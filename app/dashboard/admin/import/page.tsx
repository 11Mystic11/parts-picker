"use client";

import { useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type OEMEntityType =
  | "MaintenanceSchedule"
  | "PartsCatalog"
  | "LaborOperation"
  | "OTPRRule";

type DiffEntry = { field: string; from: unknown; to: unknown };

type ImportRecord = {
  action: "new" | "update";
  key: string;
  record: unknown;
  currentVersion?: number;
  changes?: DiffEntry[];
};

type PreviewResult = {
  entityType: OEMEntityType;
  records: ImportRecord[];
  newCount: number;
  updateCount: number;
  errors: string[];
};

type BatchHistoryItem = {
  id: string;
  entityType: string;
  recordCount: number;
  newCount: number;
  updatedCount: number;
  status: string;
  createdAt: string;
  importedBy: { name?: string; email?: string };
};

const ENTITY_LABELS: Record<OEMEntityType, string> = {
  MaintenanceSchedule: "Maintenance Schedules",
  PartsCatalog: "Parts Catalog",
  LaborOperation: "Labor Operations",
  OTPRRule: "OTPR Rules",
};

const EXAMPLE_PAYLOADS: Record<OEMEntityType, object[]> = {
  MaintenanceSchedule: [
    {
      oem: "GM",
      mileageInterval: 5000,
      serviceDefinitions: [
        { id: "gm-oil-change", name: "Engine Oil & Filter Change", category: "Fluid", description: "Full synthetic oil and filter", isRequired: true },
      ],
      notes: "Standard GM interval",
    },
  ],
  PartsCatalog: [
    {
      oem: "GM",
      partNumber: "ACDelco-PF48",
      name: "Oil Filter",
      description: "ACDelco PF48 engine oil filter",
      defaultCost: 8.5,
      conditions: {},
      serviceIds: ["gm-oil-change"],
      quantityRule: "1",
      isKit: false,
      kitParts: [],
    },
  ],
  LaborOperation: [
    {
      oem: "GM",
      opCode: "GM-OC-001",
      name: "Engine Oil & Filter Change",
      description: "Standard oil change flat rate",
      flatRateHours: 0.5,
      serviceIds: ["gm-oil-change"],
      conditions: {},
    },
  ],
  OTPRRule: [
    {
      oem: "GM",
      name: "Transmission Fluid Flush",
      description: "Flush and replace ATF at 60k",
      serviceCategory: "Transmission",
      mileageThreshold: 60000,
      partNumbers: ["ACDelco-10-9395"],
      urgencyTier: "suggested",
      conditions: {},
    },
  ],
};

function str(v: unknown): string {
  if (v === null || v === undefined) return "—";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

export default function ImportPage() {
  const [entityType, setEntityType] = useState<OEMEntityType>("MaintenanceSchedule");
  const [jsonText, setJsonText] = useState("");
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [commitLoading, setCommitLoading] = useState(false);
  const [commitResult, setCommitResult] = useState<{ batchId: string; newCount: number; updatedCount: number } | null>(null);
  const [commitError, setCommitError] = useState<string | null>(null);
  const [history, setHistory] = useState<BatchHistoryItem[] | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [rollbackLoading, setRollbackLoading] = useState<string | null>(null);
  const [rollbackError, setRollbackError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const loadHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const res = await fetch("/api/admin/import/history");
      const data = await res.json();
      setHistory(data.batches ?? []);
    } catch {
      setHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setJsonText(ev.target?.result as string ?? "");
    reader.readAsText(file);
  };

  const handlePreview = async () => {
    setPreview(null);
    setCommitResult(null);
    setCommitError(null);
    setPreviewLoading(true);
    try {
      let records: unknown[];
      try {
        records = JSON.parse(jsonText);
        if (!Array.isArray(records)) throw new Error("Must be a JSON array");
      } catch (e) {
        setPreview({ entityType, records: [], newCount: 0, updateCount: 0, errors: [`JSON parse error: ${e instanceof Error ? e.message : e}`] });
        return;
      }
      const res = await fetch("/api/admin/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entityType, records, mode: "preview" }),
      });
      const data = await res.json();
      setPreview(data);
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleCommit = async () => {
    if (!preview) return;
    setCommitLoading(true);
    setCommitError(null);
    try {
      let records: unknown[];
      try {
        records = JSON.parse(jsonText);
      } catch {
        setCommitError("Invalid JSON — re-run preview first");
        return;
      }
      const res = await fetch("/api/admin/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entityType, records, mode: "commit" }),
      });
      const data = await res.json();
      if (!res.ok) {
        setCommitError(data.error ?? "Commit failed");
      } else {
        setCommitResult(data);
        setPreview(null);
        setJsonText("");
        loadHistory();
      }
    } finally {
      setCommitLoading(false);
    }
  };

  const handleRollback = async (batchId: string) => {
    setRollbackLoading(batchId);
    setRollbackError(null);
    try {
      const res = await fetch("/api/admin/import/rollback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ batchId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setRollbackError(data.error ?? "Rollback failed");
      } else {
        loadHistory();
      }
    } finally {
      setRollbackLoading(null);
    }
  };

  return (
    <div className="p-6 max-w-5xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-foreground">OEM Data Import</h1>
        <p className="text-muted-foreground mt-1">
          Bulk-import versioned OEM rules. Each import creates a new version — previous versions are preserved and can be rolled back.
        </p>
      </div>

      {/* Entity type selector */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">1. Select entity type</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {(Object.keys(ENTITY_LABELS) as OEMEntityType[]).map((t) => (
            <button
              key={t}
              onClick={() => { setEntityType(t); setPreview(null); setCommitResult(null); }}
              className={`px-4 py-2 rounded-md text-sm font-medium border transition-colors ${
                entityType === t
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-surface text-foreground border-border hover:border-primary/50"
              }`}
            >
              {ENTITY_LABELS[t]}
            </button>
          ))}
        </CardContent>
      </Card>

      {/* JSON input */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">2. Paste JSON or upload file</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
              Upload .json file
            </Button>
            <input ref={fileRef} type="file" accept=".json,application/json" className="hidden" onChange={handleFileChange} />
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setJsonText(JSON.stringify(EXAMPLE_PAYLOADS[entityType], null, 2))}
            >
              Load example
            </Button>
          </div>
          <textarea
            className="w-full h-64 font-mono text-xs border rounded-md p-3 bg-background focus:outline-none focus:ring-2 focus:ring-primary"
            placeholder={`Paste a JSON array of ${ENTITY_LABELS[entityType]} records…`}
            value={jsonText}
            onChange={(e) => { setJsonText(e.target.value); setPreview(null); }}
          />
          <Button onClick={handlePreview} disabled={!jsonText.trim() || previewLoading}>
            {previewLoading ? "Previewing…" : "Preview changes"}
          </Button>
        </CardContent>
      </Card>

      {/* Preview / diff */}
      {preview && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-3">
              3. Review diff
              <Badge variant="outline" className="text-green-700 border-green-300">
                {preview.newCount} new
              </Badge>
              <Badge variant="outline" className="text-amber-700 border-amber-300">
                {preview.updateCount} updated
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {preview.errors.length > 0 && (
              <div className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-md p-3 space-y-1">
                <p className="text-sm font-medium text-red-800">Validation errors</p>
                {preview.errors.map((e, i) => (
                  <p key={i} className="text-xs text-red-700 font-mono">{e}</p>
                ))}
              </div>
            )}

            {preview.records.length > 0 && (
              <div className="border rounded-md overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-surface">
                    <tr>
                      <th className="px-4 py-2 text-left font-medium text-muted-foreground">Action</th>
                      <th className="px-4 py-2 text-left font-medium text-muted-foreground">Key</th>
                      <th className="px-4 py-2 text-left font-medium text-muted-foreground">Version</th>
                      <th className="px-4 py-2 text-left font-medium text-muted-foreground">Changes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {preview.records.map((rec, i) => (
                      <tr key={i} className="hover:bg-surface-hover">
                        <td className="px-4 py-2">
                          <Badge
                            variant="outline"
                            className={rec.action === "new"
                              ? "text-green-700 border-green-300 bg-green-50"
                              : "text-amber-700 border-amber-300 bg-amber-50"}
                          >
                            {rec.action === "new" ? "NEW" : "UPDATE"}
                          </Badge>
                        </td>
                        <td className="px-4 py-2 font-mono text-xs">{rec.key}</td>
                        <td className="px-4 py-2 text-xs text-muted-foreground">
                          {rec.action === "update"
                            ? `v${rec.currentVersion} → v${(rec.currentVersion ?? 0) + 1}`
                            : "v1"}
                        </td>
                        <td className="px-4 py-2">
                          {rec.changes && rec.changes.length > 0 ? (
                            <div className="space-y-1">
                              {rec.changes.map((ch, j) => (
                                <div key={j} className="text-xs font-mono">
                                  <span className="text-muted-foreground">{ch.field}: </span>
                                  <span className="text-red-600 line-through mr-1">{str(ch.from)}</span>
                                  <span className="text-green-700">{str(ch.to)}</span>
                                </div>
                              ))}
                            </div>
                          ) : rec.action === "new" ? (
                            <span className="text-xs text-muted-foreground">—</span>
                          ) : (
                            <span className="text-xs text-muted-foreground">No field changes</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {preview.errors.length === 0 && preview.records.length > 0 && (
              <div className="flex gap-3 pt-2">
                <Button onClick={handleCommit} disabled={commitLoading}>
                  {commitLoading ? "Committing…" : `Confirm import (${preview.records.length} records)`}
                </Button>
                <Button variant="outline" onClick={() => setPreview(null)}>Cancel</Button>
              </div>
            )}

            {commitError && (
              <p className="text-sm text-red-600">{commitError}</p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Commit success */}
      {commitResult && (
        <div className="bg-green-50 dark:bg-green-950/40 border border-green-200 dark:border-green-800 rounded-md p-4">
          <p className="text-sm font-medium text-green-800 dark:text-green-300">
            Import committed — {commitResult.newCount} new, {commitResult.updatedCount} updated
          </p>
          <p className="text-xs text-green-700 dark:text-green-400 mt-1 font-mono">Batch ID: {commitResult.batchId}</p>
        </div>
      )}

      {/* History */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Import history</CardTitle>
            <Button variant="outline" size="sm" onClick={loadHistory} disabled={historyLoading}>
              {historyLoading ? "Loading…" : "Refresh"}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {history === null ? (
            <p className="text-sm text-muted-foreground">Click Refresh to load history.</p>
          ) : history.length === 0 ? (
            <p className="text-sm text-muted-foreground">No import batches yet.</p>
          ) : (
            <div className="border rounded-md overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-surface">
                  <tr>
                    <th className="px-4 py-2 text-left font-medium text-muted-foreground">Date</th>
                    <th className="px-4 py-2 text-left font-medium text-muted-foreground">Entity</th>
                    <th className="px-4 py-2 text-left font-medium text-muted-foreground">Records</th>
                    <th className="px-4 py-2 text-left font-medium text-muted-foreground">Imported by</th>
                    <th className="px-4 py-2 text-left font-medium text-muted-foreground">Status</th>
                    <th className="px-4 py-2"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {history.map((b) => (
                    <tr key={b.id} className="hover:bg-surface-hover">
                      <td className="px-4 py-2 text-xs text-muted-foreground whitespace-nowrap">
                        {new Date(b.createdAt).toLocaleString()}
                      </td>
                      <td className="px-4 py-2 text-xs font-mono">{b.entityType}</td>
                      <td className="px-4 py-2 text-xs">
                        {b.recordCount} total
                        <span className="text-green-700 ml-1">+{b.newCount}</span>
                        <span className="text-amber-600 ml-1">~{b.updatedCount}</span>
                      </td>
                      <td className="px-4 py-2 text-xs text-muted-foreground">
                        {b.importedBy?.name ?? b.importedBy?.email ?? "—"}
                      </td>
                      <td className="px-4 py-2">
                        <Badge
                          variant="outline"
                          className={
                            b.status === "committed"
                              ? "text-green-700 border-green-300"
                              : "text-muted-foreground border-border"
                          }
                        >
                          {b.status}
                        </Badge>
                      </td>
                      <td className="px-4 py-2">
                        {b.status === "committed" && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-red-600 hover:text-red-700 hover:bg-red-50 text-xs"
                            disabled={rollbackLoading === b.id}
                            onClick={() => handleRollback(b.id)}
                          >
                            {rollbackLoading === b.id ? "Rolling back…" : "Rollback"}
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {rollbackError && (
            <p className="text-sm text-red-600 mt-2">{rollbackError}</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
