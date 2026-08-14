# Dotaxi 2.0 (carriles progresivos) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reescribir dotaxi para que sea RN-safe y sus carriles crezcan 2 → 3 → 4 con los aciertos, conservando su identidad visual.

**Architecture:** Un módulo puro (`lanes.ts`) con las reglas decidibles (cuántos carriles toca, geometría de cada uno, construcción de las opciones incluido el distractor cruzado) y una página que solo orquesta: fetch → GameIntro → loop con `useTicker` → GameResult. El motor vive en refs; cada tick hace snapshot a estado para render.

**Tech Stack:** Next.js 16 (app router), React 19, Tailwind 4 + tokens de `app/globals.css`, `useTicker` (rAF), GameIntro/GameResult compartidos.

**Spec:** `docs/superpowers/specs/2026-08-12-dotaxi-carriles-progresivos.md` (aprobado).

## Global Constraints

- **RN-safe (regla 2 CLAUDE.md)**: solo `onPointerUp`; **cero `keydown`** (el juego viejo lo usaba como input real y es el motivo del rediseño), sin canvas, sin Drag API, sin `<input>`. **Nada de Web Audio** — el zumbido del motor se retira; solo `playSound` compartido. Animación solo `transform`/`opacity`: el taxi con `translateX`, la carretera con `translateY` + tick rAF (el viejo animaba `left` y `background-position-y`).
- **Regla 1**: `router.push("/play")`; nada de `window.location.*` (el viejo lo usaba 3 veces).
- **Regla 3**: sin `setState` síncrono en cuerpo de `useEffect`; **sin efectos colaterales dentro de updaters de `setState`** (el viejo lo violaba en cinco sitios). Leer `.current` en JSX es error del compiler lint — render desde estado snapshot.
- **Regla 4**: score solo vía `GameResult`, con `finalScore` seteado en el MISMO commit que `setPhase("result")`.
- **Regla 5**: `loadError` + Reintentar con patrón `fetchAttempt` por estado.
- **Regla 6**: `useSearchParams` dentro de `<Suspense>`.
- **Regla 7**: `?seed=` baraja el mazo; con el mismo seed, mazo idéntico entre rivales.
- Torneo y reto solo con partida completa; `submitChallengeScore(score, { completed })` — el segundo argumento es **obligatorio** en la firma actual del hook.
- **UI en español**, tono juguetón.
- Progresión de carriles por **aciertos**: 0-2 → 2 carriles; 3-5 → 3; 6+ → 4. Ancho de carretera fijo; los carriles reparten el espacio (50 % / 33,3 % / 25 %).
- Al cambiar de tramo: el taxi se recoloca al carril **más cercano** a su posición y hay un aviso "¡Carril nuevo!" de ~600 ms antes de arrancar la ronda.
- Datos: el backend da **3 opciones** por pregunta y 15 preguntas. La cuarta (para 4 carriles) sale de **otra pregunta del mismo mazo**, excluyendo case-insensitive las ya presentes. Si no alcanza, se juega con los carriles que se puedan llenar.
- Se conserva: 10 aciertos para ganar, 5 corazones, timer 5000 ms − 280 ms/ronda con suelo 2500 ms, combo ×100.
- **Sin test runner de componentes**: cada tarea verifica con `source ~/.nvm/nvm.sh && npm run lint && npx tsc --noEmit` (+ `npx next build` donde se indique) y con un **banco temporal** `app/dev-juice/page.tsx` que corre aserciones o monta la página real. **El banco NUNCA se commitea** (`git add <rutas exactas>`, jamás `git add -A`); se borra en la Task 4.
- Verificación heredada: en el preview sin compositing **ni rAF ni ResizeObserver disparan** y las transiciones CSS no avanzan (el estilo inline es la señal autoritativa, no `getComputedStyle`). Un banco que monte la página real necesita shim de `requestAnimationFrame` sobre `setTimeout` y `api.defaults.adapter`. Entre taps sintéticos, `await` ~60 ms.
- `source ~/.nvm/nvm.sh` SIEMPRE antes de node/npm.

## File Structure

- `app/(app)/games/dotaxi/lanes.ts` — **crear**. Puro, sin React ni DOM: `lanesForCorrect`, `laneGeometry`, `buildLaneOptions`, `nearestLane`. Portable a RN tal cual.
- `app/(app)/games/dotaxi/page.tsx` — **reescribir completo**. Fases, fetch, HUD, carretera, taxi, botón de confirmar, GameIntro/GameResult.
- `docs/ARQUITECTURA.md`, `plans/README.md` — **modificar** al final (Task 4).

Se conserva el componente `Taxi` (dibujado con divs) del archivo actual: es la identidad visual del juego. Se copia tal cual al reescribir, cambiando solo cómo se posiciona (transform en vez de `left`).

