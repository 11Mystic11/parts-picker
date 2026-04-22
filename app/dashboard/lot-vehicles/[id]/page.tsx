"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, Truck, Pencil, Check, X, Plus, ClipboardList, Loader2, Car, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";

interface LotVehicle {
  id: string;
  make: string;
  model: string;
  year: number | null;
  trim: string | null;
  color: string | null;
  vin: string | null;
  licensePlate: string | null;
  stockNumber: string | null;
  mileage: number | null;
  status: string;
  isLoaner: boolean;
  notes: string | null;
  repairOrders: {
    id: string;
    roNumber: string | null;
    status: string;
    createdAt: string;
    scheduledAt: string | null;
    advisor: { name: string | null };
  }[];
}

const STATUS_STYLES: Record<string, string> = {
  available: "bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300",
  in_service: "bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300",
  sold: "bg-surface text-muted-foreground",
};
const STATUS_LABELS: Record<string, string> = { available: "Available", in_service: "In Service", sold: "Sold" };
const RO_STATUS_STYLES: Record<string, string> = {
  draft: "bg-surface text-muted-foreground",
  presented: "bg-blue-100 dark:bg-blue-900/40 text-blue-700",
  approved: "bg-green-100 dark:bg-green-900/40 text-green-700",
  closed: "bg-green-100 dark:bg-green-900/40 text-green-700",
  void: "bg-red-100 dark:bg-red-900/40 text-red-700",
};

