// [FEATURE: parts_ordering]
// Worldpac (OEM import parts) supplier adapter stub.
// Configure via rooftop supplier config: { worldpac: { username, password, warehouseId } }

import type { PartsSupplierAdapter, PartSearchResult, OrderResult, OrderStatus, OrderItem } from "./adapter";

interface WorldpacConfig {
  username: string;
  password: string;
  warehouseId?: string;
}

export function getWorldpacAdapter(config: WorldpacConfig): PartsSupplierAdapter {
  return {
    async searchParts(query: string, partNumber?: string): Promise<PartSearchResult[]> {
      const baseUrl = process.env.WORLDPAC_BASE_URL;
      if (!baseUrl) {
        console.warn("[parts_ordering:Worldpac] WORLDPAC_BASE_URL not set — returning empty");
        return [];
      }
      // TODO: implement Worldpac parts search (speedDIAL API)
      // POST ${baseUrl}/api/v1/search with Basic auth
      console.warn("[parts_ordering:Worldpac] searchParts not yet implemented");
      return [];
    },

    async submitOrder(items: OrderItem[]): Promise<OrderResult> {
      const baseUrl = process.env.WORLDPAC_BASE_URL;
      if (!baseUrl) return { success: false, error: "WORLDPAC_BASE_URL not configured" };
      // TODO: implement Worldpac order submission
      console.warn("[parts_ordering:Worldpac] submitOrder not yet implemented");
      return { success: false, error: "WORLDPAC_NOT_IMPLEMENTED" };
    },

    async getOrderStatus(externalOrderId: string): Promise<OrderStatus> {
      return { status: "unknown" };
    },
  };
}
