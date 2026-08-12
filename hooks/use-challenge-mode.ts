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
 * así que a diferencia del torneo aquí NO hay rearme: el ref bloquea el
 * doble efecto de StrictMode, los re-renders en "result" y también los
 * "jugar de nuevo" dentro de la misma página.
 *
 * Por eso `completed` es OBLIGATORIO: como el intento se gasta a la primera,
 * enviar una partida abandonada la quema con un score parcial. El hook no
 * puede saber qué significa "completa" en cada juego (agotar el mazo, el
 * tiempo, las vidas…), así que obliga a quien llama a declararlo — un juego
 * nuevo no puede olvidarse por omisión. Ese olvido ya costó el bug en cinco
 * juegos (sentence-builder, audio-blitz, true-false, word-tower, dot-match).
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
    (score: number, { completed }: { completed: boolean }) => {
      if (challengeId === null || submittedRef.current) return;
      // Partida abandonada: no se gasta el intento del reto
      if (!completed) return;
      submittedRef.current = true;
      // fire-and-forget: el reto nunca bloquea la UI del juego
      postChallengeScoreService(challengeId, score).catch(() => {});
    },
    [challengeId],
  );

  return { challengeId, submitChallengeScore };
}
