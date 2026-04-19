// [FEATURE: special_orders]
// SOP creation form — creates a new Special Order Part record.
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { X } from "lucide-react";

interface Props {
  onClose: () => void;
  onSaved: () => void;
}

export function SOPForm({ onClose, onSaved }: Props) {
  const [saving, setSaving] = useState(false);
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

  function set(field: string, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
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
      }),
    });
    setSaving(false);
    if (res.ok) onSaved();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-background border border-border rounded-xl w-full max-w-lg shadow-xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="font-semibold text-foreground">New Special Order</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>
        <form onSubmit={submit} className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Part Number *</Label>
              <Input value={form.partNumber} onChange={(e) => set("partNumber", e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label>Qty</Label>
              <Input type="number" min="1" value={form.quantity} onChange={(e) => set("quantity", e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Description *</Label>
            <Input value={form.description} onChange={(e) => set("description", e.target.value)} required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Supplier *</Label>
              <Input value={form.supplier} onChange={(e) => set("supplier", e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label>Vendor PO</Label>
              <Input value={form.vendorPO} onChange={(e) => set("vendorPO", e.target.value)} />
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
