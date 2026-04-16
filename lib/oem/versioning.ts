import { prisma } from "@/lib/db";
import { Prisma } from "@prisma/client";

export type OEMEntityType =
  | "MaintenanceSchedule"
  | "PartsCatalog"
  | "LaborOperation"
  | "OTPRRule";

// ─── Active record lookups ────────────────────────────────────────────────────
// These replace bare findMany({ where: { oem } }) calls everywhere.
// Adding isActive: true is the only behavioral change — existing data unaffected.

export async function getActiveSchedules(oem: string) {
  return prisma.maintenanceSchedule.findMany({
    where: { oem, isActive: true },
    orderBy: { mileageInterval: "asc" },
  });
}

export async function getActiveSchedule(oem: string, mileageInterval: number) {
  return prisma.maintenanceSchedule.findFirst({
    where: { oem, mileageInterval, isActive: true },
  });
}

export async function getActiveParts(oem: string) {
  return prisma.partsCatalog.findMany({
    where: { oem, isActive: true },
  });
}

export async function getActiveLabor(oem: string) {
  return prisma.laborOperation.findMany({
    where: { oem, isActive: true },
  });
}

export async function getActiveOTPR(oem: string, mileage: number) {
  const window = mileage * 0.15;
  return prisma.oTPRRule.findMany({
    where: {
      oem,
      isActive: true,
      mileageThreshold: {
        gte: mileage - window,
        lte: mileage + window,
      },
    },
  });
}

// ─── Supersede helpers ────────────────────────────────────────────────────────
// Called inside import transactions to deactivate the previous version.

export async function deactivateSchedule(id: string, tx: typeof prisma) {
  return tx.maintenanceSchedule.update({
    where: { id },
    data: { isActive: false },
  });
}

export async function deactivatePart(id: string, tx: typeof prisma) {
  return tx.partsCatalog.update({
    where: { id },
    data: { isActive: false },
  });
}

export async function deactivateLabor(id: string, tx: typeof prisma) {
  return tx.laborOperation.update({
    where: { id },
    data: { isActive: false },
  });
}

export async function deactivateOTPR(id: string, tx: typeof prisma) {
  return tx.oTPRRule.update({
    where: { id },
    data: { isActive: false },
  });
}

// ─── Rollback ─────────────────────────────────────────────────────────────────
// Reverses all records in a committed ImportBatch:
// - marks current (batchId) records isActive=false
// - finds version-1 and marks it isActive=true again
// - marks the ImportBatch status='rolledBack'

export async function rollbackBatch(batchId: string, importedById: string) {
  const batch = await prisma.importBatch.findUnique({ where: { id: batchId } });
  if (!batch) throw new Error("Batch not found");
  if (batch.status === "rolledBack") throw new Error("Batch already rolled back");

  await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    if (batch.entityType === "MaintenanceSchedule") {
      const records = await tx.maintenanceSchedule.findMany({
        where: { importBatchId: batchId },
      });
      for (const rec of records) {
        await tx.maintenanceSchedule.update({
          where: { id: rec.id },
          data: { isActive: false },
        });
        // Reactivate previous version if it exists
        const prev = await tx.maintenanceSchedule.findFirst({
          where: {
            oem: rec.oem,
            mileageInterval: rec.mileageInterval,
            version: rec.version - 1,
          },
        });
        if (prev) {
          await tx.maintenanceSchedule.update({
            where: { id: prev.id },
            data: { isActive: true },
          });
        }
      }
    } else if (batch.entityType === "PartsCatalog") {
      const records = await tx.partsCatalog.findMany({
        where: { importBatchId: batchId },
      });
      for (const rec of records) {
        await tx.partsCatalog.update({
          where: { id: rec.id },
          data: { isActive: false },
        });
        const prev = await tx.partsCatalog.findFirst({
          where: {
            oem: rec.oem,
            partNumber: rec.partNumber,
            version: rec.version - 1,
          },
        });
        if (prev) {
          await tx.partsCatalog.update({
            where: { id: prev.id },
            data: { isActive: true },
          });
        }
      }
    } else if (batch.entityType === "LaborOperation") {
      const records = await tx.laborOperation.findMany({
        where: { importBatchId: batchId },
      });
      for (const rec of records) {
        await tx.laborOperation.update({
          where: { id: rec.id },
          data: { isActive: false },
        });
        const prev = await tx.laborOperation.findFirst({
          where: {
            oem: rec.oem,
            opCode: rec.opCode,
            version: rec.version - 1,
          },
        });
        if (prev) {
          await tx.laborOperation.update({
            where: { id: prev.id },
            data: { isActive: true },
          });
        }
      }
    } else if (batch.entityType === "OTPRRule") {
      const records = await tx.oTPRRule.findMany({
        where: { importBatchId: batchId },
      });
      for (const rec of records) {
        await tx.oTPRRule.update({
          where: { id: rec.id },
          data: { isActive: false },
        });
        const prev = await tx.oTPRRule.findFirst({
          where: {
            oem: rec.oem,
            name: rec.name,
            version: rec.version - 1,
          },
        });
        if (prev) {
          await tx.oTPRRule.update({
            where: { id: prev.id },
            data: { isActive: true },
          });
        }
      }
    }

    await tx.importBatch.update({
      where: { id: batchId },
      data: { status: "rolledBack" },
    });
  });
}
