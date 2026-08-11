# Constructor 2.0 (diferenciación) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Diferenciar Constructor del ejercicio `buildUp` de la práctica: bonus de tiempo por frase (sin derrota) y señuelos cruzados escalados, más los bugs de salida/hardcodes.

**Architecture:** Un módulo puro nuevo (`builder-rules.ts`) junto a la página con las dos reglas nuevas (bonus por tiempo y enriquecido de pool), y la página cableándolo. Toda la lógica decidible vive en el módulo puro y se verifica con un banco de aserciones; la página solo orquesta.

**Tech Stack:** Next.js 16 (app router), React 19, Tailwind 4 + tokens de `app/globals.css`, `useTicker` (rAF, ya usado por word-tower y dot-bombs).

**Spec:** `docs/superpowers/specs/2026-08-10-constructor-diferenciacion.md` (aprobado).

## Global Constraints

- **RN-safe (regla 2 CLAUDE.md)**: solo `onPointerUp`; sin keydown, canvas, Drag API ni `<input>`. Animación solo `transform`/`opacity`; el cronómetro usa un tick rAF (`useTicker`), **la barra se anima con `transform: scaleX()`, nunca `width`**.
- **Regla 3**: sin `setState` síncrono en cuerpo de `useEffect`; sin efectos colaterales dentro de updaters de `setState`. Leer refs en JSX es error del compiler lint — usar estado snapshot.
- **Regla 4**: score solo vía `GameResult`. **Salir a mitad NO envía score** (navega a `/play`), igual que memory.
- **Regla 5**: `loadError` + Reintentar con patrón `fetchAttempt` por estado.
- **Regla 7**: `?seed=` debe seguir produciendo mazos idénticos entre rivales — todo lo aleatorio nuevo se deriva del seed cuando existe.
- **UI en español**, tono juguetón.
- Economía exacta del spec: `SCORE_BASE = 100`; bonus **decae linealmente de 60 a 0 en 20 s** y se congela en 0; un "Comprobar" fallido pone el bonus de esa frase a 0; **nunca hay game over**. Máximo 8 × 160 = 1.280.
- Señuelos por tramo (índice 0-based): frases 0-2 → 2 (solo backend); 3-5 → +2 cruzados; 6-7 → +4 cruzados. Se excluyen palabras presentes en la respuesta actual (case-insensitive). Si el pool cruzado no alcanza, se añaden los que haya.
- **Sin test runner de componentes**: cada tarea verifica con `source ~/.nvm/nvm.sh && npm run lint && npx tsc --noEmit` (+ `npx next build` donde se indique) y con un **banco temporal** `app/dev-juice/page.tsx` (fuera del grupo `(app)`, sin auth) que corre aserciones o monta la página real. **El banco NUNCA se commitea**: cada commit añade rutas exactas con `git add <paths>`, jamás `git add -A`. Se borra en la Task 4.
- Lección de verificación heredada: en el preview sin compositing **ni rAF ni ResizeObserver disparan**; un banco que monte la página real debe shimear `requestAnimationFrame` sobre `setTimeout` y mockear axios vía `api.defaults.adapter`. Entre taps sintéticos, `await` ~50 ms (no son eventos discretos para React).
- `source ~/.nvm/nvm.sh` SIEMPRE antes de node/npm.

## File Structure

- `app/(app)/games/sentence-builder/builder-rules.ts` — **crear**. Puro, sin React ni DOM: `timeBonus`, `decoyCountFor`, `buildPool`. Portable a RN tal cual.
- `app/(app)/games/sentence-builder/page.tsx` — **modificar**. Cablea el módulo: cronómetro con `useTicker`, pool enriquecido, HUD con barra, fix de salida, hardcodes y retry.
- `docs/ARQUITECTURA.md`, `plans/README.md` — **modificar** al final (Task 4).

---

### Task 1: Módulo puro `builder-rules.ts`

**Files:**
- Create: `app/(app)/games/sentence-builder/builder-rules.ts`
- Test (banco): `app/dev-juice/page.tsx` (temporal, NO se commitea)

