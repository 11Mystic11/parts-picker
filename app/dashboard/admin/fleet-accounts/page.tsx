// [FEATURE: fleet_accounts]
// Fleet Account Management — list of commercial fleet customers.
// Remove this file to disable.

"use client";

import { useState, useEffect, useCallback } from "react";
import { Truck, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface FleetAccount {
  id: string;
  companyName: string;
  contactName: string | null;
  contactPhone: string | null;
  contactEmail: string | null;
  billingCycle: string;
  requiresPo: boolean;
  isActive: boolean;
  notes: string | null;
  openROCount: number;
  totalROCount: number;
}

export default function FleetAccountsPage() {
  const [accounts, setAccounts] = useState<FleetAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    companyName: "",
    contactName: "",
    contactPhone: "",
    contactEmail: "",
    billingCycle: "monthly",
    requiresPo: false,
  });

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/fleet-accounts");
    if (res.ok) {
      const { accounts: data } = await res.json();
      setAccounts(data ?? []);
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function createAccount(e: React.FormEvent) {
    e.preventDefault();
    if (!form.companyName) return;
    setSaving(true);
    const res = await fetch("/api/fleet-accounts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        companyName: form.companyName,
        contactName: form.contactName || null,
        contactPhone: form.contactPhone || null,
        contactEmail: form.contactEmail || null,
        billingCycle: form.billingCycle,
        requiresPo: form.requiresPo,
      }),
    });
    setSaving(false);
    if (res.ok) {
      setShowForm(false);
      setForm({ companyName: "", contactName: "", contactPhone: "", contactEmail: "", billingCycle: "monthly", requiresPo: false });
      load();
    }
  }

  async function deactivate(id: string, name: string) {
    if (!confirm(`Deactivate ${name}? Their RO history will be preserved.`)) return;
    await fetch(`/api/fleet-accounts/${id}`, { method: "DELETE" });
    load();
  }

  return (
    <div className="p-6 max-w-4xl space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Truck className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-2xl font-bold text-foreground">Fleet Accounts</h1>
            <p className="text-sm text-muted-foreground">Commercial fleet customers with volume billing</p>
          </div>
        </div>
        <Button size="sm" onClick={() => setShowForm(true)}>
          <Plus className="h-4 w-4 mr-1.5" /> New Account
        </Button>
      </div>

      {loading ? (
        <div className="py-16 text-center text-sm text-muted-foreground animate-pulse">Loading…</div>
      ) : accounts.length === 0 ? (
        <div className="border border-border rounded-xl p-10 text-center text-sm text-muted-foreground">
          No fleet accounts yet. Add your first commercial customer to get started.
        </div>
      ) : (
        <div className="border border-border rounded-xl overflow-hidden">
          <div className="px-4 py-2.5 bg-surface border-b border-border">
            <span className="text-sm font-semibold text-muted-foreground">{accounts.length} active account{accounts.length !== 1 ? "s" : ""}</span>
          </div>
          <div className="divide-y divide-border">
            {accounts.map((a) => (
              <div key={a.id} className="px-4 py-3 flex items-start gap-3 hover:bg-surface-hover text-sm">
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-foreground">{a.companyName}</span>
                    <span className="text-xs text-muted-foreground bg-surface border border-border px-1.5 py-0.5 rounded capitalize">{a.billingCycle}</span>
                    {a.requiresPo && (
                      <span className="text-xs text-amber-700 dark:text-amber-300 bg-amber-100 dark:bg-amber-900/40 px-1.5 py-0.5 rounded">PO required</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                    {a.contactName && <span>{a.contactName}</span>}
                    {a.contactPhone && <><span>·</span><span>{a.contactPhone}</span></>}
                    {a.contactEmail && <><span>·</span><span>{a.contactEmail}</span></>}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {a.openROCount} open RO{a.openROCount !== 1 ? "s" : ""} · {a.totalROCount} total
                  </p>
                </div>
                <button
                  onClick={() => deactivate(a.id, a.companyName)}
                  className="text-muted-foreground hover:text-red-500 transition-colors flex-shrink-0"
                  title="Deactivate"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Create form modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-background border border-border rounded-xl w-full max-w-md shadow-xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <h2 className="font-semibold text-foreground">New Fleet Account</h2>
              <button onClick={() => setShowForm(false)} className="text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={createAccount} className="p-5 space-y-4">
              <div className="space-y-1.5">
                <Label>Company Name *</Label>
                <Input value={form.companyName} onChange={(e) => setForm((f) => ({ ...f, companyName: e.target.value }))} required />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Contact Name</Label>
                  <Input value={form.contactName} onChange={(e) => setForm((f) => ({ ...f, contactName: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label>Contact Phone</Label>
                  <Input type="tel" value={form.contactPhone} onChange={(e) => setForm((f) => ({ ...f, contactPhone: e.target.value }))} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Contact Email</Label>
                <Input type="email" value={form.contactEmail} onChange={(e) => setForm((f) => ({ ...f, contactEmail: e.target.value }))} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Billing Cycle</Label>
                  <select
                    value={form.billingCycle}
                    onChange={(e) => setForm((f) => ({ ...f, billingCycle: e.target.value }))}
                    className="w-full h-9 px-3 text-sm border border-border rounded bg-background text-foreground"
                  >
                    <option value="monthly">Monthly</option>
                    <option value="weekly">Weekly</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label>Requires PO</Label>
                  <div className="flex items-center gap-2 h-9">
                    <input
                      type="checkbox"
                      id="requiresPo"
                      checked={form.requiresPo}
                      onChange={(e) => setForm((f) => ({ ...f, requiresPo: e.target.checked }))}
                      className="rounded"
                    />
                    <label htmlFor="requiresPo" className="text-sm text-foreground">Yes</label>
                  </div>
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <Button type="button" variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
                <Button type="submit" disabled={saving}>{saving ? "Creating…" : "Create"}</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
