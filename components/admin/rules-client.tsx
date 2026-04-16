"use client";

import { useState, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Plus, Pencil, Trash2 } from "lucide-react";

const FALLBACK_OEMS = ["GM", "Ford", "Toyota", "Honda", "Stellantis", "BMW", "Mercedes"];
const URGENCY_OPTIONS = ["urgent", "suggested", "informational"] as const;

type Tab = "schedules" | "parts" | "labor" | "otpr";

// ── Entity types ──────────────────────────────────────────────────────────────

type Schedule = {
  id: string; oem: string; mileageInterval: number;
  serviceDefinitions: string; notes: string | null;
};

type Part = {
  id: string; oem: string; partNumber: string; name: string;
  description: string | null; defaultCost: number;
  conditions: string; serviceIds: string; quantityRule: string;
  isKit: boolean; kitParts: string;
};

type LaborOp = {
  id: string; oem: string; opCode: string; name: string;
  description: string | null; flatRateHours: number;
  serviceIds: string; conditions: string;
};

type OTPRRule = {
  id: string; oem: string; name: string; description: string | null;
  serviceCategory: string; mileageThreshold: number;
  partNumbers: string; urgencyTier: string; conditions: string; isActive: boolean;
};

// ── Textarea helper ───────────────────────────────────────────────────────────

function Textarea({ label, value, onChange, placeholder, rows = 3 }: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; rows?: number;
}) {
  return (
    <div className="space-y-1">
      <Label>{label}</Label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        className="w-full rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 font-mono resize-y"
      />
    </div>
  );
}

// ── Form state helpers ────────────────────────────────────────────────────────

const EMPTY_SCHEDULE: Omit<Schedule, "id"> = {
  oem: "", mileageInterval: 5000, serviceDefinitions: "[]", notes: "",
};
const EMPTY_PART: Omit<Part, "id"> = {
  oem: "", partNumber: "", name: "", description: "",
  defaultCost: 0, conditions: "{}", serviceIds: "[]",
  quantityRule: "1", isKit: false, kitParts: "[]",
};
const EMPTY_LABOR: Omit<LaborOp, "id"> = {
  oem: "", opCode: "", name: "", description: "",
  flatRateHours: 0.5, serviceIds: "[]", conditions: "{}",
};
const EMPTY_OTPR: Omit<OTPRRule, "id"> = {
  oem: "", name: "", description: "", serviceCategory: "",
  mileageThreshold: 30000, partNumbers: "[]",
  urgencyTier: "suggested", conditions: "{}", isActive: true,
};

// ── Main component ────────────────────────────────────────────────────────────

