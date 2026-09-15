# Rediseño look & feel — Subproyecto B (Camino v3) — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** El Camino muestra una dificultad a la vez con la ilustración del nivel como protagonista (nodo sin contenedor de 128 px), un banner de dificultad con Doty narrador que se pliega en una cabecera pegajosa al scrollear, sub-banners por sección, botón "Volver a mi nivel", vista previa de dificultades bloqueadas y un HUD sin marcos con la llama encendida solo si la racha de hoy está asegurada.

**Architecture:** Todo es frontend (dots-webapp); `GET /path` no cambia. La lógica de vista (qué dificultad mostrar, vecinas, conteo de lecciones, frases por umbral, poses deterministas) vive en un módulo puro `lib/path-view.ts` probado con `node --test`. Los componentes del Camino se reparten por responsabilidad: `path-node` (tile), `path-section` (zigzag + sub-banner), `path-difficulty` (vista de UNA dificultad: banner, secciones, niebla), `path-container` (fetch, `?d=`, navegación, tarjetas bloqueadas) y piezas pequeñas (`segmented-bar`, `section-banner`, `difficulty-banner`, `difficulty-nav`, `folded-header`, `back-to-current`, `locked-difficulty`, `upcoming-divider`). La detección de "esta pose todavía es placeholder" sale del propio registro generado (`components/ui/doty/pending.ts`), así los puntos de cableado usan el fallback del spec §2.3 sin tocar código cuando llegue el arte.

**Tech Stack:** Next.js 16 (app router) + React 19 + Tailwind 4; `next/image`; `IntersectionObserver`; `node --test` (Node 24 ejecuta `.ts` puros sin compilar); tokens de tema generados (A).

**Spec:** `docs/superpowers/specs/2026-09-14-rediseno-look-and-feel-juvenil-design.md` — §3 (Subproyecto B), §1 (principios), §2.3 (tabla de cableado y fallbacks), §8 (orden y ramas).

## Global Constraints

- Webapp: `source ~/.nvm/nvm.sh && nvm use` antes de cualquier `node`/`npm` (Node 24 por `.nvmrc`). Verificación final siempre `npm run lint && npm run test:scripts && npx next build`.
- Rama `redesign/b-camino` desde `main` (solo dots-webapp; **no hay cambios de backend en B**). **Sin push a origin.** Trabajo en worktree fuera del checkout principal (el dev server de Sergio vive ahí).
- Commits terminan con `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`.
- Regla 1: navegación con `router.push`/`router.replace`, nunca `window.location.*`. Regla 2 (RN-safe): solo tap/pointer, nada de hover como única señal, animaciones solo `transform`/`opacity`. Regla 3: nada de `setState` síncrono en el cuerpo de un `useEffect` (un `setState` dentro del callback de un `IntersectionObserver` sí está permitido). Regla 6: `useSearchParams` solo dentro de `<Suspense>`. Regla 10: Doty solo con `<Doty pose=…>` y poses del registro; ningún PNG nuevo en `public/images/Doty/`. Regla 11: cero emoji como icono; iconos de sistema con `<Icon name>` (SVG, `paths.tsx`, viewBox 48, grosor por familia: glifo 3.5) y de economía con `<UiIcon name>`. Regla 12: `app/themes.generated.css` y `lib/theme-colors.ts` no se editan a mano.
- Principio 4 del spec: **sin contenedores para el contenido** (nodos, arte, etiquetas flotan sobre el fondo). El panel teñido `color-mix(in srgb, <acento> 14%, var(--surface))`, sin borde, se reserva para cabeceras: banner de dificultad (radio 28) y sub-banner de sección (radio 22).
- Principio 5: Doty siempre es rosa; el tema vive en el chrome. Tokens que no cambian por paleta: `--gem`, `--flame`, `--gold`, `--success`, `--danger`, `--sky-*` y la paleta de nueve colores de `lib/difficulty-palette.ts`.
- Copy en español. Toda frase de Doty sale de la tabla "Frases aprobadas por momento" de `docs/brand/doty-identity.md`; una frase nueva se añade a la tabla **antes** de cablearse (Task 1 añade las de B).
- Arte pendiente (spec §2.3, §8): narradores de dificultad → fallback `bienvenido` / `sigue-asi` / `orgulloso` por posición; `cerebro-galaxia` → `orgulloso`. El fallback se resuelve con `poseOrFallback` (Task 2), que detecta el placeholder en el registro generado.
- Módulos puros bajo test (`lib/path-view.ts`, `lib/media-url.ts`, `components/ui/doty/pending.ts`): solo `import type` (Node los ejecuta sin bundler; un import de valor con alias `@/` no resuelve). Los tests son `*.test.mjs` junto al módulo e importan `./x.ts` con extensión.
- Geometría fija del spec §3.1: arte 128 px en caja de 136, barra 100 × 8, etiqueta 13 px, wrapper `NODE_W` 150, pista de ancho máximo 640, zigzag 15/50/85 %.

---

## Estructura de archivos

**Crear**
- `lib/path-view.ts` + `lib/path-view.test.mjs` — lógica pura de la vista del Camino.
- `lib/media-url.ts` + `lib/media-url.test.mjs` — resolución de URL de imagen de contenido (sale de `WordImg`).
- `components/ui/doty/pending.ts` + `components/ui/doty/pending.test.mjs` — detección de poses en placeholder y fallback.
- `hooks/use-in-view.ts` — `IntersectionObserver` como hook.
- `components/path/segmented-bar.tsx` — barra segmentada (una casilla por sección).
- `components/path/section-banner.tsx` — sub-banner por sección (solución 2).
- `components/path/difficulty-banner.tsx` — banner de dificultad (composición A).
- `components/path/difficulty-nav.tsx` — flechas anterior/siguiente.
- `components/path/upcoming-divider.tsx` — separador de niebla "Próximamente · Sección N".
- `components/path/locked-difficulty.tsx` — tarjeta punteada de dificultad bloqueada.
- `components/path/folded-header.tsx` — cabecera plegada pegajosa (solución 1).
- `components/path/back-to-current.tsx` — botón "Volver a mi nivel" (flotante en móvil, dentro del panel en escritorio).

**Modificar**
- `components/ui/doty/doty.tsx` — tres tamaños nuevos (`chip` 44, `section` 104, `banner` 158) y `poseOrFallback`.
- `components/ui/word-img/word-img.tsx` — usa `wordImageUrl`.
- `components/ui/icon/paths.tsx` — iconos `izquierda` y `derecha` (familia glifo).
- `components/path/path-node.tsx` — reescritura: variante D.
- `components/path/path-section.tsx` — geometría uniforme, pista 640, sub-banner, modo `preview`.
- `components/path/path-difficulty.tsx` — reescritura: vista de una dificultad (banner + secciones + niebla + grid de escritorio).
- `components/path/path-container.tsx` — `?d=`, dificultad por defecto, navegación, tarjetas bloqueadas, cabecera plegada y botón flotante.
- `components/path/node-popover.tsx` — Doty `cerebro-galaxia` (fallback `orgulloso`) al dominar.
- `components/shell/app-header.tsx` — HUD sin marcos.
- `app/(app)/(hub)/levels/page.tsx` — `<Suspense>`.
- `package.json` — `test:scripts` incluye los `.test.mjs` nuevos.
- `docs/brand/doty-identity.md` — filas nuevas de la tabla de frases; los dos iconos nuevos en la lista de SVG.
- `docs/ARQUITECTURA.md` — sección del Camino v3.

---

### Task 1: Lógica pura de la vista — `lib/path-view.ts` (TDD) y frases nuevas en la tabla de voz

**Files:**
- Create: `lib/path-view.ts`, `lib/path-view.test.mjs`
- Modify: `docs/brand/doty-identity.md` (tabla "Frases aprobadas por momento", filas "Dificultad: …")
- Modify: `package.json` (script `test:scripts`)

**Interfaces:**
- Consumes: tipos `PathDifficulty`, `PathSection` de `types/path.types.ts` (solo `import type`).
- Produces (lo consumen Tasks 4–7): `countLessons(sections): { done; total; pct }`, `isDifficultyUnlocked(d): boolean`, `difficultyOfCurrentNode(ds): PathDifficulty | undefined`, `pickDefaultDifficultyId(ds): number | null`, `type DifficultyNav = { index; total; prevId: number | null; nextId: number | null; nextLocked: boolean }`, `difficultyNav(ds, id): DifficultyNav`, `firstUpcomingSectionIndex(sections): number`, `encouragement(pct): string`, `PREVIEW_LINE: string`, `SECTION_POSES`, `sectionPose(sectionId)`, `NARRATOR_FALLBACK`, `narratorFallback(index)`, `prettyDifficultyName(name): string`, `clampPct(n): number`.

- [ ] **Step 1: Añadir las frases a la tabla de voz**

En `docs/brand/doty-identity.md`, tabla "### Frases aprobadas por momento", sustituye la fila `| Dificultad: < 40 % | narrador | "Vas con todo. Ni una lección te frena." |` por `| Dificultad: < 50 % | narrador | "Vas con todo. Ni una lección te frena." |` (a 45 % "más de la mitad" sería falso), y añade después de la fila `Dificultad: < 80 %` estas dos filas:

```markdown
| Dificultad: < 100 % | narrador | "Ya casi. Cierra con estilo." |
| Dificultad bloqueada (vista previa) | narrador | "Termina la anterior y este camino se abre." |
```

- [ ] **Step 2: Escribir los tests que fallan — `lib/path-view.test.mjs`**

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  SECTION_POSES,
  clampPct,
  countLessons,
  difficultyNav,
  encouragement,
  firstUpcomingSectionIndex,
  isDifficultyUnlocked,
  narratorFallback,
  pickDefaultDifficultyId,
  prettyDifficultyName,
  sectionPose,
} from "./path-view.ts";

const node = (over = {}) => ({
  id: 1, type: "vocab", position: 0, title: "x", sectionId: 1,
  progress: 0, completed: false, unlocked: true, current: false, ...over,
});
const section = (over = {}) => ({
  id: 1, name: "s", progress: 0, skipped: false, unlocked: true, current: false,
  checkpointAvailable: false, nodes: [], ...over,
});
const difficulty = (over = {}) => ({
  id: 1, name: "beginner", img: null, progress: 0, skipped: false, current: false, sections: [], ...over,
});

test("clampPct acota y redondea", () => {
  assert.equal(clampPct(-5), 0);
  assert.equal(clampPct(33.4), 33);
  assert.equal(clampPct(140), 100);
});

test("countLessons excluye checkpoints y redondea el porcentaje", () => {
  const s = section({ nodes: [node({ completed: true }), node({ id: 2 }), node({ id: 3, type: "checkpoint" }), node({ id: 4 })] });
  assert.deepEqual(countLessons([s]), { done: 1, total: 3, pct: 33 });
  assert.deepEqual(countLessons([]), { done: 0, total: 0, pct: 0 });
});

test("isDifficultyUnlocked: superada o con alguna sección abierta", () => {
  assert.equal(isDifficultyUnlocked(difficulty({ sections: [section({ unlocked: false })] })), false);
  assert.equal(isDifficultyUnlocked(difficulty({ sections: [section({ unlocked: false, skipped: true })] })), true);
  assert.equal(isDifficultyUnlocked(difficulty({ skipped: true })), true);
});

