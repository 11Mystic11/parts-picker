"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Plus, ClipboardList, CheckCircle2, Loader2, Car, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";

interface InspectionItem {
  id: string;
  status: string;
  vin: string | null;
  vehicleLabel: string | null;
  createdAt: string;
  template: { id: string; name: string };
  repairOrder: { id: string; roNumber: string | null } | null;
  tech: { id: string; name: string | null };
  lotVehicle: { id: string; year: number | null; make: string; model: string; stockNumber: string | null } | null;
}

const STATUS_STYLES: Record<string, string> = {
  in_progress: "bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300",
  complete:    "bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300",
};

function vehicleLabel(insp: InspectionItem) {
  if (insp.vehicleLabel) return insp.vehicleLabel;
  if (insp.lotVehicle) {
    return [insp.lotVehicle.year, insp.lotVehicle.make, insp.lotVehicle.model].filter(Boolean).join(" ")
      || "Lot Vehicle";
  }
  if (insp.vin) return insp.vin;
  return "No vehicle";
}

export default function InspectionsPage() {
  const [inspections, setInspections] = useState<InspectionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<"" | "in_progress" | "complete">("");

  const load = useCallback(async () => {
    setLoading(true);
    const url = statusFilter ? `/api/inspections?status=${statusFilter}` : "/api/inspections";
    const res = await fetch(url);
    if (res.ok) {
      const data = await res.json();
      setInspections(data.inspections ?? []);
    }
    setLoading(false);
  }, [statusFilter]);

  useEffect(() => { load(); }, [load]);

  const standalone = inspections.filter((i) => !i.repairOrder);
  const linked = inspections.filter((i) => i.repairOrder);

  return (
    <div className="p-6 max-w-4xl space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <ClipboardList className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-2xl font-bold text-foreground">Inspections</h1>
            <p className="text-sm text-muted-foreground">Standalone and RO-linked vehicle inspections.</p>
          </div>
        </div>
        <Link href="/dashboard/inspections/new">
          <Button size="sm">
            <Plus className="h-4 w-4 mr-1.5" />
            New Inspection
          </Button>
        </Link>
      </div>

      {/* Filter bar */}
      <div className="flex gap-2">
        {(["", "in_progress", "complete"] as const).map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={[
              "px-3 py-1 text-xs font-medium rounded-full border transition-colors",
              statusFilter === s
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-surface text-muted-foreground border-border hover:text-foreground",
            ].join(" ")}
          >
            {s === "" ? "All" : s === "in_progress" ? "In Progress" : "Complete"}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : inspections.length === 0 ? (
        <div className="text-center py-12 border border-dashed border-border rounded-xl text-muted-foreground text-sm">
          No inspections yet.{" "}
          <Link href="/dashboard/inspections/new" className="text-primary hover:underline">
            Create one
          </Link>
        </div>
      ) : (
        <>
          {/* Standalone inspections */}
          {standalone.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-muted-foreground mb-2">Standalone</h2>
              <div className="border border-border rounded-lg divide-y divide-border overflow-hidden">
                {standalone.map((insp) => (
                  <Link
                    key={insp.id}
                    href={`/dashboard/inspections/${insp.id}`}
                    className="flex items-center justify-between px-4 py-3 hover:bg-surface transition-colors"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm text-foreground">{insp.template.name}</span>
                        <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${STATUS_STYLES[insp.status] ?? "bg-surface text-muted-foreground"}`}>
                          {insp.status === "in_progress" ? "In Progress" : "Complete"}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 mt-0.5 text-xs text-muted-foreground">
                        <Car className="h-3.5 w-3.5 flex-shrink-0" />
                        <span className="truncate">{vehicleLabel(insp)}</span>
                      </div>
                    </div>
                    <div className="text-right ml-4 flex-shrink-0">
                      <p className="text-xs text-muted-foreground">{new Date(insp.createdAt).toLocaleDateString()}</p>
                      <p className="text-xs text-muted-foreground">{insp.tech.name ?? "Unknown"}</p>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* RO-linked inspections */}
          {linked.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-muted-foreground mb-2">Linked to ROs</h2>
              <div className="border border-border rounded-lg divide-y divide-border overflow-hidden">
                {linked.map((insp) => (
                  <Link
                    key={insp.id}
                    href={`/dashboard/inspections/${insp.id}`}
                    className="flex items-center justify-between px-4 py-3 hover:bg-surface transition-colors"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm text-foreground">{insp.template.name}</span>
                        <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${STATUS_STYLES[insp.status] ?? "bg-surface text-muted-foreground"}`}>
                          {insp.status === "in_progress" ? "In Progress" : "Complete"}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground flex-wrap">
                        {insp.repairOrder && (
                          <span className="flex items-center gap-1">
                            <FileText className="h-3.5 w-3.5" />
                            {insp.repairOrder.roNumber ?? `RO-${insp.repairOrder.id.slice(-6).toUpperCase()}`}
                          </span>
                        )}
                        <span className="flex items-center gap-1">
                          <Car className="h-3.5 w-3.5" />
                          {vehicleLabel(insp)}
                        </span>
                      </div>
                    </div>
                    <div className="text-right ml-4 flex-shrink-0">
                      <p className="text-xs text-muted-foreground">{new Date(insp.createdAt).toLocaleDateString()}</p>
                      <p className="text-xs text-muted-foreground">{insp.tech.name ?? "Unknown"}</p>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
