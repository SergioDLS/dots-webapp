# Rediseño look & feel — Subproyecto F.2 (Pistas contextuales) — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** La primera vez que alguien entra a cada pestaña, Doty le explica lo único que hace falta entender de esa pantalla, señalándolo con un foco; y no se lo vuelve a decir nunca, ni en ese dispositivo ni en otro.

**Architecture:** Cero backend: `PATCH /me/settings` ya acepta `tips_seen` y el servidor hace la unión de-duplicada. Un único `TipsController` montado en el layout del hub decide qué pista toca según la ruta, y encuentra el elemento al que apuntar **por un atributo `data-tip` en el DOM**, no por refs — porque la llama de la racha vive en la cabecera del layout y ninguna página podría alcanzarla por props. El catálogo y la selección son lógica pura bajo `node --test`; medir y esperar al elemento es un hook; pintar el foco y el bocadillo es un componente presentacional.

**Tech Stack:** Next.js 16 (app router) + React 19 + Tailwind 4; `node --test` para la lógica pura. Sin cambios en el backend ni en la base de datos.

**Spec:** `docs/superpowers/specs/2026-09-14-rediseno-look-and-feel-juvenil-design.md` — §7.3 completo. F.1 (§7.1 y §7.2) ya está en `main`. También rigen §1 (principios), §2.2 (guía de voz) y §8.

## Global Constraints

- `source ~/.nvm/nvm.sh && nvm use` antes de cualquier `node`/`npm`/`npx` (Node 24 por `.nvmrc`). Verificación final: `npm run lint && npm run test:scripts && npx next build`.
- Rama `redesign/f2-pistas` desde `main` (ee160cc), en un worktree **fuera del checkout principal**. **Sin push a origin.** Nunca escribas fuera de tu worktree. **Nunca uses `git stash`** (pila compartida: usa `git show <rev>:<ruta>`). **Nunca corras `npm install`** en el worktree: falla compilando `sharp`; el controlador provisiona `node_modules` con `cp -al`.
- **Cero cambios en `dots-backend`.** El DTO ya acepta `tips_seen` y `mergeSettings` hace la unión.
- Commits terminan con `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`.
- Regla 1: navegación con `router.push`/`router.replace`, nunca `window.location.*` (este plan no navega).
- Regla 2 (RN-safe): solo tap/pointer, nada de `keydown` **como input de producto** —`Escape` para cerrar sí es aceptable y el repo ya lo usa en `settings-sheet.tsx` y `avatar-picker.tsx`—, animación solo `transform`/`opacity`, hover jamás como única señal.
- Regla 3 (lint del compiler de React): **prohibido `setState` síncrono en el cuerpo de un `useEffect`**; dentro de callbacks de promesas, de `setTimeout` y de `requestAnimationFrame` sí se puede. Esta regla ya costó dos rondas en F.1: léela antes de escribir un efecto.
- Regla 10: Doty solo con `<Doty pose=…>` y poses del registro generado. Las seis poses de este plan existen con arte real: `senalando`, `emocionado`, `gamer`, `meditando`.
- Regla 11: cero emoji como iconografía.
- Regla 12: los archivos generados no se editan a mano; un componente cliente no lee `matchMedia` en el render.
- Copy de producto en español con tuteo, tono juguetón, sin regionalismos. **Las seis frases están fijadas en la tabla de abajo y NO se reescriben.**
- Módulos puros bajo test (`lib/tips.ts`): **solo `import type`**. El test es `lib/tips.test.mjs`, junto al módulo, importando `./tips.ts` con extensión. **No toques `package.json`.**
- Sin librerías nuevas.

---

## Contexto medido del código (leído el 2026-09-17, no re-investigar)

**El backend ya está listo.** `services/settings.service.ts` declara `UserSettings.tips_seen: string[]` y `SettingsPatch.tips_seen?: string[]` (claves a **añadir**, unión nunca reemplazo). Nadie las lee ni las escribe todavía en la webapp. `patchMySettingsService(patch)` es el único escritor.

**No existe NADA de maquinaria de overlay medido.** Comprobado en todo el repo: cero `getBoundingClientRect`, cero `createPortal`, cero `box-shadow: 0 0 0 9999px`, cero trampas de foco. Los precedentes más cercanos son `components/profile/settings-sheet.tsx` y `components/profile/avatar-picker.tsx`: los dos pintan un scrim `var(--scrim)` a pantalla completa, cierran con `Escape`, enfocan al abrir y bloquean el scroll del body restaurándolo en el cleanup. `hooks/use-in-view.ts` es el único `IntersectionObserver`.

**El layout del hub** (`app/(app)/(hub)/layout.tsx`) monta, en orden: `ThemeSync`, `FirstRunGate`, `DotyEntrada`, `AppNav`, `AppHeader` y `{children}` dentro de un `<main class="mx-auto w-full max-w-5xl …">`. **Se monta una vez por carga de página** y sobrevive al cambio de pestaña. **Scrollea la ventana**, no un contenedor. La cabecera es `sticky top-0 z-30`, el nav inferior `fixed … z-40`, y el overlay de entrada `fixed inset-0 z-50`. **No hay ningún ancestro con `transform` ni `overflow:hidden`** entre la raíz y los anclajes, así que `position: fixed` y `getBoundingClientRect` se comportan.

**El overlay de entrada es un peligro de medición**: en una cuenta nueva —justo cuando disparan las pistas— `DotyEntrada` puede estar reproduciéndose a pantalla completa mientras la página monta y mide. Hay que esperar a que desaparezca.

**F.1 dejó una pieza reutilizable**: `lib/first-run.ts` exporta `estadoPrimerInicio()` y `suscribirPrimerInicio(cb)`, un store mínimo. Vale `"desconocido"`, `"pendiente"` o `"hecho"`. Mientras no sea `"hecho"`, el usuario está yendo o volviendo de la bienvenida y no toca enseñarle pistas.

**Anclajes, medidos uno a uno:**

