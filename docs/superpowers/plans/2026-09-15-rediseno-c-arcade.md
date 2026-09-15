# Rediseño look & feel — Subproyecto C (/play v2, "Arcade") — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `/play` se convierte en "Arcade": cabecera con Doty gamer, los dos juegos diarios como héroes con su estado de hoy, doce juegos como arte flotante sin caja con badges de trono y torneo, bloqueados en gris con candado, y entrada a cada juego con `router.push` (se elimina la excepción legacy de `window.location.assign`).

**Architecture:** Todo es frontend (dots-webapp); ningún endpoint cambia. La lógica de vista (repartir los juegos en diarios/arcade/bloqueados, derivar la clave de juego desde la ruta, decidir badges y traducir el estado diario a copy) vive en un módulo puro `lib/arcade.ts` probado con `node --test`. Los componentes se reparten por responsabilidad: `arcade-container` (fetch, estados, navegación), `arcade-grid` (vista pura), y las piezas `arcade-header`, `daily-hero`, `game-tile`, `locked-tile`, `arcade-skeleton`. La geometría se exporta como constantes desde las piezas para que el esqueleto de carga calque la retícula real en vez de aproximarla.

**Tech Stack:** Next.js 16 (app router) + React 19 + Tailwind 4; `next/image`; `useRouter` de `next/navigation`; `node --test` (Node 24 ejecuta `.ts` con solo `import type` sin compilar); tokens de tema generados (subproyecto A).

**Spec:** `docs/superpowers/specs/2026-09-14-rediseno-look-and-feel-juvenil-design.md` — §4 (Subproyecto C), §1 (principios), §2.3 (tabla de cableado y fallbacks de arte), §8 (orden y ramas).

## Global Constraints

- Webapp: `source ~/.nvm/nvm.sh && nvm use` antes de cualquier `node`/`npm` (Node 24 por `.nvmrc`). Verificación final siempre `npm run lint && npm run test:scripts && npx next build`.
- Rama `redesign/c-arcade` desde `main` (solo dots-webapp; **no hay cambios de backend en C**). **Sin push a origin.** El trabajo va en un worktree fuera del checkout principal: ahí vive el dev server de Sergio y no se toca.
- Commits terminan con `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`.
- Regla 1: navegación con `router.push`/`router.replace`, nunca `window.location.*`. **C elimina la excepción legacy** de la grilla de juegos y la frase que la documenta en `CLAUDE.md` (spec §1.6).
- Regla 2 (RN-safe): solo tap/pointer, nada de hover como única señal, animación solo `transform`/`opacity`. Un `filter` **estático** (grayscale de un bloqueado) no es animación y está permitido; animarlo no.
- Regla 3: nada de `setState` síncrono en el cuerpo de un `useEffect`; el botón "Reintentar" usa el patrón `fetchAttempt` (el botón sube un contador, el efecto solo fetchea).
- Regla 5: todo fetch de página tiene estado `loadError` + botón **Reintentar** que re-fetchea por estado.
- Regla 10: Doty solo con `<Doty pose=…>` y poses del registro generado; ningún PNG nuevo en `public/images/Doty/`.
- Regla 11: cero emoji como icono. Iconos de sistema con `<Icon name>` (SVG, `components/ui/icon/paths.tsx`) y de economía con `<UiIcon name>` (PNG, `components/ui/ui-icon/ui-icon.tsx`). **El `FALLBACK` emoji 🎮 de la grilla actual desaparece en C.**
- Regla 12: `app/themes.generated.css` y `lib/theme-colors.ts` no se editan a mano.
- Principio 4 del spec: **sin contenedores para el contenido**. Los tiles de juego flotan sobre el fondo con sombra de piso: sin mancha de color, sin borde, sin caja. El panel teñido queda reservado a las cabeceras del Camino y no aparece en C.
- Principio 5: Doty siempre es rosa. Tokens que no cambian por paleta: `--gem`, `--flame`, `--gold`, `--success`, `--danger`, `--sky-*`.
- Módulos puros bajo test (`lib/arcade.ts`): **solo `import type`**. Node los ejecuta sin bundler, así que un import de valor con alias `@/` no resolvería; un `import type` se borra antes de ejecutar y sí vale. El test es `lib/arcade.test.mjs` junto al módulo e importa `./arcade.ts` con extensión. `npm run test:scripts` ya incluye `lib/*.test.mjs`: **no hay que tocar `package.json`**.
- Copy en español. La frase de la cabecera ya está aprobada en la tabla de `docs/brand/doty-identity.md`: `| Cabecera de /play | gamer | "Arcade · XP sin sufrir." |`. No se inventan frases nuevas de Doty en C.
- Arte pendiente (spec §2.3, §8): la pose `gamer` sigue apuntando al placeholder en el registro generado, así que el cableado va con `poseOrFallback("gamer", "en-celular")` y hoy se ve `en-celular`. Cuando llegue la tanda 1 cambia sola, sin tocar código.

---

## Contexto medido del código actual (leído el 2026-09-15, no re-investigar)

Lo que sigue son hechos verificados en el repo y en `../dots-backend`. Un implementador **no necesita volver a comprobarlos**.

**Lo que hay hoy en `/play`:**
- `app/(app)/(hub)/play/page.tsx` (22 líneas): cabecera "Zona de juego" / "Practica jugando. Las lecturas viven en tu camino." + `<Doty pose="idea" size="mini">` + `<GamesGrid />`.
- `components/play/games-grid.tsx` (89 líneas): fetch de `getGamesService()` con patrón `fetchAttempt`, esqueleto propio, estado de error con Doty `decepcionado` y `UIButton` "Reintentar", estado vacío con Doty `timido`.
- `components/play/games-grid-view.tsx` (250 líneas): vista con tarjetas de color (`SKIN` por ruta con un token de tono), tres bloques Hoy/Arcade/Por desbloquear, glifos de 28–36 px, `FALLBACK` emoji 🎮 y `const go = (path) => window.location.assign(\`/games${path}\`)`.

**Los dos archivos de `components/play/` se borran en C.** Sus decisiones útiles que se conservan: el reparto en tres bloques, el patrón `fetchAttempt`, y que `getGamesService()` propaga el error a propósito para distinguir "no hay juegos" de "no pudimos cargarlos".

**Datos del backend (`services/games.service.ts`, `services/tournament.service.ts`):**

