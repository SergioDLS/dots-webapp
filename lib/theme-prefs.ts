"use client";

import { PALETTES, THEME_COLORS, type Palette } from "@/lib/theme-colors";

export type ThemeMode = "light" | "dark" | "auto";
export type ThemePrefs = { palette: Palette; mode: ThemeMode };

/** Claves del espejo local. El servidor (/me/settings) es la fuente de verdad;
 *  esto solo evita el parpadeo del primer paint (lo lee el script inline de
 *  app/layout.tsx con los mismos defaults). */
export const PALETTE_KEY = "dots-palette";
export const MODE_KEY = "dots-theme";
export const DEFAULT_PREFS: ThemePrefs = { palette: "rosa", mode: "auto" };

const isPalette = (v: unknown): v is Palette =>
  typeof v === "string" && (PALETTES as readonly string[]).includes(v);
const isMode = (v: unknown): v is ThemeMode =>
  v === "light" || v === "dark" || v === "auto";

export function readMirror(): ThemePrefs {
  if (typeof window === "undefined") return DEFAULT_PREFS;
  try {
    const p = window.localStorage.getItem(PALETTE_KEY);
    const m = window.localStorage.getItem(MODE_KEY);
    return {
      palette: isPalette(p) ? p : DEFAULT_PREFS.palette,
      mode: isMode(m) ? m : DEFAULT_PREFS.mode,
    };
  } catch {
    return DEFAULT_PREFS;
  }
}

export function writeMirror(prefs: ThemePrefs): void {
  try {
    window.localStorage.setItem(PALETTE_KEY, prefs.palette);
    window.localStorage.setItem(MODE_KEY, prefs.mode);
  } catch {
    /* modo privado o storage lleno: el servidor sigue teniendo la verdad */
  }
}

export function resolveMode(mode: ThemeMode): "light" | "dark" {
  if (mode !== "auto") return mode;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

/** Aplica paleta y modo al documento. Debe hacer exactamente lo mismo que el
 *  script anti-parpadeo de app/layout.tsx: si cambias uno, cambia el otro. */
export function applyThemePrefs(prefs: ThemePrefs): void {
  const root = document.documentElement;
  root.setAttribute("data-palette", prefs.palette);
  if (prefs.mode === "auto") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", prefs.mode);
  const resolved = resolveMode(prefs.mode);
  root.classList.toggle("dark", resolved === "dark");
  root.style.colorScheme = resolved;
  document.querySelectorAll('meta[name="theme-color"]').forEach((el) => el.remove());
  const meta = document.createElement("meta");
  meta.setAttribute("name", "theme-color");
  meta.setAttribute("content", THEME_COLORS[prefs.palette][resolved]);
  document.head.appendChild(meta);
}
