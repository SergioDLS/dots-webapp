# PWA Manifest Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que dots se pueda instalar como app —icono propio, sin barra del navegador, bloqueada en vertical— sin service worker, sin offline y sin push.

**Architecture:** Tres piezas independientes. Los iconos se generan una vez con ImageMagick recortando la burbuja del logo existente y se commitean como binarios. `app/manifest.ts` los declara usando el tipo `MetadataRoute.Manifest` de Next 16, que se sirve solo en `/manifest.webmanifest` y se auto-enlaza. `app/layout.tsx` añade lo que el manifest no cubre: el `theme-color` de la barra de estado y los metadatos de iOS, que ignora el manifest.

**Tech Stack:** Next 16 (app router), TypeScript, ImageMagick 7 (`magick`, ya instalado en el equipo).

## Global Constraints

- **No hay test runner de componentes en este repo.** La verificación es
  `npm run lint` + `npx next build` + comprobaciones medidas (`magick
  identify`, inspección del HTML/JSON servido). **No inventes un framework de
  tests ni instales dependencias.** Los pasos de "verificar" de este plan son
  comandos reales con su salida real, medida al escribir el plan.
- `source ~/.nvm/nvm.sh` **siempre** antes de cualquier `node`/`npm`.
- **Nunca levantes el dev server con Bash.** Usa la herramienta de preview
  (`preview_start` con el nombre `dots-webapp` de `.claude/launch.json`).
- Navegación con `router.push`, jamás `window.location.*` (regla 1 del
  CLAUDE.md). Este plan no navega, pero la regla aplica igual.
- Colores exactos, copiados de `app/globals.css`: `--background` claro
  `#fff7fb`, `--background` oscuro `#14122e`, `--accent` `#e5077e`.
- Recorte exacto de la burbuja en `DOTS_LOGO.png` (1080×1080):
  **`399x406+359+157`**.
- El texto de cara al usuario va en **español**.

---

### Task 1: Generar los cinco iconos

**Files:**
- Create: `public/icons/icon-192.png`
- Create: `public/icons/icon-512.png`
- Create: `public/icons/icon-maskable-192.png`
- Create: `public/icons/icon-maskable-512.png`
- Create: `app/apple-icon.png`
- Read-only: `public/images/logos/DOTS_LOGO.png` (no se modifica)

**Interfaces:**
- Consumes: nada.
- Produces: las cinco rutas de arriba. La Task 2 referencia **literalmente**
  las cuatro de `public/icons/` con estas rutas absolutas de web:
  `/icons/icon-192.png`, `/icons/icon-512.png`,
  `/icons/icon-maskable-192.png`, `/icons/icon-maskable-512.png`.

**El de Apple va en `app/`, no en `public/`, y no es un capricho:**
`app/apple-icon.png` es una convención de fichero de Next, que al detectarla
emite sola la etiqueta `<link rel="apple-touch-icon">` con su `sizes`. Puesto
en `public/apple-touch-icon.png` el archivo se serviría igual y Safari lo
encontraría por la ruta conocida, pero **no habría etiqueta** — y la Task 3
comprueba precisamente que esa etiqueta existe.

Contexto de por qué cada archivo existe (no lo deduzcas, está medido):
`DOTS_LOGO.png` es el lockup completo —burbuja rosa + "dots®" + la bajada
"Language Online Learning" en blanco—, pensado para fondos oscuros. Como icono
no sirve: a 48 px la bajada es un borrón y el texto blanco desaparece sobre
fondo claro. El icono es **solo la burbuja**.

- [ ] **Step 1: Comprobar que el recorte de partida es el correcto**

```bash
cd /home/endurance/Projects/Endurance/dots/dots-webapp
magick public/images/logos/DOTS_LOGO.png -crop 1080x580+0+0 +repage -trim info:
```

Expected: la línea contiene `399x406 1080x580+359+157`. Si no coincide, PARA:
el logo ha cambiado desde que se escribió el spec y el recorte hay que
recalcularlo antes de seguir.

- [ ] **Step 2: Crear el directorio y generar los dos iconos `any`**