---

### Task 1: Módulo puro `lanes.ts`

**Files:**
- Create: `app/(app)/games/dotaxi/lanes.ts`
- Test (banco): `app/dev-juice/page.tsx` (temporal, NO se commitea)

**Interfaces:**
- Consumes: nada (módulo hoja, sin imports).
- Produces (Tasks 2-3 dependen de esto, firmas exactas):
  - `type Rng = () => number`
  - `LANE_TIERS: readonly { minCorrect: number; lanes: number }[]`
  - `lanesForCorrect(correctCount: number): number`
  - `laneGeometry(lanes: number): { widthPct: number; centersPct: number[] }`
  - `nearestLane(currentLane: number, fromLanes: number, toLanes: number): number`
  - `buildLaneOptions(correct: string, questionOptions: readonly string[], crossWords: readonly string[], lanes: number, rng: Rng): string[]`

- [ ] **Step 1: Escribir el banco primero (rojo)**

Crear `app/dev-juice/page.tsx`. Antes de existir el módulo, `npx tsc --noEmit` DEBE fallar con "Cannot find module .../lanes" — esa es la evidencia RED.

```tsx
"use client";
// BANCO TEMPORAL — NO COMMITEAR. Se borra en Task 4.
import React from "react";
import {
  lanesForCorrect,
  laneGeometry,
  nearestLane,
  buildLaneOptions,
} from "@/app/(app)/games/dotaxi/lanes";

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

type Check = { name: string; pass: boolean };

function run(): Check[] {
  const out: Check[] = [];
  const t = (name: string, pass: boolean) => out.push({ name, pass });

  // ── lanesForCorrect: 0-2 → 2 | 3-5 → 3 | 6+ → 4 ──
  t("0,1,2 aciertos → 2 carriles", [0, 1, 2].every((n) => lanesForCorrect(n) === 2));
  t("3,4,5 aciertos → 3 carriles", [3, 4, 5].every((n) => lanesForCorrect(n) === 3));
  t("6,9,20 aciertos → 4 carriles", [6, 9, 20].every((n) => lanesForCorrect(n) === 4));

  // ── laneGeometry: ancho fijo repartido ──
  const g2 = laneGeometry(2), g3 = laneGeometry(3), g4 = laneGeometry(4);
  t("2 carriles → 50% cada uno", g2.widthPct === 50);
  t("3 carriles → 33.33%", Math.abs(g3.widthPct - 100 / 3) < 1e-9);
  t("4 carriles → 25%", g4.widthPct === 25);
  t("centros de 2 = [25,75]", g2.centersPct.join() === "25,75");
  t("centros de 4 = [12.5,37.5,62.5,87.5]", g4.centersPct.join() === "12.5,37.5,62.5,87.5");
  t("hay un centro por carril", g3.centersPct.length === 3);

  // ── nearestLane: el taxi nunca queda fuera de rango ──
  t("2→3: carril 1 (derecha) mapea a 2", nearestLane(1, 2, 3) === 2);
  t("2→3: carril 0 sigue en 0", nearestLane(0, 2, 3) === 0);
  t("4→2: carril 3 cae a 1 (último válido)", nearestLane(3, 4, 2) === 1);
  t("resultado siempre dentro de rango",
    [0, 1, 2, 3].every((l) => { const r = nearestLane(l, 4, 2); return r >= 0 && r <= 1; }));

  // ── buildLaneOptions ──
  const qOpts = ["run", "walk", "jump"]; // 3 del backend, correct = "run"
  const cross = ["swim", "fly", "RUN", "walk"]; // colisiones a propósito

  const o2 = buildLaneOptions("run", qOpts, cross, 2, mulberry32(1));
  t("2 carriles → 2 opciones", o2.length === 2);
  t("2 carriles incluye la correcta", o2.includes("run"));

  const o3 = buildLaneOptions("run", qOpts, cross, 3, mulberry32(2));
  t("3 carriles → las 3 del backend", o3.length === 3 && [...o3].sort().join() === "jump,run,walk");

  const o4 = buildLaneOptions("run", qOpts, cross, 4, mulberry32(3));
  t("4 carriles → 4 opciones", o4.length === 4);
  t("4 carriles incluye la correcta", o4.includes("run"));
  t("sin duplicados case-insensitive",
    new Set(o4.map((w) => w.toLowerCase())).size === o4.length);
  t("el cuarto sale del cruzado", o4.some((w) => ["swim", "fly"].includes(w)));

  // cruzado insuficiente: no revienta, devuelve lo que hay
  const oShort = buildLaneOptions("run", qOpts, [], 4, mulberry32(4));
  t("cruzado vacío → 3 opciones sin romper", oShort.length === 3);

  // determinismo y pureza
  const a = buildLaneOptions("run", qOpts, cross, 4, mulberry32(9)).join("|");
  const b = buildLaneOptions("run", qOpts, cross, 4, mulberry32(9)).join("|");
  t("mismo seed → mismas opciones en el mismo orden", a === b);
  const src = [...qOpts];
  buildLaneOptions("run", src, cross, 4, mulberry32(5));
  t("no muta questionOptions", src.join("|") === qOpts.join("|"));

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
          {c.pass ? "✓" : "✗"} {c.name}
        </p>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Verificar RED**

Run: `source ~/.nvm/nvm.sh && npx tsc --noEmit`
Expected: FAIL con `error TS2307: Cannot find module '.../lanes'`

- [ ] **Step 3: Escribir el módulo**

```ts
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
```

- [ ] **Step 4: Verificar GREEN**

Run: `source ~/.nvm/nvm.sh && npm run lint && npx tsc --noEmit`
Expected: ambos limpios.
El controller levanta el preview y lee `/dev-juice`: `[data-testid='verdict']` debe decir `PASS (22)` y no debe haber ningún `[data-testid='fail']`.

- [ ] **Step 5: Commit (solo el módulo)**

```bash
git add "app/(app)/games/dotaxi/lanes.ts"
git commit -m "feat(dotaxi): reglas puras de carriles progresivos y opciones cruzadas"
```

---

### Task 2: Esqueleto de página — fases, fetch, intro y result

**Files:**
- Modify (reescritura completa): `app/(app)/games/dotaxi/page.tsx`

**Interfaces:**
- Consumes: `GameIntro`/`GameResult` de `components/games/shared/` (props: GameIntro `{emoji,title,howTo,record,throne,onStart}`; GameResult `{gameKey,score,onReplay,onExit,extra?}`), `useGameRecords("dotaxi")`, `useTournamentMode()`, `useChallengeMode()`, `getDotaxiService()` → `DotaxiQuestion[] {id,text,options,correct}`, `lanesForCorrect` de `./lanes`.
- Produces (Task 3 lo completa): `type Phase = "intro" | "playing" | "result"`, estados `deck`, `correctCount`, `hearts`, `score`, `finalScore`, refs `completedRef`, y `startGame()`. La zona de juego es un placeholder `data-testid="road"`.

- [ ] **Step 1: Reescribir `page.tsx` entero**

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
import { getDotaxiService, type DotaxiQuestion } from "@/services/games.service";
import { useGameRecords } from "@/hooks/use-game-records";
import { useTournamentMode } from "@/hooks/use-tournament-mode";
import { useChallengeMode } from "@/hooks/use-challenge-mode";
import { lanesForCorrect } from "./lanes";

// ── Constantes (heredadas del juego original) ────────────────────────────────

const START_HEARTS = 5;
const WIN_CORRECT = 10;
const TIMER_START = 5000;
const TIMER_STEP = 280; // se recorta por ronda jugada
const TIMER_MIN = 2500;

type Phase = "intro" | "playing" | "result";

/** PRNG determinista para derivar el mazo del seed (mismo mazo entre rivales). */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffleWith<T>(arr: readonly T[], rng: () => number): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

// ── Lector de seed (dentro del boundary de Suspense) ────────────────────────

function DotaxiGame() {
  const searchParams = useSearchParams();
  const seedParam = searchParams.get("seed");
  const parsed = seedParam !== null && seedParam !== "" ? parseInt(seedParam, 10) : NaN;
  const seed = Number.isFinite(parsed) ? parsed : undefined;
  return <DotaxiInner seed={seed} />;
}

// ── Componente principal ─────────────────────────────────────────────────────

function DotaxiInner({ seed }: { seed?: number }) {
  const router = useRouter();
  const { record, throne } = useGameRecords("dotaxi");
  const { submitTournamentScore, resetTournamentSubmit } = useTournamentMode();
  const { submitChallengeScore } = useChallengeMode();

  const [phase, setPhase] = useState<Phase>("intro");
  const [deck, setDeck] = useState<DotaxiQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  const [hearts, setHearts] = useState(START_HEARTS);
  const [correctCount, setCorrectCount] = useState(0);
  const [score, setScore] = useState(0);
  const [finalScore, setFinalScore] = useState(0);

  /** La partida llegó a su fin natural (ganó o se quedó sin corazones). */
  const completedRef = useRef(false);

  // Fetch con patrón fetchAttempt (regla 5)
  const [fetchAttempt, setFetchAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    getDotaxiService()
      .then((data) => {
        if (!active) return;
        const usable = data.filter(
          (q) => q.correct && q.options && q.options.length > 0,
        );
        // Nunca se arranca sin preguntas: el juego viejo encadenaba choques
        // automáticos y enviaba un score 0
        if (usable.length === 0) {
          setLoadError(true);
          return;
        }
        const rng = seed !== undefined ? mulberry32(seed) : Math.random;
        setDeck(shuffleWith(usable, rng));
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

  const startGame = useCallback(() => {
    completedRef.current = false;
    setHearts(START_HEARTS);
    setCorrectCount(0);
    setScore(0);
    setFinalScore(0);
    setPhase("playing");
  }, []);

  // Torneo/reto: solo partidas completas. El score personal conserva el
  // parcial al salir (sube desde 0, como dot-match).
  useEffect(() => {
    if (phase === "result") {
      if (completedRef.current) {
        submitTournamentScore(finalScore);
        submitChallengeScore(finalScore, { completed: true });
      }
    } else {
      resetTournamentSubmit();
    }
  }, [phase]); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner title="Calentando el motor…" />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="text-lg font-bold" style={{ color: "var(--foreground)" }}>
          No se pudo cargar el trayecto.
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
            emoji="🚕"
            title="Dotaxi"
            howTo={[
              "Lee la frase con el hueco y busca la palabra que encaja.",
              "Toca el carril de esa palabra para mover el taxi.",
              "Pulsa «¡Vamos!» para confirmar antes de que se acabe el tiempo.",
              "Empiezas con 2 carriles; según aciertas se abren más (¡hasta 4!).",
              `${WIN_CORRECT} aciertos para llegar. Tienes ${START_HEARTS} corazones.`,
            ]}
            record={record}
            throne={throne}
            onStart={startGame}
          />
        </>
      )}

      {/* Jugando — Task 3 reemplaza este placeholder */}
      {phase === "playing" && (
        <div data-testid="road" className="z-10 flex w-full max-w-sm flex-1 flex-col">
          <p className="text-sm font-bold" style={{ color: "var(--muted)" }}>
            carriles: {lanesForCorrect(correctCount)} · aciertos: {correctCount} ·
            corazones: {hearts} · pts: {score}
          </p>
        </div>
      )}

      {phase === "result" && (
        <GameResult
          gameKey="dotaxi"
          score={finalScore}
          onReplay={startGame}
          onExit={() => router.push("/play")}
          extra={
            <p className="text-sm font-bold text-center" style={{ color: "var(--muted)" }}>
              {correctCount}/{WIN_CORRECT} aciertos
            </p>
          }
        />
      )}
    </div>
  );
}

// ── Export con puerta de Suspense (useSearchParams, regla 6) ────────────────

export default function DotaxiPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <Spinner title="Cargando…" />
        </div>
      }
    >
      <DotaxiGame />
    </Suspense>
  );
}
```

