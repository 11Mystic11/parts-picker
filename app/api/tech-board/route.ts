import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

// GET /api/tech-board — returns all techs with their active assigned ROs
export async function GET(_req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = session.user as { rooftopId?: string; role?: string };
  if (!user.rooftopId) return NextResponse.json({ error: "No rooftop" }, { status: 400 });

  const techs = await prisma.user.findMany({
    where: { rooftopId: user.rooftopId, role: "technician" },
    select: {
      id: true,
      name: true,
      employeeId: true,
      techRepairOrders: {
        where: { status: { notIn: ["closed", "void"] } },
        orderBy: { scheduledAt: "asc" },
        include: {
          lineItems: {
            where: { isAccepted: true },
            select: {
              id: true,
              type: true,
              description: true,
              partNumber: true,
              quantity: true,
              laborOpCode: true,
              totalPrice: true,
            },
            orderBy: { sortOrder: "asc" },
          },
        },
      },
    },
    orderBy: { name: "asc" },
  });

  // Shape the response with derived vehicle labels
  const result = techs.map((tech) => ({
    id: tech.id,
    name: tech.name,
    employeeId: tech.employeeId,
    activeRoCount: tech.techRepairOrders.length,
    ros: tech.techRepairOrders.map((ro) => {
      let vehicleLabel = "Unknown";
      try {
        const v = JSON.parse(ro.vehicleSnapshot);
        vehicleLabel = `${v.year ?? ""} ${v.make ?? ""} ${v.model ?? ""}`.trim() || ro.vin.slice(-6);
      } catch { /* ignore */ }

      const partsItems = ro.lineItems.filter((li) => li.type === "part");
      const laborItems = ro.lineItems.filter((li) => li.type === "labor");
      const estimatedHours = laborItems.reduce((sum, li) => sum + li.quantity, 0);

      return {
        id: ro.id,
        vin: ro.vin,
        vehicleLabel,
        status: ro.status,
        scheduledAt: ro.scheduledAt?.toISOString() ?? null,
        estimatedDuration: ro.estimatedDuration,
        customerName: ro.customerName,
        partsNeeded: partsItems.map((p) => ({
          description: p.description,
          partNumber: p.partNumber,
          quantity: p.quantity,
        })),
        laborOps: laborItems.map((l) => ({
          description: l.description,
          laborOpCode: l.laborOpCode,
          hours: l.quantity,
        })),
        estimatedHours: Math.round(estimatedHours * 10) / 10,
        totalValue: ro.totalAmount,
      };
    }),
  }));

  return NextResponse.json({ techs: result });
}
