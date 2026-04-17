// [FEATURE: parts_ordering]
// Tab panel on RO detail showing placed parts orders and a button to open the search dialog.
// Remove this file to disable.

"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PartsSearchDialog } from "./parts-search-dialog";
import { ShoppingCart, RefreshCw, Loader2, PackagePlus } from "lucide-react";

interface OrderItem {
  partNumber: string;
  description: string;
  quantity: number;
  unitCost: number;
}

interface PartsOrder {
  id: string;
  supplier: string;
  status: string;
  externalOrderId: string | null;
  errorMessage: string | null;
  submittedAt: string | null;
  createdAt: string;
  items: string; // JSON
  placedBy: { name: string | null } | null;
}

interface PartsOrderPanelProps {
  roId: string;
}

const STATUS_COLORS: Record<string, string> = {
  pending: "secondary",
  submitted: "default",
  confirmed: "default",
  error: "destructive",
};

const STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  submitted: "Submitted",
  confirmed: "Confirmed",
  error: "Error",
};

export function PartsOrderPanel({ roId }: PartsOrderPanelProps) {
  const [orders, setOrders] = useState<PartsOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const loadOrders = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/ro/${roId}/parts-orders`);
      if (res.ok) {
        const data = await res.json();
        setOrders(data.orders ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, [roId]);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  async function handleRefreshStatus(orderId: string) {
    setRefreshing(orderId);
    try {
      const res = await fetch(`/api/ro/${roId}/parts-orders/${orderId}`, { method: "PATCH" });
      if (res.ok) {
        const data = await res.json();
        setOrders((prev) => prev.map((o) => (o.id === orderId ? { ...o, ...data.order } : o)));
      }
    } finally {
      setRefreshing(null);
    }
  }

  function parseItems(raw: string): OrderItem[] {
    try { return JSON.parse(raw); } catch { return []; }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Parts Orders</h3>
        <Button size="sm" onClick={() => setDialogOpen(true)}>
          <PackagePlus className="h-4 w-4 mr-2" />
          Order Parts
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : orders.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-10 text-muted-foreground text-sm">
          <ShoppingCart className="h-8 w-8 opacity-30" />
          <p>No parts orders yet.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {orders.map((order) => {
            const items = parseItems(order.items);
            const total = items.reduce((s, i) => s + i.unitCost * i.quantity, 0);
            return (
              <div key={order.id} className="border rounded-lg p-3 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="font-medium capitalize">{order.supplier}</span>
                    <Badge variant={STATUS_COLORS[order.status] as any}>
                      {STATUS_LABELS[order.status] ?? order.status}
                    </Badge>
                    {order.externalOrderId && (
                      <span className="text-xs text-muted-foreground">#{order.externalOrderId}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">
                      {order.placedBy?.name ?? "Unknown"} · {new Date(order.createdAt).toLocaleDateString()}
                    </span>
                    {order.externalOrderId && (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7"
                        onClick={() => handleRefreshStatus(order.id)}
                        disabled={refreshing === order.id}
                        title="Refresh status from supplier"
                      >
                        {refreshing === order.id
                          ? <Loader2 className="h-3 w-3 animate-spin" />
                          : <RefreshCw className="h-3 w-3" />
                        }
                      </Button>
                    )}
                  </div>
                </div>

                {order.errorMessage && (
                  <p className="text-xs text-destructive">{order.errorMessage}</p>
                )}

                <div className="text-xs text-muted-foreground divide-y border rounded">
                  {items.map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between px-2 py-1">
                      <span>{item.description} <span className="opacity-60">({item.partNumber})</span></span>
                      <span>x{item.quantity} @ ${item.unitCost.toFixed(2)}</span>
                    </div>
                  ))}
                </div>

                <div className="text-right text-xs font-medium">
                  Total: ${total.toFixed(2)}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <PartsSearchDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        roId={roId}
        onOrderSubmitted={loadOrders}
      />
    </div>
  );
}
