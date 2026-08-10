# Dot Bombs 2.0 (anagrama tap) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reescribir dot-bombs para que se juegue con fichas de anagrama (tap) en vez de teclear, cumpliendo todas las convenciones modernas del repo.

**Architecture:** Dos módulos puros colocados junto a la página (`anagram.ts` para la bandeja de letras, `engine.ts` para la caída/dificultad/score) y una página que solo cablea: fetch → GameIntro → selector de modo → loop con `useTicker` → GameResult. El estado del motor vive en refs; cada tick hace un snapshot a estado para render.

**Tech Stack:** Next.js 16 (app router), React 19, Tailwind 4 + tokens de `app/globals.css`, `useTicker` (rAF), GameIntro/GameResult compartidos.

**Spec:** `docs/superpowers/specs/2026-08-10-dot-bombs-anagram-redesign.md` (aprobado).

## Global Constraints

- **RN-safe (regla 2 CLAUDE.md)**: solo `onPointerUp`/`onClick`; sin keydown, sin `<input>`, sin canvas, sin Drag API, sin hover-como-señal. Animación SOLO `transform`/`opacity` + ticks rAF. La caída usa `transform: translateY`, nunca `top`.
- **UI en español, tono juguetón.** El contenido a aprender (las palabras) queda en inglés.
- **Regla 1**: navegación con `router.push("/play")`. Nada de `window.location.*`.
- **Regla 3**: prohibido `setState` síncrono en cuerpo de `useEffect` y efectos colaterales dentro de updaters de `setState`.
- **Regla 4**: el score se envía SOLO vía `GameResult`. `finalScore` se setea EN EL MISMO commit que `setPhase("result")` (lección de memory: los efectos del hijo corren antes que los del padre; calcularlo tarde envía 0).
- **Regla 5**: `loadError` + Reintentar con patrón `fetchAttempt`.
- **Sin test runner de componentes.** El ciclo de verificación por tarea es: `source ~/.nvm/nvm.sh && npm run lint && npx tsc --noEmit` (mecánico) + **banco de pruebas**: ruta temporal `app/dev-juice/page.tsx` (fuera del grupo `(app)`, sin auth ni backend) que importa los módulos, corre aserciones y pinta el resultado en el DOM; se lee con las herramientas de preview (`javascript_tool`). El banco NUNCA se commitea: cada commit añade rutas exactas con `git add <paths>`, jamás `git add -A`/`git add .`. La ruta se borra en la Task 6.
- **`source ~/.nvm/nvm.sh` SIEMPRE antes de node/npm** (Node 22 vía nvm).
- Los valores de dificultad/aceleración de `DIFFICULTY` son puntos de partida del spec; se calibran jugando antes del commit final (Task 6) sin cambiar su forma.

## File Structure

- `app/(app)/games/dot-bombs/anagram.ts` — **crear**. Lógica pura de la bandeja: `buildTray`, `tapChip`, tipos. Sin React, sin DOM (portable a RN tal cual).
- `app/(app)/games/dot-bombs/engine.ts` — **crear**. Lógica pura de caída y balance: `DIFFICULTY`, `stepBombs`, `bombScore`, `survivalMultiplier`, tipos. Sin React, sin DOM.
- `app/(app)/games/dot-bombs/page.tsx` — **reescribir completo**. Página fina: fases, fetch, HUD, render de bombas y bandeja, GameIntro/GameResult.
- `services/games.service.ts` — **modificar**: `getGameWordsService(seed?)`.
- `docs/ARQUITECTURA.md`, `plans/README.md` — **modificar** al final (Task 6).

---

### Task 1: Módulo puro `anagram.ts`

**Files:**
- Create: `app/(app)/games/dot-bombs/anagram.ts`
- Test (banco): `app/dev-juice/page.tsx` (temporal, NO se commitea)

**Interfaces:**
- Consumes: nada (módulo hoja, sin imports).
- Produces (Tasks 4-5 dependen de esto, firmas exactas):
  - `type Rng = () => number`
  - `type TrayChip = { id: number; char: string; used: boolean; decoy: boolean }`
  - `type TrayState = { word: string; display: string[]; nextSlot: number; chips: TrayChip[] }`
  - `type TapResult = "progress" | "wrong" | "complete" | "noop"`
  - `buildTray(word: string, decoys: number, rng: Rng): TrayState`
  - `tapChip(state: TrayState, chipId: number): { state: TrayState; result: TapResult }`

- [ ] **Step 1: Escribir el módulo**

```ts
// app/(app)/games/dot-bombs/anagram.ts
// Lógica pura de la bandeja de anagrama. Sin React ni DOM: portable a RN.

export type Rng = () => number; // [0,1) — inyectable (seed/tests)

export type TrayChip = {
  id: number; // estable dentro de la bandeja (índice de creación)
  char: string; // minúscula
  used: boolean; // ya colocada en la palabra
  decoy: boolean; // señuelo: no pertenece a la palabra
};

export type TrayState = {
  word: string; // objetivo, en minúsculas
  /** Huecos de la palabra: char ya colocado o "" pendiente.
   *  Los caracteres fuera de [a-z] (espacios, guiones) vienen PRE-colocados. */
  display: string[];
  nextSlot: number; // índice del siguiente hueco pendiente; -1 = completa
  chips: TrayChip[];
};

export type TapResult = "progress" | "wrong" | "complete" | "noop";

const ALPHABET = "abcdefghijklmnopqrstuvwxyz";

function isLetter(ch: string): boolean {
  return ch >= "a" && ch <= "z";
}

/** Fisher-Yates con rng inyectado (muta la copia local, no el argumento). */
function shuffleWith<T>(arr: T[], rng: Rng): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/** Primer hueco pendiente desde `from` (saltando pre-colocados). -1 si no queda. */
function nextPendingSlot(display: string[], word: string, from: number): number {
  for (let i = from; i < word.length; i++) {
    if (display[i] === "") return i;
  }
  return -1;
}

export function buildTray(word: string, decoys: number, rng: Rng): TrayState {
  const target = word.toLowerCase();
  const display = Array.from(target, (ch) => (isLetter(ch) ? "" : ch));

  const letters = Array.from(target).filter(isLetter);
  const wordSet = new Set(letters);
  const decoyPool = Array.from(ALPHABET).filter((ch) => !wordSet.has(ch));
  const chosen = shuffleWith(decoyPool, rng).slice(0, Math.max(0, decoys));

  const chips: TrayChip[] = shuffleWith(
    [
      ...letters.map((char) => ({ char, decoy: false })),
      ...chosen.map((char) => ({ char, decoy: true })),
    ],
    rng,
  ).map((c, id) => ({ id, char: c.char, used: false, decoy: c.decoy }));

  return {
    word: target,
    display,
    nextSlot: nextPendingSlot(display, target, 0),
    chips,
  };
}

export function tapChip(
  state: TrayState,
  chipId: number,
): { state: TrayState; result: TapResult } {
  const chip = state.chips.find((c) => c.id === chipId);
  // Ficha inexistente/usada o palabra ya completa: no-op (la UI deshabilita,
  // esto es el guard de fondo)
  if (!chip || chip.used || state.nextSlot === -1) {
    return { state, result: "noop" };
  }
  if (chip.char !== state.word[state.nextSlot]) {
    return { state, result: "wrong" };
  }

  const display = [...state.display];
  display[state.nextSlot] = chip.char;
  const next: TrayState = {
    ...state,
    display,
    nextSlot: nextPendingSlot(display, state.word, state.nextSlot + 1),
    chips: state.chips.map((c) => (c.id === chipId ? { ...c, used: true } : c)),
  };
  return { state: next, result: next.nextSlot === -1 ? "complete" : "progress" };
}
```

