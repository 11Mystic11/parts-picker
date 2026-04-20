"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, Upload, FileText, CheckCircle2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

const EXAMPLE_CSV = `vin,year,make,model,trim,color,licensePlate,stockNumber,mileage,notes
1FTFW1E50NFA00001,2022,Ford,F-150,XLT,Oxford White,ABC1234,STK-001,15000,Clean title
2T1BURHE0GC123456,2021,Toyota,Camry,SE,Midnight Black,,STK-002,28500,`;

export default function LotVehiclesImportPage() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [csvText, setCsvText] = useState("");
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ created: number; errors: { row: number; error: string }[] } | null>(null);
  const [error, setError] = useState<string | null>(null);

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setCsvText((ev.target?.result as string) ?? "");
    reader.readAsText(file);
  }

  async function importCSV() {
    if (!csvText.trim()) return;
    setImporting(true);
    setError(null);
    setResult(null);
    const res = await fetch("/api/lot-vehicles/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ csv: csvText }),
    });
    const data = await res.json();
    if (res.ok) {
      setResult(data);
    } else {
      setError(data.error ?? "Import failed");
    }
    setImporting(false);
  }

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <Link href="/dashboard/lot-vehicles" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ChevronLeft className="h-4 w-4" />
        Lot Vehicles
      </Link>

      <div className="flex items-center gap-3">
        <Upload className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold text-foreground">Import Lot Vehicles</h1>
          <p className="text-sm text-muted-foreground">Upload a CSV file or paste CSV text below.</p>
        </div>
      </div>

      {/* Column reference */}
      <div className="border border-border rounded-lg p-4 space-y-2">
        <div className="flex items-center gap-2 text-sm font-medium text-foreground">
          <FileText className="h-4 w-4" />
          Required CSV columns
        </div>
        <div className="text-xs text-muted-foreground space-y-1">
          <p><span className="font-mono text-foreground">make</span>, <span className="font-mono text-foreground">model</span> — required</p>
          <p><span className="font-mono text-foreground">vin, year, trim, color, licensePlate, stockNumber, mileage, notes</span> — optional</p>
        </div>
        <button
          onClick={() => setCsvText(EXAMPLE_CSV)}
          className="text-xs text-primary hover:underline"
        >
          Load example CSV
        </button>
      </div>

      {/* File upload */}
      <div className="flex items-center gap-3">
        <input
          ref={fileRef}
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={handleFile}
        />
        <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
          <Upload className="h-4 w-4 mr-1.5" />
          Choose CSV file
        </Button>
        <span className="text-xs text-muted-foreground">or paste below</span>
      </div>

      <Textarea
        value={csvText}
        onChange={(e) => setCsvText(e.target.value)}
        placeholder="Paste CSV here…"
        rows={10}
        className="font-mono text-xs"
      />

      {error && (
        <div className="flex items-center gap-2 text-sm text-destructive">
          <AlertCircle className="h-4 w-4" />
          {error}
        </div>
      )}

      {result && (
        <div className="border border-border rounded-lg p-4 space-y-2">
          <div className="flex items-center gap-2 text-sm font-medium text-green-600">
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

      <div className="flex gap-3">
        <Button onClick={importCSV} disabled={importing || !csvText.trim()}>
          {importing ? "Importing…" : "Import"}
        </Button>
        <Link href="/dashboard/lot-vehicles">
          <Button variant="outline">Cancel</Button>
        </Link>
      </div>
    </div>
  );
}