**Interfaces:**
- Consumes: nada (módulo hoja, sin imports).
- Produces (Tasks 2-3 dependen de esto, firmas exactas):
  - `type Rng = () => number`
  - `BONUS_MAX = 60`
  - `BONUS_WINDOW_MS = 20000`
  - `timeBonus(elapsedMs: number, failed: boolean): number`
  - `decoyCountFor(sentenceIndex: number): number`
  - `buildPool(baseChips: readonly string[], answer: readonly string[], crossWords: readonly string[], extraDecoys: number, rng: Rng): string[]`

- [ ] **Step 1: Escribir el banco primero (rojo)**

Crear `app/dev-juice/page.tsx`. Antes de existir el módulo, `npx tsc --noEmit` DEBE fallar con "Cannot find module .../builder-rules" — esa es la evidencia RED.

```tsx
"use client";
// BANCO TEMPORAL — NO COMMITEAR. Se borra en Task 4.
import React from "react";
import {
  timeBonus,
  decoyCountFor,
  buildPool,
  BONUS_MAX,
  BONUS_WINDOW_MS,
} from "@/app/(app)/games/sentence-builder/builder-rules";

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

  // ── timeBonus ──
  t("t=0 sin fallo → 60", timeBonus(0, false) === BONUS_MAX);
  t("t=10s → 30 (mitad)", timeBonus(10000, false) === 30);
  t("t=20s → 0 (fin de ventana)", timeBonus(BONUS_WINDOW_MS, false) === 0);
  t("t=60s → 0, nunca negativo", timeBonus(60000, false) === 0);
  t("con fallo → 0 aunque sea instantáneo", timeBonus(0, true) === 0);
  t("bonus es entero", Number.isInteger(timeBonus(3333, false)));

  // ── decoyCountFor ──
  t("frases 0-2 → 0 extras", [0, 1, 2].every((i) => decoyCountFor(i) === 0));
  t("frases 3-5 → 2 extras", [3, 4, 5].every((i) => decoyCountFor(i) === 2));
  t("frases 6-7 → 4 extras", [6, 7].every((i) => decoyCountFor(i) === 4));
  t("índices altos siguen en 4", decoyCountFor(20) === 4);

  // ── buildPool ──
  const answer = ["the", "cat", "sleeps"];
  const base = ["the", "cat", "sleeps", "dog", "runs"]; // respuesta + 2 del backend
  const cross = ["house", "green", "quickly", "cat", "THE"]; // 'cat'/'THE' colisionan

  const p0 = buildPool(base, answer, cross, 0, mulberry32(1));
  t("extras=0 → mismo tamaño que base", p0.length === base.length);
  t("extras=0 → mismo contenido", [...p0].sort().join() === [...base].sort().join());

  const p2 = buildPool(base, answer, cross, 2, mulberry32(2));
  t("extras=2 → base+2", p2.length === base.length + 2);
  t("no añade palabras de la respuesta (case-insensitive)",
    p2.filter((w) => w.toLowerCase() === "cat").length === 1 &&
    p2.filter((w) => w.toLowerCase() === "the").length === 1);
  t("la respuesta completa sigue en el pool",
    answer.every((w) => p2.some((c) => c.toLowerCase() === w.toLowerCase())));

  // pool cruzado corto: añade los que haya, sin romper
  const p9 = buildPool(base, answer, ["house"], 4, mulberry32(3));
  t("cruzado corto → añade solo los disponibles", p9.length === base.length + 1);

  // determinismo por seed
  const a = buildPool(base, answer, cross, 2, mulberry32(7)).join("|");
  const b = buildPool(base, answer, cross, 2, mulberry32(7)).join("|");
  t("mismo seed → mismo pool", a === b);
  t("baraja (no es concatenación directa)",
    buildPool(base, answer, cross, 2, mulberry32(11)).join("|") !== base.concat(["house", "green"]).join("|"));

  // pureza
  const src = [...base];
  buildPool(src, answer, cross, 2, mulberry32(5));
  t("no muta baseChips", src.join("|") === base.join("|"));

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
Expected: FAIL con `error TS2307: Cannot find module '.../builder-rules'`

- [ ] **Step 3: Escribir el módulo**

```ts
// app/(app)/games/sentence-builder/builder-rules.ts
// Reglas puras de Constructor: bonus por tiempo y enriquecido del pool de
// fichas. Sin React ni DOM — portable a RN tal cual.

