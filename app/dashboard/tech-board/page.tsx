"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { HardHat, Package, Wrench, Clock, RefreshCw } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type LaborOp = { description: string; laborOpCode: string | null; hours: number };
type Part = { description: string; partNumber: string | null; quantity: number };

type RO = {
  id: string;
  vin: string;
  vehicleLabel: string;
  status: string;
  scheduledAt: string | null;
  estimatedDuration: number | null;
  customerName: string | null;
  partsNeeded: Part[];
  laborOps: LaborOp[];
  estimatedHours: number;
  totalValue: number;
};

type Tech = {
  id: string;
  name: string | null;
  employeeId: string | null;
  activeRoCount: number;
  ros: RO[];
};

const STATUS_COLORS: Record<string, string> = {
  draft:     "bg-slate-100 text-slate-700",
  presented: "bg-blue-100 text-blue-700",
  approved:  "bg-green-100 text-green-700",
};

function fmt(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
}

export default function TechBoardPage() {
  const [techs, setTechs] = useState<Tech[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const r = await fetch("/api/tech-board");
      if (r.ok) {
        const data = await r.json();
        setTechs(data.techs ?? []);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  if (loading) {
    return (
      <div className="p-6 max-w-7xl">
        <h1 className="text-2xl font-bold text-foreground mb-6">Tech Board</h1>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-64 rounded-xl bg-surface-hover animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <HardHat className="h-6 w-6 text-primary" />
            Tech Board
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Live view of all technicians and their active jobs
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={load}>
          <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
          Refresh
        </Button>
      </div>

      {techs.length === 0 ? (
        <div className="py-16 text-center border border-dashed border-border rounded-xl">
          <HardHat className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">No technicians found for this rooftop.</p>
          <p className="text-xs text-muted-foreground mt-1">
            Assign the "technician" role to users in{" "}
            <Link href="/dashboard/admin/users" className="text-primary hover:underline">Users</Link>.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {techs.map((tech) => (
            <Card key={tech.id} className="flex flex-col">
              {/* Tech header */}
              <CardHeader className="pb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/15 flex items-center justify-center text-primary font-bold">
                    {tech.name?.[0]?.toUpperCase() ?? "T"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-base leading-tight">{tech.name ?? "Unnamed Tech"}</CardTitle>
                    {tech.employeeId && (
                      <p className="text-xs font-mono text-muted-foreground">{tech.employeeId}</p>
                    )}
                  </div>
                  <div className="flex-shrink-0 text-center">
                    <p className="text-2xl font-bold text-foreground">{tech.activeRoCount}</p>
                    <p className="text-[10px] text-muted-foreground">Active</p>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="pt-0 flex-1 space-y-3">
                {tech.ros.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-4">No active jobs</p>
                ) : (
                  tech.ros.map((ro) => (
                    <div key={ro.id} className="rounded-lg border border-border bg-surface p-3 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-foreground leading-tight">{ro.vehicleLabel}</p>
                          {ro.customerName && (
                            <p className="text-xs text-muted-foreground">{ro.customerName}</p>
                          )}
                          {ro.scheduledAt && (
                            <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                              <Clock className="h-3 w-3" />
                              {new Date(ro.scheduledAt).toLocaleString("en-US", {
                                month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
                              })}
                              {ro.estimatedDuration && ` · ${ro.estimatedDuration}min`}
                            </p>
                          )}
                        </div>
                        <div className="flex flex-col items-end gap-1 flex-shrink-0">
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium capitalize ${STATUS_COLORS[ro.status] ?? ""}`}>
                            {ro.status}
                          </span>
                          <span className="text-xs text-muted-foreground">{fmt(ro.totalValue)}</span>
                        </div>
                      </div>

                      {/* Labor ops */}
                      {ro.laborOps.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {ro.laborOps.map((l, idx) => (
                            <span key={idx} className="text-[10px] bg-blue-50 text-blue-700 border border-blue-200 px-1.5 py-0.5 rounded flex items-center gap-0.5">
                              <Wrench className="h-2.5 w-2.5" />
                              {l.description} {l.hours > 0 ? `(${l.hours}h)` : ""}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Parts needed */}
                      {ro.partsNeeded.length > 0 && (
                        <div>
                          <p className="text-[10px] text-muted-foreground font-medium mb-1 flex items-center gap-1">
                            <Package className="h-3 w-3" /> Parts needed
                          </p>
                          <div className="flex flex-wrap gap-1">
                            {ro.partsNeeded.slice(0, 4).map((p, idx) => (
                              <span key={idx} className="text-[10px] bg-amber-50 text-amber-700 border border-amber-200 px-1.5 py-0.5 rounded">
                                {p.description}{p.partNumber ? ` #${p.partNumber}` : ""} ×{p.quantity}
                              </span>
                            ))}
                            {ro.partsNeeded.length > 4 && (
                              <span className="text-[10px] text-muted-foreground">+{ro.partsNeeded.length - 4} more</span>
                            )}
                          </div>
                        </div>
                      )}

                      <Link
                        href={`/dashboard/ro/${ro.id}`}
                        className="text-xs text-primary hover:underline font-medium"
                      >
                        Open RO →
                      </Link>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
