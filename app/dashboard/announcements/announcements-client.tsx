"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Pencil, Trash2, Loader2, Megaphone } from "lucide-react";

type AnnouncementAuthor = { name: string | null; role: string };

type Announcement = {
  id: string;
  title: string;
  body: string;
  priority: string;
  expiresAt: string | null;
  createdAt: string;
  author: AnnouncementAuthor;
};

const PRIORITY_STYLES: Record<string, string> = {
  info:    "bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300",
  warning: "bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300",
  urgent:  "bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300",
};

const PRIORITY_LABELS: Record<string, string> = {
  info: "Info",
  warning: "Warning",
  urgent: "Urgent",
};

function isExpired(expiresAt: string | null) {
  if (!expiresAt) return false;
  return new Date(expiresAt) < new Date();
}

type FormState = {
  title: string;
  body: string;
  priority: "info" | "warning" | "urgent";
  expiresAt: string;
};

const EMPTY_FORM: FormState = { title: "", body: "", priority: "info", expiresAt: "" };

export function AnnouncementsClient({
  initialAnnouncements,
  canManage,
}: {
  initialAnnouncements: Announcement[];
  canManage: boolean;
}) {
  const [announcements, setAnnouncements] = useState<Announcement[]>(initialAnnouncements);
  const [showDialog, setShowDialog] = useState(false);
  const [editing, setEditing] = useState<Announcement | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  function openCreate() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setError("");
    setShowDialog(true);
  }

  function openEdit(a: Announcement) {
    setEditing(a);
    setForm({
      title: a.title,
      body: a.body,
      priority: a.priority as "info" | "warning" | "urgent",
      expiresAt: a.expiresAt ? a.expiresAt.slice(0, 16) : "",
    });
    setError("");
    setShowDialog(true);
  }

  async function handleSave() {
    setError("");
    if (!form.title.trim()) { setError("Title is required"); return; }
    if (!form.body.trim()) { setError("Body is required"); return; }

    setSaving(true);
    try {
      const payload = {
        title: form.title.trim(),
        body: form.body.trim(),
        priority: form.priority,
        expiresAt: form.expiresAt ? new Date(form.expiresAt).toISOString() : null,
      };

      let res: Response;
      if (editing) {
        res = await fetch(`/api/announcements/${editing.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } else {
        res = await fetch("/api/announcements", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }

      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Failed to save"); return; }

      if (editing) {
        setAnnouncements((prev) => prev.map((a) => (a.id === editing.id ? data : a)));
      } else {
        setAnnouncements((prev) => [data, ...prev]);
      }
      setShowDialog(false);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this announcement?")) return;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/announcements/${id}`, { method: "DELETE" });
      if (res.ok) {
        setAnnouncements((prev) => prev.filter((a) => a.id !== id));
      }
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">Announcements</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Shop-wide broadcasts visible to all staff on the dashboard.</p>
        </div>
        {canManage && (
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4 mr-2" />
            New Announcement
          </Button>
        )}
      </div>

      {/* List */}
      {announcements.length === 0 && (
        <div className="text-center py-16 text-muted-foreground border border-dashed border-border rounded-lg">
          <Megaphone className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">No announcements yet.</p>
          {canManage && (
            <p className="text-xs mt-1">Create one to broadcast a message to all staff.</p>
          )}
        </div>
      )}

      <div className="space-y-3">
        {announcements.map((a) => {
          const expired = isExpired(a.expiresAt);
          return (
            <div
              key={a.id}
              className={[
                "border rounded-lg p-4 transition-opacity",
                expired ? "opacity-40" : "",
                a.priority === "urgent" && !expired ? "border-l-4 border-l-red-500 border-border" :
                a.priority === "warning" && !expired ? "border-l-4 border-l-amber-400 border-border" :
                "border-border",
              ].join(" ")}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="font-semibold text-foreground">{a.title}</span>
                    <Badge className={`text-xs ${PRIORITY_STYLES[a.priority] ?? ""}`}>
                      {PRIORITY_LABELS[a.priority] ?? a.priority}
                    </Badge>
                    {expired && (
                      <Badge className="text-xs bg-surface text-muted-foreground">Expired</Badge>
                    )}
                  </div>
                  <p className="text-sm text-foreground/80 whitespace-pre-wrap">{a.body}</p>
                  <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                    <span>{a.author.name ?? "Unknown"}</span>
                    <span>·</span>
                    <span>{new Date(a.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
                    {a.expiresAt && (
                      <>
                        <span>·</span>
                        <span>Expires {new Date(a.expiresAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
                      </>
                    )}
                  </div>
                </div>
                {canManage && (
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      onClick={() => openEdit(a)}
                      className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-surface-hover rounded"
                      title="Edit"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(a.id)}
                      disabled={deletingId === a.id}
                      className="p-1.5 text-muted-foreground hover:text-red-500 hover:bg-red-500/10 rounded"
                      title="Delete"
                    >
                      {deletingId === a.id
                        ? <Loader2 className="h-4 w-4 animate-spin" />
                        : <Trash2 className="h-4 w-4" />
                      }
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Create / Edit Dialog */}
      <Dialog open={showDialog} onOpenChange={(v) => { if (!v) setShowDialog(false); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Announcement" : "New Announcement"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Title <span className="text-red-500">*</span></Label>
              <Input
                placeholder="e.g. Holiday hours this Friday"
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Message <span className="text-red-500">*</span></Label>
              <Textarea
                placeholder="Write your announcement here…"
                className="min-h-[100px] resize-none"
                value={form.body}
                onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Priority</Label>
                <Select
                  value={form.priority}
                  onValueChange={(v) => setForm((f) => ({ ...f, priority: v as FormState["priority"] }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="info">Info</SelectItem>
                    <SelectItem value="warning">Warning</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Expires (optional)</Label>
                <Input
                  type="datetime-local"
                  value={form.expiresAt}
                  onChange={(e) => setForm((f) => ({ ...f, expiresAt: e.target.value }))}
                />
              </div>
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {editing ? "Save Changes" : "Post Announcement"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
