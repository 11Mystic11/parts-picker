"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Download, TrendingUp, Wrench, Users, ArrowUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type KPIs = {
  revenueMtd: number;
  roCountMtd: number;
  avgRoValue: number;
  upsellRate: number;
};

type TrendPoint = {
  date: string;
  revenue: number;
  roCount: number;
};

type AdvisorRow = {
  advisorId: string;
  name: string;
  employeeId: string | null;
  roCount: number;
  totalRevenue: number;
  avgValue: number;
  upsellRate: number;
};

type StatusEntry = {
  status: string;
  count: number;
};

type AnalyticsData = {
  kpis: KPIs;
  trend: TrendPoint[];
  byAdvisor: AdvisorRow[];
  statusBreakdown: StatusEntry[];
};

type SortKey = keyof Pick<AdvisorRow, "roCount" | "totalRevenue" | "avgValue" | "upsellRate">;

function fmt(n: number): string {
  return `$${n.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function fmtFull(n: number): string {
  return `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function shortDate(iso: string): string {
  const [, mm, dd] = iso.split("-");
  return `${parseInt(mm)}/${parseInt(dd)}`;
}

function KpiCard({
  label,
  value,
  sub,
  icon,
}: {
  label: string;
  value: string;
  sub: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-xl glass border border-border/50 p-5 shadow-lg">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">{label}</p>
          <p className="text-2xl font-bold text-foreground">{value}</p>
          <p className="text-xs text-muted-foreground mt-1">{sub}</p>
        </div>
        <div className="text-muted-foreground/30">{icon}</div>
      </div>
    </div>
  );
}

function downloadCsv(advisors: AdvisorRow[], trend: TrendPoint[]) {
  const advisorHeader = "Advisor,Employee ID,ROs,Total Revenue,Avg RO Value,Upsell Rate";
  const advisorRows = advisors.map(
    (a) =>
      `"${a.name}","${a.employeeId ?? ""}",${a.roCount},${a.totalRevenue},${a.avgValue},${a.upsellRate}%`
  );

  const trendHeader = "Date,Revenue,RO Count";
  const trendRows = trend.map((t) => `${t.date},${t.revenue},${t.roCount}`);

  const csv = [
    "ADVISOR PERFORMANCE",
    advisorHeader,
    ...advisorRows,
    "",
    "REVENUE TREND (LAST 30 DAYS)",
    trendHeader,
    ...trendRows,
  ].join("\n");

  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `analytics-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function AnalyticsPage() {
  const router = useRouter();
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [sortKey, setSortKey] = useState<SortKey>("totalRevenue");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  useEffect(() => {
    fetch("/api/analytics")
      .then((r) => r.json())
      .then((d) => setData(d))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  }

  const sortedAdvisors = data
    ? [...data.byAdvisor].sort((a, b) => {
        const diff = a[sortKey] - b[sortKey];
        return sortDir === "asc" ? diff : -diff;
      })
    : [];

  if (loading) {
    return (
      <div className="p-6 max-w-6xl">
        <h1 className="text-2xl font-bold text-foreground mb-1">Analytics</h1>
        <p className="text-muted-foreground mb-8">RO value trends, upsell rates, and advisor performance.</p>
        <div className="animate-pulse space-y-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-28 rounded-xl bg-surface-hover" />
            ))}
          </div>
          <div className="h-64 rounded-xl bg-surface-hover" />
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-6">
        <p className="text-red-500 text-sm">Failed to load analytics. Please refresh.</p>
      </div>
    );
  }

  const { kpis, trend, byAdvisor, statusBreakdown } = data;

  // Advisor bar chart data (top 8)
  const advisorChartData = [...byAdvisor]
    .sort((a, b) => b.roCount - a.roCount)
    .slice(0, 8)
    .map((a) => ({ name: a.name.split(" ")[0], roCount: a.roCount }));

  const SortHeader = ({
    label,
    field,
  }: {
    label: string;
    field: SortKey;
  }) => (
    <th
      className="px-4 py-2.5 text-right font-medium cursor-pointer select-none hover:text-foreground transition-colors"
      onClick={() => handleSort(field)}
    >
      <span className="inline-flex items-center gap-1 justify-end">
        {label}
        <ArrowUpDown
          className={cn(
            "h-3 w-3",
            sortKey === field ? "text-primary" : "text-muted-foreground/30"
          )}
        />
      </span>
    </th>
  );

  return (
    <div className="p-6 max-w-6xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground mb-1">Analytics</h1>
          <p className="text-muted-foreground text-sm">RO value trends, upsell rates, and advisor performance.</p>
        </div>
        <Button
          variant="outline"
          onClick={() => downloadCsv(byAdvisor, trend)}
          className="gap-2 text-sm"
        >
          <Download className="h-4 w-4" />
          Export CSV
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <KpiCard
          label="Revenue MTD"
          value={fmt(kpis.revenueMtd)}
          sub="Month to date"
          icon={<TrendingUp className="h-6 w-6" />}
        />
        <KpiCard
          label="Avg RO Value"
          value={fmtFull(kpis.avgRoValue)}
          sub="Per repair order"
          icon={<Wrench className="h-6 w-6" />}
        />
        <KpiCard
          label="ROs This Month"
          value={String(kpis.roCountMtd)}
          sub="Total opened"
          icon={<Wrench className="h-6 w-6" />}
        />
        <KpiCard
          label="Upsell Rate"
          value={`${kpis.upsellRate}%`}
          sub="Recommended items accepted"
          icon={<Users className="h-6 w-6" />}
        />
      </div>

      {/* Revenue Trend Chart */}
      <div className="rounded-xl glass border border-border/50 p-5 shadow-lg mb-6">
        <h2 className="text-sm font-semibold text-foreground mb-4">Revenue Trend — Last 30 Days</h2>
        <ResponsiveContainer width="100%" height={260}>
          <AreaChart data={trend} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.15} />
                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(127,127,127,0.15)" />
            <XAxis
              dataKey="date"
              tickFormatter={shortDate}
              tick={{ fontSize: 11, fill: "#9ca3af" }}
              interval={4}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tickFormatter={(v: number) => `$${v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}`}
              tick={{ fontSize: 11, fill: "#9ca3af" }}
              axisLine={false}
              tickLine={false}
              width={48}
            />
            <Tooltip
              formatter={(value, name) => {
                const v = Number(value ?? 0);
                return name === "revenue" ? [fmtFull(v), "Revenue"] : [v, "RO Count"];
              }}
              labelFormatter={(label) => `Date: ${label}`}
              contentStyle={{
                fontSize: 12,
                borderRadius: 8,
                backgroundColor: "rgba(10,10,15,0.92)",
                border: "1px solid rgba(255,255,255,0.12)",
                color: "#f4f4f5",
                padding: "8px 12px",
              }}
              labelStyle={{ color: "#9ca3af", marginBottom: 4 }}
              itemStyle={{ color: "#f4f4f5" }}
            />
            <Area
              type="monotone"
              dataKey="revenue"
              stroke="#3b82f6"
              strokeWidth={2}
              fill="url(#revenueGrad)"
              dot={false}
              activeDot={{ r: 4 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Two-column: bar chart + status breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* Advisor RO Count Chart */}
        <div className="lg:col-span-2 rounded-xl glass border border-border/50 p-5 shadow-lg">
          <h2 className="text-sm font-semibold text-foreground mb-4">ROs by Advisor (Last 30 Days)</h2>
          {advisorChartData.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">No data</p>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart
                data={advisorChartData}
                layout="vertical"
                margin={{ top: 0, right: 8, left: 0, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(127,127,127,0.15)" horizontal={false} />
                <XAxis
                  type="number"
                  tick={{ fontSize: 11, fill: "#9ca3af" }}
                  axisLine={false}
                  tickLine={false}
                  allowDecimals={false}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  tick={{ fontSize: 11, fill: "#9ca3af" }}
                  axisLine={false}
                  tickLine={false}
                  width={60}
                />
                <Tooltip
                  formatter={(v) => [Number(v ?? 0), "ROs"]}
                  contentStyle={{
                    fontSize: 12,
                    borderRadius: 8,
                    backgroundColor: "rgba(10,10,15,0.92)",
                    border: "1px solid rgba(255,255,255,0.12)",
                    color: "#f4f4f5",
                    padding: "8px 12px",
                  }}
                  labelStyle={{ color: "#9ca3af" }}
                  itemStyle={{ color: "#f4f4f5" }}
                />
                <Bar dataKey="roCount" fill="#3b82f6" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Status Breakdown */}
        <div className="rounded-xl glass border border-border/50 p-5 shadow-lg">
          <h2 className="text-sm font-semibold text-foreground mb-4">RO Status Breakdown</h2>
          <div className="space-y-2">
            {statusBreakdown.length === 0 ? (
              <p className="text-sm text-muted-foreground">No data</p>
            ) : (
              statusBreakdown.map((s) => {
                const colors: Record<string, string> = {
                  draft: "bg-surface text-muted-foreground",
                  presented: "bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300",
                  approved: "bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300",
                  closed: "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300",
                  void: "bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-300",
                };
                return (
                  <div key={s.status} className="flex items-center justify-between text-sm">
                    <span
                      className={cn(
                        "px-2 py-0.5 rounded-full text-xs font-medium capitalize",
                        colors[s.status] ?? "bg-surface text-muted-foreground"
                      )}
                    >
                      {s.status}
                    </span>
                    <span className="font-semibold text-foreground">{s.count}</span>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Advisor Performance Table */}
      <div className="rounded-xl glass border border-border/50 shadow-lg overflow-hidden">
        <div className="px-5 py-3.5 border-b border-border">
          <h2 className="text-sm font-semibold text-foreground">Advisor Performance — Last 30 Days</h2>
        </div>
        {sortedAdvisors.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">No repair orders in this period.</p>
        ) : (
          <>
            {/* Mobile card layout */}
            <div className="md:hidden divide-y divide-border">
              {sortedAdvisors.map((a) => (
                <div key={a.advisorId} onClick={() => router.push(`/dashboard/analytics/${a.advisorId}`)} className="px-5 py-3 space-y-1 cursor-pointer hover:bg-surface-hover transition-colors">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <span className="font-medium text-foreground">{a.name}</span>
                      {a.employeeId && (
                        <span className="ml-2 text-xs font-mono text-muted-foreground">{a.employeeId}</span>
                      )}
                    </div>
                    <span
                      className={cn(
                        "px-2 py-0.5 rounded-full text-xs font-medium flex-shrink-0",
                        a.upsellRate >= 70
                          ? "bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300"
                          : a.upsellRate >= 40
                          ? "bg-yellow-100 dark:bg-yellow-900/40 text-yellow-700 dark:text-yellow-300"
                          : "bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-300"
                      )}
                    >
                      {a.upsellRate}%
                    </span>
                  </div>
                  <div className="flex gap-4 text-xs text-muted-foreground">
                    <span>{a.roCount} ROs</span>
                    <span>{fmtFull(a.totalRevenue)}</span>
                    <span>Avg {fmtFull(a.avgValue)}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop table layout */}
            <table className="w-full text-sm hidden md:table">
              <thead>
                <tr className="bg-surface text-xs text-muted-foreground uppercase tracking-wide border-b border-border">
                  <th className="px-4 py-2.5 text-left font-medium">Advisor</th>
                  <SortHeader label="ROs" field="roCount" />
                  <SortHeader label="Total Revenue" field="totalRevenue" />
                  <SortHeader label="Avg RO Value" field="avgValue" />
                  <SortHeader label="Upsell Rate" field="upsellRate" />
                </tr>
              </thead>
              <tbody>
                {sortedAdvisors.map((a, i) => (
                  <tr
                    key={a.advisorId}
                    onClick={() => router.push(`/dashboard/analytics/${a.advisorId}`)}
                    className={cn(
                      "border-b border-border/50 last:border-0 hover:bg-surface-hover transition-colors cursor-pointer",
                      i % 2 === 1 ? "bg-surface/50" : ""
                    )}
                  >
                    <td className="px-4 py-2.5">
                      <div className="font-medium text-foreground">{a.name}</div>
                      {a.employeeId && (
                        <div className="text-xs font-mono text-muted-foreground">{a.employeeId}</div>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-right text-muted-foreground">{a.roCount}</td>
                    <td className="px-4 py-2.5 text-right text-foreground font-medium">
                      {fmtFull(a.totalRevenue)}
                    </td>
                    <td className="px-4 py-2.5 text-right text-muted-foreground">{fmtFull(a.avgValue)}</td>
                    <td className="px-4 py-2.5 text-right">
                      <span
                        className={cn(
                          "px-2 py-0.5 rounded-full text-xs font-medium",
                          a.upsellRate >= 70
                            ? "bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300"
                            : a.upsellRate >= 40
                            ? "bg-yellow-100 dark:bg-yellow-900/40 text-yellow-700 dark:text-yellow-300"
                            : "bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-300"
                        )}
                      >
                        {a.upsellRate}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </div>
    </div>
  );
}
