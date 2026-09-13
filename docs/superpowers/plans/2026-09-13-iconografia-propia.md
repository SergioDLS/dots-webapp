# Iconografía propia Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sustituir los 42 emoji que la app usa como iconografía por 30 iconos SVG dibujados y 12 piezas PNG generadas, para que el icono no dependa del sistema operativo y el conjunto lea como una sola familia con el arte de las fases 1 y 2.

**Architecture:** Un componente `<Icon>` con los caminos SVG inline en un único `paths.ts` — una sola costura para un puerto futuro a React Native, y `currentColor` funcionando para los estados activo/bloqueado que hoy no se ven. Un `<UiIcon>` aparte para las 12 piezas PNG, que tienen color propio y no se tiñen. Un verificador `check-icons.mjs` enganchado a `npm run lint` convierte la regla de dibujo en algo que la máquina comprueba, no en una buena intención.

**Tech Stack:** Next.js 16 (app router), React 19, Tailwind 4, TypeScript. Pipeline `scripts/mj/` en Python (uv, pytest, Pillow, rembg). Verificadores en Node ESM.

**Spec:** `docs/superpowers/specs/2026-09-13-iconografia-propia-design.md`

## Global Constraints

- **Paleta cerrada.** Rellenos solo en rosa `#FF1F8F`, azul `#3768FF`, cyan `#35D8F5` y blanco `#ffffff`. Contorno siempre navy `#1E1B5C`.
- **Nunca navy como relleno.** Mide 1.18:1 sobre `--background: #14122e` del tema oscuro y la forma se funde con el fondo.
- **Rellenos planos.** Sin degradados ni brillos: Doty es un personaje, un icono es un signo.
- **`viewBox="0 0 48 48"`** en los 30 SVG, sin excepción.
- **Geometría redondeada:** `stroke-linecap="round"` y `stroke-linejoin="round"`.
- **El grosor NO se copia de los tiles.** El contorno de la fase 2 es el 1.8% del sujeto, que a 24 px son 0.45 px: invisible. El grosor se elige por tamaño de uso — nav 24 px → `stroke-width` 3; nodo 40 px → 2.5; glifo 16 px → 3.5. Dentro de una misma familia el grosor es idéntico en todas las piezas.
- **Verificación al tamaño real.** Toda pieza se juzga a su tamaño de uso, sobre `--surface` del tema claro (`#ffffff`) y del oscuro (`#201a4d`). Mirar a tamaño completo miente.
- **RN-safe** (regla 2 del CLAUDE.md): solo `onPointerUp`/`onClick`, animación solo `transform`/`opacity`. Los SVG viven en un único componente para que el puerto a `react-native-svg` no toque ninguna pantalla.
- **Node 24**: `source ~/.nvm/nvm.sh && nvm use` antes de cualquier `npm`. En fish: `set -x PATH (ls -d ~/.nvm/versions/node/v24*/bin | tail -1) $PATH`.
- **`npx next build` debe pasar antes de commitear.** No hay test runner de componentes: la verificación es lint + build + hoja de contacto.

---

## Estructura de archivos

| Archivo | Responsabilidad |
|---|---|
| `components/ui/icon/paths.ts` | Los 30 caminos SVG, como `Record<IconName, ReactNode>`. Único sitio donde vive geometría. |
| `components/ui/icon/icon.tsx` | Pinta un camino en un `<svg>` con tamaño y color. La costura de RN. |
| `components/ui/icon/index.ts` | Reexporta `Icon`, `IconName`. |
| `components/ui/ui-icon/ui-icon.tsx` | Pinta las 12 piezas PNG de `public/images/ui/`. |
| `scripts/check-icons.mjs` | Valida la regla de dibujo sobre `paths.ts`. Corre en `npm run lint`. |
| `scripts/contact-sheet-icons.mjs` | Genera la hoja de contacto de una familia a su tamaño real sobre los dos fondos. |
| `scripts/mj/batches/fase-3.json` | Catálogo de las 12 piezas generadas, grupo `ui`. |

---

### Task 1: El componente `<Icon>`, el verificador, y la familia del nav

Primera entrega completa: el nav deja de usar emoji y por primera vez tiñe el icono activo.

**Files:**
- Create: `components/ui/icon/paths.ts`
- Create: `components/ui/icon/icon.tsx`
- Create: `components/ui/icon/index.ts`
- Create: `scripts/check-icons.mjs`
- Create: `scripts/contact-sheet-icons.mjs`
- Modify: `components/shell/nav-items.ts`
- Modify: `components/shell/app-nav.tsx:83` y `:111`
- Modify: `package.json` (script `lint`)

**Interfaces:**
- Produces: `type IconName`, `<Icon name={IconName} size={number} className?={string} />`, y `ICON_PATHS: Record<IconName, ReactNode>`. Las tareas 2 y 3 añaden claves a `ICON_PATHS` y valores a `IconName`.

- [ ] **Step 1: Crear `components/ui/icon/paths.ts` con la familia del nav**

Los cinco del nav se dibujan juntos, en una sentada, porque comparten grosor y tienen que verse como un set. `stroke-width` 3 en los cinco (nav = 24 px).

```tsx
import type { ReactNode } from "react";

/**
 * Geometría de los iconos de dots. Único sitio del repo donde vive un `path`.
 *
 * El contorno usa `currentColor` a propósito: el nav tiñe el destino activo y
 * el nodo del Camino se apaga al bloquearse. Con un PNG eso obligaría a dos
 * archivos por estado. Los rellenos van fijos en la paleta porque son
 * identidad, no estado.
 *
 * `viewBox` 0 0 48 48 en todos, y el grosor constante DENTRO de cada familia:
 * nav 3, nodo 2.5, glifo 3.5. No se copia el grosor de los tiles de la fase 2
 * (1.8% del sujeto): a 24 px serían 0.45 px y no se verían.
 */
export const ICON_PATHS = {
  // ── familia nav · stroke-width 3 ──────────────────────────────────────────
  camino: (
    <g fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 41c0-9 24-9 24-18S24 14 24 7" stroke="#35D8F5" />
      <circle cx="12" cy="41" r="4" fill="#FF1F8F" />
      <circle cx="24" cy="7" r="4" fill="#FF1F8F" />
    </g>
  ),
  // el resto de la familia se dibuja en el Step 3
} as const satisfies Record<string, ReactNode>;

export type IconName = keyof typeof ICON_PATHS;
```

- [ ] **Step 2: Crear `components/ui/icon/icon.tsx`**

```tsx
import type { ReactNode } from "react";
import { ICON_PATHS, type IconName } from "./paths";

interface Props {
  name: IconName;
  /** Lado en px. El viewBox es siempre 48; esto solo escala. */
  size?: number;
  className?: string;
}

/**
 * Pinta un icono del set. Es la ÚNICA costura entre las pantallas y el SVG:
 * el día que haya app React Native, este archivo se reescribe con
 * `react-native-svg` y ninguna pantalla cambia. Por eso las pantallas nunca
 * llevan un `<svg>` suelto.
 */
export default function Icon({ name, size = 24, className }: Props) {
  return (
    <svg
      viewBox="0 0 48 48"
      width={size}
      height={size}
      className={className}
      aria-hidden
      focusable="false"
    >
      {ICON_PATHS[name]}
    </svg>
  );
}
```