- [ ] **Step 2: Banco de pruebas que falla primero**

Crear `app/dev-juice/page.tsx`. El banco corre los casos y pinta `PASS`/`FAIL` por aserción; antes de crear `anagram.ts` el import ni compila (equivalente a "test rojo": `npx tsc --noEmit` DEBE fallar con "Cannot find module" si haces este paso antes del Step 1 — hazlo así: escribe el banco primero, mira fallar tsc, luego escribe el módulo).

```tsx
"use client";
// BANCO TEMPORAL — NO COMMITEAR. Se borra en Task 6.
import React from "react";
import { buildTray, tapChip } from "@/app/(app)/games/dot-bombs/anagram";

// rng determinista (mulberry32) para aserciones estables
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Check = { name: string; pass: boolean; detail?: string };

function run(): Check[] {
  const out: Check[] = [];
  const t = (name: string, pass: boolean, detail = "") => out.push({ name, pass, detail });

  // 1. balloon: 7 letras, dos 'l' intercambiables
  let s = buildTray("balloon", 0, mulberry32(42));
  t("balloon: 7 chips sin señuelos", s.chips.length === 7);
  t("balloon: nextSlot arranca en 0", s.nextSlot === 0);
  const bId = s.chips.find((c) => c.char === "b")!.id;
  let r = tapChip(s, bId);
  t("tap 'b' progresa", r.result === "progress" && r.state.display[0] === "b");
  const aId = r.state.chips.find((c) => c.char === "a" && !c.used)!.id;
  r = tapChip(r.state, aId);
  const lIds = r.state.chips.filter((c) => c.char === "l" && !c.used).map((c) => c.id);
  t("hay dos 'l' disponibles", lIds.length === 2);
  const rA = tapChip(r.state, lIds[0]);
  const rB = tapChip(r.state, lIds[1]);
  t("cualquiera de las dos 'l' vale", rA.result === "progress" && rB.result === "progress");

  // 2. ficha equivocada
  s = buildTray("cat", 0, mulberry32(1));
  const tId = s.chips.find((c) => c.char === "t")!.id;
  t("'t' primero es wrong", tapChip(s, tId).result === "wrong");
  t("wrong no muta display", tapChip(s, tId).state.display.join("") === "");

  // 3. completar
  s = buildTray("go", 0, mulberry32(7));
  r = tapChip(s, s.chips.find((c) => c.char === "g")!.id);
  r = tapChip(r.state, r.state.chips.find((c) => c.char === "o" && !c.used)!.id);
  t("'go' completa", r.result === "complete" && r.state.nextSlot === -1);
  t("tap tras completar es noop", tapChip(r.state, 0).result === "noop");

  // 4. señuelos
  s = buildTray("sun", 2, mulberry32(3));
  t("sun+2: 5 chips", s.chips.length === 5);
  t("2 señuelos fuera de la palabra", s.chips.filter((c) => c.decoy).length === 2 &&
    s.chips.filter((c) => c.decoy).every((c) => !"sun".includes(c.char)));

  // 5. caracteres especiales pre-colocados
  s = buildTray("ice cream", 0, mulberry32(9));
  t("espacio pre-colocado", s.display[3] === " " && s.chips.length === 8);
  // completa "ice" y verifica que nextSlot salta el espacio (índice 3 → 4)
  r = tapChip(s, s.chips.find((c) => c.char === "i" && !c.used)!.id);
  r = tapChip(r.state, r.state.chips.find((c) => c.char === "c" && !c.used)!.id);
  r = tapChip(r.state, r.state.chips.find((c) => c.char === "e" && !c.used)!.id);
  t("nextSlot salta el espacio", r.state.nextSlot === 4);

  // 6. chip usado es noop
  s = buildTray("cat", 0, mulberry32(1));
  const cId = s.chips.find((c) => c.char === "c")!.id;
  r = tapChip(s, cId);
  t("re-tap de ficha usada es noop", tapChip(r.state, cId).result === "noop");

  return out;
}

export default function DevJuicePage() {
  const checks = run();
  const failed = checks.filter((c) => !c.pass);
  return (
    <div className="p-6 flex flex-col gap-1">
      <h1 data-testid="verdict" className="font-bold">
        {failed.length === 0 ? `PASS (${checks.length})` : `FAIL (${failed.length}/${checks.length})`}
      </h1>
      {checks.map((c, i) => (
        <p key={i} data-testid={c.pass ? "pass" : "fail"}>
          {c.pass ? "✓" : "✗"} {c.name} {c.detail}
        </p>
      ))}
    </div>
  );
}
```