- [ ] **Step 2: Verificar**

Run: `source ~/.nvm/nvm.sh && npm run lint && npx tsc --noEmit && npx next build`
Expected: los tres limpios; `/games/dotaxi` aparece en el output del build. Confirmar además que no queda ni un `keydown`, `AudioContext`, ni `window.location` en el archivo:
`grep -nE "keydown|AudioContext|window\.location" "app/(app)/games/dotaxi/page.tsx"` → sin resultados.

- [ ] **Step 3: Commit**

```bash
git add "app/(app)/games/dotaxi/page.tsx"
git commit -m "feat(dotaxi): esqueleto moderno — fases, fetch con retry, intro en español"
```

---

### Task 3: Carretera, taxi, rondas y carriles progresivos

**Files:**
- Modify: `app/(app)/games/dotaxi/page.tsx` (reemplaza el placeholder de `playing`)

**Interfaces:**
- Consumes: `lanesForCorrect`, `laneGeometry`, `nearestLane`, `buildLaneOptions` de `./lanes`; `useTicker(fps, cb(dtMs), running)` de `@/hooks/use-ticker`; `playSound` de `@/lib/feedback-sounds`; todo lo producido por Task 2.
- Produces: juego completo.

- [ ] **Step 1: Imports y constantes nuevas**

