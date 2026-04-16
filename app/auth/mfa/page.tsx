"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
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

export default function MFAVerifyPage() {
  const { update } = useSession();
  const router = useRouter();

  const [mode, setMode] = useState<"totp" | "backup">("totp");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const endpoint = mode === "totp" ? "/api/mfa/verify" : "/api/mfa/backup";
    const body = mode === "totp" ? { token: code } : { code };

    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(data.error ?? "Verification failed");
      return;
    }

    // Update the JWT to mark MFA as verified
    await update({ mfaVerified: true });
    router.push("/dashboard");
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4 relative">
      <div className="absolute top-[-10%] left-[-10%] w-[60%] h-[60%] bg-primary/10 blur-[120px] rounded-full pointer-events-none -z-10" />
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="text-3xl font-bold text-primary mb-1">Parts Partner</div>
          <CardTitle className="text-xl">Two-Factor Verification</CardTitle>
          <CardDescription>
            {mode === "totp"
              ? "Enter the 6-digit code from your authenticator app."
              : "Enter one of your backup codes."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="code">
                {mode === "totp" ? "Authenticator Code" : "Backup Code"}
              </Label>
              <Input
                id="code"
                type="text"
                inputMode={mode === "totp" ? "numeric" : "text"}
                maxLength={mode === "totp" ? 6 : 10}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\s/g, ""))}
                placeholder={mode === "totp" ? "000000" : "XXXXXXXXXX"}
                required
                autoComplete="one-time-code"
                className="text-center tracking-widest text-lg"
              />
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Verifying..." : "Verify"}
            </Button>
          </form>

          <button
            type="button"
            onClick={() => {
              setMode(mode === "totp" ? "backup" : "totp");
              setCode("");
              setError("");
            }}
            className="mt-4 w-full text-sm text-blue-600 hover:underline text-center"
          >
            {mode === "totp"
              ? "Use a backup code instead"
              : "Use authenticator app instead"}
          </button>
        </CardContent>
      </Card>
    </div>
  );
}
