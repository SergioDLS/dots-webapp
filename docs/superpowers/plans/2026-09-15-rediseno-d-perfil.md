# Rediseño look & feel — Subproyecto D (Perfil compacto y hoja de ajustes) — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** El perfil pasa a identidad horizontal con Doty, barra de nivel, cuatro números sin cajas, insignias doradas y gestos; los ajustes salen de la tarjeta y viven en una hoja (inferior en móvil, lateral en escritorio) que escribe paleta, modo y sonido en el servidor; y el backend salda la deuda de `users.settings`, que ya existe en producción.

**Architecture:** Dos repos. En **dots-webapp** la lógica de vista del perfil vive en `lib/profile-view.ts`, pura y bajo `node --test`; la preferencia de sonido gana su propio espejo en `lib/sound-prefs.ts` y `lib/feedback-sounds.ts` la consulta antes de sonar; el generador de temas emite además el acento de cada paleta para que la muestra de color de la hoja no sea un hex escrito a mano; los componentes se reparten en `components/profile/`. En **dots-backend** la columna `settings` pasa a declararse en la entidad y `me.service.ts` deja el SQL crudo y su 503.

**Tech Stack:** Next.js 16 (app router) + React 19 + Tailwind 4; `node --test` (Node 24 ejecuta `.ts` con solo `import type`); NestJS 11 + TypeORM + Jest 30 en el backend; PostgreSQL remota compartida de producción.

**Spec:** `docs/superpowers/specs/2026-09-14-rediseno-look-and-feel-juvenil-design.md` — §5 (Subproyecto D), §2.1 (sistema de temas y persistencia), §1 (principios), §8 (orden y dependencias).

## Global Constraints

- Webapp: `source ~/.nvm/nvm.sh && nvm use` antes de cualquier `node`/`npm` (Node 24 por `.nvmrc`). **Es obligatorio**: sin eso el `node` del sistema no sabe ejecutar los `.ts` que importan los `.test.mjs` y verás fallos falsos. Verificación final de la webapp: `npm run lint && npm run test:scripts && npx next build`.
- Backend: `npm run lint` corre `eslint --fix` sobre todo el árbol y `main` arrastra 187 errores preexistentes ajenos. **Usa `npx eslint <archivos>` sobre lo que toques**, nunca `npm run lint`. Los tests del backend son `npm test` (Jest).
- Ramas: `redesign/d-perfil` en **los dos** repos, desde `main`. **Sin push a origin.** Cada uno en su worktree, fuera de los checkouts principales: ahí viven el dev server de Sergio (`:3000`) y el watcher del backend (`:4000`), y no se tocan. El worktree del backend es `/home/endurance/Projects/Endurance/dots/.worktrees/dots-backend-d-perfil`.
- **Ninguna migración nueva y ningún `--apply` sobre la base de datos.** `users.settings` YA existe en producción (aplicada el 2026-09-15, verificada con el dry-run de `scripts/migrate-settings.js`, que imprime `users.settings: exists`). D solo deja de esquivarla.
- **No toques `dots-backend/scripts/unlock-path.js`**: es un archivo sin trackear del checkout principal de Sergio.
- Commits terminan con `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`.
- Regla 1: navegación con `router.push`/`router.replace`, nunca `window.location.*`. Los únicos usos legítimos que quedan son `lib/api-client.ts` y `context/auth-context.tsx` (logout), ambos nombrados en la regla del CLAUDE.md.
- Regla 2 (RN-safe): solo tap/pointer, nada de hover como única señal, animación solo `transform`/`opacity`.
- Regla 3: nada de `setState` síncrono en el cuerpo de un `useEffect`; nada de efectos colaterales dentro de los updaters de `setState`.
- Regla 11: cero emoji como iconografía. Iconos de sistema con `<Icon name>`, de economía con `<UiIcon name>`.
- Regla 12: `app/themes.generated.css` y `lib/theme-colors.ts` **se generan**; se editan a través de `design/themes.json` y `scripts/themes/render.mjs`, y se regeneran con `npm run themes:build`. `npm run lint` falla si quedan desfasados.
- Principio 4 del spec: **sin contenedores para el contenido**. La identidad del perfil y la fila de stats flotan sobre el fondo, sin `dots-card`. El panel teñido se reserva a cabeceras, que en el perfil no hay.
- Principio 5: Doty siempre es rosa; el tema vive en el chrome.
- Copy en español neutro con tuteo. Los nombres de paleta en la UI son exactamente "Rosa" y "Eléctrico", y la nota del bloque de tema es exactamente "Doty siempre es rosa, el resto cambia".
- Módulos puros bajo test (`lib/profile-view.ts`, `lib/sound-prefs.ts`): **solo `import type`**. Node los ejecuta sin bundler; un import de valor con alias `@/` no resolvería. Los tests son `*.test.mjs` junto al módulo e importan `./x.ts` con extensión. `npm run test:scripts` ya cubre `lib/*.test.mjs` y `scripts/themes/*.test.mjs` por glob: **no hay que tocar `package.json`**.

---

## Contexto medido del código actual (leído el 2026-09-15, no re-investigar)

Hechos verificados en los dos repos. Un implementador **no necesita volver a comprobarlos**.

**El perfil de hoy** (`app/(app)/(hub)/profile/page.tsx`, 258 líneas, todo en un archivo): tarjeta centrada con foto `profile_pic` o Doty de 96 px, chip MCER, chip de racha, barra de XP, cuatro `dots-card` de stats (XP total, Mejor racha, Lecturas, `❄️ Escudos`), tarjeta "🎨 Tu Doty" con gorros/fondos/gestos, `BadgesCard` plegable y una tarjeta de Ajustes con `ThemeToggle`, enlace a admin y cerrar sesión. Tiene tres emoji cableados en código (`❄️`, `🎨`, `🎭`) que D elimina.

**Estos cuatro componentes los usa SOLO el perfil**, así que D puede reemplazarlos sin tocar otras pantallas: `components/interactive-column/xp-level.tsx`, `components/interactive-column/streak/streak.tsx`, `components/interactive-column/badges.tsx` y `components/theme-toggle.tsx`. Verificado con grep sobre `app/` y `components/`.

**`components/interactive-column/streak/streak-top.tsx` está muerto**: la única mención en todo el repo es su propia línea de definición. D lo borra.

**Contratos de datos que D consume** (no los cambies):

```ts
// services/engagement.service.ts
export type MyStats = {
  xp: number; streak: number; level: number; xpForNextLevel: number;
  highScores: GameScore[]; readingsCompleted: number; streakFreezes: number;
  bestStreak: number; xpWeek: number;
  gems?: number;                    // puede faltar si la economía no se migró
  streakSecuredToday?: boolean;
};
export type Badge = { key: string; title: string; emoji: string; earned: boolean; progress: number; goal: number };
export async function getMyStatsService(): Promise<MyStats | null>;   // null si falla
export async function getMyBadgesService(): Promise<Badge[]>;          // [] si falla

// services/shop.service.ts
export type InventoryItem = { id: number; key: string; kind: string; name: string; slot: string | null; meta: Record<string, unknown> | null; equippedSlot: string | null };
export const getInventoryService: () => Promise<Inventory>;            // { items }
export const equipItemService: (id: number, equip: boolean) => Promise<Inventory>;

// services/settings.service.ts
export type SettingsPatch = { palette?: Palette; mode?: ThemeMode; sound?: boolean; onboarded?: boolean; tips_seen?: string[] };
export async function getMySettingsService(): Promise<UserSettings | null>;  // null si falla
export async function patchMySettingsService(patch: SettingsPatch): Promise<UserSettings>;  // PROPAGA el error

// lib/theme-prefs.ts
export type ThemeMode = "light" | "dark" | "auto";
export type ThemePrefs = { palette: Palette; mode: ThemeMode };
export const DEFAULT_PREFS: ThemePrefs;
export function normalizePrefs(prefs): ThemePrefs;
export function readMirror(): ThemePrefs;
export function hasMirror(): boolean;
export function writeMirror(prefs: ThemePrefs): void;
export function resolveMode(mode: ThemeMode): "light" | "dark";
export function applyThemePrefs(prefs: ThemePrefs): void;   // escribe data-palette, data-theme, clase dark, colorScheme y la meta theme-color

// lib/level-math.ts
export function levelProgress(xp, level, xpForNextLevel): { pct: number; … };
```

**El generador de temas** (`scripts/themes/render.mjs`) emite hoy `PALETTES`, `Palette`, `ThemeMode`, `PALETTE_LABELS` y `THEME_COLORS` (que es el `--background` de cada paleta y modo). **No emite el acento**, y la hoja de ajustes lo necesita para la muestra de color. Los acentos reales en `design/themes.json` son: rosa claro `#e5077e`, rosa oscuro `#ff3d9e`, eléctrico claro `#3768ff`, eléctrico oscuro `#5c86ff`.

**Por qué la muestra no puede hacerse solo con CSS:** los bloques generados usan selectores `:root[data-palette="…"]`, y `:root` solo casa con `<html>`. Un envoltorio con `data-palette` anidado no heredaría esos tokens. Por eso el acento tiene que viajar como dato.

**El modo resuelto se lee del DOM, nunca de `matchMedia` en el render** (regla 12): `document.documentElement.classList.contains("dark")`. `components/theme-toggle.tsx` lo hace con `useSyncExternalStore` y un `MutationObserver` sobre el atributo `class` del `<html>`; D reutiliza ese patrón exacto en la hoja, porque el servidor no sabe si el sistema operativo está en oscuro y cualquier otra lectura rompe la hidratación.

**`lib/feedback-sounds.ts` no tiene gate hoy**: `playSound(type)` construye un `Audio` y lo reproduce. Lo llaman ocho pantallas (`practice` y siete juegos) que **no cambian**: el gate va dentro de la función. `components/ui/sound/sound.tsx` y `hooks/use-lesson-audio.ts` reproducen **narración**, que es contenido a aprender y **no se silencia**.

