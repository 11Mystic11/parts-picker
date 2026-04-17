// [FEATURE: tech_time_clock]
// Efficiency calculation utilities for the technician time clock feature.
// Remove this file and its call sites to disable.

export interface TimeEntryForCalc {
  techId: string;
  techName?: string | null;
  clockedInAt: Date;
  clockedOutAt: Date | null;
  flatRateHours: number | null;
}

export interface TechEfficiency {
  techId: string;
  techName: string;
  actualHours: number;
  flatRateHours: number;
  efficiencyPct: number; // flatRate / actual * 100 (>100 = beat flat rate)
  entryCount: number;
}

/**
 * Computes per-tech efficiency from a list of time entries.
 * Excludes open (not yet clocked out) entries from actual hours.
 */
export function calcEfficiency(entries: TimeEntryForCalc[]): TechEfficiency[] {
  const byTech = new Map<string, { name: string; actualMs: number; flatRate: number; count: number }>();

  for (const entry of entries) {
    if (!entry.clockedOutAt) continue; // skip open entries

    const actualMs = entry.clockedOutAt.getTime() - entry.clockedInAt.getTime();
    const existing = byTech.get(entry.techId) ?? {
      name: entry.techName ?? entry.techId,
      actualMs: 0,
      flatRate: 0,
      count: 0,
    };

    byTech.set(entry.techId, {
      name: existing.name,
      actualMs: existing.actualMs + actualMs,
      flatRate: existing.flatRate + (entry.flatRateHours ?? 0),
      count: existing.count + 1,
    });
  }

  return Array.from(byTech.entries()).map(([techId, data]) => {
    const actualHours = data.actualMs / (1000 * 60 * 60);
    const flatRateHours = data.flatRate;
    const efficiencyPct = actualHours > 0 ? (flatRateHours / actualHours) * 100 : 0;

    return {
      techId,
      techName: data.name,
      actualHours: Math.round(actualHours * 100) / 100,
      flatRateHours: Math.round(flatRateHours * 100) / 100,
      efficiencyPct: Math.round(efficiencyPct * 10) / 10,
      entryCount: data.count,
    };
  });
}
