# F3e — Dominio por ítem + sesiones por tramos + autoplay + ronda inversa · Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans. Steps con checkbox (`- [ ]`). El único write a prod es la migración aditiva del Task 1 (crea tabla + columna, no toca datos).

**Goal:** Progreso de práctica **por ítem** persistente (aprendida = racha ≥2 o 3 aciertos; a-reforzar = falló y no domina), lecciones que entregan el contenido en **tramos de 6–7**, **autoplay** del audio, y **ronda inversa** (ver texto → elegir audio). Cubre letters, numbers y vocab (months/days/seasons/etc. son vocab packs → quedan cubiertos sin trabajo por tema). Completitud en **dos niveles**: el nodo se completa (y desbloquea el camino) al responder todo 1×; la **corona** aparece al dominar el 100%.

**Architecture:** Task 1 = migración aditiva (`dots.item_progress` + `node_progress.mastery`). Task 2 = backend (upsert por ítem espejando `sentences_progress`, progress/mastery leídos de `item_progress`, fix del 400 de letters/numbers, gemas 1×/día, contenido con dominio por ítem, `mastery` en `GET /path`). Tasks 3–6 = front (hook de sesión compartido + rework de las 3 lecciones + corona en el camino). Task 7 = verificación end-to-end.

## Global Constraints

- RN-safe + compiler-safe (CLAUDE.md): solo tap, sin setState síncrono en efectos (fetchAttempt), sin efectos en updaters, animación transform/opacity.
- **Autoplay legal:** el tap de "Practicar" activa el origen; los `play()` posteriores (montaje de turno, acierto) salen de cadenas iniciadas por gesto (timeouts de handlers) — mismo principio que `GameIntro`. UN solo `Audio` reutilizado vía ref (nunca clips solapados).
- Semántica de dominio = la de `sentences_progress` (`sentences.service.ts:244-274`): `answered → times_correct++`, `times_wrong += n`, `streak = (n==0 ? streak+1 : 0)`, `done ||= streak>=2 || times_correct>=3`. No inventar otra.
- Prod compartida: migración idempotente con backup/rollback (patrón `migrate-learning-path.js`); DDL solo aditivo.
- Degradación sin audio: ítems sin clip no entran a rondas de escucha; inversa se salta si el tramo tiene <2 clips.

## Task 1: Migración `item_progress` + `mastery` (backend, prod)

**Files:** Create `dots-backend/scripts/migrate-item-progress.js`; Modify `dots-backend/package.json` (`"migrate:item-progress"`).

- [ ] **Step 1:** Script patrón migrate (connect/.env, dry-run/--apply/--rollback, backup JSON en `scripts/out/`):
  - `CREATE TABLE IF NOT EXISTS dots.item_progress (id bigserial PK, user_id int NOT NULL, item_type varchar(16) NOT NULL, item_id int NOT NULL, times_correct int DEFAULT 0, times_wrong int DEFAULT 0, streak smallint DEFAULT 0, done bool DEFAULT false, created_at timestamptz DEFAULT now(), updated_at timestamptz, UNIQUE (user_id, item_type, item_id))` + índice por `(user_id, item_type)`.
  - `ALTER TABLE dots.node_progress ADD COLUMN IF NOT EXISTS mastery int DEFAULT 0`.
  - Rollback: `DROP TABLE IF EXISTS dots.item_progress` + `ALTER TABLE dots.node_progress DROP COLUMN IF EXISTS mastery` (el backup registra qué creó para no dropear algo preexistente).
- [ ] **Step 2:** Dry-run → `--apply` contra prod (aditivo; el backend viejo en Render no referencia nada de esto → inocuo). Commit back: `feat(db): tabla item_progress + node_progress.mastery (migracion aditiva)`.

## Task 2: Backend — progreso por ítem, dos niveles, gemas 1×/día, contenido con dominio

**Files:** Create `src/common/entity/item_progress.entity.ts`, `src/common/repository/item_progress.repository.ts`; Modify `src/modules/path/node-progress.service.ts`, `node-progress.dto.ts` (respuesta += `mastery`), `node-content.service.ts`, `path.controller.ts`, `path.service.ts`, `path.dto.ts`, `path.module.ts` (registrar repo).