- [ ] **Step 3: Verificar en rojo y luego en verde**

Rojo (banco sin módulo): `source ~/.nvm/nvm.sh && npx tsc --noEmit` → `error TS2307: Cannot find module '.../anagram'`.
Verde (con el módulo del Step 1): `npm run lint && npx tsc --noEmit` → sin errores. Levantar preview (`preview_start` con `dots-webapp`), navegar a `/dev-juice` y leer con `javascript_tool`: `document.querySelector("[data-testid='verdict']").textContent` → `PASS (14)` (14 aserciones; si añades alguna, ajusta el conteo esperado). Cero elementos `[data-testid='fail']`.

- [ ] **Step 4: Commit (solo el módulo)**

```bash
git add "app/(app)/games/dot-bombs/anagram.ts"
git commit -m "feat(dot-bombs): módulo puro de bandeja de anagrama"
```

---

### Task 2: Módulo puro `engine.ts`

**Files:**
- Create: `app/(app)/games/dot-bombs/engine.ts`
- Test (banco): sustituir el contenido de `run()` en `app/dev-juice/page.tsx`

**Interfaces:**
- Consumes: nada.
- Produces (Tasks 4-5 dependen de esto, firmas exactas):
  - `type GameMode = "easy" | "medium" | "hard" | "survival"`
  - `type Bomb = { id: number; word: string; img: string | null; y: number; speed: number }`
  - `type EngineConfig = { fallSeconds: number; maxBombs: number; spawnEveryMs: number; accelPerSecond: number; decoys: number; multiplier: number; winAt: number | null }`
  - `DIFFICULTY: Record<GameMode, EngineConfig>`
  - `stepBombs(bombs: Bomb[], dtMs: number, speedMult: number): { bombs: Bomb[]; landed: Bomb[] }`
  - `bombScore(multiplier: number, y: number, combo: number): number`
  - `survivalMultiplier(survivedSeconds: number): number`

- [ ] **Step 1: Banco en rojo**

Reemplazar `run()` e imports del banco por los casos de abajo; `npx tsc --noEmit` debe fallar con `Cannot find module '.../engine'`.

```tsx
// imports del banco (reemplazan a los de anagram):
import {
  DIFFICULTY,
  stepBombs,
  bombScore,
  survivalMultiplier,
  type Bomb,
} from "@/app/(app)/games/dot-bombs/engine";

function run(): Check[] {
  const out: Check[] = [];
  const t = (name: string, pass: boolean, detail = "") => out.push({ name, pass, detail });

  const mk = (id: number, y: number, speed = 1 / 12): Bomb =>
    ({ id, word: "w", img: null, y, speed });

  // 1. avance proporcional a dt y speedMult
  let r = stepBombs([mk(1, 0)], 1000, 1);
  t("1s a 1/12: y=+0.0833", Math.abs(r.bombs[0].y - 1 / 12) < 1e-9, String(r.bombs[0].y));
  r = stepBombs([mk(1, 0)], 1000, 2);
  t("speedMult 2 dobla el avance", Math.abs(r.bombs[0].y - 2 / 12) < 1e-9);

  // 2. TODOS los aterrizajes del mismo tick cuentan (fix del bug de vidas)
  r = stepBombs([mk(1, 0.99), mk(2, 0.995), mk(3, 0.2)], 1000, 1);
  t("dos aterrizan en el mismo tick", r.landed.length === 2 &&
    r.landed.map((b) => b.id).sort().join() === "1,2");
  t("la viva sigue en juego", r.bombs.length === 1 && r.bombs[0].id === 3);

  // 3. el argumento no se muta
  const src = [mk(9, 0.5)];
  stepBombs(src, 1000, 1);
  t("stepBombs es puro", src[0].y === 0.5);

  // 4. score: alto paga más, combo topa en x2
  t("suelo (y=1) = base*mult", bombScore(3, 1, 0) === 300);
  t("cielo (y=0) = base*mult*1.5", bombScore(3, 0, 0) === 450);
  t("combo 5 = +50%", bombScore(1, 1, 5) === 150);
  t("combo topa en x2", bombScore(1, 1, 99) === 200);

  // 5. survival multiplier: +0.1 cada 30s, tope x3
  t("0s → x1", survivalMultiplier(0) === 1);
  t("59s → x1.1", Math.abs(survivalMultiplier(59) - 1.1) < 1e-9);
  t("600s → tope x3", survivalMultiplier(600) === 3);

  // 6. tabla de dificultad coherente con el spec
  t("hard paga x3 y easy x1",
    DIFFICULTY.hard.multiplier === 3 && DIFFICULTY.easy.multiplier === 1);
  t("hard tiene señuelos", DIFFICULTY.hard.decoys === 2);
  t("normal gana a las 20; survival no tiene meta",
    DIFFICULTY.easy.winAt === 20 && DIFFICULTY.survival.winAt === null);
  t("solo survival acelera", DIFFICULTY.survival.accelPerSecond > 0 &&
    DIFFICULTY.easy.accelPerSecond === 0);

  return out;
}
```

- [ ] **Step 2: Escribir el módulo**

```ts
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

/** 100 × mult × bonus de altura [1..1.5] × combo [1..2], redondeado.
 *  y=0 (recién salida) paga 1.5; y=1 (al ras) paga 1. */
export function bombScore(multiplier: number, y: number, combo: number): number {
  const height = 1 + 0.5 * Math.min(1, Math.max(0, 1 - y));
  const comboMult = Math.min(2, 1 + 0.1 * combo);
  return Math.round(100 * multiplier * height * comboMult);
}

/** Survival: ×1 base, +0.1 por cada 30 s sobrevividos, tope ×3 (spec). */
export function survivalMultiplier(survivedSeconds: number): number {
  return Math.min(3, 1 + 0.1 * Math.floor(survivedSeconds / 30));
}
```

- [ ] **Step 3: Verificar en verde**

`source ~/.nvm/nvm.sh && npm run lint && npx tsc --noEmit` sin errores. En `/dev-juice` (recargar): `verdict` → `PASS (15)` y cero `[data-testid='fail']`.

- [ ] **Step 4: Commit (solo el módulo)**

