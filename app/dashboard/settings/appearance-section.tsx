// Appearance settings — theme selection (light / dark / system)
"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { Sun, Moon, Monitor } from "lucide-react";

const THEMES = [
  { value: "light", label: "Light", Icon: Sun },
  { value: "dark",  label: "Dark",  Icon: Moon },
  { value: "system",label: "System",Icon: Monitor },
] as const;

export function AppearanceSection() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!mounted) return null;

  return (
    <div className="rounded-xl border border-border bg-surface px-4 py-3 flex items-center justify-between gap-4">
      <p className="text-sm font-medium text-foreground">Theme</p>
      <div className="flex gap-2">
        {THEMES.map(({ value, label, Icon }) => (
          <button
            key={value}
            onClick={() => setTheme(value)}
            className={`flex items-center gap-1.5 py-1.5 px-3 rounded-lg border transition-colors text-xs font-medium ${
              theme === value
                ? "border-primary bg-primary/10 text-primary"
                : "border-border bg-background text-muted-foreground hover:bg-surface-hover hover:text-foreground"
            }`}
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
