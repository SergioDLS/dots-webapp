// app/(app)/games/dotaxi/lanes.ts
// Reglas puras de carriles de Dotaxi: cuántos toca, dónde caen y con qué
// opciones se llenan. Sin React ni DOM — portable a RN tal cual.

export type Rng = () => number; // [0,1)

/**
 * Tramos de dificultad por ACIERTOS acumulados (no por rondas jugadas: así
 * fallar no castiga dos veces). Ordenados de mayor a menor exigencia.
 */
export const LANE_TIERS = [
  { minCorrect: 6, lanes: 4 },
  { minCorrect: 3, lanes: 3 },
  { minCorrect: 0, lanes: 2 },
] as const;

export function lanesForCorrect(correctCount: number): number {
  for (const tier of LANE_TIERS) {
    if (correctCount >= tier.minCorrect) return tier.lanes;
  }
  return 2;
}

/**
 * Geometría en porcentaje sobre una carretera de ANCHO FIJO: los carriles se
 * reparten el espacio, así el escenario nunca se sale de pantalla en móvil.
 */
export function laneGeometry(lanes: number): {
  widthPct: number;
  centersPct: number[];
} {
  if (lanes <= 0) return { widthPct: 100, centersPct: [50] };
  const widthPct = 100 / lanes;
  const centersPct = Array.from(
    { length: lanes },
    (_, i) => i * widthPct + widthPct / 2,
  );
  return { widthPct, centersPct };
}

/**
 * Carril equivalente al cambiar de tramo: conserva la posición relativa del
 * taxi y lo mantiene siempre dentro de rango (nunca desaparece bajo los pies
 * del jugador cuando se añade o quita un carril).
 */
export function nearestLane(
  currentLane: number,
  fromLanes: number,
  toLanes: number,
): number {
  if (fromLanes <= 0 || toLanes <= 0) return 0;
  const ratio = (currentLane + 0.5) / fromLanes;
  const mapped = Math.floor(ratio * toLanes);
  return Math.max(0, Math.min(toLanes - 1, mapped));
}

/**
 * Opciones que se reparten por los carriles. El backend solo manda 3, así que
 * para 4 carriles se toma una palabra de OTRA pregunta del mazo (mismo
 * registro, engaña más que un distractor genérico). Se excluyen duplicados
 * case-insensitive; si el cruzado no alcanza, devuelve las que haya.
 * La correcta SIEMPRE está incluida. Puro: no muta las entradas.
 */
export function buildLaneOptions(
  correct: string,
  questionOptions: readonly string[],
  crossWords: readonly string[],
  lanes: number,
  rng: Rng,
): string[] {
  const shuffle = <T,>(arr: readonly T[]): T[] => {
    const copy = [...arr];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  };

  const taken = new Set<string>([correct.toLowerCase()]);
  const picked: string[] = [correct];

  // distractores propios de la pregunta
  for (const w of shuffle(questionOptions)) {
    if (picked.length >= lanes) break;
    const key = w.toLowerCase();
    if (taken.has(key)) continue;
    taken.add(key);
    picked.push(w);
  }

  // si faltan carriles, se cruzan palabras de otras preguntas del mazo
  for (const w of shuffle(crossWords)) {
    if (picked.length >= lanes) break;
    const key = w.toLowerCase();
    if (taken.has(key)) continue;
    taken.add(key);
    picked.push(w);
  }

  return shuffle(picked);
}
