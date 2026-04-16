import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { Plus, ClipboardList, DollarSign, TrendingUp, Megaphone } from "lucide-react";

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  const rooftopId = (session?.user as any)?.rooftopId;
  const advisorId = (session?.user as any)?.id;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const now = new Date();
  const [todayROs, activeROs, , announcements] = await Promise.all([
    prisma.repairOrder.count({
      where: { rooftopId, createdAt: { gte: today } },
    }),
    prisma.repairOrder.findMany({
      where: {
        rooftopId,
        status: { in: ["draft", "presented"] },
      },
      include: { advisor: { select: { name: true } } },
      orderBy: { updatedAt: "desc" },
      take: 10,
    }),
    prisma.repairOrder.count({ where: { rooftopId } }),
    rooftopId
      ? prisma.announcement.findMany({
          where: {
            rooftopId,
            OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
          },
          orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
          include: { author: { select: { name: true } } },
          take: 5,
        })
      : Promise.resolve([]),
  ]);

  const avgValue = await prisma.repairOrder
    .aggregate({
      where: { rooftopId, status: "closed" },
      _avg: { totalAmount: true },
    })
    .then((r) => r._avg.totalAmount ?? 0);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            Good {getGreeting()}, {session?.user?.name?.split(" ")[0]}
          </h1>
          <p className="text-muted-foreground text-sm">
            {new Date().toLocaleDateString("en-US", {
              weekday: "long",
              month: "long",
              day: "numeric",
            })}
          </p>
        </div>
        <Link href="/dashboard/ro/new">
          <Button className="gap-2">
            <Plus className="h-4 w-4" />
            New Repair Order
          </Button>
        </Link>
      </div>

      {/* Announcements */}
      {announcements.length > 0 && (
        <div className="space-y-2">
          {announcements.map((a) => (
            <div
              key={a.id}
              className={[
                "flex items-start gap-3 px-4 py-3 rounded-lg border text-sm",
                a.priority === "urgent"  ? "bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-800 border-l-4 border-l-red-500" :
                a.priority === "warning" ? "bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800 border-l-4 border-l-amber-400" :
                "bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-800",
              ].join(" ")}
            >
              <Megaphone className={[
                "h-4 w-4 flex-shrink-0 mt-0.5",
                a.priority === "urgent"  ? "text-red-600" :
                a.priority === "warning" ? "text-amber-600" :
                "text-blue-600",
              ].join(" ")} />
              <div className="flex-1 min-w-0">
                <span className="font-semibold text-foreground">{a.title}</span>
                {" — "}
                <span className="text-foreground/80">{a.body}</span>
                <span className="ml-2 text-xs text-muted-foreground">
                  {a.author.name}
                </span>
              </div>
              <Link href="/dashboard/announcements" className="text-xs text-muted-foreground hover:text-foreground flex-shrink-0 mt-0.5">
                View all
              </Link>
            </div>
          ))}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <span className="p-1.5 bg-blue-500/20 rounded-md"><ClipboardList className="h-4 w-4 text-blue-400" /></span> ROs Today
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-foreground">{todayROs}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <span className="p-1.5 bg-blue-500/20 rounded-md"><TrendingUp className="h-4 w-4 text-blue-400" /></span> Active ROs
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-blue-600">{activeROs.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <span className="p-1.5 bg-green-500/20 rounded-md"><DollarSign className="h-4 w-4 text-green-400" /></span> Avg Closed RO
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600">
              ${avgValue.toFixed(0)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Active ROs table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Active Repair Orders</CardTitle>
        </CardHeader>
        <CardContent>
          {activeROs.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <ClipboardList className="h-10 w-10 mx-auto mb-3 opacity-40" />
              <p className="font-medium">No active repair orders</p>
              <p className="text-sm mt-1">Start a new RO to get going</p>
              <Link href="/dashboard/ro/new" className="mt-4 inline-block">
                <Button variant="outline" size="sm">New RO</Button>
              </Link>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {activeROs.map((ro) => {
                const vehicle = safeJson(ro.vehicleSnapshot);
                return (
                  <div key={ro.id} className="flex items-center justify-between py-3">
                    <div>
                      <div className="font-medium text-foreground text-sm">
                        {vehicle?.year} {vehicle?.make} {vehicle?.model}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        VIN: {ro.vin} &middot; {ro.advisor.name}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge
                        variant={ro.status === "presented" ? "default" : "secondary"}
                        className="capitalize"
                      >
                        {ro.status}
                      </Badge>
                      <div className="text-sm font-semibold text-foreground">
                        ${ro.totalAmount.toFixed(2)}
                      </div>
                      <Link href={`/dashboard/ro/${ro.id}`}>
                        <Button variant="ghost" size="sm">Open</Button>
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "morning";
  if (h < 17) return "afternoon";
  return "evening";
}

function safeJson(str: string) {
  try {
    return JSON.parse(str);
  } catch {
    return {};
  }
}