```bash
git add "app/(app)/games/dot-bombs/engine.ts"
git commit -m "feat(dot-bombs): motor puro de caída, dificultad y score"
```

---

### Task 3: Esqueleto de página — fetch, fases, intro, selector de modo, result

**Files:**
- Modify: `services/games.service.ts:66-69` (seed opcional)
- Modify (reescritura completa): `app/(app)/games/dot-bombs/page.tsx`

**Interfaces:**
- Consumes: `GameIntro` y `GameResult` de `components/games/shared/` (props conocidas: GameIntro `{emoji,title,howTo,record,throne,onStart}`; GameResult `{gameKey,score,onReplay,onExit,extra?}`), `useGameRecords("dot-bombs")`, `getGameWordsService(seed?)` → `GameWord[] {id,title,src,answered}`, `DIFFICULTY`/`GameMode` de `./engine`.
- Produces: la página con `type Phase = "intro" | "modes" | "playing" | "result"` y los hooks/estado que Task 4-5 completan: `wordsRef`, `phase`, `mode`, `lives`, `defusedCount`, `finalScore`, `startGame(mode: GameMode)`. La zona de juego renderiza un placeholder `data-testid="battlefield"`.

- [ ] **Step 1: Seed opcional en el fetcher**

En `services/games.service.ts` reemplazar:

```ts
export async function getGameWordsService(): Promise<GameWord[]> {
  const { data } = await api.get<GameWord[]>("/games/words");
  return data;
}
```

por:

```ts
// seed: aceptado desde ya en el cliente (torneo/reto); el backend hoy lo
// ignora — soporte real pendiente en dots-backend
export async function getGameWordsService(seed?: number): Promise<GameWord[]> {
  const { data } = await api.get<GameWord[]>("/games/words", {
    params: seed !== undefined ? { seed } : undefined,
  });
  return data;
}
```

- [ ] **Step 2: Reescribir `page.tsx` (esqueleto completo)**

Sustituir TODO el archivo por:

```tsx
"use client";

import React, {
  Suspense,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";
import GameIntro from "@/components/games/shared/game-intro";
import GameResult from "@/components/games/shared/game-result";
import Spinner from "@/components/ui/Spinner/Spinner";
import { getGameWordsService, type GameWord } from "@/services/games.service";
import { useGameRecords } from "@/hooks/use-game-records";
import { DIFFICULTY, type GameMode } from "./engine";

// ── Constantes ────────────────────────────────────────────────────────────────

const MAX_LIVES = 5;

type Phase = "intro" | "modes" | "playing" | "result";

const MODE_LABEL: Record<GameMode, { name: string; desc: string; emoji: string }> = {
  easy: { name: "Tranqui", desc: "2 bombas lentas · ×1", emoji: "🙂" },
  medium: { name: "Serio", desc: "3 bombas · ×2", emoji: "😮" },
  hard: { name: "Caos", desc: "4 bombas + letras trampa · ×3", emoji: "🤯" },
  survival: { name: "Survival", desc: "Sin final, cada vez más rápido", emoji: "🔥" },
};

// ── Lector de seed (dentro del boundary de Suspense) ─────────────────────────

function DotBombsGame() {
  const searchParams = useSearchParams();
  const seedParam = searchParams.get("seed");
  const seed =
    seedParam !== null && seedParam !== "" ? parseInt(seedParam, 10) : undefined;
  return <DotBombsInner seed={seed} />;
}

// ── Componente principal ──────────────────────────────────────────────────────

function DotBombsInner({ seed }: { seed?: number }) {
  const router = useRouter();
  const { record, throne } = useGameRecords("dot-bombs");

  const [phase, setPhase] = useState<Phase>("intro");
  const [mode, setMode] = useState<GameMode>("easy");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [finalScore, setFinalScore] = useState(0);
  const [lives, setLives] = useState(MAX_LIVES);
  const [defusedCount, setDefusedCount] = useState(0);
  const [score, setScore] = useState(0);

  const wordsRef = useRef<GameWord[]>([]);

  // Fetch con patrón fetchAttempt (regla 5): el botón solo bumpea el contador
  const [fetchAttempt, setFetchAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    getGameWordsService(seed)
      .then((data) => {
        if (!active) return;
        wordsRef.current = data.filter((w) => w.title && w.title.trim() !== "");
        if (wordsRef.current.length === 0) setLoadError(true);
      })
      .catch(() => {
        if (active) setLoadError(true);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [seed, fetchAttempt]);

  const startGame = useCallback((m: GameMode) => {
    setMode(m);
    setLives(MAX_LIVES);
    setDefusedCount(0);
    setScore(0);
    setFinalScore(0);
    setPhase("playing");
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner title="Cargando palabras…" />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="text-lg font-bold" style={{ color: "var(--foreground)" }}>
          No se pudieron cargar las palabras.
        </p>
        <p className="text-sm" style={{ color: "var(--muted)" }}>
          Comprueba tu conexión e inténtalo de nuevo.
        </p>
        <button
          onPointerUp={() => {
            setLoadError(false);
            setLoading(true);
            setFetchAttempt((n) => n + 1);
          }}
          className="dots-pressable rounded-2xl px-6 py-3 text-sm font-bold"
          style={{ background: "var(--accent)", color: "var(--accent-contrast)" }}
        >
          Reintentar
        </button>
      </div>
    );
  }

  return (
    <div className="relative flex min-h-screen w-full flex-col items-center overflow-hidden px-4 py-6">
      {/* Glow de fondo */}
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-32 -left-24 h-80 w-80 rounded-full opacity-20 blur-3xl"
        style={{ background: "var(--accent)" }}
      />

      {/* ── Intro ── */}
      {phase === "intro" && (
        <>
          <div className="z-10 flex w-full max-w-sm justify-start">
            <button
              onPointerUp={() => router.push("/play")}
              className="text-sm font-bold transition-colors"
              style={{ color: "var(--muted)" }}
            >
              ← Salir
            </button>
          </div>
          <GameIntro
            emoji="💣"
            title="Dot Bombs"
            howTo={[
              "Caen bombas con una imagen y su palabra en inglés.",
              "La bomba más baja se enciende: deletrea su palabra tocando las letras en orden.",
              "Palabra completa = bomba desactivada y puntos. ¡Desactivar alto paga más!",
              "Si una bomba toca el suelo, pierdes un corazón. Tienes 5.",
            ]}
            record={record}
            throne={throne}
            onStart={() => setPhase("modes")}
          />
        </>
      )}

      {/* ── Selector de modo ── */}
      {phase === "modes" && (
        <div className="z-10 flex min-h-screen w-full max-w-sm flex-col items-center justify-center gap-3">
          <h2 className="font-display text-2xl font-extrabold mb-2">¿Cómo lo quieres?</h2>
          {(Object.keys(MODE_LABEL) as GameMode[]).map((m) => (
            <button
              key={m}
              onPointerUp={() => startGame(m)}
              className="dots-pressable dots-card flex w-full items-center gap-4 px-5 py-4 text-left"
              style={{ ["--press-color" as string]: "var(--accent-soft)" }}
            >
              <span className="text-3xl">{MODE_LABEL[m].emoji}</span>
              <span className="flex flex-col">
                <span className="font-display text-lg font-extrabold">{MODE_LABEL[m].name}</span>
                <span className="text-xs font-bold" style={{ color: "var(--muted)" }}>
                  {MODE_LABEL[m].desc}
                </span>
              </span>
            </button>
          ))}
          <button
            onPointerUp={() => setPhase("intro")}
            className="mt-2 text-sm font-bold"
            style={{ color: "var(--muted)" }}
          >
            ← Volver
          </button>
        </div>
      )}

      {/* ── Jugando (placeholder — Task 4 lo reemplaza) ── */}
      {phase === "playing" && (
        <div data-testid="battlefield" className="z-10 flex w-full max-w-sm flex-1 flex-col">
          <p className="text-sm font-bold" style={{ color: "var(--muted)" }}>
            modo: {mode} · vidas: {lives} · desactivadas: {defusedCount} · pts: {score}
          </p>
        </div>
      )}

      {/* ── Result ── */}
      {phase === "result" && (
        <GameResult
          gameKey="dot-bombs"
          score={finalScore}
          onReplay={() => setPhase("modes")}
          onExit={() => router.push("/play")}
          extra={
            <p className="text-sm font-bold text-center" style={{ color: "var(--muted)" }}>
              {MODE_LABEL[mode].name} · {defusedCount} bomba{defusedCount === 1 ? "" : "s"} desactivada{defusedCount === 1 ? "" : "s"}
            </p>
          }
        />
      )}
    </div>
  );
}

// ── Export con puerta de Suspense (useSearchParams, regla 6) ─────────────────

export default function DotBombsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <Spinner title="Cargando…" />
        </div>
      }
    >
      <DotBombsGame />
    </Suspense>
  );
}
```

