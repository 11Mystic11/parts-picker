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
  // Inventory enrichment
  inventoryId?: string;
  quantityOnHand?: number;
  fromInventory?: boolean;   // matched inventory, in stock — cost pulled from inventory
  isOutOfStock?: boolean;    // matched inventory, qty = 0
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
  // Trim condition: vehicle must have a trim and it must be in the list
  if (conditions.trims?.length) {
    if (!vehicle.trim) return false;
    if (!conditions.trims.includes(vehicle.trim)) return false;
  }
  return true;
}

export async function getPartsForServices(
  oem: string,
  selectedServiceIds: string[],
  vehicle: VehicleData,
  rooftopId?: string
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

  // Enrich with inventory data — stock-first pricing and out-of-stock flagging
  if (rooftopId && result.length > 0) {
    const inventory = await db.partInventory.findMany({
      where: { rooftopId, isActive: true },
    });
    const invMap = new Map(inventory.map((i) => [i.partNumber.toLowerCase(), i]));

    for (const part of result) {
      const inv = invMap.get(part.partNumber.toLowerCase());
      if (!inv) continue;
      if (inv.quantityOnHand > 0) {
        part.unitCost = inv.unitCost;
        part.fromInventory = true;
        part.inventoryId = inv.id;
        part.quantityOnHand = inv.quantityOnHand;
      } else {
        part.isOutOfStock = true;
        part.inventoryId = inv.id;
        part.quantityOnHand = 0;
      }
    }
  }

  return result;
}
