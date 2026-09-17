"use client";

import { PALETTE_ACCENTS, THEME_COLORS, type Palette } from "@/lib/theme-colors";

/**
 * Vista previa real de una paleta (spec §7.2): un trozo de HUD y un nodo del
 * Camino pintados con los colores de esa paleta y ese modo.
 *
 * Los colores llegan como DATO y no por CSS heredado a propósito: los bloques
 * de app/themes.generated.css usan `:root[data-palette]`, que solo casa con
 * <html>, así que un envoltorio anidado no heredaría nada. El generador emite
 * THEME_COLORS (el --background) y PALETTE_ACCENTS (el --accent) justo para
 * estos casos; el resto de superficies sale de mezclar esos dos.
 */
interface Props {
  palette: Palette;
  /** Modo YA resuelto: "auto" no llega hasta aquí. */
  mode: "light" | "dark";
}

export default function PalettePreview({ palette, mode }: Props) {
  const fondo = THEME_COLORS[palette][mode];
  const acento = PALETTE_ACCENTS[palette][mode];
  const superficie = `color-mix(in srgb, ${acento} 8%, ${fondo})`;
  const borde = `color-mix(in srgb, ${acento} 22%, ${fondo})`;

  return (
    <span
      aria-hidden
      className="flex h-20 w-full flex-col justify-between overflow-hidden rounded-xl p-2"
      style={{ background: fondo, border: `1.5px solid ${borde}` }}
    >
      {/* HUD: barra de progreso y dos pastillas */}
      <span className="flex items-center gap-1.5">
        <span className="h-1.5 flex-1 rounded-full" style={{ background: borde }}>
          <span className="block h-full w-2/3 rounded-full" style={{ background: acento }} />
        </span>
        <span className="h-2.5 w-2.5 rounded-full" style={{ background: acento }} />
      </span>
      {/* Nodo del Camino: círculo lleno y su sombra dura */}
      <span className="flex items-end justify-center gap-2">
        <span
          className="h-7 w-7 rounded-full"
          style={{ background: acento, boxShadow: `0 3px 0 ${borde}` }}
        />
        <span className="mb-1 h-4 w-10 rounded-md" style={{ background: superficie, border: `1.5px solid ${borde}` }} />
      </span>
    </span>
  );
}
