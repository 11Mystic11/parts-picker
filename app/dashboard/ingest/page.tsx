"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Upload,
  FileText,
  CheckCircle,
  XCircle,
  Loader2,
  Car,
  ChevronRight,
  RefreshCw,
  Camera,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { ExtractedData, ExtractedService } from "@/lib/ingest/extract";

type IngestRecord = {
  id: string;
  fileName: string;
  mimeType: string;
  status: string;
  extractedData: ExtractedData | null;
  errorMessage: string | null;
  createdAt: string;
};

type UploadState =
  | { type: "idle" }
  | { type: "uploading"; fileName: string }
  | { type: "done"; id: string; data: ExtractedData }
  | { type: "error"; message: string };

const DOC_TYPE_LABELS: Record<string, string> = {
  repair_order: "Repair Order",
  estimate: "Estimate",
  oem_menu: "OEM Menu",
  invoice: "Invoice",
  unknown: "Unknown",
};

const DOC_TYPE_COLORS: Record<string, string> = {
  repair_order: "bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-300",
  estimate: "bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-300",
  oem_menu: "bg-purple-100 dark:bg-purple-900/40 text-purple-800 dark:text-purple-300",
  invoice: "bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300",
  unknown: "bg-surface text-muted-foreground",
};

const CONFIDENCE_COLORS: Record<string, string> = {
  high: "bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300",
  medium: "bg-yellow-100 dark:bg-yellow-900/40 text-yellow-700 dark:text-yellow-300",
  low: "bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300",
};

function fmt(n: number | undefined): string {
  if (n == null) return "—";
  return `$${n.toFixed(2)}`;
}