Ampliar el import de `./lanes` y añadir los otros:

```tsx
import { useTicker } from "@/hooks/use-ticker";
import { playSound } from "@/lib/feedback-sounds";
import {
  lanesForCorrect,
  laneGeometry,
  nearestLane,
  buildLaneOptions,
} from "./lanes";
```

Constantes junto a las existentes:

```tsx
const TICKER_FPS = 30;
const RESOLVE_MS = 1300; // pausa tras resolver la ronda
const TIER_NOTICE_MS = 600; // aviso "¡Carril nuevo!" al abrirse un carril
```

- [ ] **Step 2: Estado del motor**

Dentro de `DotaxiInner`, tras los estados existentes:

```tsx
  // Motor en refs; el estado es snapshot para render (regla 3)
  const roundRef = useRef(0); // rondas jugadas (para el timer decreciente)
  const laneRef = useRef(0); // carril actual del taxi
  const lanesRef = useRef(2); // carriles del tramo actual
  const remainingRef = useRef(TIMER_START);
  const resolvingRef = useRef(false);
  const correctCountRef = useRef(0);
  const heartsRef = useRef(START_HEARTS);
  const scoreRef = useRef(0);
  const comboRef = useRef(0);
  const resolveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const roadYRef = useRef(0); // desplazamiento de la carretera (px, cíclico)

  const [lane, setLane] = useState(0);
  const [lanes, setLanes] = useState(2);
  const [laneOptions, setLaneOptions] = useState<string[]>([]);
  const [question, setQuestion] = useState<DotaxiQuestion | null>(null);
  const [remaining, setRemaining] = useState(TIMER_START);
  const [outcome, setOutcome] = useState<"none" | "clear" | "crash">("none");
  const [tierNotice, setTierNotice] = useState(false);
  const [roadY, setRoadY] = useState(0);
```