export type Rng = () => number; // [0,1) — inyectable (seed/tests)

/** Bonus máximo por frase, cuando se resuelve al instante. */
export const BONUS_MAX = 60;
/** Ventana en la que el bonus decae de BONUS_MAX a 0. */
export const BONUS_WINDOW_MS = 20000;

/**
 * Bonus de la frase actual: decae linealmente de BONUS_MAX a 0 en
 * BONUS_WINDOW_MS y se congela en 0 (nunca negativo, sin límite de tiempo).
 * Un "Comprobar" fallido lo anula por completo.
 */
export function timeBonus(elapsedMs: number, failed: boolean): number {
  if (failed) return 0;
  const left = 1 - elapsedMs / BONUS_WINDOW_MS;
  return Math.max(0, Math.round(BONUS_MAX * left));
}

/** Señuelos CRUZADOS extra según el tramo de la partida (índice 0-based). */
export function decoyCountFor(sentenceIndex: number): number {
  if (sentenceIndex <= 2) return 0;
  if (sentenceIndex <= 5) return 2;
  return 4;
}

/** Fisher-Yates con rng inyectado; devuelve copia, no muta la entrada. */
function shuffleWith<T>(arr: readonly T[], rng: Rng): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/**
 * Pool de fichas de la frase: las del backend (respuesta + sus distractores)
 * más `extraDecoys` palabras tomadas de OTRAS frases de la partida. Se
 * excluyen las que ya estén en la respuesta (case-insensitive) para no crear
 * ambigüedad, y las repetidas entre sí. Si el cruzado no alcanza, añade las
 * que haya. Todo el orden final se baraja con `rng`.
 */
export function buildPool(
  baseChips: readonly string[],
  answer: readonly string[],
  crossWords: readonly string[],
  extraDecoys: number,
  rng: Rng,
): string[] {
  if (extraDecoys <= 0) return shuffleWith(baseChips, rng);

  const taken = new Set(baseChips.map((w) => w.toLowerCase()));
  for (const w of answer) taken.add(w.toLowerCase());

  const extras: string[] = [];
  for (const w of shuffleWith(crossWords, rng)) {
    if (extras.length >= extraDecoys) break;
    const key = w.toLowerCase();
    if (taken.has(key)) continue;
    taken.add(key);
    extras.push(w);
  }

  return shuffleWith([...baseChips, ...extras], rng);
}
```

- [ ] **Step 4: Verificar GREEN**

Run: `source ~/.nvm/nvm.sh && npm run lint && npx tsc --noEmit`
Expected: ambos limpios, sin salida de error.
Luego el controller levanta el preview y lee `/dev-juice`: `[data-testid='verdict']` debe decir `PASS (17)` y no debe haber ningún `[data-testid='fail']`.

- [ ] **Step 5: Commit (solo el módulo)**

```bash
git add "app/(app)/games/sentence-builder/builder-rules.ts"
git commit -m "feat(sentence-builder): reglas puras de bonus por tiempo y pool cruzado"
```

---

### Task 2: Cronómetro y economía de puntos

**Files:**
- Modify: `app/(app)/games/sentence-builder/page.tsx`

**Interfaces:**
- Consumes: `timeBonus`, `BONUS_MAX`, `BONUS_WINDOW_MS` de `./builder-rules`; `useTicker(fps, cb(dtMs), running)` de `@/hooks/use-ticker`.
- Produces (Task 3 usa el HUD): estado `bonusNow: number` (snapshot del bonus vigente), ref `sentenceStartRef`, y la fórmula de score `SCORE_BASE + bonus`.

- [ ] **Step 1: Imports y constantes**

En `page.tsx`, añadir a los imports:

```tsx
import { useTicker } from "@/hooks/use-ticker";
import { timeBonus, BONUS_MAX, BONUS_WINDOW_MS } from "./builder-rules";
```

Junto a las constantes de arriba (`SCORE_BASE = 100` en la línea 28) **eliminar** `const SCORE_BONUS_CLEAN = 20;` (lo reemplaza el bonus de tiempo) y añadir:

```tsx
const TICKER_FPS = 10; // el bonus solo necesita refrescarse ~10 veces/s
```

- [ ] **Step 2: Estado del cronómetro**

Junto a los demás estados/refs de `DotBuilderInner` (tras `checkingRef`), añadir:

```tsx
  // Cronómetro de la frase: el bonus decae con el tiempo pero nunca hay
  // derrota — pasados BONUS_WINDOW_MS solo se ganan los puntos base
  const sentenceStartRef = useRef<number>(0);
  const bonusFrozenRef = useRef<number | null>(null); // congelado al acertar
  const [bonusNow, setBonusNow] = useState(BONUS_MAX);
