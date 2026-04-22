"use client";

// Admin page — configure parts supplier API credentials per rooftop.
// Credentials are encrypted at rest (same as DMS config).

import { useEffect, useState, Suspense } from "react";
import { ShoppingCart, CheckCircle2, XCircle, Loader2, ChevronDown, ChevronRight, Trash2, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useSearchParams } from "next/navigation";

// ─── Supplier definitions ──────────────────────────────────────────────────────

type SupplierKey = "napa" | "autozone" | "orielly" | "worldpac" | "partstech" | "nexpart";

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
    howToGet: "Just click Connect! You will be redirected to PartsTech to log in or create an account, and we will automatically link your shop.",
    fields: [], // Handled by Easy Registration redirect
  },
  {
    key: "nexpart",
    name: "Nexpart Multi-Seller",
    description: "Direct access to WHI Nexpart catalog and ordering.",
    howToGet: "Requires a Nexpart Multi-Seller account (nexpart.com). Enter your standard login credentials below.",
    fields: [
      { key: "username", label: "Username", placeholder: "Your Nexpart username" },
      { key: "password", label: "Password", placeholder: "Your Nexpart password", isSecret: true },
    ],
  },
  {
    key: "autozone",
    name: "AutoZone Commercial",
    description: "Direct AutoZone PRO catalog access and order submission.",
    howToGet: "Contact your AutoZone commercial account rep and ask for AutoZone PRO API access. Requires an active commercial account.",
    fields: [
      { key: "username", label: "Username", placeholder: "AutoZone PRO username" },
      { key: "password", label: "Password", placeholder: "AutoZone PRO password", isSecret: true },
      { key: "storeNumber", label: "Store Number (optional)", placeholder: "e.g. 1234" },
    ],
  },
  {
    key: "napa",
    name: "NAPA PROLINK",
    description: "NAPA commercial catalog search and order placement.",
    howToGet: "Through your NAPA commercial account — contact your NAPA rep and request PROLINK API credentials.",
    fields: [
      { key: "username", label: "Username", placeholder: "NAPA PROLINK username" },
      { key: "password", label: "Password", placeholder: "NAPA PROLINK password", isSecret: true },
      { key: "accountId", label: "Account ID (optional)", placeholder: "Your NAPA account ID" },
      { key: "storeId", label: "Store ID (optional)", placeholder: "e.g. NAPA-0042" },
    ],
  },
  {
    key: "orielly",
    name: "O'Reilly First Call",
    description: "O'Reilly Auto Parts commercial catalog and ordering.",
    howToGet: "Contact your O'Reilly commercial account manager to request First Call API access.",
    fields: [
      { key: "username", label: "Username", placeholder: "O'Reilly username" },
      { key: "password", label: "Password", placeholder: "O'Reilly password", isSecret: true },
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

function SuppliersContent() {
  const searchParams = useSearchParams();
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

    const success = searchParams.get("success");
    const error = searchParams.get("error");
    if (success === "partstech") {
      setExpanded("partstech");
      setMessages((m) => ({ ...m, partstech: { ok: true, text: "Successfully connected to PartsTech!" } }));
    } else if (error) {
      setExpanded("partstech");
      setMessages((m) => ({ ...m, partstech: { ok: false, text: `Connection failed: ${error}` } }));
    }
  }, [searchParams]);

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
        <p className="font-medium mt-1 gap-1 flex items-center">
          <CheckCircle2 className="h-4 w-4" />
          Recommended: Start with PartsTech — one click connects you to multiple suppliers.
        </p>
      </div>

      <div className="space-y-3">
        {SUPPLIERS.map((sup) => {
          const isConfigured = !!savedConfigs[sup.key];
          const isOpen = expanded === sup.key;
          const msg = messages[sup.key as SupplierKey];
          const currentValues = fieldValues[sup.key as SupplierKey] ?? {};

          return (
            <div key={sup.key} className="border border-border rounded-xl overflow-hidden shadow-sm">
              {/* Header row */}
              <button
                className="w-full flex items-center justify-between px-4 py-3 hover:bg-surface-hover text-left bg-surface"
                onClick={() => setExpanded(isOpen ? null : sup.key)}
              >
                <div className="flex items-center gap-3">
                  {isConfigured ? (
                    <CheckCircle2 className="h-5 w-5 text-green-500 flex-shrink-0" />
                  ) : (
                    <XCircle className="h-5 w-5 text-muted-foreground/30 flex-shrink-0" />
                  )}
                  <div>
                    <p className="font-medium text-foreground text-sm">{sup.name}</p>
                    <p className="text-xs text-muted-foreground">{sup.description}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {isConfigured && (
                    <span className="text-xs font-medium text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/40 px-2.5 py-1 rounded-full flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]"></span>
                      Connected
                    </span>
                  )}
                  {isOpen ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                </div>
              </button>

              {/* Expanded form */}
              {isOpen && (
                <div className="px-4 pb-5 pt-3 border-t border-border space-y-4 bg-surface/30">
                  {/* How to get credentials */}
                  <div className="rounded-lg bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-800/30 px-3 py-2.5 text-sm text-orange-800 dark:text-orange-200">
                    <span className="font-semibold text-orange-900 dark:text-orange-100">Setup Guide: </span>{sup.howToGet}
                  </div>

                  {sup.key === "partstech" ? (
                    /* Auto-Connect UI for PartsTech */
                    <div className="flex flex-col items-center justify-center py-4 bg-background rounded-lg border border-border">
                      {isConfigured ? (
                        <div className="text-center space-y-3">
                           <div className="mx-auto w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                             <CheckCircle2 className="h-6 w-6 text-green-600 dark:text-green-400" />
                           </div>
                           <div>
                              <p className="font-medium">PartsTech account connected</p>
                              <p className="text-xs text-muted-foreground mt-1">Shop ID: <span className="font-mono">{savedConfigs[sup.key].shopId}</span></p>
                           </div>
                           <Button
                             variant="outline"
                             size="sm"
                             className="text-red-600 mt-2"
                             onClick={() => handleClear(sup.key)}
                             disabled={clearing === sup.key}
                           >
                             {clearing === sup.key ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5 mr-1.5" />}
                             Disconnect
                           </Button>
                        </div>
                      ) : (
                        <div className="text-center space-y-4 px-6 md:px-12 py-2">
                           <div className="space-y-2">
                             <p className="font-medium text-foreground">Link your PartsTech Account</p>
                             <p className="text-sm text-muted-foreground">Click the button below to sign in or create an account on PartsTech. Your accounts will be securely linked automatically.</p>
                           </div>
                           <Button asChild size="lg" className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white shadow-md">
                              <a href="/api/admin/suppliers/register">
                                Connect to PartsTech
                                <ExternalLink className="h-4 w-4 ml-2" />
                              </a>
                           </Button>
                           {msg && (
                            <p className="text-sm font-medium text-red-600 mt-2">
                              {msg.text}
                            </p>
                           )}
                        </div>
                      )}
                    </div>
                  ) : (
                    /* Standard Username/Password Fields for other suppliers */
                    <>
                      {isConfigured && savedConfigs[sup.key] && (
                        <div className="space-y-1 bg-background p-3 rounded-lg border border-border">
                          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Active Connection</p>
                          <div className="grid grid-cols-2 gap-2">
                            {Object.entries(savedConfigs[sup.key]).map(([k, v]) => (
                              <div key={k} className="text-sm">
                                <span className="text-muted-foreground">{k}: </span>
                                <span className="font-mono text-foreground">{v}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="space-y-4 pt-1">
                        <p className="text-xs font-semibold text-foreground uppercase tracking-wider border-b border-border pb-1">
                          {isConfigured ? "Re-enter to update credentials:" : "Enter your account details:"}
                        </p>
                        
                        <div className="grid gap-4 sm:grid-cols-2">
                          {sup.fields.map((field) => (
                            <div key={field.key} className="space-y-1.5">
                              <Label className="text-sm font-medium">{field.label}</Label>
                              <Input
                                type={field.isSecret ? "password" : "text"}
                                placeholder={field.placeholder}
                                value={currentValues[field.key] ?? ""}
                                onChange={(e) => setField(sup.key, field.key, e.target.value)}
                                className="h-10 text-sm bg-background border-border focus-visible:ring-primary"
                                autoComplete="off"
                              />
                            </div>
                          ))}
                        </div>
                      </div>

                      {msg && (
                        <p className={`text-sm font-medium pt-1 ${msg.ok ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
                          {msg.text}
                        </p>
                      )}

                      <div className="flex items-center gap-3 pt-3">
                        <Button
                          onClick={() => handleSave(sup.key)}
                          disabled={saving === sup.key}
                          className="min-w-[100px]"
                        >
                          {saving === sup.key && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                          Save Connection
                        </Button>
                        
                        {isConfigured && (
                          <Button
                            variant="ghost"
                            className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/30"
                            onClick={() => handleClear(sup.key)}
                            disabled={clearing === sup.key}
                          >
                            {clearing === sup.key ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Trash2 className="h-4 w-4 mr-2" />}
                            Disconnect
                          </Button>
                        )}
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function SuppliersPage() {
  return (
    <Suspense fallback={
      <div className="p-6 flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground mx-auto" />
      </div>
    }>
      <SuppliersContent />
    </Suspense>
  )
}