function ExtractionResult({
  data,
  onReset,
}: {
  data: ExtractedData;
  onReset: () => void;
}) {
  const router = useRouter();

  function startNewRO() {
    const params = new URLSearchParams();
    if (data.vin) params.set("vin", data.vin);
    if (data.mileage != null) params.set("mileage", String(data.mileage));
    router.push(`/dashboard/ro/new?${params.toString()}`);
  }

  return (
    <div className="mt-6 space-y-4">
      {/* Header badges */}
      <div className="flex items-center gap-2 flex-wrap">
        <span
          className={cn(
            "px-2.5 py-0.5 rounded-full text-xs font-semibold",
            DOC_TYPE_COLORS[data.documentType] ?? DOC_TYPE_COLORS.unknown
          )}
        >
          {DOC_TYPE_LABELS[data.documentType] ?? "Unknown"}
        </span>
        <span
          className={cn(
            "px-2.5 py-0.5 rounded-full text-xs font-semibold capitalize",
            CONFIDENCE_COLORS[data.confidence] ?? CONFIDENCE_COLORS.low
          )}
        >
          {data.confidence} confidence
        </span>
      </div>

      {/* Vehicle info */}
      {(data.vin || data.make || data.year || data.mileage != null) && (
        <div className="rounded-lg border border-border bg-surface px-4 py-3">
          <div className="flex items-center gap-2 text-sm font-medium text-foreground mb-2">
            <Car className="h-4 w-4" />
            Vehicle
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
            {data.vin && (
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">VIN</p>
                <p className="font-mono font-medium text-foreground">{data.vin}</p>
              </div>
            )}
            {(data.year || data.make || data.model) && (
              <div className="col-span-2">
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Vehicle</p>
                <p className="font-medium text-foreground">
                  {[data.year, data.make, data.model].filter(Boolean).join(" ")}
                </p>
              </div>
            )}
            {data.mileage != null && (
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Mileage</p>
                <p className="font-medium text-foreground">
                  {data.mileage.toLocaleString()} mi
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Services table */}
      {data.services.length > 0 && (
        <div className="rounded-lg border border-border overflow-hidden">
          <div className="px-4 py-2 bg-surface border-b border-border">
            <p className="text-sm font-medium text-foreground">
              Line Items ({data.services.length})
            </p>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-xs text-muted-foreground uppercase tracking-wide">
                <th className="px-4 py-2 text-left font-medium">Description</th>
                <th className="px-4 py-2 text-left font-medium">Part #</th>
                <th className="px-4 py-2 text-right font-medium">Qty</th>
                <th className="px-4 py-2 text-right font-medium">Unit Price</th>
                <th className="px-4 py-2 text-right font-medium">Labor Hrs</th>
              </tr>
            </thead>
            <tbody>
              {data.services.map((svc: ExtractedService, i: number) => (
                <tr key={i} className="border-b border-border/50 last:border-0">
                  <td className="px-4 py-2 text-foreground">{svc.description}</td>
                  <td className="px-4 py-2 font-mono text-muted-foreground text-xs">
                    {svc.partNumber ?? "—"}
                  </td>
                  <td className="px-4 py-2 text-right text-foreground">
                    {svc.quantity ?? "—"}
                  </td>
                  <td className="px-4 py-2 text-right text-foreground">
                    {fmt(svc.unitPrice)}
                  </td>
                  <td className="px-4 py-2 text-right text-foreground">
                    {svc.laborHours != null ? `${svc.laborHours}h` : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Totals */}
      {(data.totals.parts != null ||
        data.totals.labor != null ||
        data.totals.tax != null ||
        data.totals.total != null) && (
        <div className="rounded-lg border border-border px-4 py-3 text-sm">
          <p className="font-medium text-foreground mb-2">Totals</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <p className="text-xs text-muted-foreground">Parts</p>
              <p className="font-medium">{fmt(data.totals.parts)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Labor</p>
              <p className="font-medium">{fmt(data.totals.labor)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Tax</p>
              <p className="font-medium">{fmt(data.totals.tax)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Total</p>
              <p className="font-semibold text-foreground">{fmt(data.totals.total)}</p>
            </div>
          </div>
        </div>
      )}

      {/* Raw notes */}
      {data.rawNotes && (
        <div className="rounded-lg border border-border px-4 py-3 text-sm text-muted-foreground bg-surface">
          <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Notes</p>
          <p className="whitespace-pre-wrap">{data.rawNotes}</p>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-3 pt-2">
        {data.vin && (
          <Button onClick={startNewRO} className="gap-2">
            Start New RO
            <ChevronRight className="h-4 w-4" />
          </Button>
        )}
        <Button variant="outline" onClick={onReset} className="gap-2">
          <RefreshCw className="h-4 w-4" />
          Upload Another
        </Button>
      </div>
    </div>
  );
}

function HistoryRow({
  doc,
  onView,
}: {
  doc: IngestRecord;
  onView: (data: ExtractedData) => void;
}) {
  const dt = DOC_TYPE_LABELS[doc.extractedData?.documentType ?? "unknown"] ?? "Unknown";
  const date = new Date(doc.createdAt).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

  return (
    <tr className="border-b border-border last:border-0 text-sm hover:bg-surface-hover transition-colors">
      <td className="px-4 py-2.5 text-foreground truncate max-w-xs">{doc.fileName}</td>
      <td className="px-4 py-2.5 text-muted-foreground">{dt}</td>
      <td className="px-4 py-2.5">
        {doc.status === "done" ? (
          <span className="flex items-center gap-1 text-green-600 dark:text-green-400 text-xs font-medium">
            <CheckCircle className="h-3.5 w-3.5" /> Done
          </span>
        ) : (
          <span className="flex items-center gap-1 text-red-500 dark:text-red-400 text-xs font-medium">
            <XCircle className="h-3.5 w-3.5" /> Error
          </span>
        )}
      </td>
      <td className="px-4 py-2.5 text-muted-foreground text-xs">{date}</td>
      <td className="px-4 py-2.5">
        {doc.extractedData && (
          <button
            onClick={() => onView(doc.extractedData!)}
            className="text-primary hover:underline text-xs font-medium"
          >
            View
          </button>
        )}
      </td>
    </tr>
  );
}

export default function IngestPage() {
  const [uploadState, setUploadState] = useState<UploadState>({ type: "idle" });
  const [isDragging, setIsDragging] = useState(false);
  const [history, setHistory] = useState<IngestRecord[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/ingest")
      .then((r) => r.json())
      .then((data) => setHistory(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, [uploadState]);

  async function handleFile(file: File) {
    setUploadState({ type: "uploading", fileName: file.name });

    const fd = new FormData();
    fd.append("file", file);

    try {
      const res = await fetch("/api/ingest/upload", { method: "POST", body: fd });
      const json = await res.json();

      if (!res.ok) {
        setUploadState({ type: "error", message: json.error ?? "Upload failed" });
        return;
      }

      if (json.status === "error") {
        setUploadState({ type: "error", message: json.errorMessage ?? "Extraction failed" });
        return;
      }

      setUploadState({ type: "done", id: json.id, data: json.extractedData });
    } catch {
      setUploadState({ type: "error", message: "Network error. Please try again." });
    }
  }

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = "";
  };

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, []);

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const onDragLeave = () => setIsDragging(false);

  const reset = () => setUploadState({ type: "idle" });

  const viewHistoric = (data: ExtractedData) => {
    setUploadState({ type: "done", id: "historic", data });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="p-6 max-w-4xl">
      <h1 className="text-2xl font-bold text-foreground mb-1">Document Ingest</h1>
      <p className="text-muted-foreground mb-6">
        Upload a scanned RO, estimate, or OEM price sheet — Claude will extract the
        structured data for you.
      </p>

      {/* Upload zone — shown when idle or error */}
      {(uploadState.type === "idle" || uploadState.type === "error") && (
        <div
          onDrop={onDrop}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onClick={() => fileInputRef.current?.click()}
          className={cn(
            "rounded-xl border-2 border-dashed transition-colors cursor-pointer flex flex-col items-center justify-center py-16 text-center select-none",
            isDragging
              ? "border-primary bg-primary/10"
              : "border-border hover:border-primary/50 hover:bg-surface"
          )}
        >
          <Upload
            className={cn(
              "h-10 w-10 mb-3 transition-colors",
              isDragging ? "text-primary" : "text-muted-foreground/40"
            )}
          />
          <p className="text-sm font-medium text-foreground">
            Drop a file here, or{" "}
            <span className="text-primary">click to browse</span>
          </p>
          <p className="text-xs text-muted-foreground mt-1">PNG, JPG, WebP, or PDF — max 10 MB</p>

          {/* Camera capture — only visible on touch/mobile devices */}
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); cameraInputRef.current?.click(); }}
            className="md:hidden mt-4 flex items-center gap-1.5 text-sm text-primary font-medium border border-primary/30 rounded-md px-3 py-1.5 hover:bg-primary/10 transition-colors"
          >
            <Camera className="h-4 w-4" />
            Take Photo
          </button>

          {uploadState.type === "error" && (
            <div className="mt-4 flex items-center gap-2 text-red-600 text-sm">
              <XCircle className="h-4 w-4" />
              {uploadState.message}
            </div>
          )}
        </div>
      )}

      {/* Loading state */}
      {uploadState.type === "uploading" && (
        <div className="rounded-xl border-2 border-dashed border-primary/30 bg-primary/5 py-16 flex flex-col items-center gap-3 text-center">
          <Loader2 className="h-10 w-10 text-primary animate-spin" />
          <p className="text-sm font-medium text-foreground">
            Extracting data from{" "}
            <span className="font-mono">{uploadState.fileName}</span>…
          </p>
          <p className="text-xs text-muted-foreground">Claude is reading the document</p>
        </div>
      )}

      {/* Result */}
      {uploadState.type === "done" && (
        <div className="rounded-xl glass border border-border/50 p-5 shadow-lg">
          <div className="flex items-center gap-2 text-green-600 text-sm font-medium mb-4">
            <CheckCircle className="h-4 w-4" />
            Extraction complete
          </div>
          <ExtractionResult data={uploadState.data} onReset={reset} />
        </div>
      )}

      {/* Hidden file inputs */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,application/pdf"
        className="hidden"
        onChange={onFileChange}
      />
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={onFileChange}
      />

      {/* History */}
      {history.length > 0 && (
        <div className="mt-10">
          <h2 className="text-base font-semibold text-foreground mb-3">Recent Uploads</h2>
          <div className="rounded-lg border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-surface border-b border-border text-xs text-muted-foreground uppercase tracking-wide">
                  <th className="px-4 py-2 text-left font-medium">File</th>
                  <th className="px-4 py-2 text-left font-medium">Type</th>
                  <th className="px-4 py-2 text-left font-medium">Status</th>
                  <th className="px-4 py-2 text-left font-medium">Date</th>
                  <th className="px-4 py-2 text-left font-medium" />
                </tr>
              </thead>
              <tbody>
                {history.map((doc) => (
                  <HistoryRow key={doc.id} doc={doc} onView={viewHistoric} />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
