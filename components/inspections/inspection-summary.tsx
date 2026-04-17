// [FEATURE: canned_inspections]
// InspectionSummary — read-only summary card for inspections on the RO detail page.
// Remove this file and its usage to disable.

"use client";

import { ClipboardCheck, CheckCircle, AlertTriangle, XCircle } from "lucide-react";

interface ResultItem {
  templateItemId: string;
  value: string | null;
  notes: string | null;
}

interface TemplateItem {
  id: string;
  label: string;
  checkType: string;
  unit: string | null;
}

interface Inspection {
  id: string;
  status: string;
  template: {
    name: string;
    items: TemplateItem[];
  };
  results: ResultItem[];
}

function ResultDisplay({ item, result }: { item: TemplateItem; result: ResultItem | undefined }) {
  const value = result?.value ?? null;

  if (item.checkType === "condition") {
    if (!value) return <span className="text-muted-foreground text-xs">—</span>;
    const config = {
      ok: { icon: CheckCircle, color: "text-green-500" },
      advisory: { icon: AlertTriangle, color: "text-amber-500" },
      critical: { icon: XCircle, color: "text-red-500" },
    }[value] ?? { icon: CheckCircle, color: "text-muted-foreground" };
    const Icon = config.icon;
    return (
      <span className={`flex items-center gap-1 text-xs font-semibold ${config.color}`}>
        <Icon className="h-3.5 w-3.5" /> {value}
      </span>
    );
  }

  if (item.checkType === "passfail") {
    if (!value) return <span className="text-muted-foreground text-xs">—</span>;
    return (
      <span className={`text-xs font-semibold ${value === "pass" ? "text-green-500" : "text-red-500"}`}>
        {value.toUpperCase()}
      </span>
    );
  }

  if (item.checkType === "measurement") {
    if (!value) return <span className="text-muted-foreground text-xs">—</span>;
    return (
      <span className="text-xs font-mono text-foreground">
        {value}{item.unit ? ` ${item.unit}` : ""}
      </span>
    );
  }

  return <span className="text-xs text-muted-foreground">{value ?? "—"}</span>;
}

export function InspectionSummary({ inspections }: { inspections: Inspection[] }) {
  if (inspections.length === 0) return null;

  return (
    <div className="mt-6 space-y-4">
      {inspections.map((insp) => {
        const resultMap = new Map(insp.results.map((r) => [r.templateItemId, r]));
        const issueCount = insp.results.filter(
          (r) => r.value === "critical" || r.value === "advisory" || r.value === "fail"
        ).length;

        return (
          <div key={insp.id} className="border border-border rounded-lg overflow-hidden">
            <div className="px-4 py-2.5 bg-surface border-b border-border flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ClipboardCheck className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-semibold text-foreground">{insp.template.name}</span>
              </div>
              <div className="flex items-center gap-2 text-xs">
                {issueCount > 0 && (
                  <span className="px-2 py-0.5 rounded bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 font-semibold">
                    {issueCount} issue{issueCount !== 1 ? "s" : ""}
                  </span>
                )}
                <span className={`px-2 py-0.5 rounded font-medium ${
                  insp.status === "complete"
                    ? "bg-green-100 dark:bg-green-950/40 text-green-700 dark:text-green-300"
                    : "bg-surface text-muted-foreground"
                }`}>
                  {insp.status === "complete" ? "Complete" : "In Progress"}
                </span>
              </div>
            </div>

            <div className="divide-y divide-border">
              {insp.template.items.map((item) => {
                const result = resultMap.get(item.id);
                return (
                  <div key={item.id} className="px-4 py-2.5 flex items-center justify-between gap-3 text-sm">
                    <span className="text-foreground">{item.label}</span>
                    <div className="flex-shrink-0">
                      <ResultDisplay item={item} result={result} />
                      {result?.notes && (
                        <p className="text-xs text-muted-foreground mt-0.5">{result.notes}</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