test("pickDefaultDifficultyId: flag current, luego nodo current, luego primera abierta", () => {
  const a = difficulty({ id: 1, sections: [section({ unlocked: true })] });
  const b = difficulty({ id: 2, sections: [section({ id: 2, nodes: [node({ current: true })] })] });
  const c = difficulty({ id: 3, current: true });
  assert.equal(pickDefaultDifficultyId([a, b, c]), 3);
  assert.equal(pickDefaultDifficultyId([a, b]), 2);
  assert.equal(pickDefaultDifficultyId([difficulty({ id: 9, sections: [section({ unlocked: false })] }), a]), 1);
  assert.equal(pickDefaultDifficultyId([]), null);
});

test("difficultyNav: vecinas y bloqueo de la siguiente", () => {
  const ds = [
    difficulty({ id: 1, sections: [section()] }),
    difficulty({ id: 2, sections: [section({ unlocked: true })] }),
    difficulty({ id: 3, sections: [section({ unlocked: false })] }),
  ];
  assert.deepEqual(difficultyNav(ds, 1), { index: 0, total: 3, prevId: null, nextId: 2, nextLocked: false });
  assert.deepEqual(difficultyNav(ds, 2), { index: 1, total: 3, prevId: 1, nextId: 3, nextLocked: true });
  assert.deepEqual(difficultyNav(ds, 3), { index: 2, total: 3, prevId: 2, nextId: null, nextLocked: false });
  assert.deepEqual(difficultyNav(ds, 99).index, 0);
});

test("firstUpcomingSectionIndex: primera sección ni abierta ni superada", () => {
  assert.equal(firstUpcomingSectionIndex([section(), section({ id: 2, unlocked: false }), section({ id: 3, unlocked: false })]), 1);
  assert.equal(firstUpcomingSectionIndex([section(), section({ id: 2, unlocked: false, skipped: true })]), -1);
});

test("encouragement sigue la tabla de doty-identity", () => {
  assert.equal(encouragement(0), "Todo el mundo empezó aquí. Hasta yo.");
  assert.equal(encouragement(25), "Vas con todo. Ni una lección te frena.");
  assert.equal(encouragement(50), "Más de la mitad. Ya no hay vuelta atrás.");
  assert.equal(encouragement(85), "Ya casi. Cierra con estilo.");
  assert.equal(encouragement(100), "Nivel dominado. +1000 de aura.");
});

test("sectionPose es determinista y sale del pool", () => {
  assert.equal(sectionPose(7), sectionPose(7));
  assert.equal(sectionPose(-3), sectionPose(3));
  assert.ok(SECTION_POSES.includes(sectionPose(1234)));
});

test("narratorFallback por posición, acotado", () => {
  assert.equal(narratorFallback(0), "bienvenido");
  assert.equal(narratorFallback(1), "sigue-asi");
  assert.equal(narratorFallback(2), "orgulloso");
  assert.equal(narratorFallback(9), "orgulloso");
  assert.equal(narratorFallback(-1), "bienvenido");
});

test("prettyDifficultyName capitaliza cada palabra", () => {
  assert.equal(prettyDifficultyName("upper intermediate"), "Upper Intermediate");
  assert.equal(prettyDifficultyName(""), "");
});
```

- [ ] **Step 3: Correr y ver que falla**

Run: `node --test lib/path-view.test.mjs`
Expected: FAIL (`Cannot find module … path-view.ts`).

- [ ] **Step 4: Escribir `lib/path-view.ts`**

```ts
import type { PathDifficulty, PathSection } from "@/types/path.types";

/**
 * Lógica pura de la vista del Camino (spec §3): qué dificultad se muestra, sus
 * vecinas, el conteo de lecciones y las frases del narrador. Sin React ni DOM,
 * solo `import type`, para que `node --test` la ejecute tal cual.
 */

export const clampPct = (n: number): number => Math.max(0, Math.min(100, Math.round(n)));

export type LessonCount = { done: number; total: number; pct: number };

/** Lecciones = nodos que no son checkpoint (mismo criterio que el pie del banner de hoy). */
export function countLessons(sections: readonly PathSection[]): LessonCount {
  const nodes = sections.flatMap((s) => s.nodes.filter((n) => n.type !== "checkpoint"));
  const done = nodes.filter((n) => n.completed).length;
  const total = nodes.length;
  return { done, total, pct: total === 0 ? 0 : clampPct((done / total) * 100) };
}

/** Desbloqueada = superada por test o con alguna sección abierta o superada. */
export function isDifficultyUnlocked(d: PathDifficulty): boolean {
  return d.skipped || d.sections.some((s) => s.unlocked || s.skipped);
}

export function difficultyOfCurrentNode(
  difficulties: readonly PathDifficulty[],
): PathDifficulty | undefined {
  return difficulties.find((d) => d.sections.some((s) => s.nodes.some((n) => n.current)));
}

/** Sin `?d=`: la marcada `current`; si no, la del nodo `current`; si no, la primera abierta; si no, la primera. */
export function pickDefaultDifficultyId(difficulties: readonly PathDifficulty[]): number | null {
  if (difficulties.length === 0) return null;
  const byFlag = difficulties.find((d) => d.current);
  const byNode = difficultyOfCurrentNode(difficulties);
  const firstOpen = difficulties.find(isDifficultyUnlocked);
  return (byFlag ?? byNode ?? firstOpen ?? difficulties[0]).id;
}

export type DifficultyNav = {
  index: number;
  total: number;
  prevId: number | null;
  nextId: number | null;
  /** La siguiente existe pero está bloqueada: la flecha se deshabilita (se llega por la tarjeta punteada). */
  nextLocked: boolean;
};

export function difficultyNav(difficulties: readonly PathDifficulty[], id: number): DifficultyNav {
  const index = Math.max(0, difficulties.findIndex((d) => d.id === id));
  const prev = difficulties[index - 1];
  const next = difficulties[index + 1];
  return {
    index,
    total: difficulties.length,
    prevId: prev ? prev.id : null,
    nextId: next ? next.id : null,
    nextLocked: next ? !isDifficultyUnlocked(next) : false,
  };
}

/** Índice de la primera sección aún no alcanzada (ni abierta ni superada); -1 si todas lo están. */
export function firstUpcomingSectionIndex(sections: readonly PathSection[]): number {
  return sections.findIndex((s) => !s.unlocked && !s.skipped);
}

/** Línea del narrador por umbral: docs/brand/doty-identity.md, "Frases aprobadas por momento". */
export function encouragement(pct: number): string {
  const p = clampPct(pct);
  if (p <= 0) return "Todo el mundo empezó aquí. Hasta yo.";
  if (p < 50) return "Vas con todo. Ni una lección te frena.";
  if (p < 80) return "Más de la mitad. Ya no hay vuelta atrás.";
  if (p < 100) return "Ya casi. Cierra con estilo.";
  return "Nivel dominado. +1000 de aura.";
}

/** Línea del narrador en la vista previa de una dificultad bloqueada (misma tabla). */
export const PREVIEW_LINE = "Termina la anterior y este camino se abre.";

/** Doty del sub-banner de sección: poses existentes que leen bien a 104 px, deterministas por id. */
export const SECTION_POSES = [
  "leyendo", "escribiendo", "pensando", "en-laptop", "idea",
  "escuchando", "hablando", "libro", "lapiz", "mochila",
] as const;

export function sectionPose(sectionId: number): (typeof SECTION_POSES)[number] {
  return SECTION_POSES[Math.abs(sectionId) % SECTION_POSES.length];
}

/** Narrador por posición mientras no llegue el arte de fase 4 (spec §2.3 reemplaza justo a estos tres). */
export const NARRATOR_FALLBACK = ["bienvenido", "sigue-asi", "orgulloso"] as const;

export function narratorFallback(index: number): (typeof NARRATOR_FALLBACK)[number] {
  const i = Math.min(Math.max(index, 0), NARRATOR_FALLBACK.length - 1);
  return NARRATOR_FALLBACK[i];
}

