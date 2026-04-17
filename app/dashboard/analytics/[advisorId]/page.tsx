import { getServerSession } from "next-auth";
import { redirect, notFound } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import Link from "next/link";
import { ChevronLeft, BarChart3, DollarSign, ClipboardList, TrendingUp } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type Props = { params: Promise<{ advisorId: string }> };

const STATUS_STYLES: Record<string, string> = {
  draft:     "bg-slate-100 text-slate-700",
  presented: "bg-blue-100 text-blue-700",
  approved:  "bg-green-100 text-green-700",
  closed:    "bg-green-100 text-green-700",
  void:      "bg-red-100 text-red-500",
};

function fmt(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
}

function getVehicleLabel(snapshot: string): string {
  try {
    const v = JSON.parse(snapshot);
    return `${v.year ?? ""} ${v.make ?? ""} ${v.model ?? ""}`.trim() || "Unknown Vehicle";
  } catch { return "Unknown Vehicle"; }
}

export default async function AdvisorDrillDownPage({ params }: Props) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/auth/login");

  const user = session.user as { role: string; rooftopId?: string };
  if (!["admin", "manager"].includes(user.role)) redirect("/dashboard/analytics");

  const { advisorId } = await params;

  const [advisor, ros] = await Promise.all([
    prisma.user.findUnique({
      where: { id: advisorId },
      select: { id: true, name: true, email: true, employeeId: true, role: true },
    }),
    prisma.repairOrder.findMany({
      where: {
        rooftopId: user.rooftopId,
        advisorId,
        status: { notIn: ["void"] },
      },
      include: {
        lineItems: {
          select: { type: true, isAccepted: true, totalPrice: true, description: true, source: true },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
  ]);

  if (!advisor) notFound();

  // Compute stats
  const closedRos = ros.filter((r) => r.status === "closed" || r.status === "approved");
  const totalRevenue = closedRos.reduce((s, r) => s + r.totalAmount, 0);
  const avgValue = closedRos.length > 0 ? totalRevenue / closedRos.length : 0;

  let recommended = 0, accepted = 0;
  let partsRevenue = 0, laborRevenue = 0;
  const serviceFreq = new Map<string, number>();

  for (const ro of closedRos) {
    for (const li of ro.lineItems) {
      if (li.source === "recommended") {
        recommended++;
        if (li.isAccepted) accepted++;
      }
      if (li.type === "part")  partsRevenue += li.totalPrice;
      if (li.type === "labor") laborRevenue += li.totalPrice;
      if (li.isAccepted) {
        const key = li.description;
        serviceFreq.set(key, (serviceFreq.get(key) ?? 0) + 1);
      }
    }
  }

  const upsellRate = recommended > 0 ? Math.round((accepted / recommended) * 100) : 0;

  const topServices = Array.from(serviceFreq.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);

  return (
    <div className="p-6 max-w-5xl space-y-8">
      {/* Back */}
      <Link href="/dashboard/analytics" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ChevronLeft className="h-4 w-4" /> Analytics
      </Link>

      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-full bg-primary/15 flex items-center justify-center text-primary font-bold text-lg">
          {advisor.name?.[0]?.toUpperCase() ?? "?"}
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">{advisor.name ?? advisor.email}</h1>
          <div className="flex items-center gap-2 mt-1">
            <Badge variant="outline" className="capitalize">{advisor.role}</Badge>
            {advisor.employeeId && (
              <span className="text-xs font-mono text-muted-foreground">{advisor.employeeId}</span>
            )}
          </div>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground mb-1">Total ROs</p>
            <p className="text-2xl font-bold text-foreground">{ros.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground mb-1">Total Revenue</p>
            <p className="text-2xl font-bold text-foreground">{fmt(totalRevenue)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground mb-1">Avg RO Value</p>
            <p className="text-2xl font-bold text-foreground">{fmt(avgValue)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground mb-1">Upsell Rate</p>
            <p className={`text-2xl font-bold ${upsellRate >= 70 ? "text-green-600" : upsellRate >= 40 ? "text-yellow-600" : "text-red-600"}`}>
              {upsellRate}%
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Revenue breakdown + top services */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Parts vs Labor */}
        <Card>
          <CardContent className="p-4">
            <h3 className="text-sm font-semibold text-foreground mb-3">Revenue Mix</h3>
            <div className="space-y-3">
              <div>
                <div className="flex justify-between text-xs text-muted-foreground mb-1">
                  <span>Parts</span><span>{fmt(partsRevenue)}</span>
                </div>
                <div className="h-2 bg-surface rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-500 rounded-full"
                    style={{ width: `${totalRevenue > 0 ? Math.round((partsRevenue / totalRevenue) * 100) : 0}%` }}
                  />
                </div>
              </div>
              <div>
                <div className="flex justify-between text-xs text-muted-foreground mb-1">
                  <span>Labor</span><span>{fmt(laborRevenue)}</span>
                </div>
                <div className="h-2 bg-surface rounded-full overflow-hidden">
                  <div
                    className="h-full bg-green-500 rounded-full"
                    style={{ width: `${totalRevenue > 0 ? Math.round((laborRevenue / totalRevenue) * 100) : 0}%` }}
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Top services */}
        <Card>
          <CardContent className="p-4">
            <h3 className="text-sm font-semibold text-foreground mb-3">Top Services Sold</h3>
            {topServices.length === 0 ? (
              <p className="text-xs text-muted-foreground">No data yet.</p>
            ) : (
              <ul className="space-y-1.5">
                {topServices.map(([service, count]) => (
                  <li key={service} className="flex justify-between text-xs">
                    <span className="text-foreground truncate mr-2">{service}</span>
                    <span className="text-muted-foreground flex-shrink-0 font-medium">{count}×</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {/* RO list */}
      <div>
        <h2 className="text-base font-semibold text-foreground mb-3">Repair Orders ({ros.length})</h2>
        <div className="rounded-lg border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-surface border-b border-border">
              <tr>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">RO</th>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">Vehicle</th>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">Date</th>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">Status</th>
                <th className="px-4 py-2.5 text-right text-xs font-medium text-muted-foreground">Total</th>
                <th className="px-4 py-2.5 text-right text-xs font-medium text-muted-foreground">Items</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {ros.map((ro) => (
                <tr key={ro.id} className="hover:bg-surface-hover transition-colors">
                  <td className="px-4 py-2.5">
                    <Link href={`/dashboard/ro/${ro.id}`} className="font-mono text-xs text-primary hover:underline">
                      {ro.id.slice(-8).toUpperCase()}
                    </Link>
                  </td>
                  <td className="px-4 py-2.5 text-foreground text-xs">{getVehicleLabel(ro.vehicleSnapshot)}</td>
                  <td className="px-4 py-2.5 text-muted-foreground text-xs">
                    {ro.createdAt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                  </td>
                  <td className="px-4 py-2.5">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${STATUS_STYLES[ro.status] ?? ""}`}>
                      {ro.status}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-right font-medium text-foreground">{fmt(ro.totalAmount)}</td>
                  <td className="px-4 py-2.5 text-right text-muted-foreground">{ro.lineItems.length}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
