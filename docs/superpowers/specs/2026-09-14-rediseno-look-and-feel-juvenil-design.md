# Rediseño look & feel juvenil — spec maestra

- **Fecha**: 2026-09-14
- **Estado**: diseño aprobado por Sergio en dos rondas (grilling de 28 preguntas y ronda visual con
  mockups). Pendiente su revisión de este documento antes de escribir el primer plan.
- **Alcance**: la cara de usuario de la webapp. Admin intacto. Seis subproyectos (A–F), cada uno
  con su plan de implementación y su rama desde `main`, desplegable por separado y **sin push a
  origin** hasta que Sergio revise.
- **Predecesoras**: `2026-07-20-rediseno-total-design.md` (tabs, economía, HUD),
  `2026-09-07-doty-midjourney-assets-design.md` (canon y pipeline de arte),
  `2026-09-11-tiles-de-niveles-design.md` (los 38 tiles que ahora se ven grandes),
  `2026-09-13-iconografia-propia-design.md` (cero emoji como icono).
- **Mockups**: `.superpowers/brainstorm/67669-1789410244/content/` (gitignored, evidencia del
  diseño, no fuente de verdad): `nodo-camino-v4.html`, `banner-dificultad-v4.html`,
  `banner-scroll-v2.html`, `play-arcade-v2.html`, `perfil.html`, `tema-electrico-v2.html`,
  `avatares-v2.html`, `primer-inicio-v4.html`.

## 0. El pedido y lo que se midió

Sergio pidió una cara más juvenil e irreverente, nunca vulgar, con Doty expresivo al estilo
Duolingo, la imagen del nivel como protagonista del Camino, un Camino paginado por dificultad,
/play sin cards, perfil compacto, un tema sin rosa y un primer inicio guiado con elección de tema y
avatar. El código confirmó cada observación:

| Observación | Medido en el código |
|---|---|
| La imagen del nivel se ve pequeña | Nodo 122 px, disco 100, anillo 6 px pegado, imagen recortada a 68 px (56 % del nodo). `WordImg size="medium"` emite `w-[80px]` dinámico que Tailwind no compila. |
| El Doty del banner sobra en su caja | Sprite `mini` de 80 px en caja de 64 con `overflow-hidden`: recortado por los cuatro lados. |
| La barra de progreso no se entiende | Sección: 4 px al 65 % de opacidad con etiqueta de 9 px. Dificultad: % arriba y "n / m lecciones" en 10 px abajo. |
| Una dificultad a la vez | `PathDifficulty.current` y `PathSection.current` llegan de la API y la UI no los usa. Todo llega en un `GET /path`. |
| Iconos de juego chicos | 28–36 px dentro de tiles de 92–116 px; el arte existe a 512 px. |
| Perfil con aire a los lados | `max-w-5xl` con una tarjeta que centra 128 px de contenido. |

## 1. Principios transversales

1. **Público: todo público.** Nunca vulgar ni irrespetuoso.
2. **Voz de Doty**: hype exagerado al celebrar, drama sobre sí mismo, y picardía suave **solo por
   inactividad** ("te extrañé… 👀"). **Nunca se burla de un error del usuario**: el canon "motiva
   y celebra, nunca regaña" sigue mandando. Jerga de internet latina neutra (aura, cocinado, GOAT,
   modo bestia, épico), sin chilenismos. Doty habla español; usa inglés solo cuando la frase es un
   modismo real y enseñable, con traducción en chico ("You're on fire! = estás en racha").
3. **El arte dibuja arquetipos, el copy pone la moda.** Un PNG cuesta una sesión de Midjourney; una
   frase, un commit. Las referencias a franquicias se describen sin nombrarlas.
4. **Sin contenedores para el contenido.** Nodos, tiles de juego y la identidad del perfil flotan
   sobre el fondo. El panel teñido (fondo suave del color, radio 28, sin borde) se reserva para
   **cabeceras**: banner de dificultad y sub-banner de sección.
5. **Doty siempre es rosa.** El tema vive en el chrome (HUD, botones, fondos), no en el contenido.
6. **Reglas duras vigentes**: RN-safe (regla 2), compiler de React (regla 3), `?seed=` (7), sin
   emoji como icono (11), Doty solo por registro (10), navegación con `router.push` (1). La
   excepción legacy de la regla 1 en la grilla de juegos **se elimina** en el subproyecto C.
7. **Cada script sobre la BD compartida** sigue el patrón del backend: dry-run por defecto,
   `--apply` explícito, respaldo en `scripts/out/`, `--rollback`, y aprobación explícita de Sergio
   antes de aplicar. Los PNG se despliegan **antes** de escribir rutas en la BD (lección del
   2026-09-10).

## 2. Subproyecto A — Fundamentos

Desbloquea a los demás. Sin él, B–F repintarían colores dos veces.

### 2.1 Sistema de temas: paleta × modo

- `<html>` lleva dos atributos: `data-palette="rosa" | "electrico"` y `data-theme="light" | "dark"`.
  **Modo Auto = sin `data-theme`**: el bloque `@media (prefers-color-scheme: dark)` ya existente
  resuelve el oscuro, como hoy con la fallback pre-JS.
- **Fuente única generada.** `design/themes.json` describe las cuatro combinaciones. Un script
  `scripts/themes/build.mjs` emite `app/themes.generated.css` (bloques
  `:root[data-palette="…"]`, `:root[data-palette="…"][data-theme="dark"]` y la fallback de media
  query) y `lib/theme-colors.ts` (el `theme-color` del manifest y del `<meta>` por combinación).
  Reemplaza los tres bloques que hoy se sincronizan a mano en `globals.css` y la duplicación de
  `--background` en TS. Mismo espíritu que `poses.ts`: generado, no editado a mano; `npm run lint`
  falla si el CSS generado no coincide con el JSON.
