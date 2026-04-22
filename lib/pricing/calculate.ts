import { RecommendedPart } from "@/lib/parts/recommend";
import { LaborOp } from "@/lib/labor/lookup";

export type PricingTier = {
  minCost: number;
  maxCost: number | null;
  markupPct: number;
};

export type PricedLineItem = {
  type: "part" | "labor" | "fee" | "tax";
  source: "recommended" | "manual";
  serviceId?: string;
  partNumber?: string;
  laborOpCode?: string;
  description: string;
  quantity: number;
  unitCost: number;
  unitPrice: number;
  totalPrice: number;
  fromInventory?: boolean;
  isOutOfStock?: boolean;
};

export type ROSummary = {
  lineItems: PricedLineItem[];
  partsSubtotal: number;
  laborSubtotal: number;
  shopSupplyFee: number;
  taxAmount: number;
  total: number;
};

export const DEFAULT_PRICING_TIERS: PricingTier[] = [
  { minCost: 0, maxCost: 50, markupPct: 0.3 },
  { minCost: 50, maxCost: 200, markupPct: 0.25 },
  { minCost: 200, maxCost: null, markupPct: 0.2 },
];

export function applyMarkup(cost: number, tiers: PricingTier[]): number {
  for (const tier of tiers) {
    const inRange = cost >= tier.minCost && (tier.maxCost === null || cost < tier.maxCost);
    if (inRange) return cost * (1 + tier.markupPct);
  }
  // Fallback: 25% markup
  return cost * 1.25;
}

export function calculateRO(
  parts: RecommendedPart[],
  laborOps: LaborOp[],
  tiers: PricingTier[],
  laborRate: number,
  taxRate: number,
  shopSupplyPct: number,
  shopSupplyCap: number
): ROSummary {
  const lineItems: PricedLineItem[] = [];

  // Part line items
  for (const part of parts) {
    const unitPrice = applyMarkup(part.unitCost, tiers);
    const totalPrice = unitPrice * part.quantity;
    lineItems.push({
      type: "part",
      source: "recommended",
      serviceId: part.serviceId,
      partNumber: part.partNumber,
      description: `${part.name}${part.description ? ` — ${part.description}` : ""}`,
      quantity: part.quantity,
      unitCost: part.unitCost,
      unitPrice,
      totalPrice,
      ...(part.fromInventory && { fromInventory: true }),
      ...(part.isOutOfStock && { isOutOfStock: true }),
    });
  }

  // Labor line items
  for (const op of laborOps) {
    const totalPrice = op.flatRateHours * laborRate;
    lineItems.push({
      type: "labor",
      source: "recommended",
      serviceId: op.serviceId,
      laborOpCode: op.opCode,
      description: op.name,
      quantity: op.flatRateHours,
      unitCost: laborRate,
      unitPrice: laborRate,
      totalPrice,
    });
  }

  const partsSubtotal = lineItems
    .filter((li) => li.type === "part")
    .reduce((sum, li) => sum + li.totalPrice, 0);

  const laborSubtotal = lineItems
    .filter((li) => li.type === "labor")
    .reduce((sum, li) => sum + li.totalPrice, 0);

  const rawShopSupply = (partsSubtotal + laborSubtotal) * shopSupplyPct;
  const shopSupplyFee = Math.min(shopSupplyCap, rawShopSupply);

  if (shopSupplyFee > 0) {
    lineItems.push({
      type: "fee",
      source: "recommended",
      description: "Shop Supply Fee",
      quantity: 1,
      unitCost: shopSupplyFee,
      unitPrice: shopSupplyFee,
      totalPrice: shopSupplyFee,
    });
  }

  const taxableBase = partsSubtotal + laborSubtotal + shopSupplyFee;
  const taxAmount = taxableBase * taxRate;

  if (taxAmount > 0) {
    lineItems.push({
      type: "tax",
      source: "recommended",
      description: "Sales Tax",
      quantity: 1,
      unitCost: taxAmount,
      unitPrice: taxAmount,
      totalPrice: taxAmount,
    });
  }

  const total = taxableBase + taxAmount;

  return { lineItems, partsSubtotal, laborSubtotal, shopSupplyFee, taxAmount, total };
}
