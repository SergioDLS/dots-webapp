# 005 — Backlog de juice (auditoría 2026-08-12)

- **Status**: **top 8 CERRADO** (2026-08-15). Quedan los MEDIO/BAJO agrupados
  que no cayeron de paso; ver la sección final.
- **Método**: auditoría con la vara de `improve-animations` sobre los 7 juegos
  que aún no habían tenido pasada de juice.
- **Restricción**: animación solo `transform`/`opacity`. Reutilizar la Motion
  library de `app/globals.css` antes que inventar keyframes.

## Dato transversal

En audio-blitz, true-false, word-tower, sentence-builder, ghost-race, crossword
y wordle había **cero usos** de `dots-shake-x`, `dots-slot-in` y
`dots-timer-pulse`. Los keyframes existían y estaban probados en dot-match y
dot-bombs, pero ninguno de estos siete los tocaba. La mayor parte del backlog
resultó ser *aplicar lo que ya estaba escrito*, no diseñar nada nuevo — y esa
predicción se cumplió: los ocho ítems se cerraron sin añadir un solo keyframe.

Un hallazgo de propina, no de animación sino de bug: **el spinner de carga de
wordle no giraba**. Era una rueda dibujada a mano que pedía `@keyframes spin`,
y ese keyframe vivía en el `<style>` del render normal — que con `loading` en
true nunca llega a montarse. Ambos diarios pasan ahora al `Spinner` compartido.

## Hecho

- ✅ **`GameResult`: el marcador sube contando** (`56dbb40`). Afecta a los 12
  juegos a la vez. `hooks/use-count-up.ts` no anima CSS (solo emite números,
  portable a RN) y respeta `prefers-reduced-motion` devolviendo el valor final
  de inmediato. Verificado: 0 → 417 → 1480, creciente y exacto.
- ✅ **dont-pop: el temblor anulaba el hinchado** (`3474b32`). `dp-tremble`
  define `transform: rotate()` y una animación gana al style attribute, así que
  por encima del 72 % de presión el globo perdía su `scale` justo en el tramo de
  máxima tensión. Temblor y escala viven ahora en capas distintas.

## Top 8 por impacto — TODOS HECHOS

Los ocho quedaron aplicados y verificados en navegador contra las páginas
reales (banco temporal con el adapter de axios interceptado). Se conserva el
enunciado original de cada uno como registro de qué se arregló y por qué.

1. **word-tower — perder una vida es solo `opacity: 0.2`**
   `word-tower/page.tsx:417-428` (disparado desde `227-247`). El evento más
   grave del juego compite con el banner de corrección, que sí hace pop, así que
   la vida se pierde fuera de campo. → `dots-heart-break` con `key={lives}`.
   **Caveat**: ese keyframe incluye `filter: grayscale(1)` en su frame 100 %
   (`globals.css:310`), que rompe la restricción RN — usar solo el tramo
   scale/rotate o corregir el keyframe.
2. **crossword — "Comprobar" es un botón muerto durante la ida y vuelta**
   `crossword/page.tsx:422-443`, botón `756-776`, tinte `201`. Con red lenta el
   jugador cree que no registró el tap y vuelve a pulsar. → `dots-slot-in`
   escalonado en las celdas correctas, `dots-shake-x` en las incorrectas,
   `opacity` reducida mientras hay envío en vuelo.
3. **ghost-race — el duelo con el fantasma no tiene ni un evento**
   `ghost-race/page.tsx:406-411`, barras `585-601`. El conflicto que da nombre
   al juego es una barra gris estirando `width` (propiedad prohibida). →
   `key={ghostSteps}` + `dots-pop-in` en el contador, `dots-timer-pulse` en 👻
   mientras va ganando, y barras a `scaleX` con `transform-origin: left`.
4. **true-false — acertar no produce ninguna señal**
   `true-false/page.tsx:143-150`, marcador `369-371`. Con ×5 el score salta de
   50 en 50 en silencio. → `key={score}` + `dots-score-pop`, y "+N" efímero con
   `dots-pop-in` (el patrón ya está escrito en `audio-blitz:333-344`).
5. **ghost-race — el veredicto final se voltea de "perdiste" a "ganaste"**
   `ghost-race/page.tsx:193`, submit `297-316`, render `94-111`. `beatGhost`
   arranca en `false`, así que quien ganó ve primero que perdió y luego un
   cambio de frame sin transición. → estado pendiente + `key={beatGhost}` con
   `dots-pop-in`; `dots-star-spin` en el 🏆.
6. **audio-blitz — el fallo no toca el botón pulsado**
   `audio-blitz/page.tsx:206-215`, botones `413-430`. Con 4 opciones parecidas
   el jugador lee la frase correcta sin saber cuál tocó. → `dots-shake-x` en el
   botón tocado + tinte success en el correcto (calco de `dot-match:648-654`).
