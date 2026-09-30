# El nivel que se expande — plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** al tocar un nivel del Camino, la propia burbuja del nivel crece hasta mostrar el botón para practicar (sin popover), y la barra de cada nodo pasa a tener dos hitos: completar y dominar.

**Architecture:** el alto de fila no cambia. La burbuja crece a lo ancho y el título y los hitos pasan a una columna junto a la imagen, así que ni las filas ni el conector se mueven. Toda la geometría del expandido son longitudes `px + cqw` calculadas en una función pura (`lib/node-bubble.ts`) y pasadas como variables CSS al slot. Una container query en `globals.css` elige entre la variante estrecha (burbuja a todo el ancho) y la ancha (440 px). La animación es solo CSS: transiciones, sin rAF ni medir con JS.

**Tech Stack:** Next.js 16 (app router), React 19 (con React Compiler lint), Tailwind 4, `node --test` para la lógica pura.

**Spec:** `docs/superpowers/specs/2026-09-30-nivel-que-se-expande-design.md`

## Global Constraints

- Node: en bash, `source ~/.nvm/nvm.sh && nvm use` antes de cualquier `node`/`npm`/`npx`. En fish, `nvm use` a secas.
- Navegación siempre con `router.push`; nunca `window.location.*`.
- Lint del React Compiler: nada de `setState` síncrono en el cuerpo de un `useEffect`, ni efectos colaterales dentro de updaters de `setState`.
- Iconos solo con `<Icon name=…>`, nunca emoji. El check es `<Icon name="check" mono>`.
- Doty solo con `<Doty pose=…>`; las poses dinámicas pasan por `toDotyPose`.
- Colores: tokens `var(--success)`, `var(--gold)`, `var(--gold-edge)`, `var(--surface)`, `var(--border)`, `var(--muted)`, `var(--foreground)`, `var(--shadow-card)`. No editar `app/themes.generated.css` ni `lib/theme-colors.ts`.
- Lógica pura en `lib/*.ts` con solo `import type` (o sin imports): `node --test` la ejecuta sin bundler y no resuelve `@/`. Sus tests son `lib/*.test.mjs` e importan con la extensión `.ts`.
- Animación del expandido: 400 ms, `cubic-bezier(.22, 1, .36, 1)`, sin rebote.
- Umbral de la variante ancha: pista ≥ **520 px**; ancho de la burbuja ancha: **440 px**.
- Copy en español neutro y tono juguetón; textos exactos: «Completado», «Dominado», «Empezar», «Continuar», «Repasar», «¡Sigue aquí!».
- Commits: mensaje en español estilo `feat(camino): …`, terminando con `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Antes del último commit: `npm run lint`, `npm run test:scripts` y `npx next build` deben pasar.

---

## Mapa de archivos

| Archivo | Qué hace |
|---|---|
| `lib/node-milestones.ts` (nuevo) | Pura: tramos de hitos a partir de un nodo; `MASTERY_TYPES`; etiqueta accesible |
| `lib/node-milestones.test.mjs` (nuevo) | Tests de lo anterior |
| `lib/node-bubble.ts` (nuevo) | Pura: constantes de geometría del nodo (reposo y expandido), `bubbleGeometry`, `bubbleVars`, `sideOf`, `toCss` |
| `lib/node-bubble.test.mjs` (nuevo) | Invariantes de geometría para anchos de pista reales + que el umbral de `globals.css` coincide |
| `components/path/node-milestones.tsx` (nuevo) | Pinta los tramos con su hito (círculo con check) y las etiquetas |
| `components/path/path-node.tsx` | Reescrito: capas absolutas, burbuja, columna con CTA, click fuera, scroll |
| `components/path/path-section.tsx` | Pista como contenedor, slot con `data-open` y variables, nivel actual abierto al nacer, espacio para Doty |
| `components/path/doty-marker.tsx` | Variante `peek` (asomado sobre la burbuja) además de la de siempre |
| `components/path/path-peer.tsx` | Clase para desvanecerse con la burbuja abierta |
| `app/globals.css` | Bloque `.dots-track` / `.dots-slot` / `.dots-node-*` |
| `components/path/node-popover.tsx` | **Se borra** |
| `lib/tips.ts`, `docs/brand/doty-identity.md` | Copy de la pista del primer nivel |

---

### Task 1: Hitos como lógica pura

**Files:**
- Create: `lib/node-milestones.ts`
- Test: `lib/node-milestones.test.mjs`

**Interfaces:**
- Consumes: `PathNode`, `PathNodeType` de `types/path.types.ts` (solo tipos).
- Produces:
  - `MASTERY_TYPES: ReadonlySet<PathNodeType>`
  - `type MilestoneKind = "complete" | "master"`
  - `type MilestoneTone = "accent" | "success" | "gold"`
  - `type MilestoneLeg = { kind: MilestoneKind; fill: number; tone: MilestoneTone; reached: boolean }`
  - `nodeMilestones(node: Pick<PathNode, "type" | "progress" | "completed" | "mastery">): MilestoneLeg[]`
  - `MILESTONE_LABEL: Record<MilestoneKind, string>`
  - `milestonesLabel(legs: readonly MilestoneLeg[]): string`

- [ ] **Step 1: Escribir el test que falla**

`lib/node-milestones.test.mjs`:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { MASTERY_TYPES, milestonesLabel, nodeMilestones } from "./node-milestones.ts";

const node = (over = {}) => ({ type: "vocab", progress: 0, completed: false, mastery: 0, ...over });

test("los cinco módulos con dominio por ítem, y nada más", () => {
  assert.deepEqual(
    [...MASTERY_TYPES].sort(),
    ["grammar", "letters", "numbers", "pronunciation", "vocab"],
  );
});

test("módulo con dominio a medio camino: dos tramos, ninguno alcanzado", () => {
  assert.deepEqual(nodeMilestones(node({ progress: 40 })), [
    { kind: "complete", fill: 40, tone: "accent", reached: false },
    { kind: "master", fill: 0, tone: "accent", reached: false },
  ]);
});

test("completado con dominio al 50 %: primer hito verde, segundo en curso", () => {
  assert.deepEqual(nodeMilestones(node({ progress: 100, completed: true, mastery: 50 })), [
    { kind: "complete", fill: 100, tone: "success", reached: true },
    { kind: "master", fill: 50, tone: "accent", reached: false },
  ]);
});

test("dominado: segundo hito dorado", () => {
  const [, master] = nodeMilestones(node({ progress: 100, completed: true, mastery: 100 }));
  assert.deepEqual(master, { kind: "master", fill: 100, tone: "gold", reached: true });
});

test("el dominio se muestra tal cual aunque falte completar", () => {
  const [complete, master] = nodeMilestones(node({ progress: 60, mastery: 20 }));
  assert.equal(complete.reached, false);
  assert.equal(master.fill, 20);
});

test("completed manda sobre progress: completado es tramo lleno", () => {
  const [complete] = nodeMilestones(node({ progress: 97, completed: true }));
  assert.equal(complete.fill, 100);
});

test("lección y lectura: un solo tramo", () => {
  for (const type of ["practice", "reading"]) {
    assert.deepEqual(nodeMilestones(node({ type, progress: 60 })), [
      { kind: "complete", fill: 60, tone: "accent", reached: false },
    ]);
  }
});

test("checkpoint: sin hitos", () => {
  assert.deepEqual(nodeMilestones(node({ type: "checkpoint", progress: 100, completed: true })), []);
});

test("mastery ausente cuenta como 0, y los valores se recortan y redondean", () => {
  const [a, b] = nodeMilestones(node({ progress: 33.4, mastery: undefined }));
  assert.equal(a.fill, 33);
  assert.equal(b.fill, 0);
  assert.equal(nodeMilestones(node({ progress: 140 }))[0].fill, 100);
  assert.equal(nodeMilestones(node({ progress: -5 }))[0].fill, 0);
});

test("la etiqueta accesible dice los dos porcentajes", () => {
  assert.equal(milestonesLabel(nodeMilestones(node({ progress: 40 }))), "Completado al 40 %. Dominado al 0 %.");
  assert.equal(milestonesLabel(nodeMilestones(node({ type: "practice", progress: 60 }))), "Completado al 60 %.");
});
```

- [ ] **Step 2: Correrlo y ver que falla**

Run: `node --test lib/node-milestones.test.mjs`
Expected: FAIL con `Cannot find module …/lib/node-milestones.ts`

- [ ] **Step 3: Implementar**

`lib/node-milestones.ts`:

