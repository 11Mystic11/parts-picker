import { prisma } from "@/lib/db";
import type { VehicleData } from "@/lib/vin/decode";

export type OTPRItem = {
  id: string;
  name: string;
  description: string | null;
  serviceCategory: string;
  mileageThreshold: number;
  urgencyTier: string;
};

export type OTPRResult = {
  urgent: OTPRItem[];
  suggested: OTPRItem[];
  informational: OTPRItem[];
};

type OTPRConditions = {
  drivetrains?: string[];
  engines?: string[];
};

function matchesVehicle(conditionsJson: string | null, vehicle: VehicleData): boolean {
  if (!conditionsJson) return true;

  let conditions: OTPRConditions;
  try {
    conditions = JSON.parse(conditionsJson);
  } catch {
    return true;
  }

  // Check drivetrain filter
  if (conditions.drivetrains && conditions.drivetrains.length > 0) {
    if (!vehicle.drivetrain) return false;
    if (!conditions.drivetrains.includes(vehicle.drivetrain)) return false;
  }

  // Check engine filter (substring match)
  if (conditions.engines && conditions.engines.length > 0) {
    if (!vehicle.engine) return false;
    const engineLower = vehicle.engine.toLowerCase();
    const matches = conditions.engines.some((e) =>
      engineLower.includes(e.toLowerCase())
    );
    if (!matches) return false;
  }

  return true;
}

export async function getOTPRRecommendations(
  oem: string,
  currentMileage: number,
  vehicle: VehicleData
): Promise<OTPRResult> {
  const rules = await prisma.oTPRRule.findMany({
    where: {
      oem,
      mileageThreshold: { lte: currentMileage },
      isActive: true,
    },
    orderBy: { mileageThreshold: "asc" },
  });

  const filtered = rules.filter((rule) => matchesVehicle(rule.conditions, vehicle));

  const result: OTPRResult = { urgent: [], suggested: [], informational: [] };

  for (const rule of filtered) {
    const item: OTPRItem = {
      id: rule.id,
      name: rule.name,
      description: rule.description,
      serviceCategory: rule.serviceCategory,
      mileageThreshold: rule.mileageThreshold,
      urgencyTier: rule.urgencyTier,
    };

    const tier = rule.urgencyTier.toLowerCase();
    if (tier === "urgent") {
      result.urgent.push(item);
    } else if (tier === "suggested") {
      result.suggested.push(item);
    } else {
      result.informational.push(item);
    }
  }

  return result;
}
