"use client";

import React, { useSyncExternalStore } from "react";
import Doty, { toDotyPose } from "@/components/ui/doty/doty";
import { creaSorteo } from "@/lib/doty-pose-aleatoria";

interface DotyMarkerProps {
  side?: "left" | "right";
}

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
 * Falta la pose ideal para este sitio y no existe en el catálogo: un Doty
 * llamando con la mano ("ven acá"), que es exactamente lo que dice el globo.
 * `senalando` es lo más cerca que hay.
 */
const POSES_MARCADOR = [
  "senalando", // señala hacia el nodo: la más literal
  "corriendo", // líneas de movimiento, "vamos"
  "caminando", // zancada, avance tranquilo
  "sigue-asi", // el gemelo semántico del globo
  "emocionado", // los dos brazos arriba, entusiasmo
] as const;

const sorteo = creaSorteo(POSES_MARCADOR);

/** Small Doty anchored beside the current node, cheering the learner on. */
export default function DotyMarker({ side = "right" }: DotyMarkerProps) {
  const pose = useSyncExternalStore(sorteo.suscribir, sorteo.cliente, sorteo.servidor);

  const anchor: React.CSSProperties =
    side === "right" ? { left: "100%" } : { right: "100%" };

  return (
    <div
      aria-hidden
      className="absolute flex flex-col items-center gap-0.5 pointer-events-none select-none"
      style={{
        top: -6,
        width: 96,
        zIndex: 20,
        animation: "dots-float 3s ease-in-out infinite",
        ...anchor,
      }}
    >
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
      <Doty pose={toDotyPose(pose)} size="mini" />
    </div>
  );
}
