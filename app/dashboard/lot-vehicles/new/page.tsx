"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, Truck, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export default function NewLotVehiclePage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [vinLoading, setVinLoading] = useState(false);

  const [form, setForm] = useState({
    vin: "", year: "", make: "", model: "", trim: "",
    color: "", licensePlate: "", stockNumber: "", mileage: "", notes: "",
    status: "available",
  });

  function set(field: string, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function decodeVin() {
    if (form.vin.length !== 17) return;
    setVinLoading(true);
    try {
      const res = await fetch(`/api/maintenance?vin=${form.vin}`);
      if (res.ok) {
        const data = await res.json();
        const v = data.vehicle;
        if (v) {
          setForm((f) => ({
            ...f,
            year: v.year ? String(v.year) : f.year,
            make: v.make || f.make,
            model: v.model || f.model,
            trim: v.trim || f.trim,
          }));
        }
      }
    } catch { /* ignore */ } finally {
      setVinLoading(false);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const res = await fetch("/api/lot-vehicles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        vin: form.vin || undefined,
        year: form.year ? parseInt(form.year, 10) : undefined,
        make: form.make,
        model: form.model,
        trim: form.trim || undefined,
        color: form.color || undefined,
        licensePlate: form.licensePlate || undefined,
        stockNumber: form.stockNumber || undefined,
        mileage: form.mileage ? parseInt(form.mileage, 10) : undefined,
        notes: form.notes || undefined,
        status: form.status,
      }),
    });
    if (res.ok) {
      const data = await res.json();
      router.push(`/dashboard/lot-vehicles/${data.vehicle.id}`);
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Failed to create vehicle");
      setSaving(false);
    }
  }

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <Link href="/dashboard/lot-vehicles" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ChevronLeft className="h-4 w-4" />
        Lot Vehicles
      </Link>

      <div className="flex items-center gap-3">
        <Truck className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold text-foreground">Add Lot Vehicle</h1>
      </div>

      <form onSubmit={submit} className="space-y-4">
        {/* VIN with decode */}
        <div className="space-y-1">
          <Label>VIN (optional)</Label>
          <div className="flex gap-2">
            <Input
              value={form.vin}
              onChange={(e) => set("vin", e.target.value.toUpperCase())}
              onBlur={decodeVin}
              placeholder="17-character VIN"
              maxLength={17}
              className="font-mono"
            />
            {vinLoading && <Loader2 className="h-5 w-5 animate-spin text-muted-foreground self-center" />}
          </div>
          {form.vin && form.vin.length === 17 && (
            <p className="text-xs text-muted-foreground">VIN decoded on blur.</p>
          )}
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-1">
            <Label>Year</Label>
            <Input type="number" value={form.year} onChange={(e) => set("year", e.target.value)} placeholder="2020" min={1900} max={2100} />
          </div>
          <div className="space-y-1 col-span-2">
            <Label>Make <span className="text-destructive">*</span></Label>
            <Input value={form.make} onChange={(e) => set("make", e.target.value)} placeholder="Ford" required />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label>Model <span className="text-destructive">*</span></Label>
            <Input value={form.model} onChange={(e) => set("model", e.target.value)} placeholder="F-150" required />
          </div>
          <div className="space-y-1">
            <Label>Trim</Label>
            <Input value={form.trim} onChange={(e) => set("trim", e.target.value)} placeholder="XLT" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label>Color</Label>
            <Input value={form.color} onChange={(e) => set("color", e.target.value)} placeholder="Oxford White" />
          </div>
          <div className="space-y-1">
            <Label>License Plate</Label>
            <Input value={form.licensePlate} onChange={(e) => set("licensePlate", e.target.value)} className="font-mono" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label>Stock Number</Label>
            <Input value={form.stockNumber} onChange={(e) => set("stockNumber", e.target.value)} placeholder="STK-1234" />
          </div>
          <div className="space-y-1">
            <Label>Mileage</Label>
            <Input type="number" value={form.mileage} onChange={(e) => set("mileage", e.target.value)} placeholder="45000" min={0} />
          </div>
        </div>

        <div className="space-y-1">
          <Label>Status</Label>
          <select
            value={form.status}
            onChange={(e) => set("status", e.target.value)}
            className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="available">Available</option>
            <option value="in_service">In Service</option>
            <option value="sold">Sold</option>
          </select>
        </div>

        <div className="space-y-1">
          <Label>Notes</Label>
          <Textarea value={form.notes} onChange={(e) => set("notes", e.target.value)} placeholder="Any additional notes…" rows={3} />
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <div className="flex gap-3 pt-2">
          <Button type="submit" disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Save Vehicle
          </Button>
          <Link href="/dashboard/lot-vehicles">
            <Button type="button" variant="outline">Cancel</Button>
          </Link>
        </div>
      </form>
    </div>
  );
}
