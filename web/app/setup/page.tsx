"use client";

import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Shield, Lock, User, ArrowRight, RefreshCw, CheckCircle2 } from "lucide-react";

export default function SetupPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let mounted = true;
    api
      .get("/api/auth/status")
      .then(({ firstRun }) => {
        if (mounted && !firstRun) {
          window.location.replace("/login");
        }
      })
      .catch(() => {})
      .finally(() => {
        if (mounted) setChecking(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters long");
      return;
    }
    setLoading(true);
    try {
      await api.post("/api/auth/setup", { username, password });
      window.location.href = "/dashboard";
    } catch (err: any) {
      setError(err.message || "Setup failed");
    } finally {
      setLoading(false);
    }
  };

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background bg-tech-grid">
        <div className="flex flex-col items-center gap-3">
          <div className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 border border-primary/20 text-primary">
            <RefreshCw className="h-5 w-5 animate-spin" />
          </div>
          <span className="text-xs font-mono text-muted-foreground animate-pulse">
            Verifying cluster initialization state...
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-background bg-tech-grid px-4 py-12 overflow-hidden">
      {/* Ambient background light spheres */}
      <div className="pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 h-[500px] w-[500px] rounded-full bg-primary/10 blur-[120px]" />
      <div className="pointer-events-none absolute -bottom-40 right-1/4 h-[400px] w-[400px] rounded-full bg-emerald-500/5 blur-[100px]" />

      <div className="relative w-full max-w-md">
        <Card className="border border-border/80 bg-card/85 backdrop-blur-xl shadow-2xl">
          <CardHeader className="text-center pb-4 pt-8">
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
                Cluster Setup
              </CardTitle>
              <span className="rounded bg-primary/15 border border-primary/30 px-1.5 py-0.5 text-[9px] font-mono font-semibold tracking-wider text-primary">
                INITIALIZE
              </span>
            </div>
            <CardDescription className="text-xs font-mono text-muted-foreground mt-1">
              Create the master administrator credentials for this node
            </CardDescription>
          </CardHeader>

          <CardContent className="px-6 pb-8">
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
                  <span>Administrator Username</span>
                </label>
                <Input
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="e.g. admin"
                  required
                  autoFocus
                  className="h-10 text-xs bg-background/60 border-border/80 focus-visible:ring-primary font-mono"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-mono font-medium text-foreground/80 flex items-center gap-1.5">
                  <Lock className="h-3 w-3 text-muted-foreground" />
                  <span>Root Password</span>
                </label>
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Minimum 6 characters"
                  required
                  className="h-10 text-xs bg-background/60 border-border/80 focus-visible:ring-primary font-mono"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-mono font-medium text-foreground/80 flex items-center gap-1.5">
                  <CheckCircle2 className="h-3 w-3 text-muted-foreground" />
                  <span>Confirm Password</span>
                </label>
                <Input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-type password"
                  required
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
                    <span>Bootstrapping Database...</span>
                  </>
                ) : (
                  <>
                    <span>Initialize Control Plane</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Ambient bottom status */}
        <div className="mt-4 flex items-center justify-center gap-2 text-[11px] font-mono text-muted-foreground/60">
          <span className="flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
          <span>Biryani Orchestrator</span>
          <span>·</span>
          <span>Docker Engine Local</span>
        </div>
      </div>
    </div>
  );
}
