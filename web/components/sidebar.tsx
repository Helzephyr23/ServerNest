"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import {
  LayoutDashboard,
  Server,
  Layers,
  ShoppingBag,
  Network,
  Clock,
  Bell,
  Sliders,
  Users,
  KeyRound,
  ScrollText,
  LogOut,
  ChevronRight,
  Shield,
} from "lucide-react";

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

const navItems: NavItem[] = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/dashboard/servers", label: "Servers", icon: Server },
  { href: "/dashboard/templates", label: "Templates", icon: Layers },
  { href: "/dashboard/marketplace", label: "Marketplace", icon: ShoppingBag },
  { href: "/dashboard/nodes", label: "Nodes", icon: Network },
  { href: "/dashboard/tasks", label: "Tasks", icon: Clock },
  { href: "/dashboard/notifications", label: "Notifications", icon: Bell },
  { href: "/dashboard/rate-limits", label: "Rate Limits", icon: Sliders },
  { href: "/dashboard/users", label: "Users", icon: Users },
  { href: "/dashboard/sessions", label: "Sessions", icon: KeyRound },
  { href: "/dashboard/audit", label: "Audit Log", icon: ScrollText },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  const isActive = (href: string) =>
    href === "/dashboard" ? pathname === "/dashboard" : pathname.startsWith(href);

  const navContent = (
    <div className="flex h-full flex-col">
      {/* Brand Header */}
      <div className="border-b border-border/80 px-5 py-4">
        <Link
          href="/dashboard"
          className="group flex items-center gap-3 transition-opacity hover:opacity-90"
        >
          <div className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 border border-primary/20 text-primary shadow-[0_0_12px_rgba(22,224,136,0.15)]">
            {/* High-tech voxel / cube insignia */}
            <svg
              className="h-5 w-5"
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
            <div className="absolute -top-0.5 -right-0.5 h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
          </div>
          <div className="flex-1 truncate">
            <div className="flex items-center gap-1.5">
              <span className="font-bold tracking-tight text-foreground">SERVERNEST</span>
              <span className="rounded bg-primary/15 px-1 py-0.2 text-[9px] font-mono font-semibold tracking-wider text-primary uppercase">
                PANEL
              </span>
            </div>
            <p className="text-[11px] font-mono text-muted-foreground/80 tracking-wide">
              SERVER ORCHESTRATOR
            </p>
          </div>
        </Link>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 space-y-0.5 px-3 py-3 overflow-y-auto scrollbar-thin">
        <div className="px-3 pb-2 pt-1 text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground/60">
          Control Plane
        </div>
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              className={cn(
                "group relative flex items-center justify-between rounded-lg px-3 py-2 text-xs font-medium transition-all duration-150",
                active
                  ? "bg-primary/10 text-primary font-semibold border border-primary/20 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05)]"
                  : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
              )}
            >
              <div className="flex items-center gap-2.5">
                {active && (
                  <span className="absolute left-0 top-1.5 bottom-1.5 w-1 rounded-r bg-primary shadow-[0_0_8px_rgba(22,224,136,0.8)]" />
                )}
                <Icon
                  className={cn(
                    "h-4 w-4 transition-colors",
                    active ? "text-primary" : "text-muted-foreground group-hover:text-foreground"
                  )}
                />
                <span>{item.label}</span>
              </div>
              {active && <ChevronRight className="h-3 w-3 text-primary/70" />}
            </Link>
          );
        })}
      </nav>

      {/* Node Telemetry Health Status */}
      <div className="mx-3 mb-2 rounded-lg border border-border/60 bg-muted/30 p-2.5">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
            Core Node
          </span>
          <div className="flex items-center gap-1.5">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
            </span>
            <span className="text-[10px] font-mono text-emerald-400 font-medium">Nominal</span>
          </div>
        </div>
        <p className="mt-1 text-[11px] font-mono text-muted-foreground/75 truncate">
          itzg/minecraft-server daemon
        </p>
      </div>

      {/* User & Session Footer */}
      <div className="border-t border-border/80 p-3 bg-card/60">
        <div className="flex items-center justify-between gap-2 px-2 py-1.5">
          <div className="flex items-center gap-2.5 truncate">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 border border-primary/25 text-xs font-mono font-bold text-primary">
              {user?.username?.[0]?.toUpperCase() || "?"}
            </div>
            <div className="truncate">
              <p className="text-xs font-semibold leading-tight text-foreground truncate">
                {user?.username}
              </p>
              <div className="flex items-center gap-1 mt-0.5">
                <Shield className="h-2.5 w-2.5 text-primary" />
                <span className="text-[10px] font-mono text-muted-foreground capitalize">
                  {user?.role || "Admin"}
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <ThemeToggle />
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
              onClick={logout}
              title="Sign Out"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile Toggle Button */}
      <button
        type="button"
        aria-label="Toggle navigation menu"
        className="fixed left-4 top-3.5 z-50 rounded-lg border border-border bg-card/90 backdrop-blur-md p-2 shadow-lg md:hidden"
        onClick={() => setMobileOpen(!mobileOpen)}
      >
        <svg className="h-5 w-5 text-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          {mobileOpen ? (
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          ) : (
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          )}
        </svg>
      </button>

      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-border/80 bg-card/95 backdrop-blur-md transition-transform duration-200 md:relative md:translate-x-0",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {navContent}
      </aside>
    </>
  );
}
