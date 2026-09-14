/**
 * Level/difficulty color palette.
 *
 * The same 9-color palette lives in dots-app/lib/theme.ts as
 * DIFFICULTY_PALETTE — keep both in sync.
 */

/** Color names in canonical rotation order. */
export const DIFFICULTY_COLOR_NAMES = [
  "pink",
  "orangered",
  "blue",
  "pale_blue",
  "opal",
  "orange",
  "pale_green",
  "yellow",
  "green",
] as const;

export type DifficultyColorName = (typeof DIFFICULTY_COLOR_NAMES)[number];

/** Hex value for each palette color name. */
export const DIFFICULTY_COLOR_HEX: Record<string, string> = {
  pink: "#F472B6",
  orangered: "#F97316",
  blue: "#1D4ED8",
  pale_blue: "#7DD3FC",
  opal: "#5EEAD4",
  orange: "#FBBF24",
  pale_green: "#BEF264",
  yellow: "#FACC15",
  green: "#34D399",
};

/**
 * Color de icono/texto legible sobre cada acento pintado como fondo SÓLIDO
 * (el badge de tipo de nodo en `components/path/path-node.tsx`, un
 * `<Icon mono>` sobre `accentHex` liso). No es un blanco fijo: la mayoría de
 * estos acentos son pasteles claros, y ahí el navy contrasta mucho mejor que
 * el blanco — WCAG 2.1, navy sobre `pale_green` da 11.76:1, blanco da
 * 1.31:1. Solo `blue`, el único acento oscuro del set, se lee mejor en
 * blanco (6.70:1 contra 2.29:1 de navy). Keyed por el hex de
 * `DIFFICULTY_COLOR_HEX` y no por nombre, porque `accentHex` ya llega a sus
 * consumidores resuelto a hex, sin el nombre de color.
 *
 * Es una decisión de presentación de este repo (el badge con icono
 * monocromo), no parte de la paleta compartida del comentario de arriba:
 * no hace falta portarla a `dots-app/lib/theme.ts`.
 */
export const DIFFICULTY_TEXT_ON_HEX: Record<string, string> = {
  "#F472B6": "#1E1B5C", // pink
  "#F97316": "#1E1B5C", // orangered
  "#1D4ED8": "#ffffff", // blue — el único acento oscuro del set
  "#7DD3FC": "#1E1B5C", // pale_blue
  "#5EEAD4": "#1E1B5C", // opal
  "#FBBF24": "#1E1B5C", // orange
  "#BEF264": "#1E1B5C", // pale_green
  "#FACC15": "#1E1B5C", // yellow
  "#34D399": "#1E1B5C", // green
};
