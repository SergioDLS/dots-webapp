"use client";

import Doty, { poseOrFallback } from "@/components/ui/doty/doty";

/**
 * Cabecera de /play (spec §4). La frase es la aprobada en la tabla de voz de
 * `docs/brand/doty-identity.md`: "Arcade · XP sin sufrir.".
 *
 * `gamer` todavía apunta al placeholder del registro generado, así que
 * `poseOrFallback` la cambia por `en-celular` hasta que llegue la tanda 1 de
 * arte. Cuando llegue, esto no se toca: cambia solo.
 */
export default function ArcadeHeader() {
  return (
    <header className="flex items-center justify-between gap-3">
      <div className="flex flex-col gap-1">
        <h1 className="font-display text-3xl font-extrabold text-foreground">Arcade</h1>
        <p className="text-sm font-semibold text-(--muted)">XP sin sufrir.</p>
      </div>
      {/* Visible también en móvil (spec §4): es la cara de la pantalla. */}
      <Doty pose={poseOrFallback("gamer", "en-celular")} size="section" animation="bob" />
    </header>
  );
}