**`ThemeSync`** (`components/theme/theme-sync.tsx`) hoy solo completa desde el servidor los dispositivos **sin espejo**, y su propio comentario dice que cuando D traiga la hoja el servidor puede volver a ser autoritativo. El spec §2.1 lo pide explícitamente.

**Backend, la deuda de A** (`dots-backend/src/modules/me/me.service.ts`): `getSettings` y `patchSettings` leen y escriben `users.settings` por SQL crudo y toleran el error 42703 de Postgres (columna inexistente) devolviendo defaults al leer y un 503 al escribir. La entidad `Users` (`src/modules/users/users.entity.ts`) **no declara** la columna. El helper `isUndefinedColumn` (línea 68) se usa **solo** en esos dos sitios: al pagar la deuda queda muerto y se retira con ellos. `src/common/user-settings.ts` tiene la lógica pura (`normalizeSettings`, `mergeSettings`, `DEFAULT_SETTINGS`) y **no se toca**.

**`components/ui/dialog/dialog.tsx` está muerto** (ningún consumidor) y tiene etiquetas en inglés y colores Tailwind cableados. **D no lo usa como base ni lo borra**: está fuera del alcance del spec. Queda anotado como deuda.

---

## Estructura de archivos

**Crear (dots-webapp)**
- `lib/profile-view.ts` + `lib/profile-view.test.mjs` — lógica pura del perfil.
- `lib/sound-prefs.ts` + `lib/sound-prefs.test.mjs` — espejo local de la preferencia de sonido.
- `components/profile/profile-identity.tsx` — Doty + nombre + chips + engranaje.
- `components/profile/profile-xp-bar.tsx` — "Nivel 4 · 620 / 900 XP" y la barra.
- `components/profile/profile-stats.tsx` — cuatro números sin cajas.
- `components/profile/badges-grid.tsx` — insignias en tile dorado de 58 px.
- `components/profile/gestures-card.tsx` — gestos equipables + enlace a la tienda.
- `components/profile/settings-sheet.tsx` — la hoja de ajustes.

**Modificar (dots-webapp)**
- `scripts/themes/render.mjs` — `renderThemeColors` emite además `PALETTE_ACCENTS`.
- `scripts/themes/render.test.mjs` — un test del bloque nuevo.
- `lib/theme-colors.ts` y `app/themes.generated.css` — **regenerados** con `npm run themes:build`, nunca a mano.
- `lib/feedback-sounds.ts` — gate de sonido.
- `components/theme/theme-sync.tsx` — el servidor pasa a ser autoritativo.
- `app/globals.css` — un keyframe para la entrada lateral de la hoja.
- `app/(app)/(hub)/profile/page.tsx` — reescritura completa.
- `app/layout.tsx` y `app/manifest.ts` — dos comentarios que citan `components/theme-toggle.tsx`, que deja de existir.
- `docs/ARQUITECTURA.md` y el spec — documentación.

**Borrar (dots-webapp)**
- `components/theme-toggle.tsx`
- `components/interactive-column/streak/streak-top.tsx`
- `components/interactive-column/streak/streak.tsx`
- `components/interactive-column/xp-level.tsx`
- `components/interactive-column/badges.tsx`

**Modificar (dots-backend)**
- `src/modules/users/users.entity.ts` — declarar `settings`.
- `src/modules/me/me.service.ts` — repositorio en vez de SQL crudo; fuera el 503 y `isUndefinedColumn`.

---

## Geometría y copy fijos (spec §5)

| Elemento | Valor |
|---|---|
| Avatar Doty | 78 px en móvil, 96 px en `md` |
| Nombre | Baloo (`font-display`), 24 px |
| Chips | MCER "B1 · Intermedio" y racha con llama |
| Barra de nivel | "Nivel 4 · 620 / 900 XP" |
| Stats | cuatro números sin cajas: XP total, mejor racha, insignias, gemas |
| Insignia | tile de 58 px, dorado suave; bloqueada en gris con "n / m" |
| Insignias en escritorio | seis por fila |
| Gestos | tres tarjetas, la equipada marcada, enlace a la tienda |
| Escritorio | dos columnas dentro de `max-w-5xl` |
| Nota del bloque de tema | "Doty siempre es rosa, el resto cambia" |
| Etiqueta de sonidos | "Sonidos" con subtítulo "Aciertos, fallos y celebraciones" |

**Bandas MCER**, exactamente las de hoy más su nombre en español: `A1 Principiante` (nivel ≤ 2), `A2 Básico` (≤ 4), `B1 Intermedio` (≤ 7), `B2 Intermedio alto` (≤ 10), `C1 Avanzado` (≤ 14), `C2 Experto` (resto).

---

## Tres desviaciones del spec, decididas y justificadas

Las tres se anotan en el spec en la Task 7. Un implementador **no debe "arreglarlas"** implementando lo que el texto literal del spec pide.

1. **La hoja de ajustes NO lleva la fila "Cambiar avatar", y el avatar del perfil NO lleva lápiz.** Los avatares son el subproyecto E, que según §8 depende de D. Un control que no hace nada es peor que ninguno. En D el avatar es Doty, como hoy.
2. **El perfil deja de mostrar gorros y fondos** y conserva solo los gestos, tal como §5 describe la sección. Su retirada con reembolso de gemas es §6.2, del subproyecto E. Mientras tanto un gorro comprado sigue en el inventario y deja de pintarse; eso elimina de paso dos emoji cableados.
3. **El emoji de cada insignia se queda.** Viene del backend (`Badge.emoji`), no está cableado en el código, y sustituirlo exige arte que §9 deja fuera de alcance.

---

### Task 1: Fundamentos puros — acento por paleta, lógica del perfil y gate de sonido (TDD)

**Files:**
- Modify: `scripts/themes/render.mjs` (función `renderThemeColors`)
- Modify: `scripts/themes/render.test.mjs` (un test nuevo)
- Regenerate: `lib/theme-colors.ts` (con `npm run themes:build`, nunca a mano)
- Create: `lib/profile-view.ts`, `lib/profile-view.test.mjs`
- Create: `lib/sound-prefs.ts`, `lib/sound-prefs.test.mjs`
- Modify: `lib/feedback-sounds.ts`

**Interfaces:**
- Consumes: `import type { MyStats, Badge } from "@/services/engagement.service"` y `import type { InventoryItem } from "@/services/shop.service"` (solo tipos).
- Produces (lo consumen las Tasks 2–5): de `lib/theme-colors.ts`, `PALETTE_ACCENTS: Record<Palette, Record<ThemeMode, string>>`; de `lib/profile-view.ts`, `cefrBand(level): { code: string; name: string }`, `badgeCounts(badges): { earned: number; total: number }`, `levelLine(stats): string`, `statRow(stats, badges): StatItem[]`, `type StatItem = { label: string; value: string }`, `equippedGesture(items): InventoryItem | null`, `gestureItems(items): InventoryItem[]`; de `lib/sound-prefs.ts`, `SOUND_KEY`, `normalizeSound(raw): boolean`, `readSoundEnabled(): boolean`, `writeSoundEnabled(on: boolean): void`.

- [ ] **Step 1: Escribir el test del acento por paleta**

En `scripts/themes/render.test.mjs`, añade al final:

```js
test("renderThemeColors emite el acento de cada paleta y modo", () => {
  // La muestra de color de la hoja de ajustes lo necesita como DATO: los
  // bloques generados usan selectores :root[data-palette], y :root solo casa
  // con <html>, así que un envoltorio anidado no heredaría el token.
  const ts = renderThemeColors(themes);
  assert.match(ts, /export const PALETTE_ACCENTS: Record<Palette, Record<ThemeMode, string>> = \{/);
  assert.match(ts, /rosa: \{ light: "#e5077e", dark: "#ff3d9e" \}/);
  assert.match(ts, /electrico: \{ light: "#3768ff", dark: "#5c86ff" \}/);
});
```

- [ ] **Step 2: Correr el test para verlo fallar**

```bash
source ~/.nvm/nvm.sh && nvm use && node --test scripts/themes/render.test.mjs
```

Esperado: FAIL en el test nuevo, el resto en verde.

- [ ] **Step 3: Emitir `PALETTE_ACCENTS` desde el generador**

En `scripts/themes/render.mjs`, dentro de `renderThemeColors`, añade una constante `accents` junto a la `rows` que ya existe:

```js
  const accents = ids.map((id) => `  ${id}: { light: "${themes.palettes[id].light["--accent"]}", dark: "${themes.palettes[id].dark["--accent"]}" },`).join("\n");
```

y añade al final de la plantilla que devuelve la función, justo después del bloque `THEME_COLORS`:

```js
// El --accent de cada paleta y modo. Lo necesita la muestra de color de la hoja
// de ajustes (subproyecto D): los bloques CSS generados usan :root[data-palette],
// que solo casa con <html>, así que el color tiene que viajar como dato.
export const PALETTE_ACCENTS: Record<Palette, Record<ThemeMode, string>> = {
${accents}
};
```

- [ ] **Step 4: Regenerar y verificar**

```bash
source ~/.nvm/nvm.sh && nvm use && npm run themes:build && node --test scripts/themes/render.test.mjs
```

Esperado: escribe `lib/theme-colors.ts` y todos los tests pasan. **No edites `lib/theme-colors.ts` a mano**: si el contenido no te cuadra, arregla el generador y vuelve a correr.

- [ ] **Step 5: Escribir los tests de `lib/profile-view.test.mjs`**

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  badgeCounts,
  cefrBand,
  equippedGesture,
  gestureItems,
  levelLine,
  statRow,
} from "./profile-view.ts";

const stats = (over = {}) => ({
  xp: 620, streak: 3, level: 4, xpForNextLevel: 900, highScores: [],
  readingsCompleted: 2, streakFreezes: 1, bestStreak: 9, xpWeek: 140, ...over,
});
const badge = (over = {}) => ({
  key: "b1", title: "Primera lección", emoji: "🌟", earned: true, progress: 1, goal: 1, ...over,
});
const item = (over = {}) => ({
  id: 1, key: "g1", kind: "cosmetic", name: "Saludo", slot: "gesture",
  meta: { animation: "wave" }, equippedSlot: null, ...over,
});

