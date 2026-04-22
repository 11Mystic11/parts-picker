"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ChevronLeft, User, Pencil, Check, X, Phone, Mail, ClipboardList,
  Plus, Loader2, Car, Trash2, ChevronDown, ChevronUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface CustomerVehicle {
  id: string;
  vin: string | null;
  year: number | null;
  make: string;
  model: string;
  trim: string | null;
  color: string | null;
  licensePlate: string | null;
  mileage: number | null;
  notes: string | null;
}

interface CustomerRO {
  id: string; roNumber: string | null; status: string;
  vin: string; vehicleSnapshot: string; createdAt: string;
  scheduledAt: string | null; totalAmount: number;
  advisor: { name: string | null };
  lineItems: { description: string }[];
}
interface Customer {
  id: string; name: string; phone: string | null; email: string | null;
  notes: string | null; createdAt: string;
  repairOrders: CustomerRO[];
}

const RO_STATUS_STYLES: Record<string, string> = {
  draft: "bg-surface text-muted-foreground", presented: "bg-blue-100 dark:bg-blue-900/40 text-blue-700",
  approved: "bg-green-100 dark:bg-green-900/40 text-green-700",
  closed: "bg-green-100 dark:bg-green-900/40 text-green-700",
  void: "bg-red-100 dark:bg-red-900/40 text-red-700",
};

function vehicleLabel(snapshot: string) {
  try { const v = JSON.parse(snapshot); return [v.year, v.make, v.model].filter(Boolean).join(" ") || "Unknown"; }
  catch { return "Unknown"; }
}

const EMPTY_VEHICLE_FORM = {
  vin: "", year: "", make: "", model: "", trim: "", color: "", licensePlate: "", mileage: "",
};

function AddVehicleForm({ customerId, onAdded }: { customerId: string; onAdded: () => void }) {
  const [form, setForm] = useState(EMPTY_VEHICLE_FORM);
  const [decoding, setDecoding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function decodeVin(vin: string) {
    if (vin.length !== 17) return;
    setDecoding(true);
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
            year: data.vehicle.year ? String(data.vehicle.year) : f.year,
            make: data.vehicle.make ?? f.make,
            model: data.vehicle.model ?? f.model,
            trim: data.vehicle.trim ?? f.trim,
          }));
        }
      }
    } catch { /* ignore */ } finally {
      setDecoding(false);
    }
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!form.make.trim() || !form.model.trim()) { setError("Make and model are required"); return; }
    setSaving(true);
    try {
      const res = await fetch(`/api/customers/${customerId}/vehicles`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vin: form.vin.trim() || null,
          year: form.year ? parseInt(form.year) : null,
          make: form.make.trim(),
          model: form.model.trim(),
          trim: form.trim.trim() || null,
          color: form.color.trim() || null,
          licensePlate: form.licensePlate.trim() || null,
          mileage: form.mileage ? parseInt(form.mileage) : null,
        }),
      });
      if (res.ok) {
        setForm(EMPTY_VEHICLE_FORM);
        onAdded();
      } else {
        let msg = "Failed to add vehicle";
        try { const data = await res.json(); msg = data.error ?? msg; } catch { /* ignore */ }
        setError(msg);
      }
    } catch {
      setError("Network error — please try again");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleAdd} className="border border-border rounded-lg p-4 space-y-3 bg-surface/50">
      <p className="text-sm font-medium text-foreground">Add Vehicle</p>

      {/* VIN row */}
      <div className="space-y-1">
        <Label className="text-xs">VIN</Label>
        <div className="flex items-center gap-2">
          <Input
            value={form.vin}
            onChange={(e) => setForm((f) => ({ ...f, vin: e.target.value.toUpperCase() }))}
            onBlur={(e) => decodeVin(e.target.value)}
            placeholder="17-character VIN (auto-fills year/make/model)"
            className="font-mono"
            maxLength={17}
          />
          {decoding && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground shrink-0" />}
        </div>
      </div>

      {/* Year / Make / Model / Trim */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <div className="space-y-1">
          <Label className="text-xs">Year</Label>
          <Input value={form.year} onChange={(e) => setForm((f) => ({ ...f, year: e.target.value }))} placeholder="2020" maxLength={4} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Make <span className="text-destructive">*</span></Label>
          <Input value={form.make} onChange={(e) => setForm((f) => ({ ...f, make: e.target.value }))} placeholder="Ford" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Model <span className="text-destructive">*</span></Label>
          <Input value={form.model} onChange={(e) => setForm((f) => ({ ...f, model: e.target.value }))} placeholder="F-150" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Trim</Label>
          <Input value={form.trim} onChange={(e) => setForm((f) => ({ ...f, trim: e.target.value }))} placeholder="XLT" />
        </div>
      </div>

      {/* Color / Plate / Mileage */}
      <div className="grid grid-cols-3 gap-2">
        <div className="space-y-1">
          <Label className="text-xs">Color</Label>
          <Input value={form.color} onChange={(e) => setForm((f) => ({ ...f, color: e.target.value }))} placeholder="White" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">License Plate</Label>
          <Input value={form.licensePlate} onChange={(e) => setForm((f) => ({ ...f, licensePlate: e.target.value.toUpperCase() }))} placeholder="ABC-1234" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Mileage</Label>
          <Input value={form.mileage} onChange={(e) => setForm((f) => ({ ...f, mileage: e.target.value }))} placeholder="45000" type="number" min={0} />
        </div>
      </div>

      {error && <p className="text-xs text-destructive">{error}</p>}

      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={saving}>
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <Plus className="h-3.5 w-3.5 mr-1.5" />}
          Add Vehicle
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => setForm(EMPTY_VEHICLE_FORM)}>Clear</Button>
      </div>
    </form>
  );
}

