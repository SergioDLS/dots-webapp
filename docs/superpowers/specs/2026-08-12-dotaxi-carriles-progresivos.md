# Dotaxi 2.0 — carriles progresivos y RN-safe

- **Fecha**: 2026-08-12
- **Estado**: diseño aprobado por Sergio
- **Alcance**: reescritura de `app/(app)/games/dotaxi/page.tsx` (solo frontend)

## Contexto y motivación

Dotaxi tiene la personalidad visual más fuerte de la colección (taxi dibujado
con divs, carretera en movimiento, líneas de velocidad) y es **el último juego
que bloquea la app React Native**. Sus violaciones, verificadas en el código:

- **`keydown` como input real** (←/→, 1/2/3, Enter/Espacio): la violación
  explícita de la regla 2 del CLAUDE.md.
- **Web Audio API** (`AudioContext` + `OscillatorNode` + `BiquadFilter`) para el
  zumbido del motor: sin equivalente en RN.
- Anima **`left`** para mover el taxi y **`background-position-y`** para la
  carretera: ambas fuera de `transform`/`opacity`.
- Regla 3 violada en cinco sitios (efectos colaterales dentro de updaters de
  `setState`), dos timers anidados que nunca se limpian.
- Legacy: UI en inglés, `window.location.assign` ×3, sin `GameIntro`/`GameResult`
  (`submitGameScoreService` se llama directo desde la página), sin `?seed=`, sin
  `loadError`/Reintentar.
- **Farmeable**: `questions[round % questions.length]` — sin barajar ni seed, el
  orden de preguntas es idéntico en cada partida.
- **Bug de banco vacío**: si el fetch falla, `correctIndex` queda en −1, ningún
  carril coincide y las rondas se resuelven en choque automático hasta agotar
  los 5 corazones, enviando un score 0.
- Un tap mal apuntado sobre el carril propio **confirma la respuesta**: mover y
  comprometerse comparten gesto.

## 1. Carriles progresivos (petición del usuario)

El número de carriles crece con los **aciertos**, no con las rondas jugadas: la
dificultad sube con el progreso del jugador, así que fallar no castiga dos veces.

| Aciertos acumulados | Carriles |
|---|---|
| 0-2 (rondas hasta el 3.er acierto) | 2 |
| 3-5 | 3 |
| 6+ | 4 |

- **Ancho de carretera fijo**: los carriles reparten el espacio (50 % con 2,
  33,3 % con 3, 25 % con 4). El taxi recorre siempre la misma distancia y la
  escena no se sale de pantalla en móvil.
- Al cambiar el número de carriles, el taxi **se recoloca al carril más cercano
  a su posición actual** (nunca queda fuera de rango) y se muestra un aviso
  "¡Carril nuevo!" durante ~600 ms antes de arrancar la ronda, para que el
  jugador registre el cambio.
- Con 2 carriles el arranque es amable; hoy la primera ronda ya obliga a elegir
  entre 3.

## 2. Opciones para 4 carriles

El backend sirve **exactamente 3 opciones** por pregunta
(`DOTAXI_OPTIONS = 3` en `dots-backend`) y 15 preguntas por partida
(`DOTAXI_QUESTIONS = 15`). Con 4 carriles falta una.

La cuarta opción se toma de **otra pregunta del mismo mazo** (mismo registro y
misma fuente, así que engaña más que un distractor genérico), excluyendo
case-insensitive las que ya están en pantalla. Si el mazo no alcanza, se juega
esa ronda con los carriles que se puedan llenar. **Sin cambios de backend.**

Con 2 carriles se usan la correcta + 1 distractor; con 3, las 3 del backend.
El barajado deriva del `seed` cuando existe, para que torneo y retos sirvan
mazos idénticos.

## 3. Input RN-safe

- Fuera el listener de `keydown` por completo.
- **Tocar un carril ajeno mueve el taxi** (mecánica actual, conservada).
- **Confirmar pasa a un botón explícito "¡Vamos!"** bajo la carretera. Hoy tocar
  el carril propio confirma, así que un tap mal apuntado se convierte en
  respuesta definitiva; separar mover de comprometerse elimina ese castigo.
- Dejar que expire el timer sigue contando como fallo (mecánica conservada).

## 4. Movimiento y sonido

- Taxi: `transform: translateX(...)` en vez de `left`.
- Carretera: `transform: translateY(...)` con un tick rAF (`useTicker`), en vez
  de `background-position-y`.
- El zumbido de motor de Web Audio **se retira**: no es portable a RN y su valor
  es decorativo. Se conservan los efectos de acierto/fallo del sistema
  compartido (`playSound`).
- Toda animación queda en `transform`/`opacity`.

## 5. Modernización

- UI **en español**, tono juguetón.
- `GameIntro`/`GameResult` compartidos; el score se envía **solo** vía
  `GameResult`, con `finalScore` seteado en el mismo commit que el cambio de
  fase (lección de memory).
- `?seed=` aceptado, con el mazo **barajado** (hoy el orden fijo es memorizable).
- `loadError` + Reintentar con patrón `fetchAttempt` (regla 5).
- `router.push("/play")` — fuera `window.location.assign` (regla 1).
- Motor en refs + tick rAF; sin `setState` síncrono en efectos ni efectos
  colaterales dentro de updaters (regla 3). Todos los timers registrados y
  limpiados.
- Torneo y reto solo aceptan **partidas completas**;
  `submitChallengeScore(score, { completed })` con el argumento obligatorio.

## Manejo de errores

- Fetch caído o mazo vacío → pantalla `loadError` + Reintentar. Nunca se arranca
  una partida sin preguntas (hoy encadena choques automáticos y envía score 0).
- Pregunta sin opciones suficientes → se rellenan los carriles posibles; nunca
  se renderiza un carril sin cartel.

## Se conserva

10 aciertos para ganar, 5 corazones, timer decreciente (5000 ms − 280 ms por
ronda, suelo 2500 ms), combo ×100 (máximo 5.500), y toda la identidad visual:
taxi, líneas de velocidad, escenario lateral y carretera en movimiento.

## Fuera de alcance

- Cambios de backend (más opciones por pregunta, seed en el endpoint).
- Sonido nuevo que sustituya al motor.
- La pasada de juice fino (llega con la certificación estándar).

## Referencias

- `CLAUDE.md` reglas 1-7.
- Auditoría de juegos 2026-08-10.
- Precedentes aplicados: señuelos cruzados (Constructor), score junto al cambio
  de fase (memory), longitud real sobre hardcode (ghost-race, wordle,
  word-tower), `{ completed }` obligatorio (transversal del reto 1v1).
