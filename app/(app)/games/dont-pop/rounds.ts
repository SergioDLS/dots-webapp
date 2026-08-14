// app/(app)/games/dont-pop/rounds.ts
// Reglas puras de Don't Pop: cómo se arma una ronda y cuánto paga un acierto.
// Sin React ni DOM — portable a RN tal cual.

import type { GameWord } from "@/services/games.service";

export type Rng = () => number; // [0,1)

/** Opciones por ronda. Eran 2: adivinar acertaba el 50 % de las veces. */
export const OPTIONS_PER_ROUND = 3;

const SCORE_BASE = 100;
const CALM_BONUS_MAX = 60;

/**
 * Puntos de un acierto: base + bonus por responder con el globo tranquilo.
 * La presión sube sola con el tiempo, así que premiar la calma es premiar la
 * rapidez. Fallar no resta — ya cuesta +30 de presión.
 */
export function roundScore(pressure: number): number {
  const calm = 1 - Math.min(100, Math.max(0, pressure)) / 100;
  return SCORE_BASE + Math.round(CALM_BONUS_MAX * calm);
}

/** Fisher-Yates con rng inyectado; copia, no muta. */
function shuffleWith<T>(arr: readonly T[], rng: Rng): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/**
 * Arma la siguiente ronda entre las palabras que quedan por responder.
 * Los distractores salen de OTRAS palabras **no respondidas**: si vinieran de
 * las ya contestadas, el jugador las descartaría por eliminación. Con mazo
 * corto devuelve menos de OPTIONS_PER_ROUND opciones antes que repetir una.
 * Devuelve null cuando no queda ninguna palabra jugable.
 */
export function buildRound(
  words: readonly GameWord[],
  answeredIds: ReadonlySet<number>,
  rng: Rng,
): { word: GameWord; options: string[] } | null {
  const pending = words.filter((w) => !answeredIds.has(w.id) && w.title);
  if (pending.length === 0) return null;

  const word = shuffleWith(pending, rng)[0];

  const taken = new Set([word.title.toLowerCase()]);
  const options: string[] = [word.title];
  for (const w of shuffleWith(pending, rng)) {
    if (options.length >= OPTIONS_PER_ROUND) break;
    const key = w.title.toLowerCase();
    if (taken.has(key)) continue;
    taken.add(key);
    options.push(w.title);
  }

  return { word, options: shuffleWith(options, rng) };
}
