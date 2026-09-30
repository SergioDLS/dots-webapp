"use client";

import React, { useSyncExternalStore } from "react";
import Doty, { toDotyPose } from "@/components/ui/doty/doty";
import { creaSorteo } from "@/lib/doty-pose-aleatoria";
import { DOTY_PEEK_TOP, DOTY_PEEK_W } from "@/lib/node-bubble";

/**
 * Poses del marcador del Camino, que va pegado al nodo actual diciendo
 * "¡Sigue aquí!".
 *
 * El criterio no es "saludar" — eso es el login — sino **invitar a avanzar**:
 * señalar, ir hacia allá o animar a seguir.
 *
 * La lista es corta por una razón medida, no por pereza: el marcador se pinta a
 * 80 px (`size="mini"`), y a ese tamaño casi todas las poses del catálogo
 * colapsan en "Doty con los brazos arriba". Solo se distinguen las que cambian
 * la silueta — un brazo que sale del cuerpo, una zancada, líneas de movimiento.
 * Meter diez sería variedad que nadie llega a percibir.
 *
 * `ven-aqui` se generó para este sitio: es el gesto de llamar con la mano, que
 * es exactamente lo que dice el globo. Va primera y por eso es también la que
 * pinta el servidor.
 */
const POSES_MARCADOR = [
  "ven-aqui", // llama con la mano: hecha a medida para este globo
  "senalando", // señala hacia el nodo
  "corriendo", // líneas de movimiento, "vamos"
  "caminando", // zancada, avance tranquilo
  "sigue-asi", // el gemelo semántico del globo
  "emocionado", // los dos brazos arriba, entusiasmo
] as const;

const sorteo = creaSorteo(POSES_MARCADOR);

interface DotyMarkerProps {
  side?: "left" | "right";
  /**
   * `side`: al costado del nivel actual, como siempre. `peek`: asomado sobre el
   * borde de su burbuja abierta (spec 2026-09-30, decisión 9); globals.css lo
   * muestra solo con `.dots-slot[data-open]`.
   */
  variant?: "side" | "peek";
  /** En `peek`, en qué punta de la columna va Doty: `end` si la imagen está a la izquierda. */
  dotyAt?: "start" | "end";
}

/** Small Doty anchored beside the current node, cheering the learner on. */
export default function DotyMarker({ side = "right", variant = "side", dotyAt = "end" }: DotyMarkerProps) {
  const pose = useSyncExternalStore(sorteo.suscribir, sorteo.cliente, sorteo.servidor);

  const globo = (
    <div
      className="rounded-2xl px-2.5 py-1 text-[11px] font-black whitespace-nowrap"
      style={{
        background: "var(--surface)",
        border: "2px solid var(--border)",
        color: "var(--foreground)",
        boxShadow: "0 3px 10px rgba(0,0,0,0.10)",
      }}
    >
      ¡Sigue aquí!
    </div>
  );

  if (variant === "peek") {
    return (
      <div
        aria-hidden
        className="dots-doty-peek absolute flex items-start justify-end gap-1 pointer-events-none select-none"
        style={{
          top: DOTY_PEEK_TOP,
          width: DOTY_PEEK_W,
          // Detrás de la burbuja: asoma cabeza y brazos por encima del borde.
          zIndex: -1,
          flexDirection: dotyAt === "end" ? "row" : "row-reverse",
        }}
      >
        <div className="mt-3">{globo}</div>
        <Doty pose={toDotyPose(pose)} size="mini" />
      </div>
    );
  }

  const anchor: React.CSSProperties =
    side === "right" ? { left: "100%" } : { right: "100%" };

  return (
    <div
      aria-hidden
      className="dots-doty-side absolute flex flex-col items-center gap-0.5 pointer-events-none select-none"
      style={{
        top: -6,
        width: 96,
        zIndex: 20,
        animation: "dots-float 3s ease-in-out infinite",
        ...anchor,
      }}
    >
      {globo}
      <Doty pose={toDotyPose(pose)} size="mini" />
    </div>
  );
}
