// [FEATURE: tech_pay]
// Technician pay summary report — flat-rate hours vs actual hours for a pay period.
// Remove this file to disable.

"use client";

import { useState, useEffect } from "react";
import { DollarSign, Download } from "lucide-react";
import { Button } from "@/components/ui/button";

interface TechSummary {
  techId: string;
  name: string;
  employeeId: string | null;
  actualHours: number;
  flatRateHoursProduced: number;
  efficiency: number | null;
  entries: number;
}

function downloadCsv(techs: TechSummary[], start: string, end: string) {
  const header = "Tech Name,Employee ID,Actual Hours,Flat Rate Hours,Efficiency %\n";
  const rows = techs.map((t) =>
    `"${t.name}","${t.employeeId ?? ""}",${t.actualHours},${t.flatRateHoursProduced},${t.efficiency ?? ""}`
  ).join("\n");
  const blob = new Blob([header + rows], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `tech-pay-${start.slice(0, 10)}-to-${end.slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function TechPayPage() {
  const [techs, setTechs] = useState<TechSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 14);
    return d.toISOString().slice(0, 10);
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [respMeta, setRespMeta] = useState<{ startDate: string; endDate: string } | null>(null);

  async function load() {
    setLoading(true);
    const res = await fetch(`/api/reports/tech-pay?startDate=${startDate}&endDate=${endDate}`);
    if (res.ok) {
      const data = await res.json();
      setTechs(data.techs ?? []);
      setRespMeta({ startDate: data.startDate, endDate: data.endDate });
    }
    setLoading(false);
  }

  useEffect(() => { load(); }, []); // eslint-disable-line

  function effColor(eff: number | null) {
    if (eff === null) return "text-muted-foreground";
    if (eff >= 100) return "text-green-600 dark:text-green-400";
    if (eff >= 80) return "text-yellow-600 dark:text-yellow-400";
    return "text-red-600 dark:text-red-400";
  }

  return (
    <div className="p-6 max-w-4xl space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <DollarSign className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-2xl font-bold text-foreground">Tech Pay Summary</h1>
            <p className="text-sm text-muted-foreground">Flat-rate hours vs actual hours per technician</p>
          </div>
        </div>
        {techs.length > 0 && respMeta && (
          <Button size="sm" variant="outline" onClick={() => downloadCsv(techs, respMeta.startDate, respMeta.endDate)}>
            <Download className="h-4 w-4 mr-1.5" /> Export CSV
          </Button>
        )}
      </div>

      {/* Date range */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <label className="text-sm text-muted-foreground">From</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="border border-border rounded-lg px-3 py-1.5 text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm text-muted-foreground">To</label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="border border-border rounded-lg px-3 py-1.5 text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
        <Button size="sm" onClick={load} disabled={loading}>
          {loading ? "Loading…" : "Apply"}
        </Button>
      </div>

      {/* Summary table */}
      <div className="border border-border rounded-xl overflow-hidden">
        <div className="px-4 py-2.5 bg-surface border-b border-border">
          <span className="text-sm font-semibold text-muted-foreground">
            {techs.length} technician{techs.length !== 1 ? "s" : ""}
          </span>
        </div>

        {loading ? (
          <div className="px-4 py-8 text-center text-sm text-muted-foreground animate-pulse">Loading…</div>
        ) : techs.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-muted-foreground">
            No time entries found for this period
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-surface text-xs text-muted-foreground uppercase tracking-wider">
                  <th className="px-4 py-2.5 text-left">Tech</th>
                  <th className="px-4 py-2.5 text-right">Entries</th>
                  <th className="px-4 py-2.5 text-right">Actual Hours</th>
                  <th className="px-4 py-2.5 text-right">Flat Rate</th>
                  <th className="px-4 py-2.5 text-right">Efficiency</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {techs.map((t) => (
                  <tr key={t.techId} className="hover:bg-surface-hover">
                    <td className="px-4 py-3">
                      <p className="font-medium text-foreground">{t.name}</p>
                      {t.employeeId && <p className="text-xs text-muted-foreground">ID: {t.employeeId}</p>}
                    </td>
                    <td className="px-4 py-3 text-right text-muted-foreground">{t.entries}</td>
                    <td className="px-4 py-3 text-right font-mono text-foreground">{t.actualHours.toFixed(2)}h</td>
                    <td className="px-4 py-3 text-right font-mono text-foreground">{t.flatRateHoursProduced.toFixed(2)}h</td>
                    <td className={`px-4 py-3 text-right font-mono font-semibold ${effColor(t.efficiency)}`}>
                      {t.efficiency !== null ? `${t.efficiency}%` : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        Efficiency = flat-rate hours ÷ actual hours × 100. 100% means the tech produced exactly as many flat-rate hours as they worked. Entries with no clock-out are excluded from actual hours.
      </p>
    </div>
  );
}
