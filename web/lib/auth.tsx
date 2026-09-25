"use client";

import { createContext, useContext, useEffect, useRef, useState, ReactNode } from "react";
import { api, clearToken, setToken } from "./api";
import { disconnectSocket } from "./socket";
import { useToast } from "@/components/toast";

interface User {
  id: number;
  username: string;
  role: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<{ requiresTotp?: boolean; tempToken?: string } | void>;
  verifyTotp: (tempToken: string, code: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  login: async () => {},
  verifyTotp: async () => {},
  logout: () => {},
});

const WARN_BEFORE_MS = 5 * 60 * 1000;

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [expiresAt, setExpiresAt] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const { warning } = useToast();

  useEffect(() => {
    api.get("/api/auth/me")
      .then((response: any) => {
        setUser(response?.user || null);
        setExpiresAt(response?.expiresAt ?? null);
      })
      .catch(() => {
        setUser(null);
        setExpiresAt(null);
      })
      .finally(() => setLoading(false));
  }, []);

  const logoutRef = useRef<() => void>(() => {});

  const login = async (username: string, password: string) => {
    const res = await api.post("/api/auth/login", { username, password });
    if (res.requiresTotp) {
      return { requiresTotp: true, tempToken: res.tempToken };
    }
    if (res.token) {
      setToken(res.token);
    }
    setUser(res.user);
    api.get("/api/auth/me")
      .then((response: any) => setExpiresAt(response?.expiresAt ?? null))
      .catch(() => {});
  };

  const verifyTotp = async (tempToken: string, code: string) => {
    const res = await api.post("/api/auth/2fa/challenge", { tempToken, code });
    if (res.token) {
      setToken(res.token);
    }
    setUser(res.user);
    api.get("/api/auth/me")
      .then((response: any) => setExpiresAt(response?.expiresAt ?? null))
      .catch(() => {});
  };

  const logout = async () => {
    disconnectSocket();
    clearToken();
    try {
      await api.post("/api/auth/logout");
    } catch {}
    setUser(null);
    setExpiresAt(null);
    window.location.href = "/login";
  };
  logoutRef.current = logout;

  useEffect(() => {
    if (!user || !expiresAt) return;
    const msUntilExpiry = expiresAt - Date.now();
    if (msUntilExpiry <= 0) {
      logoutRef.current();
      return;
    }
    const timers: ReturnType<typeof setTimeout>[] = [];
    const warnIn = msUntilExpiry - WARN_BEFORE_MS;
    if (warnIn > 0) {
      timers.push(setTimeout(() => {
        warning("Session expiring soon", "Your session ends in about 5 minutes. Save your work.");
      }, warnIn));
    } else {
      warning("Session expiring soon", "Your session is about to end. Save your work.");
    }
    timers.push(setTimeout(() => {
      warning("Session expired", "You have been logged out.");
      logoutRef.current();
    }, msUntilExpiry));
    return () => timers.forEach(clearTimeout);
  }, [user, expiresAt, warning]);

  return (
    <AuthContext.Provider value={{ user, loading, login, verifyTotp, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
