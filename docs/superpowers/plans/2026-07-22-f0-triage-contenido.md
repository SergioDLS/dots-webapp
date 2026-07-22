# F0 — Triage de contenido · Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dejar el camino "sano" — sin oraciones basura, sin niveles muertos por contenido apagado, sin typos/duplicados evidentes — sobre las tablas `dots.words` y `dots.sentences`, de forma reversible.

**Architecture:** Un único script Node en `dots-backend/scripts/triage-content.js` que sigue el patrón de `seed-foundations.js`: read-only por defecto (emite un *proposal* JSON revisable), `--apply <proposal>` muta dentro de una transacción con backup previo, `--rollback <backup>` restaura por upsert. Nada se borra/habilita sin que un humano lo apruebe primero editando el proposal.

**Tech Stack:** Node 22 (nvm), `pg` (cliente directo, como el resto de `scripts/`), PostgreSQL `dots` schema en producción compartida.

## Global Constraints

- **BD de PRODUCCIÓN compartida.** Todo write: backup previo en `dots-backend/scripts/out/`, dentro de `BEGIN/COMMIT`, con `--rollback` disponible. Correr siempre **desde `dots-backend/`**.
- **Alcance F0 = solo `dots.words` y `dots.sentences`.** NADA de `path_nodes`, `levels`, ni fundamentos aquí (esas son F1/F2/F3).
- **Gate humano obligatorio** antes de cualquier `--apply` a prod: el proposal se revisa y se aprueba manualmente (Task 2).
- **Node vía nvm:** `source ~/.nvm/nvm.sh` antes de `node`.
- **Sin test runner** (regla del repo): la verificación es dry-run + conteos de filas + re-run idempotente + drill de rollback.
- **Rama:** `redesign/contenido-camino` en `dots-backend`.
- `sentences_progress.id_sentence` es relación app-layer (sin FK dura); aun así el borrado limpia huérfanos.
- Idempotencia: re-correr `--apply` con el mismo proposal no debe cambiar nada la 2ª vez.

---

### Task 1: Herramienta de triage (read-only) + proposal

**Files:**
- Create: `dots-backend/scripts/triage-content.js`
- Modify: `dots-backend/package.json` (agregar script `triage:content`)
- Output (runtime): `dots-backend/scripts/out/triage-proposal-<ts>.json`

**Interfaces:**
- Produces: proposal JSON con la forma
  `{ deleteJunk: [{id,level_id,text,reason}], duplicates: [{id,level_id,text,keptId}], enableCandidates: [{id,level_id,text}], emptyOrThin: [{id,name,enabled}], approvedEnable: [], textFixes: [{id,text?,m_word?}], wordFixes: [{id,text?,meaning?}] }`.
  `approvedEnable`, `textFixes`, `wordFixes` salen vacíos: los llena el humano en Task 2.

- [ ] **Step 1: Crear el script completo**