Encuadre al 80 %: se extiende el recorte a un cuadrado centrado de lado
`406 / 0.8 = 508` y se reescala. Fondo transparente.

```bash
cd /home/endurance/Projects/Endurance/dots/dots-webapp
mkdir -p public/icons
magick public/images/logos/DOTS_LOGO.png -crop 399x406+359+157 +repage \
  -background none -gravity center -extent 508x508 -resize 512x512 \
  public/icons/icon-512.png
magick public/images/logos/DOTS_LOGO.png -crop 399x406+359+157 +repage \
  -background none -gravity center -extent 508x508 -resize 192x192 \
  public/icons/icon-192.png
```

- [ ] **Step 3: Generar los dos iconos `maskable`**

Encuadre al 60 %: lado `406 / 0.6 = 677`. Fondo **sólido** `#fff7fb`, porque
Android recorta el icono con la forma del sistema y las esquinas tienen que
tener color, no transparencia.

```bash
cd /home/endurance/Projects/Endurance/dots/dots-webapp
magick public/images/logos/DOTS_LOGO.png -crop 399x406+359+157 +repage \
  -background "#fff7fb" -gravity center -extent 677x677 -resize 512x512 \
  public/icons/icon-maskable-512.png
magick public/images/logos/DOTS_LOGO.png -crop 399x406+359+157 +repage \
  -background "#fff7fb" -gravity center -extent 677x677 -resize 192x192 \
  public/icons/icon-maskable-192.png
```

- [ ] **Step 4: Generar el icono de Apple, sin canal alfa**

iOS ignora los iconos del manifest y pide este archivo. Y **no puede llevar
transparencia**: iOS la compone contra negro y saldría un cuadrado negro.
`-alpha remove -alpha off` es lo que quita el canal.

```bash
cd /home/endurance/Projects/Endurance/dots/dots-webapp
magick public/images/logos/DOTS_LOGO.png -crop 399x406+359+157 +repage \
  -background "#fff7fb" -gravity center -extent 508x508 \
  -alpha remove -alpha off -resize 180x180 \
  app/apple-icon.png
```

- [ ] **Step 5: Verificar tamaños y canal alfa de los cinco**

```bash
cd /home/endurance/Projects/Endurance/dots/dots-webapp
for f in public/icons/icon-512.png public/icons/icon-192.png \
         public/icons/icon-maskable-512.png public/icons/icon-maskable-192.png \
         app/apple-icon.png; do
  magick identify -format "%f  %wx%h  alpha:%A\n" "$f"
done
```

Expected, exactamente:

```
icon-512.png  512x512  alpha:Blend
icon-192.png  192x192  alpha:Blend
icon-maskable-512.png  512x512  alpha:Blend
icon-maskable-192.png  192x192  alpha:Blend
apple-icon.png  180x180  alpha:Undefined
```

`alpha:Undefined` en el de Apple es el dato que importa: significa que no tiene
canal alfa. Si sale `Blend`, el `-alpha off` no se aplicó y hay que repetir el
Step 4.

- [ ] **Step 6: Verificar los píxeles de esquina**

Los tamaños no bastan: hay que comprobar que el fondo es el que toca.

```bash
cd /home/endurance/Projects/Endurance/dots/dots-webapp
magick identify -format "maskable: %[pixel:p{3,3}]\n" public/icons/icon-maskable-512.png
magick identify -format "any:      %[pixel:p{3,3}]\n" public/icons/icon-512.png
magick identify -format "apple:    %[pixel:p{3,3}]\n" app/apple-icon.png
```

Expected, exactamente:

```
maskable: srgba(255,247,251,1)
any:      srgba(0,0,0,0)
apple:    srgb(255,247,251)
```

El maskable **opaco** y el `any` **transparente**. Si el maskable sale
`srgba(...,0)`, Android le recortará las esquinas a la nada.

- [ ] **Step 7: Verificar la zona segura del maskable**

El encuadre al 60 % debería garantizarlo por construcción, pero es el punto 6
de la verificación del spec y se mide en un comando. La burbuja tiene que
caber en el **80 % central** del lienzo:

```bash
cd /home/endurance/Projects/Endurance/dots/dots-webapp
magick public/icons/icon-maskable-512.png -bordercolor "#fff7fb" -border 1 \
  -fuzz 2% -trim info:
```

Expected: `302x308 514x514+106+103` (el lienzo sale 514 porque el `-border 1`
añade un píxel por lado; réstalo mentalmente).

Lo que hay que comprobar es que el contenido cabe en el **cuadrado central de
410 px**, que es el 80 % de 512. La zona segura va de 51 a 461. La burbuja va
de 105 a 407 en horizontal y de 102 a 410 en vertical. Entra con ~50 px de
margen por lado. Si el ancho pasara de 410, el encuadre está mal y hay que
repetir el Step 3.

- [ ] **Step 8: Commit**

```bash
cd /home/endurance/Projects/Endurance/dots/dots-webapp
git add public/icons app/apple-icon.png
git commit -m "feat(pwa): iconos de instalación recortados del logo

El logo es el lockup completo (burbuja + dots® + la bajada), que a 48 px es
un borrón. El icono es solo la burbuja, que ocupa 399x406 en +359+157.

Tres familias porque tres consumidores distintos las exigen: 'any'
transparente al 80 %, 'maskable' al 60 % sobre #fff7fb porque Android recorta
al 80 % central, y apple-touch-icon SIN canal alfa porque iOS ignora los
iconos del manifest y compone la transparencia contra negro."
```

---

### Task 2: `app/manifest.ts`

**Files:**
- Create: `app/manifest.ts`

**Interfaces:**
- Consumes: las cuatro rutas de icono de la Task 1 (`/icons/icon-192.png`,
  `/icons/icon-512.png`, `/icons/icon-maskable-192.png`,
  `/icons/icon-maskable-512.png`).
- Produces: la ruta servida `/manifest.webmanifest`. La Task 3 comprueba que
  Next inyecta su `<link rel="manifest">`; no lo escribe a mano.

- [ ] **Step 1: Escribir el archivo**

Fichero completo, tal cual:

```ts
import type { MetadataRoute } from "next";

/**
 * Manifest de la PWA. Next lo sirve en `/manifest.webmanifest` y le inyecta
 * su `<link rel="manifest">` solo por existir este archivo — no hay que
 * enlazarlo a mano en el layout.
 *
 * Sin service worker a propósito: esta tanda hace la app INSTALABLE, no
 * offline. El push sigue delegado a la futura app React Native (ver
 * docs/superpowers/specs/2026-08-16-pwa-manifest-design.md).
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "dots — Aprende inglés jugando",
    short_name: "dots",
    description:
      "Aprende inglés de verdad con Doty: lecciones cortas, rachas y juegos que enganchan.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    // Los 12 juegos están compuestos en columna (HUD arriba, controles abajo)
    // y ninguno aprovecha el horizontal. OJO: esto solo ata a la app YA
    // INSTALADA; en el navegador se sigue pudiendo girar.
    orientation: "portrait",
    // El fondo, no el rosa de marca: el theme_color tiñe la barra de estado y
    // un acento ahí se lee como una cabecera que la app no tiene.
    background_color: "#fff7fb",
    theme_color: "#fff7fb",
    lang: "es",
    dir: "ltr",
    categories: ["education"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
```

- [ ] **Step 2: Type-check y lint**

```bash
cd /home/endurance/Projects/Endurance/dots/dots-webapp
source ~/.nvm/nvm.sh && npx tsc --noEmit && npm run lint
```

Expected: ambos sin salida de error. Si `tsc` se queja de `dir` o de
`orientation`, has escrito mal el valor: el tipo admite
`'ltr' | 'rtl' | 'auto'` y `'portrait'` entre otros.

- [ ] **Step 3: Arrancar el preview y leer el manifest servido**

Arranca el dev server con la herramienta de preview (`preview_start`, nombre
`dots-webapp`) y navega a `http://localhost:3000/manifest.webmanifest`, luego
extrae el texto de la página.

