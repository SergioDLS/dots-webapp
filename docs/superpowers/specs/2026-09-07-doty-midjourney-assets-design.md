# Arte de Doty con Midjourney — fases 0 y 1

- **Fecha**: 2026-09-07
- **Estado**: **implementado (fases 0 y 1) el 2026-09-10.** Las 97 piezas del
  catálogo generadas y en su sitio; iconos de la PWA, splash de iOS y
  screenshots del manifest derivados; los 22 legacy archivados en
  `public/images/doty-classic/` y `check-doty-assets` en modo `--strict`.
  Pendientes: la tarea 20 (los 3 narradores a Cloudinary + `characters.img`,
  que toca la BD de producción), las fases 2–4 y la spec aparte de ejercicios
  sin imagen (días, meses, hora y artículos, decidido con Sergio el 2026-09-07).
- **Alcance**: `components/ui/doty/` (registro y componente), `public/images/Doty/`
  (sprites nuevos; los 22 legacy no se borraron, se archivaron en
  `public/images/doty-classic/` — Sergio los quiere para una animación de
  transformación), `public/images/games/` (nuevo),
  `public/icons/` + `app/apple-icon.png` + `app/layout.tsx` (icono, splash,
  screenshots), `public/sw.js` (bump de versión), `scripts/mj/` (nuevo,
  pipeline local), `docs/brand/doty-identity.md` (portado y reescrito).
  Backend: un script en `dots-backend/scripts/` que sube 3 imágenes a
  Cloudinary y actualiza `characters.img` (3 filas) y `difficulty.img`
  (3 filas). Nada más de BD.
- **Plan de implementación**: `docs/superpowers/plans/2026-09-07-doty-midjourney-assets.md`
  (tareas 1–19, 21 y 22 hechas; 20 pendiente).

## Contexto

### Qué hay hoy (inventario del 2026-09-07, repo + BD de producción en solo lectura)

| Activo | Estado | Dónde |
|---|---|---|
| Poses de Doty | 22 PNG de 300×300, numéricas (`DOTTY-POSES-01..22`), varias con anteojos | `public/images/Doty/`, se muestran hasta 192 px (`medium`) y ya se ven blandas en pantallas 2x/3x |
| Sprites de la hoja de marca | 94 recortes de 75×99 px + 6 "heroes" de ~315 px + 8 escenarios de 168×114 | rama `redesign/doty-brand` (10 commits, 129 archivos, sin mergear desde 2026-07-14) |
| Registro tipado | `poses.ts` con nombres semánticos y dos tiers (`src` hoja / `hero` alta) | misma rama; en main el componente sigue recibiendo `pose: string` y construyendo la ruta a mano |
| Animaciones `bob/cheer/sad/wave` | el prop `animation` es un no-op en main: las clases solo existen en la rama | `app/globals.css` |
| Personajes de voz | 4 filas (`doty`, `doty-fem`, `doty-sailor`, `doty-scientist`), `characters.img` vacío en las 4 | `dots.characters`; `voice-avatar.tsx` ya prefiere `img` y cae a una pose numérica |
| Dificultades | `difficulty.img` = `"01"`, `"04"`, `"17"` (poses numéricas) | `dots.difficulty`, renderizado por `path-difficulty.tsx` |
| Iconos | PWA: burbuja rosa genérica. Nav, 10 de 12 juegos, tienda e insignias: emoji | `public/icons/`, `nav-items.ts`, `games-grid-view.tsx`, `shop_items.meta.emoji` |
| Imágenes de niveles | 95 filas, 24 distintas, 48 apuntan a `abc.png`; estilo stock flat | `dots.levels.src` en Cloudinary |
| Imágenes de palabras | 421 URLs distintas en 28 categorías, 150×150, stock | `words`, `vocab_items`, `sentences` en Cloudinary |

El registro semántico de la rama es la arquitectura correcta y este spec la
adopta. Lo que la rama no pudo resolver es el arte: sus sprites son recortes
diminutos de una sola lámina. Midjourney produce esas piezas en alta
resolución, una por una, con la lámina como referencia.

### Por qué no se mergea la rama entera

Además del registro, la rama toca paleta, botones, diálogos, admin, juegos
que ya no existen (`flashcards`, `speed-round`) y componentes borrados en main
(`level-container`, `readings-list`, `games-list`). Un merge arrastraría
conflictos y decisiones de julio ya superadas. Se **portan a mano** tres
piezas: `poses.ts` (simplificado, ver §4), `doty.tsx` y
`docs/brand/doty-identity.md` (reescrito), más los keyframes `doty-*` de su
`globals.css`.

### Restricciones de Midjourney que condicionan el diseño (verificadas 2026-09-07)

- **Consistencia de personaje**: Omni Reference (`--oref` + `--ow`). No
  garantiza detalles idénticos; se asume curación manual y una tasa de
  aciertos del 20–30 % por pose. Los trabajos con `--oref` se ejecutan con el
  modelo V7 aunque el plan tenga V8 por defecto.
- **Sin transparencia ni vectores**: salida RGB. El fondo se quita en local
  con rembg. El editor web de Midjourney solo da recorte de borde duro y no
  se usa.