Limpieza al desmontar (efecto nuevo junto al de fetch):

```tsx
  useEffect(() => {
    return () => {
      if (resolveTimerRef.current) clearTimeout(resolveTimerRef.current);
    };
  }, []);
```

- [ ] **Step 3: Armar ronda (incluye el salto de tramo)**

```tsx
  /** Prepara la ronda `idx`: calcula el tramo, recoloca el taxi si cambió el
   *  número de carriles y reparte las opciones por los carriles. */
  const setupRound = useCallback(
    (idx: number) => {
      const q = deck[idx % deck.length];
      if (!q) return;

      const nextLanes = lanesForCorrect(correctCountRef.current);
      const prevLanes = lanesRef.current;
      if (nextLanes !== prevLanes) {
        laneRef.current = nearestLane(laneRef.current, prevLanes, nextLanes);
        lanesRef.current = nextLanes;
        setLane(laneRef.current);
        setLanes(nextLanes);
        setTierNotice(true);
      } else {
        setTierNotice(false);
      }

      // cuarto distractor desde OTRAS preguntas del mazo (el backend da 3)
      const cross = deck
        .filter((_, i) => i % deck.length !== idx % deck.length)
        .map((other) => other.correct);
      const rng =
        seed !== undefined ? mulberry32(seed + idx) : Math.random;

      setQuestion(q);
      setLaneOptions(buildLaneOptions(q.correct, q.options, cross, nextLanes, rng));
      remainingRef.current = Math.max(
        TIMER_MIN,
        TIMER_START - TIMER_STEP * idx,
      );
      setRemaining(remainingRef.current);
      setOutcome("none");
      resolvingRef.current = false;
    },
    [deck, seed],
  );
```

Y en `startGame` (Task 2), tras `setPhase("playing")`, resetear el motor y armar la primera ronda:

```tsx
    roundRef.current = 0;
    laneRef.current = 0;
    lanesRef.current = 2;
    correctCountRef.current = 0;
    heartsRef.current = START_HEARTS;
    scoreRef.current = 0;
    comboRef.current = 0;
    resolvingRef.current = false;
    roadYRef.current = 0;
    setLane(0);
    setLanes(2);
    setOutcome("none");
    setPhase("playing");
    setupRound(0);
```

(y añadir `setupRound` a las deps de `startGame`).

- [ ] **Step 4: Resolver la ronda**

```tsx
  const finishGame = useCallback(() => {
    completedRef.current = true;
    setFinalScore(scoreRef.current);
    setPhase("result");
  }, []);

  const resolve = useCallback(() => {
    if (resolvingRef.current || !question) return;
    resolvingRef.current = true;

    const chosen = laneOptions[laneRef.current];
    const hit = chosen === question.correct;

    if (hit) {
      playSound("correct");
      comboRef.current += 1;
      scoreRef.current += 100 * comboRef.current;
      correctCountRef.current += 1;
      setScore(scoreRef.current);
      setCorrectCount(correctCountRef.current);
      setOutcome("clear");
    } else {
      playSound("wrong");
      comboRef.current = 0;
      heartsRef.current = Math.max(0, heartsRef.current - 1);
      setHearts(heartsRef.current);
      setOutcome("crash");
    }

    if (resolveTimerRef.current) clearTimeout(resolveTimerRef.current);
    resolveTimerRef.current = setTimeout(() => {
      if (correctCountRef.current >= WIN_CORRECT || heartsRef.current <= 0) {
        finishGame();
        return;
      }
      roundRef.current += 1;
      setupRound(roundRef.current);
    }, RESOLVE_MS);
  }, [question, laneOptions, setupRound, finishGame]);
```

- [ ] **Step 5: Tick — timer y carretera**

