"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { UserPlus, Trash2, Pencil } from "lucide-react";
import { EMPLOYEE_ID_REGEX } from "@/lib/validators/employee-id";

type User = {
  id: string;
  name: string | null;
  email: string | null;
  role: string;
  employeeId: string | null;
  createdAt: string;
};

const ROLE_OPTIONS = ["advisor", "technician", "manager", "admin"] as const;
type Role = (typeof ROLE_OPTIONS)[number];

const ROLE_COLORS: Record<string, string> = {
  admin: "bg-purple-100 text-purple-700",
  manager: "bg-blue-100 text-blue-700",
  advisor: "bg-green-100 text-green-700",
  technician: "bg-amber-100 text-amber-700",
  developer: "bg-surface text-foreground",
};

function timeAgo(date: string) {
  const diff = Date.now() - new Date(date).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 30) return `${days}d ago`;
  return new Date(date).toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

export function UsersClient({ users: initial, currentUserId }: { users: User[]; currentUserId: string }) {
  const [users, setUsers] = useState(initial);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [tempPasswordOpen, setTempPasswordOpen] = useState(false);
  const [tempPassword, setTempPassword] = useState("");
  const [invitedEmail, setInvitedEmail] = useState("");
  const [form, setForm] = useState({ name: "", email: "", role: "advisor" as Role, employeeId: "" });
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState("");
  const [removingId, setRemovingId] = useState<string | null>(null);

  // Employee ID assignment dialog state
  const [eidDialog, setEidDialog] = useState<{ open: boolean; userId: string; current: string | null }>({
    open: false,
    userId: "",
    current: null,
  });
  const [eidValue, setEidValue] = useState("");
  const [eidSaving, setEidSaving] = useState(false);
  const [eidError, setEidError] = useState("");

  async function handleRoleChange(userId: string, role: string) {
    const res = await fetch(`/api/admin/users/${userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role }),
    });
    if (res.ok) {
      setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, role } : u)));
    }
  }

  async function handleRemove(userId: string) {
    const res = await fetch(`/api/admin/users/${userId}`, { method: "DELETE" });
    if (res.ok) {
      setUsers((prev) => prev.filter((u) => u.id !== userId));
      setRemovingId(null);
    }
  }

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    setInviting(true);
    setInviteError("");

    const body: Record<string, string> = {
      name: form.name,
      email: form.email,
      role: form.role,
    };
    if (form.employeeId.trim()) body.employeeId = form.employeeId.trim().toUpperCase();

    const res = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    setInviting(false);

    if (!res.ok) {
      const data = await res.json();
      setInviteError(data.error ?? "Failed to invite user");
      return;
    }

    const data = await res.json();
    setUsers((prev) => [...prev, { ...data.user, createdAt: new Date().toISOString() }]);
    setTempPassword(data.tempPassword);
    setInvitedEmail(form.email);
    setForm({ name: "", email: "", role: "advisor", employeeId: "" });
    setInviteOpen(false);
    setTempPasswordOpen(true);
  }

  function openEidDialog(user: User) {
    setEidDialog({ open: true, userId: user.id, current: user.employeeId });
    setEidValue(user.employeeId ?? "");
    setEidError("");
  }

  async function handleSaveEid(e: React.FormEvent) {
    e.preventDefault();
    setEidSaving(true);
    setEidError("");

    const val = eidValue.trim().toUpperCase();
    if (val && !EMPLOYEE_ID_REGEX.test(val)) {
      setEidError("Format: XXX-0000 (e.g. TYT-0042)");
      setEidSaving(false);
      return;
    }

    const res = await fetch(`/api/admin/users/${eidDialog.userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ employeeId: val || null }),
    });

    setEidSaving(false);

    if (!res.ok) {
      const data = await res.json();
      setEidError(data.error ?? "Failed to save Employee ID");
      return;
    }

    setUsers((prev) =>
      prev.map((u) =>
        u.id === eidDialog.userId ? { ...u, employeeId: val || null } : u
      )
    );
    setEidDialog({ open: false, userId: "", current: null });
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <p className="text-sm text-muted-foreground">{users.length} user{users.length !== 1 ? "s" : ""} on this rooftop</p>
        <Button onClick={() => setInviteOpen(true)} size="sm">
          <UserPlus className="h-4 w-4 mr-2" />
          Invite User
        </Button>
      </div>

      <div className="border border-border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-surface border-b border-border">
            <tr>
              <th className="text-left px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wide">Name</th>
              <th className="text-left px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wide hidden md:table-cell">Employee ID</th>
              <th className="text-left px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wide hidden sm:table-cell">Email</th>
              <th className="text-left px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wide">Role</th>
              <th className="text-left px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wide hidden sm:table-cell">Added</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border/50">
            {users.map((user) => {
              const isSelf = user.id === currentUserId;
              return (
                <tr key={user.id} className="hover:bg-surface-hover">
                  <td className="px-4 py-3 font-medium text-foreground">
                    {user.name ?? "—"}
                    {isSelf && <span className="ml-2 text-xs text-muted-foreground">(you)</span>}
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <div className="flex items-center gap-2">
                      {user.employeeId ? (
                        <span className="font-mono text-xs bg-surface text-foreground px-2 py-0.5 rounded">
                          {user.employeeId}
                        </span>
                      ) : (
                        <span className="text-muted-foreground/50 text-xs">—</span>
                      )}
                      <button
                        onClick={() => openEidDialog(user)}
                        className="text-muted-foreground hover:text-primary transition-colors"
                        title="Assign Employee ID"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground hidden sm:table-cell">{user.email ?? "—"}</td>
                  <td className="px-4 py-3">
                    {isSelf ? (
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${ROLE_COLORS[user.role] ?? "bg-surface text-foreground"}`}>
                        {user.role}
                      </span>
                    ) : (
                      <Select value={user.role} onValueChange={(v) => v && handleRoleChange(user.id, v)}>
                        <SelectTrigger size="sm" className="w-32">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {ROLE_OPTIONS.map((r) => (
                            <SelectItem key={r} value={r}>{r}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground text-xs hidden sm:table-cell">{timeAgo(user.createdAt)}</td>
                  <td className="px-4 py-3 text-right">
                    {!isSelf && (
                      removingId === user.id ? (
                        <div className="flex items-center gap-2 justify-end">
                          <span className="text-xs text-muted-foreground">Remove?</span>
                          <Button size="sm" variant="destructive" onClick={() => handleRemove(user.id)}>Yes</Button>
                          <Button size="sm" variant="outline" onClick={() => setRemovingId(null)}>No</Button>
                        </div>
                      ) : (
                        <Button size="sm" variant="ghost" onClick={() => setRemovingId(user.id)}>
                          <Trash2 className="h-4 w-4 text-muted-foreground" />
                        </Button>
                      )
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Assign Employee ID Dialog */}
      <Dialog open={eidDialog.open} onOpenChange={(v) => { if (!v) setEidDialog({ open: false, userId: "", current: null }); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Assign Employee ID</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSaveEid} className="space-y-4 mt-2">
            <div className="space-y-1">
              <Label>Employee ID</Label>
              <Input
                value={eidValue}
                onChange={(e) => { setEidValue(e.target.value.toUpperCase()); setEidError(""); }}
                placeholder="TYT-0042"
                className="font-mono"
                autoFocus
              />
              <p className="text-xs text-muted-foreground">Format: 2–6 uppercase letters, dash, 4 digits. Leave blank to clear.</p>
            </div>
            {eidError && <p className="text-sm text-red-600">{eidError}</p>}
            <DialogFooter className="gap-2">
              <Button type="button" variant="outline" onClick={() => setEidDialog({ open: false, userId: "", current: null })}>
                Cancel
              </Button>
              <Button type="submit" disabled={eidSaving}>
                {eidSaving ? "Saving…" : "Save"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Invite Dialog */}
      <Dialog open={inviteOpen} onOpenChange={(v) => { if (!v) { setInviteOpen(false); setInviteError(""); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Invite a user</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleInvite} className="space-y-4 mt-2">
            <div className="space-y-1">
              <Label>Full name</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                placeholder="Jane Smith"
                required
              />
            </div>
            <div className="space-y-1">
              <Label>Email address</Label>
              <Input
                type="email"
                value={form.email}
                onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
                placeholder="jane@dealership.com"
                required
              />
            </div>
            <div className="space-y-1">
              <Label>Role</Label>
              <Select value={form.role} onValueChange={(v) => setForm((p) => ({ ...p, role: v as Role }))}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROLE_OPTIONS.map((r) => (
                    <SelectItem key={r} value={r}>{r}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Employee ID <span className="text-muted-foreground font-normal">(optional)</span></Label>
              <Input
                value={form.employeeId}
                onChange={(e) => setForm((p) => ({ ...p, employeeId: e.target.value.toUpperCase() }))}
                placeholder="TYT-0042"
                className="font-mono"
              />
              <p className="text-xs text-muted-foreground">Format: XXX-0000. Can be assigned later.</p>
            </div>
            {inviteError && <p className="text-sm text-red-600">{inviteError}</p>}
            <DialogFooter>
              <Button type="submit" disabled={inviting} className="w-full">
                {inviting ? "Creating..." : "Create account"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Temp Password Dialog */}
      <Dialog open={tempPasswordOpen} onOpenChange={(v) => { if (!v) setTempPasswordOpen(false); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>User created</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 mt-2">
            <p className="text-sm text-muted-foreground">
              Account created for <strong>{invitedEmail}</strong>. Share these credentials — they should change the password on first login.
            </p>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Temporary password</Label>
              <div
                className="font-mono text-sm bg-surface border border-border rounded-lg px-3 py-2 select-all cursor-text"
                onClick={(e) => {
                  const range = document.createRange();
                  range.selectNodeContents(e.currentTarget);
                  window.getSelection()?.removeAllRanges();
                  window.getSelection()?.addRange(range);
                }}
              >
                {tempPassword}
              </div>
              <p className="text-xs text-muted-foreground">Click to select all, then copy.</p>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => setTempPasswordOpen(false)} className="w-full">Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
