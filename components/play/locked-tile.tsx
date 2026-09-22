"use client";

import Image from "next/image";

import { Icon } from "@/components/ui/icon";
import { gameArt, lockedLabel } from "@/lib/arcade";
import type { Game } from "@/services/games.service";
import { TILE_ART, TILE_ART_BOX, TILE_H, TILE_LABEL_H } from "./game-tile";

/**
 * Juego aún cerrado (spec §4): el mismo arte en gris al 35 %, candado encima y
 * cuánto falta. No es un botón: no se puede abrir, así que no finge que sí.
 */
export default function LockedTile({ game }: { game: Game }) {
  return (
    <div className="flex w-full flex-col items-center gap-1.5" style={{ height: TILE_H }}>
      <span className="relative flex items-center justify-center" style={{ height: TILE_ART_BOX, width: TILE_ART_BOX }}>
        <Image
          src={gameArt(game.path)}
          alt=""
          aria-hidden
          width={512}
          height={512}
          sizes={`${TILE_ART}px`}
          className="h-auto select-none object-contain"
          // filter estático, no animado: RN-safe (regla 2).
          style={{ width: TILE_ART, filter: "grayscale(1)", opacity: 0.35 }}
          draggable={false}
        />
        <span className="absolute text-(--muted)">
          <Icon name="candado" size={22} mono />
        </span>
      </span>
      <span
        className="flex flex-col items-center text-center leading-4"
        style={{ height: TILE_LABEL_H }}
      >
        <span className="line-clamp-1 px-0.5 text-[12.5px] font-bold text-(--muted)">
          {game.name}
        </span>
        <span className="text-[11px] font-bold text-(--muted) opacity-75">
          {lockedLabel(game.levelsLeft)}
        </span>
      </span>
    </div>
  );
}
