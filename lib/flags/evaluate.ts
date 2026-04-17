import { prisma as db } from "@/lib/db";

/**
 * Known feature flags.
 * Add new keys here as the product grows.
 */
export const FLAG_KEYS = [
  "dms_sync",         // Enable live DMS sync on RO approval
  "mfa_enforcement",  // Honour rooftop.mfaRequired and redirect to /auth/mfa
  "tablet_ux",        // Progressive rollout of Phase 10 tablet UX
  // [FEATURE: customer_approval_portal] START
  "customer_approval_portal", // SMS/email magic-token approval link for customers
  // [FEATURE: customer_approval_portal] END
  // [FEATURE: dvi] START
  "dvi",              // Digital Vehicle Inspection — photo/video per line item
  // [FEATURE: dvi] END
  // [FEATURE: tech_time_clock] START
  "tech_time_clock",  // Technician clock in/out per labor op; efficiency reporting
  // [FEATURE: tech_time_clock] END
  // [FEATURE: parts_ordering] START
  "parts_ordering",   // Search NAPA/AutoZone catalogs and submit orders from RO
  // [FEATURE: parts_ordering] END
  // [FEATURE: core_return_tracking] START
  "core_return_tracking", // Track core/warranty part returns to supplier
  // [FEATURE: core_return_tracking] END
  // [FEATURE: canned_inspections] START
  "canned_inspections",   // Multi-point inspection templates auto-attached by mileage
  // [FEATURE: canned_inspections] END
  // [FEATURE: inventory_ro_integration] START
  "inventory_ro_integration", // Auto-decrement inventory on RO approval; low-stock warnings
  // [FEATURE: inventory_ro_integration] END
] as const;

export type FlagKey = (typeof FLAG_KEYS)[number];

/**
 * Evaluate a feature flag for a given rooftop.
 *
 * Resolution order:
 *   1. Rooftop-level record (flagKey + rooftopId) — most specific
 *   2. Global record (flagKey, rooftopId = null) — fallback
 *   3. false — if neither record exists
 */
export async function flagEnabled(
  key: FlagKey,
  rooftopId?: string | null
): Promise<boolean> {
  // Fetch both records in one query (rooftop-specific + global)
  const rows = await db.featureFlag.findMany({
    where: {
      flagKey: key,
      OR: rooftopId
        ? [{ rooftopId }, { rooftopId: null }]
        : [{ rooftopId: null }],
    },
  });

  // Prefer the rooftop-specific row
  const rooftopRow = rows.find((r) => r.rooftopId === rooftopId);
  if (rooftopRow) return rooftopRow.enabled;

  // Fall back to global
  const globalRow = rows.find((r) => r.rooftopId === null);
  if (globalRow) return globalRow.enabled;

  return false;
}

/**
 * Seed / upsert a flag record. Used by the admin API.
 */
export async function setFlag(
  key: FlagKey,
  enabled: boolean,
  rooftopId?: string | null
): Promise<void> {
  await db.featureFlag.upsert({
    where: {
      flagKey_rooftopId: {
        flagKey: key,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        rooftopId: (rooftopId ?? null) as any,
      },
    },
    update: { enabled },
    create: {
      flagKey: key,
      rooftopId: rooftopId ?? null,
      enabled,
    },
  });
}

/**
 * Return all flag rows for a given rooftop (including global rows),
 * merged into a single map with rooftop overrides applied.
 * Shape: { [flagKey]: { enabled, scope: "rooftop" | "global" | "default" } }
 */
export async function getAllFlags(rooftopId?: string | null): Promise<
  Record<string, { enabled: boolean; scope: "rooftop" | "global" | "default" }>
> {
  const rows = await db.featureFlag.findMany({
    where: rooftopId
      ? { OR: [{ rooftopId }, { rooftopId: null }] }
      : { rooftopId: null },
  });

  const result: Record<
    string,
    { enabled: boolean; scope: "rooftop" | "global" | "default" }
  > = {};

  // Start with defaults
  for (const key of FLAG_KEYS) {
    result[key] = { enabled: false, scope: "default" };
  }

  // Apply global rows
  for (const row of rows.filter((r) => r.rooftopId === null)) {
    result[row.flagKey] = { enabled: row.enabled, scope: "global" };
  }

  // Apply rooftop-level overrides (higher priority)
  for (const row of rows.filter((r) => r.rooftopId === rooftopId)) {
    result[row.flagKey] = { enabled: row.enabled, scope: "rooftop" };
  }

  return result;
}
