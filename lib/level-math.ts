/**
 * Fórmula de nivel (contrato del backend, me.service.ts):
 *   level = floor(sqrt(xp / 100)) + 1, el nivel actual empieza en 100·(level-1)²
 *   y xpForNextLevel = 100·level².
 * Única implementación en el frontend: HUD, perfil y cualquier barra de XP.
 */
export type LevelProgress = { levelStart: number; span: number; pct: number };

export function levelProgress(xp: number, level: number, xpForNextLevel: number): LevelProgress {
  const levelStart = 100 * (level - 1) * (level - 1);
  const span = Math.max(1, xpForNextLevel - levelStart);
  const pct = Math.min(100, Math.max(0, Math.round(((xp - levelStart) / span) * 100)));
  return { levelStart, span, pct };
}
