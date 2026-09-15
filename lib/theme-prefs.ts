"use client";

import { PALETTES, THEME_COLORS, type Palette } from "@/lib/theme-colors";

/** Preferencia del usuario. Distinto del `ThemeMode` de lib/theme-colors.ts
 *  (solo light|dark: el modo YA resuelto); este incluye "auto". */
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

/** Sanea valores que vienen de fuera (storage ajeno, respuesta del servidor):
 *  cualquier campo inválido cae al default. */
export function normalizePrefs(prefs: { palette?: unknown; mode?: unknown } | null | undefined): ThemePrefs {
  return {
    palette: isPalette(prefs?.palette) ? prefs.palette : DEFAULT_PREFS.palette,
    mode: isMode(prefs?.mode) ? prefs.mode : DEFAULT_PREFS.mode,
  };
}

export function readMirror(): ThemePrefs {
  if (typeof window === "undefined") return DEFAULT_PREFS;
  try {
    return normalizePrefs({
      palette: window.localStorage.getItem(PALETTE_KEY) as Palette | null,
      mode: window.localStorage.getItem(MODE_KEY) as ThemeMode | null,
    });
  } catch {
    return DEFAULT_PREFS;
  }
}

/** true si este dispositivo ya guardó alguna preferencia (aunque sea inválida):
 *  ThemeSync solo completa desde el servidor los dispositivos sin espejo. */
export function hasMirror(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return (
      window.localStorage.getItem(PALETTE_KEY) !== null ||
      window.localStorage.getItem(MODE_KEY) !== null
    );
  } catch {
    return false;
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
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

/** Aplica paleta y modo al documento. Produce exactamente el mismo estado del
 *  DOM que el script anti-parpadeo de app/layout.tsx (atributos, clase dark,
 *  colorScheme y una sola <meta name="theme-color">); el script además traga
 *  cualquier error porque corre antes de React. Si cambias uno, cambia el otro. */
export function applyThemePrefs(input: ThemePrefs): void {
  const prefs = normalizePrefs(input);
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
