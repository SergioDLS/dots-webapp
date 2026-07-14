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
