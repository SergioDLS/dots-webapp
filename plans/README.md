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

Pendientes de auditoría: audio-blitz, crossword, dont-pop, dotaxi, ghost-race,
memory, sentence-builder, true-false, wordle, word-tower.

Retirados el 2026-08-10 (récords purgados con backup en
`dots-backend/scripts/out/`): flashcards, speed-round. dot-bombs fue reconstruido como anagrama tap (2026-08-10) — pendiente solo su pasada de certificación estándar.
