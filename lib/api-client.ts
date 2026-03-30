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
    const res = await api.post("/auth/refresh");
    const token: string | null = res.data?.accessToken ?? null;
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
      if (typeof window !== "undefined") {
        window.location.replace("/login");
      }
      throw error;
    }

    original.headers = original.headers ?? {};
    original.headers.Authorization = `Bearer ${newToken}`;
    return api(original);
  }
);

export default api;