# Rediseño look & feel — Subproyecto F.1 (Primer inicio guiado) — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Una cuenta que entra por primera vez pasa por tres pantallas —saludo de Doty, tema y avatar— antes de ver la app, y sale de ahí con paleta, modo, sonido y avatar elegidos y con `onboarded_at` estampado; quien ya pasó no vuelve a verlas nunca.

**Architecture:** Todo ocurre en la webapp: **el backend ya acepta `onboarded` y `tips_seen` en `PATCH /me/settings`** y `mergeSettings` estampa `onboarded_at` una sola vez, así que F.1 no toca `dots-backend`. Una ruta inmersiva nueva `/welcome` (fuera del grupo hub, sin chrome) lleva las tres pantallas como una máquina de tres pasos en estado local. Un componente cliente `FirstRunGate`, montado en el layout del hub, pide `GET /me/settings` y redirige a `/welcome` con `router.replace` cuando `onboarded_at` es `null`; publica además su veredicto en un flag de módulo que el Camino consulta para no competir por la redirección. La lógica pura (espejo local, veredicto, ruta siguiente) vive en `lib/first-run.ts` bajo `node --test`.

**Tech Stack:** Next.js 16 (app router) + React 19 + Tailwind 4; `node --test` para la lógica pura. Sin cambios en el backend ni en la base de datos.

**Spec:** `docs/superpowers/specs/2026-09-14-rediseno-look-and-feel-juvenil-design.md` — §7.1 (gating) y §7.2 (las tres pantallas). **§7.3 (pistas contextuales) NO entra en este plan**: es el subproyecto F.2, que se escribe aparte. También rigen §1 (principios), §2.1 (temas), §6.1 (marco del avatar) y §8 (F depende de A, D y E, todos ya en `main`).

## Global Constraints

- `source ~/.nvm/nvm.sh && nvm use` antes de cualquier `node`/`npm`/`npx` (Node 24 por `.nvmrc`). **Obligatorio**: sin eso el `node` del sistema no ejecuta los `.ts` que importan los `.test.mjs` y verás fallos falsos. Verificación final: `npm run lint && npm run test:scripts && npx next build`.
- Rama `redesign/f1-primer-inicio` desde `main` (c0b88ab), en un worktree **fuera del checkout principal** `dots-webapp/`, donde vive el dev server de Sergio. **Sin push a origin.** Nunca escribas fuera de tu worktree. **Nunca uses `git stash`** (la pila es compartida entre worktrees: usa `git show <rev>:<ruta>`). **Nunca corras `npm install`** en el worktree: falla compilando `sharp` y deja `node_modules` vacío; el controlador lo provisiona con `cp -al`.
- **Cero cambios en `dots-backend`.** Si algo pareciera exigirlos, PARA e informa: el DTO ya acepta lo que F necesita.
- Commits terminan con `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`.
- Regla 1: navegación con `router.push`/`router.replace`, **nunca `window.location.*`**.
- Regla 2 (RN-safe): solo tap/pointer, nada de `keydown` como input de producto, animación solo `transform`/`opacity`, hover jamás como única señal.
- Regla 3 (lint del compiler de React): prohibido `setState` síncrono en el cuerpo de un `useEffect`; los callbacks de promesas y de temporizadores sí pueden. Prohibidos efectos colaterales dentro de updaters de `setState`.
- Regla 6: `useSearchParams` siempre dentro de un boundary `<Suspense>` (este plan no lo usa).
- Regla 10: Doty solo con `<Doty pose=…>` y poses del registro generado `components/ui/doty/poses.ts`. Las poses de este plan existen con arte: `saludando`, `feliz`, `pensando`.
- Regla 11: cero emoji como iconografía. Iconos de sistema con `<Icon name=…>` (disponibles, entre otros: `check`, `cruz`, `derecha`, `izquierda`, `sol`, `luna`, `lapiz`, `ajustes`), los de economía con `<UiIcon name=…>` (`racha`, `gemas`, `xp`…).
- Regla 12: `app/themes.generated.css` y `lib/theme-colors.ts` se GENERAN desde `design/themes.json`; no se editan a mano. Un componente cliente no lee `matchMedia` en el render.
- Copy de producto en español con tuteo, tono juguetón, sin regionalismos. Las frases de las tres pantallas son literales del spec §7.2 y de la tabla de voz de `docs/brand/doty-identity.md`; **no las reescribas**.
- Módulos puros bajo test (`lib/first-run.ts`): **solo `import type`** (Node ejecuta el `.ts` sin bundler y no resolvería el alias `@/`). El test es `lib/first-run.test.mjs`, junto al módulo, importando `./first-run.ts` con extensión. `npm run test:scripts` lo recoge por el glob `lib/*.test.mjs`; **no toques `package.json`**.
- Sin librerías nuevas. Sin CSS nuevo en `app/globals.css`: las animaciones y tokens que hacen falta ya existen.

---

## Contexto medido del código (leído el 2026-09-17, no re-investigar)

**El backend ya está listo. F.1 no lo toca.**
- `dots-backend/src/modules/me/settings.dto.ts:1-39` — `PatchSettingsDto` acepta `palette?`, `mode?`, `sound?`, **`onboarded?` (`@IsBoolean`)** y **`tips_seen?`**. **NO acepta `avatar_key`**, y la ruta `PATCH /me/settings` lleva su propio `ValidationPipe({whitelist:true, forbidNonWhitelisted:true})` (`me.controller.ts:77-83`): mandar `avatar_key` ahí **devuelve 400**. El spec §7.1 dice lo contrario y se corrige en la Task 6.
- `dots-backend/src/common/user-settings.ts:71-90` — `mergeSettings` estampa `onboarded_at` **una sola vez** (`if (patch.onboarded && next.onboarded_at === null)`), y hace unión de-duplicada en `tips_seen`. O sea: mandar `{onboarded: true}` dos veces no reescribe la fecha.
- El avatar se equipa con **`POST /me/avatar { key }`** (`me.controller.ts:95-101`), que concede el ítem si es gratis y lo equipa en una transacción.

**Contrato de la webapp con settings** (`services/settings.service.ts:1-48`):
```ts
export type UserSettings = { palette; mode; sound; avatar_key: string | null; avatar: PublicAvatar | null; onboarded_at: string | null; tips_seen: string[] };
export type SettingsPatch = { palette?; mode?; sound?; onboarded?: boolean; tips_seen?: string[] };  // sin avatar_key, a propósito
getMySettingsService(): Promise<UserSettings | null>          // null ante cualquier error
patchMySettingsService(patch: SettingsPatch): Promise<Omit<UserSettings, "avatar">>
postMyAvatarService(key: string): Promise<PublicAvatar>
```

**Preferencias de tema** (`lib/theme-prefs.ts`): `ThemeMode = "light"|"dark"|"auto"`; `PALETTE_KEY="dots-palette"`, `MODE_KEY="dots-theme"`, `DIRTY_KEY="dots-settings-dirty"`; `DEFAULT_PREFS={palette:"rosa",mode:"auto"}`; `readMirror()`, `writeMirror(prefs)`, `hasMirror()`, `normalizePrefs()`, `resolveMode(mode): "light"|"dark"`, `applyThemePrefs(prefs)` (pinta `data-palette`/`data-theme`/`.dark`/`colorScheme` y rehace el `<meta name="theme-color">`), `markSettingsDirty()`, `clearSettingsDirty()`, `hasPendingSettings()`. Sonido: `lib/sound-prefs.ts` con `SOUND_KEY="dots-sound"`, `readSoundEnabled()`, `writeSoundEnabled(on)`.

**Cómo escribe la hoja de ajustes** (`components/profile/settings-sheet.tsx:120-153`), que es el patrón a copiar: escribe el espejo, aplica al DOM, `markSettingsDirty()`, y manda **el juego completo** `{palette, mode, sound}` en el PATCH, nunca un delta. `ThemeSync` (`components/theme/theme-sync.tsx:49-69`) reconcilia al montar: si hay marca sucia reenvía los espejos, si no, el servidor manda.

**Colores como dato** (`lib/theme-colors.ts`, generado): `PALETTES = ["rosa","electrico"]`, `PALETTE_LABELS`, `THEME_COLORS[palette][light|dark]` (el `--background`) y `PALETTE_ACCENTS[palette][light|dark]` (el `--accent`). Existen **porque los bloques CSS generados usan `:root[data-palette]`, que solo casa con `<html>`**: un envoltorio anidado no heredaría los tokens. La vista previa de este plan se pinta con esos dos valores y derivados por `color-mix`, sin tocar el generador.

