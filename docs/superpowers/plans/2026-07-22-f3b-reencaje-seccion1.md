# F3b — Re-encaje de la sección 1 (migración de datos) · Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. Steps con checkbox (`- [ ]`). **Escribe en la BD compartida de PRODUCCIÓN** — todo write va por un seed idempotente con backup + rollback y se corre con `--apply` explícito y gateado.

**Goal:** Que alphabet, numbers y los 23 temas de vocabulario de la sección 1 usen su módulo natural: crear el contenido de `letters`/`numbers`/`vocab` y **reapuntar los `path_nodes` `practice` de la sección 1** a esos módulos, archivando (no borrando) las oraciones que quedan obsoletas.

**Architecture:** Un solo seed idempotente `seed-modules-content.js` (patrón de `seed-foundations.js`: dry-run por defecto, `--apply` con backup en `scripts/out/`, `--rollback <backup>`). Lee `scripts/seed-data/modules.json` (contenido de letras/números + mapping nivel→módulo). Fase A: upsert de contenido (letters/numbers desde JSON por `key`; vocab packs+items **derivados de los `words` existentes** por nivel). Fase B: re-encaje del camino (convierte cada nodo `practice` de la sección 1 cuyo `ref_id` es un nivel mapeado en un nodo `letters`/`numbers`/`vocab` apuntando al pack nuevo) + archiva (`enabled=false`) las oraciones de esos niveles.

**Tech Stack:** Node + `pg` (scripts), PostgreSQL prod. Verificación: dry-run inspeccionable + conteos post-apply + preview manual del camino.

## Decisiones cerradas (2026-07-22)

- **Rango de números:** 1–20 (pack `numbers-1-20`) + decenas 30..100 (pack `numbers-tens`).
- **Retiro de oraciones obsoletas:** **archivar** (`enabled=false`), reversible. Nunca `DELETE` de sentences.

## Global Constraints

- **BD de producción compartida:** solo el `--apply` escribe, con backup JSON previo (snapshot de las tablas tocadas + de los path_nodes/sentences modificados) y `--rollback`. Nada de queries destructivas ad-hoc.
- **Idempotente:** re-correr no duplica (upsert por `key` en packs; items por `(pack, position)`; nodos por identidad de nodo; sentences ya archivadas se saltan).
- **Data-driven, no hardcodear posiciones:** el re-encaje consulta los `path_nodes` `practice` reales de la sección 1 y los convierte según el mapping; no asume posiciones fijas.
- **Preservar media:** al derivar vocab items de `words`, copiar `img`/`audio` tal cual; no generar audio (F-media).
- **`vocab_items.meaning` es NOT NULL:** los 23 niveles ya tienen `meaning` en todos sus words (verificado en el inventario); aun así, el script usa `COALESCE(meaning,'')`.
- **Sección 1 = `section.id = 1`** ("Level 1", beginner). Mapping por `level.id`.
- **Rama:** `redesign/contenido-camino`.

## Mapping nivel → módulo (sección 1, verificado en inventario)

| level.id | nombre | módulo | pack key |
|---|---|---|---|
| 1 | alphabet | letters | `letters-alphabet` |
| 2 | numbers | numbers | `numbers-1-20` (nodo) + `numbers-tens` (nodo nuevo) |
| 3 | days of the week | vocab | `vocab-days` |
| 4 | colors | vocab | `vocab-colors` |
| 5 | months of the year | vocab | `vocab-months` |
| 6 | family | vocab | `vocab-family` |
| 7 | clothes | vocab | `vocab-clothes` |
| 8 | verbs | vocab | `vocab-verbs` |
| 9 | time | vocab | `vocab-time` |
| 10 | shapes | vocab | `vocab-shapes` |
| 11 | kitchen elements | vocab | `vocab-kitchen` |
| 12 | foods | vocab | `vocab-foods` |
| 13 | meals | vocab | `vocab-meals` |
| 14 | sports | vocab | `vocab-sports` |
| 15 | seasons | vocab | `vocab-seasons` |
| 16 | weather | vocab | `vocab-weather` |
| 17 | professions | vocab | `vocab-professions` |
| 18 | personal care products | vocab | `vocab-personal-care` |
| 44 | animals | vocab | `vocab-animals` |
| 45 | daytime | vocab | `vocab-daytime` |
| 46 | fruits | vocab | `vocab-fruits` |
| 47 | furniture | vocab | `vocab-furniture` |
| 48 | house | vocab | `vocab-house` |
| 49 | body | vocab | `vocab-body` |
| 50 | school | vocab | `vocab-school` |

