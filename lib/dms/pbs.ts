/**
 * lib/dms/pbs.ts
 *
 * PBS Systems DMS adapter.
 *
 * Auth: Username + password (basic auth or session token).
 *   Base URL: process.env.PBS_BASE_URL
 *
 * Credentials stored encrypted in Rooftop.dmsConfig:
 *   { username, password, dealerNumber }
 *
 * STUB MODE: Returns { success: false, error: "PBS_STUB_MODE" }
 * when PBS_BASE_URL is not configured.
 */

import type { DMSAdapter, DMSSyncResult, RepairOrderPayload } from "./adapter";

interface PBSConfig {
  username: string;
  password: string;
  dealerNumber: string;
}

export function getPBSAdapter(config: Record<string, string>): DMSAdapter {
  const { username, password, dealerNumber } = config as unknown as PBSConfig;

  return {
    async pushRO(ro: RepairOrderPayload): Promise<DMSSyncResult> {
      const baseUrl = process.env.PBS_BASE_URL;
      if (!baseUrl) {
        console.warn("[DMS:PBS] PBS_BASE_URL not set — stub mode");
        return { success: false, error: "PBS_STUB_MODE" };
      }

      // TODO: implement PBS Systems RO push
      // POST ${baseUrl}/api/repairorders
      // Auth: Basic auth with username:password
      console.warn("[DMS:PBS] pushRO not yet implemented");
      return { success: false, error: "PBS_NOT_IMPLEMENTED" };
    },
  };
}
