"use client";

import { useEffect } from "react";
import { setAccessToken } from "@/lib/api-client";
import { useAuth } from "./auth-context";

export default function AuthSync() {
  const { accessToken } = useAuth();

  useEffect(() => {
    setAccessToken(accessToken);
  }, [accessToken]);

  return null;
}