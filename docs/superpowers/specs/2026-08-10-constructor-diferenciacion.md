# Constructor 2.0 — diferenciación frente a la práctica del camino

- **Fecha**: 2026-08-10
- **Estado**: diseño aprobado por Sergio
- **Alcance**: `app/(app)/games/sentence-builder/page.tsx` (solo frontend)

## Contexto y motivación

Constructor duplica el ejercicio `buildUp` de la práctica core
(`components/practice-container/practice-container.tsx`): misma mecánica
(pool de fichas → bandeja, tap puro), mismo corpus (`Sentence` +
`resolveSentenceSoundUrl`), mismas voces. La práctica incluso lo hace con mejor
juice (`pc-fly-to-tray` / `pc-fly-from-pool`) e imagen de apoyo.

Lo que hoy distingue al juego es solo el envoltorio: marcador (100 + 20 por
frase limpia, máx 960), récord/trono, torneo y retos, y el flujo "Comprobar"
con dos intentos. La práctica, en cambio, está **gateada por el progreso del
camino**; el juego es **drilling libre con score**.

La decisión (2026-08-10) fue **conservarlo y diferenciarlo**, no borrarlo: es un
juego moderno y bien construido, y está en la rotación del torneo. La
diferenciación es de propósito, no de mecánica — la mecánica es buena y es la
que enseña.

Restricción confirmada leyendo el backend: `getSentenceBuilder` filtra
deliberadamente a frases **cortas** (`BUILDER_PREFERRED_MAX_TOKENS = 10`) y
sirve 8 frases con 2 distractores cada una (`BUILDER_SENTENCES = 8`,
`BUILDER_DISTRACTORS = 2`). Por eso "frases más largas" quedó **fuera de
alcance**: exigiría un cambio en `dots-backend`.

## 1. Bonus de tiempo (sin estado de derrota)

Cada frase arranca un cronómetro visible (barra + segundos).

- Resolver la frase paga `SCORE_BASE (100) + bonus`.
- El bonus decae **linealmente de 60 a 0 en 20 segundos** y se congela en 0:
  pasados los 20 s se siguen ganando los 100 base, sin límite de tiempo y sin
  penalización. **Nunca hay game over**: el juego "tranquilo" sigue siendo
  terminable por cualquiera; lo que se premia es la fluidez.
- La barra cambia de color al agotarse el bonus (de `--success` a `--muted`),
  como señal informativa, no como amenaza.
- Un "Comprobar" fallido pone el bonus de esa frase a 0 de inmediato (el error
  ya cuesta los 20 puntos de racha limpia actuales; no se añade otro castigo).
- El bonus reemplaza a `SCORE_BONUS_CLEAN`: la fórmula pasa de
  `100 + (limpia ? 20 : 0)` a `100 + bonusDeTiempo` (0 si hubo fallo).
- Máximo por partida: 8 × 160 = **1.280** (hoy 960). Se mantiene en la banda de
  memory (≤1.000) y audio-blitz (~2.000).

El cronómetro se pausa mientras se muestra la corrección/revelación entre
frases, y se reinicia al montar cada frase nueva.

## 2. Dificultad por señuelos cruzados

El backend entrega, por frase, `chips` = respuesta + 2 distractores. La página
enriquece ese pool con palabras tomadas de las **otras frases de la misma
partida** — mismo registro y misma voz, así que engañan mucho más que un
distractor genérico.

Escalado por tramo (índice de frase, 0-based):

| Frases | Señuelos totales |
|---|---|
| 1-3 (índices 0-2) | 2 (los del backend, sin extras) |
| 4-6 (índices 3-5) | 4 (2 del backend + 2 cruzados) |
| 7-8 (índices 6-7) | 6 (2 del backend + 4 cruzados) |

Reglas:

- Se excluyen palabras que ya aparezcan en la respuesta de la frase actual
  (comparación case-insensitive) para no crear ambigüedad real: una ficha
  duplicada legítima seguiría siendo válida y confundiría el chequeo.
- Si el pool cruzado no alcanza (corpus corto), se añaden los que haya: el
  escalado es un objetivo, no un requisito duro.
- El barajado usa el **mismo `seed`** cuando viene por query param, de modo que
  torneo y retos sigan sirviendo mazos idénticos entre rivales. Sin seed,
  aleatorio normal.

## 3. Bugs corregidos de paso

- **Salir a mitad quema el intento del reto 1v1.** Hoy el efecto de
  `page.tsx:131-138` envía `submitTournamentScore`/`submitChallengeScore` en
  cualquier llegada a `"result"`, incluida la salida voluntaria, y el guard de
  `use-challenge-mode.ts:28-29` **no se rearma**: salir en la frase 2 consume el
  único intento del reto con ~200 puntos. Igual que en memory: **salir a mitad
  navega a `/play` sin enviar nada**. (Terminar la partida sigue enviando, claro.)
- **`TOTAL_SENTENCES = 8` hardcodeado** en el HUD (`Frase i/8`) y en el texto
  del intro, mientras el fin de partida usa `sentences.length`: pasa a derivarse
  de `sentences.length` en los tres sitios.
- **Reintentar** pasa al patrón `fetchAttempt` por estado (regla 5), en vez de
  llamar al callback que duplica el efecto de montaje.
- El texto del intro se actualiza a la nueva economía (menciona el bonus por
  rapidez en vez de "+120 pts").

## Fuera de alcance

- Frases más largas o un parámetro de dificultad en el backend.
- El juice fino de animaciones (entrada de fichas, feedback de acierto/fallo):
  llega con la auditoría de motion estándar de la certificación, como en
  dot-match.
- Tocar la práctica del camino: no se modifica.

## Identidad resultante

| | Práctica (`/practice`, buildUp) | Constructor (`/games/sentence-builder`) |
|---|---|---|
| Acceso | gateado por el camino | libre |
| Ritmo | pausado, sin reloj | contrarreloj con bonus |
| Señuelos | los del ejercicio | escalan 2→4→6, cruzados |
| Objetivo | aprender la frase | fluidez y récord |
| Marcador | no | récord, trono, torneo, retos |

## Referencias

- `CLAUDE.md` reglas 1-7 (RN-safe, router.push, score solo vía GameResult,
  retry por estado, Suspense, seed).
- Auditoría de juegos 2026-08-10 (sesión de certificación).
- Precedente del fix de salida: memory (`d2d0880`).
