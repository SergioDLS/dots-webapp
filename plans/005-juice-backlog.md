# 005 — Backlog de juice (auditoría 2026-08-12)

- **Status**: TODO (2 ítems ya hechos, ver abajo)
- **Método**: auditoría con la vara de `improve-animations` sobre los 7 juegos
  que aún no habían tenido pasada de juice.
- **Restricción**: animación solo `transform`/`opacity`. Reutilizar la Motion
  library de `app/globals.css` antes que inventar keyframes.

## Dato transversal

En audio-blitz, true-false, word-tower, sentence-builder, ghost-race, crossword
y wordle hay **cero usos** de `dots-shake-x`, `dots-slot-in` y
`dots-timer-pulse`. Los keyframes existen y están probados en dot-match y
dot-bombs, pero ninguno de estos siete los toca. La mayor parte del backlog es
*aplicar lo que ya está escrito*, no diseñar nada nuevo.

## Hecho

- ✅ **`GameResult`: el marcador sube contando** (`56dbb40`). Afecta a los 12
  juegos a la vez. `hooks/use-count-up.ts` no anima CSS (solo emite números,
  portable a RN) y respeta `prefers-reduced-motion` devolviendo el valor final
  de inmediato. Verificado: 0 → 417 → 1480, creciente y exacto.
- ✅ **dont-pop: el temblor anulaba el hinchado** (`3474b32`). `dp-tremble`
  define `transform: rotate()` y una animación gana al style attribute, así que
  por encima del 72 % de presión el globo perdía su `scale` justo en el tramo de
  máxima tensión. Temblor y escala viven ahora en capas distintas.

## Top 8 por impacto (orden de ataque)

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

- **Entradas sin escalonar**: opciones de audio-blitz (`413-430`) y de
  ghost-race (`640-657`), pool de sentence-builder (`608-624`), rejilla de
  crossword al cargar (`622-660`). Todos → `dots-slot-in` con delay por índice.
- **Chips que solo animan al montar**: combo de word-tower (`455-469`, le falta
  `key={combo}`) y multiplicador de true-false (`380-393`, sin `key` ni
  animación).
- **Timers sin pulso en zona crítica**: audio-blitz (`370-378`, además anima
  `width`) y true-false (`358-363`). → `dots-timer-pulse` + `scaleX`.
- **Escribir no da feedback**: celdas de crossword (`219-228`) y casillas de
  wordle (`52-90`); las teclas de `DailyKeyboard` no usan `dots-pressable`.
- **Keyframes duplicados que deberían morir**: `wordle-shake`
  (`wordle/page.tsx:359-365`) es copia literal de `dots-shake-x`; `cw-pop`
  (`crossword/page.tsx:518-525`) lo es de `dots-pop-in`; `spin` está duplicado
  en ambos diarios.
- **wordle — el error de red se ve idéntico a "palabra incompleta"**
  (`207-234`): el `catch` dispara el mismo shake de 400 ms que la validación
  local. Dos causas distintas, feedback indistinguible.

## Cómo atacarlo

Cada ítem del top 8 es autocontenido y cabe en un commit. El orden propuesto ya
está por impacto. Los MEDIO/BAJO agrupados se prestan a una sola pasada
mecánica (aplicar `dots-slot-in`/`key=`/`dots-timer-pulse` donde falta y borrar
los keyframes duplicados).
