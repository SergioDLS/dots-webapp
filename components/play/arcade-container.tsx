"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import Doty from "@/components/ui/doty/doty";
import UIButton from "@/components/ui/button/button";
import { DAILY_PATHS, type DailyState } from "@/lib/arcade";
import {
  getCrosswordService,
  getGamesService,
  getWordleService,
  type Game,
} from "@/services/games.service";
import { getTournamentService } from "@/services/tournament.service";
import ArcadeGrid from "./arcade-grid";
import ArcadeSkeleton from "./arcade-skeleton";

/** Lo que adorna la rejilla pero nunca la bloquea: badges y estado de hoy. */
interface Extras {
  tournamentPath: string | null;
  dailyStates: Record<string, DailyState | null>;
}

const NO_EXTRAS: Extras = {
  tournamentPath: null,
  dailyStates: { [DAILY_PATHS[0]]: null, [DAILY_PATHS[1]]: null },
};

export default function ArcadeContainer() {
  const router = useRouter();
  const [games, setGames] = useState<Game[] | null>(null);
  const [extras, setExtras] = useState<Extras>(NO_EXTRAS);
  const [loadError, setLoadError] = useState(false);
  // Patrón fetchAttempt (regla 3): el botón sube el contador, el efecto solo fetchea.
  const [attempt, setAttempt] = useState(0);

  // La lista es lo único obligatorio: sin ella no hay pantalla.
  useEffect(() => {
    let active = true;
    getGamesService()
      .then((data) => {
        if (active) setGames(data);
      })
      .catch(() => {
        if (active) setLoadError(true);
      });
    return () => {
      active = false;
    };
  }, [attempt]);

  // Badges y estado de hoy: decoran la rejilla y no deben retrasarla ni
  // romperla. Cada fuente cae a su valor neutro por separado; el catch final
  // es la red de seguridad del Promise.all mismo, no depende de que cada
  // servicio trague su propio error.
  useEffect(() => {
    let active = true;
    Promise.all([
      getTournamentService(),
      getWordleService().catch(() => null),
      getCrosswordService().catch(() => null),
    ])
      .then(([tournament, wordle, crossword]) => {
        if (!active) return;
        setExtras({
          tournamentPath: tournament?.gamePath ?? null,
          dailyStates: {
            [DAILY_PATHS[0]]: wordle ? { done: wordle.done, won: wordle.won } : null,
            [DAILY_PATHS[1]]: crossword ? { done: crossword.done, won: crossword.won } : null,
          },
        });
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [attempt]);

  const retry = () => {
    setLoadError(false);
    setGames(null);
    setExtras(NO_EXTRAS);
    setAttempt((n) => n + 1);
  };

  // Regla 1: router.push. La grilla vieja navegaba recargando la página
  // entera (excepción legacy ya retirada), lo que tiraba el token en memoria.
  const open = (path: string) => router.push(`/games${path}`);

  if (loadError) {
    return (
      <div className="dots-card flex flex-col items-center gap-4 px-6 py-10 text-center">
        <Doty pose="decepcionado" size="tiny" />
        <p className="font-display text-base font-extrabold text-foreground">
          No pudimos cargar los juegos
        </p>
        <p className="max-w-xs text-sm font-semibold text-(--muted)">
          Revisa tu conexión y vuelve a intentarlo.
        </p>
        <UIButton onClick={retry}>Reintentar</UIButton>
      </div>
    );
  }

  if (games === null) return <ArcadeSkeleton />;

  if (games.length === 0) {
    return (
      <div className="dots-card flex flex-col items-center gap-3 px-6 py-10 text-center">
        <Doty pose="timido" size="tiny" />
        <p className="text-sm font-semibold text-(--muted)">Pronto habrá juegos aquí.</p>
      </div>
    );
  }

  return (
    <ArcadeGrid
      games={games}
      tournamentPath={extras.tournamentPath}
      dailyStates={extras.dailyStates}
      onOpen={open}
    />
  );
}