- **Sin API oficial** y con términos que prohíben automatizar la web. La
  generación la hace Sergio pegando prompts; todo lo demás se automatiza.
- **Plan Basic (10 USD)**: 3,3 h de GPU rápida al mes, sin modo relax.
  Trabajo estándar ≈ 0,8 min; Draft (24 imágenes a 512 px) ≈ 0,4 min; hora
  extra 4 USD; Standard 30 USD con relax ilimitado.

## Decisiones tomadas con Sergio

| Tema | Decisión |
|---|---|
| Anteojos | Doty canónico **sin anteojos** (como la hoja de marca). Los anteojos son un accesorio y el rasgo de la científica. |
| Personajes de voz | **Doty Fem**: pestañas y lazo cyan `#35D8F5`. **Doty marinero**: gorra marinera y pañuelo navy `#1E1B5C`. **Doty científica**: anteojos redondos y bata blanca. Mismo cuerpo y cara base que Doty. |
| Sombra | **Por CSS.** Los sprites se generan sin la elipse; el componente aplica `filter: drop-shadow`. Desactivable por prop. |
| Carpeta de descargas | `dots/imagenes/mj/<fase>/` (fuera de los repos, junto a la hoja de marca). |
| Arranque | Fases 0 y 1. Escenarios (8) y cosméticos de tienda (7) quedan fuera. |
| Palabras | **Verbos** conservan imagen (Doty haciendo la acción). **Días, meses, hora y artículos no llevan imagen**: sus ejercicios deben rediseñarse para no depender de una. Es un cambio de contenido/ejercicios, **fuera de este spec** (ver §10). Las palabras concretas se renuevan en fase 3, spec aparte. |

## 1. Fases y compuertas

| Fase | Contenido | Compuerta de salida |
|---|---|---|
| **0 — Kit de estilo** | Recorte de referencia, matriz de prueba, plantilla de prompt congelada, medición real de GPU | Doty se sostiene con ≥ 25 % de aciertos en 3 poses distintas; `scripts/mj/style.json` escrito |
| **1 — Set de Doty** | 97 piezas (§3), registro semántico, componente, icono PWA, splash, screenshots, tiles de juegos, personajes de voz | `npm run lint` y `npx next build` pasan; ningún `DOTTY-POSES-*` queda en el repo; preview visual de las pantallas clave |
| 2 — Tiles de niveles | ~30 tiles de Doty en contexto; corrige los 48 niveles que comparten `abc.png` | spec propia |
| 3 — Palabras concretas + verbos | ~530 imágenes; requiere un mes de Standard | spec propia |
| 4 — Iconos restantes | nav (set vectorial, no Midjourney), insignias, cosméticos | spec propia |

Si la fase 0 falla, el proyecto se detiene sin haber tocado código: el único
artefacto es una carpeta de pruebas y un informe.

## 2. Fase 0 — Kit de estilo

### 2.1 Referencia

Del archivo `dots/imagenes/e1a1cdcd-a522-4f4c-a935-da5ae282cf9f.png` (la hoja
de marca) se recortan con ImageMagick:

- `dots/imagenes/mj/fase-0/ref-hero.png`: el Doty grande saludando, sin la
  sombra ni los trazos decorativos. Es la imagen de **Omni Reference**.
- `dots/imagenes/mj/fase-0/ref-sheet.png`: la hoja completa. Es la imagen de
  **Style Reference** inicial; en cuanto haya 2–3 aciertos propios, el
  `--sref` pasa a ser un código derivado de ellos (más estable que una lámina
  con texto y paleta).

### 2.2 Matriz de prueba (≈ 16 trabajos, ≈ 15 min de GPU)

| Variable | Valores |
|---|---|
| Pose | `saludando`, `pensando`, `triste` |
| `--ow` | 100, 300 |
| Modelo | por defecto del plan vs. `--v 7` explícito |
| Draft | 2 trabajos con `--oref` en Draft, para saber si lo acepta y cuánto cuesta |
| Solo `--sref` | 1 trabajo sin `--oref`, para saber si el estilo solo ya sostiene al personaje |

Cada trabajo se anota en `dots/imagenes/mj/fase-0/log.md`: parámetros,
minutos de GPU consumidos (los muestra la página de cuenta de Midjourney) y
veredicto por imagen. De ahí salen dos cosas: el ajuste ganador y la tabla de
presupuesto real de §9.

### 2.3 Criterios de aceptación de una imagen

Una imagen es **acierto** si cumple todo:

1. Esfera rosa `#FF1F8F` con 5–6 picos de "pelo" arriba, sin anteojos.
2. Ojos ovalados navy con brillo blanco; boca ancha del mismo navy.
3. Brazos cortos y piernas rechonchas con zapatos magenta oscuro `#D60073`.
4. Sombreado plano tipo cel, contorno limpio, sin textura fotográfica.
5. Cuerpo entero, centrado, fondo blanco liso, sin texto, sin sombra en el suelo.
6. La pose pedida se reconoce sin leer el prompt.

### 2.4 Plantilla de prompt (punto de partida; la fase 0 la ajusta)

