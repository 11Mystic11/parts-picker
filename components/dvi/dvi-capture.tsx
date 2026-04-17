// [FEATURE: dvi]
// DVICapture — client component for technicians to fill out a Digital Vehicle Inspection.
// Handles condition toggles, notes, photo capture/upload, and mark-complete action.
// Remove this file and its usage in app/dashboard/ro/[id]/dvi/page.tsx to disable.

"use client";

import { useState, useRef } from "react";
import { Camera, CheckCircle, AlertTriangle, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";

interface DVIItem {
  id: string;
  label: string;
  condition: string;
  notes: string | null;
  photoUrls: string;
}

interface DVIReport {
  id: string;
  status: string;
  items: DVIItem[];
}

interface DVICaptureProps {
  roId: string;
  initialReport: DVIReport;
}

const CONDITIONS = [
  { value: "ok", label: "OK", className: "bg-green-600 text-white border-green-600" },
  { value: "advisory", label: "Advisory", className: "bg-amber-500 text-white border-amber-500" },
  { value: "critical", label: "Critical", className: "bg-red-600 text-white border-red-600" },
] as const;

export function DVICapture({ roId, initialReport }: DVICaptureProps) {
  const [report, setReport] = useState(initialReport);
  const [saving, setSaving] = useState<string | null>(null);
  const [completing, setCompleting] = useState(false);
  const fileRefs = useRef<Record<string, HTMLInputElement | null>>({});

  async function updateItem(
    itemId: string,
    patch: Partial<Pick<DVIItem, "condition" | "notes">>
  ) {
    setSaving(itemId);
    const res = await fetch(`/api/ro/${roId}/dvi/items/${itemId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (res.ok) {
      const { item } = await res.json();
      setReport((prev) => ({
        ...prev,
        items: prev.items.map((i) => (i.id === itemId ? { ...i, ...item } : i)),
      }));
    }
    setSaving(null);
  }

  async function uploadPhoto(itemId: string, file: File) {
    setSaving(itemId);
    const form = new FormData();
    form.append("file", file);
    const res = await fetch(`/api/ro/${roId}/dvi/items/${itemId}/upload`, {
      method: "POST",
      body: form,
    });
    if (res.ok) {
      const { url } = await res.json();
      setReport((prev) => ({
        ...prev,
        items: prev.items.map((i) => {
          if (i.id !== itemId) return i;
          let urls: string[] = [];
          try { urls = JSON.parse(i.photoUrls); } catch { /* ignore */ }
          return { ...i, photoUrls: JSON.stringify([...urls, url]) };
        }),
      }));
    }
    setSaving(null);
  }

  async function removePhoto(itemId: string, url: string) {
    setSaving(itemId);
    await fetch(`/api/ro/${roId}/dvi/items/${itemId}/upload`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
    });
    setReport((prev) => ({
      ...prev,
      items: prev.items.map((i) => {
        if (i.id !== itemId) return i;
        let urls: string[] = [];
        try { urls = JSON.parse(i.photoUrls); } catch { /* ignore */ }
        return { ...i, photoUrls: JSON.stringify(urls.filter((u) => u !== url)) };
      }),
    }));
    setSaving(null);
  }

  async function markComplete() {
    setCompleting(true);
    const res = await fetch(`/api/ro/${roId}/dvi`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "complete" }),
    });
    if (res.ok) {
      const { report: updated } = await res.json();
      setReport(updated);
    }
    setCompleting(false);
  }

  const isComplete = report.status === "complete";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Camera className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold text-foreground">Vehicle Inspection</h2>
        </div>
        {!isComplete && (
          <Button size="sm" onClick={markComplete} disabled={completing}>
            <CheckCircle className="h-4 w-4 mr-1.5" />
            {completing ? "Saving…" : "Mark Complete"}
          </Button>
        )}
        {isComplete && (
          <span className="text-sm text-green-600 dark:text-green-400 font-semibold flex items-center gap-1">
            <CheckCircle className="h-4 w-4" /> Completed
          </span>
        )}
      </div>

      <div className="space-y-3">
        {report.items.map((item) => {
          let photos: string[] = [];
          try { photos = JSON.parse(item.photoUrls); } catch { /* ignore */ }

          return (
            <div
              key={item.id}
              className={`border border-border rounded-lg p-4 ${isComplete ? "opacity-75 pointer-events-none" : ""}`}
            >
              <p className="font-medium text-foreground mb-3">{item.label}</p>

              {/* Condition toggle */}
              <div className="flex gap-2 mb-3">
                {CONDITIONS.map((c) => (
                  <button
                    key={c.value}
                    disabled={!!saving}
                    onClick={() => updateItem(item.id, { condition: c.value })}
                    className={`flex-1 py-1.5 px-2 rounded text-xs font-semibold border transition-colors ${
                      item.condition === c.value
                        ? c.className
                        : "border-border text-muted-foreground hover:bg-surface-hover"
                    } ${saving === item.id ? "opacity-50" : ""}`}
                  >
                    {c.label}
                  </button>
                ))}
              </div>

              {/* Notes */}
              <textarea
                value={item.notes ?? ""}
                onChange={(e) => {
                  setReport((prev) => ({
                    ...prev,
                    items: prev.items.map((i) =>
                      i.id === item.id ? { ...i, notes: e.target.value } : i
                    ),
                  }));
                }}
                onBlur={() => updateItem(item.id, { notes: item.notes })}
                placeholder="Add notes…"
                rows={2}
                className="w-full text-sm border border-border rounded px-3 py-2 bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary resize-none"
              />

              {/* Photos */}
              <div className="mt-2 flex flex-wrap gap-2 items-center">
                {photos.map((url, i) => (
                  <div key={i} className="relative group">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={url}
                      alt={`Photo ${i + 1}`}
                      className="w-16 h-16 object-cover rounded border border-border"
                    />
                    <button
                      onClick={() => removePhoto(item.id, url)}
                      className="absolute top-0.5 right-0.5 bg-red-600 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                ))}

                {/* Camera capture / file upload */}
                <div>
                  <input
                    ref={(el) => { fileRefs.current[item.id] = el; }}
                    type="file"
                    accept="image/*,video/*"
                    capture="environment"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) uploadPhoto(item.id, file);
                      e.target.value = "";
                    }}
                  />
                  <button
                    onClick={() => fileRefs.current[item.id]?.click()}
                    disabled={!!saving}
                    className="flex items-center gap-1.5 text-xs text-primary border border-primary/30 rounded px-2.5 py-1.5 hover:bg-primary/5 transition-colors"
                  >
                    {saving === item.id ? (
                      <div className="h-3 w-3 border border-primary border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <Upload className="h-3 w-3" />
                    )}
                    Photo
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {report.items.length === 0 && (
        <div className="text-center py-12 border border-border rounded-lg">
          <Camera className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-muted-foreground text-sm">No inspection items on this RO</p>
        </div>
      )}

      {/* condition: advisory/critical items summary */}
      {report.items.some((i) => i.condition !== "ok") && (
        <div className="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 p-3">
          <div className="flex items-center gap-2 mb-1">
            <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            <span className="text-sm font-semibold text-amber-700 dark:text-amber-300">Items needing attention</span>
          </div>
          {report.items
            .filter((i) => i.condition !== "ok")
            .map((i) => (
              <p key={i.id} className="text-xs text-amber-600 dark:text-amber-400 ml-6">
                • {i.label} —{" "}
                <span className={i.condition === "critical" ? "font-bold" : ""}>{i.condition}</span>
              </p>
            ))}
        </div>
      )}
    </div>
  );
}
