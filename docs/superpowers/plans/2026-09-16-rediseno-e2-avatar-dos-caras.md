# Rediseño look & feel — Subproyecto E.2 (Avatar de dos caras, fase 1) — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** El avatar del perfil pasa a ser una carta de dos caras: el retrato al frente y, detrás, Doty haciendo el gesto equipado dentro del mismo disco; gira solo al entrar al perfil, gira al tocarlo (o al pasar el ratón), y el lápiz queda como único acceso al selector de avatar.

**Architecture:** Cero backend. La lógica de tiempos y la pose por gesto viven en un módulo puro `lib/avatar-flip.ts` bajo `node --test`. El disco se comparte: `components/ui/avatar/avatar.tsx` exporta `<AvatarDisc>` (el marco de siempre, hoy inline dentro de `<Avatar>`) y el dorso lo reutiliza con un `<Doty size="dorso">` al 70 % del diámetro. Un componente `components/profile/avatar-flip.tsx` monta las dos caras con `rotateY` + `backface-visibility` (mismo patrón que las cartas del juego de memoria), programa el giro de entrada con temporizadores y expone tap y hover. `profile-identity.tsx` lo usa y saca el lápiz a un botón hermano.

**Tech Stack:** Next.js 16 (app router) + React 19 + Tailwind 4; `node --test` para la lógica pura. Sin cambios en el backend ni en la base de datos.

**Spec:** `docs/superpowers/specs/2026-09-14-rediseno-look-and-feel-juvenil-design.md` — §5 (perfil), §6.1 (marco y tamaños), §6.2 ("los gestos se conservan") y §1 principio 5 (solo `transform`/`opacity`; `prefers-reduced-motion` conserva el feedback). El diseño de este plan se aprobó en conversación el 2026-09-16 y la Task 4 lo escribe en la spec como **§6.4**; hasta entonces, la sección «Diseño fijado» de abajo es la autoridad. La fase 2 (aviso "te pasó" con el gesto de quien te adelanta) y el perfil público **quedan fuera** y pendientes de decisión.

## Global Constraints

- `source ~/.nvm/nvm.sh && nvm use` antes de cualquier `node`/`npm` (Node 24 por `.nvmrc`). **Obligatorio**: sin eso el `node` del sistema no ejecuta los `.ts` que importan los `.test.mjs` y verás fallos falsos. Verificación final: `npm run lint && npm run test:scripts && npx next build`.
- Rama `redesign/e2-avatar-dos-caras` desde `main` (d2d56b0), en un worktree **fuera del checkout principal** `dots-webapp/`, donde vive el dev server de Sergio. **Sin push a origin.** Nunca escribas fuera de tu worktree. **Nunca uses `git stash`** (la pila es compartida entre worktrees): para ver otra versión de un archivo usa `git show <rev>:<ruta>`.
- Commits terminan con `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`.
- Regla 1: navegación con `router.push`, nunca `window.location.*` (este plan no navega).
- Regla 2 (RN-safe): el tap es la señal primaria; el hover es un extra de escritorio, nunca la única señal. Animación solo `transform`/`opacity`. Nada de `keydown` como input.
- Regla 3 (lint del compiler de React): prohibido `setState` síncrono en el cuerpo de un `useEffect`. Programar `setTimeout` cuyo callback hace `setState` sí está permitido. Prohibidos efectos colaterales dentro de updaters de `setState`.
- Regla 10: Doty solo con `<Doty pose=…>` y poses del registro generado (`components/ui/doty/poses.ts`). Las poses de este plan existen y tienen arte: `feliz`, `saludando`, `emocionado`. **Ningún PNG se copia a mano.**
- Regla 11: cero emoji como iconografía. El lápiz es `<Icon name="lapiz">`, que ya existe.
- Regla 12: no leer `matchMedia` en el render. Leerlo dentro de un efecto o de un manejador sí es correcto (así lo hace `lib/doty-transformacion.ts`).
- Copy de producto en español con tuteo, tono juguetón. Al hablar con Sergio, español neutro con tuteo.
- Módulos puros bajo test (`lib/*.ts`): **solo `import type`**, porque Node ejecuta el `.ts` sin bundler y no resolvería el alias `@/`. Los tests son `*.test.mjs` junto al módulo e importan `./x.ts` con extensión; `npm run test:scripts` los recoge por glob. **No toques `package.json`.**
- Sin librerías nuevas. Sin CSS nuevo en `app/globals.css`: las animaciones `doty-wave`/`doty-cheer` y el token `--ease-in-out-strong` ya existen.

---

## Contexto medido del código (leído el 2026-09-16, no re-investigar)

**Los gestos hoy.** Son dos `shop_items` de `kind='gesture'`, `slot='gesture'`: `gesture_wave` "Saludo" (400 gemas, `meta: { animation: 'wave' }`) y `gesture_cheer` "Festejo" (600 gemas, `meta: { animation: 'cheer' }`). Nadie posee ninguno (`user_items` vacía). En la webapp llegan como `InventoryItem { id, key, kind, name, img, slot, meta: Record<string, unknown> | null, equippedSlot }` (`services/shop.service.ts`). `lib/profile-view.ts` ya exporta `equippedGesture(items): InventoryItem | null` (el gesto puesto, o null) y `gestureItems(items)`; `equippedGesture` quedó sin uso desde E y este plan lo vuelve a usar.

**Dónde se veía el gesto y dónde se ve.** Hasta el subproyecto D el gesto animaba al Doty grande de la identidad (`<Doty pose="feliz" size="perfil" animation={gestureAnimation ?? "bob"}>`). E sustituyó ese Doty por `<Avatar>` (retrato estático) y borró el tamaño `perfil`. Hoy el gesto solo anima las miniaturas de 32 px de `components/profile/gestures-card.tsx`, que pinta `<Doty pose="feliz" size="micro" animation={item.meta?.animation ?? "none"}>` para **cada** gesto del inventario, equipado o no.

**Vocabulario de movimiento de Doty** (`components/ui/doty/doty.tsx` + `app/globals.css`): `DotyAnimation = "none" | "bob" | "cheer" | "sad" | "wave"`. Duración de una vuelta: `doty-bob` 2.2 s, `doty-cheer` 900 ms (salta 10 px y rota ±4°), `doty-sad` 3 s, `doty-wave` 1.6 s (rota −6°/+5°/−4°/+2° con `transform-origin: center bottom`). Todas `infinite` y todas vuelven a reposo en el 100 %. `DotySize` hoy: micro 32, mini 80, tiny 96, smaller 112, small 144, medium 192, big 352, chip 44, section 104, banner 158; cada tamaño tiene su `SIZE_PX` (alimenta `sizes` de `next/image`) y su clase Tailwind (`w-8`, `w-20`, …, `w-26`, `w-[158px]`). Tailwind 4 acepta cualquier entero en las utilidades de espaciado (`w-14` = 56 px, `w-17` = 68 px). `<Doty>` acepta `shadow={false}` para no pintar el `drop-shadow`.