```

- [ ] **Step 3: Tick del bonus**

Añadir tras el efecto que inicializa las fichas:

```tsx
  const onTick = useCallback(() => {
    if (bonusFrozenRef.current !== null) return; // frase resuelta: no sigue bajando
    const elapsed = performance.now() - sentenceStartRef.current;
    setBonusNow(timeBonus(elapsed, failedChecks > 0));
  }, [failedChecks]);

  useTicker(TICKER_FPS, onTick, phase === "playing" && checkState === "idle");
```

- [ ] **Step 4: Reiniciar el cronómetro con cada frase**

En el efecto "Initialize chips when sentence changes" (hoy en `page.tsx:142-153`), añadir dentro, junto a los demás `setState`:

```tsx
    sentenceStartRef.current = performance.now();
    bonusFrozenRef.current = null;
    setBonusNow(BONUS_MAX);
```

- [ ] **Step 5: Nueva fórmula de score**

En `handleCheck`, la rama `wrongIdx === null` (hoy `page.tsx:238-241`), reemplazar:

```tsx
      playSound("correct");
      const cleanRun = failedChecks === 0;
      setScore((prev) => prev + SCORE_BASE + (cleanRun ? SCORE_BONUS_CLEAN : 0));
```

por:

```tsx
      playSound("correct");
      const earned = timeBonus(
        performance.now() - sentenceStartRef.current,
        failedChecks > 0,
      );
      bonusFrozenRef.current = earned; // congela el HUD durante la corrección
      setBonusNow(earned);
      setScore((prev) => prev + SCORE_BASE + earned);
```

- [ ] **Step 6: Actualizar el texto de acierto**

En el overlay de acierto (hoy `page.tsx:585`), reemplazar:

```tsx
                ¡Correcto! {failedChecks === 0 ? "+120 pts 🎯" : "+100 pts"}
```

por:

```tsx
                ¡Correcto! +{SCORE_BASE + bonusNow} pts {bonusNow > 0 ? "⚡" : ""}
```

- [ ] **Step 7: Verificar**

Run: `source ~/.nvm/nvm.sh && npm run lint && npx tsc --noEmit`
Expected: ambos limpios. `SCORE_BONUS_CLEAN` no debe quedar referenciado en ningún sitio (si lint no lo detecta, `grep -n "SCORE_BONUS_CLEAN" app/\(app\)/games/sentence-builder/page.tsx` debe devolver vacío).

- [ ] **Step 8: Commit**

```bash
git add "app/(app)/games/sentence-builder/page.tsx"
git commit -m "feat(sentence-builder): bonus de tiempo por frase sin estado de derrota"
```

---

### Task 3: Pool cruzado, HUD con barra y bugs

**Files:**
- Modify: `app/(app)/games/sentence-builder/page.tsx`

**Interfaces:**
- Consumes: `buildPool`, `decoyCountFor` de `./builder-rules`; `bonusNow`/`BONUS_MAX` de la Task 2.
- Produces: juego completo y diferenciado.

- [ ] **Step 1: Importar las reglas de pool**

Ampliar el import de `./builder-rules` a:

```tsx
import {
  timeBonus,
  buildPool,
  decoyCountFor,
  BONUS_MAX,
  BONUS_WINDOW_MS,
} from "./builder-rules";
```

- [ ] **Step 2: Pool enriquecido al montar cada frase**

En el efecto "Initialize chips when sentence changes", reemplazar la línea `setPoolChips([...s.chips]);` por:

```tsx
    // señuelos cruzados: palabras de las OTRAS frases de esta partida — mismo
    // registro y misma voz, así que engañan más que un distractor genérico
    const cross = sentences
      .filter((_, i) => i !== sentenceIndex)
      .flatMap((other) => other.answer);
    // el seed manda cuando existe, para que torneo/retos sirvan mazos idénticos
    const rng =
      seed !== undefined
        ? mulberry32(seed + sentenceIndex)
        : Math.random;
    setPoolChips(
      buildPool(s.chips, s.answer, cross, decoyCountFor(sentenceIndex), rng),
    );
