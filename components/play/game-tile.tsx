"use client";

import Image from "next/image";

import { UiIcon } from "@/components/ui/ui-icon";
import type { TileBadges } from "@/lib/arcade";
import type { Game } from "@/services/games.service";

/**
 * Tile flotante de un juego desbloqueado (spec §4, variante B): el arte del
 * juego sobre el fondo con sombra de piso, sin mancha de color, sin borde y
 * sin caja; el nombre debajo. Las constantes se exportan para que el
 * esqueleto de carga calque esta retícula en vez de aproximarla.
 */
export const TILE_ART = 82;
export const TILE_ART_BOX = 96;
export const TILE_LABEL_H = 32;
export const TILE_H = TILE_ART_BOX + 6 + TILE_LABEL_H;
export const BADGE = 28;

/** El arte de cada juego, por su ruta: /images/games/dot-match.png */
export function gameArt(path: string): string {
  return `/images/games/${path.startsWith("/") ? path.slice(1) : path}.png`;
}

interface Props {
  game: Game;
  badges: TileBadges;
  onOpen: (path: string) => void;
}

export default function GameTile({ game, badges, onOpen }: Props) {
  return (
    <button
      type="button"
      onClick={() => onOpen(game.path)}
      // active:scale en vez de .dots-pressable: ese canto 3-D necesita una caja
      // y aquí no hay ninguna (principio 4). Solo transform: RN-safe.
      className="flex w-full flex-col items-center gap-1.5 rounded-2xl transition-transform duration-150 active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-(--accent)"
      style={{ height: TILE_H }}
    >
      <span className="relative flex items-center justify-center" style={{ height: TILE_ART_BOX, width: TILE_ART_BOX }}>
        <Image
          src={gameArt(game.path)}
          alt=""
          aria-hidden
          width={512}
          height={512}
          sizes={`${TILE_ART}px`}
          className="dots-floor-shadow h-auto select-none object-contain"
          style={{ width: TILE_ART }}
          draggable={false}
        />
        {badges.tournament && (
          <span className="absolute flex items-center gap-0.5" style={{ top: 0, right: 0 }}>
            <UiIcon name="trofeo" size={BADGE} />
          </span>
        )}
      </span>
      {/* leading-4 (16 px) × 2 líneas = TILE_LABEL_H exacto: sin esto la fila
          de abajo se mueve cuando un nombre ocupa dos líneas y otro una. */}
      <span
        className="line-clamp-2 px-0.5 text-center font-display text-[12.5px] font-extrabold leading-4 text-foreground"
        style={{ height: TILE_LABEL_H }}
      >
        {game.name}
      </span>
    </button>
  );
}
