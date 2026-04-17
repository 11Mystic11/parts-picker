"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { Search, Car, Phone, Mail, ChevronDown, ChevronUp, History } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type CustomerRO = {
  id: string;
  status: string;
  total: number;
  date: string;
  services: string[];
};

type Customer = {
  vin: string;
  vehicleLabel: string;
  customerName: string | null;
  customerPhone: string | null;
  customerEmail: string | null;
  lastVisit: string;
  roCount: number;
  totalSpend: number;
  ros: CustomerRO[];
};

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

function CustomerCard({ customer }: { customer: Customer }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="rounded-xl border border-border bg-background overflow-hidden">
      {/* Header */}
      <div className="p-4 flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-foreground text-base">
              {customer.customerName ?? "Unknown Customer"}
            </span>
            <span className="text-xs font-mono text-muted-foreground">{customer.vin}</span>
          </div>
          <p className="text-sm text-muted-foreground mt-0.5 flex items-center gap-1">
            <Car className="h-3.5 w-3.5" /> {customer.vehicleLabel}
          </p>
          <div className="flex flex-wrap gap-3 mt-1.5">
            {customer.customerPhone && (
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Phone className="h-3 w-3" /> {customer.customerPhone}
              </span>
            )}
            {customer.customerEmail && (
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Mail className="h-3 w-3" /> {customer.customerEmail}
              </span>
            )}
          </div>
        </div>
        <div className="flex-shrink-0 text-right">
          <p className="text-lg font-bold text-foreground">{fmt(customer.totalSpend)}</p>
          <p className="text-xs text-muted-foreground">{customer.roCount} visit{customer.roCount !== 1 ? "s" : ""}</p>
          <p className="text-xs text-muted-foreground">
            Last: {new Date(customer.lastVisit).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
          </p>
        </div>
      </div>

      {/* Toggle RO history */}
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        className="w-full flex items-center justify-between px-4 py-2 text-xs text-muted-foreground bg-surface border-t border-border hover:bg-surface-hover transition-colors"
      >
        <span className="flex items-center gap-1.5">
          <History className="h-3.5 w-3.5" />
          Service History ({customer.ros.length})
        </span>
        {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
      </button>

      {/* RO list */}
      {expanded && (
        <div className="border-t border-border divide-y divide-border">
          {customer.ros.map((ro) => (
            <div key={ro.id} className="px-4 py-3 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <Link
                    href={`/dashboard/ro/${ro.id}`}
                    className="text-xs font-mono text-primary hover:underline font-medium"
                  >
                    {ro.id.slice(-8).toUpperCase()}
                  </Link>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium capitalize ${STATUS_STYLES[ro.status] ?? ""}`}>
                    {ro.status}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {new Date(ro.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                  </span>
                </div>
                {ro.services.length > 0 && (
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">
                    {ro.services.join(" · ")}
                  </p>
                )}
              </div>
              <span className="flex-shrink-0 text-sm font-medium text-foreground">{fmt(ro.total)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function CustomersPage() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const search = useCallback(async (q: string) => {
    if (q.length < 2) {
      setResults([]);
      setSearched(false);
      return;
    }
    setLoading(true);
    setSearched(true);
    try {
      const r = await fetch(`/api/customers/search?q=${encodeURIComponent(q)}`);
      if (r.ok) {
        const data = await r.json();
        setResults(data.customers ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value;
    setQuery(val);
    const trimmed = val.trim();
    if (trimmed.length >= 2) {
      const timer = setTimeout(() => search(trimmed), 300);
      return () => clearTimeout(timer);
    } else {
      setResults([]);
      setSearched(false);
    }
  }

  return (
    <div className="p-6 max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Customer Lookup</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Search by customer name, phone number, or VIN to view service history.
        </p>
      </div>

      {/* Search bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={query}
          onChange={handleChange}
          placeholder="Search by name, phone, or VIN…"
          className="pl-9 h-11 text-base"
          autoFocus
        />
      </div>

      {/* Results */}
      {loading && (
        <div className="space-y-3">
          {[1, 2].map((i) => (
            <div key={i} className="h-28 rounded-xl bg-surface-hover animate-pulse" />
          ))}
        </div>
      )}

      {!loading && searched && results.length === 0 && (
        <div className="py-12 text-center border border-dashed border-border rounded-xl">
          <Search className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">No results for "{query}"</p>
          <p className="text-xs text-muted-foreground mt-1">
            Try searching by VIN, name, or phone number.
          </p>
        </div>
      )}

      {!loading && results.length > 0 && (
        <div className="space-y-4">
          <p className="text-xs text-muted-foreground">{results.length} result{results.length !== 1 ? "s" : ""}</p>
          {results.map((c) => (
            <CustomerCard key={c.vin} customer={c} />
          ))}
        </div>
      )}

      {!searched && (
        <div className="py-16 text-center">
          <Car className="h-12 w-12 text-muted-foreground/20 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">Start typing to search customer history</p>
        </div>
      )}
    </div>
  );
}