test("cefrBand devuelve código y nombre en español por nivel", () => {
  assert.deepEqual(cefrBand(1), { code: "A1", name: "Principiante" });
  assert.deepEqual(cefrBand(4), { code: "A2", name: "Básico" });
  assert.deepEqual(cefrBand(7), { code: "B1", name: "Intermedio" });
  assert.deepEqual(cefrBand(10), { code: "B2", name: "Intermedio alto" });
  assert.deepEqual(cefrBand(14), { code: "C1", name: "Avanzado" });
  assert.deepEqual(cefrBand(15), { code: "C2", name: "Experto" });
});

test("cefrBand no se rompe con un nivel absurdo", () => {
  assert.deepEqual(cefrBand(0), { code: "A1", name: "Principiante" });
  assert.deepEqual(cefrBand(999), { code: "C2", name: "Experto" });
});

test("badgeCounts cuenta ganadas sobre total", () => {
  const list = [badge({ earned: true }), badge({ key: "b2", earned: false }), badge({ key: "b3", earned: true })];
  assert.deepEqual(badgeCounts(list), { earned: 2, total: 3 });
});

test("badgeCounts con lista vacía no divide por cero", () => {
  assert.deepEqual(badgeCounts([]), { earned: 0, total: 0 });
});

test("levelLine arma la línea de nivel del spec", () => {
  assert.equal(levelLine(stats()), "Nivel 4 · 620 / 900 XP");
});

test("levelLine sin stats da una línea neutra, no 'undefined'", () => {
  assert.equal(levelLine(null), "Nivel 1 · 0 / 0 XP");
});

test("statRow da los cuatro números del spec en orden", () => {
  const row = statRow(stats({ gems: 14 }), [badge({ earned: true }), badge({ key: "b2", earned: false })]);
  assert.deepEqual(row, [
    { label: "XP total", value: "620" },
    { label: "Mejor racha", value: "9" },
    { label: "Insignias", value: "1/2" },
    { label: "Gemas", value: "14" },
  ]);
});

test("statRow tolera gemas ausentes: el backend puede no haber migrado la economía", () => {
  const row = statRow(stats(), []);
  assert.equal(row[3].value, "0");
  assert.equal(row[2].value, "0/0");
});

test("statRow sin stats devuelve ceros y no revienta", () => {
  const row = statRow(null, []);
  assert.deepEqual(row.map((s) => s.value), ["0", "0", "0/0", "0"]);
});

test("gestureItems se queda solo con los del slot gesture", () => {
  const items = [item(), item({ id: 2, slot: "hat" }), item({ id: 3, slot: null }), item({ id: 4 })];
  assert.deepEqual(gestureItems(items).map((i) => i.id), [1, 4]);
});

test("equippedGesture encuentra el gesto puesto y devuelve null si no hay", () => {
  const items = [item(), item({ id: 2, equippedSlot: "gesture" })];
  assert.equal(equippedGesture(items)?.id, 2);
  assert.equal(equippedGesture([item()]), null);
});

test("equippedGesture ignora un equipado de otro slot", () => {
  // Un gorro equipado no debe animar a Doty.
  assert.equal(equippedGesture([item({ slot: "hat", equippedSlot: "hat" })]), null);
});
```

- [ ] **Step 6: Correr los tests para verlos fallar**

```bash
source ~/.nvm/nvm.sh && nvm use && node --test lib/profile-view.test.mjs
```

Esperado: FAIL con `Cannot find module …/lib/profile-view.ts`.

- [ ] **Step 7: Escribir `lib/profile-view.ts`**

```ts
import type { Badge, MyStats } from "@/services/engagement.service";
import type { InventoryItem } from "@/services/shop.service";

/**
 * Lógica pura del perfil (spec §5). Vive fuera de los componentes para poder
 * probarse con `node --test`: por eso SOLO admite `import type` (Node ejecuta
 * este archivo sin bundler y no resolvería el alias `@/`).
 */

/** Banda MCER estimada por nivel de XP. Los umbrales son los que ya usaba el perfil. */
export function cefrBand(level: number): { code: string; name: string } {
  if (level <= 2) return { code: "A1", name: "Principiante" };
  if (level <= 4) return { code: "A2", name: "Básico" };
  if (level <= 7) return { code: "B1", name: "Intermedio" };
  if (level <= 10) return { code: "B2", name: "Intermedio alto" };
  if (level <= 14) return { code: "C1", name: "Avanzado" };
  return { code: "C2", name: "Experto" };
}

export function badgeCounts(badges: Badge[]): { earned: number; total: number } {
  return { earned: badges.filter((b) => b.earned).length, total: badges.length };
}

/** "Nivel 4 · 620 / 900 XP" (spec §5). Con stats ausentes da una línea neutra. */
export function levelLine(stats: MyStats | null): string {
  const level = stats?.level ?? 1;
  const xp = stats?.xp ?? 0;
  const next = stats?.xpForNextLevel ?? 0;
  return `Nivel ${level} · ${xp} / ${next} XP`;
}

export interface StatItem {
  label: string;
  value: string;
}

/**
 * Los cuatro números del spec §5, en orden. `gems` es opcional en el contrato
 * del backend (puede faltar si la economía no se migró) y las insignias llegan
 * de otro endpoint, así que ambos caen a cero en vez de pintar "undefined".
 */
export function statRow(stats: MyStats | null, badges: Badge[]): StatItem[] {
  const { earned, total } = badgeCounts(badges);
  return [
    { label: "XP total", value: String(stats?.xp ?? 0) },
    { label: "Mejor racha", value: String(stats?.bestStreak ?? 0) },
    { label: "Insignias", value: `${earned}/${total}` },
    { label: "Gemas", value: String(stats?.gems ?? 0) },
  ];
}

/** Gestos del inventario. Gorros y fondos dejan de pintarse en D (spec §5). */
export function gestureItems(items: InventoryItem[]): InventoryItem[] {
  return items.filter((i) => i.slot === "gesture");
}

/** El gesto puesto, o null. Un equipado de otro slot no cuenta. */
export function equippedGesture(items: InventoryItem[]): InventoryItem | null {
  return items.find((i) => i.slot === "gesture" && i.equippedSlot === "gesture") ?? null;
}
```

- [ ] **Step 8: Correr los tests para verlos pasar**

```bash
source ~/.nvm/nvm.sh && nvm use && node --test lib/profile-view.test.mjs
```

Esperado: PASS, 11 tests.

- [ ] **Step 9: Escribir los tests de `lib/sound-prefs.test.mjs`**

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { SOUND_KEY, normalizeSound } from "./sound-prefs.ts";

test("la clave del espejo sigue la convención de las de tema", () => {
  assert.equal(SOUND_KEY, "dots-sound");
});

test("normalizeSound reconoce los dos valores que escribimos", () => {
  assert.equal(normalizeSound("on"), true);
  assert.equal(normalizeSound("off"), false);
});

test("normalizeSound da true por defecto: quien nunca lo tocó oye los sonidos", () => {
  assert.equal(normalizeSound(null), true);
  assert.equal(normalizeSound(""), true);
  assert.equal(normalizeSound("basura"), true);
});
```

- [ ] **Step 10: Correr los tests para verlos fallar**

```bash
source ~/.nvm/nvm.sh && nvm use && node --test lib/sound-prefs.test.mjs
```

Esperado: FAIL con `Cannot find module …/lib/sound-prefs.ts`.

- [ ] **Step 11: Escribir `lib/sound-prefs.ts`**

```ts
/**
 * Espejo local de la preferencia de sonido, hermano del de tema
 * (lib/theme-prefs.ts). El servidor es la fuente de verdad (users.settings.sound,
 * spec §2.4), pero `playSound` se llama desde manejadores de evento sin acceso a
 * React ni tiempo para un fetch, así que consulta este espejo.
 *
 * `normalizeSound` es la parte pura y está bajo test; la lectura y escritura
 * tocan localStorage y tragan cualquier error (modo privado, storage lleno).
 * Solo `import type` en este archivo: `node --test` lo ejecuta sin bundler.
 */
export const SOUND_KEY = "dots-sound";

/** Cualquier cosa que no sea exactamente "off" significa sonido encendido. */
export function normalizeSound(raw: string | null | undefined): boolean {
  return raw !== "off";
}

export function readSoundEnabled(): boolean {
  if (typeof window === "undefined") return true;
  try {
    return normalizeSound(window.localStorage.getItem(SOUND_KEY));
  } catch {
    return true;
  }
}

export function writeSoundEnabled(on: boolean): void {
  try {
    window.localStorage.setItem(SOUND_KEY, on ? "on" : "off");
  } catch {
    /* modo privado o storage lleno: el servidor sigue teniendo la verdad */
  }
}
```

- [ ] **Step 12: Correr los tests para verlos pasar**

```bash
source ~/.nvm/nvm.sh && nvm use && node --test lib/sound-prefs.test.mjs
```

Esperado: PASS, 3 tests.

- [ ] **Step 13: Poner el gate en `lib/feedback-sounds.ts`**

Sustituye el contenido completo del archivo por:

```ts
import { readSoundEnabled } from "./sound-prefs";

/**
 * Sonidos de respuesta compartidos (assets en /public/sounds/answers).
 *
 * El gate vive aquí y no en las ocho pantallas que llaman a esta función
 * (práctica y siete juegos): así apagar los sonidos desde la hoja de ajustes
 * los apaga todos sin tocar ninguna. La NARRACIÓN no pasa por aquí y nunca se
 * silencia: es el contenido a aprender (components/ui/sound/sound.tsx y
 * hooks/use-lesson-audio.ts).
 */
export function playSound(type: "correct" | "wrong") {
  if (!readSoundEnabled()) return;
  const src =
    type === "correct"
      ? "/sounds/answers/correct.wav"
      : "/sounds/answers/wrong.wav";
  new Audio(src).play().catch(() => {});
}
```

