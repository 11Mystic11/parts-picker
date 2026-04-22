"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, Truck, Loader2, Plus, X, CheckCircle2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface VehicleRow {
  id: string; // local key only
  vin: string;
  year: string;
  make: string;
  model: string;
  trim: string;
  color: string;
  licensePlate: string;
  stockNumber: string;
  mileage: string;
  status: string;
  notes: string;
  vinLoading: boolean;
  vinDecoded: boolean;
  // result state after save attempt
  saved?: boolean;
  error?: string;
}

function emptyRow(): VehicleRow {
  return {
    id: Math.random().toString(36).slice(2),
    vin: "", year: "", make: "", model: "", trim: "",
    color: "", licensePlate: "", stockNumber: "", mileage: "",
    status: "available", notes: "",
    vinLoading: false, vinDecoded: false,
  };
}

export default function NewLotVehiclePage() {
  const router = useRouter();
  const [rows, setRows] = useState<VehicleRow[]>([emptyRow()]);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  function updateRow(id: string, patch: Partial<VehicleRow>) {
    setRows((prev) => prev.map((r) => r.id === id ? { ...r, ...patch } : r));
  }

  function addRow() {
    setRows((prev) => [...prev, emptyRow()]);
  }

  function removeRow(id: string) {
    setRows((prev) => prev.length > 1 ? prev.filter((r) => r.id !== id) : prev);
  }

  const decodeVin = useCallback(async (id: string, vin: string) => {
    if (vin.length !== 17) return;
    updateRow(id, { vinLoading: true });
    try {
      const res = await fetch("/api/vin/decode", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vin: vin.toUpperCase() }),
      });
      if (res.ok) {
        const data = await res.json();
        const v = data.vehicle;
        if (v) {
          updateRow(id, {
            year: v.year ? String(v.year) : "",
            make: v.make || "",
            model: v.model || "",
            trim: v.trim || "",
            vinDecoded: true,
          });
        }
      }
    } catch { /* ignore */ } finally {
      updateRow(id, { vinLoading: false });
    }
  }, []);

  async function saveAll() {
    setSaving(true);
    const toSave = rows.filter((r) => r.make.trim() || r.model.trim() || r.vin.trim());

    // Reset result state
    setRows((prev) => prev.map((r) => ({ ...r, saved: undefined, error: undefined })));

    await Promise.all(
      toSave.map(async (row) => {
        if (!row.make.trim() && !row.model.trim()) {
          updateRow(row.id, { error: "Make and model are required" });
          return;
        }
        const res = await fetch("/api/lot-vehicles", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            vin: row.vin || undefined,
            year: row.year ? parseInt(row.year, 10) : undefined,
            make: row.make || "Unknown",
            model: row.model || "Unknown",
            trim: row.trim || undefined,
            color: row.color || undefined,
            licensePlate: row.licensePlate || undefined,
            stockNumber: row.stockNumber || undefined,
            mileage: row.mileage ? parseInt(row.mileage, 10) : undefined,
            notes: row.notes || undefined,
            status: row.status,
          }),
        });
        if (res.ok) {
          updateRow(row.id, { saved: true, error: undefined });
        } else {
          const data = await res.json().catch(() => ({}));
          updateRow(row.id, { error: data.error ?? "Failed to save" });
        }
      })
    );

    setSaving(false);

    // If all rows saved cleanly, redirect after short delay
    const updatedRows = rows.filter((r) => r.make.trim() || r.model.trim() || r.vin.trim());
    const allOk = updatedRows.every((r) => r.saved);
    if (allOk && toSave.length === 1) {
      router.push("/dashboard/lot-vehicles");
    } else if (allOk) {
      setDone(true);
    }
  }

  const pendingCount = rows.filter((r) => r.make.trim() || r.model.trim() || r.vin.trim()).length;
  const savedCount = rows.filter((r) => r.saved).length;
  const errorCount = rows.filter((r) => r.error).length;

  if (done) {
    return (
      <div className="p-6 max-w-2xl mx-auto space-y-4">
        <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
          <CheckCircle2 className="h-5 w-5" />
          <span className="font-medium">{savedCount} vehicle{savedCount !== 1 ? "s" : ""} added successfully</span>
        </div>
        <div className="flex gap-3">
          <Link href="/dashboard/lot-vehicles"><Button>View Lot Vehicles</Button></Link>
          <Button variant="outline" onClick={() => { setRows([emptyRow()]); setDone(false); }}>Add More</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <Link href="/dashboard/lot-vehicles" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ChevronLeft className="h-4 w-4" />
        Lot Vehicles
      </Link>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Truck className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-2xl font-bold text-foreground">Add Lot Vehicles</h1>
            <p className="text-sm text-muted-foreground">Enter a VIN to auto-fill details. Add as many rows as you need.</p>
          </div>
        </div>
        <Button size="sm" variant="outline" onClick={addRow}>
          <Plus className="h-4 w-4 mr-1.5" />
          Add Row
        </Button>
      </div>

      <div className="space-y-3">
        {rows.map((row, idx) => (
          <div
            key={row.id}
            className={`border rounded-xl p-4 space-y-3 transition-colors ${
              row.saved ? "border-green-400 dark:border-green-700 bg-green-50 dark:bg-green-950/20"
              : row.error ? "border-destructive/50 bg-red-50 dark:bg-red-950/20"
              : "border-border bg-background"
            }`}
          >
            {/* Row header */}
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">Vehicle {idx + 1}</span>
              <div className="flex items-center gap-2">
                {row.saved && <span className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1"><CheckCircle2 className="h-3.5 w-3.5" /> Saved</span>}
                {row.error && <span className="text-xs text-destructive flex items-center gap-1"><AlertCircle className="h-3.5 w-3.5" /> {row.error}</span>}
                {rows.length > 1 && !row.saved && (
                  <button onClick={() => removeRow(row.id)} className="text-muted-foreground hover:text-destructive transition-colors" title="Remove row">
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>

            {/* VIN + decoded badge */}
            <div className="flex items-center gap-2">
              <div className="relative flex-1 max-w-xs">
                <Input
                  value={row.vin}
                  onChange={(e) => updateRow(row.id, { vin: e.target.value.toUpperCase(), vinDecoded: false })}
                  onBlur={(e) => decodeVin(row.id, e.target.value.toUpperCase())}
                  placeholder="VIN (auto-fills make/model/year)"
                  maxLength={17}
                  className="font-mono pr-8"
                  disabled={row.saved}
                />
                {row.vinLoading && (
                  <Loader2 className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
                )}
              </div>
              {row.vinDecoded && (
                <span className="text-xs text-primary font-medium">VIN decoded</span>
              )}
            </div>

            {/* Main fields grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <label className="text-xs text-muted-foreground block mb-1">Year</label>
                <Input
                  type="number"
                  value={row.year}
                  onChange={(e) => updateRow(row.id, { year: e.target.value })}
                  placeholder="2022"
                  min={1900} max={2100}
                  disabled={row.saved}
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground block mb-1">Make <span className="text-destructive">*</span></label>
                <Input
                  value={row.make}
                  onChange={(e) => updateRow(row.id, { make: e.target.value })}
                  placeholder="Ford"
                  disabled={row.saved}
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground block mb-1">Model <span className="text-destructive">*</span></label>
                <Input
                  value={row.model}
                  onChange={(e) => updateRow(row.id, { model: e.target.value })}
                  placeholder="F-150"
                  disabled={row.saved}
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground block mb-1">Trim</label>
                <Input
                  value={row.trim}
                  onChange={(e) => updateRow(row.id, { trim: e.target.value })}
                  placeholder="XLT"
                  disabled={row.saved}
                />
              </div>
            </div>

            {/* Secondary fields */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <label className="text-xs text-muted-foreground block mb-1">Color</label>
                <Input
                  value={row.color}
                  onChange={(e) => updateRow(row.id, { color: e.target.value })}
                  placeholder="White"
                  disabled={row.saved}
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground block mb-1">License Plate</label>
                <Input
                  value={row.licensePlate}
                  onChange={(e) => updateRow(row.id, { licensePlate: e.target.value })}
                  className="font-mono"
                  disabled={row.saved}
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground block mb-1">Stock #</label>
                <Input
                  value={row.stockNumber}
                  onChange={(e) => updateRow(row.id, { stockNumber: e.target.value })}
                  placeholder="STK-001"
                  disabled={row.saved}
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground block mb-1">Mileage</label>
                <Input
                  type="number"
                  value={row.mileage}
                  onChange={(e) => updateRow(row.id, { mileage: e.target.value })}
                  placeholder="45000"
                  min={0}
                  disabled={row.saved}
                />
              </div>
            </div>

            {/* Status + notes on one line */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <label className="text-xs text-muted-foreground block mb-1">Status</label>
                <select
                  value={row.status}
                  onChange={(e) => updateRow(row.id, { status: e.target.value })}
                  disabled={row.saved}
                  className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background text-foreground disabled:opacity-50"
                >
                  <option value="available">Available</option>
                  <option value="in_service">In Service</option>
                  <option value="sold">Sold</option>
                </select>
              </div>
              <div className="sm:col-span-3">
                <label className="text-xs text-muted-foreground block mb-1">Notes</label>
                <Input
                  value={row.notes}
                  onChange={(e) => updateRow(row.id, { notes: e.target.value })}
                  placeholder="Optional notes…"
                  disabled={row.saved}
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Add row link */}
      <button
        onClick={addRow}
        className="flex items-center gap-2 text-sm text-primary hover:underline"
      >
        <Plus className="h-4 w-4" />
        Add another vehicle
      </button>

      {/* Save / cancel */}
      <div className="flex items-center gap-3 pt-2 border-t border-border">
        <Button onClick={saveAll} disabled={saving || pendingCount === 0}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : null}
          {saving ? "Saving…" : `Save ${pendingCount > 1 ? `${pendingCount} Vehicles` : "Vehicle"}`}
        </Button>
        <Link href="/dashboard/lot-vehicles">
          <Button variant="outline">Cancel</Button>
        </Link>
        {savedCount > 0 && !saving && (
          <span className="text-xs text-muted-foreground ml-auto">
            {savedCount} saved{errorCount > 0 ? `, ${errorCount} failed` : ""}
          </span>
        )}
      </div>
    </div>
  );
}
