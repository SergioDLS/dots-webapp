import axios, { AxiosError, InternalAxiosRequestConfig } from "axios";

let accessTokenMemory: string | null = null;

export const setAccessToken = (token: string | null) => {
  accessTokenMemory = token;
};

type RetryableConfig = InternalAxiosRequestConfig & { _retry?: boolean };

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000",
  headers: { "Content-Type": "application/json" },
  withCredentials: true, // required for HttpOnly refresh cookie
});

// Single refresh flow guard
let isRefreshing = false;
let refreshPromise: Promise<string | null> | null = null;

const doRefresh = async (): Promise<string | null> => {
  try {
    // Use a plain axios instance (no interceptors) to avoid the response
    // interceptor catching a 401 on the refresh call itself and recursing.
    const plain = axios.create({
      baseURL: process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000",
      headers: { "Content-Type": "application/json" },
      withCredentials: true,
      timeout: 8000,
    });
    const res = await plain.post("/auth/refresh");
    // Backend returns { token } (not accessToken)
    const token: string | null = res.data?.token ?? res.data?.accessToken ?? null;
    setAccessToken(token);
    return token;
  } catch {
    setAccessToken(null);
    return null;
  }
};

api.interceptors.request.use((config) => {
  if (accessTokenMemory) {
    config.headers = config.headers ?? {};
    config.headers.Authorization = `Bearer ${accessTokenMemory}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
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
      // Don't redirect here — let callers (AuthProvider, pages) decide
      // what to do when auth fails. Redirecting from the interceptor
      // causes a hard navigation that prevents components from mounting.
      throw error;
    }

    original.headers = original.headers ?? {};
    original.headers.Authorization = `Bearer ${newToken}`;
    return api(original);
  }
);

export default api;