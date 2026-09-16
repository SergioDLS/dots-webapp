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
  3 = 16 avatares de pago. Sergio genera en Midjourney a partir de `--emit-lote`; el código de B–F
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
| `chismoso` | aviso de rival (`use-rival-watch`) | `senalando` |
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
  tres tarjetas con el gesto equipado marcado, enlace a la tienda.
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
- **Marco (variante A)**: círculo con fondo `color-mix(meta.color 42 %, surface)` y anillo del
  `--accent` del tema (3 px a 128, 2 px a 34). Tamaños: 128 perfil, 96 selector y tienda, 48
  toasts, 34 leaderboard y vecinos. Componente único `<Avatar>`.
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
  `--rollback`. Los gestos (`gesture`) se conservan.

### 6.3 Tienda

- Nueva sección **"Avatares"** con el marco A a 96 px, precio en chip de gemas, "Lo tienes" y
  botón "Usar" para equipar desde la tienda. La sección "Para tu Doty" desaparece con los
  cosméticos emoji.
- Criterios: comprar un avatar lo deja equipable y visible en leaderboard, vecinos y rival sin
  recargar; el usuario sin avatar ve `clasico`; el script de retiro deja saldo y ledger coherentes
  en dry-run antes de aplicarse.

## 7. Subproyecto F — Primer inicio guiado

### 7.1 Gating

- Ruta inmersiva nueva `/welcome` (fuera del grupo hub). Un componente cliente `FirstRunGate`,
  montado en el layout del hub, redirige ahí con `router.replace` cuando `settings.onboarded_at`
  es `null`. **Aplica a todas las cuentas**
  existentes: la plataforma aún no la ve nadie, no hay modal de novedades.
- Al terminar (o saltar), `PATCH /me/settings` con `palette`, `mode`, `sound`, `avatar_key` y
  `onboarded_at`; después, `/onboarding` si `placementPending`, si no `/levels`.
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
3. **Avatar**: "Elige tu Doty" + "Es tu cara en el ranking y en el Camino."; los seis gratis en
   marco A a 86 px; botón "Listo, soy {nombre}".

### 7.3 Pistas contextuales

- Componente `DotyTip`: recibe el `ref` del elemento objetivo, mide su rect y pinta un foco
  (`box-shadow: 0 0 0 9999px scrim`, radio del objetivo) más un bocadillo con Doty de 84 px, título
  Baloo, una frase y el botón "Entendido" con "Pista 1 de 2". Solo `transform`/`opacity`; el patrón
  overlay + medición es portable a RN.
- Claves en `settings.tips_seen`: `camino.primer-nivel`, `camino.racha`, `arcade.diarios`,
  `arcade.trono`, `repaso.que-es`, `retos.torneo`, `perfil.avatar`. Máximo dos por pestaña, solo
  en la primera visita; "Entendido" hace `PATCH` acumulativo.
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
