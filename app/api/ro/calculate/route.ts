import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { z } from "zod";
import { prisma as db } from "@/lib/db";
import { getPartsForServices } from "@/lib/parts/recommend";
import { getLaborForServices } from "@/lib/labor/lookup";
import { calculateRO, DEFAULT_PRICING_TIERS, PricingTier } from "@/lib/pricing/calculate";
import { VehicleData } from "@/lib/vin/normalize";

const bodySchema = z.object({
  vin: z.string().length(17),
  selectedServiceIds: z.array(z.string()).min(1),
});

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request" },
      { status: 400 }
    );
  }

  const { vin, selectedServiceIds } = parsed.data;

  // Load vehicle from cache (must have been decoded first)
  const cached = await db.vehicleCache.findUnique({ where: { vin: vin.toUpperCase() } });
  if (!cached) {
    return NextResponse.json(
      { error: "Vehicle not found — decode the VIN first" },
      { status: 400 }
    );
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

  // Load rooftop config from session user
  const rooftopId = (session.user as { rooftopId?: string }).rooftopId;
  if (!rooftopId) {
    return NextResponse.json({ error: "No rooftop assigned to user" }, { status: 400 });
  }

  const rooftop = await db.rooftop.findUnique({
    where: { id: rooftopId },
    include: { pricingMatrix: true },
  });
  if (!rooftop) {
    return NextResponse.json({ error: "Rooftop not found" }, { status: 404 });
  }

  // Parse pricing tiers or fall back to defaults
  let tiers: PricingTier[] = DEFAULT_PRICING_TIERS;
  const matrix = rooftop.pricingMatrix[0];
  if (matrix) {
    try {
      tiers = JSON.parse(matrix.tiers);
    } catch {
      tiers = DEFAULT_PRICING_TIERS;
    }
  }

  // Resolve parts and labor in parallel
  const [parts, laborOps] = await Promise.all([
    getPartsForServices(oem, selectedServiceIds, vehicle, rooftopId),
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

  return NextResponse.json({ vehicle, ...summary });
}
