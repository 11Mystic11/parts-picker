/**
 * lib/dms/dealersocket.ts
 *
 * DealerSocket (Solera) DMS adapter.
 *
 * Auth: API key header.
 *   Base URL: process.env.DEALERSOCKET_BASE_URL
 *
 * Credentials stored encrypted in Rooftop.dmsConfig:
 *   { apiKey, dealerCode }
 *
 * STUB MODE: Returns { success: false, error: "DEALERSOCKET_STUB_MODE" }
 * when DEALERSOCKET_BASE_URL is not configured.
 */

import type { DMSAdapter, DMSSyncResult, RepairOrderPayload } from "./adapter";

interface DealerSocketConfig {
  apiKey: string;
  dealerCode: string;
}

export function getDealerSocketAdapter(config: Record<string, string>): DMSAdapter {
  const { apiKey, dealerCode } = config as unknown as DealerSocketConfig;

  return {
    async pushRO(ro: RepairOrderPayload): Promise<DMSSyncResult> {
      const baseUrl = process.env.DEALERSOCKET_BASE_URL;
      if (!baseUrl) {
        console.warn("[DMS:DealerSocket] DEALERSOCKET_BASE_URL not set — stub mode");
        return { success: false, error: "DEALERSOCKET_STUB_MODE" };
      }

      // TODO: implement POST to DealerSocket RO endpoint
      // POST ${baseUrl}/api/v1/repairorders
      // Headers: { "X-Api-Key": apiKey, "X-Dealer-Code": dealerCode }
      console.warn("[DMS:DealerSocket] pushRO not yet implemented");
      return { success: false, error: "DEALERSOCKET_NOT_IMPLEMENTED" };
    },
  };
}
