import type { Game } from "@/services/games.service";

/**
 * Lógica pura de la vista del arcade (spec §4). Vive fuera de los componentes
 * para poder probarse con `node --test`: por eso SOLO admite `import type`
 * (Node ejecuta este archivo sin bundler y no resolvería el alias `@/`).
 */

/** Los dos juegos de un puzzle al día. El orden es el que ven los héroes. */
export const DAILY_PATHS = ["/wordle", "/crossword"] as const;

export function isDailyPath(path: string): boolean {
  return (DAILY_PATHS as readonly string[]).includes(path);
}

/**
 * "/dot-match" → "dot-match": la clave con la que el backend guarda récords,
 * tronos y torneos. La columna `path` de la BD puede llegar vacía, así que no
 * se asume la barra.
 */
export function gameKey(path: string): string {
  return path.startsWith("/") ? path.slice(1) : path;
}

/**
 * El arte de un juego por su clave o su ruta: "dot-match" →
 * "/images/games/dot-match.png". Lo comparten la grilla del arcade y la
 * pantalla de inicio de cada juego, que enseñan el MISMO icono.
 */
export function gameArt(pathOrKey: string): string {
  return `/images/games/${gameKey(pathOrKey)}.png`;
}

export interface SplitGames {
  daily: Game[];
  arcade: Game[];
  locked: Game[];
}

/**
 * Reparte la lista en los tres bloques de la pantalla. Los diarios salen en el
 * orden de DAILY_PATHS y no en el que los mande el backend (ordena por
 * `unlock`), para que los dos héroes no se intercambien entre cargas.
 */
export function splitGames(games: Game[]): SplitGames {
  const unlocked = games.filter((g) => g.unlocked);
  const daily = DAILY_PATHS.map((p) => unlocked.find((g) => g.path === p)).filter(
    (g): g is Game => g !== undefined,
  );
  return {
    daily,
    arcade: unlocked.filter((g) => !isDailyPath(g.path)),
    locked: games.filter((g) => !g.unlocked),
  };
}

/** Cuánto falta para abrir un juego. Concuerda en singular y plural. */
export function lockedLabel(levelsLeft: number): string {
  if (levelsLeft <= 0) return "ya casi";
  return levelsLeft === 1 ? "falta 1 nivel" : `faltan ${levelsLeft} niveles`;
}

export interface TileBadges {
  /** Este es el juego del torneo de esta semana. */
  tournament: boolean;
}

export interface BadgeContext {
  /** `gamePath` del torneo — ya viene con barra desde el backend. */
  tournamentPath: string | null;
}

export function badgesFor(path: string, ctx: BadgeContext): TileBadges {
  return {
    tournament: ctx.tournamentPath !== null && ctx.tournamentPath === path,
  };
}

/** Lo que `GET /games/wordle` y `GET /games/crossword` dicen del día de hoy. */
export interface DailyState {
  done: boolean;
  won: boolean;
}

export interface DailyStatus {
  label: string;
  /** Pinta el check verde junto a la etiqueta. */
  check: boolean;
}

/**
 * Traduce el estado del puzzle de hoy a la línea del héroe. `null` mientras el
 * estado no ha llegado: el héroe reserva el alto igual y no salta al cargar.
 *
 * El caso `done && !won` (seis intentos gastados en el wordle) no está en el
 * spec: "Sin resolver" invitaría a algo imposible hasta mañana, y señalar el
 * fallo rompe el canon "nunca regaña" (spec §1.2). Va una línea neutra.
 *
 * "hasta +40 XP": el backend da 15 XP por partida y 25 más solo si el score
 * supera el récord personal (`XP_PER_GAME_PLAY` + `XP_NEW_HIGH_SCORE_BONUS`).
 */
export function dailyStatus(state: DailyState | null): DailyStatus | null {
  if (state === null) return null;
  if (state.won) return { label: "Hecho por hoy", check: true };
  if (state.done) return { label: "Vuelve mañana", check: false };
  return { label: "Sin resolver · hasta +40 XP", check: false };
}
