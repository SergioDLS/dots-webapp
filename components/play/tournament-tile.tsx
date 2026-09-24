"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

import { UiIcon } from "@/components/ui/ui-icon";
import { formatCountdown, gameArt } from "@/lib/arcade";
import type { Game } from "@/services/games.service";
import { TILE_H } from "./game-tile";

/**
 * El juego del torneo de la semana, al frente de la grilla y sobre dos
 * columnas: arte mayor, trofeo y lo que falta para que cierre. El alto es el
 * MISMO de un tile normal (TILE_H) a propósito — si creciera, la primera fila
 * entera crecería con él y los vecinos quedarían flotando en el hueco.
 *
 * Al tocarlo entra en modo torneo (`?tournament=1&seed=`), igual que la
 * tarjeta de /quests: mismo mazo para todos y el score cuenta en la tabla.
 */
export const TOURNAMENT_ART = 96;

export default function TournamentTile({
  game,
  endsAt,
  onOpen,
}: {
  game: Game;
  /** Cierre del torneo en ISO; del `GET /tournament`. */
  endsAt: string;
  onOpen: () => void;
}) {
  // El texto del countdown se deriva en render; este tick solo fuerza el
  // re-render cada minuto (sin setState síncrono en el cuerpo del efecto).
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 60_000);
    return () => clearInterval(id);
  }, []);

  return (
    <button
      type="button"
      onClick={onOpen}
      data-tip="arcade.torneo"
      className="flex w-full items-center gap-1.5 rounded-3xl pr-2 text-left transition-transform duration-150 active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-(--accent)"
      style={{
        height: TILE_H,
        background: "color-mix(in srgb, var(--accent) 8%, transparent)",
      }}
    >
      <span
        className="flex shrink-0 items-center justify-center"
        style={{ height: TILE_H, width: TOURNAMENT_ART + 4 }}
      >
        <Image
          src={gameArt(game.path)}
          alt=""
          aria-hidden
          width={512}
          height={512}
          sizes={`${TOURNAMENT_ART}px`}
          // max-height ademas del ancho: los artes apaisados (la tira de
          // cartas de memory) se quedarian enanos si solo se fijara el ancho.
          className="dots-floor-shadow select-none object-contain"
          style={{ width: "auto", height: "auto", maxWidth: TOURNAMENT_ART, maxHeight: TOURNAMENT_ART }}
          draggable={false}
        />
      </span>

      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-(--accent)">
          <UiIcon name="trofeo" size={16} />
          Torneo
        </span>
        <span className="line-clamp-2 font-display text-[13.5px] font-extrabold leading-4 text-foreground">
          {game.name}
        </span>
        <span className="text-[11px] font-bold text-(--muted)">
          termina en {formatCountdown(endsAt)}
        </span>
        {/* El pase dura lo que el torneo: decirlo aquí evita que el lunes
            parezca que le quitaron un juego que ya era suyo. */}
        {game.tournamentPass && (
          <span className="whitespace-nowrap text-[10.5px] font-bold text-(--accent)">
            solo hasta el lunes
          </span>
        )}
      </span>
    </button>
  );
}
