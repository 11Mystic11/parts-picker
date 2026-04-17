import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

// Tech color palette (cycles if more than 8 techs)
const TECH_COLORS = [
  "#3b82f6", "#10b981", "#f59e0b", "#ef4444",
  "#8b5cf6", "#ec4899", "#06b6d4", "#84cc16",
];

// GET /api/calendar/events?start=ISO&end=ISO
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = session.user as { rooftopId?: string };
  if (!user.rooftopId) return NextResponse.json({ error: "No rooftop assigned" }, { status: 400 });

  const { searchParams } = new URL(req.url);
  const startParam = searchParams.get("start");
  const endParam = searchParams.get("end");

  const start = startParam ? new Date(startParam) : new Date();
  const end = endParam
    ? new Date(endParam)
    : new Date(start.getTime() + 30 * 24 * 60 * 60 * 1000);

  const ros = await prisma.repairOrder.findMany({
    where: {
      rooftopId: user.rooftopId,
      scheduledAt: { gte: start, lte: end },
      status: { notIn: ["void"] },
    },
    include: {
      advisor: { select: { id: true, name: true } },
      assignedTech: { select: { id: true, name: true } },
    },
    orderBy: { scheduledAt: "asc" },
  });

  // Assign deterministic colors per tech
  const techColorMap = new Map<string, string>();
  let colorIdx = 0;
  function getColor(techId: string | null): string {
    if (!techId) return "#94a3b8";
    if (!techColorMap.has(techId)) {
      techColorMap.set(techId, TECH_COLORS[colorIdx % TECH_COLORS.length]);
      colorIdx++;
    }
    return techColorMap.get(techId)!;
  }

  const events = ros.map((ro) => {
    const scheduledAt = ro.scheduledAt!;
    const durationMs = (ro.estimatedDuration ?? 60) * 60 * 1000;
    const endTime = new Date(scheduledAt.getTime() + durationMs);

    let vehicleLabel = "Unknown Vehicle";
    try {
      const v = JSON.parse(ro.vehicleSnapshot);
      vehicleLabel = `${v.year ?? ""} ${v.make ?? ""} ${v.model ?? ""}`.trim() || ro.vin.slice(-6);
    } catch { /* ignore */ }

    const techName = ro.assignedTech?.name ?? "Unassigned";

    return {
      id: ro.id,
      title: `${vehicleLabel}${ro.customerName ? ` · ${ro.customerName}` : ""}`,
      start: scheduledAt.toISOString(),
      end: endTime.toISOString(),
      roId: ro.id,
      status: ro.status,
      techId: ro.assignedTechId,
      techName,
      advisorName: ro.advisor.name,
      color: getColor(ro.assignedTechId),
      customerName: ro.customerName,
    };
  });

  return NextResponse.json({ events });
}
