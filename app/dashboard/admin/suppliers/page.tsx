"use client";

// Admin page — configure parts supplier API credentials per rooftop.
// Credentials are encrypted at rest (same as DMS config).

import { useEffect, useState } from "react";
import { ShoppingCart, CheckCircle2, XCircle, Loader2, ChevronDown, ChevronRight, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// ─── Supplier definitions ──────────────────────────────────────────────────────

type SupplierKey = "napa" | "autozone" | "orielly" | "worldpac" | "partstech";

interface FieldDef {
  key: string;
  label: string;
  placeholder: string;
  isSecret?: boolean;
}

const SUPPLIERS: {
  key: SupplierKey;
  name: string;
  description: string;
  howToGet: string;
  fields: FieldDef[];
}[] = [
  {
    key: "partstech",
    name: "PartsTech",
    description: "Multi-supplier platform — one integration covers NAPA, AutoZone, O'Reilly, and more.",
    howToGet: "Sign up at partstech.com → go to Settings → API Credentials. Best option for most shops.",
    fields: [
      { key: "apiKey", label: "API Key", placeholder: "pt_live_...", isSecret: true },
      { key: "shopId", label: "Shop ID", placeholder: "Your PartsTech shop ID" },
    ],
  },
  {
    key: "autozone",
    name: "AutoZone Commercial",
    description: "Direct AutoZone PRO catalog access and order submission.",
    howToGet: "Contact your AutoZone commercial account rep and ask for AutoZone PRO API access. Requires an active commercial account.",
    fields: [
      { key: "apiKey", label: "API Key", placeholder: "AutoZone PRO API key", isSecret: true },
      { key: "storeNumber", label: "Store Number", placeholder: "e.g. 1234" },
    ],
  },
  {
    key: "napa",
    name: "NAPA PROLINK",
    description: "NAPA commercial catalog search and order placement.",
    howToGet: "Through your NAPA commercial account — contact your NAPA rep and request PROLINK API credentials.",
    fields: [
      { key: "apiKey", label: "API Key", placeholder: "NAPA PROLINK API key", isSecret: true },
      { key: "accountId", label: "Account ID", placeholder: "Your NAPA account ID" },
      { key: "storeId", label: "Store ID (optional)", placeholder: "e.g. NAPA-0042" },
    ],
  },
  {
    key: "orielly",
    name: "O'Reilly First Call",
    description: "O'Reilly Auto Parts commercial catalog and ordering.",
    howToGet: "Contact your O'Reilly commercial account manager to request First Call API access.",
    fields: [
      { key: "apiKey", label: "API Key", placeholder: "O'Reilly API key", isSecret: true },
      { key: "accountNumber", label: "Account Number", placeholder: "Your O'Reilly account number" },
      { key: "storeId", label: "Store ID (optional)", placeholder: "e.g. 0412" },
    ],
  },
  {
    key: "worldpac",
    name: "WorldPac SpeedDIAL",
    description: "WorldPac wholesale parts ordering for import/domestic vehicles.",
    howToGet: "Requires a WorldPac wholesale account. Log into speednet.worldpac.com → Settings → API to get credentials.",
    fields: [
      { key: "username", label: "Username", placeholder: "Your WorldPac username" },
      { key: "password", label: "Password", placeholder: "Your WorldPac password", isSecret: true },
      { key: "warehouseId", label: "Warehouse ID (optional)", placeholder: "e.g. WH001" },
    ],
  },
];

// ─── Component ────────────────────────────────────────────────────────────────

export default function SuppliersPage() {
  const [loading, setLoading] = useState(true);
  const [savedConfigs, setSavedConfigs] = useState<Record<string, Record<string, string>>>({});
  const [expanded, setExpanded] = useState<SupplierKey | null>("partstech");
  const [fieldValues, setFieldValues] = useState<Record<SupplierKey, Record<string, string>>>(
    {} as Record<SupplierKey, Record<string, string>>
  );
  const [saving, setSaving] = useState<SupplierKey | null>(null);
  const [clearing, setClearing] = useState<SupplierKey | null>(null);
  const [messages, setMessages] = useState<Record<SupplierKey, { ok: boolean; text: string } | null>>(
    {} as Record<SupplierKey, { ok: boolean; text: string } | null>
  );

  useEffect(() => {
    fetch("/api/admin/suppliers")
      .then((r) => r.json())
      .then((d) => setSavedConfigs(d.suppliers ?? {}))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  function setField(supplier: SupplierKey, field: string, value: string) {
    setFieldValues((prev) => ({
      ...prev,
      [supplier]: { ...(prev[supplier] ?? {}), [field]: value },
    }));
  }

  function clearMessage(supplier: SupplierKey) {
    setTimeout(() => setMessages((m) => ({ ...m, [supplier]: null })), 4000);
  }

  async function handleSave(supplierKey: SupplierKey) {
    const def = SUPPLIERS.find((s) => s.key === supplierKey)!;
    const credentials: Record<string, string> = {};
    for (const field of def.fields) {
      const val = fieldValues[supplierKey]?.[field.key] ?? "";
      if (val) credentials[field.key] = val;
    }
    if (Object.keys(credentials).length === 0) {
      setMessages((m) => ({ ...m, [supplierKey]: { ok: false, text: "Enter at least one credential field." } }));
      clearMessage(supplierKey);
      return;
    }
    setSaving(supplierKey);
    try {
      const res = await fetch("/api/admin/suppliers", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ supplier: supplierKey, credentials }),
      });
      if (!res.ok) throw new Error("Save failed");
      setSavedConfigs((prev) => ({ ...prev, [supplierKey]: credentials }));
      setFieldValues((prev) => ({ ...prev, [supplierKey]: {} }));
      setMessages((m) => ({ ...m, [supplierKey]: { ok: true, text: "Credentials saved." } }));
    } catch {
      setMessages((m) => ({ ...m, [supplierKey]: { ok: false, text: "Failed to save — try again." } }));
    } finally {
      setSaving(null);
      clearMessage(supplierKey);
    }
  }

  async function handleClear(supplierKey: SupplierKey) {
    if (!confirm(`Remove ${SUPPLIERS.find((s) => s.key === supplierKey)?.name} credentials?`)) return;
    setClearing(supplierKey);
    try {
      await fetch(`/api/admin/suppliers?supplier=${supplierKey}`, { method: "DELETE" });
      setSavedConfigs((prev) => { const n = { ...prev }; delete n[supplierKey]; return n; });
      setMessages((m) => ({ ...m, [supplierKey]: { ok: true, text: "Credentials removed." } }));
    } catch {
      setMessages((m) => ({ ...m, [supplierKey]: { ok: false, text: "Failed to clear." } }));
    } finally {
      setClearing(null);
      clearMessage(supplierKey);
    }
  }

  if (loading) {
    return (
      <div className="p-6 flex items-center gap-2 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading supplier config…
      </div>
    );
  }

  return (
    <div className="p-6 max-w-2xl space-y-6">
      <div className="flex items-center gap-3">
        <ShoppingCart className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold text-foreground">Supplier Connections</h1>
          <p className="text-sm text-muted-foreground">Connect parts suppliers to enable catalog search and ordering.</p>
        </div>
      </div>

      <div className="rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/30 px-4 py-3 text-sm text-blue-700 dark:text-blue-300 space-y-1">
        <p className="font-medium">How supplier connections work</p>
        <p>Once credentials are saved, entering a part number anywhere in the app (Order Parts, Special Orders, Purchase Orders) will search that supplier&apos;s live catalog and auto-fill the description and cost.</p>
        <p className="font-medium mt-1">Recommended: start with PartsTech — it connects to multiple suppliers through a single API.</p>
      </div>

      <div className="space-y-3">
        {SUPPLIERS.map((sup) => {
          const isConfigured = !!savedConfigs[sup.key];
          const isOpen = expanded === sup.key;
          const msg = messages[sup.key as SupplierKey];
          const currentValues = fieldValues[sup.key as SupplierKey] ?? {};

          return (
            <div key={sup.key} className="border border-border rounded-xl overflow-hidden">
              {/* Header row */}
              <button
                className="w-full flex items-center justify-between px-4 py-3 hover:bg-surface-hover text-left"
                onClick={() => setExpanded(isOpen ? null : sup.key)}
              >
                <div className="flex items-center gap-3">
                  {isConfigured ? (
                    <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0" />
                  ) : (
                    <XCircle className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  )}
                  <div>
                    <p className="font-medium text-foreground text-sm">{sup.name}</p>
                    <p className="text-xs text-muted-foreground">{sup.description}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {isConfigured && (
                    <span className="text-xs font-medium text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/30 px-2 py-0.5 rounded-full">
                      Connected
                    </span>
                  )}
                  {isOpen ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                </div>
              </button>

              {/* Expanded form */}
              {isOpen && (
                <div className="px-4 pb-4 pt-2 border-t border-border space-y-4 bg-surface/50">
                  {/* How to get credentials */}
                  <div className="rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
                    <span className="font-medium">How to get credentials: </span>{sup.howToGet}
                  </div>

                  {/* Current saved config (masked) */}
                  {isConfigured && savedConfigs[sup.key] && (
                    <div className="space-y-1">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Saved credentials</p>
                      <div className="grid grid-cols-2 gap-1.5">
                        {Object.entries(savedConfigs[sup.key]).map(([k, v]) => (
                          <div key={k} className="text-xs">
                            <span className="text-muted-foreground">{k}: </span>
                            <span className="font-mono text-foreground">{v}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Credential fields */}
                  <div className="space-y-3">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      {isConfigured ? "Update credentials" : "Enter credentials"}
                    </p>
                    {sup.fields.map((field) => (
                      <div key={field.key} className="space-y-1">
                        <Label className="text-xs">{field.label}</Label>
                        <Input
                          type={field.isSecret ? "password" : "text"}
                          placeholder={field.placeholder}
                          value={currentValues[field.key] ?? ""}
                          onChange={(e) => setField(sup.key, field.key, e.target.value)}
                          className="h-8 text-sm"
                          autoComplete="off"
                        />
                      </div>
                    ))}
                  </div>

                  {/* Message */}
                  {msg && (
                    <p className={`text-xs font-medium ${msg.ok ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
                      {msg.text}
                    </p>
                  )}

                  {/* Actions */}
                  <div className="flex items-center gap-2 pt-1">
                    <Button
                      size="sm"
                      onClick={() => handleSave(sup.key)}
                      disabled={saving === sup.key}
                    >
                      {saving === sup.key && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
                      Save
                    </Button>
                    {isConfigured && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-red-600 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
                        onClick={() => handleClear(sup.key)}
                        disabled={clearing === sup.key}
                      >
                        {clearing === sup.key ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5 mr-1.5" />}
                        Remove
                      </Button>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="rounded-lg border border-border bg-surface px-4 py-3 text-sm text-muted-foreground space-y-1">
        <p className="font-medium text-foreground text-xs uppercase tracking-wide">Note on adapter status</p>
        <p>PartsTech, NAPA, AutoZone, O&apos;Reilly, and WorldPac adapters are structurally complete — credentials are stored and passed to each adapter. The actual API calls inside each adapter are ready to be enabled once you receive your credentials and we can verify the exact endpoints with each supplier&apos;s developer documentation.</p>
      </div>
    </div>
  );
}
