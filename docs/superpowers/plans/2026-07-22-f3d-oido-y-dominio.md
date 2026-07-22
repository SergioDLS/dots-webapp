# F3d — Oído + dominio (audio copiado + rediseño de lecciones) · Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans. Steps con checkbox (`- [ ]`). El único write a prod es el seed del Task 1 (copia de audio, llena solo NULL).

**Goal:** Que las lecciones de la sección 1 enseñen por el oído: letras y vocab con **escucha-y-selecciona**, números con escucha + emparejar, y **bucle de dominio** (fallos re-encolados hasta responder todo bien) en las tres. Audio 100% copiado de `words` — cero ElevenLabs.

**Architecture:** Task 1 = seed `copy-module-audio.js` (patrón F3b: dry-run/--apply/--rollback, idempotente, solo llena `audio IS NULL`). Tasks 2–4 = rediseño de los drills en `lesson/letters`, `lesson/numbers` y `lesson/vocab` (componentes existentes; mismas reglas RN-safe/compiler). Task 5 = verificación (lint+build front, integridad audio, preview).

## Global Constraints

- RN-safe (solo tap; audio solo tras gesto; animación transform/opacity) y compiler-safe (sin setState síncrono en efectos; fetchAttempt para retry) — CLAUDE.md.
- Audio: resolver rutas legacy contra `BASE_URL_SOUNDS` como `components/ui/sound/sound.tsx:62-65` (URL absoluta se usa tal cual). Letras/números copiarán URLs absolutas, pero el guard es barato.
- **Degradación sin audio:** ítems sin clip no entran a la ronda de escucha; caen a la variante visual (letras: nombre→letra; números: palabra→numeral; vocab: solo emparejar).
- Bucle de dominio: cada ítem fallado se re-encola al final; la lección cierra cuando TODOS quedaron respondidos correctamente; `times_wrong` acumulado se envía UNA vez (`putNodeProgressService`, guard con ref).
- Prod: seed con backup + rollback; `--apply` tras dry-run.

## Task 1: Seed copia de audio (backend, prod)

**Files:** Create `dots-backend/scripts/copy-module-audio.js`; Modify `dots-backend/package.json` (`"audio:copy-modules"`).

- [ ] **Step 1:** Harness patrón `seed-vocab-topup.js` (connect/.env/OUT_DIR/--apply/--rollback/backup). Lógica:
  - Letras: `UPDATE dots.letter_items li SET audio = w.audio FROM dots.words w WHERE w.level_id = '1' AND UPPER(w.text) = UPPER(li.letter) AND li.audio IS NULL AND w.audio IS NOT NULL AND w.audio <> '' RETURNING li.id` (registrar ids en backup).
  - Números: igual con `w.level_id = '2' AND LOWER(w.text) = LOWER(ni.word) AND ni.audio IS NULL` sobre `number_items`.
  - Dry-run: mismos JOINs con SELECT count. Rollback: `UPDATE ... SET audio = NULL WHERE id = ANY(backup.letterIds|numberIds)`.
- [ ] **Step 2:** Dry-run (`npm run audio:copy-modules`) → esperado: letters=26, numbers=10. `--apply` → verificación imprime cobertura (`letter_items 26/26 con audio, number_items 10/28`). Commit: `feat(seed): copia audio words→letter/number items`.

## Task 2: Lección letras — escucha-y-selecciona + dominio

**Files:** Modify `dots-webapp/app/(app)/lesson/letters/page.tsx`