```
<frase inicial única>, Doty the mascot: a round hot-pink ball character with a
spiky tuft of hair on top, big oval navy eyes with white highlights, wide navy
smiling mouth, short stubby arms and legs, dark magenta shoes, no glasses,
<pose y gesto>, <expresión>, flat vector cartoon illustration, clean bold
outlines, soft cel shading, full body centered, plain white background
--ar 1:1 --stylize 50 --oref <ref-hero> --ow <ganador> --sref <código> --sw 200
--no text, watermark, glasses, shadow, background objects
```

Para **chapas de estado** y **tiles de juegos** (§3.6–3.7) no se usa `--oref`;
el bloque de estilo es "flat icon, thick rounded outline, brand palette
#FF1F8F #1E1B5C #3768FF #35D8F5, centered, plain white background" con el
mismo `--sref`.

### 2.5 Salida de la fase

`scripts/mj/style.json` con los parámetros congelados:

```json
{
  "model": "7",
  "oref": "ref-hero.png",
  "ow": 300,
  "sref": "<código>",
  "sw": 200,
  "stylize": 50,
  "aspect": "1:1",
  "negative": ["text", "watermark", "glasses", "shadow", "background objects"],
  "draft_supports_oref": null,
  "gpu_minutes": { "standard": null, "draft": null, "enhance": null }
}
```

Los `null` se rellenan con lo medido. Ningún prompt de fase 1 se emite hasta
que este archivo está completo.

## 2-bis. Resultado real de la fase 0 (2026-09-09) — cambia el método

**La fase 0 hizo su trabajo: invalidó el método que este spec había diseñado.**
Ejecutada con 8 trabajos contra Midjourney **V8.2**, plan Basic.

### El camino no es V7 + Omni Reference, es V8.2 + Edit Model

| | V7 + `--oref` | V8.2 + Edit Model |
|---|---|---|
| GPU por trabajo (medido) | 2,0 min | **1,0 min** |
| Contorno navy de marca | 1 de 8 salidas | 4 de 4 |
| Transfiere a una pose nueva | sí | sí (verificado con `pensando`) |
| Consistencia entre las 4 candidatas | baja | alta |

En V8.x Midjourney retiró el bin de Omni-reference y lo sustituyó por el Edit
Model (la fila "Attach to prompt" de la web). `--oref`/`--ow` siguen existiendo,
pero solo bajo V7 — y V7 rinde peor y cuesta el doble.

**Consecuencia de presupuesto:** la fase 1 pasa de ~12,9 h (≈ 4 meses de Basic)
a **1,6–3,2 h**, que cabe en un ciclo. El mes de Standard que §9 daba por
necesario deja de serlo.

### Cómo funciona el Edit Model, y las dos reglas que impone

Se le da **una imagen fuente** y **una instrucción de qué cambiar**. Hereda de
la fuente el acabado *y el encuadre*. De ahí las dos reglas:

1. **Fuente fija, nunca encadenar.** Las 97 piezas parten siempre de la misma
   imagen patrón. Encadenar (pieza 1 → 2 → 3) acumula deriva.
2. **La instrucción nombra los colores de marca, siempre.** Lo que no se
   nombra, deriva. Medido sobre la misma pose y la misma fuente:
   - sin nombrarlos → contorno `#D2006E` (magenta), distancia al navy 183
   - nombrándolos → contorno `#001E28` (navy), distancia al navy **60**

### La imagen patrón

`dots/imagenes/mj/fase-0/ref-patron.png`: el `ref-hero.png` recortado al
contenido y centrado en un lienzo **1024×1024 blanco con margen**. El cuadrado
importa porque el Edit hereda el encuadre: con la fuente de 870×787 las salidas
venían recortadas sin cuerpo entero.

### Corrección al canon: Doty NO lleva zapatos

§2.3 de este spec exigía "zapatos magenta oscuro". **Es un error mío al leer la
hoja de marca**: ampliada, los pies del Doty original son rosa liso y lo navy
del pie levantado es la planta, no un zapato. Midjourney tenía razón al no
producirlos. El criterio queda eliminado, y con él el criterio 3 de §2.3.

### Lo que queda obsoleto de §2

La matriz de prueba de §2.2 (`--ow` 100 vs 300, modelo por defecto vs `--v 7`)
no aplica: `--ow` es de V7. Además `--oref` fuerza V7 aunque la cuenta esté en
V8, así que el eje del modelo nunca midió nada. Se conserva escrita solo como
registro de lo que se probó.

## 3. Fase 1 — Catálogo de piezas (97)

Cada pieza tiene un **slug** (nombre de archivo y clave del registro), un
**grupo** (carpeta) y una **frase inicial única** en inglés que abre su prompt.
Midjourney nombra las descargas `<usuario>_<primeras palabras del prompt>_<uuid>.png`,
así que la frase inicial es lo que permite al pipeline (§5) mapear cada
archivo a su destino sin que nadie renombre nada. La lista completa vive en
`scripts/mj/batches/fase-1.json`; aquí va el resumen.

### 3.1 Expresiones (15) — `expressions/`

