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
import { CalendarDays, ChevronDown, ChevronUp, Check } from "lucide-react";
import { cn } from "@/lib/utils";

type Tech = { id: string; name: string | null; employeeId: string | null };

type Props = {
  roId: string;
  scheduledAt: string | null;
  estimatedDuration: number | null;
  assignedTechId: string | null;
  customerName: string | null;
  customerPhone: string | null;
  customerEmail: string | null;
  techs: Tech[];
};

export function ROScheduleForm({
  roId,
  scheduledAt,
  estimatedDuration,
  assignedTechId,
  customerName,
  customerPhone,
  customerEmail,
  techs,
}: Props) {
  const [open, setOpen] = useState(!!scheduledAt || !!customerName);
  const [form, setForm] = useState({
    scheduledAt: scheduledAt
      ? new Date(scheduledAt).toISOString().slice(0, 16) // datetime-local format
      : "",
    estimatedDuration: String(estimatedDuration ?? "60"),
    assignedTechId: assignedTechId ?? "",
    customerName: customerName ?? "",
    customerPhone: customerPhone ?? "",
    customerEmail: customerEmail ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  async function handleSave() {
    setSaving(true);
    setSaved(false);
    setError("");
    try {
      const res = await fetch(`/api/ro/${roId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scheduledAt: form.scheduledAt ? new Date(form.scheduledAt).toISOString() : null,
          estimatedDuration: form.estimatedDuration ? parseInt(form.estimatedDuration, 10) : null,
          assignedTechId: form.assignedTechId || null,
          customerName: form.customerName || null,
          customerPhone: form.customerPhone || null,
          customerEmail: form.customerEmail || null,
        }),
      });
      if (res.ok) {
        setSaved(true);
        setTimeout(() => setSaved(false), 2500);
      } else {
        const data = await res.json();
        setError(data.error ?? "Failed to save");
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mb-6 rounded-lg border border-border overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-4 py-3 bg-surface text-sm font-medium text-foreground hover:bg-surface-hover transition-colors"
      >
        <span className="flex items-center gap-2">
          <CalendarDays className="h-4 w-4 text-primary" />
          Schedule &amp; Customer Info
          {scheduledAt && (
            <span className="text-xs text-primary font-normal ml-1">
              {new Date(scheduledAt).toLocaleString()}
            </span>
          )}
        </span>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      {open && (
        <div className="p-4 space-y-4 bg-background border-t border-border">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Scheduling */}
            <div className="space-y-1">
              <Label>Scheduled Date &amp; Time</Label>
              <Input
                type="datetime-local"
                value={form.scheduledAt}
                onChange={(e) => setForm((p) => ({ ...p, scheduledAt: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label>Estimated Duration (minutes)</Label>
              <Input
                type="number"
                min={0}
                step={15}
                value={form.estimatedDuration}
                onChange={(e) => setForm((p) => ({ ...p, estimatedDuration: e.target.value }))}
                placeholder="60"
              />
            </div>

            {/* Tech assignment */}
            <div className="space-y-1">
              <Label>Assign Technician</Label>
              <Select
                value={form.assignedTechId}
                onValueChange={(v) => setForm((p) => ({ ...p, assignedTechId: v ?? "" }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Unassigned" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Unassigned</SelectItem>
                  {techs.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name ?? "Unnamed"}{t.employeeId ? ` (${t.employeeId})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {techs.length === 0 && (
                <p className="text-xs text-muted-foreground">No technicians assigned to this rooftop yet.</p>
              )}
            </div>

            {/* Customer info */}
            <div className="space-y-1">
              <Label>Customer Name</Label>
              <Input
                value={form.customerName}
                onChange={(e) => setForm((p) => ({ ...p, customerName: e.target.value }))}
                placeholder="Jane Smith"
              />
            </div>
            <div className="space-y-1">
              <Label>Customer Phone</Label>
              <Input
                type="tel"
                value={form.customerPhone}
                onChange={(e) => setForm((p) => ({ ...p, customerPhone: e.target.value }))}
                placeholder="(555) 555-5555"
              />
            </div>
            <div className="space-y-1">
              <Label>Customer Email</Label>
              <Input
                type="email"
                value={form.customerEmail}
                onChange={(e) => setForm((p) => ({ ...p, customerEmail: e.target.value }))}
                placeholder="jane@example.com"
              />
            </div>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex items-center gap-3">
            <Button onClick={handleSave} disabled={saving} size="sm">
              {saving ? "Saving…" : "Save"}
            </Button>
            {saved && (
              <span className="flex items-center gap-1 text-sm text-green-600">
                <Check className="h-4 w-4" /> Saved
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
