/**
 * lib/dms/mitchell1.ts
 *
 * Mitchell 1 (Shop Management) DMS adapter.
 *
 * Auth: API key.
 *   Base URL: process.env.MITCHELL1_BASE_URL
 *
 * Credentials stored encrypted in Rooftop.dmsConfig:
 *   { apiKey, shopId }
 *
 * STUB MODE: Returns { success: false, error: "MITCHELL1_STUB_MODE" }
 * when MITCHELL1_BASE_URL is not configured.
 */

import type { DMSAdapter, DMSSyncResult, RepairOrderPayload } from "./adapter";

interface Mitchell1Config {
  apiKey: string;
  shopId: string;
}

export function getMitchell1Adapter(config: Record<string, string>): DMSAdapter {
  const { apiKey, shopId } = config as unknown as Mitchell1Config;

  return {
    async pushRO(ro: RepairOrderPayload): Promise<DMSSyncResult> {
      const baseUrl = process.env.MITCHELL1_BASE_URL;
      if (!baseUrl) {
        console.warn("[DMS:Mitchell1] MITCHELL1_BASE_URL not set — stub mode");
        return { success: false, error: "MITCHELL1_STUB_MODE" };
      }

      // TODO: implement Mitchell 1 RO push
      // POST ${baseUrl}/v1/shops/${shopId}/orders
      // Headers: { "Authorization": `Bearer ${apiKey}` }
      console.warn("[DMS:Mitchell1] pushRO not yet implemented");
      return { success: false, error: "MITCHELL1_NOT_IMPLEMENTED" };
    },
  };
}
