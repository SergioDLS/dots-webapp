"use client";

import React from "react";
import { peerColor } from "@/lib/peer-colors";
import type { PathPeer as PathPeerType } from "@/types/path.types";

interface PathPeerProps {
  peer: PathPeerType;
  side: "left" | "right";
  /** Desplazamiento vertical para apilar varios vecinos en el mismo nodo. */
  stackIndex?: number;
  /** Desplazamiento horizontal para compensar que el nodo sobresale de su wrapper. */
  offset?: number;
  /**
   * Desplazamiento vertical extra cuando el nodo es el actual.
   * DotyMarker ocupa desde top=-6 hasta ~top=104; con 112px el vecino
   * siempre queda por debajo sin importar el stackIndex.
   * Este valor es independiente de stackIndex: uno significa "¿cuántos
   * vecinos hay apilados?" y el otro "¿hay que esquivar a Doty?".
   */
  currentNodeOffset?: number;
}

const CIRCLE = 34;
const SLOT_H = CIRCLE + 22;

/**
 * Un compañero posado al costado de su nodo. Mismo anclaje que DotyMarker:
 * se pega al borde del wrapper de 150px, hacia el interior del zigzag.
 *
 * RN-safe: el nombre va SIEMPRE visible (nada de hover como única señal) y no
 * hay animación fuera de transform/opacity. `pointer-events-none` porque hoy es
 * informativo; si más adelante se puede tocar para retar, se quita.
 */
export default function PathPeer({
  peer,
  side,
  stackIndex = 0,
  offset = 0,
  currentNodeOffset = 0,
}: PathPeerProps) {
  // Compensate for nodes that overshoot their 150px wrapper (e.g., checkpoints at 158px).
  const offsetValue = offset > 0 ? `calc(100% + ${offset}px)` : "100%";
  const anchor: React.CSSProperties =
    side === "right" ? { left: offsetValue } : { right: offsetValue };
  const hex = peerColor(peer.id);
  const initial = (peer.name?.trim()?.[0] ?? "?").toUpperCase();
  const label = peer.lastName ? `${peer.name} ${peer.lastName}.` : peer.name;

  return (
    <div
      className="absolute flex flex-col items-center gap-0.5 pointer-events-none select-none"
      style={{
        top: 18 + currentNodeOffset + stackIndex * SLOT_H,
        width: 72,
        zIndex: 20,
        ...anchor,
      }}
    >
      <div
        className="flex items-center justify-center rounded-full font-display font-black"
        style={{
          width: CIRCLE,
          height: CIRCLE,
          fontSize: 15,
          lineHeight: 1,
          background: `color-mix(in srgb, ${hex} 22%, var(--surface))`,
          border: `2.5px solid ${hex}`,
          color: `color-mix(in srgb, ${hex} 55%, var(--foreground))`,
          boxShadow: `0 2px 8px ${hex}44`,
        }}
      >
        {initial}
      </div>
      <span className="w-full truncate text-center text-[10px] font-extrabold leading-tight text-(--muted)">
        {label}
      </span>
    </div>
  );
}
