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
      const baseUrl = process.env.PARTSTECH_BASE_URL ?? "https://api.partstech.com";
      
      try {
        const searchParams: any = {};
        if (partNumber) {
          searchParams.partNumber = [partNumber];
        } else {
          searchParams.keyword = query;
        }

        const res = await fetch(`${baseUrl}/catalog/quote`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${config.apiKey}`
          },
          body: JSON.stringify({ searchParams })
        });

        if (!res.ok) {
          console.error("[parts_ordering:PartsTech] Search failed:", res.status, await res.text());
          return [];
        }

        const data = await res.json();
        const parts = data.parts || [];

        return parts.map((p: any) => ({
          id: p.partId,
          partNumber: p.partNumber,
          description: p.partName,
          manufacturer: p.brand?.name || "Unknown",
          cost: p.price?.list || p.price?.cost || 0,
          listPrice: p.price?.list || 0,
          availability: p.status === "IN_STOCK" ? "in-stock" : "special-order",
          supplierName: p.supplier?.name || "PartsTech",
          supplierKey: "partstech"
        }));

      } catch (error) {
        console.error("[parts_ordering:PartsTech] Search Exception:", error);
        return [];
      }
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
