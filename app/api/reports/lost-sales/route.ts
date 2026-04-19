// [FEATURE: lost_sales]
// Lost sales report — declined line items with revenue impact and decline reasons.
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
    d.setDate(d.getDate() - 30);
    return d;
  })();
  const endDate = params.get("endDate") ? new Date(params.get("endDate")!) : new Date();

  const decisions = await prisma.rOLineItemDecision.findMany({
    where: {
      decision: "declined",
      decidedAt: { gte: startDate, lte: endDate },
      repairOrder: { rooftopId: user.rooftopId },
    },
    include: {
      lineItem: { select: { description: true, totalPrice: true, type: true } },
      repairOrder: {
        select: {
          roNumber: true,
          id: true,
          advisor: { select: { name: true } },
        },
      },
    },
    orderBy: { decidedAt: "desc" },
  });

  // Aggregate by reason
  const byReason: Record<string, { count: number; revenue: number }> = {};
  let totalRevenue = 0;
  for (const d of decisions) {
    const reason = d.declineReason ?? "other";
    if (!byReason[reason]) byReason[reason] = { count: 0, revenue: 0 };
    const price = d.lineItem?.totalPrice ?? 0;
    byReason[reason].count++;
    byReason[reason].revenue += price;
    totalRevenue += price;
  }

  // Aggregate by advisor
  const byAdvisor: Record<string, { name: string; count: number; revenue: number }> = {};
  for (const d of decisions) {
    const advisorName = d.repairOrder.advisor?.name ?? "Unknown";
    if (!byAdvisor[advisorName]) byAdvisor[advisorName] = { name: advisorName, count: 0, revenue: 0 };
    byAdvisor[advisorName].count++;
    byAdvisor[advisorName].revenue += d.lineItem?.totalPrice ?? 0;
  }

  return NextResponse.json({
    totalRevenue,
    totalCount: decisions.length,
    byReason: Object.entries(byReason).map(([reason, data]) => ({ reason, ...data })),
    byAdvisor: Object.values(byAdvisor).sort((a, b) => b.revenue - a.revenue),
    decisions: decisions.slice(0, 100),
  });
}
