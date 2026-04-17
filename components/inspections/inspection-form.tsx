// [FEATURE: canned_inspections]
// InspectionForm — tech view for filling out inspection results on an RO.
// Remove this file and its usage to disable.

"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { CheckCircle } from "lucide-react";

interface TemplateItem {
  id: string;
  label: string;
  checkType: string;
  unit: string | null;
  sortOrder: number;
}

interface InspectionResult {
  templateItemId: string;
  value: string | null;
  notes: string | null;
}

interface InspectionData {
  id: string;
  status: string;
  template: {
    name: string;
    items: TemplateItem[];
  };
  results: InspectionResult[];
}

interface InspectionFormProps {
  roId: string;
  inspection: InspectionData;
  onUpdated: (updated: InspectionData) => void;
}

export function InspectionForm({ roId, inspection, onUpdated }: InspectionFormProps) {
  const [values, setValues] = useState<Record<string, string | null>>(() => {
    const map: Record<string, string | null> = {};
    for (const r of inspection.results) {
      map[r.templateItemId] = r.value ?? null;
    }
    return map;
  });
  const [notes, setNotes] = useState<Record<string, string>>(() => {
    const map: Record<string, string> = {};
    for (const r of inspection.results) {
      if (r.notes) map[r.templateItemId] = r.notes;
    }
    return map;
  });
  const [saving, setSaving] = useState(false);
  const [completing, setCompleting] = useState(false);

  async function save(newValues = values, newNotes = notes) {
    setSaving(true);
    const results = inspection.template.items.map((item) => ({
      templateItemId: item.id,
      value: newValues[item.id] ?? null,
      notes: newNotes[item.id] ?? null,
    }));

    const res = await fetch(`/api/ro/${roId}/inspections/${inspection.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ results }),
    });

    if (res.ok) {
      const { inspection: updated } = await res.json();
      onUpdated(updated);
    }
    setSaving(false);
  }

  async function markComplete() {
    setCompleting(true);
    const results = inspection.template.items.map((item) => ({
      templateItemId: item.id,
      value: values[item.id] ?? null,
      notes: notes[item.id] ?? null,
    }));

    const res = await fetch(`/api/ro/${roId}/inspections/${inspection.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "complete", results }),
    });

    if (res.ok) {
      const { inspection: updated } = await res.json();
      onUpdated(updated);
    }
    setCompleting(false);
  }

  const isComplete = inspection.status === "complete";

  return (
    <div className={`border border-border rounded-lg overflow-hidden ${isComplete ? "opacity-75" : ""}`}>
      <div className="px-4 py-2.5 bg-surface border-b border-border flex items-center justify-between">
        <span className="text-sm font-semibold text-foreground">{inspection.template.name}</span>
        {!isComplete && (
          <Button size="sm" onClick={markComplete} disabled={completing}>
            <CheckCircle className="h-3.5 w-3.5 mr-1.5" />
            {completing ? "Saving…" : "Mark Complete"}
          </Button>
        )}
        {isComplete && (
          <span className="text-xs text-green-600 dark:text-green-400 font-semibold">✓ Complete</span>
        )}
      </div>

      <div className="divide-y divide-border">
        {inspection.template.items.map((item) => (
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
                      save(next, notes);
                    }}
                    className={`flex-1 py-1.5 rounded text-xs font-semibold border transition-colors ${
                      values[item.id] === c
                        ? c === "ok"
                          ? "bg-green-600 border-green-600 text-white"
                          : c === "advisory"
                          ? "bg-amber-500 border-amber-500 text-white"
                          : "bg-red-600 border-red-600 text-white"
                        : "border-border text-muted-foreground hover:bg-surface-hover"
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
                      save(next, notes);
                    }}
                    className={`flex-1 py-1.5 rounded text-xs font-semibold border transition-colors ${
                      values[item.id] === v
                        ? v === "pass"
                          ? "bg-green-600 border-green-600 text-white"
                          : "bg-red-600 border-red-600 text-white"
                        : "border-border text-muted-foreground hover:bg-surface-hover"
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
                  onBlur={() => save()}
                  placeholder="Enter value"
                  className="flex-1 border border-border rounded px-2 py-1.5 text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                />
                {item.unit && (
                  <span className="text-sm text-muted-foreground">{item.unit}</span>
                )}
              </div>
            )}

            <textarea
              disabled={isComplete}
              value={notes[item.id] ?? ""}
              onChange={(e) => setNotes((prev) => ({ ...prev, [item.id]: e.target.value }))}
              onBlur={() => save()}
              placeholder="Notes (optional)"
              rows={1}
              className="w-full border border-border rounded px-2 py-1.5 text-xs bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary resize-none"
            />
          </div>
        ))}
      </div>

      {!isComplete && (
        <div className="px-4 py-3 bg-surface border-t border-border">
          <Button size="sm" variant="outline" onClick={() => save()} disabled={saving}>
            {saving ? "Saving…" : "Save Progress"}
          </Button>
        </div>
      )}
    </div>
  );
}