| Pista | Archivo y elemento | Nota |
|---|---|---|
| `camino.primer-nivel` | `components/path/path-section.tsx:123` — el `<div>` que ya lleva `data-path-current` | El repo YA localiza este elemento con `document.querySelector('[data-path-current="true"]')` desde `path-container.tsx:180,190,199` para centrarlo. El patrón por atributo está probado en casa. |
| `camino.racha` | `components/shell/app-header.tsx:35-47` — el `<div class="flex items-center gap-1 …">` que envuelve llama y número | **Vive en el LAYOUT, no en una página**: ninguna página puede alcanzarlo por props. Este es el motivo de todo el diseño por atributo. |
| `arcade.diarios` | `components/play/arcade-grid.tsx:61` — el `<ul>` de la fila de diarios | |
| `repaso.que-es` | `app/(app)/(hub)/review/page.tsx:37` (el `<h1>` del estado vacío) **y** el elemento más externo de `components/review/review-quiz.tsx` | `/review` pinta tres raíces disjuntas (spinner, vacío, quiz) sin ningún elemento común. Se marcan las dos que pueden verse; el controlador usa la que exista. |
| `retos.torneo` | `components/quests/tournament-card.tsx:70-73` — el `<div>` de la tarjeta real, no el esqueleto ni la rama `null` | |
| `perfil.avatar` | `components/profile/profile-identity.tsx:50` — el `<div class="relative shrink-0">` que envuelve el avatar y el lápiz | Enseña de paso la carta de dos caras de E.2. |

**Doty**: `SIZE_PX` es `micro 32, mini 80, tiny 96, smaller 112, small 144, medium 192, big 352, chip 44, section 104, banner 158, dorso 68, bienvenida 170`. **No existe 84**, que es el que pide §7.3. `<Doty say>` pinta un bocadillo **encima** de Doty con la flecha hacia abajo: es una columna, no un bocadillo anclado a un objetivo, así que **no sirve aquí** y `DotyTip` compone el suyo.

**Animación disponible**: `dots-pop-in` ya existe en `app/globals.css` y la usan `path-node.tsx` y `rival-banner.tsx`. No hace falta CSS nuevo.

**Deuda conocida que este plan NO arregla**: `ThemeSync` y `FirstRunGate` ya piden `/me/settings` por separado y no hay caché cliente; el controlador de pistas será un tercer lector. En régimen normal son dos, porque el gate se salta el fetch cuando el espejo dice que sí. Compartir la respuesta es una mejora aparte.

## Copy fijado

Las dos del Camino son **literales del spec §7.3 y de la tabla de voz de `docs/brand/doty-identity.md`**; el `·` del spec separa título de frase y así se parten. **Las otras cuatro las escribí yo siguiendo las cinco reglas de voz de §2.2 y están pendientes del visto bueno de Sergio**: si las cambia, se cambian aquí y en `lib/tips.ts`, en un commit.

| Clave | Pose | Título | Frase |
|---|---|---|---|
| `camino.primer-nivel` | `senalando` | `Este es tu primer nivel` | `Toca la imagen y arrancamos. Cada lección son unos tres minutos.` |
| `camino.racha` | `emocionado` | `La llama es tu racha` | `Practica hoy y se enciende. Un día sin practicar y se apaga. Drama garantizado.` |
| `arcade.diarios` | `gamer` | `Dos juegos cada día` | `Cambian mañana. Juégalos y súmate XP en un minuto.` |
| `repaso.que-es` | `meditando` | `Aquí vuelve lo que aprendiste` | `Justo antes de que se te olvide. Dos minutos hoy te ahorran una lección mañana.` |
| `retos.torneo` | `emocionado` | `Un torneo cada semana` | `Un juego distinto y una tabla para todos. Juega una vez y ya estás dentro.` |
| `perfil.avatar` | `senalando` | `Esta es tu cara` | `Sale en el ranking y en el Camino. Tócala para ver tu gesto; el lápiz la cambia.` |

El botón es siempre `Entendido`, y encima va el contador `Pista 1 de 2` (sin contador cuando la pantalla tiene una sola).

## Seis decisiones tomadas antes de escribir el plan

1. **Anclar por atributo `data-tip`, no por refs.** La llama vive en el layout y ninguna página la alcanza; y el Camino ya usa este mismo truco con `data-path-current`. Un `document.querySelector` en el controlador llega a todo sin tocar ni una firma de props.
2. **Un solo controlador en el layout del hub**, no uno por pantalla. El layout se monta una vez por carga de página, así que `/me/settings` se pide una vez; `usePathname()` dice qué pantalla es.
3. **Se bloquea el scroll mientras hay una pista**, como hacen la hoja de ajustes y el selector de avatar. Eso elimina de raíz el problema de seguir el rectángulo al scrollear: se centra el elemento ANTES de medir y después ya no se mueve.
4. **`scrollIntoView` con `behavior: "auto"`**, no `smooth`. El suave no tiene evento de fin fiable y habría que adivinar cuándo medir.
5. **`arcade.trono` no existe.** El subproyecto C retiró el trono y su corona, así que esa pista se quedó sin objetivo. Quedan seis, y ninguna pantalla llega al máximo de dos salvo el Camino.
6. **Si el elemento no aparece, la pista se salta en silencio.** Nunca se bloquea al usuario por no encontrar a qué apuntar, y nunca se marca como vista una pista que no se enseñó.

## Estructura de archivos

- **Crear** `lib/tips.ts` — catálogo y selección, puro.
- **Crear** `lib/tips.test.mjs` — sus tests.
- **Modificar** `components/ui/doty/doty.tsx` — tamaño `pista` (84 px).
- **Modificar** seis archivos para poner `data-tip`, y `components/ui/doty/doty-entrada.tsx` para poner `data-doty-entrada`.
- **Crear** `hooks/use-tip-anchor.ts` — espera al elemento, lo centra, lo mide y bloquea el scroll.
- **Crear** `components/ui/doty-tip/doty-tip.tsx` — el foco y el bocadillo, presentacional.
- **Crear** `components/tips/tips-controller.tsx` — la orquestación.
- **Modificar** `app/(app)/(hub)/layout.tsx` — lo monta.
- **Modificar** la spec y `docs/ARQUITECTURA.md`.

