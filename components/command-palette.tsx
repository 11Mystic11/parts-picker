// [FEATURE: global_search]
// Global Ctrl+K / Cmd+K command palette — search ROs, inventory, and navigate pages.
"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Command } from "cmdk";
import {
  Search, Car, Package, LayoutDashboard, ClipboardList,
  CalendarDays, Users, BarChart3, Settings, X,
} from "lucide-react";

interface SearchResult {
  ros: { id: string; roNumber: string | null; vin: string; customerName: string | null; status: string }[];
  inventory: { id: string; partNumber: string; description: string; quantityOnHand: number; category: string }[];
}

const NAV_ITEMS = [
  { label: "Dashboard",     href: "/dashboard",               icon: LayoutDashboard },
  { label: "Repair Orders", href: "/dashboard/ro",            icon: ClipboardList },
  { label: "New RO",        href: "/dashboard/ro/new",        icon: Car },
  { label: "Inventory",     href: "/dashboard/inventory",     icon: Package },
  { label: "Calendar",      href: "/dashboard/calendar",      icon: CalendarDays },
  { label: "Customers",     href: "/dashboard/customers",     icon: Users },
  { label: "Analytics",     href: "/dashboard/analytics",     icon: BarChart3 },
  { label: "Settings",      href: "/dashboard/settings",      icon: Settings },
];

export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult>({ ros: [], inventory: [] });
  const [loading, setLoading] = useState(false);

  // Ctrl+K / Cmd+K toggle
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Debounced search
  useEffect(() => {
    if (!open || query.length < 2) {
      setResults({ ros: [], inventory: [] });
      return;
    }
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
        if (res.ok) setResults(await res.json());
      } finally {
        setLoading(false);
      }
    }, 200);
    return () => clearTimeout(timer);
  }, [query, open]);

  const navigate = useCallback((href: string) => {
    setOpen(false);
    setQuery("");
    router.push(href);
  }, [router]);

  if (!open) return null;

  const filteredNav = query.length > 0
    ? NAV_ITEMS.filter((n) => n.label.toLowerCase().includes(query.toLowerCase()))
    : NAV_ITEMS;

  return (
    <div className="fixed inset-0 z-[999] flex items-start justify-center pt-[15vh]" onClick={() => setOpen(false)}>
      {/* backdrop */}
      <div className="absolute inset-0 bg-black/50" />

      <div
        className="relative z-10 w-full max-w-xl rounded-xl border border-border bg-background shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
          <Search className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search ROs, parts, or navigate…"
            className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
          />
          {loading && <span className="text-xs text-muted-foreground">Searching…</span>}
          <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="max-h-[420px] overflow-y-auto divide-y divide-border">
          {/* RO results */}
          {results.ros.length > 0 && (
            <div className="py-2">
              <p className="px-4 py-1 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Repair Orders</p>
              {results.ros.map((ro) => (
                <button
                  key={ro.id}
                  onClick={() => navigate(`/dashboard/ro/${ro.id}`)}
                  className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-surface-hover text-left"
                >
                  <Car className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground">
                      {ro.roNumber ?? ro.id.slice(-8).toUpperCase()}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {ro.vin}{ro.customerName ? ` · ${ro.customerName}` : ""}
                    </p>
                  </div>
                  <span className="text-xs text-muted-foreground capitalize">{ro.status}</span>
                </button>
              ))}
            </div>
          )}

          {/* Inventory results */}
          {results.inventory.length > 0 && (
            <div className="py-2">
              <p className="px-4 py-1 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Inventory</p>
              {results.inventory.map((item) => (
                <button
                  key={item.id}
                  onClick={() => navigate("/dashboard/inventory")}
                  className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-surface-hover text-left"
                >
                  <Package className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground">{item.partNumber}</p>
                    <p className="text-xs text-muted-foreground truncate">{item.description}</p>
                  </div>
                  <span className="text-xs text-muted-foreground">{item.quantityOnHand} in stock</span>
                </button>
              ))}
            </div>
          )}

          {/* Navigation shortcuts */}
          {filteredNav.length > 0 && (
            <div className="py-2">
              <p className="px-4 py-1 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Navigation</p>
              {filteredNav.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.href}
                    onClick={() => navigate(item.href)}
                    className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-surface-hover text-left"
                  >
                    <Icon className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <span className="text-sm text-foreground">{item.label}</span>
                  </button>
                );
              })}
            </div>
          )}

          {query.length >= 2 && results.ros.length === 0 && results.inventory.length === 0 && !loading && (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">
              No results for &ldquo;{query}&rdquo;
            </div>
          )}
        </div>

        <div className="px-4 py-2 border-t border-border flex items-center gap-4 text-xs text-muted-foreground">
          <span><kbd className="px-1 py-0.5 rounded border border-border bg-surface font-mono">↑↓</kbd> navigate</span>
          <span><kbd className="px-1 py-0.5 rounded border border-border bg-surface font-mono">↵</kbd> select</span>
          <span><kbd className="px-1 py-0.5 rounded border border-border bg-surface font-mono">Esc</kbd> close</span>
          <span className="ml-auto"><kbd className="px-1 py-0.5 rounded border border-border bg-surface font-mono">Ctrl+K</kbd> toggle</span>
        </div>
      </div>
    </div>
  );
}
