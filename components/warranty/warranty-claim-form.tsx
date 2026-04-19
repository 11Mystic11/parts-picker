// [FEATURE: warranty_claims]
// Form to create a new warranty claim, linked to an RO.
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

export function WarrantyClaimForm({ onClose, onSaved }: Props) {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    repairOrderId: "",
    claimNumber: "",
    failureDescription: "",
    oemLaborCode: "",
    expectedReimbursement: "",
  });

  function set(field: string, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.repairOrderId || !form.failureDescription) return;
    setSaving(true);
    const res = await fetch("/api/warranty", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        repairOrderId: form.repairOrderId,
        claimNumber: form.claimNumber || null,
        failureDescription: form.failureDescription,
        oemLaborCode: form.oemLaborCode || null,
        expectedReimbursement: parseFloat(form.expectedReimbursement) || 0,
      }),
    });
    setSaving(false);
    if (res.ok) onSaved();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-background border border-border rounded-xl w-full max-w-lg shadow-xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="font-semibold text-foreground">New Warranty Claim</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>
        <form onSubmit={submit} className="p-5 space-y-4">
          <div className="space-y-1.5">
            <Label>Repair Order ID *</Label>
            <Input
              placeholder="Paste RO ID from the RO detail page"
              value={form.repairOrderId}
              onChange={(e) => set("repairOrderId", e.target.value)}
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>OEM Claim Number</Label>
              <Input value={form.claimNumber} onChange={(e) => set("claimNumber", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>OEM Labor Code</Label>
              <Input value={form.oemLaborCode} onChange={(e) => set("oemLaborCode", e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Failure Description *</Label>
            <Textarea
              value={form.failureDescription}
              onChange={(e) => set("failureDescription", e.target.value)}
              rows={3}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label>Expected Reimbursement ($)</Label>
            <Input
              type="number"
              step="0.01"
              min="0"
              value={form.expectedReimbursement}
              onChange={(e) => set("expectedReimbursement", e.target.value)}
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? "Saving…" : "Create Claim"}</Button>
          </div>
        </form>
      </div>
    </div>
  );
}
