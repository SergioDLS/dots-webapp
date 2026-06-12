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

  // Single-flight refresh shared by the request and response interceptors.
  // Uses a plain axios call (no interceptors) to avoid recursion.
  let refreshPromise: Promise<string | null> | null = null;
  const refresh = (): Promise<string | null> => {
    if (!refreshPromise) {
      refreshPromise = axios
        .post(`${API_BASE}/auth/refresh`, null, {
          headers: {
            "Content-Type": "application/json",
            ...(cookieHeader ? { Cookie: cookieHeader } : {}),
          },
          timeout: 8000,
        })
        .then((res) => {
          const token: string | null =
            res.data?.accessToken ?? res.data?.token ?? null;
          accessTokenMemory = token;
          return token;
        })
        .catch(() => {
          accessTokenMemory = null;
          return null;
        })
        .finally(() => {
          refreshPromise = null;
        });
    }
    return refreshPromise;
  };

  // Attach Authorization header if we have an access token for this request.
  // If we don't, attempt a server-side refresh before the first request.
  api.interceptors.request.use(async (config) => {
    if (!accessTokenMemory) {
      accessTokenMemory = await refresh();
    }
    if (accessTokenMemory) {
      config.headers = config.headers ?? {};
      config.headers.Authorization = `Bearer ${accessTokenMemory}`;
    }
    return config;
  });

  api.interceptors.response.use(
    (r) => r,
    async (error: AxiosError) => {
      const original = error.config as RetryableConfig | undefined;
      if (!original || error.response?.status !== 401 || original._retry) {
        throw error;
      }
      original._retry = true;

      const newToken = await refresh();
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
