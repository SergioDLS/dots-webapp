"use client";

import { useSyncExternalStore } from "react";

import PalettePreview from "@/components/first-run/palette-preview";
import { Icon } from "@/components/ui/icon";
import { PALETTES, PALETTE_LABELS } from "@/lib/theme-colors";
import type { ThemeMode, ThemePrefs } from "@/lib/theme-prefs";

/**
 * Pantalla 2 del primer inicio (spec §7.2): paleta, modo y sonido, con la
 * elección aplicada en vivo a esta misma pantalla.
 *
 * El modo resuelto se lee del DOM y nunca de `matchMedia` en el render
 * (regla 12): `applyThemePrefs` mantiene `<html class="dark">` al día, así que
 * mirar esa clase basta y no rompe la hidratación. Mismo patrón que la hoja de
 * ajustes.
 */
const MODOS: { key: ThemeMode; label: string }[] = [
  { key: "light", label: "Claro" },
  { key: "dark", label: "Oscuro" },
  { key: "auto", label: "Auto" },
];

function sinSuscripcion(): () => void {
  return () => {};
}

function modoDelDom(): "light" | "dark" {
  return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

function modoDelServidor(): "light" | "dark" {
  return "light";
}

interface Props {
  prefs: ThemePrefs;
  sound: boolean;
  onPrefs: (prefs: ThemePrefs) => void;
  onSound: (on: boolean) => void;
  onNext: () => void;
}

export default function WelcomeTheme({ prefs, sound, onPrefs, onSound, onNext }: Props) {
  const resuelto = useSyncExternalStore(sinSuscripcion, modoDelDom, modoDelServidor);

  return (
    <div className="flex w-full flex-col items-center gap-5 text-center">
      <div className="flex flex-col gap-1.5">
        <h1 className="font-display text-2xl font-extrabold text-foreground">¿Cómo lo quieres ver?</h1>
        <p className="text-sm font-semibold text-(--muted)">Doty siempre es rosa. Lo demás, tú decides.</p>
      </div>

      {/* Paletas, con su vista previa */}
      <ul className="grid w-full grid-cols-2 gap-3">
        {PALETTES.map((p) => {
          const on = prefs.palette === p;
          return (
            <li key={p}>
              <button
                type="button"
                onClick={() => onPrefs({ ...prefs, palette: p })}
                aria-pressed={on}
                className="flex w-full flex-col gap-2 rounded-2xl p-2 transition-transform duration-150 active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--accent)"
                style={{
                  background: on ? "color-mix(in srgb, var(--accent) 10%, transparent)" : "var(--surface-2)",
                  border: on ? "2px solid var(--accent)" : "2px solid transparent",
                }}
              >
                <PalettePreview palette={p} mode={resuelto} />
                <span
                  className="flex items-center justify-center gap-1 text-xs font-extrabold"
                  style={{ color: on ? "var(--accent)" : "var(--foreground)" }}
                >
                  {PALETTE_LABELS[p]}
                  <span className="h-4 w-4">{on && <Icon name="check" size={16} mono />}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      {/* Modo */}
      <div className="flex w-full rounded-2xl p-1" style={{ background: "var(--surface-2)" }}>
        {MODOS.map((m) => {
          const on = prefs.mode === m.key;
          return (
            <button
              key={m.key}
              type="button"
              onClick={() => onPrefs({ ...prefs, mode: m.key })}
              aria-pressed={on}
              className="flex-1 rounded-xl py-2 text-sm font-extrabold transition-transform duration-150 active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--accent)"
              style={{
                background: on ? "var(--accent)" : "transparent",
                color: on ? "var(--accent-contrast)" : "var(--muted)",
              }}
            >
              {m.label}
            </button>
          );
        })}
      </div>

      {/* Sonido */}
      <button
        type="button"
        onClick={() => onSound(!sound)}
        aria-pressed={sound}
        className="flex w-full items-center justify-between rounded-2xl px-4 py-3 text-left transition-transform duration-150 active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--accent)"
        style={{ background: "var(--surface-2)" }}
      >
        <span className="flex flex-col">
          <span className="text-sm font-extrabold text-foreground">Sonidos</span>
          <span className="text-xs font-semibold text-(--muted)">Aciertos, fallos y celebraciones</span>
        </span>
        <span
          className="flex h-7 w-12 shrink-0 items-center rounded-full p-1 transition-colors"
          style={{ background: sound ? "var(--accent)" : "var(--border)" }}
        >
          <span
            className="h-5 w-5 rounded-full transition-transform duration-150"
            style={{ background: "var(--surface)", transform: sound ? "translateX(20px)" : "translateX(0)" }}
          />
        </span>
      </button>

      <button
        type="button"
        onClick={onNext}
        className="dots-pressable w-full max-w-xs rounded-2xl px-6 py-3.5 text-base font-black transition-transform duration-150 active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--accent)"
        style={{ background: "var(--accent)", color: "var(--accent-contrast)" }}
      >
        Este me gusta
      </button>
    </div>
  );
}
