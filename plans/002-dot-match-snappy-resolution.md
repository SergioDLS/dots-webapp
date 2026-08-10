# 002 — Resolución de match más rápida + tinte de acierto (dot-match)

- **Status**: DONE
- **Commit**: 16c5e4f
- **Severity**: HIGH
- **Category**: Purpose & frequency / Easing & duration
- **Estimated scope**: 1 archivo (`app/(app)/games/dot-match/page.tsx`), ~15 líneas

## Problem

Cada match correcto bloquea TODO el tablero 250 ms (`processingRef` + `setTimeout(…, 250)`, page.tsx:281-322) mientras las dos tarjetas salen con `transition … 0.25s ease`. En una partida se hacen 60-75 matches contrarreloj: son ~15-19 s acumulados de tablero muerto por partida. Es fricción de alta frecuencia — la categoría donde la auditoría manda recortar drásticamente. Además la salida no comunica "acierto": las tarjetas solo se encogen y desvanecen, sin color de éxito.

```tsx
// page.tsx:322 — actual
}, 250); // matches the CSS transition duration
```

```tsx
// page.tsx:593-597 — actual (transición de salida y estados)
transition: slot.leaving
  ? "opacity 0.25s ease, transform 0.25s ease"
  : shaking
    ? "transform 0.05s ease"
    : "border-color 0.15s, background 0.15s, opacity 0.25s, transform 0.25s",
```

## Target

- Constante nueva junto a `SHAKE_MS` (page.tsx:30): `const LEAVE_MS = 160;`
- El `setTimeout` del refill usa `LEAVE_MS` (comentario incluido: `// matches the CSS leave transition`).
- Salida en 160 ms con curva fuerte, y tinte de éxito mientras sale (un slot solo tiene `leaving: true` tras un match correcto, así que el tinte es inequívoco):

```tsx
// dentro del style de ambos botones (izquierda y derecha)
borderColor: slot.leaving
  ? "var(--success)"
  : selected
    ? "var(--accent)"
    : "var(--border)",
background: slot.leaving
  ? "color-mix(in srgb, var(--success) 18%, transparent)"
  : selected
    ? "color-mix(in srgb, var(--accent) 12%, transparent)"
    : "var(--surface)",
transform: slot.leaving ? "scale(0.8)" : undefined,
transition: slot.leaving
  ? "opacity 0.16s var(--ease-out-strong), transform 0.16s var(--ease-out-strong), border-color 0.1s, background 0.1s"
  : "border-color 0.15s, background 0.15s, transform 120ms ease",
```

(La rama `shaking` de `transform`/`transition` desaparece en el plan 003; si 003 aún no se aplicó, conservarla tal cual está.)

Nota descubierta al ejecutar: el código original ponía `transform: "scale(1)"`
como base — un transform inline SIEMPRE pisa el `translateY(4px)` del selector
`:active` de `.dots-pressable`, así que los slots no se hundían al presionar.
El Target deja `transform: undefined` fuera de `leaving` para restaurar el
press físico, y la rama no-leaving transiciona `transform 120ms ease` (mismo
timing que `.dots-pressable`, globals.css:229). La entrada de `opacity` en esa
rama era peso muerto (opacity solo cambia al salir, y en ese render ya rige la
rama `leaving`): eliminada.

## Repo conventions to follow

- Tokens de color semánticos ya existen: `--success` (globals.css:47 claro, :126 oscuro); exemplar de uso con `color-mix`: page.tsx:556.
- `var(--ease-out-strong)` la crea el plan 001 (dependencia).

## Steps

1. `page.tsx`: añadir `const LEAVE_MS = 160;` junto a las constantes (línea ~30) y reemplazar `250` por `LEAVE_MS` en el `setTimeout` (línea 322).
2. `page.tsx`: en ambos botones, aplicar `borderColor`/`background`/`transition` del Target.
3. Nada más: `processingRef` y la lógica de refill quedan intactos.

## Boundaries

- NO eliminar el lock global `processingRef` (evita dobles matches sobre índices en tránsito) — solo se acorta la ventana.
- NO tocar la lógica de rondas/banner dentro del mismo `setTimeout`.
- NO añadir dependencias.
- Si el código no coincide con los excerpts, PARAR y reportar.

## Verification

- **Mechanical**: `source ~/.nvm/nvm.sh && npm run lint && npx tsc --noEmit` sin errores.
- **Feel check**: encadenar 3-4 matches rápidos — el tablero debe sentirse "al toque", sin la pausa gomosa tras cada acierto; las tarjetas acertadas se tiñen de verde mientras salen; el refill sigue llegando al hueco correcto (misma fila).
- **Done when**: no hay tablero bloqueado perceptible entre matches y el acierto se lee en verde.
