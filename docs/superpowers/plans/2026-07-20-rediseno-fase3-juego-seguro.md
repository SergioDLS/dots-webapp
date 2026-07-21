# Rediseño total — Fase 3: Juego seguro + explicar-fallo Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans. Steps con checkbox.

**Goal:** Hacer las lecciones más divertidas y educativas: celebración de fin por etapas, explicación al fallar, teclado en desktop, y fallo que re-encola (nunca gameover en el camino).

**Architecture:** Todo frontend salvo el `hint` de explicar-fallo (campo opcional derivado en el backend). El hook `useLessonSeries` gana un modo `requeue`. Un hook nuevo `useLessonKeys` centraliza el teclado. La celebración vive en `result-screen`/`reward-panel`.

**Tech Stack:** React 19, Next 16, hooks existentes, servicios `lessons.service` / `engagement.service`.

## Global Constraints
- Rama `redesign/total`. Reutilizar `useLessonSeries`, `ResultScreen`, `RewardPanel`.
- Sin gameover en lecciones del camino; vidas solo en checkpoints/arcade (Fase 5).
- UI en español. Verificación: build + snapshot/inspect (screenshot cuelga).

## Task 1: Celebración por etapas — ✅ HECHO (commit 7989bff)
- `result-screen.tsx`: español + revelado escalonado (título→Doty→mensaje→recompensa→CTA vía `animation-delay`).
- `reward-panel.tsx`: client con conteo animado de XP (easeOutCubic, rAF), chips escalonados, español, token `--flame`.

## Task 2: Teclado en lecciones (desktop) — PENDIENTE
**Files:** create `hooks/use-lesson-keys.ts`; wire en `app/(app)/lesson/{pronunciation,grammar,vocab}/page.tsx`, `components/practice-container/practice-container.tsx`, `components/checkpoint/checkpoint-exam.tsx`.
- [ ] `useLessonKeys({onEnter, onSelect(index), onReplay, enabled})` — keydown global; ignora inputs/textarea; `Enter`→onEnter (confirmar/continuar), `1-9`→onSelect(n-1), `Ctrl/Cmd+Space`→onReplay (audio). Cleanup en unmount.
- [ ] Wire en cada flujo: mapear onSelect a la selección de opción, onEnter a confirmar/next, onReplay al botón de audio. Hints visuales sutiles (número en la esquina de cada opción en desktop).
- [ ] Verificar en preview (teclado) + build. Commit `feat(lesson): atajos de teclado`.

## Task 3: Fallo infinito (re-encolado) en el camino — PENDIENTE
**Files:** modify `hooks/use-lesson-series.ts`; usar `requeue` en los 3 flujos de lección del camino (NO en checkpoint/arcade).
- [ ] Añadir opción `mode: "hearts" | "requeue"`. En `requeue`: al fallar, no bajar vidas; re-encolar el ítem actual al final de una cola interna (estado), y `finished` solo cuando la cola se vacía con todos acertados. Mantener `hearts` para stakes.
- [ ] La cola interna: copiar `items` a estado; `next()` avanza; si el ítem se falló, reinsertarlo al final. `summary` cuenta intentos.
- [ ] Wire: los 3 flujos del camino usan `mode:"requeue"`; checkpoint/arcade siguen con `hearts`.
- [ ] Verificar (fallar un ítem → reaparece; acertar todo → termina) + build. Commit `feat(lesson): fallo re-encola en el camino, sin gameover`.

## Task 4: Explicar al fallar (C8, lever educativo) — ✅ HECHO (commits 8b395b7 backend, bdea7b6 frontend)
Alcance entregado: gramática + pronunciación (donde hay regla/contraste explicable). Backend deriva `hint` (grammar: bloque tip/example de la píldora; pronunciation: palabra + sonido del par mínimo) y lo expone en `node-content` + `path.dto`. Frontend: `ExplanationHint` (panel 💡); grammar-pill lo muestra bajo el feedback antes de "Continuar"; pronunciation-drill se detiene al fallar, muestra el hint y espera "Continuar" (el acierto sigue avanzando rápido). Vocab (matching) queda fuera: el emparejamiento se explica solo. Practice (oraciones) queda para una pasada futura (máquina de estados propia; hint = traducción).

### Detalle original (referencia)
**Files (backend):** `dots-backend/src/modules/path/node-content.service.ts` + DTOs — añadir `hint?: string` por ítem (derivado): grammar → bloque `tip`/`example` de la píldora; sentence/practice → traducción; vocab → significado+ejemplo; pronunciation → contraste del par mínimo templado. **Files (frontend):** `components/lesson/answer-flash.tsx` o un panel nuevo `explanation-hint.tsx`; consumir en los flujos.
- [ ] Backend: extender el contenido de nodo con `hint` opcional por ítem (degradar a "Respuesta correcta: X" si no hay). Tests del derivador.
- [ ] Frontend: al `answerState==="wrong"`, mostrar panel breve con el hint + respuesta correcta; cerrar con Enter/tap. No bloquea el ritmo.
- [ ] Verificar E2E (fallar → aparece explicación) + build. Commit `feat(lesson): explicación al fallar (backend hint + panel)`.

## Self-Review
- Cubre C1 (celebración ✅), C7 (teclado, Task 2), C5 (re-encolado, Task 3), C8 (explicar-fallo, Task 4) del spec.
- Riesgo: `practice-container` tiene su propia máquina de estados (no usa `useLessonSeries`) — el teclado y el requeue ahí requieren adaptación específica; el camino usa los flujos nuevos que sí usan el hook.
- Backend hint (Task 4) es el único cambio no-frontend de la fase; sigue la política de contratos aditivos.