- [ ] **Step 14: Verificar tipos, lint y la suite completa**

```bash
source ~/.nvm/nvm.sh && nvm use && npx tsc --noEmit && npx eslint lib/profile-view.ts lib/sound-prefs.ts lib/feedback-sounds.ts scripts/themes/render.mjs && npm run test:scripts
```

Esperado: sin errores y todos los tests en verde. Anota en el informe cuántos tests quedan en total.

- [ ] **Step 15: Commit**

```bash
git add scripts/themes/render.mjs scripts/themes/render.test.mjs lib/theme-colors.ts lib/profile-view.ts lib/profile-view.test.mjs lib/sound-prefs.ts lib/sound-prefs.test.mjs lib/feedback-sounds.ts
git commit -m "feat(perfil): lógica pura, espejo de sonido con gate y acento por paleta en el generador de temas

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 2: Identidad, barra de nivel y fila de stats

**Files:**
- Modify: `components/ui/doty/doty.tsx` (un tamaño nuevo)
- Create: `components/profile/profile-identity.tsx`
- Create: `components/profile/profile-xp-bar.tsx`
- Create: `components/profile/profile-stats.tsx`

**Interfaces:**
- Consumes de Task 1: `cefrBand(level)`, `levelLine(stats)`, `statRow(stats, badges)`, `type StatItem`.
- Produces (lo consume Task 5): `ProfileIdentity` (default export) con props `{ name: string; stats: MyStats | null; gestureAnimation?: DotyAnimation; onOpenSettings: () => void }`; `ProfileXpBar` (default export) con props `{ stats: MyStats | null }`; `ProfileStats` (default export) con props `{ stats: MyStats | null; badges: Badge[] }`.

- [ ] **Step 1: Añadir el tamaño `perfil` a `components/ui/doty/doty.tsx`**

El avatar mide 78 px en móvil y 96 en escritorio. Eso NO se consigue con
`customClass`: chocaría con el `w-24` que el propio componente pone, y entre dos
utilidades de `width` con la misma especificidad gana la que Tailwind emita
última, no la que escribas después. El registro de tamaños ya admite una clase
responsive, así que el par vive ahí. Haz tres cambios:

1. En el tipo `DotySize`, añade `"perfil"` a la unión.
2. En `SIZE_PX`, añade `perfil: 96` — es el ancho mayor al que se renderiza, y de
   ahí sale el `sizes` que evita que `next/image` sirva 1024 px.
3. En `sizeClass`, añade `perfil: "w-[78px] md:w-24"` con un comentario de una
   línea que diga que es el avatar del perfil (spec §5: 78 en móvil, 96 en `md`).

- [ ] **Step 2: Crear `components/profile/profile-identity.tsx`**

```tsx
"use client";

import Doty, { type DotyAnimation } from "@/components/ui/doty/doty";
import { Icon } from "@/components/ui/icon";
import { UiIcon } from "@/components/ui/ui-icon";
import { cefrBand } from "@/lib/profile-view";
import type { MyStats } from "@/services/engagement.service";

/**
 * Identidad del perfil (spec §5, variante A "identidad abierta"): Doty, nombre,
 * chips y engranaje, en horizontal y SIN tarjeta — el principio 4 del spec
 * reserva los contenedores para las cabeceras.
 *
 * El avatar es Doty y no lleva lápiz: los avatares llegan con el subproyecto E,
 * y un control que no hace nada es peor que ninguno.
 */
interface Props {
  name: string;
  stats: MyStats | null;
  /** Animación del gesto equipado, si el usuario tiene uno puesto. */
  gestureAnimation?: DotyAnimation;
  onOpenSettings: () => void;
}

export default function ProfileIdentity({ name, stats, gestureAnimation, onOpenSettings }: Props) {
  const band = cefrBand(stats?.level ?? 1);
  const streak = stats?.streak ?? 0;

  return (
    <header className="flex items-center gap-4">
      {/* 78 px en móvil y 96 en escritorio: el par vive en el registro de tamaños. */}
      <div className="shrink-0">
        <Doty pose="feliz" size="perfil" animation={gestureAnimation ?? "bob"} />
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <h1 className="truncate font-display text-2xl font-extrabold text-foreground">{name}</h1>
        <div className="flex flex-wrap items-center gap-1.5">
          <span
            className="rounded-full px-2.5 py-0.5 text-[11px] font-black"
            style={{
              background: "color-mix(in srgb, var(--primary) 14%, transparent)",
              border: "1.5px solid color-mix(in srgb, var(--primary) 35%, transparent)",
              color: "var(--primary)",
            }}
            title="Nivel de inglés estimado (MCER)"
          >
            {band.code} · {band.name}
          </span>
          <span
            className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-black tabular-nums"
            style={{
              background: "color-mix(in srgb, var(--flame) 14%, transparent)",
              border: "1.5px solid color-mix(in srgb, var(--flame) 38%, transparent)",
              color: "var(--flame-edge)",
            }}
            title="Racha diaria"
          >
            <UiIcon name="racha" size={14} />
            {streak}
          </span>
        </div>
      </div>

      <button
        type="button"
        onClick={onOpenSettings}
        aria-label="Abrir ajustes"
        className="shrink-0 rounded-full p-2 text-(--muted) transition-transform duration-150 active:scale-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--accent)"
      >
        <Icon name="ajustes" size={24} mono />
      </button>
    </header>
  );
}
```

- [ ] **Step 3: Crear `components/profile/profile-xp-bar.tsx`**

```tsx
"use client";

import { levelLine } from "@/lib/profile-view";
import { levelProgress } from "@/lib/level-math";
import type { MyStats } from "@/services/engagement.service";