```ts
import type { PathNode, PathNodeType } from "@/types/path.types";

/**
 * Hitos de la barra de cada nivel del Camino (spec 2026-09-30 §Hitos). Son los
 * dos logros de siempre, los que antes marcaba el check de la esquina:
 * *completado* (respondiste todo una vez) y *dominado* (mastery 100, solo en
 * los módulos con dominio por ítem).
 *
 * Lógica pura, solo `import type`: `node --test` la ejecuta tal cual.
 */

/** Módulos con dominio por ítem (F3e): los únicos con segundo tramo. */
export const MASTERY_TYPES: ReadonlySet<PathNodeType> = new Set<PathNodeType>([
  "letters",
  "numbers",
  "vocab",
  "pronunciation",
  "grammar",
]);

export type MilestoneKind = "complete" | "master";
export type MilestoneTone = "accent" | "success" | "gold";

export type MilestoneLeg = {
  kind: MilestoneKind;
  /** Cuánto del tramo está lleno, 0–100. */
  fill: number;
  tone: MilestoneTone;
  /** El hito del final del tramo ya se alcanzó. */
  reached: boolean;
};

const clamp = (n: number): number => Math.max(0, Math.min(100, Math.round(n)));

export function nodeMilestones(
  node: Pick<PathNode, "type" | "progress" | "completed" | "mastery">,
): MilestoneLeg[] {
  if (node.type === "checkpoint") return [];
  const done = node.completed;
  const legs: MilestoneLeg[] = [
    {
      kind: "complete",
      fill: done ? 100 : clamp(node.progress),
      tone: done ? "success" : "accent",
      reached: done,
    },
  ];
  if (MASTERY_TYPES.has(node.type)) {
    // Tal cual viene, aunque el primer tramo no esté lleno: se pueden dominar
    // ítems antes de terminar la pasada, y es un dato real.
    const fill = clamp(node.mastery ?? 0);
    legs.push({ kind: "master", fill, tone: fill >= 100 ? "gold" : "accent", reached: fill >= 100 });
  }
  return legs;
}

export const MILESTONE_LABEL: Record<MilestoneKind, string> = {
  complete: "Completado",
  master: "Dominado",
};

/** Lo que lee un lector de pantalla: «Completado al 40 %. Dominado al 0 %.» */
export function milestonesLabel(legs: readonly MilestoneLeg[]): string {
  return legs.map((l) => `${MILESTONE_LABEL[l.kind]} al ${l.fill} %.`).join(" ");
}
```

- [ ] **Step 4: Correrlo y ver que pasa**

Run: `node --test lib/node-milestones.test.mjs`
Expected: PASS, 10 tests.

- [ ] **Step 5: Commit**

```bash
git add lib/node-milestones.ts lib/node-milestones.test.mjs
git commit -m "feat(camino): hitos de completar y dominar como lógica pura

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Geometría del nodo como lógica pura

**Files:**
- Create: `lib/node-bubble.ts`
- Test: `lib/node-bubble.test.mjs`

**Interfaces:**
- Consumes: nada.
- Produces (todo exportado desde `lib/node-bubble.ts`):
  - Constantes numéricas: `SLOT_W = 150`, `ART_BOX = 136`, `MILESTONES_W = 104`, `MILESTONE_DOT = 14`, `LABEL_H = 30`, `MS_TOP = 140`, `LABEL_TOP = 158`, `NODE_ROW_H = 188`, `BUBBLE_TOP = -4`, `BUBBLE_H = 192`, `ART_OPEN_DY = 24`, `MS_OPEN_TOP = 84`, `WIDE_W = 440`, `WIDE_MIN_TRACK = 520`, `DOTY_PEEK_W = 200`, `DOTY_PEEK_TOP = -62`, `DOTY_ROOM = 48`
  - `COL: { top: 24; typeH: 14; titleGap: 2; titleH: 38; msGap: 10; msH: 28; ctaGap: 12; ctaH: 42 }`
  - `type NodeSide = "left" | "center" | "right"`, `type BubbleMode = "narrow" | "wide"`, `type Lin = { px: number; cqw: number }`
  - `SIDE_X: Record<NodeSide, number>` (`15 / 50 / 85`)
  - `sideOf(xPct: number): NodeSide`
  - `type BubbleGeometry = { bubbleLeft: Lin; bubbleWidth: Lin; artX: Lin; msLeft: Lin; msWidth: Lin; colLeft: number; colWidth: Lin; dotyLeft: Lin; artOnRight: boolean }`
  - `bubbleGeometry(side: NodeSide, mode: BubbleMode): BubbleGeometry`
  - `evalLin(l: Lin, trackW: number): number`
  - `toCss(l: Lin): string`
  - `bubbleVars(side: NodeSide): Record<string, string>`. Sus claves: `--nb-slot-w`, `--nb-ms-left`, `--nb-ms-top`, `--nb-ms-w`, `--nb-ms-top-open`, `--nb-art-dy`, `--nb-cl`, y para `n` (narrow) y `w` (wide): `--nb-bl-*`, `--nb-bw-*`, `--nb-ax-*`, `--nb-ml-*`, `--nb-mw-*`, `--nb-cw-*`, `--nb-dl-*`.

- [ ] **Step 1: Escribir el test que falla**

`lib/node-bubble.test.mjs`:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  ART_BOX, BUBBLE_H, BUBBLE_TOP, COL, DOTY_PEEK_W, MS_OPEN_TOP, NODE_ROW_H, SIDE_X, SLOT_W,
  WIDE_MIN_TRACK, WIDE_W, bubbleGeometry, bubbleVars, evalLin, sideOf, toCss,
} from "./node-bubble.ts";

const SIDES = ["left", "center", "right"];
const NARROW = [288, 343, 400, WIDE_MIN_TRACK - 1];
const WIDE = [WIDE_MIN_TRACK, 628, 640];
const near = (a, b, msg) => assert.ok(Math.abs(a - b) < 1e-9, `${msg}: ${a} ≠ ${b}`);

/** Todo en coordenadas de la pista, para comparar con sus bordes. */
function enPista(side, mode, W) {
  const g = bubbleGeometry(side, mode);
  const slot = (SIDE_X[side] * W) / 100 - SLOT_W / 2;
  const bl = slot + evalLin(g.bubbleLeft, W);
  const bw = evalLin(g.bubbleWidth, W);
  const art = slot + (SLOT_W - ART_BOX) / 2 + evalLin(g.artX, W);
  return { g, slot, bl, br: bl + bw, bw, art, ms: slot + evalLin(g.msLeft, W), doty: slot + evalLin(g.dotyLeft, W) };
}

test("el alto de fila y la burbuja expandida miden lo mismo por abajo", () => {
  assert.equal(NODE_ROW_H, 188);
  assert.equal(BUBBLE_TOP + BUBBLE_H, NODE_ROW_H);
});

test("la columna cabe en la burbuja y los hitos caen en su hueco", () => {
  const fin = COL.top + COL.typeH + COL.titleGap + COL.titleH + COL.msGap + COL.msH + COL.ctaGap + COL.ctaH;
  assert.ok(fin <= BUBBLE_H, `la columna mide ${fin}`);
  assert.equal(MS_OPEN_TOP - BUBBLE_TOP, COL.top + COL.typeH + COL.titleGap + COL.titleH + COL.msGap);
});

test("sideOf sigue la regla 35/65 del zigzag", () => {
  assert.equal(sideOf(15), "left");
  assert.equal(sideOf(50), "center");
  assert.equal(sideOf(85), "right");
});

test("estrecha: la burbuja es exactamente la pista", () => {
  for (const side of SIDES) for (const W of NARROW) {
    const p = enPista(side, "narrow", W);
    near(p.bl, 0, `${side}@${W} borde izq`);
    near(p.bw, W, `${side}@${W} ancho`);
  }
});

test("ancha: 440 px, dentro de la pista y anclada a su lado", () => {
  for (const side of SIDES) for (const W of WIDE) {
    const p = enPista(side, "wide", W);
    near(p.bw, WIDE_W, `${side}@${W} ancho`);
    assert.ok(p.bl >= 0 && p.br <= W, `${side}@${W} se sale: ${p.bl}..${p.br}`);
    if (side === "left") near(p.bl, p.slot, `${side}@${W} anclada a la izq del slot`);
    if (side === "right") near(p.br, p.slot + SLOT_W, `${side}@${W} anclada a la der del slot`);
    if (side === "center") near(p.bl + p.bw / 2, p.slot + SLOT_W / 2, `${side}@${W} centrada`);
  }
});

test("la imagen queda a 12 px del borde de su lado", () => {
  for (const mode of ["narrow", "wide"]) for (const side of SIDES) for (const W of mode === "narrow" ? NARROW : WIDE) {
    const p = enPista(side, mode, W);
    if (side === "right") near(p.art + ART_BOX, p.br - 12, `${side}/${mode}@${W}`);
    else near(p.art, p.bl + 12, `${side}/${mode}@${W}`);
  }
});

test("hitos y columna: mismo borde y mismo ancho, dentro de la burbuja", () => {
  for (const mode of ["narrow", "wide"]) for (const side of SIDES) for (const W of mode === "narrow" ? NARROW : WIDE) {
    const p = enPista(side, mode, W);
    near(p.ms, p.bl + p.g.colLeft, `${side}/${mode}@${W} borde`);
    near(evalLin(p.g.msWidth, W), evalLin(p.g.colWidth, W), `${side}/${mode}@${W} ancho`);
    near(evalLin(p.g.colWidth, W), p.bw - 176, `${side}/${mode}@${W} ancho de columna`);
    assert.ok(p.ms + evalLin(p.g.msWidth, W) <= p.br, `${side}/${mode}@${W} se sale`);
  }
});

test("Doty asomado cabe sobre la burbuja, lejos de la imagen", () => {
  for (const mode of ["narrow", "wide"]) for (const side of SIDES) for (const W of mode === "narrow" ? NARROW : WIDE) {
    const p = enPista(side, mode, W);
    assert.ok(p.doty >= p.bl && p.doty + DOTY_PEEK_W <= p.br, `${side}/${mode}@${W}`);
    if (side === "right") near(p.doty, p.bl + 16, `${side}/${mode}@${W}`);
    else near(p.doty + DOTY_PEEK_W, p.br - 16, `${side}/${mode}@${W}`);
  }
});

test("toCss escribe CSS válido y corto", () => {
  assert.equal(toCss({ px: 80, cqw: 0 }), "80px");
  assert.equal(toCss({ px: 0, cqw: 100 }), "100cqw");
  assert.equal(toCss({ px: 80, cqw: -15 }), "calc(80px - 15cqw)");
  assert.equal(toCss({ px: -80, cqw: 15 }), "calc(-80px + 15cqw)");
});

test("bubbleVars trae todas las variables que lee globals.css", () => {
  const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
  const leidas = new Set([...css.matchAll(/var\((--nb-[a-z-]+)\)/g)].map((m) => m[1]));
  assert.ok(leidas.size > 0, "globals.css no lee ninguna --nb-*");
  for (const side of SIDES) {
    const vars = bubbleVars(side);
    for (const v of leidas) assert.ok(v in vars, `${side}: falta ${v}`);
  }
});

test("el umbral de la container query es WIDE_MIN_TRACK", () => {
  const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
  assert.match(css, new RegExp(`@container \\(min-width: ${WIDE_MIN_TRACK}px\\)`));
});
```