export default function LotVehicleDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [vehicle, setVehicle] = useState<LotVehicle | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<Partial<LotVehicle>>({});
  const [saving, setSaving] = useState(false);
  const [creatingRO, setCreatingRO] = useState(false);
  const [vinDecoding, setVinDecoding] = useState(false);
  const [loanerAction, setLoanerAction] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/lot-vehicles/${id}`);
    if (res.ok) {
      const data = await res.json();
      setVehicle(data.vehicle);
      setForm(data.vehicle);
    }
    setLoading(false);
  }, [id]);

  useEffect(() => { load(); }, [load]);

  async function decodeVin(vin: string) {
    if (vin.length !== 17) return;
    setVinDecoding(true);
    try {
      const res = await fetch("/api/vin/decode", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vin: vin.toUpperCase() }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.vehicle) {
          setForm((f) => ({
            ...f,
            year: data.vehicle.year ?? f.year,
            make: data.vehicle.make ?? f.make,
            model: data.vehicle.model ?? f.model,
            trim: data.vehicle.trim ?? f.trim,
          }));
        }
      }
    } catch { /* ignore */ } finally {
      setVinDecoding(false);
    }
  }

  async function save() {
    setSaving(true);
    const res = await fetch(`/api/lot-vehicles/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        vin: form.vin ?? null,
        make: form.make,
        model: form.model,
        year: form.year ?? null,
        trim: form.trim ?? null,
        color: form.color ?? null,
        licensePlate: form.licensePlate ?? null,
        stockNumber: form.stockNumber ?? null,
        mileage: form.mileage ?? null,
        status: form.status,
        notes: form.notes ?? null,
      }),
    });
    if (res.ok) {
      setEditing(false);
      await load();
    }
    setSaving(false);
  }

  async function sendToLoaners() {
    if (!vehicle) return;
    setLoanerAction(true);
    const res = await fetch(`/api/lot-vehicles/${id}/send-to-loaners`, { method: "POST" });
    setLoanerAction(false);
    if (res.ok) {
      await load();
    } else {
      const data = await res.json().catch(() => ({}));
      alert(data.error ?? "Failed to send to loaners.");
    }
  }

  async function recallFromLoaners() {
    if (!vehicle) return;
    setLoanerAction(true);
    const res = await fetch(`/api/lot-vehicles/${id}/send-to-loaners`, { method: "DELETE" });
    setLoanerAction(false);
    if (res.ok) {
      await load();
    } else {
      const data = await res.json().catch(() => ({}));
      alert(data.error ?? "Failed to recall from loaners.");
    }
  }

  async function handleDelete() {
    if (!confirm("Delete this vehicle? This cannot be undone.")) return;
    setDeleting(true);
    await fetch(`/api/lot-vehicles/${id}`, { method: "DELETE" });
    router.push("/dashboard/lot-vehicles");
  }

  async function scheduleAppointment() {
    if (!vehicle) return;
    setCreatingRO(true);
    router.push(`/dashboard/ro/new?lotVehicleId=${vehicle.id}&make=${encodeURIComponent(vehicle.make)}&model=${encodeURIComponent(vehicle.model)}&year=${vehicle.year ?? ""}&vin=${vehicle.vin ?? ""}`);
  }

  if (loading) return <div className="p-6 text-sm text-muted-foreground animate-pulse">Loading…</div>;
  if (!vehicle) return <div className="p-6 text-sm text-destructive">Vehicle not found.</div>;

  const v = vehicle;
  const vehicleName = [v.year, v.make, v.model].filter(Boolean).join(" ");

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <Link href="/dashboard/lot-vehicles" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ChevronLeft className="h-4 w-4" />
        Lot Vehicles
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <Truck className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              {vehicleName}
              {v.trim && <span className="font-normal text-muted-foreground"> {v.trim}</span>}
            </h1>
            <div className="flex items-center gap-2 mt-1">
              <span className={`text-xs font-medium px-2 py-0.5 rounded ${STATUS_STYLES[v.status] ?? STATUS_STYLES.available}`}>
                {STATUS_LABELS[v.status] ?? v.status}
              </span>
              {v.isLoaner && (
                <span className="text-xs font-medium px-2 py-0.5 rounded bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 flex items-center gap-1">
                  <Car className="h-3 w-3" /> Loaner
                </span>
              )}
              {v.stockNumber && <span className="text-xs text-muted-foreground">Stock #{v.stockNumber}</span>}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!editing ? (
            <>
              <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
                <Pencil className="h-4 w-4 mr-1.5" />
                Edit
              </Button>
              <Button size="sm" variant="outline" onClick={handleDelete} disabled={deleting}
                className="text-destructive border-destructive/40 hover:bg-destructive/10">
                {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              </Button>
              {!v.isLoaner ? (
                <Button size="sm" variant="outline" onClick={sendToLoaners} disabled={loanerAction}
                  className="text-purple-700 border-purple-300 hover:bg-purple-50 dark:text-purple-300 dark:border-purple-700">
                  {loanerAction ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <Car className="h-4 w-4 mr-1.5" />}
                  Send to Loaners
                </Button>
              ) : (
                <Button size="sm" variant="outline" onClick={recallFromLoaners} disabled={loanerAction}
                  className="text-amber-700 border-amber-300 hover:bg-amber-50 dark:text-amber-300 dark:border-amber-700">
                  {loanerAction ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <Car className="h-4 w-4 mr-1.5" />}
                  Recall from Loaners
                </Button>
              )}
              <Button size="sm" onClick={scheduleAppointment} disabled={creatingRO}>
                {creatingRO ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <Plus className="h-4 w-4 mr-1.5" />}
                Schedule Appointment
              </Button>
            </>
          ) : (
            <>
              <Button size="sm" onClick={save} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4 mr-1" />}
                Save
              </Button>
              <Button size="sm" variant="outline" onClick={() => { setEditing(false); setForm(vehicle); }}>
                <X className="h-4 w-4" />
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Vehicle info card */}
      <div className="border border-border rounded-lg p-4 space-y-3">
        {editing ? (
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-3">
              <div><Label className="text-xs">Year</Label><Input type="number" value={form.year ?? ""} onChange={(e) => setForm((f) => ({ ...f, year: e.target.value ? parseInt(e.target.value) : null }))} /></div>
              <div className="col-span-2"><Label className="text-xs">Make</Label><Input value={form.make ?? ""} onChange={(e) => setForm((f) => ({ ...f, make: e.target.value }))} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs">Model</Label><Input value={form.model ?? ""} onChange={(e) => setForm((f) => ({ ...f, model: e.target.value }))} /></div>
              <div><Label className="text-xs">Trim</Label><Input value={form.trim ?? ""} onChange={(e) => setForm((f) => ({ ...f, trim: e.target.value || null }))} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs">Color</Label><Input value={form.color ?? ""} onChange={(e) => setForm((f) => ({ ...f, color: e.target.value || null }))} /></div>
              <div><Label className="text-xs">License Plate</Label><Input value={form.licensePlate ?? ""} onChange={(e) => setForm((f) => ({ ...f, licensePlate: e.target.value || null }))} className="font-mono" /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs">Stock #</Label><Input value={form.stockNumber ?? ""} onChange={(e) => setForm((f) => ({ ...f, stockNumber: e.target.value || null }))} /></div>
              <div><Label className="text-xs">Mileage</Label><Input type="number" value={form.mileage ?? ""} onChange={(e) => setForm((f) => ({ ...f, mileage: e.target.value ? parseInt(e.target.value) : null }))} /></div>
            </div>
            <div className="relative">
              <Label className="text-xs">VIN</Label>
              <div className="flex items-center gap-2">
                <Input
                  value={form.vin ?? ""}
                  onChange={(e) => setForm((f) => ({ ...f, vin: e.target.value.toUpperCase() || null }))}
                  onBlur={(e) => decodeVin(e.target.value.toUpperCase())}
                  placeholder="17-character VIN (auto-fills year/make/model)"
                  className="font-mono"
                  maxLength={17}
                />
                {vinDecoding && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground shrink-0" />}
              </div>
            </div>
            <div>
              <Label className="text-xs">Status</Label>
              <select value={form.status ?? "available"} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))} className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background text-foreground">
                <option value="available">Available</option>
                <option value="in_service">In Service</option>
                <option value="sold">Sold</option>
              </select>
            </div>
            <div><Label className="text-xs">Notes</Label><Textarea value={form.notes ?? ""} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value || null }))} rows={3} /></div>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
            {v.vin && <div className="col-span-2"><span className="text-muted-foreground">VIN: </span><span className="font-mono">{v.vin}</span></div>}
            {v.color && <div><span className="text-muted-foreground">Color: </span>{v.color}</div>}
            {v.licensePlate && <div><span className="text-muted-foreground">Plate: </span><span className="font-mono">{v.licensePlate}</span></div>}
            {v.mileage != null && <div><span className="text-muted-foreground">Mileage: </span>{v.mileage.toLocaleString()} mi</div>}
            {v.stockNumber && <div><span className="text-muted-foreground">Stock #: </span>{v.stockNumber}</div>}
            {v.notes && <div className="col-span-2 pt-1 text-muted-foreground italic">{v.notes}</div>}
          </div>
        )}
      </div>

      {/* RO History */}
      <div className="border border-border rounded-lg overflow-hidden">
        <div className="px-4 py-2.5 bg-surface border-b border-border flex items-center gap-2">
          <ClipboardList className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-semibold text-foreground">Service History</span>
          <span className="ml-auto text-xs text-muted-foreground">{v.repairOrders.length} RO{v.repairOrders.length !== 1 ? "s" : ""}</span>
        </div>
        {v.repairOrders.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-muted-foreground">No service history yet.</div>
        ) : (
          <div className="divide-y divide-border">
            {v.repairOrders.map((ro) => (
              <Link key={ro.id} href={`/dashboard/ro/${ro.id}`} className="flex items-center justify-between px-4 py-3 hover:bg-surface transition-colors">
                <div>
                  <span className="text-sm font-medium text-foreground font-mono">{ro.roNumber ?? `RO-${ro.id.slice(-6).toUpperCase()}`}</span>
                  {ro.advisor.name && <span className="text-xs text-muted-foreground ml-2">· {ro.advisor.name}</span>}
                  <p className="text-xs text-muted-foreground">{new Date(ro.createdAt).toLocaleDateString()}</p>
                </div>
                <span className={`text-xs font-medium px-2 py-0.5 rounded ${RO_STATUS_STYLES[ro.status] ?? "bg-surface text-muted-foreground"}`}>
                  {ro.status}
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
