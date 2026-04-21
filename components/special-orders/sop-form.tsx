// [FEATURE: special_orders]
// SOP creation form — creates a new Special Order Part record.
"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { X, RefreshCw } from "lucide-react";

interface ROOption {
  id: string;
  roNumber: string | null;
  customerName: string | null;
  customerPhone: string | null;
  status: string;
}

interface Props {
  onClose: () => void;
  onSaved: () => void;
}

export function SOPForm({ onClose, onSaved }: Props) {
  const [saving, setSaving] = useState(false);
  const [autoFilling, setAutoFilling] = useState(false);
  const [generatingSop, setGeneratingSop] = useState(false);
  const [form, setForm] = useState({
    partNumber: "",
    description: "",
    supplier: "",
    quantity: "1",
    customerName: "",
    customerPhone: "",
    depositCollected: "",
    vendorPO: "",
    supplierEta: "",
    notes: "",
  });

  const [roOptions, setRoOptions] = useState<ROOption[]>([]);
  const [selectedRoId, setSelectedRoId] = useState<string>("");
  const [roSearch, setRoSearch] = useState("");
  const [showRoDropdown, setShowRoDropdown] = useState(false);

  useEffect(() => {
    fetch("/api/ro?limit=100")
      .then((r) => r.json())
      .then((d) => setRoOptions(d.ros ?? []))
      .catch(() => {});
  }, []);

  const selectedRo = roOptions.find((r) => r.id === selectedRoId) ?? null;

  // Auto-fill customer info from linked RO
  useEffect(() => {
    if (selectedRo) {
      setForm((f) => ({
        ...f,
        customerName: selectedRo.customerName ?? f.customerName,
        customerPhone: selectedRo.customerPhone ?? f.customerPhone,
      }));
    }
  }, [selectedRoId]);

  const filteredRos = roSearch
    ? roOptions.filter((r) =>
        (r.roNumber ?? "").toLowerCase().includes(roSearch.toLowerCase()) ||
        (r.customerName ?? "").toLowerCase().includes(roSearch.toLowerCase())
      )
    : roOptions;

  function set(field: string, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function autoFillDescription() {
    if (!form.partNumber || !form.supplier || form.description) return;
    setAutoFilling(true);
    try {
      const params = new URLSearchParams({ supplier: form.supplier, partNumber: form.partNumber });
      const res = await fetch(`/api/parts-ordering/search?${params}`);
      if (!res.ok) return;
      const data = await res.json();
      const results = data.results ?? [];
      if (results.length >= 1 && results[0].description) {
        setForm((f) => ({ ...f, description: results[0].description }));
      }
    } finally {
      setAutoFilling(false);
    }
  }

  async function generateSopNumber() {
    setGeneratingSop(true);
    try {
      const res = await fetch("/api/special-orders/generate-sop-number");
      const data = await res.json();
      if (data.sopNumber) setForm((f) => ({ ...f, vendorPO: data.sopNumber }));
    } finally {
      setGeneratingSop(false);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.partNumber || !form.description || !form.supplier || !form.customerName) return;
    setSaving(true);
    const res = await fetch("/api/special-orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        partNumber: form.partNumber,
        description: form.description,
        supplier: form.supplier,
        quantity: parseFloat(form.quantity) || 1,
        customerName: form.customerName,
        customerPhone: form.customerPhone || null,
        depositCollected: parseFloat(form.depositCollected) || 0,
        vendorPO: form.vendorPO || null,
        supplierEta: form.supplierEta ? new Date(form.supplierEta).toISOString() : null,
        notes: form.notes || null,
        repairOrderId: selectedRoId || null,
      }),
    });
    setSaving(false);
    if (res.ok) onSaved();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-background border border-border rounded-xl w-full max-w-lg shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border sticky top-0 bg-background z-10">
          <h2 className="font-semibold text-foreground">New Special Order</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>
        <form onSubmit={submit} className="p-5 space-y-4">
          {/* Link to RO */}
          <div className="space-y-1.5">
            <Label>Link to Repair Order (optional)</Label>
            <div className="relative">
              <Input
                placeholder="Search by RO# or customer name…"
                value={selectedRo ? `${selectedRo.roNumber ?? selectedRo.id.slice(-6)} — ${selectedRo.customerName ?? "No customer"}` : roSearch}
                onChange={(e) => {
                  setRoSearch(e.target.value);
                  setSelectedRoId("");
                  setShowRoDropdown(true);
                }}
                onFocus={() => setShowRoDropdown(true)}
                onBlur={() => setTimeout(() => setShowRoDropdown(false), 150)}
              />
              {showRoDropdown && (
                <div className="absolute z-10 w-full mt-1 bg-background border border-border rounded-lg shadow-lg max-h-40 overflow-y-auto">
                  <button
                    type="button"
                    className="w-full text-left px-3 py-2 text-sm text-muted-foreground hover:bg-surface-hover"
                    onClick={() => { setSelectedRoId(""); setRoSearch(""); setShowRoDropdown(false); }}
                  >
                    — No RO link —
                  </button>
                  {filteredRos.slice(0, 20).map((ro) => (
                    <button
                      key={ro.id}
                      type="button"
                      className="w-full text-left px-3 py-2 text-sm hover:bg-surface-hover"
                      onClick={() => { setSelectedRoId(ro.id); setRoSearch(""); setShowRoDropdown(false); }}
                    >
                      <span className="font-medium">{ro.roNumber ?? ro.id.slice(-6)}</span>
                      {ro.customerName && <span className="text-muted-foreground ml-2">— {ro.customerName}</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Part Number *</Label>
              <Input value={form.partNumber} onChange={(e) => set("partNumber", e.target.value)} onBlur={autoFillDescription} required />
            </div>
            <div className="space-y-1.5">
              <Label>Qty</Label>
              <Input type="number" min="1" value={form.quantity} onChange={(e) => set("quantity", e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>
              Description *
              {autoFilling && <span className="ml-1 text-xs text-primary animate-pulse">Looking up…</span>}
            </Label>
            <Input value={form.description} onChange={(e) => set("description", e.target.value)} placeholder={autoFilling ? "Looking up…" : ""} required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Supplier *</Label>
              <Input value={form.supplier} onChange={(e) => set("supplier", e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label>Vendor PO #</Label>
              <div className="flex gap-2">
                <Input value={form.vendorPO} onChange={(e) => set("vendorPO", e.target.value)} className="flex-1" />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={generateSopNumber}
                  disabled={generatingSop}
                  title="Generate SOP number"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${generatingSop ? "animate-spin" : ""}`} />
                </Button>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Customer Name *</Label>
              <Input value={form.customerName} onChange={(e) => set("customerName", e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label>Customer Phone</Label>
              <Input type="tel" value={form.customerPhone} onChange={(e) => set("customerPhone", e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Deposit Collected ($)</Label>
              <Input type="number" step="0.01" min="0" value={form.depositCollected} onChange={(e) => set("depositCollected", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Supplier ETA</Label>
              <Input type="date" value={form.supplierEta} onChange={(e) => set("supplierEta", e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Notes</Label>
            <Textarea value={form.notes} onChange={(e) => set("notes", e.target.value)} rows={2} />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? "Saving…" : "Create SOP"}</Button>
          </div>
        </form>
      </div>
    </div>
  );
}