Nota: `lives`, `defusedCount` y `score` quedan renderizados en el placeholder para que lint no acuse variables muertas; Task 4-5 los mueven al HUD real.

- [ ] **Step 3: Verificar**

`source ~/.nvm/nvm.sh && npm run lint && npx tsc --noEmit && npx next build` — los tres sin errores. La ruta `/games/dot-bombs` aparece en el output del build.

- [ ] **Step 4: Commit**

```bash
git add "app/(app)/games/dot-bombs/page.tsx" services/games.service.ts
git commit -m "feat(dot-bombs): esqueleto moderno — fases, fetch con retry, intro y modos en español"
```

---

### Task 4: Campo de batalla — caída, bomba activa, vidas

**Files:**
- Modify: `app/(app)/games/dot-bombs/page.tsx` (reemplaza el placeholder de `playing`)
- Test (banco): actualizar `app/dev-juice/page.tsx`

**Interfaces:**
- Consumes: `stepBombs`, `DIFFICULTY`, `survivalMultiplier`, `type Bomb` de `./engine`; `useTicker(fps, cb(dtMs), running)` de `@/hooks/use-ticker`; `playSound("wrong")` de `@/lib/feedback-sounds`.
- Produces (Task 5 depende): refs `bombsRef: Bomb[]`, `activeIdRef: number | null`, `elapsedMsRef`, callback `endGame(finalDefused: number, finalScoreValue: number)` que setea `finalScore` JUNTO a `setPhase("result")`; estado `bombsSnapshot: Bomb[]` y `activeId: number | null` para render.

- [ ] **Step 1: Añadir el motor a la página**

Imports nuevos al bloque de imports de `page.tsx`:

```tsx
import { useTicker } from "@/hooks/use-ticker";
import { playSound } from "@/lib/feedback-sounds";
import WordImg from "@/components/ui/word-img/word-img";
import {
  DIFFICULTY,
  stepBombs,
  survivalMultiplier,
  type Bomb,
  type GameMode,
} from "./engine";
```

(la línea previa `import { DIFFICULTY, type GameMode } from "./engine";` se elimina — queda solo esta versión ampliada)

Constante junto a `MAX_LIVES`:

```tsx
const TICKER_FPS = 30;
```

Dentro de `DotBombsInner`, tras los estados existentes, añadir refs + estado de render:

```tsx
  // Motor en refs (el tick es la única fuente de verdad; el estado es snapshot)
  const bombsRef = useRef<Bomb[]>([]);
  const winTargetRef = useRef<number | null>(null); // min(winAt, pool) del modo en curso
  const activeIdRef = useRef<number | null>(null);
  const nextBombIdRef = useRef(1);
  const lastSpawnAtRef = useRef(0);
  const elapsedMsRef = useRef(0);
  const wordCursorRef = useRef(0);
  const livesRef = useRef(MAX_LIVES);
  const defusedRef = useRef(0);
  const scoreRef = useRef(0);

  const [bombsSnapshot, setBombsSnapshot] = useState<Bomb[]>([]);
  const [activeId, setActiveId] = useState<number | null>(null);
```

- [ ] **Step 2: Spawn, tick y fin de partida**

Añadir tras `startGame` (y ampliar `startGame` para resetear refs — versión completa abajo):

