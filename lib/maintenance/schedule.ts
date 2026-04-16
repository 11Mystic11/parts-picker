import { prisma } from "@/lib/db";

export type ServiceItem = {
  id: string;
  name: string;
  category: string;
  description: string;
  isRequired: boolean;
};

export type ScheduleGroup = {
  mileageInterval: number;
  services: ServiceItem[];
  tier: "required" | "recommended";
};

export type MaintenanceResult = {
  required: ScheduleGroup[];
  recommended: ScheduleGroup[];
};

export async function getMaintenanceRecommendations(
  oem: string,
  currentMileage: number
): Promise<MaintenanceResult> {
  const schedules = await prisma.maintenanceSchedule.findMany({
    where: { oem, isActive: true },
    orderBy: { mileageInterval: "asc" },
  });

  if (schedules.length === 0) {
    return { required: [], recommended: [] };
  }

  const intervals = schedules.map((s) => s.mileageInterval);

  // Required: single highest interval ≤ currentMileage
  const dueIntervals = intervals.filter((i) => i <= currentMileage);
  const requiredInterval =
    dueIntervals.length > 0 ? Math.max(...dueIntervals) : null;

  // Recommended: intervals in window (currentMileage, currentMileage + 15000], max 2
  const upcomingIntervals = intervals
    .filter((i) => i > currentMileage && i <= currentMileage + 15000)
    .slice(0, 2);

  function parseServices(schedule: (typeof schedules)[0]): ServiceItem[] {
    try {
      const defs = JSON.parse(schedule.serviceDefinitions);
      if (!Array.isArray(defs)) return [];
      return defs.map((d: Record<string, unknown>) => ({
        id: String(d.id ?? schedule.id + "_" + d.name),
        name: String(d.name ?? ""),
        category: String(d.category ?? ""),
        description: String(d.description ?? ""),
        isRequired: Boolean(d.isRequired ?? true),
      }));
    } catch {
      return [];
    }
  }

  const required: ScheduleGroup[] = [];
  if (requiredInterval !== null) {
    const schedule = schedules.find((s) => s.mileageInterval === requiredInterval);
    if (schedule) {
      required.push({
        mileageInterval: requiredInterval,
        services: parseServices(schedule),
        tier: "required",
      });
    }
  }

  const recommended: ScheduleGroup[] = [];
  for (const interval of upcomingIntervals) {
    const schedule = schedules.find((s) => s.mileageInterval === interval);
    if (schedule) {
      recommended.push({
        mileageInterval: interval,
        services: parseServices(schedule),
        tier: "recommended",
      });
    }
  }

  return { required, recommended };
}
