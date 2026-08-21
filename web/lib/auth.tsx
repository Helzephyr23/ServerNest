"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { api } from "./api";
import { disconnectSocket } from "./socket";

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

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get("/api/auth/me")
      .then((response: any) => {
        setUser(response?.user || null);
      })
      .catch(() => {
        setUser(null);
      })
      .finally(() => setLoading(false));
  }, []);

  const login = async (username: string, password: string) => {
    const res = await api.post("/api/auth/login", { username, password });
    if (res.requiresTotp) {
      return { requiresTotp: true, tempToken: res.tempToken };
    }
    setUser(res.user);
  };

  const verifyTotp = async (tempToken: string, code: string) => {
    const res = await api.post("/api/auth/2fa/challenge", { tempToken, code });
    setUser(res.user);
  };

  const logout = async () => {
    disconnectSocket();
    try {
      await api.post("/api/auth/logout");
    } catch {}
    setUser(null);
    window.location.href = "/login";
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, verifyTotp, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
