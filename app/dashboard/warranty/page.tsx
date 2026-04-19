// [FEATURE: warranty_claims]
// Warranty Claims pipeline — draft → submitted → approved → paid / rejected.
// Remove this file to disable.

"use client";

import { useState, useEffect, useCallback } from "react";
import { Shield, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { WarrantyStatusBadge } from "@/components/warranty/warranty-status-badge";
import { WarrantyClaimForm } from "@/components/warranty/warranty-claim-form";

interface WarrantyClaim {
  id: string;
  claimNumber: string | null;
  failureDescription: string;
  oemLaborCode: string | null;
  expectedReimbursement: number;
  actualReimbursement: number | null;
  status: string;
  rejectionReason: string | null;
  createdAt: string;
  submittedAt: string | null;
  repairOrder: { roNumber: string | null; vin: string; customerName: string | null };
  createdBy: { name: string | null };
}

const STATUSES = ["draft", "submitted", "approved", "paid", "rejected"];

const STATUS_NEXT: Record<string, string | null> = {
  draft: "submitted",
  submitted: "approved",
  approved: "paid",
  paid: null,
  rejected: null,
};

const STATUS_NEXT_LABEL: Record<string, string> = {
  draft: "Submit Claim",
  submitted: "Mark Approved",
  approved: "Mark Paid",
};

export default function WarrantyPage() {
  const [claims, setClaims] = useState<WarrantyClaim[]>([]);
  const [filter, setFilter] = useState<string>("all");
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [advancing, setAdvancing] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const params = filter !== "all" ? `?status=${filter}` : "";
    const res = await fetch(`/api/warranty${params}`);
    if (res.ok) {
      const { claims: data } = await res.json();
      setClaims(data ?? []);
    }
    setLoading(false);
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  async function advanceStatus(id: string, nextStatus: string) {
    setAdvancing(id);
    await fetch(`/api/warranty/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: nextStatus }),
    });
    setAdvancing(null);
    load();
  }

  const counts = STATUSES.reduce((acc, s) => {
    acc[s] = claims.filter((c) => c.status === s).length;
    return acc;
  }, {} as Record<string, number>);

  const pendingReimbursement = claims
    .filter((c) => ["submitted", "approved"].includes(c.status))
    .reduce((sum, c) => sum + c.expectedReimbursement, 0);

  const paidTotal = claims
    .filter((c) => c.status === "paid")
    .reduce((sum, c) => sum + (c.actualReimbursement ?? c.expectedReimbursement), 0);

  return (
    <div className="p-6 max-w-5xl space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Shield className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-2xl font-bold text-foreground">Warranty Claims</h1>
            <p className="text-sm text-muted-foreground">Track OEM warranty reimbursements</p>
          </div>
        </div>
        <Button size="sm" onClick={() => setShowForm(true)}>
          <Plus className="h-4 w-4 mr-1.5" /> New Claim
        </Button>
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
            <p className="text-xs text-muted-foreground capitalize">{s}</p>
            <p className="text-xl font-bold text-foreground">{counts[s] ?? 0}</p>
          </div>
        ))}
      </div>

      {/* KPI strip */}
      {(pendingReimbursement > 0 || paidTotal > 0) && (
        <div className="flex gap-4 flex-wrap">
          {pendingReimbursement > 0 && (
            <div className="rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/30 px-4 py-2.5 text-sm">
              <span className="text-blue-700 dark:text-blue-300 font-medium">
                ${pendingReimbursement.toFixed(2)} pending reimbursement
              </span>
            </div>
          )}
          {paidTotal > 0 && (
            <div className="rounded-lg border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950/30 px-4 py-2.5 text-sm">
              <span className="text-green-700 dark:text-green-300 font-medium">
                ${paidTotal.toFixed(2)} paid this view
              </span>
            </div>
          )}
        </div>
      )}

      {/* List */}
      <div className="border border-border rounded-xl overflow-hidden">
        <div className="px-4 py-2.5 bg-surface border-b border-border flex items-center justify-between">
          <span className="text-sm font-semibold text-muted-foreground">
            {filter === "all" ? `All Claims (${claims.length})` : `${filter} (${claims.length})`}
          </span>
          {filter !== "all" && (
            <button onClick={() => setFilter("all")} className="text-xs text-primary hover:underline">
              Clear filter
            </button>
          )}
        </div>

        {loading ? (
          <div className="px-4 py-8 text-center text-sm text-muted-foreground animate-pulse">Loading…</div>
        ) : claims.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-muted-foreground">
            No warranty claims found. Click &ldquo;New Claim&rdquo; to log one.
          </div>
        ) : (
          <div className="divide-y divide-border">
            {claims.map((c) => {
              const next = STATUS_NEXT[c.status];
              const nextLabel = next ? STATUS_NEXT_LABEL[c.status] : null;
              return (
                <div key={c.id} className="px-4 py-3 flex items-start gap-3 hover:bg-surface-hover text-sm">
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-foreground">
                        {c.repairOrder.roNumber ?? c.id.slice(-8).toUpperCase()}
                      </span>
                      {c.claimNumber && (
                        <span className="text-xs text-muted-foreground">#{c.claimNumber}</span>
                      )}
                      <WarrantyStatusBadge status={c.status} />
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-1">{c.failureDescription}</p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                      <span>{c.repairOrder.vin}</span>
                      {c.repairOrder.customerName && <><span>·</span><span>{c.repairOrder.customerName}</span></>}
                      {c.oemLaborCode && <><span>·</span><span>Code: {c.oemLaborCode}</span></>}
                      {c.rejectionReason && (
                        <><span>·</span><span className="text-red-500">Rejected: {c.rejectionReason}</span></>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                    <div className="text-right">
                      <p className="text-sm font-semibold text-foreground">
                        ${(c.actualReimbursement ?? c.expectedReimbursement).toFixed(2)}
                        {c.actualReimbursement == null && (
                          <span className="text-xs text-muted-foreground font-normal"> est.</span>
                        )}
                      </p>
                    </div>
                    {next && nextLabel && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => advanceStatus(c.id, next)}
                        disabled={advancing === c.id}
                        className="text-xs"
                      >
                        {advancing === c.id ? "…" : nextLabel}
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
        <WarrantyClaimForm
          onClose={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); load(); }}
        />
      )}
    </div>
  );
}
