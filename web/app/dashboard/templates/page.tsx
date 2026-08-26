"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export default function TemplatesPage() {
  const router = useRouter();
  const [templates, setTemplates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get("/api/templates")
      .then(({ templates: t }) => setTemplates(Array.isArray(t) ? t : []))
      .catch(() => setTemplates([]))
      .finally(() => setLoading(false));
  }, []);

  const handleSelect = (template: any) => {
    router.push(`/dashboard/servers/new?template=${template.id}`);
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <Skeleton className="h-8 w-48 mb-2" />
          <Skeleton className="h-4 w-80" />
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i}>
              <CardHeader className="pb-3">
                <div className="flex items-center gap-3">
                  <Skeleton className="h-10 w-10 rounded-lg" />
                  <div>
                    <Skeleton className="h-5 w-28 mb-1" />
                    <Skeleton className="h-3 w-16" />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <Skeleton className="h-4 w-full mb-2" />
                <Skeleton className="h-4 w-3/4 mb-4" />
                <Skeleton className="h-3 w-24 mb-4" />
                <Skeleton className="h-8 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Server Templates</h1>
        <p className="text-muted-foreground">Quick-start templates for popular Minecraft server types</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {templates.map((template) => (
          <Card key={template.id} className="cursor-pointer transition-colors hover:border-primary/50">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-3">
                <span className="text-3xl">{template.icon}</span>
                <div>
                  <CardTitle className="text-lg">{template.name}</CardTitle>
                  <p className="text-xs text-muted-foreground">{template.software}</p>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <p className="mb-4 text-sm text-muted-foreground">{template.description}</p>
              <div className="mb-4 text-xs text-muted-foreground">
                <p>Default RAM: {template.default_ram_mb >= 1024 ? `${template.default_ram_mb / 1024} GB` : `${template.default_ram_mb} MB`}</p>
              </div>
              <Button variant="outline" size="sm" className="w-full" onClick={() => handleSelect(template)}>
                Use Template
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
