// [FEATURE: tech_pay]
// Tech pay summary report — flat-rate hours vs actual hours per tech for a date range.
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = session.user as { id: string; rooftopId?: string; role?: string };
  if (!user.rooftopId) return NextResponse.json({ error: "No rooftop" }, { status: 400 });
  if (!["admin", "manager"].includes(user.role ?? "")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const params = req.nextUrl.searchParams;
  const startDate = params.get("startDate") ? new Date(params.get("startDate")!) : (() => {
    const d = new Date();
    d.setDate(d.getDate() - 14);
    return d;
  })();
  const endDate = params.get("endDate") ? new Date(params.get("endDate")!) : new Date();

  // Fetch time entries in range for this rooftop
  const entries = await prisma.timeEntry.findMany({
    where: {
      clockedInAt: { gte: startDate, lte: endDate },
      repairOrder: { rooftopId: user.rooftopId },
    },
    include: {
      tech: { select: { id: true, name: true, employeeId: true } },
      repairOrder: { select: { status: true, roType: true } },
    },
  });

  // Fetch flat-rate hours from closed RO line items for this period
  const closedRos = await prisma.repairOrder.findMany({
    where: {
      rooftopId: user.rooftopId,
      status: "closed",
      closedAt: { gte: startDate, lte: endDate },
      assignedTechId: { not: null },
    },
    select: {
      assignedTechId: true,
      roType: true,
      lineItems: {
        where: { type: "labor" },
        select: { totalPrice: true },
      },
    },
  });

  // Group by tech
  const techMap: Record<string, {
    techId: string;
    name: string;
    employeeId: string | null;
    actualMs: number;
    flatRateHoursProduced: number;
    entries: number;
  }> = {};

  for (const e of entries) {
    const techId = e.techId;
    if (!techMap[techId]) {
      techMap[techId] = {
        techId,
        name: e.tech.name ?? "Unknown",
        employeeId: e.tech.employeeId,
        actualMs: 0,
        flatRateHoursProduced: 0,
        entries: 0,
      };
    }
    techMap[techId].entries++;
    if (e.clockedOutAt) {
      techMap[techId].actualMs += new Date(e.clockedOutAt).getTime() - new Date(e.clockedInAt).getTime();
    }
    if (e.flatRateHours) {
      techMap[techId].flatRateHoursProduced += e.flatRateHours;
    }
  }

  const techs = Object.values(techMap).map((t) => ({
    ...t,
    actualHours: parseFloat((t.actualMs / 3_600_000).toFixed(2)),
    efficiency: t.actualMs > 0
      ? parseFloat(((t.flatRateHoursProduced / (t.actualMs / 3_600_000)) * 100).toFixed(1))
      : null,
  }));

  return NextResponse.json({ techs, startDate: startDate.toISOString(), endDate: endDate.toISOString() });
}
