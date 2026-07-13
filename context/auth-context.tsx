"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import api, {
  refreshAccessToken,
  setAccessToken as setApiAccessToken,
} from "@/lib/api-client";

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

  // Bootstrap: try to restore a session from the HttpOnly refresh cookie.
  // Uses the shared single-flight refresh so it can't race with interceptors.
  useEffect(() => {
    let mounted = true;
    (async () => {
      const token = await refreshAccessToken();
      if (mounted) {
        setAccessToken(token);
        setIsBootstrapping(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [setAccessToken]);

  const logout = useCallback(async () => {
    try {
      // Revoke the refresh token server-side before clearing local state.
      await api.post("/auth/logout");
    } catch {
      // Even if the server call fails, clear the local session.
    } finally {
      setAccessToken(null);
      if (typeof window !== "undefined") {
        window.localStorage.removeItem("user");
        window.location.replace("/");
      }
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
