import { z } from "zod";
import { prisma } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { OEMEntityType } from "./versioning";

// ─── Zod schemas for each entity type ────────────────────────────────────────

export const MaintenanceScheduleImportSchema = z.object({
  oem: z.string().min(1),
  mileageInterval: z.number().int().positive(),
  serviceDefinitions: z.array(z.record(z.string(), z.unknown())), // validated as JSON array
  notes: z.string().optional(),
});

export const PartsCatalogImportSchema = z.object({
  oem: z.string().min(1),
  partNumber: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional(),
  defaultCost: z.number().min(0),
  conditions: z.record(z.string(), z.unknown()).optional().default({}),
  serviceIds: z.array(z.string()).optional().default([]),
  quantityRule: z.string().optional().default("1"),
  isKit: z.boolean().optional().default(false),
  kitParts: z.array(z.string()).optional().default([]),
});

export const LaborOperationImportSchema = z.object({
  oem: z.string().min(1),
  opCode: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional(),
  flatRateHours: z.number().min(0),
  serviceIds: z.array(z.string()).optional().default([]),
  conditions: z.record(z.string(), z.unknown()).optional().default({}),
});

export const OTPRRuleImportSchema = z.object({
  oem: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional(),
  serviceCategory: z.string().min(1),
  mileageThreshold: z.number().int().positive(),
  partNumbers: z.array(z.string()).optional().default([]),
  urgencyTier: z.enum(["urgent", "suggested", "informational"]).optional().default("suggested"),
  conditions: z.record(z.string(), z.unknown()).optional().default({}),
});

// ─── Types ────────────────────────────────────────────────────────────────────

export type ImportRecord = {
  action: "new" | "update";
  key: string; // human-readable key (e.g. "GM / 5000")
  record: unknown;
  currentVersion?: number;
  changes?: DiffEntry[];
};

export type DiffEntry = {
  field: string;
  from: unknown;
  to: unknown;
};

export type ImportPreview = {
  entityType: OEMEntityType;
  records: ImportRecord[];
  newCount: number;
  updateCount: number;
  errors: string[];
};

// ─── Validation ───────────────────────────────────────────────────────────────

export function validateRecords(
  entityType: OEMEntityType,
  rawRecords: unknown[]
): { valid: unknown[]; errors: string[] } {
  const schema =
    entityType === "MaintenanceSchedule"
      ? MaintenanceScheduleImportSchema
      : entityType === "PartsCatalog"
      ? PartsCatalogImportSchema
      : entityType === "LaborOperation"
      ? LaborOperationImportSchema
      : OTPRRuleImportSchema;

  const valid: unknown[] = [];
  const errors: string[] = [];

  rawRecords.forEach((raw, idx) => {
    const result = schema.safeParse(raw);
    if (result.success) {
      valid.push(result.data);
    } else {
      errors.push(
        `Record ${idx + 1}: ${result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join(", ")}`
      );
    }
  });

  return { valid, errors };
}

// ─── Preview (dry-run) ────────────────────────────────────────────────────────

export async function previewImport(
  entityType: OEMEntityType,
  rawRecords: unknown[]
): Promise<ImportPreview> {
  const { valid, errors } = validateRecords(entityType, rawRecords);
  const records: ImportRecord[] = [];

  for (const rec of valid) {
    const r = rec as Record<string, unknown>;

    if (entityType === "MaintenanceSchedule") {
      const existing = await prisma.maintenanceSchedule.findFirst({
        where: {
          oem: r.oem as string,
          mileageInterval: r.mileageInterval as number,
          isActive: true,
        },
      });
      const key = `${r.oem} / ${r.mileageInterval}mi`;
      if (!existing) {
        records.push({ action: "new", key, record: rec });
      } else {
        const changes = diffSchedule(existing, r);
        records.push({
          action: "update",
          key,
          record: rec,
          currentVersion: existing.version,
          changes,
        });
      }
    } else if (entityType === "PartsCatalog") {
      const existing = await prisma.partsCatalog.findFirst({
        where: {
          oem: r.oem as string,
          partNumber: r.partNumber as string,
          isActive: true,
        },
      });
      const key = `${r.oem} / ${r.partNumber}`;
      if (!existing) {
        records.push({ action: "new", key, record: rec });
      } else {
        const changes = diffPart(existing, r);
        records.push({
          action: "update",
          key,
          record: rec,
          currentVersion: existing.version,
          changes,
        });
      }
    } else if (entityType === "LaborOperation") {
      const existing = await prisma.laborOperation.findFirst({
        where: {
          oem: r.oem as string,
          opCode: r.opCode as string,
          isActive: true,
        },
      });
      const key = `${r.oem} / ${r.opCode}`;
      if (!existing) {
        records.push({ action: "new", key, record: rec });
      } else {
        const changes = diffLabor(existing, r);
        records.push({
          action: "update",
          key,
          record: rec,
          currentVersion: existing.version,
          changes,
        });
      }
    } else if (entityType === "OTPRRule") {
      const existing = await prisma.oTPRRule.findFirst({
        where: {
          oem: r.oem as string,
          name: r.name as string,
          isActive: true,
        },
      });
      const key = `${r.oem} / ${r.name}`;
      if (!existing) {
        records.push({ action: "new", key, record: rec });
      } else {
        const changes = diffOTPR(existing, r);
        records.push({
          action: "update",
          key,
          record: rec,
          currentVersion: existing.version,
          changes,
        });
      }
    }
  }

  return {
    entityType,
    records,
    newCount: records.filter((r) => r.action === "new").length,
    updateCount: records.filter((r) => r.action === "update").length,
    errors,
  };
}

