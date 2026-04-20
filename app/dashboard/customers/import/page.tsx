"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import { ChevronLeft, Upload, FileText, CheckCircle2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

const EXAMPLE_CSV = `name,phone,email,notes
John Smith,(555) 123-4567,john@example.com,Regular customer
Jane Doe,(555) 987-6543,,Prefers morning appointments`;

export default function CustomersImportPage() {
  const router = { push: (p: string) => { window.location.href = p; } };
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
    setImporting(true); setError(null); setResult(null);
    const res = await fetch("/api/customers/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ csv: csvText }),
    });
    const data = await res.json();
    if (res.ok) setResult(data); else setError(data.error ?? "Import failed");
    setImporting(false);
  }

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <Link href="/dashboard/customers" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ChevronLeft className="h-4 w-4" />Customers
      </Link>
      <div className="flex items-center gap-3">
        <Upload className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold text-foreground">Import Customers</h1>
          <p className="text-sm text-muted-foreground">Upload a CSV file or paste CSV text.</p>
        </div>
      </div>
      <div className="border border-border rounded-lg p-4 space-y-2">
        <div className="flex items-center gap-2 text-sm font-medium"><FileText className="h-4 w-4" />CSV columns</div>
        <p className="text-xs text-muted-foreground"><span className="font-mono text-foreground">name</span> — required · <span className="font-mono text-foreground">phone, email, notes</span> — optional</p>
        <button onClick={() => setCsvText(EXAMPLE_CSV)} className="text-xs text-primary hover:underline">Load example</button>
      </div>
      <div className="flex items-center gap-3">
        <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={handleFile} />
        <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}><Upload className="h-4 w-4 mr-1.5" />Choose CSV file</Button>
        <span className="text-xs text-muted-foreground">or paste below</span>
      </div>
      <Textarea value={csvText} onChange={(e) => setCsvText(e.target.value)} placeholder="Paste CSV here…" rows={8} className="font-mono text-xs" />
      {error && <div className="flex items-center gap-2 text-sm text-destructive"><AlertCircle className="h-4 w-4" />{error}</div>}
      {result && (
        <div className="border border-border rounded-lg p-4 space-y-2">
          <div className="flex items-center gap-2 text-sm font-medium text-green-600"><CheckCircle2 className="h-4 w-4" />Import complete — {result.created} customer{result.created !== 1 ? "s" : ""} created</div>
          {result.errors.length > 0 && <div className="space-y-1"><p className="text-xs font-medium text-destructive">{result.errors.length} failed:</p>{result.errors.map((e) => <p key={e.row} className="text-xs text-destructive">Row {e.row}: {e.error}</p>)}</div>}
          <Link href="/dashboard/customers"><Button size="sm" className="mt-2">View Customers</Button></Link>
        </div>
      )}
      <div className="flex gap-3">
        <Button onClick={importCSV} disabled={importing || !csvText.trim()}>{importing ? "Importing…" : "Import"}</Button>
        <Link href="/dashboard/customers"><Button variant="outline">Cancel</Button></Link>
      </div>
    </div>
  );
}
