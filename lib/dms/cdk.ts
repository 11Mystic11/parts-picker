/**
 * lib/dms/cdk.ts
 *
 * CDK Global adapter.
 *
 * Auth: OAuth2 client-credentials flow.
 *   Token URL: process.env.CDK_TOKEN_URL  (e.g. https://sso.cdk.com/oauth2/token)
 *   Scope:     process.env.CDK_SCOPE      (e.g. ros:write)
 *   Base URL:  process.env.CDK_BASE_URL   (e.g. https://api.cdk.com/v1)
 *
 * Credentials stored encrypted in Rooftop.dmsConfig:
 *   { clientId, clientSecret, dealerNumber }
 *
 * STUB MODE: When CDK_TOKEN_URL is absent (local dev / no sandbox), the adapter
 * logs a warning and returns { success: false, error: "CDK_STUB_MODE" } so the
 * system correctly records a failed-but-attempted sync.
 */

import type { DMSAdapter, DMSSyncResult, RepairOrderPayload } from "./adapter";

interface CDKConfig {
  clientId: string;
  clientSecret: string;
  dealerNumber: string;
}

interface TokenCache {
  token: string;
  expiresAt: number;
}

let _tokenCache: TokenCache | null = null;

async function fetchCDKToken(config: CDKConfig): Promise<string | null> {
  const tokenUrl = process.env.CDK_TOKEN_URL;
  const scope = process.env.CDK_SCOPE ?? "ros:write";

  if (!tokenUrl) return null;

  // Use cached token if still valid (with 60s buffer)
  if (_tokenCache && _tokenCache.expiresAt > Date.now() + 60_000) {
    return _tokenCache.token;
  }

  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: config.clientId,
    client_secret: config.clientSecret,
    scope,
  });

  const res = await fetch(tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (!res.ok) {
    console.error("[CDK] Token fetch failed:", res.status, await res.text());
    return null;
  }

  const data = (await res.json()) as { access_token: string; expires_in: number };
  _tokenCache = {
    token: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  };
  return _tokenCache.token;
}

/** Maps our internal RO payload to CDK's RO creation shape. */
function mapToCDKPayload(ro: RepairOrderPayload, dealerNumber: string) {
  return {
    dealerNumber,
    externalReferenceId: ro.roId,
    vin: ro.vin,
    mileageIn: ro.currentMileage ?? 0,
    advisorId: ro.advisorEmployeeId ?? ro.advisorName,
    laborTotal: ro.laborSubtotal,
    partsTotal: ro.partsSubtotal,
    miscTotal: ro.shopSupplyFee,
    tax: ro.taxAmount,
    total: ro.totalAmount,
    notes: ro.notes ?? "",
    operations: ro.lineItems
      .filter((li) => li.type === "labor")
      .map((li) => ({
        opCode: li.laborOpCode ?? "MISC",
        description: li.description,
        laborAmount: li.totalPrice,
      })),
    parts: ro.lineItems
      .filter((li) => li.type === "part")
      .map((li) => ({
        partNumber: li.partNumber ?? "MISC",
        description: li.description,
        quantity: li.quantity,
        unitPrice: li.unitPrice,
        totalPrice: li.totalPrice,
      })),
  };
}

class CDKAdapter implements DMSAdapter {
  constructor(private config: CDKConfig) {}

  async pushRO(ro: RepairOrderPayload): Promise<DMSSyncResult> {
    const baseUrl = process.env.CDK_BASE_URL;

    if (!baseUrl || !process.env.CDK_TOKEN_URL) {
      console.warn("[CDK] STUB MODE — CDK_TOKEN_URL not set. Sync skipped.");
      return { success: false, error: "CDK_STUB_MODE: CDK_TOKEN_URL not configured" };
    }

    const token = await fetchCDKToken(this.config);
    if (!token) {
      return { success: false, error: "CDK auth failed — could not obtain access token" };
    }

    const payload = mapToCDKPayload(ro, this.config.dealerNumber);

    try {
      const res = await fetch(`${baseUrl}/ros`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(15_000),
      });

      if (!res.ok) {
        const text = await res.text();
        console.error("[CDK] pushRO failed:", res.status, text);
        return { success: false, error: `CDK ${res.status}: ${text.slice(0, 200)}` };
      }

      const data = (await res.json()) as { roId?: string; id?: string };
      const externalId = data.roId ?? data.id ?? "unknown";
      return { success: true, externalId };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[CDK] pushRO error:", msg);
      return { success: false, error: `CDK network error: ${msg}` };
    }
  }
}

export function getCDKAdapter(config: Record<string, string>): DMSAdapter {
  return new CDKAdapter(config as unknown as CDKConfig);
}
