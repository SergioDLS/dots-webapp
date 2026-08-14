# Don't Pop 2.0 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Modernizar el último juego legacy conservando su mecánica única (el globo es el reloj), con 3 opciones, score con fórmula y sin violar ninguna regla dura.

**Architecture:** Un módulo puro (`rounds.ts`) con las reglas decidibles (construcción de la ronda con distractores no-respondidos, fórmula de score) y una página que orquesta: fetch → GameIntro → tick de presión → GameResult. El motor vive en refs; el estado es snapshot para render.

**Tech Stack:** Next.js 16, React 19, Tailwind 4 + tokens de `app/globals.css`, GameIntro/GameResult compartidos, `useGameSeed`.

**Spec:** `docs/superpowers/specs/2026-08-12-dont-pop-modernizacion.md`.

## Global Constraints

- **RN-safe (regla 2)**: solo `onPointerUp`; animación solo `transform`/`opacity`. **Prohibido animar `filter`** — el aviso de peligro pasa a una capa roja con `opacity` variable.
- **Regla 3**: sin `setState` síncrono en cuerpo de efecto y **sin efectos colaterales dentro de updaters** (el juego viejo lo viola de forma flagrante: `nextRound` llama a `land()` y a `setIndex` dentro del updater de `setData`, y dentro de ese `setIndex` llama a `setOptions` y `Math.random()`). Leer `.current` en JSX es error del compiler lint.
- **Regla 1**: `router.push("/play")`; cero `window.location.*`.
- **Regla 4**: score solo vía `GameResult`, con `finalScore` seteado en el MISMO commit que `setPhase("result")`.
- **Regla 5**: `loadError` + Reintentar con `fetchAttempt`. **Nunca arrancar sin palabras** (hoy da victoria falsa con score 0).
- **Regla 6**: `useSearchParams` dentro de `<Suspense>` — se usa `useGameSeed()`, que ya lo encapsula.
- Torneo/reto solo con partida completa; `submitChallengeScore(score, { completed })` (segundo argumento obligatorio).
- **UI en español**, tono juguetón.
- Mecánica conservada: presión inicial 15, +6/s, −25 acierto, +30 fallo, revienta a 100, aterriza al limpiar todas.
- **3 opciones** por ronda; distractores de otras palabras **no respondidas**, sin repetirse; con mazo corto se juega con las que haya, nunca botones duplicados ni vacíos.
- Score: `100 + round(60 × (1 − presión/100))` por acierto; fallar no resta.
- Se conserva `hot-air-balloon.tsx` (globo, balanceo, cielo, Doty, caída, aterrizaje) — solo cambia cómo se pinta el peligro.
- **Sin test runner de componentes**: gates `source ~/.nvm/nvm.sh && npm run lint && npx tsc --noEmit` (+ `npx next build` donde se indique) + banco temporal `app/dev-juice/page.tsx` que **NUNCA se commitea** (`git add <rutas exactas>`); se borra en la Task 3.
- Verificación heredada: sin compositing ni rAF ni ResizeObserver disparan y las transiciones CSS no avanzan — el estilo **inline** es la señal autoritativa. Un banco que monte la página real necesita shim de rAF y `api.defaults.adapter`. Entre taps sintéticos, `await` ~60 ms.
- `source ~/.nvm/nvm.sh` SIEMPRE antes de node/npm.

## File Structure

- `app/(app)/games/dont-pop/rounds.ts` — **crear**. Puro: `buildRound`, `roundScore`. Portable a RN.
- `app/(app)/games/dont-pop/page.tsx` — **reescribir completo**.
- `components/games/dont-pop/hot-air-balloon.tsx` — **modificar**: el peligro deja de animar `filter`.
- `docs/ARQUITECTURA.md`, `plans/README.md` — **modificar** en la Task 3.

---

### Task 1: Módulo puro `rounds.ts`

**Files:**
- Create: `app/(app)/games/dont-pop/rounds.ts`
- Test (banco): `app/dev-juice/page.tsx` (temporal, NO se commitea)

**Interfaces:**
- Consumes: `type GameWord = { id: number; title: string; src: string | null; answered: boolean }` de `@/services/games.service` (solo el tipo).
- Produces (Task 2 depende de esto, firmas exactas):
  - `type Rng = () => number`
  - `OPTIONS_PER_ROUND = 3`
  - `buildRound(words: readonly GameWord[], answeredIds: ReadonlySet<number>, rng: Rng): { word: GameWord; options: string[] } | null`
  - `roundScore(pressure: number): number`

