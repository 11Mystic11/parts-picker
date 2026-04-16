"use client";

import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Flag } from "lucide-react";

const FLAG_LABELS: Record<string, { label: string; description: string }> = {
  dms_sync: {
    label: "DMS Sync",
    description:
      "Enable live push to CDK / Reynolds on RO approval. Disable for PPTM testing (stubs the sync call).",
  },
  mfa_enforcement: {
    label: "MFA Enforcement",
    description:
      "Honour the rooftop-level MFA requirement and redirect unenrolled users to /auth/mfa. Safe to disable during onboarding.",
  },
  tablet_ux: {
    label: "Tablet UX",
    description:
      "Progressive rollout of Phase 10 tablet-optimised UI (touch targets, camera capture, bottom nav). Roll out per rooftop.",
  },
};

type FlagEntry = { enabled: boolean; scope: "rooftop" | "global" | "default" };
type FlagMap = Record<string, FlagEntry>;

interface Rooftop {
  id: string;
  name: string;
}

function ScopeTag({ scope }: { scope: FlagEntry["scope"] }) {
  if (scope === "rooftop") return <Badge className="bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 text-xs">Rooftop override</Badge>;
  if (scope === "global") return <Badge className="bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 text-xs">Global</Badge>;
  return <Badge className="bg-surface text-muted-foreground text-xs">Default (off)</Badge>;
}

export default function FlagsPage() {
  const { data: session } = useSession();
  const user = session?.user as any;

  const [rooftops, setRooftops] = useState<Rooftop[]>([]);
  const [selectedRooftopId, setSelectedRooftopId] = useState<string>("__global__");
  const [flags, setFlags] = useState<FlagMap>({});
  const [flagKeys, setFlagKeys] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Fetch rooftop list (org-scoped via session)
  useEffect(() => {
    fetch("/api/admin/rooftops")
      .then((r) => r.json())
      .then((data) => setRooftops(data.rooftops ?? []))
      .catch(() => setRooftops([]));
  }, []);

  const fetchFlags = useCallback(async (rooftopId: string) => {
    setLoading(true);
    setError(null);
    const params = rooftopId === "__global__" ? "" : `?rooftopId=${rooftopId}`;
    const res = await fetch(`/api/admin/flags${params}`);
    if (!res.ok) {
      setError("Failed to load flags");
      setLoading(false);
      return;
    }
    const data = await res.json();
    setFlags(data.flags ?? {});
    setFlagKeys(data.flagKeys ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchFlags(selectedRooftopId);
  }, [selectedRooftopId, fetchFlags]);

  async function toggle(flagKey: string, currentEnabled: boolean) {
    setSaving(flagKey);
    const rooftopId = selectedRooftopId === "__global__" ? null : selectedRooftopId;
    const res = await fetch("/api/admin/flags", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ flagKey, enabled: !currentEnabled, rooftopId }),
    });
    if (!res.ok) {
      const { error } = await res.json().catch(() => ({ error: "Unknown error" }));
      setError(error ?? "Save failed");
      setSaving(null);
      return;
    }
    await fetchFlags(selectedRooftopId);
    setSaving(null);
  }

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Flag className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold text-foreground">Feature Flags</h1>
          <p className="text-sm text-muted-foreground">Control feature rollout per rooftop or globally.</p>
        </div>
      </div>

      {/* Scope selector */}
      <div className="flex items-center gap-3">
        <label className="text-sm font-medium text-foreground whitespace-nowrap">Viewing scope:</label>
        <select
          value={selectedRooftopId}
          onChange={(e) => setSelectedRooftopId(e.target.value)}
          className="border border-border rounded-md px-3 py-1.5 text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
        >
          <option value="__global__">Global (all rooftops)</option>
          {rooftops.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>
        <p className="text-xs text-muted-foreground">
          {selectedRooftopId === "__global__"
            ? "Changes apply to all rooftops without a specific override."
            : "Rooftop-level settings take priority over global settings."}
        </p>
      </div>

      {error && (
        <div className="rounded-md bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 px-4 py-2 text-sm text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      {loading ? (
        <div className="text-sm text-muted-foreground animate-pulse">Loading flags…</div>
      ) : (
        <div className="space-y-4">
          {flagKeys.map((key) => {
            const entry: FlagEntry = flags[key] ?? { enabled: false, scope: "default" };
            const meta = FLAG_LABELS[key] ?? { label: key, description: "" };
            const isSaving = saving === key;

            return (
              <Card key={key}>
                <CardContent className="flex items-start justify-between gap-4 pt-5 pb-5">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-foreground">{meta.label}</span>
                      <code className="text-xs text-muted-foreground bg-surface px-1.5 py-0.5 rounded">
                        {key}
                      </code>
                      <ScopeTag scope={entry.scope} />
                    </div>
                    <p className="text-sm text-muted-foreground">{meta.description}</p>
                  </div>

                  {/* Toggle */}
                  <button
                    onClick={() => toggle(key, entry.enabled)}
                    disabled={isSaving}
                    aria-pressed={entry.enabled}
                    className={`
                      relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent
                      transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
                      ${entry.enabled ? "bg-primary" : "bg-surface-hover"}
                      ${isSaving ? "opacity-50 cursor-not-allowed" : ""}
                    `}
                  >
                    <span
                      className={`
                        pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transform transition duration-200 ease-in-out
                        ${entry.enabled ? "translate-x-5" : "translate-x-0"}
                      `}
                    />
                  </button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <div className="text-xs text-muted-foreground border-t border-border pt-4">
        Flag resolution order: <strong>Rooftop override</strong> → <strong>Global</strong> → Default (off).
        Setting a rooftop-level flag overrides the global value for that rooftop only.
      </div>
    </div>
  );
}