```tsx
  const onTick = useCallback(
    (dtMs: number) => {
      // carretera en movimiento: translateY cíclico (nunca background-position)
      roadYRef.current = (roadYRef.current + dtMs * 0.12) % 64;
      setRoadY(roadYRef.current);

      if (resolvingRef.current) return;
      remainingRef.current = Math.max(0, remainingRef.current - dtMs);
      setRemaining(remainingRef.current);
      if (remainingRef.current <= 0) resolve(); // se acabó el tiempo = fallo
    },
    [resolve],
  );

  useTicker(TICKER_FPS, onTick, phase === "playing");
```

- [ ] **Step 6: Render de la zona de juego (reemplaza el placeholder)**

```tsx
      {phase === "playing" && (
        <div data-testid="road" className="z-10 flex w-full max-w-sm flex-1 flex-col gap-3">
          {/* HUD */}
          <div className="dots-card flex w-full items-center justify-between gap-3 px-4 py-3">
            <button
              onPointerUp={() => {
                // Abandonar: el parcial cuenta para el récord, no para el reto
                if (resolveTimerRef.current) clearTimeout(resolveTimerRef.current);
                setFinalScore(scoreRef.current);
                setPhase("result");
              }}
              className="text-sm font-bold transition-colors"
              style={{ color: "var(--muted)" }}
            >
              ← Salir
            </button>
            <span className="text-sm font-black" aria-label={`${hearts} corazones`}>
              {"❤️".repeat(hearts)}
              {"🤍".repeat(START_HEARTS - hearts)}
            </span>
            <div className="flex flex-col items-end">
              <span className="text-xs font-black uppercase tracking-widest" style={{ color: "var(--muted)" }}>
                {correctCount}/{WIN_CORRECT}
              </span>
              <span className="font-display text-lg font-extrabold" style={{ color: "var(--accent)" }}>
                {score}
              </span>
            </div>
          </div>

          {/* Frase con el hueco */}
          <div className="dots-card px-4 py-3 text-center">
            <p className="text-base font-extrabold">
              {question?.text.split("__")[0]}
              <span
                className="mx-1 inline-block min-w-12 rounded-md border-b-4 px-2"
                style={{ borderColor: "var(--accent)", color: "var(--accent)" }}
              >
                ?
              </span>
              {question?.text.split("__")[1] ?? ""}
            </p>
          </div>

          {/* Barra de tiempo (scaleX, nunca width) */}
          <div className="h-2 w-full overflow-hidden rounded-full" style={{ background: "var(--border)" }}>
            <div
              className="h-full w-full origin-left rounded-full"
              style={{
                transform: `scaleX(${Math.max(0, remaining) / TIMER_START})`,
                background: remaining > TIMER_START * 0.3 ? "var(--success)" : "var(--danger)",
              }}
            />
          </div>

          {/* Carretera */}
          <div
            className="relative w-full flex-1 overflow-hidden rounded-2xl border-2"
            style={{ borderColor: "var(--border)", background: "color-mix(in srgb, var(--foreground) 8%, var(--surface))" }}
          >
            {/* rayas de carril desplazándose con translateY */}
            <div
              aria-hidden
              className="absolute inset-x-0 top-0"
              style={{
                height: "200%",
                transform: `translateY(${roadY - 64}px)`,
                backgroundImage:
                  "repeating-linear-gradient(to bottom, var(--border) 0 24px, transparent 24px 64px)",
                backgroundSize: "2px 100%",
                backgroundRepeat: "repeat-y",
                backgroundPosition: "center",
                opacity: 0.5,
              }}
            />

            {/* carteles de opción, uno por carril */}
            {laneOptions.map((opt, i) => {
              const { widthPct, centersPct } = laneGeometry(lanes);
              const isClear = outcome !== "none" && opt === question?.correct;
              const isBlocked = outcome !== "none" && !isClear;
              return (
                <button
                  key={`${i}-${opt}`}
                  data-testid={`lane-${i}`}
                  onPointerUp={() => {
                    if (resolvingRef.current) return;
                    laneRef.current = i;
                    setLane(i);
                  }}
                  className="absolute top-3 dots-card px-1 py-2 text-xs font-extrabold"
                  style={{
                    left: `${centersPct[i]}%`,
                    width: `${widthPct * 0.86}%`,
                    transform: "translateX(-50%)",
                    borderColor: isClear
                      ? "var(--success)"
                      : isBlocked
                        ? "var(--danger)"
                        : lane === i
                          ? "var(--accent)"
                          : "var(--border)",
                    transition: "border-color 0.2s",
                  }}
                >
                  {outcome === "none" ? opt : isClear ? "✓" : "🚧"}
                </button>
              );
            })}

            {/* Taxi: translateX (nunca left) */}
            <div
              data-testid="taxi"
              className="absolute bottom-4"
              style={{
                left: `${laneGeometry(lanes).centersPct[Math.min(lane, lanes - 1)]}%`,
                transform: "translateX(-50%)",
                transition: "left 0.28s var(--ease-out-strong)",
              }}
            >
              <Taxi tilt={0} crashing={outcome === "crash"} pose="02" />
            </div>

            {/* aviso de carril nuevo */}
            {tierNotice && (
              <div
                data-testid="tier-notice"
                className="absolute inset-x-0 top-1/2 text-center font-display text-xl font-extrabold"
                style={{
                  color: "var(--accent)",
                  animation: "dots-pop-in 0.3s var(--ease-out-strong) both",
                }}
              >
                ¡Carril nuevo!
              </div>
            )}
          </div>

          {/* Confirmar: separado de moverse (antes tocar tu carril confirmaba) */}
          <button
            data-testid="go"
            onPointerUp={resolve}
            disabled={outcome !== "none"}
            className="dots-pressable w-full rounded-2xl py-4 text-base font-extrabold disabled:opacity-40"
            style={{
              background: "var(--accent)",
              color: "var(--accent-contrast)",
              ["--press-color" as string]: "var(--accent-edge)",
            }}
          >
            ¡Vamos!
          </button>
        </div>
      )}
```