```

y añadir `sentences` y `seed` a las deps del efecto (el `eslint-disable-next-line` que hoy lo precede puede quedarse si lint lo sigue exigiendo; si lint acepta las deps completas, quitarlo).

- [ ] **Step 3: Añadir `mulberry32` a la página**

Junto a los helpers superiores de `page.tsx` (antes del componente), añadir:

```tsx
/** PRNG determinista para derivar el pool del seed (mismo mazo entre rivales). */
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
```

- [ ] **Step 4: Barra de bonus en el HUD**

En el HUD, dentro del `<div className="flex flex-col items-center">` que hoy muestra `Frase {sentenceIndex + 1}/{TOTAL_SENTENCES}` (hoy `page.tsx:384-390`), reemplazar ese bloque completo por:

```tsx
            <div className="flex flex-col items-center gap-1">
              <span
                className="text-xs font-black uppercase tracking-widest"
                style={{ color: "var(--muted)" }}
              >
                Frase {sentenceIndex + 1}/{sentences.length}
              </span>
              {/* barra de bonus: scaleX (nunca width) */}
              <div
                className="h-1.5 w-20 overflow-hidden rounded-full"
                style={{ background: "var(--border)" }}
                aria-label={`Bonus ${bonusNow}`}
              >
                <div
                  className="h-full w-full origin-left rounded-full"
                  style={{
                    transform: `scaleX(${bonusNow / BONUS_MAX})`,
                    background: bonusNow > 0 ? "var(--success)" : "var(--muted)",
                    transition: "transform 0.1s linear, background 0.3s",
                  }}
                />
              </div>
            </div>
```

- [ ] **Step 5: Salir a mitad NO envía score**

En el botón "← Salir" del HUD (hoy `page.tsx:371-378`), reemplazar el cuerpo del handler:

```tsx
              onPointerUp={() => {
                if (advanceTimerRef.current) {
                  clearTimeout(advanceTimerRef.current);
                  advanceTimerRef.current = null;
                }
                setPhase("result");
              }}
```

por:

```tsx
              onPointerUp={() => {
                // Abandonar NO envía score: el efecto de "result" dispara
                // submitChallengeScore y el guard del reto NO se rearma, así
                // que salir a mitad quemaba el único intento del 1v1
                if (advanceTimerRef.current) {
                  clearTimeout(advanceTimerRef.current);
                  advanceTimerRef.current = null;
                }
                router.push("/play");
              }}
```

- [ ] **Step 6: Quitar el hardcode de 8 frases**

Eliminar `const TOTAL_SENTENCES = 8;` (hoy `page.tsx:27`). El HUD ya usa `sentences.length` tras el Step 4; en el texto del intro (hoy `page.tsx:350-355`), reemplazar el array `howTo` por:

```tsx
            howTo={[
              "Escucha la narración en inglés.",
              "Toca las fichas para armar la frase en orden.",
              "Toca 'Comprobar' cuando estés listo.",
              "Cuanto más rápido, más bonus: hasta +60 por frase. ¡Sin reloj de derrota!",
            ]}
