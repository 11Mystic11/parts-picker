"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { Building2, Wrench, DollarSign, Hash } from "lucide-react";

const US_TIMEZONES = [
  { label: "Eastern Time",                   value: "America/New_York"   },
  { label: "Central Time",                   value: "America/Chicago"    },
  { label: "Mountain Time",                  value: "America/Denver"     },
  { label: "Mountain Time (Arizona, no DST)", value: "America/Phoenix"   },
  { label: "Pacific Time",                   value: "America/Los_Angeles"},
  { label: "Alaska Time",                    value: "America/Anchorage"  },
  { label: "Hawaii Time",                    value: "Pacific/Honolulu"   },
];

const OEM_OPTIONS = ["GM", "Ford", "Toyota", "Honda", "Stellantis", "BMW", "Mercedes"];

type Tab = "dealership" | "oem" | "pricing" | "ronumbering";

const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: "dealership", label: "Dealership Info", icon: Building2 },
  { id: "oem", label: "OEM Lines", icon: Wrench },
  { id: "pricing", label: "Labor & Pricing", icon: DollarSign },
  { id: "ronumbering", label: "RO Numbering", icon: Hash },
];

type Rooftop = {
  id: string;
  name: string;
  oems: string;
  laborRate: number;
  taxRate: number;
  shopSupplyPct: number;
  shopSupplyCap: number;
  timezone: string;
  pricingMatrix: { tiers: string }[] | null;
  roNumberPrefix: string | null;
  roNumberNext: number;
  roNumberPadding: number;
};

