// GENERADO por scripts/themes/build.mjs a partir de design/themes.json — no editar a mano.
// Colores que hace falta conocer FUERA de CSS: el manifest de la PWA y la
// <meta name="theme-color"> que pintan el script anti-flash (app/layout.tsx)
// y lib/theme-prefs.ts. Es el --background de cada paleta y modo.
export const PALETTES = ["rosa", "electrico"] as const;
export type Palette = (typeof PALETTES)[number];
export type ThemeMode = "light" | "dark";
export const PALETTE_LABELS: Record<Palette, string> = { rosa: "Rosa", electrico: "Eléctrico" };
export const THEME_COLORS: Record<Palette, Record<ThemeMode, string>> = {
  rosa: { light: "#fff7fb", dark: "#14122e" },
  electrico: { light: "#f4f7ff", dark: "#0d1330" },
};
