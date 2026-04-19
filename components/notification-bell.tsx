// [FEATURE: notifications]
// Bell icon with unread badge; popover shows latest notifications.
"use client";

import { useState, useEffect, useRef } from "react";
import { Bell } from "lucide-react";
import { useRouter } from "next/navigation";

interface Notification {
  id: string;
  title: string;
  body: string;
  type: string;
  entityId: string | null;
  createdAt: string;
}

const TYPE_ROUTES: Record<string, string> = {
  ro_approved: "/dashboard/ro",
  sop_arrived: "/dashboard/inventory/special-orders",
  backorder_cleared: "/dashboard/inventory/backorders",
  inspection_flagged: "/dashboard/ro",
  recall_found: "/dashboard/ro",
  parts_arrived: "/dashboard/inventory/special-orders",
  dms_sync_failed: "/dashboard/admin",
};

export function NotificationBell() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  async function load() {
    try {
      const res = await fetch("/api/notifications");
      if (res.ok) {
        const { notifications: data, unreadCount: count } = await res.json();
        setNotifications(data ?? []);
        setUnreadCount(count ?? 0);
      }
    } catch { /* silent */ }
  }

  useEffect(() => {
    load();
    const interval = setInterval(load, 60_000);
    return () => clearInterval(interval);
  }, []);

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  async function markRead(id: string) {
    await fetch(`/api/notifications/${id}`, { method: "PATCH" });
    setNotifications((prev) => prev.filter((n) => n.id !== id));
    setUnreadCount((c) => Math.max(0, c - 1));
  }

  async function markAllRead() {
    await fetch("/api/notifications/read-all", { method: "POST" });
    setNotifications([]);
    setUnreadCount(0);
  }

  function handleNotificationClick(n: Notification) {
    markRead(n.id);
    const base = TYPE_ROUTES[n.type] ?? "/dashboard";
    if (n.entityId) {
      router.push(`${base}/${n.entityId}`);
    } else {
      router.push(base);
    }
    setOpen(false);
  }

  function timeAgo(iso: string) {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60_000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-surface-hover transition-colors"
        aria-label="Notifications"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 h-4 w-4 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute left-0 bottom-full mb-2 w-80 bg-background border border-border rounded-xl shadow-xl z-50 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <span className="text-sm font-semibold text-foreground">Notifications</span>
            {unreadCount > 0 && (
              <button
                onClick={markAllRead}
                className="text-xs text-primary hover:underline"
              >
                Mark all read
              </button>
            )}
          </div>

          {notifications.length === 0 ? (
            <div className="px-4 py-6 text-center text-sm text-muted-foreground">
              All caught up!
            </div>
          ) : (
            <div className="divide-y divide-border max-h-80 overflow-y-auto">
              {notifications.map((n) => (
                <div
                  key={n.id}
                  onClick={() => handleNotificationClick(n)}
                  className="px-4 py-3 hover:bg-surface-hover cursor-pointer"
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium text-foreground leading-snug">{n.title}</p>
                    <span className="text-[11px] text-muted-foreground flex-shrink-0 mt-0.5">
                      {timeAgo(n.createdAt)}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.body}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
