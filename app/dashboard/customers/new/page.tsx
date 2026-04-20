"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, UserPlus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export default function NewCustomerPage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", phone: "", email: "", notes: "" });

  function set(f: string, v: string) { setForm((p) => ({ ...p, [f]: v })); }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const res = await fetch("/api/customers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: form.name, phone: form.phone || undefined, email: form.email || undefined, notes: form.notes || undefined }),
    });
    if (res.ok) {
      const data = await res.json();
      router.push(`/dashboard/customers/${data.customer.id}`);
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Failed to create customer");
      setSaving(false);
    }
  }

  return (
    <div className="p-6 max-w-lg mx-auto space-y-6">
      <Link href="/dashboard/customers" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ChevronLeft className="h-4 w-4" />Customers
      </Link>
      <div className="flex items-center gap-3">
        <UserPlus className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold text-foreground">New Customer</h1>
      </div>
      <form onSubmit={submit} className="space-y-4">
        <div className="space-y-1">
          <Label>Name <span className="text-destructive">*</span></Label>
          <Input value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="John Smith" required />
        </div>
        <div className="space-y-1">
          <Label>Phone</Label>
          <Input value={form.phone} onChange={(e) => set("phone", e.target.value)} placeholder="(555) 000-0000" type="tel" />
        </div>
        <div className="space-y-1">
          <Label>Email</Label>
          <Input value={form.email} onChange={(e) => set("email", e.target.value)} placeholder="john@example.com" type="email" />
        </div>
        <div className="space-y-1">
          <Label>Notes</Label>
          <Textarea value={form.notes} onChange={(e) => set("notes", e.target.value)} placeholder="Any notes about this customer…" rows={3} />
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <div className="flex gap-3 pt-2">
          <Button type="submit" disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}Save Customer
          </Button>
          <Link href="/dashboard/customers"><Button type="button" variant="outline">Cancel</Button></Link>
        </div>
      </form>
    </div>
  );
}
