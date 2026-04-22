// [FEATURE: purchase_orders]
// Create a new Purchase Order with line items, RO linking, and vendor PO# generation.
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Trash2, RefreshCw, Search } from "lucide-react";

interface POLine {
  partNumber: string;
  description: string;
  qtyOrdered: string;
  unitCost: string;
  autoFilling?: boolean;
}

interface ROOption {
  id: string;
  roNumber: string | null;
  customerName: string | null;
  customerPhone: string | null;
  status: string;
}

const EMPTY_LINE: POLine = { partNumber: "", description: "", qtyOrdered: "1", unitCost: "" };

export default function NewPurchaseOrderPage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [supplier, setSupplier] = useState("");
  const [vendorPoNumber, setVendorPoNumber] = useState("");
  const [generatingPo, setGeneratingPo] = useState(false);
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<POLine[]>([{ ...EMPTY_LINE }]);
  const [roOptions, setRoOptions] = useState<ROOption[]>([]);
  const [selectedRoId, setSelectedRoId] = useState<string>("");
  const [roSearch, setRoSearch] = useState("");
  const [showRoDropdown, setShowRoDropdown] = useState(false);

  // Load open ROs for the selector
  useEffect(() => {
    fetch("/api/ro?limit=100")
      .then((r) => r.json())
      .then((d) => setRoOptions(d.ros ?? []))
      .catch(() => {});
  }, []);

  const selectedRo = roOptions.find((r) => r.id === selectedRoId) ?? null;

  const filteredRos = roSearch
    ? roOptions.filter((r) =>
        (r.roNumber ?? "").toLowerCase().includes(roSearch.toLowerCase()) ||
        (r.customerName ?? "").toLowerCase().includes(roSearch.toLowerCase())
      )
    : roOptions;

  function updateLine(index: number, field: keyof POLine, value: string) {
    setLines((prev) => prev.map((l, i) => i === index ? { ...l, [field]: value } : l));
  }

  function addLine() {
    setLines((prev) => [...prev, { ...EMPTY_LINE }]);
  }

  function removeLine(index: number) {
    setLines((prev) => prev.filter((_, i) => i !== index));
  }

  async function autoFillDescription(index: number) {
    const line = lines[index];
    if (!line.partNumber || line.description) return;
    setLines((prev) => prev.map((l, i) => i === index ? { ...l, autoFilling: true } : l));
    try {
      const params = new URLSearchParams({ partNumber: line.partNumber });
      if (supplier) params.set("supplier", supplier);
      const res = await fetch(`/api/parts-ordering/search?${params}`);
      if (!res.ok) return;
      const data = await res.json();
      const results = data.results ?? [];
      if (results.length >= 1 && results[0].description) {
        setLines((prev) => prev.map((l, i) =>
          i === index ? { ...l, description: results[0].description, unitCost: l.unitCost || String(results[0].unitCost ?? ""), autoFilling: false } : l
        ));
      }
    } finally {
      setLines((prev) => prev.map((l, i) => i === index ? { ...l, autoFilling: false } : l));
    }
  }

  async function generatePoNumber() {
    setGeneratingPo(true);
    try {
      const res = await fetch("/api/purchase-orders/generate-po-number");
      const data = await res.json();
      if (data.poNumber) setVendorPoNumber(data.poNumber);
    } finally {
      setGeneratingPo(false);
    }
  }

  const total = lines.reduce((sum, l) => {
    return sum + (parseInt(l.qtyOrdered, 10) || 0) * (parseFloat(l.unitCost) || 0);
  }, 0);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!supplier) { setError("Supplier is required."); return; }
    const badLine = lines.findIndex((l) => !l.partNumber || !l.description || !l.unitCost);
    if (badLine !== -1) {
      setError(`Line ${badLine + 1}: Part #, description, and unit cost are all required.`);
      return;
    }
    setSaving(true);

    const res = await fetch("/api/purchase-orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        supplier,
        notes: notes || null,
        vendorPoNumber: vendorPoNumber || null,
        repairOrderId: selectedRoId || null,
        lines: lines.map((l) => ({
          partNumber: l.partNumber,
          description: l.description,
          qtyOrdered: parseInt(l.qtyOrdered, 10) || 1,
          unitCost: parseFloat(l.unitCost) || 0,
        })),
      }),
    });

    setSaving(false);
    if (res.ok) {
      router.push("/dashboard/inventory/purchase-orders");
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Failed to create PO — please try again.");
    }
  }

  return (
    <div className="p-6 max-w-3xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">New Purchase Order</h1>
        <p className="text-sm text-muted-foreground mt-1">Create a parts order to a supplier</p>
      </div>

      <form onSubmit={submit} className="space-y-6">
        {/* Supplier + Vendor PO# */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>Supplier *</Label>
            <Input value={supplier} onChange={(e) => setSupplier(e.target.value)} required />
          </div>
          <div className="space-y-1.5">
            <Label>Vendor PO #</Label>
            <div className="flex gap-2">
              <Input
                value={vendorPoNumber}
                onChange={(e) => setVendorPoNumber(e.target.value)}
                placeholder="Auto-generate or enter manually"
                className="flex-1"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={generatePoNumber}
                disabled={generatingPo}
                title="Generate PO number"
              >
                <RefreshCw className={`h-4 w-4 ${generatingPo ? "animate-spin" : ""}`} />
              </Button>
            </div>
          </div>
        </div>

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
            {showRoDropdown && filteredRos.length > 0 && (
              <div className="absolute z-10 w-full mt-1 bg-background border border-border rounded-lg shadow-lg max-h-48 overflow-y-auto">
                <button
                  type="button"
                  className="w-full text-left px-3 py-2 text-sm text-muted-foreground hover:bg-surface-hover"
                  onClick={() => { setSelectedRoId(""); setRoSearch(""); setShowRoDropdown(false); }}
                >
                  — No RO link —
                </button>
                {filteredRos.slice(0, 30).map((ro) => (
                  <button
                    key={ro.id}
                    type="button"
                    className="w-full text-left px-3 py-2 text-sm hover:bg-surface-hover"
                    onClick={() => { setSelectedRoId(ro.id); setRoSearch(""); setShowRoDropdown(false); }}
                  >
                    <span className="font-medium">{ro.roNumber ?? ro.id.slice(-6)}</span>
                    {ro.customerName && <span className="text-muted-foreground ml-2">— {ro.customerName}</span>}
                    <span className={`ml-2 text-xs px-1.5 py-0.5 rounded ${ro.status === "closed" ? "bg-surface text-muted-foreground" : "bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300"}`}>
                      {ro.status}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Customer info from linked RO */}
          {selectedRo && (selectedRo.customerName || selectedRo.customerPhone) && (
            <div className="flex gap-4 text-sm p-3 bg-surface border border-border rounded-lg mt-2">
              <span className="text-muted-foreground">Customer:</span>
              <span className="font-medium text-foreground">{selectedRo.customerName}</span>
              {selectedRo.customerPhone && (
                <span className="text-muted-foreground">{selectedRo.customerPhone}</span>
              )}
            </div>
          )}
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
                <div className="col-span-3 flex gap-0.5">
                  <Input
                    className="h-7 text-xs flex-1"
                    value={line.partNumber}
                    onChange={(e) => updateLine(i, "partNumber", e.target.value)}
                    required
                  />
                  <button
                    type="button"
                    className="h-7 w-7 flex items-center justify-center rounded border border-border hover:bg-surface-hover flex-shrink-0 disabled:opacity-40"
                    onClick={() => autoFillDescription(i)}
                    disabled={line.autoFilling || !line.partNumber}
                    title="Look up part"
                  >
                    {line.autoFilling ? <RefreshCw className="h-3 w-3 animate-spin" /> : <Search className="h-3 w-3" />}
                  </button>
                </div>
                <div className="col-span-4">
                  <Input
                    className="h-7 text-xs"
                    value={line.description}
                    onChange={(e) => updateLine(i, "description", e.target.value)}
                    placeholder={line.autoFilling ? "Looking up…" : ""}
                    required
                  />
                </div>
                <div className="col-span-2">
                  <Input
                    className="h-7 text-xs text-right"
                    type="number"
                    min="1"
                    step="1"
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

        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
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
