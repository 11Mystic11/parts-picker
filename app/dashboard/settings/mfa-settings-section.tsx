"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Image from "next/image";

type Step =
  | "idle"
  | "setup-loading"
  | "setup-scan"
  | "setup-confirm"
  | "setup-backup-codes"
  | "disable-confirm"
  | "done";

interface SetupData {
  qrDataUrl: string;
  secret: string;
  backupCodes: string[];
}

export function MFASettingsSection({ mfaEnabled }: { mfaEnabled: boolean }) {
  const { update } = useSession();
  const [step, setStep] = useState<Step>("idle");
  const [setupData, setSetupData] = useState<SetupData | null>(null);
  const [confirmCode, setConfirmCode] = useState("");
  const [disablePassword, setDisablePassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [currentlyEnabled, setCurrentlyEnabled] = useState(mfaEnabled);

  async function startSetup() {
    setStep("setup-loading");
    setError("");
    const res = await fetch("/api/mfa/setup", { method: "POST" });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Failed to start MFA setup");
      setStep("idle");
      return;
    }
    setSetupData(data);
    setStep("setup-scan");
  }

  async function confirmSetup(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const res = await fetch("/api/mfa/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: confirmCode }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(data.error ?? "Invalid code");
      return;
    }
    await update({ mfaVerified: true });
    setStep("setup-backup-codes");
    setCurrentlyEnabled(true);
  }

  async function handleDisable(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const res = await fetch("/api/mfa/disable", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: disablePassword }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(data.error ?? "Failed to disable MFA");
      return;
    }
    setCurrentlyEnabled(false);
    setStep("idle");
    setDisablePassword("");
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base">Two-Factor Authentication</CardTitle>
            <CardDescription>
              Protect your account with an authenticator app.
            </CardDescription>
          </div>
          <Badge variant={currentlyEnabled ? "default" : "secondary"}>
            {currentlyEnabled ? "Enabled" : "Disabled"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Idle state */}
        {step === "idle" && !currentlyEnabled && (
          <Button onClick={startSetup} variant="outline">
            Enable MFA
          </Button>
        )}

        {/* Loading setup */}
        {step === "setup-loading" && (
          <p className="text-sm text-muted-foreground">Generating setup code…</p>
        )}

        {/* Show QR code */}
        {step === "setup-scan" && setupData && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Scan this QR code with Google Authenticator, Authy, or any TOTP
              app.
            </p>
            <div className="flex justify-center">
              <Image
                src={setupData.qrDataUrl}
                alt="MFA QR Code"
                width={200}
                height={200}
              />
            </div>
            <p className="text-xs text-muted-foreground text-center">
              Or enter manually:{" "}
              <span className="font-mono font-medium">{setupData.secret}</span>
            </p>
            <Button onClick={() => setStep("setup-confirm")} className="w-full">
              I've scanned it
            </Button>
          </div>
        )}

        {/* Confirm first code */}
        {step === "setup-confirm" && (
          <form onSubmit={confirmSetup} className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="confirm-code">Enter the 6-digit code to confirm</Label>
              <Input
                id="confirm-code"
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={confirmCode}
                onChange={(e) => setConfirmCode(e.target.value.replace(/\D/g, ""))}
                placeholder="000000"
                className="text-center tracking-widest text-lg"
                required
              />
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Verifying…" : "Confirm & Enable MFA"}
            </Button>
          </form>
        )}

        {/* Show backup codes */}
        {step === "setup-backup-codes" && setupData && (
          <div className="space-y-4">
            <div className="rounded-md bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-700 p-4">
              <p className="text-sm font-medium text-amber-800 dark:text-amber-300 mb-2">
                Save these backup codes — they won't be shown again.
              </p>
              <div className="grid grid-cols-2 gap-1">
                {setupData.backupCodes.map((code) => (
                  <span key={code} className="font-mono text-sm bg-surface border border-border rounded px-2 py-1 text-center text-foreground">
                    {code}
                  </span>
                ))}
              </div>
            </div>
            <Button onClick={() => setStep("idle")} className="w-full">
              Done — I've saved my backup codes
            </Button>
          </div>
        )}

        {/* Disable flow */}
        {step === "idle" && currentlyEnabled && (
          <Button
            variant="outline"
            onClick={() => setStep("disable-confirm")}
            className="text-red-600 border-red-200 hover:bg-red-50"
          >
            Disable MFA
          </Button>
        )}

        {step === "disable-confirm" && (
          <form onSubmit={handleDisable} className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="disable-password">Confirm your password to disable MFA</Label>
              <Input
                id="disable-password"
                type="password"
                value={disablePassword}
                onChange={(e) => setDisablePassword(e.target.value)}
                placeholder="Your current password"
                required
              />
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => { setStep("idle"); setError(""); }}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="destructive"
                className="flex-1"
                disabled={loading}
              >
                {loading ? "Disabling…" : "Disable MFA"}
              </Button>
            </div>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
