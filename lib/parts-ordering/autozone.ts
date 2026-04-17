// [FEATURE: parts_ordering]
// AutoZone supplier adapter skeleton.
// TODO: Inject real AutoZone PRO API credentials via rooftop config when available.
// Config shape: { apiKey: string, storeNumber: string }
// Remove this file to disable.

import type { PartsSupplierAdapter, PartSearchResult, OrderResult, OrderStatus, OrderItem } from "./adapter";
import { getMockAdapter } from "./mock";

interface AutoZoneConfig {
  apiKey: string;
  storeNumber: string;
}

export function getAutoZoneAdapter(config: AutoZoneConfig): PartsSupplierAdapter {
  // TODO: Replace this skeleton with real AutoZone PRO API calls.
  // AutoZone PRO API: contact AutoZone commercial team for access.
  // Until credentials are configured, fall back to the mock adapter.

  if (!config.apiKey || !config.storeNumber) {
    console.warn("[parts_ordering] AutoZone adapter: missing credentials — using mock");
    return getMockAdapter();
  }

  const BASE = "https://api.autozone.com/commercial/v1";
  const headers = {
    "Authorization": `Bearer ${config.apiKey}`,
    "X-Store-Number": config.storeNumber,
    "Content-Type": "application/json",
  };

  return {
    async searchParts(query: string, partNumber?: string): Promise<PartSearchResult[]> {
      // TODO: implement AutoZone part search
      console.log("[AutoZone] searchParts called — stub", { query, partNumber, BASE, headers });
      return getMockAdapter().searchParts(query, partNumber);
    },

    async submitOrder(items: OrderItem[]): Promise<OrderResult> {
      // TODO: implement AutoZone order submission
      console.log("[AutoZone] submitOrder called — stub", { items });
      return getMockAdapter().submitOrder(items);
    },

    async getOrderStatus(externalOrderId: string): Promise<OrderStatus> {
      // TODO: implement AutoZone order status lookup
      console.log("[AutoZone] getOrderStatus called — stub", { externalOrderId });
      return getMockAdapter().getOrderStatus(externalOrderId);
    },
  };
}
