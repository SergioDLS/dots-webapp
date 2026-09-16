# Arquitectura — dots-webapp

Actualizado: 2026-07-22 (post rediseño total + tanda juegos/social). Complemento del `CLAUDE.md` de la raíz.

## La app en una línea

Duolingo-like de inglés para hispanohablantes: un **Camino** de niveles con lecciones intercaladas, repaso SRS, economía de gemas, 12 minijuegos y capa social (torneo, retos 1v1, rivalidades, trono, carrera fantasma). Mascota: Doty (`components/ui/doty/doty.tsx`, registro generado `components/ui/doty/poses.ts`, sprites en `public/images/Doty/<grupo>/`, pipeline en `scripts/mj/`). Los 22 sprites de la identidad anterior están archivados en `public/images/doty-classic/`.

## Navegación (tabs del hub)

`components/shell/nav-items.ts` → bottom tabs en móvil / riel izquierdo 84px en desktop (`app-nav.tsx`), HUD superior con racha/gemas/nivel-XP (`app-header.tsx`, datos de `GET /me/stats`).

| Tab | Ruta | Qué hay |
|---|---|---|
| Camino | `/levels` | Camino v3 — una dificultad a la vez; detalle de componentes abajo. |
| Repaso | `/review` | SRS (SM-2) — cloze de oraciones falladas. |
| Retos | `/quests` | Rival banner + torneo semanal + retos 1v1 + misión diaria + leaderboard. |
| Juegos | `/play` | Arcade: dos héroes diarios con su estado de hoy, tiles de arte flotante con badge de torneo, y bloqueados en gris. |
| Perfil | `/profile` | Identidad con Doty, barra de nivel, cuatro números, insignias y gestos; los ajustes viven en una hoja (inferior en móvil, lateral en escritorio). |
| Tienda | `/shop` | Gemas → escudos de racha, boost XP, cosméticos/gestos de Doty. |

Camino v3 muestra una dificultad a la vez (`?d=<id>`; por defecto, la
actual, resuelta en `lib/path-view.ts`). `path-container` (fetch,
navegación entre dificultades, tarjetas de las bloqueadas);
`path-difficulty` (vista de una dificultad: banner con narrador,
secciones, niebla, grid md+ de 300 px + pista); `path-section` (zigzag
15/50/85 %, filas de 182 px, sub-banner); `path-node` (arte de 128 px sin
contenedor, barra 100×8, badges); `folded-header` + `back-to-current`
(visibles según el `IntersectionObserver` que arma `path-container` en
`hooks/use-in-view.ts`); `segmented-bar`. Las poses de Doty sin arte
propio caen a `poseOrFallback` (`components/ui/doty/doty.tsx`, sobre la
lógica pura de `pending.ts`). El HUD (`components/shell/app-header.tsx`)
enciende la llama solo con `streakSecuredToday`.

Flujos inmersivos (sin chrome): `/practice`, `/lesson/{pronunciation,grammar,vocab}`, `/checkpoint`, `/onboarding` (placement), `/readings/:id`, `/games/*`.

Fuera de `(app)` y sin sesión: `/` (login), `/forgot` (recuperar contraseña) y `/invite/[token]` (aceptar invitación y crear la cuenta). Esta última es la **única vía de alta que existe en la app** — no hay registro público. El panel de invitaciones vive en `/admin/users`, pestaña *Invitations*.

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

### El perfil (`/profile`)

`components/profile/` reparte la pantalla: `profile-identity.tsx` (Doty, nombre, chips
MCER y racha, engranaje), `profile-xp-bar.tsx`, `profile-stats.tsx` (los cuatro números
sin cajas), `badges-grid.tsx`, `gestures-card.tsx` y `settings-sheet.tsx`. La lógica de
vista es pura y está bajo `node --test` en `lib/profile-view.ts`. El avatar de
`profile-identity.tsx` usa el tamaño `perfil` del registro de
`components/ui/doty/doty.tsx` (78 px en móvil, 96 en `md`) y no un `customClass`,
porque entre dos utilidades de `width` con la misma especificidad gana la que Tailwind
emita última.

La hoja de ajustes escribe tres cosas a la vez en cada cambio: el espejo de
`localStorage`, el DOM (vía `applyThemePrefs`) y `PATCH /me/settings`. Desde aquí el
servidor es autoritativo: `components/theme/theme-sync.tsx` reconcilia al cargar y
reescribe el espejo si difiere. El servidor manda salvo mientras haya una escritura
local sin confirmar: para eso existe la marca `dots-settings-dirty`
(`lib/theme-prefs.ts`), que la hoja pone antes del `PATCH` y limpia solo al
confirmarse; si `ThemeSync` la encuentra puesta, reenvía al servidor el estado completo
de los espejos (paleta, modo y sonido) en vez de aplicar lo que diga el servidor. Sin
ella, un cambio hecho sin red se perdía en cuanto el usuario entraba a una lección y
volvía, porque este componente se remonta en cada ida y vuelta al hub. La preferencia
de sonido tiene su propio espejo en `lib/sound-prefs.ts` y `lib/feedback-sounds.ts` la
consulta antes de sonar, así que apagarla silencia los quince importadores (diez
juegos, la práctica, tres componentes de lección y un hook) que reproducen aciertos y
fallos sin tocar ninguno; la narración no pasa por ahí y nunca se silencia.

