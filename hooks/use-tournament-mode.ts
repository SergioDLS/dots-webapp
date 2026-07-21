"use client";
import { useSearchParams } from "next/navigation";
import { useRef, useCallback } from "react";
import { postTournamentScoreService } from "@/services/tournament.service";

/**
 * Modo torneo de las páginas de juego: activo cuando la URL trae
 * `?tournament=1` (la card de /quests navega así, junto con `seed`).
 *
 * `submitTournamentScore` envía el score UNA vez por partida — el ref
 * bloquea el doble efecto de StrictMode y los re-renders dentro de
 * "result". `resetTournamentSubmit` rearma el guard al salir de la
 * pantalla de resultado para que un "jugar de nuevo" también cuente.
 *
 * Lee useSearchParams: úsalo dentro del árbol <Suspense> de la página.
 */
export function useTournamentMode() {
  const searchParams = useSearchParams();
  const isTournament = searchParams.get("tournament") === "1";
  const submittedRef = useRef(false);

  const submitTournamentScore = useCallback(
    (score: number) => {
      if (!isTournament || submittedRef.current) return;
      submittedRef.current = true;
      // fire-and-forget: el torneo nunca bloquea la UI del juego
      postTournamentScoreService(score).catch(() => {});
    },
    [isTournament],
  );

  const resetTournamentSubmit = useCallback(() => {
    submittedRef.current = false;
  }, []);

  return { isTournament, submitTournamentScore, resetTournamentSubmit };
}
