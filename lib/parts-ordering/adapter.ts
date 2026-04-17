// [FEATURE: parts_ordering]
// Parts supplier adapter interface — mirrors the DMS adapter pattern in lib/dms/adapter.ts.
// Remove this file and all parts-ordering/ lib files to disable.

export interface PartSearchResult {
  partNumber: string;
  description: string;
  brand: string;
  unitCost: number;
  availability: "in_stock" | "limited" | "out_of_stock" | "unknown";
  estimatedDelivery?: string;
}

export interface OrderItem {
  partNumber: string;
  description: string;
  quantity: number;
  unitCost: number;
}

export interface OrderResult {
  success: boolean;
  externalOrderId?: string;
  estimatedDelivery?: string;
  error?: string;
}

export interface OrderStatus {
  status: "pending" | "submitted" | "confirmed" | "shipped" | "delivered" | "cancelled" | "unknown";
  trackingNumber?: string;
  estimatedDelivery?: string;
  lastUpdated?: string;
}

export interface PartsSupplierAdapter {
  searchParts(query: string, partNumber?: string): Promise<PartSearchResult[]>;
  submitOrder(items: OrderItem[]): Promise<OrderResult>;
  getOrderStatus(externalOrderId: string): Promise<OrderStatus>;
}
