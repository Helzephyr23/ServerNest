"use client";

import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";

const ConsoleView = dynamic(() => import("./console-view"), {
  ssr: false,
  loading: () => (
    <div className="space-y-4">
      <Skeleton className="h-6 w-24" />
      <Skeleton className="h-[400px] w-full rounded-lg" />
      <Skeleton className="h-10 w-full" />
    </div>
  ),
});

export default function ConsolePage() {
  return <ConsoleView />;
}
