// [FEATURE: parts_ordering]
// NAPA supplier adapter skeleton.
// TODO: Inject real NAPA API credentials via rooftop config when available.
// Config shape: { apiKey: string, accountId: string, storeId: string }
// Remove this file to disable.

import type { PartsSupplierAdapter, PartSearchResult, OrderResult, OrderStatus, OrderItem } from "./adapter";
import { getMockAdapter } from "./mock";

interface NAPAConfig {
  apiKey: string;
  accountId: string;
  storeId?: string;
}

export function getNAPAAdapter(config: NAPAConfig): PartsSupplierAdapter {
  // TODO: Replace this skeleton with real NAPA PROLINK / eCommerce API calls.
  // NAPA API base: https://api.napaonline.com (requires dealer agreement + API key)
  // Until credentials are configured, fall back to the mock adapter.

  if (!config.apiKey || !config.accountId) {
    console.warn("[parts_ordering] NAPA adapter: missing credentials — using mock");
    return getMockAdapter();
  }

  const BASE = "https://api.napaonline.com/v1";
  const headers = {
    "Authorization": `Bearer ${config.apiKey}`,
    "X-Account-Id": config.accountId,
    "Content-Type": "application/json",
  };

  return {
    async searchParts(query: string, partNumber?: string): Promise<PartSearchResult[]> {
      // TODO: implement NAPA part search
      // const res = await fetch(`${BASE}/parts/search?q=${encodeURIComponent(partNumber ?? query)}`, { headers });
      console.log("[NAPA] searchParts called — stub", { query, partNumber, BASE, headers });
      return getMockAdapter().searchParts(query, partNumber);
    },

    async submitOrder(items: OrderItem[]): Promise<OrderResult> {
      // TODO: implement NAPA order submission
      console.log("[NAPA] submitOrder called — stub", { items });
      return getMockAdapter().submitOrder(items);
    },

    async getOrderStatus(externalOrderId: string): Promise<OrderStatus> {
      // TODO: implement NAPA order status lookup
      console.log("[NAPA] getOrderStatus called — stub", { externalOrderId });
      return getMockAdapter().getOrderStatus(externalOrderId);
    },
  };
}
