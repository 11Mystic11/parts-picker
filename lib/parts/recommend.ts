import { prisma as db } from "@/lib/db";
import { VehicleData } from "@/lib/vin/normalize";

type ConditionsJSON = {
  engines?: string[];
  drivetrains?: string[];
  trims?: string[];
};

export type RecommendedPart = {
  id: string;
  partNumber: string;
  name: string;
  description: string | null;
  serviceId: string;
  quantity: number;
  unitCost: number;
};

function matchesConditions(conditions: ConditionsJSON, vehicle: VehicleData): boolean {
  // Engine condition: vehicle must have an engine and it must include at least one listed engine string
  if (conditions.engines?.length) {
    if (!vehicle.engine) return false;
    const vehicleEngine = vehicle.engine.toLowerCase();
    if (!conditions.engines.some((e) => vehicleEngine.includes(e.toLowerCase()))) return false;
  }
  // Drivetrain condition: vehicle must have a drivetrain and it must be in the list
  if (conditions.drivetrains?.length) {
    if (!vehicle.drivetrain) return false;
    if (!conditions.drivetrains.includes(vehicle.drivetrain)) return false;
  }
  return true;
}

export async function getPartsForServices(
  oem: string,
  selectedServiceIds: string[],
  vehicle: VehicleData
): Promise<RecommendedPart[]> {
  if (selectedServiceIds.length === 0) return [];

  const catalog = await db.partsCatalog.findMany({ where: { oem, isActive: true } });
  const result: RecommendedPart[] = [];

  for (const part of catalog) {
    // Check if this part belongs to any of the selected services
    let partServiceIds: string[] = [];
    try {
      partServiceIds = JSON.parse(part.serviceIds || "[]");
    } catch {
      continue;
    }

    const matchingServiceId = partServiceIds.find((sid) => selectedServiceIds.includes(sid));
    if (!matchingServiceId) continue;

    // Check vehicle conditions
    let conditions: ConditionsJSON = {};
    try {
      conditions = JSON.parse(part.conditions || "{}");
    } catch {
      conditions = {};
    }
    if (!matchesConditions(conditions, vehicle)) continue;

    const quantity = parseInt(part.quantityRule, 10) || 1;
    result.push({
      id: part.id,
      partNumber: part.partNumber,
      name: part.name,
      description: part.description,
      serviceId: matchingServiceId,
      quantity,
      unitCost: part.defaultCost,
    });
  }

  return result;
}