**Tamaños de Doty** (`components/ui/doty/doty.tsx:37-50`): `micro 32, mini 80, tiny 96, smaller 112, small 144, medium 192, big 352, chip 44, section 104, banner 158, dorso 68`. **No existe 170**, que es el que pide el spec §7.2 para la bienvenida.

**Avatares** (`components/ui/avatar/avatar.tsx`): `Avatar` (default, `{avatar, size, alt?, className?}`) y `AvatarDisc` (named). El perfil los lista así (`app/(app)/(hub)/profile/page.tsx:93-96`): `getShopService()` y filtro `i.kind === "avatar" && (i.price === 0 || i.owned)`. `components/profile/avatar-picker.tsx` es una hoja modal: **no se reutiliza aquí**, la pantalla 3 tiene su propio layout.

**Placement, que es un flujo aparte y ya existe**: `services/placement.service.ts` expone `getPlacementStatusService(): Promise<{status:"none"|"active"|"done"|"skipped"; canTake:boolean}>`. La página `/onboarding` (`app/(app)/onboarding/page.tsx:29-41`) se autoexpulsa a `/levels` cuando `!canTake && status !== "active"`. Además, **`components/path/path-container.tsx:132-134` redirige a `/onboarding` cuando `GET /path` trae `placementPending`** — de ahí la carrera que resuelve la Task 2.

**Login** (`app/page.tsx:194-254` y `:147-179`): guarda el usuario en `localStorage["user"]`, pide la animación de entrada por `sessionStorage` y **siempre** hace `router.replace("/levels")`. No decide nada de onboarding.

**Layout del hub** (`app/(app)/(hub)/layout.tsx:1-34`): monta en orden `ThemeSync`, `DotyEntrada`, `AppNav`, `AppHeader` y `{children}` dentro de `<main className="mx-auto w-full max-w-5xl px-4 pb-24 pt-4 md:px-8 md:pb-12">`. No existe `app/(app)/layout.tsx`. Las rutas inmersivas cuelgan de `app/(app)/<ruta>/` (así vive `/onboarding`).

**Logout** (`context/auth-context.tsx:52-93`): borra `localStorage["user"]` y los cuatro espejos (`PALETTE_KEY`, `MODE_KEY`, `SOUND_KEY`, `DIRTY_KEY`) y luego `window.location.replace("/")` — ese `window.location` es correcto y está contemplado en la regla 1.

**Patrón de dos pasos para leer `localStorage` sin romper la hidratación** (`app/(app)/admin/layout.tsx:35-52`, `components/interactive-column/top-students.tsx:54-68`): `useSyncExternalStore(emptySubscribe, () => true, () => false)` y leer solo cuando `hydrated`.

**Fuentes**: `Baloo_2` ya está configurada (`app/layout.tsx:16-20`, variable `--font-baloo`); `h1,h2,h3,.font-display` la usan (`app/globals.css:51-52`).

## Cinco decisiones tomadas antes de escribir el plan

1. **F se parte en dos.** F.1 (este plan) es el primer inicio: gate y tres pantallas. **F.2 son las pistas contextuales (`DotyTip`, spec §7.3)**, que tocan cinco pantallas distintas y no comparten código con esto salvo un tamaño de Doty. Cada mitad es software que funciona y se revisa por separado.
2. **Sin backend.** El DTO ya acepta `onboarded`. El `avatar_key` que pide el spec §7.1 en el PATCH **no existe y sería un 400**: el avatar se equipa con `POST /me/avatar`. La Task 6 corrige el spec.
3. **El gate no bloquea el render.** Renderiza siempre a sus hijos y solo redirige cuando su `fetch` responde. Bloquear habría metido una espera a `GET /me/settings` delante de cada página del hub, o un parpadeo en cada carga por culpa de la hidratación.
4. **La carrera con el Camino se cierra con un flag de módulo.** `path-container` redirige a `/onboarding` en cuanto `GET /path` trae `placementPending`; un usuario nuevo dispara las dos redirecciones a la vez. El gate publica su veredicto en `lib/first-run.ts` y el Camino no redirige mientras valga `"pendiente"`. Con `"desconocido"` (el fetch aún no volvió, o falló) **el Camino redirige como hoy**: fallar abierto, nunca atrapar a nadie.
5. **La vista previa de paleta se pinta con datos, no con CSS anidado.** `THEME_COLORS` y `PALETTE_ACCENTS` más `color-mix` sobre esos dos valores. Un envoltorio con `data-palette` no heredaría nada, porque el CSS generado usa `:root[data-palette]`.

## Estructura de archivos

- **Crear** `lib/first-run.ts` — lógica pura: `ONBOARDED_KEY`, `leerEspejo`, `escribirEspejo`, `borrarEspejo`, `estaOnboardado`, `rutaTrasBienvenida`, y el flag compartido `estadoPrimerInicio`/`fijarPrimerInicio`.
- **Crear** `lib/first-run.test.mjs` — sus tests bajo `node --test`.
- **Crear** `components/first-run/first-run-gate.tsx` — el gate del layout del hub.
- **Modificar** `app/(app)/(hub)/layout.tsx` — monta el gate.
- **Modificar** `components/path/path-container.tsx` — la redirección a placement respeta el flag.
- **Modificar** `context/auth-context.tsx` — `logout` borra también el espejo nuevo.
- **Modificar** `components/ui/doty/doty.tsx` — tamaño `bienvenida` (170 px).
- **Crear** `app/(app)/welcome/page.tsx` — la máquina de tres pasos y el cierre del flujo.
- **Crear** `components/first-run/welcome-hello.tsx` — pantalla 1.
- **Crear** `components/first-run/welcome-theme.tsx` — pantalla 2.
- **Crear** `components/first-run/palette-preview.tsx` — la miniatura de HUD y nodo por paleta.
- **Crear** `components/first-run/welcome-avatar.tsx` — pantalla 3.
- **Modificar** `docs/superpowers/specs/2026-09-14-rediseno-look-and-feel-juvenil-design.md` — §7.1 corregida, §7.3 anotada.
- **Modificar** `docs/ARQUITECTURA.md` — sección del primer inicio.

## Copy fijado (spec §7.2; no reescribir)

| Sitio | Texto |
|---|---|
| P1 bocadillo | `¡Hola! Soy Doty. Tu coach de inglés.` |
| P1 titular | `Prometo no regañarte.` |
| P1 texto | `Ni cuando te equivoques. Sobre todo cuando te equivoques. Vamos a armar tu dots en tres toques.` |
| P1 botón | `Vamos` |
| P2 titular | `¿Cómo lo quieres ver?` |
| P2 subtítulo | `Doty siempre es rosa. Lo demás, tú decides.` |
| P2 fila de sonido | `Sonidos` / `Aciertos, fallos y celebraciones` |
| P2 botón | `Este me gusta` |
| P3 titular | `Elige tu Doty` |
| P3 subtítulo | `Es tu cara en el ranking y en el Camino.` |
| P3 botón | `Listo, soy {label}` (el `meta.label` del avatar elegido) |
| Saltar (las tres) | `Saltar` |

---

### Task 1: La lógica pura del primer inicio — `lib/first-run.ts`

**Files:**
- Create: `lib/first-run.ts`
- Test: `lib/first-run.test.mjs`

**Interfaces:**
- Consumes: el tipo `UserSettings` de `services/settings.service.ts` y `PlacementStatus` de `services/placement.service.ts`, **solo como `import type`**.
- Produces (lo consumen las Tasks 2 y 5): `ONBOARDED_KEY = "dots-onboarded"`; `leerEspejo(): boolean`; `escribirEspejo(): void`; `borrarEspejo(): void`; `estaOnboardado(settings: { onboarded_at?: string | null } | null | undefined): boolean`; `rutaTrasBienvenida(status: { status?: string; canTake?: boolean } | null | undefined): "/onboarding" | "/levels"`; `type EstadoPrimerInicio = "desconocido" | "pendiente" | "hecho"`; `estadoPrimerInicio(): EstadoPrimerInicio`; `fijarPrimerInicio(estado: EstadoPrimerInicio): void`.

