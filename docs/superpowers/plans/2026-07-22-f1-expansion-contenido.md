# F1 — Expansión de contenido · Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development o superpowers:executing-plans. Steps con checkbox (`- [ ]`).

**Goal:** Llevar cada tema a la barra de "suficiente práctica" (≥8 oraciones activas / ≥10 vocab / ≥8 fundamentos) con contenido **acorde al tema**, y autorear los significados (es) faltantes — en lotes revisables por el usuario en el admin.

**Architecture:** Un loader idempotente `dots-backend/scripts/seed-content.js` (mismo patrón que `triage-content.js`: dry-run → `--apply` con backup → `--rollback`) que **inserta oraciones nuevas** (idempotente por `(level_id, lower(text))`) y **actualiza significados de words** (por `id`). La expansión de fundamentos reusa el flujo existente `foundations.json` + `seed-foundations.js`. El contenido se genera en archivos-lote JSON (revisables) bajo `scripts/seed-data/`.

**Tech Stack:** Node 22 (nvm), `pg`, PostgreSQL `dots` (prod compartida).

## Global Constraints

- **Prod compartida:** backup previo, transacción, `--rollback`. Correr desde `dots-backend/`.
- **`sentences.id` es bigint** (pg lo da como string) → castear `::bigint` en queries de id. `words.id` es int → `::int`.
- **Alcance F1 = `dots.sentences` (insertar) + `dots.words` (meaning).** El re-encaje de módulos y path_nodes es F3.
- **Barra:** ≥8 oraciones **activas** por tema de práctica; ≥10 items por set vocab; ≥8 por unidad de fundamentos.
- **Contenido on-topic:** nada de acrósticos ni relleno; la oración enseña el tema del nivel. Fill-in-the-blank: `text` con `__`, `m_word` = respuesta exacta.
- **Sin distractores en `sentences`** (la tabla no tiene columna; el módulo los deriva). Mirar `no_img`/`img` de una oración existente del mismo nivel y replicar (por defecto `no_img=true` para práctica solo-texto).
- **Autoría:** yo genero, el usuario revisa/ajusta en el admin (`/admin/levels`).
- **Verificación:** `npm run triage:content` (read-only) confirma que cada nivel llega a la barra; sin test runner.
- **Rama:** `redesign/contenido-camino` (backend).

---

### Task 1: Loader `seed-content.js`

**Files:**
- Create: `dots-backend/scripts/seed-content.js`
- Modify: `dots-backend/package.json` (script `seed:content`)

**Interfaces:**
- Consume archivos-lote con forma:
  `{ wordMeanings: [{id, meaning}], newSentences: [{level_id, text, m_word, no_img?}] }`
- Produces: inserta/actualiza y reporta `inserted/skipped/updated`; backup en `scripts/out/backup-content-<ts>.json`.

- [ ] **Step 1: Crear el loader**

