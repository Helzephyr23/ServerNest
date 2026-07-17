"use client";

import { AuthProvider } from "@/lib/auth";
import { ToastProvider } from "@/components/toast";
import Sidebar from "@/components/sidebar";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <ToastProvider>
        <div className="flex min-h-screen">
          <Sidebar />
          <main className="flex-1 overflow-auto p-6">{children}</main>
        </div>
      </ToastProvider>
    </AuthProvider>
  );
}