El acento de cada paleta viaja como dato (`PALETTE_ACCENTS` en el `lib/theme-colors.ts`
generado) porque los bloques CSS generados usan selectores `:root[data-palette]`, que
solo casan con `<html>`: un envoltorio anidado no heredaría el token.

## Los 12 juegos (`app/(app)/games/`)

Legacy: **ninguno**. (flashcards y speed-round fueron retirados el 2026-08-10 con sus récords purgados; dot-bombs, dotaxi y dont-pop fueron reconstruidos RN-safe — specs en `docs/superpowers/specs/`.)

Nuevos (12, todos RN-safe y con `?seed=` determinista donde aplica):

| Juego | key | Mecánica | Contenido |
|---|---|---|---|
| ¿Verdad o Trampa? | true-false | swipe (pointer events) sí/no sobre pares EN-ES, con botones ✗/✓ de respaldo; trampas con falsos amigos; termina al agotarse mazo o tiempo | vocab_items + FALSE_FRIENDS |
| Dot Match | dot-match | parejas EN/ES contrarreloj, 3 rondas 60/45/30s, combo | vocab_items |
| Memoria Relámpago | memory | 4×4 flip cards palabra-imagen, cronómetro+movimientos | words (con img) |
| Escucha Rápida | audio-blitz | oyes narración, eliges la palabra, 7s/pregunta; acierto rápido paga más y se ve (+N) | sentences con narración |
| Torre de Palabras | word-tower | palabra cae (useTicker/transform), tap al carril de su categoría, 3 vidas; rondas rebarajadas en cada revancha sin seed | vocab_packs |
| Constructor | sentence-builder | oyes la frase, la armas con fichas en orden; bonus por rapidez y señuelos cruzados que escalan (diferenciado del buildUp de la práctica) | sentences con narración |
| Palabra del Día | wordle | wordle diario server-side, teclado QWERTY en pantalla (compartido con crossword); intentos y longitud los manda el servidor | vocab (server) |
| Mini Crucigrama | crossword | 5×5 diario determinista, pistas ES, 5 checks (botón deshabilitado al agotarlas; fallo de red visible) | vocab (server) |
| Carrera Fantasma | ghost-race | corres preguntas de audio vs replay grabado de un rival (barra fantasma por timeline; el timeline registra TODA pregunta resuelta) | audio-blitz + game_runs |
| Dot Bombs | dot-bombs | caen bombas con imagen y palabra; desactivas deletreando con fichas de anagrama (tap); modos easy/medium/hard y survival | words (con img) |
| ¡No lo revientes! | dont-pop | sin reloj: el globo se infla solo y ES la presión; imagen + 3 palabras, acertar desinfla y fallar infla; responder tranquilo paga más | words (con img) |
| Dotaxi | dotaxi | frase con hueco; mueves el taxi al carril de la palabra y confirmas con «¡Vamos!»; los carriles crecen 2→3→4 con los aciertos | dotaxi (frases) |

Patrón de página: Suspense (searchParams) → fetch con loadError/Reintentar → `GameIntro` (récord propio + trono vía `useGameRecords`) → juego → `GameResult` (score una vez; muestra +XP, récord, trono robado). Hooks `useTournamentMode` (`?tournament=1`) y `useChallengeMode` (`?challenge=<id>`) envían scores adicionales a sus endpoints al llegar a result.

### El arcade (`/play`)

`components/play/arcade-container.tsx` pide la lista (`GET /games`, obligatoria) y en
paralelo lo que solo decora: torneo de la semana y el estado de hoy de los dos
diarios. Ninguna de esas tres retrasa la rejilla ni la rompe si falla (el badge de
trono se retiró; ver `lib/arcade.ts`). El reparto en bloques, la clave de juego, los
badges y el copy del estado diario viven en `lib/arcade.ts`, que es puro y está bajo
`node --test`. Los tiles exportan su geometría para que `arcade-skeleton.tsx` calque
la retícula real en vez de aproximarla. Se entra a un juego con `router.push`: la
excepción legacy de `window.location.assign` murió aquí.

El esqueleto de carga presupone que los dos juegos diarios están desbloqueados y, por tanto,
los retira si el usuario aún no los tiene. Solo lo perciben los usuarios con menos de cinco
niveles completados, que es cuando el primero de ellos se abre; se aceptó así deliberadamente
porque cambiar este comportamiento sería incorrecto para el resto.

## Social (visible en /quests)

- **Torneo semanal** (`tournament-card.tsx`): juego de la semana por rotación, top-10, countdown, CTA con `?tournament=1&seed=`.
- **Retos 1v1** (`challenges-panel.tsx` + ⚔️ en `top-students.tsx`): retar desde el leaderboard, mismo mazo por seed, panel entrantes/salientes/historial, badge en nav.
- **Rival** (`rival-banner.tsx` + `use-rival-watch`): el de arriba/abajo tuyo en XP semanal; toast al subir de puesto (snapshot de rank en localStorage por usuario).
- **Trono**: récord global por juego; robarlo = +10 gemas (server).