- [ ] **Step 3: Crear `components/ui/icon/index.ts`**

```ts
export { default as Icon } from "./icon";
export type { IconName } from "./paths";
```

- [ ] **Step 4: Escribir el verificador `scripts/check-icons.mjs`**

Convierte la regla de dibujo en algo que falla el lint. Sin esto, la regla se erosiona en la tercera sesión de dibujo — que es exactamente lo que pasó con los 6 iconos de la fase 1.

```js
#!/usr/bin/env node
// Valida la regla de dibujo de components/ui/icon/paths.ts.
// Falla si un icono usa un color fuera de paleta, navy como relleno, o un
// stroke-width distinto al de su familia.
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = new URL("..", import.meta.url).pathname;
const source = readFileSync(join(root, "components/ui/icon/paths.ts"), "utf8");

const PALETA = new Set(["#FF1F8F", "#3768FF", "#35D8F5", "#ffffff", "none", "currentColor"]);
const NAVY = "#1E1B5C";
const errors = [];

// 1. Ningún color fuera de la paleta, en fill ni en stroke.
//    El rango es [A-Za-z], no [a-z]: con minúsculas solo, `currentColor` casa
//    como `current` y el verificador lo denuncia como color inventado.
for (const m of source.matchAll(/(?:fill|stroke)=["{]"?(#[0-9A-Fa-f]{3,8}|[A-Za-z]+)"?/g)) {
  const c = m[1];
  if (c === NAVY) continue; // navy es legítimo como contorno; el fill se revisa abajo
  if (!PALETA.has(c)) errors.push(`color fuera de paleta: ${c}`);
}

// 2. Navy nunca como relleno. Es la regla 10 del CLAUDE.md: sobre el tema
//    oscuro mide 1.18:1 y la forma desaparece.
for (const _ of source.matchAll(new RegExp(`fill=["{]"?${NAVY}`, "g"))) {
  errors.push(`navy como relleno (${NAVY}): es color de línea, no de masa`);
}

// 3. Sin degradados ni brillos.
for (const t of ["linearGradient", "radialGradient", "filter="]) {
  if (source.includes(t)) errors.push(`relleno no plano: ${t}`);
}

// 4. Grosor constante por familia. Las familias se marcan con un comentario
//    `── familia <nombre> · stroke-width <n> ──` y todo lo que va debajo hasta
//    la siguiente marca debe usar ese grosor.
const marcas = [...source.matchAll(/── familia (\S+) · stroke-width ([\d.]+) ──/g)];
if (marcas.length === 0) errors.push("ninguna familia declarada en paths.ts");
for (let i = 0; i < marcas.length; i++) {
  const desde = marcas[i].index;
  const hasta = i + 1 < marcas.length ? marcas[i + 1].index : source.length;
  const [, familia, esperado] = marcas[i];
  for (const m of source.slice(desde, hasta).matchAll(/strokeWidth=\{([\d.]+)\}/g)) {
    if (m[1] !== esperado) {
      errors.push(`familia ${familia}: strokeWidth ${m[1]} donde la familia usa ${esperado}`);
    }
  }
}

// 5. Un solo viewBox, y vive en icon.tsx, no aquí.
if (source.includes("viewBox")) errors.push("paths.ts no declara viewBox: lo pone icon.tsx");

if (errors.length) {
  console.error(`check-icons: ${errors.length} problema(s)\n  ${errors.join("\n  ")}`);
  process.exit(1);
}
const n = [...source.matchAll(/^  [a-z][\w-]*: \(/gm)].length;
console.log(`check-icons: ${n} iconos OK (${marcas.length} familia(s))`);
```

- [ ] **Step 5: Correr el verificador y comprobar que PASA con un solo icono**

```bash
node scripts/check-icons.mjs
```
Esperado: `check-icons: 1 iconos OK (1 familia(s))`

- [ ] **Step 6: Comprobar que el verificador TIENE DIENTES**

Un verificador que no se ha visto fallar no verifica nada. Mete temporalmente en `paths.ts`, dentro del `<g>` de `camino`, un `<rect fill="#1E1B5C" />` y corre otra vez:

```bash
node scripts/check-icons.mjs
```
Esperado: FALLA con `navy como relleno (#1E1B5C)`.

Ahora cambia ese rect a `fill="#00FF00"`:
Esperado: FALLA con `color fuera de paleta: #00FF00`.

Ahora déjalo en `fill="#FF1F8F"` pero con `strokeWidth={9}`:
Esperado: FALLA con `familia nav: strokeWidth 9 donde la familia usa 3`.

Quita el rect y confirma que vuelve a pasar. **Si alguno de los tres no falla, el verificador está mal y hay que arreglarlo antes de seguir.**

- [ ] **Step 7: Escribir `scripts/contact-sheet-icons.mjs`**

La verificación visual obligatoria de las tareas 1 a 3. Renderiza una familia a su tamaño de uso sobre los dos fondos reales.

```js
#!/usr/bin/env node
// Hoja de contacto de una familia de iconos, a su tamaño de uso y sobre los
// fondos reales de los dos temas. Mirar el icono a tamaño completo miente:
// lo que decide es si sobrevive la reducción.
//
//   node scripts/contact-sheet-icons.mjs nav 24
//
// Escribe un HTML; ábrelo con el preview y hazle captura.
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const root = new URL("..", import.meta.url).pathname;
const [familia, tam = "24"] = process.argv.slice(2);
if (!familia) { console.error("uso: contact-sheet-icons.mjs <familia> [tamaño]"); process.exit(1); }

const source = readFileSync(join(root, "components/ui/icon/paths.ts"), "utf8");
const marcas = [...source.matchAll(/── familia (\S+) · stroke-width ([\d.]+) ──/g)];
const i = marcas.findIndex((m) => m[1] === familia);
if (i === -1) { console.error(`no existe la familia ${familia}`); process.exit(1); }
const bloque = source.slice(marcas[i].index, i + 1 < marcas.length ? marcas[i + 1].index : source.length);
const nombres = [...bloque.matchAll(/^  ([a-z][\w-]*): \(/gm)].map((m) => m[1]);

// El JSX no se puede renderizar desde Node sin compilar, así que la hoja
// importa el componente real a través de una página de Next: esto solo genera
// la ruta de prueba que la sirve.
const page = `// Generado por scripts/contact-sheet-icons.mjs — no editar a mano.
import { Icon } from "@/components/ui/icon";
const NOMBRES = ${JSON.stringify(nombres)} as const;
export default function Hoja() {
  return (
    <div>
      {[["#ffffff", "#1E1B5C"], ["#201a4d", "#ffffff"]].map(([bg, fg]) => (
        <div key={bg} style={{ background: bg, color: fg, padding: 24, display: "flex", gap: 24 }}>
          {NOMBRES.map((n) => (
            <div key={n} style={{ textAlign: "center", fontSize: 10 }}>
              <Icon name={n} size={${tam}} />
              <div>{n}</div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
`;
writeFileSync(join(root, "app/dev-iconos/page.tsx"), page);
console.log(`hoja de ${nombres.length} iconos (${familia}, ${tam}px) → /dev-iconos`);
```

- [ ] **Step 8: Enganchar el verificador al lint**

En `package.json`, el script `lint` pasa de:
```json
"lint": "eslint && node scripts/check-doty-assets.mjs --strict",
```
a:
```json
"lint": "eslint && node scripts/check-doty-assets.mjs --strict && node scripts/check-icons.mjs",
```

- [ ] **Step 9: Dibujar los cuatro que faltan de la familia nav**

En `paths.ts`, debajo de `camino` y antes del cierre. `stroke-width` 3 en los cuatro. El encargo de cada uno:

| Clave | Sustituye | Qué se dibuja |
|---|---|---|
| `repaso` | 🔁 | Flecha circular cerrada, cabeza gruesa. El arco en azul `#3768FF`, la cabeza en rosa. |
| `retos` | 🎯 | Diana de tres anillos concéntricos: exterior rosa, medio blanco, centro cyan. |
| `juegos` | 🎮 | Mando: cuerpo de cápsula rosa con esquinas muy redondeadas, cruceta blanca a la izquierda, dos botones cyan a la derecha. |
| `perfil` | 👤 | Busto: círculo de cabeza y arco de hombros. Cabeza rosa, hombros cyan. |

Reglas que aplican a los cuatro: contorno `currentColor` a 3, rellenos de paleta, nada de navy en `fill`, `strokeLinecap`/`strokeLinejoin` en `round`. La geometría debe **llenar el viewBox**: un dibujo que ocupa solo el centro se ve diminuto a 24 px.

- [ ] **Step 10: Verificar la familia al tamaño real**

```bash
node scripts/contact-sheet-icons.mjs nav 24
```
Levanta el preview (`preview_start` con la config `dots-webapp`), abre `/dev-iconos` y haz captura.

Criterios, y son de rechazo:
1. Los cinco se distinguen entre sí de un vistazo a 24 px.
2. Ninguno desaparece sobre el fondo oscuro.
3. Los cinco tienen el mismo peso visual: ninguno se ve notablemente más gordo o más fino.
4. Ninguno se lee como "una mancha": a 24 px el detalle fino colapsa.

Si alguno falla, redibújalo y repite. **No sigas al Step 11 con un icono que falle.**

- [ ] **Step 11: Cablear el nav**

`components/shell/nav-items.ts` pasa de `icon: string` (emoji) a `icon: IconName`:

```ts
import type { IconName } from "@/components/ui/icon";

/** Destinos de la navegación principal (barra inferior móvil + riel desktop). */
export type NavItem = {
  href: string;
  label: string;
  icon: IconName;
};

export const NAV_ITEMS: NavItem[] = [
  { href: "/levels", label: "Camino", icon: "camino" },
  { href: "/review", label: "Repaso", icon: "repaso" },
  { href: "/quests", label: "Retos", icon: "retos" },
  { href: "/play", label: "Juegos", icon: "juegos" },
  { href: "/profile", label: "Perfil", icon: "perfil" },
];
```

En `app-nav.tsx`, las dos apariciones de `{item.icon}` (líneas 83 y 111) pasan a `<Icon name={item.icon} size={24} />`. El `className` del contenedor ya lleva `text-(--accent)` / `text-(--muted)`, así que el `currentColor` del contorno hereda el estado sin tocar nada más — **ese es el arreglo**: hasta ahora el estado activo solo se veía en la etiqueta.

- [ ] **Step 12: Lint, build y captura del nav**

```bash
npm run lint && npx next build
```
Esperado: `check-icons: 5 iconos OK (1 familia(s))` y build en verde.

Luego, en el preview, navega entre dos destinos y haz captura de los dos estados. El icono activo debe verse rosa y el inactivo gris. Si el icono no cambia de color, el contorno no está usando `currentColor`.

- [ ] **Step 13: Commit**

```bash
git add components/ui/icon scripts/check-icons.mjs scripts/contact-sheet-icons.mjs \
        components/shell/nav-items.ts components/shell/app-nav.tsx package.json
git commit -m "feat(iconos): componente Icon, verificador de la regla, y el nav sin emoji

El nav pintaba emoji, que los dibuja el sistema operativo: distintos en Safari
de iPhone y en escritorio. Y como un emoji ignora el color del texto, el estado
activo solo se veía en la etiqueta. Los cinco pasan a SVG con el contorno en
currentColor, así que ahora el icono también se tiñe.

check-icons.mjs entra en el lint para que la regla de dibujo la compruebe la
máquina: paleta cerrada, navy nunca de relleno, rellenos planos y grosor
constante dentro de cada familia. Sin eso la regla se erosiona, que es como
acabaron los seis iconos de la fase 1."
```

---

### Task 2: La familia de los tipos de nodo

**Files:**
- Modify: `components/ui/icon/paths.ts`
- Modify: `lib/path-node-meta.ts`
- Modify: `components/path/path-node.tsx:231` y `:270`

**Interfaces:**
- Consumes: `ICON_PATHS`, `IconName`, `<Icon>` de la tarea 1.
- Produces: ocho claves nuevas en `IconName`; `NODE_META[t].icon` pasa de `string` a `IconName`.

- [ ] **Step 1: Dibujar los ocho, con la marca de familia**

En `paths.ts`, después de la familia nav:

```tsx
  // ── familia nodo · stroke-width 2.5 ───────────────────────────────────────
```

El nodo se pinta a 40 px, así que el grosor baja a 2.5. Los ocho:

| Clave | Sustituye | Nodo | Qué se dibuja |
|---|---|---|---|
| `leccion` | 📖 | practice | Libro abierto de dos páginas, lomo al centro. Páginas blancas, cubierta rosa. |
| `escucha` | 🔊 | pronunciation | Altavoz con dos ondas. Cuerpo rosa, ondas cyan. |
| `gramatica` | 🧩 | grammar | Dos piezas de puzzle encajando. Una rosa, otra cyan. |
| `vocabulario` | 💬 | vocab | Bocadillo de habla con tres puntos. Globo blanco; puntos rosa, cyan y azul. **Este es el "Saludos" que motivó la fase.** |
| `letras` | 🔤 | letters | Tres fichas cuadradas con esquinas redondeadas, superpuestas en abanico. Sin letras dentro: Midjourney y las fuentes escriben mal, y la app se traduce. |
| `numeros` | 🔢 | numbers | Ábaco de dos varillas con tres cuentas. Cuentas rosa y cyan. |
| `lectura` | 📚 | reading | Tres libros de canto, alturas distintas. Rosa, cyan, azul. |
| `checkpoint` | 🏁 | checkpoint | Banderín triangular sobre un mástil. Banderín rosa, mástil en contorno. |

`letras` y `lectura` se parecen por definición — uno es el alfabeto y otro son libros. Diferéncialos por **silueta global**: fichas cuadradas apiladas en abanico contra lomos verticales de alturas distintas. A 40 px lo que se distingue es el contorno exterior, no el interior.

- [ ] **Step 2: Verificar la familia al tamaño real**

```bash
node scripts/contact-sheet-icons.mjs nodo 40
```
Mismos cuatro criterios de rechazo del Step 10 de la tarea 1, más uno propio: **`letras` y `lectura` tienen que distinguirse entre sí a 40 px**. Si al entrecerrar los ojos son la misma mancha, uno de los dos se redibuja.

- [ ] **Step 3: Cambiar el tipo en `lib/path-node-meta.ts`**

```ts
import type { IconName } from "@/components/ui/icon";
import type { PathNode, PathNodeType } from "@/types/path.types";

type NodeMeta = {
  icon: IconName;
  label: string;
  route: (node: PathNode) => string;
};

export const NODE_META: Record<PathNodeType, NodeMeta> = {
  practice:      { icon: "leccion",     label: "Lección",     route: (n) => `/practice?id=${n.levelId ?? n.id}` },
  pronunciation: { icon: "escucha",     label: "Escucha",     route: (n) => `/lesson/pronunciation?id=${n.id}` },
  grammar:       { icon: "gramatica",   label: "Gramática",   route: (n) => `/lesson/grammar?id=${n.id}` },
  vocab:         { icon: "vocabulario", label: "Vocabulario", route: (n) => `/lesson/vocab?id=${n.id}` },
  letters:       { icon: "letras",      label: "Letras",      route: (n) => `/lesson/letters?id=${n.id}` },
  numbers:       { icon: "numeros",     label: "Números",     route: (n) => `/lesson/numbers?id=${n.id}` },
  reading:       { icon: "lectura",     label: "Lectura",     route: (n) => `/readings/${n.readingId ?? n.id}` },
  checkpoint:    { icon: "checkpoint",  label: "Checkpoint",  route: (n) => `/checkpoint?id=${n.sectionId}` },
};
```

- [ ] **Step 4: Cablear `path-node.tsx`**

Línea 231, el `<span>` con `fontSize: isCheckpoint ? 52 : 40` que envuelve `{meta.icon}`, pasa a:

```tsx
<Icon name={meta.icon} size={isCheckpoint ? 52 : 40} />
```

El `<span>` y su `fontSize` desaparecen: `fontSize` existía solo para escalar un emoji, y `<Icon>` recibe el tamaño directamente. Línea 270 (`fontSize: 13`) pasa a `<Icon name={meta.icon} size={13} />`.

El `filter: grayscale(1)` del bloqueado (línea ~209) **se queda**: sigue funcionando y ahora apaga también el contorno.

- [ ] **Step 5: Lint, build y captura del Camino**

```bash
npm run lint && npx next build
```
Esperado: `check-icons: 13 iconos OK (2 familia(s))`.

En el preview, entra al Camino y haz captura. Comprueba los tres estados de un nodo: bloqueado (gris), abierto y completado.

- [ ] **Step 6: Commit**

```bash
git add components/ui/icon/paths.ts lib/path-node-meta.ts components/path/path-node.tsx
git commit -m "feat(iconos): los ocho tipos de nodo del Camino dejan de ser emoji

El nodo de un nivel ya era arte propio desde la fase 2 y el de al lado seguía
siendo un emoji de Apple: dos lenguajes visuales en nodos contiguos. El caso
que lo hizo evidente es 'Saludos', cuyo 💬 sale distinto en Safari de iPhone.

El fontSize del span desaparece: existía solo para escalar un emoji."
```

---

### Task 3: La familia de los glifos de interfaz

Diecisiete piezas, repartidas por diez archivos. Van en una sola tarea porque comparten grosor y hay que dibujarlas de una sentada para que casen.

**Files:**
- Modify: `components/ui/icon/paths.ts`
- Modify: `app/(app)/lesson/letters/page.tsx`, `components/interactive-column/daily-quest.tsx`, `components/quests/challenges-panel.tsx`, `app/(app)/games/true-false/page.tsx`, `app/(app)/games/memory/page.tsx`, `components/path/path-difficulty.tsx`, `components/practice-container/practice-container.tsx`, `app/(app)/(hub)/profile/page.tsx`, `app/(app)/games/dot-match/page.tsx`, `components/theme-toggle.tsx`

**Interfaces:**
- Consumes: `<Icon>`, `IconName`.
- Produces: diecisiete claves nuevas en `IconName`.

- [ ] **Step 1: Dibujar los diecisiete**

```tsx
  // ── familia glifo · stroke-width 3.5 ──────────────────────────────────────
```

Van a 16 px, el tamaño más pequeño del set, así que el grosor sube a 3.5 y la geometría tiene que ser la más simple de las tres familias: dos o tres trazos, cero detalle interior.

| Clave | Sustituye | Dónde vive hoy | Qué se dibuja |
|---|---|---|---|
| `check` | ✓ ✅ | letters/page.tsx, daily-quest.tsx | Palomita sola, dos trazos. Contorno `currentColor` para que herede el verde de éxito o el gris. |
| `cruz` | ❌ ✗ | challenges-panel.tsx, true-false/page.tsx | Aspa de dos trazos. Igual, `currentColor`. |
| `aviso` | ⚠️ | memory/page.tsx | Triángulo redondeado con admiración. Relleno cyan. |
| `candado` | 🔒 | path-difficulty.tsx | Cuerpo de candado y arco. Cuerpo rosa, arco en contorno. |
| `lupa` | 🔍 | practice-container.tsx | Círculo y mango. Todo contorno. |
| `lapiz` | ✏️ | practice-container.tsx | Lápiz en diagonal, punta abajo. Cuerpo rosa, punta en contorno. |
| `ajustes` | ⚙️ | profile/page.tsx | Engranaje de seis dientes, hueco central. Relleno azul. |
| `enlace` | 🔗 | dot-match/page.tsx | Dos eslabones entrelazados. Uno rosa, otro cyan. |
| `abajo` | 👇 | path-difficulty.tsx | Flecha hacia abajo, cabeza gruesa. Contorno. |
| `sol` | ☀️ | theme-toggle.tsx | Círculo y seis rayos. Relleno rosa. |
| `luna` | 🌙 | theme-toggle.tsx | Media luna. Relleno azul. |
| `imagen` | 🖼️ | practice-container.tsx | Marco con una montaña dentro. Marco contorno, montaña cyan. |
| `calendario` | 🗓️ | daily-quest.tsx | Rejilla de cuatro celdas con cabecera. Cabecera rosa. |
| `punto` | 🔵 | memory/page.tsx | Círculo relleno cyan. |
| `cuadro` | 🟦 | ghost-race/page.tsx | Cuadrado de esquinas redondeadas, relleno azul. |
| `obras` | 🚧 | path-difficulty.tsx | Valla de dos patas con franjas. Franjas rosa y blanco. |
| `empate` | 🤝 | challenges-panel.tsx:28 | Es el resultado *Empate* de un reto, no un saludo. Dos barras horizontales iguales, una rosa y otra cyan — un signo `=`. Un apretón de manos no se lee a 16 px, y además el significado aquí es "iguales". |

- [ ] **Step 2: Verificar la familia a 16 px**

```bash
node scripts/contact-sheet-icons.mjs glifo 16
```
A este tamaño el criterio más duro es el 4 (nada de manchas). `ajustes`, `obras` y `mano` son los candidatos a fallar por exceso de detalle — si no se leen, simplifícalos hasta que se lean, aunque pierdan fidelidad al objeto.

- [ ] **Step 3: Sustituir los diecisiete call sites**

En cada archivo, el emoji suelto pasa a `<Icon name="…" size={16} />`. Importa desde `@/components/ui/icon`.

Dos con cuidado:
- **`theme-toggle.tsx`**: ☀️ y 🌙 están en el botón que cambia de tema. Comprueba que el icono correcto sale en cada estado después del cambio; es fácil invertirlos.
- **`check` y `cruz`** aparecen en varios archivos con colores distintos (verde de acierto, rojo de fallo). Su contorno es `currentColor`, así que el color lo pone la clase del contenedor — **no metas el color en el path**.

- [ ] **Step 4: Comprobar que no queda ninguno**

```bash
grep -rnP '[\x{2600}-\x{27BF}\x{2B00}-\x{2BFF}]\x{FE0F}?' components app --include="*.tsx" | grep -v /admin
```
Esperado: solo las líneas de los emoji que la spec deja fuera de alcance. Ninguno de los diecisiete de la tabla.

- [ ] **Step 5: Lint, build, commit**

```bash
npm run lint && npx next build
```
Esperado: `check-icons: 30 iconos OK (3 familia(s))`.

```bash
git add components/ui/icon/paths.ts components app
git commit -m "feat(iconos): los diecisiete glifos de interfaz dejan de ser emoji

Con esto el set SVG queda completo: 30 iconos en tres familias, cada una con su
grosor. Los glifos van a 3.5 sobre viewBox 48 porque se pintan a 16 px, el
tamaño más pequeño del set, y ahí el detalle interior colapsa.

check y cruz llevan el contorno en currentColor a propósito: el mismo icono
sirve para el acierto en verde y el fallo en rojo, y el color lo pone el
contenedor."
```

---

### Task 4: Retirar los seis iconos de la fase 1

**Files:**
- Delete: `public/images/Doty/icons/` (6 PNG)
- Modify: `components/ui/doty/poses.ts`
- Modify: `scripts/mj/batches/fase-1.json`

**Interfaces:**
- Consumes: nada.
- Produces: nada. Es limpieza.

- [ ] **Step 1: Confirmar que de verdad no los usa nadie**

```bash
grep -rn 'pose="correcto"\|pose="incorrecto"\|pose="atencion"\|pose="cargando"\|pose="racha"\|pose="nivel-completado"' components app
grep -rn 'toDotyPose(' components app | head
```
Esperado: cero coincidencias de las poses. Si `toDotyPose` recibe un string dinámico que pudiera valer uno de esos seis, **para y repórtalo** — el borrado los mandaría al placeholder.

- [ ] **Step 2: Borrar las seis piezas del catálogo**

En `scripts/mj/batches/fase-1.json`, **elimina** las seis entradas del grupo `icons`. No las marques `done: false`: eso las dejaría en el registro apuntando al placeholder y `--emit-lote --pendientes` volvería a pedirlas. Tampoco inventes un campo `retirada`, que ningún código lee.

Borrarlas es lo correcto porque la pieza deja de existir, no queda pendiente. El historial de git conserva lo que hubo.

Tras el borrado el grupo `icons` se queda sin piezas, y eso **ya está comprobado**: `validate_catalog` no se queja de un grupo vacío, porque la regla del ancla solo recorre los grupos que tienen piezas. Confírmalo igualmente:

```bash
uv run --python 3.12 --with pillow python -c "import sys; sys.path.insert(0,'scripts/mj'); import mjlib; c=mjlib.load_catalog('scripts/mj/batches/fase-1.json'); print(len(c['pieces']), 'piezas')"
```
Esperado: `92 piezas` y ningún error.

- [ ] **Step 3: Borrar los PNG y regenerar el registro**

```bash
rm -rf public/images/Doty/icons
uv run --python 3.12 --with pillow scripts/mj/process.py --emit-registry fase-1
```

- [ ] **Step 4: Comprobar que el lint pasa**

```bash
npm run lint
```
`check-doty-assets --strict` prohíbe huérfanos en `public/images/Doty/` y entradas del registro que no existan en disco. Si el registro sigue nombrando los seis, falla — y ese fallo es la señal de que el `--emit-registry` no corrió.

Esperado: `check-doty-assets: 76 poses OK (strict)` (82 menos 6).

- [ ] **Step 5: Commit**

```bash
git add -A public/images/Doty components/ui/doty/poses.ts scripts/mj/batches/fase-1.json
git commit -m "chore(doty): retirar los seis iconos de la fase 1 que nadie cableó

correcto, incorrecto, atencion, cargando, racha y nivel-completado se generaron
en la fase 1, se registraron en poses.ts como si fueran poses de Doty —que
conceptualmente no lo son— y ninguna pantalla llegó a renderizarlos. Ninguno
usa la paleta: son verde, naranja y dorado. Cambiar un emoji ajeno por un PNG
ajeno no arregla nada.

Cuatro los cubre ahora el set SVG y dos los cubrirá el grupo ui de la fase 3."
```

---

### Task 5: El pipeline admite el grupo `ui`

**Files:**
- Modify: `scripts/mj/mjlib.py:14` (`EXTRA_GROUPS`) y `:143` (`_relative_output`)
- Test: `scripts/mj/tests/test_mjlib.py`

**Interfaces:**
- Produces: piezas con `group: "ui"` aterrizan en `public/images/ui/<slug>.png`.

- [ ] **Step 1: Escribir el test que falla**

En `scripts/mj/tests/test_mjlib.py`:

```python
def test_grupo_ui_aterriza_en_public_images_ui():
    # El grupo ui son los iconos de economía (racha, gemas, vidas...). No van a
    # public/images/Doty/ porque no los consume <Doty>: un icono no es una pose,
    # y check-doty-assets --strict rechaza huérfanos en esa carpeta.
    p = piece(slug="racha", group="ui", mascot=False, size=512)
    assert mjlib._relative_output(p, "fase-3") == "public/images/ui/racha.png"


def test_output_path_cubre_el_grupo_ui(tmp_path):
    p = piece(slug="gemas", group="ui", mascot=False, size=512)
    destino = mjlib.output_path(p, "fase-3", tmp_path, tmp_path / "raw")
    assert destino == tmp_path / "public/images/ui/gemas.png"
```

- [ ] **Step 2: Correr y comprobar que falla**

```bash
uv run --python 3.12 --with pytest --with pillow python -m pytest scripts/mj/tests/test_mjlib.py -k ui -q
```
Esperado: FALLA. `validate_catalog` rechaza el grupo, o `_relative_output` cae al `return` final y devuelve la ruta del app-icon.

- [ ] **Step 3: Implementar**

En `mjlib.py` línea 14:
```python
EXTRA_GROUPS = ("games", "characters", "app-icon", "levels", "ui")
```

En `_relative_output`, después de la rama de `levels`:
```python
    if g == "ui":
        return f"public/images/ui/{s}.png"
```

- [ ] **Step 4: Correr y comprobar que pasa**

```bash
uv run --python 3.12 --with pytest --with pillow python -m pytest scripts/mj/tests -q
```
Esperado: todos en verde, dos tests más que antes.

- [ ] **Step 5: Comprobar que el test tiene dientes**

Quita la rama `if g == "ui"` que acabas de añadir y corre otra vez. Esperado: fallan **exactamente** los dos tests nuevos, ninguno más. Vuelve a ponerla.

- [ ] **Step 6: Commit**

```bash
git add scripts/mj/mjlib.py scripts/mj/tests/test_mjlib.py
git commit -m "feat(mj): el pipeline admite el grupo ui

Los doce iconos de economía van a public/images/ui/, fuera de
public/images/Doty/: no los consume <Doty> y check-doty-assets --strict
rechazaría huérfanos ahí. Misma forma que la rama que la fase 2 añadió para
levels."
```

---

### Task 6: El catálogo `fase-3.json`

**Files:**
- Create: `scripts/mj/batches/fase-3.json`
- Create: `scripts/mj/tests/test_catalogo_fase3.py`

**Interfaces:**
- Consumes: el grupo `ui` de la tarea 5.
- Produces: doce piezas listas para `--emit-lote ui`.

- [ ] **Step 1: Escribir el catálogo**

Mismo esquema que `fase-2.json`. Doce piezas, grupo `ui`, `size` 512, `mascot: false` en las doce, y **una con `anchor: true`**.

El ancla es `gemas`: es la forma más simple y la más cerca del lenguaje de icono plano, así que fija bien el grosor de línea y el nivel de abstracción para las once restantes.

| Slug | Sustituye | `prefix` | `prompt` |
|---|---|---|---|
| `gemas` ⚓ | 💎 | `Ui icon gem` | `a single faceted gem seen from the front, wide flat top facet and three facets below, cyan body with a lighter cyan highlight facet` |
| `racha` | 🔥 | `Ui icon flame` | `a single bold flame with two inner tongues, pink outer flame and cyan inner tongue` |
| `vidas` | ❤️ | `Ui icon heart` | `a plump rounded heart, pink body with a small white highlight in the upper left` |
| `xp` | ⭐ | `Ui icon star` | `a single five-pointed star with thick rounded points, blue body with a lighter blue inner star` |
| `corona` | 👑 | `Ui icon crown` | `a three-peaked crown with a wide band, pink body with three cyan round jewels on the band` |
| `trofeo` | 🏆 | `Ui icon trophy` | `a two-handled cup on a square base, cyan cup and pink base` |
| `medalla` | 🏅 | `Ui icon medal` | `a round medal hanging from a short ribbon, blue disc and pink ribbon` |
| `regalo` | 🎁 | `Ui icon gift box` | `a square gift box with a ribbon cross and a bow on top, pink box and cyan ribbon` |
| `podio-oro` | 🥇 | `Ui icon first place medal` | `a round medal with the numeral one shape suggested by a single vertical bar, cyan disc and pink ribbon` |
| `podio-plata` | 🥈 | `Ui icon second place medal` | `a round medal with two short horizontal bars inside, blue disc and pink ribbon` |
| `podio-bronce` | 🥉 | `Ui icon third place medal` | `a round medal with three short horizontal bars inside, pink disc and cyan ribbon` |
| `rayo` | ⚡ | `Ui icon lightning bolt` | `a single thick zigzag lightning bolt, cyan body with a pink edge` |

Los tres del podio se distinguen por el **número de barras dentro del disco**, no por el color del metal: oro, plata y bronce no están en la paleta, y el navy queda prohibido. Una, dos y tres barras se leen a 24 px; un tono de dorado contra otro de dorado, no.

- [ ] **Step 2: Escribir el test del catálogo**

`scripts/mj/tests/test_catalogo_fase3.py`:

```python
import json
import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))
import mjlib

CATALOGO = pathlib.Path(__file__).resolve().parents[1] / "batches" / "fase-3.json"


def _cat():
    return mjlib.load_catalog(str(CATALOGO))


def test_son_doce_piezas_todas_del_grupo_ui():
    piezas = _cat()["pieces"]
    assert len(piezas) == 12
    assert {p["group"] for p in piezas} == {"ui"}


def test_ninguna_es_mascota():
    # Son objetos, no Doty. Si alguna llevara mascot: true recibiría el
    # brand_lock del personaje y saldría un Doty con forma de gema.
    assert all(p["mascot"] is False for p in _cat()["pieces"])


def test_exactamente_un_ancla_y_es_gemas():
    # validate_catalog ya exige exactamente un ancla por grupo no-mascota. Esto
    # fija CUÁL, porque de ella cuelga el estilo de las once restantes: si el
    # ancla cambia, hay que regenerarlas todas.
    anclas = [p["slug"] for p in _cat()["pieces"] if p.get("anchor")]
    assert anclas == ["gemas"]


def test_los_tres_del_podio_se_distinguen_por_barras_no_por_metal():
    # Oro, plata y bronce no están en la paleta y el navy está prohibido como
    # masa, así que el rango se codifica en el número de barras del disco.
    piezas = {p["slug"]: p["prompt"] for p in _cat()["pieces"]}
    assert "single vertical bar" in piezas["podio-oro"]
    assert "two short horizontal bars" in piezas["podio-plata"]
    assert "three short horizontal bars" in piezas["podio-bronce"]
    for s in ("podio-oro", "podio-plata", "podio-bronce"):
        assert "gold" not in piezas[s] and "silver" not in piezas[s] and "bronze" not in piezas[s]


def test_ningun_prompt_pide_navy_de_relleno():
    for p in _cat()["pieces"]:
        mjlib.dark_fill_mentions(p["prompt"])  # lanza si lo pide
```

- [ ] **Step 3: Correr los tests**

```bash
uv run --python 3.12 --with pytest --with pillow python -m pytest scripts/mj/tests -q
```
Esperado: todos en verde.

- [ ] **Step 4: Emitir el lote y revisarlo**

```bash
uv run --python 3.12 --with pillow scripts/mj/process.py --emit-lote ui --pendientes --raw ../imagenes/mj --fase fase-3
```
Esperado: `12 piezas (0 mascota, 12 icono)`, con `gemas` de primera marcada como ancla.

- [ ] **Step 5: Commit**

```bash
git add scripts/mj/batches/fase-3.json scripts/mj/tests/test_catalogo_fase3.py
git commit -m "feat(mj): catálogo de la fase 3 — doce iconos de economía

Son los emoji cuyo color es parte del significado: una gema es cyan, una racha
es fuego. Por eso van en PNG y no en el set SVG, que se tiñe con el contexto.

Los tres del podio se distinguen por el número de barras del disco y no por el
metal: oro, plata y bronce no están en la paleta, y a 24 px un dorado contra
otro dorado es el mismo icono tres veces."
```

---

### Task 7: Generación en Midjourney (trabajo humano — compuerta)

**Files:**
- Produce: 12 PNG en `$RAW/fase-3/`

**Interfaces:**
- Consumes: `scripts/mj/batches/fase-3.json`.
- Produces: las descargas que la tarea 8 procesa.

- [ ] **Step 1: Generar el ancla primero**

`gemas` va marcada `⚓ ANCLA` y es la número 1 del lote. Se genera **sin nada adjunto**: ni `ref-patron.png` en *Attach to prompt*, ni nada en *Style reference*.

Adjuntar `ref-patron.png` a una pieza de icono es el error de la fase 2: esa fila es el Edit Model, así que Midjourney parte de un Doty y lo edita, heredando su reparto de color — de ahí salieron los navy de relleno.

- [ ] **Step 2: Las once restantes**

La mejor candidata de `gemas` se arrastra al slot **Style reference** y se queda ahí para las once. *Attach to prompt* vacío en todas.

- [ ] **Step 3: Criterios para elegir candidata**

Además de los del lote:
1. **Se lee a 24 px.** Es el tamaño de la cabecera, más pequeño que los tiles de nivel. El detalle fino desaparece.
2. **Nada de texto ni numerales.** Midjourney los escribe mal, y los tres del podio ya codifican el rango en barras.
3. **Nada flotando despegado** de la figura: `rembg` lo borra. Es lo que se comió las flechas de `condicionales` en la fase 2.
4. **Ningún color fuera de la paleta.** El marrón del cartel de `condicionales` entró por no declarar el color; aquí los doce prompts lo declaran.

- [ ] **Step 4: Confirmar que están las doce**

```bash
uv run --python 3.12 --with pillow scripts/mj/process.py --dry-run fase-3 --raw ../imagenes/mj
```
Esperado: 12 líneas `OK`, cero `FALTA`, cero `AMBIGUO`.

---

### Task 8: Procesado y verificación a 24 px

**Files:**
- Create: `public/images/ui/*.png` (12)
- Modify: `scripts/mj/batches/fase-3.json` (el pipeline marca `done` y `source_file`)

**Interfaces:**
- Consumes: las descargas de la tarea 7.
- Produces: los doce PNG que la tarea 9 cablea.

- [ ] **Step 1: Procesar**

```bash
uv run --python 3.12 --with pillow --with rembg --with onnxruntime \
  scripts/mj/process.py --apply fase-3 --raw ../imagenes/mj
```
Esperado: `Ambiguas (0)`, `Faltan (0)`, `Falló el procesado (0)`, `Alerta de halo (0)`.

- [ ] **Step 2: Hoja de contacto a 24 px sobre los dos fondos**

```bash
uv run --python 3.12 --with pillow python - <<'PY'
from PIL import Image, ImageDraw
import glob, os
T = 24                      # el tamaño real en la cabecera
fs = sorted(glob.glob('public/images/ui/*.png'))
h = Image.new("RGB", (len(fs)*(T+10)+10, T*2+26), (105,105,105))
d = ImageDraw.Draw(h)
for i, f in enumerate(fs):
    cut = Image.open(f).convert("RGBA").resize((T,T), Image.LANCZOS)
    for j, bg in enumerate(((0xff,0xff,0xff), (0x20,0x1a,0x4d))):
        t = Image.new("RGBA", (T,T), bg+(255,)); t.alpha_composite(cut)
        h.paste(t.convert("RGB"), (10+i*(T+10), 10+j*T))
    d.text((10+i*(T+10), 2*T+12), os.path.basename(f)[:-4][:8], fill=(255,255,255))
h = h.resize((h.width*4, h.height*4), Image.LANCZOS)
h.save('/tmp/contacto-ui.png')
print('→ /tmp/contacto-ui.png')
PY
```

Criterios de rechazo, los mismos que cerraron la fase 2:
1. Ninguna pieza pierde un elemento sobre el fondo oscuro.
2. Los tres del podio se distinguen entre sí a 24 px.
3. Ninguna usa un color fuera de la paleta.

Cualquiera que falle vuelve al catálogo con `regen: true` — **nunca `done: false`**, que haría caer el registro al placeholder mientras dure.

- [ ] **Step 3: Commit**

```bash
git add public/images/ui scripts/mj/batches/fase-3.json
git commit -m "feat(mj): las doce piezas de la fase 3 procesadas

Verificadas a 24 px, el tamaño real en la cabecera, sobre los fondos de los dos
temas. Medir a tamaño completo miente: lo que decide es si el icono sobrevive
la reducción."
```

---

### Task 9: `<UiIcon>` y el cableado de la economía

**Files:**
- Create: `components/ui/ui-icon/ui-icon.tsx`
- Create: `components/ui/ui-icon/index.ts`
- Modify: `components/shell/app-header.tsx:46` y `:61`, `components/lesson/lesson-top-bar.tsx`, `components/interactive-column/top-students.tsx`, `components/lesson/reward-panel.tsx`, `components/ui/xp-reward.tsx`, `components/ui/xp-level.tsx`, `components/quests/tournament-card.tsx`, `components/interactive-column/badges.tsx`, `components/interactive-column/daily-quest.tsx`, `components/games/shared/game-intro.tsx`, `components/games/shared/game-result.tsx`, `components/lesson/vocab/vocab-pack.tsx`, `components/path/path-difficulty.tsx`

**Interfaces:**
- Consumes: los doce PNG de `public/images/ui/`.
- Produces: `<UiIcon name={UiIconName} size={number} />`.

- [ ] **Step 1: Crear el componente**

```tsx
import NextImage from "next/image";

const NOMBRES = [
  "gemas", "racha", "vidas", "xp", "corona", "trofeo",
  "medalla", "regalo", "podio-oro", "podio-plata", "podio-bronce", "rayo",
] as const;

export type UiIconName = (typeof NOMBRES)[number];

interface Props {
  name: UiIconName;
  /** Lado en px. 24 en la cabecera, 40 en los paneles de premio. */
  size?: number;
  /** Vida perdida, logro sin desbloquear: el mismo objeto, apagado. */
  apagado?: boolean;
  className?: string;
}

/**
 * Los iconos cuyo color es identidad y no estado: una gema es cyan, una racha
 * es fuego. Por eso son PNG y no entran en el set SVG, que se tiñe con el
 * contexto.
 *
 * No pasan por <Doty> ni por poses.ts: un icono no es una pose. Ese fue el
 * error de los seis de la fase 1, que acabaron en el registro de poses y no
 * los renderizó nadie.
 */
export default function UiIcon({ name, size = 24, apagado = false, className }: Props) {
  return (
    <NextImage
      src={`/images/ui/${name}.png`}
      alt=""
      width={size}
      height={size}
      aria-hidden
      className={className}
      style={apagado ? { filter: "grayscale(1)", opacity: 0.4 } : undefined}
    />
  );
}
```

- [ ] **Step 2: Crear `components/ui/ui-icon/index.ts`**

```ts
export { default as UiIcon } from "./ui-icon";
export type { UiIconName } from "./ui-icon";
```

- [ ] **Step 3: Cablear la cabecera primero**

`app-header.tsx` línea 46 (`🔥`) y línea 61 (`💎`) pasan a `<UiIcon name="racha" size={16} />` y `<UiIcon name="gemas" size={16} />`. El `<span className="text-base leading-none">` que los envuelve desaparece: existía para dimensionar un emoji.

- [ ] **Step 4: Cablear las vidas, con el estado apagado**

En `lesson-top-bar.tsx`, ❤️ es la vida que queda y 🤍 la perdida. Las dos pasan al mismo icono:

```tsx
<UiIcon name="vidas" size={20} apagado={i >= vidasRestantes} />
```

Ese es el motivo de que 🤍 no sea una pieza aparte: es el mismo objeto en otro estado, y dos dibujos serían dos cosas que mantener sincronizadas.

- [ ] **Step 5: Cablear los diez archivos restantes**

Cada emoji de la tabla de la tarea 6 pasa a su `<UiIcon>`. Tamaño: 16 px en línea de texto, 24 px en tarjetas, 40 px en paneles de premio.

- [ ] **Step 6: Comprobar que no queda ninguno de los doce**

```bash
grep -rnP '[\x{1F380}-\x{1F3C6}\x{1F48E}\x{1F525}\x{2764}\x{26A1}\x{2B50}]' components app --include="*.tsx" | grep -v /admin
```
Esperado: solo los que la spec deja fuera (🌟 y ✨ decorativos, y los de pantallas de juego).

- [ ] **Step 7: Lint, build, captura**

```bash
npm run lint && npx next build
```
En el preview, captura la cabecera y un panel de premio en los dos temas.

- [ ] **Step 8: Commit**

```bash
git add components/ui/ui-icon components app
git commit -m "feat(iconos): la economía deja de ser emoji

Racha, gemas, vidas, XP, corona, trofeo, medalla, regalo, podio y rayo pasan a
las doce piezas generadas. La vida perdida no es una pieza aparte: es el mismo
corazón con grayscale y opacidad, porque dos dibujos para una diferencia de
estado son dos cosas que mantener sincronizadas.

Los spans con text-base que los envolvían desaparecen: existían para
dimensionar un emoji."
```

---

### Task 10: Documentación

**Files:**
- Modify: `docs/brand/doty-identity.md`
- Modify: `CLAUDE.md`

**Interfaces:**
- Consumes: todo lo anterior.

- [ ] **Step 1: Añadir la sección de iconografía a `docs/brand/doty-identity.md`**

Documenta, con los valores exactos: la paleta cerrada de rellenos, el navy como línea y nunca como masa, el `viewBox` 48, los tres grosores por familia, y **la medición que niega la regla obvia** — el contorno de los tiles es el 1.8% del sujeto, que a 24 px son 0.45 px, así que el grosor no se copia de la fase 2 sino que se elige por tamaño de uso.

Sin esa última frase, el siguiente que dibuje un icono intentará igualar el trazo de los tiles y hará iconos invisibles.

- [ ] **Step 2: Añadir la regla 11 al `CLAUDE.md`**

Después de la regla 10 (la de Doty):

```markdown
11. **Iconos.** Ningún emoji como iconografía en código de producto. Los iconos
    de sistema se pintan con `<Icon name=…>` (SVG, `components/ui/icon/paths.ts`)
    y los de economía con `<UiIcon name=…>` (PNG, `public/images/ui/`). Un emoji
    lo dibuja el sistema operativo: sale distinto en Safari de iPhone que en
    escritorio, y no se puede teñir. `npm run lint` lo comprueba
    (`check-icons.mjs`): paleta cerrada, navy nunca de relleno, rellenos planos
    y grosor constante dentro de cada familia. El grosor NO se copia de los
    tiles — el suyo es el 1.8% del sujeto, que a 24 px es invisible: nav 3,
    nodo 2.5, glifo 3.5 sobre `viewBox` 48. Los emoji dentro de frases de copy
    se quedan: ahí son puntuación, no iconos.
```

- [ ] **Step 3: Borrar la página de desarrollo**

```bash
rm -rf app/dev-iconos
```
La generaba `contact-sheet-icons.mjs` para verificar; no debe llegar a producción.

- [ ] **Step 4: Lint, build, commit**

```bash
npm run lint && npx next build
git add docs/brand/doty-identity.md CLAUDE.md
git rm -r --cached app/dev-iconos 2>/dev/null || true
git commit -m "docs(iconos): la regla de dibujo queda escrita donde se busca

La medición que más importa es la que niega lo intuitivo: el contorno de los
tiles de la fase 2 es el 1.8% del sujeto, que a 24 px son 0.45 px. Quien intente
igualar ese trazo hará iconos invisibles. El grosor se elige por tamaño de uso."
```

---

## Notas sobre este plan

**Por qué no van los 30 `path` escritos aquí.** Un icono se dibuja mirándolo: el `d` de un SVG es el resultado de un bucle visual, no algo que se pueda redactar a ciegas. Escribir treinta cadenas inventadas produciría treinta dibujos malos que el implementador tiraría igual, y además daría la falsa impresión de que el trabajo está decidido. Lo que sí va completo y es lo que de verdad gobierna el resultado: el componente, el verificador que falla el lint, tres iconos dibujados enteros como patrón, el encargo exacto de cada uno de los treinta, y un paso de verificación visual con criterios de rechazo explícitos en cada familia.

**El orden es deliberado.** Las tareas 1 a 5 no necesitan a Sergio; la compuerta humana (tarea 7) llega lo más tarde posible, cuando ya hay valor entregado en el repo. Si la generación se demora, el nav, el Camino y los glifos ya están hechos.
