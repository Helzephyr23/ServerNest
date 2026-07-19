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
  refresh: () => void;
}

const ServerContext = createContext<ServerContextType>({
  server: null,
  loading: true,
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

  const fetch = useCallback(async () => {
    if (!id) return;
    try {
      const data = await api.get(`/api/servers/${id}`);
      setServer(data.server);
    } catch {
      setServer(null);
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
    <ServerContext.Provider value={{ server, loading, refresh: fetch }}>
      {children}
    </ServerContext.Provider>
  );
}