**El marco del avatar** (`components/ui/avatar/avatar.tsx` + `lib/avatar.ts`): `<Avatar avatar size alt? className?>` pinta un `<span>` redondo con `overflow-hidden`, `background: discBackground(color)` (= `color-mix(in srgb, <color> 42%, var(--surface))`) y `border: ringWidth(size)px solid var(--accent)` (3 px a 128, 2 px a 34, interpolado), y dentro un `<Image>` del retrato con `objectFit: contain`. `avatarOrDefault(a)` cae al clásico (`/images/avatars/clasico.png`, `#FF1F8F`).

**La identidad hoy** (`components/profile/profile-identity.tsx`): un único `<button onClick={onChangeAvatar} aria-label="Cambiar avatar">` que contiene dos `<Avatar>` (78 px en `md:hidden`, 96 en `hidden md:inline-flex`) y un lápiz decorativo (`aria-hidden`) de 28 px en la esquina inferior derecha. La página (`app/(app)/(hub)/profile/page.tsx`) pide `getMyStatsService`, `getMyBadgesService`, `getInventoryService`, `getMySettingsService` (de ahí `avatar` y `avatar_key`) y `getShopService` en un solo efecto con bandera `active`.

**Patrón de giro ya en el repo** (`app/(app)/games/memory/page.tsx:470-520`): contenedor con `perspective: 600px`; hijo absoluto con `transformStyle: "preserve-3d"` y `transform: rotateY(180deg | 0deg)` en transición; dos caras absolutas con `backfaceVisibility: "hidden"` (+ `WebkitBackfaceVisibility`), la trasera pre-rotada `rotateY(180deg)`.

**Movimiento reducido** (`app/globals.css:363`): bajo `prefers-reduced-motion: reduce` toda animación pasa a 0.01 ms y una sola iteración, y las transiciones se limitan a opacidad/color/fondo/borde/sombra/filtro — o sea, una transición de `transform` desaparece y el giro se vuelve un cambio instantáneo. `lib/doty-transformacion.ts` **no reproduce** la animación de entrada bajo esa preferencia ("es accesibilidad, no un extra") y la lee con `window.matchMedia` dentro de una función, nunca en el render.

**Tokens**: `--ease-in-out-strong: cubic-bezier(0.77, 0, 0.175, 1)` (estático, `design/themes.json`). Iconos de sistema disponibles: `lapiz`, `ajustes`, `check`.

## Diseño fijado (aprobado el 2026-09-16; la Task 4 lo lleva a la spec como §6.4)

1. **Dos caras, un disco.** Frente: `<Avatar>` tal cual. Dorso: el mismo disco (`<AvatarDisc>` con el color del avatar y el anillo) con `<Doty size="dorso" animation={gesto} shadow={false}>` a un 70 % del diámetro (56 px en el disco de 78, 68 en el de 96), para que ni el salto de 10 px del festejo ni el vaivén del saludo se recorten con el `overflow-hidden` del disco.
2. **Pose por gesto**, no `feliz` para todo: `wave` → `saludando`, `cheer` → `emocionado`, cualquier otra → `feliz`. La tarjeta de gestos usa la misma pose en sus miniaturas para que dorso y tarjeta cuenten lo mismo.
3. **Giro de entrada, una vez por montaje.** Cuando `/me/settings` **y** el inventario ya respondieron (`ready`) y hay gesto equipado: el retrato se muestra 600 ms, gira en 400 ms, el gesto da vueltas **completas** hasta cubrir unos 3 s (`max(2, round(3000 / vuelta))`: dos de `wave` = 3.2 s, tres de `cheer` = 2.7 s) y vuelve al retrato. Sin gesto equipado el disco **no gira nunca** y no es un botón.
4. **Equipar otro gesto lo vuelve a reproducir**: la identidad monta la carta con `key={gesto ?? "none"}`, así cambiar de gesto remonta el componente, reinicia su estado (fijado, hover) y dispara el giro de entrada como confirmación.
5. **Tap y hover.** Tocar el disco alterna `pinned` (se queda en el dorso hasta el siguiente toque). Con ratón, `pointerenter` con `pointerType === "mouse"` muestra el dorso y `pointerleave` lo devuelve; los punteros táctiles no cuentan como hover, así un tap no dispara dos cambios. Cara mostrada = dorso si hay gesto y (`flourishing` o `pinned` o `hovering`).
6. **La animación del dorso está siempre encendida** mientras haya gesto (como los `doty-bob` infinitos de banners y marcador). Así la vuelta al frente nunca "corta" el gesto a mitad de vuelta mientras aún se ve, y el estado se reduce a tres booleanos.
7. **Movimiento reducido**: no hay giro de entrada (leído con `matchMedia` dentro del efecto, igual que la entrada a la app); el tap sigue cambiando de cara y el CSS global ya convierte el giro en un cambio instantáneo y deja a Doty quieto.
8. **El lápiz es un botón propio** (`aria-label="Cambiar avatar"`), hermano del disco y no anidado: dos botones anidados son HTML inválido y el clic del lápiz no debe girar la carta. El disco-botón lleva `aria-label="Ver el gesto de tu Doty"` y `aria-pressed={pinned}`.
9. **Nada gira a 34 px** (ranking, vecinos, tarjeta de rival): a ese tamaño el gesto no se distingue. Este plan no toca esas superficies.
10. **Copy de la tarjeta** "Gesto de tu Doty": con gestos, una línea bajo el título: «Tu Doty lo hace detrás de tu avatar al abrir el perfil. Toca el avatar para verlo otra vez.»; sin gestos: «Todavía no tienes gestos. Consíguelos en la tienda: tu Doty los hace detrás de tu avatar.»

## Estructura de archivos