```

Si queda alguna otra referencia a `TOTAL_SENTENCES`, sustituirla por `sentences.length`.

- [ ] **Step 7: Reintentar por estado (regla 5)**

Eliminar el callback `fetchSentences` completo (hoy `page.tsx:153-165`) y su uso en el botón Reintentar. En su lugar: añadir el contador de intentos junto a los estados,

```tsx
  const [fetchAttempt, setFetchAttempt] = useState(0);
```

añadir `fetchAttempt` a las deps del efecto de carga (hoy `useEffect(..., [seed])` en `page.tsx:88-120` → `[seed, fetchAttempt]`), y el botón Reintentar pasa a:

```tsx
          onPointerUp={() => {
            setLoadError(false);
            setLoading(true);
            setFetchAttempt((n) => n + 1);
          }}
```

(mantener las clases y estilos que ya tenga el botón).

- [ ] **Step 8: Verificar**

Run: `source ~/.nvm/nvm.sh && npm run lint && npx tsc --noEmit && npx next build`
Expected: los tres limpios; `/games/sentence-builder` aparece en el output del build.

- [ ] **Step 9: Commit**

```bash
git add "app/(app)/games/sentence-builder/page.tsx"
git commit -m "feat(sentence-builder): señuelos cruzados, barra de bonus y salida sin enviar score"
```

---

### Task 4: Verificación jugada, docs y limpieza

**Files:**
- Modify: `docs/ARQUITECTURA.md`, `plans/README.md`
- Delete: `app/dev-juice/page.tsx` (el banco)

**Interfaces:**
- Consumes: todo lo anterior.
- Produces: rama lista para review final.

- [ ] **Step 1: Banco que monta la página real**

Reemplazar `app/dev-juice/page.tsx` por un banco que monte la página real con axios mockeado y shim de rAF (patrón heredado de dot-bombs — sin él, `useTicker` no corre en el preview):

```tsx
"use client";
// BANCO TEMPORAL — NO COMMITEAR.
import React from "react";
import api from "@/lib/api-client";
import SentenceBuilderPage from "@/app/(app)/games/sentence-builder/page";

const SENTENCES = [
  { id: 1, ext: "a", answer: ["the", "cat", "sleeps"], chips: ["the", "cat", "sleeps", "dog", "runs"] },
  { id: 2, ext: "b", answer: ["i", "like", "coffee"], chips: ["i", "like", "coffee", "tea", "hate"] },
  { id: 3, ext: "c", answer: ["she", "reads", "books"], chips: ["she", "reads", "books", "he", "writes"] },
  { id: 4, ext: "d", answer: ["we", "play", "outside"], chips: ["we", "play", "outside", "they", "inside"] },
];

if (typeof window !== "undefined") {
  window.requestAnimationFrame = ((cb: FrameRequestCallback) =>
    window.setTimeout(() => cb(performance.now()), 33)) as typeof window.requestAnimationFrame;
  window.cancelAnimationFrame = ((id: number) => window.clearTimeout(id)) as typeof window.cancelAnimationFrame;
  api.defaults.adapter = async (config) => {
    const url = config.url ?? "";
    const data = url.includes("/games/sentence-builder")
      ? { sentences: SENTENCES }
      : url.includes("/games/records") || url.includes("/games/scores")
        ? []
        : {};
    return { data, status: 200, statusText: "OK", headers: {}, config } as never;
  };
}

