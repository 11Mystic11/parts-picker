// [FEATURE: core_return_tracking]
// GET /api/ro/[id]/part-returns — list returns associated with a specific RO
// Remove this file to disable.

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma as db } from "@/lib/db";
import { flagEnabled } from "@/lib/flags/evaluate";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = session.user as { id: string; rooftopId?: string };
  const { id } = await params;

  const enabled = await flagEnabled("core_return_tracking" as any, user.rooftopId);
  if (!enabled) return NextResponse.json({ error: "This feature is not enabled. Enable it in Admin → Feature Flags." }, { status: 403 });

  const ro = await db.repairOrder.findUnique({ where: { id }, select: { rooftopId: true } });
  if (!ro) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (ro.rooftopId !== user.rooftopId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const returns = await db.partReturn.findMany({
    where: { repairOrderId: id },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ returns });
}