feliz, muy-feliz, emocionado, orgulloso, sorprendido, pensando, preocupado,
triste, enojado, decepcionado, riendo, timido, enamorado, cansado, dormido.
Cuerpo entero, de pie, brazos acompañando la emoción.

### 3.2 Poses (16) — `poses/`

saludando, pulgar-arriba, senalando, bienvenido (brazos abiertos),
aplaudiendo, caminando, corriendo, saltando, bailando, sentado, leyendo,
escribiendo, en-laptop, escuchando (auriculares azules), en-celular,
**hablando** (boca abierta, mano al frente; es la pose del avatar de voz
cuando el personaje es Doty base). `hablando` es la única pieza nueva respecto
al registro de la rama.

### 3.3 Estados (6) — `states/`

wow, oh-no, ups, excelente, perfecto, sigue-asi. Son expresiones con gesto
marcado; **sin texto** dentro de la imagen (el texto lo pone la UI).

### 3.4 Celebraciones (6) — `celebrations/`

lo-lograste (salto con puños arriba), confeti, trofeo, medalla, diploma,
fuegos-artificiales. Los props van en los colores de marca.

### 3.5 Accesorios (16) — `accessories/`

libro, lapiz, laptop, tablet, celular, mochila, taza, diploma, trofeo,
microfono, bandera-uk, bandera-usa, maleta, lentes, idea (bombilla), globo.
Doty sostiene o lleva el objeto; el objeto es el protagonista visual.

### 3.6 Temáticos (6) — `themed/`

navidad, halloween, san-valentin, fiestas-patrias, graduacion, back-to-school.

### 3.7 Chapas de estado (6) — `icons/`

correcto, incorrecto, atencion, cargando, racha, nivel-completado. Iconos
planos, sin mascota, 512 px. Se renderizan con `<Doty pose="correcto"
size="micro">` igual que en la rama; están en el registro para que el
type-check los cubra.

### 3.8 Stickers sin texto (10) — `stickers/`

good-job (pulgar arriba y guiño), amazing (ojos de estrella), keep-going
(puño en alto), you-can-do-it (bíceps), lets-practice (señala una laptop),
oops (manos en la boca), almost (dedos "casi"), nice (gesto OK), excellent
(doble pulgar), see-you (saluda de espaldas girando la cabeza). Son poses; la
burbuja y la frase las compone `DotySticker` (§4.4). Archivo
`stickers/<kind>.png`, clave del registro `sticker-<kind>` (como en la rama),
para que no choquen con expresiones de nombre parecido.

### 3.9 Tiles de juegos (12) — `public/images/games/<key>.png`

| key | Motivo |
|---|---|
| wordle | fichas de letras verdes y amarillas |
| crossword | cuadrícula con lápiz |
| dot-match | puntos unidos por una línea |
| true-false | dos tarjetas, ✓ y ✗ |
| memory | cartas boca abajo y una volteada |
| audio-blitz | auriculares con rayo |
| word-tower | torre de bloques con letras |
| sentence-builder | ladrillos apilándose |
| ghost-race | Doty fantasma corriendo |
| dotaxi | Doty en un taxi amarillo |
| dont-pop | Doty en globo aerostático |
| dot-bombs | bomba con mecha y Doty asustado |

512 px, transparentes, mismo estilo que las chapas. Reemplazan los 10 emoji y
los 2 PNG actuales del grid de Juegos (`games-grid-view.tsx`).

### 3.10 Personajes de voz (3) — Cloudinary `dots/images/characters/<key>.png`

`doty-fem`, `doty-sailor`, `doty-scientist`, cada uno hablando. 1024 px. El
backend los sube y escribe `characters.img`; `voice-avatar.tsx` no cambia (ya
prefiere `img`). Se generan como cualquier pieza de mascota: Edit Model con
`ref-patron.png` adjunta (§2-bis), no con `--oref`, que quedó obsoleto.

**Dos intentos fallidos y lo que ensenaron** (2026-09-09). Primero fueron el
Doty base con un accesorio encima; a tamano de avatar (~80 px), que es donde se
usan, el accesorio no se lee. Despues un barrido de color rosa → lavanda → azul
→ cyan, que se leia pero rompia el contraste: medido contra los `--background`
reales, el cyan daba 2,11:1 sobre el tema claro y el azul 2,35:1 sobre el
oscuro. Cada uno desaparecia en un tema distinto.

La causa es que el contraste lo fija la **luminosidad**, no el tono, y mover el
tono lejos la arrastra. El rosa base sale bien en ambos temas (3,67 / 4,70) por
estar a media luminosidad. Congelada esa luminosidad, un barrido muestra que
entre 290° y 10° el contraste no se mueve; fuera de ahi se rompe. Los tres
narradores viven dentro de esa franja:

| pieza | giro | cuerpo | claro | oscuro |
|---|---|---|---|---|
| `doty-fem` | −27° | `#E30BE3` orquidea | 3,68:1 | 4,69:1 |
| `doty-scientist` | −49° | `#B432FF` violeta | 4,12:1 | 4,19:1 |
| `doty-sailor` | +23° | `#ED023B` carmin | 4,27:1 | 4,04:1 |

