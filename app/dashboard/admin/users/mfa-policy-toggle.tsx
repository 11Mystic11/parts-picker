"use client";

import { useState } from "react";
import { ShieldCheck, ShieldOff } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface Props {
  rooftopId: string;
  mfaRequired: boolean;
}

export function MFAPolicyToggle({ rooftopId, mfaRequired: initial }: Props) {
  const [enabled, setEnabled] = useState(initial);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function toggle() {
    setLoading(true);
    setError("");
    const res = await fetch(`/api/rooftop/${rooftopId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mfaRequired: !enabled }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(data.error ?? "Failed to update MFA policy");
      return;
    }
    setEnabled(!enabled);
  }

  return (
    <div className="flex items-center gap-4 p-4 rounded-lg border border-border bg-surface max-w-md">
      <div className="flex-1">
        <div className="flex items-center gap-2 mb-1">
          {enabled ? (
            <ShieldCheck className="h-5 w-5 text-primary" />
          ) : (
            <ShieldOff className="h-5 w-5 text-muted-foreground" />
          )}
          <span className="font-medium text-foreground text-sm">
            Require MFA for all users
          </span>
          <Badge variant={enabled ? "default" : "secondary"} className="text-xs">
            {enabled ? "On" : "Off"}
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground">
          {enabled
            ? "Users must complete TOTP verification after every sign-in."
            : "MFA is optional — users may enable it themselves."}
        </p>
        {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
      </div>
      <Button
        variant={enabled ? "outline" : "default"}
        size="sm"
        onClick={toggle}
        disabled={loading}
        className="flex-shrink-0"
      >
        {loading ? "Saving…" : enabled ? "Disable" : "Enable"}
      </Button>
    </div>
  );
}
