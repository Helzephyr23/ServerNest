"use client";

import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function MarketplacePage() {
  const [query, setQuery] = useState("");
  const [type, setType] = useState<"mods" | "plugins">("mods");
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const search = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    setLoading(true);
    setSearched(true);
    try {
      const endpoint = type === "mods" ? "/api/mods/search" : "/api/mods/plugins";
      const { mods, plugins } = await api.get(`${endpoint}?q=${encodeURIComponent(query.trim())}`);
      setResults(mods || plugins || []);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Marketplace</h1>
        <p className="text-muted-foreground">Browse mods and plugins from Modrinth</p>
      </div>

      <form onSubmit={search} className="flex gap-2">
        <div className="flex gap-1 rounded-lg border p-1">
          <button
            type="button"
            onClick={() => setType("mods")}
            className={`rounded-md px-3 py-1 text-sm ${type === "mods" ? "bg-primary text-primary-foreground" : ""}`}
          >
            Mods
          </button>
          <button
            type="button"
            onClick={() => setType("plugins")}
            className={`rounded-md px-3 py-1 text-sm ${type === "plugins" ? "bg-primary text-primary-foreground" : ""}`}
          >
            Plugins
          </button>
        </div>
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search mods..."
          className="flex-1"
        />
        <Button type="submit" disabled={loading}>
          {loading ? "Searching..." : "Search"}
        </Button>
      </form>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      ) : searched && results.length === 0 ? (
        <p className="py-12 text-center text-muted-foreground">No results found</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {results.map((mod) => (
            <Card key={mod.slug}>
              <CardHeader className="flex flex-row items-start gap-3 pb-3">
                {mod.icon_url && (
                  <img src={mod.icon_url} alt="" className="h-12 w-12 rounded-lg object-cover" />
                )}
                <div className="flex-1">
                  <CardTitle className="text-base">{mod.title}</CardTitle>
                  <p className="text-xs text-muted-foreground">{mod.downloads?.toLocaleString()} downloads</p>
                </div>
              </CardHeader>
              <CardContent>
                <p className="line-clamp-2 text-sm text-muted-foreground">{mod.description}</p>
                <div className="mt-3 flex flex-wrap gap-1">
                  {mod.categories?.slice(0, 3).map((cat: string) => (
                    <span key={cat} className="rounded-full bg-secondary px-2 py-0.5 text-xs">{cat}</span>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {!searched && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <span className="mb-4 text-6xl">📦</span>
          <h2 className="text-xl font-bold">Discover Mods & Plugins</h2>
          <p className="mt-2 max-w-md text-muted-foreground">
            Search for mods and plugins to enhance your Minecraft server.
            Powered by Modrinth.
          </p>
        </div>
      )}
    </div>
  );
}
