"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, Upload, FileText, CheckCircle2, AlertCircle, Sparkles, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { ParsedVehicle } from "@/app/api/lot-vehicles/import/ai-parse/route";

const EXAMPLE_CSV = `vin,year,make,model,trim,color,licensePlate,stockNumber,mileage,notes
1FTFW1E50NFA00001,2022,Ford,F-150,XLT,Oxford White,ABC1234,STK-001,15000,Clean title
2T1BURHE0GC123456,2021,Toyota,Camry,SE,Midnight Black,,STK-002,28500,`;

type ImportResult = { created: number; errors: { row: number; error: string }[] };

export default function LotVehiclesImportPage() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [csvText, setCsvText] = useState("");
  const [parsing, setParsing] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [preview, setPreview] = useState<ParsedVehicle[] | null>(null);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setCsvText((ev.target?.result as string) ?? "");
      setPreview(null);
      setParseError(null);
      setResult(null);
    };
    reader.readAsText(file);
  }

  async function parseWithAI() {
    if (!csvText.trim()) return;
    setParsing(true);
    setParseError(null);
    setPreview(null);
    setResult(null);
    try {
      const res = await fetch("/api/lot-vehicles/import/ai-parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csv: csvText }),
      });
      const data = await res.json();
      if (res.ok) {
        setPreview(data.vehicles ?? []);
      } else {
        setParseError(data.error ?? "AI parsing failed");
      }
    } catch {
      setParseError("Network error. Please try again.");
    }
    setParsing(false);
  }

  async function importVehicles() {
    const payload = preview ? { vehicles: preview } : { csv: csvText };
    setImporting(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/lot-vehicles/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (res.ok) {
        setResult(data);
        setPreview(null);
      } else {
        setError(data.error ?? "Import failed");
      }
    } catch {
      setError("Network error. Please try again.");
    }
    setImporting(false);
  }

  function removePreviewRow(idx: number) {
    if (!preview) return;
    const updated = preview.filter((_, i) => i !== idx);
    setPreview(updated.length > 0 ? updated : null);
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <Link href="/dashboard/lot-vehicles" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ChevronLeft className="h-4 w-4" />
        Lot Vehicles
      </Link>

      <div className="flex items-center gap-3">
        <Upload className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold text-foreground">Import Lot Vehicles</h1>
          <p className="text-sm text-muted-foreground">Upload any CSV format — AI will map the columns automatically.</p>
        </div>
      </div>

      {/* Column reference */}
      <div className="border border-border rounded-lg p-4 space-y-2">
        <div className="flex items-center gap-2 text-sm font-medium text-foreground">
          <FileText className="h-4 w-4" />
          Accepted fields
        </div>
        <p className="text-xs text-muted-foreground">
          <span className="font-mono text-foreground">make</span>, <span className="font-mono text-foreground">model</span> — required &nbsp;·&nbsp;
          <span className="font-mono text-foreground">vin, year, trim, color, licensePlate, stockNumber, mileage, notes</span> — optional
        </p>
        <p className="text-xs text-muted-foreground">Column names don't need to match exactly — use <span className="font-medium">Parse with AI</span> and it will figure out the mapping.</p>
        <button onClick={() => { setCsvText(EXAMPLE_CSV); setPreview(null); }} className="text-xs text-primary hover:underline">
          Load example CSV
        </button>
      </div>

      {/* File upload + textarea */}
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={handleFile} />
          <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
            <Upload className="h-4 w-4 mr-1.5" />
            Choose CSV file
          </Button>
          <span className="text-xs text-muted-foreground">or paste below</span>
        </div>

        <Textarea
          value={csvText}
          onChange={(e) => { setCsvText(e.target.value); setPreview(null); setParseError(null); setResult(null); }}
          placeholder="Paste CSV here — any column format accepted…"
          rows={8}
          className="font-mono text-xs"
        />

        {parseError && (
          <div className="flex items-start gap-2 text-sm text-destructive">
            <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
            {parseError}
          </div>
        )}
      </div>

      {/* AI parse button */}
      {!preview && !result && (
        <div className="flex gap-3">
          <Button onClick={parseWithAI} disabled={parsing || !csvText.trim()} variant="outline">
            {parsing ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Sparkles className="h-4 w-4 mr-1.5" />}
            {parsing ? "Parsing…" : "Parse with AI"}
          </Button>
          <Button onClick={importVehicles} disabled={importing || !csvText.trim()} variant="ghost" className="text-muted-foreground text-xs">
            Import raw (exact column names required)
          </Button>
        </div>
      )}

      {/* AI preview table */}
      {preview && preview.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-foreground">
              AI parsed <span className="text-primary">{preview.length}</span> vehicle{preview.length !== 1 ? "s" : ""} — review before importing
            </p>
            <Button size="sm" variant="ghost" onClick={() => setPreview(null)} className="text-xs text-muted-foreground">
              <X className="h-3 w-3 mr-1" /> Clear
            </Button>
          </div>

          <div className="border border-border rounded-lg overflow-auto max-h-96">
            <table className="w-full text-xs">
              <thead className="bg-surface border-b border-border sticky top-0">
                <tr>
                  <th className="text-left px-3 py-2 text-muted-foreground font-medium">Year</th>
                  <th className="text-left px-3 py-2 text-muted-foreground font-medium">Make</th>
                  <th className="text-left px-3 py-2 text-muted-foreground font-medium">Model</th>
                  <th className="text-left px-3 py-2 text-muted-foreground font-medium">Trim</th>
                  <th className="text-left px-3 py-2 text-muted-foreground font-medium">Color</th>
                  <th className="text-left px-3 py-2 text-muted-foreground font-medium font-mono">VIN</th>
                  <th className="text-left px-3 py-2 text-muted-foreground font-medium">Stock #</th>
                  <th className="text-left px-3 py-2 text-muted-foreground font-medium">Mileage</th>
                  <th className="text-left px-3 py-2 text-muted-foreground font-medium">Plate</th>
                  <th className="px-2 py-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {preview.map((v, i) => (
                  <tr key={i} className="hover:bg-surface transition-colors">
                    <td className="px-3 py-2 text-foreground">{v.year ?? <span className="text-muted-foreground">—</span>}</td>
                    <td className="px-3 py-2 text-foreground font-medium">{v.make}</td>
                    <td className="px-3 py-2 text-foreground">{v.model}</td>
                    <td className="px-3 py-2 text-muted-foreground">{v.trim ?? "—"}</td>
                    <td className="px-3 py-2 text-muted-foreground">{v.color ?? "—"}</td>
                    <td className="px-3 py-2 font-mono text-muted-foreground">{v.vin ?? "—"}</td>
                    <td className="px-3 py-2 text-muted-foreground">{v.stockNumber ?? "—"}</td>
                    <td className="px-3 py-2 text-muted-foreground">{v.mileage != null ? v.mileage.toLocaleString() : "—"}</td>
                    <td className="px-3 py-2 font-mono text-muted-foreground">{v.licensePlate ?? "—"}</td>
                    <td className="px-2 py-2">
                      <button
                        onClick={() => removePreviewRow(i)}
                        className="text-muted-foreground hover:text-destructive transition-colors"
                        title="Remove this row"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex gap-3">
            <Button onClick={importVehicles} disabled={importing}>
              {importing ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <CheckCircle2 className="h-4 w-4 mr-1.5" />}
              {importing ? "Importing…" : `Import ${preview.length} vehicle${preview.length !== 1 ? "s" : ""}`}
            </Button>
            <Button variant="outline" onClick={() => setPreview(null)}>Back</Button>
          </div>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 text-sm text-destructive">
          <AlertCircle className="h-4 w-4" />
          {error}
        </div>
      )}

      {result && (
        <div className="border border-border rounded-lg p-4 space-y-2">
          <div className="flex items-center gap-2 text-sm font-medium text-green-600 dark:text-green-400">
            <CheckCircle2 className="h-4 w-4" />
            Import complete — {result.created} vehicle{result.created !== 1 ? "s" : ""} created
          </div>
          {result.errors.length > 0 && (
            <div className="space-y-1">
              <p className="text-xs font-medium text-destructive">{result.errors.length} row{result.errors.length !== 1 ? "s" : ""} failed:</p>
              {result.errors.map((e) => (
                <p key={e.row} className="text-xs text-destructive">Row {e.row}: {e.error}</p>
              ))}
            </div>
          )}
          <Link href="/dashboard/lot-vehicles">
            <Button size="sm" className="mt-2">View Lot Vehicles</Button>
          </Link>
        </div>
      )}

      {!preview && !result && (
        <Link href="/dashboard/lot-vehicles">
          <Button variant="outline">Cancel</Button>
        </Link>
      )}
    </div>
  );
}
