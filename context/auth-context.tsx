"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import api, { setAccessToken as setApiAccessToken } from "@/lib/api-client";

type AuthContextType = {
  accessToken: string | null;
  isBootstrapping: boolean;
  setAccessToken: (token: string | null) => void;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [accessToken, setAccessTokenState] = useState<string | null>(null);
  const [isBootstrapping, setIsBootstrapping] = useState(true);

  const setAccessToken = (token: string | null) => {
    setAccessTokenState(token);
    setApiAccessToken(token);
  };

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await api.post("/auth/refresh");
        const token = res.data?.accessToken ?? null;
        if (mounted) setAccessToken(token);
      } catch {
        if (mounted) setAccessToken(null);
      } finally {
        if (mounted) setIsBootstrapping(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const logout = async () => {
    try {
      await api.post("/auth/logout");
    } finally {
      setAccessToken(null);
      if (typeof window !== "undefined") window.location.replace("/login");
    }
  };

  const value = useMemo(
    () => ({ accessToken, isBootstrapping, setAccessToken, logout }),
    [accessToken, isBootstrapping],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
