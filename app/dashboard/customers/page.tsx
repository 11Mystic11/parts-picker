"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Search, Car, Phone, Mail, ChevronDown, ChevronUp, History, UserPlus, Upload, Users, User } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

// ─── Types ─────────────────────────────────────────────────────────────────────

type CustomerRO = { id: string; status: string; total: number; date: string; services: string[] };
type HistoryCustomer = {
  vin: string; vehicleLabel: string; customerName: string | null;
  customerPhone: string | null; customerEmail: string | null;
  lastVisit: string; roCount: number; totalSpend: number; ros: CustomerRO[];
};
type CustomerProfile = {
  id: string; name: string; phone: string | null; email: string | null;
  notes: string | null; createdAt: string;
  _count: { repairOrders: number };
};

// ─── Helpers ───────────────────────────────────────────────────────────────────

const STATUS_STYLES: Record<string, string> = {
  draft: "bg-slate-100 text-slate-700", presented: "bg-blue-100 text-blue-700",
  approved: "bg-green-100 text-green-700", closed: "bg-green-100 text-green-700",
  void: "bg-red-100 text-red-500",
};
function fmt(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
}

// ─── History Card ───────────────────────────────────────────────────────────────

function HistoryCard({ customer }: { customer: HistoryCustomer }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="rounded-xl border border-border bg-background overflow-hidden">
      <div className="p-4 flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-foreground">{customer.customerName ?? "Unknown Customer"}</span>
            <span className="text-xs font-mono text-muted-foreground">{customer.vin}</span>
          </div>
          <p className="text-sm text-muted-foreground mt-0.5 flex items-center gap-1">
            <Car className="h-3.5 w-3.5" /> {customer.vehicleLabel}
          </p>
          <div className="flex flex-wrap gap-3 mt-1.5">
            {customer.customerPhone && <span className="text-xs text-muted-foreground flex items-center gap-1"><Phone className="h-3 w-3" />{customer.customerPhone}</span>}
            {customer.customerEmail && <span className="text-xs text-muted-foreground flex items-center gap-1"><Mail className="h-3 w-3" />{customer.customerEmail}</span>}
          </div>
        </div>
        <div className="flex-shrink-0 text-right">
          <p className="text-lg font-bold text-foreground">{fmt(customer.totalSpend)}</p>
          <p className="text-xs text-muted-foreground">{customer.roCount} visit{customer.roCount !== 1 ? "s" : ""}</p>
          <p className="text-xs text-muted-foreground">Last: {new Date(customer.lastVisit).toLocaleDateString()}</p>
        </div>
      </div>
      <button onClick={() => setExpanded((e) => !e)} className="w-full flex items-center justify-between px-4 py-2 text-xs text-muted-foreground bg-surface border-t border-border hover:bg-surface-hover transition-colors">
        <span className="flex items-center gap-1.5"><History className="h-3.5 w-3.5" />Service History ({customer.ros.length})</span>
        {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
      </button>
      {expanded && (
        <div className="border-t border-border divide-y divide-border">
          {customer.ros.map((ro) => (
            <div key={ro.id} className="px-4 py-3 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <Link href={`/dashboard/ro/${ro.id}`} className="text-xs font-mono text-primary hover:underline font-medium">{ro.id.slice(-8).toUpperCase()}</Link>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium capitalize ${STATUS_STYLES[ro.status] ?? ""}`}>{ro.status}</span>
                  <span className="text-xs text-muted-foreground">{new Date(ro.date).toLocaleDateString()}</span>
                </div>
                {ro.services.length > 0 && <p className="text-xs text-muted-foreground mt-0.5 truncate">{ro.services.join(" · ")}</p>}
              </div>
              <span className="flex-shrink-0 text-sm font-medium text-foreground">{fmt(ro.total)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Profile Card ───────────────────────────────────────────────────────────────

function ProfileCard({ customer }: { customer: CustomerProfile }) {
  return (
    <Link href={`/dashboard/customers/${customer.id}`}>
      <div className="rounded-xl border border-border bg-background hover:border-primary/50 transition-colors p-4 space-y-2 cursor-pointer">
        <div className="flex items-start justify-between">
          <div>
            <p className="font-semibold text-foreground">{customer.name}</p>
            <div className="flex flex-wrap gap-2 mt-1">
              {customer.phone && <span className="text-xs text-muted-foreground flex items-center gap-1"><Phone className="h-3 w-3" />{customer.phone}</span>}
              {customer.email && <span className="text-xs text-muted-foreground flex items-center gap-1"><Mail className="h-3 w-3" />{customer.email}</span>}
            </div>
          </div>
          <span className="text-xs text-muted-foreground">{customer._count.repairOrders} RO{customer._count.repairOrders !== 1 ? "s" : ""}</span>
        </div>
        {customer.notes && <p className="text-xs text-muted-foreground italic truncate">{customer.notes}</p>}
      </div>
    </Link>
  );
}

// ─── Main Page ──────────────────────────────────────────────────────────────────

export default function CustomersPage() {
  const [tab, setTab] = useState<"profiles" | "history">("profiles");

  // Profile tab state
  const [profiles, setProfiles] = useState<CustomerProfile[]>([]);
  const [profilesLoading, setProfilesLoading] = useState(true);
  const [profileSearch, setProfileSearch] = useState("");

  // History tab state
  const [query, setQuery] = useState("");
  const [historyResults, setHistoryResults] = useState<HistoryCustomer[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const loadProfiles = useCallback(async (q = "") => {
    setProfilesLoading(true);
    const res = await fetch(`/api/customers?q=${encodeURIComponent(q)}&limit=100`);
    if (res.ok) {
      const data = await res.json();
      setProfiles(data.customers ?? []);
    }
    setProfilesLoading(false);
  }, []);

  useEffect(() => { loadProfiles(); }, [loadProfiles]);

  useEffect(() => {
    const t = setTimeout(() => loadProfiles(profileSearch), 300);
    return () => clearTimeout(t);
  }, [profileSearch, loadProfiles]);

  const searchHistory = useCallback(async (q: string) => {
    if (q.length < 2) { setHistoryResults([]); setSearched(false); return; }
    setHistoryLoading(true);
    setSearched(true);
    const r = await fetch(`/api/customers/search?q=${encodeURIComponent(q)}`);
    if (r.ok) { const data = await r.json(); setHistoryResults(data.customers ?? []); }
    setHistoryLoading(false);
  }, []);

  return (
    <div className="p-6 max-w-4xl space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Users className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-2xl font-bold text-foreground">Customers</h1>
            <p className="text-sm text-muted-foreground">Manage customer profiles and view service history.</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/dashboard/customers/import">
            <Button variant="outline" size="sm"><Upload className="h-4 w-4 mr-1.5" />Import CSV</Button>
          </Link>
          <Link href="/dashboard/customers/new">
            <Button size="sm"><UserPlus className="h-4 w-4 mr-1.5" />New Customer</Button>
          </Link>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border">
        {(["profiles", "history"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn("px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px",
              tab === t ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            {t === "profiles" ? <><User className="h-4 w-4 inline mr-1.5" />Profiles</> : <><History className="h-4 w-4 inline mr-1.5" />Vehicle History</>}
          </button>
        ))}
      </div>

      {/* Profiles tab */}
      {tab === "profiles" && (
        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input value={profileSearch} onChange={(e) => setProfileSearch(e.target.value)} placeholder="Search customers…" className="pl-9" />
          </div>
          {profilesLoading ? (
            <div className="text-sm text-muted-foreground animate-pulse">Loading…</div>
          ) : profiles.length === 0 ? (
            <div className="py-14 text-center border border-dashed border-border rounded-xl">
              <User className="h-10 w-10 text-muted-foreground/20 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">{profileSearch ? "No customers match." : "No customer profiles yet."}</p>
              {!profileSearch && <Link href="/dashboard/customers/new"><Button size="sm" variant="outline" className="mt-3"><UserPlus className="h-4 w-4 mr-1.5" />Add First Customer</Button></Link>}
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 gap-3">
              {profiles.map((c) => <ProfileCard key={c.id} customer={c} />)}
            </div>
          )}
        </div>
      )}

      {/* History tab */}
      {tab === "history" && (
        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => { setQuery(e.target.value); searchHistory(e.target.value.trim()); }}
              placeholder="Search by name, phone, or VIN…"
              className="pl-9 h-11 text-base"
              autoFocus
            />
          </div>
          {historyLoading && <div className="space-y-3">{[1, 2].map((i) => <div key={i} className="h-28 rounded-xl bg-surface-hover animate-pulse" />)}</div>}
          {!historyLoading && searched && historyResults.length === 0 && (
            <div className="py-12 text-center border border-dashed border-border rounded-xl">
              <Search className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No results for &quot;{query}&quot;</p>
            </div>
          )}
          {!historyLoading && historyResults.length > 0 && (
            <div className="space-y-4">
              <p className="text-xs text-muted-foreground">{historyResults.length} result{historyResults.length !== 1 ? "s" : ""}</p>
              {historyResults.map((c) => <HistoryCard key={c.vin} customer={c} />)}
            </div>
          )}
          {!searched && (
            <div className="py-16 text-center">
              <Car className="h-12 w-12 text-muted-foreground/20 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">Search by name, phone, or VIN to view service history</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
