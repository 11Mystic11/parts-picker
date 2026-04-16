import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { z } from "zod";
import { cacheVehicle, getVehicleFromCache } from "@/lib/vin/decode";
import { normalizeDecodeVinValues } from "@/lib/vin/normalize";

// If only `vin` is provided → server fetches NHTSA, normalizes, caches, returns vehicle.
// If full vehicle object is provided → skip NHTSA (manual entry), just cache and return.

const vinOnlySchema = z.object({
  vin: z.string().length(17),
  make: z.undefined().optional(),
});

const fullVehicleSchema = z.object({
  vin: z.string().length(17),
  make: z.string().min(1),
  model: z.string(),
  year: z.number().int().min(1900),
  engine: z.string().nullable(),
  drivetrain: z.string().nullable(),
  trim: z.string().nullable(),
  oem: z.string().nullable(),
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

  const b = body as Record<string, unknown>;

  // Manual entry path — full vehicle object provided
  if (b.make) {
    const parsed = fullVehicleSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid vehicle data" },
        { status: 400 }
      );
    }
    try {
      await cacheVehicle(parsed.data);
      return NextResponse.json({ vehicle: parsed.data, fromCache: false });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Cache write failed";
      return NextResponse.json({ error: message }, { status: 500 });
    }
  }

  // Auto path — only VIN provided, fetch NHTSA server-side
  const vinParsed = z.string().length(17).safeParse(b.vin);
  if (!vinParsed.success) {
    return NextResponse.json({ error: "VIN must be exactly 17 characters" }, { status: 400 });
  }
  const vin = (vinParsed.data as string).toUpperCase();

  // Check cache first
  const cached = await getVehicleFromCache(vin).catch(() => null);
  if (cached) {
    return NextResponse.json({ vehicle: cached, fromCache: true });
  }

  // Fetch from NHTSA server-side (correct subdomain used by vPIC)
  let vehicle;
  try {
    const url = `https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValues/${encodeURIComponent(vin)}?format=json`;
    const nhtsa = await fetch(url, { cache: "no-store" });
    if (!nhtsa.ok) throw new Error(`NHTSA error: ${nhtsa.status}`);
    const data = await nhtsa.json();
    if (!data.Results?.[0]) throw new Error("No results from NHTSA");
    vehicle = normalizeDecodeVinValues(vin, data.Results[0]);
  } catch (err) {
    const message = err instanceof Error ? err.message : "VIN decode failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }

  try {
    await cacheVehicle(vehicle);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Cache write failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  return NextResponse.json({ vehicle, fromCache: false });
}