function VehicleCard({
  vehicle, customerId, customerName, onDeleted,
}: {
  vehicle: CustomerVehicle; customerId: string; customerName: string; onDeleted: () => void;
}) {
  const [deleting, setDeleting] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const displayName = [vehicle.year, vehicle.make, vehicle.model, vehicle.trim].filter(Boolean).join(" ");

  async function handleDelete() {
    if (!confirm(`Remove ${displayName} from this customer?`)) return;
    setDeleting(true);
    await fetch(`/api/customers/${customerId}/vehicles/${vehicle.id}`, { method: "DELETE" });
    onDeleted();
  }

  const scheduleUrl = `/dashboard/ro/new?${new URLSearchParams({
    vin: vehicle.vin ?? "",
    customerName: customerName,
    ...(vehicle.vin ? {} : { lotVehicleId: "" }),
  }).toString()}`;

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-3">
        <Car className="h-4 w-4 text-muted-foreground shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground truncate">{displayName}</p>
          <div className="flex gap-3 text-xs text-muted-foreground flex-wrap">
            {vehicle.vin && <span className="font-mono">{vehicle.vin}</span>}
            {vehicle.licensePlate && <span>{vehicle.licensePlate}</span>}
            {vehicle.color && <span>{vehicle.color}</span>}
            {vehicle.mileage != null && <span>{vehicle.mileage.toLocaleString()} mi</span>}
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <Link href={scheduleUrl}>
            <Button size="sm" variant="outline" className="text-xs h-7 px-2">
              <Plus className="h-3 w-3 mr-1" />Schedule RO
            </Button>
          </Link>
          <button
            onClick={() => setExpanded((v) => !v)}
            className="p-1.5 rounded text-muted-foreground hover:text-foreground transition-colors"
          >
            {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </button>
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="p-1.5 rounded text-muted-foreground hover:text-destructive transition-colors"
          >
            {deleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
          </button>
        </div>
      </div>
      {expanded && vehicle.notes && (
        <div className="border-t border-border px-4 py-2.5 bg-surface/50">
          <p className="text-xs text-muted-foreground whitespace-pre-wrap">{vehicle.notes}</p>
        </div>
      )}
    </div>
  );
}

export default function CustomerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [vehicles, setVehicles] = useState<CustomerVehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<Partial<Customer>>({});
  const [saving, setSaving] = useState(false);
  const [notesSaving, setNotesSaving] = useState(false);
  const [notesValue, setNotesValue] = useState("");
  const [showAddVehicle, setShowAddVehicle] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const loadVehicles = useCallback(async () => {
    const res = await fetch(`/api/customers/${id}/vehicles`);
    if (res.ok) {
      const data = await res.json();
      setVehicles(data.vehicles ?? []);
    }
  }, [id]);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/customers/${id}`);
    if (res.ok) {
      const data = await res.json();
      setCustomer(data.customer);
      setForm(data.customer);
      setNotesValue(data.customer.notes ?? "");
    }
    setLoading(false);
  }, [id]);

  useEffect(() => {
    load();
    loadVehicles();
  }, [load, loadVehicles]);

  async function save() {
    setSaving(true);
    await fetch(`/api/customers/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: form.name, phone: form.phone ?? null, email: form.email ?? null }),
    });
    setEditing(false);
    await load();
    setSaving(false);
  }

  async function saveNotes() {
    setNotesSaving(true);
    await fetch(`/api/customers/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notes: notesValue || null }),
    });
    setNotesSaving(false);
    await load();
  }

  async function handleDelete() {
    if (!confirm("Delete this customer and all their records? This cannot be undone.")) return;
    setDeleting(true);
    await fetch(`/api/customers/${id}`, { method: "DELETE" });
    router.push("/dashboard/customers");
  }

  async function scheduleAppointment() {
    if (!customer) return;
    router.push(`/dashboard/ro/new?customerId=${customer.id}&customerName=${encodeURIComponent(customer.name)}&customerPhone=${encodeURIComponent(customer.phone ?? "")}&customerEmail=${encodeURIComponent(customer.email ?? "")}`);
  }

  if (loading) return <div className="p-6 text-sm text-muted-foreground animate-pulse">Loading…</div>;
  if (!customer) return <div className="p-6 text-sm text-destructive">Customer not found.</div>;

  // Group ROs by VIN for vehicle history
  const vehicleMap = new Map<string, CustomerRO[]>();
  for (const ro of customer.repairOrders) {
    const group = vehicleMap.get(ro.vin) ?? [];
    group.push(ro);
    vehicleMap.set(ro.vin, group);
  }

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <Link href="/dashboard/customers" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ChevronLeft className="h-4 w-4" />Customers
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-primary/15 flex items-center justify-center">
            <User className="h-5 w-5 text-primary" />
          </div>
          <div>
            {editing ? (
              <Input value={form.name ?? ""} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className="font-bold text-xl h-8" autoFocus />
            ) : (
              <h1 className="text-2xl font-bold text-foreground">{customer.name}</h1>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!editing ? (
            <>
              <Button size="sm" variant="outline" onClick={() => setEditing(true)}><Pencil className="h-4 w-4 mr-1.5" />Edit</Button>
              <Button size="sm" variant="outline" onClick={handleDelete} disabled={deleting}
                className="text-destructive border-destructive/40 hover:bg-destructive/10">
                {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              </Button>
              <Button size="sm" onClick={scheduleAppointment}><Plus className="h-4 w-4 mr-1.5" />Schedule Appointment</Button>
            </>
          ) : (
            <>
              <Button size="sm" onClick={save} disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4 mr-1" />}Save</Button>
              <Button size="sm" variant="outline" onClick={() => { setEditing(false); setForm(customer); }}><X className="h-4 w-4" /></Button>
            </>
          )}
        </div>
      </div>

      {/* Contact info */}
      <div className="border border-border rounded-lg p-4 space-y-3">
        {editing ? (
          <div className="space-y-3">
            <div><Label className="text-xs">Phone</Label><Input value={form.phone ?? ""} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value || null }))} placeholder="(555) 000-0000" /></div>
            <div><Label className="text-xs">Email</Label><Input value={form.email ?? ""} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value || null }))} placeholder="email@example.com" /></div>
          </div>
        ) : (
          <div className="flex flex-wrap gap-4 text-sm">
            {customer.phone ? <span className="flex items-center gap-1.5 text-foreground"><Phone className="h-4 w-4 text-muted-foreground" />{customer.phone}</span> : <span className="text-muted-foreground text-xs">No phone</span>}
            {customer.email ? <span className="flex items-center gap-1.5 text-foreground"><Mail className="h-4 w-4 text-muted-foreground" />{customer.email}</span> : <span className="text-muted-foreground text-xs">No email</span>}
          </div>
        )}
      </div>

      {/* Vehicles */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Car className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-semibold text-foreground">Vehicles</span>
            <span className="text-xs text-muted-foreground">({vehicles.length})</span>
          </div>
          <Button size="sm" variant="outline" onClick={() => setShowAddVehicle((v) => !v)}>
            {showAddVehicle ? <X className="h-3.5 w-3.5 mr-1.5" /> : <Plus className="h-3.5 w-3.5 mr-1.5" />}
            {showAddVehicle ? "Cancel" : "Add Vehicle"}
          </Button>
        </div>

        {showAddVehicle && (
          <AddVehicleForm
            customerId={id}
            onAdded={() => {
              setShowAddVehicle(false);
              loadVehicles();
            }}
          />
        )}

        {vehicles.length === 0 && !showAddVehicle ? (
          <div className="text-center py-6 border border-border rounded-xl text-sm text-muted-foreground">
            No vehicles on file. Add one to quickly schedule ROs.
          </div>
        ) : (
          <div className="space-y-2">
            {vehicles.map((v) => (
              <VehicleCard
                key={v.id}
                vehicle={v}
                customerId={id}
                customerName={customer.name}
                onDeleted={loadVehicles}
              />
            ))}
          </div>
        )}
      </div>

      {/* Notes */}
      <div className="border border-border rounded-lg p-4 space-y-2">
        <p className="text-sm font-medium text-foreground">Customer Notes</p>
        <Textarea
          value={notesValue}
          onChange={(e) => setNotesValue(e.target.value)}
          placeholder="Notes about this customer…"
          rows={3}
        />
        {notesValue !== (customer.notes ?? "") && (
          <Button size="sm" onClick={saveNotes} disabled={notesSaving}>
            {notesSaving ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <Check className="h-4 w-4 mr-1.5" />}
            Save Notes
          </Button>
        )}
      </div>

      {/* Vehicle History grouped by VIN */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <ClipboardList className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-semibold text-foreground">Service History</span>
          <span className="text-xs text-muted-foreground">({customer.repairOrders.length} RO{customer.repairOrders.length !== 1 ? "s" : ""})</span>
        </div>
        {vehicleMap.size === 0 ? (
          <div className="text-center py-8 border border-border rounded-xl text-sm text-muted-foreground">No service history yet.</div>
        ) : (
          Array.from(vehicleMap.entries()).map(([vin, ros]) => (
            <div key={vin} className="border border-border rounded-lg overflow-hidden">
              <div className="px-4 py-2.5 bg-surface border-b border-border flex items-center gap-2">
                <Car className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium text-foreground">{vehicleLabel(ros[0].vehicleSnapshot)}</span>
                <span className="text-xs font-mono text-muted-foreground">{vin}</span>
                <Link href={`/dashboard/ro/new?vin=${vin}&customerName=${encodeURIComponent(customer.name)}`} className="ml-auto text-xs text-primary hover:underline">
                  + Schedule
                </Link>
              </div>
              <div className="divide-y divide-border">
                {ros.map((ro) => (
                  <Link key={ro.id} href={`/dashboard/ro/${ro.id}`} className="flex items-center justify-between px-4 py-3 hover:bg-surface transition-colors">
                    <div>
                      <span className="text-sm font-medium font-mono text-foreground">{ro.roNumber ?? `RO-${ro.id.slice(-6).toUpperCase()}`}</span>
                      {ro.advisor.name && <span className="text-xs text-muted-foreground ml-2">· {ro.advisor.name}</span>}
                      <p className="text-xs text-muted-foreground">{new Date(ro.createdAt).toLocaleDateString()}</p>
                      {ro.lineItems.length > 0 && <p className="text-xs text-muted-foreground truncate max-w-xs">{ro.lineItems.map((l) => l.description).join(" · ")}</p>}
                    </div>
                    <div className="text-right">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded ${RO_STATUS_STYLES[ro.status] ?? "bg-surface text-muted-foreground"}`}>{ro.status}</span>
                      <p className="text-sm font-medium text-foreground mt-1">${ro.totalAmount.toFixed(0)}</p>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
