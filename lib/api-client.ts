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

/**
 * Cómo terminó un refresh. `anon` y `unreachable` NO son lo mismo: el primero
 * es el servidor diciendo que no hay sesión (401/403); el segundo, que no
 * logramos hablar con él (timeout, red caída o 5xx). Quien trate un
 * `unreachable` como "sin sesión" manda al login a alguien que sí la tiene.
 */
export type RefreshOutcome =
  | { kind: "ok"; token: string }
  | { kind: "anon" }
  | { kind: "unreachable"; error: unknown };

// La API vive en Render y se duerme tras un rato sin tráfico: el primer pedido
// la despierta y el proxy de Render lo retiene hasta que el proceso arranca,
// que puede tardar hasta un minuto. Con un único intento de 8 s (lo que había)
// el refresh se abortaba a mitad del arranque y la app concluía "sin sesión".
// Reintentar es seguro: el refresh token es un JWT sin estado, así que un
// intento abortado que el backend llegue a procesar no invalida el siguiente.
const REFRESH_ATTEMPT_TIMEOUT_MS = 20_000;
// Pausa antes de cada reintento; su largo + 1 = intentos (~64 s en el peor caso).
const REFRESH_BACKOFF_MS = [1_000, 3_000];

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Sin respuesta (timeout, red, CORS de una página de error del proxy) o 5xx: vale la pena reintentar. */
const isTransient = (err: unknown) => {
  if (!axios.isAxiosError(err)) return false;
  const status = err.response?.status;
  return status === undefined || status >= 500;
};

/** El servidor respondió y rechazó la sesión: esto sí es "inicia sesión". */
export const isSessionError = (err: unknown) => {
  const status = axios.isAxiosError(err) ? err.response?.status : undefined;
  return status === 401 || status === 403;
};

const postRefresh = async () => {
  for (let attempt = 0; ; attempt++) {
    try {
      // Plain axios (no interceptors) so a 401 from /auth/refresh itself
      // can't recurse back into the response interceptor.
      // Body must be a JSON object: axios serializes `null` to the literal
      // string "null", which Express' strict JSON parser rejects with 400
      // before the request ever reaches the auth controller.
      return await axios.post(`${API_BASE}/auth/refresh`, {}, {
        headers: { "Content-Type": "application/json" },
        withCredentials: true,
        timeout: REFRESH_ATTEMPT_TIMEOUT_MS,
      });
    } catch (err) {
      if (!isTransient(err) || attempt >= REFRESH_BACKOFF_MS.length) throw err;
      await sleep(REFRESH_BACKOFF_MS[attempt]);
    }
  }
};

// Single-flight refresh: concurrent 401s (and the AuthProvider bootstrap)
// all await the same promise instead of firing parallel /auth/refresh calls.
let refreshPromise: Promise<RefreshOutcome> | null = null;

export const refreshSession = (): Promise<RefreshOutcome> => {
  if (!refreshPromise) {
    refreshPromise = postRefresh()
      .then((res): RefreshOutcome => {
        const token: string | null =
          res.data?.token ?? res.data?.accessToken ?? null;
        setAccessToken(token);
        return token ? { kind: "ok", token } : { kind: "anon" };
      })
      .catch((err: unknown): RefreshOutcome => {
        setAccessToken(null);
        if (isTransient(err)) return { kind: "unreachable", error: err };
        // Un 403 significa que la sesión no solo expiró localmente: el backend
        // rechaza explícitamente este refresh token (usuario bloqueado o con
        // acceso vencido). En ese caso guardamos el motivo, limpiamos el
        // perfil y forzamos una recarga limpia a /. Usamos window.location
        // igual que logout() en auth-context.tsx: la sesión ya está muerta,
        // perder el token en memoria es exactamente lo que queremos.
        const status = (err as { response?: { status?: number } })?.response?.status;
        if (status === 403 && typeof window !== "undefined") {
          const reason = (err as { response?: { data?: { reason?: string } } })
            ?.response?.data?.reason;
          if (reason) {
            window.sessionStorage.setItem("dots_auth_reason", reason);
          }
          window.localStorage.removeItem("user");
          window.location.replace("/");
        }
        return { kind: "anon" };
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

    const outcome = await refreshSession();
    if (outcome.kind !== "ok") {
      // Don't redirect here — let callers (AuthProvider, pages) decide
      // what to do when auth fails. Redirecting from the interceptor
      // causes a hard navigation that prevents components from mounting.
      // Si el refresh ni siquiera llegó al servidor, se propaga ESE error y
      // no el 401 original: quien lo reciba no debe leerlo como "sin sesión".
      throw outcome.kind === "unreachable" ? outcome.error : error;
    }

    original.headers = original.headers ?? {};
    original.headers.Authorization = `Bearer ${outcome.token}`;
    return api(original);
  }
);

export default api;
