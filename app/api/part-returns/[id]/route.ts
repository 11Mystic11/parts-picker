// [FEATURE: core_return_tracking]
// GET    /api/part-returns/[id] — fetch single return record
// PATCH  /api/part-returns/[id] — advance status, set tracking/credit
// DELETE /api/part-returns/[id] — delete if still pending
// Remove this file to disable.

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma as db } from "@/lib/db";
import { flagEnabled } from "@/lib/flags/evaluate";
import { z } from "zod";

type Params = { params: Promise<{ id: string }> };

const patchSchema = z.object({
  status: z.enum(["pending", "submitted", "received", "credited", "rejected"]).optional(),
  trackingNumber: z.string().optional().nullable(),
  actualCredit: z.number().min(0).optional().nullable(),
  notes: z.string().optional().nullable(),
});

export async function GET(_req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = session.user as { id: string; rooftopId?: string };
  const { id } = await params;

  const enabled = await flagEnabled("core_return_tracking" as any, user.rooftopId);
  if (!enabled) return NextResponse.json({ error: "Feature not enabled" }, { status: 403 });

  const partReturn = await db.partReturn.findUnique({
    where: { id },
    include: {
      repairOrder: { select: { roNumber: true } },
      createdBy: { select: { name: true } },
    },
  });
  if (!partReturn) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (partReturn.rooftopId !== user.rooftopId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json({ partReturn });
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = session.user as { id: string; rooftopId?: string };
  const { id } = await params;

  const enabled = await flagEnabled("core_return_tracking" as any, user.rooftopId);
  if (!enabled) return NextResponse.json({ error: "Feature not enabled" }, { status: 403 });

  const existing = await db.partReturn.findUnique({ where: { id }, select: { rooftopId: true, status: true } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (existing.rooftopId !== user.rooftopId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 });
  }

  const updateData: Record<string, unknown> = {};
  if (parsed.data.status !== undefined) {
    updateData.status = parsed.data.status;
    if (parsed.data.status === "submitted") updateData.submittedAt = new Date();
    if (parsed.data.status === "received") updateData.receivedAt = new Date();
    if (parsed.data.status === "credited") updateData.creditedAt = new Date();
  }
  if (parsed.data.trackingNumber !== undefined) updateData.trackingNumber = parsed.data.trackingNumber;
  if (parsed.data.actualCredit !== undefined) updateData.actualCredit = parsed.data.actualCredit;
  if (parsed.data.notes !== undefined) updateData.notes = parsed.data.notes;

  const updated = await db.partReturn.update({ where: { id }, data: updateData });
  return NextResponse.json({ partReturn: updated });
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = session.user as { id: string; rooftopId?: string };
  const { id } = await params;

  const enabled = await flagEnabled("core_return_tracking" as any, user.rooftopId);
  if (!enabled) return NextResponse.json({ error: "Feature not enabled" }, { status: 403 });

  const existing = await db.partReturn.findUnique({ where: { id }, select: { rooftopId: true, status: true } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (existing.rooftopId !== user.rooftopId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (existing.status !== "pending") {
    return NextResponse.json(
      { error: "Only pending returns can be deleted" },
      { status: 400 }
    );
  }

  await db.partReturn.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