Contexto para esta tarea: este módulo corre bajo `node --test` sin navegador, así que **cada acceso a `localStorage` va dentro de `try/catch` y detrás de un `typeof window === "undefined"`**, y los tests comprueban justo eso. Dos criterios de diseño que los tests fijan: `estaOnboardado(null)` devuelve `true` (si no se pudo leer los ajustes, **no atrapes a nadie** en el primer inicio: mismo espíritu que el "fail-open by design" de `path-container.tsx:128-131`), y `rutaTrasBienvenida` replica la guardia de `/onboarding` (`app/(app)/onboarding/page.tsx:33`): ahí se entra si `canTake` o si el test ya está `"active"`.

- [ ] **Step 1: Escribe el test que falla**

Crea `lib/first-run.test.mjs`:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ONBOARDED_KEY,
  borrarEspejo,
  escribirEspejo,
  estaOnboardado,
  estadoPrimerInicio,
  fijarPrimerInicio,
  leerEspejo,
  rutaTrasBienvenida,
} from "./first-run.ts";

test("la clave del espejo es la del resto de preferencias", () => {
  assert.equal(ONBOARDED_KEY, "dots-onboarded");
});

test("estaOnboardado: con fecha sí, sin fecha no", () => {
  assert.equal(estaOnboardado({ onboarded_at: "2026-09-17T10:00:00.000Z" }), true);
  assert.equal(estaOnboardado({ onboarded_at: null }), false);
  assert.equal(estaOnboardado({}), false);
});

test("estaOnboardado falla abierto: sin ajustes nadie queda atrapado", () => {
  // getMySettingsService devuelve null ante CUALQUIER error de red.
  assert.equal(estaOnboardado(null), true);
  assert.equal(estaOnboardado(undefined), true);
});

test("rutaTrasBienvenida manda a placement solo si se puede tomar o ya está activo", () => {
  assert.equal(rutaTrasBienvenida({ status: "none", canTake: true }), "/onboarding");
  assert.equal(rutaTrasBienvenida({ status: "active", canTake: false }), "/onboarding");
  assert.equal(rutaTrasBienvenida({ status: "done", canTake: false }), "/levels");
  assert.equal(rutaTrasBienvenida({ status: "skipped", canTake: false }), "/levels");
});

test("rutaTrasBienvenida falla abierta al Camino si no se pudo preguntar", () => {
  assert.equal(rutaTrasBienvenida(null), "/levels");
  assert.equal(rutaTrasBienvenida(undefined), "/levels");
});

test("el espejo no explota fuera del navegador", () => {
  // Node no tiene localStorage: leer devuelve false y escribir no lanza.
  assert.equal(leerEspejo(), false);
  assert.doesNotThrow(() => escribirEspejo());
  assert.doesNotThrow(() => borrarEspejo());
});

test("el flag compartido arranca en desconocido y se puede fijar", () => {
  assert.equal(estadoPrimerInicio(), "desconocido");
  fijarPrimerInicio("pendiente");
  assert.equal(estadoPrimerInicio(), "pendiente");
  fijarPrimerInicio("hecho");
  assert.equal(estadoPrimerInicio(), "hecho");
  fijarPrimerInicio("desconocido");
  assert.equal(estadoPrimerInicio(), "desconocido");
});
```

- [ ] **Step 2: Comprueba que falla**

```bash
source ~/.nvm/nvm.sh && nvm use && node --test lib/first-run.test.mjs
```

Esperado: FAIL — `Cannot find module '.../lib/first-run.ts'`.

- [ ] **Step 3: Escribe el módulo**

Crea `lib/first-run.ts`:

```ts
import type { UserSettings } from "@/services/settings.service";
import type { PlacementStatus } from "@/services/placement.service";

/**
 * Primer inicio guiado (spec §7.1). Lógica pura para poder probarse con
 * `node --test`: por eso SOLO admite `import type` — Node ejecuta este archivo
 * sin bundler y no resolvería el alias `@/`, y tampoco tiene `localStorage`,
 * de ahí las guardas de `typeof window`.
 */

/** Espejo local de "ya pasó por el primer inicio", hermano de dots-palette/theme/sound. */
export const ONBOARDED_KEY = "dots-onboarded";

export function leerEspejo(): boolean {
  try {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem(ONBOARDED_KEY) === "1";
  } catch {
    return false;
  }
}

export function escribirEspejo(): void {
  try {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(ONBOARDED_KEY, "1");
  } catch {
    // storage bloqueado: el servidor sigue siendo la verdad, solo se pierde el atajo
  }
}

export function borrarEspejo(): void {
  try {
    if (typeof window === "undefined") return;
    window.localStorage.removeItem(ONBOARDED_KEY);
  } catch {
    // ídem
  }
}

/**
 * ¿Esta cuenta ya pasó por el primer inicio? Sin ajustes devuelve `true`: el
 * servicio da `null` ante cualquier error de red, y mandar a `/welcome` a quien
 * no se pudo consultar lo atraparía en un bucle. Mismo criterio que la
 * redirección a placement del Camino, que también falla abierta.
 */
export function estaOnboardado(
  settings: Pick<UserSettings, "onboarded_at"> | null | undefined,
): boolean {
  if (!settings) return true;
  return typeof settings.onboarded_at === "string" && settings.onboarded_at.length > 0;
}

/**
 * A dónde va el usuario al cerrar la bienvenida. Replica la guardia de
 * `/onboarding`, que se autoexpulsa a `/levels` si el placement no se puede
 * tomar y no está activo: preguntarlo antes evita que la pantalla parpadee.
 */
export function rutaTrasBienvenida(
  status: Partial<PlacementStatus> | null | undefined,
): "/onboarding" | "/levels" {
  if (!status) return "/levels";
  return status.canTake === true || status.status === "active" ? "/onboarding" : "/levels";
}

// ── Flag compartido con el Camino ────────────────────────────────────────────

export type EstadoPrimerInicio = "desconocido" | "pendiente" | "hecho";

/**
 * El Camino redirige a `/onboarding` en cuanto `GET /path` trae
 * `placementPending`, y el gate redirige a `/welcome` en cuanto responde
 * `GET /me/settings`: en una cuenta nueva las dos carreras salen a la vez. El
 * gate publica aquí su veredicto y el Camino se aparta mientras valga
 * "pendiente". Con "desconocido" el Camino redirige como siempre: fallar
 * abierto es preferible a dejar a alguien sin placement.
 */
let estado: EstadoPrimerInicio = "desconocido";

export function estadoPrimerInicio(): EstadoPrimerInicio {
  return estado;
}

export function fijarPrimerInicio(siguiente: EstadoPrimerInicio): void {
  estado = siguiente;
}
```

- [ ] **Step 4: Comprueba que pasa**

```bash
source ~/.nvm/nvm.sh && nvm use && node --test lib/first-run.test.mjs && npm run test:scripts
```

Esperado: los 7 tests nuevos en PASS y la suite completa sin fallos (64 + 7 = 71).

- [ ] **Step 5: Commit**

```bash
git add lib/first-run.ts lib/first-run.test.mjs
git commit -m "feat(primer-inicio): lógica pura del gating — espejo local, veredicto y ruta siguiente

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 2: El gate del hub, la carrera con el Camino y el espejo en logout

**Files:**
- Create: `components/first-run/first-run-gate.tsx`
- Modify: `app/(app)/(hub)/layout.tsx`
- Modify: `components/path/path-container.tsx:132-134`
- Modify: `context/auth-context.tsx:77-87`

**Interfaces:**
- Consumes: de `lib/first-run.ts` (Task 1) `estaOnboardado`, `leerEspejo`, `escribirEspejo`, `borrarEspejo`, `fijarPrimerInicio`, `estadoPrimerInicio`, `ONBOARDED_KEY`; `getMySettingsService` de `services/settings.service.ts`; `useAuth` de `context/auth-context.tsx`.
- Produces (lo consume la Task 3 indirectamente): nada nuevo exportado. `FirstRunGate` es `default` y se monta con `<FirstRunGate />` **sin hijos**: no envuelve nada, solo observa y redirige.

Contexto para esta tarea: el gate **no bloquea el render** (decisión 3 del plan): montarlo como envoltorio habría metido una espera a `GET /me/settings` delante de cada página del hub, o un parpadeo en cada carga, porque el espejo no se puede leer durante el render del servidor sin romper la hidratación. Renderiza `null` siempre y trabaja en un efecto. Va en el layout del hub junto a `ThemeSync`, que es el otro componente-efecto de esa casa.

