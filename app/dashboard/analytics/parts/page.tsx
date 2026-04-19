// [FEATURE: parts_analytics]
// Parts profitability, fill rate, and inventory analytics dashboard.
// Remove this file to disable.

"use client";

import { useState, useEffect } from "react";
import { BarChart3, RefreshCw, TrendingUp, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from "recharts";

interface PartsAnalytics {
  dateRange: { startDate: string; endDate: string };
  fillRate: number | null;
  inventoryTurns: number | null;
  totalInventoryValue: number;
  totalInventorySKUs: number;
  profitByCategory: Array<{
    category: string;
    revenue: number;
    cost: number;
    grossProfit: number;
    margin: number;
    units: number;
  }>;
  slowStock: {
    days90: { count: number; value: number };
    days180: { count: number; value: number };
    days365: { count: number; value: number };
  };
}

const CHART_COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4", "#f97316"];

export default function PartsAnalyticsPage() {
  const [data, setData] = useState<PartsAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 90);
    return d.toISOString().split("T")[0];
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split("T")[0]);

  async function load() {
    setLoading(true);
    const res = await fetch(`/api/analytics/parts?startDate=${startDate}&endDate=${endDate}`);
    if (res.ok) {
      setData(await res.json());
    }
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  return (
    <div className="p-6 max-w-5xl space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <BarChart3 className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-2xl font-bold text-foreground">Parts Analytics</h1>
            <p className="text-sm text-muted-foreground">Profitability, fill rate, and inventory health</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="h-8 px-2 text-sm border border-border rounded bg-background text-foreground"
          />
          <span className="text-muted-foreground text-sm">to</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="h-8 px-2 text-sm border border-border rounded bg-background text-foreground"
          />
          <Button size="sm" variant="outline" onClick={load} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-1.5 ${loading ? "animate-spin" : ""}`} />
            Apply
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="py-16 text-center text-sm text-muted-foreground animate-pulse">Loading analytics…</div>
      ) : !data ? (
        <div className="py-16 text-center text-sm text-muted-foreground">Failed to load analytics.</div>
      ) : (
        <>
          {/* KPI cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <KpiCard
              icon={<TrendingUp className="h-4 w-4" />}
              label="Fill Rate"
              value={data.fillRate != null ? `${data.fillRate.toFixed(1)}%` : "N/A"}
              sub="Parts in stock at time of RO"
            />
            <KpiCard
              icon={<RefreshCw className="h-4 w-4" />}
              label="Inventory Turns"
              value={data.inventoryTurns != null ? data.inventoryTurns.toFixed(1) : "N/A"}
              sub="COGS / avg inventory value"
            />
            <KpiCard
              icon={<Package className="h-4 w-4" />}
              label="Inventory Value"
              value={`$${(data.totalInventoryValue / 1000).toFixed(1)}k`}
              sub={`${data.totalInventorySKUs} SKUs on hand`}
            />
            <KpiCard
              icon={<BarChart3 className="h-4 w-4" />}
              label="GP (period)"
              value={`$${(data.profitByCategory.reduce((s, c) => s + c.grossProfit, 0) / 1000).toFixed(1)}k`}
              sub="Gross profit on closed ROs"
            />
          </div>

          {/* Gross profit by category bar chart */}
          {data.profitByCategory.length > 0 && (
            <div className="border border-border rounded-xl p-5 space-y-4">
              <h2 className="text-sm font-semibold text-foreground">Gross Profit by Category</h2>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={data.profitByCategory.slice(0, 10)} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                  <XAxis
                    dataKey="category"
                    tick={{ fontSize: 10, fill: "var(--color-muted-foreground)" }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: "var(--color-muted-foreground)" }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
                  />
                  <Tooltip
                    formatter={(v: unknown) => `$${Number(v).toFixed(2)}`}
                    contentStyle={{ background: "var(--color-background)", border: "1px solid var(--color-border)", borderRadius: 8, fontSize: 12 }}
                  />
                  <Bar dataKey="grossProfit" radius={[4, 4, 0, 0]}>
                    {data.profitByCategory.slice(0, 10).map((_, i) => (
                      <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              {/* Table below chart */}
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-1.5 text-muted-foreground font-semibold">Category</th>
                      <th className="text-right py-1.5 text-muted-foreground font-semibold">Revenue</th>
                      <th className="text-right py-1.5 text-muted-foreground font-semibold">Cost</th>
                      <th className="text-right py-1.5 text-muted-foreground font-semibold">GP</th>
                      <th className="text-right py-1.5 text-muted-foreground font-semibold">Margin</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {data.profitByCategory.map((c) => (
                      <tr key={c.category} className="hover:bg-surface-hover">
                        <td className="py-1.5 text-foreground font-medium">{c.category}</td>
                        <td className="py-1.5 text-right text-foreground">${c.revenue.toFixed(0)}</td>
                        <td className="py-1.5 text-right text-muted-foreground">${c.cost.toFixed(0)}</td>
                        <td className="py-1.5 text-right text-foreground font-medium">${c.grossProfit.toFixed(0)}</td>
                        <td className={`py-1.5 text-right font-medium ${c.margin >= 30 ? "text-green-600 dark:text-green-400" : c.margin >= 15 ? "text-amber-600 dark:text-amber-400" : "text-red-600 dark:text-red-400"}`}>
                          {c.margin.toFixed(1)}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Slow stock summary */}
          <div className="border border-border rounded-xl p-5 space-y-3">
            <h2 className="text-sm font-semibold text-foreground">Dead / Slow Stock (on-hand, no movement)</h2>
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: "90+ days", ...data.slowStock.days90 },
                { label: "180+ days", ...data.slowStock.days180 },
                { label: "365+ days", ...data.slowStock.days365 },
              ].map((s) => (
                <div key={s.label} className="rounded-lg border border-border bg-surface p-3">
                  <p className="text-xs text-muted-foreground">{s.label} stale</p>
                  <p className="text-lg font-bold text-foreground mt-0.5">{s.count} SKUs</p>
                  <p className="text-xs text-muted-foreground">${s.value.toFixed(0)} tied up</p>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function KpiCard({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string; sub: string }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-4 space-y-1">
      <div className="flex items-center gap-1.5 text-muted-foreground">{icon}<span className="text-xs font-semibold">{label}</span></div>
      <p className="text-2xl font-bold text-foreground">{value}</p>
      <p className="text-xs text-muted-foreground">{sub}</p>
    </div>
  );
}
