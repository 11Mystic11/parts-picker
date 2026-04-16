import { prisma } from "@/lib/db";
import type { VehicleData } from "./normalize";

export type { VehicleData } from "./normalize";

// Save a normalized VehicleData to the cache with a 7-day TTL
export async function cacheVehicle(vehicle: VehicleData): Promise<void> {
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  await prisma.vehicleCache.upsert({
    where: { vin: vehicle.vin },
    create: { ...vehicle, expiresAt, rawData: "" },
    update: { ...vehicle, expiresAt },
  });
}

// Read from cache only (used by the recommendations route)
export async function getVehicleFromCache(vin: string): Promise<VehicleData | null> {
  const cached = await prisma.vehicleCache.findUnique({ where: { vin } });
  if (!cached || cached.expiresAt <= new Date()) return null;
  return {
    vin: cached.vin,
    make: cached.make,
    model: cached.model,
    year: cached.year,
    engine: cached.engine,
    drivetrain: cached.drivetrain,
    trim: cached.trim,
    oem: cached.oem,
  };
}
