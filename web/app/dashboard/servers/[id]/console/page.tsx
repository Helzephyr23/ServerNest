"use client";

import dynamic from "next/dynamic";

const ConsoleView = dynamic(() => import("./console-view"), {
  ssr: false,
  loading: () => (
    <div className="flex justify-center py-12">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
    </div>
  ),
});

export default function ConsolePage() {
  return <ConsoleView />;
}