export function prettyDifficultyName(name: string): string {
  return String(name || "")
    .split(" ")
    .map((w) => (w.length ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ");
}
```

- [ ] **Step 5: Correr y ver que pasa; enganchar al `test:scripts`**

Run: `node --test lib/path-view.test.mjs`
Expected: 10 tests en verde, sin warnings.

En `package.json` cambia `"test:scripts": "node --test scripts/themes/render.test.mjs"` por
`"test:scripts": "node --test scripts/themes/render.test.mjs lib/*.test.mjs components/ui/doty/*.test.mjs"` (el patrón de `components/ui/doty` lo llena la Task 2; hasta entonces `node --test` acepta un glob sin coincidencias). Run: `npm run test:scripts` → 18 tests en verde (8 de temas + 10).

- [ ] **Step 6: Commit**

```bash
git add lib/path-view.ts lib/path-view.test.mjs docs/brand/doty-identity.md package.json
git commit -m "feat(camino): lógica pura de la vista (dificultad mostrada, vecinas, conteo, frases) con tests

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 2: Infraestructura pequeña — URL de imagen, fallback de poses, tamaños de Doty, flechas

**Files:**
- Create: `lib/media-url.ts`, `lib/media-url.test.mjs`, `components/ui/doty/pending.ts`, `components/ui/doty/pending.test.mjs`
- Modify: `components/ui/word-img/word-img.tsx:12-22`, `components/ui/doty/doty.tsx` (`DotySize`, `SIZE_PX`, `sizeClass`, export nuevo), `components/ui/icon/paths.tsx` (familia glifo), `docs/brand/doty-identity.md` (lista de SVG)

**Interfaces:**
- Produces: `wordImageUrl(src: string, base: string): string`; `isPlaceholderPose(registry, pose, placeholderKey = "feliz"): boolean`; `resolvePoseOrFallback(registry, pose, fallback)`; en `doty.tsx`: `poseOrFallback(pose: DotyPose, fallback: DotyPose): DotyPose` y los tamaños `"chip"` (44 px), `"section"` (104 px), `"banner"` (158 px); iconos `izquierda` y `derecha` en `IconName`.

- [ ] **Step 1: Tests que fallan**

`lib/media-url.test.mjs`:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { wordImageUrl } from "./media-url.ts";

test("absolutas y rutas del frontend se devuelven tal cual", () => {
  assert.equal(wordImageUrl("https://res.cloudinary.com/x/a.png", "https://api"), "https://res.cloudinary.com/x/a.png");
  assert.equal(wordImageUrl("/images/levels/colores.png", "https://api"), "/images/levels/colores.png");
});

test("un nombre suelto es el formato legacy de words", () => {
  assert.equal(wordImageUrl("abc.png", "https://api/images"), "https://api/images/words/abc.png");
});
```

`components/ui/doty/pending.test.mjs`:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { isPlaceholderPose, resolvePoseOrFallback } from "./pending.ts";

const reg = {
  feliz: { src: "/images/Doty/expressions/feliz.png" },
  orgulloso: { src: "/images/Doty/expressions/orgulloso.png" },
  "cerebro-galaxia": { src: "/images/Doty/expressions/feliz.png" },
};

test("una pose en placeholder comparte el src de feliz", () => {
  assert.equal(isPlaceholderPose(reg, "cerebro-galaxia"), true);
  assert.equal(isPlaceholderPose(reg, "orgulloso"), false);
  assert.equal(isPlaceholderPose(reg, "feliz"), false);
  assert.equal(isPlaceholderPose(reg, "no-existe"), false);
});

test("resolvePoseOrFallback devuelve el fallback solo mientras dure el placeholder", () => {
  assert.equal(resolvePoseOrFallback(reg, "cerebro-galaxia", "orgulloso"), "orgulloso");
  assert.equal(resolvePoseOrFallback(reg, "orgulloso", "feliz"), "orgulloso");
  const listo = { ...reg, "cerebro-galaxia": { src: "/images/Doty/expressions/cerebro-galaxia.png" } };
  assert.equal(resolvePoseOrFallback(listo, "cerebro-galaxia", "orgulloso"), "cerebro-galaxia");
});
```

Run: `npm run test:scripts` → los 4 nuevos FAIL por módulo inexistente.

- [ ] **Step 2: `lib/media-url.ts` y `WordImg`**

```ts
/**
 * URL de una imagen de contenido. Absolutas (Cloudinary) y rutas servidas por el
 * frontend (`/images/levels/x.png`) van tal cual; un nombre suelto (`abc.png`) es
 * el formato legacy de la tabla `words` y se resuelve contra `base`.
 */
export function wordImageUrl(src: string, base: string): string {
  if (/^https?:\/\//.test(src) || src.startsWith("/")) return src;
  return `${base}/words/${src}`;
}
```

En `components/ui/word-img/word-img.tsx` añade `import { wordImageUrl } from "@/lib/media-url";` y sustituye el cálculo de `url` (las líneas del comentario "Absolute URLs…" hasta el `: \`${BASE_URL_IMAGES}/words/${src}\`;`) por:

```ts
  // Ver lib/media-url.ts: absolutas y rutas `/…` tal cual; nombre suelto = legacy de `words`.
  const url = wordImageUrl(src, BASE_URL_IMAGES);
```

- [ ] **Step 3: `components/ui/doty/pending.ts` y `doty.tsx`**

```ts
export type PoseEntryLike = { src: string };

/**
 * Una pose está "pendiente" si su PNG todavía es el placeholder del registro
 * (la cara de `feliz`): `--emit-registry` la apunta ahí mientras la pieza no esté
 * `done` en su catálogo. Puro y sin importar el registro para que se pruebe solo.
 */
export function isPlaceholderPose(
  registry: Record<string, PoseEntryLike>,
  pose: string,
  placeholderKey = "feliz",
): boolean {
  const entry = registry[pose];
  if (!entry || pose === placeholderKey) return false;
  return entry.src === registry[placeholderKey]?.src;
}

/** La pose nueva si ya tiene arte; si sigue en placeholder, el fallback del spec §2.3. */
export function resolvePoseOrFallback<T extends string>(
  registry: Record<string, PoseEntryLike>,
  pose: T,
  fallback: T,
): T {
  return isPlaceholderPose(registry, pose) ? fallback : pose;
}
```

En `components/ui/doty/doty.tsx`:
1. `import { resolvePoseOrFallback } from "./pending";` y, junto a los otros exports de arriba:
```ts
/** Cableado con fallback (spec §2.3): usa la pose nueva solo cuando su arte ya no es el placeholder. */
export function poseOrFallback(pose: DotyPose, fallback: DotyPose): DotyPose {
  return resolvePoseOrFallback(POSES, pose, fallback);
}
```
2. `export type DotySize = "micro" | "mini" | "small" | "tiny" | "smaller" | "medium" | "big" | "chip" | "section" | "banner";`
3. En `SIZE_PX` añade `chip: 44, section: 104, banner: 158,` y en `sizeClass` añade `chip: "w-11", section: "w-26", banner: "w-[158px]",` (Tailwind 4: `w-11` = 44 px, `w-26` = 104 px). Comenta: `// chip: cabecera plegada y píldoras; section: sub-banner; banner: narrador del banner de dificultad (spec §3.2).`

- [ ] **Step 4: Flechas en `paths.tsx`**

Dentro de la familia glifo (debajo de la marca `── familia glifo · stroke-width 3.5 ──`), junto a `abajo`, añade:

```tsx
  izquierda: (
    <path d="M42,24 H18 M26,12 L14,24 L26,36" fill="none" stroke="currentColor" strokeWidth={3.5} />
  ),
  derecha: (
    <path d="M6,24 H30 M22,12 L34,24 L22,36" fill="none" stroke="currentColor" strokeWidth={3.5} />
  ),
```

En `docs/brand/doty-identity.md`, sección "### Los 33 SVG": cambia el número del encabezado (y cualquier "33" que cuente los SVG en esa sección o en "## Iconografía") a 35 y añade `izquierda` y `derecha` en el mismo formato que la entrada de `abajo`, con la descripción "flechas de navegación entre dificultades del Camino (familia glifo)".

- [ ] **Step 5: Verificar**

Run: `npm run test:scripts && npx tsc --noEmit && npm run lint`
Expected: 22 tests en verde; `check-icons: 35 iconos OK`; sin errores. Confirma con `grep -rn "wordImageUrl" components lib` que `WordImg` usa el helper.

- [ ] **Step 6: Commit**

```bash
git add lib/media-url.ts lib/media-url.test.mjs components/ui/doty/pending.ts components/ui/doty/pending.test.mjs components/ui/doty/doty.tsx components/ui/word-img/word-img.tsx components/ui/icon/paths.tsx docs/brand/doty-identity.md
git commit -m "feat(ui): fallback de poses por placeholder, tamaños chip/section/banner de Doty, flechas y wordImageUrl

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 3: Nodo "sin contenedor" — `path-node.tsx` (variante D) y geometría de la pista

**Files:**
- Modify: `components/path/path-node.tsx` (reescritura completa)
- Modify: `components/path/path-section.tsx:1-64,121,150-197` (constantes, slots, ancho 640; el encabezado de sección se sustituye en Task 4)

**Interfaces:**
- Consumes: `wordImageUrl` (Task 2), `NODE_META`, `DIFFICULTY_TEXT_ON_HEX`, `NodePopover` (sin cambios), `BASE_URL_IMAGES` de `@/constants`.
- Produces: constantes exportadas `NODE_W = 150`, `ART_BOX = 136`, `ART = 128`, `BAR_W = 100`, `BAR_H = 8`, `LABEL_H = 30`, `NODE_ROW_H = 182`; prop nueva `preview?: boolean` en `PathNode` (todo en gris, sin popover). `path-section` sigue exponiendo el mismo `PathSection` (props sin cambios en esta tarea).

- [ ] **Step 1: Reescribir `components/path/path-node.tsx`**

```tsx
"use client";

import React, { useEffect, useRef } from "react";
import Image from "next/image";
import NodePopover from "./node-popover";
import { Icon } from "@/components/ui/icon";
import { UiIcon } from "@/components/ui/ui-icon";
import { NODE_META } from "@/lib/path-node-meta";
import { DIFFICULTY_TEXT_ON_HEX } from "@/lib/difficulty-palette";
import { wordImageUrl } from "@/lib/media-url";
import { BASE_URL_IMAGES } from "@/constants";
import type { PathNode as PathNodeType } from "@/types/path.types";

/* ── Geometría compartida con path-section (slots y conectores) ──────────
 * El arte flota sin disco ni anillo (spec §3.1): 128 px dentro de una caja de
 * 136 (8 px de aire para el resplandor), barra de 100×8 y etiqueta de 13 px.
 * Todas las filas miden lo mismo, checkpoints incluidos: la pista no tiene que
 * distinguir tamaños. */
export const NODE_W = 150;
export const ART_BOX = 136;
export const ART = 128;
export const BAR_W = 100;
export const BAR_H = 8;
export const LABEL_H = 30;
export const NODE_ROW_H = ART_BOX + 4 + BAR_H + 4 + LABEL_H; // 182
const TROPHY = 118;

interface PathNodeProps {
  node: PathNodeType;
  accentHex: string;
  checkpointAvailable: boolean;
  animationIndex: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  popoverAlign: "left" | "center" | "right";
  /** Vista previa de una dificultad bloqueada: todo en gris, sin popover ni marcas de progreso. */
  preview?: boolean;
}

/** Módulos con dominio por ítem: la corona exige mastery 100, no solo completar. */
const MASTERY_TYPES = new Set(["letters", "numbers", "vocab", "pronunciation", "grammar"]);

const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

export default function PathNode({
  node,
  accentHex,
  checkpointAvailable,
  animationIndex,
  open,
  onOpenChange,
  popoverAlign,
  preview = false,
}: PathNodeProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);

  const isCheckpoint = node.type === "checkpoint";
  const isLocked = preview || !node.unlocked;
  const progress = clamp(node.progress);
  const isDone = !preview && node.completed;
  // Dos niveles (F3e): completado = respondiste todo 1× (check); corona = pack dominado.
  const isMastered =
    !preview && (MASTERY_TYPES.has(node.type) ? (node.mastery ?? 0) >= 100 : isDone);
  const isCurrent = !preview && node.current && !isLocked && !isDone;
  const isTestable =
    !preview && isCheckpoint && node.unlocked && !node.completed && checkpointAvailable;
  const meta = NODE_META[node.type];

  // Cerrar el popover al tocar fuera (pointerdown: sirve para ratón y dedo).
  useEffect(() => {
    if (!open) return;
    const h = (e: PointerEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) onOpenChange(false);
    };
    document.addEventListener("pointerdown", h);
    return () => document.removeEventListener("pointerdown", h);
  }, [open, onOpenChange]);

  const labelColor = isLocked
    ? "var(--muted)"
    : isDone
      ? "var(--success)"
      : isCheckpoint
        ? "var(--gold-edge)"
        : `color-mix(in srgb, ${accentHex} 55%, var(--foreground))`;

  // Sombra de piso por defecto; resplandor del color de la sección en el actual;
  // dorado en el checkpoint listo. Bloqueado: gris y apagado, sin sombra.
  const artFilter = isLocked
    ? "grayscale(1)"
    : isTestable
      ? "drop-shadow(0 0 16px color-mix(in srgb, var(--gold) 60%, transparent))"
      : isCurrent
        ? `drop-shadow(0 0 14px ${accentHex}aa)`
        : "drop-shadow(0 6px 4px rgba(30, 27, 92, 0.18))";
  const artOpacity = isLocked ? 0.3 : isDone ? 0.88 : 1;
  const delay = Math.min(animationIndex, 8) * 80;
  const src = node.src ? wordImageUrl(node.src, BASE_URL_IMAGES) : null;
  const showBar = !isLocked && !isCheckpoint;

  return (
    <div
      ref={wrapperRef}
      className="relative flex flex-col items-center"
      style={{
        width: NODE_W,
        animation: `dots-pop-in 500ms cubic-bezier(.34,1.56,.64,1) ${delay}ms both`,
      }}
    >
      {/* ── Arte (el tile es el botón) ─────────────────────── */}
      <button
        type="button"
        aria-label={`${meta.label}: ${node.title}`}
        aria-expanded={open}
        disabled={isLocked}
        onClick={() => onOpenChange(!open)}
        className="relative flex items-center justify-center bg-transparent p-0 transition-transform duration-150 hover:enabled:scale-[1.06] active:enabled:scale-95 disabled:cursor-default"
        style={{
          width: ART_BOX,
          height: ART_BOX,
          animation: isCurrent
            ? `dots-float 2.5s ease-in-out ${(animationIndex % 3) * 0.4}s infinite`
            : "none",
        }}
      >
        {/* Pulso: acento en el actual, oro suave en el checkpoint listo */}
        {(isCurrent || isTestable) && (
          <div
            aria-hidden
            className="absolute inset-2 rounded-full"
            style={
              {
                "--pulse-color": isTestable
                  ? "color-mix(in srgb, var(--gold) 35%, transparent)"
                  : `${accentHex}44`,
                animation: `dots-pulse-ring ${isTestable ? "2.6s" : "2s"} ease-out infinite`,
              } as React.CSSProperties
            }
          />
        )}

        <div
          style={{
            opacity: artOpacity,
            filter: artFilter,
            transition: "opacity 200ms, filter 200ms",
            animation: isCurrent
              ? `dots-wiggle 3s ease-in-out ${animationIndex * 0.2}s infinite`
              : "none",
          }}
        >
          {isCheckpoint ? (
            <UiIcon name="trofeo" size={TROPHY} />
          ) : src ? (
            <Image
              src={src}
              alt=""
              width={ART}
              height={ART}
              sizes={`${ART}px`}
              className="object-contain"
              style={{ width: ART, height: ART }}
              draggable={false}
            />
          ) : (
            <Icon name={meta.icon} size={72} />
          )}
        </div>

        {isLocked && (
          <div
            className="absolute inset-0 flex items-center justify-center text-(--muted)"
            role="img"
            aria-label="Bloqueado"
          >
            <Icon name="candado" size={36} />
          </div>
        )}

        {/* Badge de tipo (abajo-izquierda), en mono sobre el acento: ver DIFFICULTY_TEXT_ON_HEX */}
        {!isCheckpoint && (
          <div
            className="absolute flex items-center justify-center"
            style={{
              bottom: 6,
              left: 6,
              width: 28,
              height: 28,
              borderRadius: "50%",
              background: isLocked ? "var(--border)" : accentHex,
              border: "2px solid var(--surface)",
              boxShadow: isLocked ? "none" : `0 2px 6px ${accentHex}55`,
              filter: isLocked ? "grayscale(1)" : "none",
              color: DIFFICULTY_TEXT_ON_HEX[accentHex] ?? "#ffffff",
              zIndex: 10,
            }}
            title={meta.label}
          >
            <Icon name={meta.icon} size={16} mono />
          </div>
        )}

        {/* Estrella del actual (arriba-derecha) */}
        {isCurrent && (
          <div
            className="absolute flex items-center justify-center"
            style={{
              top: 4,
              right: 8,
              width: 30,
              height: 30,
              borderRadius: "50%",
              background: "linear-gradient(135deg, var(--gold), var(--gold-edge))",
              border: "2px solid var(--surface)",
              boxShadow: "0 2px 8px color-mix(in srgb, var(--gold) 50%, transparent)",
              zIndex: 10,
            }}
          >
            <span style={{ display: "inline-flex", animation: "dots-star-spin 3s linear infinite" }}>
              <UiIcon name="xp" size={15} />
            </span>
          </div>
        )}

        {/* Corona de maestría (arriba-centro) */}
        {isMastered && !isLocked && (
          <div
            className="absolute flex items-center justify-center"
            style={{ top: -2, left: "50%", transform: "translateX(-50%)", width: 32, height: 32, zIndex: 10 }}
          >
            <span style={{ display: "inline-flex", filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.3))" }}>
              <UiIcon name="corona" size={24} />
            </span>
          </div>
        )}

        {/* Check de completado (abajo-derecha) */}
        {isDone && !isLocked && (
          <div
            className="absolute flex items-center justify-center text-white"
            style={{
              bottom: 6,
              right: 8,
              width: 26,
              height: 26,
              borderRadius: "50%",
              background: "var(--success)",
              border: "2px solid var(--surface)",
              boxShadow: "0 2px 6px color-mix(in srgb, var(--success) 40%, transparent)",
              zIndex: 10,
            }}
          >
            <Icon name="check" size={16} mono />
          </div>
        )}
      </button>

      {/* ── Barra de progreso (oculta en bloqueados y checkpoints; el hueco se conserva) ── */}
      {showBar ? (
        <div
          className="mt-1 overflow-hidden rounded-full"
          role="progressbar"
          aria-label="Progreso de la lección"
          aria-valuenow={isDone ? 100 : progress}
          aria-valuemin={0}
          aria-valuemax={100}
          style={{
            width: BAR_W,
            height: BAR_H,
            background: `color-mix(in srgb, ${accentHex} 18%, transparent)`,
          }}
        >
          <div
            className="h-full rounded-full transition-[width] duration-700 ease-out"
            style={{
              width: `${isDone ? 100 : progress}%`,
              background: isDone ? "var(--success)" : accentHex,
            }}
          />
        </div>
      ) : (
        <div aria-hidden className="mt-1" style={{ height: BAR_H }} />
      )}

      {/* ── Etiqueta ───────────────────────────────────────── */}
      <span
        className="mt-1 w-full truncate text-center font-extrabold leading-tight"
        style={{ color: labelColor, fontSize: 13, letterSpacing: "-0.01em", height: LABEL_H - 4 }}
      >
        {node.title}
      </span>

      {/* ── Popover ────────────────────────────────────────── */}
      {open && !isLocked && (
        <NodePopover
          node={node}
          accentHex={accentHex}
          align={popoverAlign}
          onClose={() => onOpenChange(false)}
        />
      )}
    </div>
  );
}
```

Notas para el implementador: desaparecen el anillo SVG, el disco, el borde, el overlay negro del candado, la píldora de porcentaje y el `<svg>` inline del check (ahora `<Icon name="check" mono>`); los handlers `onMouseEnter/Leave/Down/Up` que mutaban `style.transform` se reemplazan por las clases `hover:enabled:scale-[1.06] active:enabled:scale-95` (hover no es la única señal: el tap abre el popover). El `UiIcon` de economía acepta cualquier `size` en px.

- [ ] **Step 2: Geometría en `components/path/path-section.tsx`**

Sustituye el import de la línea 4 por `import PathNode, { NODE_W, ART_BOX, NODE_ROW_H } from "./path-node";`, borra las constantes locales `LABEL_H`, `NODE_W` (líneas 28-30; conserva `ROW_GAP = 18`) y sustituye el cálculo de `slots`/`placed` (líneas 42-60) por:

```ts
  // Todas las filas miden lo mismo (checkpoint incluido): NODE_ROW_H.
  const slots = nodes.map((n, i) => ({
    node: n,
    key: `${n.type}-${n.id}`,
    xPct: n.type === "checkpoint" ? 50 : zigzagX(i),
    h: NODE_ROW_H,
  }));
  const offsets = slots.map((_, i) =>
    slots.slice(0, i).reduce((sum, s) => sum + s.h + ROW_GAP, 0),
  );
  const placed = slots.map((s, i) => ({
    ...s,
    y: offsets[i],
    centerY: offsets[i] + ART_BOX / 2,
  }));
