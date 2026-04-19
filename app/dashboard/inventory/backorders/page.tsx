// [FEATURE: backorder_tracking]
// Backorder report — all open backordered parts sorted by age.
// Remove this file to disable.

"use client";

import { useState, useEffect } from "react";
import { AlertTriangle, RefreshCw, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface BackorderItem {
  id: string;
  supplier: string;
  status: string;
  submittedAt: string | null;
  backorderEta: string | null;
  items: string; // JSON
  repairOrder: { id: string; roNumber: string | null; vin: string; customerName: string | null };
}

function daysSince(iso: string | null) {
  if (!iso) return null;
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
}

export default function BackordersPage() {
  const router = useRouter();
  const [backorders, setBackorders] = useState<BackorderItem[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const res = await fetch("/api/reports/backorders");
    if (res.ok) {
      const { backorders: data } = await res.json();
      setBackorders(data ?? []);
    }
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  function getFirstPart(itemsJson: string) {
    try {
      const items = JSON.parse(itemsJson);
      if (Array.isArray(items) && items.length > 0) {
        const first = items[0];
        return `${first.partNumber ?? ""} ${first.description ?? ""}`.trim();
      }
    } catch { /* */ }
    return "Unknown part";
  }

  return (
    <div className="p-6 max-w-4xl space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <AlertTriangle className="h-6 w-6 text-amber-500" />
          <div>
            <h1 className="text-2xl font-bold text-foreground">Backorders</h1>
            <p className="text-sm text-muted-foreground">Open parts orders marked as backordered</p>
          </div>
        </div>
        <Button size="sm" variant="outline" onClick={load} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-1.5 ${loading ? "animate-spin" : ""}`} /> Refresh
        </Button>
      </div>

      <div className="border border-border rounded-xl overflow-hidden">
        <div className="px-4 py-2.5 bg-surface border-b border-border flex items-center justify-between">
          <span className="text-sm font-semibold text-muted-foreground">
            {backorders.length} backordered item{backorders.length !== 1 ? "s" : ""}
          </span>
        </div>

        {loading ? (
          <div className="px-4 py-8 text-center text-sm text-muted-foreground animate-pulse">Loading…</div>
        ) : backorders.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-muted-foreground">
            No open backorders
          </div>
        ) : (
          <div className="divide-y divide-border">
            {backorders.map((b) => {
              const days = daysSince(b.submittedAt);
              const etaDate = b.backorderEta ? new Date(b.backorderEta).toLocaleDateString() : null;
              const partLabel = getFirstPart(b.items);

              return (
                <div key={b.id} className="px-4 py-3 flex items-start gap-3 hover:bg-surface-hover text-sm">
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-foreground">{partLabel}</span>
                      <span className="text-xs text-muted-foreground">{b.supplier}</span>
                      {days !== null && (
                        <span className={`text-xs font-medium ${days > 14 ? "text-red-500" : "text-amber-500"}`}>
                          {days}d waiting
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                      <Link href={`/dashboard/ro/${b.repairOrder.id}`} className="hover:underline font-medium text-foreground">
                        {b.repairOrder.roNumber ?? b.repairOrder.id.slice(-8).toUpperCase()}
                      </Link>
                      <span>·</span>
                      <span>{b.repairOrder.vin}</span>
                      {b.repairOrder.customerName && <><span>·</span><span>{b.repairOrder.customerName}</span></>}
                      {etaDate && <><span>·</span><span className="text-foreground">ETA: {etaDate}</span></>}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-shrink-0 text-xs"
                    onClick={() => router.push(`/dashboard/inventory?q=${encodeURIComponent(partLabel)}`)}
                  >
                    <Search className="h-3 w-3 mr-1" /> Source Elsewhere
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
