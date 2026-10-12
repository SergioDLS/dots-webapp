"use client";

import Spinner from "@/components/ui/Spinner/Spinner";
import Doty from "@/components/ui/doty/doty";
import { useAuth } from "@/context/auth-context";

/**
 * Aviso de arranque en frío. La API (Render) se duerme sin tráfico y el primer
 * refresh puede tardar hasta un minuto en volver: en vez de un spinner mudo, a
 * los pocos segundos Doty avisa de que el servidor está despertando, y si se
 * agotan los reintentos ofrece Reintentar. Tapa la pantalla entera a propósito:
 * sin servidor no funciona nada, y así ninguna página tiene que saberlo.
 *
 * Vive en el layout raíz, dentro de AuthProvider. El estado lo decide
 * auth-context (`connection`); aquí solo se pinta.
 */
export default function ServerWake() {
  const { connection, retryBootstrap } = useAuth();
  if (connection === "ok") return null;

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