---

### Task 1: El catálogo y la selección — `lib/tips.ts`

**Files:**
- Create: `lib/tips.ts`
- Test: `lib/tips.test.mjs`

**Interfaces:**
- Consumes: el tipo `DotyPose` de `components/ui/doty/doty`, **solo como `import type`**.
- Produces (lo consumen las Tasks 3, 4 y 5): `type TipKey`; `interface Tip { key: TipKey; ruta: string; pose: DotyPose; titulo: string; frase: string }`; `TIPS: readonly Tip[]`; `MAX_POR_PANTALLA = 2`; `pendientesPara(pathname: string, vistas: readonly string[]): Tip[]`.

Contexto: el orden del catálogo es el orden en que se enseñan. `pendientesPara` compara la ruta **exacta**, no por prefijo: las cinco pestañas del hub son exactamente `/levels`, `/play`, `/review`, `/quests` y `/profile`, y un prefijo haría que `/profile` casara con rutas que no existen todavía pero podrían existir.

- [ ] **Step 1: Escribe el test que falla**

Crea `lib/tips.test.mjs`:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { MAX_POR_PANTALLA, TIPS, pendientesPara } from "./tips.ts";

test("el catálogo tiene las seis pistas, sin arcade.trono", () => {
  assert.equal(TIPS.length, 6);
  const claves = TIPS.map((t) => t.key);
  assert.deepEqual(claves, [
    "camino.primer-nivel",
    "camino.racha",
    "arcade.diarios",
    "repaso.que-es",
    "retos.torneo",
    "perfil.avatar",
  ]);
  assert.equal(claves.includes("arcade.trono"), false);
});

test("ninguna pantalla pasa del máximo de dos", () => {
  const porRuta = new Map();
  for (const t of TIPS) porRuta.set(t.ruta, (porRuta.get(t.ruta) ?? 0) + 1);
  for (const [ruta, n] of porRuta) {
    assert.ok(n <= MAX_POR_PANTALLA, `${ruta} tiene ${n} pistas`);
  }
});

test("toda pista trae pose, título y frase no vacíos", () => {
  for (const t of TIPS) {
    assert.ok(t.pose.length > 0, `${t.key} sin pose`);
    assert.ok(t.titulo.length > 0, `${t.key} sin título`);
    assert.ok(t.frase.length > 0, `${t.key} sin frase`);
    assert.ok(t.ruta.startsWith("/"), `${t.key} con ruta rara`);
  }
});

test("pendientesPara devuelve las de esa ruta, en orden", () => {
  const camino = pendientesPara("/levels", []);
  assert.deepEqual(camino.map((t) => t.key), ["camino.primer-nivel", "camino.racha"]);
  assert.deepEqual(pendientesPara("/profile", []).map((t) => t.key), ["perfil.avatar"]);
});

test("pendientesPara descarta las ya vistas", () => {
  const quedan = pendientesPara("/levels", ["camino.primer-nivel"]);
  assert.deepEqual(quedan.map((t) => t.key), ["camino.racha"]);
  assert.deepEqual(pendientesPara("/levels", ["camino.primer-nivel", "camino.racha"]), []);
});

test("pendientesPara ignora claves desconocidas en lo visto", () => {
  // `tips_seen` es una lista libre en el servidor: puede traer claves viejas.
  const quedan = pendientesPara("/profile", ["arcade.trono", "lo-que-sea"]);
  assert.deepEqual(quedan.map((t) => t.key), ["perfil.avatar"]);
});

test("una ruta sin pistas devuelve lista vacía, no explota", () => {
  assert.deepEqual(pendientesPara("/shop", []), []);
  assert.deepEqual(pendientesPara("", []), []);
});

test("la ruta se compara exacta, no por prefijo", () => {
  assert.deepEqual(pendientesPara("/levels/algo", []), []);
});
```

- [ ] **Step 2: Comprueba que falla**

```bash
source ~/.nvm/nvm.sh && nvm use && node --test lib/tips.test.mjs
```

Esperado: FAIL — `Cannot find module '.../lib/tips.ts'`.

- [ ] **Step 3: Escribe el módulo**

Crea `lib/tips.ts`:

```ts
import type { DotyPose } from "@/components/ui/doty/doty";

/**
 * Pistas contextuales (spec §7.3): lo único que hace falta entender de cada
 * pestaña, dicho una sola vez.
 *
 * Lógica pura para poder probarse con `node --test`: por eso SOLO admite
 * `import type` — Node ejecuta este archivo sin bundler y no resolvería `@/`.
 */
export type TipKey =
  | "camino.primer-nivel"
  | "camino.racha"
  | "arcade.diarios"
  | "repaso.que-es"
  | "retos.torneo"
  | "perfil.avatar";

export interface Tip {
  key: TipKey;
  /** Ruta EXACTA de la pestaña que la enseña. */
  ruta: string;
  pose: DotyPose;
  titulo: string;
  frase: string;
}

/** Como mucho dos por pestaña, y solo en la primera visita (spec §7.3). */
export const MAX_POR_PANTALLA = 2;

/**
 * El orden es el orden en que se enseñan.
 *
 * Las dos del Camino son literales del spec y de la tabla de voz de
 * docs/brand/doty-identity.md, donde el `·` separa título de frase. Las otras
 * cuatro se escribieron siguiendo las cinco reglas de voz del spec §2.2.
 *
 * `arcade.trono` NO está: el subproyecto C retiró el trono y su corona, así que
 * esa pista se quedó sin objetivo al que apuntar.
 */
