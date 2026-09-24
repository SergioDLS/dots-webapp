"use client";

import { badgesFor, hoistTournament, splitGames, type DailyState } from "@/lib/arcade";
import type { Game } from "@/services/games.service";
import DailyHero from "./daily-hero";
import GameTile from "./game-tile";
import LockedTile from "./locked-tile";
import TournamentTile from "./tournament-tile";

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

/**
 * Contenedor principal del arcade. El esqueleto de carga usa ESTA misma cadena
 * para que los héroes, eyebrow y primera fila del grid caigan en el mismo píxel.
 */
export const ARCADE_STACK_CLASS = "flex flex-col gap-6";

/**
 * Grid de los héroes diarios (dos columnas). El esqueleto lo reutiliza para
 * alinear sus placeholders con la rejilla real.
 */
export const HERO_ROW_CLASS = "grid grid-cols-2 gap-3";

/**
 * Altura de línea del eyebrow (h2 de títulos de sección). Se exporta porque
 * el esqueleto necesita replicar exactamente este alto en sus placeholders.
 */
export const EYEBROW_H = 16;

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-xs font-bold uppercase tracking-widest text-(--muted)" style={{ lineHeight: `${EYEBROW_H}px` }}>{children}</h2>
  );
}

interface Props {
  games: Game[];
  /** `gamePath` del torneo de la semana — ya viene con barra desde el backend. */
  tournamentPath: string | null;
  /** Cierre del torneo en ISO; null mientras no llega. Sin él no hay destacado. */
  tournamentEndsAt: string | null;
  /** Abre el juego del torneo EN modo torneo (seed + flag). */
  onOpenTournament: () => void;
  /** Estado del puzzle de hoy por ruta ("/wordle" → {done, won}); null si aún no llega. */
  dailyStates: Record<string, DailyState | null>;
  onOpen: (path: string) => void;
}

export default function ArcadeGrid({
  games,
  tournamentPath,
  tournamentEndsAt,
  dailyStates,
  onOpen,
  onOpenTournament,
}: Props) {
  const { daily, arcade, locked } = splitGames(games);
  // Sin `endsAt` el tile no puede contar el cierre, así que el juego se queda
  // en la grilla normal con su trofeo hasta que llegue.
  const { featured, rest } = hoistTournament(
    arcade,
    tournamentEndsAt === null ? null : tournamentPath,
  );

  return (
    <div className={ARCADE_STACK_CLASS}>
      {daily.length > 0 && (
        <ul className={HERO_ROW_CLASS} data-tip="arcade.diarios">
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
            {featured !== null && tournamentEndsAt !== null && (
              <li key={featured.id} className="col-span-2">
                <TournamentTile
                  game={featured}
                  endsAt={tournamentEndsAt}
                  onOpen={onOpenTournament}
                />
              </li>
            )}
            {rest.map((game) => (
              <li key={game.id}>
                <GameTile game={game} badges={badgesFor(game.path, { tournamentPath })} onOpen={onOpen} />
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
