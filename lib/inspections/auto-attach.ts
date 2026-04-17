// [FEATURE: canned_inspections]
// Auto-attach inspection templates to an RO based on mileage triggers.
// Called during RO creation if the canned_inspections flag is enabled.
// Remove this file and its call site in app/api/ro/route.ts to disable.

import { prisma as db } from "@/lib/db";

export async function autoAttachInspections(
  roId: string,
  mileage: number,
  rooftopId: string,
  techId: string
): Promise<void> {
  // Find templates with a triggerMileage within triggerWindow of the RO mileage
  // Templates with no triggerMileage are NOT auto-attached (must be manually added)
  const templates = await db.inspectionTemplate.findMany({
    where: {
      isActive: true,
      triggerMileage: { not: null },
      OR: [{ rooftopId }, { rooftopId: null }],
    },
    include: { items: { orderBy: { sortOrder: "asc" } } },
  });

  for (const template of templates) {
    if (!template.triggerMileage) continue;
    const window = template.triggerWindow ?? 2500;
    const diff = Math.abs(mileage - template.triggerMileage);
    if (diff > window) continue;

    // Check not already attached
    const existing = await db.roInspection.findUnique({
      where: { repairOrderId_templateId: { repairOrderId: roId, templateId: template.id } },
    });
    if (existing) continue;

    // Create inspection + result rows
    const inspection = await db.roInspection.create({
      data: {
        repairOrderId: roId,
        templateId: template.id,
        techId,
      },
    });

    if (template.items.length > 0) {
      await db.inspectionResult.createMany({
        data: template.items.map((item) => ({
          inspectionId: inspection.id,
          templateItemId: item.id,
          value: null,
          notes: null,
          updatedAt: new Date(),
        })),
      });
    }
  }
}
