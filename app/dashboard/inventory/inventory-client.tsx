"use client";

import { useState, useMemo } from "react";
import {
  Package,
  Plus,
  Search,
  AlertTriangle,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Loader2,
  X,
  Pencil,
  Trash2,
  History,
  ArrowDownToLine,
  ArrowUpFromLine,
  RotateCcw,
  SlidersHorizontal,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// ─── Types ────────────────────────────────────────────────────────────────────

type InventoryItem = {
  id: string;
  partNumber: string;
  description: string;
  category: string;
  supplier: string | null;
  unitCost: number;
  unitPrice: number;
  quantityOnHand: number;
  reorderPoint: number;
  reorderQty: number;
  location: string | null;
};

type Movement = {
  id: string;
  type: string;
  quantity: number;
  previousQty: number;
  newQty: number;
  reason: string | null;
  referenceId: string | null;
  createdAt: string;
  performedBy: { name: string | null; employeeId: string | null };
};

type Props = {
  initialItems: InventoryItem[];
  canEdit: boolean;
  canDelete: boolean;
  userId: string;
};

// ─── Constants ────────────────────────────────────────────────────────────────

const CATEGORIES = ["All", "Filters", "Fluids", "Brakes", "Batteries", "Belts", "Ignition", "Wipers", "Other"] as const;
const PART_CATEGORIES = CATEGORIES.filter((c) => c !== "All");
const SUPPLIERS = ["NAPA", "AutoZone", "O'Reilly", "Advance", "Rock Auto", "OEM", "Other"];

const MOVEMENT_TYPE_CONFIG = {
  receive:  { label: "Receive Stock",   icon: ArrowDownToLine, delta: +1, color: "text-green-600" },
  use:      { label: "Use / Consume",   icon: ArrowUpFromLine, delta: -1, color: "text-red-600"   },
  adjust:   { label: "Manual Adjust",   icon: SlidersHorizontal, delta: +1, color: "text-blue-600" },
  return:   { label: "Return to Stock", icon: RotateCcw,       delta: +1, color: "text-amber-600" },
} as const;

// ─── Stock level helpers ──────────────────────────────────────────────────────

function stockStatus(item: InventoryItem): "out" | "low" | "ok" {
  if (item.quantityOnHand <= 0) return "out";
  if (item.quantityOnHand <= item.reorderPoint) return "low";
  return "ok";
}

function StockBadge({ item }: { item: InventoryItem }) {
  const status = stockStatus(item);
  if (status === "out") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300">
        <AlertCircle className="h-3 w-3" /> Out of stock
      </span>
    );
  }
  if (status === "low") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-yellow-100 dark:bg-yellow-900/40 text-yellow-700 dark:text-yellow-300">
        <AlertTriangle className="h-3 w-3" /> {item.quantityOnHand} left
      </span>
    );
  }
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300">
      {item.quantityOnHand}
    </span>
  );
}

function fmt(n: number) { return `$${n.toFixed(2)}`; }

// ─── Add / Edit Part Dialog ───────────────────────────────────────────────────

type PartFormDialogProps = {
  open: boolean;
  onClose: () => void;
  onSaved: (item: InventoryItem) => void;
  editing?: InventoryItem | null;
};

