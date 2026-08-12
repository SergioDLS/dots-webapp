"use client";

import React from "react";
import type { Mark } from "@/services/games.service";

/**
 * Teclado QWERTY en pantalla de los juegos diarios (wordle y crossword).
 * RN-safe: solo `onPointerUp`, sin listeners de teclado físico.
 *
 * Las diferencias entre ambos juegos son props, no copias: wordle pinta las
 * teclas con las marcas del servidor y necesita ENTER; crossword no.
 */

export const KB_ROW1 = ["Q", "W", "E", "R", "T", "Y", "U", "I", "O", "P"];
export const KB_ROW2 = ["A", "S", "D", "F", "G", "H", "J", "K", "L"];
export const KB_ROW3 = ["Z", "X", "C", "V", "B", "N", "M"];

/** Tecla especial de borrado; el consumidor la recibe tal cual en `onKey`. */
export const KEY_BACKSPACE = "⌫";
/** Tecla especial de envío (solo cuando `showEnter`). */
export const KEY_ENTER = "ENTER";

type Size = "sm" | "md";

interface KeyProps {
  label: string;
  mark?: Mark;
  onTap: () => void;
  wide?: boolean;
  size: Size;
}

function Key({ label, mark, onTap, wide, size }: KeyProps) {
  const bg =
    mark === "hit"
      ? "#22c55e"
      : mark === "present"
        ? "#f59e0b"
        : mark === "miss"
          ? "var(--muted)"
          : "var(--surface)";
  const color = mark !== undefined ? "#fff" : "var(--foreground)";
  const md = size === "md";

  return (
    <button
      onPointerUp={onTap}
      style={{
        minWidth: wide ? (md ? "4rem" : "3.5rem") : md ? "2.1rem" : "2rem",
        height: md ? "3.2rem" : "3rem",
        padding: md ? "0 0.25rem" : "0 0.2rem",
        border: "none",
        borderRadius: "0.4rem",
        background: bg,
        color,
        fontWeight: 700,
        fontSize: wide ? (md ? "0.75rem" : "0.7rem") : md ? "0.9rem" : "0.875rem",
        cursor: "pointer",
        userSelect: "none",
        flexShrink: 0,
        transition: "background 0.2s",
      }}
    >
      {label}
    </button>
  );
}

interface DailyKeyboardProps {
  /** Recibe la letra pulsada, o `KEY_ENTER` / `KEY_BACKSPACE`. */
  onKey: (key: string) => void;
  /** Marcas por letra (wordle); omitir para teclas neutras (crossword). */
  marks?: Record<string, Mark | undefined>;
  /** Añade la tecla ↵ al inicio de la tercera fila. */
  showEnter?: boolean;
  /** `md` = wordle (teclas algo mayores), `sm` = crossword. */
  size?: Size;
}

export default function DailyKeyboard({
  onKey,
  marks,
  showEnter = false,
  size = "md",
}: DailyKeyboardProps) {
  const gap = size === "md" ? "0.25rem" : "0.2rem";
  const rowStyle: React.CSSProperties = {
    display: "flex",
    gap,
    justifyContent: "center",
  };

  return (
    <>
      <div style={rowStyle}>
        {KB_ROW1.map((k) => (
          <Key key={k} label={k} mark={marks?.[k]} onTap={() => onKey(k)} size={size} />
        ))}
      </div>
      <div style={rowStyle}>
        {KB_ROW2.map((k) => (
          <Key key={k} label={k} mark={marks?.[k]} onTap={() => onKey(k)} size={size} />
        ))}
      </div>
      <div style={rowStyle}>
        {showEnter && (
          <Key label="↵" onTap={() => onKey(KEY_ENTER)} wide size={size} />
        )}
        {KB_ROW3.map((k) => (
          <Key key={k} label={k} mark={marks?.[k]} onTap={() => onKey(k)} size={size} />
        ))}
        <Key label={KEY_BACKSPACE} onTap={() => onKey(KEY_BACKSPACE)} wide size={size} />
      </div>
    </>
  );
}
