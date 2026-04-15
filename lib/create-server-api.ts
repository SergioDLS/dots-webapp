import axios, { AxiosError, InternalAxiosRequestConfig } from "axios";

type RetryableConfig = InternalAxiosRequestConfig & { _retry?: boolean };

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export function createServerApi(cookieHeader?: string) {
  let accessTokenMemory: string | null = null;

  // If cookieHeader contains an access_token cookie, use it as initial token
  if (cookieHeader) {
    const match = cookieHeader.match(/(?:^|; )access_token=([^;]+)/);
    if (match) {
      try {
        accessTokenMemory = decodeURIComponent(match[1]);
      } catch {
        accessTokenMemory = match[1];
      }
    }
  }
  const api = axios.create({
    baseURL: API_BASE,
    headers: {
      "Content-Type": "application/json",
      ...(cookieHeader ? { Cookie: cookieHeader } : {}),
    },
    timeout: 8000,
  });

  // Server-side refresh flow: use a plain axios instance (no interceptors) to avoid recursion
  const doRefresh = async (): Promise<string | null> => {
    try {
      const plain = axios.create({
        baseURL: API_BASE,
        headers: {
          "Content-Type": "application/json",
          ...(cookieHeader ? { Cookie: cookieHeader } : {}),
        },
        timeout: 8000,
      });

      const res = await plain.post("/auth/refresh");
      // backend returns access token in body as `token`
      const token: string | null =
        res.data?.accessToken ?? res.data?.token ?? null;
      accessTokenMemory = token;
      return token;
    } catch {
      accessTokenMemory = null;
      return null;
    }
  };

  // Attach Authorization header if we have an access token for this request.
  // If we don't, attempt a server-side refresh before the first request.
  api.interceptors.request.use(async (config) => {
    if (!accessTokenMemory) {
      // try to obtain a token using refresh cookie
      accessTokenMemory = await doRefresh();
    }
    if (accessTokenMemory) {
      config.headers = config.headers ?? {};
      config.headers.Authorization = `Bearer ${accessTokenMemory}`;
    }
    return config;
  });

  let isRefreshing = false;
  let refreshPromise: Promise<string | null> | null = null;

  api.interceptors.response.use(
    (r) => r,
    async (error: AxiosError) => {
      const original = error.config as RetryableConfig | undefined;
      if (!original || error.response?.status !== 401 || original._retry) {
        throw error;
      }
      original._retry = true;

      if (!isRefreshing) {
        isRefreshing = true;
        refreshPromise = doRefresh().finally(() => {
          isRefreshing = false;
        });
      }

      const newToken = await refreshPromise;
      if (!newToken) {
        // On server we throw and let caller handle redirect to login if needed
        throw error;
      }

      original.headers = original.headers ?? {};
      original.headers.Authorization = `Bearer ${newToken}`;
      return api(original);
    }
  );

  return api;
}
