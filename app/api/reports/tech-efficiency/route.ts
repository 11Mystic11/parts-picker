// [FEATURE: tech_time_clock]
// GET /api/reports/tech-efficiency — aggregate actual vs flat-rate hours per tech.
// Query params: ?from=ISO&to=ISO (defaults to last 30 days)
// Remove this file to disable.

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma as db } from "@/lib/db";
import { flagEnabled } from "@/lib/flags/evaluate";
import { calcEfficiency } from "@/lib/timeclock/efficiency";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = session.user as { id: string; role?: string; rooftopId?: string };

  if (!["admin", "manager", "developer"].includes(user.role ?? "")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const enabled = await flagEnabled("tech_time_clock" as any, user.rooftopId);
  if (!enabled) return NextResponse.json({ error: "Feature not enabled" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const fromParam = searchParams.get("from");
  const toParam = searchParams.get("to");

  const now = new Date();
  const from = fromParam ? new Date(fromParam) : new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const to = toParam ? new Date(toParam) : now;

  const entries = await db.timeEntry.findMany({
    where: {
      repairOrder: { rooftopId: user.rooftopId! },
      clockedInAt: { gte: from, lte: to },
    },
    include: { tech: { select: { id: true, name: true } } },
    orderBy: { clockedInAt: "asc" },
  });

  const efficiencyData = calcEfficiency(
    entries.map((e) => ({
      techId: e.techId,
      techName: e.tech.name,
      clockedInAt: e.clockedInAt,
      clockedOutAt: e.clockedOutAt,
      flatRateHours: e.flatRateHours,
    }))
  );

  return NextResponse.json({
    from: from.toISOString(),
    to: to.toISOString(),
    efficiency: efficiencyData,
    rawEntries: entries.map((e) => ({
      id: e.id,
      techId: e.techId,
      techName: e.tech.name,
      repairOrderId: e.repairOrderId,
      lineItemId: e.lineItemId,
      clockedInAt: e.clockedInAt.toISOString(),
      clockedOutAt: e.clockedOutAt?.toISOString() ?? null,
      flatRateHours: e.flatRateHours,
      notes: e.notes,
    })),
  });
}
