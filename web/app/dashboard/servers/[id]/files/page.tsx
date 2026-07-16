"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function FilesPage() {
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold">File Manager</h2>
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <span className="mb-2 text-4xl">📁</span>
          <p className="text-muted-foreground">File manager coming soon</p>
        </CardContent>
      </Card>
    </div>
  );
}