Los dos últimos tests leen `app/globals.css`, que no tendrá el bloque hasta la Task 4. En esta task **fallan a propósito** y se marcan como pendientes con `test.todo`: cambia `test("bubbleVars trae …` y `test("el umbral …` por `test.todo(` con el mismo nombre y cuerpo. La Task 4 los vuelve a poner en `test(`.

- [ ] **Step 2: Correrlo y ver que falla**

Run: `node --test lib/node-bubble.test.mjs`
Expected: FAIL con `Cannot find module …/lib/node-bubble.ts`

- [ ] **Step 3: Implementar**

`lib/node-bubble.ts`:

```ts
/**
 * Geometría del nivel del Camino, en reposo y expandido (spec
 * docs/superpowers/specs/2026-09-30-nivel-que-se-expande-design.md).
 *
 * Coordenadas del SLOT del nodo: una caja de 150 px que path-section pone en la
 * pista a `calc(X% - 75px)`. Las del expandido son longitudes lineales
 * `px + cqw`: la pista es el contenedor (`container-type: inline-size`), así
 * que `1cqw` es el 1 % de su ancho y el CSS lo resuelve solo, sin que JS mida.
 *
 * Dos variantes, que elige una container query en globals.css:
 * - `narrow` (pista < 520 px: móvil, y escritorio estrecho con el panel al
 *   lado): la burbuja ocupa la pista entera.
 * - `wide` (pista ≥ 520 px): 440 px anclada a su lado del zigzag.
 *
 * Lógica pura y sin imports: `node --test` la ejecuta tal cual.
 */

export type NodeSide = "left" | "center" | "right";
export type BubbleMode = "narrow" | "wide";
/** Longitud lineal: `px` píxeles más `cqw` centésimas del ancho de la pista. */
export type Lin = { px: number; cqw: number };

// ── Reposo ───────────────────────────────────────────────────────────────
export const SLOT_W = 150;
/** El arte (128) flota en una caja de 136: 8 px de aire para el resplandor. */
export const ART_BOX = 136;
export const MILESTONES_W = 104;
export const MILESTONE_DOT = 14;
export const LABEL_H = 30;
export const MS_TOP = ART_BOX + 4; // 140
export const LABEL_TOP = MS_TOP + MILESTONE_DOT + 4; // 158
/** Alto de fila. Expandir NO lo cambia: por eso el camino no se mueve. */
export const NODE_ROW_H = LABEL_TOP + LABEL_H; // 188
const ART_INSET = (SLOT_W - ART_BOX) / 2; // 7

// ── Expandido ────────────────────────────────────────────────────────────
/** La burbuja desborda 4 px por arriba del slot y llega hasta su base. */
export const BUBBLE_TOP = -4;
export const BUBBLE_H = NODE_ROW_H - BUBBLE_TOP; // 192
/** Cuánto baja la imagen para quedar centrada en la burbuja. */
export const ART_OPEN_DY = BUBBLE_TOP + (BUBBLE_H - ART_BOX) / 2; // 24
/** Columna, en coords de la burbuja: tipo, título de dos líneas, hitos, botón. */
export const COL = {
  top: 24,
  typeH: 14,
  titleGap: 2,
  titleH: 38,
  msGap: 10,
  msH: 28,
  ctaGap: 12,
  ctaH: 42,
} as const;
/** Donde caen los hitos al expandir, en coords del slot. */
export const MS_OPEN_TOP = BUBBLE_TOP + COL.top + COL.typeH + COL.titleGap + COL.titleH + COL.msGap; // 84
/** Aire entre el borde de la burbuja y la imagen. */
const PAD = 12;
/** La columna empieza tras la imagen y deja 16 px al otro borde. */
const COL_FROM_ART = PAD + ART_BOX + 12; // 160
const COL_END = 16;
export const WIDE_W = 440;
/** Umbral de la container query de globals.css (hay un test que los ata). */
export const WIDE_MIN_TRACK = 520;
/** Doty asomado con su globo al lado. */
export const DOTY_PEEK_W = 200;
/** Doty mini mide 80: con la base a 18 px, sus 22 px de abajo quedan tras la burbuja. */
export const DOTY_PEEK_TOP = BUBBLE_TOP + 22 - 80; // -62
/** Lo que la fila del nivel actual reserva arriba para que Doty asome sin tocar al anterior. */
export const DOTY_ROOM = 48;

/** Posición horizontal del slot en la pista, en % (el zigzag de path-section). */
export const SIDE_X: Record<NodeSide, number> = { left: 15, center: 50, right: 85 };

export function sideOf(xPct: number): NodeSide {
  return xPct < 35 ? "left" : xPct > 65 ? "right" : "center";
}

export type BubbleGeometry = {
  bubbleLeft: Lin;
  bubbleWidth: Lin;
  /** `translate` horizontal de la imagen, desde su sitio en reposo. */
  artX: Lin;
  msLeft: Lin;
  msWidth: Lin;
  /** Borde izquierdo de la columna, en coords de la burbuja. */
  colLeft: number;
  colWidth: Lin;
  dotyLeft: Lin;
  artOnRight: boolean;
};

const lin = (px: number, cqw = 0): Lin => ({ px, cqw });
const add = (a: Lin, b: Lin): Lin => ({ px: a.px + b.px, cqw: a.cqw + b.cqw });

export function bubbleGeometry(side: NodeSide, mode: BubbleMode): BubbleGeometry {
  const artOnRight = side === "right";
  let bubbleLeft: Lin;
  let bubbleWidth: Lin;
  if (mode === "narrow") {
    // La pista entera: su borde izquierdo está a -(X% - 75px) del slot.
    bubbleLeft = lin(SLOT_W / 2, -SIDE_X[side]);
    bubbleWidth = lin(0, 100);
  } else {
    bubbleWidth = lin(WIDE_W);
    bubbleLeft =
      side === "left" ? lin(0) : side === "right" ? lin(SLOT_W - WIDE_W) : lin(SLOT_W / 2 - WIDE_W / 2);
  }
  const bubbleRight = add(bubbleLeft, bubbleWidth);
  const artLeft = artOnRight ? add(bubbleRight, lin(-PAD - ART_BOX)) : add(bubbleLeft, lin(PAD));
  const colLeft = artOnRight ? COL_END : COL_FROM_ART;
  const colWidth = add(bubbleWidth, lin(-(COL_FROM_ART + COL_END)));
  return {
    bubbleLeft,
    bubbleWidth,
    artX: add(artLeft, lin(-ART_INSET)),
    msLeft: add(bubbleLeft, lin(colLeft)),
    msWidth: colWidth,
    colLeft,
    colWidth,
    // En la punta de la columna, lejos de la imagen.
    dotyLeft: artOnRight
      ? add(bubbleLeft, lin(COL_END))
      : add(bubbleRight, lin(-COL_END - DOTY_PEEK_W)),
    artOnRight,
  };
}

/** Valor en px de una `Lin` para una pista de `trackW` px. */
export function evalLin(l: Lin, trackW: number): number {
  return l.px + (l.cqw * trackW) / 100;
}

/** `80px`, `100cqw` o `calc(80px - 15cqw)`. */
export function toCss(l: Lin): string {
  if (l.cqw === 0) return `${l.px}px`;
  if (l.px === 0) return `${l.cqw}cqw`;
  return `calc(${l.px}px ${l.cqw < 0 ? "-" : "+"} ${Math.abs(l.cqw)}cqw)`;
}

/** Variables CSS que el slot lleva en `style`; globals.css elige narrow o wide. */
export function bubbleVars(side: NodeSide): Record<string, string> {
  const vars: Record<string, string> = {
    "--nb-slot-w": `${SLOT_W}px`,
    "--nb-ms-left": `${(SLOT_W - MILESTONES_W) / 2}px`,
    "--nb-ms-top": `${MS_TOP}px`,
    "--nb-ms-w": `${MILESTONES_W}px`,
    "--nb-ms-top-open": `${MS_OPEN_TOP}px`,
    "--nb-art-dy": `${ART_OPEN_DY}px`,
    "--nb-cl": `${bubbleGeometry(side, "narrow").colLeft}px`,
  };
  for (const [mode, s] of [["narrow", "n"], ["wide", "w"]] as const) {
    const g = bubbleGeometry(side, mode);
    vars[`--nb-bl-${s}`] = toCss(g.bubbleLeft);
    vars[`--nb-bw-${s}`] = toCss(g.bubbleWidth);
    vars[`--nb-ax-${s}`] = toCss(g.artX);
    vars[`--nb-ml-${s}`] = toCss(g.msLeft);
    vars[`--nb-mw-${s}`] = toCss(g.msWidth);
    vars[`--nb-cw-${s}`] = toCss(g.colWidth);
    vars[`--nb-dl-${s}`] = toCss(g.dotyLeft);
  }
  return vars;
}
```

