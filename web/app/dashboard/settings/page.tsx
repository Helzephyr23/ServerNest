"use client";

import { Card, CardContent } from "@/components/ui/card";

export default function PanelSettingsPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-3xl font-bold">Settings</h1>
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <span className="mb-2 text-4xl">⚙️</span>
          <p className="text-muted-foreground">Panel settings coming soon</p>
        </CardContent>
      </Card>
    </div>
  );
}