```javascript
#!/usr/bin/env node
/**
 * F1 content loader — additive & idempotent.
 *   node scripts/seed-content.js <batch.json>            # dry-run
 *   node scripts/seed-content.js <batch.json> --apply    # backup + upsert
 *   node scripts/seed-content.js --rollback <backup.json>
 * batch: { wordMeanings:[{id,meaning}], newSentences:[{level_id,text,m_word,no_img?}] }
 */
/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require('fs');
const path = require('path');
require('dotenv').config();
const { Client } = require('pg');

const OUT_DIR = path.join(__dirname, 'out');
const SNAPSHOT_TABLES = ['words', 'sentences'];

async function connect() {
  const client = new Client({
    host: process.env.DB_HOST, port: Number(process.env.DB_PORT),
    user: process.env.DB_USERNAME, password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME, ssl: { rejectUnauthorized: false },
  });
  await client.connect();
  return client;
}
async function snapshot(client) {
  const d = {};
  for (const t of SNAPSHOT_TABLES) d[t] = (await client.query(`SELECT * FROM dots.${t} ORDER BY id`)).rows;
  return d;
}

async function run(client, batch, apply) {
  const stats = { inserted: 0, skipped: 0, updated: 0 };
  // new sentences (idempotent by level_id + lower(text))
  for (const s of batch.newSentences || []) {
    const exists = await client.query(
      `SELECT id FROM dots.sentences WHERE level_id = $1 AND lower(text) = lower($2)`,
      [s.level_id, s.text],
    );
    if (exists.rows.length) { stats.skipped++; continue; }
    if (apply) {
      await client.query(
        `INSERT INTO dots.sentences (level_id, text, m_word, enabled, no_img)
         VALUES ($1, $2, $3, true, $4)`,
        [s.level_id, s.text, s.m_word, s.no_img ?? true],
      );
    }
    stats.inserted++;
  }
  // word meanings (by id)
  for (const w of batch.wordMeanings || []) {
    if (apply)
      await client.query(`UPDATE dots.words SET meaning = $2 WHERE id = $1::int`, [w.id, w.meaning]);
    stats.updated++;
  }
  return stats;
}

async function rollback(client, backup) {
  await client.query('BEGIN');
  try {
    for (const t of SNAPSHOT_TABLES) {
      // delete rows added after backup (present now, absent in snapshot)
      const ids = backup.snapshot[t].map((r) => r.id);
      if (ids.length)
        await client.query(
          `DELETE FROM dots.${t} WHERE id <> ALL($1::${t === 'sentences' ? 'bigint' : 'int'}[])`,
          [ids],
        );
      for (const row of backup.snapshot[t]) {
        const names = Object.keys(row);
        const params = names.map((_, i) => `$${i + 1}`).join(', ');
        const upd = names.filter((n) => n !== 'id').map((n) => `${n} = EXCLUDED.${n}`).join(', ');
        await client.query(
          `INSERT INTO dots.${t} (${names.join(', ')}) VALUES (${params})
           ON CONFLICT (id) DO UPDATE SET ${upd}`,
          names.map((n) => (row[n] !== null && typeof row[n] === 'object' ? JSON.stringify(row[n]) : row[n])),
        );
      }
      await client.query(
        `SELECT setval(pg_get_serial_sequence('dots.${t}','id'), COALESCE((SELECT MAX(id) FROM dots.${t}),1))`,
      );
    }
    await client.query('COMMIT');
    console.log('Rollback complete.');
  } catch (e) { await client.query('ROLLBACK'); throw e; }
}

async function main() {
  const args = process.argv.slice(2);
  const rbIdx = args.indexOf('--rollback');
  const apply = args.includes('--apply');
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const client = await connect();
  try {
    if (rbIdx !== -1) {
      await rollback(client, JSON.parse(fs.readFileSync(args[rbIdx + 1], 'utf8')));
      return;
    }
    const batchFile = args.find((a) => !a.startsWith('--'));
    if (!batchFile) throw new Error('Usage: seed-content.js <batch.json> [--apply]');
    const batch = JSON.parse(fs.readFileSync(batchFile, 'utf8'));
    if (apply) {
      const backup = { timestamp: new Date().toISOString(), snapshot: await snapshot(client) };
      const bf = path.join(OUT_DIR, `backup-content-${Date.now()}.json`);
      fs.writeFileSync(bf, JSON.stringify(backup, null, 1));
      console.log(`Backup written: ${bf}`);
      await client.query('BEGIN');
      try { const s = await run(client, batch, true); await client.query('COMMIT');
        console.log(`Applied: inserted=${s.inserted} skipped=${s.skipped} updated=${s.updated}`);
      } catch (e) { await client.query('ROLLBACK'); throw e; }
    } else {
      const s = await run(client, batch, false);
      console.log(`Dry-run: would insert=${s.inserted} skip=${s.skipped} update=${s.updated}`);
    }
  } finally { await client.end(); }
}
main().catch((e) => { console.error('seed-content failed:', e.message); process.exit(1); });
```

- [ ] **Step 2: npm script** — en `package.json` junto a `triage:content`:
```json
"seed:content": "node scripts/seed-content.js",
```

- [ ] **Step 3: Smoke dry-run** con lote vacío:
```bash
source ~/.nvm/nvm.sh
echo '{"wordMeanings":[],"newSentences":[]}' > /tmp/empty.json
node scripts/seed-content.js /tmp/empty.json
```
Expected: `Dry-run: would insert=0 skip=0 update=0`.

- [ ] **Step 4: Commit**
```bash
git add scripts/seed-content.js package.json
git commit -m "feat(content): loader idempotente de contenido (oraciones nuevas + significados)"
```

