// [FEATURE: tech_time_clock]
// ClockWidget — compact clock-in/out widget for the technician dashboard page.
// Shows the current open entry (live timer) or a "Clock In" button.
// Remove this file and its usage in app/dashboard/tech/page.tsx to disable.

"use client";

import { useState, useEffect, useCallback } from "react";
import { Timer, StopCircle, PlayCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface OpenEntry {
  id: string;
  repairOrderId: string;
  clockedInAt: string;
  flatRateHours: number | null;
}

interface ClockWidgetProps {
  /** ID of the RO to clock in on — required for clock-in action */
  roId?: string;
  /** If provided, shown above the widget */
  jobLabel?: string;
}

function formatElapsed(ms: number) {
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return h > 0
    ? `${h}h ${String(m).padStart(2, "0")}m`
    : `${String(m).padStart(2, "0")}m ${String(s).padStart(2, "0")}s`;
}

export function ClockWidget({ roId, jobLabel }: ClockWidgetProps) {
  const [openEntry, setOpenEntry] = useState<OpenEntry | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);

  // Poll for open entry on mount
  const checkOpen = useCallback(async () => {
    if (!roId) { setChecking(false); return; }
    const res = await fetch(`/api/ro/${roId}/time-entries`);
    if (res.ok) {
      const { entries } = await res.json();
      const open = entries?.find((e: { clockedOutAt: null | string }) => !e.clockedOutAt) ?? null;
      setOpenEntry(open);
    }
    setChecking(false);
  }, [roId]);

  useEffect(() => { checkOpen(); }, [checkOpen]);

  // Live timer
  useEffect(() => {
    if (!openEntry) return;
    const tick = () => setElapsed(Date.now() - new Date(openEntry.clockedInAt).getTime());
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [openEntry]);

  async function clockIn() {
    if (!roId) return;
    setLoading(true);
    const res = await fetch(`/api/ro/${roId}/time-entries`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    if (res.ok) {
      const { entry } = await res.json();
      setOpenEntry({ ...entry, clockedInAt: entry.clockedInAt });
    } else {
      const { error } = await res.json().catch(() => ({ error: "Failed" }));
      alert(error ?? "Clock-in failed");
    }
    setLoading(false);
  }

  async function clockOut() {
    if (!openEntry) return;
    setLoading(true);
    const res = await fetch(`/api/ro/${openEntry.repairOrderId}/time-entries/${openEntry.id}`, {
      method: "PATCH",
    });
    if (res.ok) {
      setOpenEntry(null);
      setElapsed(0);
    }
    setLoading(false);
  }

  if (checking) return null;

  return (
    <div className="flex items-center gap-3 p-3 rounded-lg border border-border bg-surface">
      <Timer className={`h-5 w-5 flex-shrink-0 ${openEntry ? "text-green-500 animate-pulse" : "text-muted-foreground"}`} />

      <div className="flex-1 min-w-0">
        {jobLabel && <p className="text-xs text-muted-foreground truncate">{jobLabel}</p>}
        {openEntry ? (
          <p className="text-sm font-mono font-semibold text-foreground">{formatElapsed(elapsed)}</p>
        ) : (
          <p className="text-sm text-muted-foreground">Not clocked in</p>
        )}
      </div>

      {roId && (
        openEntry ? (
          <Button size="sm" variant="outline" onClick={clockOut} disabled={loading} className="flex-shrink-0">
            <StopCircle className="h-3.5 w-3.5 mr-1 text-red-500" />
            Clock Out
          </Button>
        ) : (
          <Button size="sm" onClick={clockIn} disabled={loading} className="flex-shrink-0">
            <PlayCircle className="h-3.5 w-3.5 mr-1" />
            Clock In
          </Button>
        )
      )}
    </div>
  );
}
