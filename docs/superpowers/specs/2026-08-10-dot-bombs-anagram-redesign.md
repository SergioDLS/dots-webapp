# Dot Bombs 2.0 — rediseño a anagrama tap

- **Fecha**: 2026-08-10
- **Estado**: diseño aprobado por Sergio; pendiente plan de implementación
- **Alcance**: reescritura de `app/(app)/games/dot-bombs/page.tsx` (input, modos, score, convenciones)

## Contexto y motivación

Dot-bombs es el único juego arcade de dots que entrena **producción/spelling bajo
presión** (el resto son de reconocimiento). Pero su mecanismo central — teclear la
palabra en un `<input>` con `autoFocus` — viola la regla RN-safe (regla 2 del
CLAUDE.md: solo tap/pointer; teclados = botones en pantalla) y lo hace imposible
de portar a la app React Native. `docs/ARQUITECTURA.md` ya lo marcaba como
"pendiente de reemplazo por anagrama tap".

La auditoría de 2026-08-10 encontró además:

- **Farmeo sin techo en Survival**: aceleración de 0.0002/tick sobre una caída
  inicial de ~500 s por bomba; el score crece sin límite mientras se teclee.
- **Recompensa invertida**: easy paga ×3 con la caída más lenta y menos bombas;
  es objetivamente el modo más rentable.
- **Bug de vidas**: `lostLife` es booleano; varias bombas explotando en el mismo
  tick de 100 ms restan una sola vida.
- **Timeouts corruptos**: los `setTimeout` de limpieza capturan índices del array
  de bombas y pueden resetear bombas vivas de la partida siguiente; `endgame()`
  no los cancela.
- **Fallo de red silencioso**: sin `loadError`; con fetch caído la partida
  arranca sin bombas.
- Legacy total: UI en inglés, `window.location.assign`, `submitGameScoreService`
  fuera de `GameResult`, anima `top` (propiedad de layout), pegar texto en el
  input también acierta.

## Decisión de input: anagrama tap

Las letras de la palabra activa aparecen **barajadas como fichas** en una bandeja
fija en la parte baja de la pantalla (altura de pulgar). El jugador las toca en
orden para desactivar la bomba.

Alternativas consideradas y descartadas:

- **QWERTY en pantalla** (estilo wordle): recall puro, pedagógicamente superior,
  pero el teclado ocupa ~40 % del viewport móvil y teclear palabras completas con
  bombas cayendo produce errores de pulsación que frustran sin enseñar.
- **Letras faltantes (cloze)**: entrena letras difíciles (dobles, mudas) pero
  exige decidir qué ocultar y se aleja más de "escribir la palabra".

El anagrama conserva el entrenamiento de ortografía (orden de letras), es
tolerante a dedos gordos y es el reemplazo que la arquitectura ya preveía.

## Core loop

1. Las bombas caen (imagen + palabra en inglés visible). **Solo una bomba está
   activa a la vez**: la más cercana al suelo, resaltada visualmente. Las demás
   siguen cayendo detrás y hacen cola.
2. La bandeja muestra las letras de la palabra activa, barajadas:
   - Letras duplicadas = fichas duplicadas (dos fichas «l» para "balloon" son
     intercambiables entre sí).
   - En dificultad hard se añaden 1-2 **letras señuelo**.
3. Tocar la ficha correcta la mueve al siguiente hueco de la palabra; ficha
   equivocada = shake (`dots-shake-x`) y ficha intacta, **sin coste de vida**
   (el coste del error es el tiempo perdido). Rachas de palabra sin fallo
   alimentan el combo.
4. Palabra completa = bomba desactivada: pop de salida, puntos, y la siguiente
   bomba en cola pasa a activa (su anagrama entra con `dots-slot-in`).
5. Bomba que aterriza = −1 vida y pasa la activación a la siguiente. **Todos los
   aterrizajes de un mismo tick cuentan** (se corrige el bug del booleano).
6. 5 vidas. Normal termina al desactivar 20 bombas o quedarse sin vidas;
   Survival solo al quedarse sin vidas.

