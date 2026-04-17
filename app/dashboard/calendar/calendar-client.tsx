"use client";

import { useState, useEffect, useCallback } from "react";
import { Calendar, dateFnsLocalizer, Views, type View } from "react-big-calendar";
import { format, parse, startOfWeek, getDay } from "date-fns";
import { toZonedTime, fromZonedTime } from "date-fns-tz";
import { enUS } from "date-fns/locale";
import "react-big-calendar/lib/css/react-big-calendar.css";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ChevronRight, CalendarDays, X } from "lucide-react";
import { cn } from "@/lib/utils";

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek: () => startOfWeek(new Date(), { weekStartsOn: 0 }),
  getDay,
  locales: { "en-US": enUS },
});

type CalendarEvent = {
  id: string;
  title: string;
  start: Date;
  end: Date;
  roId: string;
  status: string;
  techId: string | null;
  techName: string;
  advisorName: string | null;
  color: string;
  customerName: string | null;
};

type ApiEvent = Omit<CalendarEvent, "start" | "end"> & {
  start: string;
  end: string;
};

const STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  presented: "Presented",
  approved: "Approved",
  closed: "Closed",
};

export function CalendarClient({ timezone }: { timezone: string }) {
  const [view, setView] = useState<View>(Views.WEEK);
  const [date, setDate] = useState(new Date());
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<CalendarEvent | null>(null);

  const fetchEvents = useCallback(
    async (rangeStart: Date, rangeEnd: Date) => {
      setLoading(true);
      try {
        // Convert local display dates to UTC for the API query
        const utcStart = fromZonedTime(rangeStart, timezone);
        const utcEnd = fromZonedTime(rangeEnd, timezone);
        const res = await fetch(
          `/api/calendar/events?start=${utcStart.toISOString()}&end=${utcEnd.toISOString()}`
        );
        if (!res.ok) return;
        const data = await res.json();
        const mapped: CalendarEvent[] = (data.events as ApiEvent[]).map((e) => ({
          ...e,
          // Convert stored UTC dates to the rooftop timezone for display
          start: toZonedTime(new Date(e.start), timezone),
          end: toZonedTime(new Date(e.end), timezone),
        }));
        setEvents(mapped);
      } finally {
        setLoading(false);
      }
    },
    [timezone]
  );

  // Initial load — fetch current month window
  useEffect(() => {
    const start = new Date(date);
    start.setDate(1);
    const end = new Date(date);
    end.setMonth(end.getMonth() + 1);
    fetchEvents(start, end);
  }, [date, fetchEvents]);

  function handleRangeChange(range: Date[] | { start: Date; end: Date }) {
    const start = Array.isArray(range) ? range[0] : range.start;
    const end = Array.isArray(range) ? range[range.length - 1] : range.end;
    if (start && end) fetchEvents(start, end);
  }

  const eventStyleGetter = (event: CalendarEvent) => ({
    style: {
      backgroundColor: event.color,
      borderColor: event.color,
      color: "#fff",
      borderRadius: "6px",
      fontSize: "12px",
      padding: "2px 6px",
    },
  });

  const tzLabel = new Intl.DateTimeFormat("en-US", {
    timeZoneName: "short",
    timeZone: timezone,
  })
    .formatToParts(new Date())
    .find((p) => p.type === "timeZoneName")?.value ?? timezone;

  return (
    <div className="p-6 h-full flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <CalendarDays className="h-6 w-6 text-primary" />
            Service Calendar
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">Times shown in {tzLabel}</p>
        </div>
        {/* View switcher */}
        <div className="flex gap-1 bg-surface border border-border rounded-lg p-1">
          {([Views.MONTH, Views.WEEK, Views.DAY] as View[]).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={cn(
                "px-3 py-1.5 text-sm rounded-md transition-colors capitalize font-medium",
                view === v
                  ? "bg-primary text-white"
                  : "text-muted-foreground hover:bg-surface-hover"
              )}
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      {/* Calendar */}
      <div className={cn("flex-1 min-h-0 bg-background rounded-xl border border-border overflow-hidden [&_.rbc-header]:bg-surface [&_.rbc-header]:border-b [&_.rbc-header]:border-border [&_.rbc-today]:bg-primary/5 [&_.rbc-off-range-bg]:bg-surface/50 [&_.rbc-toolbar]:hidden [&_.rbc-calendar]:h-full", loading && "opacity-60 pointer-events-none")}>
        <Calendar
          localizer={localizer}
          events={events}
          view={view}
          date={date}
          onView={setView}
          onNavigate={setDate}
          onRangeChange={handleRangeChange}
          eventPropGetter={eventStyleGetter}
          onSelectEvent={(event) => setSelected(event as CalendarEvent)}
          style={{ height: "100%", minHeight: 500 }}
          popup
        />
      </div>

      {/* Mini navigation toolbar below calendar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => {
            const d = new Date(date);
            if (view === Views.MONTH) d.setMonth(d.getMonth() - 1);
            else if (view === Views.WEEK) d.setDate(d.getDate() - 7);
            else d.setDate(d.getDate() - 1);
            setDate(d);
          }}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => setDate(new Date())}>
            Today
          </Button>
          <Button variant="outline" size="icon" onClick={() => {
            const d = new Date(date);
            if (view === Views.MONTH) d.setMonth(d.getMonth() + 1);
            else if (view === Views.WEEK) d.setDate(d.getDate() + 7);
            else d.setDate(d.getDate() + 1);
            setDate(d);
          }}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <span className="text-sm font-medium text-foreground ml-2">
            {format(date, view === Views.DAY ? "MMMM d, yyyy" : view === Views.WEEK ? "'Week of' MMM d" : "MMMM yyyy")}
          </span>
        </div>
        <p className="text-xs text-muted-foreground">{events.length} scheduled RO{events.length !== 1 ? "s" : ""}</p>
      </div>

      {/* Event detail slide-in */}
      {selected && (
        <div className="fixed inset-y-0 right-0 w-80 bg-background border-l border-border shadow-xl z-50 flex flex-col">
          <div className="p-4 border-b border-border flex items-center justify-between">
            <h2 className="font-semibold text-foreground text-sm">RO Details</h2>
            <button onClick={() => setSelected(null)} className="text-muted-foreground hover:text-foreground">
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="p-4 space-y-3 overflow-y-auto flex-1">
            <div
              className="w-3 h-3 rounded-full inline-block mr-2"
              style={{ backgroundColor: selected.color }}
            />
            <p className="inline text-sm font-medium text-foreground">{selected.title}</p>

            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Status</span>
                <Badge variant="outline">{STATUS_LABELS[selected.status] ?? selected.status}</Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Tech</span>
                <span className="text-foreground">{selected.techName}</span>
              </div>
              {selected.advisorName && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Advisor</span>
                  <span className="text-foreground">{selected.advisorName}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-muted-foreground">Start</span>
                <span className="text-foreground text-xs">
                  {format(selected.start, "MMM d, h:mm a")}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">End</span>
                <span className="text-foreground text-xs">
                  {format(selected.end, "MMM d, h:mm a")}
                </span>
              </div>
              {selected.customerName && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Customer</span>
                  <span className="text-foreground">{selected.customerName}</span>
                </div>
              )}
            </div>

            <div className="pt-2">
              <a
                href={`/dashboard/ro/${selected.roId}`}
                className="flex items-center justify-center w-full h-8 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:brightness-105 transition-all"
              >
                Open RO
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