```ts
// GET /games — la lista. `path` viene de la columna de la BD: "/wordle", "/dot-match"…
export type Game = { id: number; name: string; path: string; unlock: number; unlocked: boolean; levelsLeft: number };
export async function getGamesService(): Promise<Game[]>;           // PROPAGA el error

// GET /games/records — trono global por juego. `gameKey` es la ruta SIN la barra: "dot-match".
export type GameRecord = { gameKey: string; holderName: string; holderId: number; highScore: number };
export async function getGameRecordsService(): Promise<GameRecord[]>;  // devuelve [] si falla

// GET /tournament — torneo de la semana. `gamePath` SÍ trae barra: "/dot-match".
export interface TournamentData { week: string; gameKey: string; gameName: string; gamePath: string; seed: number; endsAt: string; top: {name: string; score: number}[]; me: {rank: number; best: number; plays: number} | null }
export async function getTournamentService(): Promise<TournamentData | null>;  // devuelve null si falla

// GET /games/wordle y GET /games/crossword — estado del puzzle de hoy.
export type WordleState = { day: string; length: number; maxTries: number; guesses: …[]; done: boolean; won: boolean; hintEs: string | null; answer: string | null };
export type CrosswordState = { day: string; size: 5; slots: …[]; cells: …; checksUsed: number; maxChecks: 5; done: boolean; won: boolean; answers: … };
export async function getWordleService(): Promise<WordleState>;      // PROPAGA el error
export async function getCrosswordService(): Promise<CrosswordState>; // PROPAGA el error
```

**Verificado en el backend (`src/modules/daily-games/daily-games.service.ts`): `GET /games/wordle` y `GET /games/crossword` son de solo lectura.** Hacen `findOne` del estado del día y lo devuelven; no crean fila ni consumen intento. Por eso `/play` puede pedirlos para pintar el estado de hoy sin efectos secundarios.

**Verificado en el backend (`src/modules/games/games.service.ts`): el XP de un juego es `XP_PER_GAME_PLAY = 15` más `XP_NEW_HIGH_SCORE_BONUS = 25` solo si el score supera el récord personal.** Es decir, 40 XP es el **máximo** (y lo que se lleva siempre un primer intento), no lo que se lleva cada partida. El spec §4 dice `"Sin resolver · +40 XP"`, que promete de más a quien resuelve el diario peor que su mejor día. **Task 6 corrige el spec** y el copy que se implementa es `"Sin resolver · hasta +40 XP"`.

**Tercer estado del diario que el spec no contempla:** `done: true, won: false` (en el wordle, agotar los seis intentos). El spec solo describe resuelto y sin resolver. Mostrar "Sin resolver" ahí sería invitar a algo imposible hasta mañana, y cualquier copy que señale el fallo viola el canon "nunca regaña" (spec §1.2). **Se implementa un tercer estado neutro: "Vuelve mañana"**, sin check.

**Piezas existentes que C reutiliza:**
- `<Doty pose size animation>` — `components/ui/doty/doty.tsx`. Tamaños disponibles: `micro` 32, `mini` 80, `tiny` 96, `smaller` 112, `small` 144, `medium` 192, `big` 352, `chip` 44, `section` 104, `banner` 158. **`section` son los 104 px que pide el spec para la cabecera.** Exporta `poseOrFallback(pose, fallback)`.
- `<UiIcon name size apagado className>` — `components/ui/ui-icon/ui-icon.tsx`. Nombres disponibles: `gemas, racha, vidas, xp, corona, trofeo, medalla, regalo, podio-oro, podio-plata, podio-bronce, rayo`. **`corona` y `trofeo` son los badges del spec.**
- `<Icon name mono size>` — `components/ui/icon/paths.tsx`. Nombres relevantes: `candado`, `check`. (Lista completa: `camino repaso retos juegos perfil leccion escucha gramatica vocabulario letras numeros lectura checkpoint check cruz aviso candado lupa lapiz ajustes enlace abajo izquierda derecha sol luna imagen calendario punto cuadro empate duelo brujula escudo armar`.)
- `<UIButton>` — `components/ui/button/button.tsx`, el botón de "Reintentar".
- `.doty-shadow` en `app/globals.css` es `filter: drop-shadow(0 6px 4px rgba(30, 27, 92, 0.18))`. C añade `.dots-floor-shadow` con la misma sombra para arte que no es Doty (un tile de juego no es una pose y no debe llevar una clase llamada `doty-*`).
- Los doce PNG de juego viven en `public/images/games/<key>.png`, todos **512 × 512**: `audio-blitz, crossword, dont-pop, dot-bombs, dot-match, dotaxi, ghost-race, memory, sentence-builder, true-false, word-tower, wordle`.

**El id del usuario actual** se lee hoy de `localStorage` con el mismo bloque copiado en seis sitios (`hooks/use-game-records.ts:46`, `hooks/use-rival-watch.ts:126`, `components/interactive-column/top-students.tsx:61`, `components/interactive-column/daily-progress/daily-progress.tsx:15`, `app/(app)/admin/layout.tsx:45`, `app/(app)/(hub)/profile/page.tsx:31`). C extrae `lib/current-user.ts` y lo usa en los dos sitios que toca (el contenedor nuevo y `use-game-records.ts`, que tiene el bloque idéntico). **Los otros cuatro no se tocan**: están en pantallas de otros subproyectos y migrarlos aquí sería refactor sin encargo.

---

## Estructura de archivos

**Crear**
- `lib/arcade.ts` + `lib/arcade.test.mjs` — lógica pura de la vista del arcade.
- `lib/current-user.ts` — `readCurrentUserId()`, el bloque de `localStorage` con nombre.
- `components/play/game-tile.tsx` — tile flotante de un juego desbloqueado (arte + badges + nombre). Exporta su geometría.
- `components/play/locked-tile.tsx` — tile de un juego bloqueado (gris, candado, "faltan N niveles").
- `components/play/daily-hero.tsx` — héroe de un juego diario (arte 96, eyebrow, nombre, estado). Exporta su geometría.
- `components/play/arcade-header.tsx` — "Arcade" / "XP sin sufrir." + Doty gamer.
- `components/play/arcade-skeleton.tsx` — esqueleto que calca la retícula real usando las constantes de las piezas.
- `components/play/arcade-grid.tsx` — vista pura: recibe datos ya cargados y los reparte en los tres bloques.
- `components/play/arcade-container.tsx` — fetch, estados (carga / error / vacío) y navegación con `router.push`.

**Modificar**
- `app/globals.css` — utilidad `.dots-floor-shadow`.
- `hooks/use-game-records.ts` — usa `readCurrentUserId()` en vez del bloque inline.
- `app/(app)/(hub)/play/page.tsx` — cabecera nueva + `<ArcadeContainer />`.
- `CLAUDE.md` — la regla 1 pierde la excepción legacy.
- `docs/ARQUITECTURA.md` — fila de `/play` y sección del arcade.
- `docs/superpowers/specs/2026-09-14-rediseno-look-and-feel-juvenil-design.md` — §4: copy del XP y tercer estado del diario.

