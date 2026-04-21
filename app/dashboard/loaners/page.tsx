// [FEATURE: loaner_vehicles]
// Loaner vehicle fleet grid — status cards with check-out/check-in actions.
// Remove this file to disable.

"use client";

import { useState, useEffect, useCallback } from "react";
import { Car, Plus, RefreshCw, FileText, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";

interface LoanerLoan {
  id: string;
  customerName: string;
  checkOutAt: string;
  expectedReturnAt: string | null;
  repairOrder: { roNumber: string | null } | null;
}

interface LoanerVehicle {
  id: string;
  vin: string;
  make: string;
  model: string;
  year: number;
  licensePlate: string | null;
  color: string | null;
  status: string;
  lotVehicleId: string | null;
  notes: string | null;
  loans: LoanerLoan[];
}

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  available: { label: "Available", className: "bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300" },
  loaned: { label: "Loaned Out", className: "bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300" },
  in_service: { label: "In Service", className: "bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300" },
};

function daysSince(iso: string) {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
}

export default function LoanersPage() {
  const [vehicles, setVehicles] = useState<LoanerVehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [checkingIn, setCheckingIn] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/loaners");
    if (res.ok) {
      const { vehicles: data } = await res.json();
      setVehicles(data ?? []);
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function quickCheckIn(vehicleId: string, loanId: string, currentMileage: number) {
    const mileageIn = prompt("Current mileage (odometer reading):");
    if (!mileageIn) return;
    const fuelIn = prompt("Fuel level at return (0-100%):", "100");

    setCheckingIn(loanId);
    await fetch(`/api/loaners/${vehicleId}/loans/${loanId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mileageIn: parseInt(mileageIn) || currentMileage,
        fuelLevelIn: parseInt(fuelIn ?? "100") || 100,
      }),
    });
    setCheckingIn(null);
    load();
  }

  const available = vehicles.filter((v) => v.status === "available").length;
  const loaned = vehicles.filter((v) => v.status === "loaned").length;

  return (
    <div className="p-6 max-w-5xl space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Car className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-2xl font-bold text-foreground">Loaner Vehicles</h1>
            <p className="text-sm text-muted-foreground">
              {available} available · {loaned} out
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={load} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-1.5 ${loading ? "animate-spin" : ""}`} /> Refresh
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="py-16 text-center text-sm text-muted-foreground animate-pulse">Loading…</div>
      ) : vehicles.length === 0 ? (
        <div className="border border-border rounded-xl p-10 text-center space-y-3">
          <Car className="h-10 w-10 text-muted-foreground mx-auto" />
          <p className="text-sm text-muted-foreground">No loaner vehicles yet. Add them via the API or settings.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {vehicles.map((v) => {
            const config = STATUS_CONFIG[v.status] ?? { label: v.status, className: "bg-surface text-muted-foreground" };
            const activeLoan = v.loans[0];
            const daysOut = activeLoan ? daysSince(activeLoan.checkOutAt) : null;
            const isOverdue = activeLoan?.expectedReturnAt
              ? new Date(activeLoan.expectedReturnAt) < new Date()
              : false;

            return (
              <div key={v.id} className="border border-border rounded-xl p-4 bg-surface space-y-3">
                {/* Vehicle header */}
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-1.5">
                      <p className="font-semibold text-foreground">{v.year} {v.make} {v.model}</p>
                      {v.lotVehicleId && (
                        <span className="text-xs px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 flex items-center gap-0.5">
                          <Truck className="h-2.5 w-2.5" /> Lot
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {v.licensePlate && <span>{v.licensePlate} · </span>}
                      {v.color && <span>{v.color} · </span>}
                      <span className="font-mono">{v.vin.slice(-8)}</span>
                    </p>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded font-medium ${config.className}`}>
                    {config.label}
                  </span>
                </div>

                {/* Active loan info */}
                {activeLoan && (
                  <div className={`rounded-lg p-2.5 text-xs space-y-1 ${isOverdue ? "bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800" : "bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800"}`}>
                    <p className="font-medium text-foreground">{activeLoan.customerName}</p>
                    <p className="text-muted-foreground">
                      {activeLoan.repairOrder?.roNumber && `${activeLoan.repairOrder.roNumber} · `}
                      Out {daysOut}d ago
                      {isOverdue && <span className="text-red-600 dark:text-red-400 font-medium"> · OVERDUE</span>}
                    </p>
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-2">
                  {v.status === "loaned" && activeLoan && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1 text-xs"
                      disabled={checkingIn === activeLoan.id}
                      onClick={() => quickCheckIn(v.id, activeLoan.id, 0)}
                    >
                      {checkingIn === activeLoan.id ? "Checking in…" : "Check In"}
                    </Button>
                  )}
                  <a
                    href={`/api/loaners/${v.id}/pdf`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center justify-center h-8 px-3 text-xs rounded-md border border-border text-muted-foreground hover:text-foreground hover:bg-surface-hover transition-colors gap-1"
                    title="Download loaner agreement PDF"
                  >
                    <FileText className="h-3.5 w-3.5" /> PDF
                  </a>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
