# 005 — Backlog de juice (auditoría 2026-08-12)

- **Status**: **CERRADO** (2026-08-16). Los 21 hallazgos —top 8 y MEDIO/BAJO—
  están aplicados y verificados en navegador.
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

## Hallazgos MEDIO/BAJO agrupados — TODOS HECHOS

Los primeros cayeron de paso, por estar en el mismo archivo que un ítem del
top 8; el resto se cerró después:

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

- ✅ **Entradas sin escalonar, las dos que faltaban** — HECHO. Opciones de
  ghost-race (0/45/90/135 ms) y rejilla de crossword al cargar (21 casillas,
  0…320 ms en pasos de 16, sin huecos donde están las negras).

  La rejilla tenía la trampa que anotaba este backlog: hay que distinguir la
  entrada inicial de la cascada del veredicto, que usa el mismo keyframe. Se
  resuelve con un guard `checkRound === 0`, y no es decorativo — una casilla
  vuelve a `neutral` al editarla tras una comprobación, y como su `key` vuelve
  entonces a la forma sin ronda, **remonta**. Verificado en navegador: al
  editar una casilla ya tintada, `remontada: true` pero animación
  `(ninguna)`. Sin el guard, el tablero repetiría su entrada a media partida.
- **Chips que solo animan al montar**: ninguno — word-tower y true-false se
  arreglaron en `1f8b400`.
- ✅ **Escribir no daba feedback** — HECHO. Las teclas de `DailyKeyboard` usan
  `dots-pressable` (con la sombra de presión siguiendo al color de la tecla:
  en las marcadas de wordle una sombra gris se veía como suciedad sobre el
  verde), y la letra recién escrita da un golpe seco tanto en la casilla de
  wordle como en la celda de crossword.
- ✅ **El ↵ de wordle era un botón muerto durante el envío** — HECHO, vía una
  prop `enterBusy` en el componente compartido.

- ✅ **El teclado de wordle desbordaba 10 px a lo ancho en un móvil de 375 px**
  — HECHO. Era **previo** a la pasada de juice (medido con y sin los cambios:
  `scrollWidth` 385 en ambos casos). La primera fila pedía 372 px (10 teclas de
  `minWidth: 2.1rem` + 9 huecos) dentro de una fila de 351 px, y
  `flexShrink: 0` impedía que encogieran.

  El arreglo apuntado aquí (bajar `md` al tamaño de `sm`) resultó ser el
  equivocado: salvaba los 375 px y nada más. A 360 px —el Android más común—
  `sm` también se salía, así que crossword tenía el mismo bug latente. La
  medida correcta no es un rem fijo sino **ancho fluido y uniforme**:
  `--kb-key: calc((100% - 9 * gap) / 10)`, la unidad sale de la fila más larga
  y las otras dos se centran con el sobrante, que es como se comporta un
  teclado de móvil de verdad. El `maxWidth` del contenedor pone el techo, así
  que en escritorio queda igual que siempre.

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
- **ghost-race (fallo)**: el botón tocado tiembla con tinte danger y el
  correcto se tiñe de verde, los dos a opacidad 1. **No estaba en el backlog**:
  se auditó ese fallo solo en audio-blitz, pero los dos juegos son gemelos
  documentados (mismo banco, mismo bucle, misma rejilla de opciones), así que
  arreglar uno y dejar el otro habría sido peor que cualquiera de los dos
  estados.
- **`DailyKeyboard`**: las teclas resuelven `box-shadow: 0 4px 0` con el color
  correcto (verde oscuro bajo la tecla verde, no gris). Escribir una letra
  remonta **solo** su casilla — medido: al teclear la quinta letra el array de
  remontes es `[false,false,false,false,true]`, así que las ya escritas no
  repiten su pop. Con el envío en vuelo el ↵ pasa a "…", `disabled`, opacidad
  0,55, mientras el ⌫ sigue vivo.
- **Anchos del teclado**, medidos en cuatro viewports (Q, A y Z siempre miden
  lo mismo, o sea que el ancho es uniforme entre filas, y las anchas 1,5×):

  | ancho | scrollWidth | ¿desborda? | tecla (wordle) |
  | --- | --- | --- | --- |
  | 320 px | 320 | no | 26,00 px |
  | 360 px | 360 | no | 30,00 px |
  | 375 px | 375 | **no** (antes 385, sí) | 31,50 px |
  | ≥ 1280 px | 1280 | no | 34,80 px (tope del contenedor) |

### Anchos fijos en rem: el patrón que hay que vigilar

Tres bugs de la misma familia en dos días, todos por medir en rem lo que
depende del ancho de la pantalla:

1. El teclado de wordle (10 teclas de `2.1rem` + `flexShrink: 0`) desbordaba a
   375 px. Arreglado con `--kb-key` fluida.
2. **La rejilla de wordle** (casillas de `3rem`): el backend sirve palabras de
   4 a 6 letras (`WORDLE_MIN_LEN`/`MAX_LEN`), y con 6 el tablero pide 320 px.
   En un móvil de 320 se comía los 24 px de padding y quedaba pegado a los dos
   bordes; por debajo de eso, scroll horizontal. Arreglado con `--wd-tile`
   fluida y `aspect-ratio: 1` para que la casilla siga cuadrada.
3. Crossword: **medido, está a salvo** — 256 px en 296 disponibles a 320 px,
   40 de holgura, y su rejilla es 5×5 fija en cliente y servidor, así que no
   puede crecer. No se tocó.

Lección de verificación, no de CSS: el bug 2 sobrevivió a la ronda anterior
porque el banco servía una palabra de 5 letras, que es justo la que entra.
**Cuando una medida depende de un dato del servidor, hay que probar los
extremos del rango, no un valor cualquiera.**

### Una trampa que se repite

El `transition` inline **pisa entero** al de la clase. `dots-pressable` define
`transition: transform 120ms, box-shadow 120ms, filter 150ms`, y el `style`
inline de la tecla traía su propio `transition: background 0.2s` — resultado:
la tecla se hundía de golpe, sin interpolar. Es el mismo mecanismo que hizo que
`dp-tremble` anulara el hinchado del globo en dont-pop (`3474b32`), solo que
allí era una animación pisando un transform inline y aquí es al revés.

**Regla**: al añadir `dots-pressable` a algo que ya tiene `transition` inline,
repite sus tres propiedades en el inline o no se moverá.
