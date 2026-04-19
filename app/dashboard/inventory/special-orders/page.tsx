// [FEATURE: special_orders]
// Special Order Parts pipeline — list, filter by status, advance status, create new SOP.
// Remove this file to disable.

"use client";

import { useState, useEffect, useCallback } from "react";
import { Package, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SOPStatusBadge } from "@/components/special-orders/sop-status-badge";
import { SOPForm } from "@/components/special-orders/sop-form";

interface SOP {
  id: string;
  partNumber: string;
  description: string;
  supplier: string;
  quantity: number;
  customerName: string;
  customerPhone: string | null;
  depositCollected: number;
  vendorPO: string | null;
  supplierEta: string | null;
  status: string;
  notes: string | null;
  createdAt: string;
  arrivedAt: string | null;
  notifiedAt: string | null;
  pickedUpAt: string | null;
  createdBy: { name: string | null };
  repairOrder: { roNumber: string | null } | null;
}

const STATUSES = ["ordered", "received", "customer_notified", "picked_up"];

const STATUS_LABELS: Record<string, string> = {
  ordered: "Ordered",
  received: "Received",
  customer_notified: "Notified",
  picked_up: "Picked Up",
};

const STATUS_NEXT: Record<string, string | null> = {
  ordered: "received",
  received: "customer_notified",
  customer_notified: "picked_up",
  picked_up: null,
  cancelled: null,
};

const STATUS_NEXT_LABEL: Record<string, string> = {
  ordered: "Mark Received",
  received: "Notify Customer",
  customer_notified: "Mark Picked Up",
};

function daysSince(iso: string) {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
}

export default function SpecialOrdersPage() {
  const [sops, setSops] = useState<SOP[]>([]);
  const [filter, setFilter] = useState<string>("all");
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [advancing, setAdvancing] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const params = filter !== "all" ? `?status=${filter}` : "";
    const res = await fetch(`/api/special-orders${params}`);
    if (res.ok) {
      const { sops: data } = await res.json();
      setSops(data ?? []);
    }
    setLoading(false);
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  async function advanceStatus(id: string, nextStatus: string) {
    setAdvancing(id);
    await fetch(`/api/special-orders/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: nextStatus }),
    });
    setAdvancing(null);
    load();
  }

  const counts = STATUSES.reduce((acc, s) => {
    acc[s] = sops.filter((r) => r.status === s).length;
    return acc;
  }, {} as Record<string, number>);

  const totalDeposit = sops
    .filter((s) => !["picked_up", "cancelled"].includes(s.status))
    .reduce((sum, s) => sum + s.depositCollected, 0);

  return (
    <div className="p-6 max-w-5xl space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Package className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-2xl font-bold text-foreground">Special Orders</h1>
            <p className="text-sm text-muted-foreground">Customer-specific ordered parts pipeline</p>
          </div>
        </div>
        <Button size="sm" onClick={() => setShowForm(true)}>
          <Plus className="h-4 w-4 mr-1.5" /> New SOP
        </Button>
      </div>

      {/* Pipeline summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {STATUSES.map((s) => (
          <div
            key={s}
            onClick={() => setFilter(filter === s ? "all" : s)}
            className={`rounded-lg border p-3 cursor-pointer transition-colors ${
              filter === s ? "border-primary bg-primary/5" : "border-border bg-surface hover:bg-surface-hover"
            }`}
          >
            <p className="text-xs text-muted-foreground">{STATUS_LABELS[s]}</p>
            <p className="text-xl font-bold text-foreground">{counts[s] ?? 0}</p>
          </div>
        ))}
      </div>

      {totalDeposit > 0 && (
        <div className="rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/30 px-4 py-2.5 text-sm">
          <span className="text-blue-700 dark:text-blue-300 font-medium">
            ${totalDeposit.toFixed(2)} in deposits held on open orders
          </span>
        </div>
      )}

      {/* List */}
      <div className="border border-border rounded-xl overflow-hidden">
        <div className="px-4 py-2.5 bg-surface border-b border-border flex items-center justify-between">
          <span className="text-sm font-semibold text-muted-foreground">
            {filter === "all" ? `All Open Orders (${sops.length})` : `${STATUS_LABELS[filter] ?? filter} (${sops.length})`}
          </span>
          {filter !== "all" && (
            <button onClick={() => setFilter("all")} className="text-xs text-primary hover:underline">
              Clear filter
            </button>
          )}
        </div>

        {loading ? (
          <div className="px-4 py-8 text-center text-sm text-muted-foreground animate-pulse">Loading…</div>
        ) : sops.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-muted-foreground">
            No special orders found. Click &ldquo;New SOP&rdquo; to create one.
          </div>
        ) : (
          <div className="divide-y divide-border">
            {sops.map((sop) => {
              const next = STATUS_NEXT[sop.status];
              const nextLabel = next ? STATUS_NEXT_LABEL[sop.status] : null;
              const age = daysSince(sop.createdAt);
              const etaDate = sop.supplierEta
                ? new Date(sop.supplierEta).toLocaleDateString()
                : null;

              return (
                <div key={sop.id} className="px-4 py-3 flex items-start gap-3 hover:bg-surface-hover text-sm">
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-foreground">{sop.partNumber}</span>
                      <span className="text-xs text-muted-foreground truncate max-w-[200px]">{sop.description}</span>
                      <SOPStatusBadge status={sop.status} />
                      {age > 7 && (
                        <span className={`text-xs font-medium ${age > 14 ? "text-red-500" : "text-amber-500"}`}>
                          {age}d old
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                      <span className="font-medium text-foreground">{sop.customerName}</span>
                      {sop.customerPhone && <><span>·</span><span>{sop.customerPhone}</span></>}
                      <span>·</span>
                      <span>{sop.supplier}</span>
                      {sop.repairOrder?.roNumber && <><span>·</span><span>{sop.repairOrder.roNumber}</span></>}
                      {etaDate && <><span>·</span><span className="text-foreground">ETA: {etaDate}</span></>}
                      {sop.depositCollected > 0 && (
                        <><span>·</span><span className="text-green-600 dark:text-green-400">${sop.depositCollected.toFixed(2)} deposit</span></>
                      )}
                    </div>
                    {sop.vendorPO && (
                      <p className="text-xs text-muted-foreground">PO: {sop.vendorPO}</p>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                    <span className="text-xs text-muted-foreground">qty {sop.quantity}</span>
                    {next && nextLabel && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => advanceStatus(sop.id, next)}
                        disabled={advancing === sop.id}
                        className="text-xs"
                      >
                        {advancing === sop.id ? "…" : nextLabel}
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {showForm && (
        <SOPForm
          onClose={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); load(); }}
        />
      )}
    </div>
  );
}