- [ ] **Step 1: Escribir el banco primero (rojo)**

```tsx
"use client";
// BANCO TEMPORAL — NO COMMITEAR. Se borra en Task 3.
import React from "react";
import {
  buildRound,
  roundScore,
  OPTIONS_PER_ROUND,
} from "@/app/(app)/games/dont-pop/rounds";
import type { GameWord } from "@/services/games.service";

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

const W = (id: number, title: string): GameWord => ({
  id, title, src: null, answered: false,
});

type Check = { name: string; pass: boolean };

function run(): Check[] {
  const out: Check[] = [];
  const t = (name: string, pass: boolean) => out.push({ name, pass });
  const deck = [W(1, "apple"), W(2, "house"), W(3, "river"), W(4, "cloud"), W(5, "bread")];

  // ── roundScore: 100 + hasta 60 por calma ──
  t("presión 0 → 160", roundScore(0) === 160);
  t("presión 100 → 100", roundScore(100) === 100);
  t("presión 50 → 130", roundScore(50) === 130);
  t("nunca por debajo de 100", roundScore(150) === 100);
  t("nunca por encima de 160", roundScore(-20) === 160);
  t("devuelve entero", Number.isInteger(roundScore(33)));

  // ── buildRound: 3 opciones, una correcta ──
  const r1 = buildRound(deck, new Set(), mulberry32(1));
  t("devuelve ronda con mazo lleno", r1 !== null);
  t("3 opciones", r1!.options.length === OPTIONS_PER_ROUND);
  t("incluye la palabra correcta", r1!.options.includes(r1!.word.title));
  t("sin duplicados", new Set(r1!.options).size === r1!.options.length);

  // ── los distractores NO son palabras ya respondidas ──
  const answered = new Set([2, 3, 4]); // house, river, cloud fuera
  const r2 = buildRound(deck, answered, mulberry32(2));
  t("no elige una palabra respondida como objetivo", !answered.has(r2!.word.id));
  t("ningún distractor es palabra respondida",
    r2!.options.every((o) => o === r2!.word.title || !["house", "river", "cloud"].includes(o)));

  // ── degradación con mazo corto ──
  const r3 = buildRound([W(1, "apple")], new Set(), mulberry32(3));
  t("una sola palabra → 1 opción, sin duplicar", r3!.options.length === 1 && r3!.options[0] === "apple");
  const r4 = buildRound([W(1, "apple"), W(2, "house")], new Set(), mulberry32(4));
  t("dos palabras → 2 opciones distintas", r4!.options.length === 2 && new Set(r4!.options).size === 2);

  // ── sin palabras jugables ──
  t("mazo vacío → null", buildRound([], new Set(), mulberry32(5)) === null);
  t("todas respondidas → null",
    buildRound(deck, new Set([1, 2, 3, 4, 5]), mulberry32(6)) === null);

  // ── determinismo y pureza ──
  const a = JSON.stringify(buildRound(deck, new Set(), mulberry32(9)));
  const b = JSON.stringify(buildRound(deck, new Set(), mulberry32(9)));
  t("mismo seed → misma ronda", a === b);
  const src = [...deck];
  buildRound(src, new Set(), mulberry32(7));
  t("no muta el mazo", src.length === deck.length && src[0].title === "apple");

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
Expected: FAIL con `Cannot find module '.../rounds'`

- [ ] **Step 3: Escribir el módulo**

```ts
// app/(app)/games/dont-pop/rounds.ts
// Reglas puras de Don't Pop: cómo se arma una ronda y cuánto paga un acierto.
// Sin React ni DOM — portable a RN tal cual.

import type { GameWord } from "@/services/games.service";

export type Rng = () => number; // [0,1)

/** Opciones por ronda. Eran 2: adivinar acertaba el 50 % de las veces. */
export const OPTIONS_PER_ROUND = 3;

const SCORE_BASE = 100;
const CALM_BONUS_MAX = 60;

