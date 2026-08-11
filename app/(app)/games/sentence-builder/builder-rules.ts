// app/(app)/games/sentence-builder/builder-rules.ts
// Reglas puras de Constructor: bonus por tiempo y enriquecido del pool de
// fichas. Sin React ni DOM — portable a RN tal cual.

export type Rng = () => number; // [0,1) — inyectable (seed/tests)

/** Bonus máximo por frase, cuando se resuelve al instante. */
export const BONUS_MAX = 60;
/** Ventana en la que el bonus decae de BONUS_MAX a 0. */
export const BONUS_WINDOW_MS = 20000;

/**
 * Bonus de la frase actual: decae linealmente de BONUS_MAX a 0 en
 * BONUS_WINDOW_MS y se congela en 0 (nunca negativo, sin límite de tiempo).
 * Un "Comprobar" fallido lo anula por completo.
 */
export function timeBonus(elapsedMs: number, failed: boolean): number {
  if (failed) return 0;
  const left = 1 - elapsedMs / BONUS_WINDOW_MS;
  return Math.max(0, Math.round(BONUS_MAX * left));
}

/** Señuelos CRUZADOS extra según el tramo de la partida (índice 0-based). */
export function decoyCountFor(sentenceIndex: number): number {
  if (sentenceIndex <= 2) return 0;
  if (sentenceIndex <= 5) return 2;
  return 4;
}

/** Fisher-Yates con rng inyectado; devuelve copia, no muta la entrada. */
function shuffleWith<T>(arr: readonly T[], rng: Rng): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/**
 * Pool de fichas de la frase: las del backend (respuesta + sus distractores)
 * más `extraDecoys` palabras tomadas de OTRAS frases de la partida. Se
 * excluyen las que ya estén en la respuesta (case-insensitive) para no crear
 * ambigüedad, y las repetidas entre sí. Si el cruzado no alcanza, añade las
 * que haya. Todo el orden final se baraja con `rng`.
 */
export function buildPool(
  baseChips: readonly string[],
  answer: readonly string[],
  crossWords: readonly string[],
  extraDecoys: number,
  rng: Rng,
): string[] {
  if (extraDecoys <= 0) return shuffleWith(baseChips, rng);

  const taken = new Set(baseChips.map((w) => w.toLowerCase()));
  for (const w of answer) taken.add(w.toLowerCase());

  const extras: string[] = [];
  for (const w of shuffleWith(crossWords, rng)) {
    if (extras.length >= extraDecoys) break;
    const key = w.toLowerCase();
    if (taken.has(key)) continue;
    taken.add(key);
    extras.push(w);
  }

  return shuffleWith([...baseChips, ...extras], rng);
}