**Borrar**
- `components/play/games-grid.tsx`
- `components/play/games-grid-view.tsx`

---

## Geometría fija (spec §4, medida para que doce juegos entren en pantalla y media a 390 px)

| Constante | Valor | De dónde sale |
|---|---|---|
| `TILE_ART` | 82 | spec §4: "arte del juego a 82 px" |
| `TILE_ART_BOX` | 96 | caja del arte: deja aire para la sombra de piso y para el badge |
| `TILE_LABEL_H` | 32 | dos líneas de 12.5 px con interlínea 16 |
| `TILE_H` | 134 | `TILE_ART_BOX` + 6 de gap + `TILE_LABEL_H` |
| `HERO_ART` | 96 | spec §4: "arte de 96 px centrado" |
| `HERO_ART_BOX` | 108 | caja del arte del héroe |
| `HERO_H` | 178 | 108 + eyebrow 14 + nombre 22 + estado 16 + tres gaps de 6 |
| `BADGE` | 28 | spec §4: "badges de 28 px sobre el arte, arriba a la derecha" |
| Columnas | 3 / 5 (`md`) / 6 (`lg`) | spec §4 |

Suma a 390 × 812: cabecera ≈ 110 + héroes 178 + rejilla de 10 juegos (4 filas × 134 + 3 × 12 de gap = 572) + gaps 48 ≈ 908 px de contenido contra ≈ 705 px de viewport útil (812 − 43 de HUD − 64 de nav). **1.29 pantallas**, dentro del criterio de "una pantalla y media".

---

### Task 1: Lógica pura del arcade — `lib/arcade.ts` (TDD)

**Files:**
- Create: `lib/arcade.ts`, `lib/arcade.test.mjs`

**Interfaces:**
- Consumes: `import type { Game, GameRecord } from "@/services/games.service"` (solo tipos — un import de valor rompería `node --test`).
- Produces (lo consumen las Tasks 2–5): `DAILY_PATHS`, `isDailyPath(path): boolean`, `gameKey(path): string`, `splitGames(games): { daily: Game[]; arcade: Game[]; locked: Game[] }`, `lockedLabel(levelsLeft): string`, `type TileBadges = { throne: boolean; tournament: boolean }`, `badgesFor(path, ctx): TileBadges`, `type DailyState = { done: boolean; won: boolean }`, `type DailyStatus = { label: string; check: boolean }`, `dailyStatus(state): DailyStatus | null`.

- [ ] **Step 1: Escribir los tests que fallan — `lib/arcade.test.mjs`**

```js
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

const record = (over = {}) => ({
  gameKey: "dot-match",
  holderName: "Ana",
  holderId: 7,
  highScore: 300,
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

test("badgesFor pone la corona solo si el trono es del usuario actual", () => {
  const ctx = { records: [record({ holderId: 7 })], currentUserId: 7, tournamentPath: null };
  assert.deepEqual(badgesFor("/dot-match", ctx), { throne: true, tournament: false });
});

test("badgesFor no pone corona si el trono es de otro", () => {
  const ctx = { records: [record({ holderId: 99 })], currentUserId: 7, tournamentPath: null };
  assert.deepEqual(badgesFor("/dot-match", ctx), { throne: false, tournament: false });
});

test("badgesFor no pone corona sin sesión legible", () => {
  const ctx = { records: [record({ holderId: 7 })], currentUserId: null, tournamentPath: null };
  assert.equal(badgesFor("/dot-match", ctx).throne, false);
});

test("badgesFor pone el trofeo en el juego del torneo de la semana", () => {
  const ctx = { records: [], currentUserId: 7, tournamentPath: "/dot-match" };
  assert.deepEqual(badgesFor("/dot-match", ctx), { throne: false, tournament: true });
  assert.deepEqual(badgesFor("/memory", ctx), { throne: false, tournament: false });
});

test("badgesFor puede dar los dos badges a la vez", () => {
  const ctx = { records: [record({ holderId: 7 })], currentUserId: 7, tournamentPath: "/dot-match" };
  assert.deepEqual(badgesFor("/dot-match", ctx), { throne: true, tournament: true });
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
  // "hasta": son 15 XP por partida + 25 solo si supera el récord personal.
  assert.deepEqual(dailyStatus({ done: false, won: false }), {
    label: "Sin resolver · hasta +40 XP",
    check: false,
  });
});
```

- [ ] **Step 2: Correr los tests para verlos fallar**

```bash
source ~/.nvm/nvm.sh && nvm use && node --test lib/arcade.test.mjs
```

Esperado: FAIL con `Cannot find module …/lib/arcade.ts`.

- [ ] **Step 3: Escribir `lib/arcade.ts`**

```ts
import type { Game, GameRecord } from "@/services/games.service";

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
  /** El trono global de este juego es del usuario actual. */
  throne: boolean;
  /** Este es el juego del torneo de esta semana. */
  tournament: boolean;
}

export interface BadgeContext {
  records: GameRecord[];
  currentUserId: number | null;
  /** `gamePath` del torneo — ya viene con barra desde el backend. */
  tournamentPath: string | null;
}

export function badgesFor(path: string, ctx: BadgeContext): TileBadges {
  const key = gameKey(path);
  return {
    throne:
      ctx.currentUserId !== null &&
      ctx.records.some((r) => r.gameKey === key && r.holderId === ctx.currentUserId),
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
```

- [ ] **Step 4: Correr los tests para verlos pasar**

```bash
source ~/.nvm/nvm.sh && nvm use && node --test lib/arcade.test.mjs
```

Esperado: PASS, 16 tests.

- [ ] **Step 5: Verificar que el módulo compila en el bundler**

```bash
source ~/.nvm/nvm.sh && nvm use && npx tsc --noEmit
```

Esperado: sin errores.

- [ ] **Step 6: Commit**