- [ ] **Step 1:** Entidad + repo `ItemProgress` (espejo de `sentences_progress` con `itemType`/`itemId`).
- [ ] **Step 2:** `NodeProgressService.updateProgress`:
  - `ITEM_TABLES += letters: {table:'letter_items', fk:'pack_id'}, numbers: {table:'number_items', fk:'pack_id'}` (fix del 400).
  - Por cada ítem del body: upsert `item_progress` con `item_type = node.type` y la semántica de dominio (Global Constraints).
  - `progress` = `floor(#(times_correct>=1) / total_habilitados × 100)` y `mastery` = `floor(#done / total_habilitados × 100)`, ambos contados de `item_progress` (JOIN contra la tabla de ítems del pack, `enabled=true`). Guardar con `max()` contra lo previo (no bajar lo ya mostrado). `attempts++` igual que hoy.
  - **Gemas 1×/día:** capturar ANTES de tocar `daily_use` si su `updated_at` ya es de hoy (`santiagoToday()`); si ya practicó hoy este nodo, saltar `awardGems`. XP sin cambios.
  - Respuesta += `mastery` (DTO).
- [ ] **Step 3:** Contenido con dominio: `path.controller.ts` pasa `@CurrentUser()` a `getNodeContent(nodeId, user)`; en `lettersContent/numbersContent/vocabContent` un LEFT JOIN a `item_progress` (`item_type` del nodo) agrega a cada ítem `progress: { done, streak, timesWrong } | null` (null = nueva).
- [ ] **Step 4:** `GET /path`: `path.service.ts` ya mapea `node_progress` — propagar `mastery` (0 si null) a `PathNodeDto` (`path.dto.ts`).
- [ ] **Step 5:** `npx tsc --noEmit` + build + boot contra la BD (con Task 1 aplicado). Probar con curl/httpie: PUT de un nodo letters ya no da 400; dos PUT con tramos distintos acumulan progress. Commit back: `feat(path): dominio por item, progress/mastery de dos niveles y gemas 1x/dia`.

## Task 3: Front — tipos + hook de sesión + piezas compartidas

**Files:** Modify `services/lessons.service.ts`, `types/path.types.ts`, `services/path.service.ts` (si tipa nodos); Create `hooks/use-lesson-session.ts`, `components/lesson/shared/audio-choice-quiz.tsx`, `components/lesson/shared/use-lesson-audio.ts`.

- [ ] **Step 1:** Tipos: ítems de `LettersContent/NumbersContent/VocabContent` += `progress?: { done: boolean; streak: number; timesWrong: number } | null`; `NodeProgressReward += mastery`; tipo de nodo del camino += `mastery`.
- [ ] **Step 2:** `use-lesson-audio.ts`: ref a un único `HTMLAudioElement`; `play(src)` (resuelve legacy vía `BASE_URL_SOUNDS`, pausa lo anterior, reproduce). Es la única puerta de audio de las lecciones.
- [ ] **Step 3:** `use-lesson-session.ts` (puro, testeable a ojo): recibe ítems con `progress` y devuelve el **tramo**: `n_sesiones = ceil(total/7)`, `tamaño = ceil(total/n_sesiones)` (≤7 entra completo); prioridad **a-reforzar → nuevas → +1–2 aprendidas de repaso** (barajadas); pack 100% dominado → tramo aleatorio de repaso. Expone `{ tramo, newItems, packLearned, packTotal }`.
- [ ] **Step 4:** `audio-choice-quiz.tsx` (ronda inversa, RN-safe): prompt de texto grande (letra/numeral/significado) + 3–4 botones 🔊 (distractores con audio del pack completo); tap = reproduce Y selecciona (borde acento); botón **Comprobar** valida → verde/rojo + `onWrong(itemId)`; fallo re-encola (mismo contrato que `listen-quiz`). Se usa en las 3 lecciones.
- [ ] **Step 5:** `npm run lint` verde. Commit front: `feat(lesson): tipos de dominio, hook de tramos y ronda inversa compartida`.

## Task 4: Front — letras por tramos

**Files:** Modify `app/(app)/lesson/letters/page.tsx`.