El espejo es un atajo, no la verdad: sirve para saltarse el `fetch` de quien ya pasó. El servidor sigue mandando, así que el gate pide los ajustes igual **cuando el espejo está vacío**, y cuando el espejo dice que sí no pide nada.

- [ ] **Step 1: Escribe el gate**

Crea `components/first-run/first-run-gate.tsx`:

```tsx
"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { useAuth } from "@/context/auth-context";
import {
  escribirEspejo,
  estaOnboardado,
  fijarPrimerInicio,
  leerEspejo,
} from "@/lib/first-run";
import { getMySettingsService } from "@/services/settings.service";

/**
 * Primer inicio guiado (spec §7.1): manda a `/welcome` a quien todavía no tiene
 * `onboarded_at`.
 *
 * NO envuelve a nadie ni bloquea el render: pinta `null` y decide en un efecto.
 * Envolver habría puesto una espera a `GET /me/settings` delante de cada
 * página del hub —o un parpadeo en cada carga, porque el espejo no se puede
 * leer en el render del servidor sin romper la hidratación— a cambio de nada:
 * quien no está onboardado se va igual, y quien sí lo está no debe esperar.
 *
 * El espejo `dots-onboarded` es solo un atajo para ahorrarse el fetch; la
 * verdad vive en el servidor, igual que con paleta, modo y sonido.
 */
export default function FirstRunGate() {
  const router = useRouter();
  const { isBootstrapping, accessToken } = useAuth();

  useEffect(() => {
    // Sin sesión resuelta no hay a quién preguntar; `lib/api-client.ts` ya se
    // encarga de expulsar al login cuando el refresh falla.
    if (isBootstrapping || !accessToken) return;

    if (leerEspejo()) {
      fijarPrimerInicio("hecho");
      return;
    }

    let activo = true;
    getMySettingsService().then((settings) => {
      if (!activo) return;
      if (estaOnboardado(settings)) {
        // También cuando `settings` es null (fetch fallido): fallar abierto.
        if (settings) escribirEspejo();
        fijarPrimerInicio("hecho");
        return;
      }
      fijarPrimerInicio("pendiente");
      router.replace("/welcome");
    });

    return () => {
      activo = false;
    };
  }, [isBootstrapping, accessToken, router]);

  return null;
}
```

- [ ] **Step 2: Móntalo en el layout del hub**

En `app/(app)/(hub)/layout.tsx`, añade el import junto a los otros:

```tsx
import FirstRunGate from "@/components/first-run/first-run-gate";
```

y el componente justo **después** de `<ThemeSync />` y **antes** de `<DotyEntrada />`, con su comentario:

```tsx
      {/* Reconcilia paleta/modo con /me/settings tras el primer paint. */}
      <ThemeSync />
      {/* Primer inicio (spec §7.1): manda a /welcome a quien no tiene
          onboarded_at. No envuelve nada: pinta null y decide en un efecto. */}
      <FirstRunGate />
```

- [ ] **Step 3: Aparta al Camino mientras el primer inicio esté pendiente**

En `components/path/path-container.tsx`, añade el import:

```tsx
import { estadoPrimerInicio } from "@/lib/first-run";
```

y sustituye el efecto de las líneas 132-134 (el que hoy dice `if (path?.placementPending) router.replace("/onboarding");`) por:

```tsx
  useEffect(() => {
    // El gate del primer inicio corre en paralelo y también redirige: mientras
    // su veredicto sea "pendiente" este se aparta, para que una cuenta nueva
    // vea la bienvenida ANTES del placement y no al revés. Con "desconocido"
    // —el fetch de ajustes aún no volvió, o falló— se redirige como siempre:
    // fallar abierto es preferible a dejar a alguien sin placement.
    if (path?.placementPending && estadoPrimerInicio() !== "pendiente") {
      router.replace("/onboarding");
    }
  }, [path?.placementPending, router]);
```

Deja intacto el comentario que ya explica el fail-open de `placementPending` justo encima del efecto.

- [ ] **Step 4: El logout borra el espejo nuevo**

En `context/auth-context.tsx`, dentro de `logout`, donde hoy se borran los cuatro espejos (`PALETTE_KEY`, `MODE_KEY`, `SOUND_KEY`, `DIRTY_KEY`), añade el quinto. Importa `borrarEspejo` de `@/lib/first-run` y llámalo en el mismo bloque `try` que los otros, con esta línea de comentario encima:

```ts
      // El primer inicio también es del usuario: en un equipo compartido, el
      // siguiente en entrar tiene que pasar por su propia bienvenida.
      borrarEspejo();
```

- [ ] **Step 5: Verifica**

```bash
source ~/.nvm/nvm.sh && nvm use && npm run lint && npx tsc --noEmit && npm run test:scripts
```

Esperado: lint limpio, sin errores de tipos, 71/71. Si el lint del compiler de React se queja del efecto del gate, el arreglo va en el componente: el efecto solo debe llamar a funciones y registrar callbacks de promesa, nunca a un `setState` directo (aquí no hay ninguno).

- [ ] **Step 6: Commit**

```bash
git add components/first-run/first-run-gate.tsx "app/(app)/(hub)/layout.tsx" components/path/path-container.tsx context/auth-context.tsx
git commit -m "feat(primer-inicio): el hub manda a /welcome a quien no tiene onboarded_at

El Camino deja de competir por la redirección mientras el primer inicio esté
pendiente, y el logout borra también el espejo nuevo.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 3: La ruta `/welcome`, su máquina de tres pasos y la pantalla 1

**Files:**
- Modify: `components/ui/doty/doty.tsx:9` (tipo `DotySize`), `:37-50` (`SIZE_PX`), `:52-66` (`sizeClass`)
- Create: `components/first-run/welcome-hello.tsx`
- Create: `app/(app)/welcome/page.tsx`

**Interfaces:**
- Consumes: de `lib/first-run.ts` (Task 1) `escribirEspejo`, `fijarPrimerInicio`, `rutaTrasBienvenida`; `getPlacementStatusService` de `services/placement.service.ts`; `patchMySettingsService` de `services/settings.service.ts`; `postMyAvatarService` de `services/settings.service.ts`; `getShopService` de `services/shop.service.ts`; `useAuth`.
- Produces (lo consumen las Tasks 4 y 5): de `welcome-hello.tsx`, `export default function WelcomeHello({ onNext }: { onNext: () => void })`. De la página, los contratos que las Tasks 4 y 5 rellenan: `<WelcomeTheme prefs={prefs} sound={sound} onPrefs={(p: ThemePrefs) => void} onSound={(on: boolean) => void} onNext={() => void} />` y `<WelcomeAvatar items={ShopItem[]} pickedKey={string | null} onPick={(key: string) => void} onFinish={() => void} busy={boolean} />`. En esta tarea la página monta solo la pantalla 1 y deja las otras dos como pasos vacíos que las tareas siguientes llenan; **no inventes esas pantallas aquí**.
- El tamaño nuevo de Doty: `"bienvenida"` en `DotySize`, `SIZE_PX.bienvenida = 170`, clase `w-[170px]`.

Contexto para esta tarea: `/welcome` es una ruta **inmersiva**, o sea que cuelga de `app/(app)/welcome/` y **no** del grupo `(hub)`: así no hereda nav ni HUD (la misma regla por la que `/onboarding` vive donde vive). El spec pide Doty `saludando` a 170 px, un tamaño que no existe; se añade al registro igual que se añadió `dorso`.

La página es la dueña del estado del flujo: el paso actual, las preferencias elegidas, el avatar elegido y el cierre. Las tres pantallas son presentacionales.

**Cierre del flujo** (lo mismo para "terminar" y para "saltar", con distintos valores):
1. `patchMySettingsService({ palette, mode, sound, onboarded: true })` — el juego completo, como hace la hoja de ajustes, más la marca. **Nunca mandes `avatar_key` en este PATCH: la ruta lo rechaza con 400.**
2. Si hay avatar elegido, `postMyAvatarService(key)`.
3. `escribirEspejo()` y `fijarPrimerInicio("hecho")`.
4. `getPlacementStatusService()` y `router.replace(rutaTrasBienvenida(status))`.

Los pasos 1 y 2 van en ese orden y en secuencia: si el avatar falla (por ejemplo porque el sembrado todavía no se aplicó y no hay ítems), el primer inicio **igual queda cerrado** y el usuario entra a la app; lo contrario lo dejaría en un bucle de bienvenida.

- [ ] **Step 1: Añade el tamaño `bienvenida` a Doty**

En `components/ui/doty/doty.tsx`, tres ediciones. El tipo:

```ts
export type DotySize = "micro" | "mini" | "small" | "tiny" | "smaller" | "medium" | "big" | "chip" | "section" | "banner" | "dorso" | "bienvenida";
```

En `SIZE_PX`, después de `dorso: 68,`:

```ts
  // bienvenida: Doty saludando en la primera pantalla del primer inicio (spec §7.2).
  bienvenida: 170,
