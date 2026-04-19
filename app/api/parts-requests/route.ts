// Aggregated parts requests across all ROs for a rooftop — used by the Parts Queue page.
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = session.user as { id: string; rooftopId?: string; role?: string };
  if (!user.rooftopId) return NextResponse.json({ error: "No rooftop" }, { status: 400 });

  const status = req.nextUrl.searchParams.get("status");

  const requests = await prisma.partRequest.findMany({
    where: {
      rooftopId: user.rooftopId,
      ...(status ? { status } : { status: { not: "cancelled" } }),
    },
    include: {
      repairOrder: { select: { roNumber: true, vin: true, customerName: true } },
      requestedBy: { select: { name: true, employeeId: true } },
    },
    orderBy: [
      { status: "asc" },
      { createdAt: "desc" },
    ],
    take: 200,
  });

  return NextResponse.json({ requests });
}