> **Para revisión:** `verbs` (L8) tiene 20 oraciones on-topic; el spec manda todos los temas de sección 1 a vocab-visual, así que va a `vocab` y sus oraciones se archivan. Si se prefiere conservarlo como `practice`, quítalo del mapping (queda como está).

---

## Task 1: Data file `scripts/seed-data/modules.json`

**Files:** Create `dots-backend/scripts/seed-data/modules.json`

- [ ] **Step 1:** Crear el JSON con 3 claves: `letter_packs`, `number_packs`, `vocab_from_levels`.

```json
{
  "letter_packs": [
    {
      "key": "letters-alphabet",
      "title": "El abecedario",
      "items": [
        { "letter": "A", "name": "ay", "sound_ipa": "/eɪ/", "example_word": "apple", "example_meaning": "manzana" },
        { "letter": "B", "name": "bee", "sound_ipa": "/biː/", "example_word": "ball", "example_meaning": "pelota" },
        { "letter": "C", "name": "cee", "sound_ipa": "/siː/", "example_word": "cat", "example_meaning": "gato" },
        { "letter": "D", "name": "dee", "sound_ipa": "/diː/", "example_word": "dog", "example_meaning": "perro" },
        { "letter": "E", "name": "ee", "sound_ipa": "/iː/", "example_word": "egg", "example_meaning": "huevo" },
        { "letter": "F", "name": "ef", "sound_ipa": "/ɛf/", "example_word": "fish", "example_meaning": "pez" },
        { "letter": "G", "name": "gee", "sound_ipa": "/dʒiː/", "example_word": "goat", "example_meaning": "cabra" },
        { "letter": "H", "name": "aitch", "sound_ipa": "/eɪtʃ/", "example_word": "hat", "example_meaning": "sombrero" },
        { "letter": "I", "name": "eye", "sound_ipa": "/aɪ/", "example_word": "ice", "example_meaning": "hielo" },
        { "letter": "J", "name": "jay", "sound_ipa": "/dʒeɪ/", "example_word": "juice", "example_meaning": "jugo" },
        { "letter": "K", "name": "kay", "sound_ipa": "/keɪ/", "example_word": "kite", "example_meaning": "cometa" },
        { "letter": "L", "name": "el", "sound_ipa": "/ɛl/", "example_word": "lion", "example_meaning": "león" },
        { "letter": "M", "name": "em", "sound_ipa": "/ɛm/", "example_word": "moon", "example_meaning": "luna" },
        { "letter": "N", "name": "en", "sound_ipa": "/ɛn/", "example_word": "nest", "example_meaning": "nido" },
        { "letter": "O", "name": "oh", "sound_ipa": "/oʊ/", "example_word": "orange", "example_meaning": "naranja" },
        { "letter": "P", "name": "pee", "sound_ipa": "/piː/", "example_word": "pig", "example_meaning": "cerdo" },
        { "letter": "Q", "name": "cue", "sound_ipa": "/kjuː/", "example_word": "queen", "example_meaning": "reina" },
        { "letter": "R", "name": "ar", "sound_ipa": "/ɑːr/", "example_word": "rain", "example_meaning": "lluvia" },
        { "letter": "S", "name": "ess", "sound_ipa": "/ɛs/", "example_word": "sun", "example_meaning": "sol" },
        { "letter": "T", "name": "tee", "sound_ipa": "/tiː/", "example_word": "tree", "example_meaning": "árbol" },
        { "letter": "U", "name": "you", "sound_ipa": "/juː/", "example_word": "umbrella", "example_meaning": "paraguas" },
        { "letter": "V", "name": "vee", "sound_ipa": "/viː/", "example_word": "van", "example_meaning": "furgoneta" },
        { "letter": "W", "name": "double-u", "sound_ipa": "/ˈdʌbəljuː/", "example_word": "water", "example_meaning": "agua" },
        { "letter": "X", "name": "ex", "sound_ipa": "/ɛks/", "example_word": "box", "example_meaning": "caja" },
        { "letter": "Y", "name": "wy", "sound_ipa": "/waɪ/", "example_word": "yellow", "example_meaning": "amarillo" },
        { "letter": "Z", "name": "zee", "sound_ipa": "/ziː/", "example_word": "zebra", "example_meaning": "cebra" }
      ]
    }
  ],
  "number_packs": [
    {
      "key": "numbers-1-20",
      "title": "Números 1–20",
      "items": [
        {"value":1,"word":"one"},{"value":2,"word":"two"},{"value":3,"word":"three"},{"value":4,"word":"four"},{"value":5,"word":"five"},
        {"value":6,"word":"six"},{"value":7,"word":"seven"},{"value":8,"word":"eight"},{"value":9,"word":"nine"},{"value":10,"word":"ten"},
        {"value":11,"word":"eleven"},{"value":12,"word":"twelve"},{"value":13,"word":"thirteen"},{"value":14,"word":"fourteen"},{"value":15,"word":"fifteen"},
        {"value":16,"word":"sixteen"},{"value":17,"word":"seventeen"},{"value":18,"word":"eighteen"},{"value":19,"word":"nineteen"},{"value":20,"word":"twenty"}
      ]
    },
    {
      "key": "numbers-tens",
      "title": "Las decenas (30–100)",
      "items": [
        {"value":30,"word":"thirty"},{"value":40,"word":"forty"},{"value":50,"word":"fifty"},{"value":60,"word":"sixty"},
        {"value":70,"word":"seventy"},{"value":80,"word":"eighty"},{"value":90,"word":"ninety"},{"value":100,"word":"one hundred"}
      ]
    }
  ],
  "vocab_from_levels": [
    { "levelId": 3,  "key": "vocab-days",          "title": "days of the week" },
    { "levelId": 4,  "key": "vocab-colors",        "title": "colors" },
    { "levelId": 5,  "key": "vocab-months",        "title": "months of the year" },
    { "levelId": 6,  "key": "vocab-family",        "title": "family" },
    { "levelId": 7,  "key": "vocab-clothes",       "title": "clothes" },
    { "levelId": 8,  "key": "vocab-verbs",         "title": "verbs" },
    { "levelId": 9,  "key": "vocab-time",          "title": "time" },
    { "levelId": 10, "key": "vocab-shapes",        "title": "shapes" },
    { "levelId": 11, "key": "vocab-kitchen",       "title": "kitchen elements" },
    { "levelId": 12, "key": "vocab-foods",         "title": "foods" },
    { "levelId": 13, "key": "vocab-meals",         "title": "meals" },
    { "levelId": 14, "key": "vocab-sports",        "title": "sports" },
    { "levelId": 15, "key": "vocab-seasons",       "title": "seasons" },
    { "levelId": 16, "key": "vocab-weather",       "title": "weather" },
    { "levelId": 17, "key": "vocab-professions",   "title": "professions" },
    { "levelId": 18, "key": "vocab-personal-care", "title": "personal care products" },
    { "levelId": 44, "key": "vocab-animals",       "title": "animals" },
    { "levelId": 45, "key": "vocab-daytime",       "title": "daytime" },
    { "levelId": 46, "key": "vocab-fruits",        "title": "fruits" },
    { "levelId": 47, "key": "vocab-furniture",     "title": "furniture" },
    { "levelId": 48, "key": "vocab-house",         "title": "house" },
    { "levelId": 49, "key": "vocab-body",          "title": "body" },
    { "levelId": 50, "key": "vocab-school",        "title": "school" }
  ]
}
```