```javascript
#!/usr/bin/env node
/**
 * F0 triage of original content (dots.words + dots.sentences).
 * Read-only by default (emits a proposal); --apply mutates with a full backup.
 *
 * Usage (from dots-backend/):
 *   node scripts/triage-content.js                          # dry-run: report + out/triage-proposal-<ts>.json
 *   node scripts/triage-content.js --apply <proposal.json>  # backup + apply the reviewed proposal
 *   node scripts/triage-content.js --apply <proposal.json> --archive-junk  # disable junk instead of deleting
 *   node scripts/triage-content.js --rollback <backup.json> # upsert-restore words+sentences
 */
/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require('fs');
const path = require('path');
require('dotenv').config();
const { Client } = require('pg');

const OUT_DIR = path.join(__dirname, 'out');
const SNAPSHOT_TABLES = ['words', 'sentences'];

const JUNK =
  /\b(test|testing|hehe+|a{3,}|asdf|sentenceee+|dots|10000|new version|final sentence|more testing|fantastic sentence)\b/i;
const isJunk = (t) => {
  const s = (t || '').trim();
  if (!s) return true;
  if (JUNK.test(s)) return true;
  if (/::/.test(s)) return true;
  if (/^[^a-zA-Z]*$/.test(s.replace(/_/g, ''))) return true; // sin ninguna letra
  return false;
};

async function connect() {
  const client = new Client({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    user: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();
  return client;
}

async function snapshot(client) {
  const data = {};
  for (const t of SNAPSHOT_TABLES)
    data[t] = (await client.query(`SELECT * FROM dots.${t} ORDER BY id`)).rows;
  return data;
}

async function buildProposal(client) {
  const sentences = (
    await client.query(
      `SELECT id, level_id, text, m_word, enabled FROM dots.sentences ORDER BY level_id, id`,
    )
  ).rows;
  const levels = (
    await client.query(`SELECT id, name FROM dots.levels ORDER BY id`)
  ).rows;

  const byLevel = {};
  for (const s of sentences) (byLevel[s.level_id] ??= []).push(s);

  const deleteJunk = [];
  const duplicates = [];
  const enableCandidates = [];
  for (const arr of Object.values(byLevel)) {
    const seen = new Map();
    for (const s of arr) {
      const t = (s.text || '').trim();
      if (isJunk(t)) {
        deleteJunk.push({ id: s.id, level_id: s.level_id, text: t, reason: 'junk' });
        continue;
      }
      const key = t.toLowerCase();
      if (seen.has(key))
        duplicates.push({ id: s.id, level_id: s.level_id, text: t, keptId: seen.get(key) });
      else seen.set(key, s.id);
      if (!s.enabled && t.includes('__') && s.m_word)
        enableCandidates.push({ id: s.id, level_id: s.level_id, text: t });
    }
  }
  const emptyOrThin = levels
    .map((l) => ({
      id: l.id,
      name: l.name,
      enabled: (byLevel[l.id] || []).filter((s) => s.enabled).length,
    }))
    .filter((l) => l.enabled < 8)
    .sort((a, b) => a.enabled - b.enabled);

  return {
    deleteJunk,
    duplicates,
    enableCandidates,
    emptyOrThin,
    approvedEnable: [],
    textFixes: [],
    wordFixes: [],
  };
}

async function apply(client, proposal, archiveJunk) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const backup = { timestamp: new Date().toISOString(), snapshot: await snapshot(client) };
  const backupFile = path.join(OUT_DIR, `backup-triage-${Date.now()}.json`);
  fs.writeFileSync(backupFile, JSON.stringify(backup, null, 1));
  console.log(`Backup written: ${backupFile}`);

  await client.query('BEGIN');
  try {
    let del = 0, arch = 0, dedup = 0, en = 0, fix = 0;
    const junkIds = (proposal.deleteJunk || []).map((x) => x.id ?? x);
    if (junkIds.length) {
      if (archiveJunk) {
        arch = (
          await client.query(
            `UPDATE dots.sentences SET enabled = false WHERE id = ANY($1)`,
            [junkIds],
          )
        ).rowCount;
      } else {
        await client.query(`DELETE FROM dots.sentences_progress WHERE id_sentence = ANY($1)`, [junkIds]);
        del = (
          await client.query(`DELETE FROM dots.sentences WHERE id = ANY($1)`, [junkIds])
        ).rowCount;
      }
    }
    const dupIds = (proposal.duplicates || []).map((x) => x.id ?? x);
    if (dupIds.length) {
      await client.query(`DELETE FROM dots.sentences_progress WHERE id_sentence = ANY($1)`, [dupIds]);
      dedup = (
        await client.query(`DELETE FROM dots.sentences WHERE id = ANY($1)`, [dupIds])
      ).rowCount;
    }
    const enIds = (proposal.approvedEnable || []).map((x) => x.id ?? x);
    if (enIds.length) {
      en = (
        await client.query(
          `UPDATE dots.sentences SET enabled = true WHERE id = ANY($1)`,
          [enIds],
        )
      ).rowCount;
    }
    for (const f of proposal.textFixes || []) {
      const vals = [f.id];
      const sets = [];
      if (f.text != null) { vals.push(f.text); sets.push(`text = $${vals.length}`); }
      if (f.m_word != null) { vals.push(f.m_word); sets.push(`m_word = $${vals.length}`); }
      if (sets.length) {
        await client.query(`UPDATE dots.sentences SET ${sets.join(', ')} WHERE id = $1`, vals);
        fix++;
      }
    }
    for (const f of proposal.wordFixes || []) {
      const vals = [f.id];
      const sets = [];
      if (f.text != null) { vals.push(f.text); sets.push(`text = $${vals.length}`); }
      if (f.meaning != null) { vals.push(f.meaning); sets.push(`meaning = $${vals.length}`); }
      if (sets.length) {
        await client.query(`UPDATE dots.words SET ${sets.join(', ')} WHERE id = $1`, vals);
        fix++;
      }
    }
    await client.query('COMMIT');
    console.log(`Applied: deleted=${del} archived=${arch} dedup=${dedup} enabled=${en} fixes=${fix}`);
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  }
}

async function rollback(client, backup) {
  await client.query('BEGIN');
  try {
    for (const t of SNAPSHOT_TABLES) {
      for (const row of backup.snapshot[t]) {
        const names = Object.keys(row);
        const params = names.map((_, i) => `$${i + 1}`).join(', ');
        const updates = names
          .filter((n) => n !== 'id')
          .map((n) => `${n} = EXCLUDED.${n}`)
          .join(', ');
        await client.query(
          `INSERT INTO dots.${t} (${names.join(', ')}) VALUES (${params})
           ON CONFLICT (id) DO UPDATE SET ${updates}`,
          names.map((n) =>
            row[n] !== null && typeof row[n] === 'object' ? JSON.stringify(row[n]) : row[n],
          ),
        );
      }
      await client.query(
        `SELECT setval(pg_get_serial_sequence('dots.${t}', 'id'), COALESCE((SELECT MAX(id) FROM dots.${t}), 1))`,
      );
    }
    await client.query('COMMIT');
    console.log('Rollback (upsert-restore) complete.');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  }
}

async function main() {
  const args = process.argv.slice(2);
  const applyIdx = args.indexOf('--apply');
  const rbIdx = args.indexOf('--rollback');
  const archiveJunk = args.includes('--archive-junk');
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const client = await connect();
  try {
    if (rbIdx !== -1) {
      const file = args[rbIdx + 1];
      if (!file) throw new Error('Usage: --rollback <backup.json>');
      await rollback(client, JSON.parse(fs.readFileSync(file, 'utf8')));
      return;
    }
    if (applyIdx !== -1) {
      const file = args[applyIdx + 1];
      if (!file) throw new Error('Usage: --apply <proposal.json>');
      const proposal = JSON.parse(fs.readFileSync(file, 'utf8'));
      await apply(client, proposal, archiveJunk);
      return;
    }
    // dry-run: build + write proposal, print summary
    const p = await buildProposal(client);
    const out = path.join(OUT_DIR, `triage-proposal-${Date.now()}.json`);
    fs.writeFileSync(out, JSON.stringify(p, null, 1));
    console.log('== triage-content (dry-run) ==');
    console.log(`junk=${p.deleteJunk.length} duplicates=${p.duplicates.length} ` +
      `enableCandidates=${p.enableCandidates.length} emptyOrThin=${p.emptyOrThin.length}`);
    console.log('emptyOrThin (enabled<8):');
    for (const l of p.emptyOrThin) console.log(`  L${l.id} "${l.name}": ${l.enabled} enabled`);
    console.log(`\nProposal -> ${out}\nReview it, fill approvedEnable/textFixes/wordFixes, then --apply.`);
  } finally {
    await client.end();
  }
}

main().catch((e) => { console.error('triage failed:', e.message); process.exit(1); });
```

