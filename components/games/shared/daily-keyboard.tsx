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
  disabled?: boolean;
}

function Key({ label, mark, onTap, wide, size, disabled }: KeyProps) {
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
      onPointerUp={disabled ? undefined : onTap}
      disabled={disabled}
      // `dots-pressable` es el acuse de la casa: la tecla se hunde 4 px y su
      // sombra se colapsa. Sin él las teclas eran rectángulos inertes — el
      // único sitio de la app donde pulsar algo no se sentía.
      className="dots-pressable"
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
        cursor: disabled ? "default" : "pointer",
        userSelect: "none",
        flexShrink: 0,
        opacity: disabled ? 0.55 : 1,
        // La sombra de presión sigue al color de la tecla: en las marcadas de
        // wordle una sombra gris se vería como suciedad sobre el verde
        ["--press-color" as string]:
          mark !== undefined
            ? `color-mix(in srgb, ${bg} 65%, #000)`
            : "var(--border)",
        // OJO: un `transition` inline pisa entero al de `.dots-pressable`, así
        // que hay que repetir aquí sus tres propiedades o el hundido de la
        // tecla salta sin interpolar
        transition:
          "background 0.2s, opacity 0.2s, transform 120ms ease, box-shadow 120ms ease, filter 150ms ease",
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
  /**
   * El envío está en vuelo: la tecla ↵ se bloquea y lo dice. Sin esto el
   * jugador pulsaba ↵, no pasaba nada visible durante la ida y vuelta, y
   * volvía a pulsar — el mismo agujero que tenía «Comprobar» en crossword.
   */
  enterBusy?: boolean;
  /** `md` = wordle (teclas algo mayores), `sm` = crossword. */
  size?: Size;
}

export default function DailyKeyboard({
  onKey,
  marks,
  showEnter = false,
  enterBusy = false,
  size = "md",
}: DailyKeyboardProps) {
  const gap = size === "md" ? "0.25rem" : "0.2rem";
  const rowStyle: React.CSSProperties = {
    display: "flex",
    gap,
    justifyContent: "center",
  };
  // El teclado se ocupa de su propio ritmo vertical en vez de dejárselo al
  // contenedor de cada juego: la sombra de presión mide 4 px y se come el
  // hueco entre filas, así que el gap tiene que contarla.
  const rowsStyle: React.CSSProperties = {
    display: "flex",
    flexDirection: "column",
    gap: size === "md" ? "0.55rem" : "0.5rem",
  };

  return (
    <div style={rowsStyle}>
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
          <Key
            label={enterBusy ? "…" : "↵"}
            onTap={() => onKey(KEY_ENTER)}
            wide
            size={size}
            disabled={enterBusy}
          />
        )}
        {KB_ROW3.map((k) => (
          <Key key={k} label={k} mark={marks?.[k]} onTap={() => onKey(k)} size={size} />
        ))}
        <Key label={KEY_BACKSPACE} onTap={() => onKey(KEY_BACKSPACE)} wide size={size} />
      </div>
    </div>
  );
}