/**
 * Puntos de un acierto: base + bonus por responder con el globo tranquilo.
 * La presión sube sola con el tiempo, así que premiar la calma es premiar la
 * rapidez. Fallar no resta — ya cuesta +30 de presión.
 */
export function roundScore(pressure: number): number {
  const calm = 1 - Math.min(100, Math.max(0, pressure)) / 100;
  return SCORE_BASE + Math.round(CALM_BONUS_MAX * calm);
}

/** Fisher-Yates con rng inyectado; copia, no muta. */
function shuffleWith<T>(arr: readonly T[], rng: Rng): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/**
 * Arma la siguiente ronda entre las palabras que quedan por responder.
 * Los distractores salen de OTRAS palabras **no respondidas**: si vinieran de
 * las ya contestadas, el jugador las descartaría por eliminación. Con mazo
 * corto devuelve menos de OPTIONS_PER_ROUND opciones antes que repetir una.
 * Devuelve null cuando no queda ninguna palabra jugable.
 */
export function buildRound(
  words: readonly GameWord[],
  answeredIds: ReadonlySet<number>,
  rng: Rng,
): { word: GameWord; options: string[] } | null {
  const pending = words.filter((w) => !answeredIds.has(w.id) && w.title);
  if (pending.length === 0) return null;

  const word = shuffleWith(pending, rng)[0];

  const taken = new Set([word.title.toLowerCase()]);
  const options: string[] = [word.title];
  for (const w of shuffleWith(pending, rng)) {
    if (options.length >= OPTIONS_PER_ROUND) break;
    const key = w.title.toLowerCase();
    if (taken.has(key)) continue;
    taken.add(key);
    options.push(w.title);
  }

  return { word, options: shuffleWith(options, rng) };
}
```

- [ ] **Step 4: Verificar GREEN**

Run: `source ~/.nvm/nvm.sh && npm run lint && npx tsc --noEmit` — ambos limpios.
El controller lee `/dev-juice` en el navegador: `[data-testid='verdict']` debe decir `PASS (18)` y cero `[data-testid='fail']`.

- [ ] **Step 5: Commit**

```bash
git add "app/(app)/games/dont-pop/rounds.ts"
git commit -m "feat(dont-pop): reglas puras de ronda y puntuación por calma"
```

---

### Task 2: Reescritura de la página + peligro sin `filter`

**Files:**
- Modify (reescritura completa): `app/(app)/games/dont-pop/page.tsx`
- Modify: `components/games/dont-pop/hot-air-balloon.tsx`

**Interfaces:**
- Consumes: `buildRound`, `roundScore`, `OPTIONS_PER_ROUND` de `./rounds`; `GameIntro`/`GameResult`; `useGameRecords("dont-pop")`, `useTournamentMode()`, `useChallengeMode()`, `useGameSeed()`; `getDontPopService()`; `playSound`; `HotAirBalloon` de `@/components/games/dont-pop/hot-air-balloon`.
- Produces: juego completo.

- [ ] **Step 1: El globo deja de animar `filter`**

En `components/games/dont-pop/hot-air-balloon.tsx`, el div del envelope hoy lleva:

```tsx
            transition: "transform 0.25s ease-out, filter 0.3s ease-out",
            filter:
              danger > 0.55 && phase === "flying"
                ? `hue-rotate(-${Math.round((danger - 0.55) * 90)}deg) saturate(${1 + danger * 0.8})`
                : undefined,
```

Sustituir esas líneas por (se queda solo la transición de transform):

```tsx
            transition: "transform 0.25s ease-out",
