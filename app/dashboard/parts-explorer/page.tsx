"use client";

import { useState, useEffect } from "react";
import { Search, Loader2, Package, History, ShoppingCart, Info, ExternalLink } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface PartResult {
  partNumber: string;
  description: string;
  brand: string;
  unitCost: number;
  availability: "in_stock" | "out_of_stock" | "backordered";
}

interface SupplierResult {
  supplier: string;
  status: "idle" | "loading" | "success" | "error";
  error?: string;
  results: PartResult[];
}

const SUPPLIER_NAMES: Record<string, string> = {
  partstech: "PartsTech",
  nexpart: "Nexpart",
  autozone: "AutoZone",
  napa: "NAPA",
  orielly: "O'Reilly",
  worldpac: "WorldPac",
  local: "Local Inventory",
};

export default function PartsExplorerPage() {
  const [query, setQuery] = useState("");
  const [connectedSuppliers, setConnectedSuppliers] = useState<string[]>([]);
  const [isInitializing, setIsInitializing] = useState(true);
  
  // State for tracking search across all connected sources
  const [searchState, setSearchState] = useState<Record<string, SupplierResult>>({});

  // 1. Fetch connected suppliers on mount
  useEffect(() => {
    fetch("/api/admin/suppliers")
      .then((r) => r.json())
      .then((data) => {
        const suppliers = data.suppliers ? Object.keys(data.suppliers) : [];
        setConnectedSuppliers(suppliers);
        
        // Initialize the state object
        const initialState: Record<string, SupplierResult> = {};
        // Always include local inventory search
        ["local", ...suppliers].forEach((sup) => {
          initialState[sup] = { supplier: sup, status: "idle", results: [] };
        });
        setSearchState(initialState);
      })
      .catch((e) => console.error("Failed to load suppliers", e))
      .finally(() => setIsInitializing(false));
  }, []);

  // 2. Handle Search Submission
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    // Set all to loading
    const newState = { ...searchState };
    Object.keys(newState).forEach((key) => {
      newState[key] = { ...newState[key], status: "loading", error: undefined, results: [] };
    });
    setSearchState(newState);

    // Fire off parallel requests
    Object.keys(newState).forEach(async (supplier) => {
      try {
        const res = await fetch(`/api/parts-ordering/search?supplier=${supplier}&q=${encodeURIComponent(query.trim())}`);
        if (!res.ok) throw new Error("Search failed");
        const data = await res.json();
        
        setSearchState(prev => ({
          ...prev,
          [supplier]: {
            supplier,
            status: "success",
            results: data.results || []
          }
        }));
      } catch (err: any) {
        setSearchState(prev => ({
          ...prev,
          [supplier]: {
            supplier,
            status: "error",
            error: err.message || "Request failed",
            results: []
          }
        }));
      }
    });
  };

  const isAnyLoading = Object.values(searchState).some(s => s.status === "loading");

  if (isInitializing) {
    return (
      <div className="flex flex-col items-center justify-center h-[50vh] text-muted-foreground">
        <Loader2 className="h-8 w-8 animate-spin mb-4" />
        <p>Loading your connected suppliers...</p>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-8">
      {/* Hero Search Section */}
      <div className="bg-gradient-to-br from-blue-900 via-blue-800 to-indigo-900 rounded-2xl p-8 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-full bg-[url('/noise.svg')] opacity-20 pointer-events-none mix-blend-overlay"></div>
        <div className="absolute -top-24 -right-24 w-96 h-96 bg-white/10 blur-3xl rounded-full pointer-events-none"></div>
        
        <div className="relative z-10 max-w-2xl">
          <h1 className="text-3xl font-bold text-white mb-2 flex items-center gap-3">
            <Package className="h-8 w-8 text-blue-300" />
            Parts Explorer
          </h1>
          <p className="text-blue-100 mb-6">Search your local inventory and all connected suppliers simultaneously. Find the best price and availability in seconds.</p>

          <form onSubmit={handleSearch} className="relative flex items-center shadow-lg rounded-xl overflow-hidden bg-background/10 backdrop-blur-md border border-white/20 p-1">
            <Search className="absolute left-4 h-5 w-5 text-white/70" />
            <Input 
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="e.g. Oil Filter, WIX-51515, Brake Pads..."
              className="pl-12 py-6 text-lg bg-transparent border-none text-white placeholder:text-white/50 focus-visible:ring-0 focus-visible:ring-offset-0"
              autoFocus
            />
            <Button 
              type="submit" 
              size="lg" 
              className="ml-2 px-8 bg-white text-blue-900 hover:bg-blue-50 rounded-lg whitespace-nowrap font-semibold transition-all"
              disabled={isAnyLoading || !query.trim()}
            >
              {isAnyLoading ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : null}
              {isAnyLoading ? "Searching..." : "Search"}
            </Button>
          </form>
          
          <div className="mt-4 flex flex-wrap gap-2 text-xs text-blue-200">
            <span className="opacity-70 flex items-center"><History className="h-3 w-3 mr-1" /> Recent:</span>
            {["WIX-51515", "Rotors", "5W-30", "Alternator"].map(term => (
              <button 
                key={term} 
                className="hover:text-white hover:underline transition-colors focus:outline-none"
                onClick={() => { setQuery(term); document.querySelector('form')?.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true })); }}
              >
                {term}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Connection Status Banner */}
      {connectedSuppliers.length === 0 && (
        <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl p-4 flex items-start gap-3 text-amber-800 dark:text-amber-200">
          <Info className="h-5 w-5 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="font-semibold text-amber-900 dark:text-amber-100">No external suppliers connected</h3>
            <p className="text-sm mt-1 mb-2">You are currently only searching your local inventory and offline catalogs. For live pricing, connect a supplier.</p>
            <a
              href="/dashboard/admin/suppliers"
              className="inline-flex items-center justify-center px-3 py-1.5 text-xs font-medium rounded-md border border-amber-300 dark:border-amber-700 bg-white/50 dark:bg-black/50 hover:bg-white/80 dark:hover:bg-black/70 transition-colors"
            >
              Connect Suppliers
            </a>
          </div>
        </div>
      )}

      {/* Results Matrix */}
      {Object.keys(searchState).length > 0 && query && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <h2 className="text-xl font-semibold border-b border-border pb-2 flex items-center justify-between">
            <span>Results for <span className="text-primary">&quot;{query}&quot;</span></span>
            <span className="text-sm font-normal text-muted-foreground bg-surface px-3 py-1 rounded-full border border-border shrink-0">
               Searching {Object.keys(searchState).length} sources
            </span>
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 items-start">
            {Object.values(searchState).map((source) => {
              const name = SUPPLIER_NAMES[source.supplier] || source.supplier;
              return (
                <div key={source.supplier} className="bg-surface border border-border rounded-xl shadow-sm overflow-hidden flex flex-col">
                  {/* Card Header */}
                  <div className="bg-muted px-4 py-3 border-b border-border flex items-center justify-between">
                    <h3 className="font-semibold text-foreground truncate">{name}</h3>
                    {source.status === "loading" ? (
                      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    ) : source.status === "success" ? (
                      <span className="text-xs font-medium bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                        {source.results.length} found
                      </span>
                    ) : source.status === "error" ? (
                      <span className="text-xs font-medium text-red-500 flex items-center">
                        <XCircle className="h-3 w-3 mr-1" /> Error
                      </span>
                    ) : null}
                  </div>

                  {/* Card Body */}
                  <div className="p-0 flex-1 max-h-[400px] overflow-y-auto">
                    {source.status === "loading" && (
                      <div className="p-8 text-center text-muted-foreground">
                        <div className="w-full flex justify-center mb-3">
                          <Skeleton className="h-8 w-8 rounded-full" />
                        </div>
                        <p className="text-sm">Querying {name}...</p>
                      </div>
                    )}
                    
                    {source.status === "error" && (
                      <div className="p-6 text-center text-muted-foreground text-sm">
                        <p>{source.error}</p>
                      </div>
                    )}

                    {source.status === "success" && source.results.length === 0 && (
                      <div className="p-8 text-center text-muted-foreground text-sm">
                        <Package className="h-8 w-8 mx-auto mb-2 opacity-20" />
                        <p>No matches found</p>
                      </div>
                    )}

                    {source.status === "success" && source.results.length > 0 && (
                      <ul className="divide-y divide-border">
                        {source.results.map((item, idx) => (
                          <li key={idx} className="p-4 hover:bg-surface-hover transition-colors group">
                            <div className="flex justify-between items-start gap-2 mb-1">
                              <span className="font-mono text-sm font-semibold text-primary">{item.partNumber}</span>
                              <span className={cn(
                                "text-[10px] uppercase font-bold px-1.5 py-0.5 rounded whitespace-nowrap",
                                item.availability === "in_stock" ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" :
                                item.availability === "out_of_stock" ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" :
                                "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                              )}>
                                {item.availability.replace("_", " ")}
                              </span>
                            </div>
                            <p className="text-sm text-foreground mb-2 line-clamp-2 leading-tight">{item.description}</p>
                            
                            <div className="flex items-center justify-between mt-auto">
                              <div className="text-xs text-muted-foreground">
                                {item.brand}
                              </div>
                              <div className="font-semibold text-foreground">
                                ${(item.unitCost).toFixed(2)}
                              </div>
                            </div>

                            {/* Hover Actions (Mock setup) */}
                            <div className="mt-3 hidden group-hover:flex items-center gap-2">
                              <Button size="sm" variant="outline" className="w-full text-xs h-8">
                                <ShoppingCart className="h-3 w-3 mr-1" /> Add
                              </Button>
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// A simple skeleton component since we didn't import the main UI one
function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse bg-muted rounded-md", className)} />
}
