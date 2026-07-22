# F1 — Expansión de contenido · Reporte de ejecución

- **Fecha:** 2026-07-22
- **Rama:** `redesign/contenido-camino` (backend)
- **Tools:** `seed-content.js` (`seed:content`), `triage-content.js`, `seed-foundations.js`
- **Backups (rollback) en `dots-backend/scripts/out/`:** `backup-content-*.json` (Batches A/B), `backup-triage-*.json` (chunk 1), `backup-seed-foundations-*.json` (Batch C).

## Aplicado a prod

### Batch A — significados (es)
`updated=371`. Todos los words de vocabulario (excepto alphabet, que va al módulo Letras en F3) ahora tienen `meaning`. Archivo: `scripts/seed-data/content-meanings.json`.

### Batch B — oraciones a ≥8
`inserted=29`. 14 niveles de gramática llegan a ≥8 oraciones activas; **L55 "Opposites" reformateado** (9 oraciones reales tipo "The opposite of hot is __"; las 21 rotas quedan desactivadas). Archivo: `scripts/seed-data/content-sentences.json`. Fix incluido: secuencia de `sentences.id` (bigint) se avanza antes de insertar.

### Chunk 1 — enable + typos + rename
`enabled=16` (L21 personal pronouns 4→20, contenido bueno que estaba desactivado), `fixes=9` typos de texto inglés (daugther→daughter, sking→skiing, swiming→swimming, pinneaple→pineapple, calph→calf, dinningroom→dining room, livingroom→living room, book seller→bookcase, short→shorts), y **`stations`→`seasons`** (nombre de nivel corregido en `dots.levels`).

### Batch C — fundamentos a ≥8
`items: 36 new` (audio existente preservado). 11 grammar pills → 8 ítems; vocab packs → 10; pronunciación 8. **`s-inicial` queda en 6** a propósito (pares mínimos reales; forzar a 8 metería palabras falsas). Archivo: `scripts/seed-data/foundations.json`.

## Estado final
- **Toda la gramática ≥8 oraciones activas.** `emptyOrThin` (report) pasó de 35 → 10, y los 10 restantes son **solo vocab** (daytime, furniture, house, body, school = 0 oraciones; seasons/meals/shapes/days = sets pequeños) **+ L32** (dup vacío). Todos van a **F3** (módulos vocab / consolidación), no a más oraciones.
- Fundamentos completos salvo `s-inicial` (6, intencional).

## Pendiente
- **F-media:** audio de los 4 vocab ítems nuevos de fundamentos + audio de los 371 words (para el módulo vocab-visual). Vía `generate-narrations.js` (ElevenLabs).
- **F3:** niveles vocab (incl. alphabet/numbers) → módulos; L32 consolidar con L24.
- Regenerar estado: `npm run triage:content` (read-only).