Nota sobre `left` en el taxi y los carteles: es **posicionamiento estático por carril**, no animación de layout — la única propiedad animada por el tick es `transform`. La transición de `left` del taxi (0.28 s) reproduce el deslizamiento del juego original; si el revisor la considera animación de layout, sustituirla por `transform: translateX(calc(...))` calculado sobre el ancho del contenedor.

- [ ] **Step 7: Conservar el componente `Taxi`**

Copiar del archivo original (antes de la reescritura, disponible con `git show HEAD~2:"app/(app)/games/dotaxi/page.tsx"`) el componente `Taxi` completo y su bloque de comentario, pegándolo antes de `DotaxiGame`. Cambiar solo su animación: donde use `dotaxi-bob` mantenerla (es `transform`, ya cumple), y eliminar cualquier referencia a `left`.

- [ ] **Step 8: Verificar**

Run: `source ~/.nvm/nvm.sh && npm run lint && npx tsc --noEmit && npx next build`
Expected: los tres limpios.

- [ ] **Step 9: Commit**

```bash
git add "app/(app)/games/dotaxi/page.tsx"
git commit -m "feat(dotaxi): carriles progresivos 2→3→4, carretera con transform y confirmación explícita"
```

---

### Task 4: Verificación jugada, docs y limpieza

**Files:**
- Modify: `docs/ARQUITECTURA.md`, `plans/README.md`
- Delete: `app/dev-juice/page.tsx`

**Interfaces:**
- Consumes: todo lo anterior.
- Produces: rama lista para review final.

- [ ] **Step 1: Banco que monta la página real**

Reemplazar `app/dev-juice/page.tsx` por:

```tsx
"use client";
// BANCO TEMPORAL — NO COMMITEAR.
import React from "react";
import api from "@/lib/api-client";
import DotaxiPage from "@/app/(app)/games/dotaxi/page";

const QUESTIONS = Array.from({ length: 12 }, (_, i) => ({
  id: i + 1,
  text: `sentence ${i + 1} with a __ inside`,
  options: [`right${i + 1}`, `wrongA${i + 1}`, `wrongB${i + 1}`],
  correct: `right${i + 1}`,
}));

declare global {
  interface Window { __posts: string[] }
}

if (typeof window !== "undefined") {
  window.__posts = [];
  window.requestAnimationFrame = ((cb: FrameRequestCallback) =>
    window.setTimeout(() => cb(performance.now()), 33)) as typeof window.requestAnimationFrame;
  window.cancelAnimationFrame = ((id: number) => window.clearTimeout(id)) as typeof window.cancelAnimationFrame;
  api.defaults.adapter = async (config) => {
    const url = config.url ?? "";
    if ((config.method ?? "get").toLowerCase() === "post") window.__posts.push(url);
    let data: unknown = {};
    if (url.includes("/games/dotaxi")) data = QUESTIONS;
    else if (url.includes("/games/records") || url.includes("/games/scores")) data = [];
    else if (url.includes("/games/score")) data = { xpGained: 10, isNewHighScore: false };
    return { data, status: 200, statusText: "OK", headers: {}, config } as never;
  };
}

export default function DevJuicePage() {
  return <DotaxiPage />;
}
```

- [ ] **Step 2: Verificación jugada (la hace el controller)**

Con `?challenge=5`, comprobar en el navegador:
- Arranca con **2 carriles** (`[data-testid^='lane-']` = 2 elementos).
- Tras 3 aciertos → **3 carriles**; tras 6 → **4 carriles**, y aparece `[data-testid='tier-notice']` en el salto.
- Con 4 carriles, las 4 opciones son distintas entre sí (el cuarto distractor viene cruzado) y una es la correcta.
- El taxi nunca queda fuera de rango al cambiar de tramo (su `left` inline coincide con un centro válido del nuevo número de carriles).
- Tocar un carril mueve; **solo «¡Vamos!» resuelve**.
- Salir a mitad → solo `/games/score`, **nada al reto**. Partida completa (10 aciertos o 0 corazones) → también `/challenges/5/score`.
- Cero `keydown` en el archivo y ningún `AudioContext` creado.

