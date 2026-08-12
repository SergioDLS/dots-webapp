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

- `globals.css:391` — el bloque `prefers-reduced-motion` aniquila TODA
  animación/transición (0.01 ms). Lo correcto es conservar feedback de opacidad
  y quitar solo desplazamientos. Es decisión global de la app, no de un juego:
  tratarlo en una pasada propia.
- `GameResult` (shared) — candidato a count-up del score y stagger ya presente;
  tocarlo afecta a los 14 juegos a la vez: dejarlo para el final del barrido.
- Banner de ronda — sale por unmount seco; se compensa con el stagger de
  entrada del tablero (001). Revisitar solo si tras el piloto aún se siente brusco.

## Próximos juegos (barrido "uno por uno")

Pendientes de auditoría: audio-blitz, crossword, dont-pop, dotaxi, true-false,
wordle, word-tower.

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
