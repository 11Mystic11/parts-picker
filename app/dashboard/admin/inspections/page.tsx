// [FEATURE: canned_inspections]
// Admin/manager inspection template manager — create, edit, soft-delete templates.
// Remove this file to disable.

"use client";

import { useState, useEffect, useCallback } from "react";
import { ClipboardCheck, Plus, Trash2, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";

interface TemplateItem {
  id?: string;
  label: string;
  checkType: "condition" | "passfail" | "measurement";
  unit: string | null;
  sortOrder: number;
}

interface Template {
  id: string;
  name: string;
  description: string | null;
  triggerMileage: number | null;
  triggerWindow: number | null;
  rooftopId: string | null;
  items: TemplateItem[];
}

const EMPTY_ITEM: TemplateItem = { label: "", checkType: "condition", unit: null, sortOrder: 0 };

export default function InspectionsAdminPage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  // Create form state
  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newTriggerMileage, setNewTriggerMileage] = useState("");
  const [newTriggerWindow, setNewTriggerWindow] = useState("2500");
  const [newItems, setNewItems] = useState<TemplateItem[]>([{ ...EMPTY_ITEM }]);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/inspection-templates");
    if (res.ok) {
      const { templates: data } = await res.json();
      setTemplates(data ?? []);
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const res = await fetch("/api/inspection-templates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: newName,
        description: newDescription || null,
        triggerMileage: newTriggerMileage ? parseInt(newTriggerMileage) : null,
        triggerWindow: newTriggerWindow ? parseInt(newTriggerWindow) : 2500,
        items: newItems.filter((i) => i.label.trim()),
      }),
    });
    setSaving(false);
    if (res.ok) {
      setShowCreate(false);
      setNewName("");
      setNewDescription("");
      setNewTriggerMileage("");
      setNewItems([{ ...EMPTY_ITEM }]);
      load();
    }
  }

  async function softDelete(id: string) {
    if (!confirm("Archive this template? It will no longer auto-attach to new ROs.")) return;
    await fetch(`/api/inspection-templates/${id}`, { method: "DELETE" });
    load();
  }

  return (
    <div className="p-6 max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <ClipboardCheck className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-2xl font-bold text-foreground">Inspection Templates</h1>
            <p className="text-sm text-muted-foreground">Manage multi-point inspection checklists</p>
          </div>
        </div>
        <Button size="sm" onClick={() => setShowCreate(!showCreate)}>
          <Plus className="h-4 w-4 mr-1.5" /> New Template
        </Button>
      </div>

      {/* Create form */}
      {showCreate && (
        <form onSubmit={create} className="border border-primary/30 rounded-xl p-5 space-y-4 bg-primary/5">
          <h2 className="font-semibold text-foreground">New Template</h2>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Name *</label>
              <input
                required
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g. Brake Inspection"
                className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Description</label>
              <input
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Auto-attach at mileage</label>
              <input
                type="number"
                value={newTriggerMileage}
                onChange={(e) => setNewTriggerMileage(e.target.value)}
                placeholder="e.g. 30000 (optional)"
                className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Trigger window (miles)</label>
              <input
                type="number"
                value={newTriggerWindow}
                onChange={(e) => setNewTriggerWindow(e.target.value)}
                className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="block text-xs text-muted-foreground">Checklist Items</label>
            {newItems.map((item, i) => (
              <div key={i} className="flex gap-2 items-center">
                <input
                  value={item.label}
                  onChange={(e) => {
                    const next = [...newItems];
                    next[i] = { ...item, label: e.target.value };
                    setNewItems(next);
                  }}
                  placeholder={`Item ${i + 1}`}
                  className="flex-1 border border-border rounded-lg px-3 py-2 text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                />
                <select
                  value={item.checkType}
                  onChange={(e) => {
                    const next = [...newItems];
                    next[i] = { ...item, checkType: e.target.value as TemplateItem["checkType"] };
                    setNewItems(next);
                  }}
                  className="border border-border rounded-lg px-2 py-2 text-xs bg-background text-foreground"
                >
                  <option value="condition">Condition</option>
                  <option value="passfail">Pass/Fail</option>
                  <option value="measurement">Measurement</option>
                </select>
                {item.checkType === "measurement" && (
                  <input
                    value={item.unit ?? ""}
                    onChange={(e) => {
                      const next = [...newItems];
                      next[i] = { ...item, unit: e.target.value || null };
                      setNewItems(next);
                    }}
                    placeholder="unit"
                    className="w-16 border border-border rounded-lg px-2 py-2 text-xs bg-background text-foreground"
                  />
                )}
                <button
                  type="button"
                  onClick={() => setNewItems(newItems.filter((_, j) => j !== i))}
                  className="text-muted-foreground hover:text-red-500"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setNewItems([...newItems, { ...EMPTY_ITEM, sortOrder: newItems.length }])}
            >
              + Add Item
            </Button>
          </div>

          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={() => setShowCreate(false)} className="flex-1">Cancel</Button>
            <Button type="submit" disabled={saving} className="flex-1">
              {saving ? "Creating…" : "Create Template"}
            </Button>
          </div>
        </form>
      )}

      {/* Template list */}
      {loading ? (
        <div className="text-sm text-muted-foreground animate-pulse">Loading…</div>
      ) : templates.length === 0 ? (
        <div className="text-center py-12 border border-border rounded-xl">
          <ClipboardCheck className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">No templates yet</p>
        </div>
      ) : (
        <div className="space-y-3">
          {templates.map((t) => (
            <div key={t.id} className="border border-border rounded-xl overflow-hidden">
              <div
                className="px-4 py-3 flex items-center justify-between gap-3 cursor-pointer hover:bg-surface-hover"
                onClick={() => setExpanded(expanded === t.id ? null : t.id)}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-foreground">{t.name}</span>
                    {t.triggerMileage && (
                      <span className="text-xs text-muted-foreground bg-surface px-1.5 py-0.5 rounded">
                        @ {t.triggerMileage.toLocaleString()} mi ± {t.triggerWindow?.toLocaleString() ?? 2500}
                      </span>
                    )}
                    {t.rooftopId === null && (
                      <span className="text-xs text-purple-600 dark:text-purple-400 bg-purple-100 dark:bg-purple-900/40 px-1.5 py-0.5 rounded">Global</span>
                    )}
                    <span className="text-xs text-muted-foreground">{t.items.length} items</span>
                  </div>
                  {t.description && <p className="text-xs text-muted-foreground mt-0.5">{t.description}</p>}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={(e) => { e.stopPropagation(); softDelete(t.id); }}
                    className="text-muted-foreground hover:text-red-500 p-1"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                  {expanded === t.id ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                </div>
              </div>

              {expanded === t.id && (
                <div className="border-t border-border divide-y divide-border">
                  {t.items.map((item, i) => (
                    <div key={item.id ?? i} className="px-4 py-2.5 flex items-center gap-3 text-sm">
                      <span className="flex-1 text-foreground">{item.label}</span>
                      <span className="text-xs text-muted-foreground capitalize">{item.checkType}</span>
                      {item.unit && <span className="text-xs text-muted-foreground">{item.unit}</span>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
