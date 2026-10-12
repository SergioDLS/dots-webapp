import axios, { AxiosError, InternalAxiosRequestConfig } from "axios";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

let accessTokenMemory: string | null = null;

export const setAccessToken = (token: string | null) => {
  accessTokenMemory = token;
};

export const getAccessToken = () => accessTokenMemory;

type RetryableConfig = InternalAxiosRequestConfig & {
  _retry?: boolean;
  /** Id de seguimiento de peticiones lentas (ver trackStart). */
  _trackId?: number;
};

// Tope por petición. Sin él, una conexión muerta (la red del celular que
// cambia, un proxy que no suelta) dejaba la pantalla en «Cargando…» para
// siempre; con él falla, y la pantalla ofrece Reintentar (regla 5). Es largo a
// propósito: una petición que despierta a la API (Render en frío, hasta un
// minuto) tiene que llegar, no cortarse a mitad del arranque como le pasaba al
// refresh con sus 8 s.
const API_TIMEOUT_MS = 90_000;

/**
 * Para lo que de verdad trabaja en el servidor: generar voz con ElevenLabs,
 * subir a Cloudinary, mandar invitaciones en lote. Se pasa por petición:
 * `api.post(url, body, { timeout: LONG_REQUEST_TIMEOUT_MS })`.
 */
export const LONG_REQUEST_TIMEOUT_MS = 5 * 60_000;

// ── Peticiones lentas ────────────────────────────────────────────────────────
// A mitad de sesión la API también se duerme (Render, tras un rato sin
// tráfico) y la siguiente petición espera lo que tarde en despertar, sin que
// la pantalla diga por qué. Se lleva la cuenta de las que pasan de
// SLOW_REQUEST_MS en vuelo; components/shell/server-wake.tsx la lee con
// useSyncExternalStore y pinta «Despertando al servidor…». 4 s y no menos:
// una API despierta responde en ~200 ms, pero una red móvil floja puede rozar
// los 2-3 s y el aviso no debe salir con el servidor despierto.
const SLOW_REQUEST_MS = 4_000;
let lastTrackId = 0;
const slowIds = new Set<number>();
const slowTimers = new Map<number, ReturnType<typeof setTimeout>>();
const slowListeners = new Set<() => void>();

const emitSlow = () => slowListeners.forEach((listener) => listener());

const trackStart = (): number => {
  const id = ++lastTrackId;
  slowTimers.set(
    id,
    setTimeout(() => {
      slowTimers.delete(id);
      slowIds.add(id);
      emitSlow();
    }, SLOW_REQUEST_MS),
  );
  return id;
};

const trackEnd = (id: number | undefined) => {
  if (id === undefined) return;
  clearTimeout(slowTimers.get(id));
  slowTimers.delete(id);
  if (slowIds.delete(id)) emitSlow();
};

export const subscribeSlowRequests = (listener: () => void) => {
  slowListeners.add(listener);
  return () => {
    slowListeners.delete(listener);
  };
};

/** ¿Hay alguna petición en vuelo desde hace más de SLOW_REQUEST_MS? */
export const hasSlowRequests = () => slowIds.size > 0;

const api = axios.create({
  baseURL: API_BASE,
  timeout: API_TIMEOUT_MS,
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
    // El refresh también cuenta: va por axios a secas (sin los interceptores
    // de `api`) y, con sus reintentos y pausas, puede ser él quien deja
    // esperando a la pantalla después de que la petición original volviera 401.
    const trackId = trackStart();
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
        trackEnd(trackId);
        refreshPromise = null;
      });
  }
  return refreshPromise;
};

api.interceptors.request.use((config) => {
  // Lo que lleva el tope largo (voz, subidas, correos en lote) tarda porque
  // trabaja, no porque el servidor duerma: no se cuenta, o el aviso mentiría.
  // `config.timeout` ya trae aquí el default de la instancia fusionado.
  if (config.timeout && config.timeout <= API_TIMEOUT_MS) {
    (config as RetryableConfig)._trackId = trackStart();
  }
  if (accessTokenMemory) {
    config.headers = config.headers ?? {};
    config.headers.Authorization = `Bearer ${accessTokenMemory}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => {
    trackEnd((response.config as RetryableConfig)._trackId);
    return response;
  },
  async (error: AxiosError) => {
    const original = error.config as RetryableConfig | undefined;
    // El reintento de abajo vuelve a pasar por el interceptor de request, que
    // le da un id nuevo: este se cierra aquí en todos los caminos.
    trackEnd(original?._trackId);

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
