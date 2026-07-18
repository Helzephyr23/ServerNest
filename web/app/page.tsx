"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";

export default function Home() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get("/api/auth/status").then(({ firstRun }) => {
      if (firstRun) {
        router.replace("/setup");
      } else {
        const token = localStorage.getItem("biryani_token");
        if (token) {
          router.replace("/dashboard");
        } else {
          router.replace("/login");
        }
      }
    }).catch(() => {
      router.replace("/login");
    }).finally(() => setLoading(false));
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
