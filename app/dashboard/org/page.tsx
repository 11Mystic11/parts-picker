import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Building2, Users, ClipboardList, DollarSign, ShieldCheck } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default async function OrgOverviewPage() {
  const session = await getServerSession(authOptions);
  const user = session?.user as any;

  if (!user) redirect("/auth/signin");
  if (user.role !== "admin" && user.role !== "manager") redirect("/dashboard");

  const orgId = user.organizationId;
  if (!orgId) redirect("/dashboard");

  // Fetch all rooftops in the org with aggregate RO data
  const rooftops = await prisma.rooftop.findMany({
    where: { organizationId: orgId },
    include: {
      _count: { select: { users: true, repairOrders: true } },
      repairOrders: {
        where: { status: { in: ["approved", "closed"] } },
        select: { totalAmount: true, status: true },
      },
    },
    orderBy: { name: "asc" },
  });

  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { name: true, slug: true },
  });

  // Aggregate org-level totals
  const totalROs = rooftops.reduce((sum, r) => sum + r._count.repairOrders, 0);
  const totalUsers = rooftops.reduce((sum, r) => sum + r._count.users, 0);
  const totalRevenue = rooftops.reduce(
    (sum, r) => sum + r.repairOrders.reduce((s, ro) => s + ro.totalAmount, 0),
    0
  );
  const closedROs = rooftops.reduce(
    (sum, r) => sum + r.repairOrders.filter((ro) => ro.status === "closed").length,
    0
  );

  function fmt(n: number) {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
  }

  return (
    <div className="p-6 max-w-5xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-foreground">{org?.name ?? "Organization"} Overview</h1>
        <p className="text-sm text-muted-foreground mt-1">Across all rooftops</p>
      </div>

      {/* Org-level summary cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Building2 className="h-4 w-4" />
              <span className="text-xs font-medium uppercase tracking-wide">Rooftops</span>
            </div>
            <p className="text-2xl font-bold">{rooftops.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Users className="h-4 w-4" />
              <span className="text-xs font-medium uppercase tracking-wide">Users</span>
            </div>
            <p className="text-2xl font-bold">{totalUsers}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <ClipboardList className="h-4 w-4" />
              <span className="text-xs font-medium uppercase tracking-wide">Total ROs</span>
            </div>
            <p className="text-2xl font-bold">{totalROs}</p>
            <p className="text-xs text-muted-foreground">{closedROs} closed</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <DollarSign className="h-4 w-4" />
              <span className="text-xs font-medium uppercase tracking-wide">Revenue</span>
            </div>
            <p className="text-2xl font-bold">{fmt(totalRevenue)}</p>
            <p className="text-xs text-muted-foreground">approved + closed</p>
          </CardContent>
        </Card>
      </div>

      {/* Per-rooftop table */}
      <div>
        <h2 className="text-lg font-semibold text-foreground mb-3">Rooftops</h2>
        <div className="rounded-lg border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-surface text-muted-foreground text-xs uppercase tracking-wide border-b border-border">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Name</th>
                <th className="px-4 py-3 text-left font-medium">OEMs</th>
                <th className="px-4 py-3 text-right font-medium">Users</th>
                <th className="px-4 py-3 text-right font-medium">ROs</th>
                <th className="px-4 py-3 text-right font-medium">Revenue</th>
                <th className="px-4 py-3 text-center font-medium">MFA</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rooftops.map((r) => {
                let oems: string[] = [];
                try { oems = JSON.parse(r.oems); } catch {}
                const revenue = r.repairOrders.reduce((s, ro) => s + ro.totalAmount, 0);

                return (
                  <tr key={r.id} className="hover:bg-surface-hover transition-colors">
                    <td className="px-4 py-3 font-medium text-foreground">
                      <Link
                        href={`/dashboard`}
                        className="text-primary hover:underline"
                        title="Switch to this rooftop from the sidebar switcher"
                      >
                        {r.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {oems.length > 0 ? oems.join(", ") : <span className="text-muted-foreground/40">—</span>}
                    </td>
                    <td className="px-4 py-3 text-right text-foreground">{r._count.users}</td>
                    <td className="px-4 py-3 text-right text-foreground">{r._count.repairOrders}</td>
                    <td className="px-4 py-3 text-right text-foreground">{fmt(revenue)}</td>
                    <td className="px-4 py-3 text-center">
                      {r.mfaRequired ? (
                        <Badge variant="default" className="text-xs gap-1">
                          <ShieldCheck className="h-3 w-3" />
                          Required
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="text-xs">Optional</Badge>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
