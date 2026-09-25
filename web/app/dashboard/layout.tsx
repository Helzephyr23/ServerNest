"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth";
import { ErrorBoundary } from "@/components/error-boundary";
import { ConfirmProvider } from "@/components/confirm-dialog";
import Sidebar from "@/components/sidebar";
import { Plus, ChevronRight, Radio } from "lucide-react";
import { Button } from "@/components/ui/button";

function TopBar() {
  const pathname = usePathname();

  const segments = pathname
    .split("/")
    .filter(Boolean)
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1));

  return (
    <header className="sticky top-0 z-30 flex h-14 w-full items-center justify-between border-b border-border/70 bg-card/60 px-4 backdrop-blur-md sm:px-6">
      {/* Zone 1: Contextual Breadcrumb Trail */}
      <div className="flex items-center gap-2 pl-10 md:pl-0">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-mono">
          <span className="text-foreground/90 font-medium">Cluster Alpha</span>
          {segments.slice(1).map((segment, idx) => (
            <span key={idx} className="flex items-center gap-1.5">
              <ChevronRight className="h-3 w-3 text-muted-foreground/50" />
              <span className={idx === segments.length - 2 ? "text-primary font-semibold" : "text-muted-foreground"}>
                {segment}
              </span>
            </span>
          ))}
          {segments.length <= 1 && (
            <span className="flex items-center gap-1.5">
              <ChevronRight className="h-3 w-3 text-muted-foreground/50" />
              <span className="text-primary font-semibold">Overview</span>
            </span>
          )}
        </div>
      </div>

      {/* Zone 2: System Telemetry & Quick Search */}
      <div className="hidden lg:flex items-center gap-3">
        <div className="flex items-center gap-2 rounded-full border border-border/80 bg-background/50 px-3 py-1 text-xs text-muted-foreground font-mono">
          <Radio className="h-3 w-3 text-emerald-400 animate-pulse" />
          <span>Docker Socket Active</span>
          <span className="text-border">·</span>
          <span>Fastify :3001</span>
        </div>
      </div>

      {/* Zone 3: Primary Actions */}
      <div className="flex items-center gap-2">
        <Link href="/dashboard/servers/new">
          <Button size="sm" className="h-8 gap-1.5 px-3 text-xs font-semibold shadow-[0_0_12px_rgba(22,224,136,0.2)]">
            <Plus className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">New Server</span>
          </Button>
        </Link>
      </div>
    </header>
  );
}

function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/login");
    }
  }, [loading, user, router]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 border border-primary/20 text-primary">
            <svg
              className="h-6 w-6 animate-pulse"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="m21 16-9 5-9-5V8l9-5 9 5v8z" />
              <path d="m3.27 6.96 8.73 4.88 8.73-4.88" />
              <path d="M12 22V12" />
            </svg>
          </div>
          <span className="text-xs font-mono text-muted-foreground animate-pulse">
            Connecting to control plane...
          </span>
        </div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <TopBar />
        <main className="flex-1 overflow-y-auto bg-tech-grid p-4 sm:p-6 lg:p-8">
          <div className="mx-auto max-w-7xl">
            <ErrorBoundary>{children}</ErrorBoundary>
          </div>
        </main>
      </div>
    </div>
  );
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <ConfirmProvider>
      <AuthGuard>{children}</AuthGuard>
    </ConfirmProvider>
  );
}
