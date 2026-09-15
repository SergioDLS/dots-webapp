"use client";

import Image from "next/image";

import { Icon } from "@/components/ui/icon";
import { dailyStatus, type DailyState } from "@/lib/arcade";
import type { Game } from "@/services/games.service";
import { gameArt } from "./game-tile";

/**
 * Héroe de un juego diario (spec §4): arte más grande, eyebrow "Nuevo cada
 * día" y el estado del puzzle de hoy. Sin panel: igual que los tiles, flota.
 */
export const HERO_ART = 96;
export const HERO_ART_BOX = 108;
export const HERO_EYEBROW_H = 14;
export const HERO_NAME_H = 22;
export const HERO_STATUS_H = 16;
/** `gap-1.5` son 6 px en los TRES huecos, no 6/2/2: el alto se calcula, no se teclea. */
const HERO_GAP = 6;
export const HERO_H =
  HERO_ART_BOX + HERO_EYEBROW_H + HERO_NAME_H + HERO_STATUS_H + HERO_GAP * 3;

interface Props {
  game: Game;
  /** null mientras el estado de hoy no ha llegado (o no se pudo pedir). */
  state: DailyState | null;
  onOpen: (path: string) => void;
}

export default function DailyHero({ game, state, onOpen }: Props) {
  const status = dailyStatus(state);
  return (
    <button
      type="button"
      onClick={() => onOpen(game.path)}
      className="flex w-full flex-col items-center gap-1.5 rounded-2xl transition-transform duration-150 active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-(--accent)"
      style={{ height: HERO_H }}
    >
      <span className="flex items-center justify-center" style={{ height: HERO_ART_BOX }}>
        <Image
          src={gameArt(game.path)}
          alt=""
          aria-hidden
          width={512}
          height={512}
          sizes={`${HERO_ART}px`}
          className="dots-floor-shadow h-auto select-none object-contain"
          style={{ width: HERO_ART }}
          priority
          draggable={false}
        />
      </span>
      <span
        className="text-[11px] font-black uppercase tracking-widest text-(--accent)"
        style={{ lineHeight: `${HERO_EYEBROW_H}px` }}
      >
        Nuevo cada día
      </span>
      <span
        className="line-clamp-1 px-1 text-center font-display text-base font-extrabold text-foreground"
        style={{ lineHeight: `${HERO_NAME_H}px` }}
      >
        {game.name}
      </span>
      {/* El alto se reserva SIEMPRE, con estado o sin él: si la línea apareciera
          al llegar el fetch, la rejilla de abajo daría un salto. */}
      <span
        className="flex items-center justify-center gap-1 text-[11.5px] font-bold"
        style={{ height: HERO_STATUS_H, color: status?.check ? "var(--success)" : "var(--muted)" }}
      >
        {status !== null && (
          <>
            {status.check && <Icon name="check" size={13} mono />}
            {status.label}
          </>
        )}
      </span>
    </button>
  );
}
