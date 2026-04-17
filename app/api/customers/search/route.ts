import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

// GET /api/customers/search?q=...
// Returns ROs grouped by (vin + customerName), acting as a customer/vehicle history lookup
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = session.user as { rooftopId?: string };
  if (!user.rooftopId) return NextResponse.json({ error: "No rooftop" }, { status: 400 });

  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") ?? "").trim();

  if (q.length < 2) {
    return NextResponse.json({ customers: [] });
  }

  const qLower = q.toLowerCase();

  // Fetch matching ROs (search by customerName, customerPhone, vin)
  const ros = await prisma.repairOrder.findMany({
    where: {
      rooftopId: user.rooftopId,
      OR: [
        { customerName: { contains: q, mode: "insensitive" } },
        { customerPhone: { contains: q, mode: "insensitive" } },
        { vin: { contains: q, mode: "insensitive" } },
      ],
    },
    select: {
      id: true,
      vin: true,
      vehicleSnapshot: true,
      status: true,
      totalAmount: true,
      createdAt: true,
      customerName: true,
      customerPhone: true,
      customerEmail: true,
      lineItems: {
        where: { isAccepted: true, type: { in: ["service", "labor"] } },
        select: { description: true },
        take: 3,
        orderBy: { sortOrder: "asc" },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  // Group by VIN (primary key for vehicle history)
  type CustomerGroup = {
    vin: string;
    vehicleLabel: string;
    customerName: string | null;
    customerPhone: string | null;
    customerEmail: string | null;
    lastVisit: string;
    roCount: number;
    totalSpend: number;
    ros: {
      id: string;
      status: string;
      total: number;
      date: string;
      services: string[];
    }[];
  };

  const groupMap = new Map<string, CustomerGroup>();

  for (const ro of ros) {
    const key = ro.vin;
    let vehicleLabel = "Unknown Vehicle";
    try {
      const v = JSON.parse(ro.vehicleSnapshot);
      vehicleLabel = `${v.year ?? ""} ${v.make ?? ""} ${v.model ?? ""}`.trim() || ro.vin.slice(-6);
    } catch { /* ignore */ }

    if (!groupMap.has(key)) {
      groupMap.set(key, {
        vin: ro.vin,
        vehicleLabel,
        customerName: ro.customerName,
        customerPhone: ro.customerPhone,
        customerEmail: ro.customerEmail,
        lastVisit: ro.createdAt.toISOString(),
        roCount: 0,
        totalSpend: 0,
        ros: [],
      });
    }

    const group = groupMap.get(key)!;
    group.roCount++;
    if (ro.status === "closed" || ro.status === "approved") {
      group.totalSpend += ro.totalAmount;
    }
    // Keep most recent contact info
    if (ro.customerName && !group.customerName) group.customerName = ro.customerName;
    if (ro.customerPhone && !group.customerPhone) group.customerPhone = ro.customerPhone;
    if (ro.customerEmail && !group.customerEmail) group.customerEmail = ro.customerEmail;

    group.ros.push({
      id: ro.id,
      status: ro.status,
      total: ro.totalAmount,
      date: ro.createdAt.toISOString(),
      services: ro.lineItems.map((li) => li.description),
    });
  }

  const customers = Array.from(groupMap.values())
    .sort((a, b) => new Date(b.lastVisit).getTime() - new Date(a.lastVisit).getTime());

  return NextResponse.json({ customers });
}
