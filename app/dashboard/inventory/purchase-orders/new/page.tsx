// [FEATURE: purchase_orders]
// Create a new Purchase Order with line items.
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Trash2 } from "lucide-react";

interface POLine {
  partNumber: string;
  description: string;
  qtyOrdered: string;
  unitCost: string;
}

const EMPTY_LINE: POLine = { partNumber: "", description: "", qtyOrdered: "1", unitCost: "" };

export default function NewPurchaseOrderPage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [supplier, setSupplier] = useState("");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<POLine[]>([{ ...EMPTY_LINE }]);

  function updateLine(index: number, field: keyof POLine, value: string) {
    setLines((prev) => prev.map((l, i) => i === index ? { ...l, [field]: value } : l));
  }

  function addLine() {
    setLines((prev) => [...prev, { ...EMPTY_LINE }]);
  }

  function removeLine(index: number) {
    setLines((prev) => prev.filter((_, i) => i !== index));
  }

  const total = lines.reduce((sum, l) => {
    return sum + (parseFloat(l.qtyOrdered) || 0) * (parseFloat(l.unitCost) || 0);
  }, 0);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!supplier || lines.some((l) => !l.partNumber || !l.description || !l.unitCost)) return;
    setSaving(true);

    const res = await fetch("/api/purchase-orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        supplier,
        notes: notes || null,
        lines: lines.map((l) => ({
          partNumber: l.partNumber,
          description: l.description,
          qtyOrdered: parseFloat(l.qtyOrdered) || 1,
          unitCost: parseFloat(l.unitCost) || 0,
        })),
      }),
    });

    setSaving(false);
    if (res.ok) {
      router.push("/dashboard/inventory/purchase-orders");
    }
  }

  return (
    <div className="p-6 max-w-3xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">New Purchase Order</h1>
        <p className="text-sm text-muted-foreground mt-1">Create a parts order to a supplier</p>
      </div>

      <form onSubmit={submit} className="space-y-6">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5 col-span-2 sm:col-span-1">
            <Label>Supplier *</Label>
            <Input value={supplier} onChange={(e) => setSupplier(e.target.value)} required />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label>Notes</Label>
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
        </div>

        {/* Line items */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label>Line Items</Label>
            <Button type="button" size="sm" variant="outline" onClick={addLine}>
              <Plus className="h-3.5 w-3.5 mr-1" /> Add Line
            </Button>
          </div>

          <div className="border border-border rounded-lg overflow-hidden">
            <div className="grid grid-cols-12 gap-0 bg-surface px-3 py-2 text-xs font-semibold text-muted-foreground border-b border-border">
              <span className="col-span-3">Part #</span>
              <span className="col-span-4">Description</span>
              <span className="col-span-2 text-right">Qty</span>
              <span className="col-span-2 text-right">Unit Cost</span>
              <span className="col-span-1" />
            </div>
            {lines.map((line, i) => (
              <div key={i} className="grid grid-cols-12 gap-1 px-3 py-2 border-b border-border last:border-b-0 items-center">
                <div className="col-span-3">
                  <Input
                    className="h-7 text-xs"
                    value={line.partNumber}
                    onChange={(e) => updateLine(i, "partNumber", e.target.value)}
                    required
                  />
                </div>
                <div className="col-span-4">
                  <Input
                    className="h-7 text-xs"
                    value={line.description}
                    onChange={(e) => updateLine(i, "description", e.target.value)}
                    required
                  />
                </div>
                <div className="col-span-2">
                  <Input
                    className="h-7 text-xs text-right"
                    type="number"
                    min="0.1"
                    step="0.1"
                    value={line.qtyOrdered}
                    onChange={(e) => updateLine(i, "qtyOrdered", e.target.value)}
                    required
                  />
                </div>
                <div className="col-span-2">
                  <Input
                    className="h-7 text-xs text-right"
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    value={line.unitCost}
                    onChange={(e) => updateLine(i, "unitCost", e.target.value)}
                    required
                  />
                </div>
                <div className="col-span-1 flex justify-end">
                  {lines.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeLine(i)}
                      className="text-muted-foreground hover:text-red-500 transition-colors"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
            ))}
            <div className="px-3 py-2 bg-surface text-right text-sm font-semibold text-foreground">
              Total: ${total.toFixed(2)}
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => router.push("/dashboard/inventory/purchase-orders")}>
            Cancel
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? "Creating…" : "Create PO"}
          </Button>
        </div>
      </form>
    </div>
  );
}
