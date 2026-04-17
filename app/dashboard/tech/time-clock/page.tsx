// [FEATURE: tech_time_clock]
// Technician time clock page — clock in/out on ROs, view today's entries with elapsed times.
// Remove this file to disable.

"use client";

import { useState, useEffect, useCallback } from "react";
import { Timer, PlayCircle, StopCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";

interface TimeEntry {
  id: string;
  repairOrderId: string;
  lineItemId: string | null;
  clockedInAt: string;
  clockedOutAt: string | null;
  flatRateHours: number | null;
  notes: string | null;
}

interface ROSummary {
  id: string;
  roNumber: string | null;
  vin: string;
  status: string;
  assignedTechId: string | null;
}

function formatElapsed(ms: number) {
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return h > 0
    ? `${h}h ${String(m).padStart(2, "0")}m`
    : `${m}m ${String(s).padStart(2, "0")}s`;
}

function formatHours(ms: number) {
  return (ms / (1000 * 60 * 60)).toFixed(2) + "h";
}

export default function TimeClockPage() {
  const [myROs, setMyROs] = useState<ROSummary[]>([]);
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [openEntry, setOpenEntry] = useState<TimeEntry | null>(null);
  const [now, setNow] = useState(Date.now());
  const [loading, setLoading] = useState(false);
  const [selectedRoId, setSelectedRoId] = useState<string>("");

  // Live timer
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const loadMyROs = useCallback(async () => {
    const res = await fetch("/api/ro?techId=me&limit=20");
    if (res.ok) {
      const { ros } = await res.json();
      setMyROs(ros ?? []);
    }
  }, []);

  // Load all time entries from today across my assigned ROs
  const loadEntries = useCallback(async () => {
    if (myROs.length === 0) return;
    // Load entries from the first few ROs
    const all: TimeEntry[] = [];
    for (const ro of myROs.slice(0, 10)) {
      const res = await fetch(`/api/ro/${ro.id}/time-entries`);
      if (res.ok) {
        const { entries: e } = await res.json();
        if (Array.isArray(e)) all.push(...e);
      }
    }
    const sorted = all.sort(
      (a, b) => new Date(b.clockedInAt).getTime() - new Date(a.clockedInAt).getTime()
    );
    setEntries(sorted);
    setOpenEntry(sorted.find((e) => !e.clockedOutAt) ?? null);
  }, [myROs]);

  useEffect(() => { loadMyROs(); }, [loadMyROs]);
  useEffect(() => { loadEntries(); }, [loadEntries]);

  async function clockIn() {
    if (!selectedRoId) return;
    setLoading(true);
    const res = await fetch(`/api/ro/${selectedRoId}/time-entries`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    setLoading(false);
    if (res.ok) {
      await loadEntries();
    } else {
      const { error } = await res.json().catch(() => ({ error: "Clock-in failed" }));
      alert(error);
    }
  }

  async function clockOut() {
    if (!openEntry) return;
    setLoading(true);
    const res = await fetch(
      `/api/ro/${openEntry.repairOrderId}/time-entries/${openEntry.id}`,
      { method: "PATCH" }
    );
    setLoading(false);
    if (res.ok) await loadEntries();
  }

  const todayEntries = entries.filter((e) => {
    const d = new Date(e.clockedInAt);
    const today = new Date();
    return (
      d.getFullYear() === today.getFullYear() &&
      d.getMonth() === today.getMonth() &&
      d.getDate() === today.getDate()
    );
  });

  const todayActualMs = todayEntries
    .filter((e) => e.clockedOutAt)
    .reduce((sum, e) => sum + new Date(e.clockedOutAt!).getTime() - new Date(e.clockedInAt).getTime(), 0);

  const todayFlatRate = todayEntries.reduce((sum, e) => sum + (e.flatRateHours ?? 0), 0);

  const roLabel = (roId: string) =>
    myROs.find((r) => r.id === roId)?.roNumber ?? roId.slice(-8).toUpperCase();

  return (
    <div className="p-6 max-w-xl space-y-6">
      <div className="flex items-center gap-3">
        <Timer className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold text-foreground">Time Clock</h1>
          <p className="text-sm text-muted-foreground">Track time on your assigned jobs</p>
        </div>
      </div>

      {/* Clock in/out panel */}
      <div className="p-5 rounded-xl border border-border bg-surface space-y-4">
        {openEntry ? (
          <div className="text-center space-y-2">
            <p className="text-sm text-muted-foreground">
              Clocked in on <span className="font-semibold text-foreground">{roLabel(openEntry.repairOrderId)}</span>
            </p>
            <p className="text-4xl font-mono font-bold text-foreground tabular-nums">
              {formatElapsed(now - new Date(openEntry.clockedInAt).getTime())}
            </p>
            <Button onClick={clockOut} disabled={loading} variant="destructive" className="w-full mt-2">
              <StopCircle className="h-4 w-4 mr-2" /> Clock Out
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">Select a job to clock in:</p>
            <select
              value={selectedRoId}
              onChange={(e) => setSelectedRoId(e.target.value)}
              className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="">— Select RO —</option>
              {myROs.map((ro) => (
                <option key={ro.id} value={ro.id}>
                  {ro.roNumber ?? ro.id.slice(-8)} — {ro.vin}
                </option>
              ))}
            </select>
            <Button onClick={clockIn} disabled={loading || !selectedRoId} className="w-full">
              <PlayCircle className="h-4 w-4 mr-2" /> Clock In
            </Button>
          </div>
        )}
      </div>

      {/* Today summary */}
      {todayEntries.length > 0 && (
        <div className="p-4 rounded-xl border border-border bg-surface space-y-2">
          <p className="text-sm font-semibold text-foreground">Today</p>
          <div className="flex gap-4 text-sm">
            <div>
              <p className="text-xs text-muted-foreground">Actual</p>
              <p className="font-mono font-semibold text-foreground">{formatHours(todayActualMs)}</p>
            </div>
            {todayFlatRate > 0 && (
              <div>
                <p className="text-xs text-muted-foreground">Flat Rate</p>
                <p className="font-mono font-semibold text-foreground">{todayFlatRate.toFixed(2)}h</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Entry list */}
      <div className="space-y-2">
        <p className="text-sm font-semibold text-foreground">Recent Entries</p>
        {todayEntries.length === 0 && (
          <p className="text-sm text-muted-foreground">No entries today</p>
        )}
        {todayEntries.map((e) => {
          const durationMs = e.clockedOutAt
            ? new Date(e.clockedOutAt).getTime() - new Date(e.clockedInAt).getTime()
            : now - new Date(e.clockedInAt).getTime();

          return (
            <div key={e.id} className="flex items-center justify-between px-3 py-2.5 rounded-lg border border-border bg-surface text-sm">
              <div>
                <p className="font-medium text-foreground">
                  <Link href={`/dashboard/ro/${e.repairOrderId}`} className="hover:underline">
                    {roLabel(e.repairOrderId)}
                  </Link>
                </p>
                <p className="text-xs text-muted-foreground">
                  {new Date(e.clockedInAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  {" → "}
                  {e.clockedOutAt
                    ? new Date(e.clockedOutAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                    : "in progress"}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-foreground">{formatHours(durationMs)}</span>
                {!e.clockedOutAt && (
                  <Badge className="bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300 text-xs">Live</Badge>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