export const TIPS: readonly Tip[] = [
  {
    key: "camino.primer-nivel",
    ruta: "/levels",
    pose: "senalando",
    titulo: "Este es tu primer nivel",
    frase: "Toca la imagen y arrancamos. Cada lección son unos tres minutos.",
  },
  {
    key: "camino.racha",
    ruta: "/levels",
    pose: "emocionado",
    titulo: "La llama es tu racha",
    frase: "Practica hoy y se enciende. Un día sin practicar y se apaga. Drama garantizado.",
  },
  {
    key: "arcade.diarios",
    ruta: "/play",
    pose: "gamer",
    titulo: "Dos juegos cada día",
    frase: "Cambian mañana. Juégalos y súmate XP en un minuto.",
  },
  {
    key: "repaso.que-es",
    ruta: "/review",
    pose: "meditando",
    titulo: "Aquí vuelve lo que aprendiste",
    frase: "Justo antes de que se te olvide. Dos minutos hoy te ahorran una lección mañana.",
  },
  {
    key: "retos.torneo",
    ruta: "/quests",
    pose: "emocionado",
    titulo: "Un torneo cada semana",
    frase: "Un juego distinto y una tabla para todos. Juega una vez y ya estás dentro.",
  },
  {
    key: "perfil.avatar",
    ruta: "/profile",
    pose: "senalando",
    titulo: "Esta es tu cara",
    frase: "Sale en el ranking y en el Camino. Tócala para ver tu gesto; el lápiz la cambia.",
  },
];

/**
 * Las pistas de esta pantalla que todavía no se han visto, en orden.
 *
 * `vistas` viene de `settings.tips_seen`, que en el servidor es una lista libre
 * y puede traer claves de versiones anteriores: las desconocidas se ignoran
 * solas, porque solo se usa para descartar.
 */
export function pendientesPara(pathname: string, vistas: readonly string[]): Tip[] {
  const ya = new Set(vistas);
  return TIPS.filter((t) => t.ruta === pathname && !ya.has(t.key)).slice(0, MAX_POR_PANTALLA);
}
```

- [ ] **Step 4: Comprueba que pasa**

```bash
source ~/.nvm/nvm.sh && nvm use && node --test lib/tips.test.mjs && npm run test:scripts
```

Esperado: los 8 tests nuevos en PASS y la suite completa sin fallos (80 + 8 = 88).

- [ ] **Step 5: Commit**

```bash
git add lib/tips.ts lib/tips.test.mjs
git commit -m "feat(pistas): catálogo de las seis pistas contextuales y su selección por pantalla

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 2: Los anclajes en el DOM y el tamaño de Doty

**Files:**
- Modify: `components/ui/doty/doty.tsx` (tipo `DotySize`, `SIZE_PX`, `sizeClass`)
- Modify: `components/path/path-section.tsx:123`
- Modify: `components/shell/app-header.tsx:35`
- Modify: `components/play/arcade-grid.tsx:61`
- Modify: `app/(app)/(hub)/review/page.tsx:37` y `components/review/review-quiz.tsx`
- Modify: `components/quests/tournament-card.tsx:70`
- Modify: `components/profile/profile-identity.tsx:50`
- Modify: `components/ui/doty/doty-entrada.tsx:48`

**Interfaces:**
- Produces (lo consumen las Tasks 3, 4 y 5): el atributo `data-tip="<clave>"` en los seis anclajes, el atributo `data-doty-entrada` en el overlay de entrada, y el tamaño `"pista"` en `DotySize` (`SIZE_PX.pista = 84`, clase `w-21`).

Contexto: son ocho ediciones de una línea cada una. **No cambies nada más de esos archivos**: son código de cinco subproyectos distintos, ya revisado y en producción, y aquí solo se les cuelga una etiqueta. Tailwind 4 admite cualquier entero, así que `w-21` son 84 px.

El atributo del Camino y el del torneo van **condicionados**, porque esos componentes también pintan estados en los que no hay nada que señalar.

- [ ] **Step 1: Añade el tamaño `pista` a Doty**

En `components/ui/doty/doty.tsx`, tres ediciones. El tipo, añadiendo `| "pista"` al final de la unión `DotySize`. En `SIZE_PX`, después de `bienvenida: 170,`:

```ts
  // pista: Doty dentro del bocadillo de una pista contextual (spec §7.3).
  pista: 84,
```

En `sizeClass`, después de la entrada de `bienvenida`:

```ts
  pista: "w-21",
```

- [ ] **Step 2: Marca el nodo actual del Camino**

En `components/path/path-section.tsx`, el `<div>` que ya lleva `data-path-current` (línea 123) gana una línea hermana justo debajo:

```tsx
              data-tip={!preview && p.node.current ? "camino.primer-nivel" : undefined}
```

Misma condición que el atributo de al lado: en la vista previa de otra dificultad no hay "tu primer nivel" que señalar.

- [ ] **Step 3: Marca la llama de la racha**

En `components/shell/app-header.tsx`, el `<div className="flex items-center gap-1 font-black tabular-nums" …>` que envuelve la llama y el número gana:

```tsx
        data-tip="camino.racha"
```

- [ ] **Step 4: Marca la fila de juegos diarios**

En `components/play/arcade-grid.tsx`, el `<ul className={HERO_ROW_CLASS}>` gana:

```tsx
        data-tip="arcade.diarios"
```

- [ ] **Step 5: Marca las dos caras del Repaso**

En `app/(app)/(hub)/review/page.tsx`, el `<h1>` del estado vacío gana `data-tip="repaso.que-es"`.

En `components/review/review-quiz.tsx`, el **elemento más externo** que devuelve el componente gana el mismo `data-tip="repaso.que-es"`. Si ese elemento es un componente y no una etiqueta HTML (por ejemplo `PanelWrapper`), pon el atributo en el `<div>` o `<section>` HTML más externo que envuelva su contenido; **no modifiques la firma de ningún componente compartido** para hacerle sitio. Si no hubiera ninguno, dilo en el informe y deja solo el del estado vacío: el controlador salta en silencio la pista que no encuentra.

- [ ] **Step 6: Marca la tarjeta del torneo**

