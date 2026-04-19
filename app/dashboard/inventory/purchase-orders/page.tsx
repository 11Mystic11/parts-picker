// [FEATURE: purchase_orders]
// Purchase Orders list — draft | submitted | partial_received | received | invoiced
// Remove this file to disable.

"use client";

import { useState, useEffect, useCallback } from "react";
import { ShoppingCart, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

interface PurchaseOrder {
  id: string;
  supplier: string;
  status: string;
  notes: string | null;
  createdAt: string;
  submittedAt: string | null;
  receivedAt: string | null;
  createdBy: { name: string | null };
  lines: Array<{
    id: string;
    partNumber: string;
    description: string;
    qtyOrdered: number;
    qtyReceived: number;
    unitCost: number;
  }>;
}

const STATUSES = ["draft", "submitted", "partial_received", "received", "invoiced"];

const STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  submitted: "Submitted",
  partial_received: "Partial",
  received: "Received",
  invoiced: "Invoiced",
};

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-surface text-muted-foreground border border-border",
  submitted: "bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300",
  partial_received: "bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300",
  received: "bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300",
  invoiced: "bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300",
};

const STATUS_NEXT: Record<string, string | null> = {
  draft: "submitted",
  submitted: "partial_received",
  partial_received: "received",
  received: "invoiced",
  invoiced: null,
};

const STATUS_NEXT_LABEL: Record<string, string> = {
  draft: "Submit",
  submitted: "Partial Receive",
  partial_received: "Mark Received",
  received: "Mark Invoiced",
};

export default function PurchaseOrdersPage() {
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [filter, setFilter] = useState<string>("all");
  const [loading, setLoading] = useState(true);
  const [advancing, setAdvancing] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const params = filter !== "all" ? `?status=${filter}` : "";
    const res = await fetch(`/api/purchase-orders${params}`);
    if (res.ok) {
      const { orders: data } = await res.json();
      setOrders(data ?? []);
    }
    setLoading(false);
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  async function advanceStatus(id: string, nextStatus: string) {
    setAdvancing(id);
    await fetch(`/api/purchase-orders/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: nextStatus }),
    });
    setAdvancing(null);
    load();
  }

  const counts = STATUSES.reduce((acc, s) => {
    acc[s] = orders.filter((o) => o.status === s).length;
    return acc;
  }, {} as Record<string, number>);

  function totalCost(o: PurchaseOrder) {
    return o.lines.reduce((sum, l) => sum + l.qtyOrdered * l.unitCost, 0);
  }

  return (
    <div className="p-6 max-w-5xl space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <ShoppingCart className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-2xl font-bold text-foreground">Purchase Orders</h1>
            <p className="text-sm text-muted-foreground">Inventory replenishment orders to suppliers</p>
          </div>
        </div>
        <Link href="/dashboard/inventory/purchase-orders/new">
          <Button size="sm">
            <Plus className="h-4 w-4 mr-1.5" /> New PO
          </Button>
        </Link>
      </div>

      {/* Pipeline summary */}
      <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
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

      {/* List */}
      <div className="border border-border rounded-xl overflow-hidden">
        <div className="px-4 py-2.5 bg-surface border-b border-border flex items-center justify-between">
          <span className="text-sm font-semibold text-muted-foreground">
            {filter === "all" ? `All Orders (${orders.length})` : `${STATUS_LABELS[filter] ?? filter} (${orders.length})`}
          </span>
          {filter !== "all" && (
            <button onClick={() => setFilter("all")} className="text-xs text-primary hover:underline">
              Clear filter
            </button>
          )}
        </div>

        {loading ? (
          <div className="px-4 py-8 text-center text-sm text-muted-foreground animate-pulse">Loading…</div>
        ) : orders.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-muted-foreground">
            No purchase orders found.
          </div>
        ) : (
          <div className="divide-y divide-border">
            {orders.map((o) => {
              const next = STATUS_NEXT[o.status];
              const nextLabel = next ? STATUS_NEXT_LABEL[o.status] : null;
              const cost = totalCost(o);
              return (
                <div key={o.id} className="px-4 py-3 flex items-start gap-3 hover:bg-surface-hover text-sm">
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-foreground">{o.supplier}</span>
                      <span className={`text-xs px-2 py-0.5 rounded font-medium ${STATUS_COLORS[o.status] ?? ""}`}>
                        {STATUS_LABELS[o.status] ?? o.status}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {o.lines.length} line{o.lines.length !== 1 ? "s" : ""}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                      <span>PO #{o.id.slice(-8).toUpperCase()}</span>
                      <span>·</span>
                      <span>{new Date(o.createdAt).toLocaleDateString()}</span>
                      {o.createdBy.name && <><span>·</span><span>{o.createdBy.name}</span></>}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                    <p className="text-sm font-semibold text-foreground">${cost.toFixed(2)}</p>
                    {next && nextLabel && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => advanceStatus(o.id, next)}
                        disabled={advancing === o.id}
                        className="text-xs"
                      >
                        {advancing === o.id ? "…" : nextLabel}
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
