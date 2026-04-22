import { prisma as db } from "@/lib/db";
import { VehicleData } from "@/lib/vin/normalize";

type ConditionsJSON = {
  engines?: string[];
  drivetrains?: string[];
  trims?: string[];
};

export type LaborOp = {
  id: string;
  opCode: string;
  name: string;
  flatRateHours: number;
  serviceId: string;
};

function matchesConditions(conditions: ConditionsJSON, vehicle: VehicleData): boolean {
  if (conditions.engines?.length) {
    if (!vehicle.engine) return false;
    const vehicleEngine = vehicle.engine.toLowerCase();
    if (!conditions.engines.some((e) => vehicleEngine.includes(e.toLowerCase()))) return false;
  }
  if (conditions.drivetrains?.length) {
    if (!vehicle.drivetrain) return false;
    if (!conditions.drivetrains.includes(vehicle.drivetrain)) return false;
  }
  if (conditions.trims?.length) {
    if (!vehicle.trim) return false;
    if (!conditions.trims.includes(vehicle.trim)) return false;
  }
  return true;
}

export async function getLaborForServices(
  oem: string,
  selectedServiceIds: string[],
  vehicle: VehicleData
): Promise<LaborOp[]> {
  if (selectedServiceIds.length === 0) return [];

  const ops = await db.laborOperation.findMany({ where: { oem, isActive: true } });
  const result: LaborOp[] = [];

  for (const op of ops) {
    let opServiceIds: string[] = [];
    try {
      opServiceIds = JSON.parse(op.serviceIds || "[]");
    } catch {
      continue;
    }

    const matchingServiceId = opServiceIds.find((sid) => selectedServiceIds.includes(sid));
    if (!matchingServiceId) continue;

    let conditions: ConditionsJSON = {};
    try {
      conditions = JSON.parse(op.conditions || "{}");
    } catch {
      conditions = {};
    }
    if (!matchesConditions(conditions, vehicle)) continue;

    result.push({
      id: op.id,
      opCode: op.opCode,
      name: op.name,
      flatRateHours: op.flatRateHours,
      serviceId: matchingServiceId,
    });
  }

  return result;
}