export default function DevJuicePage() {
  return <SentenceBuilderPage />;
}
```

- [ ] **Step 2: Verificación jugada (la hace el controller)**

El controller levanta el preview, navega a `/dev-juice` y comprueba con `javascript_tool`:
- La barra de bonus baja: `transform: scaleX(...)` decrece con el tiempo y el elemento **no** tiene `width` inline animado.
- Resolver una frase al instante paga ~160 y una lenta paga 100 (leyendo el marcador del HUD antes/después).
- La frase 4 (índice 3) presenta **2 fichas más** en el pool que la frase 1 (índice 0) — señuelos cruzados activos — y ninguna de las añadidas coincide (case-insensitive) con una palabra de la respuesta.
- Pasados 20 s la partida sigue jugable (no hay game over) y el bonus se queda en 0.
- El botón "← Salir" navega a `/play` sin pasar por la pantalla de resultado.

Si algo falla, se despacha un fix antes de continuar.

- [ ] **Step 3: Borrar el banco**

```bash
rm -rf app/dev-juice
```

- [ ] **Step 4: Docs**

En `docs/ARQUITECTURA.md`, en la tabla de juegos, reemplazar la fila del Constructor:

```
| Constructor | sentence-builder | oyes la frase, la armas con fichas en orden | sentences con narración |
```

por:

```
| Constructor | sentence-builder | oyes la frase, la armas con fichas en orden; bonus por rapidez y señuelos cruzados que escalan (diferenciado del buildUp de la práctica) | sentences con narración |
```

Y en la sección "Deuda conocida (frontend)", añadir al final de la línea que habla de "Salir" (la que menciona dot-match y memory): ` En sentence-builder, "Salir" también abandona sin enviar — el guard del reto 1v1 no se rearma y un parcial quemaba el intento (corregido 2026-08-10).`

En `plans/README.md`, en la lista de pendientes de auditoría, quitar `sentence-builder` y añadir bajo la línea de retirados:

```
Constructor (sentence-builder) fue diferenciado del buildUp de la práctica el
2026-08-10 (bonus por tiempo + señuelos cruzados; spec en
`docs/superpowers/specs/2026-08-10-constructor-diferenciacion.md`) — pendiente
solo su pasada de juice.
```

- [ ] **Step 5: Gates finales**

Run: `source ~/.nvm/nvm.sh && npm run lint && npx tsc --noEmit && npx next build`
Expected: los tres limpios. `git status --short` no debe mostrar `app/dev-juice`.
(Si el build se queja de tipos stale de la ruta borrada: `rm -rf .next` y repetir — lección heredada de dot-bombs.)

- [ ] **Step 6: Commit**

```bash
git add docs/ARQUITECTURA.md plans/README.md
git commit -m "docs(sentence-builder): Constructor diferenciado y tracker al día"
```

---

## Self-Review (hecho al escribir el plan)

- **Cobertura del spec**: bonus 60→0 en 20 s congelado (T1 `timeBonus` + T2 tick) ✓ · sin game over (nada corta la partida por tiempo; el ticker solo actualiza un número) ✓ · fallo anula bonus (`timeBonus(_, failed)` y `failedChecks > 0`) ✓ · reemplaza `SCORE_BONUS_CLEAN` (T2 Step 1 lo elimina) ✓ · máx 1.280 (8 × (100+60)) ✓ · barra con color que cambia (T3 Step 4) ✓ · cronómetro se reinicia por frase (T2 Step 4) y se congela en la corrección (`bonusFrozenRef` + el `running` del ticker exige `checkState === "idle"`) ✓ · escalado 2/4/6 = 0/+2/+4 extras (T1 `decoyCountFor`) ✓ · exclusión case-insensitive de palabras de la respuesta (T1 `buildPool` + aserción) ✓ · pool corto degrada (aserción "cruzado corto") ✓ · determinismo por seed (T3 `mulberry32(seed + sentenceIndex)`; el `+ sentenceIndex` evita que todas las frases barajen igual, y sigue siendo idéntico entre rivales con el mismo seed) ✓ · salir sin enviar (T3 Step 5) ✓ · hardcodes fuera (T3 Step 6) ✓ · retry por estado (T3 Step 7) ✓ · intro actualizado (T3 Step 6) ✓ · docs (T4) ✓.
- **Placeholders**: ninguno; cada paso que cambia código muestra el código.
- **Consistencia de tipos**: `timeBonus(elapsedMs, failed)`, `decoyCountFor(sentenceIndex)`, `buildPool(baseChips, answer, crossWords, extraDecoys, rng)` idénticas en T1 (definición), T2 y T3 (consumo). `bonusNow` es estado en ambas tareas que lo tocan; `BONUS_MAX` se importa donde se usa (T2 estado inicial, T3 barra).
- **Nota de riesgo para el ejecutor**: `BONUS_WINDOW_MS` se importa en T2 aunque solo lo consuma `timeBonus` internamente — si lint lo marca como no usado, quitarlo del import (no de la firma del módulo).
