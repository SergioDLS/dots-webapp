import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DAILY_PATHS,
  badgesFor,
  dailyStatus,
  gameKey,
  isDailyPath,
  lockedLabel,
  splitGames,
} from "./arcade.ts";

const game = (over = {}) => ({
  id: 1,
  name: "Juego",
  path: "/dot-match",
  unlock: 0,
  unlocked: true,
  levelsLeft: 0,
  ...over,
});

test("gameKey quita la barra inicial de la ruta", () => {
  assert.equal(gameKey("/dot-match"), "dot-match");
  assert.equal(gameKey("/wordle"), "wordle");
});

test("gameKey tolera una ruta vacía o sin barra", () => {
  // La columna `path` de la BD puede venir vacía: el backend la sirve como "".
  assert.equal(gameKey(""), "");
  assert.equal(gameKey("memory"), "memory");
});

test("isDailyPath reconoce los dos puzzles diarios y nada más", () => {
  assert.equal(isDailyPath("/wordle"), true);
  assert.equal(isDailyPath("/crossword"), true);
  assert.equal(isDailyPath("/dot-match"), false);
  assert.equal(isDailyPath(""), false);
});

test("splitGames reparte en diarios, arcade y bloqueados", () => {
  const games = [
    game({ id: 1, path: "/dot-match" }),
    game({ id: 2, path: "/wordle" }),
    game({ id: 3, path: "/ghost-race", unlocked: false, levelsLeft: 4 }),
    game({ id: 4, path: "/crossword" }),
    game({ id: 5, path: "/memory" }),
  ];
  const { daily, arcade, locked } = splitGames(games);
  assert.deepEqual(daily.map((g) => g.id), [2, 4]);
  assert.deepEqual(arcade.map((g) => g.id), [1, 5]);
  assert.deepEqual(locked.map((g) => g.id), [3]);
});

test("splitGames ordena los héroes como DAILY_PATHS, no como llegan", () => {
  // El backend ordena por `unlock` y el crucigrama puede llegar antes que el
  // wordle; los dos héroes no deben intercambiarse entre cargas.
  const games = [game({ id: 9, path: "/crossword" }), game({ id: 8, path: "/wordle" })];
  assert.deepEqual(splitGames(games).daily.map((g) => g.path), DAILY_PATHS);
  assert.deepEqual(splitGames(games).daily.map((g) => g.id), [8, 9]);
});

test("splitGames manda a bloqueados un diario que aún no se desbloquea", () => {
  const games = [game({ id: 2, path: "/wordle", unlocked: false, levelsLeft: 2 })];
  const { daily, locked } = splitGames(games);
  assert.deepEqual(daily, []);
  assert.deepEqual(locked.map((g) => g.id), [2]);
});

test("lockedLabel concuerda en singular, plural y cero", () => {
  assert.equal(lockedLabel(1), "falta 1 nivel");
  assert.equal(lockedLabel(4), "faltan 4 niveles");
  assert.equal(lockedLabel(0), "ya casi");
  assert.equal(lockedLabel(-3), "ya casi");
});

test("badgesFor pone el trofeo en el juego del torneo de la semana", () => {
  const ctx = { tournamentPath: "/dot-match" };
  assert.deepEqual(badgesFor("/dot-match", ctx), { tournament: true });
  assert.deepEqual(badgesFor("/memory", ctx), { tournament: false });
});

test("dailyStatus devuelve null mientras no hay estado", () => {
  // La línea existe igual y reserva su alto: sin esto la tarjeta salta al cargar.
  assert.equal(dailyStatus(null), null);
});

test("dailyStatus celebra el puzzle resuelto", () => {
  assert.deepEqual(dailyStatus({ done: true, won: true }), {
    label: "Hecho por hoy",
    check: true,
  });
});

test("dailyStatus es neutro con el puzzle agotado sin resolver", () => {
  // Canon: Doty nunca regaña. Y "Sin resolver" invitaría a algo imposible hasta mañana.
  assert.deepEqual(dailyStatus({ done: true, won: false }), {
    label: "Vuelve mañana",
    check: false,
  });
});

test("dailyStatus invita cuando el puzzle sigue abierto", () => {
  // "hasta": son 15 XP por partida + 25 solo si supera el récord personal (`XP_PER_GAME_PLAY` + `XP_NEW_HIGH_SCORE_BONUS`).
  assert.deepEqual(dailyStatus({ done: false, won: false }), {
    label: "Sin resolver · hasta +40 XP",
    check: false,
  });
});