```bash
git add lib/arcade.ts lib/arcade.test.mjs
git commit -m "feat(arcade): lógica pura de la vista — reparto, clave de juego, badges y estado diario

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 2: Sombra de piso, id de usuario y los dos tiles de juego

**Files:**
- Create: `lib/current-user.ts`
- Create: `components/play/game-tile.tsx`
- Create: `components/play/locked-tile.tsx`
- Modify: `app/globals.css` (añadir `.dots-floor-shadow` junto a `.doty-shadow`)
- Modify: `hooks/use-game-records.ts:41-56` (sustituir el bloque inline de `localStorage`)

**Interfaces:**
- Consumes de Task 1: `lockedLabel(levelsLeft): string`, `type TileBadges = { throne: boolean; tournament: boolean }`.
- Produces (lo consumen Tasks 4 y 5): `readCurrentUserId(): number | null`; `GameTile` (default export) con props `{ game: Game; badges: TileBadges; onOpen: (path: string) => void }`; `LockedTile` (default export) con props `{ game: Game }`; y desde `game-tile.tsx` las constantes `TILE_ART`, `TILE_ART_BOX`, `TILE_LABEL_H`, `TILE_H`, `BADGE` y el helper `gameArt(path): string`.

- [ ] **Step 1: Añadir la utilidad de sombra a `app/globals.css`**

Busca la línea `.doty-shadow { filter: drop-shadow(0 6px 4px rgba(30, 27, 92, 0.18)); }` y añade justo debajo:

```css
/* Misma sombra que .doty-shadow, para arte que no es Doty: los tiles del
   arcade flotan sobre el fondo sin caja (spec §1 principio 4) y la sombra es
   lo único que los apoya. Clase aparte a propósito: un tile de juego no es una
   pose y no debe llevar una clase doty-*. */
.dots-floor-shadow { filter: drop-shadow(0 6px 4px rgba(30, 27, 92, 0.18)); }
```

- [ ] **Step 2: Crear `lib/current-user.ts`**

```ts
/**
 * El id del usuario de la sesión. El access token vive en memoria, pero el
 * perfil se espeja en localStorage al iniciar sesión; seis pantallas leían
 * este mismo bloque copiado. Devuelve null ante cualquier duda (SSR, storage
 * bloqueado, JSON corrupto): quien llama debe funcionar sin el id.
 */
export function readCurrentUserId(): number | null {
  try {
    const raw = typeof window === "undefined" ? null : window.localStorage.getItem("user");
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { id?: number };
    return typeof parsed.id === "number" ? parsed.id : null;
  } catch {
    return null;
  }
}
```

- [ ] **Step 3: Usar el helper en `hooks/use-game-records.ts`**

Añade el import junto a los que ya hay:

```ts
import { readCurrentUserId } from "@/lib/current-user";
```

Y sustituye el bloque completo que va desde `// Read current user id from localStorage (same pattern as other components)` hasta el `})();` que cierra la IIFE por:

```ts
    const currentUserId: number | null = readCurrentUserId();
```

- [ ] **Step 4: Crear `components/play/game-tile.tsx`**

```tsx
"use client";

import Image from "next/image";

import { UiIcon } from "@/components/ui/ui-icon";
import type { TileBadges } from "@/lib/arcade";
import type { Game } from "@/services/games.service";

/**
 * Tile flotante de un juego desbloqueado (spec §4, variante B): el arte del
 * juego sobre el fondo con sombra de piso, sin mancha de color, sin borde y
 * sin caja; el nombre debajo. Las constantes se exportan para que el
 * esqueleto de carga calque esta retícula en vez de aproximarla.
 */
export const TILE_ART = 82;
export const TILE_ART_BOX = 96;
export const TILE_LABEL_H = 32;
export const TILE_H = TILE_ART_BOX + 6 + TILE_LABEL_H;
export const BADGE = 28;

/** El arte de cada juego, por su ruta: /images/games/dot-match.png */
export function gameArt(path: string): string {
  return `/images/games/${path.startsWith("/") ? path.slice(1) : path}.png`;
}

interface Props {
  game: Game;
  badges: TileBadges;
  onOpen: (path: string) => void;
}

export default function GameTile({ game, badges, onOpen }: Props) {
  return (
    <button
      type="button"
      onClick={() => onOpen(game.path)}
      // active:scale en vez de .dots-pressable: ese canto 3-D necesita una caja
      // y aquí no hay ninguna (principio 4). Solo transform: RN-safe.
      className="group flex w-full flex-col items-center gap-1.5 rounded-2xl transition-transform duration-150 active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-(--accent)"
      style={{ height: TILE_H }}
    >
      <span className="relative flex items-center justify-center" style={{ height: TILE_ART_BOX, width: TILE_ART_BOX }}>
        <Image
          src={gameArt(game.path)}
          alt=""
          aria-hidden
          width={512}
          height={512}
          sizes={`${TILE_ART}px`}
          className="dots-floor-shadow h-auto select-none object-contain"
          style={{ width: TILE_ART }}
          draggable={false}
        />
        {(badges.throne || badges.tournament) && (
          <span className="absolute flex items-center gap-0.5" style={{ top: 0, right: 0 }}>
            {badges.throne && <UiIcon name="corona" size={BADGE} />}
            {badges.tournament && <UiIcon name="trofeo" size={BADGE} />}
          </span>
        )}
      </span>
      {/* leading-4 (16 px) × 2 líneas = TILE_LABEL_H exacto: sin esto la fila
          de abajo se mueve cuando un nombre ocupa dos líneas y otro una. */}
      <span
        className="line-clamp-2 px-0.5 text-center font-display text-[12.5px] font-extrabold leading-4 text-foreground"
        style={{ height: TILE_LABEL_H }}
      >
        {game.name}
      </span>
    </button>
  );
}
```

- [ ] **Step 5: Crear `components/play/locked-tile.tsx`**

```tsx
"use client";

import Image from "next/image";

import { Icon } from "@/components/ui/icon";
import { lockedLabel } from "@/lib/arcade";
import type { Game } from "@/services/games.service";
import { TILE_ART, TILE_ART_BOX, TILE_H, TILE_LABEL_H, gameArt } from "./game-tile";

/**
 * Juego aún cerrado (spec §4): el mismo arte en gris al 35 %, candado encima y
 * cuánto falta. No es un botón: no se puede abrir, así que no finge que sí.
 */
export default function LockedTile({ game }: { game: Game }) {
  return (
    <div className="flex w-full flex-col items-center gap-1.5" style={{ height: TILE_H }}>
      <span className="relative flex items-center justify-center" style={{ height: TILE_ART_BOX, width: TILE_ART_BOX }}>
        <Image
          src={gameArt(game.path)}
          alt=""
          aria-hidden
          width={512}
          height={512}
          sizes={`${TILE_ART}px`}
          className="h-auto select-none object-contain"
          // filter estático, no animado: RN-safe (regla 2).
          style={{ width: TILE_ART, filter: "grayscale(1)", opacity: 0.35 }}
          draggable={false}
        />
        <span className="absolute text-(--muted)">
          <Icon name="candado" size={22} mono />
        </span>
      </span>
      <span
        className="flex flex-col items-center text-center leading-4"
        style={{ height: TILE_LABEL_H }}
      >
        <span className="line-clamp-1 px-0.5 text-[12.5px] font-bold text-(--muted)">
          {game.name}
        </span>
        <span className="text-[11px] font-bold text-(--muted) opacity-75">
          {lockedLabel(game.levelsLeft)}
        </span>
      </span>
    </div>
  );
}
```