## Auth y datos

`lib/api-client.ts`: axios con access token **en memoria** + refresh cookie HttpOnly → por eso `router.push` obligatorio. Usuario cacheado en `localStorage["user"]` (id/nombre para UI). Services resilientes: los de features sociales devuelven null/[] en error para no romper el shell.

## Temas y preferencias

`design/themes.json` (paleta × modo) → `scripts/themes/render.mjs` (funciones puras) + `scripts/themes/build.mjs` (E/S, `--check`) → generados `app/themes.generated.css` y `lib/theme-colors.ts`; `npm run lint` falla si están desactualizados.

`<html data-palette="rosa|electrico" data-theme="light|dark">`: Auto es la ausencia de `data-theme` (resuelve por `prefers-color-scheme`). El script anti-flash inline de `app/layout.tsx` fija estos atributos antes del primer paint desde el espejo de `localStorage`; `applyThemePrefs` (`lib/theme-prefs.ts`) hace exactamente lo mismo desde React — si cambias uno, cambia el otro.

`components/profile/settings-sheet.tsx`: hoja de ajustes que reemplazó al toggle binario claro/oscuro; lee el modo resuelto del DOM (`html.dark`) y nunca de `matchMedia` en el render (regla 12). Ver "El perfil" arriba para el detalle de qué escribe (paleta, modo y sonido) y cómo se reconcilia con el servidor.

`components/theme/theme-sync.tsx`: reconcilia paleta, modo y sonido contra `GET /me/settings` — ver "El perfil" arriba para el detalle completo (servidor autoritativo salvo marca de pendiente); en Auto también sigue `prefers-color-scheme` con la pestaña abierta.

`services/settings.service.ts`: fetchers de `/me/settings` (`GET`/`PATCH`), tolerantes a que el endpoint no exista todavía.

`lib/level-math.ts` es la única fórmula de nivel (la comparten HUD y perfil).

## Deuda conocida (frontend)

- Con `settings` ya declarada en la entidad `Users` del backend, viaja en todos
  los `save(user)`: un `PATCH /me/settings` que confirme entre la lectura y el
  guardado de una escritura de XP puede quedar pisado. La vía limpia sería
  marcar la columna como no seleccionada por defecto y pedirla explícitamente
  donde se usa, pero hacerlo mal es peor que la carrera — si la lectura
  devolviera vacío, el merge partiría de los valores por defecto y borraría
  los ajustes del usuario —, así que queda anotado y sin cambiar.
- `GameResult` traga errores del submit sin estado de error (patrón aceptado batch-wide).
- Countdown del torneo muestra "0h" en la última hora.
- Rival: LIMIT 200 en backend → usuarios 201+ se ven como sin rank.
- crossword y wordle replican la fórmula de score del backend en cliente solo
  para mostrarla (`crosswordScore` / el cálculo de wordle, comentados con su
  fuente); el arreglo de fondo es que los endpoints devuelvan el score ya
  calculado.
- wordle no escucha el teclado físico (cumple la regla RN-safe: teclados =
  botones en pantalla), así que en escritorio hay que tocar las teclas.
- `useGameSeed()` (hooks/) es el único lector de `?seed=`: lo honra SOLO con `?tournament=1` o `?challenge=<id>`, así que fijar un seed a mano en juego libre ya no permite memorizar el mazo y farmear récord/trono.
- `submitChallengeScore(score, { completed })` exige declarar si la partida terminó: el intento del reto 1v1 se gasta a la primera (el backend 409ea repetidos) y no hay rearme, así que enviar un abandono lo quemaba. Los seis juegos con reto lo declaran explícitamente.
- "Salir" a mitad de dot-match va a result con score parcial (decisión de diseño: su score sube desde 0). En memory, "Salir" ABANDONA sin enviar nada — su fórmula parte de 1000 y baja, y un parcial temprano superaría a cualquier partida completa (exploit de torneo, corregido 2026-08-10). En sentence-builder, "Salir" también abandona sin enviar — el guard del reto 1v1 no se rearma y un parcial quemaba el intento (corregido 2026-08-10). En ghost-race igual: salir posteaba a /ghost/run una carrera truncada (corregido 2026-08-10). En audio-blitz, true-false, word-tower, dotaxi y dont-pop el parcial SÍ cuenta para el récord personal (su score sube desde 0, como dot-match), pero torneo y reto solo aceptan partidas completas (corregido 2026-08-10).
- `/games/dont-pop` tampoco acepta seed: no debe entrar en reto ni torneo hasta que el endpoint lo honre.
- `/games/dotaxi` IGNORA el `seed` (el backend baraja con Math.random), así que dos rivales reciben mazos distintos: dotaxi NO debe entrar en `CHALLENGE_GAMES` ni en la rotación de torneo hasta que el endpoint lo honre.

## Historia

Specs/planes/handoffs en `docs/superpowers/`. Rama de trabajo: `redesign/total` (mergeada a main por FF el 2026-07-22).
