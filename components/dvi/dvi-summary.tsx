// [FEATURE: dvi]
// DVISummary — read-only summary card shown in the RO detail view and customer portal.
// Remove this file and its usage in app/dashboard/ro/[id]/page.tsx to disable.

"use client";

import { Camera, AlertTriangle, CheckCircle, Info } from "lucide-react";

interface DVIItem {
  id: string;
  label: string;
  condition: "ok" | "advisory" | "critical" | string;
  notes: string | null;
  photoUrls: string;
}

interface DVIReportData {
  id: string;
  status: string;
  items: DVIItem[];
}

interface DVISummaryProps {
  report: DVIReportData;
}

const CONDITION_CONFIG = {
  ok: { label: "OK", color: "text-green-600 dark:text-green-400", bg: "bg-green-50 dark:bg-green-950/40", icon: CheckCircle },
  advisory: { label: "Advisory", color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-50 dark:bg-amber-950/40", icon: AlertTriangle },
  critical: { label: "Critical", color: "text-red-600 dark:text-red-400", bg: "bg-red-50 dark:bg-red-950/40", icon: AlertTriangle },
};

export function DVISummary({ report }: DVISummaryProps) {
  const criticalCount = report.items.filter((i) => i.condition === "critical").length;
  const advisoryCount = report.items.filter((i) => i.condition === "advisory").length;

  return (
    <div className="border border-border rounded-lg overflow-hidden mt-6">
      <div className="px-4 py-2.5 bg-surface border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Camera className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-semibold text-foreground">Vehicle Inspection</span>
        </div>
        <div className="flex items-center gap-2 text-xs">
          {criticalCount > 0 && (
            <span className="px-2 py-0.5 rounded bg-red-100 dark:bg-red-950/40 text-red-600 dark:text-red-400 font-semibold">
              {criticalCount} Critical
            </span>
          )}
          {advisoryCount > 0 && (
            <span className="px-2 py-0.5 rounded bg-amber-100 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 font-semibold">
              {advisoryCount} Advisory
            </span>
          )}
          <span className={`px-2 py-0.5 rounded font-medium ${
            report.status === "complete"
              ? "bg-green-100 dark:bg-green-950/40 text-green-700 dark:text-green-300"
              : "bg-surface text-muted-foreground"
          }`}>
            {report.status === "complete" ? "Complete" : "In Progress"}
          </span>
        </div>
      </div>

      <div className="divide-y divide-border">
        {report.items.map((item) => {
          const config = CONDITION_CONFIG[item.condition as keyof typeof CONDITION_CONFIG] ?? CONDITION_CONFIG.ok;
          const Icon = config.icon;
          let photos: string[] = [];
          try { photos = JSON.parse(item.photoUrls); } catch { /* ignore */ }

          return (
            <div key={item.id} className="px-4 py-3 flex items-start gap-3">
              <div className={`mt-0.5 flex-shrink-0 p-1 rounded ${config.bg}`}>
                <Icon className={`h-3.5 w-3.5 ${config.color}`} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-foreground">{item.label}</span>
                  <span className={`text-xs font-semibold ${config.color}`}>{config.label}</span>
                </div>
                {item.notes && (
                  <p className="text-xs text-muted-foreground mt-0.5">{item.notes}</p>
                )}
                {photos.length > 0 && (
                  <div className="flex gap-1.5 mt-2 flex-wrap">
                    {photos.map((url, i) => (
                      <a key={i} href={url} target="_blank" rel="noopener noreferrer">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={url}
                          alt={`Photo ${i + 1}`}
                          className="w-14 h-14 object-cover rounded border border-border hover:opacity-80 transition-opacity"
                        />
                      </a>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}
        {report.items.length === 0 && (
          <div className="px-4 py-6 text-center">
            <Info className="h-6 w-6 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">No inspection items recorded yet</p>
          </div>
        )}
      </div>
    </div>
  );
}
