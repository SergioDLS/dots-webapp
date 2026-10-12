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
  refreshSession,
  setAccessToken as setApiAccessToken,
  subscribeAccessToken,
} from "@/lib/api-client";
import { clearAvatarMirror } from "@/lib/avatar-mirror";
import { marcarConocido } from "@/lib/doty-transformacion";
import { borrarEspejo } from "@/lib/first-run";
import { SOUND_KEY } from "@/lib/sound-prefs";
import { DIRTY_KEY, MODE_KEY, PALETTE_KEY } from "@/lib/theme-prefs";

/**
 * Cómo va el arranque contra la API: `waking` cuando el refresh tarda más de
 * lo normal (casi siempre, Render despertando) y `unreachable` cuando se
 * agotaron los reintentos sin hablar con el servidor. Lo pinta
 * components/shell/server-wake.tsx.
 */
export type ServerConnection = "ok" | "waking" | "unreachable";

type AuthContextType = {
  /**
   * Presente mientras haya sesión. Sigue a api-client solo cuando la sesión
   * entra o muere, no en cada rotación del token: úsalo como "¿hay sesión?",
   * nunca como credencial. Para llamar a la API, siempre `api`.
   */
  accessToken: string | null;
  isBootstrapping: boolean;
  connection: ServerConnection;
  retryBootstrap: () => void;
  setAccessToken: (token: string | null) => void;
  logout: () => Promise<void>;
};

// Un refresh con la API despierta tarda ~200 ms. Pasado esto, avisamos de que
// el servidor está despertando en vez de dejar un spinner mudo.
const WAKING_HINT_MS = 3_000;

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [accessToken, setAccessTokenState] = useState<string | null>(null);
  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const [connection, setConnection] = useState<ServerConnection>("ok");
  // Patrón fetchAttempt (regla 3): Reintentar solo bumpea este contador.
  const [bootAttempt, setBootAttempt] = useState(0);

  const setAccessToken = useCallback((token: string | null) => {
    setAccessTokenState(token);
    setApiAccessToken(token);
    // Con sesión, la persona va a ver al Doty nuevo dentro de la app: desde ya
    // las pantallas previas a la sesión pueden enseñárselo (ver
    // lib/doty-transformacion.ts). El logout no la borra a propósito.
    if (token) marcarConocido();
  }, []);

  // El interceptor de api-client refresca por su cuenta. Si ese refresh dice
  // que la sesión murió (logout en otra pestaña, cookie vencida), el contexto
  // tiene que enterarse: si no, la app se sigue creyendo logueada y `/`
  // rebota a /levels en vez de mostrar el login. Solo se sigue la PRESENCIA
  // de sesión: la rotación del token cada 15 min no debe volver a disparar
  // los efectos que dependen de `accessToken` (FirstRunGate, RivalWatch…).
  useEffect(
    () =>
      subscribeAccessToken((token) => {
        setAccessTokenState((prev) =>
          Boolean(prev) === Boolean(token) ? prev : token,
        );
      }),
    [],
  );

  // Bootstrap: try to restore a session from the HttpOnly refresh cookie.
  // Uses the shared single-flight refresh so it can't race with interceptors.
  useEffect(() => {
    let mounted = true;
    const hint = setTimeout(() => {
      if (mounted) setConnection("waking");
    }, WAKING_HINT_MS);
    (async () => {
      const outcome = await refreshSession();
      clearTimeout(hint);
      if (!mounted) return;
      if (outcome.kind === "unreachable") {
        // isBootstrapping se queda en true a propósito: "no hay sesión" solo
        // lo puede decir el servidor. Así ninguna pantalla manda al login (ni
        // pinta «inicia sesión») por un timeout; server-wake ofrece Reintentar.
        setConnection("unreachable");
        return;
      }
      setConnection("ok");
      setAccessToken(outcome.kind === "ok" ? outcome.token : null);
      setIsBootstrapping(false);
    })();
    return () => {
      mounted = false;
      clearTimeout(hint);
    };
  }, [setAccessToken, bootAttempt]);

  const retryBootstrap = useCallback(() => {
    // Ya sabemos que va lento: el aviso de "despertando" sale sin esperar.
    setConnection("waking");
    setBootAttempt((n) => n + 1);
  }, []);

  const logout = useCallback(async () => {
    try {
      // Revoke the refresh token server-side before clearing local state.
      await api.post("/auth/logout");
    } catch {
      // Even if the server call fails, clear the local session.
    } finally {
      setAccessToken(null);
      // Los avatares pasan por /_next/image, que el service worker cachea:
      // en un equipo compartido (una academia) quedarían legibles para el
      // siguiente que entre. Best-effort y por prefijo, para no depender de
      // SW_VERSION; los otros caches solo tienen assets públicos del build.
      if (typeof caches !== "undefined") {
        try {
          const names = await caches.keys();
          await Promise.all(
            names
              .filter((n) => n.startsWith("dots-media-"))
              .map((n) => caches.delete(n)),
          );
        } catch {
          /* ignore */
        }
      }
      if (typeof window !== "undefined") {
        window.localStorage.removeItem("user");
        // Limpia también los espejos (tema, sonido, pendiente): si no, en un
        // equipo compartido heredas los ajustes de quien cerró sesión.
        try {
          window.localStorage.removeItem(PALETTE_KEY);
          window.localStorage.removeItem(MODE_KEY);
          window.localStorage.removeItem(SOUND_KEY);
          window.localStorage.removeItem(DIRTY_KEY);
          // La cara tambien es del usuario: sin esto el siguiente en entrar ve
          // un instante el avatar del anterior antes de que responda el suyo.
          clearAvatarMirror();
          // El primer inicio también es del usuario: en un equipo compartido, el
          // siguiente en entrar tiene que pasar por su propia bienvenida.
          borrarEspejo();
        } catch {
          /* modo privado o storage lleno: nada que limpiar */
        }
        // window.location a propósito (par de lib/api-client.ts): en logout
        // la recarga completa ES el objetivo — descarta todo estado en memoria.
        window.location.replace("/");
      }
    }
  }, [setAccessToken]);

  const value = useMemo(
    () => ({
      accessToken,
      isBootstrapping,
      connection,
      retryBootstrap,
      setAccessToken,
      logout,
    }),
    [accessToken, isBootstrapping, connection, retryBootstrap, setAccessToken, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
