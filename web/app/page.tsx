"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    api.get("/api/auth/status").then(({ firstRun }) => {
      if (firstRun) {
        router.replace("/setup");
      } else {
        const token = localStorage.getItem("biryani_token");
        if (!token) {
          router.replace("/login");
          return;
        }
        try {
          const payload = JSON.parse(atob(token.split(".")[1]));
          if (payload.exp && payload.exp * 1000 < Date.now()) {
            localStorage.removeItem("biryani_token");
            router.replace("/login");
          } else {
            router.replace("/dashboard");
          }
        } catch {
          localStorage.removeItem("biryani_token");
          router.replace("/login");
        }
      }
    }).catch(() => {
      router.replace("/login");
    });
  }, [router]);

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        <p className="text-sm text-muted-foreground">Loading Biryani...</p>
      </div>
    </div>
  );
}
