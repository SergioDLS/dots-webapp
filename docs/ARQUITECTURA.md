# Arquitectura — dots-webapp

Actualizado: 2026-07-22 (post rediseño total + tanda juegos/social). Complemento del `CLAUDE.md` de la raíz.

## La app en una línea

Duolingo-like de inglés para hispanohablantes: un **Camino** de niveles con lecciones intercaladas, repaso SRS, economía de gemas, 14 minijuegos y capa social (torneo, retos 1v1, rivalidades, trono, carrera fantasma). Mascota: Doty (`components/ui/doty/doty.tsx`, poses en `public/images/Doty/DOTTY-POSES-XX.png`).

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

## Los 14 juegos (`app/(app)/games/`)

Legacy (5): dont-pop, dot-bombs (teclado físico — NO RN-safe, pendiente de reemplazo por anagrama tap), dotaxi, flashcards, speed-round.

Nuevos (9, todos RN-safe y con `?seed=` determinista donde aplica):

| Juego | key | Mecánica | Contenido |
|---|---|---|---|
| ¿Verdad o Trampa? | true-false | swipe (pointer events) sí/no sobre pares EN-ES; trampas con falsos amigos | vocab_items + FALSE_FRIENDS |
| Dot Match | dot-match | parejas EN/ES contrarreloj, 3 rondas 60/45/30s, combo | vocab_items |
| Memoria Relámpago | memory | 4×4 flip cards palabra-imagen, cronómetro+movimientos | words (con img) |
| Escucha Rápida | audio-blitz | oyes narración, eliges la palabra, 7s/pregunta | sentences con narración |
| Torre de Palabras | word-tower | palabra cae (useTicker/transform), tap al carril de su categoría, 3 vidas | vocab_packs |
| Constructor | sentence-builder | oyes la frase, la armas con fichas en orden | sentences con narración |
| Palabra del Día | wordle | wordle diario server-side, teclado QWERTY en pantalla | vocab (server) |
| Mini Crucigrama | crossword | 5×5 diario determinista, pistas ES, 5 checks | vocab (server) |
| Carrera Fantasma | ghost-race | corres 12 preguntas de audio vs replay grabado de un rival (barra fantasma por timeline) | audio-blitz + game_runs |

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
- dot-bombs/dotaxi dependen de teclado físico (legacy, pre-RN).
- "Salir" a mitad de memory/dot-match va a result con score parcial (decisión de diseño).

## Historia

Specs/planes/handoffs en `docs/superpowers/`. Rama de trabajo: `redesign/total` (mergeada a main por FF el 2026-07-22).
