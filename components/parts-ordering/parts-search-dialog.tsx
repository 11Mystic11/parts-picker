// [FEATURE: parts_ordering]
// Dialog for searching supplier parts catalog and building an order.
// Remove this file to disable.

"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Search, Plus, Minus, ShoppingCart, Loader2 } from "lucide-react";

interface PartResult {
  partNumber: string;
  description: string;
  price: number;
  availability: string;
  brand?: string;
}

interface CartItem extends PartResult {
  quantity: number;
}

interface PartsSearchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  roId: string;
  onOrderSubmitted?: () => void;
}

const SUPPLIERS = [
  { value: "mock", label: "Demo Supplier" },
  { value: "NAPA", label: "NAPA Auto Parts" },
  { value: "AUTOZONE", label: "AutoZone PRO" },
];

export function PartsSearchDialog({ open, onOpenChange, roId, onOrderSubmitted }: PartsSearchDialogProps) {
  const [supplier, setSupplier] = useState("mock");
  const [query, setQuery] = useState("");
  const [partNumber, setPartNumber] = useState("");
  const [results, setResults] = useState<PartResult[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [searching, setSearching] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<"search" | "cart">("search");

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!query && !partNumber) return;
    setSearching(true);
    setError(null);
    try {
      const params = new URLSearchParams({ supplier });
      if (query) params.set("q", query);
      if (partNumber) params.set("partNumber", partNumber);
      const res = await fetch(`/api/parts-ordering/search?${params}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Search failed");
      setResults(data.results ?? []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSearching(false);
    }
  }

  function addToCart(part: PartResult) {
    setCart((prev) => {
      const existing = prev.find((c) => c.partNumber === part.partNumber);
      if (existing) {
        return prev.map((c) =>
          c.partNumber === part.partNumber ? { ...c, quantity: c.quantity + 1 } : c
        );
      }
      return [...prev, { ...part, quantity: 1 }];
    });
  }

  function updateQty(partNumber: string, delta: number) {
    setCart((prev) =>
      prev
        .map((c) => (c.partNumber === partNumber ? { ...c, quantity: c.quantity + delta } : c))
        .filter((c) => c.quantity > 0)
    );
  }

  async function handleSubmit() {
    if (cart.length === 0) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/ro/${roId}/parts-orders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          supplier,
          items: cart.map((c) => ({
            partNumber: c.partNumber,
            description: c.description,
            quantity: c.quantity,
            unitCost: c.price,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Order submission failed");
      setCart([]);
      setResults([]);
      setQuery("");
      setPartNumber("");
      setStep("search");
      onOpenChange(false);
      onOrderSubmitted?.();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  function handleClose(val: boolean) {
    if (!val) {
      setStep("search");
      setError(null);
    }
    onOpenChange(val);
  }

  const cartCount = cart.reduce((s, c) => s + c.quantity, 0);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Order Parts</DialogTitle>
        </DialogHeader>

        {step === "search" ? (
          <div className="space-y-4">
            {/* Supplier selector */}
            <div className="flex gap-3">
              <div className="w-48">
                <Label className="text-xs text-muted-foreground mb-1 block">Supplier</Label>
                <Select value={supplier} onValueChange={(v) => setSupplier(v ?? supplier)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SUPPLIERS.map((s) => (
                      <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex-1">
                <form onSubmit={handleSearch} className="flex gap-2 items-end">
                  <div className="flex-1">
                    <Label className="text-xs text-muted-foreground mb-1 block">Search</Label>
                    <Input
                      placeholder="e.g. oil filter"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                    />
                  </div>
                  <div className="w-36">
                    <Label className="text-xs text-muted-foreground mb-1 block">Part #</Label>
                    <Input
                      placeholder="WIX-123"
                      value={partNumber}
                      onChange={(e) => setPartNumber(e.target.value)}
                    />
                  </div>
                  <Button type="submit" disabled={searching || (!query && !partNumber)}>
                    {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                  </Button>
                </form>
              </div>
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}

            {/* Results */}
            {results.length > 0 && (
              <div className="border rounded-md divide-y max-h-64 overflow-y-auto">
                {results.map((part) => {
                  const inCart = cart.find((c) => c.partNumber === part.partNumber);
                  return (
                    <div key={part.partNumber} className="flex items-center gap-3 px-3 py-2 text-sm">
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">{part.description}</div>
                        <div className="text-muted-foreground text-xs">{part.partNumber}{part.brand ? ` · ${part.brand}` : ""}</div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="font-medium">${part.price.toFixed(2)}</div>
                        <Badge variant={part.availability === "in_stock" ? "default" : "secondary"} className="text-xs">
                          {part.availability === "in_stock" ? "In Stock" : part.availability === "limited" ? "Limited" : "Order"}
                        </Badge>
                      </div>
                      <Button
                        size="sm"
                        variant={inCart ? "secondary" : "outline"}
                        onClick={() => addToCart(part)}
                      >
                        <Plus className="h-3 w-3 mr-1" />
                        {inCart ? `(${inCart.quantity})` : "Add"}
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}

            {results.length === 0 && !searching && (query || partNumber) && (
              <p className="text-sm text-muted-foreground text-center py-4">No results found.</p>
            )}
          </div>
        ) : (
          /* Cart review step */
          <div className="space-y-3">
            <p className="text-sm font-medium">Review Order — {SUPPLIERS.find(s => s.value === supplier)?.label}</p>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <div className="border rounded-md divide-y">
              {cart.map((item) => (
                <div key={item.partNumber} className="flex items-center gap-3 px-3 py-2 text-sm">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{item.description}</div>
                    <div className="text-muted-foreground text-xs">{item.partNumber}</div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => updateQty(item.partNumber, -1)}>
                      <Minus className="h-3 w-3" />
                    </Button>
                    <span className="w-6 text-center">{item.quantity}</span>
                    <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => updateQty(item.partNumber, 1)}>
                      <Plus className="h-3 w-3" />
                    </Button>
                  </div>
                  <div className="w-20 text-right font-medium">
                    ${(item.price * item.quantity).toFixed(2)}
                  </div>
                </div>
              ))}
            </div>
            <div className="flex justify-end text-sm font-semibold">
              Total: ${cart.reduce((s, c) => s + c.price * c.quantity, 0).toFixed(2)}
            </div>
          </div>
        )}

        <DialogFooter className="gap-2">
          {step === "search" ? (
            <>
              <Button variant="outline" onClick={() => handleClose(false)}>Cancel</Button>
              <Button
                disabled={cartCount === 0}
                onClick={() => setStep("cart")}
              >
                <ShoppingCart className="h-4 w-4 mr-2" />
                Review Order ({cartCount})
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => setStep("search")}>Back</Button>
              <Button onClick={handleSubmit} disabled={submitting || cart.length === 0}>
                {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Submit Order
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
