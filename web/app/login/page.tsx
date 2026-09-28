"use client";

import { useState, useRef, useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Shield, KeyRound, ArrowRight, Lock, User, RefreshCw } from "lucide-react";

export default function LoginPage() {
  const { user, loading: authLoading, login, verifyTotp } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [tempToken, setTempToken] = useState("");
  const [totpCode, setTotpCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const isSubmitting = useRef(false);

  // If already authenticated, redirect to dashboard
  useEffect(() => {
    if (!authLoading && user) {
      window.location.href = "/dashboard";
    }
  }, [user, authLoading]);

  // If first-time setup hasn't been completed, redirect to setup
  useEffect(() => {
    fetch("/api/auth/status")
      .then((res) => res.json())
      .then(({ firstRun }) => {
        if (firstRun) window.location.replace("/setup");
      })
      .catch(() => {});
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting.current) return;
    isSubmitting.current = true;
    setError("");
    setLoading(true);
    try {
      const result = await login(username, password);
      if (result?.requiresTotp) {
        setTempToken(result.tempToken!);
      } else {
        window.location.href = "/dashboard";
      }
    } catch (err: any) {
      setError(err.message || "Login failed");
    } finally {
      setLoading(false);
      isSubmitting.current = false;
    }
  };

  const handleTotpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting.current) return;
    isSubmitting.current = true;
    setError("");
    setLoading(true);
    try {
      await verifyTotp(tempToken, totpCode);
      window.location.href = "/dashboard";
    } catch (err: any) {
      setError(err.message || "Invalid two-factor authentication code");
    } finally {
      setLoading(false);
      isSubmitting.current = false;
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-background bg-tech-grid px-4 py-12 overflow-hidden">
      {/* Ambient background light spheres */}
      <div className="pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 h-[500px] w-[500px] rounded-full bg-primary/10 blur-[120px]" />
      <div className="pointer-events-none absolute -bottom-40 right-1/4 h-[400px] w-[400px] rounded-full bg-emerald-500/5 blur-[100px]" />

      <div className="relative w-full max-w-md">
        <Card className="border border-border/80 bg-card/85 backdrop-blur-xl shadow-2xl">
          <CardHeader className="text-center pb-4 pt-8">
            {/* High-tech voxel insignia */}
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 border border-primary/25 text-primary shadow-[0_0_20px_rgba(22,224,136,0.25)]">
              <svg
                className="h-7 w-7"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="m21 16-9 5-9-5V8l9-5 9 5v8z" />
                <path d="m3.27 6.96 8.73 4.88 8.73-4.88" />
                <path d="M12 22V12" />
              </svg>
            </div>
            <div className="flex items-center justify-center gap-1.5">
              <CardTitle className="text-2xl font-bold tracking-tight text-foreground">
                SERVERNEST
              </CardTitle>
              <span className="rounded bg-primary/15 border border-primary/30 px-1.5 py-0.5 text-[9px] font-mono font-semibold tracking-wider text-primary">
                ORCHESTRATOR
              </span>
            </div>
            <CardDescription className="text-xs font-mono text-muted-foreground mt-1">
              Minecraft Server Management Console
            </CardDescription>
          </CardHeader>

          <CardContent className="px-6 pb-8">
            {!tempToken ? (
              <form onSubmit={handleSubmit} className="space-y-4">
                {error && (
                  <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-2.5 text-xs text-destructive flex items-center gap-2">
                    <Shield className="h-4 w-4 shrink-0" />
                    <span>{error}</span>
                  </div>
                )}

                <div className="space-y-1.5">
                  <label className="text-xs font-mono font-medium text-foreground/80 flex items-center gap-1.5">
                    <User className="h-3 w-3 text-muted-foreground" />
                    <span>Username</span>
                  </label>
                  <Input
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Administrator username"
                    required
                    autoComplete="username"
                    className="h-10 text-xs bg-background/60 border-border/80 focus-visible:ring-primary font-mono"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-mono font-medium text-foreground/80 flex items-center gap-1.5">
                    <Lock className="h-3 w-3 text-muted-foreground" />
                    <span>Password</span>
                  </label>
                  <Input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••••"
                    required
                    autoComplete="current-password"
                    className="h-10 text-xs bg-background/60 border-border/80 focus-visible:ring-primary font-mono"
                  />
                </div>

                <Button
                  type="submit"
                  className="w-full h-10 gap-2 text-xs font-semibold shadow-[0_0_16px_rgba(22,224,136,0.3)] transition-all"
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                      <span>Authenticating...</span>
                    </>
                  ) : (
                    <>
                      <span>Enter Control Plane</span>
                      <ArrowRight className="h-3.5 w-3.5" />
                    </>
                  )}
                </Button>

                <div className="pt-3 text-center border-t border-border/60">
                  <button
                    type="button"
                    onClick={async () => {
                      if (
                        confirm(
                          "Reset administrator account credentials and re-run initial setup?"
                        )
                      ) {
                        try {
                          await fetch("/api/auth/reset", { method: "POST" });
                          localStorage.removeItem("servernest_token");
                          window.location.href = "/setup";
                        } catch {
                          setError("Failed to reset admin account");
                        }
                      }
                    }}
                    className="text-[11px] font-mono text-muted-foreground/80 hover:text-primary transition-colors underline-offset-4 hover:underline"
                  >
                    Forgot password or redo admin setup?
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleTotpSubmit} className="space-y-4">
                <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 text-center">
                  <KeyRound className="mx-auto h-6 w-6 text-primary mb-1" />
                  <p className="text-xs font-medium text-foreground">Two-Factor Authentication</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Enter the 6-digit code from your authenticator app
                  </p>
                </div>

                {error && (
                  <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-2.5 text-xs text-destructive">
                    {error}
                  </div>
                )}

                <div className="space-y-1.5">
                  <Input
                    value={totpCode}
                    onChange={(e) => setTotpCode(e.target.value)}
                    placeholder="000 000"
                    maxLength={6}
                    autoFocus
                    required
                    className="h-11 text-center font-mono text-lg tracking-widest bg-background/60 border-border/80"
                  />
                </div>

                <Button
                  type="submit"
                  className="w-full h-10 text-xs font-semibold shadow-[0_0_16px_rgba(22,224,136,0.3)]"
                  disabled={loading}
                >
                  {loading ? "Verifying Token..." : "Verify & Sign In"}
                </Button>

                <Button
                  type="button"
                  variant="ghost"
                  className="w-full text-xs text-muted-foreground hover:text-foreground"
                  onClick={() => {
                    setTempToken("");
                    setTotpCode("");
                    setError("");
                  }}
                >
                  ← Back to Login
                </Button>
              </form>
            )}
          </CardContent>
        </Card>

        {/* Ambient bottom status */}
        <div className="mt-4 flex items-center justify-center gap-2 text-[11px] font-mono text-muted-foreground/60">
          <span className="flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
          <span>Self-Hosted & Open Source</span>
          <span>·</span>
          <span>Fastify :3001</span>
        </div>
      </div>
    </div>
  );
}