- [ ] **Step 1:** Integrar `use-lesson-session` (tramo) + `use-lesson-audio`. Encabezado con "Aprendidas X de Y" del pack.
- [ ] **Step 2:** Etapas: **presentación solo de ítems nuevos del tramo** (si no hay nuevas, se salta) → **directa** (escucha→elige letra, existente, acotada al tramo) con **autoplay** al montar turno y refuerzo al acertar → **inversa** (`audio-choice-quiz`: ve la letra → elige el audio; se salta si <2 clips) → cierre.
- [ ] **Step 3:** Envío: SOLO ítems del tramo (`times_wrong` real, `answered:true` al dominarlos en sesión) — se elimina el "todas las 26 answered". Pantalla final: "Aprendidas X de Y" (+ las recién ganadas) + **"Seguir practicando"** (bumpea `attempt` → re-fetch → tramo nuevo) + "Volver al camino".
- [ ] **Step 4:** lint + build. Commit: `feat(lesson): letras por tramos con autoplay y ronda inversa`.

## Task 5: Front — números por tramos

**Files:** Modify `app/(app)/lesson/numbers/page.tsx`.

- [ ] **Step 1:** Mismo esquema: tramo → reconocimiento (escucha→numeral, autoplay) → **inversa** (ve el numeral → elige audio) → emparejar numeral↔palabra **acotado al tramo** → cierre con envío del tramo + "Seguir practicando".
- [ ] **Step 2:** lint + build. Commit: `feat(lesson): numeros por tramos con autoplay y ronda inversa`.

## Task 6: Front — vocab por tramos (cubre months/days/seasons/…)

**Files:** Modify `components/lesson/vocab/vocab-pack.tsx`, `components/lesson/vocab/listen-quiz.tsx` (autoplay vía `use-lesson-audio`), `app/(app)/lesson/vocab/page.tsx` (pasar re-fetch para "Seguir practicando").

- [ ] **Step 1:** `vocab-pack` consume `use-lesson-session`; stages `present(nuevas del tramo) → listen(directa, autoplay) → inverse(significado ES → elige audio EN) → match(tramo) → summary("Aprendidas X de Y" + Seguir practicando)`. Envío solo del tramo (hoy ya envía en summary — ajustar a tramo).
- [ ] **Step 2:** lint + build. Commit: `feat(lesson): vocab por tramos con autoplay y ronda inversa`.

## Task 7: Front — corona en el camino + verificación final

**Files:** Modify `lib/path-node-meta.ts` o `components/path/path-node.tsx` + `components/path/node-popover.tsx` (badge 👑 cuando `mastery === 100`; popover muestra "Dominado X%" bajo el progreso).

- [ ] **Step 1:** Corona/badge en nodo dominado; nodos completos-no-dominados se ven como hoy (completos).
- [ ] **Step 2:** `npm run lint` + `npx next build` verdes (front), `tsc`+build (back).
- [ ] **Step 3:** Preview end-to-end (backend local con watcher + `npm run dev`):
  - `/lesson/letters?id=…`: sesión pide ~7, autoplay suena al cambiar de pregunta y al acertar, inversa funciona, cierre muestra "Aprendidas X/26".
  - Segunda sesión: acumula (`progress` sube; fallados de la 1ª aparecen primero).
  - PUT de letters/numbers responde 200 (fin del 400); gemas no se re-pagan en la 2ª sesión del día; XP sí.
  - Un vocab pack chico (days=7) entra completo; camino muestra corona al dominar un pack (forzable dominando seasons=4).
  - Confirmación del usuario en preview.
- [ ] **Step 4:** Commits finales + docs: marcar F3e ✅ en el spec con nota de ejecución. Commit docs: `docs(contenido): F3e hecho y verificado`.

## Self-Review
- Feedback cubierto: pocas letras por sesión (tramos 6–7, T3–T6), autoplay (T3 hook + T4–T6), inversa (T3 componente + T4–T6), aplica a todo vocab seed (T6 cubre months/days/etc.), repetición beginner (repaso mezclado + "Seguir practicando" + modo repaso al dominar), sistema aprendida/reforzar (T1–T2 `item_progress`, prioridad a-reforzar en T3). ✓
- Grilling: dos niveles (T2 progress/mastery + T7 corona), 6–7 por tramo (T3), gemas 1×/día (T2), completo de una (este plan). ✓
- Prod: un solo write (T1, DDL aditivo con backup/rollback); el backend desplegado viejo ignora la tabla nueva. ✓
- El 400 de letters/numbers se corrige en T2 y se verifica en T7. ✓