```

En el contenedor de la pista (línea 121) cambia `maxWidth: 520` por `maxWidth: 640`. En `PathPeer` (línea 194) el `offset` pasa a `0` (ningún nodo sobresale ya del wrapper de 150). Quita el uso de `p.svg` que quede.

- [ ] **Step 3: Verificar**

Run: `npx tsc --noEmit && npm run lint`
Expected: limpio. `grep -n "WordImg\|NODE_SVG_SIZE\|CHECKPOINT_SVG_SIZE" components/path/*.tsx` no devuelve nada.

- [ ] **Step 4: Commit**

```bash
git add components/path/path-node.tsx components/path/path-section.tsx
git commit -m "feat(camino): nodo sin contenedor — arte de 128 px flotante, barra de progreso y filas uniformes de 182 px

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 4: Barra segmentada, sub-banner de sección y modo vista previa

**Files:**
- Create: `components/path/segmented-bar.tsx`, `components/path/section-banner.tsx`
- Modify: `components/path/path-section.tsx` (props `index`, `total`, `preview`; encabezado → `SectionBanner`; marcador y vecinos ocultos en preview)

**Interfaces:**
- Consumes: `countLessons`, `sectionPose`, `clampPct` (Task 1); tamaño `"section"` de Doty (Task 2); `PathNode.preview` (Task 3).
- Produces: `SegmentedBar({ sections, accentHex, height?, gap?, className? })`; `SectionBanner({ section, index, total, accentHex, muted? })`; `PathSection` gana `index: number`, `total: number`, `preview?: boolean` (la Task 5 los pasa).

- [ ] **Step 1: `components/path/segmented-bar.tsx`**

```tsx
import { clampPct } from "@/lib/path-view";
import type { PathSection } from "@/types/path.types";

interface Props {
  sections: readonly PathSection[];
  accentHex: string;
  height?: number;
  gap?: number;
  className?: string;
}

/** Un segmento por sección: relleno = `section.progress`; las completadas o superadas, en --success. */
export default function SegmentedBar({ sections, accentHex, height = 8, gap = 4, className = "" }: Props) {
  const avg =
    sections.length === 0
      ? 0
      : Math.round(sections.reduce((a, s) => a + (s.skipped ? 100 : clampPct(s.progress)), 0) / sections.length);
  return (
    <div
      className={`flex w-full ${className}`}
      style={{ gap }}
      role="progressbar"
      aria-label="Progreso por sección"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={avg}
    >
      {sections.map((s) => {
        const pct = s.skipped ? 100 : clampPct(s.progress);
        return (
          <div
            key={s.id}
            className="flex-1 overflow-hidden rounded-full"
            style={{ height, background: `color-mix(in srgb, ${accentHex} 18%, transparent)` }}
          >
            <div
              className="h-full rounded-full transition-[width] duration-700 ease-out"
              style={{ width: `${pct}%`, background: pct >= 100 ? "var(--success)" : accentHex }}
            />
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: `components/path/section-banner.tsx`**

```tsx
"use client";

import Doty from "@/components/ui/doty/doty";
import { clampPct, countLessons, sectionPose } from "@/lib/path-view";
import type { PathSection } from "@/types/path.types";

interface Props {
  section: PathSection;
  index: number;
  total: number;
  accentHex: string;
  /** Sección aún no alcanzada o vista previa: gris y sin animación. */
  muted?: boolean;
}

/** Sub-banner de sección (spec §3.2, solución 2): panel teñido del color de la sección, radio 22, Doty de 104 px. */
export default function SectionBanner({ section, index, total, accentHex, muted = false }: Props) {
  const { done, total: lessons } = countLessons([section]);
  const pct = section.skipped ? 100 : clampPct(section.progress);
  return (
    <header
      className="relative w-full"
      style={{
        background: `color-mix(in srgb, ${accentHex} 14%, var(--surface))`,
        borderRadius: 22,
        padding: "14px 120px 14px 16px",
        opacity: muted ? 0.6 : 1,
        filter: muted ? "grayscale(1)" : "none",
      }}
    >
      <p
        className="text-[11px] font-black uppercase tracking-widest"
        style={{ color: `color-mix(in srgb, ${accentHex} 60%, var(--foreground))` }}
      >
        Sección {index + 1} de {total}
        {section.skipped ? " · Superada" : ""}
      </p>
      <h3 className="truncate font-display text-lg font-extrabold leading-tight text-foreground">
        {section.name}
      </h3>
      <div className="mt-2 flex items-center gap-2">
        <div
          className="h-2 flex-1 overflow-hidden rounded-full"
          role="progressbar"
          aria-label={`Progreso de ${section.name}`}
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
          style={{ background: `color-mix(in srgb, ${accentHex} 18%, transparent)` }}
        >
          <div
            className="h-full rounded-full transition-[width] duration-700 ease-out"
            style={{ width: `${pct}%`, background: pct >= 100 ? "var(--success)" : accentHex }}
          />
        </div>
        <span className="shrink-0 text-xs font-extrabold tabular-nums text-(--muted)">
          {done} de {lessons} lecciones
        </span>
      </div>
      <div aria-hidden className="pointer-events-none absolute select-none" style={{ top: -22, right: -2 }}>
        <Doty pose={sectionPose(section.id)} size="section" animation={muted ? "none" : "bob"} />
      </div>
    </header>
  );
}
```

- [ ] **Step 3: `path-section.tsx`: encabezado, props y preview**

1. Props: `interface PathSectionProps { section: PathSectionType; index: number; total: number; accentHex: string; peersByNodeId: Record<number, PathPeerType[]>; preview?: boolean; }` y destructura `index, total, preview = false`.
2. Import `SectionBanner from "./section-banner"` y sustituye TODO el bloque `{/* ── Section header ── */} <div className="w-full flex flex-col items-center gap-1.5">…</div>` (el `<span>` con el punto de color, el nombre, la pastilla "Superada" y la barra de 1 px con el `%`) por:
```tsx
      <SectionBanner
        section={section}
        index={index}
        total={total}
        accentHex={accentHex}
        muted={preview || (!section.unlocked && !section.skipped)}
      />
```
   Las variables `name`, `progress`, `skipped` y `pct` quedan sin uso: bórralas del destructuring y del componente.
3. Pasa `preview={preview}` a `<PathNode>`; el `data-path-current` solo cuando `!preview && p.node.current`; el `DotyMarker` y los `PathPeer` no se renderizan en preview (`!preview && …`).

- [ ] **Step 4: Verificar**

Run: `npx tsc --noEmit`
Expected: falla SOLO en `components/path/path-difficulty.tsx` porque `PathSection` exige `index` y `total` (lo corrige la Task 5 al reescribirlo). Si prefieres un árbol verde, pasa temporalmente `index={i}` y `total={sections.length}` en `path-difficulty.tsx:194-199`. Luego `npm run lint` limpio.

- [ ] **Step 5: Commit**

```bash
git add components/path/segmented-bar.tsx components/path/section-banner.tsx components/path/path-section.tsx components/path/path-difficulty.tsx
git commit -m "feat(camino): barra segmentada, sub-banner de sección con Doty y modo vista previa

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 5: Banner de dificultad, niebla de secciones futuras y vista de UNA dificultad

**Files:**
- Create: `components/path/difficulty-banner.tsx`, `components/path/upcoming-divider.tsx`, `components/path/difficulty-nav.tsx`
- Modify: `components/path/path-difficulty.tsx` (reescritura completa)

**Interfaces:**
- Consumes: `countLessons`, `encouragement`, `PREVIEW_LINE`, `narratorFallback`, `prettyDifficultyName`, `firstUpcomingSectionIndex`, `type DifficultyNav` (Task 1); `SegmentedBar`, `PathSection` con `index/total/preview` (Task 4); tamaño `"banner"` e iconos `izquierda`/`derecha` (Task 2).
- Produces: `DifficultyBanner({ difficulty, index, total, accentHex, nav, onGo, preview?, children? })`; `DifficultyArrow({ direction: "prev" | "next", nav, onGo, accentHex, size? })`; `UpcomingDivider({ sectionNumber })`; `PathDifficulty({ difficulty, nav, accentHex, peersByNodeId, preview, onGo, bannerRef, header?, aside? })` — `header` es la cabecera plegada (Task 7) que va ANTES del banner en móvil; `aside` es el botón "Volver a mi nivel" que va dentro del banner en escritorio.

- [ ] **Step 1: `components/path/difficulty-nav.tsx`**

```tsx
"use client";

import { Icon } from "@/components/ui/icon";
import type { DifficultyNav } from "@/lib/path-view";

interface ArrowProps {
  direction: "prev" | "next";
  nav: DifficultyNav;
  onGo: (id: number) => void;
  accentHex: string;
  size?: number;
}

/**
 * Una flecha de navegación entre dificultades. La anterior se atenúa en la
 * primera; la siguiente se deshabilita si la próxima está bloqueada (a esa se
 * llega por su tarjeta punteada, en modo vista previa).
 */
export function DifficultyArrow({ direction, nav, onGo, accentHex, size = 36 }: ArrowProps) {
  const id = direction === "prev" ? nav.prevId : nav.nextId;
  const disabled = id === null || (direction === "next" && nav.nextLocked);
  return (
    <button
      type="button"
      aria-label={direction === "prev" ? "Dificultad anterior" : "Dificultad siguiente"}
      disabled={disabled}
      onClick={() => id !== null && onGo(id)}
      className="grid shrink-0 place-items-center rounded-full text-foreground transition-transform active:enabled:scale-95 disabled:opacity-40"
      style={{
        width: size,
        height: size,
        background: `color-mix(in srgb, ${accentHex} 18%, var(--surface))`,
      }}
    >
      <Icon name={direction === "prev" ? "izquierda" : "derecha"} size={Math.round(size * 0.55)} />
    </button>
  );
}

interface PairProps {
  nav: DifficultyNav;
  onGo: (id: number) => void;
  accentHex: string;
}

/** Las dos flechas juntas (banner). */
export default function DifficultyNavArrows({ nav, onGo, accentHex }: PairProps) {
  return (
    <div className="flex items-center gap-2">
      <DifficultyArrow direction="prev" nav={nav} onGo={onGo} accentHex={accentHex} />
      <DifficultyArrow direction="next" nav={nav} onGo={onGo} accentHex={accentHex} />
    </div>
  );
}
```

- [ ] **Step 2: `components/path/difficulty-banner.tsx`**

```tsx
"use client";

import type React from "react";
import Doty, { isDotyPose } from "@/components/ui/doty/doty";
import SegmentedBar from "./segmented-bar";
import DifficultyNavArrows from "./difficulty-nav";
import {
  PREVIEW_LINE,
  countLessons,
  encouragement,
  narratorFallback,
  prettyDifficultyName,
  type DifficultyNav,
} from "@/lib/path-view";
import type { PathDifficulty } from "@/types/path.types";

interface Props {
  difficulty: PathDifficulty;
  index: number;
  total: number;
  accentHex: string;
  nav: DifficultyNav;
  onGo: (id: number) => void;
  preview?: boolean;
  /** En escritorio, el botón "Volver a mi nivel" vive dentro del panel. */
  children?: React.ReactNode;
}

/**
 * Banner de dificultad (spec §3.2, composición A): panel teñido, radio 28, sin
 * borde; Doty narrador de 158 px asomando por la esquina superior derecha;
 * kicker, título, línea de ánimo, barra segmentada y conteo de lecciones (los
 * checkpoints no cuentan). `difficulty.img` trae la pose del narrador cuando el
 * backend ya la asignó; si no, cae al narrador por posición.
 */
export default function DifficultyBanner({
  difficulty,
  index,
  total,
  accentHex,
  nav,
  onGo,
  preview = false,
  children,
}: Props) {
  const { done, total: lessons, pct } = countLessons(difficulty.sections);
  const pose = isDotyPose(difficulty.img) ? difficulty.img : narratorFallback(index);
  const headingId = `path-difficulty-${difficulty.id}`;

  return (
    <section
      aria-labelledby={headingId}
      className="relative w-full"
      style={{
        background: `color-mix(in srgb, ${accentHex} 14%, var(--surface))`,
        borderRadius: 28,
        padding: "18px 150px 18px 20px",
      }}
    >
      <p
        className="text-[11px] font-black uppercase tracking-widest"
        style={{ color: `color-mix(in srgb, ${accentHex} 60%, var(--foreground))` }}
      >
        {preview ? "Vista previa · " : ""}Dificultad {index + 1} de {total}
        {difficulty.skipped ? " · Superada" : ""}
      </p>
      <h2 id={headingId} className="font-display text-2xl font-extrabold leading-tight text-foreground">
        {prettyDifficultyName(difficulty.name)}
      </h2>
      <p className="mt-1 text-[13px] font-bold text-(--muted)">
        {preview ? PREVIEW_LINE : encouragement(pct)}
      </p>
      <SegmentedBar sections={difficulty.sections} accentHex={accentHex} className="mt-3" />
      <div className="mt-2 flex items-center justify-between gap-3">
        <p className="text-xs font-bold tabular-nums text-(--muted)">
          <b className="text-base font-black" style={{ color: accentHex }}>{done}</b> de {lessons} lecciones · {pct} %
        </p>
        <DifficultyNavArrows nav={nav} onGo={onGo} accentHex={accentHex} />
      </div>
      {children && <div className="mt-4">{children}</div>}
      <div
        aria-hidden
        className="pointer-events-none absolute select-none"
        style={{ top: -38, right: -6, filter: preview ? "grayscale(1)" : "none", opacity: preview ? 0.5 : 1 }}
      >
        <Doty pose={pose} size="banner" animation={preview ? "none" : "bob"} />
      </div>
    </section>
  );
}
```

- [ ] **Step 3: `components/path/upcoming-divider.tsx`**

```tsx
interface Props {
  sectionNumber: number;
}

/** Niebla antes de la primera sección no alcanzada (spec §3.2): degradado al fondo y pastilla "Próximamente". */
export default function UpcomingDivider({ sectionNumber }: Props) {
  return (
    <div
      role="separator"
      className="relative flex w-full items-center justify-center"
      style={{ height: 72, background: "linear-gradient(to bottom, transparent, var(--background) 60%)" }}
    >
      <span
        className="rounded-full border px-3 py-1 text-[11px] font-black uppercase tracking-widest"
        style={{ background: "var(--surface)", borderColor: "var(--border)", color: "var(--muted)" }}
      >
        Próximamente · Sección {sectionNumber}
      </span>
    </div>
  );
}
```

- [ ] **Step 4: Reescribir `components/path/path-difficulty.tsx`**

```tsx
"use client";

import React from "react";
import PathSection from "./path-section";
import DifficultyBanner from "./difficulty-banner";
import UpcomingDivider from "./upcoming-divider";
import { DIFFICULTY_COLOR_NAMES, DIFFICULTY_COLOR_HEX } from "@/lib/difficulty-palette";
import { firstUpcomingSectionIndex, type DifficultyNav } from "@/lib/path-view";
import type { PathDifficulty as PathDifficultyType, PathPeer } from "@/types/path.types";

interface PathDifficultyProps {
  difficulty: PathDifficultyType;
  nav: DifficultyNav;
  accentHex: string;
  peersByNodeId: Record<number, PathPeer[]>;
  /** Dificultad bloqueada vista "por curiosidad": todo en gris, sin popovers ni marcador. */
  preview: boolean;
  onGo: (id: number) => void;
  /** El contenedor observa el banner para plegar la cabecera. */
  bannerRef: React.Ref<HTMLDivElement>;
  /** Cabecera plegada (móvil): va antes del banner para poder ser sticky dentro de esta vista. */
  header?: React.ReactNode;
  /** Botón "Volver a mi nivel" en escritorio: dentro del panel sticky. */
  aside?: React.ReactNode;
}

/** La rotación de la paleta por id de dificultad es la del dashboard legacy: no cambia. */
export function difficultyColors(id: number): string[] {
  const base = [...DIFFICULTY_COLOR_NAMES];
  const shift = (id ?? 0) % base.length;
  return [...base.slice(shift), ...base.slice(0, shift)].map(
    (name) => DIFFICULTY_COLOR_HEX[name] ?? DIFFICULTY_COLOR_HEX.pink,
  );
}

/**
 * Vista de UNA dificultad (spec §3.2). Móvil: cabecera plegada + banner +
 * secciones en columna. Escritorio (md+): grid de 300 px + pista, con el banner
 * completo en la columna izquierda en `position: sticky`.
 */
export default function PathDifficulty({
  difficulty,
  nav,
  accentHex,
  peersByNodeId,
  preview,
  onGo,
  bannerRef,
  header,
  aside,
}: PathDifficultyProps) {
  const colors = difficultyColors(difficulty.id);
  const { sections } = difficulty;
  const upcoming = preview ? -1 : firstUpcomingSectionIndex(sections);

  return (
    <div className="w-full md:grid md:grid-cols-[300px_minmax(0,1fr)] md:items-start md:gap-8">
      {header}

      <aside className="md:sticky md:top-[72px]">
        {/* Aire arriba para el narrador que asoma por encima del panel. */}
        <div ref={bannerRef} className="pt-9">
          <DifficultyBanner
            difficulty={difficulty}
            index={nav.index}
            total={nav.total}
            accentHex={accentHex}
            nav={nav}
            onGo={onGo}
            preview={preview}
          >
            {aside}
          </DifficultyBanner>
        </div>
      </aside>

      <div className="mt-6 flex w-full flex-col items-center gap-10 md:mt-0">
        {sections.length === 0 ? (
          <span className="text-(--muted)">No hay secciones disponibles.</span>
        ) : (
          sections.map((section, i) => (
            <React.Fragment key={section.id}>
              {i === upcoming && <UpcomingDivider sectionNumber={i + 1} />}
              <PathSection
                section={section}
                index={i}
                total={sections.length}
                accentHex={colors[i % colors.length]}
                peersByNodeId={peersByNodeId}
                preview={preview}
              />
            </React.Fragment>
          ))
        )}
      </div>
    </div>
  );
}
```

Desaparecen: `motivational` (con sus emoji), la tarjeta punteada de dificultad bloqueada (pasa a `locked-difficulty.tsx` en Task 6) y el banner viejo con borde. El `accentHex` de la dificultad lo calcula el contenedor con `difficultyColors(difficulty.id)[0]` (Task 6).

- [ ] **Step 5: Verificar**

Run: `npx tsc --noEmit`
Expected: falla SOLO en `components/path/path-container.tsx` (props nuevas de `PathDifficulty`), que reescribe la Task 6. `npm run lint` limpio en los archivos nuevos (`npx eslint components/path`).

- [ ] **Step 6: Commit**

```bash
git add components/path/difficulty-banner.tsx components/path/difficulty-nav.tsx components/path/upcoming-divider.tsx components/path/path-difficulty.tsx
git commit -m "feat(camino): banner de dificultad con narrador, flechas, niebla de secciones futuras y vista de una dificultad

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 6: Una dificultad a la vez — `?d=`, dificultad por defecto, tarjetas bloqueadas y `<Suspense>`

**Files:**
- Create: `components/path/locked-difficulty.tsx`
- Modify: `components/path/path-container.tsx` (reescritura del render y del estado de navegación; el fetch, el adaptador, los vecinos y `placementPending` se conservan tal cual)
- Modify: `app/(app)/(hub)/levels/page.tsx`

**Interfaces:**
- Consumes: `pickDefaultDifficultyId`, `difficultyNav`, `isDifficultyUnlocked`, `narratorFallback`, `prettyDifficultyName` (Task 1); `PathDifficulty` y `difficultyColors` (Task 5).
- Produces: `LockedDifficulty({ difficulty, index, previousName, accentHex, onPreview })`; en `PathContainer`, el estado derivado `shownId`, `currentId`, `preview`, `nav` y `goTo(id)`; `bannerRef` creado aquí (lo consume Task 7). La URL `/levels?d=<id>` sobrevive a recargar; sin `?d=` no se escribe nada en la URL.

- [ ] **Step 1: `components/path/locked-difficulty.tsx`**

```tsx
"use client";

import Doty from "@/components/ui/doty/doty";
import { Icon } from "@/components/ui/icon";
import { narratorFallback, prettyDifficultyName } from "@/lib/path-view";
import type { PathDifficulty } from "@/types/path.types";

interface Props {
  difficulty: PathDifficulty;
  index: number;
  previousName: string;
  accentHex: string;
  onPreview: (id: number) => void;
}

/** Dificultad bloqueada al final del Camino (spec §3.2): banner punteado, Doty en gris; tocar abre la vista previa. */
export default function LockedDifficulty({ difficulty, index, previousName, accentHex, onPreview }: Props) {
  return (
    <button
      type="button"
      onClick={() => onPreview(difficulty.id)}
      className="dots-pressable relative flex w-full items-center gap-4 bg-transparent text-left"
      style={{
        borderRadius: 28,
        padding: "16px 20px",
        border: `2px dashed color-mix(in srgb, ${accentHex} 45%, var(--border))`,
      }}
    >
      <div aria-hidden style={{ filter: "grayscale(1)", opacity: 0.5 }}>
        <Doty pose={narratorFallback(index)} size="mini" shadow={false} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1 text-[11px] font-black uppercase tracking-widest text-(--muted)">
          <Icon name="candado" size={14} /> Dificultad {index + 1}
        </p>
        <h3 className="truncate font-display text-lg font-extrabold text-(--muted)">
          {prettyDifficultyName(difficulty.name)}
        </h3>
        <p className="text-xs font-bold text-(--muted)">
          Termina {previousName} para desbloquear · toca para ver qué viene
        </p>
      </div>
      <span className="text-(--muted)">
        <Icon name="derecha" size={20} />
      </span>
    </button>
  );
}
```

- [ ] **Step 2: `components/path/path-container.tsx` — navegación por dificultad**

Conserva sin cambios: `normalizeCurrent`, los tres `useEffect` de fetch (`/path` con fallback a `/levels`), vecinos y `placementPending`, el bloque de error y el `Spinner`. Cambia lo demás así:

Imports nuevos:
```tsx
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import PathDifficulty, { difficultyColors } from "./path-difficulty";
import LockedDifficulty from "./locked-difficulty";
import {
  difficultyNav,
  isDifficultyUnlocked,
  pickDefaultDifficultyId,
  prettyDifficultyName,
} from "@/lib/path-view";
```

Estado derivado (después de los hooks de fetch, antes de los `return` tempranos, porque los hooks no pueden ir detrás de un `return` condicional):
```tsx
  const searchParams = useSearchParams();
  const requested = Number(searchParams.get("d"));
  const difficulties = path?.difficulties ?? [];
  // "Mi nivel": la dificultad current del backend, o la del nodo current, o la primera abierta.
  const currentId = pickDefaultDifficultyId(difficulties);
  const shownId = difficulties.some((d) => d.id === requested) ? requested : currentId;
  const shown = difficulties.find((d) => d.id === shownId) ?? null;
  const preview = shown ? !isDifficultyUnlocked(shown) : false;
  const nav = shownId === null ? null : difficultyNav(difficulties, shownId);
  const bannerRef = useRef<HTMLDivElement>(null);

  const goTo = useCallback(
    (id: number) => {
      // Sin `?d=` para "mi nivel": la URL limpia sigue siendo la del Camino de siempre.
      router.push(id === currentId ? "/levels" : `/levels?d=${id}`);
    },
    [router, currentId],
  );
```

El auto-scroll al nodo actual pasa a depender de la dificultad mostrada (se hace una vez por dificultad; en preview no hay nodo actual):
```tsx
  const scrolledForRef = useRef<number | null>(null);
  useEffect(() => {
    if (!path || shownId === null || shownId !== currentId) return;
    if (scrolledForRef.current === shownId) return;
    scrolledForRef.current = shownId;
    const t = setTimeout(() => {
      document
        .querySelector('[data-path-current="true"]')
        ?.scrollIntoView({ block: "center", behavior: "smooth" });
    }, 300);
    return () => clearTimeout(t);
  }, [path, shownId, currentId]);
```
(Borra el `scrolledRef` y el efecto de auto-scroll antiguos.)

Render final (sustituye el `return` con `path.difficulties.map(…)`):
```tsx
  if (!shown || nav === null) {
    return <span className="text-(--muted)">No hay dificultades disponibles.</span>;
  }

  const accentHex = difficultyColors(shown.id)[0];
  const locked = difficulties.filter((d) => d.id !== shown.id && !isDifficultyUnlocked(d));

  return (
    <div className="flex w-full flex-col gap-8">
      <PathDifficulty
        difficulty={shown}
        nav={nav}
        accentHex={accentHex}
        peersByNodeId={peersByNodeId}
        preview={preview}
        onGo={goTo}
        bannerRef={bannerRef}
      />

      {locked.length > 0 && (
        <div className="mx-auto flex w-full max-w-[640px] flex-col gap-4">
          {locked.map((d) => {
            const i = difficulties.findIndex((x) => x.id === d.id);
            const previous = difficulties[i - 1];
            return (
              <LockedDifficulty
                key={d.id}
                difficulty={d}
                index={i}
                previousName={previous ? prettyDifficultyName(previous.name) : "la dificultad anterior"}
                accentHex={difficultyColors(d.id)[0]}
                onPreview={goTo}
              />
            );
          })}
        </div>
      )}
    </div>
  );
```
El bloque `if (!path) return <Spinner …/>` y el de error se mantienen ANTES de este return (los hooks ya quedaron todos arriba).

- [ ] **Step 3: `<Suspense>` en la página**

```tsx
import React, { Suspense } from "react";

import PathContainer from "@/components/path/path-container";
import Spinner from "@/components/ui/Spinner/Spinner";

/**
 * Camino (home). El chrome (nav + HUD) lo aporta el layout del grupo hub; aquí
 * vive una dificultad a la vez (`?d=<id>`, por defecto la actual). El Suspense
 * es obligatorio por `useSearchParams` (regla 6).
 */
export default function Levels() {
  return (
    <Suspense fallback={<Spinner title="Cargando tu camino..." />}>
      <PathContainer />
    </Suspense>
  );
}
```

- [ ] **Step 4: Verificar**

Run: `npx tsc --noEmit && npm run lint`
Expected: limpio. `grep -n "window.location" components/path` no devuelve nada.

- [ ] **Step 5: Commit**

```bash
git add components/path/locked-difficulty.tsx components/path/path-container.tsx "app/(app)/(hub)/levels/page.tsx"
git commit -m "feat(camino): una dificultad a la vez con ?d=, vista previa de las bloqueadas y Suspense en la página

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 7: Cabecera plegada y botón "Volver a mi nivel" (`IntersectionObserver`)

**Files:**
- Create: `hooks/use-in-view.ts`, `components/path/folded-header.tsx`, `components/path/back-to-current.tsx`
- Modify: `components/path/path-container.tsx` (cablea `header`, `aside` y el botón flotante)

**Interfaces:**
- Consumes: `bannerRef`, `shownId`, `currentId`, `preview`, `nav`, `goTo` (Task 6); `DifficultyArrow` (Task 5); `SegmentedBar` (Task 4); `countLessons`, `narratorFallback`, `prettyDifficultyName` (Task 1); tamaños `"chip"`/`"mini"` de Doty.
- Produces: `useInView(getTarget: () => Element | null, key: unknown, options?: IntersectionObserverInit, initial = true): boolean`; `FoldedHeader({ difficulty, nav, accentHex, visible, onGo })`; `BackToCurrent({ visible, onClick, variant: "floating" | "inline" })`.

- [ ] **Step 1: `hooks/use-in-view.ts`**

```ts
"use client";

import { useEffect, useState } from "react";

/**
 * true mientras el elemento intersecta el viewport. `getTarget` se evalúa al
 * montar y cada vez que cambia `key` (p. ej. la dificultad mostrada: el nodo
 * actual es otro elemento). Sin `IntersectionObserver` (SSR, navegador viejo)
 * devuelve `initial` para siempre. El `setState` va dentro del callback del
 * observer, no en el cuerpo del efecto (regla 3).
 */
export function useInView(
  getTarget: () => Element | null,
  key: unknown,
  options: IntersectionObserverInit = {},
  initial = true,
): boolean {
  const [inView, setInView] = useState(initial);
  const { rootMargin = "0px", threshold = 0 } = options;

  useEffect(() => {
    const el = getTarget();
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      ([entry]) => setInView(entry.isIntersecting),
      { rootMargin, threshold },
    );
    io.observe(el);
    return () => io.disconnect();
    // `key` fuerza a reobservar cuando el elemento objetivo cambia de identidad.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, rootMargin, threshold]);

  return inView;
}
```

Si el lint del compiler de React rechaza el `eslint-disable`, pasa `getTarget` envuelto en `useCallback` desde el llamador y añádelo al array de dependencias en vez de deshabilitar la regla; documenta cuál de las dos formas quedó.

- [ ] **Step 2: `components/path/folded-header.tsx`**

```tsx
"use client";

import Doty, { isDotyPose } from "@/components/ui/doty/doty";
import SegmentedBar from "./segmented-bar";
import { DifficultyArrow } from "./difficulty-nav";
import { countLessons, narratorFallback, prettyDifficultyName, type DifficultyNav } from "@/lib/path-view";
import type { PathDifficulty } from "@/types/path.types";

interface Props {
  difficulty: PathDifficulty;
  nav: DifficultyNav;
  accentHex: string;
  /** El banner salió del viewport. */
  visible: boolean;
  onGo: (id: number) => void;
}

/**
 * Cabecera plegada (spec §3.2, solución 1): barra pegajosa bajo el HUD con el
 * mismo tinte del banner. Es un contenedor sticky de altura 0 (no deja hueco
 * mientras el banner está a la vista) y la barra real va absoluta dentro; se
 * muestra con opacity/transform. Solo móvil: en escritorio el banner es sticky.
 */
export default function FoldedHeader({ difficulty, nav, accentHex, visible, onGo }: Props) {
  const { done, total } = countLessons(difficulty.sections);
  const pose = isDotyPose(difficulty.img) ? difficulty.img : narratorFallback(nav.index);
  return (
    <div className="sticky z-20 h-0 md:hidden" style={{ top: 56 }} aria-hidden={!visible}>
      <div
        className="absolute inset-x-0 top-0 flex items-center gap-2 rounded-2xl px-2.5 py-1.5 transition-[opacity,transform] duration-200"
        style={{
          background: `color-mix(in srgb, ${accentHex} 14%, var(--surface))`,
          boxShadow: "var(--shadow-card)",
          opacity: visible ? 1 : 0,
          transform: visible ? "translateY(0)" : "translateY(-8px)",
          pointerEvents: visible ? "auto" : "none",
        }}
      >
        <DifficultyArrow direction="prev" nav={nav} onGo={onGo} accentHex={accentHex} size={32} />
        <Doty pose={pose} size="chip" shadow={false} />
        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-[13px] font-extrabold leading-tight text-foreground">
            {prettyDifficultyName(difficulty.name)}
          </p>
          <p className="text-[11px] font-bold tabular-nums leading-tight text-(--muted)">
            {done} de {total} lecciones
          </p>
        </div>
        <div style={{ width: 88 }}>
          <SegmentedBar sections={difficulty.sections} accentHex={accentHex} height={6} gap={3} />
        </div>
        <DifficultyArrow direction="next" nav={nav} onGo={onGo} accentHex={accentHex} size={32} />
      </div>
    </div>
  );
}
```

- [ ] **Step 3: `components/path/back-to-current.tsx`**

```tsx
"use client";

import Doty from "@/components/ui/doty/doty";

interface Props {
  visible: boolean;
  onClick: () => void;
  /** `floating`: píldora fija abajo a la derecha (móvil). `inline`: botón dentro del panel (escritorio). */
  variant: "floating" | "inline";
}

const PILL =
  "dots-pressable relative inline-flex items-center rounded-full bg-(--accent) text-[13px] font-black text-(--accent-contrast) [--press-color:var(--accent-edge)]";

/** "Volver a mi nivel" (spec §3.2): visible cuando el nodo actual no está en pantalla o se mira otra dificultad. */
export default function BackToCurrent({ visible, onClick, variant }: Props) {
  if (!visible) return null;
  if (variant === "inline") {
    return (
      <button type="button" onClick={onClick} className={`${PILL} w-full justify-center gap-2 px-4 py-2.5`}>
        <Doty pose="corriendo" size="chip" shadow={false} /> Volver a mi nivel
      </button>
    );
  }
  return (
    <button
      type="button"
      onClick={onClick}
      className={`${PILL} fixed right-4 z-30 py-2.5 pr-4 pl-14 md:hidden`}
      style={{
        bottom: "calc(76px + env(safe-area-inset-bottom))",
        animation: "dots-pop-in 250ms cubic-bezier(.34,1.56,.64,1) both",
      }}
    >
      <span aria-hidden className="absolute" style={{ left: -6, top: -30 }}>
        <Doty pose="corriendo" size="mini" shadow={false} />
      </span>
      Volver a mi nivel
    </button>
  );
}
```

- [ ] **Step 4: Cablear en `path-container.tsx`**

Imports: `import { useInView } from "@/hooks/use-in-view";`, `import FoldedHeader from "./folded-header";`, `import BackToCurrent from "./back-to-current";`.

Junto al estado derivado de la Task 6 (siempre antes de los `return` tempranos):
```tsx
  // El banner sale del viewport → cabecera plegada. Margen superior = alto del HUD.
  const bannerInView = useInView(() => bannerRef.current, shownId, { rootMargin: "-64px 0px 0px 0px" });
  // El nodo actual sale del viewport → botón flotante. Si se mira otra dificultad no existe en el DOM.
  const currentInView = useInView(
    () => document.querySelector('[data-path-current="true"]'),
    `${shownId}:${path ? 1 : 0}`,
    { threshold: 0.4 },
  );
  const showBack = shownId !== null && (shownId !== currentId || !currentInView);

  const pendingScrollRef = useRef(false);
  const scrollToCurrent = useCallback(() => {
    document
      .querySelector('[data-path-current="true"]')
      ?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, []);
  const backToCurrent = useCallback(() => {
    if (shownId !== currentId && currentId !== null) {
      pendingScrollRef.current = true;
      goTo(currentId);
      return;
    }
    scrollToCurrent();
  }, [shownId, currentId, goTo, scrollToCurrent]);

  // Tras cambiar a "mi nivel" desde otra dificultad, centrar el nodo cuando ya está pintado.
  useEffect(() => {
    if (!pendingScrollRef.current || shownId !== currentId) return;
    pendingScrollRef.current = false;
    const t = setTimeout(scrollToCurrent, 350);
    return () => clearTimeout(t);
  }, [shownId, currentId, scrollToCurrent]);
```

En el render, pasa a `<PathDifficulty>`:
```tsx
        header={<FoldedHeader difficulty={shown} nav={nav} accentHex={accentHex} visible={!bannerInView} onGo={goTo} />}
        aside={<div className="hidden md:block"><BackToCurrent visible={showBack} onClick={backToCurrent} variant="inline" /></div>}
```
y, como hermano de `<PathDifficulty>` dentro del `div` raíz: `<BackToCurrent visible={showBack} onClick={backToCurrent} variant="floating" />`.

- [ ] **Step 5: Verificar**

Run: `npx tsc --noEmit && npm run lint`
Expected: limpio (si el lint del compiler señala el `eslint-disable` del hook, aplica la alternativa con `useCallback` descrita en el Step 1). Comprobación en navegador (la hace el controlador en la Task 10): al scrollear 600 px en móvil aparece la cabecera plegada con la misma barra segmentada; el botón flotante aparece cuando el nodo actual sale de pantalla y desaparece al volver; tocarlo lo centra; con `?d=` de otra dificultad el botón está siempre y al tocarlo vuelve a `/levels` y centra.

- [ ] **Step 6: Commit**

```bash
git add hooks/use-in-view.ts components/path/folded-header.tsx components/path/back-to-current.tsx components/path/path-container.tsx
git commit -m "feat(camino): cabecera plegada al scrollear y botón Volver a mi nivel con IntersectionObserver

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 8: HUD sin marcos — `components/shell/app-header.tsx`

**Files:**
- Modify: `components/shell/app-header.tsx` (reescritura del JSX; el fetch se conserva)

**Interfaces:**
- Consumes: `MyStats.streakSecuredToday?: boolean` (A, Task 4/6), `levelProgress` (A), `UiIcon` `racha`/`gemas`/`xp`.
- Produces: nada nuevo; misma exportación `AppHeader`.

- [ ] **Step 1: Reescribir el `return` de `AppHeader`**

Conserva los imports, el estado y el `useEffect` tal cual (líneas 1-29). Actualiza el comentario de cabecera a: `HUD superior de las pantallas hub, sin marcos (spec §3.3): llama encendida solo si la racha de hoy está asegurada, gemas y nivel con barra degradada. Consume /me/stats; sin sesión degrada a ceros.` Añade tras la línea del `pct`:

```tsx
  // Sin el campo (backend viejo) la llama sigue la racha, como hasta ahora.
  const lit = stats ? (stats.streakSecuredToday ?? stats.streak > 0) : false;
```

y sustituye todo el `<header>` por:

```tsx
    <header className="sticky top-0 z-30 flex items-center gap-4 border-b border-(--border) bg-(--background)/85 px-4 py-2.5 backdrop-blur-md md:px-8">
      {/* Racha: llama + número, sin pastilla. Apagada = gris y atenuada. */}
      <div
        className="flex items-center gap-1 font-black tabular-nums"
        title={lit ? "Racha asegurada hoy" : "Practica hoy para encender la racha"}
        style={{ color: lit ? "var(--flame-edge)" : "var(--muted)" }}
      >
        <span
          className="inline-flex transition-[filter,opacity] duration-300"
          style={{ filter: lit ? "none" : "grayscale(1)", opacity: lit ? 1 : 0.45 }}
        >
          <UiIcon name="racha" size={22} />
        </span>
        <span className="text-sm">{stats?.streak ?? 0}</span>
      </div>

      {/* Gemas → tienda */}
      <Link
        href="/shop"
        className="flex items-center gap-1 font-black tabular-nums transition-transform active:scale-95"
        style={{ color: "var(--gem-edge)" }}
        title="Tienda"
      >
        <UiIcon name="gemas" size={22} />
        <span className="text-sm">{stats?.gems ?? 0}</span>
      </Link>

      {/* Nivel + XP */}
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <span className="flex shrink-0 items-center gap-1 text-xs font-black text-foreground">
          <UiIcon name="xp" size={20} /> Nv {stats?.level ?? 1}
        </span>
        <div
          className="h-2 min-w-0 flex-1 overflow-hidden rounded-full"
          role="progressbar"
          aria-label="Progreso de nivel"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
          style={{ background: "var(--border)" }}
        >
          <div
            className="h-full rounded-full transition-[width] duration-700"
            style={{ width: `${pct}%`, background: "linear-gradient(90deg, var(--primary), var(--accent))" }}
          />
        </div>
        <span className="shrink-0 text-[11px] font-extrabold tabular-nums text-(--muted)">
          {stats ? `${stats.xp}/${stats.xpForNextLevel}` : "—"} XP
        </span>
      </div>
    </header>
```

- [ ] **Step 2: Verificar**

Run: `npx tsc --noEmit && npm run lint`
Expected: limpio. `grep -n "border: \"1.5px" components/shell/app-header.tsx` no devuelve nada (se fueron las pastillas).

- [ ] **Step 3: Commit**

```bash
git add components/shell/app-header.tsx
git commit -m "feat(hud): racha, gemas y nivel sin marcos; la llama solo se enciende con la racha de hoy asegurada

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 9: Popover del nodo — Doty "cerebro galaxia" al dominar (con fallback)

**Files:**
- Modify: `components/path/node-popover.tsx:116-129`

**Interfaces:**
- Consumes: `poseOrFallback` y tamaño `"chip"` (Task 2); frase de la tabla de voz: "Cerebro galaxia. Este nivel ya es tuyo." (ya existe en `doty-identity.md`, fila `Maestría al 100 %`).

- [ ] **Step 1: Cablear**

Añade `import Doty, { poseOrFallback } from "@/components/ui/doty/doty";` y sustituye el bloque `{/* Mastery (dos niveles): dominado = corona */}` por:

```tsx
      {/* Maestría (dos niveles): dominado = corona + Doty cerebro galaxia (fallback orgulloso hasta que llegue el arte, spec §2.3). */}
      {mastery != null &&
        (mastery >= 100 ? (
          <div className="flex items-center gap-2">
            <Doty pose={poseOrFallback("cerebro-galaxia", "orgulloso")} size="chip" shadow={false} />
            <p className="text-[11px] font-black leading-tight" style={{ color: "var(--gold-edge)" }}>
              <span className="flex items-center gap-1"><UiIcon name="corona" size={14} /> Dominado</span>
              Cerebro galaxia. Este nivel ya es tuyo.
            </p>
          </div>
        ) : (
          <p className="flex items-center gap-1 text-[10px] font-black tabular-nums text-(--muted)">
            <UiIcon name="corona" size={16} /> Dominado {mastery}%
          </p>
        ))}
```

Sustituye también el botón `▶ {cta}` por `{cta}` con un `<Icon name="derecha" size={14} mono />` delante dentro de un `inline-flex items-center justify-center gap-1` (el triángulo era un carácter tipográfico haciendo de icono).

- [ ] **Step 2: Verificar**

Run: `npx tsc --noEmit && npm run lint`
Expected: limpio.

- [ ] **Step 3: Commit**

```bash
git add components/path/node-popover.tsx
git commit -m "feat(camino): el popover celebra el dominio con Doty cerebro galaxia (fallback orgulloso)

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 10: Documentación, verificación final y criterios de aceptación

**Files:**
- Modify: `docs/ARQUITECTURA.md` (sección del Camino)

- [ ] **Step 1: `docs/ARQUITECTURA.md`**

En la sección "## Navegación (tabs del hub)", donde describe el Camino (`/levels`), sustituye la descripción de los componentes del camino por un párrafo (máx. 12 líneas) que diga: una dificultad a la vez (`?d=<id>`, por defecto la actual: `lib/path-view.ts`); `path-container` (fetch, navegación, tarjetas bloqueadas), `path-difficulty` (vista: banner con narrador, secciones, niebla, grid md+ de 300 px + pista), `path-section` (zigzag 15/50/85 %, filas de 182 px, sub-banner), `path-node` (arte de 128 px sin contenedor, barra 100×8, badges), `folded-header` + `back-to-current` (IntersectionObserver vía `hooks/use-in-view.ts`), `segmented-bar`; que las poses pendientes de arte se resuelven con `poseOrFallback` (`components/ui/doty/pending.ts`); y que el HUD (`components/shell/app-header.tsx`) enciende la llama solo con `streakSecuredToday`.

- [ ] **Step 2: Verificación completa**

Run: `npm run lint && npm run test:scripts && npx next build`
Expected: lint limpio (`check-icons: 35 iconos OK`, `check-doty-assets` OK, `check-themes: generados al día`), 22 tests en verde, build sin errores (el warning de Turbopack sobre lockfiles múltiples es de infraestructura si se compila desde un worktree).

- [ ] **Step 3: Comprobación en navegador (controlador, con la sesión del preview; en el worktree con `npm run dev -- -p 3459` vía launch.json temporal)**

Criterios §3.4, medidos con `getComputedStyle`/`getBoundingClientRect` y capturas:
1. `resize_window` a 390 px: el `<img>` del nodo mide 128 × 128; ninguna etiqueta se recorta (`scrollWidth <= clientWidth` del label); en las tres posiciones del zigzag el marcador y los vecinos no se solapan con nodos (comparar rects).
2. Scroll de 600 px: la cabecera plegada tiene `opacity: 1` y muestra `SegmentedBar`; las flechas cambian `?d=`; recargar con `?d=<id>` conserva la dificultad.
3. El botón flotante aparece cuando `[data-path-current]` sale del viewport y desaparece al volver; un tap lo centra (rect del nodo dentro del viewport tras 400 ms).
4. HUD: con `streakSecuredToday: true` el `filter` del icono de racha es `none`; con `false`, `grayscale(1)`. (Si la cuenta del preview ya practicó hoy, forzar el otro caso con un mock de `/me/stats` en `javascript_tool` no es posible: anotar el caso observado y el contrario queda cubierto por la lógica `lit`.)
5. Las animaciones usadas son `dots-pop-in`, `dots-float`, `dots-wiggle`, `dots-pulse-ring`, `dots-star-spin`, `doty-bob` y transiciones de `opacity/transform/width/filter`: nada anima `top/left/height` salvo la barra de progreso (`width`, tolerado en el proyecto). Con `prefers-reduced-motion` (emulación del navegador) el feedback de progreso sigue visible.
Cuatro temas: repetir las capturas del Camino en rosa/eléctrico × claro/oscuro; el tinte de los banners sale de `color-mix` con `--surface`, así que debe seguir a la paleta.

- [ ] **Step 4: Mensaje de cierre a Sergio**

Debe decir: rama y commits; que B no toca el backend ni la BD; que los narradores y `cerebro-galaxia` muestran el fallback hasta que la fase 4 esté `done` (y que `poseOrFallback` los cambiará solo al regenerar el registro); los ratios/medidas de los criterios 1-5; y el comportamiento nuevo por defecto (una dificultad a la vez, `?d=`).

- [ ] **Step 5: Commit**

```bash
git add docs/ARQUITECTURA.md
git commit -m "docs(arquitectura): Camino v3 — una dificultad a la vez, nodo sin contenedor, cabecera plegada y HUD sin marcos

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

## Self-review del plan

- **Cobertura del spec §3**: 3.1 nodo → Task 3 (arte 128/136, barra, etiqueta, estados, checkpoint trofeo, badges, geometría 640/150/182, lectura con badge `lectura` vía `NODE_META`, animaciones transform/opacity). 3.2 banner → Task 5 (composición A, kicker, línea de ánimo, barra segmentada, conteo sin checkpoints, narrador con fallback), una dificultad a la vez → Task 6 (`?d=` en Suspense, por defecto la current), cabecera plegada → Task 7, sub-banner → Task 4, escritorio 300 px sticky → Task 5, botón flotante → Task 7, secciones futuras y niebla → Task 5, dificultades bloqueadas y vista previa → Tasks 4/6, líneas de ánimo → Task 1. 3.3 HUD → Task 8. 3.4 criterios → Task 10. Tabla §2.3 en el Camino: `cerebro-galaxia` → Task 9; narradores → Task 5.
- **Decisiones que el spec no fija** (anotadas como rulings del plan): nodos sin `src` muestran el icono del tipo a 72 px sin disco; los umbrales de la tabla pasan a 0 / <50 / <80 / <100 / 100 con dos frases nuevas; el banner lleva también las flechas (en escritorio no hay cabecera plegada); en vista previa el narrador dice `PREVIEW_LINE`; la píldora de porcentaje del nodo desaparece (la barra la reemplaza).
- **Consistencia de nombres**: `NODE_W`, `ART_BOX`, `NODE_ROW_H` (Task 3) los consume Task 3 en `path-section`; `PathSection` con `index/total/preview` (Task 4) la consume Task 5; `PathDifficulty` con `nav/accentHex/preview/onGo/bannerRef/header/aside` y `difficultyColors` (Task 5) los consume Task 6/7; `DifficultyArrow` (Task 5) lo consume Task 7; `useInView(getTarget, key, options, initial)` (Task 7) solo lo consume el contenedor; `poseOrFallback` y tamaños `chip/section/banner` (Task 2) los consumen Tasks 4, 5, 7, 9.
- **Sin placeholders**: cada paso lleva el código o el comando exacto; las únicas instrucciones en prosa (ARQUITECTURA, lista de SVG) indican contenido y límite.