En `components/quests/tournament-card.tsx`, el `<div>` de la tarjeta **real** (el que lleva `rounded-2xl border border-(--border) bg-(--surface) p-4 flex flex-col gap-3` y la animación `dots-pop-in`) gana `data-tip="retos.torneo"`. **No** lo pongas en el esqueleto de carga ni toques la rama que devuelve `null`.

- [ ] **Step 7: Marca el avatar del perfil**

En `components/profile/profile-identity.tsx`, el `<div className="relative shrink-0">` que envuelve el avatar y el lápiz gana `data-tip="perfil.avatar"`.

- [ ] **Step 8: Marca el overlay de entrada**

En `components/ui/doty/doty-entrada.tsx`, el `<div>` con `className="fixed inset-0 z-50 …"` gana:

```tsx
      data-doty-entrada
```

con este comentario encima:

```tsx
      // Lo mira el controlador de pistas: mientras este overlay exista está
      // tapando la pantalla entera, así que medir un elemento debajo daría un
      // rectángulo que el usuario no puede ver.
```

- [ ] **Step 9: Verifica**

```bash
source ~/.nvm/nvm.sh && nvm use && npm run lint && npx tsc --noEmit && npm run test:scripts
```

Esperado: limpio y 88/88. Comprueba además con `git diff` que **solo** has añadido líneas: no debe haber ni una línea borrada salvo las tres del registro de tamaños de Doty que se reemplazan por sí mismas.

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "feat(pistas): los seis anclajes se marcan con data-tip y Doty gana el tamaño pista

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 3: Esperar, centrar y medir — `hooks/use-tip-anchor.ts`

**Files:**
- Create: `hooks/use-tip-anchor.ts`

**Interfaces:**
- Consumes: nada del proyecto; solo React y el DOM.
- Produces (lo consumen las Tasks 4 y 5): `export interface Recorte { top: number; left: number; width: number; height: number; radio: number }` y `export function useTipAnchor(clave: string | null): Recorte | null`.

Contexto: este hook resuelve los tres problemas de medir algo que todavía no existe.

**El elemento tarda en aparecer**, porque cada pantalla lo pinta después de que responda su fetch. Se reintenta por frame hasta ~1,5 s y, si nunca aparece, se devuelve `null` para siempre y el controlador salta la pista en silencio (decisión 6 del plan).

**El overlay de entrada puede estar tapando la pantalla** justo cuando una cuenta nueva llega, que es cuando disparan las pistas. Mientras exista un `[data-doty-entrada]` no se mide nada.

**El rectángulo se mueve si el usuario scrollea.** En vez de seguirlo, se centra el elemento con `scrollIntoView` **y después se bloquea el scroll del body**, igual que hacen la hoja de ajustes y el selector de avatar. Se usa `behavior: "auto"` a propósito: el scroll suave no tiene un evento de fin fiable y habría que adivinar cuándo medir.

**Regla 3**: el efecto no llama a `setState` en su cuerpo. Programa un `requestAnimationFrame` y es su callback quien mide y guarda. Y el recorte se guarda **junto a la clave con la que se midió**, para que al cambiar de pista no se enseñe un frame en el sitio anterior sin necesidad de resetear estado desde un efecto.

- [ ] **Step 1: Escribe el hook**

Crea `hooks/use-tip-anchor.ts`:

```ts
"use client";

import { useEffect, useState } from "react";

/** Rectángulo del foco, en coordenadas de viewport, con su holgura ya sumada. */
export interface Recorte {
  top: number;
  left: number;
  width: number;
  height: number;
  radio: number;
}

/** ~1,5 s a 60 fps. Si en ese tiempo la pantalla no lo pintó, no se insiste. */
const INTENTOS_MAX = 90;

/** Aire alrededor del elemento para que el foco no lo corte. */
const HOLGURA = 8;

/**
 * Encuentra el elemento marcado con `data-tip="<clave>"`, lo centra, lo mide y
 * bloquea el scroll mientras se enseña la pista.
 *
 * Devuelve `null` mientras no haya nada que enseñar, y también para siempre si
 * el elemento no llega a aparecer: una pista que no encuentra a qué apuntar se
 * salta en silencio, nunca bloquea al usuario.
 */
export function useTipAnchor(clave: string | null): Recorte | null {
  // El recorte viaja con la clave que lo midió: así, al pasar de una pista a
  // la siguiente, el valor viejo deja de ser válido sin tener que borrarlo
  // desde un efecto (regla 3).
  const [medida, setMedida] = useState<{ clave: string; recorte: Recorte } | null>(null);

  useEffect(() => {
    if (clave === null) return;
    let vivo = true;
    let frame = 0;
    let intentos = 0;

    const buscar = () => {
      if (!vivo) return;
      // Mientras la animación de entrada cubra la pantalla, lo que hay debajo
      // no se ve: medirlo daría un rectángulo que el usuario no puede mirar.
      const tapado = document.querySelector("[data-doty-entrada]") !== null;
      const el = tapado ? null : document.querySelector(`[data-tip="${clave}"]`);

      if (el) {
        // `auto` y no `smooth`: el suave no avisa cuándo terminó.
        el.scrollIntoView({ block: "center", behavior: "auto" });
        frame = requestAnimationFrame(() => {
          if (!vivo) return;
          const r = el.getBoundingClientRect();
          const radio = Number.parseFloat(getComputedStyle(el).borderTopLeftRadius) || 0;
          setMedida({
            clave,
            recorte: {
              top: r.top - HOLGURA,
              left: r.left - HOLGURA,
              width: r.width + HOLGURA * 2,
              height: r.height + HOLGURA * 2,
              radio: radio + HOLGURA,
            },
          });
        });
        return;
      }

      intentos += 1;
      if (intentos < INTENTOS_MAX) frame = requestAnimationFrame(buscar);
    };

    frame = requestAnimationFrame(buscar);
    return () => {
      vivo = false;
      cancelAnimationFrame(frame);
    };
  }, [clave]);

  const listo = medida !== null && medida.clave === clave;

  useEffect(() => {
    if (!listo) return;
    // Mismo bloqueo que components/profile/settings-sheet.tsx: con el scroll
    // parado, el rectángulo medido sigue siendo válido mientras dure la pista.
    const antes = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = antes;
    };
  }, [listo]);

  return listo ? medida.recorte : null;
}
```