**El prefijo dirige la generacion, no solo nombra el archivo.** Es el hallazgo
util de esta seccion. Sergio escribio "Doty Sailor the **old** crimson
narrator" y esa palabra sola dio el cuerpo bajo y cuadrado que separa al
marinero — mas que el color. Midjourney construye primero una idea de *persona*
a partir del sustantivo y deriva el cuerpo de ahi, asi que un concepto de
persona ("old") funciona mejor que una instruccion geometrica ("stockier and
squarer"), que no tiene a nadie detras. Cada narrador lleva por eso en el
prefijo la palabra que le da su silueta: `old` (bajo y cuadrado), `slender`
(alto y estrecho), `poised` (erguido, bata que ensancha abajo).

Corolario operativo: si al generar cambias una palabra del prefijo, **ese
cambio va al catalogo**. El prefijo es la llave con que `match_downloads` mapea
la descarga de vuelta a la pieza, y ademas es parte del prompt: dejarlo
desincronizado pierde el mapeo y, en la siguiente regeneracion, la silueta.

### 3.11 Icono PWA (1) — `dots/imagenes/mj/fase-1/out/app-icon.png`

Primer plano de Doty `feliz` (cabeza y hombros), centrado, 1024 px. De este
único render salen por `compose-icons.mjs`: `icon-192/512` (purpose `any`, fondo transparente),
`icon-maskable-192/512` (fondo `THEME_COLORS.light`, Doty dentro del 80 %
central), `app/apple-icon.png` (180 px, fondo opaco porque iOS descarta el
alfa) y el favicon. **Como `/icons/icon-192.png` está en `PRECACHE_URLS`, el
mismo commit bumpea `SW_VERSION`** (regla 9 de CLAUDE.md).

### 3.12 Splash iOS y screenshots del manifest (0 generaciones)

- **Splash**: `appleWebApp.startupImage` en `app/layout.tsx` con un array
  `{ url, media }` para los tamaños de iPhone y iPad vigentes. Las imágenes se
  componen con sharp a partir del icono y el logo sobre `THEME_COLORS.light`,
  desde un script (`scripts/mj/compose-splash.mjs`). Nada de Midjourney.
- **Screenshots**: campo `screenshots` del manifest con 3 capturas `narrow`
  (Camino, Juegos, una lección) y 1 `wide` (Camino en desktop), tomadas del
  build de producción con la config `dots-webapp-prod` del launch.json una vez
  que el arte nuevo esté en su sitio. Cierra el pendiente anotado en el spec
  de la PWA.

## 4. Arquitectura de assets

### 4.1 Dónde vive cada cosa

| Qué | Dónde | Por qué |
|---|---|---|
| Sprites de Doty, chapas, stickers, tiles de juegos | repo, `public/images/...` | se versionan con el código que los referencia; el SW los cachea al primer uso; funcionan offline |
| Personajes de voz | Cloudinary + `characters.img` | la BD ya modela ese campo y el avatar ya lo lee |
| Tiles de niveles y palabras (fases 2–3) | Cloudinary + BD | contenido, no código; lo edita el admin |

### 4.2 Registro `components/ui/doty/poses.ts` (simplificado)

Toda pieza nace a 1024 px, así que el tier `hero` de la rama **desaparece**:
una sola ruta por pose y `next/image` sirve el tamaño que toque.

```ts
export type DotyGroup =
  | "expressions" | "poses" | "states" | "celebrations"
  | "accessories" | "themed" | "stickers" | "icons";

export type PoseEntry = { src: string; group: DotyGroup };

export const POSES = {
  feliz: { src: "/images/Doty/expressions/feliz.png", group: "expressions" },
  // ... 81 entradas, una por pieza de §3.1–3.8
} as const satisfies Record<string, PoseEntry>;

export type DotyPose = keyof typeof POSES;
export const FALLBACK_POSE: DotyPose = "feliz";
```

Sin claves numéricas. `scripts/mj/batches/fase-1.json` es la fuente de la que
se **genera** este archivo (`uv run scripts/mj/process.py --emit-registry`),
para que catálogo, prompts y registro no diverjan. Las piezas cuyo `group` no
es un `DotyGroup` (`games`, `characters`, `app-icon`) están en el lote pero
**no** entran al registro: tienen sus propios destinos (§3.9–3.11).

### 4.3 Componente `Doty`

- `pose: DotyPose`. Los strings dinámicos (BD, params) se aceptan con un cast
  interno y caen a `FALLBACK_POSE` si no existen, como en la rama.
- `size` conserva los siete valores actuales (32 → 352 px). Se añade el
  atributo `sizes` de `next/image` por tamaño para no servir 1024 px a un
  sprite de 32.
- `shadow?: boolean` (default `true`): aplica `filter: drop-shadow(0 6px 4px
  rgba(30,27,92,.18))` al `<Image>`. Funciona sobre cualquier fondo y tema.
- `animation` vuelve a funcionar: se portan los keyframes `doty-bob`,
  `doty-cheer`, `doty-sad`, `doty-wave` de la rama a `app/globals.css`. Solo
  `transform`/`opacity` (regla 2 de CLAUDE.md).
- `alt` pasa a `""` con `aria-hidden` cuando `say` está vacío: Doty es
  decorativo; el mensaje que lo acompaña ya está en el DOM.

### 4.4 Componente `DotySticker` (nuevo)

`<DotySticker kind="good-job">` compone la burbuja (CSS, colores de tema), la
frase en español desde una tabla interna y `<Doty pose="sticker-good-job"
size="mini" shadow={false}>`. Reemplaza los stickers con texto quemado de la
rama.

### 4.5 Migración de poses numéricas → semánticas

Tabla por defecto; en cada punto de uso se elige por contexto según la tabla
tono→pose de `doty-identity.md` (por ejemplo, un `"05"` en un diálogo de error
pasa a `oh-no`, no a `triste`).

| Legacy | Por defecto | Usos en main |
|---|---|---|
| 01 | saludando | difficulty beginner, varios |
| 02 | muy-feliz | 4 estáticos + personaje `doty` |
| 03 | sigue-asi | 1 |
| 04 | bailando | difficulty intermediate |
| 05 | triste / oh-no según contexto | 9 |
| 06 | wow | 1 |
| 07 | preocupado | 6 + personaje `doty-sailor` |
| 09 | decepcionado | 1 |
| 11 | riendo | 1 + personaje `doty-scientist` |
| 12 | idea | 2 |
| 13 | senalando | 2 |
| 14 | saludando (es el saludo sin anteojos) | 1 (dont-pop, Doty en la canasta) |
| 16 | bienvenido | — |
| 17 | saludando | 10 + difficulty advanced + personaje `doty-fem` |
| 18 | halloween | — |
| 08, 10, 15, 19–22 | sin uso; se borran | — |

Cambios de datos derivados (3 filas, vía script del backend §7):
`difficulty.img` → `bienvenido` (beginner), `sigue-asi` (intermediate),
`orgulloso` (advanced). `path-difficulty.tsx` cae a `bienvenido` si el valor
no está en el registro.

`lib/voice-characters.ts` pasa a poses semánticas (`doty` → `hablando`); los
otros tres personajes dejan de necesitar pose porque tendrán `img`.

`games-grid-view.tsx`: los 12 `Skin` pasan a `img`; se elimina la rama
`emoji` y el `FALLBACK` apunta a un tile genérico.

### 4.6 Borrado de los 22 legacy

Cuando `tsc` no reporte ningún literal fuera de `DotyPose`, se borran los
`DOTTY-POSES-*.png`. Un script `scripts/check-doty-assets.mjs` verifica que
cada `src` del registro existe en disco y que no queda ningún PNG huérfano en
`public/images/Doty/`; se encadena a `npm run lint`.

## 5. Pipeline local `scripts/mj/`

Un solo runtime, Python con **uv** (ya instalado), porque rembg es Python y
así no se mezclan dos toolchains. El script lleva metadatos inline (PEP 723)
para que `uv run scripts/mj/process.py` resuelva dependencias solo:
`rembg[gpu]` y `pillow`. Si CUDA no está disponible, rembg cae a CPU sin
cambios.

### 5.1 Archivos

| Archivo | Rol |
|---|---|
| `scripts/mj/style.json` | parámetros congelados en fase 0 |
| `scripts/mj/batches/fase-1.json` | catálogo: `{ slug, group, prefix, prompt, out, size }` por pieza |
| `scripts/mj/process.py` | el pipeline (subcomandos abajo) |
| `scripts/mj/compose-icons.mjs`, `compose-splash.mjs` | derivados del icono y splash con sharp (Node, porque sharp ya está en `node_modules`) |
| `scripts/check-doty-assets.mjs` | verificación registro ↔ disco |

### 5.1-bis Formato de prompt tras la fase 0

Hay **dos formas** de pieza, según si es la mascota o no. El campo que decide
se llama `mascot` (antes `oref`, renombrado porque `--oref` ya no se usa).

**Piezas de mascota (`mascot: true`) — instrucción de Edit.** Se pega junto a
`ref-patron.png` adjunta como fuente. Sin flags: el Edit Model no los toma.

```
<prefix>, <prompt>, <brand_lock>, <framing>
```

Por ejemplo, para `feliz`:

> Doty beaming with joy, standing upright, arms slightly open, big happy smile,
> keep the dark navy outline, the navy eyes with white highlights and the
> hot-pink body, full body centered, plain white background, no shadow on the
> floor

El `prefix` sigue abriendo la instrucción por la misma razón de siempre:
Midjourney nombra la descarga con las primeras palabras, y de ahí sale el mapeo
de vuelta a la pieza. La regla de colisión de prefijos sigue vigente.

**Piezas que no son la mascota (`mascot: false`) — texto a imagen, sin cambios.**
Son los 6 `icons` y los 12 `games`: iconos planos donde una fuente con Doty no
tiene sentido. Conservan el formato con `--ar`, `--stylize` y `--no`.

`style.json` cambia en consecuencia: `oref_file`, `ow`, `sw` y `sref` quedan
obsoletos; entran `edit_source`, `brand_lock` y `framing`. Los bloques
`icon_block`, `negative`, `aspect` y `stylize` siguen sirviendo a la segunda
forma.

### 5.2 Subcomandos de `process.py`

- `--emit-prompts fase-1` → `dots/imagenes/mj/fase-1/PROMPTS.md`: lista
  numerada, un prompt por línea listo para pegar, con el bloque de estilo de
  `style.json` ya incorporado. Es lo único que Sergio necesita abrir.
- `--emit-registry fase-1` → escribe `components/ui/doty/poses.ts`.
- `--dry-run fase-1 --raw dots/imagenes/mj/fase-1` → lista qué archivo
  descargado corresponde a qué slug (por `prefix`), cuáles tienen varios
  candidatos y cuáles faltan. No escribe nada.
- `--apply fase-1 --raw ...` → por cada pieza con un único candidato (o
  `--pick <slug>=<archivo>` para desambiguar):
  1. rembg con modelo `isnet-general-use` y alpha matting activado (bordes
     suaves sobre el rosa).
  2. Recorte al bounding box del alfa con margen del 4 %.
  3. Lienzo cuadrado, contenido centrado, redimensión a `size` (1024 por
     defecto; 512 para `icons/` y tiles).
  4. PNG optimizado en `out`. Idempotente: no reescribe si existe salvo
     `--force`.
  5. Informe `dots/imagenes/mj/fase-1/REPORT.md`: piezas hechas, faltantes,
     ambiguas, procesamiento fallido (excepción en una pieza), duplicados (mismo
     archivo asignado a dos piezas), y **alerta de halo** cuando la banda
     semitransparente rosa alrededor del sujeto mide más de 2 px de grosor
     (píxeles semitransparentes rosados / largo del contorno), medido sobre la
     salida de rembg antes de redimensionar. Un sprite limpio mide ~1.4 px en
     cualquier silueta y resolución. Es un canario, no una garantía: solo ve
     fleco rosado saturado, así que uno difuminado a blanco o gris — el que de
     verdad se nota en el tema oscuro de la app — no dispara la alerta.

### 5.3 Reglas

- Las descargas se dejan **tal cual** en `dots/imagenes/mj/<fase>/`. Rechazar
  una imagen es borrar su archivo; el script no decide estética.
- Nunca se sube a Cloudinary desde `process.py`: eso es del backend (§7).
- El script solo escribe en `public/images/Doty/`, `public/images/games/` y
  `dots/imagenes/mj/<fase>/out/` (personajes de voz y fuente del icono, que no
  se sirven desde la webapp). `public/icons/` y `app/apple-icon.png` los
  escribe `compose-icons.mjs`.

## 6. Flujo de trabajo humano

1. Claude corre `--emit-lote GRUPO [GRUPO...]` (uno o varios grupos por tanda,
   según lo que la GPU del día aguante) y genera `LOTE-<grupo>[+<grupo>...].md`:
   el prompt de cada pieza más la instrucción de adjunto que le toca. Piezas de
   mascota → `ref-patron.png` en **"Attach to prompt"**, siempre la misma
   fuente, nunca encadenada. Piezas no-mascota (`icons`/`games`) → nada
   adjunto, salvo la pieza `anchor` de cada grupo, que se genera primero y cuyo
   mejor resultado va al **Style reference** del resto del grupo (§2-bis,
   §5.1-bis; `validate_catalog` exige exactamente un ancla por grupo no-mascota).
2. Sergio pega cada prompt en Midjourney (con el adjunto que toque), mejora a
   resolución completa el acierto y lo descarga a la carpeta de la fase sin
   renombrar. Borra lo que no sirve.
3. Claude corre `--dry-run`, resuelve con Sergio las piezas ambiguas o
   faltantes vía `--pick slug=archivo`, corre `--apply` y revisa `REPORT.md`.
4. Las piezas con halo o dudosas vuelven al paso 2 en el siguiente lote.
5. Al cerrar un grupo completo, Claude corre `--emit-registry`, migra sus
   puntos de uso (§4.5), pasa lint + build y verifica en preview.

Midjourney publica las generaciones en su galería pública en el plan Basic
(el modo stealth es de Pro en adelante). Se acepta: la mascota ya es pública en
la app.

## 7. Backend — `scripts/set-doty-art.js`

Mismo patrón que `migrate-media-to-cloudinary.js`: dry-run por defecto,
`--apply`, `--rollback <backup.json>`, lee `DB_*` y `CLOUDINARY_*` del `.env`.

- Sube `dots/imagenes/mj/fase-1/out/characters/{doty-fem,doty-sailor,doty-scientist}.png`
  a `dots/images/characters/<key>` (public_id determinista, sobrescribible).
- `UPDATE dots.characters SET img = <url> WHERE key = ...` (3 filas).
- `UPDATE dots.difficulty SET img = <slug>` según §4.5 (3 filas).
- Respaldo previo de las 6 filas en `scripts/out/backup-doty-art-<ts>.json`.

Es el único contacto con la BD de producción de todo el proyecto.

## 8. Documentación

- `docs/brand/doty-identity.md` se porta y reescribe: canon sin anteojos,
  paleta, los tres personajes, tabla tono→pose actualizada, y "cómo pedir una
  pose nueva" (añadir al JSON del lote, emitir prompt, procesar, regenerar
  registro).