```

En `sizeClass`, después de la entrada de `dorso`:

```ts
  bienvenida: "w-[170px]",
```

- [ ] **Step 2: Escribe la pantalla 1**

Crea `components/first-run/welcome-hello.tsx`:

```tsx
"use client";

import Doty from "@/components/ui/doty/doty";

/**
 * Pantalla 1 del primer inicio (spec §7.2): Doty se presenta. El copy es
 * literal del spec y de la tabla de voz de docs/brand/doty-identity.md.
 */
interface Props {
  onNext: () => void;
}

export default function WelcomeHello({ onNext }: Props) {
  return (
    <div className="flex flex-col items-center gap-5 text-center">
      <Doty pose="saludando" size="bienvenida" animation="wave" say="¡Hola! Soy Doty. Tu coach de inglés." />
      <h1 className="font-display text-3xl font-extrabold text-foreground">Prometo no regañarte.</h1>
      <p className="max-w-sm text-base font-semibold text-(--muted)">
        Ni cuando te equivoques. Sobre todo cuando te equivoques. Vamos a armar tu dots en tres toques.
      </p>
      <button
        type="button"
        onClick={onNext}
        className="dots-pressable mt-2 w-full max-w-xs rounded-2xl px-6 py-3.5 text-base font-black transition-transform duration-150 active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--accent)"
        style={{ background: "var(--accent)", color: "var(--accent-contrast)" }}
      >
        Vamos
      </button>
    </div>
  );
}
```

- [ ] **Step 3: Escribe la página con la máquina de pasos**

Crea `app/(app)/welcome/page.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import WelcomeHello from "@/components/first-run/welcome-hello";
import Spinner from "@/components/ui/Spinner/Spinner";
import { useAuth } from "@/context/auth-context";
import { escribirEspejo, fijarPrimerInicio, rutaTrasBienvenida } from "@/lib/first-run";
import { readSoundEnabled, writeSoundEnabled } from "@/lib/sound-prefs";
import {
  applyThemePrefs,
  markSettingsDirty,
  readMirror,
  writeMirror,
  type ThemePrefs,
} from "@/lib/theme-prefs";
import { getPlacementStatusService } from "@/services/placement.service";
import { patchMySettingsService, postMyAvatarService } from "@/services/settings.service";
import { getShopService, type ShopItem } from "@/services/shop.service";

/**
 * Primer inicio guiado (spec §7.2): tres pantallas antes de ver la app.
 *
 * Ruta INMERSIVA — vive fuera del grupo (hub), así que no hereda nav ni HUD.
 * Los pasos van en estado, no en la URL: el flujo dura tres toques y no hay
 * nada que compartir ni a lo que volver con el botón atrás.
 *
 * La página es la dueña del estado; las tres pantallas son presentacionales.
 */
type Paso = 1 | 2 | 3;

export default function WelcomePage() {
  const router = useRouter();
  const { isBootstrapping, accessToken } = useAuth();

  const [paso, setPaso] = useState<Paso>(1);
  const [prefs, setPrefs] = useState<ThemePrefs>(() => ({ palette: "rosa", mode: "auto" }));
  const [sound, setSound] = useState(true);
  const [avatares, setAvatares] = useState<ShopItem[]>([]);
  const [elegido, setElegido] = useState<string | null>(null);
  const [cerrando, setCerrando] = useState(false);

  // Arranca de lo que ya hubiera: quien llega con espejo (otro dispositivo,
  // sesión anterior) no ve saltar sus colores al entrar.
  useEffect(() => {
    setPrefs(readMirror());
    setSound(readSoundEnabled());
  }, []);

  // Los seis gratis para la pantalla 3. Mismo filtro que el perfil: gratis o
  // ya comprado. Si el sembrado todavía no se aplicó, llega vacío y la
  // pantalla 3 lo dice sin romperse.
  useEffect(() => {
    if (isBootstrapping || !accessToken) return;
    let activo = true;
    getShopService().then((shop) => {
      if (activo) {
        setAvatares(shop.items.filter((i) => i.kind === "avatar" && (i.price === 0 || i.owned)));
      }
    });
    return () => {
      activo = false;
    };
  }, [isBootstrapping, accessToken]);

  // Cada cambio de tema se aplica en vivo a esta misma pantalla (spec §7.2).
  const cambiarPrefs = (siguiente: ThemePrefs) => {
    setPrefs(siguiente);
    writeMirror(siguiente);
    applyThemePrefs(siguiente);
  };

  const cambiarSonido = (on: boolean) => {
    setSound(on);
    writeSoundEnabled(on);
  };

  /**
   * Cierra el primer inicio. `avatarKey` es null al saltar sin elegir.
   * El PATCH manda el juego completo, como la hoja de ajustes, más la marca
   * `onboarded`. NUNCA lleva `avatar_key`: esa ruta lo rechaza con 400 y el
   * avatar se equipa con POST /me/avatar.
   */
  const cerrar = (avatarKey: string | null) => {
    if (cerrando) return;
    setCerrando(true);
    markSettingsDirty();
    patchMySettingsService({ palette: prefs.palette, mode: prefs.mode, sound, onboarded: true })
      .then(() => (avatarKey ? postMyAvatarService(avatarKey).then(() => undefined) : undefined))
      .catch(() => {
        // Si el avatar falla —por ejemplo, con la tienda todavía sin sembrar—
        // el primer inicio igual queda cerrado: lo contrario deja al usuario
        // dando vueltas por la bienvenida. El perfil permite cambiarlo luego.
      })
      .then(() => {
        escribirEspejo();
        fijarPrimerInicio("hecho");
        return getPlacementStatusService();
      })
      .then((status) => router.replace(rutaTrasBienvenida(status)))
      .catch(() => router.replace("/levels"));
  };

  /** Saltar (spec §7.1): Rosa, Auto, sonido activado y un avatar gratis al azar. */
  const saltar = () => {
    const defecto: ThemePrefs = { palette: "rosa", mode: "auto" };
    cambiarPrefs(defecto);
    cambiarSonido(true);
    const alAzar = avatares.length > 0 ? avatares[Math.floor(Math.random() * avatares.length)].key : null;
    cerrar(alAzar);
  };

  if (isBootstrapping) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner title="Cargando…" />
      </div>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-lg flex-col items-center justify-center gap-6 px-5 py-10">
      {paso === 1 && <WelcomeHello onNext={() => setPaso(2)} />}

      {/* Los pasos 2 y 3 los montan las tareas siguientes de este plan. */}

      <button
        type="button"
        onClick={saltar}
        disabled={cerrando}
        className="text-sm font-extrabold text-(--muted) transition-transform duration-150 active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--accent) disabled:opacity-50"
      >
        Saltar
      </button>
    </main>
  );
}
```

Nota para el implementador: los `useState` de `prefs`, `sound`, `avatares`, `elegido` y las funciones `cambiarPrefs`, `cambiarSonido`, `cerrar` quedan definidos aquí aunque las pantallas que los usan lleguen en las Tasks 4 y 5. `elegido` y `avatares` todavía no se leen en el JSX: si el lint marca una variable sin usar, **no la borres** — pon el paso 3 en su sitio en la Task 5. Si el lint bloquea el commit, deja el `elegido`/`avatares` conectados con la pantalla que corresponde en esa tarea y **anótalo en el informe**; no inventes la pantalla antes de tiempo.

- [ ] **Step 4: Verifica**

```bash
source ~/.nvm/nvm.sh && nvm use && npm run lint && npx tsc --noEmit && npm run test:scripts
```

Esperado: limpio y 71/71.

- [ ] **Step 5: Commit**

```bash
git add components/ui/doty/doty.tsx components/first-run/welcome-hello.tsx "app/(app)/welcome/page.tsx"
git commit -m "feat(primer-inicio): ruta /welcome con la máquina de tres pasos y la pantalla de saludo

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 4: Pantalla 2 — tema, modo y sonido con vista previa real

