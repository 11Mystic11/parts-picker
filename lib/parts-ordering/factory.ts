// [FEATURE: parts_ordering]
// Factory — resolves the right parts supplier adapter from a supplier key and rooftop config.
// Mirrors getDMSAdapter() in lib/dms/adapter.ts.
// Remove this file to disable.

import type { PartsSupplierAdapter } from "./adapter";
import { getMockAdapter } from "./mock";

/**
 * Rooftop-level supplier config shape.
 * Store as JSON in a rooftop config field (or use the existing dmsConfig pattern if co-located).
 * Shape: { napa?: { apiKey, accountId, storeId }, autozone?: { apiKey, storeNumber } }
 */
type SupplierConfig = {
  napa?: { apiKey: string; accountId: string; storeId?: string };
  autozone?: { apiKey: string; storeNumber: string };
};

export function getSupplierAdapter(
  supplier: string,
  rooftopSupplierConfig?: string | null
): PartsSupplierAdapter {
  let config: SupplierConfig = {};
  if (rooftopSupplierConfig) {
    try {
      config = JSON.parse(rooftopSupplierConfig);
    } catch {
      console.warn("[parts_ordering] Failed to parse rooftop supplier config — using mock");
    }
  }

  switch (supplier.toUpperCase()) {
    case "NAPA": {
      const { getNAPAAdapter } = require("./napa");
      return getNAPAAdapter(config.napa ?? { apiKey: "", accountId: "" });
    }
    case "AUTOZONE": {
      const { getAutoZoneAdapter } = require("./autozone");
      return getAutoZoneAdapter(config.autozone ?? { apiKey: "", storeNumber: "" });
    }
    default:
      return getMockAdapter();
  }
}