- `docs/ARQUITECTURA.md`: referencia al registro y al pipeline.
- `CLAUDE.md`: una regla nueva y corta: Doty solo se renderiza con poses del
  registro; las piezas nuevas entran por `scripts/mj/`, nunca a mano en
  `public/images/Doty/`.
- Memoria: actualizar `doty-brand-redesign.md` (la rama queda obsoleta una
  vez portado lo útil) y `factibilidad-pwa-vs-rn.md` (el bug del prop
  `animation` queda cerrado).

## 9. Presupuesto y ritmo (a confirmar con lo medido en fase 0)

| Escenario | Trabajos | GPU | Meses de Basic |
|---|---|---|---|
| Fase 0 | ~16 estándar | ~15 min | — |
| Fase 1 con Draft (2 draft + 1 mejora por pieza) | 97 × 3 | ~2,6 h | 1 |
| Fase 1 sin Draft (4 estándar por pieza) | ~390 | ~5,2 h | 1,6, o +8 USD en horas extra |

### Lo que costó de verdad (cerrado el 2026-09-10)

La estimación de arriba partía de V7 + Omni Reference, a 2 min por trabajo. La
fase 0 encontró que V8.2 + Edit Model cuesta **1 min** y acierta las cuatro
candidatas en vez de una de ocho (§2-bis), así que el presupuesto se partió por
la mitad antes de empezar y la pregunta de `draft_supports_oref` quedó sin
sentido: no hizo falta el modo Draft.

