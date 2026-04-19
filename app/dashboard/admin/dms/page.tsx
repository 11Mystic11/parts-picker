"use client";

/**
 * app/dashboard/admin/dms/page.tsx
 *
 * DMS Integration config panel — admin only.
 * Lets admins select a DMS provider, enter credentials, test the connection,
 * and view recent sync health stats for the rooftop.
 */

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Plug,
  CheckCircle2,
  XCircle,
  Loader2,
  AlertTriangle,
  RefreshCw,
} from "lucide-react";

type Provider = "none" | "cdk" | "reynolds" | "dealertrack" | "dealersocket" | "pbs" | "mitchell1";

interface ConfigState {
  dmsProvider: Provider | null;
  hasConfig: boolean;
  maskedConfig: Record<string, string> | null;
}

interface SyncStat {
  id: string;
  status: string | null;
  syncedAt: string | null;
  externalId: string | null;
  attempts: number;
}

export default function DMSConfigPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Current saved config
  const [config, setConfig] = useState<ConfigState>({ dmsProvider: null, hasConfig: false, maskedConfig: null });

  // Form state
  const [provider, setProvider] = useState<Provider>("none");
  // CDK fields
  const [cdkClientId, setCdkClientId] = useState("");
  const [cdkClientSecret, setCdkClientSecret] = useState("");
  const [cdkDealerNumber, setCdkDealerNumber] = useState("");
  // Reynolds fields
  const [reynoldsApiKey, setReynoldsApiKey] = useState("");
  const [reynoldsDealerCode, setReynoldsDealerCode] = useState("");
  // DealerTrack fields
  const [dtClientId, setDtClientId] = useState("");
  const [dtClientSecret, setDtClientSecret] = useState("");
  const [dtDealerId, setDtDealerId] = useState("");
  // DealerSocket fields
  const [dsApiKey, setDsApiKey] = useState("");
  const [dsDealerCode, setDsDealerCode] = useState("");
  // PBS fields
  const [pbsUsername, setPbsUsername] = useState("");
  const [pbsPassword, setPbsPassword] = useState("");
  const [pbsDealerNumber, setPbsDealerNumber] = useState("");
  // Mitchell 1 fields
  const [m1ApiKey, setM1ApiKey] = useState("");
  const [m1ShopId, setM1ShopId] = useState("");

  // Sync stats
  const [stats, setStats] = useState<SyncStat[]>([]);
  const [statsLoading, setStatsLoading] = useState(true);

  useEffect(() => {
    fetchConfig();
    fetchStats();
  }, []);

  async function fetchConfig() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/dms");
      if (!res.ok) throw new Error("Failed to load DMS config");
      const data: ConfigState = await res.json();
      setConfig(data);
      setProvider((data.dmsProvider as Provider) ?? "none");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  async function fetchStats() {
    setStatsLoading(true);
    try {
      const res = await fetch("/api/ro?limit=20");
      if (!res.ok) return;
      const data: { ros: Array<{ id: string; dmsSyncStatus: string | null; dmsSyncedAt: string | null; dmsExternalId: string | null; dmsSyncAttempts: number }> } = await res.json();
      setStats(
        data.ros
          .filter((r) => r.dmsSyncStatus !== null)
          .map((r) => ({
            id: r.id,
            status: r.dmsSyncStatus,
            syncedAt: r.dmsSyncedAt,
            externalId: r.dmsExternalId,
            attempts: r.dmsSyncAttempts,
          }))
      );
    } catch { /* ignore */ } finally {
      setStatsLoading(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    setSuccessMsg(null);
    setTestResult(null);

    let body: Record<string, string>;
    if (provider === "none") {
      body = { dmsProvider: "none" };
    } else if (provider === "cdk") {
      body = { dmsProvider: "cdk", clientId: cdkClientId, clientSecret: cdkClientSecret, dealerNumber: cdkDealerNumber };
    } else if (provider === "reynolds") {
      body = { dmsProvider: "reynolds", apiKey: reynoldsApiKey, dealerCode: reynoldsDealerCode };
    } else if (provider === "dealertrack") {
      body = { dmsProvider: "dealertrack", clientId: dtClientId, clientSecret: dtClientSecret, dealerId: dtDealerId };
    } else if (provider === "dealersocket") {
      body = { dmsProvider: "dealersocket", apiKey: dsApiKey, dealerCode: dsDealerCode };
    } else if (provider === "pbs") {
      body = { dmsProvider: "pbs", username: pbsUsername, password: pbsPassword, dealerNumber: pbsDealerNumber };
    } else {
      body = { dmsProvider: "mitchell1", apiKey: m1ApiKey, shopId: m1ShopId };
    }

    try {
      const res = await fetch("/api/admin/dms", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Save failed");
      setSuccessMsg("DMS configuration saved.");
      fetchConfig();
      fetchStats();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setSaving(false);
    }
  }

  async function handleTestConnection() {
    // Find the most recent approved RO to test against
    setTesting(true);
    setTestResult(null);
    try {
      const roRes = await fetch("/api/ro?limit=5");
      const roData: { ros: Array<{ id: string; status: string }> } = await roRes.json();
      const approvedRO = roData.ros.find((r) => r.status === "approved");
      if (!approvedRO) {
        setTestResult({ ok: false, message: "No approved RO found to test with. Create and approve an RO first." });
        return;
      }
      const res = await fetch("/api/dms/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roId: approvedRO.id, dryRun: true }),
      });
      const data: { ok?: boolean; message?: string; error?: string } = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Test failed");
      setTestResult({ ok: true, message: data.message ?? "Adapter found and reachable." });
    } catch (e) {
      setTestResult({ ok: false, message: e instanceof Error ? e.message : "Test failed" });
    } finally {
      setTesting(false);
    }
  }

  const syncedCount = stats.filter((s) => s.status === "synced").length;
  const failedCount = stats.filter((s) => s.status === "failed").length;
  const pendingCount = stats.filter((s) => s.status === "pending").length;

  if (loading) {
    return (
      <div className="p-6 flex items-center gap-2 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading DMS config…
      </div>
    );
  }

  return (
    <div className="p-6 max-w-2xl space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-primary/15 flex items-center justify-center">
          <Plug className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">DMS Integration</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Connect Parts Partner to your Dealer Management System.
          </p>
        </div>
      </div>

      {/* Sync Health Summary */}
      {!statsLoading && stats.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          <Card className="p-4 text-center">
            <p className="text-2xl font-bold text-green-600">{syncedCount}</p>
            <p className="text-xs text-muted-foreground mt-1">Synced</p>
          </Card>
          <Card className="p-4 text-center">
            <p className="text-2xl font-bold text-yellow-600">{pendingCount}</p>
            <p className="text-xs text-muted-foreground mt-1">Pending</p>
          </Card>
          <Card className="p-4 text-center">
            <p className="text-2xl font-bold text-red-600">{failedCount}</p>
            <p className="text-xs text-muted-foreground mt-1">Failed</p>
          </Card>
        </div>
      )}

      {/* Config Card */}
      <Card className="p-6 space-y-6">
        {/* Provider selector */}
        <div className="space-y-2">
          <Label className="text-sm font-semibold">DMS Provider</Label>
          <p className="text-xs text-muted-foreground">Select your dealer management system.</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-2">
            {([
              { value: "none", label: "No DMS" },
              { value: "cdk", label: "CDK Global" },
              { value: "reynolds", label: "Reynolds & Reynolds" },
              { value: "dealertrack", label: "DealerTrack" },
              { value: "dealersocket", label: "DealerSocket" },
              { value: "pbs", label: "PBS Systems" },
              { value: "mitchell1", label: "Mitchell 1" },
            ] as { value: Provider; label: string }[]).map((p) => (
              <button
                key={p.value}
                onClick={() => { setProvider(p.value); setTestResult(null); }}
                className={[
                  "relative rounded-lg border-2 p-3 text-sm font-medium transition-colors text-center",
                  provider === p.value
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border bg-background text-foreground hover:border-primary/50",
                ].join(" ")}
              >
                {p.label}
                {config.dmsProvider === p.value && p.value !== "none" && (
                  <span className="absolute top-1 right-1">
                    <CheckCircle2 className="h-3 w-3 text-green-500" />
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* CDK Fields */}
        {provider === "cdk" && (
          <div className="space-y-4 border-t pt-4">
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">CDK Global Credentials</p>
            {config.hasConfig && config.dmsProvider === "cdk" && (
              <div className="rounded-md bg-yellow-50 dark:bg-yellow-950/40 border border-yellow-200 dark:border-yellow-800 px-3 py-2 text-xs text-yellow-800 dark:text-yellow-300 flex items-center gap-2">
                <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />
                Existing credentials are saved. Enter new values to replace them.
                {config.maskedConfig && (
                  <span className="ml-auto font-mono text-yellow-700">
                    {Object.entries(config.maskedConfig).map(([k, v]) => `${k}: ${v}`).join(" · ")}
                  </span>
                )}
              </div>
            )}
            <div className="space-y-3">
              <div>
                <Label htmlFor="cdk-client-id" className="text-xs">Client ID</Label>
                <Input id="cdk-client-id" value={cdkClientId} onChange={(e) => setCdkClientId(e.target.value)} placeholder="e.g. pp_cdk_abc123" className="mt-1 font-mono text-sm" />
              </div>
              <div>
                <Label htmlFor="cdk-client-secret" className="text-xs">Client Secret</Label>
                <Input id="cdk-client-secret" type="password" value={cdkClientSecret} onChange={(e) => setCdkClientSecret(e.target.value)} placeholder="••••••••" className="mt-1 font-mono text-sm" />
              </div>
              <div>
                <Label htmlFor="cdk-dealer-number" className="text-xs">Dealer Number</Label>
                <Input id="cdk-dealer-number" value={cdkDealerNumber} onChange={(e) => setCdkDealerNumber(e.target.value)} placeholder="e.g. 00042" className="mt-1 font-mono text-sm" />
              </div>
            </div>
          </div>
        )}

        {/* Reynolds Fields */}
        {provider === "reynolds" && (
          <div className="space-y-4 border-t pt-4">
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Reynolds & Reynolds Credentials</p>
            {config.hasConfig && config.dmsProvider === "reynolds" && (
              <div className="rounded-md bg-yellow-50 dark:bg-yellow-950/40 border border-yellow-200 dark:border-yellow-800 px-3 py-2 text-xs text-yellow-800 dark:text-yellow-300 flex items-center gap-2">
                <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />
                Existing credentials are saved. Enter new values to replace them.
              </div>
            )}
            <div className="space-y-3">
              <div>
                <Label htmlFor="rr-api-key" className="text-xs">API Key</Label>
                <Input id="rr-api-key" type="password" value={reynoldsApiKey} onChange={(e) => setReynoldsApiKey(e.target.value)} placeholder="••••••••" className="mt-1 font-mono text-sm" />
              </div>
              <div>
                <Label htmlFor="rr-dealer-code" className="text-xs">Dealer Code</Label>
                <Input id="rr-dealer-code" value={reynoldsDealerCode} onChange={(e) => setReynoldsDealerCode(e.target.value)} placeholder="e.g. DEALER-0042" className="mt-1 font-mono text-sm" />
              </div>
            </div>
          </div>
        )}

        {/* DealerTrack Fields */}
        {provider === "dealertrack" && (
          <div className="space-y-4 border-t pt-4">
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">DealerTrack Credentials</p>
            <div className="space-y-3">
              <div>
                <Label htmlFor="dt-client-id" className="text-xs">Client ID</Label>
                <Input id="dt-client-id" value={dtClientId} onChange={(e) => setDtClientId(e.target.value)} placeholder="OAuth client ID" className="mt-1 font-mono text-sm" />
              </div>
              <div>
                <Label htmlFor="dt-client-secret" className="text-xs">Client Secret</Label>
                <Input id="dt-client-secret" type="password" value={dtClientSecret} onChange={(e) => setDtClientSecret(e.target.value)} placeholder="••••••••" className="mt-1 font-mono text-sm" />
              </div>
              <div>
                <Label htmlFor="dt-dealer-id" className="text-xs">Dealer ID</Label>
                <Input id="dt-dealer-id" value={dtDealerId} onChange={(e) => setDtDealerId(e.target.value)} placeholder="e.g. DLR-12345" className="mt-1 font-mono text-sm" />
              </div>
            </div>
          </div>
        )}

        {/* DealerSocket Fields */}
        {provider === "dealersocket" && (
          <div className="space-y-4 border-t pt-4">
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">DealerSocket Credentials</p>
            <div className="space-y-3">
              <div>
                <Label htmlFor="ds-api-key" className="text-xs">API Key</Label>
                <Input id="ds-api-key" type="password" value={dsApiKey} onChange={(e) => setDsApiKey(e.target.value)} placeholder="••••••••" className="mt-1 font-mono text-sm" />
              </div>
              <div>
                <Label htmlFor="ds-dealer-code" className="text-xs">Dealer Code</Label>
                <Input id="ds-dealer-code" value={dsDealerCode} onChange={(e) => setDsDealerCode(e.target.value)} placeholder="e.g. DS-0042" className="mt-1 font-mono text-sm" />
              </div>
            </div>
          </div>
        )}

        {/* PBS Fields */}
        {provider === "pbs" && (
          <div className="space-y-4 border-t pt-4">
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">PBS Systems Credentials</p>
            <div className="space-y-3">
              <div>
                <Label htmlFor="pbs-username" className="text-xs">Username</Label>
                <Input id="pbs-username" value={pbsUsername} onChange={(e) => setPbsUsername(e.target.value)} placeholder="PBS login username" className="mt-1 font-mono text-sm" />
              </div>
              <div>
                <Label htmlFor="pbs-password" className="text-xs">Password</Label>
                <Input id="pbs-password" type="password" value={pbsPassword} onChange={(e) => setPbsPassword(e.target.value)} placeholder="••••••••" className="mt-1 font-mono text-sm" />
              </div>
              <div>
                <Label htmlFor="pbs-dealer-number" className="text-xs">Dealer Number</Label>
                <Input id="pbs-dealer-number" value={pbsDealerNumber} onChange={(e) => setPbsDealerNumber(e.target.value)} placeholder="e.g. PBS-0042" className="mt-1 font-mono text-sm" />
              </div>
            </div>
          </div>
        )}

        {/* Mitchell 1 Fields */}
        {provider === "mitchell1" && (
          <div className="space-y-4 border-t pt-4">
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Mitchell 1 Credentials</p>
            <div className="space-y-3">
              <div>
                <Label htmlFor="m1-api-key" className="text-xs">API Key</Label>
                <Input id="m1-api-key" type="password" value={m1ApiKey} onChange={(e) => setM1ApiKey(e.target.value)} placeholder="••••••••" className="mt-1 font-mono text-sm" />
              </div>
              <div>
                <Label htmlFor="m1-shop-id" className="text-xs">Shop ID</Label>
                <Input id="m1-shop-id" value={m1ShopId} onChange={(e) => setM1ShopId(e.target.value)} placeholder="e.g. SHOP-1234" className="mt-1 font-mono text-sm" />
              </div>
            </div>
          </div>
        )}

        {/* No DMS message */}
        {provider === "none" && (
          <div className="border-t border-border pt-4 text-sm text-muted-foreground">
            Selecting <strong>No DMS</strong> will clear any existing integration. ROs will not be synced.
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-3 border-t pt-4">
          <Button onClick={handleSave} disabled={saving} id="dms-save-btn">
            {saving ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Saving…</> : "Save Configuration"}
          </Button>
          {provider !== "none" && config.hasConfig && (
            <Button
              variant="outline"
              onClick={handleTestConnection}
              disabled={testing}
              id="dms-test-btn"
            >
              {testing ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Testing…</> : <><RefreshCw className="h-4 w-4 mr-2" /> Test Connection</>}
            </Button>
          )}
        </div>

        {/* Feedback messages */}
        {error && (
          <div className="rounded-md bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 px-3 py-2 text-sm text-red-700 dark:text-red-300 flex items-center gap-2">
            <XCircle className="h-4 w-4 flex-shrink-0" /> {error}
          </div>
        )}
        {successMsg && (
          <div className="rounded-md bg-green-50 dark:bg-green-950/40 border border-green-200 dark:border-green-800 px-3 py-2 text-sm text-green-700 dark:text-green-300 flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 flex-shrink-0" /> {successMsg}
          </div>
        )}
        {testResult && (
          <div className={`rounded-md border px-3 py-2 text-sm flex items-center gap-2 ${testResult.ok ? "bg-green-50 dark:bg-green-950/40 border-green-200 dark:border-green-800 text-green-700 dark:text-green-300" : "bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-800 text-red-700 dark:text-red-300"}`}>
            {testResult.ok ? <CheckCircle2 className="h-4 w-4 flex-shrink-0" /> : <XCircle className="h-4 w-4 flex-shrink-0" />}
            {testResult.message}
          </div>
        )}
      </Card>

      {/* Info box */}
      <div className="rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 p-4 text-sm text-blue-800 dark:text-blue-300 space-y-1">
        <p className="font-semibold">How sync works</p>
        <ul className="list-disc list-inside space-y-0.5 text-blue-700 dark:text-blue-400 text-xs mt-1">
          <li>ROs are automatically pushed to your DMS when status changes to <strong>Approved</strong>.</li>
          <li>Failed syncs are retried up to 3 times (every 15 min via cron).</li>
          <li>Sync status is visible in the Repair Orders list.</li>
          <li>Admin / managers can manually re-sync any RO from the RO list.</li>
        </ul>
      </div>
    </div>
  );
}
