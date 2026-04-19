/**
 * lib/dms/dealertrack.ts
 *
 * DealerTrack (Cox Automotive) DMS adapter.
 *
 * Auth: OAuth2 client-credentials.
 *   Token URL:  process.env.DEALERTRACK_TOKEN_URL
 *   Base URL:   process.env.DEALERTRACK_BASE_URL
 *
 * Credentials stored encrypted in Rooftop.dmsConfig:
 *   { clientId, clientSecret, dealerId }
 *
 * STUB MODE: Returns { success: false, error: "DEALERTRACK_STUB_MODE" }
 * when DEALERTRACK_BASE_URL is not configured.
 */

import type { DMSAdapter, DMSSyncResult, RepairOrderPayload } from "./adapter";

interface DealerTrackConfig {
  clientId: string;
  clientSecret: string;
  dealerId: string;
}

export function getDealerTrackAdapter(config: Record<string, string>): DMSAdapter {
  const { clientId, clientSecret, dealerId } = config as unknown as DealerTrackConfig;

  return {
    async pushRO(ro: RepairOrderPayload): Promise<DMSSyncResult> {
      const baseUrl = process.env.DEALERTRACK_BASE_URL;
      if (!baseUrl) {
        console.warn("[DMS:DealerTrack] DEALERTRACK_BASE_URL not set — stub mode");
        return { success: false, error: "DEALERTRACK_STUB_MODE" };
      }

      // TODO: implement OAuth token fetch + POST to DealerTrack RO endpoint
      // POST ${baseUrl}/dealers/${dealerId}/repairOrders
      console.warn("[DMS:DealerTrack] pushRO not yet implemented");
      return { success: false, error: "DEALERTRACK_NOT_IMPLEMENTED" };
    },
  };
}