Con eso, las 97 piezas de la fase 1 entraron en el plan Basic de 10 USD sin
comprar horas extra. Sergio subió a Standard **al final**, no por presupuesto:
lo hizo para poder regenerar sin contar minutos las piezas que el barrido de
contraste marcó como flojas (nueve, todas por pedir navy de relleno) y para las
nueve tandas que costó cerrar `doty-fem`. Con relax ilimitado, regenerar dejó de
ser una decisión económica — que es la diferencia real entre los dos planes para
un proyecto como este.

## 10. Fuera de alcance (y dónde queda anotado)

- **Escenarios (8)** y **cosméticos de tienda (7)**: decisión de Sergio; los
  cosméticos se retoman con la visión Rive de la memoria
  `factibilidad-pwa-vs-rn.md`.
- **Fase 2** (tiles de niveles) y **fase 3** (palabras concretas + verbos):
  specs propias; la 3 exige un mes de Standard.
- **Ejercicios sin imagen para días, meses, hora y artículos**: cambio de
  diseño de contenido y de tipos de ejercicio en backend + webapp. Spec
  propia de contenido, pendiente. Hasta entonces esas palabras conservan su
  imagen stock actual.
- **Iconos de nav e insignias**: set vectorial teñido con la paleta, no
  Midjourney. Tarea pequeña aparte.
