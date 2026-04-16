import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getMaintenanceRecommendations } from "@/lib/maintenance/schedule";
import { getOTPRRecommendations } from "@/lib/maintenance/otpr";
import { getVehicleFromCache } from "@/lib/vin/decode";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = req.nextUrl;
  const vin = searchParams.get("vin");
  const mileageStr = searchParams.get("mileage");
  const oemOverride = searchParams.get("oem");

  if (!vin || vin.length !== 17) {
    return NextResponse.json({ error: "vin must be 17 characters" }, { status: 400 });
  }

  const mileage = parseInt(mileageStr ?? "", 10);
  if (isNaN(mileage) || mileage < 0) {
    return NextResponse.json({ error: "mileage must be a non-negative integer" }, { status: 400 });
  }

  // Fetch vehicle from cache (must have been saved after client-side VIN decode)
  const vehicle = await getVehicleFromCache(vin.toUpperCase());
  if (!vehicle) {
    return NextResponse.json(
      { error: "Vehicle not found — decode the VIN first" },
      { status: 404 }
    );
  }

  const oem = oemOverride ?? vehicle.oem;
  if (!oem) {
    return NextResponse.json(
      { error: "No OEM available for this vehicle — provide ?oem= override" },
      { status: 400 }
    );
  }

  const [maintenance, otpr] = await Promise.all([
    getMaintenanceRecommendations(oem, mileage),
    getOTPRRecommendations(oem, mileage, vehicle),
  ]);

  return NextResponse.json({
    vehicle,
    required: maintenance.required,
    recommended: maintenance.recommended,
    otpr,
  });
}