// ─── Commit ───────────────────────────────────────────────────────────────────

export async function commitImport(
  entityType: OEMEntityType,
  rawRecords: unknown[],
  importedById: string
): Promise<{ batchId: string; newCount: number; updatedCount: number; errors: string[] }> {
  const { valid, errors } = validateRecords(entityType, rawRecords);
  if (errors.length > 0) {
    throw new Error(`Validation failed: ${errors.join("; ")}`);
  }

  let newCount = 0;
  let updatedCount = 0;
  const batchId = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    // Create the batch record first to get its ID
    const batch = await tx.importBatch.create({
      data: {
        importedById,
        entityType,
        recordCount: valid.length,
        status: "committed",
      },
    });

    for (const rec of valid) {
      const r = rec as Record<string, unknown>;

      if (entityType === "MaintenanceSchedule") {
        const existing = await tx.maintenanceSchedule.findFirst({
          where: {
            oem: r.oem as string,
            mileageInterval: r.mileageInterval as number,
            isActive: true,
          },
        });
        const nextVersion = existing ? existing.version + 1 : 1;
        if (existing) {
          await tx.maintenanceSchedule.update({
            where: { id: existing.id },
            data: { isActive: false },
          });
          updatedCount++;
        } else {
          newCount++;
        }
        await tx.maintenanceSchedule.create({
          data: {
            oem: r.oem as string,
            mileageInterval: r.mileageInterval as number,
            serviceDefinitions: JSON.stringify(r.serviceDefinitions),
            notes: r.notes as string | undefined,
            version: nextVersion,
            isActive: true,
            effectiveDate: new Date(),
            importBatchId: batch.id,
          },
        });
      } else if (entityType === "PartsCatalog") {
        const existing = await tx.partsCatalog.findFirst({
          where: {
            oem: r.oem as string,
            partNumber: r.partNumber as string,
            isActive: true,
          },
        });
        const nextVersion = existing ? existing.version + 1 : 1;
        if (existing) {
          await tx.partsCatalog.update({
            where: { id: existing.id },
            data: { isActive: false },
          });
          updatedCount++;
        } else {
          newCount++;
        }
        await tx.partsCatalog.create({
          data: {
            oem: r.oem as string,
            partNumber: r.partNumber as string,
            name: r.name as string,
            description: r.description as string | undefined,
            defaultCost: r.defaultCost as number,
            conditions: JSON.stringify(r.conditions ?? {}),
            serviceIds: JSON.stringify(r.serviceIds ?? []),
            quantityRule: r.quantityRule as string,
            isKit: r.isKit as boolean,
            kitParts: JSON.stringify(r.kitParts ?? []),
            version: nextVersion,
            isActive: true,
            effectiveDate: new Date(),
            importBatchId: batch.id,
          },
        });
      } else if (entityType === "LaborOperation") {
        const existing = await tx.laborOperation.findFirst({
          where: {
            oem: r.oem as string,
            opCode: r.opCode as string,
            isActive: true,
          },
        });
        const nextVersion = existing ? existing.version + 1 : 1;
        if (existing) {
          await tx.laborOperation.update({
            where: { id: existing.id },
            data: { isActive: false },
          });
          updatedCount++;
        } else {
          newCount++;
        }
        await tx.laborOperation.create({
          data: {
            oem: r.oem as string,
            opCode: r.opCode as string,
            name: r.name as string,
            description: r.description as string | undefined,
            flatRateHours: r.flatRateHours as number,
            serviceIds: JSON.stringify(r.serviceIds ?? []),
            conditions: JSON.stringify(r.conditions ?? {}),
            version: nextVersion,
            isActive: true,
            effectiveDate: new Date(),
            importBatchId: batch.id,
          },
        });
      } else if (entityType === "OTPRRule") {
        const existing = await tx.oTPRRule.findFirst({
          where: {
            oem: r.oem as string,
            name: r.name as string,
            isActive: true,
          },
        });
        const nextVersion = existing ? existing.version + 1 : 1;
        if (existing) {
          await tx.oTPRRule.update({
            where: { id: existing.id },
            data: { isActive: false },
          });
          updatedCount++;
        } else {
          newCount++;
        }
        await tx.oTPRRule.create({
          data: {
            oem: r.oem as string,
            name: r.name as string,
            description: r.description as string | undefined,
            serviceCategory: r.serviceCategory as string,
            mileageThreshold: r.mileageThreshold as number,
            partNumbers: JSON.stringify(r.partNumbers ?? []),
            urgencyTier: r.urgencyTier as string,
            conditions: JSON.stringify(r.conditions ?? {}),
            isActive: true,
            version: nextVersion,
            effectiveDate: new Date(),
            importBatchId: batch.id,
          },
        });
      }
    }

    // Update counts on the batch
    await tx.importBatch.update({
      where: { id: batch.id },
      data: { newCount, updatedCount: updatedCount },
    });

    return batch.id;
  });

  return { batchId, newCount, updatedCount, errors };
}

