/**
 * Utilidades compartidas por los juegos diarios (wordle y crossword): ambos
 * rotan a medianoche UTC y pintan la misma cuenta atrás.
 */

/** Segundos que faltan para la medianoche UTC (cuando rota el juego diario). */
export function secondsUntilMidnightUTC(): number {
  const now = new Date();
  const tomorrow = new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate() + 1,
      0,
      0,
      0,
      0,
    ),
  );
  return Math.max(0, Math.floor((tomorrow.getTime() - now.getTime()) / 1000));
}

/**
 * Cuenta atrás legible. `readyLabel` es el texto de "ya hay uno nuevo",
 * distinto por juego ("¡Nueva palabra…" / "¡Nuevo crucigrama…").
 */
export function formatCountdown(secs: number, readyLabel: string): string {
  if (secs <= 0) return readyLabel;
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m} min`;
  return "menos de 1 min";
}
