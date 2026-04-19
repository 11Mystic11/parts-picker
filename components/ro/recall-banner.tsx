// [FEATURE: recall_check]
// Recall banner for RO detail — fetches NHTSA open recalls for the VIN.
"use client";

import { useState, useEffect } from "react";
import { AlertTriangle, ChevronDown, ChevronUp } from "lucide-react";

interface Campaign {
  NHTSACampaignNumber: string;
  Component: string;
  Summary: string;
  Consequence: string;
  Remedy: string;
}

interface Props {
  roId: string;
  initialCount: number | null;
}

export function RecallBanner({ roId, initialCount }: Props) {
  const [count, setCount] = useState(initialCount ?? 0);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(initialCount === null);

  useEffect(() => {
    if (initialCount !== null && initialCount > 0) return; // already have cache
    // If no cache or initialCount is null, fetch fresh
    async function check() {
      setLoading(true);
      try {
        const res = await fetch(`/api/recalls?roId=${roId}`);
        if (res.ok) {
          const data = await res.json();
          setCount(data.count ?? 0);
        }
      } finally {
        setLoading(false);
      }
    }
    check();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roId]);

  async function loadCampaigns() {
    if (campaigns.length > 0) { setExpanded(!expanded); return; }
    const res = await fetch(`/api/recalls?roId=${roId}`);
    if (res.ok) {
      const data = await res.json();
      setCampaigns(data.campaigns ?? []);
    }
    setExpanded(true);
  }

  if (loading) return null;
  if (count === 0) return null;

  return (
    <div className="mb-5 rounded-lg border border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-950/30 overflow-hidden">
      <button
        onClick={loadCampaigns}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-red-100 dark:hover:bg-red-950/50 transition-colors"
      >
        <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400 flex-shrink-0" />
        <span className="text-sm font-medium text-red-700 dark:text-red-300 flex-1">
          {count} open NHTSA recall{count !== 1 ? "s" : ""} found for this vehicle
        </span>
        {expanded ? (
          <ChevronUp className="h-4 w-4 text-red-500 flex-shrink-0" />
        ) : (
          <ChevronDown className="h-4 w-4 text-red-500 flex-shrink-0" />
        )}
      </button>

      {expanded && campaigns.length > 0 && (
        <div className="border-t border-red-200 dark:border-red-800 divide-y divide-red-200 dark:divide-red-800">
          {campaigns.map((c) => (
            <div key={c.NHTSACampaignNumber} className="px-4 py-3 space-y-1">
              <p className="text-xs font-mono text-red-600 dark:text-red-400">{c.NHTSACampaignNumber}</p>
              <p className="text-sm font-medium text-red-800 dark:text-red-200">{c.Component}</p>
              <p className="text-xs text-red-700 dark:text-red-300">{c.Summary}</p>
              {c.Remedy && (
                <p className="text-xs text-muted-foreground"><span className="font-medium">Remedy:</span> {c.Remedy}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