```tsx
  const startGame = useCallback((m: GameMode) => {
    setMode(m);
    // meta del modo: min(20, pool) por spec — con pool corto la meta encoge
    const cfgWin = DIFFICULTY[m].winAt;
    winTargetRef.current =
      cfgWin === null ? null : Math.min(cfgWin, wordsRef.current.length);
    livesRef.current = MAX_LIVES;
    defusedRef.current = 0;
    scoreRef.current = 0;
    bombsRef.current = [];
    activeIdRef.current = null;
    nextBombIdRef.current = 1;
    lastSpawnAtRef.current = 0;
    elapsedMsRef.current = 0;
    wordCursorRef.current = 0;
    setLives(MAX_LIVES);
    setDefusedCount(0);
    setScore(0);
    setFinalScore(0);
    setBombsSnapshot([]);
    setActiveId(null);
    setPhase("playing");
  }, []);

  /** Fin de partida: score y phase en el MISMO commit (lección de memory —
   *  GameResult envía al montar y los efectos del hijo corren primero). */
  const endGame = useCallback(() => {
    setFinalScore(scoreRef.current);
    setDefusedCount(defusedRef.current);
    setPhase("result");
  }, []);

  const spawnBomb = useCallback(() => {
    const pool = wordsRef.current;
    if (pool.length === 0) return;
    const cfg = DIFFICULTY[mode];
    const word = pool[wordCursorRef.current % pool.length];
    wordCursorRef.current += 1;
    bombsRef.current = [
      ...bombsRef.current,
      {
        id: nextBombIdRef.current++,
        word: word.title.toLowerCase(),
        img: word.src,
        y: 0,
        speed: 1 / cfg.fallSeconds,
      },
    ];
  }, [mode]);

  const onTick = useCallback(
    (dtMs: number) => {
      const cfg = DIFFICULTY[mode];
      elapsedMsRef.current += dtMs;

      // survival acelera; normal va a x1 constante
      const speedMult =
        cfg.accelPerSecond > 0
          ? 1 + cfg.accelPerSecond * (elapsedMsRef.current / 1000)
          : 1;

      const { bombs, landed } = stepBombs(bombsRef.current, dtMs, speedMult);
      bombsRef.current = bombs;

      // TODOS los aterrizajes del tick cuestan vida (fix del bug del booleano)
      if (landed.length > 0) {
        playSound("wrong");
        livesRef.current = Math.max(0, livesRef.current - landed.length);
        setLives(livesRef.current);
        if (livesRef.current === 0) {
          endGame();
          return;
        }
      }

      // spawn si hay hueco
      if (
        bombsRef.current.length < cfg.maxBombs &&
        elapsedMsRef.current - lastSpawnAtRef.current >= cfg.spawnEveryMs
      ) {
        lastSpawnAtRef.current = elapsedMsRef.current;
        spawnBomb();
      }

      // bomba activa = la más baja
      const lowest = bombsRef.current.reduce<Bomb | null>(
        (acc, b) => (acc === null || b.y > acc.y ? b : acc),
        null,
      );
      activeIdRef.current = lowest?.id ?? null;

      // snapshot para render
      setBombsSnapshot(bombsRef.current);
      setActiveId(activeIdRef.current);
    },
    [mode, spawnBomb, endGame],
  );

  useTicker(TICKER_FPS, onTick, phase === "playing");
```

Primer spawn inmediato: en `startGame`, después de `setPhase("playing")`, añadir `lastSpawnAtRef.current = -DIFFICULTY[m].spawnEveryMs;` (así el primer tick spawnea sin esperar).

- [ ] **Step 3: Render del campo (reemplaza el placeholder)**

```tsx
      {/* ── Jugando ── */}
      {phase === "playing" && (
        <div data-testid="battlefield" className="z-10 flex w-full max-w-sm flex-1 flex-col">
          {/* HUD */}
          <div className="dots-card flex w-full items-center justify-between gap-3 px-4 py-3">
            <button
              onPointerUp={() => {
                // Abandonar NO envía score (misma política que memory)
                router.push("/play");
              }}
              className="text-sm font-bold transition-colors"
              style={{ color: "var(--muted)" }}
            >
              ← Salir
            </button>
            <span className="text-sm font-black tabular-nums" aria-label={`${lives} vidas`}>
              {"❤️".repeat(lives)}
              {"🤍".repeat(MAX_LIVES - lives)}
            </span>
            <div className="flex flex-col items-end">
              <span className="text-xs font-black uppercase tracking-widest" style={{ color: "var(--muted)" }}>
                {winTargetRef.current !== null
                  ? `${defusedCount}/${winTargetRef.current}`
                  : `${Math.floor(elapsedMsRef.current / 1000)}s`}
              </span>
              <span className="font-display text-lg font-extrabold" style={{ color: "var(--accent)" }}>
                {score}
              </span>
            </div>
          </div>

          {/* Cielo: las bombas caen con translateY (nunca top) */}
          <div className="relative mt-3 w-full flex-1 overflow-hidden rounded-2xl border-2"
            style={{ borderColor: "var(--border)", background: "color-mix(in srgb, var(--accent) 4%, var(--surface))" }}
          >
            {bombsSnapshot.map((bomb) => (
              <div
                key={bomb.id}
                data-testid={`bomb-${bomb.id}`}
                className="absolute left-0 top-0 flex w-full justify-center"
                style={{
                  // y∈[0,1] → recorre el alto del contenedor menos la bomba (~96px)
                  transform: `translateY(calc(${bomb.y} * (100cqh - 96px)))`,
                  opacity: activeId === bomb.id ? 1 : 0.7,
                }}
              >
                <div
                  className="dots-card flex flex-col items-center gap-1 px-3 py-2"
                  style={{
                    borderColor: activeId === bomb.id ? "var(--danger)" : "var(--border)",
                    transform: activeId === bomb.id ? "scale(1)" : "scale(0.85)",
                    transition: "transform 0.2s var(--ease-out-strong), border-color 0.2s",
                  }}
                >
                  {bomb.img && <WordImg src={bomb.img} size="w-10 h-10" customClass="rounded" />}
                  <span className="text-xs font-extrabold">💣 {bomb.word}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Bandeja (Task 5) */}
          <div data-testid="tray" className="mt-3 min-h-28" />
        </div>
      )}
```

