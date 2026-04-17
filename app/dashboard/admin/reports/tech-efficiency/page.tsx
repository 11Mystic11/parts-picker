// [FEATURE: tech_time_clock]
// Tech Efficiency Report — manager/admin view of actual vs flat-rate hours per technician.
// Remove this file to disable.

"use client";

import { useState, useEffect, useCallback } from "react";
import { BarChart3, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";

interface TechEfficiency {
  techId: string;
  techName: string;
  actualHours: number;
  flatRateHours: number;
  efficiencyPct: number;
  entryCount: number;
}

export default function TechEfficiencyPage() {
  const [data, setData] = useState<TechEfficiency[]>([]);
  const [loading, setLoading] = useState(true);
  const [from, setFrom] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split("T")[0];
  });
  const [to, setTo] = useState(() => new Date().toISOString().split("T")[0]);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/reports/tech-efficiency?from=${from}T00:00:00Z&to=${to}T23:59:59Z`);
    if (res.ok) {
      const json = await res.json();
      setData(json.efficiency ?? []);
    }
    setLoading(false);
  }, [from, to]);

  useEffect(() => { load(); }, [load]);

  function exportCSV() {
    const rows = [
      ["Technician", "Actual Hours", "Flat Rate Hours", "Efficiency %", "Jobs"],
      ...data.map((d) => [d.techName, d.actualHours, d.flatRateHours, d.efficiencyPct, d.entryCount]),
    ];
    const csv = rows.map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `tech-efficiency-${from}-${to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function effColor(pct: number) {
    if (pct >= 100) return "text-green-600 dark:text-green-400";
    if (pct >= 75) return "text-amber-600 dark:text-amber-400";
    return "text-red-600 dark:text-red-400";
  }

  return (
    <div className="p-6 max-w-4xl space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <BarChart3 className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-2xl font-bold text-foreground">Tech Efficiency</h1>
            <p className="text-sm text-muted-foreground">Actual vs flat-rate hours per technician</p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={exportCSV} disabled={data.length === 0}>
          <Download className="h-4 w-4 mr-1.5" /> Export CSV
        </Button>
      </div>

      {/* Date range */}
      <div className="flex items-center gap-3">
        <div>
          <label className="block text-xs text-muted-foreground mb-1">From</label>
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="border border-border rounded px-3 py-1.5 text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
        <div>
          <label className="block text-xs text-muted-foreground mb-1">To</label>
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="border border-border rounded px-3 py-1.5 text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
        <Button size="sm" onClick={load} disabled={loading} className="mt-5">
          {loading ? "Loading…" : "Apply"}
        </Button>
      </div>

      {/* Chart */}
      {data.length > 0 && (
        <div className="border border-border rounded-xl bg-surface p-4">
          <p className="text-sm font-semibold text-foreground mb-4">Hours Comparison</p>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={data} margin={{ top: 4, right: 8, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="techName" tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} />
              <YAxis tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} />
              <Tooltip
                contentStyle={{ background: "hsl(var(--background))", border: "1px solid hsl(var(--border))" }}
              />
              <Legend />
              <Bar dataKey="actualHours" name="Actual Hours" fill="#6366f1" radius={[4, 4, 0, 0]} />
              <Bar dataKey="flatRateHours" name="Flat Rate" fill="#22c55e" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Table */}
      <div className="border border-border rounded-xl overflow-hidden">
        <div className="px-4 py-2.5 bg-surface border-b border-border">
          <span className="text-sm font-semibold text-muted-foreground">Technician Breakdown</span>
        </div>
        {loading ? (
          <div className="px-4 py-8 text-center text-sm text-muted-foreground animate-pulse">Loading…</div>
        ) : data.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-muted-foreground">No time entries in this period</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-surface border-b border-border">
              <tr>
                {["Technician", "Jobs", "Actual Hrs", "Flat Rate Hrs", "Efficiency"].map((h) => (
                  <th key={h} className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {data.map((row) => (
                <tr key={row.techId} className="hover:bg-surface-hover">
                  <td className="px-4 py-3 font-medium text-foreground">{row.techName}</td>
                  <td className="px-4 py-3 text-muted-foreground">{row.entryCount}</td>
                  <td className="px-4 py-3 font-mono text-foreground">{row.actualHours.toFixed(2)}</td>
                  <td className="px-4 py-3 font-mono text-foreground">{row.flatRateHours.toFixed(2)}</td>
                  <td className={`px-4 py-3 font-semibold ${effColor(row.efficiencyPct)}`}>
                    {row.efficiencyPct.toFixed(1)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
