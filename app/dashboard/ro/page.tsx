"use client";

/**
 * app/dashboard/ro/page.tsx (client component)
 *
 * Repair Orders list with DMS sync status column.
 * Admin/manager roles get a "Re-sync" button on failed rows.
 */

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ClipboardList, Plus, RefreshCw, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

const STATUS_STYLES: Record<string, string> = {
  draft:     "bg-surface text-muted-foreground",
  presented: "bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300",
  approved:  "bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300",
  closed:    "bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300",
  void:      "bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300",
};

const DMS_STYLES: Record<string, string> = {
  pending: "bg-yellow-100 dark:bg-yellow-900/40 text-yellow-700 dark:text-yellow-300",
  synced:  "bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300",
  failed:  "bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300",
};

function formatCurrency(n: number) {
  return `$${n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",")}`;
}

function timeAgo(dateStr: string): string {
  const date = new Date(dateStr);
  const diff = Date.now() - date.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

interface RO {
  id: string;
  roNumber: string | null;
  vin: string;
  vehicleSnapshot: string;
  status: string;
  totalAmount: number;
  createdAt: string;
  dmsSyncStatus: string | null;
  dmsSyncedAt: string | null;
  dmsSyncAttempts: number;
  advisor: { name: string | null };
}

const ADMIN_ROLES = ["admin", "manager", "developer"];

export default function RepairOrdersPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const role = (session?.user as { role?: string })?.role ?? "";
  const canResync = ADMIN_ROLES.includes(role);

  const [ros, setRos] = useState<RO[]>([]);
  const [loading, setLoading] = useState(true);
  const [resyncing, setResyncing] = useState<string | null>(null);

  const isTech = role === "technician";

  useEffect(() => {
    const url = isTech ? "/api/ro?limit=100&techId=me" : "/api/ro?limit=100";
    fetch(url)
      .then((r) => r.json())
      .then((d: { ros: RO[] }) => setRos(d.ros ?? []))
      .finally(() => setLoading(false));
  }, [isTech]);

  async function handleResync(roId: string) {
    setResyncing(roId);
    try {
      const res = await fetch("/api/dms/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roId }),
      });
      const data: { ro?: RO } = await res.json();
      if (data.ro) {
        setRos((prev) => prev.map((r) => (r.id === roId ? { ...r, ...data.ro } : r)));
      }
    } catch (e) {
      console.error("Resync error:", e);
    } finally {
      setResyncing(null);
    }
  }

  const enriched = ros.map((ro) => {
    let vehicle: { year?: number; make?: string; model?: string } = {};
    try { vehicle = JSON.parse(ro.vehicleSnapshot); } catch { /* ignore */ }
    return { ...ro, vehicle };
  });

  if (loading) {
    return (
      <div className="p-6 flex items-center gap-2 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading repair orders…
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            {isTech ? "My Jobs" : "Repair Orders"}
          </h1>
          <p className="text-muted-foreground mt-0.5 text-sm">
            {isTech ? "Jobs assigned to you." : "All ROs for your service location."}
          </p>
        </div>
        {!isTech && (
          <Button onClick={() => router.push("/dashboard/ro/new")} id="new-ro-btn">
            <Plus className="h-4 w-4 mr-2" />
            New RO
          </Button>
        )}
      </div>

      {enriched.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center text-muted-foreground">
          <ClipboardList className="h-12 w-12 mb-4 opacity-30" />
          <p className="text-lg font-medium">{isTech ? "No jobs assigned to you" : "No repair orders yet"}</p>
          <p className="text-sm mt-1">{isTech ? "Your assigned jobs will appear here." : "Create your first RO to get started."}</p>
          {!isTech && (
            <Button onClick={() => router.push("/dashboard/ro/new")} className="mt-6">
              <Plus className="h-4 w-4 mr-2" /> New Repair Order
            </Button>
          )}
        </div>
      ) : (
        <div className="border border-border rounded-lg overflow-hidden overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="bg-surface border-b border-border">
              <tr>
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wide">RO #</th>
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wide">Vehicle</th>
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wide hidden md:table-cell">Advisor</th>
                <th className="text-right px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wide">Total</th>
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wide">Status</th>
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wide hidden lg:table-cell">DMS</th>
                <th className="text-right px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wide hidden sm:table-cell">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {enriched.map((ro) => (
                <tr key={ro.id} className="hover:bg-surface-hover transition-colors">
                  <td className="px-4 py-3">
                    <Link
                      href={`/dashboard/ro/${ro.id}`}
                      className="font-mono text-xs text-primary hover:text-primary/80 hover:underline"
                    >
                      {ro.roNumber ?? `RO-${ro.id.slice(-8).toUpperCase()}`}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-foreground">
                      {[ro.vehicle.year, ro.vehicle.make, ro.vehicle.model].filter(Boolean).join(" ") || "—"}
                    </div>
                    <div className="text-xs text-muted-foreground font-mono">{ro.vin}</div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">
                    {ro.advisor.name ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-foreground">
                    {formatCurrency(ro.totalAmount)}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${STATUS_STYLES[ro.status] ?? "bg-surface text-foreground"}`}>
                      {ro.status}
                    </span>
                  </td>
                  {/* DMS sync status column */}
                  <td className="px-4 py-3 hidden lg:table-cell">
                    {!ro.dmsSyncStatus ? (
                      <span className="text-xs text-muted-foreground">—</span>
                    ) : (
                      <div className="flex items-center gap-2">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${DMS_STYLES[ro.dmsSyncStatus] ?? "bg-surface text-foreground"}`}
                          title={ro.dmsSyncedAt ? `Synced ${timeAgo(ro.dmsSyncedAt)}` : `${ro.dmsSyncAttempts} attempt(s)`}
                        >
                          {ro.dmsSyncStatus}
                        </span>
                        {ro.dmsSyncStatus === "failed" && canResync && (
                          <button
                            id={`resync-${ro.id}`}
                            onClick={() => handleResync(ro.id)}
                            disabled={resyncing === ro.id}
                            className="text-muted-foreground hover:text-primary transition-colors disabled:opacity-50"
                            title="Re-sync to DMS"
                          >
                            {resyncing === ro.id
                              ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              : <RefreshCw className="h-3.5 w-3.5" />}
                          </button>
                        )}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right text-muted-foreground text-xs hidden sm:table-cell">
                    {timeAgo(ro.createdAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
