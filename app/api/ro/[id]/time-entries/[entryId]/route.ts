// [FEATURE: tech_time_clock]
// PATCH /api/ro/[id]/time-entries/[entryId] — clock out (sets clockedOutAt)
// Remove this file to disable.

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma as db } from "@/lib/db";
import { flagEnabled } from "@/lib/flags/evaluate";

type Params = { params: Promise<{ id: string; entryId: string }> };

export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = session.user as { id: string; rooftopId?: string };
  const { id, entryId } = await params;

  const enabled = await flagEnabled("tech_time_clock" as any, user.rooftopId);
  if (!enabled) return NextResponse.json({ error: "Feature not enabled" }, { status: 403 });

  const ro = await db.repairOrder.findUnique({ where: { id }, select: { rooftopId: true } });
  if (!ro) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (ro.rooftopId !== user.rooftopId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const entry = await db.timeEntry.findUnique({ where: { id: entryId } });
  if (!entry) return NextResponse.json({ error: "Time entry not found" }, { status: 404 });
  if (entry.techId !== user.id) {
    return NextResponse.json({ error: "Not your time entry" }, { status: 403 });
  }
  if (entry.clockedOutAt) {
    return NextResponse.json({ error: "Already clocked out" }, { status: 400 });
  }

  const updated = await db.timeEntry.update({
    where: { id: entryId },
    data: { clockedOutAt: new Date() },
  });

  return NextResponse.json({ entry: updated });
}