Y el mapping de módulos de nodo: `numbers` node (L2) apunta a `numbers-1-20`; el pack `numbers-tens` se coloca como **nodo nuevo** contiguo (Task 3).
- [ ] **Step 2:** `node -e "JSON.parse(require('fs').readFileSync('scripts/seed-data/modules.json','utf8'))"` → sin error. Commit: `feat(content): datos de módulos (letras + números) F3b`.

## Task 2: Seed — Fase A (contenido: packs + items)

**Files:** Create `dots-backend/scripts/seed-modules-content.js`; Modify `dots-backend/package.json` (script `seed:modules`)

- [ ] **Step 1:** Copiar el harness de `scripts/seed-foundations.js`: `connect()`, flags `--apply`/`--rollback`, `OUT_DIR`, backup JSON, dry-run por defecto. `require` de `pg` + `dotenv`.
- [ ] **Step 2:** Fase A — upsert idempotente:
  - **letters/numbers:** por cada pack del JSON, `INSERT ... ON CONFLICT (key) DO UPDATE SET title=...` en `letter_packs`/`number_packs`; por cada item, buscar por `(pack_id, position)` (position = índice) y update, o insert. Campos letras: `letter,name,sound_ipa,example_word,example_meaning`; números: `value,word`. `img`/`audio` se dejan NULL (F-media).
  - **vocab desde niveles:** por cada entry de `vocab_from_levels`, upsert `vocab_packs` por `key` (title del JSON); luego `SELECT text, meaning, img, audio, position FROM dots.words WHERE level_id = $levelId::text ORDER BY position, id`; por cada word, upsert `vocab_items` por `(pack_id, position)` con `text, meaning=COALESCE(meaning,''), img, audio`.
  - Contar new/updated por tabla para el resumen.