- **Crear** `lib/avatar-flip.ts` — lógica pura: `gestureAnimation`, `gesturePose`, `LOOP_MS`, `FLIP_MS`, `FLOURISH_DELAY_MS`, `flourishLoops`, `flourishMs`, `flourishTimeline`, `shouldFlourish`.
- **Crear** `lib/avatar-flip.test.mjs` — sus tests bajo `node --test`.
- **Modificar** `components/ui/avatar/avatar.tsx` — extrae y exporta `AvatarDisc`; `Avatar` lo usa sin cambiar de comportamiento.
- **Modificar** `components/ui/doty/doty.tsx` — tamaño `dorso` (56 px móvil / 68 escritorio).
- **Crear** `components/profile/avatar-flip.tsx` — la carta de dos caras: giro de entrada, tap, hover, accesibilidad.
- **Modificar** `components/profile/profile-identity.tsx` — usa `AvatarFlip`, lápiz como botón hermano, props `gesture` y `ready`.
- **Modificar** `app/(app)/(hub)/profile/page.tsx` — deriva `gesture` con `equippedGesture` + `gestureAnimation`, banderas `settingsResolved`/`inventoryResolved`.
- **Modificar** `components/profile/gestures-card.tsx` — pose por gesto en las miniaturas y el copy nuevo.
- **Modificar** `docs/superpowers/specs/2026-09-14-rediseno-look-and-feel-juvenil-design.md` — nueva §6.4 y dos punteros en §5 y §6.2.
- **Modificar** `docs/ARQUITECTURA.md` — el perfil y la sección «Avatares» mencionan el dorso.

---

### Task 1: La lógica pura del giro — `lib/avatar-flip.ts`

**Files:**
- Create: `lib/avatar-flip.ts`
- Test: `lib/avatar-flip.test.mjs`

**Interfaces:**
- Consumes: los tipos `DotyAnimation` y `DotyPose` de `components/ui/doty/doty.tsx` (solo `import type`); la forma `{ meta: Record<string, unknown> | null }` de `InventoryItem`/`ShopItem` (no se importa: se declara estructuralmente).
- Produces (lo consumen las Tasks 3 y 4): `gestureAnimation(item: { meta: Record<string, unknown> | null } | null | undefined): DotyAnimation | null`; `gesturePose(animation: DotyAnimation): DotyPose`; `LOOP_MS: Record<DotyAnimation, number>`; `FLIP_MS = 400`; `FLOURISH_DELAY_MS = 600`; `flourishLoops(animation: DotyAnimation): number`; `flourishMs(animation: DotyAnimation): number`; `flourishTimeline(animation: DotyAnimation | null): { flipAt: number; flipBackAt: number } | null`; `shouldFlourish(animation: DotyAnimation | null, reducedMotion: boolean): boolean`.

Contexto para esta tarea: los módulos de `lib/` bajo test **solo admiten `import type`** (Node ejecuta el `.ts` sin bundler; el alias `@/` no resolvería un import de valor). Las duraciones de `LOOP_MS` calcan `app/globals.css`: `doty-bob` 2.2 s, `doty-cheer` 900 ms, `doty-sad` 3 s, `doty-wave` 1.6 s; `none` no es un gesto. Las poses `saludando`, `emocionado` y `feliz` existen en el registro con arte.

- [ ] **Step 1: Escribe el test que falla**

Crea `lib/avatar-flip.test.mjs`:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  FLIP_MS,
  FLOURISH_DELAY_MS,
  LOOP_MS,
  flourishLoops,
  flourishMs,
  flourishTimeline,
  gestureAnimation,
  gesturePose,
  shouldFlourish,
} from "./avatar-flip.ts";

const item = (over = {}) => ({
  id: 1,
  key: "gesture_wave",
  kind: "gesture",
  name: "Saludo",
  img: null,
  slot: "gesture",
  meta: { animation: "wave" },
  equippedSlot: "gesture",
  ...over,
});

test("LOOP_MS calca las duraciones de app/globals.css", () => {
  assert.deepEqual(LOOP_MS, { none: 0, bob: 2200, cheer: 900, sad: 3000, wave: 1600 });
});

test("gestureAnimation lee meta.animation y solo acepta el vocabulario de Doty", () => {
  assert.equal(gestureAnimation(item()), "wave");
  assert.equal(gestureAnimation(item({ meta: { animation: "cheer" } })), "cheer");
  assert.equal(gestureAnimation(item({ meta: { animation: "none" } })), null);
  assert.equal(gestureAnimation(item({ meta: { animation: "moonwalk" } })), null);
  assert.equal(gestureAnimation(item({ meta: { animation: 7 } })), null);
  assert.equal(gestureAnimation(item({ meta: null })), null);
  assert.equal(gestureAnimation(null), null);
  assert.equal(gestureAnimation(undefined), null);
});

test("gesturePose elige la pose que hace legible cada gesto", () => {
  assert.equal(gesturePose("wave"), "saludando");
  assert.equal(gesturePose("cheer"), "emocionado");
  assert.equal(gesturePose("bob"), "feliz");
  assert.equal(gesturePose("sad"), "feliz");
  assert.equal(gesturePose("none"), "feliz");
});

test("flourishLoops da vueltas completas que suman unos 3 s, nunca menos de dos", () => {
  assert.equal(flourishLoops("wave"), 2); // 3200 ms
  assert.equal(flourishLoops("cheer"), 3); // 2700 ms
  assert.equal(flourishLoops("bob"), 2); // 4400 ms: manda el mínimo
  assert.equal(flourishLoops("none"), 0);
});

test("flourishMs es vueltas por duración de vuelta", () => {
  assert.equal(flourishMs("wave"), 3200);
  assert.equal(flourishMs("cheer"), 2700);
  assert.equal(flourishMs("none"), 0);
});

test("flourishTimeline: retrato 600 ms, giro de 400, gesto completo y vuelta", () => {
  assert.equal(FLOURISH_DELAY_MS, 600);
  assert.equal(FLIP_MS, 400);
  assert.deepEqual(flourishTimeline("wave"), { flipAt: 600, flipBackAt: 4200 });
  assert.deepEqual(flourishTimeline("cheer"), { flipAt: 600, flipBackAt: 3700 });
  assert.equal(flourishTimeline("none"), null);
  assert.equal(flourishTimeline(null), null);
});

test("shouldFlourish exige gesto y respeta prefers-reduced-motion", () => {
  assert.equal(shouldFlourish("wave", false), true);
  assert.equal(shouldFlourish("cheer", false), true);
  assert.equal(shouldFlourish("wave", true), false);
  assert.equal(shouldFlourish(null, false), false);
  assert.equal(shouldFlourish("none", false), false);
});
```

- [ ] **Step 2: Comprueba que falla**

```bash
source ~/.nvm/nvm.sh && nvm use && node --test lib/avatar-flip.test.mjs
```

Esperado: FAIL — `Cannot find module '.../lib/avatar-flip.ts'`.

- [ ] **Step 3: Escribe el módulo**

Crea `lib/avatar-flip.ts`:

```ts
import type { DotyAnimation, DotyPose } from "@/components/ui/doty/doty";

