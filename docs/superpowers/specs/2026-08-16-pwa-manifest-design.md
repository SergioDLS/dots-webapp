# Manifest de la PWA — dots instalable

- **Fecha**: 2026-08-16
- **Estado**: diseño aprobado por Sergio.
- **Alcance**: `app/manifest.ts` y `app/apple-icon.png` (nuevos),
  `app/layout.tsx`, `public/icons/` (nuevo). Solo frontend, sin tocar backend
  ni BD.
- **Plan de implementación**: `docs/superpowers/plans/2026-08-16-pwa-manifest.md`

## Contexto

La webapp **no tiene manifest**. Su único icono es `app/favicon.ico`, así que
hoy no se puede instalar: "Añadir a pantalla de inicio" produce un acceso
directo que abre el navegador con su barra, y en iPhone el icono es una
captura de la página.

El hallazgo salió de rebote del barrido de altos fijos, al comprobar si el
proyecto bloqueaba la orientación: no hay manifest ni bloqueo en ninguna parte.

### Una contradicción que este spec resuelve

El spec `2026-07-20-rediseno-total-design.md` dice, en dos sitios, que la PWA
queda **fuera** de la web: *"la web queda responsive sin service worker"* y
*"PWA/push (lo asume la futura app React Native)"*. La decisión del 2026-08-12
—PWA primero— lo revierte.

La revierte **solo en la parte instalable**. El razonamiento de julio era sobre
el **push**: Web Push es frágil en iOS (solo funciona con la PWA ya instalada)
y duplicaría infraestructura que la app nativa hará mejor. Ese razonamiento
sigue en pie y no se toca. Lo que julio no separó es que *instalable* y *push*
son cosas distintas: un manifest no necesita service worker.

## 1. Iconos

El logo disponible **no sirve tal cual**. `public/images/logos/DOTS_LOGO.png`
(1080×1080, alfa) es el lockup completo: burbuja rosa + "dots®" + la bajada
"Language Online Learning" en blanco, pensado para fondos oscuros. A 48 px la
bajada es un borrón, y el texto blanco desaparece sobre fondo claro.

El icono es **solo la burbuja**, que dentro de ese lienzo ocupa exactamente
**399×406 en el offset +359+157** (medido con `magick -trim` sobre la mitad
superior). Recorte de partida, común a las tres familias:

```
magick DOTS_LOGO.png -crop 399x406+359+157 +repage burbuja.png
```

Tres familias, cada una porque un consumidor distinto la exige:

| archivo | tamaños | `purpose` | fondo | encuadre |
| --- | --- | --- | --- | --- |
| `icon-<n>.png` | 192, 512 | `any` | transparente | burbuja al 80 % |
| `icon-maskable-<n>.png` | 192, 512 | `maskable` | `#fff7fb` | burbuja al 60 % |
| `app/apple-icon.png` | 180 | — | `#fff7fb` opaco | igual que `any` |

"Burbuja al N %" significa: extender el recorte a un lienzo cuadrado centrado
de lado `406 / N`, y reescalar ese cuadrado al tamaño final. Con el lado mayor
de la burbuja en 406 px: **508×508 para el 80 %** y **677×677 para el 60 %**.
Así el porcentaje es un número exacto y no un ojímetro.

Por qué las tres:

- **`maskable`**: Android recorta el icono con la forma del sistema (círculo,
  squircle…). La zona segura es el **80 % central**; lo de fuera se pierde. Sin
  un icono maskable, Android usa el de `any` y le muerde los bordes a la
  burbuja. Por eso este va al 60 %, con fondo sólido que rellena las esquinas.
- **`app/apple-icon.png`**: iOS **ignora los iconos del manifest**. Sin este
  archivo, el icono de la pantalla de inicio es una captura de la página. Y
  **no puede llevar transparencia**: iOS la compone contra negro.

  Va en `app/` y no en `public/` porque es una **convención de fichero de
  Next**: al detectarlo emite solo el `<link rel="apple-touch-icon">`. En
  `public/apple-touch-icon.png` el archivo se serviría igual y Safari lo
  encontraría por la ruta conocida, pero no habría etiqueta — y el punto 5 de
  la verificación comprueba justo eso.