- [ ] **Step 2: Agregar el npm script**

En `dots-backend/package.json`, junto a `"seed:foundations"`, agregar:

```json
"triage:content": "node scripts/triage-content.js",
```

- [ ] **Step 3: Correr el dry-run y verificar**

Run (desde `dots-backend/`):
```bash
source ~/.nvm/nvm.sh
node scripts/triage-content.js
```
Expected (aprox., los ids exactos salen del reporte en vivo):
- `junk≈13` (L1 alphabet aporta ~10; +numbers, months, Like).
- `emptyOrThin` incluye los ~18 niveles con `enabled=0` (verb to be, do/does, prepositions, Opposites…) y los vocab con 0 (daytime, furniture, house, body, school) y L32.
- Se creó `scripts/out/triage-proposal-<ts>.json`.

- [ ] **Step 4: Commit**

```bash
git add scripts/triage-content.js package.json
git commit -m "feat(triage): herramienta read-only de triage de contenido (dry-run + proposal)"
```

---

### Task 2: Gate de revisión humana (decisiones)

Sin código: convierte el proposal en un plan de cambios aprobado. **Requiere al usuario** (responde las preguntas abiertas del spec §7).

**Files:**
- Modify (a mano): `dots-backend/scripts/out/triage-proposal-<ts>.json` (o una copia `triage-approved.json`)

- [ ] **Step 1: Revisar `deleteJunk`** — confirmar que las ~13 son basura real. Quitar de la lista cualquier falso positivo. Decidir modo: borrar (default) o `--archive-junk`.

- [ ] **Step 2: Revisar `enableCandidates` y poblar `approvedEnable`** — por cada nivel apagado (verb to be, do/does, prepositions, etc.), mirar el texto: si las oraciones son inglés bien formado y on-topic, copiar sus `id` a `approvedEnable`. Las rotas/dudosas se dejan fuera (van a F1 para reescritura). **Aquí se responde "¿por qué estaban apagadas?"** viendo el contenido.

- [ ] **Step 3: Poblar `textFixes` / `wordFixes`** — typos y ruido confirmados: `daugther→daughter`, `sharpenner→sharpener`, normalizar `GRAY/GREY`, `"My short is"→"My shorts are"`, tokens `"f::__"`, formato de L55 "Opposites". Cada entrada: `{id, text}` o `{id, meaning}`.

- [ ] **Step 4: Decidir L32 vs L24 "reflexive pronouns"** — si es duplicado, se consolida en F3 (re-encaje del camino), no en F0; en F0 solo se documenta. Marcar la decisión en el reporte final (Task 4).

