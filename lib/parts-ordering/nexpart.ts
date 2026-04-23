// [FEATURE: parts_ordering]
// Nexpart Multi-Seller supplier adapter skeleton.
// TODO: Replace with real WHI Nexpart API integration.
// Config shape: { username: string, password: string }
// Remove this file to disable.

import type { PartsSupplierAdapter, PartSearchResult, OrderResult, OrderStatus, OrderItem } from "./adapter";
import { getMockAdapter } from "./mock";

interface NexpartConfig {
  username: string;
  password?: string;
}

export function getNexpartAdapter(config: NexpartConfig): PartsSupplierAdapter {
  // Nexpart API typically uses XML/HTTPS or a specific JSON gateway.
  // Until credentials are provided, we fall back to mock.

  if (!config.username) {
    console.warn("[parts_ordering] Nexpart adapter: missing credentials — using mock");
    return getMockAdapter();
  }

  return {
    async searchParts(query: string, partNumber?: string): Promise<PartSearchResult[]> {
      console.log("[Nexpart] searchParts stub", { query, partNumber });
      // In a real implementation, we would call the Nexpart Gateway here.
      return getMockAdapter().searchParts(query, partNumber);
    },

    async submitOrder(items: OrderItem[]): Promise<OrderResult> {
      console.log("[Nexpart] submitOrder stub", { items });
      return getMockAdapter().submitOrder(items);
    },

    async getOrderStatus(externalOrderId: string): Promise<OrderStatus> {
      console.log("[Nexpart] getOrderStatus stub", { externalOrderId });
      return getMockAdapter().getOrderStatus(externalOrderId);
    },
  };
}