- [ ] **Step 4: Correrlo y ver que pasa**

Run: `node --test lib/node-bubble.test.mjs`
Expected: PASS 9 tests, 2 todo.

- [ ] **Step 5: Commit**

```bash
git add lib/node-bubble.ts lib/node-bubble.test.mjs
git commit -m "feat(camino): geometría del nivel expandido como lógica pura

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: La barra de cada nodo pasa a hitos y el check de la esquina se va

Esta task deja el Camino funcionando **con el popover de siempre**. Solo cambian la barra y el check. Es un paso entregable por sí solo.

**Files:**
- Create: `components/path/node-milestones.tsx`
- Modify: `components/path/path-node.tsx` (constantes, barra y check)
- Modify: `components/path/path-section.tsx` (comentario del alto de fila)

**Interfaces:**
- Consumes: `nodeMilestones`, `milestonesLabel`, `MILESTONE_LABEL`, `MilestoneLeg`, `MilestoneTone` (Task 1); `SLOT_W`, `ART_BOX`, `MILESTONES_W`, `MILESTONE_DOT`, `LABEL_H`, `NODE_ROW_H` (Task 2).
- Produces: `NodeMilestones` (default export de `components/path/node-milestones.tsx`) con props `{ legs: readonly MilestoneLeg[]; accentHex: string; labeled?: boolean; className?: string; style?: CSSProperties }`. `path-node.tsx` sigue exportando `NODE_W`, `ART_BOX`, `NODE_ROW_H` (ahora 188) para `path-section`.

- [ ] **Step 1: Crear el componente de hitos**

`components/path/node-milestones.tsx`:

```tsx
"use client";

import type { CSSProperties } from "react";
import { Icon } from "@/components/ui/icon";
import { MILESTONE_DOT } from "@/lib/node-bubble";
import {
  MILESTONE_LABEL,
  milestonesLabel,
  type MilestoneLeg,
  type MilestoneTone,
} from "@/lib/node-milestones";

interface Props {
  legs: readonly MilestoneLeg[];
  accentHex: string;
  /** Expandido: se ven «Completado» y «Dominado» bajo cada hito. */
  labeled?: boolean;
  className?: string;
  style?: CSSProperties;
}

const SEG_H = 8;

/** El dorado del dominio es el mismo degradado que tenía el check de la esquina. */
const paint = (tone: MilestoneTone, accentHex: string): string =>
  tone === "success"
    ? "var(--success)"
    : tone === "gold"
      ? "linear-gradient(135deg, var(--gold), var(--gold-edge))"
      : accentHex;

/**
 * Barra de hitos de un nivel (spec 2026-09-30 §Hitos): un tramo por logro, con
 * su hito al final. El hito alcanzado lleva el check que antes iba en la
 * esquina de la imagen: hay un solo lugar que dice cuánto llevas.
 */