- [ ] **Step 5: Guardar** el proposal aprobado como `scripts/out/triage-approved.json`.

---

### Task 3: Aplicar a prod (gated) + verificación + drill de rollback

**Files:**
- Uses: `dots-backend/scripts/triage-content.js`, `scripts/out/triage-approved.json`
- Output: `scripts/out/backup-triage-<ts>.json`

- [ ] **Step 1: Dry-run del apply (sin escribir)** — inspeccionar el approved una vez más:
```bash
node -e "const p=require('./scripts/out/triage-approved.json');console.log('borrar',p.deleteJunk.length,'dedup',p.duplicates.length,'enable',p.approvedEnable.length,'textFixes',p.textFixes.length,'wordFixes',p.wordFixes.length)"
```
Expected: números coinciden con lo aprobado en Task 2.

- [ ] **Step 2: Aplicar (GATE — requiere OK explícito del usuario)**

Run:
```bash
node scripts/triage-content.js --apply scripts/out/triage-approved.json
```
(o con `--archive-junk` si se eligió archivar). Expected: imprime `Backup written: …` y `Applied: deleted=… enabled=… fixes=…` con los conteos esperados.

- [ ] **Step 3: Verificar estado post-apply**

Run:
```bash
node scripts/triage-content.js
```
Expected: `junk=0`; `emptyOrThin` ya NO lista los niveles re-habilitados; sin duplicados de los tratados.

- [ ] **Step 4: Verificar idempotencia** — re-aplicar el mismo approved:
```bash
node scripts/triage-content.js --apply scripts/out/triage-approved.json
```
Expected: `deleted=0` (ya no existen), `enabled=` (re-set no-op), sin errores.

- [ ] **Step 5: Drill de rollback (verificación de reversibilidad)** — restaurar desde el backup del Step 2 y confirmar que vuelve el estado previo, luego re-aplicar:
```bash
node scripts/triage-content.js --rollback scripts/out/backup-triage-<ts>.json
node scripts/triage-content.js   # junk vuelve a ~13 → rollback funciona
node scripts/triage-content.js --apply scripts/out/triage-approved.json  # re-aplicar el estado deseado
```
Expected: tras rollback el reporte vuelve a mostrar el junk; tras re-apply queda limpio.

- [ ] **Step 6: Commit** (el approved + el backup quedan versionados como evidencia)

```bash
git add scripts/out/triage-approved.json scripts/out/backup-triage-*.json
git commit -m "chore(triage): proposal aprobado + backup del apply F0"
```

---

### Task 4: Reporte final + estado del spec

**Files:**
- Create: `dots-webapp/docs/superpowers/plans/out/2026-07-22-f0-triage-reporte.md`
- Modify: `dots-webapp/docs/superpowers/specs/2026-07-22-contenido-camino-y-modulos-design.md` (marcar F0 como hecho; anotar decisión L32 y qué niveles quedaron pendientes para F1)

- [ ] **Step 1: Escribir el reporte final** — qué se borró, qué se re-habilitó, qué quedó pendiente para F1 (niveles con contenido roto que necesitan reescritura), y la decisión sobre L32.

- [ ] **Step 2: Actualizar el spec** — en §5 F0, añadir "✅ hecho 2026-07-22" + link al reporte; mover a F1 la lista de niveles a reescribir.

- [ ] **Step 3: Commit**

```bash
cd ../dots-webapp
git add docs/superpowers/plans/out/2026-07-22-f0-triage-reporte.md docs/superpowers/specs/2026-07-22-contenido-camino-y-modulos-design.md
git commit -m "docs(triage): reporte F0 + estado del spec"
```

---

## Self-Review

**Spec coverage (F0 del spec §5):**
- Borrar 13 basura → Task 1 (detección) + Task 3 (apply). ✓
- Re-habilitar/decidir ~18 niveles apagados → Task 2 Step 2 (revisión) + Task 3 (enable). ✓
- Vacíos (L32, vocab con 0) → documentados en Task 2 Step 4 / Task 4; su relleno es F1/F3 (fuera de F0 por diseño). ✓
- Typos/duplicados/formato → Task 2 Step 3 + Task 3. ✓
- Reversibilidad + backup → Global Constraints + Task 3 Step 5. ✓

**Placeholder scan:** los ids exactos se generan por el reporte en vivo (Task 1) y se aprueban en Task 2 — es un pipeline de datos, no un placeholder. El código de todos los modos (dry-run/apply/rollback) está completo en Task 1. ✓

**Type consistency:** el shape del proposal (`deleteJunk/duplicates/approvedEnable/textFixes/wordFixes`) es el mismo en `buildProposal`, en `apply`, y en las Tasks 2–3. Columnas verificadas: `sentences(id,level_id,text,m_word,enabled)`, `words(id,text,meaning)`, `sentences_progress(id_sentence)`. ✓
