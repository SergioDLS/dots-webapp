"use client";

import { useSyncExternalStore } from "react";
import Spinner from "@/components/ui/Spinner/Spinner";
import Doty from "@/components/ui/doty/doty";
import { useAuth } from "@/context/auth-context";
import { hasSlowRequests, subscribeSlowRequests } from "@/lib/api-client";

/**
 * Aviso de arranque en frío. La API (Render) se duerme sin tráfico y el primer
 * refresh puede tardar hasta un minuto en volver: en vez de un spinner mudo, a
 * los pocos segundos Doty avisa de que el servidor está despertando, y si se
 * agotan los reintentos ofrece Reintentar. Tapa la pantalla entera a propósito:
 * sin servidor no funciona nada, y así ninguna página tiene que saberlo.
 *
 * A mitad de sesión la API también se duerme, pero ahí la pantalla ya está
 * pintada y muchas peticiones son de fondo: en vez de taparlo todo, una
 * píldora arriba que no bloquea, mientras alguna petición lleve más de 4 s en
 * vuelo (lib/api-client.ts, `hasSlowRequests`). Se va sola cuando responden.
 *
 * Vive en el layout raíz, dentro de AuthProvider. El arranque lo decide
 * auth-context (`connection`) y la lentitud api-client; aquí solo se pinta.
 */
export default function ServerWake() {
  const { connection, retryBootstrap } = useAuth();
  const slow = useSyncExternalStore(subscribeSlowRequests, hasSlowRequests, () => false);

  if (connection === "ok") {
    if (!slow) return null;
    return (
      <div
        className="pointer-events-none fixed inset-x-0 top-[calc(env(safe-area-inset-top)+0.75rem)] z-[60] flex justify-center px-4"
        role="status"
        aria-live="polite"
      >
        <div className="flex items-center gap-2 rounded-full bg-(--accent) px-4 py-2 text-sm font-extrabold text-(--accent-contrast) shadow-lg [animation:dots-pop-in_.3s_ease-out_both]">
          <span
            className="h-4 w-4 animate-spin rounded-full border-2 border-(--accent-contrast) border-t-transparent"
            aria-hidden
          />
          Despertando al servidor…
        </div>
      </div>
    );
  }

  const unreachable = connection === "unreachable";

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-(--background) px-4"
      role={unreachable ? "alert" : "status"}
      aria-live={unreachable ? "assertive" : "polite"}
    >
      <div className="dots-card flex w-full max-w-md flex-col items-center gap-4 px-6 py-10 text-center [animation:dots-slide-up_.3s_ease-out_both]">
        <Doty
          pose={unreachable ? "dormido" : "bostezo"}
          size="small"
          animation={unreachable ? "none" : "bob"}
        />
        <h2 className="font-display text-2xl font-extrabold text-foreground">
          {unreachable ? "El servidor no responde" : "Despertando al servidor…"}
        </h2>
        <p className="text-sm font-semibold text-(--muted)">
          {unreachable
            ? "Puede que estés sin conexión o que siga dormido. Revisa tu internet y lo intentamos otra vez."
            : "Se quedó dormido mientras no estabas. La primera carga puede tardar hasta un minuto."}
        </p>
        {unreachable ? (
          <button
            type="button"
            onClick={retryBootstrap}
            className="dots-pressable rounded-2xl bg-(--accent) px-6 py-3 text-sm font-extrabold text-(--accent-contrast) [--press-color:var(--accent-edge)]"
          >
            Reintentar
          </button>
        ) : (
          <Spinner size="sm" />
        )}
      </div>
    </div>
  );
}