---

### Task 2: Batch A — significados de words (es)

**Files:** Create `dots-backend/scripts/seed-data/content-meanings.json` (generado por lotes por grupo de nivel).

- [ ] **Step 1: Generar significados** para los words con `meaning` vacío, por grupos coherentes (numbers, colors, days, months, family, clothes, foods, animals, body, house, school…). Excluir **alphabet** (las letras no tienen "significado"; van al módulo Letras en F3). Formato `{id, meaning}` (ids desde `words`).
  Ejemplo:
```json
{ "wordMeanings": [
  { "id": 27, "meaning": "uno" }, { "id": 28, "meaning": "dos" },
  { "id": 51, "meaning": "negro" }, { "id": 52, "meaning": "azul" }
], "newSentences": [] }
```
- [ ] **Step 2: Dry-run** `node scripts/seed-content.js scripts/seed-data/content-meanings.json` → revisar `update=N`.
- [ ] **Step 3: GATE humano** — el usuario revisa el JSON (traducciones) antes de aplicar.
- [ ] **Step 4: Apply** `--apply` (backup automático). Verificar en `/admin/levels` un par de niveles.
- [ ] **Step 5: Commit** del batch JSON.

---

### Task 3: Batch B — expansión de oraciones a ≥8 (gramática)

**Files:** Create `dots-backend/scripts/seed-data/content-sentences.json`.

- [ ] **Step 1: Identificar** niveles con `enabled<8` (de `npm run triage:content` → `emptyOrThin`), excluyendo vocab (F3) y L55 (reescritura aparte).
- [ ] **Step 2: Autorear** oraciones on-topic hasta ≥8 por nivel. Cada una: `{level_id, text (con __), m_word}`. Revisar `no_img` de una oración existente del nivel y replicar.
  Ejemplo (L35 comparative/superlative, +2):
```json
{ "newSentences": [
  { "level_id": 35, "text": "A cheetah is __ a cat.", "m_word": "faster than" },
  { "level_id": 35, "text": "This is the __ book in the library.", "m_word": "most interesting" }
], "wordMeanings": [] }
```
- [ ] **Step 3: Dry-run** → revisar `insert=N skip=M` (skip = ya existían, idempotencia).
- [ ] **Step 4: GATE humano** — revisión lingüística.
- [ ] **Step 5: Apply** + `npm run triage:content` para confirmar que esos niveles ya no salen en `emptyOrThin`.
- [ ] **Step 6: Commit** del batch.

---

### Task 4: Batch C — expansión de fundamentos a ≥8

**Files:** Modify `dots-backend/scripts/seed-data/foundations.json`.

- [ ] **Step 1: Auditar** items por unidad; las grammar pills con 5-6 items suben a ≥8 (agregar `items` con `mode/text/answer/distractors`), vocab packs a ≥10, pronunciation a ≥8 pares.
- [ ] **Step 2: Dry-run** `node scripts/seed-foundations.js` (ya idempotente).
- [ ] **Step 3: GATE humano.**
- [ ] **Step 4: Apply** `node scripts/seed-foundations.js --apply` (backup propio). Audio de items nuevos queda null → F-media.
- [ ] **Step 5: Commit** de `foundations.json`.

---

### Task 5: Verificación final + estado

- [ ] **Step 1:** `npm run triage:content` → confirmar 0 niveles de gramática con `enabled<8` (salvo los diferidos a F3).
- [ ] **Step 2:** Reporte `docs/superpowers/plans/2026-07-22-f1-expansion-reporte.md` + marcar F1 en el spec.
- [ ] **Step 3:** Commit.

## Self-Review

- **Cobertura spec F1:** oraciones a la barra (Task 3), significados (Task 2), fundamentos a la barra (Task 4). ✓ (Extender fundamentos a otras secciones vía path_nodes se difiere a F3, donde vive la edición de camino.)
- **Placeholders:** el loader está completo; el contenido es data generada en ejecución y revisada por el usuario (parte del diseño "yo genero, tú revisas"). ✓
- **Tipos:** batch shape `{wordMeanings:[{id,meaning}], newSentences:[{level_id,text,m_word,no_img?}]}` idéntico en loader y Tasks 2-3. Casts `::int`/`::bigint` correctos. ✓
