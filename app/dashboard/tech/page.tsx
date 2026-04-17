import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Card, CardContent } from "@/components/ui/card";
import Link from "next/link";
import { ClipboardList, Package, CalendarClock, Wrench, Camera, Clock } from "lucide-react";
// [FEATURE: tech_time_clock] START
import { ClockWidget } from "@/components/timeclock/clock-widget";
// [FEATURE: tech_time_clock] END

function getVehicleLabel(snapshot: string): string {
  try {
    const v = JSON.parse(snapshot);
    return `${v.year ?? ""} ${v.make ?? ""} ${v.model ?? ""}`.trim() || "Unknown Vehicle";
  } catch {
    return "Unknown Vehicle";
  }
}

const STATUS_COLORS: Record<string, string> = {
  draft:     "bg-slate-100 text-slate-700",
  presented: "bg-blue-100 text-blue-700",
  approved:  "bg-green-100 text-green-700",
  closed:    "bg-gray-100 text-gray-500",
  void:      "bg-red-100 text-red-500",
};

export default async function TechDashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/auth/login");

  const user = session.user as { id: string; role: string; rooftopId?: string; name?: string };
  if (user.role !== "technician") redirect("/dashboard");

  const techId = user.id;
  const rooftopId = user.rooftopId;

  const now = new Date();
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const [assignedROs, upcomingScheduled] = await Promise.all([
    // Active ROs assigned to this tech
    prisma.repairOrder.findMany({
      where: {
        rooftopId: rooftopId ?? undefined,
        assignedTechId: techId,
        status: { notIn: ["closed", "void"] },
      },
      include: {
        lineItems: {
          where: { type: "part", isAccepted: true },
          orderBy: { sortOrder: "asc" },
        },
        advisor: { select: { name: true } },
      },
      orderBy: { updatedAt: "desc" },
    }),
    // Upcoming scheduled ROs (next 7 days)
    prisma.repairOrder.findMany({
      where: {
        rooftopId: rooftopId ?? undefined,
        assignedTechId: techId,
        scheduledAt: {
          gte: now,
          lte: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
        },
        status: { notIn: ["closed", "void"] },
      },
      orderBy: { scheduledAt: "asc" },
      take: 5,
    }),
  ]);

  const partsNeeded = assignedROs.flatMap((ro) =>
    ro.lineItems.map((li) => ({ ...li, roId: ro.id, vin: ro.vin, vehicle: getVehicleLabel(ro.vehicleSnapshot) }))
  );

  return (
    <div className="p-6 max-w-5xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-foreground">
          My Dashboard
        </h1>
        <p className="text-muted-foreground mt-1">
          Welcome back, {user.name ?? "Technician"}
        </p>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <ClipboardList className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold">{assignedROs.length}</p>
              <p className="text-xs text-muted-foreground">Active Jobs</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
              <Package className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{partsNeeded.length}</p>
              <p className="text-xs text-muted-foreground">Parts Needed</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center">
              <CalendarClock className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{upcomingScheduled.length}</p>
              <p className="text-xs text-muted-foreground">Upcoming (7d)</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* [FEATURE: tech_time_clock] START */}
      <div>
        <h2 className="text-base font-semibold text-foreground mb-3 flex items-center gap-2">
          <Clock className="h-4 w-4 text-primary" />
          Time Clock
        </h2>
        <ClockWidget />
      </div>
      {/* [FEATURE: tech_time_clock] END */}

      {/* Active jobs */}
      <div>
        <h2 className="text-base font-semibold text-foreground mb-3 flex items-center gap-2">
          <Wrench className="h-4 w-4 text-primary" />
          Active Jobs
        </h2>
        {assignedROs.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center border border-dashed border-border rounded-xl">
            No active jobs assigned to you right now.
          </p>
        ) : (
          <div className="space-y-3">
            {assignedROs.map((ro) => (
              <Card key={ro.id}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="min-w-0">
                      <p className="font-medium text-foreground">
                        {getVehicleLabel(ro.vehicleSnapshot)}
                      </p>
                      <p className="text-xs text-muted-foreground font-mono mt-0.5">{ro.vin}</p>
                      {ro.customerName && (
                        <p className="text-xs text-muted-foreground mt-0.5">{ro.customerName}</p>
                      )}
                      {ro.scheduledAt && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Scheduled: {new Date(ro.scheduledAt).toLocaleString()}
                        </p>
                      )}
                      {ro.lineItems.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {ro.lineItems.slice(0, 3).map((li) => (
                            <span key={li.id} className="text-[11px] bg-amber-50 text-amber-700 border border-amber-200 px-1.5 py-0.5 rounded">
                              {li.description} {li.partNumber ? `(${li.partNumber})` : ""}
                            </span>
                          ))}
                          {ro.lineItems.length > 3 && (
                            <span className="text-[11px] text-muted-foreground">+{ro.lineItems.length - 3} more</span>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${STATUS_COLORS[ro.status] ?? ""}`}>
                        {ro.status}
                      </span>
                      {/* [FEATURE: dvi] START */}
                      <Link href={`/dashboard/ro/${ro.id}/dvi`} className="inline-flex items-center h-7 px-2.5 rounded-lg border border-border bg-background text-sm font-medium hover:bg-muted transition-colors gap-1" title="Start Inspection">
                        <Camera className="h-3.5 w-3.5" />
                        DVI
                      </Link>
                      {/* [FEATURE: dvi] END */}
                      <Link href={`/dashboard/ro/${ro.id}`} className="inline-flex items-center h-7 px-2.5 rounded-lg border border-border bg-background text-sm font-medium hover:bg-muted transition-colors">View</Link>
                    </div>
                  </div>
                  {ro.advisor.name && (
                    <p className="text-[11px] text-muted-foreground mt-2">Advisor: {ro.advisor.name}</p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Parts needed */}
      {partsNeeded.length > 0 && (
        <div>
          <h2 className="text-base font-semibold text-foreground mb-3 flex items-center gap-2">
            <Package className="h-4 w-4 text-amber-600" />
            Parts Needed
          </h2>
          <div className="rounded-lg border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-surface border-b border-border">
                <tr>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">Part</th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">Part #</th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">Qty</th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">Vehicle</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {partsNeeded.map((p) => (
                  <tr key={p.id} className="hover:bg-surface-hover transition-colors">
                    <td className="px-4 py-2.5 text-foreground">{p.description}</td>
                    <td className="px-4 py-2.5 font-mono text-muted-foreground text-xs">{p.partNumber ?? "—"}</td>
                    <td className="px-4 py-2.5 text-foreground">{p.quantity}</td>
                    <td className="px-4 py-2.5 text-muted-foreground text-xs">{p.vehicle}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Upcoming schedule */}
      {upcomingScheduled.length > 0 && (
        <div>
          <h2 className="text-base font-semibold text-foreground mb-3 flex items-center gap-2">
            <CalendarClock className="h-4 w-4 text-green-600" />
            Upcoming Schedule
          </h2>
          <div className="space-y-2">
            {upcomingScheduled.map((ro) => (
              <div key={ro.id} className="flex items-center justify-between p-3 rounded-lg border border-border bg-surface">
                <div>
                  <p className="text-sm font-medium text-foreground">{getVehicleLabel(ro.vehicleSnapshot)}</p>
                  <p className="text-xs text-muted-foreground">
                    {ro.scheduledAt ? new Date(ro.scheduledAt).toLocaleString() : ""}
                    {ro.estimatedDuration ? ` · ${ro.estimatedDuration}min` : ""}
                  </p>
                </div>
                <Link href={`/dashboard/ro/${ro.id}`} className="inline-flex items-center h-7 px-2.5 rounded-lg border border-border bg-background text-sm font-medium hover:bg-muted transition-colors flex-shrink-0">View</Link>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
