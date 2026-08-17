# Manifest de la PWA — dots instalable

- **Fecha**: 2026-08-16
- **Estado**: diseño aprobado por Sergio.
- **Alcance**: `app/manifest.ts` (nuevo), `app/layout.tsx`, `public/icons/`
  (nuevo). Solo frontend, sin tocar backend ni BD.

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
| `apple-touch-icon.png` | 180 | — | `#fff7fb` opaco | igual que `any` |

"Burbuja al N %" significa: extender el recorte a un lienzo cuadrado centrado
de lado `406 / N`, y reescalar ese cuadrado al tamaño final. Con el lado mayor
de la burbuja en 406 px: **508×508 para el 80 %** y **677×677 para el 60 %**.
Así el porcentaje es un número exacto y no un ojímetro.

Por qué las tres:

- **`maskable`**: Android recorta el icono con la forma del sistema (círculo,
  squircle…). La zona segura es el **80 % central**; lo de fuera se pierde. Sin
  un icono maskable, Android usa el de `any` y le muerde los bordes a la
  burbuja. Por eso este va al 60 %, con fondo sólido que rellena las esquinas.
- **`apple-touch-icon.png`**: iOS **ignora los iconos del manifest**. Sin este
  archivo en la raíz, el icono de la pantalla de inicio es una captura de la
  página. Y **no puede llevar transparencia**: iOS la compone contra negro.

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

## 3. Cableado en `app/layout.tsx`

- `export const viewport: Viewport` con `themeColor` sensible al esquema:
  `#fff7fb` en claro y `#14122e` en oscuro (los dos `--background` reales de
  `globals.css`). El manifest solo admite un color estático; esto es lo que
  hace que la barra de estado acompañe al tema que el usuario tenga puesto.
- En `metadata`, `appleWebApp` con `capable: true`, `statusBarStyle:
  "default"` y el `title` corto.
- El `<link rel="manifest">` **no se escribe a mano**: lo pone Next al existir
  `app/manifest.ts`.

No se toca el script anti-flash del `<head>`, que ya resuelve el tema antes del
primer pintado y seguirá haciéndolo dentro de la app instalada.

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
4. `apple-touch-icon.png` **sin canal alfa** (`magick identify -format "%A"`
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
