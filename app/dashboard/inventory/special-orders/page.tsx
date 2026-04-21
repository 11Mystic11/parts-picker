// [FEATURE: special_orders]
// Special Order Parts pipeline — list, filter by status, advance status, create new SOP.
// Remove this file to disable.

"use client";

import { useState, useEffect, useCallback } from "react";
import { Package, Plus, ChevronDown } from "lucide-react";
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
  repairOrder: { id: string; roNumber: string | null; customerName: string | null } | null;
}

const ALL_STATUSES = ["ordered", "received", "customer_notified", "picked_up", "cancelled"];
const PIPELINE_STATUSES = ["ordered", "received", "customer_notified", "picked_up"];

const STATUS_LABELS: Record<string, string> = {
  ordered: "Ordered",
  received: "Received",
  customer_notified: "Notified",
  picked_up: "Picked Up",
  cancelled: "Cancelled",
};

const OPEN_STATUSES = new Set(["ordered", "received", "customer_notified"]);
const CLOSED_STATUSES = new Set(["picked_up", "cancelled"]);

function daysSince(iso: string) {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
}

export default function SpecialOrdersPage() {
  const [sops, setSops] = useState<SOP[]>([]);
  const [filter, setFilter] = useState<string>("all");
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [updating, setUpdating] = useState<string | null>(null);
  const [openStatusMenu, setOpenStatusMenu] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    // Fetch all (not-cancelled by default) or filtered
    const params =
      filter !== "all" && filter !== "open" && filter !== "closed"
        ? `?status=${filter}`
        : filter === "closed"
        ? "?status=picked_up"
        : "";
    const res = await fetch(`/api/special-orders${params}`);
    if (res.ok) {
      const { sops: data } = await res.json();
      setSops(data ?? []);
    }
    setLoading(false);
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    function handle() { setOpenStatusMenu(null); }
    document.addEventListener("click", handle);
    return () => document.removeEventListener("click", handle);
  }, []);

  async function setStatus(id: string, newStatus: string) {
    setUpdating(id);
    setOpenStatusMenu(null);
    await fetch(`/api/special-orders/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
    setUpdating(null);
    load();
  }

  const allSops = sops;
  const visibleSops = filter === "open"
    ? allSops.filter((s) => OPEN_STATUSES.has(s.status))
    : filter === "closed"
    ? allSops.filter((s) => CLOSED_STATUSES.has(s.status))
    : allSops;

  const counts = PIPELINE_STATUSES.reduce((acc, s) => {
    acc[s] = allSops.filter((r) => r.status === s).length;
    return acc;
  }, {} as Record<string, number>);

  const openCount = allSops.filter((s) => OPEN_STATUSES.has(s.status)).length;
  const closedCount = allSops.filter((s) => CLOSED_STATUSES.has(s.status)).length;

  const totalDeposit = allSops
    .filter((s) => OPEN_STATUSES.has(s.status))
    .reduce((sum, s) => sum + s.depositCollected, 0);

  return (
    <div className="p-6 max-w-6xl space-y-6">
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

      <div className="flex gap-4">
        {/* Main content */}
        <div className="flex-1 space-y-4">
          {/* Pipeline summary */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {PIPELINE_STATUSES.map((s) => (
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
                {filter === "all"
                  ? `All Orders (${visibleSops.length})`
                  : filter === "open"
                  ? `Open (${visibleSops.length})`
                  : filter === "closed"
                  ? `Closed (${visibleSops.length})`
                  : `${STATUS_LABELS[filter] ?? filter} (${visibleSops.length})`}
              </span>
              {filter !== "all" && (
                <button onClick={() => setFilter("all")} className="text-xs text-primary hover:underline">
                  Clear filter
                </button>
              )}
            </div>

            {loading ? (
              <div className="px-4 py-8 text-center text-sm text-muted-foreground animate-pulse">Loading…</div>
            ) : visibleSops.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                No special orders found. Click &ldquo;New SOP&rdquo; to create one.
              </div>
            ) : (
              <div className="divide-y divide-border">
                {visibleSops.map((sop) => {
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
                          {sop.repairOrder?.roNumber && (
                            <><span>·</span>
                            <span className="text-blue-600 dark:text-blue-400">RO: {sop.repairOrder.roNumber}</span></>
                          )}
                          {etaDate && <><span>·</span><span className="text-foreground">ETA: {etaDate}</span></>}
                          {sop.depositCollected > 0 && (
                            <><span>·</span><span className="text-green-600 dark:text-green-400">${sop.depositCollected.toFixed(2)} deposit</span></>
                          )}
                        </div>
                        {sop.vendorPO && (
                          <p className="text-xs text-muted-foreground">Vendor PO: {sop.vendorPO}</p>
                        )}
                      </div>
                      <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                        <span className="text-xs text-muted-foreground">qty {sop.quantity}</span>
                        {/* Status dropdown */}
                        <div className="relative" onClick={(e) => e.stopPropagation()}>
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-xs gap-1"
                            disabled={updating === sop.id}
                            onClick={() => setOpenStatusMenu(openStatusMenu === sop.id ? null : sop.id)}
                          >
                            {updating === sop.id ? "…" : "Set Status"}
                            <ChevronDown className="h-3 w-3" />
                          </Button>
                          {openStatusMenu === sop.id && (
                            <div className="absolute right-0 mt-1 w-44 bg-background border border-border rounded-lg shadow-lg z-20 overflow-hidden">
                              {ALL_STATUSES.map((s) => (
                                <button
                                  key={s}
                                  className={`w-full text-left px-3 py-2 text-xs hover:bg-surface-hover ${sop.status === s ? "font-semibold text-primary" : "text-foreground"}`}
                                  onClick={() => setStatus(sop.id, s)}
                                >
                                  {STATUS_LABELS[s]}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right panel — Open / Closed summary */}
        <div className="w-44 flex-shrink-0 space-y-3">
          <div
            onClick={() => setFilter(filter === "open" ? "all" : "open")}
            className={`rounded-xl border p-4 cursor-pointer transition-colors ${
              filter === "open" ? "border-green-500 bg-green-50 dark:bg-green-900/20" : "border-border bg-surface hover:bg-surface-hover"
            }`}
          >
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Open</p>
            <p className="text-3xl font-bold text-foreground mt-1">{openCount}</p>
            <p className="text-xs text-muted-foreground mt-1">Ordered · Received · Notified</p>
          </div>
          <div
            onClick={() => setFilter(filter === "closed" ? "all" : "closed")}
            className={`rounded-xl border p-4 cursor-pointer transition-colors ${
              filter === "closed" ? "border-purple-500 bg-purple-50 dark:bg-purple-900/20" : "border-border bg-surface hover:bg-surface-hover"
            }`}
          >
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Closed</p>
            <p className="text-3xl font-bold text-foreground mt-1">{closedCount}</p>
            <p className="text-xs text-muted-foreground mt-1">Picked Up · Cancelled</p>
          </div>
        </div>
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