Los tamaños 192 y 512 son el mínimo que pide Chrome para considerar la app
instalable, y 512 es el que alimenta el splash.

## 2. `app/manifest.ts`

Fichero TypeScript tipado con `MetadataRoute.Manifest`, que es lo idiomático en
Next 16: se sirve en `/manifest.webmanifest` y Next inyecta solo el
`<link rel="manifest">`. Nada de un JSON suelto en `public/`.

| campo | valor | por qué |
| --- | --- | --- |
| `name` | `dots — Aprende inglés jugando` | el de la ficha de instalación |
| `short_name` | `dots` | el que cabe bajo el icono |
| `id`, `start_url`, `scope` | `/` | `id` fijo evita que un cambio futuro de `start_url` cree una app "nueva" |
| `display` | `standalone` | sin barra del navegador |
| `orientation` | `portrait` | decisión de producto, ver abajo |
| `background_color` | `#fff7fb` | pinta el splash |
| `theme_color` | `#fff7fb` | barra de estado |
| `lang` / `dir` | `es` / `ltr` | la UI es en español |
| `categories` | `["education"]` | |

**`orientation: "portrait"`** *(decisión de producto)*. Los 12 juegos están
compuestos en columna —HUD arriba, teclado o controles abajo— y ninguno
aprovecha el horizontal. Aviso importante: **esto solo afecta a la app ya
instalada**. En el navegador el usuario sigue pudiendo girar, así que el
arreglo del tablero de memory (`2fd341c`) sigue siendo necesario y no queda
redundante.

**`theme_color` es el fondo, no el rosa de marca** *(decisión de producto)*. El
`theme_color` tiñe la barra de estado; un acento ahí se lee como una cabecera
que la app no tiene. `#fff7fb` es `--background` en claro.

**Congelados en claro, a propósito** *(límite aceptado, no bug)*:
`background_color` y `theme_color` son estáticos porque el manifest es un
fichero que el navegador lee **antes de que corra cualquier script** — no
puede consultar `localStorage["dots-theme"]`. Quien instale la app con el
tema oscuro puesto ve el splash de arranque (Android pinta
`background_color`/`theme_color` con el icono encima mientras React aún no
montó) en `#fff7fb`, y recién pasa a oscuro cuando el script anti-flash y la
app corren. Es el único sitio donde "la barra acompaña al tema" no se
cumple, y no tiene arreglo con un manifest estático: no se cambia el
manifest por esto.

## 3. Cableado en `app/layout.tsx`

**Diseño final** (corregido durante la Task 3 de la implementación, no en
esta planificación — ver las dos subsecciones de abajo para el porqué
completo): no existe `export const viewport` ni `themeColor`. El script
anti-flash del `<head>` es la **única** fuente de verdad para la barra de
estado:

- Lee `localStorage["dots-theme"]`, vuelca `data-theme` y `colorScheme` como
  ya hacía.
- Borra con `querySelectorAll` cualquier `<meta name="theme-color">`
  existente y crea **una sola**, sin atributo `media`, con el color del tema
  resuelto. El borrado es defensivo/idempotente (por si el script llegara a
  correr más de una vez), no una pelea con React: al no existir `viewport`,
  React no gestiona ninguna etiqueta `theme-color` propia y no hay
  hidratación que reclame ni recree nada.
- `components/theme-toggle.tsx` hace exactamente la misma limpieza +
  inserción en su `applyTheme()`, para que cambiar de tema en caliente
  actualice la barra sin esperar a la siguiente recarga.

