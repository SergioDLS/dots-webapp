# Planes de animación — dots-webapp

Backlog de mejoras de motion generado con la metodología `improve-animations`
(auditoría → planes autocontenidos). Cada plan es ejecutable sin contexto de la
conversación que lo creó. Restricción transversal: **RN-safe** — keyframes solo
con `transform`/`opacity`, sin canvas, sin keydown (regla 2 del CLAUDE.md).

## Piloto: dot-match

| # | Plan | Severidad | Status |
| --- | --- | --- | --- |
| 001 | [Entrada física de slots + stagger](001-dot-match-slot-entrances.md) | HIGH | DONE |
| 002 | [Resolución de match 250→160 ms + tinte de acierto](002-dot-match-snappy-resolution.md) | HIGH | DONE |
| 003 | [Shake real en fallo](003-dot-match-wrong-shake.md) | HIGH | DONE |
| 004 | [HUD vivo: score/combo/timer](004-dot-match-hud-feedback.md) | MEDIUM | DONE |

**Orden recomendado**: 001 → 002 → 003 → 004. El 001 crea los tokens
`--ease-out-strong`/`--ease-in-out-strong` y el campo `Slot.stagger` que 002 y
003 referencian; 004 es independiente pero reutiliza los tokens.

## Hallazgos aparcados (fuera del piloto)

- `prefers-reduced-motion` — RESUELTO el 2026-08-12. El bloque mataba TODA
  animación y transición (0.01 ms), dejando la app muda para quien activa la
  preferencia. Ahora los keyframes siguen anulados (todos los nuestros mueven
  algo) pero `transition-property` se restringe a opacidad/color/borde/sombra/
  filtro: el movimiento desaparece y el feedback de "acertaste/fallaste" se
  conserva con su duración normal. Verificado en navegador: `transform` sale de
  la lista de propiedades transicionables y los keyframes quedan en 1e-05s.
- `GameResult` (shared) — candidato a count-up del score y stagger ya presente;
  tocarlo afecta a los 14 juegos a la vez: dejarlo para el final del barrido.
- Banner de ronda — sale por unmount seco; se compensa con el stagger de
  entrada del tablero (001). Revisitar solo si tras el piloto aún se siente brusco.

## Próximos juegos (barrido "uno por uno")

Pendientes de auditoría: dont-pop (legacy — es rediseño, no certificación).

Dotaxi 2.0 (2026-08-12): rediseñado a carriles progresivos 2→3→4 por aciertos y
hecho RN-safe — fuera el keydown como input, fuera Web Audio, el taxi y la
carretera pasan a transform, confirmar es un botón «¡Vamos!» separado de mover
(antes un tap mal apuntado respondía), mazo barajado con seed, y el bug de banco
vacío cerrado. Spec en
`docs/superpowers/specs/2026-08-12-dotaxi-carriles-progresivos.md`.
Con esto NO queda ningún juego que bloquee la app RN salvo dont-pop.

Retirados el 2026-08-10 (récords purgados con backup en
`dots-backend/scripts/out/`): flashcards, speed-round. dot-bombs fue reconstruido como anagrama tap (2026-08-10) — pendiente solo su pasada de certificación estándar. Diferidos anotados de la review final: ignorar taps durante la transición de bandeja (~200 ms), pop de salida de bomba desactivada, y tamaño adaptativo de fichas para palabras largas.

Constructor (sentence-builder) fue diferenciado del buildUp de la práctica el
2026-08-10 (bonus por tiempo + señuelos cruzados; spec en
`docs/superpowers/specs/2026-08-10-constructor-diferenciacion.md`) — pendiente
solo su pasada de juice.

Carrera Fantasma (ghost-race) certificada el 2026-08-10: cerrado el exploit del
timeline (solo registraba aciertos, así que fallar a propósito reportaba
duraciones imbatibles), salir dejó de postear carreras truncadas, el
`dangerouslySetInnerHTML` pasó a JSX (RN-portable) y las barras miden contra
longitudes reales en vez de un 12 hardcodeado. Decisión de producto: se queda
como juego separado de audio-blitz pese a compartir banco y bucle — su endpoint
server-side (/ghost/run) premia distinto. Pendiente su pasada de juice.

Escucha Rápida (audio-blitz) certificada el 2026-08-10: `dangerouslySetInnerHTML`
→ JSX y centinela `__TIMEOUT__` fuera del estado de la frase (mismos gemelos que
ghost-race), torneo/reto solo aceptan partidas completas (salir quemaba el
intento del 1v1; el parcial sí sigue contando para el récord personal, que sube
desde 0), y el acierto por fin tiene el feedback que un comentario prometía y no
existía: chip "+N" verde y pop del marcador.

