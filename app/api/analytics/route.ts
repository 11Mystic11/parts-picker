import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET(_req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = session.user as { id?: string; rooftopId?: string };
  const rooftopId = user.rooftopId;
  if (!rooftopId) {
    return NextResponse.json({ error: "No rooftop assigned" }, { status: 400 });
  }

  const now = new Date();
  const thirtyDaysAgo = new Date(now);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 29);
  thirtyDaysAgo.setHours(0, 0, 0, 0);

  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  // Fetch all non-void ROs in last 30 days with their line items and advisor info
  const ros = await prisma.repairOrder.findMany({
    where: {
      rooftopId,
      status: { not: "void" },
      createdAt: { gte: thirtyDaysAgo },
    },
    include: {
      advisor: { select: { id: true, name: true, email: true, employeeId: true } },
      lineItems: {
        where: { source: "recommended" },
        select: { isAccepted: true },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  // Status breakdown (all time for the rooftop, grouped)
  const statusCounts = await prisma.repairOrder.groupBy({
    by: ["status"],
    where: { rooftopId },
    _count: { _all: true },
  });

  // ── KPIs ────────────────────────────────────────────────────────────────────

  const mtdRos = ros.filter((ro) => ro.createdAt >= startOfMonth);
  const revenueMtd = mtdRos
    .filter((ro) => ro.status === "closed" || ro.status === "approved")
    .reduce((sum, ro) => sum + ro.totalAmount, 0);
  const roCountMtd = mtdRos.length;
  const avgRoValue = roCountMtd > 0 ? revenueMtd / roCountMtd : 0;

  // Upsell rate across all 30 days
  let totalRecommended = 0;
  let totalAccepted = 0;
  for (const ro of ros) {
    for (const item of ro.lineItems) {
      totalRecommended++;
      if (item.isAccepted) totalAccepted++;
    }
  }
  const upsellRate =
    totalRecommended > 0
      ? Math.round((totalAccepted / totalRecommended) * 100)
      : 0;

  // ── Trend (last 30 days by day) ─────────────────────────────────────────────

  // Build a map date → { revenue, roCount }
  const trendMap = new Map<string, { revenue: number; roCount: number }>();

  // Pre-populate all 30 days with zeroes
  for (let i = 0; i < 30; i++) {
    const d = new Date(thirtyDaysAgo);
    d.setDate(d.getDate() + i);
    const key = d.toISOString().slice(0, 10);
    trendMap.set(key, { revenue: 0, roCount: 0 });
  }

  for (const ro of ros) {
    const key = ro.createdAt.toISOString().slice(0, 10);
    const entry = trendMap.get(key);
    if (entry) {
      entry.roCount++;
      if (ro.status === "closed" || ro.status === "approved") {
        entry.revenue += ro.totalAmount;
      }
    }
  }

  const trend = Array.from(trendMap.entries()).map(([date, val]) => ({
    date,
    revenue: Math.round(val.revenue * 100) / 100,
    roCount: val.roCount,
  }));

  // ── By Advisor ───────────────────────────────────────────────────────────────

  const advisorMap = new Map<
    string,
    {
      advisorId: string;
      name: string;
      employeeId: string | null;
      roCount: number;
      totalRevenue: number;
      recommended: number;
      accepted: number;
    }
  >();

  for (const ro of ros) {
    const id = ro.advisorId;
    if (!advisorMap.has(id)) {
      advisorMap.set(id, {
        advisorId: id,
        name: ro.advisor.name ?? ro.advisor.email ?? id,
        employeeId: ro.advisor.employeeId ?? null,
        roCount: 0,
        totalRevenue: 0,
        recommended: 0,
        accepted: 0,
      });
    }
    const entry = advisorMap.get(id)!;
    entry.roCount++;
    if (ro.status === "closed" || ro.status === "approved") {
      entry.totalRevenue += ro.totalAmount;
    }
    for (const item of ro.lineItems) {
      entry.recommended++;
      if (item.isAccepted) entry.accepted++;
    }
  }

  const byAdvisor = Array.from(advisorMap.values()).map((a) => ({
    advisorId: a.advisorId,
    name: a.name,
    employeeId: a.employeeId,
    roCount: a.roCount,
    totalRevenue: Math.round(a.totalRevenue * 100) / 100,
    avgValue:
      a.roCount > 0 ? Math.round((a.totalRevenue / a.roCount) * 100) / 100 : 0,
    upsellRate:
      a.recommended > 0
        ? Math.round((a.accepted / a.recommended) * 100)
        : 0,
  }));

  // Sort advisors by total revenue descending
  byAdvisor.sort((a, b) => b.totalRevenue - a.totalRevenue);

  // ── Status Breakdown ─────────────────────────────────────────────────────────

  const statusBreakdown = statusCounts.map((s) => ({
    status: s.status,
    count: s._count._all,
  }));

  return NextResponse.json({
    kpis: {
      revenueMtd: Math.round(revenueMtd * 100) / 100,
      roCountMtd,
      avgRoValue: Math.round(avgRoValue * 100) / 100,
      upsellRate,
    },
    trend,
    byAdvisor,
    statusBreakdown,
  });
}