function PartFormDialog({ open, onClose, onSaved, editing }: PartFormDialogProps) {
  const isEdit = !!editing;
  const [form, setForm] = useState({
    partNumber: editing?.partNumber ?? "",
    description: editing?.description ?? "",
    category: editing?.category ?? "Other",
    supplier: editing?.supplier ?? "",
    unitCost: editing?.unitCost ?? 0,
    unitPrice: editing?.unitPrice ?? 0,
    quantityOnHand: editing?.quantityOnHand ?? 0,
    reorderPoint: editing?.reorderPoint ?? 5,
    reorderQty: editing?.reorderQty ?? 10,
    location: editing?.location ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function reset() {
    setForm({ partNumber: "", description: "", category: "Other", supplier: "", unitCost: 0, unitPrice: 0, quantityOnHand: 0, reorderPoint: 5, reorderQty: 10, location: "" });
    setError("");
  }

  async function handleSubmit() {
    if (!form.partNumber.trim()) { setError("Part number is required"); return; }
    if (!form.description.trim()) { setError("Description is required"); return; }
    setSaving(true);
    setError("");
    try {
      const url = isEdit ? `/api/inventory/${editing!.id}` : "/api/inventory";
      const method = isEdit ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          supplier: form.supplier || null,
          location: form.location || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Failed to save"); return; }
      onSaved(data.item);
      reset();
      onClose();
    } catch {
      setError("Network error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) { reset(); onClose(); } }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Part" : "Add Part to Inventory"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2 max-h-[70vh] overflow-y-auto pr-1">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Part Number <span className="text-red-500">*</span></Label>
              <Input placeholder="e.g. 85-7878" value={form.partNumber} onChange={(e) => setForm((p) => ({ ...p, partNumber: e.target.value }))} disabled={isEdit} />
            </div>
            <div className="space-y-1.5">
              <Label>Category</Label>
              <Select value={form.category} onValueChange={(v) => setForm((p) => ({ ...p, category: v ?? p.category }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PART_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Description <span className="text-red-500">*</span></Label>
            <Input placeholder="e.g. Motorcraft Oil Filter" value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Supplier</Label>
              <Select value={form.supplier || ""} onValueChange={(v) => setForm((p) => ({ ...p, supplier: v ?? "" }))}>
                <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">None</SelectItem>
                  {SUPPLIERS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Bin / Location</Label>
              <Input placeholder="e.g. A3-12" value={form.location} onChange={(e) => setForm((p) => ({ ...p, location: e.target.value }))} />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label>Your Cost ($)</Label>
              <Input type="number" min={0} step={0.01} value={form.unitCost} onChange={(e) => setForm((p) => ({ ...p, unitCost: parseFloat(e.target.value) || 0 }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Sell Price ($)</Label>
              <Input type="number" min={0} step={0.01} value={form.unitPrice} onChange={(e) => setForm((p) => ({ ...p, unitPrice: parseFloat(e.target.value) || 0 }))} />
            </div>
            <div className="space-y-1.5">
              <Label>On Hand</Label>
              <Input type="number" min={0} step={1} value={form.quantityOnHand} onChange={(e) => setForm((p) => ({ ...p, quantityOnHand: parseFloat(e.target.value) || 0 }))} disabled={isEdit} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Reorder Point</Label>
              <Input type="number" min={0} step={1} value={form.reorderPoint} onChange={(e) => setForm((p) => ({ ...p, reorderPoint: parseFloat(e.target.value) || 0 }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Reorder Qty</Label>
              <Input type="number" min={0} step={1} value={form.reorderQty} onChange={(e) => setForm((p) => ({ ...p, reorderQty: parseFloat(e.target.value) || 0 }))} />
            </div>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => { reset(); onClose(); }}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            {isEdit ? "Save Changes" : "Add Part"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Adjust Stock Dialog ──────────────────────────────────────────────────────

type AdjustDialogProps = {
  item: InventoryItem | null;
  onClose: () => void;
  onAdjusted: (updated: InventoryItem) => void;
};

function AdjustDialog({ item, onClose, onAdjusted }: AdjustDialogProps) {
  const [movementType, setMovementType] = useState<"receive" | "use" | "adjust" | "return">("receive");
  const [qty, setQty] = useState("1");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [movements, setMovements] = useState<Movement[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  async function loadHistory() {
    if (!item) return;
    setLoadingHistory(true);
    try {
      const res = await fetch(`/api/inventory/${item.id}`);
      if (res.ok) {
        const data = await res.json();
        setMovements(data.item.movements ?? []);
      }
    } finally {
      setLoadingHistory(false);
      setShowHistory(true);
    }
  }

  async function handleAdjust() {
    if (!item) return;
    const quantity = parseFloat(qty);
    if (isNaN(quantity) || quantity <= 0) { setError("Quantity must be greater than 0"); return; }
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/inventory/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "adjust", type: movementType, quantity, reason: reason || undefined }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Failed to adjust"); return; }
      onAdjusted(data.item);
      onClose();
    } catch {
      setError("Network error");
    } finally {
      setSaving(false);
    }
  }

  const config = MOVEMENT_TYPE_CONFIG[movementType];
  const delta = config.delta * (parseFloat(qty) || 0);
  const preview = item ? Math.max(0, item.quantityOnHand + delta) : 0;

  return (
    <Dialog open={!!item} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Adjust Stock — {item?.description}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          {/* Movement type selector */}
          <div className="grid grid-cols-2 gap-2">
            {(Object.entries(MOVEMENT_TYPE_CONFIG) as [keyof typeof MOVEMENT_TYPE_CONFIG, typeof MOVEMENT_TYPE_CONFIG[keyof typeof MOVEMENT_TYPE_CONFIG]][]).map(([type, cfg]) => {
              const Icon = cfg.icon;
              return (
                <button
                  key={type}
                  type="button"
                  onClick={() => setMovementType(type)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${
                    movementType === type
                      ? "border-primary bg-primary/10 text-foreground"
                      : "border-border bg-background text-muted-foreground hover:border-primary/50"
                  }`}
                >
                  <Icon className={`h-4 w-4 ${cfg.color}`} />
                  {cfg.label}
                </button>
              );
            })}
          </div>

          <div className="space-y-1.5">
            <Label>Quantity</Label>
            <Input
              type="number"
              min="0.01"
              step="1"
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              autoFocus
            />
          </div>

          <div className="space-y-1.5">
            <Label>Reason (optional)</Label>
            <Input
              placeholder="e.g. Weekly stock receive, RO-00042"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>

          {item && (
            <div className="px-3 py-2.5 bg-surface border border-border rounded-lg text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Current stock</span>
                <span className="font-mono font-semibold text-foreground">{item.quantityOnHand}</span>
              </div>
              <div className="flex justify-between mt-1">
                <span className="text-muted-foreground">After adjustment</span>
                <span className={`font-mono font-semibold ${preview <= 0 ? "text-red-600" : preview <= item.reorderPoint ? "text-yellow-600" : "text-green-600"}`}>
                  {preview}
                </span>
              </div>
            </div>
          )}

          {error && <p className="text-sm text-red-600">{error}</p>}

          {/* History toggle */}
          <button
            type="button"
            onClick={() => showHistory ? setShowHistory(false) : loadHistory()}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <History className="h-3.5 w-3.5" />
            {showHistory ? "Hide history" : "Show movement history"}
            {loadingHistory && <Loader2 className="h-3 w-3 animate-spin" />}
            {showHistory ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </button>

          {showHistory && movements.length > 0 && (
            <div className="border border-border rounded-lg overflow-hidden">
              <div className="divide-y divide-border/50 max-h-48 overflow-y-auto">
                {movements.map((m) => (
                  <div key={m.id} className="px-3 py-2 text-xs flex items-center gap-2">
                    <span className={`font-mono font-semibold ${m.quantity >= 0 ? "text-green-600" : "text-red-600"}`}>
                      {m.quantity >= 0 ? "+" : ""}{m.quantity}
                    </span>
                    <span className="text-muted-foreground capitalize">{m.type}</span>
                    {m.reason && <span className="text-muted-foreground truncate">— {m.reason}</span>}
                    <span className="ml-auto text-muted-foreground flex-shrink-0 font-mono">{m.previousQty} → {m.newQty}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {showHistory && movements.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-2">No movement history yet.</p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleAdjust} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Save Adjustment
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function InventoryClient({ initialItems, canEdit, canDelete }: Props) {
  const [items, setItems] = useState<InventoryItem[]>(initialItems);
  const [activeCategory, setActiveCategory] = useState<string>("All");
  const [search, setSearch] = useState("");
  const [showAddPart, setShowAddPart] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [adjustingItem, setAdjustingItem] = useState<InventoryItem | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [sortField, setSortField] = useState<"description" | "quantityOnHand" | "category">("description");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  // Filter + sort
  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return items
      .filter((item) => {
        const matchCat = activeCategory === "All" || item.category === activeCategory;
        const matchSearch = !q ||
          item.description.toLowerCase().includes(q) ||
          item.partNumber.toLowerCase().includes(q) ||
          (item.supplier ?? "").toLowerCase().includes(q);
        return matchCat && matchSearch;
      })
      .sort((a, b) => {
        let cmp = 0;
        if (sortField === "description") cmp = a.description.localeCompare(b.description);
        else if (sortField === "quantityOnHand") cmp = a.quantityOnHand - b.quantityOnHand;
        else if (sortField === "category") cmp = a.category.localeCompare(b.category);
        return sortDir === "asc" ? cmp : -cmp;
      });
  }, [items, activeCategory, search, sortField, sortDir]);

  const lowStockCount = items.filter((i) => stockStatus(i) !== "ok").length;

  function toggleSort(field: typeof sortField) {
    if (sortField === field) setSortDir((d) => d === "asc" ? "desc" : "asc");
    else { setSortField(field); setSortDir("asc"); }
  }

  function SortIcon({ field }: { field: typeof sortField }) {
    if (sortField !== field) return <ChevronDown className="h-3 w-3 opacity-30" />;
    return sortDir === "asc"
      ? <ChevronUp className="h-3 w-3 text-primary" />
      : <ChevronDown className="h-3 w-3 text-primary" />;
  }

  function handlePartSaved(item: InventoryItem) {
    setItems((prev) => {
      const idx = prev.findIndex((i) => i.id === item.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = item;
        return next;
      }
      return [...prev, item];
    });
  }

  function handleAdjusted(updated: InventoryItem) {
    setItems((prev) => prev.map((i) => i.id === updated.id ? { ...i, ...updated } : i));
  }

  async function handleDelete(id: string) {
    if (!confirm("Remove this part from inventory? This can be undone by an admin.")) return;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/inventory/${id}`, { method: "DELETE" });
      if (res.ok) setItems((prev) => prev.filter((i) => i.id !== id));
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="p-6 max-w-7xl space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Parts Inventory</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{items.length} part{items.length !== 1 ? "s" : ""} tracked</p>
        </div>
        {canEdit && (
          <Button onClick={() => setShowAddPart(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Part
          </Button>
        )}
      </div>

      {/* Low stock alert banner */}
      {lowStockCount > 0 && (
        <div className="flex items-center gap-2.5 px-4 py-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-lg text-amber-800 dark:text-amber-300 text-sm">
          <AlertTriangle className="h-4 w-4 flex-shrink-0" />
          <span>
            <strong>{lowStockCount}</strong> part{lowStockCount !== 1 ? "s" : ""} at or below reorder point
          </span>
          <button
            onClick={() => { setActiveCategory("All"); setSearch(""); }}
            className="ml-auto text-xs underline underline-offset-2 hover:no-underline"
          >
            View all
          </button>
        </div>
      )}

      {/* Category tabs + search row */}
      <div className="flex flex-col sm:flex-row gap-3">
        {/* Category pills */}
        <div className="flex flex-wrap gap-1.5">
          {CATEGORIES.map((cat) => {
            const count = cat === "All" ? items.length : items.filter((i) => i.category === cat).length;
            return (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors flex items-center gap-1.5 ${
                  activeCategory === cat
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-background text-muted-foreground border-border hover:border-primary/50 hover:text-foreground"
                }`}
              >
                {cat}
                <span className={`text-xs rounded-full px-1.5 py-0 font-mono ${activeCategory === cat ? "bg-primary-foreground/20 text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Search */}
        <div className="relative sm:ml-auto sm:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Search parts…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 pr-8"
          />
          {search && (
            <button onClick={() => setSearch("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Empty state */}
      {filtered.length === 0 && (
        <div className="flex flex-col items-center justify-center py-24 text-center text-muted-foreground border-2 border-dashed border-border rounded-lg">
          <Package className="h-12 w-12 mb-4 opacity-30" />
          {items.length === 0 ? (
            <>
              <p className="text-lg font-medium">No parts in inventory yet</p>
              <p className="text-sm mt-1">Add your first part to get started tracking stock.</p>
              {canEdit && (
                <Button onClick={() => setShowAddPart(true)} className="mt-6">
                  <Plus className="h-4 w-4 mr-2" /> Add First Part
                </Button>
              )}
            </>
          ) : (
            <p className="text-sm">No parts match your filters.</p>
          )}
        </div>
      )}

      {/* Inventory table */}
      {filtered.length > 0 && (
        <div className="border border-border rounded-lg overflow-hidden">
          {/* Desktop table */}
          <table className="w-full text-sm hidden md:table">
            <thead className="bg-surface border-b border-border">
              <tr>
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wide">
                  <button onClick={() => toggleSort("description")} className="flex items-center gap-1 hover:text-foreground">
                    Part <SortIcon field="description" />
                  </button>
                </th>
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wide">
                  <button onClick={() => toggleSort("category")} className="flex items-center gap-1 hover:text-foreground">
                    Category <SortIcon field="category" />
                  </button>
                </th>
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wide hidden lg:table-cell">Supplier</th>
                <th className="text-right px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wide">Cost</th>
                <th className="text-right px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wide">Price</th>
                <th className="text-right px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wide">
                  <button onClick={() => toggleSort("quantityOnHand")} className="flex items-center gap-1 ml-auto hover:text-foreground">
                    On Hand <SortIcon field="quantityOnHand" />
                  </button>
                </th>
                <th className="text-right px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wide hidden lg:table-cell">Reorder</th>
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wide hidden lg:table-cell">Location</th>
                <th className="w-24" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {filtered.map((item) => (
                <tr key={item.id} className="hover:bg-surface-hover transition-colors">
                  <td className="px-4 py-3">
                    <div className="font-medium text-foreground">{item.description}</div>
                    <div className="text-xs text-muted-foreground font-mono">#{item.partNumber}</div>
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant="outline" className="text-xs">{item.category}</Badge>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground hidden lg:table-cell">{item.supplier ?? "—"}</td>
                  <td className="px-4 py-3 text-right text-muted-foreground font-mono">{fmt(item.unitCost)}</td>
                  <td className="px-4 py-3 text-right font-mono font-medium text-foreground">{fmt(item.unitPrice)}</td>
                  <td className="px-4 py-3 text-right">
                    <StockBadge item={item} />
                  </td>
                  <td className="px-4 py-3 text-right text-muted-foreground text-xs hidden lg:table-cell">{item.reorderPoint}</td>
                  <td className="px-4 py-3 text-muted-foreground text-xs hidden lg:table-cell">{item.location ?? "—"}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => setAdjustingItem(item)}
                        className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-surface rounded"
                        title="Adjust stock"
                      >
                        <SlidersHorizontal className="h-3.5 w-3.5" />
                      </button>
                      {canEdit && (
                        <button
                          onClick={() => setEditingItem(item)}
                          className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-surface rounded"
                          title="Edit"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                      )}
                      {canDelete && (
                        <button
                          onClick={() => handleDelete(item.id)}
                          disabled={deletingId === item.id}
                          className="p-1.5 text-muted-foreground hover:text-red-600 hover:bg-surface rounded"
                          title="Remove"
                        >
                          {deletingId === item.id
                            ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            : <Trash2 className="h-3.5 w-3.5" />
                          }
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Mobile card layout */}
          <div className="md:hidden divide-y divide-border/50">
            {filtered.map((item) => (
              <div key={item.id} className="px-4 py-3 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-medium text-foreground">{item.description}</div>
                    <div className="text-xs text-muted-foreground font-mono">#{item.partNumber}</div>
                  </div>
                  <StockBadge item={item} />
                </div>
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <Badge variant="outline" className="text-xs">{item.category}</Badge>
                  {item.supplier && <span>{item.supplier}</span>}
                  {item.location && <span>📍 {item.location}</span>}
                  <span className="ml-auto font-mono font-medium text-foreground">{fmt(item.unitPrice)}</span>
                </div>
                <div className="flex items-center gap-2 pt-1">
                  <button
                    onClick={() => setAdjustingItem(item)}
                    className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground border border-border rounded px-2 py-1"
                  >
                    <SlidersHorizontal className="h-3 w-3" /> Adjust
                  </button>
                  {canEdit && (
                    <button
                      onClick={() => setEditingItem(item)}
                      className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground border border-border rounded px-2 py-1"
                    >
                      <Pencil className="h-3 w-3" /> Edit
                    </button>
                  )}
                  {canDelete && (
                    <button
                      onClick={() => handleDelete(item.id)}
                      disabled={deletingId === item.id}
                      className="flex items-center gap-1 text-xs text-muted-foreground hover:text-red-600 border border-border rounded px-2 py-1"
                    >
                      {deletingId === item.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                      Remove
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Dialogs */}
      <PartFormDialog
        open={showAddPart}
        onClose={() => setShowAddPart(false)}
        onSaved={handlePartSaved}
      />
      <PartFormDialog
        open={!!editingItem}
        onClose={() => setEditingItem(null)}
        onSaved={(item) => { handlePartSaved(item); setEditingItem(null); }}
        editing={editingItem}
      />
      <AdjustDialog
        item={adjustingItem}
        onClose={() => setAdjustingItem(null)}
        onAdjusted={handleAdjusted}
      />
    </div>
  );
}
