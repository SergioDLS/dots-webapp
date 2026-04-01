"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import api, { setAccessToken as setApiAccessToken } from "@/lib/api-client";
import axios from "axios";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

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

  const setAccessToken = useCallback((token: string | null) => {
    setAccessTokenState(token);
    setApiAccessToken(token);
  }, []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        // Use a plain axios instance (no interceptors) to avoid triggering
        // the response interceptor's retry-refresh logic on this initial call.
        const plain = axios.create({
          baseURL: API_BASE,
          headers: { "Content-Type": "application/json" },
          withCredentials: true,
          timeout: 8000,
        });
        const res = await plain.post("/auth/refresh");
        // Backend returns { token } (not accessToken)
        const token = res.data?.token ?? res.data?.accessToken ?? null;
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
  }, [setAccessToken]);

  const logout = useCallback(async () => {
    try {
      await api.post("/auth/logout");
    } finally {
      setAccessToken(null);
      if (typeof window !== "undefined") window.location.replace("/login");
    }
  }, [setAccessToken]);

  const value = useMemo(
    () => ({ accessToken, isBootstrapping, setAccessToken, logout }),
    [accessToken, isBootstrapping, setAccessToken, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
