# 003 — Shake real en fallo (dot-match)

- **Status**: DONE
- **Commit**: 16c5e4f
- **Severity**: HIGH
- **Category**: Feedback / Cohesion
- **Estimated scope**: 2 archivos (`app/globals.css`, `app/(app)/games/dot-match/page.tsx`), ~20 líneas

## Problem

El "temblor" de fallo no tiembla: es un desplazamiento estático de 4 px que se queda congelado 500 ms y luego vuelve. page.tsx:588-597 mueve a `translateX(4px)` con `transition: transform 0.05s ease` y `SHAKE_MS = 500` (page.tsx:30) lo mantiene ahí. El intro promete "un pequeño temblor" (page.tsx:481) — la promesa no se cumple. En `globals.css:346` ya existe `pc-wrong-shake` (familia practice) con el patrón correcto de oscilación decreciente, pero los juegos no tienen equivalente compartido.

```tsx
// page.tsx:588-592 — actual
transform: slot.leaving
  ? "scale(0.8)"
  : shaking
    ? "translateX(4px)"
    : "scale(1)",
```

## Target

1. Keyframe compartido en la Motion library de `app/globals.css` (misma forma que `pc-wrong-shake`, globals.css:346-352, promovido a la familia `dots-*`):

```css
@keyframes dots-shake-x {
  0%, 100% { transform: translateX(0); }
  20%      { transform: translateX(-6px); }
  40%      { transform: translateX(6px); }
  60%      { transform: translateX(-4px); }
  80%      { transform: translateX(4px); }
}
```

2. `page.tsx`: `SHAKE_MS` pasa de `500` a `400` (duración exacta de la animación; el timer solo limpia el estado `shake`).

3. En ambos botones: la rama `shaking` deja de vivir en `transform`/`transition` y pasa a `animation`:

```tsx
transform: slot.leaving ? "scale(0.8)" : undefined,
animation: slot.leaving
  ? "none"
  : shaking
    ? "dots-shake-x 0.4s var(--ease-out-strong)"
    : slot.shaken
      ? "none"
      : `dots-slot-in 0.22s var(--ease-out-strong) ${slot.stagger * 45}ms backwards`,
```

(Si el plan 001 no se aplicó aún, la rama final es `"none"`.) Al terminar el
keyframe vuelve a 0 — sin fill, sin estados colgados. Matiz crítico: cuando el
shake termina y `animation` volvería al string de entrada, el navegador la
reproduciría de nuevo (cambio de valor = animación nueva). Por eso `Slot` lleva
`shaken: boolean` y el fallo lo marca en ambos slots (ver `processMatch`):

```tsx
setShake({ left: lIdx, right: rIdx });
setLeftCol((prev) => prev.map((s, i) => (i === lIdx ? { ...s, shaken: true } : s)));
setRightCol((prev) => prev.map((s, i) => (i === rIdx ? { ...s, shaken: true } : s)));
```

Fallar dos veces seguidas sobre el mismo slot dentro de los 400 ms no reinicia la animación (mismo string) — aceptable: el timer de `SHAKE_MS` rearma el estado y el caso real es raro.

## Repo conventions to follow

- Exemplar del patrón de oscilación: `pc-wrong-shake` en globals.css:346-352 (no tocarlo: la familia `pc-*` es de practice/lesson).
- Sonido de fallo ya existe (`playSound("wrong")`, page.tsx:325) — no duplicar feedback de audio.

## Steps

1. `app/globals.css`: añadir `@keyframes dots-shake-x` tras `dots-slot-in` (plan 001) o tras `dots-slide-up` si 001 no está.
2. `page.tsx`: `SHAKE_MS = 400`.
3. `page.tsx`: en ambos botones aplicar el bloque del Target §3 (quitar `translateX(±4px)` y la rama `shaking` de `transition`).

## Boundaries

- NO tocar `pc-wrong-shake` ni sus usuarios.
- NO cambiar la lógica de `setShake`/`shakeTimerRef`.
- Si el código no coincide con los excerpts, PARAR y reportar.

## Verification

- **Mechanical**: `source ~/.nvm/nvm.sh && npm run lint && npx tsc --noEmit` sin errores.
- **Feel check**: forzar un fallo — ambas tarjetas oscilan ±6 px decreciendo durante 0.4 s y quedan en reposo exacto (sin offset residual). Con DevTools → Animations al 10 %, confirmar que la oscilación decrece (6→4 px) y termina en `translateX(0)`.
- **Done when**: el fallo se siente como sacudida breve, no como empujón congelado.