- [ ] **Step 1:** Agregar helper local `resolveAudio(src)` (absoluta tal cual; si no, `${BASE_URL_SOUNDS}/${src}`; import de `@/constants`). Usarlo en todo `new Audio(...)`.
- [ ] **Step 2:** Rediseñar el drill:
  - **Etapa presentación** (nueva, breve): grid de tarjetas letra+nombre; tap reproduce el clip y marca vista (como el present de vocab). Botón "Practicar" habilitado al verlas todas (o "Saltar" si se prefiere ligero — usar visto ≥ 50%? NO: todas, consistente con vocab).
  - **Etapa drill (escucha-y-selecciona):** cola = ítems CON audio barajados; por turno: botón grande "🔊 Escuchar" (reproduce; auto-reproducir al montar el turno está prohibido — solo tap) + 4 opciones de LETRA (target + 3 distractores). Acierto → sale de la cola (verde 500ms); fallo → `times_wrong++`, rojo, y el ítem se **re-encola al final** (el usuario puede volver a escuchar). Ítems SIN audio (no debería haber tras Task 1): variante visual nombre→letra, misma cola.
  - **Cierre:** cuando la cola queda vacía, enviar `putNodeProgressService` una vez (ref guard) con `{id, times_wrong, answered:true}` por ítem; pantalla "¡Listo!" con aciertos a la primera (`X/N a la primera`).
- [ ] **Step 3:** `npm run lint` + `npx next build` verdes. Commit: `feat(lesson): letras escucha-y-selecciona con bucle de dominio`.

## Task 3: Lección números — escucha + emparejar + dominio

**Files:** Modify `dots-webapp/app/(app)/lesson/numbers/page.tsx`

- [ ] **Step 1:** Mismo `resolveAudio`. Drill en dos rondas con cola de dominio compartida (times_wrong por ítem):
  - **Ronda 1 (reconocimiento):** con audio → "🔊 Escuchar" + 4 numerales (oyes "seven" → tocas 7); sin audio → palabra escrita + 4 numerales (actual). Fallos se re-encolan.
  - **Ronda 2 (emparejar):** columnas numeral ↔ palabra (grupos de hasta 5, patrón `match-quiz` de vocab pero inline y simplificado: seleccionas uno de cada columna; correcto se apaga, error suma times_wrong). Al completar todos los pares, fin.
  - Enviar progreso una vez al terminar ronda 2; pantalla final con resumen.
- [ ] **Step 2:** lint + build. Commit: `feat(lesson): números escucha+emparejar con dominio`.

## Task 4: Lección vocab — ronda de escucha + dominio

**Files:** Modify `dots-webapp/components/lesson/vocab/vocab-pack.tsx`; Create `dots-webapp/components/lesson/vocab/listen-quiz.tsx`

- [ ] **Step 1:** Nuevo `listen-quiz.tsx` (`items`, `onWrong(itemId)`, `onProgress(pct)`, `onComplete`): cola barajada de ítems CON audio; por turno "🔊 Escuchar" (usa `Sound` o `new Audio` + resolve) + 4 opciones de **significado (ES)**; fallo re-encola + `onWrong`; sin-audio se saltan esta ronda. RN-safe.
- [ ] **Step 2:** En `vocab-pack.tsx`, nuevo flujo de stages: `present → listen → quiz(match) → summary`. `listen` solo si ≥4 ítems con audio (si no, va directo a match). `wrongByItem` compartido entre rondas (times_wrong suma de ambas). El envío de progreso ya ocurre once en summary — no tocar esa lógica.
- [ ] **Step 3:** lint + build. Commit: `feat(lesson): vocab ronda escucha-y-selecciona + dominio`.

## Task 5: Verificación final

- [ ] lint + `npx next build` (front) verdes; backend intacto (`tsc` si se tocó algo).
- [ ] Chequeo read-only: cobertura de audio (letter 26/26, number 10/28, vocab 361/367).
- [ ] Preview con servers arriba: `/lesson/letters?id=…` (escucha-y-selecciona con re-encolado), números, y un vocab con ronda de escucha. Confirmación del usuario.

## Self-Review
- Feedback cubierto: oído-primero (T2/T3/T4), emparejar con traducción (T3 ronda 2; vocab ya lo tenía), dominio ~90% vía re-encolado hasta acertar todo (T2-T4). ✓
- Créditos: cero (T1 solo copia; los 24 faltantes degradan — decidido). ✓
- Prod: un solo write (T1), aditivo sobre NULL, con backup/rollback. ✓
- Verb to be amplio → pertenece al plan del piloto sección 2 (no a F3d). Anotado en spec. ✓
