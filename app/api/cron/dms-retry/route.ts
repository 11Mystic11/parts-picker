/**
 * app/api/cron/dms-retry/route.ts
 *
 * GET /api/cron/dms-retry
 *
 * Retries failed DMS syncs (dmsSyncStatus = "failed", dmsSyncAttempts < 3).
 * Secured by Authorization: Bearer {CRON_SECRET}.
 *
 * Designed to run every 15 minutes via Vercel Cron or an external scheduler.
 * Add to vercel.json crons array:
 *   path: /api/cron/dms-retry   schedule: every 15 minutes
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma as db } from "@/lib/db";
import { getDMSAdapter, RepairOrderPayload } from "@/lib/dms/adapter";

const MAX_ATTEMPTS = 3;

export async function GET(req: NextRequest) {
  // Auth: verify cron secret
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.get("authorization");

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Find all failed ROs that haven't exhausted retries
  const failedROs = await db.repairOrder.findMany({
    where: {
      dmsSyncStatus: "failed",
      dmsSyncAttempts: { lt: MAX_ATTEMPTS },
    },
    include: {
      lineItems: { orderBy: { sortOrder: "asc" } },
      advisor: { select: { name: true, employeeId: true } },
      rooftop: { select: { dmsProvider: true, dmsConfig: true } },
    },
    take: 50, // safety cap per cron run
  });

  if (failedROs.length === 0) {
    return NextResponse.json({ processed: 0, message: "No failed syncs to retry" });
  }

  const results: Array<{ roId: string; success: boolean; error?: string }> = [];

  for (const ro of failedROs) {
    const adapter = await getDMSAdapter(ro.rooftop);
    if (!adapter) {
      results.push({ roId: ro.id, success: false, error: "No adapter" });
      continue;
    }

    const payload: RepairOrderPayload = {
      roId: ro.id,
      vin: ro.vin,
      advisorName: ro.advisor.name ?? "Unknown",
      advisorEmployeeId: ro.advisor.employeeId,
      currentMileage: ro.currentMileage,
      status: ro.status,
      partsSubtotal: ro.partsSubtotal,
      laborSubtotal: ro.laborSubtotal,
      shopSupplyFee: ro.shopSupplyFee,
      taxAmount: ro.taxAmount,
      totalAmount: ro.totalAmount,
      notes: ro.notes,
      lineItems: ro.lineItems.map((li) => ({
        type: li.type,
        description: li.description,
        partNumber: li.partNumber,
        laborOpCode: li.laborOpCode,
        quantity: li.quantity,
        unitPrice: li.unitPrice,
        totalPrice: li.totalPrice,
      })),
      createdAt: ro.createdAt,
    };

    try {
      const result = await adapter.pushRO(payload);

      await db.repairOrder.update({
        where: { id: ro.id },
        data: {
          dmsSyncStatus: result.success ? "synced" : "failed",
          dmsSyncedAt: result.success ? new Date() : undefined,
          dmsExternalId: result.success ? result.externalId : undefined,
          dmsSyncAttempts: { increment: 1 },
        },
      });

      // Mark as permanently failed after max attempts
      const newAttempts = ro.dmsSyncAttempts + 1;
      if (!result.success && newAttempts >= MAX_ATTEMPTS) {
        await db.auditLog.create({
          data: {
            rooftopId: ro.rooftopId,
            repairOrderId: ro.id,
            action: "ro.dms_sync.exhausted",
            entityType: "RepairOrder",
            entityId: ro.id,
            diff: JSON.stringify({ attempts: newAttempts, lastError: result.error }),
          },
        });
      }

      results.push({ roId: ro.id, success: result.success, error: result.success ? undefined : result.error });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      results.push({ roId: ro.id, success: false, error: msg });

      await db.repairOrder.update({
        where: { id: ro.id },
        data: { dmsSyncAttempts: { increment: 1 } },
      });
    }
  }

  const succeeded = results.filter((r) => r.success).length;
  const failed = results.filter((r) => !r.success).length;

  return NextResponse.json({
    processed: results.length,
    succeeded,
    failed,
    results,
  });
}