/**
 * El dorso del avatar (spec §6.4): tiempos del giro de entrada y pose por
 * gesto. Vive fuera de los componentes para poder probarse con `node --test`:
 * por eso SOLO admite `import type` (Node ejecuta este archivo sin bundler y
 * no resolvería el alias `@/`).
 */

/** Duración de una vuelta de cada animación, calcada de app/globals.css (doty-*). */
export const LOOP_MS: Record<DotyAnimation, number> = {
  none: 0,
  bob: 2200,
  cheer: 900,
  sad: 3000,
  wave: 1600,
};

/** Lo que tarda la carta en girar (transición de `transform`). */
export const FLIP_MS = 400;

/** Cuánto se ve el retrato antes del primer giro: que se vea que es tu avatar. */
export const FLOURISH_DELAY_MS = 600;

/** Lo que debería durar el gesto a la vista, redondeado a vueltas completas. */
const FLOURISH_TARGET_MS = 3000;

const GESTURES: readonly string[] = ["bob", "cheer", "sad", "wave"];

/**
 * La animación que trae un ítem del inventario o la tienda en `meta.animation`,
 * o null si no es un gesto que Doty sepa hacer. `"none"` no cuenta como gesto.
 */
export function gestureAnimation(
  item: { meta: Record<string, unknown> | null } | null | undefined,
): DotyAnimation | null {
  const raw = item?.meta?.animation;
  return typeof raw === "string" && GESTURES.includes(raw) ? (raw as DotyAnimation) : null;
}

/**
 * La pose que hace legible el gesto: saludar con la mano ya en el aire y
 * festejar con los dos brazos arriba. `feliz` para lo que no tenga pose propia.
 */
export function gesturePose(animation: DotyAnimation): DotyPose {
  if (animation === "wave") return "saludando";
  if (animation === "cheer") return "emocionado";
  return "feliz";
}

/**
 * Vueltas completas que más se acercan a FLOURISH_TARGET_MS, nunca menos de
 * dos: una sola vuelta de 1.6 s no da tiempo a reconocer el gesto.
 */
export function flourishLoops(animation: DotyAnimation): number {
  const loop = LOOP_MS[animation];
  if (loop === 0) return 0;
  return Math.max(2, Math.round(FLOURISH_TARGET_MS / loop));
}

export function flourishMs(animation: DotyAnimation): number {
  return flourishLoops(animation) * LOOP_MS[animation];
}

export interface FlourishTimeline {
  /** ms desde que hay datos hasta que la carta empieza a girar al dorso. */
  flipAt: number;
  /** ms hasta que empieza a volver al retrato: giro + vueltas completas del gesto. */
  flipBackAt: number;
}

/** null sin gesto: el disco no gira nunca si no hay nada que mostrar. */
export function flourishTimeline(animation: DotyAnimation | null): FlourishTimeline | null {
  if (animation === null || LOOP_MS[animation] === 0) return null;
  const flipAt = FLOURISH_DELAY_MS;
  return { flipAt, flipBackAt: flipAt + FLIP_MS + flourishMs(animation) };
}

/**
 * Con `prefers-reduced-motion` no hay giro de entrada: es accesibilidad, no un
 * extra (mismo criterio que la animación de entrada a la app). El tap sigue
 * cambiando de cara porque lo pide el usuario.
 */
export function shouldFlourish(animation: DotyAnimation | null, reducedMotion: boolean): boolean {
  return animation !== null && LOOP_MS[animation] > 0 && !reducedMotion;
}
```

- [ ] **Step 4: Comprueba que pasa**

```bash
source ~/.nvm/nvm.sh && nvm use && node --test lib/avatar-flip.test.mjs && npm run test:scripts
```

Esperado: los 7 tests nuevos en PASS y la suite completa sin fallos.

- [ ] **Step 5: Commit**

```bash
git add lib/avatar-flip.ts lib/avatar-flip.test.mjs
git commit -m "feat(perfil): lógica pura del dorso del avatar — pose por gesto y tiempos del giro de entrada

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 2: El disco compartido y el tamaño `dorso` de Doty

**Files:**
- Modify: `components/ui/avatar/avatar.tsx`
- Modify: `components/ui/doty/doty.tsx:9` (tipo `DotySize`), `:36-48` (`SIZE_PX`), `:50-62` (`sizeClass`)

**Interfaces:**
- Consumes: `avatarOrDefault`, `discBackground`, `ringWidth`, `PublicAvatar` de `lib/avatar.ts` (ya existen, no se tocan).
- Produces (lo consume la Task 3): `export function AvatarDisc({ color, size, className?, children }: { color: string; size: number; className?: string; children: React.ReactNode })` en `components/ui/avatar/avatar.tsx`, junto al `default export Avatar` que **no cambia de firma ni de comportamiento**; y el tamaño `"dorso"` en `DotySize` (`SIZE_PX.dorso = 68`, clase `w-14 md:w-17`).

Contexto para esta tarea: hoy `<Avatar>` pinta el disco inline (un `<span>` redondo con `overflow-hidden`, fondo `discBackground(color)` y borde `ringWidth(size)px solid var(--accent)`) y dentro el `<Image>` del retrato. El dorso de la Task 3 necesita **el mismo disco** con otro contenido, así que el disco se extrae a `AvatarDisc`. El comentario de cabecera de `avatar.tsx` dice que es el único sitio donde vive la geometría del marco: sigue siendo cierto. En `doty.tsx`, cada tamaño tiene su `SIZE_PX` (alimenta el atributo `sizes` de `next/image`) y su clase Tailwind de ancho; Tailwind 4 acepta cualquier entero (`w-14` = 56 px, `w-17` = 68 px). El disco del perfil mide 78 px en móvil y 96 en escritorio, y el dorso va al 70 %.

- [ ] **Step 1: Extrae `AvatarDisc`**

Sustituye `components/ui/avatar/avatar.tsx` completo por:

```tsx
"use client";

import type { ReactNode } from "react";
import Image from "next/image";

import { avatarOrDefault, discBackground, ringWidth, type PublicAvatar } from "@/lib/avatar";

/**
 * La cara pública del usuario (spec §6.1). Único sitio donde vive la geometría
 * del marco: perfil, selector, tienda, leaderboard, vecinos del Camino y avisos
 * de rival lo usan todos con el mismo componente y solo cambian `size`.
 *
 * NO es un `<Doty>`: los avatares viven en public/images/avatars/ y están fuera
 * del registro de poses (regla 10). El dorso del avatar del perfil (spec §6.4)
 * sí lleva un Doty, pero dentro de este mismo disco: por eso `AvatarDisc` se
 * exporta aparte.
 */
interface DiscProps {
  /** Color propio del avatar (`meta.color`): se mezcla al 42 % con la superficie. */
  color: string;
  /** Diámetro en px. */
  size: number;
  className?: string;
  children: ReactNode;
}

/** El disco y el anillo, sin contenido: lo comparten el retrato y el dorso. */
export function AvatarDisc({ color, size, className, children }: DiscProps) {
  const ring = ringWidth(size);
  return (
    <span
      className={`relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full ${className ?? ""}`}
      style={{
        width: size,
        height: size,
        background: discBackground(color),
        border: `${ring}px solid var(--accent)`,
      }}
    >
      {children}
    </span>
  );
}

interface Props {
  avatar: PublicAvatar | null | undefined;
  /** Diámetro en px. Los del spec: 96 selector y tienda, 48 toasts, 34 leaderboard y vecinos. */
  size: number;
  alt?: string;
  className?: string;
}

export default function Avatar({ avatar, size, alt = "", className }: Props) {
  const a = avatarOrDefault(avatar);
  return (
    <AvatarDisc color={a.color} size={size} className={className}>
      <Image
        src={a.img}
        alt={alt}
        width={size}
        height={size}
        // El retrato ya viene recortado a cabeza y hombros con margen: se pinta
        // completo dentro del disco, sin recorte extra.
        style={{ objectFit: "contain" }}
      />
    </AvatarDisc>
  );
}
```

- [ ] **Step 2: Añade el tamaño `dorso` a Doty**

En `components/ui/doty/doty.tsx`, tres ediciones:

La línea del tipo:

```ts
export type DotySize = "micro" | "mini" | "small" | "tiny" | "smaller" | "medium" | "big" | "chip" | "section" | "banner" | "dorso";
```

En `SIZE_PX`, después de `banner: 158,`:

```ts
  // dorso: Doty en la cara trasera del avatar del perfil (spec §6.4); 68 es el mayor de sus dos anchos.
  dorso: 68,
```

En `sizeClass`, después de `banner: "w-[158px]",`:

```ts
  // dorso: 70 % del disco del perfil — 56 px dentro del de 78 (móvil) y 68 dentro del de 96 (escritorio).
  dorso: "w-14 md:w-17",
```

- [ ] **Step 3: Verifica que nada cambió de aspecto ni de tipos**

```bash
source ~/.nvm/nvm.sh && nvm use && npm run lint && npx tsc --noEmit && npm run test:scripts
```

Esperado: lint limpio, sin errores de tipos, suite en PASS. `Avatar` conserva la misma firma, así que ningún llamador cambia.

- [ ] **Step 4: Commit**

```bash
git add components/ui/avatar/avatar.tsx components/ui/doty/doty.tsx
git commit -m "refactor(avatar,doty): el disco del avatar se exporta como AvatarDisc y Doty gana el tamaño dorso

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 3: La carta de dos caras — `components/profile/avatar-flip.tsx`

**Files:**
- Create: `components/profile/avatar-flip.tsx`

**Interfaces:**
- Consumes: `Avatar` (default) y `AvatarDisc` de `components/ui/avatar/avatar.tsx` (Task 2); `Doty` con `size="dorso"` (Task 2); `avatarOrDefault`, `PublicAvatar` de `lib/avatar.ts`; `FLIP_MS`, `flourishTimeline`, `gesturePose`, `shouldFlourish` de `lib/avatar-flip.ts` (Task 1); `DotyAnimation` de `components/ui/doty/doty.tsx`.
- Produces (lo consume la Task 4): `export default function AvatarFlip(props: { avatar: PublicAvatar | null; gesture: DotyAnimation | null; size: number; ready: boolean })`.

Contexto para esta tarea: es el diseño fijado del plan, puntos 1, 3, 5, 6, 7 y 8. Patrón de giro copiado del juego de memoria (`app/(app)/games/memory/page.tsx:470-520`): contenedor con `perspective`, hijo con `transformStyle: "preserve-3d"` que rota, dos caras absolutas con `backfaceVisibility: "hidden"` y la trasera pre-rotada. La regla 3 prohíbe `setState` síncrono en el cuerpo de un `useEffect`: aquí el efecto **solo programa temporizadores** y son sus callbacks los que cambian estado; el cleanup los cancela (StrictMode monta dos veces en dev y esto lo hace inocuo). La regla 12 prohíbe `matchMedia` en el render: se lee dentro del efecto. La animación del dorso está **siempre encendida** mientras haya gesto (punto 6). Sin gesto, el componente devuelve la carta sin botón: no hay nada que ver ni que tocar.

- [ ] **Step 1: Escribe el componente**

Crea `components/profile/avatar-flip.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";

import Avatar, { AvatarDisc } from "@/components/ui/avatar/avatar";
import Doty, { type DotyAnimation } from "@/components/ui/doty/doty";
import { avatarOrDefault, type PublicAvatar } from "@/lib/avatar";
import { FLIP_MS, flourishTimeline, gesturePose, shouldFlourish } from "@/lib/avatar-flip";

/**
 * El avatar del perfil como carta de dos caras (spec §6.4): el retrato al
 * frente y, detrás, Doty haciendo el gesto equipado dentro del mismo disco.
 *
 * - Giro de entrada: cuando ya hay datos (`ready`) y hay gesto, el retrato se
 *   ve un momento, la carta gira, el gesto da vueltas completas y vuelve. Una
 *   vez por montaje: la identidad remonta la carta con `key` al cambiar de
 *   gesto, y eso la vuelve a reproducir como confirmación de equipar.
 * - Tap: alterna el dorso fijo. Hover: solo con ratón (`pointerType`), para
 *   que un tap no cuente dos veces. El tap es la señal primaria (regla 2).
 * - Sin gesto no hay botón ni dorso: el disco no gira nunca.
 * - Con `prefers-reduced-motion` no hay giro de entrada; el CSS global ya
 *   deja el giro instantáneo y a Doty quieto, así que el tap sigue sirviendo.
 *
 * Mismo patrón 3D que las cartas del juego de memoria: `perspective` en el
 * contenedor, `preserve-3d` en la carta y `backface-visibility: hidden` en
 * cada cara. Solo `transform` (principio 5 de la spec).
 */
