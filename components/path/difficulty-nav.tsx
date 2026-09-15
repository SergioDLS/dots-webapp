"use client";

import { Icon } from "@/components/ui/icon";
import type { DifficultyNav } from "@/lib/path-view";

interface ArrowProps {
  direction: "prev" | "next";
  nav: DifficultyNav;
  onGo: (id: number) => void;
  accentHex: string;
  size?: number;
}

/**
 * Una flecha de navegación entre dificultades. La anterior se atenúa en la
 * primera; la siguiente se deshabilita si la próxima está bloqueada (a esa se
 * llega por su tarjeta punteada, en modo vista previa).
 */
export function DifficultyArrow({ direction, nav, onGo, accentHex, size = 36 }: ArrowProps) {
  const id = direction === "prev" ? nav.prevId : nav.nextId;
  const disabled = id === null || (direction === "next" && nav.nextLocked);
  return (
    <button
      type="button"
      aria-label={direction === "prev" ? "Dificultad anterior" : "Dificultad siguiente"}
      disabled={disabled}
      onClick={() => id !== null && onGo(id)}
      className="grid shrink-0 place-items-center rounded-full text-foreground transition-transform active:enabled:scale-95 disabled:opacity-40"
      style={{
        width: size,
        height: size,
        background: `color-mix(in srgb, ${accentHex} 18%, var(--surface))`,
      }}
    >
      <Icon name={direction === "prev" ? "izquierda" : "derecha"} size={Math.round(size * 0.55)} />
    </button>
  );
}

interface PairProps {
  nav: DifficultyNav;
  onGo: (id: number) => void;
  accentHex: string;
}

/** Las dos flechas juntas (banner). */
export default function DifficultyNavArrows({ nav, onGo, accentHex }: PairProps) {
  return (
    <div className="flex items-center gap-2">
      <DifficultyArrow direction="prev" nav={nav} onGo={onGo} accentHex={accentHex} />
      <DifficultyArrow direction="next" nav={nav} onGo={onGo} accentHex={accentHex} />
    </div>
  );
}