**Files:**
- Create: `components/first-run/palette-preview.tsx`
- Create: `components/first-run/welcome-theme.tsx`
- Modify: `app/(app)/welcome/page.tsx` (monta el paso 2)

**Interfaces:**
- Consumes: `PALETTES`, `PALETTE_LABELS`, `PALETTE_ACCENTS`, `THEME_COLORS`, `type Palette` de `lib/theme-colors.ts` (generado); `type ThemeMode`, `type ThemePrefs` de `lib/theme-prefs.ts`; las funciones `cambiarPrefs`/`cambiarSonido` que la página ya tiene (Task 3).
- Produces (lo consume la página): `export default function PalettePreview({ palette, mode }: { palette: Palette; mode: "light" | "dark" })` y `export default function WelcomeTheme({ prefs, sound, onPrefs, onSound, onNext }: { prefs: ThemePrefs; sound: boolean; onPrefs: (p: ThemePrefs) => void; onSound: (on: boolean) => void; onNext: () => void })`.

Contexto para esta tarea: **la vista previa no puede usar CSS anidado.** Los bloques generados en `app/themes.generated.css` usan `:root[data-palette]`, y `:root` solo casa con `<html>`: poner `data-palette="electrico"` en un `<div>` no hereda ni un token. Por eso el generador ya emite los dos colores que hacen falta como **dato** (`THEME_COLORS` = el `--background` de cada paleta y modo, `PALETTE_ACCENTS` = su `--accent`), y de ahí salen las superficies del preview por `color-mix`. Ese fue justo el motivo por el que el subproyecto D añadió `PALETTE_ACCENTS`.

**El modo resuelto se lee del DOM, nunca de `matchMedia` en el render** (regla 12). `applyThemePrefs` mantiene `<html class="dark">` al día en cada cambio, así que basta con mirar esa clase con `useSyncExternalStore`, que es exactamente lo que hace `components/profile/settings-sheet.tsx:55-58`.

- [ ] **Step 1: Escribe la miniatura**

Crea `components/first-run/palette-preview.tsx`:

```tsx
"use client";

import { PALETTE_ACCENTS, THEME_COLORS, type Palette } from "@/lib/theme-colors";

/**
 * Vista previa real de una paleta (spec §7.2): un trozo de HUD y un nodo del
 * Camino pintados con los colores de esa paleta y ese modo.
 *
 * Los colores llegan como DATO y no por CSS heredado a propósito: los bloques
 * de app/themes.generated.css usan `:root[data-palette]`, que solo casa con
 * <html>, así que un envoltorio anidado no heredaría nada. El generador emite
 * THEME_COLORS (el --background) y PALETTE_ACCENTS (el --accent) justo para
 * estos casos; el resto de superficies sale de mezclar esos dos.
 */
interface Props {
  palette: Palette;
  /** Modo YA resuelto: "auto" no llega hasta aquí. */
  mode: "light" | "dark";
}

export default function PalettePreview({ palette, mode }: Props) {
  const fondo = THEME_COLORS[palette][mode];
  const acento = PALETTE_ACCENTS[palette][mode];
  const superficie = `color-mix(in srgb, ${acento} 8%, ${fondo})`;
  const borde = `color-mix(in srgb, ${acento} 22%, ${fondo})`;

  return (
    <span
      aria-hidden
      className="flex h-20 w-full flex-col justify-between overflow-hidden rounded-xl p-2"
      style={{ background: fondo, border: `1.5px solid ${borde}` }}
    >
      {/* HUD: barra de progreso y dos pastillas */}
      <span className="flex items-center gap-1.5">
        <span className="h-1.5 flex-1 rounded-full" style={{ background: borde }}>
          <span className="block h-full w-2/3 rounded-full" style={{ background: acento }} />
        </span>
        <span className="h-2.5 w-2.5 rounded-full" style={{ background: acento }} />
      </span>
      {/* Nodo del Camino: círculo lleno y su sombra dura */}
      <span className="flex items-end justify-center gap-2">
        <span
          className="h-7 w-7 rounded-full"
          style={{ background: acento, boxShadow: `0 3px 0 ${borde}` }}
        />
        <span className="mb-1 h-4 w-10 rounded-md" style={{ background: superficie, border: `1.5px solid ${borde}` }} />
      </span>
    </span>
  );
}
```

- [ ] **Step 2: Escribe la pantalla 2**

Crea `components/first-run/welcome-theme.tsx`:

```tsx
"use client";

import { useSyncExternalStore } from "react";

import PalettePreview from "@/components/first-run/palette-preview";
import { Icon } from "@/components/ui/icon";
import { PALETTES, PALETTE_LABELS } from "@/lib/theme-colors";
import type { ThemeMode, ThemePrefs } from "@/lib/theme-prefs";

/**
 * Pantalla 2 del primer inicio (spec §7.2): paleta, modo y sonido, con la
 * elección aplicada en vivo a esta misma pantalla.
 *
 * El modo resuelto se lee del DOM y nunca de `matchMedia` en el render
 * (regla 12): `applyThemePrefs` mantiene `<html class="dark">` al día, así que
 * mirar esa clase basta y no rompe la hidratación. Mismo patrón que la hoja de
 * ajustes.
 */
const MODOS: { key: ThemeMode; label: string }[] = [
  { key: "light", label: "Claro" },
  { key: "dark", label: "Oscuro" },
  { key: "auto", label: "Auto" },
];

function sinSuscripcion(): () => void {
  return () => {};
}

function modoDelDom(): "light" | "dark" {
  return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

function modoDelServidor(): "light" | "dark" {
  return "light";
}

interface Props {
  prefs: ThemePrefs;
  sound: boolean;
  onPrefs: (prefs: ThemePrefs) => void;
  onSound: (on: boolean) => void;
  onNext: () => void;
}

export default function WelcomeTheme({ prefs, sound, onPrefs, onSound, onNext }: Props) {
  const resuelto = useSyncExternalStore(sinSuscripcion, modoDelDom, modoDelServidor);

  return (
    <div className="flex w-full flex-col items-center gap-5 text-center">
      <div className="flex flex-col gap-1.5">
        <h1 className="font-display text-2xl font-extrabold text-foreground">¿Cómo lo quieres ver?</h1>
        <p className="text-sm font-semibold text-(--muted)">Doty siempre es rosa. Lo demás, tú decides.</p>
      </div>

      {/* Paletas, con su vista previa */}
      <ul className="grid w-full grid-cols-2 gap-3">
        {PALETTES.map((p) => {
          const on = prefs.palette === p;
          return (
            <li key={p}>
              <button
                type="button"
                onClick={() => onPrefs({ ...prefs, palette: p })}
                aria-pressed={on}
                className="flex w-full flex-col gap-2 rounded-2xl p-2 transition-transform duration-150 active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--accent)"
                style={{
                  background: on ? "color-mix(in srgb, var(--accent) 10%, transparent)" : "var(--surface-2)",
                  border: on ? "2px solid var(--accent)" : "2px solid transparent",
                }}
              >
                <PalettePreview palette={p} mode={resuelto} />
                <span
                  className="flex items-center justify-center gap-1 text-xs font-extrabold"
                  style={{ color: on ? "var(--accent)" : "var(--foreground)" }}
                >
                  {PALETTE_LABELS[p]}
                  <span className="h-4 w-4">{on && <Icon name="check" size={16} mono />}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      {/* Modo */}
      <div className="flex w-full rounded-2xl p-1" style={{ background: "var(--surface-2)" }}>
        {MODOS.map((m) => {
          const on = prefs.mode === m.key;
          return (
            <button
              key={m.key}
              type="button"
              onClick={() => onPrefs({ ...prefs, mode: m.key })}
              aria-pressed={on}
              className="flex-1 rounded-xl py-2 text-sm font-extrabold transition-transform duration-150 active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--accent)"
              style={{
                background: on ? "var(--accent)" : "transparent",
                color: on ? "var(--accent-contrast)" : "var(--muted)",
              }}
            >
              {m.label}
            </button>
          );
        })}
      </div>

      {/* Sonido */}
      <button
        type="button"
        onClick={() => onSound(!sound)}
        aria-pressed={sound}
        className="flex w-full items-center justify-between rounded-2xl px-4 py-3 text-left transition-transform duration-150 active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--accent)"
        style={{ background: "var(--surface-2)" }}
      >
        <span className="flex flex-col">
          <span className="text-sm font-extrabold text-foreground">Sonidos</span>
          <span className="text-xs font-semibold text-(--muted)">Aciertos, fallos y celebraciones</span>
        </span>
        <span
          className="flex h-7 w-12 shrink-0 items-center rounded-full p-1 transition-colors"
          style={{ background: sound ? "var(--accent)" : "var(--border)" }}
        >
          <span
            className="h-5 w-5 rounded-full transition-transform duration-150"
            style={{ background: "var(--surface)", transform: sound ? "translateX(20px)" : "translateX(0)" }}
          />
        </span>
      </button>

      <button
        type="button"
        onClick={onNext}
        className="dots-pressable w-full max-w-xs rounded-2xl px-6 py-3.5 text-base font-black transition-transform duration-150 active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--accent)"
        style={{ background: "var(--accent)", color: "var(--accent-contrast)" }}
      >
        Este me gusta
      </button>
    </div>
  );
}
```