- **Tokens que cambian por paleta**: `--background`, `--surface`, `--surface-2`, `--border`,
  `--dot`, `--muted`, `--accent` (+ `-soft`, `-edge`, `-contrast`), `--primary` (+ `-edge`,
  `-contrast`), `--input-bg`, `--scrim`, `--shadow-card`. **No cambian**: `--gem`, `--flame`,
  `--gold`, `--success`, `--danger`, `--sky-*`, la paleta de nueve
  colores de sección (`lib/difficulty-palette.ts`).
- **Eléctrico, dirección aprobada** (afinar con contraste medido: texto ≥ 4.5:1, UI ≥ 3:1, en
  ambos modos, con el validador de `check-icons`/OKLCH antes de fijar):

| Token | Eléctrico claro | Eléctrico oscuro |
|---|---|---|
| `--background` | `#f4f7ff` | `#0d1330` |
| `--surface` / `--surface-2` | `#ffffff` / `#e9efff` | `#172046` / `#121a3d` |
| `--border` = `--dot` | `#d3ddff` | `#2a386b` |
| `--foreground` / `--muted` | `#201a4d` / `#5f6a8e` | `#eef2ff` / `#a9b6e6` |
| `--accent` / `--accent-edge` | `#3768FF` / `#2447c9` | `#5c86ff` / `#2b55d6` |
| `--primary` | navy (sin cambio) | `#35d8f5` (cyan: el degradado de XP queda cyan → azul) |

- **Nombres en la UI**: "Rosa" y "Eléctrico". Por estilo, nunca por género.
- **Persistencia**: la preferencia vive en el servidor (2.4) y `localStorage` (`dots-theme`,
  `dots-palette`) es el espejo anti-parpadeo que lee el script inline de `app/layout.tsx`.
  Mientras solo el toggle escribe en el servidor (y solo el modo), `ThemeSync` completa desde
  `/me/settings` únicamente los dispositivos sin espejo y nunca pisa una elección local; cuando
  la hoja de ajustes (D) escriba paleta y modo, el servidor pasa a ser autoritativo y el espejo
  se reescribe al diferir. En modo Auto, `ThemeSync` sigue los cambios de tema del SO.
- El componente `theme-toggle.tsx` (binario, en inglés) desaparece: sus controles pasan a la hoja
  de ajustes del perfil (subproyecto D). Mientras tanto, sus etiquetas se traducen.

### 2.2 Guía de voz de Doty

Nueva sección **"Humor e irreverencia"** en `docs/brand/doty-identity.md`, con:

- las cinco reglas del principio 2, escritas como "sí / no" con ejemplo;
- una tabla momento → frase aprobada, que es la fuente del copy de B–F (ver 7.3 y las líneas de
  ánimo de 3.2);
- la lista de lo prohibido: burla del error, vulgaridad, regionalismos, franquicias por nombre en
  prompts de arte, texto dentro del PNG.

### 2.3 Catálogo de arte: fase 4

`scripts/mj/batches/fase-4.json`, mismo esquema que fases anteriores, más un grupo nuevo.

| Grupo | Piezas | Destino | Notas |
|---|---|---|---|
| `expressions` (registro) | 14 | `public/images/Doty/expressions/` | `en-llamas`, `aura`, `cocinado`, `llanto-dramatico`, `cerebro-galaxia`, `reojo`, `mente-volada`, `lentes-deal`, `gamer`, `chismoso`, `facepalm`, `flexeando`, `meditando`, `bostezo`. `mascot: true`, 1024 px. El aura de `en-llamas` **toca la silueta** (nada flotante: `rembg` lo borra). |
| `poses` (registro) | 3 | `public/images/Doty/poses/` | Narradores de dificultad con actitud: `narrador-beginner`, `narrador-intermediate`, `narrador-advanced`. Reemplazan `bienvenido` / `sigue-asi` / `orgulloso` en `difficulty.img` vía `set-doty-art.js`, **después** de desplegar los PNG. |
| `avatars` (grupo EXTRA nuevo) | 6 gratis + 16 de pago + 3 personajes | `public/images/avatars/<slug>.png` | 512 px, `mascot: true`, override `framing: "head and shoulders only, centered with margin, plain white background, no shadow"` (el mismo mecanismo de `app-icon`). Varía expresión + **un** accesorio grande; el color del disco no va en el PNG. Los tres personajes (`fem`, `marinero`, `cientifica`) se generan como retrato desde su arte de `$RAW/fase-1/out/characters/`. |

- Cambios de pipeline: `EXTRA_GROUPS += avatars` y rama en `_relative_output` (`mjlib.py`), test
  de catálogo `tests/test_catalogo_fase4.py` (unicidad de slugs y prefijos, `framing` obligatorio
  en `avatars`, navy nunca como masa). `check-doty-assets --strict` no cambia: solo barre
  `public/images/Doty/`.
- **Tandas**: 1 = las 4 expresiones diarias (`en-llamas`, `gamer`, `reojo`, `llanto-dramatico`) +
  3 narradores + 6 avatares gratis (13 piezas); 2 = 10 expresiones restantes + 3 personajes;
  3 = **19** avatares de pago (el catálogo `scripts/mj/batches/fase-4.json` tiene 25 avatares y 6 hechos; la cifra de 16 que decía aquí nunca cuadró con §6.2, que ya decía 19). Sergio genera en Midjourney a partir de `--emit-lote`; el código de B–F
  no espera al arte: cada punto de cableado tiene un fallback del registro actual.

| Pieza | Dónde se cablea | Fallback hasta que llegue |
|---|---|---|
| `en-llamas` | racha de práctica (`practice-container.tsx:125`) | `emocionado` |
| `gamer` | cabecera de /play | `en-celular` |
| `reojo` | entrada tras 3+ días sin practicar (`DotyEntrada`) | `saludando` |
| `llanto-dramatico` | primera carga tras perder la racha | `triste` |
| `aura` | nuevo récord o trono (`GameResult`) | `trofeo-celebracion` |
| `cocinado` | tiempo agotado en juegos con reloj | `oh-no` |
| `cerebro-galaxia` | maestría al 100 % (popover de nodo) | `orgulloso` |
| `mente-volada` | nivel desbloqueado (celebración de lección) | `wow` |
| `lentes-deal` | checkpoint aprobado | `lo-lograste` |
| `chismoso` | sin cablear — el aviso de rival (§6.5) usa `flexeando` y el gesto del rival, no `chismoso` | `senalando` |
| `facepalm` | errores de carga | `oh-no` |
| `flexeando` | boost de XP activo (HUD) | `pulgar-arriba` |
| `meditando` | repaso al día (`/review`) | `excelente` |
| `bostezo` | entrada tras 7+ días | `cansado` |

