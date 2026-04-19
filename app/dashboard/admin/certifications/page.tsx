// [FEATURE: certifications]
// Tech certification tracker — all techs at rooftop with their certs, expiry alerts.
// Remove this file to disable.

"use client";

import { useState, useEffect, useCallback } from "react";
import { Award, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface TechCert {
  id: string;
  certType: string;
  name: string;
  certNumber: string | null;
  issuedAt: string | null;
  expiresAt: string | null;
  notes: string | null;
  user: { name: string | null; role: string };
}

function daysUntil(iso: string) {
  return Math.floor((new Date(iso).getTime() - Date.now()) / 86_400_000);
}

function ExpiryBadge({ expiresAt }: { expiresAt: string | null }) {
  if (!expiresAt) return null;
  const days = daysUntil(expiresAt);
  if (days < 0) return <span className="text-xs px-2 py-0.5 rounded font-medium bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300">Expired</span>;
  if (days < 30) return <span className="text-xs px-2 py-0.5 rounded font-medium bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300">{days}d left</span>;
  if (days < 90) return <span className="text-xs px-2 py-0.5 rounded font-medium bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300">{days}d left</span>;
  return <span className="text-xs text-muted-foreground">{new Date(expiresAt).toLocaleDateString()}</span>;
}

export default function CertificationsPage() {
  const [certs, setCerts] = useState<TechCert[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ userId: "", certType: "", name: "", certNumber: "", issuedAt: "", expiresAt: "" });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/certifications");
    if (res.ok) {
      const { certs: data } = await res.json();
      setCerts(data ?? []);
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function addCert(e: React.FormEvent) {
    e.preventDefault();
    if (!form.userId || !form.certType || !form.name) return;
    setSaving(true);
    const res = await fetch("/api/certifications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: form.userId,
        certType: form.certType,
        name: form.name,
        certNumber: form.certNumber || null,
        issuedAt: form.issuedAt ? new Date(form.issuedAt).toISOString() : null,
        expiresAt: form.expiresAt ? new Date(form.expiresAt).toISOString() : null,
      }),
    });
    setSaving(false);
    if (res.ok) {
      setShowForm(false);
      setForm({ userId: "", certType: "", name: "", certNumber: "", issuedAt: "", expiresAt: "" });
      load();
    }
  }

  async function deleteCert(id: string) {
    if (!confirm("Delete this certification?")) return;
    await fetch(`/api/certifications/${id}`, { method: "DELETE" });
    load();
  }

  // Group by user
  const byUser = new Map<string, { name: string; role: string; certs: TechCert[] }>();
  for (const c of certs) {
    const key = c.user.name ?? "Unknown";
    if (!byUser.has(key)) byUser.set(key, { name: key, role: c.user.role, certs: [] });
    byUser.get(key)!.certs.push(c);
  }

  const expiringCount = certs.filter((c) => c.expiresAt && daysUntil(c.expiresAt) < 90).length;

  return (
    <div className="p-6 max-w-4xl space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Award className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-2xl font-bold text-foreground">Certifications</h1>
            <p className="text-sm text-muted-foreground">
              {certs.length} total · {expiringCount > 0 ? <span className="text-amber-600 dark:text-amber-400">{expiringCount} expiring soon</span> : "all current"}
            </p>
          </div>
        </div>
        <Button size="sm" onClick={() => setShowForm(true)}>
          <Plus className="h-4 w-4 mr-1.5" /> Add Cert
        </Button>
      </div>

      {loading ? (
        <div className="py-16 text-center text-sm text-muted-foreground animate-pulse">Loading…</div>
      ) : certs.length === 0 ? (
        <div className="border border-border rounded-xl p-10 text-center text-sm text-muted-foreground">
          No certifications on file. Click &ldquo;Add Cert&rdquo; to add one.
        </div>
      ) : (
        <div className="space-y-4">
          {Array.from(byUser.values()).map((group) => (
            <div key={group.name} className="border border-border rounded-xl overflow-hidden">
              <div className="px-4 py-2.5 bg-surface border-b border-border flex items-center gap-2">
                <span className="font-semibold text-foreground text-sm">{group.name}</span>
                <span className="text-xs text-muted-foreground capitalize">({group.role})</span>
              </div>
              <div className="divide-y divide-border">
                {group.certs.map((cert) => (
                  <div key={cert.id} className="px-4 py-3 flex items-center gap-3 hover:bg-surface-hover text-sm">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-foreground">{cert.name}</span>
                        <span className="text-xs text-muted-foreground bg-surface border border-border px-1.5 py-0.5 rounded">{cert.certType}</span>
                        <ExpiryBadge expiresAt={cert.expiresAt} />
                      </div>
                      {cert.certNumber && (
                        <p className="text-xs text-muted-foreground mt-0.5">#{cert.certNumber}</p>
                      )}
                    </div>
                    <button
                      onClick={() => deleteCert(cert.id)}
                      className="text-muted-foreground hover:text-red-500 transition-colors"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add cert modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-background border border-border rounded-xl w-full max-w-md shadow-xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <h2 className="font-semibold text-foreground">Add Certification</h2>
              <button onClick={() => setShowForm(false)} className="text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={addCert} className="p-5 space-y-4">
              <div className="space-y-1.5">
                <Label>User ID *</Label>
                <Input placeholder="Paste user ID from admin panel" value={form.userId} onChange={(e) => setForm((f) => ({ ...f, userId: e.target.value }))} required />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Cert Type *</Label>
                  <Input placeholder="e.g. ASE_A1, OEM_FORD" value={form.certType} onChange={(e) => setForm((f) => ({ ...f, certType: e.target.value }))} required />
                </div>
                <div className="space-y-1.5">
                  <Label>Cert Number</Label>
                  <Input value={form.certNumber} onChange={(e) => setForm((f) => ({ ...f, certNumber: e.target.value }))} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Full Name *</Label>
                <Input placeholder="e.g. ASE A1 Engine Repair" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Issued Date</Label>
                  <Input type="date" value={form.issuedAt} onChange={(e) => setForm((f) => ({ ...f, issuedAt: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label>Expiry Date</Label>
                  <Input type="date" value={form.expiresAt} onChange={(e) => setForm((f) => ({ ...f, expiresAt: e.target.value }))} />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <Button type="button" variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
                <Button type="submit" disabled={saving}>{saving ? "Saving…" : "Add"}</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
