import { prisma as db } from "@/lib/db";

/**
 * Known feature flags.
 * Add new keys here as the product grows.
 */
export const FLAG_KEYS = [
  "dms_sync",         // Enable live DMS sync on RO approval
  "mfa_enforcement",  // Honour rooftop.mfaRequired and redirect to /auth/mfa
  "tablet_ux",        // Progressive rollout of Phase 10 tablet UX
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