export function RooftopSettingsForm({ rooftop }: { rooftop: Rooftop }) {
  const [activeTab, setActiveTab] = useState<Tab>("dealership");
  const [form, setForm] = useState({
    name: rooftop.name,
    laborRate: rooftop.laborRate,
    taxRate: Math.round(rooftop.taxRate * 100),
    shopSupplyPct: Math.round(rooftop.shopSupplyPct * 100),
    shopSupplyCap: rooftop.shopSupplyCap,
    timezone: rooftop.timezone,
    roNumberPrefix: rooftop.roNumberPrefix ?? "",
    roNumberNext: rooftop.roNumberNext,
    roNumberPadding: rooftop.roNumberPadding,
  });

  const [oems, setOems] = useState<string[]>(() => {
    try {
      return JSON.parse(rooftop.oems);
    } catch {
      return [];
    }
  });

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  function toggleOem(oem: string) {
    setOems((prev) =>
      prev.includes(oem) ? prev.filter((o) => o !== oem) : [...prev, oem]
    );
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaved(false);
    setError("");

    const res = await fetch(`/api/rooftop/${rooftop.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.name,
        laborRate: form.laborRate,
        taxRate: form.taxRate / 100,
        shopSupplyPct: form.shopSupplyPct / 100,
        shopSupplyCap: form.shopSupplyCap,
        timezone: form.timezone,
        oems,
        roNumberPrefix: form.roNumberPrefix || null,
        roNumberNext: form.roNumberNext,
        roNumberPadding: form.roNumberPadding,
      }),
    });

    setSaving(false);
    if (res.ok) {
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } else {
      setError("Failed to save settings.");
    }
  }

  return (
    <form onSubmit={handleSave}>
      <div className="flex gap-6">
        {/* Left tab strip */}
        <nav className="w-48 flex-shrink-0">
          <ul className="space-y-1">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              return (
                <li key={tab.id}>
                  <button
                    type="button"
                    onClick={() => setActiveTab(tab.id)}
                    className={cn(
                      "w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors text-left",
                      activeTab === tab.id
                        ? "bg-surface-hover text-foreground border border-border"
                        : "text-muted-foreground hover:bg-surface-hover hover:text-foreground"
                    )}
                  >
                    <Icon className="h-4 w-4 flex-shrink-0" />
                    {tab.label}
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Right content panel */}
        <div className="flex-1 min-w-0">
          {activeTab === "dealership" && (
            <div className="space-y-4">
              <div>
                <h2 className="text-base font-semibold text-foreground mb-4">Dealership Info</h2>
              </div>
              <div className="space-y-1">
                <Label>Rooftop name</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                  required
                />
              </div>
              <div className="space-y-1">
                <Label>Timezone</Label>
                <Select
                  value={form.timezone}
                  onValueChange={(v) => setForm((p) => ({ ...p, timezone: v ?? p.timezone }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select timezone…" />
                  </SelectTrigger>
                  <SelectContent>
                    {US_TIMEZONES.map((tz) => (
                      <SelectItem key={tz.value} value={tz.value}>
                        {tz.label}
                        <span className="ml-1 text-muted-foreground text-xs">({tz.value})</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {activeTab === "oem" && (
            <div className="space-y-4">
              <div>
                <h2 className="text-base font-semibold text-foreground mb-1">OEM Lines</h2>
                <p className="text-sm text-muted-foreground mb-4">
                  Select the OEM lines your rooftop services. This drives which maintenance schedules and parts rules are shown.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {OEM_OPTIONS.map((oem) => (
                  <button
                    key={oem}
                    type="button"
                    onClick={() => toggleOem(oem)}
                    className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                      oems.includes(oem)
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-background text-foreground border-border hover:border-primary/50"
                    }`}
                  >
                    {oem}
                  </button>
                ))}
              </div>
              {oems.length === 0 && (
                <p className="text-xs text-amber-600">Select at least one OEM to use the maintenance browser.</p>
              )}
            </div>
          )}

          {activeTab === "pricing" && (
            <div className="space-y-4">
              <div>
                <h2 className="text-base font-semibold text-foreground mb-4">Labor &amp; Pricing</h2>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label>Labor rate ($/hr)</Label>
                  <Input
                    type="number"
                    min={0}
                    step={0.01}
                    value={form.laborRate}
                    onChange={(e) => setForm((p) => ({ ...p, laborRate: parseFloat(e.target.value) }))}
                  />
                </div>
                <div className="space-y-1">
                  <Label>Tax rate (%)</Label>
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    step={0.1}
                    value={form.taxRate}
                    onChange={(e) => setForm((p) => ({ ...p, taxRate: parseFloat(e.target.value) }))}
                  />
                </div>
                <div className="space-y-1">
                  <Label>Shop supply (%)</Label>
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    step={0.1}
                    value={form.shopSupplyPct}
                    onChange={(e) => setForm((p) => ({ ...p, shopSupplyPct: parseFloat(e.target.value) }))}
                  />
                </div>
                <div className="space-y-1">
                  <Label>Shop supply cap ($)</Label>
                  <Input
                    type="number"
                    min={0}
                    step={0.01}
                    value={form.shopSupplyCap}
                    onChange={(e) => setForm((p) => ({ ...p, shopSupplyCap: parseFloat(e.target.value) }))}
                  />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Shop supply fee = min(subtotal &times; {form.shopSupplyPct}%, ${form.shopSupplyCap} cap)
              </p>
            </div>
          )}

          {activeTab === "ronumbering" && (
            <div className="space-y-4">
              <div>
                <h2 className="text-base font-semibold text-foreground mb-1">RO Numbering</h2>
                <p className="text-sm text-muted-foreground mb-4">
                  Configure how repair order numbers are formatted. Use the &quot;Next number&quot; field to continue from a previous system.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label>Prefix</Label>
                  <Input
                    placeholder="e.g. RO-, WO, or leave blank"
                    maxLength={10}
                    value={form.roNumberPrefix}
                    onChange={(e) => setForm((p) => ({ ...p, roNumberPrefix: e.target.value }))}
                  />
                  <p className="text-xs text-muted-foreground">Letters, numbers, and hyphens only</p>
                </div>
                <div className="space-y-1">
                  <Label>Digit padding</Label>
                  <Select
                    value={String(form.roNumberPadding)}
                    onValueChange={(v) => setForm((p) => ({ ...p, roNumberPadding: parseInt(v ?? "0") }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[3, 4, 5, 6, 7, 8].map((n) => (
                        <SelectItem key={n} value={String(n)}>{n} digits</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1">
                <Label>Next number</Label>
                <Input
                  type="number"
                  min={1}
                  step={1}
                  value={form.roNumberNext}
                  onChange={(e) => setForm((p) => ({ ...p, roNumberNext: parseInt(e.target.value) || 1 }))}
                />
                <p className="text-xs text-muted-foreground">
                  Set this to continue from a previous system (e.g. enter 10543 to pick up where you left off)
                </p>
              </div>
              <div className="px-4 py-3 bg-surface border border-border rounded-lg">
                <p className="text-xs text-muted-foreground mb-1">Preview</p>
                <p className="text-sm font-mono font-semibold text-foreground">
                  Next RO will be: {(form.roNumberPrefix || "") + String(form.roNumberNext).padStart(form.roNumberPadding, "0")}
                </p>
              </div>
            </div>
          )}

          {error && <p className="text-sm text-red-600 mt-4">{error}</p>}

          <div className="flex items-center gap-3 mt-6 pt-6 border-t border-border">
            <Button type="submit" disabled={saving}>
              {saving ? "Saving..." : "Save settings"}
            </Button>
            {saved && <span className="text-sm text-green-600">Saved!</span>}
          </div>
        </div>
      </div>
    </form>
  );
}