- [ ] **Step 3:** Backup Fase A: snapshot de `letter_packs,letter_items,number_packs,number_items,vocab_packs,vocab_items` (full-table, son chicas), guardado en `scripts/out/backup-modules-content-<ts>.json`. (El rollback de Fase A borra los packs con `key` sembrados en esta corrida y sus items — registrar los keys insertados.)
- [ ] **Step 4:** Agregar `"seed:modules": "node scripts/seed-modules-content.js"` a package.json. Dry-run: `npm run seed:modules` → imprime cuántos packs/items crearía, sin escribir. Commit: `feat(seed): fase A contenido de módulos (dry-run)`.

## Task 3: Seed — Fase B (re-encaje del camino + archivado)

**Files:** Modify `dots-backend/scripts/seed-modules-content.js`

- [ ] **Step 1:** Construir el mapa `levelId → { module, packKey }` desde el JSON (letters: L1→`letters-alphabet`; numbers: L2→`numbers-1-20`; vocab: cada entry). Resolver cada `packKey` a su `id` (ya creado en Fase A).
- [ ] **Step 2:** Re-encaje de nodos (idempotente, data-driven). En una transacción:

```js
// Todos los nodos practice de la sección 1 cuyo ref es un nivel mapeado.
const practice = await client.query(
  `SELECT id, position, ref_id FROM dots.path_nodes
    WHERE section_id = 1 AND type = 'practice' AND ref_id = ANY($1)`,
  [mappedLevelIds],
);
for (const n of practice.rows) {
  const m = mapByLevel[n.ref_id];           // { module, packId }
  if (apply) await client.query(
    `UPDATE dots.path_nodes SET type = $2, ref_id = $3 WHERE id = $1`,
    [n.id, m.module, m.packId]);
  stats.rewritten++;
}
```

