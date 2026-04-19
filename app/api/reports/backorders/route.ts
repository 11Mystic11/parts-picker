// [FEATURE: backorder_tracking]
// GET /api/reports/backorders — all open backordered parts orders for a rooftop.
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET(_req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = session.user as { id: string; rooftopId?: string };
  if (!user.rooftopId) return NextResponse.json({ error: "No rooftop" }, { status: 400 });

  const backorders = await prisma.partsOrder.findMany({
    where: {
      rooftopId: user.rooftopId,
      isBackordered: true,
      status: { not: "confirmed" },
    },
    include: {
      repairOrder: { select: { id: true, roNumber: true, vin: true, customerName: true, advisorId: true } },
    },
    orderBy: { submittedAt: "asc" },
    take: 200,
  });

  return NextResponse.json({ backorders });
}