- [ ] **Step 6: Verificar tipos y lint**

```bash
source ~/.nvm/nvm.sh && nvm use && npx tsc --noEmit && npx eslint lib/current-user.ts hooks/use-game-records.ts components/play/game-tile.tsx components/play/locked-tile.tsx
```

Esperado: sin errores. Los dos componentes todavía no los usa nadie: eso es correcto en esta tarea.

- [ ] **Step 7: Commit**

```bash
git add app/globals.css lib/current-user.ts hooks/use-game-records.ts components/play/game-tile.tsx components/play/locked-tile.tsx
git commit -m "feat(arcade): tiles flotantes de juego y bloqueado, sombra de piso y lectura del usuario con nombre

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 3: Héroe diario y cabecera del arcade

**Files:**
- Create: `components/play/daily-hero.tsx`
- Create: `components/play/arcade-header.tsx`

**Interfaces:**
- Consumes de Task 1: `dailyStatus(state): DailyStatus | null`, `type DailyState = { done: boolean; won: boolean }`. De Task 2: `gameArt(path): string`.
- Produces (lo consumen Tasks 4 y 5): `DailyHero` (default export) con props `{ game: Game; state: DailyState | null; onOpen: (path: string) => void }`; las constantes `HERO_ART`, `HERO_ART_BOX`, `HERO_H` exportadas desde `daily-hero.tsx`; `ArcadeHeader` (default export) sin props.

- [ ] **Step 1: Crear `components/play/daily-hero.tsx`**

```tsx
"use client";

import Image from "next/image";

import { Icon } from "@/components/ui/icon";
import { dailyStatus, type DailyState } from "@/lib/arcade";
import type { Game } from "@/services/games.service";
import { gameArt } from "./game-tile";

/**
 * Héroe de un juego diario (spec §4): arte más grande, eyebrow "Nuevo cada
 * día" y el estado del puzzle de hoy. Sin panel: igual que los tiles, flota.
 */
export const HERO_ART = 96;
export const HERO_ART_BOX = 108;
export const HERO_EYEBROW_H = 14;
export const HERO_NAME_H = 22;
export const HERO_STATUS_H = 16;
/** `gap-1.5` son 6 px en los TRES huecos, no 6/2/2: el alto se calcula, no se teclea. */
const HERO_GAP = 6;
export const HERO_H =
  HERO_ART_BOX + HERO_EYEBROW_H + HERO_NAME_H + HERO_STATUS_H + HERO_GAP * 3;

interface Props {
  game: Game;
  /** null mientras el estado de hoy no ha llegado (o no se pudo pedir). */
  state: DailyState | null;
  onOpen: (path: string) => void;
}

export default function DailyHero({ game, state, onOpen }: Props) {
  const status = dailyStatus(state);
  return (
    <button
      type="button"
      onClick={() => onOpen(game.path)}
      className="flex w-full flex-col items-center gap-1.5 rounded-2xl transition-transform duration-150 active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-(--accent)"
      style={{ height: HERO_H }}
    >
      <span className="flex items-center justify-center" style={{ height: HERO_ART_BOX }}>
        <Image
          src={gameArt(game.path)}
          alt=""
          aria-hidden
          width={512}
          height={512}
          sizes={`${HERO_ART}px`}
          className="dots-floor-shadow h-auto select-none object-contain"
          style={{ width: HERO_ART }}
          priority
          draggable={false}
        />
      </span>
      <span
        className="text-[11px] font-black uppercase tracking-widest text-(--accent)"
        style={{ lineHeight: `${HERO_EYEBROW_H}px` }}
      >
        Nuevo cada día
      </span>
      <span
        className="line-clamp-1 px-1 text-center font-display text-base font-extrabold text-foreground"
        style={{ lineHeight: `${HERO_NAME_H}px` }}
      >
        {game.name}
      </span>
      {/* El alto se reserva SIEMPRE, con estado o sin él: si la línea apareciera
          al llegar el fetch, la rejilla de abajo daría un salto. */}
      <span
        className="flex items-center justify-center gap-1 text-[11.5px] font-bold"
        style={{ height: HERO_STATUS_H, color: status?.check ? "var(--success)" : "var(--muted)" }}
      >
        {status !== null && (
          <>
            {status.check && <Icon name="check" size={13} mono />}
            {status.label}
          </>
        )}
      </span>
    </button>
  );
}
```

- [ ] **Step 2: Crear `components/play/arcade-header.tsx`**

```tsx
"use client";

import Doty, { poseOrFallback } from "@/components/ui/doty/doty";

/**
 * Cabecera de /play (spec §4). La frase es la aprobada en la tabla de voz de
 * `docs/brand/doty-identity.md`: "Arcade · XP sin sufrir.".
 *
 * `gamer` todavía apunta al placeholder del registro generado, así que
 * `poseOrFallback` la cambia por `en-celular` hasta que llegue la tanda 1 de
 * arte. Cuando llegue, esto no se toca: cambia solo.
 */
export default function ArcadeHeader() {
  return (
    <header className="flex items-center justify-between gap-3">
      <div className="flex flex-col gap-1">
        <h1 className="font-display text-3xl font-extrabold text-foreground">Arcade</h1>
        <p className="text-sm font-semibold text-(--muted)">XP sin sufrir.</p>
      </div>
      {/* Visible también en móvil (spec §4): es la cara de la pantalla. */}
      <Doty pose={poseOrFallback("gamer", "en-celular")} size="section" animation="bob" />
    </header>
  );
}
```

- [ ] **Step 3: Verificar tipos y lint**

```bash
source ~/.nvm/nvm.sh && nvm use && npx tsc --noEmit && npx eslint components/play/daily-hero.tsx components/play/arcade-header.tsx
```

Esperado: sin errores.

- [ ] **Step 4: Commit**

```bash
git add components/play/daily-hero.tsx components/play/arcade-header.tsx
git commit -m "feat(arcade): héroe de juego diario con el estado de hoy y cabecera con Doty gamer

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 4: Rejilla pura y esqueleto que la calca

**Files:**
- Create: `components/play/arcade-grid.tsx`
- Create: `components/play/arcade-skeleton.tsx`

**Interfaces:**
- Consumes de Task 1: `splitGames`, `badgesFor`, `type DailyState`, `type BadgeContext`. De Task 2: `GameTile`, `LockedTile`, `TILE_H`, `TILE_ART_BOX`, `TILE_LABEL_H`. De Task 3: `DailyHero`, `HERO_H`, `HERO_ART_BOX`.
- Produces (lo consume Task 5): `ArcadeGrid` (default export) con props `{ games: Game[]; badgeContext: BadgeContext; dailyStates: Record<string, DailyState | null>; onOpen: (path: string) => void }` y la constante `ARCADE_GRID_CLASS` exportada desde el mismo archivo; `ArcadeSkeleton` (default export) sin props. **Crea `arcade-grid.tsx` antes que `arcade-skeleton.tsx`: el esqueleto importa `ARCADE_GRID_CLASS` de la rejilla.**