### 2.4 Backend de fundamentos

- `users.settings jsonb NOT NULL DEFAULT '{}'` con claves `palette`, `mode` (`light|dark|auto`),
  `sound` (bool), `avatar_key`, `onboarded_at`, `tips_seen` (string[]). Migración
  `scripts/migrate-settings.js` con el patrón obligatorio.
- `GET /me/settings` y `PATCH /me/settings` (merge parcial, validación con lista blanca de claves y
  valores). Sin `PATCH` genérico de usuario.
- `GET /me/stats` suma `streakSecuredToday: boolean` (= `last_streak_day` igual a hoy en Santiago).
- El login no cambia: el primer inicio se decide en el cliente con `settings.onboarded_at == null`.

### 2.5 Deuda que A salda

- Etiquetas del toggle en inglés → español.
- `components/interactive-column/streak/streak.tsx` deja `localStorage["streak"]`, el ámbar
  hardcodeado y el "day streak!": lee `MyStats.streak` y usa tokens.
- La fórmula de nivel/XP duplicada (`app-header.tsx`, `xp-level.tsx`) pasa a `lib/level-math.ts`.

### 2.6 Criterios de aceptación A

1. Las cuatro combinaciones paleta × modo se ven en todas las rutas de usuario (hub e inmersivas)
   sin texto por debajo de 4.5:1 ni UI por debajo de 3:1 (medido, no estimado).
2. `themes.generated.css` y `theme-colors.ts` salen del JSON; editar el CSS a mano rompe el lint.
3. `fase-4.json` pasa sus tests y `--emit-lote expressions poses avatars --pendientes` produce la
   hoja de la tanda 1.
4. `PATCH /me/settings` rechaza claves desconocidas y valores fuera de lista; los tests del backend
   cubren merge parcial y `tips_seen` acumulativo.
5. `npm run lint`, `npx next build` y los tests del backend pasan.

## 3. Subproyecto B — Camino v3

### 3.1 Nodo "sin contenedor" (variante D)

- La ilustración del nivel flota sobre el fondo: `next/image` de **128 px** (caja de 136) con
  `object-contain` y sombra de piso (`drop-shadow`), sin disco, borde ni anillo. Se deja de usar
  `WordImg` para el nodo.
- Debajo, **barra de progreso** de 100 × 8 px del color de la sección (relleno = `progress`), y
  la etiqueta de 13 px. Completado: barra llena en `--success`, arte al 88 %, badge check.
  Bloqueado: `grayscale(1)` + opacidad 0.30 + candado centrado, barra oculta. Actual: `drop-shadow`
  de resplandor del color de la sección + estrella + marcador de Doty.
- Badges como hoy (tipo abajo-izquierda, estrella arriba-derecha, check abajo-derecha, corona de
  maestría), apoyados sobre el arte.
- **Checkpoint**: trofeo (`UiIcon trofeo`) de 118 px con resplandor `--gold`, etiqueta dorada; sin
  caja.
- Geometría de la pista: ancho máximo **640 px** (era 520), `NODE_W` 150, fila = 128 + 8 + 8 + 30
  ≈ 180 px + solapamiento actual. Zigzag 15/50/85 %, conectores, `DotyMarker` y `PathPeer` se
  mantienen; el marcador y los vecinos siguen anclados al wrapper de 150 px. Nodos de lectura:
  mismo tile, icono `lectura` en el badge de tipo.
- Anima solo `transform`/`opacity` (pop-in, float, wiggle como hoy).

### 3.2 Banner de dificultad (composición A) y cómo viaja contigo

- **Banner**: panel teñido `color-mix(acento de dificultad 14 %, surface)`, radio 28, sin borde,
  padding 18/20; la cabecera (kicker, título y línea de ánimo) deja 134 px libres a la derecha para
  el narrador y mide al menos 104 px; la barra segmentada, el conteo y las flechas van a ancho
  completo por debajo del narrador (que termina a 120 px del borde superior); Doty narrador de
  **158 px** asomando por la esquina superior derecha (`top:-38px; right:-6px`, sin recorte).
  Contenido: kicker "Dificultad 1 de 3", título Baloo 800,
  línea de ánimo (tabla de voz), **barra segmentada** (un segmento por sección, relleno =
  `section.progress`, completadas en `--success`), y "**12** de 30 lecciones · 40 %" con el número
  en el color de la dificultad. El conteo excluye checkpoints, como hoy.
- **Una dificultad a la vez** (`?d=<id>` dentro de `<Suspense>`; por defecto la que trae
  `current: true`, o la que contiene el nodo `current`).
- **Cabecera plegada** (solución 1): un `IntersectionObserver` sobre el banner alterna una barra
  pegajosa bajo el HUD con el mismo tinte: flecha anterior, Doty a 44 px, nombre + "12 de 30
  lecciones", barra segmentada mini de 88 px, flecha siguiente. Las flechas cambian de dificultad;
  la anterior se atenúa en la primera y la siguiente queda deshabilitada si la próxima está
  bloqueada.
- **Sub-banner por sección** (solución 2): panel teñido del color de la sección, radio 22, con
  kicker "Sección 3 de 4", nombre de la sección (si el nombre es genérico, se muestra igual: la
  autoría de nombres amigables es de contenido, fuera de alcance), barra de 8 px, "2 de 8
  lecciones", y un Doty de 104 px elegido de un pool de poses existentes de forma determinista
  por `section.id`.
