import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { z } from "zod";
import { prisma as db } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { getPartsForServices } from "@/lib/parts/recommend";
import { getLaborForServices } from "@/lib/labor/lookup";
import { calculateRO, DEFAULT_PRICING_TIERS, PricingTier } from "@/lib/pricing/calculate";
import { VehicleData } from "@/lib/vin/normalize";

const createSchema = z.object({
  vin: z.string().length(17),
  mileage: z.number().int().min(0),
  selectedServiceIds: z.array(z.string()).min(1),
  notes: z.string().optional(),
});

// POST /api/ro — create a draft RO with line items
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = session.user as { id: string; rooftopId?: string };
  if (!user.rooftopId) {
    return NextResponse.json({ error: "No rooftop assigned to user" }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request" },
      { status: 400 }
    );
  }

  const { vin, mileage, selectedServiceIds, notes } = parsed.data;

  // Load vehicle from cache
  const cached = await db.vehicleCache.findUnique({ where: { vin: vin.toUpperCase() } });
  if (!cached) {
    return NextResponse.json({ error: "Vehicle not found — decode the VIN first" }, { status: 400 });
  }

  const vehicle: VehicleData = {
    vin: cached.vin,
    make: cached.make,
    model: cached.model,
    year: cached.year,
    engine: cached.engine,
    drivetrain: cached.drivetrain,
    trim: cached.trim,
    oem: cached.oem,
  };

  const oem = vehicle.oem;
  if (!oem) {
    return NextResponse.json({ error: "Vehicle OEM not recognized" }, { status: 400 });
  }

  // Load rooftop config
  const rooftop = await db.rooftop.findUnique({
    where: { id: user.rooftopId },
    include: { pricingMatrix: true },
  });
  if (!rooftop) return NextResponse.json({ error: "Rooftop not found" }, { status: 404 });

  let tiers: PricingTier[] = DEFAULT_PRICING_TIERS;
  const matrix = rooftop.pricingMatrix[0];
  if (matrix) {
    try { tiers = JSON.parse(matrix.tiers); } catch { /* use defaults */ }
  }

  // Resolve parts + labor and calculate
  const [parts, laborOps] = await Promise.all([
    getPartsForServices(oem, selectedServiceIds, vehicle),
    getLaborForServices(oem, selectedServiceIds, vehicle),
  ]);

  const summary = calculateRO(
    parts,
    laborOps,
    tiers,
    rooftop.laborRate,
    rooftop.taxRate,
    rooftop.shopSupplyPct,
    rooftop.shopSupplyCap
  );

  // Create RO + line items in a transaction
  const ro = await db.$transaction(async (tx: Prisma.TransactionClient) => {
    const newRo = await tx.repairOrder.create({
      data: {
        rooftopId: user.rooftopId!,
        advisorId: user.id,
        vin: vehicle.vin,
        vehicleSnapshot: JSON.stringify(vehicle),
        currentMileage: mileage,
        status: "draft",
        wizardStep: 3,
        partsSubtotal: summary.partsSubtotal,
        laborSubtotal: summary.laborSubtotal,
        shopSupplyFee: summary.shopSupplyFee,
        taxAmount: summary.taxAmount,
        totalAmount: summary.total,
        notes: notes ?? null,
      },
    });

    if (summary.lineItems.length > 0) {
      await tx.rOLineItem.createMany({
        data: summary.lineItems.map((li, i) => ({
          repairOrderId: newRo.id,
          type: li.type,
          source: li.source,
          serviceId: li.serviceId ?? null,
          partNumber: li.partNumber ?? null,
          laborOpCode: li.laborOpCode ?? null,
          description: li.description,
          quantity: li.quantity,
          unitCost: li.unitCost,
          unitPrice: li.unitPrice,
          totalPrice: li.totalPrice,
          isAccepted: true,
          sortOrder: i,
        })),
      });
    }

    await tx.auditLog.create({
      data: {
        userId: user.id,
        rooftopId: user.rooftopId!,
        repairOrderId: newRo.id,
        action: "ro.created",
        entityType: "RepairOrder",
        entityId: newRo.id,
      },
    });

    return newRo;
  });

  return NextResponse.json({ ro: { id: ro.id, status: ro.status, totalAmount: ro.totalAmount } }, { status: 201 });
}

// GET /api/ro — list ROs for the current rooftop
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = session.user as { id: string; role?: string; rooftopId?: string };
  if (!user.rooftopId) return NextResponse.json({ error: "No rooftop assigned" }, { status: 400 });

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const limit = Math.min(100, parseInt(searchParams.get("limit") ?? "50", 10));

  const ros = await db.repairOrder.findMany({
    where: {
      rooftopId: user.rooftopId,
      ...(status ? { status } : {}),
    },
    include: {
      advisor: { select: { name: true, email: true } },
    },
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  return NextResponse.json({ ros });
}
