"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  FileText,
  Loader2,
  CheckCircle,
  CheckCircle2,
  Pencil,
  X,
  Check,
  Package,
  Wrench,
  RefreshCw,
  AlertCircle,
  Clock,
  Plus,
  MessageSquare,
  ClipboardList,
  Trash2,
  Send,
  // [FEATURE: customer_approval_portal] START
  Share2,
  // [FEATURE: customer_approval_portal] END
  // [FEATURE: inventory_ro_integration] START
  AlertTriangle,
  // [FEATURE: inventory_ro_integration] END
  // [FEATURE: tech_time_clock] START
  Timer,
  // [FEATURE: tech_time_clock] END
  // [FEATURE: core_return_tracking] START
  RotateCcw,
  // [FEATURE: core_return_tracking] END
} from "lucide-react";
// [FEATURE: customer_approval_portal] START
import { ApprovalSendDialog } from "@/components/ro/approval-send-dialog";
// [FEATURE: customer_approval_portal] END
// [FEATURE: parts_ordering] START
import { PartsOrderPanel } from "@/components/parts-ordering/parts-order-panel";
// [FEATURE: parts_ordering] END
// [FEATURE: core_return_tracking] START
import { ReturnForm } from "@/components/returns/return-form";
// [FEATURE: core_return_tracking] END

// ─── Types ─────────────────────────────────────────────────────────────────────

type LineItem = {
  id: string;
  type: string;
  source: string;
  description: string;
  quantity: number;
  unitCost: number;
  unitPrice: number;
  totalPrice: number;
  partNumber: string | null;
  laborOpCode: string | null;
  supplier: string | null;
  isAccepted: boolean;
};

type ROMessage = {
  id: string;
  content: string;
  category: string;
  createdAt: string;
  author: {
    id: string;
    name: string | null;
    role: string;
    employeeId: string | null;
  };
};

type RODetailClientProps = {
  roId: string;
  status: string;
  lineItems: LineItem[];
  partsSubtotal: number;
  laborSubtotal: number;
  shopSupplyFee: number;
  taxAmount: number;
  totalAmount: number;
  notes: string | null;
  dmsSyncStatus?: string | null;
  dmsSyncedAt?: string | null;
  dmsExternalId?: string | null;
};

// ─── Helpers ───────────────────────────────────────────────────────────────────

function fmt(n: number) {
  return `$${n.toFixed(2)}`;
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return new Date(dateStr).toLocaleDateString();
}

const ROLE_COLORS: Record<string, string> = {
  admin:     "bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300",
  manager:   "bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300",
  advisor:   "bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300",
  developer: "bg-surface text-muted-foreground",
};

const SUPPLIERS = ["NAPA", "AutoZone", "O'Reilly", "Advance", "Rock Auto", "OEM", "Other"];

// ─── Messages Tab ──────────────────────────────────────────────────────────────

function MessagesTab({ roId, category }: { roId: string; category: "message" | "note" }) {
  const [messages, setMessages] = useState<ROMessage[]>([]);
  const [content, setContent] = useState("");
  const [sending, setSending] = useState(false);
  const [asExternal, setAsExternal] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  async function fetchMessages() {
    try {
      const res = await fetch(`/api/ro/${roId}/messages`);
      if (res.ok) {
        const all: ROMessage[] = await res.json();
        const filtered = all.filter((m) =>
          category === "message"
            ? m.category === "message" || m.category === "external"
            : m.category === "note"
        );
        setMessages(filtered);
      }
    } catch {
      // silent
    }
  }

  useEffect(() => {
    fetchMessages();
    const interval = setInterval(fetchMessages, 30000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roId, category]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleSend() {
    if (!content.trim()) return;
    setSending(true);
    try {
      const res = await fetch(`/api/ro/${roId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: content.trim(),
          category: category === "message" ? (asExternal ? "external" : "message") : "note",
        }),
      });
      if (res.ok) {
        setContent("");
        setAsExternal(false);
        await fetchMessages();
      }
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex flex-col h-full min-h-[320px]">
      {/* Message list */}
      <div className="flex-1 overflow-y-auto space-y-3 max-h-[400px] pr-1">
        {messages.length === 0 && (
          <p className="text-sm text-muted-foreground py-8 text-center">
            {category === "message" ? "No messages yet. Start the conversation." : "No notes yet."}
          </p>
        )}
        {messages.map((msg) => (
          <div key={msg.id} className="flex gap-3">
            <div className="flex-1 bg-surface rounded-lg px-3 py-2.5 border border-border">
              <div className="flex items-center gap-2 mb-1">
                <span className="font-semibold text-foreground text-sm">
                  {msg.author.name ?? msg.author.employeeId ?? "Unknown"}
                </span>
                <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${ROLE_COLORS[msg.author.role] ?? "bg-surface text-muted-foreground"}`}>
                  {msg.author.role}
                </span>
                {msg.category === "external" && (
                  <span className="text-xs bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 px-1.5 py-0.5 rounded font-medium">
                    Customer
                  </span>
                )}
                <span className="ml-auto text-xs text-muted-foreground">{timeAgo(msg.createdAt)}</span>
              </div>
              <p className="text-sm text-foreground whitespace-pre-wrap">{msg.content}</p>
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Compose */}
      <div className="mt-4 space-y-2 border-t border-border pt-4">
        {category === "message" && (
          <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer select-none w-fit">
            <input
              type="checkbox"
              checked={asExternal}
              onChange={(e) => setAsExternal(e.target.checked)}
              className="rounded"
            />
            Mark as customer-facing note
          </label>
        )}
        <div className="flex gap-2">
          <Textarea
            placeholder={category === "message" ? "Message team..." : "Add a note..."}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="flex-1 min-h-[72px] resize-none text-sm"
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) handleSend();
            }}
          />
          <Button
            onClick={handleSend}
            disabled={sending || !content.trim()}
            className="self-end"
            size="sm"
          >
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">Ctrl+Enter to send</p>
      </div>
    </div>
  );
}