- [ ] **Step 3: Monta el paso 2 en la página**

En `app/(app)/welcome/page.tsx`, añade el import:

```tsx
import WelcomeTheme from "@/components/first-run/welcome-theme";
```

y sustituye el comentario `{/* Los pasos 2 y 3 los montan las tareas siguientes de este plan. */}` por:

```tsx
      {paso === 2 && (
        <WelcomeTheme
          prefs={prefs}
          sound={sound}
          onPrefs={cambiarPrefs}
          onSound={cambiarSonido}
          onNext={() => setPaso(3)}
        />
      )}

      {/* El paso 3 lo monta la tarea siguiente de este plan. */}
```

- [ ] **Step 4: Verifica**

```bash
source ~/.nvm/nvm.sh && nvm use && npm run lint && npx tsc --noEmit && npm run test:scripts
```

Esperado: limpio y 71/71.

- [ ] **Step 5: Commit**

```bash
git add components/first-run/palette-preview.tsx components/first-run/welcome-theme.tsx "app/(app)/welcome/page.tsx"
git commit -m "feat(primer-inicio): pantalla de tema con vista previa real de cada paleta

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 5: Pantalla 3 — el avatar y el cierre del flujo

**Files:**
- Create: `components/first-run/welcome-avatar.tsx`
- Modify: `app/(app)/welcome/page.tsx` (monta el paso 3)

**Interfaces:**
- Consumes: `Avatar` (default) de `components/ui/avatar/avatar.tsx`; `type PublicAvatar` de `lib/avatar.ts`; `type ShopItem` de `services/shop.service.ts`; `Doty` para el estado vacío; las funciones `cerrar` y el estado `avatares`/`elegido`/`cerrando` que la página ya tiene (Task 3).
- Produces: `export default function WelcomeAvatar({ items, pickedKey, onPick, onFinish, busy }: { items: ShopItem[]; pickedKey: string | null; onPick: (key: string) => void; onFinish: () => void; busy: boolean })`.

Contexto para esta tarea: los avatares son `shop_items` con `kind='avatar'`; su retrato está en `img` y su color y nombre visible en `meta` (`{ color, label }`). Se pintan con `<Avatar>` a **86 px** (spec §7.2). **Ojo, cambió el 2026-09-17 en `main`**: el avatar ya NO lleva marco circular ni anillo del acento — el retrato flota y lo apoya una sombra teñida con su propio color, que `<Avatar>` calcula sola a partir del tamaño. No hay nada que añadir ni que envolver: pasa `avatar` y `size` y ya.

**El estado vacío importa de verdad**: los seis avatares se siembran con un script de base de datos que corre Sergio, y hasta que lo haga `GET /shop` no trae ninguno. Con la lista vacía la pantalla no puede quedarse muda ni bloquear el botón: enseña a Doty, explica que el avatar se elige luego en el perfil, y el botón cierra el flujo igual.

- [ ] **Step 1: Escribe la pantalla 3**

Crea `components/first-run/welcome-avatar.tsx`:

```tsx
"use client";

import Avatar from "@/components/ui/avatar/avatar";
import Doty from "@/components/ui/doty/doty";
import { Icon } from "@/components/ui/icon";
import type { PublicAvatar } from "@/lib/avatar";
import type { ShopItem } from "@/services/shop.service";

/**
 * Pantalla 3 del primer inicio (spec §7.2): los seis avatares gratis a 86 px.
 *
 * La lista puede llegar VACÍA mientras el sembrado de `shop_items` no se haya
 * aplicado en producción. Ese caso no bloquea: se explica y el botón cierra el
 * primer inicio igual, porque el backend resuelve `clasico` por su cuenta y el
 * perfil permite cambiarlo después.
 */
interface Props {
  items: ShopItem[];
  pickedKey: string | null;
  onPick: (key: string) => void;
  onFinish: () => void;
  busy: boolean;
}

/** `meta` es jsonb libre: lo que no venga con la forma esperada cae a algo usable. */
function etiqueta(item: ShopItem): string {
  const label = item.meta?.label;
  return typeof label === "string" && label.length > 0 ? label : item.name;
}

function comoAvatar(item: ShopItem): PublicAvatar {
  const color = item.meta?.color;
  return {
    img: item.img ?? "",
    color: typeof color === "string" && color.length > 0 ? color : "#FF1F8F",
  };
}