interface Props {
  avatar: PublicAvatar | null;
  /** Animación del gesto equipado, o null si no hay ninguno. */
  gesture: DotyAnimation | null;
  /** Diámetro en px: 78 en móvil, 96 en escritorio. */
  size: number;
  /** true cuando /me/settings y el inventario ya respondieron: el giro de entrada espera a los dos. */
  ready: boolean;
}

/** Igual que en lib/doty-transformacion.ts: se lee en un efecto, nunca en el render. */
function prefiereMenosMovimiento(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

export default function AvatarFlip({ avatar, gesture, size, ready }: Props) {
  const [flourishing, setFlourishing] = useState(false);
  const [pinned, setPinned] = useState(false);
  const [hovering, setHovering] = useState(false);

  // Solo programa temporizadores; el estado lo cambian sus callbacks (regla 3).
  useEffect(() => {
    if (!ready) return;
    const timeline = flourishTimeline(gesture);
    if (!timeline || !shouldFlourish(gesture, prefiereMenosMovimiento())) return;
    const ida = setTimeout(() => setFlourishing(true), timeline.flipAt);
    const vuelta = setTimeout(() => setFlourishing(false), timeline.flipBackAt);
    return () => {
      clearTimeout(ida);
      clearTimeout(vuelta);
    };
  }, [ready, gesture]);

  const a = avatarOrDefault(avatar);
  const hayGesto = gesture !== null;
  const dorso = hayGesto && (flourishing || pinned || hovering);

  const carta = (
    <span className="relative inline-block" style={{ width: size, height: size, perspective: "600px" }}>
      <span
        aria-hidden
        className="absolute inset-0"
        style={{
          transformStyle: "preserve-3d",
          transform: dorso ? "rotateY(180deg)" : "rotateY(0deg)",
          transition: `transform ${FLIP_MS}ms var(--ease-in-out-strong)`,
        }}
      >
        <span
          className="absolute inset-0"
          style={{ backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden" }}
        >
          <Avatar avatar={a} size={size} />
        </span>
        {gesture !== null && (
          <span
            className="absolute inset-0"
            style={{
              backfaceVisibility: "hidden",
              WebkitBackfaceVisibility: "hidden",
              transform: "rotateY(180deg)",
            }}
          >
            {/* El disco es la base: sin drop-shadow, y Doty al 70 % para que el gesto no se recorte. */}
            <AvatarDisc color={a.color} size={size}>
              <Doty pose={gesturePose(gesture)} size="dorso" animation={gesture} shadow={false} />
            </AvatarDisc>
          </span>
        )}
      </span>
    </span>
  );

  if (!hayGesto) return carta;

  return (
    <button
      type="button"
      onClick={() => setPinned((p) => !p)}
      onPointerEnter={(e) => {
        if (e.pointerType === "mouse") setHovering(true);
      }}
      onPointerLeave={(e) => {
        if (e.pointerType === "mouse") setHovering(false);
      }}
      aria-pressed={pinned}
      aria-label="Ver el gesto de tu Doty"
      className="inline-flex cursor-pointer rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--accent)"
    >
      {carta}
    </button>
  );
}
```

- [ ] **Step 2: Verifica tipos y lint**

```bash
source ~/.nvm/nvm.sh && nvm use && npm run lint && npx tsc --noEmit
```

Esperado: limpio. Si el lint del compiler de React se queja del efecto, el error es en el código, no en la regla: el efecto no debe llamar a ningún `setState` directamente.

- [ ] **Step 3: Commit**

```bash
git add components/profile/avatar-flip.tsx
git commit -m "feat(perfil): la carta de dos caras del avatar — dorso con el gesto, giro de entrada, tap y hover

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 4: Integración en el perfil, copy de la tarjeta y documentación

**Files:**
- Modify: `components/profile/profile-identity.tsx` (archivo completo)
- Modify: `app/(app)/(hub)/profile/page.tsx` (imports, dos estados, el efecto, dos derivadas, props de `ProfileIdentity`)
- Modify: `components/profile/gestures-card.tsx` (archivo completo)
- Modify: `docs/superpowers/specs/2026-09-14-rediseno-look-and-feel-juvenil-design.md` (nueva §6.4 y dos punteros)
- Modify: `docs/ARQUITECTURA.md` (párrafo del perfil y sección «Avatares»)

**Interfaces:**
- Consumes: `AvatarFlip` (Task 3); `gestureAnimation`, `gesturePose` de `lib/avatar-flip.ts` (Task 1); `equippedGesture` de `lib/profile-view.ts` (ya existe: `equippedGesture(items: InventoryItem[]): InventoryItem | null`); `DotyAnimation` de `components/ui/doty/doty.tsx`.
- Produces: `ProfileIdentity` gana dos props obligatorias, `gesture: DotyAnimation | null` y `ready: boolean`. Nadie más consume esto después.

Contexto para esta tarea: hoy la identidad es un único botón que abre el selector y contiene dos `<Avatar>` (78 en `md:hidden`, 96 en `hidden md:inline-flex`) más un lápiz decorativo; la página no calcula el gesto equipado (dejó de hacerlo en E) y pide inventario y ajustes en un efecto con bandera `active`. La tarjeta de gestos pinta `<Doty pose="feliz" size="micro" animation=…>` por gesto. Diseño fijado, puntos 2, 4, 8 y 10.

- [ ] **Step 1: La identidad usa la carta y saca el lápiz a su propio botón**

Sustituye `components/profile/profile-identity.tsx` completo por:

```tsx
"use client";

import AvatarFlip from "@/components/profile/avatar-flip";
import type { DotyAnimation } from "@/components/ui/doty/doty";
import { Icon } from "@/components/ui/icon";
import { UiIcon } from "@/components/ui/ui-icon";
import { cefrBand } from "@/lib/profile-view";
import type { PublicAvatar } from "@/lib/avatar";
import type { MyStats } from "@/services/engagement.service";

/**
 * Identidad del perfil (spec §5, variante A "identidad abierta"): avatar,
 * nombre, chips y engranaje, en horizontal y SIN tarjeta — el principio 4 del
 * spec reserva los contenedores para las cabeceras.
 *
 * El avatar es una carta de dos caras (spec §6.4): retrato al frente y, detrás,
 * Doty con el gesto equipado. Tocar el disco lo gira; el lápiz es un botón
 * aparte —nunca anidado dentro del disco— y el único acceso al selector.
 */
interface Props {
  name: string;
  stats: MyStats | null;
  avatar: PublicAvatar | null;
  /** Animación del gesto equipado, o null si no hay ninguno. */
  gesture: DotyAnimation | null;
  /** true cuando /me/settings y el inventario ya respondieron. */
  ready: boolean;
  onChangeAvatar: () => void;
  onOpenSettings: () => void;
}

export default function ProfileIdentity({
  name,
  stats,
  avatar,
  gesture,
  ready,
  onChangeAvatar,
  onOpenSettings,
}: Props) {
  const band = cefrBand(stats?.level ?? 1);
  const streak = stats?.streak ?? 0;
  // La key remonta la carta al cambiar de gesto: reinicia su estado (fijado,
  // hover) y repite el giro de entrada como confirmación de haber equipado.
  const flipKey = gesture ?? "none";

  return (
    <header className="flex items-center gap-4">
      <div className="relative shrink-0">
        {/* 78 px en móvil y 96 en escritorio (no los 128 del §6.1): Ruling 2 del plan de E. */}
        <span className="md:hidden">
          <AvatarFlip key={flipKey} avatar={avatar} gesture={gesture} size={78} ready={ready} />
        </span>
        <span className="hidden md:inline-flex">
          <AvatarFlip key={flipKey} avatar={avatar} gesture={gesture} size={96} ready={ready} />
        </span>
        <button
          type="button"
          onClick={onChangeAvatar}
          aria-label="Cambiar avatar"
          className="absolute -bottom-0.5 -right-0.5 flex h-7 w-7 items-center justify-center rounded-full transition-transform duration-150 active:scale-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--accent)"
          style={{ background: "var(--accent)", color: "var(--accent-contrast)" }}
        >
          <Icon name="lapiz" size={14} mono />
        </button>
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
            role="img"
            aria-label={`Racha: ${streak} días`}
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

- [ ] **Step 2: La página deriva el gesto y sabe cuándo hay datos**

En `app/(app)/(hub)/profile/page.tsx`:

Añade dos imports junto a los de `@/lib`:

```ts
import { gestureAnimation } from "@/lib/avatar-flip";
import { equippedGesture } from "@/lib/profile-view";
```

Añade dos estados después de `const [pickerOpen, setPickerOpen] = useState(false);`:

```ts
  // El giro de entrada de la carta espera a que respondan ajustes (avatar) e
  // inventario (gesto): si girara con el clásico y luego llegara el retrato
  // real, cambiaría de cara a media vuelta.
  const [settingsResolved, setSettingsResolved] = useState(false);
  const [inventoryResolved, setInventoryResolved] = useState(false);
```

En el efecto, sustituye las dos llamadas a inventario y ajustes por estas (mismo contenido, más el `.finally`):

```ts
    getInventoryService()
      .then((inv) => {
        if (active) setInventory(inv.items);
      })
      .finally(() => {
        if (active) setInventoryResolved(true);
      });
    getMySettingsService()
      .then((s) => {
        if (active && s) {
          setAvatar(s.avatar);
          // Sin key equipada el backend igual resuelve "clasico" en perfil, ranking
          // y aviso de rival: mismo fallback aquí para que selector y tienda coincidan.
          setAvatarKey(s.avatar_key ?? "clasico");
        }
      })
      .finally(() => {
        if (active) setSettingsResolved(true);
      });
```

Después de `const name = …;` añade:

```ts
  const gesture = gestureAnimation(equippedGesture(inventory));
  const ready = settingsResolved && inventoryResolved;
```

Y en el JSX pasa las dos props nuevas a `ProfileIdentity`:

```tsx
          <ProfileIdentity
            name={name}
            stats={stats}
            avatar={avatar}
            gesture={gesture}
            ready={ready}
            onChangeAvatar={() => setPickerOpen(true)}
            onOpenSettings={() => setSettingsOpen(true)}
          />
```

- [ ] **Step 3: La tarjeta de gestos cuenta lo mismo que el dorso**

Sustituye `components/profile/gestures-card.tsx` completo por:

```tsx
"use client";

import Link from "next/link";

import Doty from "@/components/ui/doty/doty";
import { Icon } from "@/components/ui/icon";
import { gestureAnimation, gesturePose } from "@/lib/avatar-flip";
import { gestureItems } from "@/lib/profile-view";
import type { InventoryItem } from "@/services/shop.service";

/**
 * "Gesto de tu Doty" (spec §5): tarjetas con el equipado marcado y enlace a la
 * tienda. El gesto se ve en el dorso del avatar (spec §6.4): la tarjeta lo dice
 * y pinta cada miniatura con la misma pose que usa el dorso, para que las dos
 * cuenten lo mismo. Gorros y fondos se retiraron en el subproyecto E (§6.2).
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
          Todavía no tienes gestos. Consíguelos en la tienda: tu Doty los hace detrás de tu avatar.
        </p>
      ) : (
        <>
          <p className="text-xs font-semibold text-(--muted)">
            Tu Doty lo hace detrás de tu avatar al abrir el perfil. Toca el avatar para verlo otra vez.
          </p>
          <ul className="grid grid-cols-3 gap-2">
            {gestures.map((item) => {
              const on = item.equippedSlot === "gesture";
              const animation = gestureAnimation(item);
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
                      pose={animation ? gesturePose(animation) : "feliz"}
                      size="micro"
                      animation={animation ?? "none"}
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
        </>
      )}
    </section>
  );
}
```

- [ ] **Step 4: Verifica lint, tipos, tests y build**

```bash
source ~/.nvm/nvm.sh && nvm use && npm run lint && npm run test:scripts && npx next build
```

Esperado: todo limpio. Si `tsc` señala que `ProfileIdentity` recibe props que no declara, es que el Step 1 y el Step 2 no coinciden: corrige el que esté mal.

- [ ] **Step 5: Escribe la decisión en la spec**

En `docs/superpowers/specs/2026-09-14-rediseno-look-and-feel-juvenil-design.md`:

(a) En §5, la viñeta que empieza por `- **Insignias**: tile dorado suave de 58 px;` termina hoy con `tres tarjetas con el gesto equipado marcado, enlace a la tienda.`. Sustituye ese final por:

```
tres tarjetas con el gesto equipado marcado, enlace a la tienda. Su escenario es el dorso del
  avatar (§6.4).
```

(b) En §6.2, la línea `  `--rollback`. Los gestos (`gesture`) se conservan.` pasa a:

```
  `--rollback`. Los gestos (`gesture`) se conservan y pasan al dorso del avatar (§6.4).
```

(c) Inserta esta subsección completa **justo antes** de la línea `## 7. Subproyecto F — Primer inicio guiado` (deja una línea en blanco antes y después):

```
### 6.4 Dorso del avatar (E.2, fase 1 — decidido el 2026-09-16)

- **El problema.** Los gestos perdieron su escenario cuando el avatar sustituyó a Doty en la
  identidad del perfil (§5): solo se veían en las miniaturas de 32 px de su propia tarjeta y nadie
  más los veía. Se conservan (§6.2) y su escenario pasa a ser el **dorso del avatar**.
- **La carta.** El disco del perfil tiene dos caras: el retrato al frente y, detrás, Doty haciendo
  el gesto equipado dentro del mismo disco (mismo color y anillo), con la pose que corresponde al
  gesto —`saludando` para `wave`, `emocionado` para `cheer`, `feliz` para cualquier otra— a un 70 %
  del diámetro (56 px en el disco de 78, 68 en el de 96), para que la animación no se recorte.
- **Giro de entrada.** Al abrir el perfil, cuando ajustes e inventario ya respondieron y hay gesto
  equipado: el retrato se ve 600 ms, la carta gira en 400 ms (`rotateY`, solo `transform`), el
  gesto da vueltas completas hasta cubrir unos 3 s (dos de `wave` = 3.2 s, tres de `cheer` =
  2.7 s) y vuelve al retrato. Una vez por visita; equipar otro gesto lo vuelve a reproducir. Sin
  gesto equipado el disco no gira nunca.
- **Tap y hover.** Tocar el disco lo gira y lo deja en el dorso hasta el siguiente toque; con
  ratón, pasar por encima lo gira y salir lo devuelve. El tap es la señal primaria. El lápiz pasa a
  ser un botón propio y el único acceso al selector de avatar.
- **Movimiento reducido.** No hay giro de entrada (como la animación de entrada a la app); el tap
  sigue cambiando de cara, sin transición.
- **A 34 px nada gira**: ranking, vecinos del Camino y tarjeta de rival muestran el retrato quieto,
  porque a ese tamaño el gesto no se distingue.
- La tarjeta "Gesto de tu Doty" dice dónde se ve el gesto y usa la misma pose por gesto en sus
  miniaturas. Lógica pura en `lib/avatar-flip.ts`; componente `components/profile/avatar-flip.tsx`.
- **Fuera de alcance, pendiente de decisión (fase 2):** aviso "te pasó" con el nombre y el gesto de
  quien te adelanta en el ranking, y perfil público de otros usuarios. Plan de la fase 1:
  `docs/superpowers/plans/2026-09-16-rediseno-e2-avatar-dos-caras.md`.
```

- [ ] **Step 6: Actualiza la arquitectura**

En `docs/ARQUITECTURA.md`:

(a) En la sección `### El perfil (`/profile`)`, el párrafo termina hoy con `…—no
con `<Doty>`—; el porqué de esos dos tamaños y el resto del sistema de avatares se
documentan abajo, en «Avatares».`. Añade después de ese párrafo (separado por una línea en blanco):

```
Ese avatar es una carta de dos caras (`avatar-flip.tsx`, spec §6.4): retrato al frente y,
detrás, Doty con el gesto equipado dentro del mismo disco. Gira sola al entrar (una vez,
cuando ajustes e inventario ya respondieron), gira al tocarla o al pasar el ratón, y el
lápiz es un botón aparte que abre el selector. Los tiempos del giro y la pose por gesto
son puros y están bajo `node --test` en `lib/avatar-flip.ts`.
```

(b) En la sección `### Avatares (`components/ui/avatar/`)`, el primer párrafo termina con `La geometría y el fallback viven
en `lib/avatar.ts`, puro y bajo `node --test`.`. Añade a continuación, en el mismo párrafo:

```
 El disco sin contenido se exporta como `<AvatarDisc>`: el dorso del avatar del perfil lo
reutiliza con un `<Doty size="dorso">` al 70 % del diámetro, así el gesto vive dentro del
mismo marco que el retrato.
```

- [ ] **Step 7: Commit**

```bash
git add components/profile/profile-identity.tsx "app/(app)/(hub)/profile/page.tsx" components/profile/gestures-card.tsx docs/superpowers/specs/2026-09-14-rediseno-look-and-feel-juvenil-design.md docs/ARQUITECTURA.md
git commit -m "feat(perfil): el avatar gira y muestra el gesto equipado en su dorso; el lápiz es el único acceso al selector

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

## Verificación en navegador (la hace Sergio; requiere sesión)

Los implementadores no pueden iniciar sesión. Cuando la rama esté revisada, Sergio comprueba en `/profile` con un gesto equipado (equiparlo desde la propia tarjeta sirve, porque también dispara el giro):

1. Al entrar: retrato → giro → Doty saludando o festejando dentro del disco, sin recortes → vuelta al retrato. Dura unos 4 s en total.
2. Tocar el disco lo deja en el dorso; tocarlo otra vez lo devuelve. En escritorio, pasar el ratón lo gira y salir lo devuelve.
3. El lápiz abre el selector y **no** gira la carta.
4. Equipar el otro gesto desde la tarjeta repite el giro con la otra pose; desequipar deja el retrato quieto y el disco deja de reaccionar al tap.
5. En el tema oscuro y en la paleta Eléctrico el dorso mantiene el color del avatar y el anillo del acento.
6. Con "reducir movimiento" activado en el sistema: no hay giro de entrada; el tap cambia de cara al instante.
7. Ranking (Retos) y vecinos del Camino siguen con retratos quietos de 34 px.

## Cobertura del diseño fijado

| Punto | Tarea |
|---|---|
| 1 dos caras, un disco, Doty al 70 % | Task 2 (`AvatarDisc`, `dorso`) + Task 3 |
| 2 pose por gesto en dorso y tarjeta | Task 1 (`gesturePose`) + Task 3 + Task 4 Step 3 |
| 3 giro de entrada con datos y vueltas completas | Task 1 (`flourishTimeline`) + Task 3 + Task 4 Step 2 (`ready`) |
| 4 equipar otro gesto lo repite | Task 4 Step 1 (`key`) |
| 5 tap y hover solo con ratón | Task 3 |
| 6 animación del dorso siempre encendida | Task 3 |
| 7 movimiento reducido | Task 1 (`shouldFlourish`) + Task 3 |
| 8 lápiz como botón hermano, a11y del disco | Task 3 + Task 4 Step 1 |
| 9 nada gira a 34 px | sin cambios (documentado en §6.4) |
| 10 copy de la tarjeta | Task 4 Step 3 |
| spec §6.4 y arquitectura | Task 4 Steps 5-6 |
