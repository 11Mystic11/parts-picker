// [FEATURE: tech_time_clock]
// GET  /api/ro/[id]/time-entries — list time entries for this RO
// POST /api/ro/[id]/time-entries — clock in (creates open entry, rejects if tech already has one)
// Remove this file to disable.

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma as db } from "@/lib/db";
import { flagEnabled } from "@/lib/flags/evaluate";
import { z } from "zod";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = session.user as { id: string; rooftopId?: string };
  const { id } = await params;

  const enabled = await flagEnabled("tech_time_clock" as any, user.rooftopId);
  if (!enabled) return NextResponse.json({ error: "This feature is not enabled. Enable it in Admin → Feature Flags." }, { status: 403 });

  const ro = await db.repairOrder.findUnique({ where: { id }, select: { rooftopId: true } });
  if (!ro) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (ro.rooftopId !== user.rooftopId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const entries = await db.timeEntry.findMany({
    where: { repairOrderId: id },
    include: { tech: { select: { id: true, name: true, employeeId: true } } },
    orderBy: { clockedInAt: "desc" },
  });

  return NextResponse.json({ entries });
}

const clockInSchema = z.object({
  lineItemId: z.string().optional().nullable(),
  flatRateHours: z.number().positive().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export async function POST(req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = session.user as { id: string; role?: string; rooftopId?: string };
  const { id } = await params;

  const enabled = await flagEnabled("tech_time_clock" as any, user.rooftopId);
  if (!enabled) return NextResponse.json({ error: "This feature is not enabled. Enable it in Admin → Feature Flags." }, { status: 403 });

  const ro = await db.repairOrder.findUnique({ where: { id }, select: { rooftopId: true } });
  if (!ro) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (ro.rooftopId !== user.rooftopId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: unknown;
  try { body = await req.json(); } catch { body = {}; }

  const parsed = clockInSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 });
  }

  // Guard: tech cannot be clocked in on multiple jobs simultaneously
  const openEntry = await db.timeEntry.findFirst({
    where: { techId: user.id, clockedOutAt: null },
    select: { id: true, repairOrderId: true },
  });

  if (openEntry) {
    if (openEntry.repairOrderId === id) {
      return NextResponse.json(
        { error: "You are already clocked in on this job" },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { error: "You are already clocked in on another job. Clock out first." },
      { status: 409 }
    );
  }

  const entry = await db.timeEntry.create({
    data: {
      repairOrderId: id,
      techId: user.id,
      lineItemId: parsed.data.lineItemId ?? null,
      flatRateHours: parsed.data.flatRateHours ?? null,
      notes: parsed.data.notes ?? null,
    },
  });

  return NextResponse.json({ entry }, { status: 201 });
}
