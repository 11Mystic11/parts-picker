"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";

type Step = "signin" | "forgot" | "verify";

export default function SignInPage() {
  const router = useRouter();

  // --- signin state ---
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [signInError, setSignInError] = useState("");
  const [signInLoading, setSignInLoading] = useState(false);

  // --- forgot / reset state ---
  const [step, setStep] = useState<Step>("signin");
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotError, setForgotError] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [resetLoading, setResetLoading] = useState(false);
  const [resetError, setResetError] = useState("");
  const [resetSuccess, setResetSuccess] = useState(false);

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    setSignInLoading(true);
    setSignInError("");

    const result = await signIn("credentials", { email, password, redirect: false });
    setSignInLoading(false);

    if (result?.error) {
      setSignInError("Invalid email or password.");
    } else {
      router.push("/dashboard");
    }
  }

  async function handleForgot(e: React.FormEvent) {
    e.preventDefault();
    setForgotLoading(true);
    setForgotError("");

    const res = await fetch("/api/auth/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: forgotEmail }),
    });

    setForgotLoading(false);

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setForgotError(data.error ?? "Something went wrong.");
      return;
    }

    // Always advance — avoids email enumeration (server always returns ok)
    setStep("verify");
  }

  async function handleReset(e: React.FormEvent) {
    e.preventDefault();
    setResetError("");

    if (newPassword !== confirmPassword) {
      setResetError("Passwords do not match.");
      return;
    }
    if (newPassword.length < 8) {
      setResetError("Password must be at least 8 characters.");
      return;
    }

    setResetLoading(true);
    const res = await fetch("/api/auth/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: forgotEmail, code, password: newPassword }),
    });
    setResetLoading(false);

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setResetError(data.error ?? "Something went wrong.");
      return;
    }

    setResetSuccess(true);
  }

  function backToSignIn() {
    setStep("signin");
    setForgotEmail("");
    setForgotError("");
    setCode("");
    setNewPassword("");
    setConfirmPassword("");
    setResetError("");
    setResetSuccess(false);
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4 relative">
      <div className="absolute top-[-10%] left-[-10%] w-[60%] h-[60%] bg-primary/10 blur-[120px] rounded-full pointer-events-none -z-10" />

      <Card className="w-full max-w-md">
        {/* ── Sign in ── */}
        {step === "signin" && (
          <>
            <CardHeader className="text-center">
              <div className="text-3xl font-bold text-primary mb-1">Parts Partner</div>
              <CardTitle className="text-xl">Sign in</CardTitle>
              <CardDescription>Automotive Service Intelligence</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSignIn} className="space-y-4">
                <div className="space-y-1">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="advisor@dealership.com"
                    required
                    autoComplete="email"
                  />
                </div>
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password">Password</Label>
                    <button
                      type="button"
                      onClick={() => {
                        setForgotEmail(email);
                        setStep("forgot");
                      }}
                      className="text-xs text-primary hover:underline"
                    >
                      Forgot password?
                    </button>
                  </div>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoComplete="current-password"
                  />
                </div>
                {signInError && <p className="text-sm text-red-600">{signInError}</p>}
                <Button type="submit" className="w-full" disabled={signInLoading}>
                  {signInLoading ? "Signing in..." : "Sign in"}
                </Button>
              </form>
              <p className="text-center text-sm text-muted-foreground mt-4">
                New dealership?{" "}
                <Link href="/auth/signup" className="text-primary hover:underline">
                  Create account
                </Link>
              </p>
            </CardContent>
          </>
        )}

        {/* ── Forgot password — enter email ── */}
        {step === "forgot" && (
          <>
            <CardHeader className="text-center">
              <div className="text-3xl font-bold text-primary mb-1">Parts Partner</div>
              <CardTitle className="text-xl">Reset password</CardTitle>
              <CardDescription>Enter your email and we'll send a 6-digit code.</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleForgot} className="space-y-4">
                <div className="space-y-1">
                  <Label htmlFor="forgot-email">Email</Label>
                  <Input
                    id="forgot-email"
                    type="email"
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                    placeholder="advisor@dealership.com"
                    required
                    autoComplete="email"
                  />
                </div>
                {forgotError && <p className="text-sm text-red-600">{forgotError}</p>}
                <Button type="submit" className="w-full" disabled={forgotLoading}>
                  {forgotLoading ? "Sending..." : "Send reset code"}
                </Button>
              </form>
              <button
                type="button"
                onClick={backToSignIn}
                className="block text-center text-sm text-muted-foreground hover:text-foreground mt-4 w-full"
              >
                ← Back to sign in
              </button>
            </CardContent>
          </>
        )}

        {/* ── Verify code & set new password ── */}
        {step === "verify" && (
          <>
            <CardHeader className="text-center">
              <div className="text-3xl font-bold text-primary mb-1">Parts Partner</div>
              <CardTitle className="text-xl">Enter your code</CardTitle>
              <CardDescription>
                {resetSuccess
                  ? "Password updated successfully."
                  : `Check ${forgotEmail} for a 6-digit code. It expires in 15 minutes.`}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {resetSuccess ? (
                <div className="space-y-4">
                  <p className="text-sm text-center text-muted-foreground">
                    You can now sign in with your new password.
                  </p>
                  <Button className="w-full" onClick={backToSignIn}>
                    Go to sign in
                  </Button>
                </div>
              ) : (
                <form onSubmit={handleReset} className="space-y-4">
                  <div className="space-y-1">
                    <Label htmlFor="code">6-digit code</Label>
                    <Input
                      id="code"
                      type="text"
                      inputMode="numeric"
                      maxLength={6}
                      value={code}
                      onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                      placeholder="123456"
                      required
                      autoComplete="one-time-code"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="new-password">New password</Label>
                    <Input
                      id="new-password"
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="At least 8 characters"
                      required
                      autoComplete="new-password"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="confirm-password">Confirm new password</Label>
                    <Input
                      id="confirm-password"
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                      autoComplete="new-password"
                    />
                  </div>
                  {resetError && <p className="text-sm text-red-600">{resetError}</p>}
                  <Button type="submit" className="w-full" disabled={resetLoading}>
                    {resetLoading ? "Resetting..." : "Reset password"}
                  </Button>
                  <button
                    type="button"
                    onClick={() => setStep("forgot")}
                    className="block text-center text-sm text-muted-foreground hover:text-foreground w-full"
                  >
                    ← Resend code
                  </button>
                </form>
              )}
            </CardContent>
          </>
        )}
      </Card>
    </div>
  );
}