El contenedor del cielo necesita `container-type: size` para `100cqh`: añadir `style={{ ..., containerType: "size" }}` en ese div (junto a borderColor/background).

- [ ] **Step 4: Verificar**

Mecánico: `npm run lint && npx tsc --noEmit` sin errores. Visual (banco): reemplazar `app/dev-juice/page.tsx` por una réplica del campo con 3 bombas mock a `y=0/0.5/0.95` y sin ticker; con `javascript_tool` comprobar: (a) `getComputedStyle($("[data-testid='bomb-3']").firstElementChild)` — la activa (y=0.95, la más baja) tiene `border-color` = `--danger` resuelto y las otras dos opacity 0.7; (b) los transform usan `translateY`, nunca `top` (`$("[data-testid='bomb-1']").parentElement… style.top === ""`).

- [ ] **Step 5: Commit**

```bash
git add "app/(app)/games/dot-bombs/page.tsx"
git commit -m "feat(dot-bombs): campo de caída con useTicker, bomba activa y vidas por tick"
```

---

### Task 5: Bandeja de anagrama, scoring y fin de partida

**Files:**
- Modify: `app/(app)/games/dot-bombs/page.tsx`

**Interfaces:**
- Consumes: `buildTray`, `tapChip`, `type TrayState` de `./anagram`; `bombScore`, `survivalMultiplier` de `./engine`; todo lo producido por Task 4.
- Produces: juego completo. `defuse(bombId)` retira la bomba, suma score con `bombScore`, avanza combo y chequea `winAt`.

- [ ] **Step 1: Estado de bandeja + rng**

Imports: `import { buildTray, tapChip, type TrayState } from "./anagram";` y añadir `bombScore` al import de `./engine`.

Estado/refs nuevos dentro de `DotBombsInner`:

```tsx
  const [tray, setTray] = useState<TrayState | null>(null);
  const [wrongChipId, setWrongChipId] = useState<number | null>(null);
  const comboRef = useRef(0);
  const wrongTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
```

Limpieza al desmontar (nuevo `useEffect` junto al fetch):

```tsx
  useEffect(() => {
    return () => {
      if (wrongTimerRef.current) clearTimeout(wrongTimerRef.current);
    };
  }, []);
```

- [ ] **Step 2: Reconstruir bandeja cuando cambia la bomba activa**

La bandeja se reconstruye desde el TICK (no desde un efecto, regla 3): al final de `onTick`, tras calcular `activeIdRef`, añadir:

```tsx
      // la bandeja sigue a la bomba activa (se rearma al cambiar de objetivo)
      if (activeIdRef.current !== prevActiveId) {
        const target = bombsRef.current.find((b) => b.id === activeIdRef.current);
        setTray(
          target
            ? buildTray(target.word, DIFFICULTY[mode].decoys, Math.random)
            : null,
        );
      }
```

con `const prevActiveId = activeIdRef.current;` capturado ANTES de recalcular `lowest` (primera línea del bloque "bomba activa").

- [ ] **Step 3: Tap de ficha, defuse y victoria**

```tsx
  const onChipTap = useCallback(
    (chipId: number) => {
      if (phase !== "playing" || tray === null) return;
      const { state, result } = tapChip(tray, chipId);
      if (result === "noop") return;

      if (result === "wrong") {
        playSound("wrong");
        comboRef.current = 0;
        setWrongChipId(chipId);
        if (wrongTimerRef.current) clearTimeout(wrongTimerRef.current);
        wrongTimerRef.current = setTimeout(() => setWrongChipId(null), 400);
        return;
      }

      setTray(state);
      if (result === "complete") {
        playSound("correct");
        const bomb = bombsRef.current.find((b) => b.id === activeIdRef.current);
        if (!bomb) return;
        const cfg = DIFFICULTY[mode];
        const mult =
          cfg.winAt === null
            ? survivalMultiplier(elapsedMsRef.current / 1000)
            : cfg.multiplier;
        scoreRef.current += bombScore(mult, bomb.y, comboRef.current);
        comboRef.current += 1;
        defusedRef.current += 1;
        setScore(scoreRef.current);
        setDefusedCount(defusedRef.current);

        // retirar la bomba; el próximo tick elige nueva activa y rearma bandeja
        bombsRef.current = bombsRef.current.filter((b) => b.id !== bomb.id);
        setBombsSnapshot(bombsRef.current);
        setTray(null);

        if (winTargetRef.current !== null && defusedRef.current >= winTargetRef.current) {
          endGame();
        }
      }
    },
    [phase, tray, mode, endGame],
  );
```

Y en `onTick`, dentro del bloque de aterrizajes, resetear combo: `comboRef.current = 0;` (aterrizaje = fallo). Nota: si la bomba activa aterriza, el cambio de `activeIdRef` del mismo tick rearma la bandeja solo.

- [ ] **Step 4: Render de la bandeja (reemplaza el `div` vacío `data-testid="tray"`)**

```tsx
          {/* Bandeja de anagrama */}
          <div data-testid="tray" className="mt-3 flex min-h-28 flex-col items-center gap-3">
            {tray && (
              <>
                {/* Huecos de la palabra */}
                <div className="flex flex-wrap justify-center gap-1">
                  {tray.display.map((ch, i) => (
                    <span
                      key={i}
                      className="flex h-8 w-7 items-center justify-center rounded-md border-b-4 font-display text-lg font-extrabold uppercase"
                      style={{
                        borderColor: i === tray.nextSlot ? "var(--accent)" : "var(--border)",
                        color: ch === "" ? "transparent" : "var(--foreground)",
                        animation: ch !== "" && i !== tray.nextSlot ? "none" : undefined,
                      }}
                    >
                      {ch === "" ? "·" : ch}
                    </span>
                  ))}
                </div>
                {/* Fichas */}
                <div className="flex flex-wrap justify-center gap-2">
                  {tray.chips.map((chip) => (
                    <button
                      key={chip.id}
                      data-testid={`chip-${chip.id}`}
                      disabled={chip.used}
                      onPointerUp={() => onChipTap(chip.id)}
                      className="dots-pressable h-12 w-11 rounded-xl border-2 font-display text-lg font-extrabold uppercase disabled:opacity-30"
                      style={{
                        borderColor: "var(--border)",
                        background: "var(--surface)",
                        color: "var(--foreground)",
                        animation:
                          wrongChipId === chip.id
                            ? "dots-shake-x 0.4s var(--ease-out-strong)"
                            : `dots-slot-in 0.22s var(--ease-out-strong) ${chip.id * 30}ms backwards`,
                        ["--press-color" as string]: "var(--accent-soft)",
                      }}
                    >
                      {chip.char}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
```