Expected: JSON con `"id": "/"`, `"name": "dots — Aprende inglés jugando"`,
`"short_name": "dots"`, `"start_url": "/"`, `"scope": "/"`,
`"display": "standalone"`, `"orientation": "portrait"`,
`"background_color": "#fff7fb"`, `"theme_color": "#fff7fb"`, `"lang": "es"`,
`"dir": "ltr"`, `"categories": ["education"]` y **exactamente cuatro** objetos
en `icons`, dos con `"purpose": "any"` y dos con `"purpose": "maskable"`.

- [ ] **Step 4: Comprobar que las cuatro rutas de icono responden**

Un manifest que apunta a un icono inexistente es **peor** que no tener
manifest: Chrome marca la app como no instalable y no dice por qué. Navega a
cada una de las cuatro URLs y comprueba que carga la imagen:

```
http://localhost:3000/icons/icon-192.png
http://localhost:3000/icons/icon-512.png
http://localhost:3000/icons/icon-maskable-192.png
http://localhost:3000/icons/icon-maskable-512.png
```

Expected: las cuatro responden 200 con una imagen. Ninguna 404.

- [ ] **Step 5: Commit**

```bash
cd /home/endurance/Projects/Endurance/dots/dots-webapp
git add app/manifest.ts
git commit -m "feat(pwa): manifest tipado, la app pasa a ser instalable

app/manifest.ts con MetadataRoute.Manifest, que es lo idiomático en Next 16:
se sirve en /manifest.webmanifest y se auto-enlaza, sin JSON suelto en public.

orientation: portrait porque los 12 juegos están compuestos en columna.
theme_color es el fondo (#fff7fb) y no el rosa de marca: tiñe la barra de
estado y un acento ahí se lee como una cabecera que no existe."
```

---

### Task 3: Cableado en el layout — barra de estado e iOS

**Files:**
- Modify: `app/layout.tsx`

**Interfaces:**
- Consumes: `app/apple-icon.png` (Task 1) y `app/manifest.ts` (Task 2). Las dos
  son convenciones de fichero: Next inyecta solo el `<link rel="manifest">` y
  el `<link rel="apple-touch-icon">` por el mero hecho de que esos archivos
  existan. **Esta tarea no escribe ninguna de las dos etiquetas a mano.**
- Produces: nada que consuman tareas posteriores.

**Contexto que NO debes deducir del código, porque es sutil:**

El tema de esta app **no lo decide el sistema operativo**. Lo decide
`localStorage["dots-theme"]`, que un script inline en el `<head>` lee antes del
primer pintado y vuelca en `data-theme`. El bloque
`@media (prefers-color-scheme: dark)` de `globals.css` está acotado a
`:root:not([data-theme])`, o sea que **solo actúa cuando ese script no ha
corrido** (JS desactivado).

Consecuencia: un `theme-color` basado solo en media queries se equivocaría con
cualquiera que tenga el SO en oscuro y la app en claro, o al revés. Por eso hay
dos capas: las media queries como respaldo sin JS, y una línea añadida al
script que ya existe para que fije el color real. No quites ninguna de las dos.

> **Anotado post-ejecución (2026-08-16):** el diagnóstico de arriba (por qué
> media-queries-a-secas fallarían) sigue siendo correcto, pero la solución de
> "dos capas" que propone esta última frase —y que los Steps 1 y 3 de abajo
> implementan tal cual— se construyó y se **descartó** dentro de esta misma
> Task 3, en dos rondas de corrección posteriores a la primera ejecución. Ver
> las anotaciones en el Step 1 y en el Step 3, y
> `docs/superpowers/specs/2026-08-16-pwa-manifest-design.md` sección 3 para el
> diseño final y el porqué completo.

- [ ] **Step 1: Añadir los imports y el export de viewport**

En `app/layout.tsx`, cambia la primera línea de import:

```ts
import type { Metadata } from "next";
```

por:

```ts
import type { Metadata, Viewport } from "next";
```

Y justo **después** del bloque `export const metadata` que ya existe, añade:

```ts
/**
 * Respaldo sin JS. El color de verdad lo fija el script del <head>, porque el
 * tema de esta app lo manda `localStorage["dots-theme"]`, no el esquema del
 * sistema: sin esa segunda capa, quien tenga el SO en oscuro y la app en claro
 * vería la barra de estado oscura sobre una app clara.
 */
export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fff7fb" },
    { media: "(prefers-color-scheme: dark)", color: "#14122e" },
  ],
};
```

> **Anotado post-ejecución (2026-08-16):** este `export const viewport` se
> escribió y se ejecutó tal cual (commit `4c5402e`), pero se **eliminó por
> completo** dos commits después (`e82e24e`), junto con el import de
> `Viewport` que quedaba sin uso. Razón: `themeColor` como array hace que
> Next emita dos `<meta name="theme-color">` (una por media query), y el
> script del Step 3 tocaba solo una con `querySelector` en singular — nunca
> la de `dark`, justo el caso que este comentario decía cubrir ("quien tenga
> el SO en oscuro y la app en claro"). Un primer intento (`145a836`) lo
> parcheó con un `MutationObserver` sobre `document.head`, porque React 19
> reclama y recrea esas etiquetas durante la hidratación; se descartó por
> frágil — pelearse con el reconciliador de React por una barra de estado no
> compensaba. Diseño final: sin `viewport`, sin `themeColor`; una sola fuente
> de verdad, el script del Step 3 ya corregido (ver su anotación). Detalle
> completo en `2026-08-16-pwa-manifest-design.md` sección 3.

- [ ] **Step 2: Añadir los metadatos de iOS**

Sustituye el bloque `export const metadata` entero por este:

```ts
export const metadata: Metadata = {
  title: "dots — Aprende inglés jugando",
  description:
    "Aprende inglés de verdad con Doty: lecciones cortas, rachas y juegos que enganchan.",
  // iOS ignora el manifest: la instalación desde "Añadir a pantalla de inicio"
  // se configura con estos metadatos y con app/apple-icon.png
  appleWebApp: {
    capable: true,
    title: "dots",
    statusBarStyle: "default",
  },
};
```

- [ ] **Step 3: Que el script anti-flash fije también el theme-color**

El script del `<head>` ya calcula el tema. Añadirle el color de la barra es una
línea, y es lo que hace verdad la frase "la barra acompaña al tema del
usuario". Sustituye el atributo `__html` del script por este (una sola línea,
sin saltos):

```ts
__html: `(function(){try{var t=localStorage.getItem("dots-theme")||"light";document.documentElement.setAttribute("data-theme",t);if(t==="dark")document.documentElement.classList.add("dark");document.documentElement.style.colorScheme=t;var m=document.querySelector('meta[name="theme-color"]');if(!m){m=document.createElement("meta");m.setAttribute("name","theme-color");document.head.appendChild(m);}m.setAttribute("content",t==="dark"?"#14122e":"#fff7fb");}catch(e){}})();`,
```

Lo añadido es solo la parte final: busca la `<meta name="theme-color">`, la
crea si no está, y le pone el color del tema resuelto.

> **Anotado post-ejecución (2026-08-16):** este one-liner (con
> `querySelector` en singular) se ejecutó tal cual (commit `4c5402e`) y
> resultó tener el bug descrito en la anotación del Step 1: solo tocaba una
> de las dos etiquetas que `viewport` declaraba, nunca la de `dark`. Se
> corrigió dos veces más dentro de esta misma Task 3:
>
> 1. (`145a836`) a `querySelectorAll` + borrar todas las
>    `meta[name="theme-color"]` + insertar una sola sin `media`, más un
>    `MutationObserver` añadido al mismo script para deshacer la recreación
>    que la hidratación de React 19 provocaba tras cada carga completa.
> 2. (`e82e24e`, diseño final) se quitó `viewport` por completo — ver la
>    anotación del Step 1 — y con él dejó de hacer falta el observer: el
>    script quedó en `querySelectorAll` + borrar todas + insertar una sola
>    **sin `media`**, sin nada más.
>
> `components/theme-toggle.tsx` replica esa misma limpieza en su
> `applyTheme()` al cambiar de tema en caliente (bug separado, encontrado en
> la misma revisión: el toggle no tocaba `theme-color` y la barra se quedaba
> congelada hasta la siguiente recarga). Código final en `app/layout.tsx`;
> diseño final y porqué completo en
> `2026-08-16-pwa-manifest-design.md` sección 3.

