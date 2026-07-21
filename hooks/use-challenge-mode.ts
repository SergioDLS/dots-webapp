"use client";
import { useSearchParams } from "next/navigation";
import { useRef, useCallback } from "react";
import { postChallengeScoreService } from "@/services/challenges.service";

/**
 * Modo reto 1v1 de las páginas de juego: activo cuando la URL trae
 * `?challenge=<id>` (el panel de retos y el botón ⚔️ navegan así, junto
 * con `seed` para que ambos jugadores compartan el mismo mazo).
 *
 * `submitChallengeScore` envía el score UNA sola vez — en un reto la
 * PRIMERA partida es la que cuenta (el backend responde 409 a repetidos),
 * así que a diferencia del torneo aquí no hay rearme: el ref bloquea el
 * doble efecto de StrictMode, los re-renders en "result" y también los
 * "jugar de nuevo" dentro de la misma página.
 *
 * Lee useSearchParams: úsalo dentro del árbol <Suspense> de la página.
 */
export function useChallengeMode() {
  const searchParams = useSearchParams();
  const raw = searchParams.get("challenge");
  const parsed = raw === null ? NaN : Number(raw);
  const challengeId = Number.isInteger(parsed) && parsed > 0 ? parsed : null;
  const submittedRef = useRef(false);

  const submitChallengeScore = useCallback(
    (score: number) => {
      if (challengeId === null || submittedRef.current) return;
      submittedRef.current = true;
      // fire-and-forget: el reto nunca bloquea la UI del juego
      postChallengeScoreService(challengeId, score).catch(() => {});
    },
    [challengeId],
  );

  return { challengeId, submitChallengeScore };
}
