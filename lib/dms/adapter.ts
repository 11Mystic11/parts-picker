/**
 * lib/dms/adapter.ts
 *
 * Defines the DMSAdapter interface, shared payload/result types, and the
 * getDMSAdapter() factory that returns the correct adapter for a rooftop's
 * DMS configuration (or null when DMS is not configured / disabled).
 */

import type { Rooftop } from "@prisma/client";

// ─── Shared Types ─────────────────────────────────────────────────────────────

/** Minimal RO payload pushed to the DMS. */
export interface RepairOrderPayload {
  roId: string;
  vin: string;
  advisorName: string;
  advisorEmployeeId?: string | null;
  currentMileage: number | null;
  status: string;
  partsSubtotal: number;
  laborSubtotal: number;
  shopSupplyFee: number;
  taxAmount: number;
  totalAmount: number;
  notes?: string | null;
  lineItems: LineItemPayload[];
  createdAt: Date;
  approvedAt?: Date | null;
}

export interface LineItemPayload {
  type: string;
  description: string;
  partNumber?: string | null;
  laborOpCode?: string | null;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

/** Vehicle history entry pulled from DMS (optional capability). */
export interface VehicleHistoryEntry {
  date: string;
  mileage: number;
  description: string;
  totalAmount: number;
  dmsROId: string;
}

/** Result returned by pushRO(). */
export type DMSSyncResult =
  | { success: true; externalId: string }
  | { success: false; error: string };

// ─── Adapter Interface ─────────────────────────────────────────────────────────

export interface DMSAdapter {
  /** Push an approved RO to the DMS. Returns the DMS-assigned RO ID on success. */
  pushRO(ro: RepairOrderPayload): Promise<DMSSyncResult>;
  /** Pull vehicle service history from the DMS (optional — not all adapters support this). */
  pullVehicleHistory?(vin: string): Promise<VehicleHistoryEntry[]>;
}

// ─── Credential Encryption / Decryption ───────────────────────────────────────

import crypto from "crypto";

const ALGO = "aes-256-gcm";

function getEncryptionKey(): Buffer {
  const secret = process.env.NEXTAUTH_SECRET ?? "fallback-dev-secret-32-chars!!";
  // Derive a fixed-length 32-byte key from the secret
  return crypto.createHash("sha256").update(secret).digest();
}

export function encryptConfig(plain: object): string {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGO, key, iv);
  const json = JSON.stringify(plain);
  const encrypted = Buffer.concat([cipher.update(json, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  // iv:tag:ciphertext (all hex)
  return [iv.toString("hex"), tag.toString("hex"), encrypted.toString("hex")].join(":");
}

export function decryptConfig<T = Record<string, string>>(ciphertext: string): T | null {
  try {
    const key = getEncryptionKey();
    const [ivHex, tagHex, dataHex] = ciphertext.split(":");
    const iv = Buffer.from(ivHex, "hex");
    const tag = Buffer.from(tagHex, "hex");
    const data = Buffer.from(dataHex, "hex");
    const decipher = crypto.createDecipheriv(ALGO, key, iv);
    decipher.setAuthTag(tag);
    const plain = Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
    return JSON.parse(plain) as T;
  } catch {
    return null;
  }
}

// ─── Factory ──────────────────────────────────────────────────────────────────

/**
 * Returns the DMS adapter for the given rooftop, or null if DMS is not
 * configured or the provider is unrecognised.
 */
export async function getDMSAdapter(rooftop: Pick<Rooftop, "dmsProvider" | "dmsConfig">): Promise<DMSAdapter | null> {
  if (!rooftop.dmsProvider || !rooftop.dmsConfig) return null;

  const config = decryptConfig(rooftop.dmsConfig);
  if (!config) {
    console.warn("[DMS] Failed to decrypt dmsConfig — adapter disabled");
    return null;
  }

  switch (rooftop.dmsProvider) {
    case "cdk": {
      const { getCDKAdapter } = await import("./cdk");
      return getCDKAdapter(config as Record<string, string>);
    }
    case "reynolds": {
      const { getReynoldsAdapter } = await import("./reynolds");
      return getReynoldsAdapter(config as Record<string, string>);
    }
    case "dealertrack": {
      const { getDealerTrackAdapter } = await import("./dealertrack");
      return getDealerTrackAdapter(config as Record<string, string>);
    }
    case "dealersocket": {
      const { getDealerSocketAdapter } = await import("./dealersocket");
      return getDealerSocketAdapter(config as Record<string, string>);
    }
    case "pbs": {
      const { getPBSAdapter } = await import("./pbs");
      return getPBSAdapter(config as Record<string, string>);
    }
    case "mitchell1": {
      const { getMitchell1Adapter } = await import("./mitchell1");
      return getMitchell1Adapter(config as Record<string, string>);
    }
    default:
      console.warn(`[DMS] Unknown provider: ${rooftop.dmsProvider}`);
      return null;
  }
}
