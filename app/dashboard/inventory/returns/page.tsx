// [FEATURE: core_return_tracking]
// Part Returns management page — list with pipeline summary, status filters, and status advancement.
// Remove this file to disable.

"use client";

import { useState, useEffect, useCallback } from "react";
import { RotateCcw, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ReturnStatusBadge } from "@/components/returns/return-status-badge";
import { ReturnForm } from "@/components/returns/return-form";

interface PartReturn {
  id: string;
  partNumber: string;
  description: string;
  supplier: string;
  returnType: string;
  quantity: number;
  expectedCredit: number;
  actualCredit: number | null;
  status: string;
  trackingNumber: string | null;
  createdAt: string;
  repairOrder: { roNumber: string | null } | null;
}

const STATUSES = ["pending", "submitted", "received", "credited", "rejected"];

const STATUS_NEXT: Record<string, string | null> = {
  pending: "submitted",
  submitted: "received",
  received: "credited",
  credited: null,
  rejected: null,
};

export default function ReturnsPage() {
  const [returns, setReturns] = useState<PartReturn[]>([]);
  const [filter, setFilter] = useState<string>("all");
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [advancing, setAdvancing] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const params = filter !== "all" ? `?status=${filter}` : "";
    const res = await fetch(`/api/part-returns${params}`);
    if (res.ok) {
      const { returns: data } = await res.json();
      setReturns(data ?? []);
    }
    setLoading(false);
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  async function advanceStatus(id: string, nextStatus: string) {
    setAdvancing(id);
    await fetch(`/api/part-returns/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: nextStatus }),
    });
    setAdvancing(null);
    load();
  }

  // Pipeline counts
  const counts = STATUSES.reduce((acc, s) => {
    acc[s] = returns.filter((r) => r.status === s).length;
    return acc;
  }, {} as Record<string, number>);

  // Total expected credit (pending + submitted)
  const pendingCredit = returns
    .filter((r) => ["pending", "submitted", "received"].includes(r.status))
    .reduce((s, r) => s + r.expectedCredit, 0);

  return (
    <div className="p-6 max-w-5xl space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <RotateCcw className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-2xl font-bold text-foreground">Part Returns</h1>
            <p className="text-sm text-muted-foreground">Track core charges and warranty returns</p>
          </div>
        </div>
        <Button size="sm" onClick={() => setShowForm(true)}>
          <Plus className="h-4 w-4 mr-1.5" /> Log Return
        </Button>
      </div>

      {/* Pipeline summary */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {STATUSES.map((s) => (
          <div
            key={s}
            onClick={() => setFilter(filter === s ? "all" : s)}
            className={`rounded-lg border p-3 cursor-pointer transition-colors ${
              filter === s ? "border-primary bg-primary/5" : "border-border bg-surface hover:bg-surface-hover"
            }`}
          >
            <p className="text-xs text-muted-foreground capitalize">{s}</p>
            <p className="text-xl font-bold text-foreground">{counts[s] ?? 0}</p>
          </div>
        ))}
      </div>

      {pendingCredit > 0 && (
        <div className="rounded-lg border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950/30 px-4 py-2.5 text-sm">
          <span className="text-green-700 dark:text-green-300 font-medium">
            ${pendingCredit.toFixed(2)} in pending credits
          </span>
        </div>
      )}

      {/* Table */}
      <div className="border border-border rounded-xl overflow-hidden">
        <div className="px-4 py-2.5 bg-surface border-b border-border flex items-center justify-between">
          <span className="text-sm font-semibold text-muted-foreground">
            {filter === "all" ? "All Returns" : `${filter} (${returns.length})`}
          </span>
          {filter !== "all" && (
            <button onClick={() => setFilter("all")} className="text-xs text-primary hover:underline">
              Clear filter
            </button>
          )}
        </div>

        {loading ? (
          <div className="px-4 py-8 text-center text-sm text-muted-foreground animate-pulse">Loading…</div>
        ) : returns.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-muted-foreground">
            No returns found. Click &ldquo;Log Return&rdquo; to track a core charge or warranty claim.
          </div>
        ) : (
          <div className="divide-y divide-border">
            {returns.map((r) => {
              const next = STATUS_NEXT[r.status];
              return (
                <div key={r.id} className="px-4 py-3 flex items-center gap-3 hover:bg-surface-hover text-sm">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-foreground">{r.partNumber}</span>
                      <span className="text-xs text-muted-foreground truncate">{r.description}</span>
                      <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                        r.returnType === "core"
                          ? "bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300"
                          : "bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300"
                      }`}>
                        {r.returnType}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {r.supplier}
                      {r.repairOrder?.roNumber && ` · ${r.repairOrder.roNumber}`}
                      {r.trackingNumber && ` · #${r.trackingNumber}`}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0 space-y-1">
                    <p className="text-sm font-semibold text-foreground">
                      ${r.actualCredit != null ? r.actualCredit.toFixed(2) : r.expectedCredit.toFixed(2)}
                      {r.actualCredit == null && <span className="text-xs text-muted-foreground font-normal"> est.</span>}
                    </p>
                    <ReturnStatusBadge status={r.status} />
                  </div>
                  {next && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => advanceStatus(r.id, next)}
                      disabled={advancing === r.id}
                      className="flex-shrink-0 text-xs"
                    >
                      → {next}
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {showForm && (
        <ReturnForm
          onClose={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); load(); }}
        />
      )}
    </div>
  );
}
