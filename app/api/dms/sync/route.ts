/**
 * app/api/dms/sync/route.ts
 *
 * POST /api/dms/sync  — manually trigger a DMS sync for a single RO.
 * Body: { roId: string, dryRun?: boolean }
 *
 * Access: admin | manager | developer only.
 *
 * Returns the updated RepairOrder record.
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma as db } from "@/lib/db";
import { getDMSAdapter, RepairOrderPayload } from "@/lib/dms/adapter";
import { z } from "zod";

const bodySchema = z.object({
  roId: z.string().min(1),
  dryRun: z.boolean().optional().default(false),
});

const ALLOWED_ROLES = ["admin", "manager", "developer"];

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = session.user as { id: string; role?: string; rooftopId?: string };
  if (!user.rooftopId) return NextResponse.json({ error: "No rooftop assigned" }, { status: 400 });
  if (!ALLOWED_ROLES.includes(user.role ?? "")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid request" }, { status: 400 });
  }

  const { roId, dryRun } = parsed.data;

  const ro = await db.repairOrder.findUnique({
    where: { id: roId },
    include: {
      lineItems: { orderBy: { sortOrder: "asc" } },
      advisor: { select: { name: true, employeeId: true } },
      rooftop: { select: { dmsProvider: true, dmsConfig: true } },
    },
  });

  if (!ro) return NextResponse.json({ error: "RO not found" }, { status: 404 });
  if (ro.rooftopId !== user.rooftopId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const adapter = await getDMSAdapter(ro.rooftop);

  if (!adapter) {
    return NextResponse.json(
      { error: "DMS not configured for this rooftop" },
      { status: 422 }
    );
  }

  if (dryRun) {
    return NextResponse.json({ ok: true, message: "DMS adapter found — dry run successful" });
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

  const result = await adapter.pushRO(payload);

  const updatedRo = await db.repairOrder.update({
    where: { id: roId },
    data: {
      dmsSyncStatus: result.success ? "synced" : "failed",
      dmsSyncedAt: result.success ? new Date() : undefined,
      dmsExternalId: result.success ? result.externalId : undefined,
      dmsSyncAttempts: { increment: 1 },
    },
  });

  await db.auditLog.create({
    data: {
      userId: user.id,
      rooftopId: user.rooftopId,
      repairOrderId: roId,
      action: result.success ? "ro.dms_sync.success" : "ro.dms_sync.failed",
      entityType: "RepairOrder",
      entityId: roId,
      diff: JSON.stringify({ result, triggeredBy: "manual" }),
    },
  });

  return NextResponse.json({ ro: updatedRo, result });
}