**Matiz honesto**: "única fuente de verdad" vale en la pestaña del navegador
y en la app instalada en Android/Chrome. En una app **añadida a la pantalla
de inicio de iOS**, la barra de estado la gobierna
`apple-mobile-web-app-status-bar-style` (el `statusBarStyle` de
`appleWebApp` en `metadata`, fijo en `"default"`): ese meta es estático, no
sabe nada de `localStorage["dots-theme"]` y no tiene ninguna variante que lo
haga seguir el tema. El script del `<head>` sigue siendo la única fuente de
verdad en todo lo demás; en iOS instalado, esta es la excepción, y no tiene
arreglo — ese meta no admite una versión "según el tema".

Sin cambios respecto al diseño original:

- En `metadata`, `appleWebApp` con `capable: true`, `statusBarStyle:
  "default"` y el `title` corto.
- El `<link rel="manifest">` y el `<link rel="apple-touch-icon">` **no se
  escriben a mano**: los pone Next por existir `app/manifest.ts` y
  `app/apple-icon.png`.

**Precio aceptado**: sin JavaScript no hay `theme-color` en absoluto — ni
siquiera el respaldo por media query que este spec proponía originalmente
(ver abajo). Es irrelevante: esta es una SPA de React con el token de sesión
en memoria, así que sin JS no hay login, ni juegos, ni nada que una barra de
estado bien pintada pudiera proteger.

### Por qué las media queries solas se equivocarían *(corregido al planificar)*

Este spec decía en su primera versión que el `themeColor` por media query era
"lo que hace que la barra acompañe al tema que el usuario tenga puesto". **Es
falso**, y se vio al leer el layout con detalle para escribir el plan.

El tema de esta app **no lo decide el sistema operativo**: lo decide
`localStorage["dots-theme"]`, que un script inline del `<head>` lee antes del
primer pintado y vuelca en `data-theme`. El bloque
`@media (prefers-color-scheme: dark)` de `globals.css` está acotado a
`:root:not([data-theme])`, o sea que **solo actúa si ese script no ha corrido**
(JS desactivado).

Con media queries a secas, cualquiera con el SO en oscuro y la app en claro
—o al revés— vería la barra de estado de un tema y la app del otro. La
corrección de entonces, al escribir el plan, fue proponer **dos capas**: las
media queries (`viewport.themeColor`) como respaldo sin JS, y el script, que
ya calcula el tema, fijando además el `content` de la `<meta
name="theme-color">` real.

### Por qué se descartaron las dos capas *(corregido durante la Task 3, no al planificar)*

Las dos capas se implementaron tal cual (commit `4c5402e`) y parecían
correctas, pero fallaban en la práctica:

1. **El mecanismo fallaba justo en el escenario que decía resolver.**
   `viewport.themeColor` como array hace que Next emita **dos**
   `<meta name="theme-color">`, una por media query (`light` y `dark`). El
   script fijaba el color con `document.querySelector` en **singular**, que
   siempre agarra la primera de las dos — la de `light` — y nunca tocaba la
   de `dark`. Un móvil con el sistema operativo en oscuro obedece esa segunda
   etiqueta por su propia media query, sin mirar el script; si la app (vía
   `localStorage`) estaba en claro, la barra se quedaba oscura de todos
   modos. Exactamente el caso que las dos capas decían cubrir.
2. **El primer parche no bastaba, y el segundo peleaba con React.** Cambiar
   el script a `querySelectorAll` + borrar todas + insertar una sola
   arreglaba el caso anterior en aislamiento (commit `145a836`), pero no en
   una carga real: React 19 hidrata las dos `<meta theme-color>` que
   `viewport` declaraba emparejando por `(name, content)` sin mirar `media`,
   reclama la etiqueta que el script dejó para uno de los dos huecos y
   **recrea la otra mitad estática** justo después de hidratar — con lo que
   cada carga completa volvía a terminar en dos etiquetas. Se cerró con un
   `MutationObserver` sobre `document.head` que revertía la recreación en
   cuanto ocurría.

   Funcionaba (verificado en las cuatro combinaciones SO×app), pero
   significaba mantener un observer permanente peleándose con el
   reconciliador de React por una barra de estado: frágil ante cualquier
   subida de versión de React o Next, mal negocio a cambio de tan poco.

