"use client";
import { useSearchParams } from "next/navigation";

/**
 * Seed del mazo, leído de `?seed=` — pero **solo se honra en modo competitivo**
 * (`?tournament=1` o `?challenge=<id>`).
 *
 * El seed existe para que dos rivales reciban exactamente el mismo mazo. Fuera
 * de ahí es un agujero: cualquiera podía fijar un seed a mano, memorizar las
 * preguntas y repetirlo para inflar su récord y robar el trono. Ignorarlo en
 * juego libre cierra el farmeo sin tocar torneo ni retos, que son los únicos
 * que necesitan determinismo.
 *
 * Devuelve `undefined` también si el valor no es un número finito, así que un
 * `?seed=abc` deja de propagar `NaN` a los fetchers.
 *
 * Lee useSearchParams: úsalo dentro del árbol <Suspense> de la página.
 */
export function useGameSeed(): number | undefined {
  const searchParams = useSearchParams();

  const raw = searchParams.get("seed");
  const parsed = raw !== null && raw !== "" ? parseInt(raw, 10) : NaN;
  if (!Number.isFinite(parsed)) return undefined;

  const isTournament = searchParams.get("tournament") === "1";
  const rawChallenge = searchParams.get("challenge");
  const challengeId = rawChallenge === null ? NaN : Number(rawChallenge);
  const isChallenge = Number.isInteger(challengeId) && challengeId > 0;

  return isTournament || isChallenge ? parsed : undefined;
}