/** Barra de nivel del perfil (spec §5): "Nivel 4 · 620 / 900 XP" y la barra. */
export default function ProfileXpBar({ stats }: { stats: MyStats | null }) {
  const { pct } = levelProgress(stats?.xp ?? 0, stats?.level ?? 1, stats?.xpForNextLevel ?? 0);
  return (
    <div className="flex w-full flex-col gap-1.5">
      <span className="text-xs font-extrabold tabular-nums text-(--muted)">{levelLine(stats)}</span>
      <div
        className="h-2.5 w-full overflow-hidden rounded-full"
        role="progressbar"
        aria-label="Progreso de nivel"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        style={{ background: "var(--border)" }}
      >
        <div
          className="h-full rounded-full transition-[width] duration-700 ease-out"
          style={{ width: `${pct}%`, background: "linear-gradient(90deg, var(--primary), var(--accent))" }}
        />
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Crear `components/profile/profile-stats.tsx`**

```tsx
"use client";

import { statRow } from "@/lib/profile-view";
import type { Badge, MyStats } from "@/services/engagement.service";

/**
 * Los cuatro números del perfil (spec §5): fila sin cajas. El emoji ❄️ del
 * contador de escudos que había aquí se fue con ellos: los escudos ya no son
 * uno de los cuatro, y un emoji no es un icono (regla 11).
 */
export default function ProfileStats({ stats, badges }: { stats: MyStats | null; badges: Badge[] }) {
  return (
    <dl className="grid grid-cols-4 gap-2">
      {statRow(stats, badges).map((s) => (
        <div key={s.label} className="flex flex-col items-center gap-0.5 text-center">
          <dd className="font-display text-xl font-extrabold tabular-nums text-foreground">{s.value}</dd>
          <dt className="text-[10px] font-bold uppercase tracking-wide text-(--muted)">{s.label}</dt>
        </div>
      ))}
    </dl>
  );
}
```

- [ ] **Step 5: Verificar tipos y lint**

```bash
source ~/.nvm/nvm.sh && nvm use && npx tsc --noEmit && npx eslint components/ui/doty/doty.tsx components/profile/profile-identity.tsx components/profile/profile-xp-bar.tsx components/profile/profile-stats.tsx && npm run lint
```

Esperado: sin errores. `npm run lint` incluye `check-doty-assets --strict`, que valida el registro de poses: añadir un TAMAÑO no lo afecta, pero conviene confirmarlo. Los tres componentes no los usa nadie todavía: es correcto en esta tarea.

- [ ] **Step 6: Commit**

```bash
git add components/ui/doty/doty.tsx components/profile/profile-identity.tsx components/profile/profile-xp-bar.tsx components/profile/profile-stats.tsx
git commit -m "feat(perfil): identidad horizontal, barra de nivel y fila de cuatro números sin cajas

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 3: Insignias y gestos

**Files:**
- Create: `components/profile/badges-grid.tsx`
- Create: `components/profile/gestures-card.tsx`

**Interfaces:**
- Consumes de Task 1: `gestureItems(items)`, `equippedGesture(items)`.
- Produces (lo consume Task 5): `BadgesGrid` (default export) con props `{ badges: Badge[] }`; `GesturesCard` (default export) con props `{ items: InventoryItem[]; onToggle: (item: InventoryItem) => void }`.

- [ ] **Step 1: Crear `components/profile/badges-grid.tsx`**

```tsx
"use client";

import type { Badge } from "@/services/engagement.service";

/**
 * Insignias del perfil (spec §5): tile dorado suave de 58 px, bloqueadas en
 * gris con "n / m". Siempre abiertas — el desplegable anterior escondía el
 * único sitio donde se ven los logros.
 *
 * El emoji de cada insignia viene del backend (Badge.emoji) y no está cableado
 * aquí; sustituirlo por iconografía propia exige arte que el spec §9 deja
 * fuera de alcance.
 */
export const BADGE_TILE = 58;

export default function BadgesGrid({ badges }: { badges: Badge[] }) {
  if (badges.length === 0) return null;
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-xs font-bold uppercase tracking-widest text-(--muted)">Insignias</h2>
      <ul className="grid grid-cols-4 gap-2 sm:grid-cols-5 md:grid-cols-6">
        {badges.map((b) => (
          <li key={b.key}>
            <div
              title={b.earned ? b.title : `${b.title} — ${b.progress}/${b.goal}`}
              className="flex flex-col items-center justify-center gap-0.5 rounded-2xl px-1"
              style={{
                height: BADGE_TILE,
                background: b.earned
                  ? "color-mix(in srgb, var(--gold) 14%, transparent)"
                  : "var(--surface-2)",
              }}
            >
              <span
                className="text-xl leading-none"
                // filter estático, no animado: RN-safe (regla 2).
                style={b.earned ? undefined : { filter: "grayscale(1)", opacity: 0.4 }}
              >
                {b.emoji}
              </span>
              {!b.earned && (
                <span className="text-[9px] font-bold tabular-nums text-(--muted)">
                  {b.progress}/{b.goal}
                </span>
              )}
            </div>
            <p
              className="line-clamp-2 pt-1 text-center text-[10px] font-extrabold leading-tight"
              style={{ color: b.earned ? "var(--foreground)" : "var(--muted)" }}
            >
              {b.title}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}
```

- [ ] **Step 2: Crear `components/profile/gestures-card.tsx`**

```tsx
"use client";

import Link from "next/link";

import Doty, { type DotyAnimation } from "@/components/ui/doty/doty";
import { Icon } from "@/components/ui/icon";
import { gestureItems } from "@/lib/profile-view";
import type { InventoryItem } from "@/services/shop.service";

/**
 * "Gesto de tu Doty" (spec §5): tarjetas con el equipado marcado y enlace a la
 * tienda. Gorros y fondos dejan de pintarse en D: eran emoji sobre Doty y se
 * retiran con reembolso en el subproyecto E (spec §6.2).
 */
interface Props {
  items: InventoryItem[];
  onToggle: (item: InventoryItem) => void;
}

export default function GesturesCard({ items, onToggle }: Props) {
  const gestures = gestureItems(items);

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-xs font-bold uppercase tracking-widest text-(--muted)">Gesto de tu Doty</h2>
        <Link href="/shop" className="text-xs font-extrabold text-(--accent)">
          Ir a la tienda
        </Link>
      </div>

      {gestures.length === 0 ? (
        <p className="text-sm font-semibold text-(--muted)">
          Todavía no tienes gestos. Cámbiale el movimiento a Doty con tus gemas.
        </p>
      ) : (
        <ul className="grid grid-cols-3 gap-2">
          {gestures.map((item) => {
            const on = item.equippedSlot === "gesture";
            return (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => onToggle(item)}
                  aria-pressed={on}
                  className="flex w-full flex-col items-center gap-1 rounded-2xl px-2 py-3 transition-transform duration-150 active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--accent)"
                  style={{
                    background: on ? "color-mix(in srgb, var(--accent) 12%, transparent)" : "var(--surface-2)",
                    border: on ? "2px solid var(--accent)" : "2px solid transparent",
                  }}
                >
                  <Doty
                    pose="feliz"
                    size="micro"
                    animation={(item.meta?.animation as DotyAnimation | undefined) ?? "none"}
                  />
                  <span
                    className="line-clamp-1 text-[11px] font-extrabold"
                    style={{ color: on ? "var(--accent)" : "var(--foreground)" }}
                  >
                    {item.name}
                  </span>
                  <span className="h-4" style={{ color: "var(--accent)" }}>
                    {on && <Icon name="check" size={14} mono />}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
```

- [ ] **Step 3: Verificar tipos y lint**

```bash
source ~/.nvm/nvm.sh && nvm use && npx tsc --noEmit && npx eslint components/profile/badges-grid.tsx components/profile/gestures-card.tsx
```

Esperado: sin errores.

- [ ] **Step 4: Commit**

```bash
git add components/profile/badges-grid.tsx components/profile/gestures-card.tsx
git commit -m "feat(perfil): insignias en tile dorado siempre visibles y tarjetas de gesto de Doty

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 4: Hoja de ajustes

**Files:**
- Create: `components/profile/settings-sheet.tsx`
- Modify: `app/globals.css` (un keyframe nuevo, junto a `dots-slide-up`)

**Interfaces:**
- Consumes de Task 1: `readSoundEnabled()`, `writeSoundEnabled(on)`, y de `lib/theme-colors.ts` el `PALETTE_ACCENTS` que la Task 1 hizo emitir al generador.
- Produces (lo consume Task 5): `SettingsSheet` (default export) con props `{ open: boolean; onClose: () => void; isAdmin: boolean; onLogout: () => void }`.

- [ ] **Step 1: Añadir el keyframe de entrada lateral a `app/globals.css`**

Busca `@keyframes dots-slide-up` y añade justo debajo:

```css
/* Entrada de la hoja lateral de ajustes en escritorio (spec §5). Solo
   transform y opacity: RN-safe (regla 2). En móvil la hoja usa
   dots-slide-up, que ya existe. */
@keyframes dots-slide-right {
  0%   { transform: translateX(100%); opacity: 0; }
  100% { transform: none; opacity: 1; }
}
```

- [ ] **Step 2: Crear `components/profile/settings-sheet.tsx`**

```tsx
"use client";

import { useEffect, useSyncExternalStore } from "react";
import Link from "next/link";

import { Icon } from "@/components/ui/icon";
import { PALETTE_ACCENTS, PALETTES, PALETTE_LABELS, type Palette } from "@/lib/theme-colors";
import { readSoundEnabled, writeSoundEnabled } from "@/lib/sound-prefs";
import {
  applyThemePrefs,
  normalizePrefs,
  readMirror,
  writeMirror,
  type ThemeMode,
} from "@/lib/theme-prefs";
import { patchMySettingsService } from "@/services/settings.service";

/**
 * Hoja de ajustes del perfil (spec §5): inferior en móvil, lateral en
 * escritorio. Cada control escribe el espejo local, aplica el cambio al DOM y
 * manda un PATCH /me/settings en segundo plano.
 *
 * NO lleva fila "Cambiar avatar": los avatares son el subproyecto E, que según
 * el spec §8 depende de este. Un control que no hace nada es peor que ninguno.
 *
 * El estado visible sale del DOM y de localStorage con `useSyncExternalStore`,
 * el mismo patrón que usaba el toggle que esta hoja reemplaza: el servidor no
 * sabe si el sistema operativo está en oscuro, así que leerlo en el render
 * rompería la hidratación (regla 12).
 */

const MODE_LABELS: { value: ThemeMode; label: string }[] = [
  { value: "light", label: "Claro" },
  { value: "dark", label: "Oscuro" },
  { value: "auto", label: "Auto" },
];

/**
 * El DOM es la fuente de verdad de paleta, modo y sonido: la fija el script
 * anti-parpadeo antes del primer paint y la cambian los controles de esta hoja.
 * `data-sound` está en el filtro a propósito: el espejo de sonido no dispara
 * ningún evento en la misma pestaña, así que el atributo es lo que avisa.
 */
function subscribeDom(onChange: () => void): () => void {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["class", "data-palette", "data-theme", "data-sound"],
  });
  return () => observer.disconnect();
}
const domSnapshot = (): string => {
  const root = document.documentElement;
  const resolved = root.classList.contains("dark") ? "dark" : "light";
  return `${root.dataset.palette ?? "rosa"}|${root.dataset.theme ?? "auto"}|${resolved}|${readSoundEnabled() ? "on" : "off"}`;
};
const domServerSnapshot = (): string => "rosa|auto|light|on";

function Row({ title, subtitle, children }: { title: string; subtitle?: string; children?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 py-3">
      <span className="flex min-w-0 flex-col">
        <span className="text-sm font-extrabold text-foreground">{title}</span>
        {subtitle && <span className="text-xs font-semibold text-(--muted)">{subtitle}</span>}
      </span>
      {children}
    </div>
  );
}

interface Props {
  open: boolean;
  onClose: () => void;
  isAdmin: boolean;
  onLogout: () => void;
}

export default function SettingsSheet({ open, onClose, isAdmin, onLogout }: Props) {
  const dom = useSyncExternalStore(subscribeDom, domSnapshot, domServerSnapshot);
  const [palette, mode, resolved, soundFlag] = dom.split("|") as [
    Palette,
    ThemeMode,
    "light" | "dark",
    string,
  ];
  const sound = soundFlag !== "off";

  // Cerrar con Escape y bloquear el scroll del fondo mientras la hoja está abierta.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [open, onClose]);

  if (!open) return null;

  /** Escribe espejo + DOM + servidor. El PATCH falla en silencio: el espejo conserva la elección. */
  const setTheme = (next: { palette?: Palette; mode?: ThemeMode }) => {
    const prefs = normalizePrefs({ ...readMirror(), ...next });
    writeMirror(prefs);
    applyThemePrefs(prefs);
    void patchMySettingsService(next).catch(() => {});
  };

  const setSound = (on: boolean) => {
    writeSoundEnabled(on);
    // Toca un atributo del <html> para que el useSyncExternalStore de arriba
    // se entere: el espejo de sonido no tiene evento propio en la misma pestaña.
    document.documentElement.dataset.sound = on ? "on" : "off";
    void patchMySettingsService({ sound: on }).catch(() => {});
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center md:items-stretch md:justify-end">
      <div
        aria-hidden
        onClick={onClose}
        className="absolute inset-0"
        style={{ background: "var(--scrim)" }}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label="Ajustes"
        className="relative z-10 flex max-h-[85vh] w-full flex-col overflow-y-auto rounded-t-3xl bg-(--surface) px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-4 [animation:dots-slide-up_.25s_ease-out_both] md:max-h-none md:w-[380px] md:rounded-none md:rounded-l-3xl md:pb-5 md:[animation:dots-slide-right_.25s_ease-out_both]"
      >
        <div className="flex items-center justify-between gap-2 pb-2">
          <h2 className="font-display text-xl font-extrabold text-foreground">Ajustes</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar ajustes"
            className="rounded-full p-2 text-(--muted) transition-transform duration-150 active:scale-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--accent)"
          >
            <Icon name="cruz" size={20} mono />
          </button>
        </div>

        {/* Tema */}
        <section className="flex flex-col gap-2 border-t border-(--border) pt-3">
          <span className="text-xs font-bold uppercase tracking-widest text-(--muted)">Tema</span>
          <div className="grid grid-cols-2 gap-2">
            {PALETTES.map((p) => {
              const on = p === palette;
              return (
                <button
                  key={p}
                  type="button"
                  onClick={() => setTheme({ palette: p })}
                  aria-pressed={on}
                  className="flex items-center gap-2 rounded-2xl px-3 py-2.5 transition-transform duration-150 active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--accent)"
                  style={{
                    background: on ? "color-mix(in srgb, var(--accent) 12%, transparent)" : "var(--surface-2)",
                    border: on ? "2px solid var(--accent)" : "2px solid transparent",
                  }}
                >
                  <span
                    aria-hidden
                    className="h-5 w-5 shrink-0 rounded-full"
                    style={{ background: PALETTE_ACCENTS[p][resolved] }}
                  />
                  <span className="text-sm font-extrabold text-foreground">{PALETTE_LABELS[p]}</span>
                </button>
              );
            })}
          </div>
          <p className="text-xs font-semibold text-(--muted)">Doty siempre es rosa, el resto cambia</p>
        </section>

        {/* Modo */}
        <section className="flex flex-col gap-2 border-t border-(--border) pt-3">
          <span className="text-xs font-bold uppercase tracking-widest text-(--muted)">Modo</span>
          <div className="grid grid-cols-3 gap-2">
            {MODE_LABELS.map((m) => {
              const on = m.value === mode;
              return (
                <button
                  key={m.value}
                  type="button"
                  onClick={() => setTheme({ mode: m.value })}
                  aria-pressed={on}
                  className="rounded-2xl px-2 py-2 text-sm font-extrabold transition-transform duration-150 active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--accent)"
                  style={{
                    background: on ? "color-mix(in srgb, var(--accent) 12%, transparent)" : "var(--surface-2)",
                    border: on ? "2px solid var(--accent)" : "2px solid transparent",
                    color: on ? "var(--accent)" : "var(--foreground)",
                  }}
                >
                  {m.label}
                </button>
              );
            })}
          </div>
        </section>

        {/* Sonidos */}
        <section className="border-t border-(--border)">
          <Row title="Sonidos" subtitle="Aciertos, fallos y celebraciones">
            <button
              type="button"
              role="switch"
              aria-checked={sound}
              aria-label="Sonidos"
              onClick={() => setSound(!sound)}
              className="relative h-7 w-12 shrink-0 rounded-full transition-transform duration-150 active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--accent)"
              style={{ background: sound ? "var(--accent)" : "var(--border)" }}
            >
              <span
                aria-hidden
                className="absolute top-1 left-1 h-5 w-5 rounded-full bg-white transition-transform duration-200"
                style={{ transform: sound ? "translateX(20px)" : "none" }}
              />
            </button>
          </Row>
        </section>

        {/* Acciones */}
        <section className="flex flex-col gap-2 border-t border-(--border) pt-3">
          {isAdmin && (
            <Link
              href="/admin"
              onClick={onClose}
              className="flex items-center justify-between rounded-2xl bg-(--surface-2) px-4 py-3 text-sm font-extrabold text-foreground"
            >
              Panel de admin
              <Icon name="derecha" size={16} mono />
            </Link>
          )}
          <button
            type="button"
            onClick={onLogout}
            className="rounded-2xl px-4 py-3 text-sm font-extrabold transition-transform duration-150 active:scale-95"
            style={{ background: "color-mix(in srgb, var(--danger) 12%, transparent)", color: "var(--danger)" }}
          >
            Cerrar sesión
          </button>
        </section>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Comprobar que los iconos que usa la hoja existen**

```bash
grep -oE "^  [a-z-]+:" components/ui/icon/paths.tsx | tr -d ' :' | tr '\n' ' '
```

Esperado: la lista incluye `ajustes`, `cruz`, `check` y `derecha`. Si alguno faltara, **no lo dibujes**: informa el bloqueo.

- [ ] **Step 4: Verificar tipos y lint**

```bash
source ~/.nvm/nvm.sh && nvm use && npx tsc --noEmit && npx eslint components/profile/settings-sheet.tsx
```

Esperado: sin errores.

- [ ] **Step 5: Commit**

```bash
git add app/globals.css components/profile/settings-sheet.tsx
git commit -m "feat(perfil): hoja de ajustes con tema, modo y sonidos escribiendo en el servidor

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 5: Página nueva, ThemeSync autoritativo y retirada de lo viejo

**Files:**
- Modify: `app/(app)/(hub)/profile/page.tsx` (reescritura completa)
- Modify: `components/theme/theme-sync.tsx`
- Modify: `app/layout.tsx` y `app/manifest.ts` (dos comentarios que citan un archivo que deja de existir)
- Delete: `components/theme-toggle.tsx`, `components/interactive-column/streak/streak-top.tsx`, `components/interactive-column/streak/streak.tsx`, `components/interactive-column/xp-level.tsx`, `components/interactive-column/badges.tsx`

**Interfaces:**
- Consumes de Task 1: `equippedGesture(items)`. De Task 2: `ProfileIdentity`, `ProfileXpBar`, `ProfileStats`. De Task 3: `BadgesGrid`, `GesturesCard`. De Task 4: `SettingsSheet`.
- Produces: la pantalla terminada.

- [ ] **Step 1: Reescribir `app/(app)/(hub)/profile/page.tsx`**

```tsx
"use client";

import { useCallback, useEffect, useState } from "react";

import BadgesGrid from "@/components/profile/badges-grid";
import GesturesCard from "@/components/profile/gestures-card";
import ProfileIdentity from "@/components/profile/profile-identity";
import ProfileStats from "@/components/profile/profile-stats";
import ProfileXpBar from "@/components/profile/profile-xp-bar";
import SettingsSheet from "@/components/profile/settings-sheet";
import type { DotyAnimation } from "@/components/ui/doty/doty";
import { equippedGesture } from "@/lib/profile-view";
import {
  getMyBadgesService,
  getMyStatsService,
  type Badge,
  type MyStats,
} from "@/services/engagement.service";
import {
  equipItemService,
  getInventoryService,
  type InventoryItem,
} from "@/services/shop.service";
import { ADMIN_PROFILE } from "@/constants";
import { useAuth } from "@/context/auth-context";

/**
 * Perfil (spec §5, variante A "identidad abierta"). Los ajustes viven en una
 * hoja, no en una tarjeta de la página. La foto `profile_pic` deja de
 * mostrarse: la cara es siempre Doty (la columna se conserva en la base).
 */

type StoredUser = { name?: string; last_name?: string; profile?: number };

function readUser(): StoredUser {
  try {
    return JSON.parse(localStorage.getItem("user") || "{}") || {};
  } catch {
    return {};
  }
}

export default function ProfilePage() {
  const { logout } = useAuth();
  const [user] = useState<StoredUser>(readUser);
  const [stats, setStats] = useState<MyStats | null>(null);
  const [badges, setBadges] = useState<Badge[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const loadInventory = useCallback(() => {
    getInventoryService().then((inv) => setInventory(inv.items));
  }, []);

  useEffect(() => {
    let active = true;
    getMyStatsService().then((d) => {
      if (active && d) setStats(d);
    });
    getMyBadgesService().then((b) => {
      if (active) setBadges(b);
    });
    loadInventory();
    return () => {
      active = false;
    };
  }, [loadInventory]);

  const toggleEquip = (item: InventoryItem) => {
    equipItemService(item.id, item.equippedSlot === null).then((inv) => setInventory(inv.items));
  };

  const name = [user.name, user.last_name].filter(Boolean).join(" ") || "Aprendiz";
  const gesture = equippedGesture(inventory);
  const gestureAnimation = gesture?.meta?.animation as DotyAnimation | undefined;

  return (
    <>
      <div className="flex flex-col gap-6 md:grid md:grid-cols-2 md:items-start md:gap-8">
        <div className="flex flex-col gap-5">
          <ProfileIdentity
            name={name}
            stats={stats}
            gestureAnimation={gestureAnimation}
            onOpenSettings={() => setSettingsOpen(true)}
          />
          <ProfileXpBar stats={stats} />
          <ProfileStats stats={stats} badges={badges} />
        </div>

        <div className="flex flex-col gap-6">
          <BadgesGrid badges={badges} />
          <GesturesCard items={inventory} onToggle={toggleEquip} />
        </div>
      </div>

      <SettingsSheet
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        isAdmin={user.profile === ADMIN_PROFILE}
        onLogout={() => void logout()}
      />
    </>
  );
}
```

- [ ] **Step 2: Hacer autoritativo al servidor en `components/theme/theme-sync.tsx`**

Sustituye el primer `useEffect` y el comentario de bloque del componente por:

```tsx
/**
 * El primer paint usa el espejo de localStorage (script inline de app/layout.tsx).
 * Aquí se reconcilia con el servidor, que desde el subproyecto D es AUTORITATIVO:
 * la hoja de ajustes escribe paleta, modo y sonido en `/me/settings` en cada
 * cambio, así que un espejo que difiera es de otro dispositivo o de un PATCH que
 * no llegó, y se reescribe. Antes de D solo se completaban los dispositivos sin
 * espejo, porque la paleta no tenía escritor y un servidor con defaults habría
 * pisado una elección local.
 *
 * Además, en modo Auto sigue los cambios de tema del SO con la pestaña abierta:
 * el CSS cambia solo, pero la clase `dark`, `colorScheme` y la meta no.
 *
 * Sin estado ni setState (regla 3): solo efectos.
 */
export default function ThemeSync() {
  useEffect(() => {
    let alive = true;
    getMySettingsService().then((settings) => {
      if (!alive || !settings) return;
      const server = normalizePrefs(settings);
      const local = readMirror();
      if (server.palette === local.palette && server.mode === local.mode) return;
      applyThemePrefs(server);
      writeMirror(server);
    });
    return () => {
      alive = false;
    };
  }, []);
```

Deja el segundo `useEffect` (el de `prefers-color-scheme`) tal cual. Ajusta los imports: `hasMirror` deja de usarse aquí; quítalo del import si no queda ningún otro uso en el archivo. **No borres `hasMirror` de `lib/theme-prefs.ts`**: es una función exportada y el subproyecto F puede necesitarla.

- [ ] **Step 3: Borrar lo que queda sin consumidores**

```bash
git rm components/theme-toggle.tsx components/interactive-column/streak/streak-top.tsx components/interactive-column/streak/streak.tsx components/interactive-column/xp-level.tsx components/interactive-column/badges.tsx
```

- [ ] **Step 4: Arreglar los dos comentarios que citan el archivo borrado**

`app/layout.tsx` (alrededor de la línea 96) y `app/manifest.ts` (alrededor de la línea 32) mencionan `components/theme-toggle.tsx` como uno de los sitios que conocen los colores del tema. Ese archivo ya no existe: sustituye la mención por `components/profile/settings-sheet.tsx`, que es quien hereda esa responsabilidad. No cambies nada más de esos comentarios.

- [ ] **Step 5: Comprobar que no queda ninguna referencia a lo borrado**

```bash
grep -rn "theme-toggle\|ThemeToggle\|streak-top\|StreakTop\|interactive-column/xp-level\|XpLevel\|interactive-column/badges\|BadgesCard\|interactive-column/streak/streak" --include='*.tsx' --include='*.ts' app components lib hooks services context
```

Esperado: **sin resultados**. Si sale alguno fuera de `docs/`, arréglalo antes de commitear.

- [ ] **Step 6: Verificación completa de la webapp**

```bash
source ~/.nvm/nvm.sh && nvm use && npm run lint && npm run test:scripts && npx next build
```

Esperado: lint limpio, todos los tests en verde y build sin errores.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat(perfil): pantalla nueva con hoja de ajustes, el servidor manda en el tema y fuera el toggle y los restos

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 6: Backend — saldar la deuda de `users.settings`

**Files:** (todos en el worktree del backend `/home/endurance/Projects/Endurance/dots/.worktrees/dots-backend-d-perfil`, rama `redesign/d-perfil`)

**Trabaja ahí dentro, NUNCA en `../dots-backend`**: ese es el checkout principal de Sergio y tiene el watcher del backend corriendo en el puerto 4000. El worktree ya está creado cuando esta tarea empieza.
- Modify: `src/modules/users/users.entity.ts`
- Modify: `src/modules/me/me.service.ts`

**Interfaces:**
- Consumes: nada de las tareas anteriores; es trabajo de otro repo.
- Produces: `GET/PATCH /me/settings` sin SQL crudo y sin el 503; el contrato de respuesta **no cambia**, así que la webapp no se entera.

**Contexto que no hace falta re-investigar:** la columna `users.settings jsonb NOT NULL DEFAULT '{}'` ya existe en producción (aplicada el 2026-09-15; el dry-run `node scripts/migrate-settings.js` imprime `users.settings: exists`). La lógica pura de `src/common/user-settings.ts` (`normalizeSettings`, `mergeSettings`, `DEFAULT_SETTINGS`) **no se toca**.

- [ ] **Step 1: Situarte en el worktree del backend**

```bash
cd /home/endurance/Projects/Endurance/dots/.worktrees/dots-backend-d-perfil && git branch --show-current
```

Esperado: `redesign/d-perfil`. Si no, PARA e informa: no crees la rama en otro sitio.

- [ ] **Step 2: Confirmar que la columna existe antes de declararla**

```bash
source ~/.nvm/nvm.sh && nvm use && node scripts/migrate-settings.js
```

Esperado: `users.settings: exists` y `Dry-run only`. **Nunca pases `--apply`.** Si dijera otra cosa, PARA e informa el bloqueo: declarar en la entidad una columna que no existe rompe todas las consultas de usuarios.

- [ ] **Step 3: Declarar la columna en la entidad**

En `src/modules/users/users.entity.ts`, junto a las demás columnas de la clase `Users`, añade:

```ts
  // Preferencias del usuario (tema, modo, sonido, avatar, onboarding, pistas).
  // Contrato y validación en src/common/user-settings.ts; el frontend lo espeja
  // en dots-webapp/services/settings.service.ts.
  @Column({ type: 'jsonb', nullable: false, default: () => "'{}'::jsonb" })
  settings: Record<string, unknown>;
```

- [ ] **Step 4: Reescribir los tests de settings que describen el comportamiento que se retira**

`src/modules/me/me.service.spec.ts` YA EXISTE (148 líneas) y su helper `makeService`
simula el SQL crudo, incluido el error 42703 de la columna inexistente. Cuatro de sus
tests afirman justo lo que esta tarea elimina (defaults al faltar la columna y el 503 al
escribir), así que **no basta con añadir tests: hay que sustituir los que describen el
pasado**. El helper sigue necesitando `manager.query`, porque `getStats` lo usa para leer
las gemas, y gana un `save` porque ahora es como se persisten los ajustes.

Sustituye el helper `makeService` y el `describe('MeService settings', …)` completo por
esto, y **deja intacto** el `describe('MeService getStats.streakSecuredToday', …)` del
final, que sigue funcionando:

```ts
type Row = Record<string, unknown>;

/** Repositorio falso. `manager.query` ya solo sirve las gemas de getStats: los
 *  ajustes van por findOne/save desde que la entidad declara users.settings. */
function makeService(user: Row | null) {
  const query = jest.fn().mockResolvedValue([{ gems: '5' }]);
  const save = jest.fn().mockResolvedValue(undefined);
  const usersRepository = {
    findOne: jest.fn().mockResolvedValue(user),
    save,
    manager: { query },
  };
  const userGameScoresRepository = { find: jest.fn().mockResolvedValue([]) };
  const dailyUseRepository = { find: jest.fn().mockResolvedValue([]) };
  const service = new MeService(
    usersRepository as never,
    userGameScoresRepository as never,
    dailyUseRepository as never,
  );
  return { service, query, save };
}

describe('MeService settings', () => {
  it('getSettings devuelve defaults cuando la columna está vacía', async () => {
    const { service } = makeService({ id: 1, settings: {} });
    await expect(service.getSettings(1)).resolves.toEqual(DEFAULT_SETTINGS);
  });

  it('getSettings devuelve defaults cuando la columna trae basura', async () => {
    const { service } = makeService({ id: 1, settings: { palette: 'fucsia', mode: 7 } });
    await expect(service.getSettings(1)).resolves.toEqual(DEFAULT_SETTINGS);
  });

  it('getSettings lee la columna por la entidad, sin SQL crudo', async () => {
    const { service, query } = makeService({
      id: 1,
      settings: { palette: 'electrico', mode: 'dark' },
    });
    const out = await service.getSettings(1);
    expect(out.palette).toBe('electrico');
    expect(out.mode).toBe('dark');
    expect(query).not.toHaveBeenCalled();
  });

  it('getSettings 404 si el usuario no existe', async () => {
    const { service, query } = makeService(null);
    await expect(service.getSettings(1)).rejects.toBeInstanceOf(HttpException);
    expect(query).not.toHaveBeenCalled();
  });

  it('patchSettings mezcla, persiste por el repositorio y devuelve el resultado', async () => {
    const { service, query, save } = makeService({
      id: 1,
      settings: { palette: 'rosa', tips_seen: ['a'] },
    });
    const out = await service.patchSettings(1, {
      palette: 'electrico',
      tips_seen: ['b'],
    });
    expect(out.palette).toBe('electrico');
    expect(out.tips_seen).toEqual(['a', 'b']);
    expect(query).not.toHaveBeenCalled();
    expect(save).toHaveBeenCalledTimes(1);
    // Lo guardado es el objeto COMPLETO y normalizado, no el parche.
    expect((save.mock.calls[0][0] as Row).settings).toEqual(out);
  });

  it('patchSettings 404 si el usuario no existe, sin guardar nada', async () => {
    const { service, save } = makeService(null);
    await expect(
      service.patchSettings(1, { palette: 'electrico' }),
    ).rejects.toBeInstanceOf(HttpException);
    expect(save).not.toHaveBeenCalled();
  });

  it('patchSettings propaga los errores de la BD', async () => {
    const { service, save } = makeService({ id: 1, settings: {} });
    save.mockRejectedValueOnce(new Error('connection lost'));
    await expect(
      service.patchSettings(1, { palette: 'electrico' }),
    ).rejects.toThrow('connection lost');
  });
});
```

Los imports del archivo no cambian salvo uno: `santiagoToday` y `DEFAULT_SETTINGS` se
siguen usando; comprueba al final que no quede ninguno sin usar.

- [ ] **Step 5: Correr los tests para verlos fallar**

```bash
source ~/.nvm/nvm.sh && nvm use && npx jest src/modules/me/me.service.spec.ts
```

Esperado: FAIL en los tests de settings, porque hoy `getSettings` y `patchSettings`
llaman a `manager.query`. Los de `streakSecuredToday` deben seguir en verde.

- [ ] **Step 6: Reescribir las dos rutas de settings en `src/modules/me/me.service.ts`**

Sustituye el bloque completo que va desde el comentario `// ── Settings ─` hasta el final de `readSettingsColumn` por:

```ts
  // ── Settings ─────────────────────────────────────────────────────────────
  // users.settings la creó scripts/migrate-settings.js y está aplicada en
  // producción, así que la entidad la declara y estas dos rutas usan el
  // repositorio. Antes iban por SQL crudo tolerante al 42703 de Postgres
  // (columna inexistente), con un 503 al escribir; esa tolerancia ya no tiene
  // caso y se retiró con el helper isUndefinedColumn.
  async getSettings(userId: number): Promise<UserSettings> {
    const user = await this.usersRepository.findOne({ where: { id: userId } });
    if (!user) throw new HttpException('User not found', 404);
    return normalizeSettings(user.settings);
  }

  async patchSettings(
    userId: number,
    patch: SettingsPatch,
  ): Promise<UserSettings> {
    const user = await this.usersRepository.findOne({ where: { id: userId } });
    if (!user) throw new HttpException('User not found', 404);
    const next = mergeSettings(normalizeSettings(user.settings), patch, new Date());
    user.settings = next;
    await this.usersRepository.save(user);
    return next;
  }
}
```

- [ ] **Step 7: Retirar el helper que queda muerto**

Borra la función `isUndefinedColumn` (alrededor de la línea 68 de `me.service.ts`). Antes, confirma que no queda ningún otro uso:

```bash
grep -rn "isUndefinedColumn" src
```

Esperado tras el borrado: **sin resultados**. Si apareciera algún uso que no sea el de settings, NO la borres y dilo en el informe.

- [ ] **Step 8: Correr los tests para verlos pasar**

```bash
source ~/.nvm/nvm.sh && nvm use && npx jest src/modules/me/me.service.spec.ts && npm test
```

Esperado: los tres tests nuevos en verde y la suite completa sin regresiones. Anota en el informe el total de tests.

- [ ] **Step 9: Lint solo de lo tocado**

```bash
npx eslint src/modules/me/me.service.ts src/modules/users/users.entity.ts src/modules/me/me.service.spec.ts && npx tsc --noEmit -p tsconfig.json
```

Esperado: sin errores. **No corras `npm run lint`**: aplica `--fix` a todo el árbol y `main` arrastra 187 errores ajenos.

- [ ] **Step 10: Commit**

```bash
git add src/modules/users/users.entity.ts src/modules/me/me.service.ts src/modules/me/me.service.spec.ts
git commit -m "refactor(settings): la entidad declara users.settings y /me/settings deja el SQL crudo y su 503

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 7: Verificación en navegador, documentación y desviaciones del spec

**Files:**
- Modify: `docs/ARQUITECTURA.md`
- Modify: `docs/superpowers/specs/2026-09-14-rediseno-look-and-feel-juvenil-design.md` (§5)

**Interfaces:**
- Consumes: la pantalla terminada y el backend de las tareas anteriores.
- Produces: nada que consuma código.

- [ ] **Step 1: Levantar los dos servidores del preview y abrir el perfil**

El dev server de la webapp y el del backend se levantan con el preview, nunca con Bash, y se apagan al terminar. Con sesión iniciada, abre `/profile`.

- [ ] **Step 2: Medir los criterios de aceptación del spec §5**

Mide en el navegador, no a ojo, y anota el número de cada uno:

1. **En 390 px la identidad y los stats caben sobre el pliegue.** Compara el borde inferior de la fila de stats contra `window.innerHeight` menos la barra de navegación.
2. **Avatar de 78 px en móvil y 96 en escritorio.** `getBoundingClientRect().width` de la imagen de Doty a 390 px y a 1280 px.
3. **Cambiar el tema desde la hoja repinta la app entera.** Toca "Eléctrico" y comprueba que `document.documentElement.dataset.palette` cambia y que el `--background` computado del `body` pasa al de esa paleta.
4. **Cambiar el modo funciona en los tres valores.** Claro, Oscuro y Auto: comprueba `data-theme` y la clase `dark` del `<html>` en cada uno, y que Auto quita el atributo.
5. **La elección sobrevive a una recarga** sin parpadeo: recarga y comprueba que el primer paint ya trae la paleta elegida.
6. **El PATCH llega al servidor.** Mira las peticiones de red: cada cambio debe disparar un `PATCH /me/settings` con 200.
7. **El interruptor de sonidos escribe el espejo y el servidor.** Comprueba `localStorage["dots-sound"]` y la petición.
8. **Dos columnas en escritorio** dentro de `max-w-5xl`, y una sola a 390 px.
9. **Cerrar la hoja** funciona con el botón, tocando fuera y con Escape.
10. **Insignias a seis por fila** en escritorio.

Si algo no cuadra, se arregla en esta tarea antes de documentar.

- [ ] **Step 3: Actualizar `docs/ARQUITECTURA.md`**

En la tabla de rutas, la fila de Perfil dice hoy que es el perfil con ajustes. Sustitúyela por:

```markdown
| Perfil | `/profile` | Identidad con Doty, barra de nivel, cuatro números, insignias y gestos; los ajustes viven en una hoja (inferior en móvil, lateral en escritorio). |
```

Y añade un párrafo corto al final de la sección de pantallas:

```markdown
### El perfil (`/profile`)

`components/profile/` reparte la pantalla: `profile-identity.tsx` (Doty, nombre, chips
MCER y racha, engranaje), `profile-xp-bar.tsx`, `profile-stats.tsx` (los cuatro números
sin cajas), `badges-grid.tsx`, `gestures-card.tsx` y `settings-sheet.tsx`. La lógica de
vista es pura y está bajo `node --test` en `lib/profile-view.ts`.

La hoja de ajustes escribe tres cosas a la vez en cada cambio: el espejo de
`localStorage`, el DOM (vía `applyThemePrefs`) y `PATCH /me/settings`. Desde aquí el
servidor es autoritativo: `components/theme/theme-sync.tsx` reconcilia al cargar y
reescribe el espejo si difiere. La preferencia de sonido tiene su propio espejo en
`lib/sound-prefs.ts` y `lib/feedback-sounds.ts` la consulta antes de sonar, así que
apagarla silencia las ocho pantallas que reproducen aciertos y fallos sin tocar ninguna;
la narración no pasa por ahí y nunca se silencia.

El acento de cada paleta viaja como dato (`PALETTE_ACCENTS` en el `lib/theme-colors.ts`
generado) porque los bloques CSS generados usan selectores `:root[data-palette]`, que
solo casan con `<html>`: un envoltorio anidado no heredaría el token.
```

- [ ] **Step 4: Anotar las tres desviaciones en el spec §5**

En la sección `## 5. Subproyecto D`, añade al final de la lista de viñetas:

```markdown
- **Tres desviaciones decididas durante la implementación (2026-09-15):** (1) la hoja NO
  lleva la fila "Cambiar avatar" y el avatar no lleva lápiz, porque los avatares son el
  subproyecto E y §8 lo pone después de D: un control que no hace nada es peor que
  ninguno; (2) el perfil deja de mostrar gorros y fondos y conserva solo los gestos, tal
  como describe la viñeta de arriba, mientras su retirada con reembolso sigue siendo §6.2
  del subproyecto E; (3) el emoji de cada insignia se queda, porque viene del backend
  (`Badge.emoji`) y sustituirlo exige arte que §9 deja fuera de alcance.
```

- [ ] **Step 5: Verificación final de los dos repos**

```bash
source ~/.nvm/nvm.sh && nvm use && npm run lint && npm run test:scripts && npx next build
cd /home/endurance/Projects/Endurance/dots/.worktrees/dots-backend-d-perfil && npm test && npx eslint src/modules/me/me.service.ts src/modules/users/users.entity.ts
```

Esperado: todo en verde.

- [ ] **Step 6: Commit**

```bash
git add docs/ARQUITECTURA.md docs/superpowers/specs/2026-09-14-rediseno-look-and-feel-juvenil-design.md
git commit -m "docs(perfil): ARQUITECTURA describe el perfil nuevo y el spec anota las tres desviaciones de D

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

## Cobertura del spec §5

| Requisito del spec | Dónde se implementa |
|---|---|
| Identidad horizontal: avatar 78/96 px, nombre Baloo 24, chips MCER y racha, engranaje a la derecha | Task 2, `profile-identity.tsx` |
| Lápiz para cambiar el avatar | **Desviación 1**: llega con E; anotada en el spec por la Task 7 |
| Barra "Nivel 4 · 620 / 900 XP" | Task 1 (`levelLine`) + Task 2 (`profile-xp-bar.tsx`) |
| Stats como fila de cuatro números sin cajas: XP total, mejor racha, insignias, gemas | Task 1 (`statRow`) + Task 2 (`profile-stats.tsx`) |
| Insignias: tile dorado de 58 px, bloqueadas en gris con "n / m" | Task 3, `badges-grid.tsx` |
| Gesto de tu Doty: tarjetas con el equipado marcado, enlace a la tienda | Task 1 (`gestureItems`, `equippedGesture`) + Task 3 (`gestures-card.tsx`) |
| Escritorio: dos columnas dentro de `max-w-5xl` | Task 5, la página (el `max-w-5xl` lo pone el layout del grupo hub) |
| Hoja de ajustes inferior en móvil y lateral en escritorio | Task 4, `settings-sheet.tsx` |
| Tema Rosa/Eléctrico con muestra de color y la nota "Doty siempre es rosa, el resto cambia" | Task 1 (`PALETTE_ACCENTS`) + Task 4 |
| Modo Claro / Oscuro / Auto | Task 4 |
| Sonidos "Aciertos, fallos y celebraciones" con gate en `lib/feedback-sounds.ts` | Task 1 |
| Cambiar avatar | **Desviación 1** |
| Panel de admin solo con `profile === 1` | Task 4 |
| Cerrar sesión | Task 4 |
| Cada control escribe `PATCH /me/settings` y el espejo local | Task 4 |
| La foto `profile_pic` deja de mostrarse; la columna se conserva | Task 5 (la página ya no la lee; el backend no la toca) |
| Criterio: en 390 px identidad y stats caben sobre el pliegue | Task 7, paso 2.1 |
| Criterio: cambiar tema desde la hoja repinta la app | Task 7, paso 2.3 |
| §2.1: el servidor pasa a ser autoritativo cuando la hoja escriba paleta y modo | Task 5, `theme-sync.tsx` |
| §2.1: `theme-toggle.tsx` desaparece y sus controles pasan a la hoja | Tasks 4 y 5 |
| Deuda de A: declarar `settings` en la entidad y retirar el SQL crudo | Task 6 |

**Nada del spec §5 queda sin tarea.** Las tres desviaciones están decididas, justificadas y se escriben en el propio spec en la Task 7.