// ─── Add Part Dialog ───────────────────────────────────────────────────────────

type AddPartDialogProps = {
  open: boolean;
  onClose: () => void;
  onAdd: () => void;
  roId: string;
};

function AddPartDialog({ open, onClose, onAdd, roId }: AddPartDialogProps) {
  const [supplier, setSupplier] = useState("");
  const [partNumber, setPartNumber] = useState("");
  const [description, setDescription] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [unitCost, setUnitCost] = useState("");
  const [unitPrice, setUnitPrice] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function reset() {
    setSupplier("");
    setPartNumber("");
    setDescription("");
    setQuantity("1");
    setUnitCost("");
    setUnitPrice("");
    setError("");
  }

  async function handleSubmit() {
    setError("");
    if (!description.trim()) { setError("Description is required"); return; }
    const qty = parseFloat(quantity);
    const cost = parseFloat(unitCost || "0");
    const price = parseFloat(unitPrice);
    if (isNaN(qty) || qty <= 0) { setError("Quantity must be > 0"); return; }
    if (isNaN(price) || price < 0) { setError("Sell price is required"); return; }

    setSaving(true);
    try {
      const res = await fetch(`/api/ro/${roId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "addLineItem",
          supplier: supplier || undefined,
          partNumber: partNumber.trim() || undefined,
          description: description.trim(),
          quantity: qty,
          unitCost: cost,
          unitPrice: price,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Failed to add part"); return; }
      onAdd();
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
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add Part</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>Supplier</Label>
            <Select value={supplier} onValueChange={(v) => setSupplier(v ?? "")}>
              <SelectTrigger>
                <SelectValue placeholder="Select supplier…" />
              </SelectTrigger>
              <SelectContent>
                {SUPPLIERS.map((s) => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Part Number</Label>
            <Input
              placeholder="e.g. 85-7878"
              value={partNumber}
              onChange={(e) => setPartNumber(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Description <span className="text-red-500">*</span></Label>
            <Input
              placeholder="e.g. Oil Filter"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label>Qty</Label>
              <Input
                type="number"
                min="0.01"
                step="1"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Your Cost ($)</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={unitCost}
                onChange={(e) => setUnitCost(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Sell Price ($) <span className="text-red-500">*</span></Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={unitPrice}
                onChange={(e) => setUnitPrice(e.target.value)}
              />
            </div>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => { reset(); onClose(); }}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Add Part
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────────────

export function RODetailClient({
  roId,
  status: initialStatus,
  lineItems: initialItems,
  partsSubtotal: initialPartsSub,
  laborSubtotal: initialLaborSub,
  shopSupplyFee: initialShopFee,
  taxAmount: initialTax,
  totalAmount: initialTotal,
  dmsSyncStatus: initialDmsSyncStatus,
  dmsSyncedAt: initialDmsSyncedAt,
  dmsExternalId: initialDmsExternalId,
}: RODetailClientProps) {
  const router = useRouter();
  const [status, setStatus] = useState(initialStatus);
  const [items, setItems] = useState<LineItem[]>(initialItems);
  const [totals, setTotals] = useState({
    partsSubtotal: initialPartsSub,
    laborSubtotal: initialLaborSub,
    shopSupplyFee: initialShopFee,
    taxAmount: initialTax,
    totalAmount: initialTotal,
  });
  const [dmsSyncStatus, setDmsSyncStatus] = useState(initialDmsSyncStatus ?? null);
  const [dmsSyncedAt, setDmsSyncedAt] = useState(initialDmsSyncedAt ?? null);
  const [dmsExternalId, setDmsExternalId] = useState(initialDmsExternalId ?? null);

  const [presenting, setPresenting] = useState(false);
  const [presentError, setPresentError] = useState("");
  const [approving, setApproving] = useState(false);
  const [approveError, setApproveError] = useState("");
  // [FEATURE: customer_approval_portal] START
  const [showApprovalDialog, setShowApprovalDialog] = useState(false);
  // [FEATURE: customer_approval_portal] END
  // [FEATURE: core_return_tracking] START
  const [returnFormItem, setReturnFormItem] = useState<{ lineItemId: string; partNumber: string; description: string } | null>(null);
  // [FEATURE: core_return_tracking] END
  // [FEATURE: inventory_ro_integration] START
  const [stockWarnings, setStockWarnings] = useState<{ lineItemId: string; partNumber: string; isLow: boolean; qtyNeeded: number; qtyOnHand: number }[]>([]);
  useEffect(() => {
    if (status === "draft" || status === "presented") {
      fetch(`/api/ro/${roId}/stock-check`)
        .then((r) => r.json())
        .then((data) => setStockWarnings(data.results ?? []))
        .catch(() => {});
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roId, status]);
  const lowStockIds = new Set(stockWarnings.filter((s) => s.isLow).map((s) => s.lineItemId));
  // [FEATURE: inventory_ro_integration] END
  // [FEATURE: tech_time_clock] START
  const [timeEntries, setTimeEntries] = useState<{ id: string; clockedInAt: string; clockedOutAt: string | null; flatRateHours: number | null; notes: string | null; tech: { name: string | null } | null }[]>([]);
  const [timeLoaded, setTimeLoaded] = useState(false);
  async function loadTimeEntries() {
    const res = await fetch(`/api/ro/${roId}/time-entries`);
    if (res.ok) { const d = await res.json(); setTimeEntries(d.entries ?? []); }
    setTimeLoaded(true);
  }
  // [FEATURE: tech_time_clock] END

  const [showAddPart, setShowAddPart] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);

  // Inline edit state
  const [editing, setEditing] = useState<{
    itemId: string;
    field: "unitPrice" | "quantity";
    value: string;
    reason: string;
    saving: boolean;
  } | null>(null);

  const isDraft = status === "draft";
  const isPresented = status === "presented";

  // ── Present to customer ────────────────────────────────────────────────────
  async function handlePresent() {
    setPresenting(true);
    setPresentError("");
    try {
      const res = await fetch(`/api/ro/${roId}/present`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setPresentError(data.error ?? "Failed to present RO");
      } else {
        setStatus("presented");
        router.refresh();
      }
    } catch {
      setPresentError("Network error");
    } finally {
      setPresenting(false);
    }
  }

  // ── Approve RO ─────────────────────────────────────────────────────────────
  async function handleApprove() {
    setApproving(true);
    setApproveError("");
    try {
      const res = await fetch(`/api/ro/${roId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "approved" }),
      });
      const data = await res.json();
      if (!res.ok) {
        setApproveError(data.error ?? "Failed to approve RO");
      } else {
        setStatus("approved");
        setDmsSyncStatus("pending");
        setDmsSyncedAt(null);
        setDmsExternalId(null);
        router.refresh();
      }
    } catch {
      setApproveError("Network error");
    } finally {
      setApproving(false);
    }
  }

  // ── Save inline override ───────────────────────────────────────────────────
  async function handleSaveOverride() {
    if (!editing) return;
    setEditing((e) => e && { ...e, saving: true });
    try {
      const res = await fetch(`/api/ro/${roId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lineItemOverrides: [
            {
              lineItemId: editing.itemId,
              field: editing.field,
              newValue: editing.value,
              reason: editing.reason || undefined,
            },
          ],
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error ?? "Failed to save override");
        setEditing((e) => e && { ...e, saving: false });
        return;
      }
      const updated = data.ro;
      setItems(updated.lineItems);
      setTotals({
        partsSubtotal: updated.partsSubtotal,
        laborSubtotal: updated.laborSubtotal,
        shopSupplyFee: updated.shopSupplyFee,
        taxAmount: updated.taxAmount,
        totalAmount: updated.totalAmount,
      });
      setEditing(null);
    } catch {
      alert("Network error saving override");
      setEditing((e) => e && { ...e, saving: false });
    }
  }

  // ── Remove manual line item ────────────────────────────────────────────────
  async function handleRemoveItem(lineItemId: string) {
    setRemovingId(lineItemId);
    try {
      const res = await fetch(`/api/ro/${roId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "removeLineItem", lineItemId }),
      });
      const data = await res.json();
      if (!res.ok) { alert(data.error ?? "Failed to remove item"); return; }
      setItems(data.ro.lineItems);
      setTotals({
        partsSubtotal: data.ro.partsSubtotal,
        laborSubtotal: data.ro.laborSubtotal,
        shopSupplyFee: data.ro.shopSupplyFee,
        taxAmount: data.ro.taxAmount,
        totalAmount: data.ro.totalAmount,
      });
    } catch {
      alert("Network error");
    } finally {
      setRemovingId(null);
    }
  }

  function startEdit(item: LineItem, field: "unitPrice" | "quantity") {
    setEditing({
      itemId: item.id,
      field,
      value: String(field === "unitPrice" ? item.unitPrice : item.quantity),
      reason: "",
      saving: false,
    });
  }

  // Callback when AddPartDialog succeeds — refresh items from server
  async function handlePartAdded() {
    const res = await fetch(`/api/ro/${roId}`);
    if (res.ok) {
      const data = await res.json();
      setItems(data.ro.lineItems);
      setTotals({
        partsSubtotal: data.ro.partsSubtotal,
        laborSubtotal: data.ro.laborSubtotal,
        shopSupplyFee: data.ro.shopSupplyFee,
        taxAmount: data.ro.taxAmount,
        totalAmount: data.ro.totalAmount,
      });
    }
  }

  const parts = items.filter((li) => li.type === "part");
  const labor = items.filter((li) => li.type === "labor");

  return (
    <div className="space-y-6">
      {/* Status banner */}
      {status === "presented" && (
        <div className="flex items-center gap-2 px-4 py-3 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 rounded-lg text-blue-800 dark:text-blue-300 text-sm">
          <CheckCircle className="h-4 w-4 flex-shrink-0" />
          <span>This RO has been presented to the customer. Approve it to send to your DMS.</span>
        </div>
      )}

      {/* DMS sync badge */}
      {dmsSyncStatus && (
        <div className={[
          "flex items-center gap-2 px-4 py-3 rounded-lg text-sm border",
          dmsSyncStatus === "synced"  ? "bg-green-50 dark:bg-green-900/30 border-green-200 dark:border-green-700 text-green-800 dark:text-green-300" :
          dmsSyncStatus === "pending" ? "bg-yellow-50 dark:bg-yellow-900/30 border-yellow-200 dark:border-yellow-700 text-yellow-800 dark:text-yellow-300" :
                                        "bg-red-50 dark:bg-red-900/30 border-red-200 dark:border-red-700 text-red-800 dark:text-red-300",
        ].join(" ")}>
          {dmsSyncStatus === "synced"  && <CheckCircle2 className="h-4 w-4 flex-shrink-0" />}
          {dmsSyncStatus === "pending" && <Clock className="h-4 w-4 flex-shrink-0" />}
          {dmsSyncStatus === "failed"  && <AlertCircle className="h-4 w-4 flex-shrink-0" />}
          <span>
            {dmsSyncStatus === "synced" && (
              <>DMS sync complete{dmsExternalId ? ` · DMS ID: ${dmsExternalId}` : ""}{dmsSyncedAt ? ` · ${new Date(dmsSyncedAt).toLocaleString()}` : ""}</>
            )}
            {dmsSyncStatus === "pending" && "DMS sync queued — will attempt shortly."}
            {dmsSyncStatus === "failed"  && "DMS sync failed. It will be retried automatically (up to 3 attempts)."}
          </span>
          {dmsSyncStatus === "synced" && <RefreshCw className="h-3.5 w-3.5 ml-auto opacity-50" />}
        </div>
      )}

      {/* Main tabs */}
      <Tabs defaultValue="summary">
        <TabsList className="w-full md:w-auto flex-wrap">
          <TabsTrigger value="summary" className="flex items-center gap-1.5">
            <ClipboardList className="h-4 w-4" />
            Summary
          </TabsTrigger>
          <TabsTrigger value="messages" className="flex items-center gap-1.5">
            <MessageSquare className="h-4 w-4" />
            Messages
          </TabsTrigger>
          <TabsTrigger value="notes" className="flex items-center gap-1.5">
            <Pencil className="h-4 w-4" />
            Notes
          </TabsTrigger>
          {/* [FEATURE: dvi] START */}
          <TabsTrigger value="dvi" className="flex items-center gap-1.5">
            <CheckCircle className="h-4 w-4" />
            DVI
          </TabsTrigger>
          {/* [FEATURE: dvi] END */}
          {/* [FEATURE: tech_time_clock] START */}
          <TabsTrigger value="time" className="flex items-center gap-1.5" onClick={() => { if (!timeLoaded) loadTimeEntries(); }}>
            <Timer className="h-4 w-4" />
            Time
          </TabsTrigger>
          {/* [FEATURE: tech_time_clock] END */}
          {/* [FEATURE: parts_ordering] START */}
          <TabsTrigger value="parts-orders" className="flex items-center gap-1.5">
            <Package className="h-4 w-4" />
            Parts Orders
          </TabsTrigger>
          {/* [FEATURE: parts_ordering] END */}
        </TabsList>

        {/* ── Summary Tab ─────────────────────────────────────────────────── */}
        <TabsContent value="summary" className="mt-4 space-y-6">
          {/* Parts */}
          {parts.length > 0 && (
            <div className="border border-border rounded-lg overflow-hidden">
              <div className="px-4 py-2.5 bg-surface flex items-center gap-2 border-b border-border">
                <Package className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-semibold text-foreground">Parts</span>
                {isDraft && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="ml-auto h-7 text-xs"
                    onClick={() => setShowAddPart(true)}
                  >
                    <Plus className="h-3.5 w-3.5 mr-1" />
                    Add Part
                  </Button>
                )}
              </div>

              {/* Mobile card layout */}
              <div className="md:hidden divide-y divide-border/50">
                {parts.map((item) => (
                  <div key={item.id} className="px-4 py-3 space-y-1">
                    <div className="flex items-start justify-between gap-3">
                      <div className="font-medium text-foreground leading-snug">
                        {item.description.split(" — ")[0]}
                      </div>
                      <span className="font-semibold text-foreground flex-shrink-0">{fmt(item.totalPrice)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {item.supplier && (
                        <Badge variant="outline" className="text-xs h-5">{item.supplier}</Badge>
                      )}
                      {item.partNumber && (
                        <span className="text-xs font-mono text-muted-foreground">#{item.partNumber}</span>
                      )}
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">
                        Qty {item.quantity} · Unit {fmt(item.unitPrice)}
                      </span>
                      {isDraft && (
                        <button
                          onClick={() => handleRemoveItem(item.id)}
                          disabled={removingId === item.id}
                          className="text-red-400 hover:text-red-600 p-1"
                          title="Remove"
                        >
                          {removingId === item.id
                            ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            : <Trash2 className="h-3.5 w-3.5" />
                          }
                        </button>
                      )}
                    </div>
                  </div>
                ))}
                <div className="px-4 py-2.5 bg-surface flex justify-between text-sm font-semibold text-foreground">
                  <span>Parts subtotal</span>
                  <span className="text-foreground">{fmt(totals.partsSubtotal)}</span>
                </div>
              </div>

              {/* Desktop table layout */}
              <table className="w-full text-sm hidden md:table">
                <thead>
                  <tr className="border-b border-border text-xs text-muted-foreground">
                    <th className="text-left px-4 py-2 font-medium">Part</th>
                    <th className="text-right px-4 py-2 font-medium">Qty</th>
                    <th className="text-right px-4 py-2 font-medium">Unit Price</th>
                    <th className="text-right px-4 py-2 font-medium">Total</th>
                    {isDraft && <th className="w-8" />}
                  </tr>
                </thead>
                <tbody>
                  {parts.map((item) => {
                    const editingThis = editing?.itemId === item.id;
                    return (
                      <tr key={item.id} className="border-b border-border/30">
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium text-foreground leading-snug">
                              {item.description.split(" — ")[0]}
                            </span>
                            {item.supplier && (
                              <Badge variant="outline" className="text-xs h-5">{item.supplier}</Badge>
                            )}
                            {/* [FEATURE: inventory_ro_integration] START */}
                            {lowStockIds.has(item.id) && (
                              <Badge className="text-xs h-5 bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-700">
                                <AlertTriangle className="h-3 w-3 mr-1" />
                                Low Stock
                              </Badge>
                            )}
                            {/* [FEATURE: inventory_ro_integration] END */}
                          </div>
                          {item.partNumber && (
                            <div className="text-xs text-muted-foreground font-mono">
                              #{item.partNumber}
                              {/* [FEATURE: core_return_tracking] START */}
                              {(status === "approved" || status === "closed") && (
                                <button
                                  onClick={() => setReturnFormItem({ lineItemId: item.id, partNumber: item.partNumber ?? "", description: item.description })}
                                  className="ml-2 text-muted-foreground hover:text-foreground inline-flex items-center gap-0.5"
                                  title="Log a core/warranty return"
                                >
                                  <RotateCcw className="h-3 w-3" />
                                  Return
                                </button>
                              )}
                              {/* [FEATURE: core_return_tracking] END */}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          {editingThis && editing.field === "quantity" ? (
                            <Input
                              type="number"
                              value={editing.value}
                              onChange={(e) => setEditing((ed) => ed && { ...ed, value: e.target.value })}
                              className="w-20 h-7 text-right text-sm ml-auto"
                              autoFocus
                            />
                          ) : (
                            <button
                              disabled={!isDraft}
                              onClick={() => isDraft && startEdit(item, "quantity")}
                              className={`text-foreground ${isDraft ? "hover:text-primary hover:underline cursor-pointer" : ""}`}
                            >
                              {item.quantity}
                            </button>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          {editingThis && editing.field === "unitPrice" ? (
                            <div className="flex items-center gap-1 justify-end">
                              <Input
                                type="number"
                                step="0.01"
                                value={editing.value}
                                onChange={(e) => setEditing((ed) => ed && { ...ed, value: e.target.value })}
                                className="w-24 h-7 text-right text-sm"
                                autoFocus
                              />
                            </div>
                          ) : (
                            <button
                              disabled={!isDraft}
                              onClick={() => isDraft && startEdit(item, "unitPrice")}
                              className={`font-medium text-foreground ${isDraft ? "hover:text-primary hover:underline cursor-pointer" : ""}`}
                            >
                              {fmt(item.unitPrice)}
                            </button>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-right font-medium text-foreground">
                          {editingThis ? (
                            <div className="flex items-center gap-1 justify-end">
                              <button
                                onClick={handleSaveOverride}
                                disabled={editing.saving}
                                className="p-1 text-green-600 hover:text-green-800"
                                title="Save"
                              >
                                {editing.saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                              </button>
                              <button
                                onClick={() => setEditing(null)}
                                className="p-1 text-muted-foreground hover:text-foreground"
                                title="Cancel"
                              >
                                <X className="h-4 w-4" />
                              </button>
                            </div>
                          ) : (
                            fmt(item.totalPrice)
                          )}
                        </td>
                        {isDraft && (
                          <td className="px-2 py-2.5 text-right">
                            {!editingThis && (
                              <button
                                onClick={() => handleRemoveItem(item.id)}
                                disabled={removingId === item.id}
                                className="text-red-300 hover:text-red-600 p-1"
                                title="Remove"
                              >
                                {removingId === item.id
                                  ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                  : <Trash2 className="h-3.5 w-3.5" />
                                }
                              </button>
                            )}
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-surface">
                    <td colSpan={isDraft ? 4 : 3} className="px-4 py-2 text-sm font-semibold text-foreground text-right">
                      Parts subtotal
                    </td>
                    <td className="px-4 py-2 text-right font-semibold text-foreground">
                      {fmt(totals.partsSubtotal)}
                    </td>
                    {isDraft && <td />}
                  </tr>
                </tfoot>
              </table>
            </div>
          )}

          {/* Add Part button when no parts exist yet */}
          {parts.length === 0 && isDraft && (
            <button
              onClick={() => setShowAddPart(true)}
              className="w-full border-2 border-dashed border-border rounded-lg py-6 text-sm text-muted-foreground hover:border-primary/50 hover:text-foreground transition-colors flex items-center justify-center gap-2"
            >
              <Plus className="h-4 w-4" />
              Add a part to this RO
            </button>
          )}

          {/* Labor */}
          {labor.length > 0 && (
            <div className="border border-border rounded-lg overflow-hidden">
              <div className="px-4 py-2.5 bg-surface flex items-center gap-2 border-b border-border">
                <Wrench className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-semibold text-foreground">Labor</span>
              </div>

              {/* Mobile card layout */}
              <div className="md:hidden divide-y divide-border/50">
                {labor.map((item) => (
                  <div key={item.id} className="px-4 py-3 space-y-1">
                    <div className="flex items-start justify-between gap-3">
                      <div className="font-medium text-foreground">{item.description}</div>
                      <span className="font-semibold text-foreground flex-shrink-0">{fmt(item.totalPrice)}</span>
                    </div>
                    {item.laborOpCode && (
                      <div className="text-xs font-mono text-muted-foreground">{item.laborOpCode}</div>
                    )}
                    <div className="text-xs text-muted-foreground">
                      {item.quantity.toFixed(1)} hrs · {fmt(item.unitPrice)}/hr
                    </div>
                  </div>
                ))}
                <div className="px-4 py-2.5 bg-surface flex justify-between text-sm font-semibold text-foreground">
                  <span>Labor subtotal</span>
                  <span className="text-foreground">{fmt(totals.laborSubtotal)}</span>
                </div>
              </div>

              {/* Desktop table layout */}
              <table className="w-full text-sm hidden md:table">
                <thead>
                  <tr className="border-b border-border text-xs text-muted-foreground">
                    <th className="text-left px-4 py-2 font-medium">Operation</th>
                    <th className="text-right px-4 py-2 font-medium">Hours</th>
                    <th className="text-right px-4 py-2 font-medium">Rate</th>
                    <th className="text-right px-4 py-2 font-medium">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {labor.map((item) => {
                    const editingThis = editing?.itemId === item.id;
                    return (
                      <tr key={item.id} className="border-b border-border/30">
                        <td className="px-4 py-2.5">
                          <div className="font-medium text-foreground">{item.description}</div>
                          {item.laborOpCode && (
                            <div className="text-xs text-muted-foreground font-mono">{item.laborOpCode}</div>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-right text-muted-foreground">
                          {item.quantity.toFixed(1)} hrs
                        </td>
                        <td className="px-4 py-2.5 text-right text-muted-foreground">
                          {editingThis && editing.field === "unitPrice" ? (
                            <div className="flex items-center gap-1 justify-end">
                              <Input
                                type="number"
                                step="0.01"
                                value={editing.value}
                                onChange={(e) => setEditing((ed) => ed && { ...ed, value: e.target.value })}
                                className="w-24 h-7 text-right text-sm"
                                autoFocus
                              />
                            </div>
                          ) : (
                            <button
                              disabled={!isDraft}
                              onClick={() => isDraft && startEdit(item, "unitPrice")}
                              className={`${isDraft ? "hover:text-primary hover:underline cursor-pointer" : ""}`}
                            >
                              {fmt(item.unitPrice)}/hr
                            </button>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-right font-medium text-foreground">
                          {editingThis ? (
                            <div className="flex items-center gap-1 justify-end">
                              <button
                                onClick={handleSaveOverride}
                                disabled={editing.saving}
                                className="p-1 text-green-600 hover:text-green-800"
                              >
                                {editing.saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                              </button>
                              <button onClick={() => setEditing(null)} className="p-1 text-muted-foreground hover:text-foreground">
                                <X className="h-4 w-4" />
                              </button>
                            </div>
                          ) : (
                            fmt(item.totalPrice)
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-surface">
                    <td colSpan={3} className="px-4 py-2 text-sm font-semibold text-foreground text-right">
                      Labor subtotal
                    </td>
                    <td className="px-4 py-2 text-right font-semibold text-foreground">
                      {fmt(totals.laborSubtotal)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}

          {/* Override hint */}
          {isDraft && (parts.length > 0 || labor.length > 0) && (
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Pencil className="h-3 w-3" />
              Click any price or quantity to override. Changes are logged.
            </p>
          )}

          {/* Totals summary */}
          <div className="border border-border rounded-lg overflow-hidden">
            <div className="divide-y divide-border/50">
              <div className="flex justify-between px-4 py-3 text-sm text-muted-foreground">
                <span>Parts</span>
                <span>{fmt(totals.partsSubtotal)}</span>
              </div>
              <div className="flex justify-between px-4 py-3 text-sm text-muted-foreground">
                <span>Labor</span>
                <span>{fmt(totals.laborSubtotal)}</span>
              </div>
              {totals.shopSupplyFee > 0 && (
                <div className="flex justify-between px-4 py-3 text-sm text-muted-foreground">
                  <span>Shop Supply Fee</span>
                  <span>{fmt(totals.shopSupplyFee)}</span>
                </div>
              )}
              {totals.taxAmount > 0 && (
                <div className="flex justify-between px-4 py-3 text-sm text-muted-foreground">
                  <span>Tax</span>
                  <span>{fmt(totals.taxAmount)}</span>
                </div>
              )}
              <div className="flex justify-between px-4 py-3 font-bold text-foreground bg-surface">
                <span>Total</span>
                <span className="text-lg">{fmt(totals.totalAmount)}</span>
              </div>
            </div>
          </div>

          {/* [FEATURE: inventory_ro_integration] START */}
          {isDraft && lowStockIds.size > 0 && (
            <div className="flex items-start gap-2 px-4 py-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-lg text-amber-800 dark:text-amber-300 text-sm">
              <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
              <span>
                {lowStockIds.size} part{lowStockIds.size > 1 ? "s are" : " is"} low or out of stock. Review inventory before presenting.
              </span>
            </div>
          )}
          {/* [FEATURE: inventory_ro_integration] END */}

          {/* Actions */}
          <div className="flex items-center justify-between pt-2">
            <a
              href={`/api/ro/${roId}/pdf`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground border border-border rounded-md px-3 py-2 hover:border-primary/50 transition-colors"
            >
              <FileText className="h-4 w-4" />
              Export PDF
            </a>

            {isDraft && (
              <div className="flex items-center gap-3">
                {presentError && <p className="text-sm text-red-600">{presentError}</p>}
                <Button onClick={handlePresent} disabled={presenting}>
                  {presenting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Present to Customer
                </Button>
              </div>
            )}

            {isPresented && (
              <div className="flex items-center gap-3">
                {/* [FEATURE: customer_approval_portal] START */}
                <Button variant="outline" onClick={() => setShowApprovalDialog(true)}>
                  <Share2 className="h-4 w-4 mr-2" />
                  Send for Approval
                </Button>
                {/* [FEATURE: customer_approval_portal] END */}
                {approveError && <p className="text-sm text-red-600">{approveError}</p>}
                <Button onClick={handleApprove} disabled={approving} id="approve-ro-btn">
                  {approving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Approve &amp; Send to DMS
                </Button>
              </div>
            )}
          </div>
        </TabsContent>

        {/* ── Messages Tab ────────────────────────────────────────────────── */}
        <TabsContent value="messages" className="mt-4">
          <div className="border border-border rounded-lg p-4">
            <p className="text-xs text-muted-foreground mb-3">
              Internal team messages — visible to all staff on this RO.
            </p>
            <MessagesTab roId={roId} category="message" />
          </div>
        </TabsContent>

        {/* ── Notes Tab ───────────────────────────────────────────────────── */}
        <TabsContent value="notes" className="mt-4">
          <div className="border border-border rounded-lg p-4">
            <p className="text-xs text-muted-foreground mb-3">
              Dealer-wide notes for this RO — visible to all departments (service, parts, management).
            </p>
            <MessagesTab roId={roId} category="note" />
          </div>
        </TabsContent>

        {/* [FEATURE: dvi] START */}
        <TabsContent value="dvi" className="mt-4">
          <div className="border border-border rounded-lg p-4 space-y-3">
            <p className="text-sm text-muted-foreground">
              Capture photos, videos, and condition ratings for each line item.
            </p>
            <a
              href={`/dashboard/ro/${roId}/dvi`}
              className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"
            >
              <CheckCircle className="h-4 w-4" />
              Open Digital Vehicle Inspection
            </a>
          </div>
        </TabsContent>
        {/* [FEATURE: dvi] END */}

        {/* [FEATURE: tech_time_clock] START */}
        <TabsContent value="time" className="mt-4">
          <div className="border border-border rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">Time Entries</p>
              <a href={`/dashboard/tech/time-clock`} className="text-xs text-primary hover:underline">Clock in/out</a>
            </div>
            {!timeLoaded ? (
              <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
            ) : timeEntries.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">No time entries yet.</p>
            ) : (
              <div className="divide-y border rounded-md text-sm">
                {timeEntries.map((entry) => {
                  const inMs = entry.clockedOutAt
                    ? new Date(entry.clockedOutAt).getTime() - new Date(entry.clockedInAt).getTime()
                    : Date.now() - new Date(entry.clockedInAt).getTime();
                  const hrs = (inMs / 3600000).toFixed(2);
                  return (
                    <div key={entry.id} className="flex items-center justify-between px-3 py-2 gap-4">
                      <div>
                        <span className="font-medium">{entry.tech?.name ?? "Tech"}</span>
                        <span className="text-muted-foreground text-xs ml-2">{new Date(entry.clockedInAt).toLocaleString()}</span>
                      </div>
                      <div className="text-right shrink-0">
                        <div>{entry.clockedOutAt ? `${hrs} hrs actual` : <span className="text-amber-600">In progress</span>}</div>
                        {entry.flatRateHours && <div className="text-xs text-muted-foreground">{entry.flatRateHours} flat-rate hrs</div>}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </TabsContent>
        {/* [FEATURE: tech_time_clock] END */}

        {/* [FEATURE: parts_ordering] START */}
        <TabsContent value="parts-orders" className="mt-4">
          <div className="border border-border rounded-lg p-4">
            <PartsOrderPanel roId={roId} />
          </div>
        </TabsContent>
        {/* [FEATURE: parts_ordering] END */}
      </Tabs>

      {/* Add Part Dialog */}
      <AddPartDialog
        open={showAddPart}
        onClose={() => setShowAddPart(false)}
        onAdd={handlePartAdded}
        roId={roId}
      />

      {/* [FEATURE: customer_approval_portal] START */}
      {showApprovalDialog && (
        <ApprovalSendDialog
          roId={roId}
          customerPhone={null}
          customerEmail={null}
          onClose={() => setShowApprovalDialog(false)}
        />
      )}
      {/* [FEATURE: customer_approval_portal] END */}

      {/* [FEATURE: core_return_tracking] START */}
      {returnFormItem && (
        <ReturnForm
          roId={roId}
          lineItemId={returnFormItem.lineItemId}
          prefill={{ partNumber: returnFormItem.partNumber, description: returnFormItem.description }}
          onClose={() => setReturnFormItem(null)}
          onSaved={() => setReturnFormItem(null)}
        />
      )}
      {/* [FEATURE: core_return_tracking] END */}
    </div>
  );
}
