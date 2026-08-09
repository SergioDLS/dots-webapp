"use client";

import { useEffect, useState } from "react";

import Doty from "@/components/ui/doty/doty";
import UIButton from "@/components/ui/button/button";
import GamesGridView from "@/components/play/games-grid-view";
import { getGamesService, type Game } from "@/services/games.service";

/** Cuadros grises con la misma silueta que el arcade, para no saltar al cargar. */
function Skeleton() {
  return (
    <div className="flex flex-col gap-6" aria-hidden>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {[0, 1].map((i) => (
          <div
            key={i}
            className="h-[76px] animate-pulse rounded-2xl border-2 border-(--border) bg-(--surface-2) sm:h-[88px]"
          />
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-3 lg:grid-cols-4">
        {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
          <div
            key={i}
            className="h-[104px] animate-pulse rounded-2xl border-2 border-(--border) bg-(--surface-2) sm:h-[116px]"
          />
        ))}
      </div>
    </div>
  );
}

export default function GamesGrid() {
  const [games, setGames] = useState<Game[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  // Patrón fetchAttempt: el botón sube el contador, el efecto solo fetchea.
  const [attempt, setAttempt] = useState(0);

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

  const retry = () => {
    setLoadError(false);
    setGames(null);
    setAttempt((n) => n + 1);
  };

  if (loadError) {
    return (
      <div className="dots-card flex flex-col items-center gap-4 px-6 py-10 text-center">
        <Doty pose="09" size="tiny" />
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

  if (games === null) return <Skeleton />;

  if (games.length === 0) {
    return (
      <div className="dots-card flex flex-col items-center gap-3 px-6 py-10 text-center">
        <Doty pose="01" size="tiny" />
        <p className="text-sm font-semibold text-(--muted)">
          Pronto habrá juegos aquí.
        </p>
      </div>
    );
  }

  return <GamesGridView games={games} />;
}
