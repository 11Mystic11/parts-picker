"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Trash2 } from "lucide-react";

type Tier = { minCost: number; maxCost: number | null; markupPct: number };

function formatPct(markupPct: number) {
  return (markupPct * 100).toFixed(1);
}

export function PricingClient({ rooftopId }: { rooftopId: string }) {
  const [tiers, setTiers] = useState<Tier[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/admin/pricing")
      .then((r) => r.json())
      .then((d) => { setTiers(d.tiers ?? []); setLoading(false); });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rooftopId]);

  function updateTier(index: number, field: keyof Tier, raw: string) {
    setTiers((prev) => {
      const next = [...prev];
      if (field === "maxCost") {
        next[index] = { ...next[index], maxCost: raw === "" ? null : parseFloat(raw) || 0 };
      } else if (field === "minCost") {
        next[index] = { ...next[index], minCost: parseFloat(raw) || 0 };
      } else if (field === "markupPct") {
        next[index] = { ...next[index], markupPct: (parseFloat(raw) || 0) / 100 };
      }
      return next;
    });
  }

  function addTier() {
    setTiers((prev) => {
      const last = prev[prev.length - 1];
      const newMin = last?.maxCost ?? (last?.minCost ?? 0) + 100;
      // Close the previous last tier if it was open-ended
      const updated = prev.map((t, i) =>
        i === prev.length - 1 && t.maxCost === null
          ? { ...t, maxCost: newMin }
          : t
      );
      return [...updated, { minCost: newMin, maxCost: null, markupPct: 0.2 }];
    });
  }

  function removeTier(index: number) {
    setTiers((prev) => {
      const next = prev.filter((_, i) => i !== index);
      // If we removed a middle tier, reopen the new last tier
      if (next.length > 0 && index === prev.length - 1) {
        next[next.length - 1] = { ...next[next.length - 1], maxCost: null };
      }
      return next;
    });
  }

  async function handleSave() {
    setSaving(true);
    setSaved(false);
    setError("");

    const res = await fetch("/api/admin/pricing", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tiers }),
    });

    setSaving(false);
    if (res.ok) {
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } else {
      const d = await res.json();
      setError(d.error ?? "Failed to save");
    }
  }

  if (loading) {
    return <div className="text-sm text-muted-foreground">Loading pricing matrix...</div>;
  }

  return (
    <div>
      <p className="text-sm text-muted-foreground mb-6">
        Parts are marked up based on their cost. Each tier defines a cost range and the corresponding markup percentage.
        The last tier should have no upper limit (∞) to catch all higher-cost parts.
      </p>

      <div className="border border-border rounded-lg overflow-hidden mb-4">
        <table className="w-full text-sm">
          <thead className="bg-surface border-b border-border">
            <tr>
              <th className="text-left px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wide">Min cost ($)</th>
              <th className="text-left px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wide">Max cost ($)</th>
              <th className="text-left px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wide">Markup (%)</th>
              <th className="px-4 py-3 w-12" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border/50">
            {tiers.map((tier, i) => (
              <tr key={i} className="hover:bg-surface-hover">
                <td className="px-4 py-2">
                  <Input
                    type="number"
                    min={0}
                    step={1}
                    value={tier.minCost}
                    onChange={(e) => updateTier(i, "minCost", e.target.value)}
                    className="w-28"
                  />
                </td>
                <td className="px-4 py-2">
                  <Input
                    type="number"
                    min={0}
                    step={1}
                    value={tier.maxCost ?? ""}
                    placeholder="∞"
                    onChange={(e) => updateTier(i, "maxCost", e.target.value)}
                    className="w-28"
                  />
                </td>
                <td className="px-4 py-2">
                  <Input
                    type="number"
                    min={0}
                    max={1000}
                    step={0.1}
                    value={formatPct(tier.markupPct)}
                    onChange={(e) => updateTier(i, "markupPct", e.target.value)}
                    className="w-24"
                  />
                </td>
                <td className="px-4 py-2 text-right">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => removeTier(i)}
                    disabled={tiers.length === 1}
                  >
                    <Trash2 className="h-4 w-4 text-muted-foreground" />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center gap-3">
        <Button variant="outline" size="sm" onClick={addTier}>
          <Plus className="h-4 w-4 mr-1" />
          Add tier
        </Button>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? "Saving..." : "Save all"}
        </Button>
        {saved && <span className="text-sm text-green-600">Saved!</span>}
        {error && <span className="text-sm text-red-600">{error}</span>}
      </div>

      <div className="mt-6 p-4 bg-surface rounded-lg text-xs text-muted-foreground">
        <strong>Example:</strong> A part costing $45 with a 30% markup → sells for $58.50.
        A part costing $150 with a 25% markup → sells for $187.50.
      </div>
    </div>
  );
}
