/**
 * lib/dms/reynolds.ts
 *
 * Reynolds & Reynolds adapter.
 *
 * Auth: API key passed as X-API-Key header.
 *   Base URL: process.env.REYNOLDS_BASE_URL  (e.g. https://api.reyrey.net/v2)
 *
 * Credentials stored encrypted in Rooftop.dmsConfig:
 *   { apiKey, dealerCode }
 *
 * STUB MODE: When REYNOLDS_BASE_URL is absent, the adapter returns
 * { success: false, error: "REYNOLDS_STUB_MODE" }.
 */

import type { DMSAdapter, DMSSyncResult, RepairOrderPayload } from "./adapter";

interface ReynoldsConfig {
  apiKey: string;
  dealerCode: string;
}

/** Maps our internal RO payload to Reynolds' RO creation shape. */
function mapToReynoldsPayload(ro: RepairOrderPayload, dealerCode: string) {
  return {
    dealerCode,
    referenceNumber: ro.roId,
    vehicleVIN: ro.vin,
    currentOdometer: ro.currentMileage ?? 0,
    serviceAdvisor: ro.advisorEmployeeId ?? ro.advisorName,
    laborAmount: ro.laborSubtotal,
    partsAmount: ro.partsSubtotal,
    supplyAmount: ro.shopSupplyFee,
    taxAmount: ro.taxAmount,
    invoiceTotal: ro.totalAmount,
    comments: ro.notes ?? "",
    serviceLines: ro.lineItems.map((li, idx) => ({
      lineNumber: idx + 1,
      lineType: li.type.toUpperCase(),
      description: li.description,
      opCode: li.laborOpCode ?? undefined,
      partNumber: li.partNumber ?? undefined,
      quantity: li.quantity,
      unitPrice: li.unitPrice,
      lineTotal: li.totalPrice,
    })),
  };
}

class ReynoldsAdapter implements DMSAdapter {
  constructor(private config: ReynoldsConfig) {}

  async pushRO(ro: RepairOrderPayload): Promise<DMSSyncResult> {
    const baseUrl = process.env.REYNOLDS_BASE_URL;

    if (!baseUrl) {
      console.warn("[Reynolds] STUB MODE — REYNOLDS_BASE_URL not set. Sync skipped.");
      return { success: false, error: "REYNOLDS_STUB_MODE: REYNOLDS_BASE_URL not configured" };
    }

    const payload = mapToReynoldsPayload(ro, this.config.dealerCode);

    try {
      const res = await fetch(`${baseUrl}/repair-orders`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": this.config.apiKey,
          "X-Dealer-Code": this.config.dealerCode,
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(15_000),
      });

      if (!res.ok) {
        const text = await res.text();
        console.error("[Reynolds] pushRO failed:", res.status, text);
        return { success: false, error: `Reynolds ${res.status}: ${text.slice(0, 200)}` };
      }

      const data = (await res.json()) as { repairOrderNumber?: string; id?: string };
      const externalId = data.repairOrderNumber ?? data.id ?? "unknown";
      return { success: true, externalId };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[Reynolds] pushRO error:", msg);
      return { success: false, error: `Reynolds network error: ${msg}` };
    }
  }
}

export function getReynoldsAdapter(config: Record<string, string>): DMSAdapter {
  return new ReynoldsAdapter(config as unknown as ReynoldsConfig);
}
