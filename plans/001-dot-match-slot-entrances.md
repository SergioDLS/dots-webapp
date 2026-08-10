# 001 — Entrada física de slots + stagger de tablero (dot-match)

- **Status**: DONE
- **Commit**: 16c5e4f
- **Severity**: HIGH
- **Category**: Physicality & origin / Missed opportunities / Cohesion & tokens
- **Estimated scope**: 2 archivos (`app/globals.css`, `app/(app)/games/dot-match/page.tsx`), ~30 líneas

## Problem

Los slots del tablero se teletransportan. Cada botón usa `key={`left-${idx}-${slot.pairId}`}` (page.tsx:576 y 616), así que al rellenar un hueco tras un match React monta un nodo NUEVO que aparece a opacidad 1 sin transición alguna. Lo mismo pasa con el tablero completo al empezar ronda: los 10 slots aparecen de golpe. Nada en el mundo real aparece de la nada; en un juego jugable ~75 veces por partida el teletransporte se siente barato.

```tsx
// app/(app)/games/dot-match/page.tsx:587-597 — actual (rama no-leaving, no-shake)
opacity: slot.leaving ? 0 : 1,
transform: slot.leaving ? "scale(0.8)" : shaking ? "translateX(4px)" : "scale(1)",
transition: slot.leaving
  ? "opacity 0.25s ease, transform 0.25s ease"
  : shaking
    ? "transform 0.05s ease"
    : "border-color 0.15s, background 0.15s, opacity 0.25s, transform 0.25s",
```

Además el repo no tiene tokens de easing: todo usa `ease`/`ease-out` nativos, demasiado débiles para movimiento deliberado.

## Target

1. Tokens de easing en `:root` de `app/globals.css` (junto a los demás tokens, antes de `@theme inline` en la línea 87):

```css
/* Curvas de movimiento — fuertes, para motion deliberado */
--ease-out-strong: cubic-bezier(0.23, 1, 0.32, 1);
--ease-in-out-strong: cubic-bezier(0.77, 0, 0.175, 1);
```

2. Keyframe de entrada en la sección `/* ─── Motion library ─── */` de `app/globals.css` (familia `dots-*`):

```css
@keyframes dots-slot-in {
  0%   { transform: scale(0.9) translateY(6px); opacity: 0; }
  100% { transform: scale(1) translateY(0); opacity: 1; }
}
```

3. Cada slot monta con `animation: dots-slot-in 0.22s var(--ease-out-strong) <delay> backwards`, donde `<delay>` es `idx * 45ms` SOLO en reparto inicial de tablero (inicio de partida y de ronda) y `0ms` en refills tras match. El fill DEBE ser `backwards` (no `both`/`forwards`): un fill persistente pisaría la transición de salida `leaving` (las animaciones ganan a las transitions en la cascada).

4. Para distinguir reparto inicial de refill, el tipo `Slot` (page.tsx:49-54) gana un campo `stagger: number` — índice de fila en reparto inicial, `0` en refills:

```tsx
type Slot = {
  pairId: number;
  text: string;
  side: "en" | "es";
  leaving: boolean;
  stagger: number; // fila para el delay de entrada; 0 = refill sin delay
};
```

`buildColumn` asigna `stagger: idx` (nota: la columna derecha se baraja DESPUÉS de construirse, así que su stagger queda desordenado — es deseable, cae en cascada aleatoria). Los refills dentro del `setTimeout` de `processMatch` (page.tsx:283-298) crean el slot con `stagger: 0`.

5. En el botón, la animación de entrada solo aplica si el slot no está saliendo,
   no está temblando (plan 003 usa esa rama) y no ha temblado antes — si el
   string de `animation` vuelve a cambiar a la entrada tras un shake, el navegador
   la trata como animación nueva y la REPRODUCE otra vez. Para eso `Slot` gana
   también `shaken: boolean` (false en deals/refills; `processMatch` lo pone a
   true en ambos slots de un fallo):

```tsx
animation: slot.leaving
  ? "none"
  : shaking
    ? "dots-shake-x 0.4s var(--ease-out-strong)"
    : slot.shaken
      ? "none"
      : `dots-slot-in 0.22s var(--ease-out-strong) ${slot.stagger * 45}ms backwards`,
```

## Repo conventions to follow

- Keyframes compartidos viven en `app/globals.css` bajo `/* ─── Motion library ─── */` con prefijo `dots-` (exemplar: `dots-pop-in`, globals.css:245).
- Animación por style inline con string completo (exemplar: page.tsx:498 `animation: "dots-pop-in 0.3s ease-out both"`).
- Solo `transform`/`opacity` en keyframes (regla RN-safe del CLAUDE.md).

## Steps

1. `app/globals.css`: añadir los dos tokens `--ease-out-strong` / `--ease-in-out-strong` al final del bloque `:root` (línea ~85, antes de `@theme inline`).
2. `app/globals.css`: añadir `@keyframes dots-slot-in` tras `dots-slide-up` (línea ~255).
3. `page.tsx`: ampliar `type Slot` con `stagger: number`; `buildColumn` asigna `stagger: idx`; los dos refills en `processMatch` pasan `stagger: 0`.
4. `page.tsx`: añadir la propiedad `animation` (código del Target §5) al `style` de ambos botones (columnas izquierda y derecha).

## Boundaries

- NO tocar `GameIntro`/`GameResult` ni otros juegos.
- NO cambiar la lógica de juego (cola, recycler, score) — solo el campo `stagger` y estilos.
- NO añadir dependencias.
- Si el código no coincide con los excerpts (drift), PARAR y reportar.

## Verification

- **Mechanical**: `source ~/.nvm/nvm.sh && npm run lint && npx tsc --noEmit` sin errores.
- **Feel check**: en el juego, (a) al empezar partida los 10 slots caen en cascada (~45ms entre filas) sin bloquear taps; (b) tras un match, las dos palabras nuevas entran con pop sutil SIN delay; (c) el slot que sale (correcto) sigue desvaneciéndose — si se queda visible clavado, el fill de la animación está pisando la transición (debe ser `backwards`).
- **Done when**: entrada visible en cascada al inicio de ronda + refills animados sin delay + salida de matches intacta.