export default function WelcomeAvatar({ items, pickedKey, onPick, onFinish, busy }: Props) {
  const elegido = items.find((i) => i.key === pickedKey) ?? null;

  return (
    <div className="flex w-full flex-col items-center gap-5 text-center">
      <div className="flex flex-col gap-1.5">
        <h1 className="font-display text-2xl font-extrabold text-foreground">Elige tu Doty</h1>
        <p className="text-sm font-semibold text-(--muted)">Es tu cara en el ranking y en el Camino.</p>
      </div>

      {items.length === 0 ? (
        <div className="flex flex-col items-center gap-3">
          <Doty pose="pensando" size="small" />
          <p className="max-w-xs text-sm font-semibold text-(--muted)">
            Los avatares llegan en un momento. Puedes elegir el tuyo desde tu perfil cuando quieras.
          </p>
        </div>
      ) : (
        <ul className="grid w-full grid-cols-3 gap-3">
          {items.map((item) => {
            const on = item.key === pickedKey;
            return (
              <li key={item.key}>
                <button
                  type="button"
                  onClick={() => onPick(item.key)}
                  aria-pressed={on}
                  className="flex w-full flex-col items-center gap-1.5 rounded-2xl px-1 py-2.5 transition-transform duration-150 active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--accent)"
                  style={{
                    background: on ? "color-mix(in srgb, var(--accent) 10%, transparent)" : "transparent",
                    border: on ? "2px solid var(--accent)" : "2px solid transparent",
                  }}
                >
                  {/* 86 px (spec §7.2): sin marco, la sombra teñida la pone <Avatar>. */}
                  <Avatar avatar={comoAvatar(item)} size={86} />
                  <span
                    className="line-clamp-1 text-[11px] font-extrabold"
                    style={{ color: on ? "var(--accent)" : "var(--foreground)" }}
                  >
                    {etiqueta(item)}
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

      <button
        type="button"
        onClick={onFinish}
        disabled={busy}
        className="dots-pressable w-full max-w-xs rounded-2xl px-6 py-3.5 text-base font-black transition-transform duration-150 active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--accent) disabled:opacity-60"
        style={{ background: "var(--accent)", color: "var(--accent-contrast)" }}
      >
        {elegido ? `Listo, soy ${etiqueta(elegido)}` : "Listo"}
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Monta el paso 3 en la página**

En `app/(app)/welcome/page.tsx`, añade el import:

```tsx
import WelcomeAvatar from "@/components/first-run/welcome-avatar";
```

y sustituye el comentario `{/* El paso 3 lo monta la tarea siguiente de este plan. */}` por:

```tsx
      {paso === 3 && (
        <WelcomeAvatar
          items={avatares}
          pickedKey={elegido}
          onPick={setElegido}
          onFinish={() => cerrar(elegido)}
          busy={cerrando}
        />
      )}
```

- [ ] **Step 3: Verifica el flujo completo**

```bash
source ~/.nvm/nvm.sh && nvm use && npm run lint && npx tsc --noEmit && npm run test:scripts && npx next build
```

Esperado: lint limpio, sin errores de tipos, 71/71 y build verde con `/welcome` compilada. El build tarda un par de minutos; déjalo terminar.

- [ ] **Step 4: Commit**

```bash
git add components/first-run/welcome-avatar.tsx "app/(app)/welcome/page.tsx"
git commit -m "feat(primer-inicio): pantalla de avatar y cierre del flujo con onboarded y POST /me/avatar

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 6: Documentación — la spec se corrige y la arquitectura registra el primer inicio

**Files:**
- Modify: `docs/superpowers/specs/2026-09-14-rediseno-look-and-feel-juvenil-design.md` (§7.1 y §7.3)
- Modify: `docs/ARQUITECTURA.md`

**Interfaces:** ninguna; es documentación.

Contexto para esta tarea: la spec tiene **un error de hecho** que este plan descubrió midiendo el backend, y **una pista sin objetivo** que dejó el subproyecto C. Los dos se corrigen aquí, con la fecha, porque la spec es la autoridad de la que vivirá F.2.

- [ ] **Step 1: Corrige el §7.1**

En `docs/superpowers/specs/2026-09-14-rediseno-look-and-feel-juvenil-design.md`, sustituye estas dos líneas exactas:

```
- Al terminar (o saltar), `PATCH /me/settings` con `palette`, `mode`, `sound`, `avatar_key` y
  `onboarded_at`; después, `/onboarding` si `placementPending`, si no `/levels`.
```

por:

```
- Al terminar (o saltar), `PATCH /me/settings` con `palette`, `mode`, `sound` y `onboarded: true`
  (el backend estampa `onboarded_at` una sola vez), y el avatar por `POST /me/avatar { key }`.
  **Corregido el 2026-09-17**: `avatar_key` NO es un campo de `PatchSettingsDto` y esa ruta corre
  con `forbidNonWhitelisted`, así que mandarlo ahí devuelve 400. Después, `/onboarding` si el
  placement se puede tomar o está activo, si no `/levels`.
- **El backend ya estaba listo**: `onboarded` y `tips_seen` existían en el DTO y en `mergeSettings`
  desde el subproyecto D, así que F no toca `dots-backend`.
```

- [ ] **Step 2: Anota la pista huérfana y la partición de F en el §7.3**

Sustituye estas tres líneas exactas:

```
- Claves en `settings.tips_seen`: `camino.primer-nivel`, `camino.racha`, `arcade.diarios`,
  `arcade.trono`, `repaso.que-es`, `retos.torneo`, `perfil.avatar`. Máximo dos por pestaña, solo
  en la primera visita; "Entendido" hace `PATCH` acumulativo.
```

por:

```
- Claves en `settings.tips_seen`: `camino.primer-nivel`, `camino.racha`, `arcade.diarios`,
  `repaso.que-es`, `retos.torneo`, `perfil.avatar`. Máximo dos por pestaña, solo en la primera
  visita; "Entendido" hace `PATCH` acumulativo. **`arcade.trono` se cae (2026-09-17)**: el
  subproyecto C retiró el trono y su icono de corona a petición de Sergio, así que esa pista se
  quedó sin objetivo al que apuntar.
- **F va en dos planes (2026-09-17)**: F.1 es el primer inicio de 7.1 y 7.2
  (`docs/superpowers/plans/2026-09-17-rediseno-f1-primer-inicio.md`); F.2 son estas pistas, que
  tocan cinco pantallas distintas y no comparten código con aquello.
```

- [ ] **Step 3: Registra el primer inicio en la arquitectura**

En `docs/ARQUITECTURA.md`, inserta esta sección completa **justo antes** de la línea `### El perfil (`/profile`)`, dejando una línea en blanco antes y después:

```
### Primer inicio (`/welcome`)

Ruta inmersiva (fuera del grupo `(hub)`, sin nav ni HUD) con las tres pantallas que
ve una cuenta nueva: saludo de Doty, tema —paleta, modo y sonido, con vista previa
real de cada paleta— y avatar. La página es la dueña del estado; las tres pantallas
de `components/first-run/` son presentacionales. Al cerrar manda el juego completo
de preferencias con `onboarded: true` y equipa el avatar con `POST /me/avatar`
(nunca con el PATCH, que rechaza `avatar_key`), y de ahí sale a placement o al
Camino.

Quién llega ahí lo decide `FirstRunGate`, montado en el layout del hub junto a
`ThemeSync`: pide `/me/settings` y redirige cuando `onboarded_at` es `null`. No
envuelve ni bloquea nada —pinta `null` y decide en un efecto— y usa el espejo
local `dots-onboarded` para saltarse el fetch de quien ya pasó. La lógica pura
está en `lib/first-run.ts`, bajo `node --test`.

El Camino también redirige por su cuenta cuando el placement está pendiente, así
que una cuenta nueva dispara las dos carreras a la vez. El gate publica su
veredicto en un flag de módulo de `lib/first-run.ts` y `path-container` se aparta
mientras valga «pendiente»; con «desconocido» redirige como siempre, porque fallar
abierto es preferible a dejar a alguien sin placement.
```

- [ ] **Step 4: Verifica**

```bash
source ~/.nvm/nvm.sh && nvm use && npm run lint
```

Esperado: limpio (la documentación no afecta al lint, pero confirma que nada se rompió por el camino).

- [ ] **Step 5: Commit**

```bash
git add docs/superpowers/specs/2026-09-14-rediseno-look-and-feel-juvenil-design.md docs/ARQUITECTURA.md
git commit -m "docs(primer-inicio): la spec corrige el avatar_key del §7.1 y retira la pista del trono

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

## Verificación en navegador (la hace Sergio; requiere sesión y los dos scripts aplicados)

Los implementadores no pueden iniciar sesión, y la pantalla 3 necesita que `scripts/seed-avatars.js` se haya aplicado. Cuando la rama esté revisada:

1. **Cuenta nueva** (invítate desde `/admin/users` → *Invitations*): al entrar tras el login, la app manda a `/welcome` sin pasar por el Camino ni por placement.
2. Las tres pantallas encadenan con «Vamos» y «Este me gusta»; en la 2, tocar Eléctrico repinta **la propia pantalla** en el acto, y las miniaturas muestran cada paleta con sus colores aunque la activa sea la otra.
3. Modo Claro/Oscuro/Auto cambian la pantalla en vivo; el interruptor de sonido se queda como lo dejes.
4. En la 3 salen los seis avatares a 86 px; el botón dice «Listo, soy Nerd» con el elegido.
5. Al cerrar: si la cuenta no tiene placement, cae en `/onboarding`; si ya lo tiene, en `/levels`. Recargar **no** vuelve a `/welcome`.
6. **Saltar** desde cualquiera de las tres deja Rosa, Auto, sonido activado y un avatar al azar, y cierra igual.
7. Cerrar sesión y volver a entrar con la **misma** cuenta no repite la bienvenida; con otra cuenta nueva en el mismo equipo, sí.
8. Una cuenta vieja (la tuya) no ve `/welcome` en ningún momento — ojo aquí: **todas las cuentas existentes tienen `onboarded_at` en `null`**, así que la verán una vez. Es lo que pide el spec §7.1 («aplica a todas las cuentas existentes»), pero conviene verlo en la tuya antes de dar por bueno el comportamiento.
9. En 390 px de ancho las tres pantallas caben sin scroll horizontal.

## Cobertura del spec

| Requisito (§7.1 y §7.2) | Tarea |
|---|---|
| Ruta `/welcome` fuera del hub | Task 3 |
| `FirstRunGate` en el layout del hub, `router.replace` con `onboarded_at` null | Task 2 |
| Aplica a todas las cuentas existentes | Task 2 (no hay excepción por antigüedad) |
| PATCH al terminar o saltar, y avatar por su ruta | Task 3 (`cerrar`), corregido en Task 6 |
| Después: placement o Camino | Task 1 (`rutaTrasBienvenida`) + Task 3 |
| «Saltar» siempre visible, con los defaults | Task 3 |
| Pantalla 1 (bocadillo, Doty 170, titular, texto, botón) | Task 3 |
| Pantalla 2 (paletas con vista previa real, modo, sonido, botón, en vivo) | Task 4 |
| Pantalla 3 (seis gratis a 86 px, botón con el nombre) | Task 5 |
| Criterio «menos de dos minutos» y defaults al saltar | verificación manual, puntos 2-6 |
| §7.3 pistas contextuales | **fuera**: subproyecto F.2 |