```

Y justo DESPUÉS del `</svg>` de ese mismo div (dentro del contenedor que se
escala), añadir la capa de peligro:

```tsx
          {/* Aviso de reventón: capa roja por OPACIDAD. Antes se animaba
              `filter: hue-rotate/saturate`, que no es portable a RN. */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 rounded-full"
            style={{
              background: "var(--danger)",
              mixBlendMode: "multiply",
              opacity:
                phase === "flying" && danger > 0.55
                  ? Math.min(0.55, (danger - 0.55) * 1.2)
                  : 0,
              transition: "opacity 0.3s ease-out",
            }}
          />
```

Para que la capa se posicione, el div del envelope necesita `position: relative`
— añade `position: "relative"` a su `style` si no lo tiene.

- [ ] **Step 2: Reescribir `page.tsx` entero**

Sustituir TODO el archivo por:

```tsx
"use client";

import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import GameIntro from "@/components/games/shared/game-intro";
import GameResult from "@/components/games/shared/game-result";
import Spinner from "@/components/ui/Spinner/Spinner";
import WordImg from "@/components/ui/word-img/word-img";
import HotAirBalloon from "@/components/games/dont-pop/hot-air-balloon";
import { getDontPopService, type GameWord } from "@/services/games.service";
import { useGameRecords } from "@/hooks/use-game-records";
import { useTournamentMode } from "@/hooks/use-tournament-mode";
import { useChallengeMode } from "@/hooks/use-challenge-mode";
import { useGameSeed } from "@/hooks/use-game-seed";
import { playSound } from "@/lib/feedback-sounds";
import { buildRound, roundScore } from "./rounds";

// ── Constantes (mecánica heredada: el globo ES el reloj) ────────────────────

const PRESSURE_MAX = 100;
const START_PRESSURE = 15;
const INFLATE_PER_SEC = 6;
const CORRECT_DEFLATE = 25;
const WRONG_INFLATE = 30;
const TICK_MS = 100;
const CRASH_DELAY_MS = 1500; // deja que revienten y caiga
const LANDING_DELAY_MS = 1400;

type Phase = "intro" | "playing" | "result";
type Outcome = "none" | "crash" | "land";

/** PRNG determinista para derivar las rondas del seed. */
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

export default function DontPopPage() {
  const router = useRouter();
  const seed = useGameSeed();
  const { record, throne } = useGameRecords("dont-pop");
  const { submitTournamentScore, resetTournamentSubmit } = useTournamentMode();
  const { submitChallengeScore } = useChallengeMode();

  const [phase, setPhase] = useState<Phase>("intro");
  const [words, setWords] = useState<GameWord[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  // Snapshots para render
  const [pressure, setPressure] = useState(START_PRESSURE);
  const [score, setScore] = useState(0);
  const [finalScore, setFinalScore] = useState(0);
  const [cleared, setCleared] = useState(0);
  const [current, setCurrent] = useState<{ word: GameWord; options: string[] } | null>(null);
  const [outcome, setOutcome] = useState<Outcome>("none");

  // Motor en refs
  const pressureRef = useRef(START_PRESSURE);
  const scoreRef = useRef(0);
  const clearedRef = useRef(0);
  const answeredRef = useRef<Set<number>>(new Set());
  const roundSeqRef = useRef(0);
  const resolvingRef = useRef(false);
  const endTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  /** La partida terminó de forma natural (reventó o aterrizó). */
  const completedRef = useRef(false);

  // ── Carga (patrón fetchAttempt, regla 5) ──────────────────────────────────
  const [fetchAttempt, setFetchAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    getDontPopService()
      .then((data) => {
        if (!active) return;
        const usable = data.filter((w) => w.title && w.title.trim() !== "");
        // Nunca arrancar sin palabras: el juego viejo daba victoria instantánea
        // con score 0 cuando el fetch fallaba
        if (usable.length === 0) {
          setLoadError(true);
          return;
        }
        setWords(usable);
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
  }, [fetchAttempt]);

  // Limpieza de timers
  useEffect(() => {
    return () => {
      if (endTimerRef.current) clearTimeout(endTimerRef.current);
      if (tickRef.current) clearInterval(tickRef.current);
    };
  }, []);

  const rngFor = useCallback(
    (n: number) => (seed !== undefined ? mulberry32(seed + n) : Math.random),
    [seed],
  );

  const finishGame = useCallback((how: Outcome) => {
    completedRef.current = true;
    setOutcome(how);
    if (tickRef.current) {
      clearInterval(tickRef.current);
      tickRef.current = null;
    }
    if (endTimerRef.current) clearTimeout(endTimerRef.current);
    endTimerRef.current = setTimeout(
      () => {
        setFinalScore(scoreRef.current);
        setPhase("result");
      },
      how === "crash" ? CRASH_DELAY_MS : LANDING_DELAY_MS,
    );
  }, []);

  /** Arma la siguiente ronda; si no quedan palabras, aterriza. */
  const advance = useCallback(() => {
    roundSeqRef.current += 1;
    const next = buildRound(words, answeredRef.current, rngFor(roundSeqRef.current));
    if (next === null) {
      finishGame("land");
      return;
    }
    setCurrent(next);
    resolvingRef.current = false;
  }, [words, rngFor, finishGame]);

  const startGame = useCallback(() => {
    if (endTimerRef.current) clearTimeout(endTimerRef.current);
    if (tickRef.current) clearInterval(tickRef.current);
    completedRef.current = false;
    pressureRef.current = START_PRESSURE;
    scoreRef.current = 0;
    clearedRef.current = 0;
    answeredRef.current = new Set();
    roundSeqRef.current = 0;
    resolvingRef.current = false;
    setPressure(START_PRESSURE);
    setScore(0);
    setCleared(0);
    setFinalScore(0);
    setOutcome("none");
    setPhase("playing");

    const first = buildRound(words, new Set(), rngFor(0));
    setCurrent(first);
    if (first === null) {
      // defensivo: el gate de carga ya impide llegar aquí sin palabras
      setLoadError(true);
      return;
    }

    tickRef.current = setInterval(() => {
      if (resolvingRef.current) return;
      const next = Math.min(
        PRESSURE_MAX,
        pressureRef.current + INFLATE_PER_SEC * (TICK_MS / 1000),
      );
      pressureRef.current = next;
      setPressure(next);
      if (next >= PRESSURE_MAX) {
        resolvingRef.current = true;
        playSound("wrong");
        finishGame("crash");
      }
    }, TICK_MS);
  }, [words, rngFor, finishGame]);

  // Torneo/reto: solo partidas completas
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

  const answer = useCallback(
    (option: string) => {
      if (phase !== "playing" || resolvingRef.current || current === null) return;

      if (option === current.word.title) {
        playSound("correct");
        // El bonus se calcula con la presión ANTES de desinflar: premia haber
        // respondido con el globo tranquilo
        scoreRef.current += roundScore(pressureRef.current);
        clearedRef.current += 1;
        answeredRef.current.add(current.word.id);
        pressureRef.current = Math.max(0, pressureRef.current - CORRECT_DEFLATE);
        setScore(scoreRef.current);
        setCleared(clearedRef.current);
        setPressure(pressureRef.current);
        advance();
      } else {
        playSound("wrong");
        const next = Math.min(PRESSURE_MAX, pressureRef.current + WRONG_INFLATE);
        pressureRef.current = next;
        setPressure(next);
        if (next >= PRESSURE_MAX) {
          resolvingRef.current = true;
          finishGame("crash");
        }
      }
    },
    [phase, current, advance, finishGame],
  );

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner title="Inflando el globo…" />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="text-lg font-bold" style={{ color: "var(--foreground)" }}>
          No se pudo preparar el vuelo.
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

  const danger = pressure / PRESSURE_MAX;

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
            emoji="🎈"
            title="¡No lo revientes!"
            howTo={[
              "No hay reloj: el globo es el reloj. Se infla solo.",
              "Mira la imagen y toca la palabra correcta en inglés.",
              "Acertar desinfla el globo; fallar lo infla de golpe.",
              "Cuanto más tranquilo respondas, más puntos ganas.",
              `Responde las ${words.length} palabras para aterrizar.`,
            ]}
            record={record}
            throne={throne}
            onStart={startGame}
          />
        </>
      )}

      {phase === "playing" && (
        <div data-testid="sky" className="z-10 flex w-full max-w-sm flex-1 flex-col gap-3">
          {/* HUD */}
          <div className="dots-card flex w-full items-center justify-between gap-3 px-4 py-3">
            <button
              onPointerUp={() => {
                // Abandonar: el parcial cuenta para el récord, no para el reto
                if (endTimerRef.current) clearTimeout(endTimerRef.current);
                if (tickRef.current) clearInterval(tickRef.current);
                setFinalScore(scoreRef.current);
                setPhase("result");
              }}
              className="text-sm font-bold transition-colors"
              style={{ color: "var(--muted)" }}
            >
              ← Salir
            </button>
            <span className="text-xs font-black uppercase tracking-widest" style={{ color: "var(--muted)" }}>
              {cleared}/{words.length}
            </span>
            <span className="font-display text-lg font-extrabold" style={{ color: "var(--accent)" }}>
              {score}
            </span>
          </div>

          {/* Barra de presión (scaleX, nunca width) */}
          <div
            className="h-2.5 w-full overflow-hidden rounded-full"
            style={{ background: "var(--border)" }}
            role="progressbar"
            aria-valuenow={Math.round(pressure)}
            aria-valuemin={0}
            aria-valuemax={PRESSURE_MAX}
            aria-label="Presión del globo"
          >
            <div
              data-testid="pressure-bar"
              className="h-full w-full origin-left rounded-full"
              style={{
                transform: `scaleX(${danger})`,
                background: danger > 0.75 ? "var(--danger)" : danger > 0.5 ? "var(--gold)" : "var(--success)",
                transition: "transform 0.1s linear, background 0.3s",
              }}
            />
          </div>

          {/* Globo */}
          <div className="flex justify-center">
            <HotAirBalloon
              phase={outcome === "crash" ? "exploded" : outcome === "land" ? "landed" : "flying"}
              danger={danger}
            />
          </div>

          {/* Imagen de la palabra */}
          {current && (
            <div className="dots-card flex flex-col items-center gap-2 px-4 py-3">
              {current.word.src && (
                <WordImg src={current.word.src} size="w-24 h-24" customClass="rounded-xl" />
              )}
            </div>
          )}

          {/* Opciones */}
          <div className="flex flex-col gap-2">
            {current?.options.map((opt) => (
              <button
                key={opt}
                data-testid={`opt-${opt}`}
                onPointerUp={() => answer(opt)}
                disabled={outcome !== "none"}
                className="dots-pressable w-full rounded-2xl border-2 px-4 py-3 text-base font-extrabold disabled:opacity-40"
                style={{
                  borderColor: "var(--border)",
                  background: "var(--surface)",
                  color: "var(--foreground)",
                  ["--press-color" as string]: "var(--accent-soft)",
                }}
              >
                {opt}
              </button>
            ))}
          </div>
        </div>
      )}

      {phase === "result" && (
        <GameResult
          gameKey="dont-pop"
          score={finalScore}
          onReplay={startGame}
          onExit={() => router.push("/play")}
          extra={
            <p className="text-sm font-bold text-center" style={{ color: "var(--muted)" }}>
              {outcome === "land" ? "🛬 Aterrizaje perfecto" : "💥 ¡Reventó!"} ·{" "}
              {cleared}/{words.length} palabras
            </p>
          }
        />
      )}
    </div>
  );
}
```

Nota: si las props reales de `HotAirBalloon` no son `{ phase, danger }`, adáptalas
leyendo el componente y déjalo anotado en el reporte — no cambies su API.

- [ ] **Step 3: Verificar**

Run: `source ~/.nvm/nvm.sh && npm run lint && npx tsc --noEmit && npx next build` — los tres limpios.
Confirmar además:
`grep -nE "window\.location|dangerouslySetInnerHTML|filter: *\`?hue-rotate" "app/(app)/games/dont-pop/page.tsx" components/games/dont-pop/hot-air-balloon.tsx` → sin resultados.

- [ ] **Step 4: Commit**

```bash
git add "app/(app)/games/dont-pop/page.tsx" components/games/dont-pop/hot-air-balloon.tsx
git commit -m "feat(dont-pop): reescritura moderna con 3 opciones, score por calma y peligro sin filter"
```

---

### Task 3: Verificación jugada, docs y limpieza

**Files:**
- Modify: `docs/ARQUITECTURA.md`, `plans/README.md`
- Delete: `app/dev-juice/page.tsx`

- [ ] **Step 1: Banco que monta la página real**

```tsx
"use client";
// BANCO TEMPORAL — NO COMMITEAR.
import React from "react";
import api from "@/lib/api-client";
import DontPopPage from "@/app/(app)/games/dont-pop/page";

