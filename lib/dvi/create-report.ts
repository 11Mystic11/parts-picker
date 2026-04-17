// [FEATURE: dvi]
// Auto-creates a DVIReport with default DVIItems pre-populated from an RO's labor/part line items.
// Remove this file and its call site (if any) to disable.

import { prisma as db } from "@/lib/db";

interface LineItem {
  id: string;
  type: string;
  description: string;
}

export async function createDefaultDVIReport(
  roId: string,
  techId: string,
  lineItems: LineItem[]
): Promise<string> {
  // Create the report
  const report = await db.dVIReport.create({
    data: {
      repairOrderId: roId,
      techId,
      status: "in_progress",
    },
  });

  // Pre-populate items from labor + part line items
  const relevantItems = lineItems.filter(
    (li) => li.type === "labor" || li.type === "part" || li.type === "service"
  );

  if (relevantItems.length > 0) {
    await db.dVIItem.createMany({
      data: relevantItems.map((li, i) => ({
        reportId: report.id,
        lineItemId: li.id,
        label: li.description,
        condition: "ok",
        sortOrder: i,
      })),
    });
  }

  return report.id;
}
