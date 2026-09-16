"use client";

import React from "react";
import Avatar from "@/components/ui/avatar/avatar";
import type { PathPeer as PathPeerType } from "@/types/path.types";

interface PathPeerProps {
  peer: PathPeerType;
  side: "left" | "right";
  /** Desplazamiento vertical para apilar varios vecinos en el mismo nodo. */
  stackIndex?: number;
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
}: PathPeerProps) {
  const anchor: React.CSSProperties =
    side === "right" ? { left: "100%" } : { right: "100%" };
  const label = peer.lastName ? `${peer.name} ${peer.lastName}.` : peer.name;

  return (
    <div
      className="absolute flex flex-col items-center gap-0.5 pointer-events-none select-none"
      style={{
        top: 18 + stackIndex * SLOT_H,
        width: 72,
        zIndex: 20,
        ...anchor,
      }}
    >
      <Avatar avatar={peer.avatar} size={CIRCLE} alt="" />
      <span className="w-full truncate text-center text-[10px] font-extrabold leading-tight text-(--muted)">
        {label}
      </span>
    </div>
  );
}
