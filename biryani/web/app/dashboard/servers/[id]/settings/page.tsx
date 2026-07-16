"use client";

import { Card, CardContent } from "@/components/ui/card";

export default function SettingsPage() {
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold">Server Settings</h2>
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <span className="mb-2 text-4xl">⚙️</span>
          <p className="text-muted-foreground">Server settings coming soon</p>
        </CardContent>
      </Card>
    </div>
  );
}
