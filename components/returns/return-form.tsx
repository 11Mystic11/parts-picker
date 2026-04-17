// [FEATURE: core_return_tracking]
// ReturnForm — create/edit dialog for part returns.
// Can be pre-filled with data from a line item (opened from RO detail).
// Remove this file to disable.

"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { X, RotateCcw } from "lucide-react";

interface ReturnFormProps {
  roId?: string;
  lineItemId?: string;
  prefill?: {
    partNumber?: string;
    description?: string;
    supplier?: string;
    quantity?: number;
  };
  onClose: () => void;
  onSaved: () => void;
}

export function ReturnForm({ roId, lineItemId, prefill, onClose, onSaved }: ReturnFormProps) {
  const [partNumber, setPartNumber] = useState(prefill?.partNumber ?? "");
  const [description, setDescription] = useState(prefill?.description ?? "");
  const [supplier, setSupplier] = useState(prefill?.supplier ?? "");
  const [returnType, setReturnType] = useState<"core" | "warranty">("core");
  const [quantity, setQuantity] = useState(prefill?.quantity ?? 1);
  const [expectedCredit, setExpectedCredit] = useState(0);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    const res = await fetch("/api/part-returns", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        repairOrderId: roId ?? null,
        lineItemId: lineItemId ?? null,
        partNumber,
        description,
        supplier,
        returnType,
        quantity,
        expectedCredit,
        notes: notes || null,
      }),
    });
    setSaving(false);
    if (res.ok) {
      onSaved();
    } else {
      const { error: msg } = await res.json().catch(() => ({ error: "Save failed" }));
      setError(msg ?? "Save failed");
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl w-full max-w-md border border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-800">
          <div className="flex items-center gap-2">
            <RotateCcw className="h-5 w-5 text-primary" />
            <span className="font-semibold text-gray-900 dark:text-white">Log Part Return</span>
          </div>
          <button onClick={onClose}><X className="h-5 w-5 text-gray-400" /></button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && (
            <div className="text-sm text-red-600 bg-red-50 dark:bg-red-950/40 rounded-lg px-3 py-2">{error}</div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Part Number *</label>
              <input
                required
                value={partNumber}
                onChange={(e) => setPartNumber(e.target.value)}
                className="w-full border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Supplier *</label>
              <input
                required
                value={supplier}
                onChange={(e) => setSupplier(e.target.value)}
                placeholder="NAPA, AutoZone…"
                className="w-full border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-1">Description *</label>
            <input
              required
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Return Type *</label>
              <select
                value={returnType}
                onChange={(e) => setReturnType(e.target.value as "core" | "warranty")}
                className="w-full border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="core">Core</option>
                <option value="warranty">Warranty</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Qty</label>
              <input
                type="number"
                min={0.01}
                step={0.01}
                value={quantity}
                onChange={(e) => setQuantity(parseFloat(e.target.value) || 1)}
                className="w-full border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Expected Credit ($)</label>
              <input
                type="number"
                min={0}
                step={0.01}
                value={expectedCredit}
                onChange={(e) => setExpectedCredit(parseFloat(e.target.value) || 0)}
                className="w-full border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-1">Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="w-full border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary resize-none"
            />
          </div>

          <div className="flex gap-2 pt-1">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1">Cancel</Button>
            <Button type="submit" disabled={saving} className="flex-1">
              {saving ? "Saving…" : "Log Return"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
