// [FEATURE: parts_ordering]
// O'Reilly Auto Parts supplier adapter stub.
// Configure via rooftop supplier config: { orielly: { apiKey, accountNumber, storeId } }

import type { PartsSupplierAdapter, PartSearchResult, OrderResult, OrderStatus, OrderItem } from "./adapter";

interface OReillyConfig {
  apiKey: string;
  accountNumber: string;
  storeId?: string;
}

export function getOReillyAdapter(config: OReillyConfig): PartsSupplierAdapter {
  return {
    async searchParts(query: string, partNumber?: string): Promise<PartSearchResult[]> {
      const baseUrl = process.env.ORIELLY_BASE_URL;
      if (!baseUrl) {
        console.warn("[parts_ordering:OReillyAuto] ORIELLY_BASE_URL not set — returning empty");
        return [];
      }
      // TODO: implement O'Reilly parts search API
      // GET ${baseUrl}/catalog/search?q=${query}&partNumber=${partNumber}&storeId=${config.storeId}
      console.warn("[parts_ordering:OReillyAuto] searchParts not yet implemented");
      return [];
    },

    async submitOrder(items: OrderItem[]): Promise<OrderResult> {
      const baseUrl = process.env.ORIELLY_BASE_URL;
      if (!baseUrl) return { success: false, error: "ORIELLY_BASE_URL not configured" };
      // TODO: implement O'Reilly order submission
      console.warn("[parts_ordering:OReillyAuto] submitOrder not yet implemented");
      return { success: false, error: "ORIELLY_NOT_IMPLEMENTED" };
    },

    async getOrderStatus(externalOrderId: string): Promise<OrderStatus> {
      return { status: "unknown" };
    },
  };
}