export default function NodeMilestones({ legs, accentHex, labeled = false, className = "", style }: Props) {
  return (
    <div
      role="group"
      aria-label={milestonesLabel(legs)}
      className={`flex items-center gap-[3px] ${className}`}
      style={{ height: MILESTONE_DOT, ...style }}
    >
      {legs.map((leg) => (
        <div key={leg.kind} className="relative flex min-w-0 flex-1 items-center gap-[3px]">
          <div
            className="flex-1 overflow-hidden rounded-full"
            style={{ height: SEG_H, background: `color-mix(in srgb, ${accentHex} 18%, transparent)` }}
          >
            <div
              className="h-full rounded-full transition-[width] duration-700 ease-out"
              style={{ width: `${leg.fill}%`, background: paint(leg.tone, accentHex) }}
            />
          </div>
          <span
            aria-hidden
            className="flex shrink-0 items-center justify-center rounded-full text-white"
            style={{
              width: MILESTONE_DOT,
              height: MILESTONE_DOT,
              background: leg.reached ? paint(leg.tone, accentHex) : "var(--surface)",
              border: leg.reached
                ? "2px solid var(--surface)"
                : `2px solid color-mix(in srgb, ${accentHex} 45%, transparent)`,
              boxShadow: leg.reached
                ? `0 1px 4px color-mix(in srgb, ${leg.tone === "gold" ? "var(--gold)" : "var(--success)"} 40%, transparent)`
                : "none",
            }}
          >
            {leg.reached && <Icon name="check" size={9} mono />}
          </span>
          <span
            aria-hidden
            className="pointer-events-none absolute right-0 whitespace-nowrap text-[10px] font-black leading-none text-(--muted) transition-opacity duration-200"
            style={{ top: MILESTONE_DOT + 4, opacity: labeled ? 1 : 0 }}
          >
            {MILESTONE_LABEL[leg.kind]}
          </span>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Usarlo en `path-node.tsx`, con las constantes de `lib/node-bubble`**

En `components/path/path-node.tsx`:

1. Reemplaza el bloque de constantes (desde `/* ── Geometría compartida` hasta `const TROPHY = 118;`) por:

```tsx
/* ── Geometría compartida con path-section (slots y conectores) ──────────
 * Vive en lib/node-bubble.ts, que también calcula el expandido. El arte
 * (128 px) flota en una caja de 136, con hitos de 104×14 y etiqueta de 13 px
 * debajo. Todas las filas miden lo mismo, checkpoints incluidos. */
export const NODE_W = SLOT_W;
export { ART_BOX, NODE_ROW_H };
export const ART = 128;
const TROPHY = 118;
```

2. Cambia los imports: agrega

```tsx
import NodeMilestones from "./node-milestones";
import { ART_BOX, LABEL_H, MILESTONES_W, MILESTONE_DOT, NODE_ROW_H, SLOT_W } from "@/lib/node-bubble";
import { nodeMilestones } from "@/lib/node-milestones";
```

3. Borra la constante local `MASTERY_TYPES` (y su comentario) y la línea `const isGoldCheck = …` (con su comentario «Dos niveles (F3e)…»).

4. Borra el bloque entero `{/* Check de completado (abajo-derecha)… */}` hasta el `)}` que cierra `isDone && !isLocked && (…)`.

5. Reemplaza el bloque `{/* ── Barra de progreso … */}` (el ternario `showBar ? (<div role="progressbar" …>) : (<div aria-hidden … />)`) por:

```tsx
      {/* ── Hitos (ocultos en bloqueados y checkpoints; el hueco se conserva) ── */}
      {showBar ? (
        <NodeMilestones
          legs={nodeMilestones(node)}
          accentHex={accentHex}
          className="mt-1"
          style={{ width: MILESTONES_W }}
        />
      ) : (
        <div aria-hidden className="mt-1" style={{ height: MILESTONE_DOT }} />
      )}
```

`clamp` y `progress` siguen haciendo falta (`const progress = clamp(node.progress);` lo usa el resto del componente). Si el lint marca `progress` sin uso, bórralo junto con `clamp`.

- [ ] **Step 3: Actualizar el comentario de `path-section.tsx`**

En `components/path/path-section.tsx`, dentro del comentario que empieza en «Doty and peers claim the same slot», cambia `NODE_ROW_H (182px) tall` por `NODE_ROW_H (188px) tall`.

- [ ] **Step 4: Type-check y lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: sin errores.

- [ ] **Step 5: Commit**

```bash
git add components/path/node-milestones.tsx components/path/path-node.tsx components/path/path-section.tsx
git commit -m "feat(camino): la barra de cada nivel marca los hitos de completar y dominar

El check de la esquina de la imagen se va: el hito alcanzado lo lleva dentro.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: La burbuja del nivel se expande en su lugar

**Files:**
- Modify: `app/globals.css` (bloque nuevo antes de `/* Movimiento reducido ≠ cero feedback.`)
- Modify: `components/path/path-node.tsx` (reescritura)
- Modify: `components/path/path-section.tsx`
- Modify: `lib/node-bubble.test.mjs` (los dos `test.todo` vuelven a `test`)
- Delete: `components/path/node-popover.tsx`

**Interfaces:**
- Consumes: todo lo de las Tasks 1–3, más `BUBBLE_TOP`, `BUBBLE_H`, `COL`, `LABEL_TOP`, `bubbleVars`, `sideOf`, `NodeSide`.
- Produces:
  - Props de `PathNode`: `{ node; accentHex; checkpointAvailable; animationIndex; open: boolean; onOpenChange: (open: boolean) => void; tipKey?: string; preview?: boolean }`. **`popoverAlign` desaparece.**
  - El slot de `path-section` es `div.dots-slot` con `data-open` (atributo vacío si está abierto, ausente si no) y las variables de `bubbleVars(side)` en `style`. Las Tasks 5 y siguientes cuelgan sus reglas CSS de `.dots-slot[data-open]`.
  - Clases CSS: `dots-track`, `dots-slot`, `dots-node-bubble`, `dots-node-art`, `dots-node-ms`, `dots-node-label`, `dots-node-col`, `dots-doty-peek`, `dots-doty-side`, `dots-peer` (las tres últimas las usa la Task 5).

- [ ] **Step 1: Reactivar los tests de CSS y verlos fallar**

En `lib/node-bubble.test.mjs`, cambia `test.todo("bubbleVars trae …` y `test.todo("el umbral …` de vuelta a `test(`.

Run: `node --test lib/node-bubble.test.mjs`
Expected: FAIL en «bubbleVars trae todas las variables que lee globals.css» (`globals.css no lee ninguna --nb-*`) y en «el umbral de la container query es WIDE_MIN_TRACK».

- [ ] **Step 2: Agregar el bloque CSS**

En `app/globals.css`, justo antes del comentario `/* Movimiento reducido ≠ cero feedback.`:

```css
/* ── Nivel del Camino que se expande (spec 2026-09-30-nivel-que-se-expande) ──
   La pista es el contenedor: 1cqw = 1 % de su ancho. Las coordenadas llegan
   como variables --nb-* desde lib/node-bubble.ts (bubbleVars), una tanda por
   lado del zigzag; aquí solo se elige la variante estrecha (burbuja a todo el
   ancho) o la ancha (440 px anclada a su lado). El alto de fila no cambia al
   expandir, así que nada se mueve en vertical y el conector no se toca. Con
   movimiento reducido, el bloque de abajo deja solo las transiciones de
   opacidad y color: la burbuja aparece ya en su sitio. */
.dots-track {
  container-type: inline-size;
}
.dots-node-bubble,
.dots-node-art,
.dots-node-ms,
.dots-node-label,
.dots-node-col,
.dots-doty-peek,
.dots-doty-side,
.dots-peer {
  transition-duration: 400ms;
  transition-timing-function: cubic-bezier(0.22, 1, 0.36, 1);
}
.dots-node-bubble {
  left: 0;
  width: var(--nb-slot-w);
  opacity: 0;
  pointer-events: none;
  transition-property: left, width, opacity;
}
.dots-node-art {
  transition-property: translate, scale;
}
.dots-node-ms {
  left: var(--nb-ms-left);
  top: var(--nb-ms-top);
  width: var(--nb-ms-w);
  transition-property: left, top, width;
}
.dots-node-label,
.dots-doty-side,
.dots-peer {
  transition-property: opacity;
  transition-duration: 200ms;
}
/* La columna tiene su ancho final desde el principio: la burbuja la va
   destapando y el texto no se re-acomoda mientras crece. */
.dots-node-col {
  left: var(--nb-cl);
  width: var(--nb-cw-n);
  opacity: 0;
  translate: 0 6px;
  transition-property: opacity, translate;
  transition-duration: 250ms;
}
.dots-doty-peek {
  left: var(--nb-dl-n);
  opacity: 0;
  translate: 0 18px;
  transition-property: opacity, translate;
}
.dots-slot[data-open] .dots-node-bubble {
  left: var(--nb-bl-n);
  width: var(--nb-bw-n);
  opacity: 1;
  pointer-events: auto;
}
.dots-slot[data-open] .dots-node-art {
  translate: var(--nb-ax-n) var(--nb-art-dy);
}
.dots-slot[data-open] .dots-node-ms {
  left: var(--nb-ml-n);
  top: var(--nb-ms-top-open);
  width: var(--nb-mw-n);
}
.dots-slot[data-open] .dots-node-label,
.dots-slot[data-open] .dots-doty-side,
.dots-slot[data-open] .dots-peer {
  opacity: 0;
}
.dots-slot[data-open] .dots-node-col {
  opacity: 1;
  translate: 0 0;
  transition-delay: 150ms;
}
.dots-slot[data-open] .dots-doty-peek {
  opacity: 1;
  translate: 0 0;
  transition-delay: 250ms;
}
.dots-slot:not([data-open]) .dots-node-art:enabled:hover {
  scale: 1.06;
}
.dots-node-art:enabled:active {
  scale: 0.95;
}
/* 520 = WIDE_MIN_TRACK de lib/node-bubble.ts (un test los ata). */
@container (min-width: 520px) {
  .dots-node-col {
    width: var(--nb-cw-w);
  }
  .dots-doty-peek {
    left: var(--nb-dl-w);
  }
  .dots-slot[data-open] .dots-node-bubble {
    left: var(--nb-bl-w);
    width: var(--nb-bw-w);
  }
  .dots-slot[data-open] .dots-node-art {
    translate: var(--nb-ax-w) var(--nb-art-dy);
  }
  .dots-slot[data-open] .dots-node-ms {
    left: var(--nb-ml-w);
    width: var(--nb-mw-w);
  }
}
```

- [ ] **Step 3: Correr los tests de CSS y verlos pasar**

Run: `node --test lib/node-bubble.test.mjs`
Expected: PASS 11 tests.

- [ ] **Step 4: Reescribir `components/path/path-node.tsx`**

Reemplaza el archivo entero por:

```tsx
"use client";

import { useEffect, useId, useRef, type CSSProperties } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import NodeMilestones from "./node-milestones";
import { Icon } from "@/components/ui/icon";
import { UiIcon } from "@/components/ui/ui-icon";
import { NODE_META } from "@/lib/path-node-meta";
import { nodeMilestones } from "@/lib/node-milestones";
import {
  ART_BOX,
  BUBBLE_H,
  BUBBLE_TOP,
  COL,
  LABEL_H,
  LABEL_TOP,
  NODE_ROW_H,
  SLOT_W,
} from "@/lib/node-bubble";
import { DIFFICULTY_TEXT_ON_HEX } from "@/lib/difficulty-palette";
import { wordImageUrl } from "@/lib/media-url";
import { BASE_URL_IMAGES } from "@/constants";
import type { PathNode as PathNodeType } from "@/types/path.types";

/* ── Geometría compartida con path-section (slots y conectores) ──────────
 * Vive en lib/node-bubble.ts, que también calcula el expandido. El arte
 * (128 px) flota en una caja de 136, con hitos de 104×14 y etiqueta de 13 px
 * debajo. Todas las filas miden lo mismo, checkpoints incluidos, y expandir
 * NO cambia ese alto: la burbuja crece a lo ancho y el título y los hitos
 * pasan a la columna de al lado (spec 2026-09-30 §Geometría). */
export const NODE_W = SLOT_W;
export { ART_BOX, NODE_ROW_H };
export const ART = 128;
const TROPHY = 118;

interface PathNodeProps {
  node: PathNodeType;
  accentHex: string;
  checkpointAvailable: boolean;
  animationIndex: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Pista contextual de este nivel: la burbuja la lleva mientras está abierta (cerrada, el slot). */
  tipKey?: string;
  /** Vista previa de una dificultad bloqueada: todo en gris, sin expandir ni marcas de progreso. */
  preview?: boolean;
}

const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

export default function PathNode({
  node,
  accentHex,
  checkpointAvailable,
  animationIndex,
  open,
  onOpenChange,
  tipKey,
  preview = false,
}: PathNodeProps) {
  const router = useRouter();
  const wrapperRef = useRef<HTMLDivElement>(null);
  const bubbleId = useId();

  const isCheckpoint = node.type === "checkpoint";
  const isLocked = preview || !node.unlocked;
  const progress = clamp(node.progress);
  const isDone = !preview && node.completed;
  const isCurrent = !preview && node.current && !isLocked && !isDone;
  const isTestable =
    !preview && isCheckpoint && node.unlocked && !node.completed && checkpointAvailable;
  const meta = NODE_META[node.type];
  const expanded = open && !isLocked;

  // Cerrar con un click fuera. Click y no pointerdown: el nivel actual nace
  // abierto, y con pointerdown el primer toque para hacer scroll lo cerraría.
  useEffect(() => {
    if (!expanded) return;
    const h = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) onOpenChange(false);
    };
    document.addEventListener("click", h);
    return () => document.removeEventListener("click", h);
  }, [expanded, onOpenChange]);

  const toggle = () => {
    if (expanded) {
      onOpenChange(false);
      return;
    }
    onOpenChange(true);
    // La fila no cambia de alto: esto solo actúa si el nivel estaba medio fuera.
    wrapperRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  };

  const labelColor = isLocked
    ? "var(--muted)"
    : isCheckpoint
      ? "var(--gold-edge)"
      : isDone
        ? "var(--success)"
        : `color-mix(in srgb, ${accentHex} 55%, var(--foreground))`;

  // Sombra de piso por defecto; resplandor del color de la sección en el actual;
  // dorado en el checkpoint (no bloqueado). Bloqueado: gris y apagado, sin sombra.
  const artFilter = isLocked
    ? "grayscale(1)"
    : isCheckpoint
      ? "drop-shadow(0 0 16px color-mix(in srgb, var(--gold) 60%, transparent))"
      : isCurrent
        ? `drop-shadow(0 0 14px ${accentHex}aa)`
        : "drop-shadow(0 6px 4px rgba(30, 27, 92, 0.18))";
  const artOpacity = isLocked ? 0.3 : isDone ? 0.88 : 1;
  const delay = Math.min(animationIndex, 8) * 80;
  const src = node.src ? wordImageUrl(node.src, BASE_URL_IMAGES) : null;
  const showBar = !isLocked && !isCheckpoint;
  const tint = isCheckpoint ? "var(--gold)" : accentHex;
  const cta = node.completed ? "Repasar" : progress > 0 ? "Continuar" : "Empezar";

  return (
    <div
      ref={wrapperRef}
      // Al abrir con un toque, `scrollIntoView` libra la cabecera plegada y la navegación.
      className="relative scroll-mt-[120px] scroll-mb-[96px]"
      style={{
        width: SLOT_W,
        height: NODE_ROW_H,
        animation: `dots-pop-in 500ms cubic-bezier(.34,1.56,.64,1) ${delay}ms both`,
      }}
    >
      {/* ── Burbuja: invisible en reposo, crece a su ancho al abrir ─────── */}
      {!isLocked && (
        <div
          id={bubbleId}
          role="group"
          aria-label={node.title}
          aria-hidden={!expanded}
          data-tip={expanded ? tipKey : undefined}
          className="dots-node-bubble absolute overflow-hidden"
          style={{
            top: BUBBLE_TOP,
            height: BUBBLE_H,
            borderRadius: 28,
            background: `color-mix(in srgb, ${tint} 8%, var(--surface))`,
            border: `2px solid color-mix(in srgb, ${tint} 40%, var(--border))`,
            boxShadow: "var(--shadow-card)",
          }}
        >
          <div inert={!expanded} className="dots-node-col absolute flex flex-col" style={{ top: COL.top }}>
            <span
              className="truncate text-[11px] font-black uppercase tracking-wider"
              style={{
                height: COL.typeH,
                lineHeight: `${COL.typeH}px`,
                color: `color-mix(in srgb, ${tint} 55%, var(--foreground))`,
              }}
            >
              {meta.label}
            </span>
            <p
              className="line-clamp-2 font-display text-base font-extrabold text-foreground"
              style={{ marginTop: COL.titleGap, height: COL.titleH, lineHeight: `${COL.titleH / 2}px` }}
            >
              {node.title}
            </p>
            {/* El hueco de los hitos: la barra es la del nodo, que viaja hasta aquí. */}
            <div aria-hidden style={{ marginTop: COL.msGap, height: COL.msH }} />
            <button
              type="button"
              onClick={() => router.push(meta.route(node))}
              className="dots-pressable w-full rounded-xl text-sm font-black tracking-wide cursor-pointer"
              style={
                {
                  marginTop: COL.ctaGap,
                  height: COL.ctaH,
                  background: accentHex,
                  color: DIFFICULTY_TEXT_ON_HEX[accentHex] ?? "#ffffff",
                  "--press-color": `color-mix(in srgb, ${accentHex} 70%, black)`,
                } as CSSProperties
              }
            >
              <span className="inline-flex items-center justify-center gap-1">
                <Icon name="derecha" size={16} mono />
                {cta}
              </span>
            </button>
          </div>
        </div>
      )}

      {/* ── Arte (el tile es el botón que abre y cierra) ─────────────────── */}
      <button
        type="button"
        aria-label={`${meta.label}: ${node.title}`}
        aria-expanded={isLocked ? undefined : expanded}
        aria-controls={isLocked ? undefined : bubbleId}
        disabled={isLocked}
        onClick={toggle}
        className="dots-node-art absolute flex items-center justify-center bg-transparent p-0 disabled:cursor-default"
        style={{
          left: (SLOT_W - ART_BOX) / 2,
          top: 0,
          width: ART_BOX,
          height: ART_BOX,
          zIndex: 1,
          // Abierto no flota: la burbuja es la que marca por dónde vas.
          animation:
            isCurrent && !expanded
              ? `dots-float 2.5s ease-in-out ${(animationIndex % 3) * 0.4}s infinite`
              : "none",
        }}
      >
        {/* Pulso: acento en el actual, oro suave en el checkpoint listo */}
        {(isCurrent || isTestable) && !expanded && (
          <div
            aria-hidden
            className="absolute inset-2 rounded-full"
            style={{
              border: `3px solid ${isTestable ? "color-mix(in srgb, var(--gold) 55%, transparent)" : `${accentHex}88`}`,
              animation: `dots-pulse-scale ${isTestable ? "2.6s" : "2s"} ease-out infinite`,
              // opacity base: con prefers-reduced-motion la animación colapsa y este borde tenue es el feedback que queda.
              opacity: 0.7,
            }}
          />
        )}

        <div
          style={{
            opacity: artOpacity,
            filter: artFilter,
            transition: "opacity 200ms",
            animation:
              isCurrent && !expanded
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
      </button>

      {/* ── Hitos: la misma barra en reposo y abierta (viaja a la columna) ── */}
      {showBar && (
        <NodeMilestones
          legs={nodeMilestones(node)}
          accentHex={accentHex}
          labeled={expanded}
          className="dots-node-ms absolute"
          style={{ zIndex: 2 }}
        />
      )}

      {/* ── Etiqueta en reposo (abierta, el título va en la columna) ─────── */}
      <span
        aria-hidden={expanded}
        className="dots-node-label absolute left-0 w-full text-center font-extrabold line-clamp-2"
        style={{
          top: LABEL_TOP,
          color: labelColor,
          fontSize: 13,
          lineHeight: "15px",
          letterSpacing: "-0.01em",
          height: LABEL_H,
        }}
      >
        {node.title}
      </span>
    </div>
  );
}
```

- [ ] **Step 5: Borrar el popover**

Run: `git rm components/path/node-popover.tsx`

- [ ] **Step 6: Reescribir `components/path/path-section.tsx`**

Reemplaza el archivo entero por:

```tsx
"use client";

import React, { useState, type CSSProperties } from "react";
import PathNode from "./path-node";
import DotyMarker from "./doty-marker";
import PathPeer from "./path-peer";
import SectionBanner from "./section-banner";
import { ART_BOX, NODE_ROW_H, SLOT_W, bubbleVars, sideOf, type NodeSide } from "@/lib/node-bubble";
import type {
  PathNode as PathNodeType,
  PathPeer as PathPeerType,
  PathSection as PathSectionType,
} from "@/types/path.types";

interface PathSectionProps {
  section: PathSectionType;
  index: number;
  total: number;
  accentHex: string;
  peersByNodeId: Record<number, PathPeerType[]>;
  preview?: boolean;
}

/* ── Zigzag helpers (evolved from level-section) ────────────── */
// Pattern repeats every 4 items: left → center → right → center → …
const zigzagX = (i: number): number => {
  const phase = i % 4;
  if (phase === 0) return 15;
  if (phase === 1) return 50;
  if (phase === 2) return 85;
  return 50;
};

const ROW_GAP = 18; // px – vertical gap between nodes

const keyOf = (n: PathNodeType) => `${n.type}-${n.id}`;
/** El nivel actual de verdad: el mismo criterio que la estrella de PathNode. */
const isLiveCurrent = (n: PathNodeType, preview: boolean) =>
  !preview && n.current && n.unlocked && !n.completed;
/** Variables de geometría por lado: tres objetos, calculados una sola vez. */
const SLOT_VARS: Record<NodeSide, CSSProperties> = {
  left: bubbleVars("left") as CSSProperties,
  center: bubbleVars("center") as CSSProperties,
  right: bubbleVars("right") as CSSProperties,
};
const TIP_PRIMER_NIVEL = "camino.primer-nivel";

export default function PathSection({
  section,
  index,
  total,
  accentHex,
  peersByNodeId,
  preview = false,
}: PathSectionProps) {
  const { id, checkpointAvailable, nodes } = section;
  // El nivel actual nace abierto (spec 2026-09-30, decisión 4). Inicializador y
  // no efecto: se pinta abierto desde el primer frame, sin animar ni saltar.
  const [openKey, setOpenKey] = useState<string | null>(() => {
    const current = nodes.find((n) => isLiveCurrent(n, preview));
    return current ? keyOf(current) : null;
  });

  // Todas las filas miden lo mismo (checkpoint incluido): NODE_ROW_H. Abrir un
  // nivel no lo cambia, así que las filas y el conector no se mueven nunca.
  const slots = nodes.map((n, i) => {
    const xPct = n.type === "checkpoint" ? 50 : zigzagX(i);
    return { node: n, key: keyOf(n), xPct, side: sideOf(xPct), h: NODE_ROW_H };
  });
  const offsets = slots.map((_, i) =>
    slots.slice(0, i).reduce((sum, s) => sum + s.h + ROW_GAP, 0),
  );
  const placed = slots.map((s, i) => ({
    ...s,
    y: offsets[i],
    centerY: offsets[i] + ART_BOX / 2,
  }));
  const totalH =
    slots.length === 0
      ? 0
      : offsets[slots.length - 1] + slots[slots.length - 1].h;

  // Connector: one cubic segment per consecutive pair; travelled part solid
  const segment = (
    a: { xPct: number; centerY: number },
    b: { xPct: number; centerY: number },
  ) => {
    const midY = (a.centerY + b.centerY) / 2;
    return `M ${a.xPct} ${a.centerY} C ${a.xPct} ${midY}, ${b.xPct} ${midY}, ${b.xPct} ${b.centerY}`;
  };

  return (
    <div className="flex w-full flex-col gap-4 items-center" data-section-id={id}>
      <SectionBanner
        section={section}
        index={index}
        total={total}
        accentHex={accentHex}
        muted={preview || (!section.unlocked && !section.skipped)}
      />

      {/* ── Path (zigzag + connector) ──────────────────────── */}
      {placed.length === 0 ? (
        <span className="text-(--muted)">No hay lecciones disponibles.</span>
      ) : (
        <div className="dots-track relative w-full" style={{ maxWidth: 640, height: totalH }}>
          {/* SVG connector: solid where already travelled, dashed ahead */}
          {placed.length >= 2 && (
            <svg
              className="absolute inset-0 w-full h-full pointer-events-none"
              viewBox={`0 0 100 ${totalH}`}
              preserveAspectRatio="none"
              fill="none"
            >
              {placed.slice(0, -1).map((p, i) => {
                const next = placed[i + 1];
                const travelled = p.node.completed;
                return (
                  <path
                    key={p.key}
                    d={segment(p, next)}
                    stroke={accentHex}
                    strokeWidth={travelled ? 3.5 : 2.5}
                    strokeDasharray={travelled ? undefined : "6 6"}
                    strokeLinecap="round"
                    opacity={travelled ? 0.55 : 0.3}
                    vectorEffect="non-scaling-stroke"
                  />
                );
              })}
            </svg>
          )}

          {/* Nodes */}
          {placed.map((p, nodeIndex) => {
            const peersHere = peersByNodeId[p.node.id] ?? [];
            const open = openKey === p.key;
            const live = isLiveCurrent(p.node, preview);
            return (
            <div
              key={p.key}
              className="dots-slot absolute"
              data-open={open ? "" : undefined}
              data-path-current={!preview && p.node.current ? "true" : undefined}
              // Una sola marca en el DOM: abierta la lleva la burbuja, que es lo que se ve.
              data-tip={live && !open ? TIP_PRIMER_NIVEL : undefined}
              style={{
                ...SLOT_VARS[p.side],
                left: `calc(${p.xPct}% - ${SLOT_W / 2}px)`,
                top: p.y,
                width: SLOT_W,
                zIndex: open ? 40 : 1,
              }}
            >
              <PathNode
                node={p.node}
                accentHex={accentHex}
                checkpointAvailable={checkpointAvailable}
                animationIndex={nodeIndex}
                open={open}
                // Updater puro: abrir otro nivel dispara también el "click fuera"
                // de este, y sin comparar cerraría al que se acaba de abrir.
                onOpenChange={(v) =>
                  setOpenKey((prev) => (v ? p.key : prev === p.key ? null : prev))
                }
                tipKey={live ? TIP_PRIMER_NIVEL : undefined}
                preview={preview}
              />
              {/*
                Doty and peers claim the same slot: the interior side of the
                node, top-aligned. There is no room for both — a row is
                NODE_ROW_H (188px) tall, Doty takes ~110 and two peers need
                ~105 — so on a node that has peers, Doty yields. The star
                badge and the pulse still mark the current node, and a peer
                is information while "¡Sigue aquí!" is decoration.
              */}
              {!preview && p.node.current && peersHere.length === 0 && (
                <DotyMarker side={p.xPct >= 50 ? "left" : "right"} />
              )}
              {!preview &&
                peersHere.map((peer, peerIndex) => (
                  <PathPeer
                    key={peer.id}
                    peer={peer}
                    // Always toward the inside of the zigzag. Flipping to the
                    // outside on the current node would push the peer off-screen
                    // on the 15% and 85% slots.
                    side={p.xPct >= 50 ? "left" : "right"}
                    stackIndex={peerIndex}
                  />
                ))}
            </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
```

Ya no quedan `popoverAlign` ni `NODE_W` en este archivo.

- [ ] **Step 7: Type-check, lint y tests**

Run: `npx tsc --noEmit && npm run lint && npm run test:scripts`
Expected: sin errores. Ningún archivo importa ya `node-popover`: `grep -rn "node-popover\|NodePopover\|popoverAlign" components app lib` no debe devolver nada.

- [ ] **Step 8: Commit**

```bash
git add app/globals.css components/path/path-node.tsx components/path/path-section.tsx lib/node-bubble.test.mjs
git commit -m "feat(camino): el nivel se expande en su lugar con el botón para practicar

Sin popover: la burbuja del nivel crece a lo ancho (todo el ancho en móvil,
440 px en escritorio) y el título y los hitos pasan a la columna de al lado.
El alto de fila no cambia, así que el camino no se mueve. El nivel actual
nace abierto.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Doty se asoma sobre la burbuja y los compañeros se apartan

**Files:**
- Modify: `components/path/doty-marker.tsx`
- Modify: `components/path/path-peer.tsx`
- Modify: `components/path/path-section.tsx`

**Interfaces:**
- Consumes: `DOTY_PEEK_W`, `DOTY_PEEK_TOP`, `DOTY_ROOM` de `lib/node-bubble`; las reglas `.dots-doty-peek`, `.dots-doty-side` y `.dots-peer` de `globals.css` (Task 4).
- Produces: `DotyMarker` con props `{ side?: "left" | "right"; variant?: "side" | "peek"; dotyAt?: "start" | "end" }`.

- [ ] **Step 1: Variante `peek` en `doty-marker.tsx`**

1. Agrega `import { DOTY_PEEK_TOP, DOTY_PEEK_W } from "@/lib/node-bubble";`.

2. Reemplaza la interfaz y la función por:

```tsx
interface DotyMarkerProps {
  side?: "left" | "right";
  /**
   * `side`: al costado del nivel actual, como siempre. `peek`: asomado sobre el
   * borde de su burbuja abierta (spec 2026-09-30, decisión 9); globals.css lo
   * muestra solo con `.dots-slot[data-open]`.
   */
  variant?: "side" | "peek";
  /** En `peek`, en qué punta de la columna va Doty: `end` si la imagen está a la izquierda. */
  dotyAt?: "start" | "end";
}

/** Small Doty anchored beside the current node, cheering the learner on. */
export default function DotyMarker({ side = "right", variant = "side", dotyAt = "end" }: DotyMarkerProps) {
  const pose = useSyncExternalStore(sorteo.suscribir, sorteo.cliente, sorteo.servidor);

  const globo = (
    <div
      className="rounded-2xl px-2.5 py-1 text-[11px] font-black whitespace-nowrap"
      style={{
        background: "var(--surface)",
        border: "2px solid var(--border)",
        color: "var(--foreground)",
        boxShadow: "0 3px 10px rgba(0,0,0,0.10)",
      }}
    >
      ¡Sigue aquí!
    </div>
  );

  if (variant === "peek") {
    return (
      <div
        aria-hidden
        className="dots-doty-peek absolute flex items-start justify-end gap-1 pointer-events-none select-none"
        style={{
          top: DOTY_PEEK_TOP,
          width: DOTY_PEEK_W,
          // Detrás de la burbuja: asoma cabeza y brazos por encima del borde.
          zIndex: -1,
          flexDirection: dotyAt === "end" ? "row" : "row-reverse",
        }}
      >
        <div className="mt-3">{globo}</div>
        <Doty pose={toDotyPose(pose)} size="mini" />
      </div>
    );
  }

  const anchor: React.CSSProperties =
    side === "right" ? { left: "100%" } : { right: "100%" };

  return (
    <div
      aria-hidden
      className="dots-doty-side absolute flex flex-col items-center gap-0.5 pointer-events-none select-none"
      style={{
        top: -6,
        width: 96,
        zIndex: 20,
        animation: "dots-float 3s ease-in-out infinite",
        ...anchor,
      }}
    >
      {globo}
      <Doty pose={toDotyPose(pose)} size="mini" />
    </div>
  );
}
```

- [ ] **Step 2: Clase en `path-peer.tsx`**

En el `div` raíz de `PathPeer`, cambia `className="absolute flex flex-col items-center gap-0.5 pointer-events-none select-none"` por `className="dots-peer absolute flex flex-col items-center gap-0.5 pointer-events-none select-none"`. Agrega al comentario del componente: «Con la burbuja del nivel abierta se desvanece (`.dots-slot[data-open] .dots-peer` en globals.css).»

- [ ] **Step 3: Espacio para Doty y el marcador asomado en `path-section.tsx`**

1. El import de `@/lib/node-bubble` pasa a:

```tsx
import { ART_BOX, DOTY_ROOM, NODE_ROW_H, SLOT_W, bubbleVars, sideOf, type NodeSide } from "@/lib/node-bubble";
```

2. Reemplaza el bloque `slots` + `placed` (desde el comentario «Todas las filas miden lo mismo» hasta el cierre de `placed`) por:

```tsx
  // Todas las filas miden lo mismo (checkpoint incluido): NODE_ROW_H. Abrir un
  // nivel no lo cambia, así que las filas y el conector no se mueven nunca.
  // El nivel actual reserva además aire arriba para que Doty asome sin tocar la
  // etiqueta del anterior; fijo, abierto o no, por la misma razón.
  const slots = nodes.map((n, i) => {
    const xPct = n.type === "checkpoint" ? 50 : zigzagX(i);
    const room = isLiveCurrent(n, preview) ? DOTY_ROOM : 0;
    return { node: n, key: keyOf(n), xPct, side: sideOf(xPct), room, h: room + NODE_ROW_H };
  });
  const offsets = slots.map((_, i) =>
    slots.slice(0, i).reduce((sum, s) => sum + s.h + ROW_GAP, 0),
  );
  const placed = slots.map((s, i) => ({
    ...s,
    y: offsets[i] + s.room,
    centerY: offsets[i] + s.room + ART_BOX / 2,
  }));
```

`totalH` no cambia: suma `h`, que ya incluye `room`.

3. En el slot, reemplaza

```tsx
              {!preview && p.node.current && peersHere.length === 0 && (
                <DotyMarker side={p.xPct >= 50 ? "left" : "right"} />
              )}
```

por

```tsx
              {live && peersHere.length === 0 && (
                <DotyMarker side={p.xPct >= 50 ? "left" : "right"} />
              )}
              {live && <DotyMarker variant="peek" dotyAt={p.side === "right" ? "start" : "end"} />}
```

4. En el comentario de encima («Doty and peers claim the same slot…»), agrega esta línea antes del `*/`: `With the bubble open, Doty peeks over its top edge instead and the peers fade out (.dots-slot[data-open] in globals.css).`

- [ ] **Step 4: Type-check y lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: sin errores.

- [ ] **Step 5: Commit**

```bash
git add components/path/doty-marker.tsx components/path/path-peer.tsx components/path/path-section.tsx
git commit -m "feat(camino): con el nivel abierto, Doty se asoma sobre la burbuja

Los compañeros se apartan mientras está abierta y vuelven al cerrarla.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Copy de la pista del primer nivel

**Files:**
- Modify: `lib/tips.ts:46`
- Modify: `docs/brand/doty-identity.md:199`

- [ ] **Step 1: Cambiar la frase**

En `lib/tips.ts`, la `frase` de `camino.primer-nivel` pasa a:

```ts
    frase: "Toca «Empezar» y arrancamos. Cada lección son unos tres minutos.",
```

En `docs/brand/doty-identity.md`, la fila «Pista: primer nivel» pasa a:

```md
| Pista: primer nivel | `senalando` | "Este es tu primer nivel. Toca «Empezar» y arrancamos. Cada lección son unos tres minutos." |
```

(Los planes y specs históricos de `docs/superpowers/` conservan el copy viejo: son registro, no fuente.)

- [ ] **Step 2: Tests**

Run: `node --test lib/tips.test.mjs`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add lib/tips.ts docs/brand/doty-identity.md
git commit -m "fix(pistas): el primer nivel ya está abierto, la pista señala «Empezar»

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Verificación en el navegador y build

**Files:** ninguno, salvo ajustes que salgan de verificar. Cada ajuste va en su propio commit `fix(camino): …`.

- [ ] **Step 1: Build de producción**

Run: `npx next build`
Expected: compila y hace type-check sin errores.

- [ ] **Step 2: Levantar backend y preview**

El backend (`../dots-backend`, `:4000`) suele estar corriendo con watcher. Compruébalo con `curl -s -o /dev/null -w "%{http_code}" http://localhost:4000/` (cualquier código HTTP sirve; si no responde, levántalo según su CLAUDE.md). Luego abre el dev server con `preview_start` (config de `.claude/launch.json`) y entra a `/levels` con una cuenta de prueba.

- [ ] **Step 3: Medir, no mirar (las capturas caducan)**

Móvil (`resize_window` preset `mobile`, 375×812), recargando la página:

```js
(() => {
  const open = document.querySelector('.dots-slot[data-open]');
  const bubble = open?.querySelector('.dots-node-bubble');
  const track = open?.closest('.dots-track');
  const b = bubble?.getBoundingClientRect(), t = track?.getBoundingClientRect();
  return {
    abiertos: document.querySelectorAll('.dots-slot[data-open]').length,
    esActual: open?.hasAttribute('data-path-current'),
    burbuja: b && [Math.round(b.left - t.left), Math.round(b.width), Math.round(t.width)],
    tips: document.querySelectorAll('[data-tip="camino.primer-nivel"]').length,
  };
})()
```

Esperado: `abiertos: 1`, `esActual: true`, `burbuja: [0, W, W]` (todo el ancho de la pista), `tips: 1`.

Escritorio (preset `desktop`, ventana ≥ 1280 px): el mismo script. Esperado: ancho de burbuja 440 y la burbuja dentro de la pista.

- [ ] **Step 4: Interacciones**

Con `javascript_tool` (si los clics con `computer` se cuelgan, despacha `click` por JS):

1. Clic en la imagen de otro nivel desbloqueado: `abiertos` sigue en 1 y el abierto es el nuevo.
2. Clic en el fondo de la página fuera de cualquier slot: `abiertos: 0`.
3. Scroll con la rueda o el dedo con el actual abierto: sigue abierto.
4. Antes y después de abrir/cerrar, compara `getBoundingClientRect().top` de todos los `.dots-slot`: no cambia ninguno (el camino no se mueve).
5. Clic en «Empezar»/«Continuar»: navega con `router.push` a la ruta de `NODE_META` (sin recarga completa: el token en memoria sigue vivo).
6. Un nodo bloqueado: clic sin efecto.
7. El checkpoint desbloqueado se abre y no muestra hitos.

- [ ] **Step 5: Lo visual**

Captura con `computer` → `screenshot` en móvil y escritorio, en claro y oscuro (`resize_window` con `colorScheme`). Revisa:

- Nodo izquierdo, central y derecho abiertos: la imagen a 12 px de su borde, sin texto cortado en la columna.
- Tipos con dominio (dos tramos, «Completado» y «Dominado» debajo al abrir) y sin dominio (un tramo).
- Doty asomado sin chocar con la etiqueta del nivel anterior y con los compañeros ocultos. Si choca, ajusta `DOTY_ROOM` o `DOTY_PEEK_TOP` en `lib/node-bubble.ts`: los tests de la Task 2 siguen valiendo.
- El conector pasa por detrás de la burbuja.
- Con `prefers-reduced-motion` (emúlalo en DevTools o con `matchMedia` si la herramienta lo permite), la burbuja aparece sin desplazarse.
- Ancho de pista entre 768 y ~900 px (panel lateral + pista estrecha): la burbuja ocupa la pista y no se sale.

- [ ] **Step 6: Checks finales y commit de ajustes**

Run: `npm run lint && npm run test:scripts && npx next build`
Expected: todo en verde. Si hubo ajustes, van en commits `fix(camino): …`.