- [ ] **Step 4: Type-check, lint y build**

```bash
cd /home/endurance/Projects/Endurance/dots/dots-webapp
source ~/.nvm/nvm.sh && npx tsc --noEmit && npm run lint && npx next build 2>&1 | tail -3
```

Expected: `tsc` y `lint` sin errores, y el build termina con la tabla de rutas
(exit 0). Los avisos de fuentes de Google al no haber red son normales y no
hacen fallar el build.

- [ ] **Step 5: Verificar el `<head>` servido**

Con el preview corriendo, navega a `http://localhost:3000/` y comprueba en el
DOM que existen las tres etiquetas:

```js
JSON.stringify({
  manifest: document.querySelector('link[rel="manifest"]')?.getAttribute("href"),
  apple: document.querySelector('link[rel="apple-touch-icon"]')?.getAttribute("href"),
  themeColor: document.querySelector('meta[name="theme-color"]')?.getAttribute("content"),
  dataTheme: document.documentElement.getAttribute("data-theme"),
})
```

Expected: `manifest` es `/manifest.webmanifest`; `apple` **no es null** y
empieza por `/apple-icon` (Next le añade un hash de caché, así que no compares
la cadena entera); y **`themeColor` coincide con `dataTheme`**: `#fff7fb` si
`data-theme` es `light`, `#14122e` si es `dark`.

Si `apple` sale `null`, el archivo no está en `app/apple-icon.png` — revisa la
Task 1, porque en `public/` no genera etiqueta.

- [ ] **Step 6: Verificar que el color sigue al tema, no al sistema**

Esta es la comprobación que justifica el Step 3. En la consola de la página:

```js
localStorage.setItem("dots-theme", "dark"); location.reload();
```

Tras recargar, vuelve a leer:

```js
JSON.stringify({
  themeColor: document.querySelector('meta[name="theme-color"]')?.getAttribute("content"),
  dataTheme: document.documentElement.getAttribute("data-theme"),
})
```

Expected: `themeColor` `#14122e` y `dataTheme` `dark`, **independientemente**
del esquema del sistema. Deja el estado como estaba después:
`localStorage.setItem("dots-theme","light")`.

- [ ] **Step 7: Commit**

```bash
cd /home/endurance/Projects/Endurance/dots/dots-webapp
git add app/layout.tsx
git commit -m "feat(pwa): barra de estado y metadatos de iOS

Añade el viewport con themeColor y el appleWebApp, que es lo que el manifest
no cubre: iOS lo ignora entero y se configura con metadatos y con
app/apple-icon.png.

El themeColor lleva dos capas a propósito. Las media queries son el respaldo
sin JS; el color de verdad lo fija el script anti-flash del <head>, porque el
tema de esta app lo manda localStorage['dots-theme'] y no el esquema del
sistema — el bloque prefers-color-scheme de globals.css está acotado a
:root:not([data-theme]), o sea que solo actúa sin JS. Sin esa segunda capa,
quien tenga el SO en oscuro y la app en claro vería la barra oscura sobre una
app clara."
```

> **Anotado post-ejecución (2026-08-16):** este fue el primero de tres
> commits de la Task 3 (`4c5402e`). El diseño de "dos capas" que describe su
> propio mensaje quedó descartado por los dos commits siguientes (`145a836`,
> `e82e24e`) — ver las anotaciones de los Steps 1 y 3 más arriba para el
> porqué y el diseño final. Este mensaje se deja tal cual porque es un commit
> real ya hecho: reescribirlo falsearía el historial de git.

---

### Task 4: Deshacer la contradicción entre specs

**Files:**
- Modify: `docs/superpowers/specs/2026-07-20-rediseno-total-design.md` (dos
  puntos: la fila "Notificaciones / PWA" de la tabla, y la línea de
  "Diferido")