// ─── Diff helpers ─────────────────────────────────────────────────────────────

function diffSchedule(existing: Record<string, unknown>, incoming: Record<string, unknown>): DiffEntry[] {
  const changes: DiffEntry[] = [];
  const existingDefs = (() => { try { return JSON.stringify(existing.serviceDefinitions); } catch { return existing.serviceDefinitions; } })();
  const incomingDefs = JSON.stringify(incoming.serviceDefinitions);
  if (existingDefs !== incomingDefs) changes.push({ field: "serviceDefinitions", from: "(previous)", to: "(new)" });
  if (existing.notes !== (incoming.notes ?? null)) changes.push({ field: "notes", from: existing.notes, to: incoming.notes });
  return changes;
}

function diffPart(existing: Record<string, unknown>, incoming: Record<string, unknown>): DiffEntry[] {
  const changes: DiffEntry[] = [];
  const fields: (keyof typeof incoming)[] = ["name", "description", "defaultCost", "quantityRule", "isKit"];
  for (const f of fields) {
    if (existing[f as string] !== incoming[f]) changes.push({ field: f as string, from: existing[f as string], to: incoming[f] });
  }
  const existingSvc = existing.serviceIds;
  const incomingSvc = JSON.stringify(incoming.serviceIds);
  if (existingSvc !== incomingSvc) changes.push({ field: "serviceIds", from: existing.serviceIds, to: incoming.serviceIds });
  return changes;
}

function diffLabor(existing: Record<string, unknown>, incoming: Record<string, unknown>): DiffEntry[] {
  const changes: DiffEntry[] = [];
  const fields: string[] = ["name", "description", "flatRateHours"];
  for (const f of fields) {
    if (existing[f] !== incoming[f]) changes.push({ field: f, from: existing[f], to: incoming[f] });
  }
  if (existing.serviceIds !== JSON.stringify(incoming.serviceIds)) {
    changes.push({ field: "serviceIds", from: existing.serviceIds, to: incoming.serviceIds });
  }
  return changes;
}

function diffOTPR(existing: Record<string, unknown>, incoming: Record<string, unknown>): DiffEntry[] {
  const changes: DiffEntry[] = [];
  const fields: string[] = ["description", "serviceCategory", "mileageThreshold", "urgencyTier"];
  for (const f of fields) {
    if (existing[f] !== incoming[f]) changes.push({ field: f, from: existing[f], to: incoming[f] });
  }
  if (existing.partNumbers !== JSON.stringify(incoming.partNumbers)) {
    changes.push({ field: "partNumbers", from: existing.partNumbers, to: incoming.partNumbers });
  }
  return changes;
}