export function RulesClient({ oemList: rawOemList }: { oemList: string[] }) {
  const oemList = rawOemList.length > 0 ? rawOemList : FALLBACK_OEMS;

  const [activeTab, setActiveTab] = useState<Tab>("schedules");
  const [selectedOem, setSelectedOem] = useState<string>("");

  // Data per tab
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [parts, setParts] = useState<Part[]>([]);
  const [laborOps, setLaborOps] = useState<LaborOp[]>([]);
  const [otprRules, setOtprRules] = useState<OTPRRule[]>([]);
  const [fetchedTabs, setFetchedTabs] = useState<Set<string>>(new Set());
  const [loadingTab, setLoadingTab] = useState(false);

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"add" | "edit">("add");
  const [submitting, setSubmitting] = useState(false);
  const [modalError, setModalError] = useState("");

  // Form state (one per tab type)
  const [scheduleForm, setScheduleForm] = useState<Omit<Schedule, "id">>(EMPTY_SCHEDULE);
  const [partForm, setPartForm] = useState<Omit<Part, "id">>(EMPTY_PART);
  const [laborForm, setLaborForm] = useState<Omit<LaborOp, "id">>(EMPTY_LABOR);
  const [otprForm, setOtprForm] = useState<Omit<OTPRRule, "id">>(EMPTY_OTPR);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Delete confirm
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // ── Fetch ──────────────────────────────────────────────────────────────────

  const fetchTab = useCallback(async (tab: Tab, oem: string) => {
    setLoadingTab(true);
    const oemParam = oem ? `?oem=${encodeURIComponent(oem)}` : "";
    const entityMap: Record<Tab, string> = {
      schedules: "schedules", parts: "parts", labor: "labor", otpr: "otpr",
    };
    const res = await fetch(`/api/admin/rules/${entityMap[tab]}${oemParam}`);
    const data = await res.json();
    if (tab === "schedules") setSchedules(data.schedules ?? []);
    if (tab === "parts") setParts(data.parts ?? []);
    if (tab === "labor") setLaborOps(data.laborOps ?? []);
    if (tab === "otpr") setOtprRules(data.rules ?? []);
    setFetchedTabs((prev) => new Set([...prev, `${tab}:${oem}`]));
    setLoadingTab(false);
  }, []);

  function handleTabChange(tab: Tab) {
    setActiveTab(tab);
    setConfirmDeleteId(null);
    const key = `${tab}:${selectedOem}`;
    if (!fetchedTabs.has(key)) fetchTab(tab, selectedOem);
  }

  function handleOemChange(oem: string | null) {
    if (oem === null) return;
    setSelectedOem(oem);
    setConfirmDeleteId(null);
    const key = `${activeTab}:${oem}`;
    if (!fetchedTabs.has(key)) fetchTab(activeTab, oem);
    else {
      // Re-fetch to refresh
      fetchTab(activeTab, oem);
    }
  }

  // Fetch initial tab on first render
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { fetchTab("schedules", ""); }, []);

  // ── Open modal ─────────────────────────────────────────────────────────────

  function openAdd() {
    setModalMode("add");
    setEditingId(null);
    setModalError("");
    if (activeTab === "schedules") setScheduleForm({ ...EMPTY_SCHEDULE, oem: selectedOem || oemList[0] });
    if (activeTab === "parts") setPartForm({ ...EMPTY_PART, oem: selectedOem || oemList[0] });
    if (activeTab === "labor") setLaborForm({ ...EMPTY_LABOR, oem: selectedOem || oemList[0] });
    if (activeTab === "otpr") setOtprForm({ ...EMPTY_OTPR, oem: selectedOem || oemList[0] });
    setModalOpen(true);
  }

  function openEdit(item: Schedule | Part | LaborOp | OTPRRule) {
    setModalMode("edit");
    setEditingId(item.id);
    setModalError("");
    if (activeTab === "schedules") setScheduleForm(item as Schedule);
    if (activeTab === "parts") setPartForm(item as Part);
    if (activeTab === "labor") setLaborForm(item as LaborOp);
    if (activeTab === "otpr") setOtprForm(item as OTPRRule);
    setModalOpen(true);
  }

  // ── Validate JSON fields ───────────────────────────────────────────────────

  function validateJson(...fields: string[]): string | null {
    for (const f of fields) {
      try { JSON.parse(f); } catch { return `Invalid JSON: ${f.slice(0, 40)}`; }
    }
    return null;
  }

  // ── Submit ─────────────────────────────────────────────────────────────────

  async function handleSubmit() {
    setModalError("");

    // Validate JSON fields
    let jsonError: string | null = null;
    if (activeTab === "schedules") jsonError = validateJson(scheduleForm.serviceDefinitions);
    if (activeTab === "parts") jsonError = validateJson(partForm.serviceIds, partForm.conditions, partForm.kitParts);
    if (activeTab === "labor") jsonError = validateJson(laborForm.serviceIds, laborForm.conditions);
    if (activeTab === "otpr") jsonError = validateJson(otprForm.partNumbers, otprForm.conditions);
    if (jsonError) { setModalError(jsonError); return; }

    setSubmitting(true);

    const entityMap: Record<Tab, string> = {
      schedules: "schedules", parts: "parts", labor: "labor", otpr: "otpr",
    };
    const entity = entityMap[activeTab];
    const url = modalMode === "add"
      ? `/api/admin/rules/${entity}`
      : `/api/admin/rules/${entity}/${editingId}`;
    const method = modalMode === "add" ? "POST" : "PATCH";
    const body = activeTab === "schedules" ? scheduleForm
      : activeTab === "parts" ? partForm
      : activeTab === "labor" ? laborForm
      : otprForm;

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    setSubmitting(false);

    if (!res.ok) {
      const d = await res.json();
      setModalError(d.error ?? "Failed to save");
      return;
    }

    setModalOpen(false);
    // Refresh current tab
    setFetchedTabs((prev) => {
      const next = new Set(prev);
      next.delete(`${activeTab}:${selectedOem}`);
      return next;
    });
    fetchTab(activeTab, selectedOem);
  }

  // ── Delete ─────────────────────────────────────────────────────────────────

  async function handleDelete(id: string) {
    const entityMap: Record<Tab, string> = {
      schedules: "schedules", parts: "parts", labor: "labor", otpr: "otpr",
    };
    await fetch(`/api/admin/rules/${entityMap[activeTab]}/${id}`, { method: "DELETE" });
    setConfirmDeleteId(null);
    fetchTab(activeTab, selectedOem);
  }

  // ── Row actions ────────────────────────────────────────────────────────────

  function RowActions({ id, item }: { id: string; item: Schedule | Part | LaborOp | OTPRRule }) {
    return confirmDeleteId === id ? (
      <div className="flex items-center gap-1 justify-end">
        <span className="text-xs text-muted-foreground mr-1">Delete?</span>
        <Button size="sm" variant="destructive" onClick={() => handleDelete(id)}>Yes</Button>
        <Button size="sm" variant="outline" onClick={() => setConfirmDeleteId(null)}>No</Button>
      </div>
    ) : (
      <div className="flex items-center gap-1 justify-end">
        <Button size="sm" variant="ghost" onClick={() => openEdit(item)}>
          <Pencil className="h-3.5 w-3.5" />
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setConfirmDeleteId(id)}>
          <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
        </Button>
      </div>
    );
  }

  // ── Modal form content ─────────────────────────────────────────────────────

  function ModalForm() {
    const title = `${modalMode === "add" ? "Add" : "Edit"} ${
      activeTab === "schedules" ? "Schedule"
      : activeTab === "parts" ? "Part"
      : activeTab === "labor" ? "Labor Op"
      : "OTPR Rule"
    }`;

    return (
      <Dialog open={modalOpen} onOpenChange={(v) => { if (!v) setModalOpen(false); }}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
          </DialogHeader>

          <div className="space-y-3 mt-2">

            {/* OEM */}
            <div className="space-y-1">
              <Label>OEM</Label>
              <Select
                value={
                  activeTab === "schedules" ? scheduleForm.oem
                  : activeTab === "parts" ? partForm.oem
                  : activeTab === "labor" ? laborForm.oem
                  : otprForm.oem
                }
                onValueChange={(v) => {
                  if (v === null) return;
                  if (activeTab === "schedules") setScheduleForm((p) => ({ ...p, oem: v }));
                  if (activeTab === "parts") setPartForm((p) => ({ ...p, oem: v }));
                  if (activeTab === "labor") setLaborForm((p) => ({ ...p, oem: v }));
                  if (activeTab === "otpr") setOtprForm((p) => ({ ...p, oem: v }));
                }}
              >
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {oemList.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {/* Schedules */}
            {activeTab === "schedules" && <>
              <div className="space-y-1">
                <Label>Mileage interval</Label>
                <Input type="number" min={1000} step={1000}
                  value={scheduleForm.mileageInterval}
                  onChange={(e) => setScheduleForm((p) => ({ ...p, mileageInterval: parseInt(e.target.value) || 0 }))}
                />
              </div>
              <Textarea label="Service definitions (JSON array)"
                value={scheduleForm.serviceDefinitions}
                onChange={(v) => setScheduleForm((p) => ({ ...p, serviceDefinitions: v }))}
                placeholder={'[{"id":"oil-change","name":"Oil Change","category":"Engine","description":"...","isRequired":true}]'}
                rows={5}
              />
              <div className="space-y-1">
                <Label>Notes (optional)</Label>
                <Input value={scheduleForm.notes ?? ""}
                  onChange={(e) => setScheduleForm((p) => ({ ...p, notes: e.target.value }))}
                />
              </div>
            </>}

            {/* Parts */}
            {activeTab === "parts" && <>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Part number</Label>
                  <Input value={partForm.partNumber}
                    onChange={(e) => setPartForm((p) => ({ ...p, partNumber: e.target.value }))}
                    placeholder="ACDelco-PF48"
                  />
                </div>
                <div className="space-y-1">
                  <Label>Quantity rule</Label>
                  <Input value={partForm.quantityRule}
                    onChange={(e) => setPartForm((p) => ({ ...p, quantityRule: e.target.value }))}
                    placeholder="1"
                  />
                </div>
              </div>
              <div className="space-y-1">
                <Label>Name</Label>
                <Input value={partForm.name}
                  onChange={(e) => setPartForm((p) => ({ ...p, name: e.target.value }))}
                  placeholder="Oil Filter"
                />
              </div>
              <div className="space-y-1">
                <Label>Description (optional)</Label>
                <Input value={partForm.description ?? ""}
                  onChange={(e) => setPartForm((p) => ({ ...p, description: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <Label>Default cost ($)</Label>
                <Input type="number" min={0} step={0.01}
                  value={partForm.defaultCost}
                  onChange={(e) => setPartForm((p) => ({ ...p, defaultCost: parseFloat(e.target.value) || 0 }))}
                />
              </div>
              <Textarea label="Service IDs (JSON array)"
                value={partForm.serviceIds}
                onChange={(v) => setPartForm((p) => ({ ...p, serviceIds: v }))}
                placeholder='["gm-oil-change"]'
              />
              <Textarea label="Conditions (JSON)"
                value={partForm.conditions}
                onChange={(v) => setPartForm((p) => ({ ...p, conditions: v }))}
                placeholder='{"engines":["6.2L V8"],"drivetrains":["RWD"]}'
              />
              <div className="flex items-center gap-2">
                <input type="checkbox" id="isKit" checked={partForm.isKit}
                  onChange={(e) => setPartForm((p) => ({ ...p, isKit: e.target.checked }))}
                  className="rounded"
                />
                <Label htmlFor="isKit">Is kit (bundle of parts)</Label>
              </div>
              {partForm.isKit && (
                <Textarea label="Kit parts (JSON array of part numbers)"
                  value={partForm.kitParts}
                  onChange={(v) => setPartForm((p) => ({ ...p, kitParts: v }))}
                  placeholder='["PART-001","PART-002"]'
                />
              )}
            </>}

            {/* Labor */}
            {activeTab === "labor" && <>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Op code</Label>
                  <Input value={laborForm.opCode}
                    onChange={(e) => setLaborForm((p) => ({ ...p, opCode: e.target.value }))}
                    placeholder="GM-OIL-001"
                  />
                </div>
                <div className="space-y-1">
                  <Label>Flat rate hours</Label>
                  <Input type="number" min={0} step={0.1}
                    value={laborForm.flatRateHours}
                    onChange={(e) => setLaborForm((p) => ({ ...p, flatRateHours: parseFloat(e.target.value) || 0 }))}
                  />
                </div>
              </div>
              <div className="space-y-1">
                <Label>Name</Label>
                <Input value={laborForm.name}
                  onChange={(e) => setLaborForm((p) => ({ ...p, name: e.target.value }))}
                  placeholder="Engine Oil & Filter Change"
                />
              </div>
              <div className="space-y-1">
                <Label>Description (optional)</Label>
                <Input value={laborForm.description ?? ""}
                  onChange={(e) => setLaborForm((p) => ({ ...p, description: e.target.value }))}
                />
              </div>
              <Textarea label="Service IDs (JSON array)"
                value={laborForm.serviceIds}
                onChange={(v) => setLaborForm((p) => ({ ...p, serviceIds: v }))}
                placeholder='["gm-oil-change"]'
              />
              <Textarea label="Conditions (JSON)"
                value={laborForm.conditions}
                onChange={(v) => setLaborForm((p) => ({ ...p, conditions: v }))}
                placeholder='{}'
              />
            </>}

            {/* OTPR */}
            {activeTab === "otpr" && <>
              <div className="space-y-1">
                <Label>Name</Label>
                <Input value={otprForm.name}
                  onChange={(e) => setOtprForm((p) => ({ ...p, name: e.target.value }))}
                  placeholder="Coolant Flush at 60k"
                />
              </div>
              <div className="space-y-1">
                <Label>Description (optional)</Label>
                <Input value={otprForm.description ?? ""}
                  onChange={(e) => setOtprForm((p) => ({ ...p, description: e.target.value }))}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Service category</Label>
                  <Input value={otprForm.serviceCategory}
                    onChange={(e) => setOtprForm((p) => ({ ...p, serviceCategory: e.target.value }))}
                    placeholder="Cooling"
                  />
                </div>
                <div className="space-y-1">
                  <Label>Mileage threshold</Label>
                  <Input type="number" min={0} step={1000}
                    value={otprForm.mileageThreshold}
                    onChange={(e) => setOtprForm((p) => ({ ...p, mileageThreshold: parseInt(e.target.value) || 0 }))}
                  />
                </div>
              </div>
              <div className="space-y-1">
                <Label>Urgency tier</Label>
                <Select value={otprForm.urgencyTier}
                  onValueChange={(v) => { if (v !== null) setOtprForm((p) => ({ ...p, urgencyTier: v })); }}
                >
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {URGENCY_OPTIONS.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <Textarea label="Part numbers (JSON array)"
                value={otprForm.partNumbers}
                onChange={(v) => setOtprForm((p) => ({ ...p, partNumbers: v }))}
                placeholder='["COOLANT-GAL"]'
              />
              <Textarea label="Conditions (JSON)"
                value={otprForm.conditions}
                onChange={(v) => setOtprForm((p) => ({ ...p, conditions: v }))}
                placeholder='{}'
              />
              <div className="flex items-center gap-2">
                <input type="checkbox" id="isActive" checked={otprForm.isActive}
                  onChange={(e) => setOtprForm((p) => ({ ...p, isActive: e.target.checked }))}
                  className="rounded"
                />
                <Label htmlFor="isActive">Active</Label>
              </div>
            </>}

            {modalError && <p className="text-sm text-red-600">{modalError}</p>}
          </div>

          <DialogFooter>
            <Button onClick={handleSubmit} disabled={submitting} className="w-full mt-2">
              {submitting ? "Saving..." : modalMode === "add" ? "Create" : "Save changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  // ── Table helper ───────────────────────────────────────────────────────────

  function EmptyRow({ cols }: { cols: number }) {
    return (
      <tr>
        <td colSpan={cols} className="px-4 py-8 text-center text-sm text-muted-foreground">
          {loadingTab ? "Loading..." : "No records found. Add one above."}
        </td>
      </tr>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div>
      {/* OEM filter */}
      <div className="flex items-center gap-3 mb-6">
        <Label className="text-sm text-muted-foreground shrink-0">Filter by OEM:</Label>
        <Select value={selectedOem} onValueChange={handleOemChange}>
          <SelectTrigger className="w-40"><SelectValue placeholder="All OEMs" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="">All OEMs</SelectItem>
            {oemList.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => handleTabChange(v as Tab)}>
        <TabsList className="mb-4">
          <TabsTrigger value="schedules">Schedules</TabsTrigger>
          <TabsTrigger value="parts">Parts</TabsTrigger>
          <TabsTrigger value="labor">Labor</TabsTrigger>
          <TabsTrigger value="otpr">OTPR Rules</TabsTrigger>
        </TabsList>

        {/* Schedules */}
        <TabsContent value="schedules">
          <div className="flex justify-end mb-3">
            <Button size="sm" onClick={openAdd}>
              <Plus className="h-4 w-4 mr-1" /> Add schedule
            </Button>
          </div>
          <div className="border border-border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-surface border-b border-border">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">OEM</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Interval</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden md:table-cell">Services</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden md:table-cell">Notes</th>
                  <th className="px-4 py-3 w-24" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {schedules.length === 0 ? <EmptyRow cols={5} /> : schedules.map((s) => {
                  let count = 0;
                  try { count = JSON.parse(s.serviceDefinitions).length; } catch { /* */ }
                  return (
                    <tr key={s.id} className="hover:bg-surface-hover">
                      <td className="px-4 py-2"><Badge variant="outline">{s.oem}</Badge></td>
                      <td className="px-4 py-2 font-mono text-foreground">{s.mileageInterval.toLocaleString()} mi</td>
                      <td className="px-4 py-2 text-muted-foreground hidden md:table-cell">{count} service{count !== 1 ? "s" : ""}</td>
                      <td className="px-4 py-2 text-muted-foreground text-xs hidden md:table-cell truncate max-w-xs">{s.notes || "—"}</td>
                      <td className="px-4 py-2"><RowActions id={s.id} item={s} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </TabsContent>

        {/* Parts */}
        <TabsContent value="parts">
          <div className="flex justify-end mb-3">
            <Button size="sm" onClick={openAdd}>
              <Plus className="h-4 w-4 mr-1" /> Add part
            </Button>
          </div>
          <div className="border border-border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-surface border-b border-border">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">OEM</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Part #</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Name</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden md:table-cell">Cost</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden md:table-cell">Qty</th>
                  <th className="px-4 py-3 w-24" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {parts.length === 0 ? <EmptyRow cols={6} /> : parts.map((p) => (
                  <tr key={p.id} className="hover:bg-surface-hover">
                    <td className="px-4 py-2"><Badge variant="outline">{p.oem}</Badge></td>
                    <td className="px-4 py-2 font-mono text-xs text-foreground">{p.partNumber}</td>
                    <td className="px-4 py-2 font-medium text-foreground">{p.name}</td>
                    <td className="px-4 py-2 text-muted-foreground hidden md:table-cell">${p.defaultCost.toFixed(2)}</td>
                    <td className="px-4 py-2 text-muted-foreground hidden md:table-cell">{p.quantityRule}</td>
                    <td className="px-4 py-2"><RowActions id={p.id} item={p} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TabsContent>

        {/* Labor */}
        <TabsContent value="labor">
          <div className="flex justify-end mb-3">
            <Button size="sm" onClick={openAdd}>
              <Plus className="h-4 w-4 mr-1" /> Add labor op
            </Button>
          </div>
          <div className="border border-border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-surface border-b border-border">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">OEM</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Op code</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Name</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden md:table-cell">Hours</th>
                  <th className="px-4 py-3 w-24" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {laborOps.length === 0 ? <EmptyRow cols={5} /> : laborOps.map((l) => (
                  <tr key={l.id} className="hover:bg-surface-hover">
                    <td className="px-4 py-2"><Badge variant="outline">{l.oem}</Badge></td>
                    <td className="px-4 py-2 font-mono text-xs text-foreground">{l.opCode}</td>
                    <td className="px-4 py-2 font-medium text-foreground">{l.name}</td>
                    <td className="px-4 py-2 text-muted-foreground hidden md:table-cell">{l.flatRateHours}h</td>
                    <td className="px-4 py-2"><RowActions id={l.id} item={l} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TabsContent>

        {/* OTPR */}
        <TabsContent value="otpr">
          <div className="flex justify-end mb-3">
            <Button size="sm" onClick={openAdd}>
              <Plus className="h-4 w-4 mr-1" /> Add OTPR rule
            </Button>
          </div>
          <div className="border border-border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-surface border-b border-border">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">OEM</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Name</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden md:table-cell">Mileage</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden md:table-cell">Urgency</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden md:table-cell">Active</th>
                  <th className="px-4 py-3 w-24" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {otprRules.length === 0 ? <EmptyRow cols={6} /> : otprRules.map((r) => (
                  <tr key={r.id} className="hover:bg-surface-hover">
                    <td className="px-4 py-2"><Badge variant="outline">{r.oem}</Badge></td>
                    <td className="px-4 py-2 font-medium text-foreground">{r.name}</td>
                    <td className="px-4 py-2 text-muted-foreground hidden md:table-cell font-mono">{r.mileageThreshold.toLocaleString()} mi</td>
                    <td className="px-4 py-2 hidden md:table-cell">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                        r.urgencyTier === "urgent" ? "bg-red-100 text-red-700"
                        : r.urgencyTier === "suggested" ? "bg-amber-100 text-amber-700"
                        : "bg-surface text-foreground"
                      }`}>
                        {r.urgencyTier}
                      </span>
                    </td>
                    <td className="px-4 py-2 hidden md:table-cell">
                      <span className={`text-xs font-medium ${r.isActive ? "text-green-600" : "text-muted-foreground"}`}>
                        {r.isActive ? "Yes" : "No"}
                      </span>
                    </td>
                    <td className="px-4 py-2"><RowActions id={r.id} item={r} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TabsContent>
      </Tabs>

      <ModalForm />
    </div>
  );
}
