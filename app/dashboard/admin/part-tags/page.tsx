"use client";

import { useEffect, useState } from "react";
import { Tag, Trash2, Plus, Pencil, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";

interface PartTag {
  id: string;
  name: string;
  color: string;
}

const PRESET_COLORS = [
  "#6b7280", "#ef4444", "#f97316", "#eab308",
  "#22c55e", "#14b8a6", "#3b82f6", "#8b5cf6",
  "#ec4899", "#0ea5e9",
];

export default function PartTagsPage() {
  const [tags, setTags] = useState<PartTag[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState("#3b82f6");
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editColor, setEditColor] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const res = await fetch("/api/part-tags");
    if (res.ok) {
      const data = await res.json();
      setTags(data.tags ?? []);
    }
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function create() {
    if (!newName.trim()) return;
    setCreating(true);
    setError(null);
    const res = await fetch("/api/part-tags", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName.trim(), color: newColor }),
    });
    if (res.ok) {
      setNewName("");
      setNewColor("#3b82f6");
      await load();
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Failed to create tag");
    }
    setCreating(false);
  }

  async function saveEdit(id: string) {
    const res = await fetch(`/api/part-tags/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: editName.trim(), color: editColor }),
    });
    if (res.ok) {
      setEditingId(null);
      await load();
    }
  }

  async function deleteTag(id: string) {
    if (!confirm("Delete this tag? It will be removed from all line items.")) return;
    await fetch(`/api/part-tags/${id}`, { method: "DELETE" });
    await load();
  }

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Tag className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold text-foreground">Part Tags</h1>
          <p className="text-sm text-muted-foreground">Create tags to label parts on repair orders (e.g. supplier, status).</p>
        </div>
      </div>

      {/* Create new tag */}
      <Card>
        <CardContent className="pt-5 pb-5 space-y-3">
          <p className="text-sm font-medium text-foreground">New Tag</p>
          <div className="flex items-center gap-2">
            <Input
              placeholder="Tag name (e.g. NAPA, Backordered)"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") create(); }}
              className="flex-1"
              maxLength={50}
            />
            <div className="relative">
              <input
                type="color"
                value={newColor}
                onChange={(e) => setNewColor(e.target.value)}
                className="sr-only"
                id="new-color-picker"
              />
              <label
                htmlFor="new-color-picker"
                className="flex items-center justify-center w-9 h-9 rounded-md border border-border cursor-pointer hover:border-primary transition-colors"
                style={{ backgroundColor: newColor }}
                title="Pick color"
              />
            </div>
            <Button onClick={create} disabled={creating || !newName.trim()} size="sm">
              <Plus className="h-4 w-4 mr-1" />
              Add
            </Button>
          </div>
          {/* Quick color presets */}
          <div className="flex gap-1.5 flex-wrap">
            {PRESET_COLORS.map((c) => (
              <button
                key={c}
                onClick={() => setNewColor(c)}
                className="w-5 h-5 rounded-full border-2 transition-all"
                style={{
                  backgroundColor: c,
                  borderColor: newColor === c ? "white" : "transparent",
                  outline: newColor === c ? `2px solid ${c}` : "none",
                }}
                title={c}
              />
            ))}
          </div>
          {error && <p className="text-xs text-destructive">{error}</p>}
        </CardContent>
      </Card>

      {/* Tag list */}
      {loading ? (
        <div className="text-sm text-muted-foreground animate-pulse">Loading…</div>
      ) : tags.length === 0 ? (
        <div className="text-center py-10 border border-border rounded-xl text-sm text-muted-foreground">
          No tags yet. Create your first tag above.
        </div>
      ) : (
        <div className="space-y-2">
          {tags.map((tag) => (
            <Card key={tag.id}>
              <CardContent className="py-3 px-4 flex items-center gap-3">
                {editingId === tag.id ? (
                  <>
                    <div
                      className="w-4 h-4 rounded-full shrink-0"
                      style={{ backgroundColor: editColor }}
                    />
                    <input
                      type="color"
                      value={editColor}
                      onChange={(e) => setEditColor(e.target.value)}
                      className="sr-only"
                      id={`edit-color-${tag.id}`}
                    />
                    <label
                      htmlFor={`edit-color-${tag.id}`}
                      className="w-5 h-5 rounded border border-border cursor-pointer shrink-0"
                      style={{ backgroundColor: editColor }}
                    />
                    <Input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") saveEdit(tag.id); if (e.key === "Escape") setEditingId(null); }}
                      className="flex-1 h-7 text-sm"
                      autoFocus
                    />
                    <button onClick={() => saveEdit(tag.id)} className="text-green-600 hover:text-green-700">
                      <Check className="h-4 w-4" />
                    </button>
                    <button onClick={() => setEditingId(null)} className="text-muted-foreground hover:text-foreground">
                      <X className="h-4 w-4" />
                    </button>
                  </>
                ) : (
                  <>
                    <span
                      className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium text-white"
                      style={{ backgroundColor: tag.color }}
                    >
                      {tag.name}
                    </span>
                    <span className="text-xs text-muted-foreground font-mono">{tag.color}</span>
                    <div className="ml-auto flex items-center gap-1">
                      <button
                        onClick={() => { setEditingId(tag.id); setEditName(tag.name); setEditColor(tag.color); }}
                        className="text-muted-foreground hover:text-foreground p-1"
                        title="Edit"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => deleteTag(tag.id)}
                        className="text-muted-foreground hover:text-destructive p-1"
                        title="Delete"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