- [ ] **Step 2: Verifica**

```bash
source ~/.nvm/nvm.sh && nvm use && npm run lint && npx tsc --noEmit && npm run test:scripts
```

Esperado: limpio y 88/88. El hook todavía no lo usa nadie; si el lint se quejara de un export sin consumidores, **no lo borres**: lo consume la Task 5. Dilo en el informe.

- [ ] **Step 3: Commit**

```bash
git add hooks/use-tip-anchor.ts
git commit -m "feat(pistas): el hook que espera al elemento, lo centra, lo mide y para el scroll

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 4: El foco y el bocadillo — `components/ui/doty-tip/doty-tip.tsx`

**Files:**
- Create: `components/ui/doty-tip/doty-tip.tsx`

**Interfaces:**
- Consumes: `Doty` de `components/ui/doty/doty` con `size="pista"` (Task 2); `type Tip` de `lib/tips` (Task 1); `type Recorte` de `hooks/use-tip-anchor` (Task 3).
- Produces (lo consume la Task 5): `export default function DotyTip({ tip, recorte, indice, total, onEntendido }: { tip: Tip; recorte: Recorte; indice: number; total: number; onEntendido: () => void })`.

Contexto: el foco es un `<div>` colocado en el rectángulo medido con `box-shadow: 0 0 0 9999px var(--scrim)`, que oscurece **todo menos** ese hueco. Es el recurso que pide el spec §7.3 literalmente y no existe todavía en el repo.

**El bocadillo no intenta apuntar con una flecha a la posición exacta.** Ocupa el ancho disponible con un máximo, centrado, y se coloca arriba o abajo del foco según dónde haya sitio. Es más robusto en móvil que calcular una flecha y recortar contra los bordes, y el foco ya dice a qué se refiere.

`<Doty say>` **no sirve aquí**: pinta su bocadillo encima de Doty en columna, con la flecha hacia abajo. Este componente compone el suyo.

Accesibilidad: `role="dialog"`, `aria-modal`, foco en el botón al abrir y `Escape` cierra igual que "Entendido" —una pista se enseña una sola vez, así que descartarla cuenta como haberla visto—. El `Escape` como cierre es el mismo patrón de `settings-sheet.tsx` y no cuenta como "teclado de entrada" a efectos de la regla 2.

- [ ] **Step 1: Escribe el componente**

Crea `components/ui/doty-tip/doty-tip.tsx`:

```tsx
"use client";

import { useEffect, useRef } from "react";

import Doty from "@/components/ui/doty/doty";
import type { Recorte } from "@/hooks/use-tip-anchor";
import type { Tip } from "@/lib/tips";

/**
 * Una pista contextual (spec §7.3): oscurece la pantalla menos el elemento del
 * que habla, y explica en una frase qué es.
 *
 * El foco es un `box-shadow` de 9999 px: el hueco es el propio div y la sombra
 * pinta todo lo demás. El bocadillo NO lleva flecha ni persigue la posición
 * exacta; se centra y se pone del lado donde hay sitio, que en un teléfono es
 * más fiable que recortar contra los bordes.
 */
interface Props {
  tip: Tip;
  recorte: Recorte;
  /** 1-based, para "Pista 1 de 2". */
  indice: number;
  total: number;
  onEntendido: () => void;
}