Mini Crucigrama (crossword) certificado el 2026-08-10: el botón Comprobar con 0
restantes seguía posteando al servidor (ahora `disabled` + guard de `checksLeft`
en `handleCheck`), el fallo de red era invisible (ahora aviso con `role=status`
que se limpia al reintentar), la fórmula de score duplicada quedó en un helper
`crosswordScore` documentado con su fuente en el backend, la cuenta atrás bajó a
1 s de resolución y murió una ref sin lectores. Pendiente su pasada de juice.

## Transversales pendientes

### Farmeo por `?seed=` — CERRADO el 2026-08-12

Regla fijada: **el seed solo se honra en modo competitivo** (`?tournament=1` o
`?challenge=<id>`); en juego libre se ignora y el mazo es aleatorio. Se eligió
frente a "aceptarlo pero no puntuar" porque esa alternativa obligaba a
distinguir partidas puntuables de las que no en seis sitios distintos — la misma
clase de complejidad repartida que ya costó cinco bugs con el guard del reto.

Implementado en `hooks/use-game-seed.ts` (`useGameSeed()`), consumido por los
seis juegos seedables, que antes repetían el mismo lector de 5 líneas. El hook
además descarta valores no finitos, así que un `?seed=abc` deja de propagar
`NaN` a los fetchers. Verificado en navegador los cinco casos: libre+seed →
ignorado; torneo → honrado; reto → honrado; seed no numérico → undefined;
`seed=0` en torneo → honrado (un `||` lo habría descartado por falsy).

Palabra del Día (wordle) certificada el 2026-08-10, con la extracción del
teclado compartido incluida: `components/games/shared/daily-keyboard.tsx`
(`DailyKeyboard`, parametrizado por `marks`/`showEnter`/`size`) y
`lib/daily-games.ts` (`secondsUntilMidnightUTC`, `formatCountdown`) sustituyen
las copias literales que había en wordle y crossword. Arreglos propios de
wordle: el `maxTries` del servidor por fin manda (un 6 hardcodeado dibujaba la
cuadrícula), el fetch duplicado pasó a un solo efecto con `fetchAttempt`, la
cuenta atrás ya no parpadea "ya disponible" en su primer frame, `bestMark`
devuelve `Mark` (el `?? m` era código muerto) y murió una ref sin lectores.
Pendiente su pasada de juice.

¿Verdad o Trampa? (true-false) certificada el 2026-08-10: el reloj seguía vivo
sobre la pantalla de resultado (`stop` de useCountdown no se desestructuraba),
torneo y reto solo aceptan partidas completas (salir quemaba el intento del
1v1), agotar el mazo termina la partida en vez de obligar a mirar el reloj
bajar, los dos Salir pasan a `onPointerUp` como el resto del archivo, y murió
una ref sin lectores. Pendiente su pasada de juice.

Torre de Palabras (word-tower) certificada el 2026-08-10: `handleMissStable`
ejecutaba efectos colaterales DENTRO del updater de `setLives` (violaba la regla
3 y StrictMode podía restar dos vidas por fallo) — ahora decide con un
`livesRef` fuera del updater; los cinco `timerRef.current = setTimeout` sin
limpiar pasaron por un helper `scheduleTimer`; la revancha rebaraja las rondas
(sin seed) en vez de repetir el mismo orden memorizable; `TOTAL_ROUNDS` cede
ante `rounds.length` (con mazo corto el juego encadenaba fallos automáticos); y
torneo/reto solo aceptan partidas completas. Pendiente su pasada de juice.

### Guard del reto 1v1 — CERRADO el 2026-08-10

El no-rearme de `useChallengeMode` es DELIBERADO y está documentado (en un reto
la primera partida es la que cuenta; el backend responde 409 a repetidos): el
bug vivía en los sitios de llamada, que enviaban partidas abandonadas. Arreglo
de raíz: `submitChallengeScore(score, { completed })` con el segundo argumento
OBLIGATORIO — TypeScript rompe en los seis consumidores hasta que cada uno
declare qué significa "completa" en su juego, y un juego nuevo no puede
olvidarse por omisión. El hook además ignora los envíos con `completed: false`.
Último consumidor con el agujero abierto (dot-match) corregido en la misma
tanda.
