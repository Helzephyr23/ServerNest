"use client";

import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from "react";
import { useParams } from "next/navigation";
import { api } from "@/lib/api";

interface Server {
  id: number;
  name: string;
  status: string;
  software: string;
  mc_version: string;
  [key: string]: any;
}

interface ServerContextType {
  server: Server | null;
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

const ServerContext = createContext<ServerContextType>({
  server: null,
  loading: true,
  error: null,
  refresh: () => {},
});

export function useServer() {
  return useContext(ServerContext);
}

export function ServerProvider({ children }: { children: ReactNode }) {
  const params = useParams();
  const id = params.id as string;
  const [server, setServer] = useState<Server | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    if (!id) return;
    try {
      const data = await api.get(`/api/servers/${id}`);
      setServer(data.server);
      setError(null);
    } catch (err) {
      setServer(null);
      setError((err as Error).message || "Failed to load server");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { fetch(); }, [fetch]);

  useEffect(() => {
    if (server?.status === "starting") {
      const interval = setInterval(fetch, 3000);
      return () => clearInterval(interval);
    }
  }, [server?.status, fetch]);

  return (
    <ServerContext.Provider value={{ server, loading, error, refresh: fetch }}>
      {children}
    </ServerContext.Provider>
  );
}
