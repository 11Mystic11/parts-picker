// Global search API — ROs, inventory, and navigation
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = session.user as { id: string; rooftopId?: string };
  if (!user.rooftopId) return NextResponse.json({ error: "No rooftop" }, { status: 400 });

  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (q.length < 1) return NextResponse.json({ ros: [], inventory: [] });

  const [ros, inventory] = await Promise.all([
    prisma.repairOrder.findMany({
      where: {
        rooftopId: user.rooftopId,
        OR: [
          { roNumber: { contains: q, mode: "insensitive" } },
          { vin: { contains: q, mode: "insensitive" } },
          { customerName: { contains: q, mode: "insensitive" } },
          { customerPhone: { contains: q, mode: "insensitive" } },
        ],
      },
      select: { id: true, roNumber: true, vin: true, customerName: true, status: true },
      take: 6,
      orderBy: { updatedAt: "desc" },
    }),
    prisma.partInventory.findMany({
      where: {
        rooftopId: user.rooftopId,
        isActive: true,
        OR: [
          { partNumber: { contains: q, mode: "insensitive" } },
          { description: { contains: q, mode: "insensitive" } },
        ],
      },
      select: { id: true, partNumber: true, description: true, quantityOnHand: true, category: true },
      take: 6,
      orderBy: { updatedAt: "desc" },
    }),
  ]);

  return NextResponse.json({ ros, inventory });
}