- **Escritorio** (solución 3, `md+`): grid de 300 px + pista; el banner completo va en la columna
  izquierda con `position: sticky` y el botón "Volver a mi nivel" dentro.
- **Botón flotante "Volver a mi nivel"**: pill `--accent` con Doty corriendo, visible cuando el
  nodo `current` no está en el viewport o cuando la dificultad mostrada no es la actual; al tocar,
  cambia de dificultad si hace falta y hace `scrollIntoView` centrado. En escritorio vive dentro
  del panel.
- **Secciones futuras**: nodos visibles en gris; antes de la primera sección no alcanzada, un
  separador de niebla (degradado a `--background`) con la pastilla "Próximamente · Sección N".
- **Dificultades bloqueadas**: al final, banners punteados con Doty en gris y "Termina Beginner
  para desbloquear · toca para ver qué viene"; tocarlo muestra la dificultad en modo vista previa
  (todo en gris, sin popovers).
- Líneas de ánimo por umbral con la voz nueva (ejemplos: 0 % "Todo el mundo empezó aquí. Hasta
  Doty."; < 40 % "Vas con todo. Ni una lección te frena."; 100 % "Nivel dominado. +1000 de aura.").

### 3.3 HUD sin marcos

- Racha: llama + número, sin pastilla; **encendida** si `streakSecuredToday`, si no
  `grayscale(1)` + opacidad 0.45 y número en `--muted`. Gemas: icono + número. Nivel: icono XP +
  "Nv 4" + barra de 8 px con el degradado `--primary → --accent`.
- La fórmula de nivel sale de `lib/level-math.ts` (2.5).

### 3.4 Criterios de aceptación B

1. En un teléfono de 390 px el arte del nodo mide 128 px y ningún texto se recorta; los vecinos y
   el marcador no se solapan con nodos ni entre sí en las tres posiciones del zigzag.
2. Al scrollear 600 px el banner se pliega y la cabecera muestra la misma barra segmentada; las
   flechas navegan entre dificultades desbloqueadas y `?d=` sobrevive a recargar.
3. El botón flotante aparece exactamente cuando el nodo actual sale del viewport y desaparece al
   volver; un tap lo centra.
4. Con la racha asegurada hoy la llama está encendida; sin práctica hoy, apagada.
5. Las animaciones usan solo `transform`/`opacity`; `prefers-reduced-motion` conserva el feedback.

## 4. Subproyecto C — /play v2, "Arcade"

- Título **"Arcade"**, subtítulo **"XP sin sufrir."**, Doty `gamer` (fallback `en-celular`) de
  104 px a la derecha de la cabecera, visible también en móvil.
- **Tiles flotantes (variante B)**: arte del juego a 82 px con sombra de piso, sin mancha, sin
  caja; nombre debajo (12.5 px, 800); tres por fila en móvil, cinco en `md`, seis en `lg`.
- **Héroes diarios** (Wordle, Crucigrama): arte de 96 px centrado, eyebrow "Nuevo cada día" en
  `--accent`, nombre Baloo y estado, en tres casos: "Hecho por hoy" con check verde si lo
  resolvió; "Vuelve mañana" si agotó los intentos sin resolverlo (el spec original no contemplaba
  este caso, y "Sin resolver" invitaría a algo imposible hasta mañana); y "Sin resolver · hasta
  +40 XP" si sigue abierto. **"hasta"**: el backend da `XP_PER_GAME_PLAY` = 15 por partida y
  `XP_NEW_HIGH_SCORE_BONUS` = 25 más solo si el score supera el récord personal, así que 40 es el
  máximo y no lo que se lleva cada partida.
- **Badges** de 28 px sobre el arte, arriba a la derecha: solo trofeo si el juego es el del
  torneo de la semana. El badge de trono se retiró a petición del dueño del producto por el
  aspecto del icono; la información del trono se sigue mostrando en la pantalla de inicio de
  cada juego (`GameIntro`, vía `useGameRecords`). La medalla de "récord reciente" **queda fuera**
  hasta que `/games/records` exponga la fecha del récord.
- "Por desbloquear": arte en gris al 35 % con candado y "faltan N niveles", no tocable.
- Navegación con `router.push('/games' + path)`: se elimina `window.location.assign` y la
  excepción legacy del CLAUDE.md. El skeleton replica exactamente la retícula real (hoy salta).
- Criterios: doce juegos en una pantalla y media a 390 px; entrar a un juego no recarga la app ni
  pierde el token; el badge de trofeo coincide con el juego del torneo de la semana.

## 5. Subproyecto D — Perfil compacto (variante A) y hoja de ajustes

- **Identidad horizontal**: avatar de 78 px (96 en escritorio) con lápiz para cambiarlo, nombre
  Baloo 24, chips "B1 · Intermedio" (MCER calculado como hoy) y racha con llama; engranaje a la
  derecha. Barra "Nivel 4 · 620 / 900 XP".
- **Stats** como fila de cuatro números sin cajas: XP total, mejor racha, insignias, gemas.
- **Insignias**: tile dorado suave de 58 px; bloqueadas en gris con "n / m". **Gesto de tu Doty**:
  tres tarjetas con el gesto equipado marcado, enlace a la tienda. Su escenario es el dorso del
  avatar (§6.4).
- **Escritorio**: dos columnas (identidad + XP + stats + ajustes | insignias a seis por fila +
  gestos) dentro de `max-w-5xl`.
- **Hoja de ajustes** (bottom sheet en móvil, hoja lateral en escritorio): Tema (Rosa / Eléctrico
  con muestra de color y la nota "Doty siempre es rosa, el resto cambia"), Modo (Claro / Oscuro /
  Auto), Sonidos ("Aciertos, fallos y celebraciones", gate en `lib/feedback-sounds.ts`), Cambiar
  avatar, Panel de admin (solo `profile === 1`), Cerrar sesión. Cada control escribe
  `PATCH /me/settings` y el espejo local.
- La foto `profile_pic` deja de mostrarse: el avatar Doty es la cara siempre (la columna se
  conserva).
- Criterios: en 390 px identidad y stats caben sobre el pliegue; cambiar tema desde la hoja
  repinta sin recargar y sobrevive a cerrar sesión y volver en otro dispositivo.
- **Tres desviaciones decididas durante la implementación (2026-09-15):** (1) la hoja NO
  lleva la fila "Cambiar avatar" y el avatar no lleva lápiz, porque los avatares son el
  subproyecto E y §8 lo pone después de D: un control que no hace nada es peor que
  ninguno; (2) el perfil deja de mostrar gorros y fondos y conserva solo los gestos, tal
  como describe la viñeta de arriba, mientras su retirada con reembolso sigue siendo §6.2
  del subproyecto E; (3) el emoji de cada insignia se queda, porque viene del backend
  (`Badge.emoji`) y sustituirlo exige arte que §9 deja fuera de alcance.

## 6. Subproyecto E — Avatares y tienda

### 6.1 Modelo

- Los avatares son `shop_items` con `kind = 'avatar'`, `slot = 'avatar'`, `img =
  '/images/avatars/<slug>.png'` y `meta = { color: '#35d8f5', label: 'Nerd' }`. El set gratis
  tiene `price = 0` y `position` bajo; los de pago van de 300 a 1500 gemas; los tres personajes
  entran como premium. `kind` y `slot` son `varchar` libres: **sin migración de esquema**.
- Los DTOs de `/shop` y `/shop/inventory` exponen `img` y `meta` (hoy `img` no viaja).
- **`POST /me/avatar { key }`**: si el ítem es `avatar` y (es gratis o ya está en `user_items`),
  lo concede si hace falta y lo equipa en una transacción; devuelve el avatar equipado. Es lo que
  usa el primer inicio y el perfil. La compra de avatares de pago sigue por `/shop/buy` y luego
  `POST /me/avatar`.
- **Cara pública**: `LeaderboardEntryDto`, `PathPeer` (`/path/neighbors`) y `RivalNeighborDto`
  suman `avatar: { img, color } | null`; `GET /me/settings` incluye el equipado. Sin avatar
  equipado, el cliente muestra `clasico`.
- **Presentación (sin marco; decidido el 2026-09-17, sustituye a la "variante A")**: el retrato
  flota sin caja, igual que el arte de los nodos del Camino (§3.1), y lo único que lo apoya es una
  **sombra tenue teñida con su `meta.color`** por `drop-shadow`, que sigue la silueta del PNG y no
  su caja. La geometría escala con el tamaño: caída `size × 0.06`, difuminado `size × 0.12`, color
  al 45 %. Tamaños: 78/96 perfil, 96 selector y tienda, 86 primer inicio, 48 toasts, 34 leaderboard
  y vecinos. Componente único `<Avatar>`, más `<AvatarShadow>` para compartir la sombra con el
  dorso. **El círculo con anillo del `--accent` que llevaba antes se retiró**: metía una caja donde
  el principio 4 pide que no haya ninguna, y competía con el arte del propio avatar.
- Los **vecinos del Camino** pasan de iniciales a avatares (revierte esa decisión de la spec de
  vecinos del 2026-08-09; el resto de sus reglas se mantiene).
- **Tres desviaciones decididas durante la implementación (2026-09-16):** (1) el avatar
  del perfil mide 78 px en móvil y 96 en escritorio, no 128: el §5 fija esos valores y
  el 78 se eligió para que identidad y stats quepan sobre el pliegue a 390 px, que es
  criterio de aceptación de ese mismo §5; el resto de la lista de tamaños se respeta;
  (2) solo se siembran los seis avatares gratis, porque los 19 de pago son la tanda 3
  de arte y sus PNG no existen — el modelo y la tienda los soportan sin cambios y
  aparecen al sembrarlos; igual que el de retiro, `scripts/seed-avatars.js` se entrega
  con el dry-run corrido y sin `--apply`, así que ahora mismo no hay ninguna fila de
  avatar en `shop_items`: la sección "Avatares" de la tienda y el selector del perfil
  se ven vacíos y todo el mundo ve el `clasico` por el fallback del backend, hasta que
  Sergio aplique el sembrado; (3) el retiro de gorros y fondos se entrega como script
  probado con su dry-run corrido, no aplicado: toca saldos de gemas en la base de
  datos compartida y el `--apply` lo lanza Sergio; ese dry-run encontró
  `dots.user_items` vacía —nadie posee todavía ningún ítem de la tienda—, así que al
  aplicarse desactivará los cinco cosméticos (tres gorros y dos fondos) sin reembolsar
  ninguna gema, porque no hay a quién reembolsar.

### 6.2 Retiro de gorros y fondos

- Los ítems `cosmetic` de slots `hat` y `background` pasan a `enabled = false` y se desequipan;
  a cada `user_items` de esos ítems se le devuelve el precio en `gem_ledger` con reason
  `'refund'`. Script `scripts/retire-emoji-cosmetics.js` con dry-run, `--apply`, respaldo y
  `--rollback`. Los gestos (`gesture`) se conservan y pasan al dorso del avatar (§6.4).

### 6.3 Tienda

- Nueva sección **"Avatares"** a 96 px, precio en chip de gemas, "Lo tienes" y
  botón "Usar" para equipar desde la tienda. La sección "Para tu Doty" desaparece con los
  cosméticos emoji.
- Criterios: comprar un avatar lo deja equipable y visible en leaderboard, vecinos y rival sin
  recargar; el usuario sin avatar ve `clasico`; el script de retiro deja saldo y ledger coherentes
  en dry-run antes de aplicarse.

### 6.4 Dorso del avatar (E.2, fase 1 — decidido el 2026-09-16)

- **El problema.** Los gestos perdieron su escenario cuando el avatar sustituyó a Doty en la
  identidad del perfil (§5): solo se veían en las miniaturas de 32 px de su propia tarjeta y nadie
  más los veía. Se conservan (§6.2) y su escenario pasa a ser el **dorso del avatar**.
- **La carta.** El avatar del perfil tiene dos caras: el retrato al frente y, detrás, Doty haciendo
  el gesto equipado, con la misma sombra teñida y la pose que corresponde al gesto —`saludando`
  para `wave`, `emocionado` para `cheer`, `feliz` para cualquier otra— a un 70 % del lado (56 px en
  la caja de 78, 68 en la de 96).
- **Giro de entrada.** Al abrir el perfil, cuando ajustes e inventario ya respondieron y hay gesto
  equipado: el retrato se ve 600 ms, la carta gira en 400 ms (`rotateY`, solo `transform`), el
  gesto da vueltas completas hasta cubrir unos 3 s (dos de `wave` = 3.2 s, tres de `cheer` = 2.7 s;
  completas en duración, no en fase: la animación corre desde que la carta se monta, así que el
  dorso aparece a mitad de ciclo) y vuelve al retrato. Una vez por visita; equipar otro gesto lo
  vuelve a reproducir. Sin gesto equipado el avatar no gira nunca.
- **Tap y hover.** Tocar el avatar lo gira y lo deja en el dorso hasta el siguiente toque; con
  ratón, pasar por encima lo gira y salir lo devuelve. El tap es la señal primaria. El lápiz pasa a
  ser un botón propio —28 px visibles sobre un área táctil de 40— y el único acceso al selector
  desde la identidad; la hoja de ajustes conserva el suyo.
- **Movimiento reducido.** No hay giro de entrada (como la animación de entrada a la app); el tap
  sigue cambiando de cara, sin transición.
- **A 34 px nada gira**: ranking, vecinos del Camino y tarjeta de rival muestran el retrato quieto,
  porque a ese tamaño el gesto no se distingue.
- La tarjeta "Gesto de tu Doty" dice dónde se ve el gesto y usa la misma pose por gesto en sus
  miniaturas. Lógica pura en `lib/avatar-flip.ts`; componente `components/profile/avatar-flip.tsx`.
- **Fase 2 decidida el 2026-09-17**, en §6.5. Sigue fuera de alcance el perfil público de otros
  usuarios. Plan de la fase 1: `docs/superpowers/plans/2026-09-16-rediseno-e2-avatar-dos-caras.md`.

### 6.5 Aviso "te pasó" (E.3, fase 2 — decidido el 2026-09-17)

- **El problema.** La fase 1 le dio al gesto un escenario privado: lo ve su dueño al abrir su propio
  perfil. Un gesto que solo te ves tú no es una posesión que nadie quiera comprar. La fase 2 le da el
  escenario público que justifica su existencia: **tu gesto es lo que ven los demás cuando les ganas**.
- **Lo que ya existía y se retira.** `hooks/use-rival-watch.ts` hace hoy lo contrario de esto —
  felicita cuando tu puesto MEJORA— y lo hace fuera de las convenciones del repo: pinta el aviso
  creando un `div` con `document.createElement` y estilos en línea, usa el token inexistente
  `--accent-foreground` (aquí es `--accent-contrast`), lleva un emoji como iconografía (regla 11) y
  lee el usuario de `localStorage` a mano en vez de por `hooks/use-stored-user.ts`. Se sustituye
  entero. Su idea buena —un snapshot del puesto por usuario— se conserva.

- **Dónde y cuándo.** Al entrar a **Camino, Juegos o Retos**, y en ninguna otra pantalla: ni en
  Repaso ni en Perfil ni en la Tienda, porque a esas tres vas con una intención concreta —practicar o
  gestionar algo— y el aviso la interrumpiría. Se consulta en cada entrada a esas tres rutas,
  volver de una lección incluida: ese es el momento con más dramatismo, porque acabas de sumar XP y
  aun así te adelantaron.
- **Cómo se detecta.** Se compara tu puesto actual con el guardado de la última comprobación. Si
  **empeoró**, perdiste puestos; si **mejoró**, los ganaste. Se nombra al vecino de ese lado
  (`above` cuando bajaste, `below` cuando subiste) y se enseña su gesto, que es el punto de la fase.
  Un puesto guardado nulo —primera vez en ese dispositivo— nunca avisa, solo guarda.
  - **Corregido el 2026-09-17.** La premisa original decía que un puesto solo empeora si alguien te
    cruzó, y de ahí que el vecino de arriba ES quien te pasó. Eso solo es verdad si el puesto se mueve
    **exactamente un** escalón: ahí el de al lado es forzosamente quien cambió de lado contigo. Con
    más de uno, el movimiento puede no ser cosa suya — estabas 3.º, no abres la app en tres días,
    entran dos cuentas nuevas por encima de todos y acabas 5.º: `above` es quien ya era 2.º, que
    llevaba toda la semana por delante y no te adelantó nunca. La tarjeta diría "Te pasó Beto" y
    sería falso, señalando además a una persona con nombre y cara.
  - **Cómo queda.** No se recorta la función: se hace que toda afirmación sea verdadera. La decisión
    devuelve `saltos` —la diferencia absoluta de puestos— y el copy se elige con él. Con `saltos === 1`
    se atribuye ("Te pasó Beto"); con más, el título cuenta los puestos y el nombre baja a la frase
    como lo único comprobable, quién va delante ahora y por cuánto ("Bajaste 2 puestos · Beto va
    40 XP por delante"). La rama de subida tiene el mismo agujero —subes porque bloquearon a alguien
    de arriba, sin haber pasado a nadie—, así que el tratamiento es simétrico. **Lo que no cambia en
    ninguno de los cuatro casos**: se nombra al vecino y la tarjeta conserva su Doty.
- **El reinicio semanal.** El ranking es semanal y al cambiar de semana los puestos se barajan sin que
  nadie te haya pasado, lo que dispararía un aviso falso señalando a una persona concreta. El payload
  del rival pasa a incluir `weekStart` —el lunes de la semana del ranking, como cadena `YYYY-MM-DD`,
  que es lo que el servicio ya calcula— y el snapshot lo guarda junto al puesto: **si la semana
  cambió, no se compara**, solo se guarda el estado nuevo.

- **El snapshot.** Sigue en `localStorage`, por usuario, en la clave que ya usa el hook actual
  (`dots.rival.rank.<userId>`), que pasa de `{ rank }` a `{ rank, weekStart }`. Un valor con el
  formato viejo —los que ya existen en los navegadores de la gente— se lee sin romperse y se trata
  como semana desconocida: no compara, solo migra. Es por dispositivo, igual que hoy; un navegador
  nuevo empieza sin avisar.

- **Qué enseña.** Una tarjeta con Doty en el tamaño `smaller` del registro (`w-28`, 112 px), el
  nombre del rival y por cuánto XP. No puede ser una tira de texto: a 34 px un gesto no se
  distingue (§6.4) y sin tamaño la animación no significa nada.
  - **Te pasó, con gesto equipado:** Doty hace **el gesto del rival**, con la misma traducción de la
    fase 1 (`gesturePose` de `lib/avatar-flip.ts`: `wave` → `saludando`, `cheer` → `emocionado`, el
    resto → `feliz`).
  - **Te pasó, sin gesto equipado** —hoy, todos: pose fija `flexeando` con animación `cheer`. El
    sujeto del gesto es el rival presumiendo, nunca Doty burlándose de ti: el canon dice que Doty no
    regaña ni se ríe de un error del usuario, y que te adelanten no es un error tuyo sino un mérito
    del otro.
  - **Subiste de puesto:** pose `aplaudiendo`, animación `cheer`, y NUNCA el gesto del otro — el
    gesto es exclusivamente la carga del aviso de derrota. Esa exclusividad es lo que lo convierte en
    un flex y lo que le da sentido a comprarlo.
- **Comportamiento.** Entra desde abajo, por encima de la barra de navegación. Se va sola a los 6 s
  —tiempo de sobra para leer dos líneas y ver un ciclo de gesto, que el más largo dura 3 s—, se
  puede descartar con un toque, y tocar la tarjeta lleva a Retos (`router.push`, regla 1).
  **No es un modal**: no bloquea el scroll, no se come los toques de lo que hay debajo y no usa
  `lib/scroll-lock.ts`. La pista contextual de §7.3 sí puede interrumpir porque se ve una vez en la
  vida; esto puede pasar varias veces por semana.
  - **Añadido el 2026-09-17.** Como se descarta solo y el snapshot ya quedó guardado, solo hay una
    oportunidad de verlo: por eso no se emite mientras algo tape la pantalla —la animación de entrada
    de Doty, que corre en todo login con formulario; un diálogo con el scroll tomado, o la pestaña en
    segundo plano— y no se emite fuera de la pantalla que lo pidió, porque el layout del hub no se
    remonta al cambiar de pestaña. Si el tapón no se levanta en 20 s el aviso se descarta sin pintarse;
    el snapshot se guarda igual.
- **Reglas duras.** Solo `transform`/`opacity` (regla 2), solo tap, cero emoji (regla 11), Doty solo
  desde el registro generado (regla 10). El aviso es `role="status"` con `aria-live="polite"`: informa,
  no exige atención.

- **Backend.** `GET /me/rival` gana dos campos y ninguna migración: `gesture` en cada vecino (el slot
  equipado de `dots.user_items`, en el mismo lote que ya resuelve los avatares — nunca una consulta por
  fila) y la semana del ranking en la raíz, que el servicio ya calcula con `mondayOfWeek(santiagoToday())`
  para la consulta del leaderboard. `delta` ya existe y es la diferencia de XP semanal con el vecino.
- **Lógica pura y probada.** La decisión —comparar puestos, descartar el cambio de semana, elegir a
  quién nombrar y qué pose usar— vive en un módulo puro bajo `node --test`, separada del componente y
  del fetch. Es donde están los casos que a mano no se prueban: primera vez, semana nueva, sin puesto,
  empate, rival sin nombre.

## 7. Subproyecto F — Primer inicio guiado

### 7.1 Gating

- Ruta inmersiva nueva `/welcome` (fuera del grupo hub). Un componente cliente `FirstRunGate`,
  montado en el layout del hub, redirige ahí con `router.replace` cuando `settings.onboarded_at`
  es `null`. **Aplica a todas las cuentas**
  existentes: la plataforma aún no la ve nadie, no hay modal de novedades.
- Al terminar (o saltar), `PATCH /me/settings` con `palette`, `mode`, `sound` y `onboarded: true`
  (el backend estampa `onboarded_at` una sola vez), y el avatar por `POST /me/avatar { key }`.
  **Corregido el 2026-09-17**: `avatar_key` NO es un campo de `PatchSettingsDto` y esa ruta corre
  con `forbidNonWhitelisted`, así que mandarlo ahí devuelve 400. Después, `/onboarding` si el
  placement se puede tomar o está activo, si no `/levels`.
- **El backend ya estaba listo**: `onboarded` y `tips_seen` existían en el DTO y en `mergeSettings`
  desde el subproyecto D, así que F no toca `dots-backend`.
- **Cerrar el primer inicio, tal como quedó**: el PATCH manda el juego completo
  (`palette`, `mode`, `sound`) más `onboarded: true`, y solo si ese PATCH responde se marca el
  dispositivo y se equipa el avatar; si falla, no se marca nada y la bienvenida vuelve a pedirse,
  porque no se guardó. El avatar se traga su propio fallo: el primer inicio ya está cerrado y el
  perfil permite cambiarlo. **Saltar** manda los valores por defecto explícitos, no los que
  hubiera en el dispositivo.
- **Saltar** siempre visible: deja Rosa, Auto, sonido activado y un avatar gratis al azar; el
  perfil lo recuerda con el lápiz sobre el avatar.

### 7.2 Las tres pantallas

1. **Bienvenida**: bocadillo "¡Hola! Soy Doty. Tu coach de inglés.", Doty `saludando` de 170 px,
   titular "Prometo no regañarte.", texto "Ni cuando te equivoques. Sobre todo cuando te
   equivoques. Vamos a armar tu dots en tres toques.", botón "Vamos".
2. **Tema**: "¿Cómo lo quieres ver?" + "Doty siempre es rosa. Lo demás, tú decides."; dos tarjetas
   (Rosa / Eléctrico) con **vista previa real** (HUD y un nodo pintados con los tokens de cada
   paleta); segmentado Claro / Oscuro / Auto; fila "Sonidos · Aciertos, fallos y celebraciones"
   con interruptor; botón "Este me gusta". La elección se aplica en vivo a la pantalla.
3. **Avatar**: "Elige tu Doty" + "Es tu cara en el ranking y en el Camino."; los seis gratis a
   86 px; botón "Listo, soy {nombre}".

### 7.3 Pistas contextuales

- Componente `DotyTip`: pinta un foco (`box-shadow: 0 0 0 9999px scrim`, con el radio del objetivo)
  más un bocadillo con Doty de 84 px, título Baloo, una frase y el botón "Entendido" con
  "Pista 1 de 2". Solo `transform`/`opacity`; el patrón overlay + medición es portable a RN.
  **Corregido el 2026-09-17**: no recibe un `ref`, sino que encuentra el objetivo por un atributo
  `data-tip` en el DOM. La llama de la racha vive en la cabecera del LAYOUT del hub y ninguna
  página puede pasarle un ref; además el Camino ya usaba ese mismo truco con `data-path-current`.
  Medir y esperar al elemento vive en `hooks/use-tip-anchor.ts`, que espera a que terminen las
  animaciones de entrada del objetivo (`getBoundingClientRect` devuelve la caja ya transformada:
  medir a mitad de vuelo dejaría el foco encogido), lo centra con `scrollIntoView` solo si no
  está entero a la vista, y **bloquea el scroll antes de medirlo**, porque esconder el overflow
  ensancha el viewport donde la barra de scroll es clásica. Con el scroll parado, el rectángulo
  medido sigue siendo válido mientras dure la pista. Una pista cuyo objetivo no aparece en ~6 s
  se salta en silencio, y no se marca como vista; el tiempo en que la animación de entrada tapa
  la pantalla no cuenta contra ese plazo.
- Claves en `settings.tips_seen`: `camino.primer-nivel`, `camino.racha`, `arcade.diarios`,
  `repaso.que-es`, `retos.torneo`, `perfil.avatar`. Máximo dos por pestaña, solo en la primera
  visita; "Entendido" hace `PATCH` acumulativo. **`arcade.trono` se cae (2026-09-17)**: el
  subproyecto C retiró el trono y su icono de corona a petición de Sergio, así que esa pista se
  quedó sin objetivo al que apuntar.
- **Copy de las seis (2026-09-17)**: las dos del Camino son las aprobadas en la tabla de voz; las
  de arcade, repaso, torneo y perfil se escribieron con este plan siguiendo las cinco reglas de
  §2.2 y viven en `lib/tips.ts`. El `·` de las frases aprobadas separa título de frase, y así se
  parten en el componente.
- **F va en dos planes (2026-09-17)**: F.1 es el primer inicio de 7.1 y 7.2
  (`docs/superpowers/plans/2026-09-17-rediseno-f1-primer-inicio.md`); F.2 son estas pistas, que
  tocan cinco pantallas distintas y no comparten código con aquello.
- Copy aprobado del Camino: "Este es tu primer nivel · Toca la imagen y arrancamos. Cada lección
  son unos tres minutos." y "La llama es tu racha · Practica hoy y se enciende. Un día sin
  practicar y se apaga. Drama garantizado." El resto sale de la tabla de voz (2.2).
- Criterios: una cuenta nueva pasa por las tres pantallas y el placement en menos de dos minutos;
  saltar deja los defaults; las pistas no se repiten en otro dispositivo; en un usuario con
  placement hecho, el paso 4 no aparece.

## 8. Orden, ramas y dependencias

| Sub | Rama | Depende de | Arte que espera |
|---|---|---|---|
| A | `redesign/a-fundamentos` | — | catálogo fase 4 (emitir lotes) |
| B | `redesign/b-camino` | A (tokens, `streakSecuredToday`, level-math) | 3 narradores (fallback: poses actuales) |
| C | `redesign/c-arcade` | A | `gamer` (fallback `en-celular`) |
| D | `redesign/d-perfil` | A (settings API) | — |
| E | `redesign/e-avatares` | A, D | 6 avatares gratis (tanda 1); de pago (tanda 3) |
| F | `redesign/f-primer-inicio` | A, D, E | — |

Cada subproyecto: `writing-plans` → plan en `docs/superpowers/plans/` → implementación por
subagentes → revisión → merge local a `main` por Sergio. Sin push a origin.

## 9. Fuera de alcance

- Admin. Rive y la "mascota completa" (que tu personaje reemplace a Doty en toda la app): los
  personajes fem, marinero y científica son **solo avatares y narradores de ejercicios**; Doty
  guía siempre.
- Arte para gorros y fondos (llega con Rive). Historias, push del sistema.
- Nombres amigables de secciones (contenido). MCER real (sigue calculado por nivel).
- Medalla de récord reciente en /play (requiere fecha del récord en el backend).
- Cambios en los doce juegos por dentro y en los flujos de lección, salvo los puntos de cableado
  de poses de la tabla 2.3.

## 10. Riesgos y cómo se acotan

- **El cuello de botella es el arte.** Por eso todo punto de cableado tiene fallback y las tandas
  van por prioridad de visibilidad.
- **Contraste en Eléctrico oscuro**: `#5c86ff` sobre `#0d1330` ronda 4.9:1 para texto; el cyan
  como primario solo se usa en degradados y chips grandes. Se mide antes de fijar.
- **Aura de fuego y `rembg`**: nada flotante; el prompt describe llamas pegadas al cuerpo.
- **Memes que envejecen**: viven en la tabla de copy, no en el arte.
- **Scripts sobre producción**: patrón obligatorio, aprobación explícita, PNG antes que BD.
- **Retiro de cosméticos**: el dry-run lista usuarios afectados y gemas a devolver antes de tocar
  nada.