- [ ] **Step 1: Crear `components/play/arcade-grid.tsx`**

```tsx
"use client";

import { badgesFor, splitGames, type BadgeContext, type DailyState } from "@/lib/arcade";
import type { Game } from "@/services/games.service";
import DailyHero from "./daily-hero";
import GameTile from "./game-tile";
import LockedTile from "./locked-tile";

/**
 * Vista pura del arcade: recibe todo cargado y lo reparte en los tres bloques
 * (héroes de hoy / arcade / por desbloquear). Sin fetch y sin router, para que
 * se pueda renderizar con datos de prueba.
 */

/**
  * Tres por fila en móvil, cinco en md y seis en lg (spec §4). Se exporta
  * porque el esqueleto de carga usa ESTA misma cadena: si cada uno tuviera la
  * suya, cambiar una columna aquí haría saltar la pantalla al cargar.
  */
export const ARCADE_GRID_CLASS = "grid grid-cols-3 gap-3 md:grid-cols-5 md:gap-4 lg:grid-cols-6";

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-xs font-bold uppercase tracking-widest text-(--muted)">{children}</h2>
  );
}

interface Props {
  games: Game[];
  badgeContext: BadgeContext;
  /** Estado del puzzle de hoy por ruta ("/wordle" → {done, won}); null si aún no llega. */
  dailyStates: Record<string, DailyState | null>;
  onOpen: (path: string) => void;
}

export default function ArcadeGrid({ games, badgeContext, dailyStates, onOpen }: Props) {
  const { daily, arcade, locked } = splitGames(games);

  return (
    <div className="flex flex-col gap-6">
      {daily.length > 0 && (
        <ul className="grid grid-cols-2 gap-3">
          {daily.map((game) => (
            <li key={game.id}>
              <DailyHero
                game={game}
                state={dailyStates[game.path] ?? null}
                onOpen={onOpen}
              />
            </li>
          ))}
        </ul>
      )}

      {arcade.length > 0 && (
        <section className="flex flex-col gap-3">
          <Eyebrow>Arcade</Eyebrow>
          <ul className={ARCADE_GRID_CLASS}>
            {arcade.map((game) => (
              <li key={game.id}>
                <GameTile game={game} badges={badgesFor(game.path, badgeContext)} onOpen={onOpen} />
              </li>
            ))}
          </ul>
        </section>
      )}

      {locked.length > 0 && (
        <section className="flex flex-col gap-3">
          <Eyebrow>Por desbloquear</Eyebrow>
          <ul className={ARCADE_GRID_CLASS}>
            {locked.map((game) => (
              <li key={game.id}>
                <LockedTile game={game} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Crear `components/play/arcade-skeleton.tsx`**

```tsx
"use client";

import { ARCADE_GRID_CLASS } from "./arcade-grid";
import {
  HERO_ART_BOX,
  HERO_EYEBROW_H,
  HERO_H,
  HERO_NAME_H,
  HERO_STATUS_H,
} from "./daily-hero";
import { TILE_ART_BOX, TILE_H, TILE_LABEL_H } from "./game-tile";

/**
 * Esqueleto de carga. Calca la retícula real usando las MISMAS constantes que
 * los tiles y el mismo `grid`, no medidas parecidas: el esqueleto anterior
 * dibujaba tarjetas de otra forma y la pantalla saltaba al llegar los datos
 * (spec §4: "el skeleton replica exactamente la retícula real").
 */

const PULSE = "animate-pulse rounded-full bg-(--surface-2)";

/** Diez arcade: los doce juegos menos los dos diarios, que son héroes. */
const ARCADE_SLOTS = 10;