- [ ] **Step 5: Verificar**

Mecánico: `npm run lint && npx tsc --noEmit && npx next build` sin errores. Banco: réplica en `/dev-juice` del flujo bandeja+defuse con 2 palabras mock y el motor real (sin fetch): simular con `javascript_tool` (taps con `await` de ~50 ms entre cada uno — los eventos sintéticos NO son discretos para React): (a) deletrear la palabra activa completa → la bomba desaparece del DOM y el score sube exactamente `bombScore(mult, y, 0)`; (b) ficha equivocada → `getComputedStyle(chip).animationName === "dots-shake-x"` y el combo vuelve a 0; (c) dejar aterrizar 2 bombas en el mismo tick (mock con y=0.99 ambas) → los corazones bajan DE DOS EN DOS.

- [ ] **Step 6: Commit**

```bash
git add "app/(app)/games/dot-bombs/page.tsx"
git commit -m "feat(dot-bombs): bandeja de anagrama, scoring con combo y victoria por meta"
```

---

### Task 6: Calibración, pulido y documentación

**Files:**
- Modify: `app/(app)/games/dot-bombs/engine.ts` (solo valores de `DIFFICULTY` si la calibración lo pide)
- Modify: `docs/ARQUITECTURA.md:28` y `plans/README.md`
- Delete: `app/dev-juice/page.tsx` (el banco)

**Interfaces:**
- Consumes: todo lo anterior.
- Produces: juego certificable; docs al día.

- [ ] **Step 1: Calibración de feel**

En el banco (`/dev-juice`) con el motor real y palabras mock, verificar los presupuestos del spec: easy con `fallSeconds: 16` da margen holgado para deletrear palabras de 5-8 letras; survival con `accelPerSecond: 0.004` alcanza ×2 a los ~250 s (≈4 min de run natural con maxBombs 5). Si el feel pide otra cosa, ajustar SOLO los números de `DIFFICULTY` (la forma y las claves no cambian; las aserciones de la Task 2 sobre multiplicadores/winAt deben seguir en verde).

- [ ] **Step 2: Borrar el banco y actualizar docs**

```bash
rm -rf app/dev-juice
```

En `docs/ARQUITECTURA.md` (línea 28, editada por última vez el 2026-08-10) reemplazar:

```
Legacy (3): dont-pop, dot-bombs (teclado físico — NO RN-safe; rediseño a anagrama tap aprobado, ver `docs/superpowers/specs/2026-08-10-dot-bombs-anagram-redesign.md`), dotaxi. (flashcards y speed-round fueron retirados el 2026-08-10; récords purgados.)
```

por:

```
Legacy (2): dont-pop, dotaxi. (flashcards y speed-round fueron retirados el 2026-08-10; récords purgados. dot-bombs fue reconstruido como anagrama tap RN-safe — spec en `docs/superpowers/specs/2026-08-10-dot-bombs-anagram-redesign.md`.)
```

En `plans/README.md`, sección "Retirados…": reemplazar la frase "dot-bombs tiene rediseño aprobado a anagrama tap (spec en `docs/superpowers/specs/`), se certifica al reconstruirse." por "dot-bombs fue reconstruido como anagrama tap (2026-08-xx) — pendiente solo su pasada de certificación estándar." (con la fecha real).

- [ ] **Step 3: Verificación final completa**

```bash
source ~/.nvm/nvm.sh && npm run lint && npx tsc --noEmit && npx next build
```

Los tres sin errores, y `git status --short` sin rastro de `app/dev-juice`.

- [ ] **Step 4: Commit final**

```bash
git add "app/(app)/games/dot-bombs/engine.ts" docs/ARQUITECTURA.md plans/README.md
git commit -m "feat(dot-bombs): calibración de dificultad y docs del rediseño"
```

---

## Self-Review (hecho al escribir el plan)

- **Cobertura del spec**: input anagrama (T1+T5) ✓ · una bomba activa (T4) ✓ · señuelos hard (T2 config + T5 buildTray) ✓ · duplicados intercambiables (T1 aserción) ✓ · especiales pre-colocados (T1) ✓ · mis-tap sin coste de vida + shake (T5) ✓ · aterrizajes por tick (T2 aserción + T4) ✓ · 5 vidas / winAt 20 / survival sin meta (T2+T4) ✓ · multiplicadores 1/2/3 (T2) ✓ · survival acotado por aceleración (T2+T6 calibración) ✓ · score 100×mult×altura×combo tope ×2 (T2) ✓ · survival ×1+0.1/30s tope ×3 (T2) ✓ · español (T3) ✓ · GameIntro/GameResult + score solo vía GameResult, seteado con el phase (T3+T4 endGame) ✓ · fetchAttempt retry (T3) ✓ · router.push (T3/T4) ✓ · translateY + rAF (T4) ✓ · tokens dots-slot-in/dots-shake-x (T5) ✓ · timeouts limpiados (T5 wrongTimerRef; el motor no usa timeouts) ✓ · seed cliente opcional (T3) ✓ · pool corto: `winTargetRef = min(winAt, pool.length)` fijado en `startGame` (T4) y usado por HUD y victoria (T5), exactamente el `min(20, pool)` del spec; el cursor de palabras recicla con `% pool.length` para que el spawn nunca se quede sin palabra ✓.
- **Placeholders**: ninguno — todo paso con código lo muestra completo.
- **Consistencia de tipos**: firmas de `anagram.ts`/`engine.ts` citadas idénticas en Interfaces de T3-T5 ✓ (`tapChip` devuelve `{state, result}`; `stepBombs` devuelve `{bombs, landed}`; `bombScore(multiplier, y, combo)`).