- Modify: `docs/ARQUITECTURA.md`

**Interfaces:**
- Consumes: nada.
- Produces: nada.

El spec de julio dice en dos sitios que la PWA queda fuera de la web. Tras esta
tanda es falso a medias, y un documento que se contradice con otro es peor que
uno desactualizado: el siguiente que lo lea no sabrá cuál manda.

- [ ] **Step 1: Anotar la fila de la tabla**

En `docs/superpowers/specs/2026-07-20-rediseno-total-design.md`, busca la fila
que empieza por `| Notificaciones / PWA |` y añade al final de su última celda,
antes del `|` de cierre:

```
 — **REVERTIDO EN PARTE (2026-08-16)**: la app es instalable vía manifest, sin service worker. El push sigue delegado a la app nativa, que era el motivo real de esta fila. Ver `2026-08-16-pwa-manifest-design.md`
```

- [ ] **Step 2: Anotar la línea de "Diferido"**

En el mismo archivo, busca la línea que contiene
`**Diferido (fuera de este rediseño)**` y, dentro de ella, sustituye
`PWA/push (lo asume la futura app React Native)` por:

```
push (lo asume la futura app React Native; la PWA instalable sí se hizo, 2026-08-16)
```

- [ ] **Step 3: Registrar el manifest en la arquitectura**

En `docs/ARQUITECTURA.md`, localiza la sección que describe la estructura de
`app/` (búscala con `grep -n "^## \|app/(app)" docs/ARQUITECTURA.md`) y añade
al final de esa sección este bloque literal:

```markdown
### PWA — instalable desde el 2026-08-16

`app/manifest.ts` (tipado con `MetadataRoute.Manifest`) hace la app
instalable: icono propio, sin barra del navegador y **bloqueada en vertical**
—`orientation: "portrait"`, que solo ata a la app ya instalada; en el
navegador se sigue pudiendo girar—. Los iconos viven en `public/icons/`
(dos `any` y dos `maskable`, que Android necesita porque recorta al 80 %
central) y en `app/apple-icon.png`, que va ahí y no en `public/` porque es la
convención de fichero que hace que Next emita el `<link rel="apple-touch-icon">`.

**No hay service worker**: la app instalada necesita red, y sin conexión
muestra el error del navegador. El push sigue delegado a la futura app React
Native. Spec: `docs/superpowers/specs/2026-08-16-pwa-manifest-design.md`.
```

- [ ] **Step 4: Verificar que no queda ninguna afirmación suelta**

```bash
cd /home/endurance/Projects/Endurance/dots/dots-webapp
grep -rn "sin service worker\|PWA/push\|PWA" docs/superpowers/specs/2026-07-20-rediseno-total-design.md
```

Expected: cada línea que mencione la PWA lleva ya la nota de revertido o habla
solo de push. Si aparece alguna afirmación de que la PWA está descartada sin
matizar, anótala igual que las otras dos.

- [ ] **Step 5: Commit**

```bash
cd /home/endurance/Projects/Endurance/dots/dots-webapp
git add docs/
git commit -m "docs(pwa): el spec de julio deja de contradecir al de agosto

El rediseño total daba la PWA por descartada. Tras esta tanda es falso a
medias: la app es instalable, el push sigue delegado a la app nativa. Se anota
en su sitio en vez de reescribir el spec, que es histórico y cuyo razonamiento
sobre push sigue siendo correcto."
```

---

## Notas de cierre para quien ejecute

- **Lo que este plan NO hace**, y es deliberado: service worker, offline,
  push, `screenshots` y `shortcuts` del manifest. Si te tienta añadirlos,
  no: el offline con el token en memoria y una BD compartida de producción es
  una tanda entera aparte.
- **No rehagas el logo.** Se recorta el que hay.
- La app instalada **necesita red**. Sin conexión muestra el error del
  navegador. Es el precio de este alcance, no un bug que arreglar aquí.
- Los iconos son binarios: al commitearlos revisa con `git status` que no se
  cuela nada más de `public/`.
