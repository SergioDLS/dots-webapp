# 004 — HUD vivo: score pop, combo que crece, timer con pulso (dot-match)

- **Status**: DONE
- **Commit**: 16c5e4f
- **Severity**: MEDIUM
- **Category**: Missed opportunities
- **Estimated scope**: 2 archivos (`app/globals.css`, `app/(app)/games/dot-match/page.tsx`), ~25 líneas

## Problem

El loop central de recompensa es mudo en el HUD:

- El score (page.tsx:541-543) cambia de número sin ningún movimiento.
- El chip de combo (page.tsx:552-564) solo anima al montar (`combo` 0→1); de 2→3→4 el elemento persiste y el crecimiento es invisible.
- El timer (page.tsx:529-534) comunica urgencia solo con color (`--danger` a ≤10 s); fácil de no ver mientras miras el tablero.

## Target

1. Keyframes nuevos en la Motion library de `app/globals.css`:

```css
@keyframes dots-score-pop {
  0%   { transform: scale(1); }
  40%  { transform: scale(1.22); }
  100% { transform: scale(1); }
}

@keyframes dots-timer-pulse {
  0%, 100% { transform: scale(1); }
  50%      { transform: scale(1.1); }
}
```

2. Score — remontar el número por valor para relanzar el pop (el `span` externo conserva layout; `display: inline-block` para que `scale` aplique):

```tsx
<span className="font-display text-lg font-extrabold" style={{ color: "var(--accent)" }}>
  <span
    key={score}
    className="inline-block"
    style={{ animation: score > 0 ? "dots-score-pop 0.25s var(--ease-out-strong)" : "none" }}
  >
    {score}
  </span>
</span>
```

3. Combo — `key={combo}` en el chip existente para que `dots-pop-in 0.15s` se relance en cada incremento (el string de animación ya está en page.tsx:559; solo falta el key). El chip desaparece igual que hoy cuando `combo === 0`.

4. Timer — pulso de latido solo en zona crítica:

```tsx
<span
  className="font-display text-2xl font-extrabold tabular-nums"
  style={{
    color: timeColor,
    animation: timeLeft <= 10
      ? "dots-timer-pulse 1s ease-in-out infinite"
      : "none",
  }}
>
  {timeLeft}s
</span>
```

(El chequeo de `phase` sobra: este span solo se renderiza dentro del bloque
`phase === "playing"`. Tampoco necesita `inline-block`: es flex item de la
columna del HUD, ya es block-level para `transform`. El span interno del score
SÍ lleva `inline-block` porque vive dentro de otro span.)

## Repo conventions to follow

- Relanzar animación por remount con `key` es el patrón disponible sin libs (no hay Framer Motion en el repo).
- `dots-pop-in 0.15s ease-out both` del chip es convención existente (page.tsx:559) — no cambiar su curva, solo el key.
- Pulsos infinitos sutiles: exemplar `dots-float` (globals.css:256) usa `ease-in-out` — el timer-pulse igual.

## Steps

1. `app/globals.css`: añadir `dots-score-pop` y `dots-timer-pulse` a la Motion library.
2. `page.tsx`: score anidado con `key={score}` (Target §2).
3. `page.tsx`: `key={combo}` en el `<span>` del chip.
4. `page.tsx`: animación condicional del timer (Target §4).

## Boundaries

- NO tocar la fila "N/M parejas" ni el botón Salir.
- NO añadir sonido de tick (el audio del juego ya cubre correct/wrong; un tick por segundo sería ruido).
- Si el código no coincide con los excerpts, PARAR y reportar.

## Verification

- **Mechanical**: `source ~/.nvm/nvm.sh && npm run lint && npx tsc --noEmit` sin errores.
- **Feel check**: (a) cada match hace pop en el score sin mover el layout de la barra; (b) el 🔥 repite su pop en CADA incremento de combo, no solo el primero; (c) a ≤10 s el número late 1 vez/segundo y se detiene al cambiar de ronda o terminar; (d) los tres juntos no compiten — mirar 5 matches seguidos y confirmar que no se siente carnaval.
- **Done when**: score, combo y timer reaccionan; nada late fuera de la zona crítica.