export default function ArcadeSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-hidden>
      <ul className="grid grid-cols-2 gap-3">
        {[0, 1].map((i) => (
          <li key={i} className="flex flex-col items-center gap-1.5" style={{ height: HERO_H }}>
            <span className={PULSE} style={{ height: HERO_ART_BOX, width: HERO_ART_BOX }} />
            <span className={`${PULSE} w-16`} style={{ height: HERO_EYEBROW_H }} />
            <span className={`${PULSE} w-24`} style={{ height: HERO_NAME_H }} />
            <span className={`${PULSE} w-20`} style={{ height: HERO_STATUS_H }} />
          </li>
        ))}
      </ul>

      <div className="flex flex-col gap-3">
        <span className={`${PULSE} w-20`} style={{ height: 14 }} />
        <ul className={ARCADE_GRID_CLASS}>
          {Array.from({ length: ARCADE_SLOTS }, (_, i) => (
            <li key={i} className="flex flex-col items-center gap-1.5" style={{ height: TILE_H }}>
              <span className={PULSE} style={{ height: TILE_ART_BOX, width: TILE_ART_BOX }} />
              <span className={`${PULSE} w-14`} style={{ height: TILE_LABEL_H / 2 }} />
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Verificar tipos y lint**

```bash
source ~/.nvm/nvm.sh && nvm use && npx tsc --noEmit && npx eslint components/play/arcade-grid.tsx components/play/arcade-skeleton.tsx
```

Esperado: sin errores.

- [ ] **Step 4: Commit**

```bash
git add components/play/arcade-grid.tsx components/play/arcade-skeleton.tsx
git commit -m "feat(arcade): rejilla pura de tres bloques y esqueleto que calca su geometría

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 5: Contenedor con fetch y `router.push`, página nueva y retirada de la excepción legacy

**Files:**
- Create: `components/play/arcade-container.tsx`
- Modify: `app/(app)/(hub)/play/page.tsx` (reescritura completa, 22 líneas)
- Modify: `CLAUDE.md` (regla 1: quitar la excepción legacy)
- Delete: `components/play/games-grid.tsx`, `components/play/games-grid-view.tsx`

**Interfaces:**
- Consumes de Task 1: `DAILY_PATHS`, `type DailyState`, `type BadgeContext`. De Task 2: `readCurrentUserId()`. De Task 3: `ArcadeHeader`. De Task 4: `ArcadeGrid`, `ArcadeSkeleton`.
- Produces: `ArcadeContainer` (default export) sin props, montado por la página.

- [ ] **Step 1: Crear `components/play/arcade-container.tsx`**

```tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import Doty from "@/components/ui/doty/doty";
import UIButton from "@/components/ui/button/button";
import { DAILY_PATHS, type BadgeContext, type DailyState } from "@/lib/arcade";
import { readCurrentUserId } from "@/lib/current-user";
import {
  getCrosswordService,
  getGameRecordsService,
  getGamesService,
  getWordleService,
  type Game,
  type GameRecord,
} from "@/services/games.service";
import { getTournamentService } from "@/services/tournament.service";
import ArcadeGrid from "./arcade-grid";
import ArcadeSkeleton from "./arcade-skeleton";

/** Lo que adorna la rejilla pero nunca la bloquea: badges y estado de hoy. */
interface Extras {
  records: GameRecord[];
  tournamentPath: string | null;
  dailyStates: Record<string, DailyState | null>;
}

const NO_EXTRAS: Extras = {
  records: [],
  tournamentPath: null,
  dailyStates: { [DAILY_PATHS[0]]: null, [DAILY_PATHS[1]]: null },
};

export default function ArcadeContainer() {
  const router = useRouter();
  const [games, setGames] = useState<Game[] | null>(null);
  const [extras, setExtras] = useState<Extras>(NO_EXTRAS);
  const [loadError, setLoadError] = useState(false);
  // Patrón fetchAttempt (regla 3): el botón sube el contador, el efecto solo fetchea.
  const [attempt, setAttempt] = useState(0);

  // La lista es lo único obligatorio: sin ella no hay pantalla.
  useEffect(() => {
    let active = true;
    getGamesService()
      .then((data) => {
        if (active) setGames(data);
      })
      .catch(() => {
        if (active) setLoadError(true);
      });
    return () => {
      active = false;
    };
  }, [attempt]);

  // Badges y estado de hoy: decoran la rejilla y no deben retrasarla ni
  // romperla. Cada fuente cae a su valor neutro por separado.
  useEffect(() => {
    let active = true;
    Promise.all([
      getGameRecordsService(),
      getTournamentService(),
      getWordleService().catch(() => null),
      getCrosswordService().catch(() => null),
    ]).then(([records, tournament, wordle, crossword]) => {
      if (!active) return;
      setExtras({
        records,
        tournamentPath: tournament?.gamePath ?? null,
        dailyStates: {
          [DAILY_PATHS[0]]: wordle ? { done: wordle.done, won: wordle.won } : null,
          [DAILY_PATHS[1]]: crossword ? { done: crossword.done, won: crossword.won } : null,
        },
      });
    });
    return () => {
      active = false;
    };
  }, [attempt]);

  const retry = () => {
    setLoadError(false);
    setGames(null);
    setExtras(NO_EXTRAS);
    setAttempt((n) => n + 1);
  };

  // Regla 1: router.push. La grilla vieja usaba window.location.assign como
  // excepción legacy; recargaba la app entera y tiraba el token en memoria.
  const open = (path: string) => router.push(`/games${path}`);

  if (loadError) {
    return (
      <div className="dots-card flex flex-col items-center gap-4 px-6 py-10 text-center">
        <Doty pose="decepcionado" size="tiny" />
        <p className="font-display text-base font-extrabold text-foreground">
          No pudimos cargar los juegos
        </p>
        <p className="max-w-xs text-sm font-semibold text-(--muted)">
          Revisa tu conexión y vuelve a intentarlo.
        </p>
        <UIButton onClick={retry}>Reintentar</UIButton>
      </div>
    );
  }

  if (games === null) return <ArcadeSkeleton />;

  if (games.length === 0) {
    return (
      <div className="dots-card flex flex-col items-center gap-3 px-6 py-10 text-center">
        <Doty pose="timido" size="tiny" />
        <p className="text-sm font-semibold text-(--muted)">Pronto habrá juegos aquí.</p>
      </div>
    );
  }

  const badgeContext: BadgeContext = {
    records: extras.records,
    currentUserId: readCurrentUserId(),
    tournamentPath: extras.tournamentPath,
  };

  return (
    <ArcadeGrid
      games={games}
      badgeContext={badgeContext}
      dailyStates={extras.dailyStates}
      onOpen={open}
    />
  );
}
```

- [ ] **Step 2: Reescribir `app/(app)/(hub)/play/page.tsx`**

```tsx
import ArcadeContainer from "@/components/play/arcade-container";
import ArcadeHeader from "@/components/play/arcade-header";

/**
 * Arcade (spec §4). El chrome (nav + HUD) lo pone el layout del grupo hub.
 * La cabecera es un componente aparte porque monta Doty (cliente) y la página
 * se queda como server component.
 */
export default function PlayPage() {
  return (
    <div className="flex flex-col gap-6">
      <ArcadeHeader />
      <ArcadeContainer />
    </div>
  );
}
```

- [ ] **Step 3: Borrar la grilla vieja**

```bash
git rm components/play/games-grid.tsx components/play/games-grid-view.tsx
```

- [ ] **Step 4: Quitar la excepción legacy del `CLAUDE.md`**

En la regla 1, sustituye la línea completa:

```markdown
1. **Navegación con `router.push`, nunca `window.location.*`** — recarga la página y pierde el token en memoria. (Excepción legacy aceptada: games-list usa `window.location.assign`.)
```

por:

```markdown
1. **Navegación con `router.push`, nunca `window.location.*`** — recarga la página y pierde el token en memoria. Sin excepciones en código de producto: la última (la grilla de juegos) cayó en el subproyecto C. `lib/api-client.ts` sí usa `window.location.replace("/")` al expirar la sesión, y ahí es lo correcto: una recarga limpia es justo lo que se busca.
```

- [ ] **Step 5: Verificar que no queda ningún `window.location` de navegación**

```bash
grep -rn "window.location" --include='*.tsx' --include='*.ts' components app lib hooks services
```

Esperado: exactamente tres resultados, todos legítimos — `components/admin/invitations-tab.tsx` (construye un enlace de invitación, no navega) y las dos líneas de `lib/api-client.ts` (comentario + la recarga de sesión expirada). **Ninguno en `components/play/`.**

- [ ] **Step 6: Verificación completa**

```bash
source ~/.nvm/nvm.sh && nvm use && npm run lint && npm run test:scripts && npx next build
```

Esperado: lint limpio, todos los tests en verde y build sin errores.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat(arcade): /play v2 — contenedor con router.push, página nueva y fin de la excepción legacy de window.location

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 6: Verificación en el navegador, documentación y corrección del spec

**Files:**
- Modify: `docs/ARQUITECTURA.md` (fila de `/play` en la tabla de rutas y una sección del arcade)
- Modify: `docs/superpowers/specs/2026-09-14-rediseno-look-and-feel-juvenil-design.md` (§4: copy del XP y tercer estado del diario)

**Interfaces:**
- Consumes: la pantalla terminada de las Tasks 1–5.
- Produces: nada que consuma código.

- [ ] **Step 1: Levantar el preview y abrir `/play`**

El dev server se levanta con el preview del worktree (nunca con Bash) y se apaga al terminar. Con el backend en `:4000` corriendo, abre `/play` con sesión iniciada.

- [ ] **Step 2: Medir los criterios de aceptación del spec §4**

Mide en el navegador, no a ojo, y anota el número de cada uno:

1. **Doce juegos en una pantalla y media a 390 px.** Con el viewport en 390 × 812, mide `document.body.scrollHeight` contra `window.innerHeight`. Esperado: menos de 1.5 veces.
2. **Arte de tile a 82 px y héroe a 96 px.** `getBoundingClientRect().width` de una imagen de cada bloque.
3. **Entrar a un juego no recarga la app.** Guarda un valor en `window` (`window.__sinRecarga = 1`), toca un tile, y comprueba que sigue ahí en la página del juego. Si la navegación fuera `window.location`, se habría perdido.
4. **El badge de trono coincide con `GET /games/records`.** Compara las coronas que se ven contra la respuesta real del endpoint y el id del usuario.
5. **El esqueleto no salta.** Recarga con la red ralentizada y comprueba que la posición vertical del primer tile del arcade no cambia entre el esqueleto y la rejilla cargada.
6. **Tres y seis columnas.** Repite a 390 px y a 1280 px.
7. **Estado del diario.** Comprueba la línea de cada héroe contra `GET /games/wordle` y `GET /games/crossword`.

Si algo no cuadra, se arregla en esta tarea antes de documentar.

- [ ] **Step 3: Actualizar `docs/ARQUITECTURA.md`**

En la tabla de rutas, la fila de Juegos dice hoy `| Juegos | \`/play\` | Lista de juegos con candados por niveles completados. |`. Sustitúyela por:

```markdown
| Juegos | `/play` | Arcade: dos héroes diarios con su estado de hoy, tiles de arte flotante con badges de trono y torneo, y bloqueados en gris. |
```

Y añade al final de la sección de los 12 juegos un párrafo corto:

```markdown
### El arcade (`/play`)

`components/play/arcade-container.tsx` pide la lista (`GET /games`, obligatoria) y en
paralelo lo que solo decora: récords globales, torneo de la semana y el estado de
hoy de los dos diarios. Ninguna de esas cuatro retrasa la rejilla ni la rompe si
falla. El reparto en bloques, la clave de juego, los badges y el copy del estado
diario viven en `lib/arcade.ts`, que es puro y está bajo `node --test`. Los tiles
exportan su geometría para que `arcade-skeleton.tsx` calque la retícula real en vez
de aproximarla. Se entra a un juego con `router.push`: la excepción legacy de
`window.location.assign` murió aquí.
```

- [ ] **Step 4: Corregir el spec §4**

En la sección `## 4. Subproyecto C — /play v2, "Arcade"`, sustituye la viñeta de los héroes diarios:

```markdown
- **Héroes diarios** (Wordle, Crucigrama): arte de 96 px centrado, eyebrow "Nuevo cada día" en
  `--accent`, nombre Baloo y estado: "Hecho por hoy" con check verde o "Sin resolver · +40 XP".
```

por:

```markdown
- **Héroes diarios** (Wordle, Crucigrama): arte de 96 px centrado, eyebrow "Nuevo cada día" en
  `--accent`, nombre Baloo y estado, en tres casos: "Hecho por hoy" con check verde si lo
  resolvió; "Vuelve mañana" si agotó los intentos sin resolverlo (el spec original no contemplaba
  este caso, y "Sin resolver" invitaría a algo imposible hasta mañana); y "Sin resolver · hasta
  +40 XP" si sigue abierto. **"hasta"**: el backend da `XP_PER_GAME_PLAY` = 15 por partida y
  `XP_NEW_HIGH_SCORE_BONUS` = 25 más solo si el score supera el récord personal, así que 40 es el
  máximo y no lo que se lleva cada partida.
```

- [ ] **Step 5: Verificación final**

```bash
source ~/.nvm/nvm.sh && nvm use && npm run lint && npm run test:scripts && npx next build
```

Esperado: lint limpio, tests en verde, build sin errores.

- [ ] **Step 6: Commit**

```bash
git add docs/ARQUITECTURA.md docs/superpowers/specs/2026-09-14-rediseno-look-and-feel-juvenil-design.md
git commit -m "docs(arcade): ARQUITECTURA describe /play v2 y el spec corrige el XP del diario y su tercer estado

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

## Cobertura del spec §4

| Requisito del spec | Dónde se implementa |
|---|---|
| Título "Arcade", subtítulo "XP sin sufrir.", Doty `gamer` (fallback `en-celular`) 104 px a la derecha, visible en móvil | Task 3, `arcade-header.tsx` (tamaño `section` = 104) |
| Tiles flotantes variante B: arte 82 px, sombra de piso, sin mancha, sin caja | Task 2, `game-tile.tsx` + `.dots-floor-shadow` |
| Nombre debajo, 12.5 px, peso 800 | Task 2, `game-tile.tsx` (`text-[12.5px] font-extrabold`) |
| Tres por fila en móvil, cinco en `md`, seis en `lg` | Task 4, constante `GRID` |
| Héroes diarios: arte 96 px, eyebrow "Nuevo cada día" en `--accent`, nombre Baloo, estado | Task 3, `daily-hero.tsx` |
| Badges 28 px arriba a la derecha: corona si el trono es del usuario, trofeo si es el juego del torneo | Task 1 (`badgesFor`) + Task 2 (`game-tile.tsx`) |
| La medalla de récord reciente queda fuera | No se implementa: fuera de alcance por §9 |
| "Por desbloquear": arte gris al 35 % con candado y "faltan N niveles", no tocable | Task 2, `locked-tile.tsx` (es un `div`, no un botón) |
| Navegación con `router.push('/games' + path)`; se elimina `window.location.assign` y la excepción del CLAUDE.md | Task 5 |
| El skeleton replica exactamente la retícula real | Task 4, `arcade-skeleton.tsx` con las constantes de los tiles |
| Criterio: doce juegos en pantalla y media a 390 px | Task 6, paso 2.1 |
| Criterio: entrar a un juego no recarga la app ni pierde el token | Task 6, paso 2.3 |
| Criterio: el badge de trono coincide con `GET /games/records` | Task 6, paso 2.4 |

**Nada del spec §4 queda sin tarea.** Lo único que se aparta del texto literal del spec es el copy del XP del diario y el tercer estado, ambos corregidos en el propio spec por la Task 6 con la razón medida en el backend.
