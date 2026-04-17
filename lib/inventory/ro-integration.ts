// [FEATURE: inventory_ro_integration]
// Auto-decrement inventory when an RO is approved; warn when parts are low/missing.
// Remove this file and its call sites in app/api/ro/[id]/route.ts and
// app/api/ro/[id]/present/route.ts to disable this feature.

import { prisma as db } from "@/lib/db";
import { Prisma } from "@prisma/client";

export interface StockCheckResult {
  lineItemId: string;
  partNumber: string;
  description: string;
  qtyNeeded: number;
  qtyOnHand: number;
  isLow: boolean;      // at or below reorderPoint
  isInsufficient: boolean; // qtyOnHand < qtyNeeded
}

/**
 * Pre-flight stock check for an RO.
 * Returns only part line items where a matching PartInventory record exists.
 */
export async function checkStockForRO(
  roId: string,
  rooftopId: string
): Promise<StockCheckResult[]> {
  const lineItems = await db.rOLineItem.findMany({
    where: { repairOrderId: roId, type: "part", partNumber: { not: null } },
    select: { id: true, partNumber: true, description: true, quantity: true },
  });

  if (lineItems.length === 0) return [];

  const partNumbers = lineItems
    .map((li) => li.partNumber)
    .filter((pn): pn is string => pn !== null);

  const inventory = await db.partInventory.findMany({
    where: { rooftopId, partNumber: { in: partNumbers }, isActive: true },
    select: { partNumber: true, quantityOnHand: true, reorderPoint: true },
  });

  const inventoryMap = new Map(inventory.map((inv) => [inv.partNumber, inv]));

  return lineItems
    .filter((li) => li.partNumber && inventoryMap.has(li.partNumber!))
    .map((li) => {
      const inv = inventoryMap.get(li.partNumber!)!;
      return {
        lineItemId: li.id,
        partNumber: li.partNumber!,
        description: li.description,
        qtyNeeded: li.quantity,
        qtyOnHand: inv.quantityOnHand,
        isLow: inv.quantityOnHand <= inv.reorderPoint,
        isInsufficient: inv.quantityOnHand < li.quantity,
      };
    });
}

/**
 * Returns the set of partNumbers (for a given RO) that are at or below reorderPoint.
 * Used for low-stock badge rendering in the UI.
 */
export async function getLowStockPartsForRO(
  roId: string,
  rooftopId: string
): Promise<Set<string>> {
  const results = await checkStockForRO(roId, rooftopId);
  return new Set(results.filter((r) => r.isLow).map((r) => r.partNumber));
}

/**
 * Decrement inventory for all part line items on an approved RO.
 * Must be called inside an existing Prisma transaction.
 * Clamps to 0 if stock is insufficient (logs a warning but does NOT throw).
 */
export async function decrementStockForRO(
  roId: string,
  rooftopId: string,
  performedById: string,
  tx: Prisma.TransactionClient
): Promise<void> {
  const lineItems = await tx.rOLineItem.findMany({
    where: { repairOrderId: roId, type: "part", partNumber: { not: null } },
    select: { partNumber: true, quantity: true },
  });

  if (lineItems.length === 0) return;

  const partNumbers = lineItems
    .map((li) => li.partNumber)
    .filter((pn): pn is string => pn !== null);

  const inventoryRecords = await tx.partInventory.findMany({
    where: { rooftopId, partNumber: { in: partNumbers }, isActive: true },
  });

  const inventoryMap = new Map(inventoryRecords.map((inv) => [inv.partNumber, inv]));

  for (const li of lineItems) {
    if (!li.partNumber) continue;
    const inv = inventoryMap.get(li.partNumber);
    if (!inv) continue; // not tracked in this rooftop's inventory — skip silently

    const previousQty = inv.quantityOnHand;
    const decrementBy = li.quantity;
    const newQty = Math.max(0, previousQty - decrementBy);

    if (previousQty < decrementBy) {
      console.warn(
        `[inventory_ro_integration] Insufficient stock for ${li.partNumber}: needed ${decrementBy}, had ${previousQty}. Clamping to 0.`
      );
    }

    await tx.partInventory.update({
      where: { id: inv.id },
      data: { quantityOnHand: newQty },
    });

    await tx.inventoryMovement.create({
      data: {
        inventoryId: inv.id,
        type: "use",
        quantity: -decrementBy,
        previousQty,
        newQty,
        reason: `RO approval — ${roId}`,
        referenceId: roId,
        performedById,
      },
    });
  }
}
