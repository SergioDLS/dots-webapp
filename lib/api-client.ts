import axios, { AxiosError, InternalAxiosRequestConfig } from "axios";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

let accessTokenMemory: string | null = null;

export const setAccessToken = (token: string | null) => {
  accessTokenMemory = token;
};

export const getAccessToken = () => accessTokenMemory;

type RetryableConfig = InternalAxiosRequestConfig & { _retry?: boolean };

const api = axios.create({
  baseURL: API_BASE,
  headers: { "Content-Type": "application/json" },
  // The refresh token lives in an HttpOnly cookie, so every request must
  // carry credentials for the backend to be able to rotate/revoke it.
  withCredentials: true,
});

// Single-flight refresh: concurrent 401s (and the AuthProvider bootstrap)
// all await the same promise instead of firing parallel /auth/refresh calls.
let refreshPromise: Promise<string | null> | null = null;

export const refreshAccessToken = (): Promise<string | null> => {
  if (!refreshPromise) {
    // Plain axios (no interceptors) so a 401 from /auth/refresh itself
    // can't recurse back into the response interceptor.
    refreshPromise = axios
      .post(`${API_BASE}/auth/refresh`, null, {
        headers: { "Content-Type": "application/json" },
        withCredentials: true,
        timeout: 8000,
      })
      .then((res) => {
        const token: string | null =
          res.data?.token ?? res.data?.accessToken ?? null;
        setAccessToken(token);
        return token;
      })
      .catch(() => {
        setAccessToken(null);
        return null;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
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

    // A 401 from the auth endpoints themselves (wrong password, expired
    // refresh cookie, etc.) means the credentials failed — refreshing and
    // retrying would be wrong. Only protected-resource 401s go through refresh.
    if (original.url?.includes("/auth/")) {
      throw error;
    }

    original._retry = true;

    const newToken = await refreshAccessToken();
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