const WORDS = Array.from({ length: 4 }, (_, i) => ({
  id: i + 1, title: `word${i + 1}`, src: null, answered: false,
}));

declare global {
  interface Window { __posts: string[] }
}

if (typeof window !== "undefined") {
  window.__posts = [];
  api.defaults.adapter = async (config) => {
    const url = config.url ?? "";
    if ((config.method ?? "get").toLowerCase() === "post") window.__posts.push(url);
    let data: unknown = {};
    if (url.includes("/games/dont-pop")) data = WORDS;
    else if (url.includes("/games/records") || url.includes("/games/scores")) data = [];
    else if (url.includes("/games/score")) data = { xpGained: 10, isNewHighScore: false };
    return { data, status: 200, statusText: "OK", headers: {}, config } as never;
  };
}

export default function DevJuicePage() {
  return <DontPopPage />;
}
```

- [ ] **Step 2: Verificación jugada (la hace el controller)**

Con `?challenge=5`: arranca con **3 opciones** distintas; acertar sube el score en 100-160 según la presión y **baja** la barra; fallar la sube; limpiar las 4 palabras aterriza y llega a result; salir a mitad postea solo `/games/score`; el globo se tiñe por **opacidad** (cero `filter` en su style computado).

- [ ] **Step 3: Borrar el banco**

```bash
rm -rf app/dev-juice
```

- [ ] **Step 4: Docs**

`docs/ARQUITECTURA.md`:
- La línea `Legacy (1): dont-pop.` y su paréntesis pasan a: `Legacy: ninguno. (flashcards y speed-round fueron retirados el 2026-08-10 con sus récords purgados; dot-bombs, dotaxi y dont-pop fueron reconstruidos RN-safe — specs en `docs/superpowers/specs/`.)`
- `Nuevos (10, ...` pasa a `Nuevos (11, ...`.
- Añadir a la tabla: `| ¡No lo revientes! | dont-pop | sin reloj: el globo se infla solo y es la presión; imagen + 3 palabras, acertar desinfla y fallar infla; responder tranquilo paga más | words (con img) |`
- En "Deuda conocida", añadir: `- `/games/dont-pop` no acepta seed (como dotaxi): no debe entrar en reto ni torneo hasta que el endpoint lo honre.`

`plans/README.md`: la línea de pendientes pasa a `Pendientes de auditoría: ninguno — los 11 juegos están certificados o reconstruidos.` y se añade al final el párrafo de Don't Pop 2.0 con fecha 2026-08-12 resumiendo: 3 opciones (antes 2, azar al 50 %), score con fórmula por calma (antes el conteo de palabras), peligro por opacidad en vez de `filter`, regla 3 saneada (el viejo llamaba `land()` y `setIndex` dentro del updater de `setData`), retry por estado que cierra la victoria falsa con score 0, español, `GameIntro`/`GameResult`, `router.push` y seed vía `useGameSeed`.

- [ ] **Step 5: Gates finales**

```bash
source ~/.nvm/nvm.sh && npm run lint && npx tsc --noEmit && npx next build
```
Los tres limpios; `git status --short` sin `app/dev-juice`. (Si el build se queja de tipos stale: `rm -rf .next` y repetir.)

- [ ] **Step 6: Commit**

```bash
git add docs/ARQUITECTURA.md plans/README.md
git commit -m "docs(dont-pop): modernización del último legacy y tracker al día"
```

---

## Self-Review (hecho al escribir el plan)

- **Cobertura del spec**: mecánica del globo conservada (T2 constantes + tick) ✓ · 3 opciones con distractores no-respondidos (T1 `buildRound` + aserciones) ✓ · degradación con mazo corto sin duplicados (T1) ✓ · score `100 + 60×calma` (T1 `roundScore`) ✓ · peligro por opacidad (T2 Step 1) ✓ · español (T2) ✓ · GameIntro/GameResult con score solo ahí y `finalScore` junto al phase (T2 `finishGame`) ✓ · loadError/fetchAttempt que cierra la victoria falsa (T2) ✓ · router.push (T2) ✓ · seed vía useGameSeed (T2) ✓ · regla 3: `buildRound` se llama FUERA de cualquier updater (T2 `advance`) ✓ · timers limpiados (T2 efecto de unmount + `finishGame`) ✓ · torneo/reto solo completas con `{ completed }` (T2) ✓.
- **Placeholders**: ninguno.
- **Consistencia de tipos**: `buildRound(words, answeredIds, rng)` y `roundScore(pressure)` idénticas en T1 (definición) y T2 (consumo); `current` es `{ word, options } | null` en ambos.
- **Riesgo anotado**: el plan asume que `HotAirBalloon` acepta `{ phase, danger }`. Si su API real difiere, T2 Step 2 indica adaptarla sin cambiar el componente y reportarlo.
