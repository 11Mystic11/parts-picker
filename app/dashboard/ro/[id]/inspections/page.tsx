// [FEATURE: canned_inspections]
// Technician inspection results entry page for a specific RO.
// Remove this file to disable.

"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, ClipboardCheck, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { InspectionForm } from "@/components/inspections/inspection-form";

interface TemplateItem {
  id: string;
  label: string;
  checkType: string;
  unit: string | null;
  sortOrder: number;
}

interface Inspection {
  id: string;
  status: string;
  template: { name: string; items: TemplateItem[] };
  results: { templateItemId: string; value: string | null; notes: string | null }[];
}

interface Template {
  id: string;
  name: string;
}

export default function ROInspectionsPage() {
  const { id: roId } = useParams<{ id: string }>();
  const [inspections, setInspections] = useState<Inspection[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [attaching, setAttaching] = useState(false);
  const [showAttach, setShowAttach] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const [inspRes, tplRes] = await Promise.all([
      fetch(`/api/ro/${roId}/inspections`),
      fetch("/api/inspection-templates"),
    ]);
    if (inspRes.ok) {
      const { inspections: data } = await inspRes.json();
      setInspections(data ?? []);
    }
    if (tplRes.ok) {
      const { templates: tpls } = await tplRes.json();
      setTemplates(tpls ?? []);
    }
    setLoading(false);
  }, [roId]);

  useEffect(() => { load(); }, [load]);

  async function attach() {
    if (!selectedTemplate) return;
    setAttaching(true);
    await fetch(`/api/ro/${roId}/inspections`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ templateId: selectedTemplate }),
    });
    setAttaching(false);
    setShowAttach(false);
    setSelectedTemplate("");
    load();
  }

  const attachedIds = new Set(inspections.map((i) => i.template.name));
  const available = templates.filter((t) => !attachedIds.has(t.name));

  return (
    <div className="p-6 max-w-2xl space-y-6">
      <Link
        href={`/dashboard/ro/${roId}`}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="h-4 w-4" />
        Back to RO
      </Link>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ClipboardCheck className="h-5 w-5 text-primary" />
          <h1 className="text-xl font-bold text-foreground">Inspections</h1>
        </div>
        {available.length > 0 && (
          <Button size="sm" onClick={() => setShowAttach(!showAttach)}>
            <Plus className="h-4 w-4 mr-1.5" /> Add Inspection
          </Button>
        )}
      </div>

      {showAttach && (
        <div className="flex gap-2">
          <select
            value={selectedTemplate}
            onChange={(e) => setSelectedTemplate(e.target.value)}
            className="flex-1 border border-border rounded-lg px-3 py-2 text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="">— Select template —</option>
            {available.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
          <Button size="sm" onClick={attach} disabled={attaching || !selectedTemplate}>
            {attaching ? "Attaching…" : "Attach"}
          </Button>
        </div>
      )}

      {loading ? (
        <div className="text-sm text-muted-foreground animate-pulse">Loading…</div>
      ) : inspections.length === 0 ? (
        <div className="text-center py-12 border border-border rounded-xl">
          <ClipboardCheck className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">No inspections on this RO</p>
        </div>
      ) : (
        <div className="space-y-4">
          {inspections.map((insp) => (
            <InspectionForm
              key={insp.id}
              roId={roId}
              inspection={insp}
              onUpdated={(updated) =>
                setInspections((prev) => prev.map((i) => (i.id === updated.id ? updated : i)))
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}
