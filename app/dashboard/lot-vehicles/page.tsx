"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Truck, Plus, Upload, Search, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

interface LotVehicle {
  id: string;
  make: string;
  model: string;
  year: number | null;
  trim: string | null;
  color: string | null;
  vin: string | null;
  licensePlate: string | null;
  stockNumber: string | null;
  mileage: number | null;
  status: string;
  isLoaner: boolean;
  notes: string | null;
  createdAt: string;
}

const STATUS_STYLES: Record<string, string> = {
  available: "bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300",
  in_service: "bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300",
  sold: "bg-surface text-muted-foreground",
};

const STATUS_LABELS: Record<string, string> = {
  available: "Available",
  in_service: "In Service",
  sold: "Sold",
};

export default function LotVehiclesPage() {
  const [vehicles, setVehicles] = useState<LotVehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("available");

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/lot-vehicles?status=${statusFilter === "all" ? "" : statusFilter}`);
    if (res.ok) {
      const data = await res.json();
      setVehicles(data.vehicles ?? []);
    }
    setLoading(false);
  }, [statusFilter]);

  useEffect(() => { load(); }, [load]);

  const filtered = vehicles.filter((v) => {
    const q = search.toLowerCase();
    return (
      `${v.year} ${v.make} ${v.model} ${v.trim ?? ""} ${v.vin ?? ""} ${v.stockNumber ?? ""} ${v.licensePlate ?? ""}`.toLowerCase().includes(q)
    );
  });

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Truck className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-2xl font-bold text-foreground">Lot Vehicles</h1>
            <p className="text-sm text-muted-foreground">Dealer inventory — service without a customer RO.</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/dashboard/lot-vehicles/import">
            <Button variant="outline" size="sm">
              <Upload className="h-4 w-4 mr-1.5" />
              Import CSV
            </Button>
          </Link>
          <Link href="/dashboard/lot-vehicles/new">
            <Button size="sm">
              <Plus className="h-4 w-4 mr-1.5" />
              Add Vehicle
            </Button>
          </Link>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search make, model, VIN, stock #…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>
        <div className="flex gap-1">
          {["all", "available", "in_service", "sold"].map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${statusFilter === s ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-surface hover:text-foreground"}`}
            >
              {s === "all" ? "All" : STATUS_LABELS[s]}
            </button>
          ))}
        </div>
        <button onClick={load} className="text-muted-foreground hover:text-foreground" title="Refresh">
          <RefreshCw className="h-4 w-4" />
        </button>
      </div>

      {/* Vehicle list */}
      {loading ? (
        <div className="text-sm text-muted-foreground animate-pulse">Loading…</div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-16 border border-border rounded-xl text-sm text-muted-foreground">
          <Truck className="h-10 w-10 opacity-20" />
          <p>{search ? "No vehicles match your search." : "No lot vehicles yet."}</p>
          {!search && (
            <Link href="/dashboard/lot-vehicles/new">
              <Button size="sm" variant="outline">
                <Plus className="h-4 w-4 mr-1.5" />
                Add First Vehicle
              </Button>
            </Link>
          )}
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((v) => (
            <Link key={v.id} href={`/dashboard/lot-vehicles/${v.id}`}>
              <Card className="hover:border-primary/50 transition-colors cursor-pointer h-full">
                <CardContent className="pt-4 pb-4 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold text-foreground">
                        {[v.year, v.make, v.model].filter(Boolean).join(" ")}
                        {v.trim && <span className="font-normal text-muted-foreground"> {v.trim}</span>}
                      </p>
                      {v.color && <p className="text-xs text-muted-foreground">{v.color}</p>}
                    </div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded ${STATUS_STYLES[v.status] ?? STATUS_STYLES.available}`}>
                        {STATUS_LABELS[v.status] ?? v.status}
                      </span>
                      {v.isLoaner && (
                        <span className="text-xs font-medium px-2 py-0.5 rounded bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300">
                          Loaner
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    {v.stockNumber && (
                      <Badge variant="outline" className="text-xs">Stock #{v.stockNumber}</Badge>
                    )}
                    {v.licensePlate && (
                      <span className="text-xs font-mono text-muted-foreground">{v.licensePlate}</span>
                    )}
                    {v.mileage != null && (
                      <span className="text-xs text-muted-foreground">{v.mileage.toLocaleString()} mi</span>
                    )}
                  </div>
                  {v.vin && (
                    <p className="text-xs font-mono text-muted-foreground truncate">{v.vin}</p>
                  )}
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
