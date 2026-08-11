// app/(app)/games/dot-bombs/engine.ts
// Caída, dificultad y puntuación. Puro: sin React ni DOM (portable a RN).

export type GameMode = "easy" | "medium" | "hard" | "survival";

export type Bomb = {
  id: number;
  word: string;
  img: string | null;
  y: number; // 0 arriba → 1 suelo
  speed: number; // fracción de pantalla por segundo (antes de speedMult)
};

export type EngineConfig = {
  fallSeconds: number; // segundos de caída completa a speedMult=1
  maxBombs: number; // simultáneas en pantalla
  spawnEveryMs: number;
  accelPerSecond: number; // crecimiento de speedMult por segundo (survival)
  decoys: number; // letras señuelo en la bandeja
  multiplier: number; // multiplicador de score del modo
  winAt: number | null; // bombas desactivadas para ganar; null = sin meta
};

// Valores de partida del spec — calibrar jugando en la Task 6 sin cambiar la forma.
export const DIFFICULTY: Record<GameMode, EngineConfig> = {
  easy: { fallSeconds: 16, maxBombs: 2, spawnEveryMs: 6000, accelPerSecond: 0, decoys: 0, multiplier: 1, winAt: 20 },
  medium: { fallSeconds: 12, maxBombs: 3, spawnEveryMs: 5000, accelPerSecond: 0, decoys: 0, multiplier: 2, winAt: 20 },
  hard: { fallSeconds: 9, maxBombs: 4, spawnEveryMs: 4000, accelPerSecond: 0, decoys: 2, multiplier: 3, winAt: 20 },
  survival: { fallSeconds: 12, maxBombs: 5, spawnEveryMs: 4500, accelPerSecond: 0.004, decoys: 1, multiplier: 1, winAt: null },
};

/** Avanza las bombas dtMs. Devuelve las vivas y TODAS las aterrizadas del tick
 *  (el juego viejo perdía una sola vida aunque aterrizaran varias). Puro. */
export function stepBombs(
  bombs: Bomb[],
  dtMs: number,
  speedMult: number,
): { bombs: Bomb[]; landed: Bomb[] } {
  const moved = bombs.map((b) => ({ ...b, y: b.y + (b.speed * speedMult * dtMs) / 1000 }));
  return {
    bombs: moved.filter((b) => b.y < 1),
    landed: moved.filter((b) => b.y >= 1),
  };
}

/** 40 × mult × bonus de altura [1..1.5] × combo [1..2], redondeado.
 *  y=0 (recién salida) paga 1.5; y=1 (al ras) paga 1. */
export function bombScore(multiplier: number, y: number, combo: number): number {
  const height = 1 + 0.5 * Math.min(1, Math.max(0, 1 - y));
  const comboMult = Math.min(2, 1 + 0.1 * combo);
  return Math.round(40 * multiplier * height * comboMult);
}

/** Survival: ×1 base, +0.1 por cada 30 s sobrevividos, tope ×3 (spec). */
export function survivalMultiplier(survivedSeconds: number): number {
  return Math.min(3, 1 + 0.1 * Math.floor(survivedSeconds / 30));
}