Al cambiar la bomba activa (por desactivación o aterrizaje), la bandeja se
reconstruye con la nueva palabra; los taps durante la transición (~200 ms) se
ignoran.

## Modos y dificultad

| Modo | Velocidad de caída | Bombas simultáneas | Multiplicador | Fin |
|---|---|---|---|---|
| Normal · easy | lenta | 2 | ×1 | 20 bombas |
| Normal · medium | media | 3 | ×2 | 20 bombas |
| Normal · hard | rápida + señuelos | 4 | ×3 | 20 bombas |
| Survival | arranca media, acelera de verdad | 3→5 | ×1, +0.1 por cada 30 s sobrevividos (tope ×3) | 5 vidas |

- Se corrige la inversión actual (easy pagaba ×3).
- Survival: la aceleración se calibra para que una run natural dure **2-4 min**
  (queda acotado por esfuerzo, no farmeable por paciencia). Valores exactos se
  ajustan jugando en el plan de implementación.

## Puntuación

- Por bomba: `100 × multiplicador × bonusAltura`, donde `bonusAltura` ∈ [1, 1.5]
  según cuánto le faltaba por caer (desactivar alto paga más — conserva la
  esencia de "responde rápido" del juego actual).
- Combo: +10 % acumulativo por bomba consecutiva sin ficha errada (tope ×2).
- Banda objetivo de un run Normal completo: **~1.500-2.500 puntos**, alineada
  con audio-blitz (~2.000) y memory (≤1.000); hoy conviven escalas de 10 a
  21.000 entre juegos.
- Sin clamp de score (el 1000 fijo actual hacía que todo high score de Normal
  fuera idéntico).

## Modernización técnica

- UI **en español** (tono juguetón del proyecto).
- `GameIntro`/`GameResult` compartidos; el score se envía **solo** vía
  `GameResult` (hoy se postea directo desde la página).
- `loadError` + botón Reintentar con el patrón `fetchAttempt` (regla 5).
- `router.push("/play")` — fuera `window.location.assign` (regla 1).
- Caída con `transform: translateY` + tick rAF (`useTicker`), no `top` (regla 2).
- Fichas y feedback con la Motion library compartida: `dots-slot-in`,
  `dots-shake-x`, `dots-score-pop`, `--ease-out-strong`.
- Todos los timeouts registrados y limpiados en `endgame()`/unmount (se elimina
  la corrupción de bombas entre partidas).
- Sin `setState` síncrono en efectos ni efectos colaterales dentro de updaters
  (regla 3) — el motor de juego vive en refs + un tick rAF que hace `setState`
  del snapshot.
- `?seed=`: el fetcher cliente lo aceptará opcional y lo pasará; **el backend
  hoy no soporta seed en `/games/words`**, así que el soporte real (y con él el
  modo torneo) queda como cambio de backend aparte.

## Manejo de errores

- Fetch caído → pantalla `loadError` + Reintentar (hoy: partida muerta sin
  bombas, o victoria instantánea con score 0 en dont-pop-style).
- Pool corto: Normal juega `min(20, pool.length)` bombas; el anagrama no
  necesita distractores del pool, así que `data.length === 1` deja de ser un
  caso roto.
- Palabras con caracteres fuera de [a-z] (espacios, guiones): la ficha del
  carácter especial se muestra ya colocada (no se baraja), para no romper el
  anagrama.

## Fuera de alcance

- Soporte de seed en el backend y alta en torneos/retos.
- Sonidos nuevos (se reutilizan correct/wrong actuales).
- El juice fino y la auditoría de animaciones (llegan con la certificación
  estándar, como en dot-match).
- Renombrar el juego o cambiar su arte.

## Referencias

- Survey de auditoría 2026-08-10 (sesión de certificación de juegos).
- `docs/ARQUITECTURA.md` — línea "dot-bombs (teclado físico — NO RN-safe,
  pendiente de reemplazo por anagrama tap)".
- `CLAUDE.md` reglas 1-5.