7. **sentence-builder — el fallo solo escala un token un 5 %**
   `sentence-builder/page.tsx:296-322`, token `585-587`. El único momento juicy
   del juego es el reveal escalonado tras el segundo fallo, o sea cuando ya
   perdiste la frase. → `dots-shake-x` en el contenedor del tray.
8. **wordle — ganar la palabra del día renderiza una tarjeta estática**
   `wordle/page.tsx:487-501`. No tiene `animation` de ningún tipo; ni siquiera
   llega al nivel de crossword. → `dots-pop-in` en el contenedor +
   `dots-star-spin` en el 🎉.

Justo por detrás, mismo nivel ALTO: **word-tower — no se distingue el carril que
pulsaste** (`541-542`: todos los no-correctos se pintan gris idéntico) y
**true-false — la carta se queda congelada torcida 1200 ms tras fallar**
(`151-172`: la rama de fallo no resetea `dragX`).

## Hallazgos MEDIO/BAJO agrupados

Cayeron de paso, por estar en el mismo archivo que un ítem del top 8:

- ✅ **Entradas sin escalonar** en audio-blitz (opciones, 0/45/90/135 ms) y en
  el pool de sentence-builder (0…210 ms).
- ✅ **Timers que animaban `width`**: audio-blitz y las tres barras de
  ghost-race pasan a `scaleX` con `transform-origin: left`; el contenedor del
  timer de audio-blitz late con `dots-timer-pulse` por debajo de 3 s.
- ✅ **Keyframes duplicados muertos**: `wordle-shake` → `dots-shake-x`,
  `cw-pop` → `dots-pop-in`, y los dos `spin` locales murieron al pasar ambos
  diarios al `Spinner` compartido.
- ✅ **wordle — el error de red se veía idéntico a "palabra incompleta"**:
  ahora el fallo de envío añade un aviso con `role="status"`; el temblor a
  secas sigue significando "te faltan letras".

Siguen pendientes (ninguno bloquea nada):

- **Entradas sin escalonar** que quedaron fuera: opciones de ghost-race
  (`640-657`) y rejilla de crossword al cargar (`622-660`). La rejilla necesita
  distinguir la entrada inicial de la cascada del veredicto, que ya usa
  `dots-slot-in`; no es un `animationDelay` y ya está.
- **Chips que solo animan al montar**: ninguno — word-tower y true-false se
  arreglaron en `1f8b400`.
- **Escribir no da feedback**: celdas de crossword (`219-228`) y casillas de
  wordle; las teclas de `DailyKeyboard` no usan `dots-pressable`. Es el mismo
  arreglo en el componente compartido, así que conviene hacerlo de una vez.
- **El ↵ de wordle es un botón muerto durante el envío**, igual que lo era
  "Comprobar" en crossword. Arreglarlo pide un estado de "en vuelo" en
  `DailyKeyboard`, que es compartido: entra con el punto anterior.

## Verificación

Los ocho se comprobaron en navegador montando las páginas reales con el adapter
de axios interceptado. Lo medido, no lo leído:

- **crossword**: durante el envío el botón dice "Comprobando…", `disabled`,
  opacidad 0,7. Al llegar el veredicto, 16 casillas correctas con `dots-slot-in`
  escalonado sin huecos (0, 25, 50 … 375 ms) y 5 incorrectas con `dots-shake-x`
  a la vez. Una segunda comprobación con idéntico veredicto vuelve a repartir
  (los nodos remontan por `key`), que es justo lo que el contador `checkRound`
  existe para garantizar.
- **ghost-race**: durante la ida y vuelta a `/ghost/run` la tarjeta muestra ⏳
  "Comparando la carrera…" con `aria-label="resolviendo"`; al resolver salta a
  🏆 con `dots-star-spin` y el bloque remonta con `dots-pop-in`. Antes ese hueco
  decía "perdiste" a todo el mundo. Las tres barras miden `scaleX` y **cero
  divs transicionan `width`**.
- **audio-blitz**: al fallar, el botón tocado queda con `dots-shake-x` + tinte
  danger y el correcto con tinte verde, **ambos a opacidad 1** — el
  `disabled:opacity-40` apagaba justo los dos que hay que mirar.
- **sentence-builder**: el primer fallo tiembla la bandeja entera y la tiñe de
  danger (antes `wrong` caía al gris neutro), conservando el `scale(1.05)` de
  la ficha culpable.
- **wordle**: la tarjeta de victoria entra con `dots-pop-in` y el 🎉 gira con
  `dots-star-spin`.
