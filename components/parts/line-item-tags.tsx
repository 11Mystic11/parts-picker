"use client";

// Inline tag chip widget for RO line items.
// Self-loads the rooftop's tag library and the item's current tags.
// Shows tag chips with a + button to open a mini picker.

import { useState, useEffect, useRef } from "react";
import { Plus, X, Tag } from "lucide-react";

interface PartTag {
  id: string;
  name: string;
  color: string;
}

interface LineItemTagsProps {
  roId: string;
  itemId: string;
  initialTagIds?: string[]; // optional pre-loaded tag IDs
  allTags: PartTag[];       // pre-loaded rooftop tag library
  onTagsChange?: (tagIds: string[], newTag?: PartTag) => void;
}

export function LineItemTags({ roId, itemId, initialTagIds = [], allTags, onTagsChange }: LineItemTagsProps) {
  const [tagIds, setTagIds] = useState<string[]>(initialTagIds);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  // Locally created tags (not yet in parent's allTags list)
  const [localNewTags, setLocalNewTags] = useState<PartTag[]>([]);
  const panelRef = useRef<HTMLDivElement>(null);

  // Close picker on outside click
  useEffect(() => {
    if (!open) return;
    function handle(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch("");
      }
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [open]);

  // Merge server tags with any newly created local tags
  const mergedTags = [
    ...allTags,
    ...localNewTags.filter((lt) => !allTags.find((t) => t.id === lt.id)),
  ];
  const activeTags = mergedTags.filter((t) => tagIds.includes(t.id));
  const filteredAll = mergedTags.filter(
    (t) => t.name.toLowerCase().includes(search.toLowerCase())
  );

  async function saveTags(next: string[], newTag?: PartTag) {
    setSaving(true);
    setTagIds(next);
    onTagsChange?.(next, newTag);
    await fetch(`/api/ro/${roId}/line-items/${itemId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tags: next }),
    });
    setSaving(false);
  }

  function toggle(tagId: string) {
    const next = tagIds.includes(tagId)
      ? tagIds.filter((id) => id !== tagId)
      : [...tagIds, tagId];
    saveTags(next);
  }

  async function createAndAdd() {
    if (!search.trim()) return;
    setCreating(true);
    setCreateError(null);
    const res = await fetch("/api/part-tags", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: search.trim(), color: "#3b82f6" }),
    });
    if (res.ok) {
      const data = await res.json();
      const newTag: PartTag = data.tag;
      setLocalNewTags((prev) => [...prev, newTag]);
      const next = [...tagIds, newTag.id];
      saveTags(next, newTag);
      setSearch("");
    } else {
      const data = await res.json().catch(() => ({}));
      // Tag may already exist — try to find and add it
      const existing = mergedTags.find((t) => t.name.toLowerCase() === search.trim().toLowerCase());
      if (existing) {
        const next = [...tagIds, existing.id];
        saveTags(next);
        setSearch("");
      } else {
        setCreateError(data.error ?? "Failed to create tag");
      }
    }
    setCreating(false);
  }

  const noMatch = filteredAll.length === 0 && search.trim().length > 0;

  return (
    <div className="flex items-center gap-1 flex-wrap relative" ref={panelRef}>
      {activeTags.map((tag) => (
        <span
          key={tag.id}
          className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-medium text-white leading-none"
          style={{ backgroundColor: tag.color }}
        >
          {tag.name}
          <button
            onClick={() => toggle(tag.id)}
            className="ml-0.5 opacity-70 hover:opacity-100"
            title="Remove tag"
          >
            <X className="h-2.5 w-2.5" />
          </button>
        </span>
      ))}

      <button
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center justify-center w-5 h-5 rounded-full border border-border text-muted-foreground hover:text-foreground hover:border-primary transition-colors"
        title="Add tag"
      >
        <Plus className="h-3 w-3" />
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-1 z-50 w-52 bg-background border border-border rounded-lg shadow-lg p-2 space-y-1.5">
          <input
            autoFocus
            placeholder="Search or create…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setCreateError(null); }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && noMatch) createAndAdd();
              if (e.key === "Escape") { setOpen(false); setSearch(""); }
            }}
            className="w-full text-xs px-2 py-1.5 rounded border border-border bg-background focus:outline-none focus:ring-1 focus:ring-primary"
          />

          {createError && (
            <p className="text-[10px] text-red-500 px-2 leading-tight">{createError}</p>
          )}
          {filteredAll.length > 0 ? (
            <div className="max-h-40 overflow-y-auto space-y-0.5">
              {filteredAll.map((tag) => {
                const active = tagIds.includes(tag.id);
                return (
                  <button
                    key={tag.id}
                    onClick={() => toggle(tag.id)}
                    className={`w-full flex items-center gap-2 px-2 py-1 rounded text-xs hover:bg-surface transition-colors text-left ${active ? "bg-surface" : ""}`}
                  >
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: tag.color }}
                    />
                    <span className="flex-1 truncate text-foreground">{tag.name}</span>
                    {active && <span className="text-primary font-bold">✓</span>}
                  </button>
                );
              })}
            </div>
          ) : noMatch ? (
            <button
              onClick={createAndAdd}
              disabled={creating}
              className="w-full flex items-center gap-1.5 px-2 py-1 text-xs rounded hover:bg-surface text-primary"
            >
              <Tag className="h-3 w-3" />
              Create &quot;{search}&quot;
            </button>
          ) : (
            <p className="text-xs text-muted-foreground px-2 py-1">No tags yet. Type to create one.</p>
          )}
        </div>
      )}
    </div>
  );
}
