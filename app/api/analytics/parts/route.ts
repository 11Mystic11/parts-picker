// [FEATURE: parts_analytics]
// Parts KPI analytics — fill rate, gross profit by category, slow stock, inventory turns.
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = session.user as { id: string; rooftopId?: string };
  if (!user.rooftopId) return NextResponse.json({ error: "No rooftop" }, { status: 400 });

  const { searchParams } = req.nextUrl;
  const startDate = searchParams.get("startDate")
    ? new Date(searchParams.get("startDate")!)
    : new Date(Date.now() - 90 * 86_400_000); // default: last 90 days
  const endDate = searchParams.get("endDate")
    ? new Date(searchParams.get("endDate")!)
    : new Date();

  // ── Gross profit by category ──────────────────────────────────────────────
  // Sum ROLineItem price vs PartInventory cost (matched by partNumber)
  const partLineItems = await prisma.rOLineItem.findMany({
    where: {
      type: "part",
      repairOrder: {
        rooftopId: user.rooftopId,
        createdAt: { gte: startDate, lte: endDate },
        status: "closed",
      },
      partNumber: { not: null },
    },
    select: {
      partNumber: true,
      description: true,
      quantity: true,
      unitPrice: true,
      totalPrice: true,
    },
  });

  // Get inventory records to derive cost
  const partNumbers = [...new Set(partLineItems.map((li) => li.partNumber).filter(Boolean) as string[])];
  const inventoryRecords = await prisma.partInventory.findMany({
    where: {
      rooftopId: user.rooftopId,
      partNumber: { in: partNumbers },
    },
    select: { partNumber: true, category: true, unitCost: true, quantityOnHand: true, reorderPoint: true },
  });
  const inventoryMap = new Map(inventoryRecords.map((r) => [r.partNumber, r]));

  // Group by category
  const categoryMap = new Map<string, { revenue: number; cost: number; units: number }>();
  for (const li of partLineItems) {
    if (!li.partNumber) continue;
    const inv = inventoryMap.get(li.partNumber);
    const category = inv?.category ?? "Uncategorized";
    const existing = categoryMap.get(category) ?? { revenue: 0, cost: 0, units: 0 };
    existing.revenue += li.totalPrice;
    existing.cost += (inv?.unitCost ?? 0) * li.quantity;
    existing.units += li.quantity;
    categoryMap.set(category, existing);
  }
  const profitByCategory = Array.from(categoryMap.entries()).map(([category, data]) => ({
    category,
    revenue: data.revenue,
    cost: data.cost,
    grossProfit: data.revenue - data.cost,
    margin: data.revenue > 0 ? ((data.revenue - data.cost) / data.revenue) * 100 : 0,
    units: data.units,
  })).sort((a, b) => b.grossProfit - a.grossProfit);

  // ── Slow / dead stock ─────────────────────────────────────────────────────
  const ninetyDaysAgo = new Date(Date.now() - 90 * 86_400_000);
  const oneEightyDaysAgo = new Date(Date.now() - 180 * 86_400_000);
  const oneYearAgo = new Date(Date.now() - 365 * 86_400_000);

  const allInventory = await prisma.partInventory.findMany({
    where: { rooftopId: user.rooftopId, quantityOnHand: { gt: 0 } },
    select: {
      id: true,
      partNumber: true,
      description: true,
      category: true,
      quantityOnHand: true,
      unitCost: true,
      movements: {
        where: { createdAt: { gte: oneYearAgo } },
        select: { createdAt: true, quantity: true, type: true },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  });

  let deadStock90Count = 0, deadStock90Value = 0;
  let deadStock180Count = 0, deadStock180Value = 0;
  let deadStock365Count = 0, deadStock365Value = 0;

  for (const inv of allInventory) {
    const lastMovement = inv.movements[0]?.createdAt;
    const value = inv.quantityOnHand * inv.unitCost;
    if (!lastMovement || lastMovement < ninetyDaysAgo) {
      deadStock90Count++;
      deadStock90Value += value;
    }
    if (!lastMovement || lastMovement < oneEightyDaysAgo) {
      deadStock180Count++;
      deadStock180Value += value;
    }
    if (!lastMovement || lastMovement < oneYearAgo) {
      deadStock365Count++;
      deadStock365Value += value;
    }
  }

  // ── Fill rate (approximate) ───────────────────────────────────────────────
  // % of part lines where the part number exists in inventory with qty > 0
  const totalPartLines = partLineItems.length;
  const filledLines = partLineItems.filter((li) => {
    if (!li.partNumber) return false;
    const inv = inventoryMap.get(li.partNumber);
    return inv && inv.quantityOnHand > 0;
  }).length;
  const fillRate = totalPartLines > 0 ? (filledLines / totalPartLines) * 100 : null;

  // ── Inventory turns ───────────────────────────────────────────────────────
  const totalCostOfGoodsSold = profitByCategory.reduce((s, c) => s + c.cost, 0);
  const avgInventoryValue = allInventory.reduce((s, i) => s + i.quantityOnHand * i.unitCost, 0);
  const inventoryTurns = avgInventoryValue > 0 ? totalCostOfGoodsSold / avgInventoryValue : null;

  // ── Total inventory value ─────────────────────────────────────────────────
  const totalInventoryValue = allInventory.reduce((s, i) => s + i.quantityOnHand * i.unitCost, 0);
  const totalInventorySKUs = allInventory.length;

  return NextResponse.json({
    dateRange: { startDate: startDate.toISOString(), endDate: endDate.toISOString() },
    fillRate,
    inventoryTurns,
    totalInventoryValue,
    totalInventorySKUs,
    profitByCategory,
    slowStock: {
      days90: { count: deadStock90Count, value: deadStock90Value },
      days180: { count: deadStock180Count, value: deadStock180Value },
      days365: { count: deadStock365Count, value: deadStock365Value },
    },
  });
}
