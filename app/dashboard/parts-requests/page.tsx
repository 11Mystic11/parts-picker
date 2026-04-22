// [FEATURE: parts_queue]
// Parts Request Queue — counter staff view of all pending tech part requests across ROs.
// Remove this file to disable.

"use client";

import { useState, useEffect, useCallback } from "react";
import { Package, RefreshCw, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useSession } from "next-auth/react";
import Link from "next/link";

interface PartRequest {
  id: string;
  repairOrderId: string;
  partDescription: string;
  partNumber: string | null;
  quantity: number;
  notes: string | null;
  status: string;
  createdAt: string;
  repairOrder: { roNumber: string | null; vin: string; customerName: string | null };
  requestedBy: { name: string | null; employeeId: string | null };
}

const STATUS_LABEL: Record<string, string> = {
  pending: "Pending",
  ordered: "Pulled / Ordered",
  received: "Ready for Tech",
  cancelled: "Cancelled",
};

const STATUS_COLOR: Record<string, string> = {
  pending:  "bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300",
  ordered:  "bg-yellow-100 dark:bg-yellow-900/40 text-yellow-700 dark:text-yellow-300",
  received: "bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300",
};

export default function PartsRequestsPage() {
  const { data: session } = useSession();
  const role = (session?.user as { role?: string } | undefined)?.role ?? "";
  const canSubmit = ["advisor", "manager", "admin"].includes(role);

  const [requests, setRequests] = useState<PartRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [advancing, setAdvancing] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>("pending");
  const [pendingStatus, setPendingStatus] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setLoading(true);
    const params = filter !== "all" ? `?status=${filter}` : "";
    const res = await fetch(`/api/parts-requests${params}`);
    if (res.ok) {
      const { requests: data } = await res.json();
      setRequests(data ?? []);
    }
    setLoading(false);
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  // Auto-refresh every 30s
  useEffect(() => {
    const id = setInterval(load, 30_000);
    return () => clearInterval(id);
  }, [load]);

  async function advance(req: PartRequest) {
    const next = req.status === "pending" ? "ordered" : req.status === "ordered" ? "received" : null;
    if (!next) return;
    setAdvancing(req.id);
    await fetch(`/api/ro/${req.repairOrderId}/part-requests?requestId=${req.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: next }),
    });
    setAdvancing(null);
    load();
  }

  const FILTERS = ["pending", "ordered", "received", "all"];
  const counts: Record<string, number> = {};
  for (const r of requests) counts[r.status] = (counts[r.status] ?? 0) + 1;

  function elapsed(iso: string) {
    const ms = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(ms / 60_000);
    if (mins < 60) return `${mins}m ago`;
    return `${Math.floor(mins / 60)}h ago`;
  }

  return (
    <div className="p-6 max-w-4xl space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Package className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-2xl font-bold text-foreground">Parts Queue</h1>
            <p className="text-sm text-muted-foreground">Part requests from technicians</p>
          </div>
        </div>
        <Button size="sm" variant="outline" onClick={load} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-1.5 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Filter chips */}
      <div className="flex gap-2 flex-wrap">
        {FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors capitalize ${
              filter === f
                ? "border-primary bg-primary/10 text-primary"
                : "border-border text-muted-foreground hover:bg-surface-hover"
            }`}
          >
            {f === "all" ? "All" : STATUS_LABEL[f]}
            {f !== "all" && counts[f] ? ` (${counts[f]})` : ""}
          </button>
        ))}
      </div>

      {/* Request list */}
      <div className="border border-border rounded-xl overflow-hidden">
        {loading ? (
          <div className="px-4 py-8 text-center text-sm text-muted-foreground animate-pulse">Loading…</div>
        ) : requests.length === 0 ? (
          <div className="px-4 py-12 text-center space-y-2">
            <CheckCircle className="h-8 w-8 text-green-500 mx-auto" />
            <p className="text-sm text-muted-foreground">No {filter !== "all" ? filter : ""} requests</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {requests.map((req) => {
              const selected = pendingStatus[req.id];

              return (
                <div key={req.id} className="px-4 py-3 flex items-start gap-3 hover:bg-surface-hover text-sm">
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-foreground">{req.partDescription}</span>
                      {req.partNumber && (
                        <span className="text-xs text-muted-foreground font-mono">{req.partNumber}</span>
                      )}
                      <span className="text-xs text-muted-foreground">× {req.quantity}</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                      <Link
                        href={`/dashboard/ro/${req.repairOrderId}`}
                        className="hover:underline font-medium text-foreground"
                      >
                        {req.repairOrder.roNumber ?? req.repairOrderId.slice(-8).toUpperCase()}
                      </Link>
                      <span>·</span>
                      <span>{req.repairOrder.vin}</span>
                      {req.repairOrder.customerName && <><span>·</span><span>{req.repairOrder.customerName}</span></>}
                      <span>·</span>
                      <span>{req.requestedBy.name ?? req.requestedBy.employeeId ?? "Tech"}</span>
                      <span>·</span>
                      <span>{elapsed(req.createdAt)}</span>
                    </div>
                    {req.notes && <p className="text-xs text-muted-foreground italic">{req.notes}</p>}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${STATUS_COLOR[req.status] ?? ""}`}>
                      {STATUS_LABEL[req.status] ?? req.status}
                    </span>
                    {canSubmit && req.status === "pending" && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => advance(req)}
                        disabled={advancing === req.id}
                        className="text-xs"
                      >
                        Submit Order
                      </Button>
                    )}
                    {canSubmit && req.status === "ordered" && (
                      <div className="flex items-center gap-1.5">
                        <Select
                          value={selected ?? ""}
                          onValueChange={(v) => setPendingStatus((prev) => ({ ...prev, [req.id]: v }))}
                        >
                          <SelectTrigger className="h-7 w-28 text-xs">
                            <SelectValue placeholder="Set status…" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="received">Mark Ready</SelectItem>
                            <SelectItem value="cancelled">Cancel</SelectItem>
                          </SelectContent>
                        </Select>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-xs h-7 px-2"
                          disabled={!selected || advancing === req.id}
                          onClick={async () => {
                            if (!selected) return;
                            setAdvancing(req.id);
                            await fetch(`/api/ro/${req.repairOrderId}/part-requests?requestId=${req.id}`, {
                              method: "PATCH",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ status: selected }),
                            });
                            setPendingStatus((prev) => { const n = { ...prev }; delete n[req.id]; return n; });
                            setAdvancing(null);
                            load();
                          }}
                        >
                          Save
                        </Button>
                      </div>
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
