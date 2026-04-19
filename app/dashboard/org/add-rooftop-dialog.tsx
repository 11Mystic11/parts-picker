"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, AlertTriangle, Loader2 } from "lucide-react";

const US_TIMEZONES = [
  { label: "Eastern Time", value: "America/New_York" },
  { label: "Central Time", value: "America/Chicago" },
  { label: "Mountain Time", value: "America/Denver" },
  { label: "Mountain Time (Arizona)", value: "America/Phoenix" },
  { label: "Pacific Time", value: "America/Los_Angeles" },
  { label: "Alaska Time", value: "America/Anchorage" },
  { label: "Hawaii Time", value: "Pacific/Honolulu" },
];

export function AddRooftopDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [timezone, setTimezone] = useState("America/Chicago");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setName("");
    setTimezone("America/Chicago");
    setError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/org/rooftops", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), timezone }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to create location");
      reset();
      setOpen(false);
      router.refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <Button onClick={() => setOpen(true)} variant="outline" className="gap-2">
        <Plus className="h-4 w-4" />
        Add Location
      </Button>

      <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); setOpen(v); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add New Location</DialogTitle>
          </DialogHeader>

          {/* Cost warning */}
          <div className="flex items-start gap-3 p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-sm">
            <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
            <p className="text-amber-800 dark:text-amber-300">
              Adding a new location may incur additional charges on your plan. Please confirm this with your account manager before proceeding.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1">
              <Label>Location name <span className="text-destructive">*</span></Label>
              <Input
                placeholder="e.g. North Campus Service"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1">
              <Label>Timezone</Label>
              <Select value={timezone} onValueChange={(v) => setTimezone(v ?? timezone)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {US_TIMEZONES.map((tz) => (
                    <SelectItem key={tz.value} value={tz.value}>{tz.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <DialogFooter className="gap-2">
              <Button type="button" variant="outline" onClick={() => { reset(); setOpen(false); }}>Cancel</Button>
              <Button type="submit" disabled={submitting || !name.trim()}>
                {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Create Location
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
