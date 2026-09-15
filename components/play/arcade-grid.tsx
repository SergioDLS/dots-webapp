"use client";

import { badgesFor, splitGames, type BadgeContext, type DailyState } from "@/lib/arcade";
import type { Game } from "@/services/games.service";
import DailyHero from "./daily-hero";
import GameTile from "./game-tile";
import LockedTile from "./locked-tile";

/**
 * Vista pura del arcade: recibe todo cargado y lo reparte en los tres bloques
 * (héroes de hoy / arcade / por desbloquear). Sin fetch y sin router, para que
 * se pueda renderizar con datos de prueba.
 */

/**
  * Tres por fila en móvil, cinco en md y seis en lg (spec §4). Se exporta
  * porque el esqueleto de carga usa ESTA misma cadena: si cada uno tuviera la
  * suya, cambiar una columna aquí haría saltar la pantalla al cargar.
  */
export const ARCADE_GRID_CLASS = "grid grid-cols-3 gap-3 md:grid-cols-5 md:gap-4 lg:grid-cols-6";

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-xs font-bold uppercase tracking-widest text-(--muted)">{children}</h2>
  );
}

interface Props {
  games: Game[];
  badgeContext: BadgeContext;
  /** Estado del puzzle de hoy por ruta ("/wordle" → {done, won}); null si aún no llega. */
  dailyStates: Record<string, DailyState | null>;
  onOpen: (path: string) => void;
}

export default function ArcadeGrid({ games, badgeContext, dailyStates, onOpen }: Props) {
  const { daily, arcade, locked } = splitGames(games);

  return (
    <div className="flex flex-col gap-6">
      {daily.length > 0 && (
        <ul className="grid grid-cols-2 gap-3">
          {daily.map((game) => (
            <li key={game.id}>
              <DailyHero
                game={game}
                state={dailyStates[game.path] ?? null}
                onOpen={onOpen}
              />
            </li>
          ))}
        </ul>
      )}

      {arcade.length > 0 && (
        <section className="flex flex-col gap-3">
          <Eyebrow>Arcade</Eyebrow>
          <ul className={ARCADE_GRID_CLASS}>
            {arcade.map((game) => (
              <li key={game.id}>
                <GameTile game={game} badges={badgesFor(game.path, badgeContext)} onOpen={onOpen} />
              </li>
            ))}
          </ul>
        </section>
      )}

      {locked.length > 0 && (
        <section className="flex flex-col gap-3">
          <Eyebrow>Por desbloquear</Eyebrow>
          <ul className={ARCADE_GRID_CLASS}>
            {locked.map((game) => (
              <li key={game.id}>
                <LockedTile game={game} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
