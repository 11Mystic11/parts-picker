// [FEATURE: lost_sales]
// Lost sales report — declined line items with revenue breakdown by reason and advisor.
"use client";

import { useState, useEffect } from "react";
import { TrendingDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from "recharts";

interface ByReason { reason: string; count: number; revenue: number }
interface ByAdvisor { name: string; count: number; revenue: number }
interface ReportData {
  totalRevenue: number;
  totalCount: number;
  byReason: ByReason[];
  byAdvisor: ByAdvisor[];
}

const REASON_LABELS: Record<string, string> = {
  price: "Price Too High",
  time_constraint: "Time Constraint",
  will_return: "Will Return Later",
  did_elsewhere: "Did It Elsewhere",
  other: "Other",
};

const COLORS = ["#ef4444", "#f97316", "#eab308", "#22c55e", "#3b82f6"];

export default function LostSalesPage() {
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(false);
  const [startDate, setStartDate] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - 30);
    return d.toISOString().slice(0, 10);
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().slice(0, 10));

  async function load() {
    setLoading(true);
    const res = await fetch(`/api/reports/lost-sales?startDate=${startDate}&endDate=${endDate}`);
    if (res.ok) setData(await res.json());
    setLoading(false);
  }

  useEffect(() => { load(); }, []); // eslint-disable-line

  const pieData = data?.byReason.map((r) => ({
    name: REASON_LABELS[r.reason] ?? r.reason,
    value: parseFloat(r.revenue.toFixed(2)),
  })) ?? [];

  return (
    <div className="p-6 max-w-4xl space-y-6">
      <div className="flex items-center gap-3">
        <TrendingDown className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold text-foreground">Lost Sales</h1>
          <p className="text-sm text-muted-foreground">Declined line item revenue and reasons</p>
        </div>
      </div>

      {/* Date filter */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <label className="text-sm text-muted-foreground">From</label>
          <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)}
            className="border border-border rounded-lg px-3 py-1.5 text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary" />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm text-muted-foreground">To</label>
          <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)}
            className="border border-border rounded-lg px-3 py-1.5 text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary" />
        </div>
        <Button size="sm" onClick={load} disabled={loading}>{loading ? "Loading…" : "Apply"}</Button>
      </div>

      {data && (
        <>
          {/* KPI cards */}
          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-xl border border-border bg-surface p-4">
              <p className="text-xs text-muted-foreground">Declined Revenue</p>
              <p className="text-2xl font-bold text-red-500">${data.totalRevenue.toFixed(2)}</p>
            </div>
            <div className="rounded-xl border border-border bg-surface p-4">
              <p className="text-xs text-muted-foreground">Declined Items</p>
              <p className="text-2xl font-bold text-foreground">{data.totalCount}</p>
            </div>
          </div>

          {/* Pie chart by reason */}
          {pieData.length > 0 && (
            <div className="rounded-xl border border-border bg-surface p-4">
              <p className="text-sm font-semibold text-foreground mb-3">By Decline Reason</p>
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={false}>
                    {pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v: unknown) => `$${Number(v).toFixed(2)}`} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* By advisor */}
          {data.byAdvisor.length > 0 && (
            <div className="border border-border rounded-xl overflow-hidden">
              <div className="px-4 py-2.5 bg-surface border-b border-border">
                <span className="text-sm font-semibold text-muted-foreground">By Advisor</span>
              </div>
              <div className="divide-y divide-border">
                {data.byAdvisor.map((a) => (
                  <div key={a.name} className="px-4 py-3 flex items-center justify-between text-sm">
                    <span className="font-medium text-foreground">{a.name}</span>
                    <div className="text-right">
                      <p className="font-semibold text-red-500">${a.revenue.toFixed(2)}</p>
                      <p className="text-xs text-muted-foreground">{a.count} item{a.count !== 1 ? "s" : ""}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {data.totalCount === 0 && (
            <div className="text-center py-8 text-sm text-muted-foreground">
              No declined items in this date range.
            </div>
          )}
        </>
      )}
    </div>
  );
}