- [ ] **Step 3:** Niveles mapeados **sin** nodo practice en la sección 1 (p. ej. 15–18, 44–50 si no estaban colocados) → insertar un nodo del módulo al final de la sección, en posiciones libres (patrón `placeNodes` de seed-foundations: `MAX(position)+10`, verificar colisión `(section_id, position)`). Además, el pack `numbers-tens` se inserta como nodo `numbers` nuevo contiguo al de `numbers-1-20`. Registrar `insertedNodeIds` en el backup.
- [ ] **Step 4:** Archivar oraciones obsoletas: para cada `levelId` mapeado, `UPDATE dots.sentences SET enabled = false WHERE level_id = $levelId AND enabled = true RETURNING id` — registrar `archivedSentenceIds` en el backup (rollback las vuelve a `enabled=true`). **Nunca DELETE.**
- [ ] **Step 5:** Rollback (Fase B): re-apuntar/rev-tipar los nodos reescritos a `practice`+level (desde el snapshot de nodos), borrar `insertedNodeIds` (y sus `node_progress`), y `UPDATE sentences SET enabled=true WHERE id = ANY(archivedSentenceIds)`. Rollback (Fase A): borrar items y packs por los keys sembrados. Un solo `--rollback <backup>` deshace ambas fases (Fase B antes que A).
- [ ] **Step 6:** Dry-run: imprime "reescribiría N nodos, insertaría M, archivaría K oraciones" sin escribir. Commit: `feat(seed): fase B re-encaje del camino (dry-run)`.

## Task 4: Backup dry-run review + `--apply` (gateado) + verificación

- [ ] **Step 1:** Dry-run completo `npm run seed:modules` y **revisar el resumen** (packs/items a crear, nodos a reescribir/insertar, oraciones a archivar). Confirmar que los conteos cuadran con el inventario (23 vocab packs, 1 letters, 2 numbers; ~14+ nodos practice reescritos).
- [ ] **Step 2 (GATEADO — requiere OK explícito):** `npm run seed:modules -- --apply`. Escribe con backup en `scripts/out/`.
- [ ] **Step 3:** Verificación post-apply (el script imprime): conteos de `letter_items`(26), `number_items`(28), `vocab_packs`(≥23), `path_nodes` de sección 1 por tipo (0 practice de niveles vocab restantes), sentences archivadas. Además boot del backend + `GET /path/nodes/:id` de un nodo letters/numbers/vocab nuevo (o preview del camino como usuario).
- [ ] **Step 4:** Preview manual: abrir el camino de la sección 1 y confirmar que alphabet→lección de letras, numbers→números, y los temas → vocab-visual. Commit (si hubo ajustes de datos): `chore(content): F3b aplicado`.

---

## Self-Review

- **Cobertura spec F3b:** crear vocab_packs/items desde words (Task 2) ✓; crear letters/numbers (Task 1–2) ✓; reescribir path_nodes sección 1 (Task 3) ✓; retirar oraciones = **archivar** (Task 3 Step 4) ✓; backup+rollback (Task 2–3) ✓.
- **Riesgo (prod, camino en vivo):** todo idempotente + backup + rollback; oraciones se archivan (reversible), no se borran; el re-encaje es data-driven (no rompe nodos ya existentes de grammar/pronunciation/reading/vocab-previos). **El `--apply` está gateado** — el plan se revisa antes de tocar prod.
- **Placeholder scan:** contenido de letras/números completo e inline; mapping explícito; sin TBD.
- **Decisión abierta anotada:** `verbs` (L8) → vocab (quitar del mapping si se quiere conservar como practice).
- **Fuera de F3b (→ F3c):** placement de fundamentos en secciones 2–12 y engrosar niveles vocab flacos.