- [ ] **Step 3: Borrar el banco**

```bash
rm -rf app/dev-juice
```

- [ ] **Step 4: Docs**

En `docs/ARQUITECTURA.md`:
1. La línea de legacy pasa de `Legacy (2): dont-pop, dotaxi.` a `Legacy (1): dont-pop.` (conservando el resto del paréntesis) y se añade a la tabla de juegos nuevos la fila:
   `| Dotaxi | dotaxi | frase con hueco; mueves el taxi al carril de la palabra y confirmas con «¡Vamos!»; los carriles crecen 2→3→4 con los aciertos | dotaxi (frases) |`
2. En "Deuda conocida", eliminar la línea `- dotaxi depende de teclado físico (legacy, pre-RN).`

En `plans/README.md`, actualizar la línea de pendientes a `Pendientes de auditoría: dont-pop (legacy — es rediseño, no certificación).` y añadir al final:

```
Dotaxi 2.0 (2026-08-12): rediseñado a carriles progresivos 2→3→4 por aciertos y
hecho RN-safe — fuera el keydown como input, fuera Web Audio, el taxi y la
carretera pasan a transform, confirmar es un botón «¡Vamos!» separado de mover
(antes un tap mal apuntado respondía), mazo barajado con seed, y el bug de banco
vacío cerrado. Spec en
`docs/superpowers/specs/2026-08-12-dotaxi-carriles-progresivos.md`.
Con esto NO queda ningún juego que bloquee la app RN salvo dont-pop.
```

- [ ] **Step 5: Gates finales**

```bash
source ~/.nvm/nvm.sh && npm run lint && npx tsc --noEmit && npx next build
```
Los tres limpios y `git status --short` sin rastro de `app/dev-juice`.
(Si el build se queja de tipos stale de la ruta borrada: `rm -rf .next` y repetir.)

- [ ] **Step 6: Commit**

```bash
git add docs/ARQUITECTURA.md plans/README.md
git commit -m "docs(dotaxi): rediseño a carriles progresivos y tracker al día"
```

---

## Self-Review (hecho al escribir el plan)

- **Cobertura del spec**: progresión 2/3/4 por aciertos (T1 `lanesForCorrect` + T3 `setupRound`) ✓ · ancho fijo repartido (T1 `laneGeometry`) ✓ · recolocación del taxi (T1 `nearestLane` + T3) ✓ · aviso "¡Carril nuevo!" 600 ms (T3 `tierNotice`, `TIER_NOTICE_MS`) ✓ · cuarto distractor cruzado con exclusión case-insensitive y degradación (T1 `buildLaneOptions` + aserciones) ✓ · sin keydown (T2 Step 2 lo verifica con grep) ✓ · sin Web Audio (idem) ✓ · taxi/carretera por transform (T3) ✓ · botón «¡Vamos!» separado de mover (T3 Step 6) ✓ · timeout = fallo (T3 Step 5) ✓ · español (T2) ✓ · GameIntro/GameResult con score solo ahí y `finalScore` junto al phase (T2 + T3 `finishGame`) ✓ · seed baraja mazo (T2) y deriva las opciones (T3) ✓ · fetchAttempt (T2) ✓ · router.push (T2/T3) ✓ · banco vacío cerrado (T2 filtra y marca loadError) ✓ · torneo/reto solo completas con `{ completed }` obligatorio (T2) ✓ · 10 aciertos / 5 corazones / timer decreciente / combo ×100 conservados (T2 constantes + T3 `resolve`) ✓ · identidad visual conservada (T3 Step 7 copia `Taxi`) ✓.
- **Placeholders**: ninguno; cada paso que cambia código muestra el código.
- **Consistencia de tipos**: `lanesForCorrect(n): number`, `laneGeometry(lanes): {widthPct, centersPct}`, `nearestLane(current, from, to): number`, `buildLaneOptions(correct, questionOptions, crossWords, lanes, rng): string[]` idénticas en T1 (definición) y T3 (consumo). `completedRef`, `finalScore` y `setupRound` definidos en T2 y usados en T3 con el mismo nombre.
- **Riesgo anotado para el ejecutor**: T3 Step 6 posiciona taxi y carteles con `left` estático + `translateX(-50%)`. Es posicionamiento, no animación por tick — pero la transición de `left` del taxi es la única propiedad no-transform que se anima; el propio paso explica la alternativa si la review lo rechaza.
