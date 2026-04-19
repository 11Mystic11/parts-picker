// [FEATURE: parts_ordering]
// PartsTech multi-supplier platform adapter stub.
// Configure via rooftop supplier config: { partstech: { apiKey, shopId } }

import type { PartsSupplierAdapter, PartSearchResult, OrderResult, OrderStatus, OrderItem } from "./adapter";

interface PartsTechConfig {
  apiKey: string;
  shopId: string;
}

export function getPartsTechAdapter(config: PartsTechConfig): PartsSupplierAdapter {
  return {
    async searchParts(query: string, partNumber?: string): Promise<PartSearchResult[]> {
      const baseUrl = process.env.PARTSTECH_BASE_URL ?? "https://api.partstech.com/v2";
      // TODO: implement PartsTech search API
      // GET ${baseUrl}/parts/search?query=${query}&shopId=${config.shopId}
      // Authorization: Bearer ${config.apiKey}
      console.warn("[parts_ordering:PartsTech] searchParts not yet implemented");
      return [];
    },

    async submitOrder(items: OrderItem[]): Promise<OrderResult> {
      // TODO: implement PartsTech order cart/checkout
      console.warn("[parts_ordering:PartsTech] submitOrder not yet implemented");
      return { success: false, error: "PARTSTECH_NOT_IMPLEMENTED" };
    },

    async getOrderStatus(externalOrderId: string): Promise<OrderStatus> {
      return { status: "unknown" };
    },
  };
}
