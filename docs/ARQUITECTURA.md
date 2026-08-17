# Arquitectura — dots-webapp

Actualizado: 2026-07-22 (post rediseño total + tanda juegos/social). Complemento del `CLAUDE.md` de la raíz.

## La app en una línea

Duolingo-like de inglés para hispanohablantes: un **Camino** de niveles con lecciones intercaladas, repaso SRS, economía de gemas, 12 minijuegos y capa social (torneo, retos 1v1, rivalidades, trono, carrera fantasma). Mascota: Doty (`components/ui/doty/doty.tsx`, poses en `public/images/Doty/DOTTY-POSES-XX.png`).

## Navegación (tabs del hub)

`components/shell/nav-items.ts` → bottom tabs en móvil / riel izquierdo 84px en desktop (`app-nav.tsx`), HUD superior con racha/gemas/nivel-XP (`app-header.tsx`, datos de `GET /me/stats`).

| Tab | Ruta | Qué hay |
|---|---|---|
| Camino | `/levels` | `PathContainer` — sendero zigzag de nodos (practice/pronunciation/grammar/vocab/reading/checkpoint). Dificultades bloqueadas se colapsan con candado. |
| Repaso | `/review` | SRS (SM-2) — cloze de oraciones falladas. |
| Retos | `/quests` | Rival banner + torneo semanal + retos 1v1 + misión diaria + leaderboard. |
| Juegos | `/play` | Lista de juegos con candados por niveles completados. |
| Perfil | `/profile` | Stats, CEFR por nivel, badges, Doty custom (cosméticos/gestos de la tienda). |
| Tienda | `/shop` | Gemas → escudos de racha, boost XP, cosméticos/gestos de Doty. |

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

## Social (visible en /quests)

- **Torneo semanal** (`tournament-card.tsx`): juego de la semana por rotación, top-10, countdown, CTA con `?tournament=1&seed=`.
- **Retos 1v1** (`challenges-panel.tsx` + ⚔️ en `top-students.tsx`): retar desde el leaderboard, mismo mazo por seed, panel entrantes/salientes/historial, badge en nav.
- **Rival** (`rival-banner.tsx` + `use-rival-watch`): el de arriba/abajo tuyo en XP semanal; toast al subir de puesto (snapshot de rank en localStorage por usuario).
- **Trono**: récord global por juego; robarlo = +10 gemas (server).

## Auth y datos

`lib/api-client.ts`: axios con access token **en memoria** + refresh cookie HttpOnly → por eso `router.push` obligatorio. Usuario cacheado en `localStorage["user"]` (id/nombre para UI). Services resilientes: los de features sociales devuelven null/[] en error para no romper el shell.

## Deuda conocida (frontend)

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
