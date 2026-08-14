# Don't Pop 2.0 — modernización del último legacy

- **Fecha**: 2026-08-12
- **Estado**: diseño decidido por Claude bajo autorización de Sergio para avanzar
  los pendientes sin consultar. Las decisiones de producto están marcadas y
  razonadas para que pueda revertirlas.
- **Alcance**: `app/(app)/games/dont-pop/page.tsx` y
  `components/games/dont-pop/hot-air-balloon.tsx` (solo frontend)

## Contexto

Don't Pop es el **último juego legacy** de la colección. Su mecánica tiene una
idea genuinamente buena que ningún otro juego usa: **no hay reloj, el globo ES
el reloj**. La presión sube sola 6/s desde 15 hasta 100 (~14 s de gracia),
acertar la baja 25 y fallar la sube 30. A 100 el globo revienta; limpiar todas
las palabras es un aterrizaje suave.

Problemas verificados en el código:

- UI **en inglés**; `window.location.assign("/levels")` ×2 (regla 1).
- Sin `GameIntro`/`GameResult`: `submitGameScoreService` se llama directo desde
  la página (regla 4).
- **Regla 3 violada de forma flagrante**: `nextRound` llama a `land()` y a
  `setIndex` **dentro del updater de `setData`**, y dentro del updater de
  `setIndex` llama a `setOptions` y a `Math.random()`. StrictMode doble-invoca
  los updaters.
- **Sin `loadError` ni Reintentar**: el fetch traga el error. Con `data = []` la
  intro dice "Clear all **0** words", pulsar Start llama a `nextRound` →
  `findIndex` da −1 → `land()` → **victoria instantánea con score 0**.
- El globo **anima `filter`** (`hue-rotate`, `saturate`), fuera de
  `transform`/`opacity`.
- Los `setTimeout` de `crash`/`land` nunca se limpian al desmontar.
- Con `data.length === 1` el distractor `(d+1) % 1` colisiona: los dos botones
  muestran el mismo texto. El distractor puede además ser una palabra ya
  respondida.
- `setTimeout(() => nextRound(), 0)` como sincronización de arranque.
- Sin `?seed=`. El score es el número de palabras limpiadas (0..N), escala
  incompatible con el resto (~1.000-2.000).

## 1. La mecánica se conserva

El globo como reloj es la identidad del juego y no se toca: presión inicial 15,
subida 6/s, −25 por acierto, +30 por fallo, reventón a 100, aterrizaje al
limpiar todas. Es la única presión "blanda" de la colección (no hay cuenta atrás
numérica) y funciona.

## 2. Tres opciones en vez de dos *(decisión de producto)*

Hoy hay 2 botones: adivinar es una moneda al aire con 50 % de acierto, y como
fallar solo cuesta presión, el azar es una estrategia viable. Se pasa a **3
opciones**, que baja el azar al 33 % sin tocar el ritmo. Los distractores salen
de otras palabras del mazo, **excluyendo las ya respondidas** y sin repetirse
entre sí (hoy un distractor puede ser una palabra ya contestada, lo que delata
la respuesta por eliminación).

Si el mazo es tan corto que no hay 3 opciones distintas, se juega con las que
haya — nunca se renderiza un botón vacío ni dos botones iguales.

## 3. Puntuación con fórmula *(decisión de producto)*

Hoy el score es el conteo de palabras limpiadas, una escala que no se puede
comparar con ningún otro juego. Pasa a:

```
por acierto: 100 + bonus de calma
bonus de calma = round(60 × (1 − presión/100))   // 0..60
```

Responder con el globo tranquilo paga más que responder al borde del reventón,
que es exactamente el comportamiento que el juego quiere premiar (ir rápido
mantiene la presión baja). Fallar no resta puntos — ya cuesta +30 de presión.

Banda objetivo con un mazo típico: **~1.000-1.600**, alineada con memory (≤1.000)
y audio-blitz (~2.000).

## 4. Aviso de peligro sin animar `filter`

El globo se tiñe de rojo al acercarse al reventón. En vez de animar
`filter: hue-rotate()/saturate()` (no portable, fuera de la regla 2), se
superpone una capa roja cuya **opacidad** sigue a la presión. Mismo efecto
visual, `opacity` pura.

## 5. Modernización

- UI **en español**, tono juguetón.
- `GameIntro`/`GameResult` compartidos; el score se envía **solo** vía
  `GameResult`, con `finalScore` seteado en el mismo commit que el cambio de
  fase (lección de memory).
- `loadError` + Reintentar con patrón `fetchAttempt` (regla 5). **Nunca se
  arranca sin palabras**: si el mazo viene vacío se va a `loadError`, no a una
  victoria falsa con score 0.
- `router.push("/play")` — fuera `window.location.assign` (regla 1).
- `?seed=` vía `useGameSeed()` (solo se honra en torneo/reto) y mazo barajado.
- Motor en refs + tick; **sin efectos colaterales dentro de updaters** y sin
  `setState` síncrono en efectos (regla 3). Todos los timeouts limpiados.
- Torneo y reto solo con **partida completa**;
  `submitChallengeScore(score, { completed })`.

## Manejo de errores

- Fetch caído o mazo vacío → pantalla `loadError` + Reintentar.
- Mazo de una sola palabra → se juega con las opciones que haya, sin botones
  duplicados (hoy los dos muestran lo mismo).

## Fuera de alcance

- Cambios de backend (`/games/dont-pop` no acepta seed hoy; se reenvía por
  convención igual que en dotaxi y se anota la deuda).
- Sonido nuevo.
- La pasada de juice fino.

## Se conserva

El globo dibujado (`hot-air-balloon.tsx`), su balanceo, el cielo con degradado
(`--sky-top`/`--sky-bottom`), Doty en la cesta, la caída al reventar y el
aterrizaje suave.

## Referencias

- `CLAUDE.md` reglas 1-7.
- Precedentes: `useGameSeed` (transversal 2026-08-12), `{ completed }`
  obligatorio (transversal 2026-08-10), score junto al cambio de fase (memory),
  distractores cruzados (Constructor), degradación con mazo corto (dot-bombs).
