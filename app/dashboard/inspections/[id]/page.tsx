"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ChevronLeft, CheckCircle, AlertTriangle, Car, FileText,
  Loader2, Plus, Link2, X, Check, Download, User
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface TemplateItem {
  id: string;
  label: string;
  checkType: string;
  unit: string | null;
  sortOrder: number;
}

interface InspectionResult {
  id: string;
  templateItemId: string;
  value: string | null;
  notes: string | null;
  templateItem: { label: string; checkType: string; unit: string | null };
}

interface Inspection {
  id: string;
  status: string;
  repairOrderId: string | null;
  vin: string | null;
  vehicleLabel: string | null;
  createdAt: string;
  template: { id: string; name: string; items: TemplateItem[] };
  results: InspectionResult[];
  repairOrder: { id: string; roNumber: string | null } | null;
  tech: { id: string; name: string | null } | null;
  lotVehicle: { id: string; year: number | null; make: string; model: string; stockNumber: string | null } | null;
}

function isFlagged(value: string | null) {
  return value === "critical" || value === "fail" || value === "advisory";
}

export default function InspectionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [insp, setInsp] = useState<Inspection | null>(null);
  const [loading, setLoading] = useState(true);
  const [values, setValues] = useState<Record<string, string | null>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [completing, setCompleting] = useState(false);

  // Create RO modal state
  const [showCreateRO, setShowCreateRO] = useState(false);
  const [flaggedSelected, setFlaggedSelected] = useState<Set<string>>(new Set());
  const [customerName, setCustomerName] = useState("");
  const [creatingRO, setCreatingRO] = useState(false);
  const [createROError, setCreateROError] = useState<string | null>(null);

  // Link RO modal state
  const [showLinkRO, setShowLinkRO] = useState(false);
  const [linkROId, setLinkROId] = useState("");
  const [linking, setLinking] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/inspections/${id}`);
    if (res.ok) {
      const data = await res.json();
      const i: Inspection = data.inspection;
      setInsp(i);
      const v: Record<string, string | null> = {};
      const n: Record<string, string> = {};
      for (const r of i.results) {
        v[r.templateItemId] = r.value ?? null;
        if (r.notes) n[r.templateItemId] = r.notes;
      }
      setValues(v);
      setNotes(n);
    }
    setLoading(false);
  }, [id]);

  useEffect(() => { load(); }, [load]);

  async function saveResults(newValues = values, newNotes = notes, status?: string) {
    setSaving(true);
    const results = (insp?.template.items ?? []).map((item) => ({
      templateItemId: item.id,
      value: newValues[item.id] ?? null,
      notes: newNotes[item.id] ?? null,
    }));
    const body: Record<string, unknown> = { results };
    if (status) body.status = status;
    const res = await fetch(`/api/inspections/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.ok) {
      const data = await res.json();
      setInsp(data.inspection);
    }
    setSaving(false);
  }

  async function markComplete() {
    setCompleting(true);
    await saveResults(values, notes, "complete");
    setCompleting(false);
  }

  async function handleCreateRO() {
    setCreateROError(null);
    if (flaggedSelected.size === 0) { setCreateROError("Select at least one issue"); return; }
    setCreatingRO(true);
    const res = await fetch(`/api/inspections/${id}/create-ro`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        flaggedItemIds: Array.from(flaggedSelected),
        customerName: customerName.trim() || null,
        lotVehicleId: insp?.lotVehicle?.id ?? null,
      }),
    });
    const data = await res.json();
    if (res.ok) {
      router.push(`/dashboard/ro/${data.ro.id}`);
    } else {
      setCreateROError(data.error ?? "Failed to create RO");
      setCreatingRO(false);
    }
  }

  async function handleLinkRO() {
    setLinkError(null);
    if (!linkROId.trim()) { setLinkError("Enter an RO ID"); return; }
    setLinking(true);
    const res = await fetch(`/api/inspections/${id}/link-ro`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ roId: linkROId.trim() }),
    });
    const data = await res.json();
    if (res.ok) {
      await load();
      setShowLinkRO(false);
      setLinkROId("");
    } else {
      setLinkError(data.error ?? "Failed to link");
    }
    setLinking(false);
  }

  if (loading) return <div className="p-6 text-sm text-muted-foreground animate-pulse">Loading…</div>;
  if (!insp) return <div className="p-6 text-sm text-destructive">Inspection not found.</div>;

  const isComplete = insp.status === "complete";
  const isLinked = !!insp.repairOrderId;

  // Items flagged as issues in results
  const flaggedItems = insp.template.items.filter((item) => isFlagged(values[item.id] ?? null));

  const vehicleDisplay = insp.vehicleLabel
    ?? (insp.lotVehicle
      ? [insp.lotVehicle.year, insp.lotVehicle.make, insp.lotVehicle.model].filter(Boolean).join(" ")
      : insp.vin ?? "No vehicle");

  return (
    <div className="p-6 max-w-2xl space-y-6">
      <Link href="/dashboard/inspections" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ChevronLeft className="h-4 w-4" />Inspections
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-foreground">{insp.template.name}</h1>
          <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground flex-wrap">
            <Car className="h-4 w-4" />
            <span>{vehicleDisplay}</span>
            {insp.vin && <span className="font-mono text-xs">· {insp.vin}</span>}
          </div>
          {insp.tech?.name && (
            <div className="flex items-center gap-1.5 mt-1 text-xs text-muted-foreground">
              <User className="h-3.5 w-3.5" />
              {insp.tech.name}
            </div>
          )}
          {insp.repairOrder && (
            <div className="flex items-center gap-1.5 mt-1 text-xs text-muted-foreground">
              <FileText className="h-3.5 w-3.5" />
              Linked to{" "}
              <Link href={`/dashboard/ro/${insp.repairOrder.id}`} className="text-primary hover:underline">
                {insp.repairOrder.roNumber ?? `RO-${insp.repairOrder.id.slice(-6).toUpperCase()}`}
              </Link>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-xs px-2 py-1 rounded font-medium ${isComplete ? "bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300" : "bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300"}`}>
            {isComplete ? "Complete" : "In Progress"}
          </span>
          {insp.results.length > 0 && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => window.open(`/api/inspections/${id}/pdf`, "_blank")}
            >
              <Download className="h-3.5 w-3.5 mr-1.5" />
              {isComplete ? "Download PDF" : "Print Blank Form"}
            </Button>
          )}
          {!isComplete && (
            <Button size="sm" onClick={markComplete} disabled={completing || saving}>
              {completing ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <CheckCircle className="h-3.5 w-3.5 mr-1.5" />}
              Mark Complete
            </Button>
          )}
        </div>
      </div>

      {/* Flagged issues summary */}
      {flaggedItems.length > 0 && (
        <div className="border border-amber-200 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20 rounded-lg px-4 py-3 space-y-2">
          <div className="flex items-center gap-2 text-sm font-medium text-amber-800 dark:text-amber-300">
            <AlertTriangle className="h-4 w-4" />
            {flaggedItems.length} issue{flaggedItems.length !== 1 ? "s" : ""} found
          </div>
          {!isLinked && (
            <div className="flex gap-2 flex-wrap">
              <Button
                size="sm"
                variant="outline"
                className="text-xs h-7 border-amber-300 dark:border-amber-700"
                onClick={() => {
                  setFlaggedSelected(new Set(flaggedItems.map((i) => i.id)));
                  setShowCreateRO(true);
                }}
              >
                <Plus className="h-3.5 w-3.5 mr-1" />
                Create RO from Issues
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="text-xs h-7 border-amber-300 dark:border-amber-700"
                onClick={() => setShowLinkRO(true)}
              >
                <Link2 className="h-3.5 w-3.5 mr-1" />
                Link to Existing RO
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Inspection form */}
      <div className={`border border-border rounded-lg overflow-hidden ${isComplete ? "opacity-75" : ""}`}>
        <div className="px-4 py-2.5 bg-surface border-b border-border flex items-center justify-between">
          <span className="text-sm font-semibold text-foreground">Inspection Items</span>
          {saving && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
        </div>
        <div className="divide-y divide-border">
          {insp.template.items.map((item) => {
            const val = values[item.id] ?? null;
            return (
              <div key={item.id} className="px-4 py-3 space-y-2">
                <p className="text-sm font-medium text-foreground">{item.label}</p>

                {item.checkType === "condition" && (
                  <div className="flex gap-2">
                    {(["ok", "advisory", "critical"] as const).map((c) => (
                      <button
                        key={c}
                        disabled={isComplete}
                        onClick={() => {
                          const next = { ...values, [item.id]: c };
                          setValues(next);
                          saveResults(next, notes);
                        }}
                        className={`flex-1 py-1.5 rounded text-xs font-semibold border transition-colors ${
                          val === c
                            ? c === "ok"
                              ? "bg-green-600 border-green-600 text-white"
                              : c === "advisory"
                              ? "bg-amber-500 border-amber-500 text-white"
                              : "bg-red-600 border-red-600 text-white"
                            : "border-border text-muted-foreground hover:bg-surface"
                        }`}
                      >
                        {c.charAt(0).toUpperCase() + c.slice(1)}
                      </button>
                    ))}
                  </div>
                )}

                {item.checkType === "passfail" && (
                  <div className="flex gap-2">
                    {(["pass", "fail"] as const).map((v) => (
                      <button
                        key={v}
                        disabled={isComplete}
                        onClick={() => {
                          const next = { ...values, [item.id]: v };
                          setValues(next);
                          saveResults(next, notes);
                        }}
                        className={`flex-1 py-1.5 rounded text-xs font-semibold border transition-colors ${
                          val === v
                            ? v === "pass"
                              ? "bg-green-600 border-green-600 text-white"
                              : "bg-red-600 border-red-600 text-white"
                            : "border-border text-muted-foreground hover:bg-surface"
                        }`}
                      >
                        {v.toUpperCase()}
                      </button>
                    ))}
                  </div>
                )}

                {item.checkType === "measurement" && (
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      disabled={isComplete}
                      value={values[item.id] ?? ""}
                      onChange={(e) => setValues((prev) => ({ ...prev, [item.id]: e.target.value }))}
                      onBlur={() => saveResults()}
                      placeholder="Enter value"
                      className="flex-1 border border-border rounded px-2 py-1.5 text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                    {item.unit && <span className="text-sm text-muted-foreground">{item.unit}</span>}
                  </div>
                )}

                <textarea
                  disabled={isComplete}
                  value={notes[item.id] ?? ""}
                  onChange={(e) => setNotes((prev) => ({ ...prev, [item.id]: e.target.value }))}
                  onBlur={() => saveResults()}
                  placeholder="Notes (optional)"
                  rows={1}
                  className="w-full border border-border rounded px-2 py-1.5 text-xs bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                />
              </div>
            );
          })}
        </div>
        {!isComplete && (
          <div className="px-4 py-3 bg-surface border-t border-border">
            <Button size="sm" variant="outline" onClick={() => saveResults()} disabled={saving}>
              {saving ? "Saving…" : "Save Progress"}
            </Button>
          </div>
        )}
      </div>

      {/* Create RO modal */}
      {showCreateRO && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-background border border-border rounded-xl shadow-xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold">Create RO from Issues</h2>
              <button onClick={() => setShowCreateRO(false)}><X className="h-5 w-5 text-muted-foreground" /></button>
            </div>
            <p className="text-sm text-muted-foreground">Select which issues to add as line items on the new RO.</p>
            <div className="space-y-2">
              {flaggedItems.map((item) => {
                const val = values[item.id];
                return (
                  <label key={item.id} className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={flaggedSelected.has(item.id)}
                      onChange={(e) => {
                        const next = new Set(flaggedSelected);
                        e.target.checked ? next.add(item.id) : next.delete(item.id);
                        setFlaggedSelected(next);
                      }}
                      className="mt-0.5"
                    />
                    <div>
                      <span className="text-sm font-medium text-foreground">{item.label}</span>
                      <span className={`ml-2 text-xs px-1.5 py-0.5 rounded font-medium ${val === "critical" || val === "fail" ? "bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300" : "bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300"}`}>
                        {val}
                      </span>
                    </div>
                  </label>
                );
              })}
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Customer Name (optional)</Label>
              <Input
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Customer name…"
              />
            </div>
            {createROError && <p className="text-sm text-destructive">{createROError}</p>}
            <div className="flex gap-2">
              <Button onClick={handleCreateRO} disabled={creatingRO || flaggedSelected.size === 0} className="flex-1">
                {creatingRO ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Check className="h-4 w-4 mr-2" />}
                Create RO
              </Button>
              <Button variant="outline" onClick={() => setShowCreateRO(false)}>Cancel</Button>
            </div>
          </div>
        </div>
      )}

      {/* Link RO modal */}
      {showLinkRO && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-background border border-border rounded-xl shadow-xl max-w-sm w-full p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold">Link to Existing RO</h2>
              <button onClick={() => { setShowLinkRO(false); setLinkROId(""); setLinkError(null); }}>
                <X className="h-5 w-5 text-muted-foreground" />
              </button>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">RO ID</Label>
              <Input
                value={linkROId}
                onChange={(e) => setLinkROId(e.target.value)}
                placeholder="Paste RO ID…"
                className="font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground">Find the RO ID in the URL: /dashboard/ro/[RO ID]</p>
            </div>
            {linkError && <p className="text-sm text-destructive">{linkError}</p>}
            <div className="flex gap-2">
              <Button onClick={handleLinkRO} disabled={linking || !linkROId.trim()} className="flex-1">
                {linking ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Link2 className="h-4 w-4 mr-2" />}
                Link
              </Button>
              <Button variant="outline" onClick={() => { setShowLinkRO(false); setLinkROId(""); setLinkError(null); }}>Cancel</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
