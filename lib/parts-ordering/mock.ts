// [FEATURE: parts_ordering]
// Mock parts supplier adapter — returns deterministic fake catalog results.
// Used as a safe fallback when no real supplier is configured.
// Remove this file to disable.

import type { PartsSupplierAdapter, PartSearchResult, OrderResult, OrderStatus, OrderItem } from "./adapter";

const MOCK_CATALOG: PartSearchResult[] = [
  { partNumber: "MOB-15W50-QT", description: "Mobil 1 15W-50 Full Synthetic Motor Oil (1 Qt)", brand: "Mobil 1", unitCost: 12.49, availability: "in_stock" },
  { partNumber: "WIX-57060", description: "WIX Oil Filter", brand: "WIX", unitCost: 6.89, availability: "in_stock" },
  { partNumber: "NGK-6619", description: "NGK Iridium IX Spark Plug", brand: "NGK", unitCost: 11.99, availability: "in_stock" },
  { partNumber: "BOSCH-3330", description: "Bosch Premium Air Filter", brand: "Bosch", unitCost: 14.99, availability: "in_stock" },
  { partNumber: "ATE-500157", description: "ATE Ceramic Brake Pads (Front)", brand: "ATE", unitCost: 42.50, availability: "limited" },
  { partNumber: "ATE-500222", description: "ATE Ceramic Brake Pads (Rear)", brand: "ATE", unitCost: 38.75, availability: "in_stock" },
  { partNumber: "ACDelco-12603786", description: "ACDelco Serpentine Belt", brand: "ACDelco", unitCost: 22.00, availability: "in_stock" },
  { partNumber: "Prestone-AF888", description: "Prestone 50/50 Coolant (1 Gal)", brand: "Prestone", unitCost: 18.49, availability: "in_stock" },
  { partNumber: "STD-S65", description: "Standard Motor Products Ignition Coil", brand: "Standard", unitCost: 29.99, availability: "out_of_stock" },
  { partNumber: "Gates-38472", description: "Gates Timing Belt Kit", brand: "Gates", unitCost: 84.00, availability: "limited" },
];

let orderSeq = 1000;

export function getMockAdapter(): PartsSupplierAdapter {
  return {
    async searchParts(query: string, partNumber?: string): Promise<PartSearchResult[]> {
      const q = (partNumber ?? query).toLowerCase();
      if (!q) return MOCK_CATALOG.slice(0, 5);

      const results = MOCK_CATALOG.filter(
        (p) =>
          p.partNumber.toLowerCase().includes(q) ||
          p.description.toLowerCase().includes(q) ||
          p.brand.toLowerCase().includes(q)
      );
      return results.slice(0, 10);
    },

    async submitOrder(items: OrderItem[]): Promise<OrderResult> {
      // Simulate a small async delay
      await new Promise((r) => setTimeout(r, 50));
      return {
        success: true,
        externalOrderId: `MOCK-${++orderSeq}`,
        estimatedDelivery: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
      };
    },

    async getOrderStatus(externalOrderId: string): Promise<OrderStatus> {
      return {
        status: "confirmed",
        estimatedDelivery: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
        lastUpdated: new Date().toISOString(),
      };
    },
  };
}