export default function DotyTip({ tip, recorte, indice, total, onEntendido }: Props) {
  const botonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    botonRef.current?.focus();
  }, []);

  useEffect(() => {
    const alPulsar = (e: KeyboardEvent) => {
      // Descartar cuenta como haberla visto: una pista se enseña una sola vez.
      if (e.key === "Escape") onEntendido();
    };
    document.addEventListener("keydown", alPulsar);
    return () => document.removeEventListener("keydown", alPulsar);
  }, [onEntendido]);

  // Arriba o abajo del foco, según dónde quede más aire.
  const debajo = recorte.top + recorte.height < window.innerHeight / 2;
  const posicion = debajo
    ? { top: recorte.top + recorte.height + 16 }
    : { bottom: window.innerHeight - recorte.top + 16 };

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label={tip.titulo}>
      {/* El hueco: la sombra gigante pinta todo lo que queda fuera. */}
      <div
        aria-hidden
        className="absolute"
        style={{
          top: recorte.top,
          left: recorte.left,
          width: recorte.width,
          height: recorte.height,
          borderRadius: recorte.radio,
          boxShadow: "0 0 0 9999px var(--scrim)",
          pointerEvents: "none",
        }}
      />

      <div
        className="absolute inset-x-0 flex justify-center px-4"
        style={{ ...posicion, animation: "dots-pop-in 0.35s ease-out both" }}
      >
        <div
          className="flex w-full max-w-sm flex-col items-center gap-2 rounded-2xl p-4 text-center"
          style={{
            background: "var(--surface)",
            border: "2px solid var(--border)",
            boxShadow: "0 8px 24px rgba(0,0,0,0.18)",
          }}
        >
          <Doty pose={tip.pose} size="pista" />
          <h2 className="font-display text-lg font-extrabold text-foreground">{tip.titulo}</h2>
          <p className="text-sm font-semibold text-(--muted)">{tip.frase}</p>
          <button
            ref={botonRef}
            type="button"
            onClick={onEntendido}
            className="dots-pressable mt-1 w-full rounded-2xl px-6 py-3 text-base font-black transition-transform duration-150 active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--accent)"
            style={{ background: "var(--accent)", color: "var(--accent-contrast)" }}
          >
            Entendido
          </button>
          {total > 1 && (
            <span className="text-xs font-extrabold text-(--muted)">
              Pista {indice} de {total}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verifica**

```bash
source ~/.nvm/nvm.sh && nvm use && npm run lint && npx tsc --noEmit && npm run test:scripts
```

Esperado: limpio y 88/88. Si el lint del compiler de React se queja de leer `window.innerHeight` durante el render, **dilo en el informe y no lo silencies**: la solución correcta sería medir el viewport en el hook de la Task 3 y pasarlo por props, y eso es una decisión del controlador, no tuya.

- [ ] **Step 3: Commit**

```bash
git add components/ui/doty-tip/doty-tip.tsx
git commit -m "feat(pistas): el foco y el bocadillo de una pista contextual

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 5: La orquestación — `components/tips/tips-controller.tsx`

**Files:**
- Create: `components/tips/tips-controller.tsx`
- Modify: `app/(app)/(hub)/layout.tsx`

**Interfaces:**
- Consumes: `pendientesPara` y `type Tip` de `lib/tips` (Task 1); `useTipAnchor` de `hooks/use-tip-anchor` (Task 3); `DotyTip` de `components/ui/doty-tip/doty-tip` (Task 4); `estadoPrimerInicio` y `suscribirPrimerInicio` de `lib/first-run` (F.1, ya en `main`); `getMySettingsService` y `patchMySettingsService` de `services/settings.service`; `useAuth`.
- Produces: `export default function TipsController()`, montado sin props.

Contexto: es el único componente que decide. Se monta en el layout del hub, que **se monta una vez por carga de página**, así que pide `/me/settings` una sola vez aunque el usuario cambie de pestaña diez veces.

**Dos esperas antes de enseñar nada**: que hayan llegado las pistas vistas, y que el primer inicio esté `"hecho"`. Lo segundo reutiliza el store que dejó F.1: mientras valga `"pendiente"` el usuario está yendo a la bienvenida, y mientras valga `"desconocido"` todavía no se sabe.

**El contador "Pista 1 de 2" necesita dos listas**: la que llegó del servidor, que no cambia, para saber cuántas había al llegar; y la que va creciendo según se marcan, para saber cuál toca. Con una sola, el total bajaría de 2 a 1 mientras el usuario mira.

**El PATCH es acumulativo y optimista**: se añade la clave a la lista local en el acto y se manda al servidor sin esperar. Si el PATCH falla, la pista no se repite en esta sesión pero sí en la siguiente, que es el fallo correcto: molestar una vez más es mejor que perder la explicación.

- [ ] **Step 1: Escribe el controlador**

Crea `components/tips/tips-controller.tsx`:

```tsx
"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";

import DotyTip from "@/components/ui/doty-tip/doty-tip";
import { useTipAnchor } from "@/hooks/use-tip-anchor";
import { useAuth } from "@/context/auth-context";
import { estadoPrimerInicio, suscribirPrimerInicio } from "@/lib/first-run";
import { pendientesPara } from "@/lib/tips";
import { getMySettingsService, patchMySettingsService } from "@/services/settings.service";

/**
 * Pistas contextuales (spec §7.3): decide cuál toca en esta pantalla y la
 * enseña una sola vez.
 *
 * Va en el layout del hub, que se monta una vez por carga de página: así
 * `/me/settings` se pide una vez aunque el usuario recorra las cinco
 * pestañas. Encuentra a qué apuntar por `data-tip` en el DOM y no por refs,
 * porque la llama de la racha vive en la cabecera del propio layout y ninguna
 * página podría pasársela.
 */
export default function TipsController() {
  const pathname = usePathname();
  const { isBootstrapping, accessToken } = useAuth();
  const primerInicio = useSyncExternalStore(
    suscribirPrimerInicio,
    estadoPrimerInicio,
    () => "desconocido" as const,
  );

  // `iniciales` es la foto que llegó del servidor y no cambia: da el total del
  // contador. `vistas` crece según se marcan y dice cuál toca ahora.
  const [iniciales, setIniciales] = useState<string[] | null>(null);
  const [vistas, setVistas] = useState<string[]>([]);

  useEffect(() => {
    if (isBootstrapping || !accessToken) return;
    let vivo = true;
    getMySettingsService().then((s) => {
      if (!vivo) return;
      const ya = s?.tips_seen ?? [];
      setIniciales(ya);
      setVistas(ya);
    });
    return () => {
      vivo = false;
    };
  }, [isBootstrapping, accessToken]);

  // Mientras el primer inicio no esté resuelto, el usuario está yendo o
  // volviendo de la bienvenida: no es momento de explicarle la pantalla.
  const listo = iniciales !== null && primerInicio === "hecho";
  const cola = listo ? pendientesPara(pathname, vistas) : [];
  const actual = cola[0] ?? null;
  const total = listo ? pendientesPara(pathname, iniciales).length : 0;
  const recorte = useTipAnchor(actual?.key ?? null);

  const entendido = useCallback(() => {
    if (!actual) return;
    setVistas((v) => (v.includes(actual.key) ? v : [...v, actual.key]));
    // Optimista: si el PATCH falla, la pista no se repite en esta sesión pero
    // sí en la siguiente. Molestar una vez más es mejor que perder la
    // explicación.
    patchMySettingsService({ tips_seen: [actual.key] }).catch(() => undefined);
  }, [actual]);

  if (!actual || !recorte) return null;

  return (
    <DotyTip
      tip={actual}
      recorte={recorte}
      indice={total - cola.length + 1}
      total={total}
      onEntendido={entendido}
    />
  );
}
```

- [ ] **Step 2: Móntalo en el layout del hub**

En `app/(app)/(hub)/layout.tsx`, añade el import junto a los otros y el componente **después** de `<DotyEntrada />` y **antes** de `<AppNav />`:

```tsx
      {/* Pistas contextuales (spec §7.3): espera a que el primer inicio esté
          resuelto y a que el overlay de entrada se haya ido. */}
      <TipsController />
```

- [ ] **Step 3: Verifica**

```bash
source ~/.nvm/nvm.sh && nvm use && npm run lint && npx tsc --noEmit && npm run test:scripts && npx next build
```

Esperado: lint limpio y sin avisos, sin errores de tipos, 88/88, build verde. El build tarda un par de minutos; déjalo terminar.

- [ ] **Step 4: Commit**

```bash
git add components/tips/tips-controller.tsx "app/(app)/(hub)/layout.tsx"
git commit -m "feat(pistas): el controlador decide qué pista toca y la marca como vista

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 6: Documentación

**Files:**
- Modify: `docs/superpowers/specs/2026-09-14-rediseno-look-and-feel-juvenil-design.md` (§7.3)
- Modify: `docs/ARQUITECTURA.md`

**Interfaces:** ninguna; es documentación.

- [ ] **Step 1: Cierra el §7.3 de la spec**

Localiza la viñeta que empieza por `- Componente `DotyTip`: recibe el `ref` del elemento objetivo` y sustitúyela entera por:

```
- Componente `DotyTip`: pinta un foco (`box-shadow: 0 0 0 9999px scrim`, con el radio del objetivo)
  más un bocadillo con Doty de 84 px, título Baloo, una frase y el botón "Entendido" con
  "Pista 1 de 2". Solo `transform`/`opacity`; el patrón overlay + medición es portable a RN.
  **Corregido el 2026-09-17**: no recibe un `ref`, sino que encuentra el objetivo por un atributo
  `data-tip` en el DOM. La llama de la racha vive en la cabecera del LAYOUT del hub y ninguna
  página puede pasarle un ref; además el Camino ya usaba ese mismo truco con `data-path-current`.
  Medir y esperar al elemento vive en `hooks/use-tip-anchor.ts`, que centra el objetivo con
  `scrollIntoView` y después **bloquea el scroll**, para que el rectángulo medido siga siendo
  válido mientras dure la pista. Una pista cuyo objetivo no aparece en ~1,5 s se salta en
  silencio, y no se marca como vista.
```

- [ ] **Step 2: Añade la nota del copy**

Justo después de la viñeta de las claves de `tips_seen`, añade:

```
- **Copy de las seis (2026-09-17)**: las dos del Camino son las aprobadas en la tabla de voz; las
  de arcade, repaso, torneo y perfil se escribieron con este plan siguiendo las cinco reglas de
  §2.2 y viven en `lib/tips.ts`. El `·` de las frases aprobadas separa título de frase, y así se
  parten en el componente.
```

- [ ] **Step 3: Registra las pistas en la arquitectura**

En `docs/ARQUITECTURA.md`, inserta esta sección completa **justo antes** de la línea `### Primer inicio (`/welcome`)`, dejando una línea en blanco antes y después:

```
### Pistas contextuales

Lo único que hace falta entender de cada pestaña, dicho una vez y nunca más. Un solo
`TipsController` en el layout del hub decide cuál toca según la ruta, y encuentra el
elemento al que apuntar **por un atributo `data-tip` en el DOM**, no por refs: la
llama de la racha vive en la cabecera del propio layout y ninguna página podría
pasársela, y el Camino ya localizaba así su nodo actual. El catálogo y la selección
son puros (`lib/tips.ts`, bajo `node --test`); esperar, centrar y medir el objetivo
es `hooks/use-tip-anchor.ts`; pintar el foco y el bocadillo es
`components/ui/doty-tip/`.

Se marcan con `PATCH /me/settings { tips_seen: [clave] }`, que el backend acumula
en unión de-duplicada, así que no se repiten en otro dispositivo. Nada se enseña
hasta que el primer inicio esté resuelto y el overlay de entrada haya terminado, y
una pista cuyo objetivo no aparece se salta en silencio.
```

- [ ] **Step 4: Verifica y commitea**

```bash
source ~/.nvm/nvm.sh && nvm use && npm run lint
```

```bash
git add docs/superpowers/specs/2026-09-14-rediseno-look-and-feel-juvenil-design.md docs/ARQUITECTURA.md
git commit -m "docs(pistas): la spec corrige el ref del §7.3 por el atributo data-tip

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

## Verificación en navegador (la hace Sergio)

Hace falta una cuenta con `tips_seen` vacío. Para vaciarlo:

```sql
UPDATE dots.users SET settings = settings - 'tips_seen' WHERE email = '<tu correo>';
```

1. Entra al Camino: aparece el foco sobre tu nodo actual con "Este es tu primer nivel" y "Pista 1 de 2". "Entendido" la cierra y sale la de la llama, apuntando a la cabecera.
2. Cambia de pestaña y vuelve al Camino: no reaparece ninguna.
3. Arcade, Repaso, Retos y Perfil: una pista cada uno, sin contador.
4. En Repaso con y sin cosas que repasar: en los dos casos hay a qué apuntar.
5. Recarga: no se repite ninguna. Entra desde otro navegador con la misma cuenta: tampoco.
6. Mientras hay una pista, la página no scrollea; al cerrarla vuelve a scrollear.
7. Con el nodo actual abajo del todo del Camino, la pista lo centra antes de enseñarlo.
8. Cuenta nueva: la bienvenida va primero y las pistas esperan a que termine, sin pelearse con la animación de entrada.
9. Con teclado: `Escape` cierra una pista y no vuelve a salir.
10. En 390 px el bocadillo no se sale ni tapa el foco.

## Cobertura del spec §7.3

| Requisito | Tarea |
|---|---|
| Foco con el radio del objetivo, bocadillo con Doty 84, título, frase y "Entendido" | Task 2 (tamaño) + Task 4 |
| Contador "Pista 1 de 2" | Task 4 + Task 5 (los dos conjuntos) |
| Solo `transform`/`opacity` | Task 4 (`dots-pop-in`) |
| Las seis claves en `settings.tips_seen` | Task 1 |
| Máximo dos por pestaña, solo primera visita | Task 1 (`MAX_POR_PANTALLA`, `pendientesPara`) |
| "Entendido" hace PATCH acumulativo | Task 5 |
| Copy aprobado del Camino, literal | Task 1 |
| `arcade.trono` | **se cae**: sin objetivo desde el subproyecto C (documentado en Task 6) |
