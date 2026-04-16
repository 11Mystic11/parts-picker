"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { MessageSquare, Send, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type RO = {
  id: string;
  vin: string;
  vehicleSnapshot: string;
  status: string;
};

type Message = {
  id: string;
  content: string;
  category: string;
  createdAt: string;
  author: {
    id: string;
    name: string | null;
    role: string;
    employeeId: string | null;
  };
};

type Mode = "internal" | "client" | "both";

function getVehicleLabel(ro: RO): string {
  try {
    const v = JSON.parse(ro.vehicleSnapshot);
    const label = `${v.year ?? ""} ${v.make ?? ""} ${v.model ?? ""}`.trim();
    return label || ro.vin.slice(-6);
  } catch {
    return ro.vin.slice(-6);
  }
}

// ─── Shared chat logic hook ────────────────────────────────────────────────────

function useChatState() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const userId = (session?.user as any)?.id as string | undefined;

  const [ros, setRos] = useState<RO[]>([]);
  const [selectedRoId, setSelectedRoId] = useState<string>("");
  const [mode, setMode] = useState<Mode>("internal");
  const [messages, setMessages] = useState<Message[]>([]);
  const [compose, setCompose] = useState("");
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Detect RO from current URL
  const roFromPath = pathname.match(/\/dashboard\/ro\/([^/]+)/)?.[1];

  // Fetch active ROs for selector
  useEffect(() => {
    if (!session) return;
    fetch("/api/ro?limit=50")
      .then((r) => r.json())
      .then((data) => setRos(data.ros ?? []))
      .catch(() => {});
  }, [session]);

  // Auto-select RO when navigating to an RO page
  useEffect(() => {
    if (roFromPath && roFromPath !== selectedRoId) {
      setSelectedRoId(roFromPath);
    }
  }, [roFromPath]); // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch messages for selected RO
  const fetchMessages = useCallback(async () => {
    if (!selectedRoId) {
      setMessages([]);
      return;
    }
    try {
      const r = await fetch(`/api/ro/${selectedRoId}/messages`);
      if (r.ok) setMessages(await r.json());
    } catch {
      // ignore network errors silently
    }
  }, [selectedRoId]);

  useEffect(() => {
    fetchMessages();
    if (pollingRef.current) clearInterval(pollingRef.current);
    pollingRef.current = setInterval(fetchMessages, 30_000);
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [fetchMessages]);

  // Scroll to newest message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const filteredMessages = messages.filter((m) => {
    if (mode === "internal") return m.category === "message";
    if (mode === "client") return m.category === "external";
    return m.category !== "note"; // "both" shows message + external
  });

  async function handleSend() {
    if (!compose.trim() || !selectedRoId || sending) return;
    setSending(true);
    try {
      const category = mode === "client" ? "external" : "message";
      const r = await fetch(`/api/ro/${selectedRoId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: compose.trim(), category }),
      });
      if (r.ok) {
        const msg = await r.json();
        setMessages((prev) => [...prev, msg]);
        setCompose("");
      }
    } finally {
      setSending(false);
    }
  }

  return {
    ros,
    selectedRoId,
    setSelectedRoId,
    mode,
    setMode,
    filteredMessages,
    compose,
    setCompose,
    sending,
    handleSend,
    messagesEndRef,
    userId,
  };
}

// ─── Chat body (shared between desktop panel and mobile sheet) ────────────────

function ChatBody({
  ros,
  selectedRoId,
  setSelectedRoId,
  mode,
  setMode,
  filteredMessages,
  compose,
  setCompose,
  sending,
  handleSend,
  messagesEndRef,
  userId,
}: ReturnType<typeof useChatState>) {
  return (
    <>
      {/* RO selector + mode toggle */}
      <div className="px-3 py-2 border-b border-border space-y-2 flex-shrink-0">
        <Select value={selectedRoId} onValueChange={(v) => setSelectedRoId(v ?? "")}>
          <SelectTrigger className="h-8 text-xs">
            <SelectValue placeholder="Select Repair Order…" />
          </SelectTrigger>
          <SelectContent>
            {ros.length === 0 && (
              <SelectItem value="__none__" disabled className="text-xs text-muted-foreground">
                No active ROs
              </SelectItem>
            )}
            {ros.map((ro) => (
              <SelectItem key={ro.id} value={ro.id} className="text-xs">
                {getVehicleLabel(ro)} · ···{ro.vin.slice(-6)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Internal / Customer / All tabs */}
        <div className="flex gap-1">
          {(["internal", "client", "both"] as Mode[]).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={cn(
                "flex-1 text-[10px] font-medium py-1 rounded transition-colors",
                mode === m
                  ? "bg-primary text-white"
                  : "bg-surface text-muted-foreground hover:bg-surface-hover hover:text-foreground"
              )}
            >
              {m === "internal" ? "Internal" : m === "client" ? "Customer" : "All"}
            </button>
          ))}
        </div>
      </div>

      {/* Message thread */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3 min-h-0 dark:bg-black/20">
        {!selectedRoId ? (
          <p className="text-xs text-muted-foreground text-center mt-10">
            Select an RO to view messages
          </p>
        ) : filteredMessages.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center mt-10">
            No messages yet
          </p>
        ) : (
          filteredMessages.map((msg) => {
            const isMe = msg.author.id === userId;
            return (
              <div
                key={msg.id}
                className={cn("flex flex-col gap-0.5", isMe ? "items-end" : "items-start")}
              >
                {!isMe && (
                  <span className="text-[10px] text-muted-foreground pl-1">
                    {msg.author.name ?? "Unknown"} · {msg.author.role}
                  </span>
                )}
                <div
                  className={cn(
                    "max-w-[90%] px-3 py-1.5 rounded-2xl text-xs leading-relaxed break-words",
                    isMe
                      ? "bg-primary text-white rounded-tr-sm"
                      : "bg-muted text-foreground rounded-tl-sm",
                    msg.category === "external" && !isMe && "border border-amber-300 dark:border-amber-600"
                  )}
                >
                  {msg.content}
                </div>
                <div className={cn("flex items-center gap-1 px-1", isMe ? "flex-row-reverse" : "flex-row")}>
                  {msg.category === "external" && (
                    <span className="text-[9px] text-amber-600 dark:text-amber-400">Customer</span>
                  )}
                  <span className="text-[9px] text-muted-foreground">
                    {new Date(msg.createdAt).toLocaleTimeString("en-US", {
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Compose area */}
      {selectedRoId && (
        <div className="px-3 py-2.5 border-t border-border flex-shrink-0 space-y-1.5">
          {mode === "both" && (
            <p className="text-[10px] text-amber-600 dark:text-amber-400">
              Posting as internal message
            </p>
          )}
          <div className="flex gap-2 items-end">
            <Textarea
              value={compose}
              onChange={(e) => setCompose(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder={mode === "client" ? "Message to customer…" : "Internal message…"}
              className="text-xs min-h-[52px] max-h-24 resize-none"
            />
            <Button
              size="sm"
              disabled={!compose.trim() || sending}
              onClick={handleSend}
              className="self-end flex-shrink-0"
            >
              <Send className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )}
    </>
  );
}

// ─── Main export ───────────────────────────────────────────────────────────────

export function GlobalChatPanel() {
  const chatState = useChatState();
  const [desktopOpen, setDesktopOpen] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);

  // Persist desktop panel state across navigations
  useEffect(() => {
    const stored = localStorage.getItem("chat-panel-open");
    if (stored === "false") setDesktopOpen(false);
  }, []);

  useEffect(() => {
    localStorage.setItem("chat-panel-open", String(desktopOpen));
  }, [desktopOpen]);

  return (
    <>
      {/* ── Desktop right panel ───────────────────────────────────────────── */}
      {desktopOpen ? (
        <div className="hidden md:flex flex-col w-80 shrink-0 glass border-l border-border dark:bg-black/40">
          {/* Panel header */}
          <div className="flex items-center justify-between px-3 py-2.5 border-b border-border flex-shrink-0">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-primary" />
              <span className="text-sm font-semibold text-foreground">
                Messages
              </span>
            </div>
            <button
              onClick={() => setDesktopOpen(false)}
              className="p-1 text-muted-foreground hover:text-foreground rounded transition-colors"
              title="Collapse chat"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
          <ChatBody {...chatState} />
        </div>
      ) : (
        /* Collapsed — show a slim toggle tab on the right edge */
        <button
          onClick={() => setDesktopOpen(true)}
          className="hidden md:flex fixed right-0 top-1/2 -translate-y-1/2 z-40 flex-col items-center justify-center w-8 h-20 glass border-r-0 rounded-l-lg shadow-md hover:bg-surface-hover transition-colors gap-1"
          title="Open messages"
        >
          <MessageSquare className="h-4 w-4 text-blue-600" />
        </button>
      )}

      {/* ── Mobile floating button ────────────────────────────────────────── */}
      <button
        onClick={() => setMobileOpen(true)}
        className="md:hidden fixed bottom-[calc(3.5rem+env(safe-area-inset-bottom)+0.75rem)] right-4 z-40 w-12 h-12 bg-primary text-white rounded-full shadow-lg shadow-primary/30 flex items-center justify-center"
        title="Open messages"
      >
        <MessageSquare className="h-5 w-5" />
      </button>

      {/* ── Mobile sheet ──────────────────────────────────────────────────── */}
      <Sheet
        open={mobileOpen}
        onOpenChange={(v) => {
          if (!v) setMobileOpen(false);
        }}
      >
        <SheetContent side="right" className="w-full sm:w-96 p-0 flex flex-col glass dark:bg-black/60 dark:border-border">
          <SheetHeader className="px-3 py-2.5 border-b border-border flex-shrink-0">
            <SheetTitle className="flex items-center gap-2 text-sm font-semibold">
              <MessageSquare className="h-4 w-4 text-primary" />
              Messages
            </SheetTitle>
          </SheetHeader>
          <div className="flex-1 flex flex-col overflow-hidden">
            <ChatBody {...chatState} />
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