- **Rig de Rive**: los PNG de este spec son el tier raster de la PWA y el
  fallback que la decisión del 2026-08-12 ya contemplaba. No lo sustituyen.

## 11. Riesgos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| Doty deriva entre poses (número de picos, forma de ojos, zapatos) | `--oref` con `--ow` alto, criterios de §2.3 aplicados sin piedad, regenerar antes que retocar; el `--sref` pasa a código propio en cuanto hay aciertos |
| Draft no acepta `--oref` | medido en fase 0; presupuesto alternativo en §9 |
| Halo rosa en bordes tras rembg | fondo blanco liso en el prompt, alpha matting, alerta automática en `REPORT.md` |
| El mapeo por nombre de archivo falla | `prefix` único por pieza, `--dry-run` obligatorio antes de `--apply`, `--pick` manual |
| Un string dinámico pide una pose inexistente | fallback a `feliz` en el componente; `check-doty-assets` en lint |
| Cambiar `icon-192.png` sin bumpear el SW deja el icono viejo para siempre | está en el mismo commit por diseño (§3.11) y en los criterios de §12 |
| Los términos de Midjourney sobre automatización | no se automatiza la web; solo se procesan descargas |

## 12. Criterios de aceptación de la fase 1

1. `npm run lint` (incluye `check-doty-assets`) y `npx next build` pasan.
2. `poses.ts` no tiene claves numéricas y `public/images/Doty/` no tiene
   `DOTTY-POSES-*`.
3. `grep -r 'pose="[0-9]' app components hooks lib` devuelve vacío.
4. `SW_VERSION` bumpeado en el commit que cambia `public/icons/`.
5. `characters.img` con URL en las 3 filas y `difficulty.img` con slugs
   semánticos; respaldo JSON presente en `dots-backend/scripts/out/`.
6. Preview en claro y oscuro de: onboarding (bienvenida), Camino (marcador y
   dificultades), resultado de lección, intro y resultado de un juego, grid
   de Juegos, avatar de voz en una lección con `doty-fem`.
7. Lighthouse PWA sin advertencias de iconos; splash visible en un iPhone
   real o en el simulador de Safari.
