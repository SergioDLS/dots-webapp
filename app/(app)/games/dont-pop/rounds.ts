// app/(app)/games/dont-pop/rounds.ts
// Reglas puras de Don't Pop: cómo se arma una ronda y cuánto paga un acierto.
// Sin React ni DOM — portable a RN tal cual.

import type { GameWord } from "@/services/games.service";
// Ruta relativa y con extensión, como los imports de valor entre archivos de
// lib/: así `node --test` carga este archivo tal cual (el alias `@/` no existe
// fuera del bundler) y lib/dont-pop-rounds.test.mjs puede probarlo.
import { sinAceptadas } from "../../../../lib/accepted-answers.ts";

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
 *
 * Las palabras que el admin aceptó para esta imagen (`word.accepted`, spec
 * reportes §4) tampoco salen de señuelo: reventar un globo que también valía
 * sería injusto. Se descartan DESPUÉS de barajar, nunca antes: así el rng gasta
 * exactamente lo mismo con o sin alternativas y el mazo sembrado (torneo, reto)
 * solo cambia en el señuelo que se sustituye.
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
  const candidatos = sinAceptadas(
    shuffleWith(pending, rng).map((w) => w.title),
    word.accepted,
  );
  for (const title of candidatos) {
    if (options.length >= OPTIONS_PER_ROUND) break;
    const key = title.toLowerCase();
    if (taken.has(key)) continue;
    taken.add(key);
    options.push(title);
  }

  return { word, options: shuffleWith(options, rng) };
}
