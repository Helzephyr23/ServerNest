"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { ErrorBoundary } from "@/components/error-boundary";
import { ConfirmProvider } from "@/components/confirm-dialog";
import Sidebar from "@/components/sidebar";

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
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 overflow-auto p-3 sm:p-6">
        <ErrorBoundary>{children}</ErrorBoundary>
      </main>
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