**Diseño final** (commit `e82e24e`): se elimina `themeColor` del `viewport` —y
con él el export entero, que quedaba vacío—. Al no declarar ya nadie una
`<meta name="theme-color">` vía metadata de Next, React no gestiona esa
etiqueta y no hay hidratación que la reclame ni que recree nada. El script
inline pasa a ser la única fuente: `querySelectorAll` + borrar todas +
insertar una sola sin `media`. `components/theme-toggle.tsx` replica la misma
limpieza al cambiar de tema en caliente (un bug aparte que la misma revisión
encontró: su `applyTheme()` no tocaba `theme-color`, así que la barra se
quedaba congelada hasta la siguiente recarga).

El precio es el que ya se anotó arriba: sin JavaScript no hay `theme-color`
en absoluto, ni el respaldo por media query que había en el diseño de dos
capas. Se acepta porque en una SPA con el token en memoria, sin JS no hay app
que proteger. Detalle completo (incluida la cita del código de hidratación de
React que causaba la recreación) en
`docs/superpowers/plans/2026-08-16-pwa-manifest.md` (Task 3, anotaciones de
los Steps 1 y 3).

## 4. Corregir el spec de julio

En `2026-07-20-rediseno-total-design.md`, las dos frases que dan la PWA por
descartada llevarán una nota que apunte a este spec, aclarando que lo revertido
es la instalabilidad y que el push sigue delegado a la app nativa. Sin
reescribir el spec: es un documento histórico y su razonamiento sobre push era
correcto.

## Verificación

Todo comprobable sin instalar nada:

1. `npx next build` en verde y `/manifest.webmanifest` servido.
2. El JSON servido contiene **todos** los campos de la tabla con sus valores
   exactos, y exactamente cuatro entradas en `icons` (las dos `any` y las dos
   `maskable`; el de Apple no va en el manifest, va como `<link>`).
3. Cada ruta declarada en `icons` existe y **mide lo que dice** (`magick
   identify`); un manifest que apunta a un icono inexistente es peor que no
   tener manifest, porque Chrome marca la app como no instalable sin decir por
   qué.
4. `app/apple-icon.png` **sin canal alfa** (`magick identify -format "%A"`
   debe dar `False`/`Undefined`).
5. El HTML servido incluye `<link rel="manifest">` y el `apple-touch-icon`.
6. La burbuja del icono maskable cabe en el 80 % central: comprobar que el
   contenido no transparente no toca el borde del recuadro seguro.

## Manejo de errores y casos límite

- **iOS**: no lee `orientation` ni instala desde el manifest; el usuario tiene
  que usar "Compartir → Añadir a pantalla de inicio". Es limitación de la
  plataforma, no algo que arreglar aquí.
- **Sesión**: el token vive en memoria, así que abrir la app instalada arranca
  igual que una pestaña nueva — el refresh token en cookie HttpOnly rehidrata
  la sesión. `standalone` no cambia nada de esto.
- **Sin service worker**, la app instalada **necesita red**: sin conexión
  muestra el error del navegador. Es el precio consciente de este alcance.

## Fuera de alcance

Service worker, offline, push/notificaciones, `screenshots` y `shortcuts` del
manifest, y el icono adaptativo animado. También queda fuera rehacer el logo:
se recorta el que hay.

## Referencias

- `CLAUDE.md` (reglas 1-8), `app/globals.css` (tokens de color).
- Decisión PWA-primero del 2026-08-12; `2026-07-20-rediseno-total-design.md`
  para el razonamiento sobre push que se conserva.
- `2fd341c` — el arreglo de memory en horizontal, que este spec NO deja
  redundante.
