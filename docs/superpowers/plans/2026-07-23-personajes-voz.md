# Personajes de Doty como voces de los audios — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development (recomendado) o superpowers:executing-plans. Steps con checkbox (`- [ ]`). El único write a prod es la migración del Task 1 (`--apply` lo corre el usuario).

**Goal:** Cada audio de lecciones/practice pertenece a un personaje de la familia Doty (elenco de 4): el dato queda fijado en BD (reparto retro balanceado), el backend expone el personaje en los payloads, y la UI muestra un placeholder (pose de Doty + nombre) junto a cada audio — avatar en rondas de escucha y mini-avatar en los botones 🔊 de la ronda inversa. Admin ve el personaje de cada audio y puede regenerar con personaje fijo.

**Architecture:** Task 1 = migración aditiva + reparto retro (script backend, patrón `migrate-item-progress.js`). Task 2 = backend voces (columna `accent`, picker filtrado, conteo y generación para letters/numbers). Task 3 = backend payloads (`character` en items de letters/numbers/vocab). Tasks 4–7 = front lecciones/practice (lib de identidad + `VoiceAvatar` + integración en 3 lecciones y practice). Task 8 = admin (badge + selector de narrador). Task 9 = verificación end-to-end + docs.

**Tech stack:** NestJS + TypeORM + pg (back), Next.js 16 + React 19 + Tailwind 4 (front), ElevenLabs TTS + Cloudinary (generación, sin consumo en este plan).

## Global Constraints

- **BD PostgreSQL compartida de producción:** scripts con dry-run por defecto, backup JSON en `scripts/out/`, `--rollback`; **`--apply` lo corre solo el usuario**.
- **🚨 `sentences` queda FUERA del reparto retro.** Su personaje construye la URL de Cloudinary (`narration.service.ts:137-141` — default en ruta legacy `dots/sounds/sentences/{id}`, resto en subcarpeta `{key}/`; los juegos derivan `voiceKey` con LEFT JOIN a characters en `games.service.ts:573,753`). Reasignar personaje a una sentence legacy movería la URL y rompería el audio en audio-blitz/builder/practice. **La voz legacy es canónicamente la de Doty**; el mismatch voz↔cara aceptado en grilling aplica solo a vocab/letters/numbers (su `audio` es URL completa autocontenida — reasignar el personaje NO mueve el archivo). Corrige la derivada técnica 1 del spec.
- **Voice IDs de ElevenLabs pendientes (el usuario aún elige):** todo debe funcionar con `elevenlabs_voice_id = NULL`. La capa visual no depende de la voz; generar con personaje sin voz responde 400 (comportamiento existente). Los IDs se cargan después con `--voices` (Task 1) sin re-migrar.
- **Picker de contenido base filtra `accent = 'en-US'`** solo en la selección automática; `characterId` explícito (override admin) no se filtra.
- **Alcance fase 1:** lecciones letters/numbers/vocab + practice. Juegos y pronunciation-drill NO (el dato queda listo). Regeneración retro de audios = F-media (fuera).
- **Front:** RN-safe (solo tap, transform/opacity) y compiler-safe (sin setState síncrono en efectos, sin efectos en updaters) según `CLAUDE.md`. `<select>` solo en admin (web-only), nunca en lecciones.
- **Elenco (keys/nombres BD, sin renames):** `doty` = "Doty" (default, juvenil M), `doty-fem` = "Doty Fem" (juvenil F), `doty-captain` = "Doty capitán" (adulto M grave), `doty-scientist` = "Doty científica" (adulta F precisa).
- **Prerrequisito de preview:** migración F3e (`migrate:item-progress --apply`) y la de este plan aplicadas; sin ellas las lecciones no cargan.
- Verificación por fase: `npx tsc --noEmit` + build + boot (back), `npm run lint` + `npx next build` (front), preview manual. No hay test runner de componentes.

---

## Task 1: Migración — elenco, `accent`, FKs y reparto retro (backend, prod)

**Files:**
- Create: `dots-backend/scripts/migrate-voice-characters.js`
- Modify: `dots-backend/package.json` (scripts)

**Interfaces:**
- Produces: filas `doty-captain`/`doty-scientist` en `dots.characters`; columna `characters.accent` (default `'en-US'`); columnas `letter_items.voice_character_id` y `number_items.voice_character_id`; reparto retro (todo ítem de `vocab_items`/`letter_items`/`number_items` con `audio` no nulo queda con `voice_character_id` de uno de los 4); flag `--voices key=voiceId,...` para cargar los IDs de ElevenLabs cuando existan.

- [ ] **Step 1: Escribir el script** (patrón `migrate-item-progress.js`: mismo `connect()`, dry-run por defecto, backup JSON, rollback que solo revierte lo que este run creó):

```js
#!/usr/bin/env node
/**
 * Personajes de voz (fase 1): agrega doty-captain y doty-scientist,
 * characters.accent, voice_character_id en letter/number items, y reparte
 * retro-balanceado el catálogo de lecciones entre los 4 personajes.
 *
 * IMPORTANTE: dots.sentences queda FUERA del reparto a propósito — su
 * personaje construye la URL de Cloudinary (ver narration.service.ts
 * sentencePublicId: el default vive en la ruta legacy sin subcarpeta).
 * Reasignar personaje ahí rompería el audio en juegos y practice.
 * La voz legacy es canónicamente la de Doty (default).
 *
 * Usage (from dots-backend/):
 *   node scripts/migrate-voice-characters.js            # dry-run
 *   node scripts/migrate-voice-characters.js --apply
 *   node scripts/migrate-voice-characters.js --apply --voices doty=ID1,doty-fem=ID2
 *   node scripts/migrate-voice-characters.js --rollback scripts/out/backup-voice-characters-<ts>.json
 *
 * --voices es idempotente y re-ejecutable: actualiza elevenlabs_voice_id
 * solo de los keys listados (sirve para cargar los IDs cuando el usuario
 * termine de elegirlos, sin tocar nada más).
 */
/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require('fs');
const path = require('path');
require('dotenv').config();
const { Client } = require('pg');

const OUT_DIR = path.join(__dirname, 'out');

const NEW_CHARACTERS = [
  { key: 'doty-captain', name: 'Doty capitán' },
  { key: 'doty-scientist', name: 'Doty científica' },
];
const CAST_KEYS = ['doty', 'doty-fem', 'doty-captain', 'doty-scientist'];
// audio es URL completa en estas tablas → reasignar personaje no mueve archivos.
const RETRO_TABLES = ['vocab_items', 'letter_items', 'number_items'];

const DDL = [
  `ALTER TABLE dots.characters ADD COLUMN IF NOT EXISTS accent varchar(10) NOT NULL DEFAULT 'en-US'`,
  `ALTER TABLE dots.letter_items ADD COLUMN IF NOT EXISTS voice_character_id integer`,
  `ALTER TABLE dots.number_items ADD COLUMN IF NOT EXISTS voice_character_id integer`,
];

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

async function columnExists(client, table, column) {
  const res = await client.query(
    `SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'dots' AND table_name = $1 AND column_name = $2`,
    [table, column],
  );
  return res.rowCount > 0;
}

function parseVoices(arg) {
  const map = {};
  for (const pair of arg.split(',')) {
    const [key, id] = pair.split('=');
    if (!key || !id) throw new Error(`--voices malformado: '${pair}' (esperado key=voiceId)`);
    if (!CAST_KEYS.includes(key)) throw new Error(`--voices: personaje desconocido '${key}'`);
    map[key.trim()] = id.trim();
  }
  return map;
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

async function rollback(client, backup) {
  console.log(`== rollback of ${backup.script} @ ${backup.timestamp} ==`);
  for (const { table, ids } of backup.retroAssigned ?? []) {
    if (!ids.length) continue;
    await client.query(
      `UPDATE dots.${table} SET voice_character_id = NULL WHERE id = ANY($1::int[])`,
      [ids],
    );
    console.log(`reverted retro: ${table} (${ids.length} rows)`);
  }
  for (const { key, prev } of backup.voicesPrev ?? []) {
    await client.query(
      `UPDATE dots.characters SET elevenlabs_voice_id = $2 WHERE key = $1`,
      [key, prev],
    );
    console.log(`reverted voice id: ${key}`);
  }
  if (backup.createdCharacterIds?.length) {
    await client.query(`DELETE FROM dots.characters WHERE id = ANY($1::int[])`, [
      backup.createdCharacterIds,
    ]);
    console.log(`deleted characters: ${backup.createdCharacterIds.join(', ')}`);
  }
  if (backup.createdLetterColumn) {
    await client.query(`ALTER TABLE dots.letter_items DROP COLUMN IF EXISTS voice_character_id`);
    console.log('dropped: letter_items.voice_character_id');
  }
  if (backup.createdNumberColumn) {
    await client.query(`ALTER TABLE dots.number_items DROP COLUMN IF EXISTS voice_character_id`);
    console.log('dropped: number_items.voice_character_id');
  }
  if (backup.createdAccentColumn) {
    await client.query(`ALTER TABLE dots.characters DROP COLUMN IF EXISTS accent`);
    console.log('dropped: characters.accent');
  }
  console.log('Rollback complete.');
}

async function main() {
  const args = process.argv.slice(2);
  const apply = args.includes('--apply');
  const rollbackIdx = args.indexOf('--rollback');
  const voicesIdx = args.indexOf('--voices');
  const voices = voicesIdx !== -1 ? parseVoices(args[voicesIdx + 1] ?? '') : null;

  fs.mkdirSync(OUT_DIR, { recursive: true });
  const client = await connect();

  try {
    if (rollbackIdx !== -1) {
      const backupFile = args[rollbackIdx + 1];
      if (!backupFile) throw new Error('Usage: --rollback <backup.json>');
      await rollback(client, JSON.parse(fs.readFileSync(backupFile, 'utf8')));
      return;
    }

    const hadAccent = await columnExists(client, 'characters', 'accent');
    const hadLetterCol = await columnExists(client, 'letter_items', 'voice_character_id');
    const hadNumberCol = await columnExists(client, 'number_items', 'voice_character_id');
    const existing = await client.query(
      `SELECT id, key, elevenlabs_voice_id FROM dots.characters WHERE key = ANY($1)`,
      [CAST_KEYS],
    );
    const existingByKey = new Map(existing.rows.map((r) => [r.key, r]));
    const toCreate = NEW_CHARACTERS.filter((c) => !existingByKey.has(c.key));

    // Reparto retro pendiente (solo lectura, sirve para el dry-run)
    const pending = {};
    for (const table of RETRO_TABLES) {
      const col = await columnExists(client, table, 'voice_character_id');
      if (!col) {
        pending[table] = null; // la columna se crea en este run
        continue;
      }
      const res = await client.query(
        `SELECT count(*)::int AS n FROM dots.${table}
          WHERE audio IS NOT NULL AND voice_character_id IS NULL`,
      );
      pending[table] = res.rows[0].n;
    }

    console.log('== voice characters migration (personajes-voz fase 1) ==');
    console.log(`characters.accent: ${hadAccent ? 'exists' : 'will create'}`);
    console.log(`letter_items.voice_character_id: ${hadLetterCol ? 'exists' : 'will create'}`);
    console.log(`number_items.voice_character_id: ${hadNumberCol ? 'exists' : 'will create'}`);
    console.log(`characters to insert: ${toCreate.map((c) => c.key).join(', ') || '(none)'}`);
    for (const table of RETRO_TABLES) {
      console.log(
        `retro ${table}: ${pending[table] == null ? 'todo el catálogo con audio (columna nueva)' : pending[table] + ' items sin personaje'}`,
      );
    }
    if (voices) console.log(`voices to set: ${Object.keys(voices).join(', ')}`);

    if (!apply) {
      console.log('\nDry-run only. Re-run with --apply to execute.');
      return;
    }

    const backup = {
      script: 'migrate-voice-characters',
      timestamp: new Date().toISOString(),
      createdAccentColumn: !hadAccent,
      createdLetterColumn: !hadLetterCol,
      createdNumberColumn: !hadNumberCol,
      createdCharacterIds: [],
      retroAssigned: [],
      voicesPrev: [],
    };

    await client.query('BEGIN');
    try {
      for (const sql of DDL) {
        await client.query(sql);
        console.log('OK:', sql.replace(/\s+/g, ' ').slice(0, 90));
      }

      for (const c of toCreate) {
        const res = await client.query(
          `INSERT INTO dots.characters (key, name, is_default, enabled)
           VALUES ($1, $2, false, true)
           ON CONFLICT (key) DO NOTHING
           RETURNING id`,
          [c.key, c.name],
        );
        if (res.rows[0]) {
          backup.createdCharacterIds.push(res.rows[0].id);
          console.log(`inserted character: ${c.key} (id ${res.rows[0].id})`);
        }
      }

      // Elenco completo (ids) para el reparto
      const cast = await client.query(
        `SELECT id, key FROM dots.characters WHERE key = ANY($1) ORDER BY id`,
        [CAST_KEYS],
      );
      const castIds = cast.rows.map((r) => r.id);
      if (castIds.length !== CAST_KEYS.length) {
        throw new Error(`Elenco incompleto: esperaba ${CAST_KEYS.length}, hay ${castIds.length}`);
      }

      // Reparto retro: round-robin sobre ítems barajados → balance casi
      // perfecto DENTRO del catálogo de lecciones. No se usa el conteo
      // global de narraciones porque las ~814 sentences legacy (todas del
      // default) lo sesgarían y doty no aparecería nunca en lecciones.
      for (const table of RETRO_TABLES) {
        const rows = await client.query(
          `SELECT id FROM dots.${table}
            WHERE audio IS NOT NULL AND voice_character_id IS NULL
            ORDER BY id`,
        );
        const ids = shuffle(rows.rows.map((r) => r.id));
        const byCharacter = new Map(castIds.map((cid) => [cid, []]));
        ids.forEach((id, i) => byCharacter.get(castIds[i % castIds.length]).push(id));
        for (const [cid, assigned] of byCharacter) {
          if (!assigned.length) continue;
          await client.query(
            `UPDATE dots.${table} SET voice_character_id = $1 WHERE id = ANY($2::int[])`,
            [cid, assigned],
          );
        }
        backup.retroAssigned.push({ table, ids });
        console.log(`retro ${table}: ${ids.length} items repartidos entre ${castIds.length} personajes`);
      }

      if (voices) {
        for (const [key, voiceId] of Object.entries(voices)) {
          const prev = await client.query(
            `SELECT elevenlabs_voice_id FROM dots.characters WHERE key = $1`,
            [key],
          );
          if (!prev.rowCount) throw new Error(`--voices: '${key}' no existe en characters`);
          backup.voicesPrev.push({ key, prev: prev.rows[0].elevenlabs_voice_id });
          await client.query(
            `UPDATE dots.characters SET elevenlabs_voice_id = $2 WHERE key = $1`,
            [key, voiceId],
          );
          console.log(`voice set: ${key}`);
        }
      }

      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    }

    const backupFile = path.join(OUT_DIR, `backup-voice-characters-${Date.now()}.json`);
    fs.writeFileSync(backupFile, JSON.stringify(backup, null, 2));
    console.log(`\nBackup written: ${backupFile}`);

    // Verificación: nada con audio queda sin personaje; reparto visible
    for (const table of RETRO_TABLES) {
      const res = await client.query(
        `SELECT count(*)::int AS n FROM dots.${table}
          WHERE audio IS NOT NULL AND voice_character_id IS NULL`,
      );
      if (res.rows[0].n !== 0) throw new Error(`Verification failed: ${table} tiene ${res.rows[0].n} items con audio sin personaje`);
      const dist = await client.query(
        `SELECT c.key, count(*)::int AS n FROM dots.${table} t
          JOIN dots.characters c ON c.id = t.voice_character_id
          WHERE t.audio IS NOT NULL GROUP BY c.key ORDER BY c.key`,
      );
      console.log(`${table}: ` + dist.rows.map((r) => `${r.key}=${r.n}`).join(' '));
    }
    console.log('\nMigration verified OK.');
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
```

- [ ] **Step 2: npm script.** En `dots-backend/package.json`, junto a `"migrate:item-progress"`:

```json
"migrate:voice-characters": "node scripts/migrate-voice-characters.js",
```

- [ ] **Step 3: Dry-run** (lee prod — requiere aprobación del usuario en esta máquina): `npm run migrate:voice-characters`. Esperado: `will create` × 3, `characters to insert: doty-captain, doty-scientist`, conteos retro ≈ vocab ~361+, letters 26, numbers 10.
- [ ] **Step 4: `--apply` (LO CORRE EL USUARIO):** `npm run migrate:voice-characters -- --apply`. Esperado: distribución pareja por tabla (26 letras → 7/7/6/6). El `--voices` puede correrse después, cuando el usuario tenga los 4 IDs.
- [ ] **Step 5: Commit** (back): `feat(db): elenco de voces, accent y reparto retro de personajes (migracion aditiva)`.

---

## Task 2: Backend — `accent` en picker, conteo completo y generación letters/numbers

**Files:**
- Modify: `dots-backend/src/common/entity/character.entity.ts`
- Modify: `dots-backend/src/common/entity/letter_item.entity.ts`, `dots-backend/src/common/entity/number_item.entity.ts`
- Modify: `dots-backend/src/modules/admin/narration.service.ts`
- Modify: `dots-backend/src/modules/admin/admin.controller.ts`, `admin.service.ts` (listCharacters), `admin.dto.ts` (Create/UpdateCharacterDto)

**Interfaces:**
- Consumes: columnas creadas en Task 1.
- Produces: `Character.accent: string`; `LetterItem.voiceCharacterId` / `NumberItem.voiceCharacterId`; `NarrationService.generateLetterAudio(id, characterId?)` y `generateNumberAudio(id, characterId?)` → `{ characterKey: string; url: string }`; rutas `POST /admin/letter-items/:id/generate-audio` y `POST /admin/number-items/:id/generate-audio` (body `GenerateNarrationDto`); `GET /admin/characters` ahora incluye `accent`.

- [ ] **Step 1: Entidades.** `character.entity.ts` — después de `enabled`:

```ts
/** Acento del personaje (p.ej. 'en-US', 'en-GB'). El contenido base solo usa 'en-US'. */
@Column({ type: 'varchar', length: 10, default: 'en-US' })
accent: string;
```

En `letter_item.entity.ts` y `number_item.entity.ts` — después de `audio` (mismo comentario que `sentences.entity.ts`):

```ts
/** Which character voices this item's clip (characters.id). App-layer relation only — no DB FK on purpose. */
@Column({ name: 'voice_character_id', type: 'int', nullable: true })
voiceCharacterId?: number | null;
```

- [ ] **Step 2: Picker filtra acento base.** En `narration.service.ts`, constante de módulo (bajo los imports):

```ts
/** Los niveles base solo usan acento US; los personajes acentuados debutan en niveles avanzados (gating futuro). */
const BASE_ACCENT = 'en-US';
```

En `pickCharacter` (línea ~99) cambiar el filtro de candidatos (el `explicitCharacterId` NO se filtra — el override admin puede elegir acentuados):

```ts
const candidates = enabled.filter(
  (c) => Boolean(c.elevenlabsVoiceId) && c.accent === BASE_ACCENT,
);
```

- [ ] **Step 3: Conteo incluye letters/numbers.** En `audioCountsByCharacter` (líneas 43-58) agregar al UNION:

```sql
UNION ALL
SELECT voice_character_id FROM dots.letter_items
  WHERE voice_character_id IS NOT NULL
UNION ALL
SELECT voice_character_id FROM dots.number_items
  WHERE voice_character_id IS NOT NULL
```

- [ ] **Step 4: Generación letters/numbers.** En `narration.service.ts`: constructor += `private readonly letterItemRepository: LetterItemRepository` y `private readonly numberItemRepository: NumberItemRepository` (imports desde `src/common/repository/…`; ambos ya están registrados en `admin.module.ts`). Métodos nuevos después de `generateVocabAudio`:

```ts
/** TTS del nombre de la letra ("bee" para B); cae a la letra si no hay name. */
async generateLetterAudio(
  letterItemId: number,
  characterId?: number,
): Promise<{ characterKey: string; url: string }> {
  const item = await this.letterItemRepository.findOne({
    where: { id: letterItemId },
  });
  if (!item) throw new NotFoundException('Letter item not found');

  const text = buildWordText(item.name || item.letter);
  const { character, voiceId } = await this.pickCharacter(characterId);

  const audio = await this.tts.synthesize(text, voiceId);
  const { url } = await this.cloudinary.uploadBuffer(audio, {
    publicId: `dots/sounds/letters/${character.key}/${audioSlug(item.letter, String(item.id))}`,
    kind: 'audio',
  });

  item.audio = url;
  item.voiceCharacterId = character.id;
  await this.letterItemRepository.save(item);

  return { characterKey: character.key, url };
}

async generateNumberAudio(
  numberItemId: number,
  characterId?: number,
): Promise<{ characterKey: string; url: string }> {
  const item = await this.numberItemRepository.findOne({
    where: { id: numberItemId },
  });
  if (!item) throw new NotFoundException('Number item not found');

  const text = buildWordText(item.word);
  const { character, voiceId } = await this.pickCharacter(characterId);

  const audio = await this.tts.synthesize(text, voiceId);
  const { url } = await this.cloudinary.uploadBuffer(audio, {
    publicId: `dots/sounds/numbers/${character.key}/${audioSlug(item.word, String(item.id))}`,
    kind: 'audio',
  });

  item.audio = url;
  item.voiceCharacterId = character.id;
  await this.numberItemRepository.save(item);

  return { characterKey: character.key, url };
}
```

- [ ] **Step 5: Rutas admin.** En `admin.controller.ts`, junto a `vocab-items/:id/generate-audio`:

```ts
@Post('letter-items/:id/generate-audio')
generateLetterAudio(
  @Param('id', ParseIntPipe) id: number,
  @Body() dto: GenerateNarrationDto,
) {
  return this.narrationService.generateLetterAudio(id, dto?.characterId);
}

@Post('number-items/:id/generate-audio')
generateNumberAudio(
  @Param('id', ParseIntPipe) id: number,
  @Body() dto: GenerateNarrationDto,
) {
  return this.narrationService.generateNumberAudio(id, dto?.characterId);
}
```

- [ ] **Step 6: Admin characters expone `accent`.** En `admin.service.ts` `listCharacters` (líneas 99-114) agregar `accent: c.accent,` al map. En `admin.dto.ts`, `CreateCharacterDto` y `UpdateCharacterDto` +=:

```ts
@IsOptional()
@IsString()
accent?: string;
```

(y en `admin.service.ts` `createCharacter`/`updateCharacter`, propagar `dto.accent` si viene — mismo patrón que `img`).

- [ ] **Step 7: Verificar:** `npx tsc --noEmit` y `npm run build` verdes. Boot contra la BD **con Task 1 aplicado** y `GET /admin/characters` devuelve 4 personajes con `accent: 'en-US'`.
- [ ] **Step 8: Commit** (back): `feat(narration): accent base en picker y generacion de audio para letters/numbers`.

---

## Task 3: Backend — `character` en los payloads de lección

**Files:**
- Modify: `dots-backend/src/modules/path/path.dto.ts`
- Modify: `dots-backend/src/modules/path/node-content.service.ts`
- Modify: `dots-backend/src/modules/path/path.module.ts` (registrar `Character` + `CharacterRepository`, espejo de cómo F3e registró `ItemProgress`)

**Interfaces:**
- Consumes: `voiceCharacterId` en `VocabItem`/`LetterItem`/`NumberItem` (Task 2).
- Produces: en `VocabNodeContentDto`/`LettersNodeContentDto`/`NumbersNodeContentDto`, cada item += `character?: ItemCharacterDto | null` con `ItemCharacterDto = { key: string; name: string; img?: string | null }`. (Practice NO cambia: `sentences.service.ts:86-109` ya emite `voice_key` y el front lo mapea solo.)

- [ ] **Step 1: DTO.** En `path.dto.ts`, junto a `ItemProgressDto` (línea ~59):

```ts
/** Personaje que narra el clip del ítem (la cara ES la voz). null = voz legacy/default. */
export type ItemCharacterDto = {
  key: string;
  name: string;
  img?: string | null;
};
```

y en los items de `VocabNodeContentDto`, `LettersNodeContentDto` y `NumbersNodeContentDto` (líneas 100-140):

```ts
character?: ItemCharacterDto | null;
```

- [ ] **Step 2: Resolver.** En `node-content.service.ts`: inyectar `private readonly characterRepository: CharacterRepository` (import + registro en `path.module.ts`), `import { In } from 'typeorm'`, y helper privado:

```ts
/** Batch-load de personajes para adjuntar {key,name,img} a los ítems. */
private async charactersById(
  ids: Array<number | null | undefined>,
): Promise<Map<number, ItemCharacterDto>> {
  const unique = [...new Set(ids.filter((v): v is number => v != null))];
  if (unique.length === 0) return new Map();
  const rows = await this.characterRepository.find({ where: { id: In(unique) } });
  return new Map(
    rows.map((c) => [c.id, { key: c.key, name: c.name, img: c.img ?? null }]),
  );
}
```

En `vocabContent` (línea ~202), `lettersContent` (~235) y `numbersContent` (~271), tras cargar `items`:

```ts
const charById = await this.charactersById(items.map((i) => i.voiceCharacterId));
```

y en el map de cada item:

```ts
character:
  item.voiceCharacterId != null
    ? (charById.get(item.voiceCharacterId) ?? null)
    : null,
```

- [ ] **Step 3: Verificar:** `npx tsc --noEmit` + build + boot; `GET /path/nodes/<id de un nodo letters>` (con JWT) → cada item trae `character: { key, name, img }` (reparto del Task 1). Commit (back): `feat(path): personaje narrador en payloads de letters/numbers/vocab`.

---

## Task 4: Front — tipos, identidad de personajes y `VoiceAvatar`

**Files:**
- Modify: `dots-webapp/services/lessons.service.ts`
- Create: `dots-webapp/lib/voice-characters.ts`
- Create: `dots-webapp/components/lesson/shared/voice-avatar.tsx`

**Interfaces:**
- Produces: `ItemCharacter = { key: string; name: string; img?: string | null }` (exportado de `lessons.service.ts`); `resolveVoiceCharacter(character?, voiceKey?) → { key, name, pose }`; `<VoiceAvatar character={…} voiceKey={…} size="sm"|"xs" />` (sm = avatar + nombre; xs = mini avatar sin nombre).

- [ ] **Step 1: Tipos.** En `lessons.service.ts`:

```ts
/** Personaje que narra el clip (la cara ES la voz). null = voz legacy/default (Doty). */
export type ItemCharacter = {
  key: string;
  name: string;
  img?: string | null;
};
```

y `character?: ItemCharacter | null;` en los items de `VocabContent` (línea ~43), `LettersContent` (~62) y `NumbersContent` (~78).

- [ ] **Step 2: Identidad placeholder.** Create `lib/voice-characters.ts`:

```ts
import type { ItemCharacter } from "@/services/lessons.service";

export type VoiceCharacterInfo = { key: string; name: string; pose: string };

/** Placeholder visual por personaje (poses PNG existentes de public/images/Doty)
 *  hasta que llegue el arte de Midjourney (characters.img). */
const BY_KEY: Record<string, VoiceCharacterInfo> = {
  doty: { key: "doty", name: "Doty", pose: "02" },
  "doty-fem": { key: "doty-fem", name: "Doty Fem", pose: "17" },
  "doty-captain": { key: "doty-captain", name: "Doty capitán", pose: "07" },
  "doty-scientist": { key: "doty-scientist", name: "Doty científica", pose: "11" },
};

const DEFAULT_CHARACTER = BY_KEY.doty;

/** Resuelve la identidad visual: payload de lección si viene; voiceKey solo
 *  (practice) mapea por key; sin dato → Doty (la voz legacy es la default). */
export function resolveVoiceCharacter(
  character?: ItemCharacter | null,
  voiceKey?: string | null,
): VoiceCharacterInfo {
  if (character) {
    const base = BY_KEY[character.key];
    return {
      key: character.key,
      name: character.name,
      pose: base?.pose ?? DEFAULT_CHARACTER.pose,
    };
  }
  if (voiceKey && BY_KEY[voiceKey]) return BY_KEY[voiceKey];
  return DEFAULT_CHARACTER;
}
```

- [ ] **Step 3: Componente.** Create `components/lesson/shared/voice-avatar.tsx` (RN-safe: estático, sin hover ni teclado; el import de `Doty` con la misma ruta que usa `components/lesson/result-screen.tsx`):

```tsx
"use client";

import Image from "next/image";
import Doty from "@/components/ui/doty/doty";
import { resolveVoiceCharacter } from "@/lib/voice-characters";
import type { ItemCharacter } from "@/services/lessons.service";

interface VoiceAvatarProps {
  character?: ItemCharacter | null;
  voiceKey?: string | null;
  /** sm = avatar + nombre (rondas de escucha); xs = mini avatar (botones 🔊). */
  size?: "sm" | "xs";
}

export function VoiceAvatar({ character, voiceKey, size = "sm" }: VoiceAvatarProps) {
  const info = resolveVoiceCharacter(character, voiceKey);
  const art = character?.img;
  return (
    <div className="flex flex-col items-center gap-0.5">
      {art ? (
        <Image
          src={art}
          alt={info.name}
          width={64}
          height={64}
          className={`h-auto select-none ${size === "xs" ? "w-8" : "w-16"}`}
          draggable={false}
        />
      ) : (
        <Doty pose={info.pose} size={size === "xs" ? "micro" : "mini"} />
      )}
      {size === "sm" && (
        <span className="text-xs font-semibold" style={{ color: "var(--muted)" }}>
          {info.name}
        </span>
      )}
    </div>
  );
}
```

(Si el export de `Doty` es nombrado en vez de default, ajustar el import — verificar contra `result-screen.tsx`.)

- [ ] **Step 4:** `npm run lint` verde. Commit (front): `feat(lesson): identidad de personajes de voz y VoiceAvatar placeholder`.

---

## Task 5: Front — avatar + nombre en las rondas de escucha

**Files:**
- Modify: `dots-webapp/components/lesson/vocab/listen-quiz.tsx`
- Modify: `dots-webapp/app/(app)/lesson/letters/page.tsx`
- Modify: `dots-webapp/app/(app)/lesson/numbers/page.tsx`

**Interfaces:**
- Consumes: `item.character` (Task 3/4 — ya fluye en los tipos de contenido, no hay que tocar props), `<VoiceAvatar />` (Task 4).

- [ ] **Step 1: Vocab (listen-quiz).** En `listen-quiz.tsx`, dentro de la card del turno y junto al botón "🔊 Escuchar de nuevo" (línea ~135), agregar el personaje del ítem objetivo:

```tsx
<VoiceAvatar character={target.character} />
```

(import del componente; el `target` ya es el ítem de `VocabContent`, trae `character` por tipos del Task 4).

- [ ] **Step 2: Letras (ronda directa).** En `letters/page.tsx`, etapa `direct` (líneas ~354-433): junto al botón de replay del turno (línea ~368), con `target` el ítem actual:

```tsx
<VoiceAvatar character={target?.character} />
```

- [ ] **Step 3: Números (recognize).** En `numbers/page.tsx`, fase `recognize`: junto al replay/autoplay del turno (zona de líneas ~163-166 y ~332), igual que letras:

```tsx
<VoiceAvatar character={target?.character} />
```

- [ ] **Step 4:** `npm run lint` + `npx next build` verdes. Commit: `feat(lesson): personaje narrador visible en rondas de escucha`.

---

## Task 6: Front — mini-avatar en los botones de la ronda inversa

**Files:**
- Modify: `dots-webapp/components/lesson/shared/audio-choice-quiz.tsx`
- Modify: `dots-webapp/components/lesson/vocab/vocab-pack.tsx` (map de `inverseItems`/`inversePool`, líneas ~66-79)
- Modify: `dots-webapp/app/(app)/lesson/letters/page.tsx` y `dots-webapp/app/(app)/lesson/numbers/page.tsx` (maps equivalentes hacia `AudioChoiceQuiz`)

**Interfaces:**
- Consumes: `ItemCharacter` (Task 4).
- Produces: `AudioChoice += character?: ItemCharacter | null`.

- [ ] **Step 1: Tipo.** En `audio-choice-quiz.tsx`:

```ts
export type AudioChoice = {
  id: number;
  prompt: string;
  audio: string;
  character?: ItemCharacter | null;
};
```

- [ ] **Step 2: Botones.** En el grid de botones 🔊 (líneas ~151-166), dentro de cada botón (tap sigue = reproducir Y seleccionar; solo se agrega contenido visual):

```tsx
<VoiceAvatar character={choice.character} size="xs" />
```

- [ ] **Step 3: Callers.** Propagar el personaje en cada map hacia `AudioChoice`. Ejemplo en `vocab-pack.tsx` (mismo cambio en `inversePool` y en los maps de letters/numbers):

```ts
const inverseItems = tramo
  .filter((i) => i.audio)
  .map((i) => ({ id: i.id, prompt: i.meaning, audio: i.audio!, character: i.character ?? null }));
```

- [ ] **Step 4:** `npm run lint` + `npx next build` verdes. Commit: `feat(lesson): mini-avatar del personaje en la ronda inversa`.

---

## Task 7: Front — personaje en practice

**Files:**
- Modify: `dots-webapp/components/practice-container/practice-container.tsx`

**Interfaces:**
- Consumes: `dataSentence.voice_key` (ya llega — se usa en la línea 112 para la URL) y `<VoiceAvatar voiceKey={…} />`.

- [ ] **Step 1:** Junto a los dos `<Sound autoplay … src={audioSrc}>` (líneas ~183 y ~281), cuando `audioSrc` no es vacío, mostrar quién habla (sin `character` del payload aquí; `voice_key` ausente = Doty default — correcto porque la voz legacy ES la de Doty):

```tsx
{audioSrc && <VoiceAvatar voiceKey={dataSentence.voice_key} />}
```

- [ ] **Step 2:** `npm run lint` + `npx next build` verdes. Commit: `feat(practice): personaje narrador junto al audio`.

---

## Task 8: Front — admin: badge de personaje + regenerar con narrador fijo

**Files:**
- Modify: `dots-webapp/services/admin.service.ts`
- Modify: `dots-webapp/components/admin/foundations/vocab-manager.tsx`
- Modify: `dots-webapp/components/admin/foundations/letters-manager.tsx`, `numbers-manager.tsx` (mismos nombres de archivo que renderiza `admin/foundations/page.tsx:62-66`)

**Interfaces:**
- Consumes: `GET /admin/characters` (existente), rutas nuevas del Task 2.
- Produces: `AdminCharacter`, `getAdminCharacters()`, `generateLetterAudio(id, characterId?)`, `generateNumberAudio(id, characterId?)`; `AdminVocabItem`/`AdminLetterItem`/`AdminNumberItem += voiceCharacterId?: number | null`.

- [ ] **Step 1: Fetchers + tipos.** En `admin.service.ts`:

```ts
export type AdminCharacter = {
  id: number;
  key: string;
  name: string;
  elevenlabsVoiceId?: string | null;
  img?: string | null;
  isDefault: boolean;
  enabled: boolean;
  accent?: string;
  audioCount: number;
};

export async function getAdminCharacters() {
  const { data } = await api.get<AdminCharacter[]>("/admin/characters");
  return data;
}

export async function generateLetterAudio(id: number, characterId?: number) {
  const { data } = await api.post(
    `/admin/letter-items/${id}/generate-audio`,
    characterId != null ? { characterId } : {},
  );
  return data;
}

export async function generateNumberAudio(id: number, characterId?: number) {
  const { data } = await api.post(
    `/admin/number-items/${id}/generate-audio`,
    characterId != null ? { characterId } : {},
  );
  return data;
}
```

y `voiceCharacterId?: number | null;` en `AdminVocabItem` (línea ~502), `AdminLetterItem` (~653) y `AdminNumberItem` (~747) — el backend ya lo devuelve al listar items (entities completas) una vez exista la columna.

- [ ] **Step 2: Selector de narrador (patrón compartido en cada manager).** En `vocab-manager.tsx` (y espejo en letters/numbers): estado + carga de personajes con el patrón `fetchAttempt` del repo, un `<select>` (admin es web-only) con "Auto (balanceado)" + los 4, y badge por fila:

```tsx
const [characters, setCharacters] = useState<AdminCharacter[]>([]);
const [narratorId, setNarratorId] = useState<number | undefined>(undefined);

useEffect(() => {
  let alive = true;
  getAdminCharacters()
    .then((rows) => { if (alive) setCharacters(rows); })
    .catch(() => {});
  return () => { alive = false; };
}, []);

const characterName = (id?: number | null) =>
  characters.find((c) => c.id === id)?.name ?? (id != null ? `#${id}` : "—");
```

Selector (encabezado de la tabla de items):

```tsx
<select
  value={narratorId ?? ""}
  onChange={(e) => setNarratorId(e.target.value === "" ? undefined : Number(e.target.value))}
  className="rounded-lg border px-2 py-1 text-sm"
  style={{ borderColor: "var(--border)" }}
>
  <option value="">Narrador: Auto (balanceado)</option>
  {characters.map((c) => (
    <option key={c.id} value={c.id}>{c.name}</option>
  ))}
</select>
```

Badge en cada fila de item (columna nueva "Voz" junto a Media): `{characterName(item.voiceCharacterId)}`.

- [ ] **Step 3: Generación con narrador.** `vocab-manager.tsx` línea ~225: `await generateVocabAudio(item.id, narratorId);`. En letters/numbers managers, botón "Generate audio" idéntico al de vocab (líneas 298-304) llamando `generateLetterAudio(item.id, narratorId)` / `generateNumberAudio(item.id, narratorId)`.
- [ ] **Step 4:** `npm run lint` + `npx next build` verdes. Commit: `feat(admin): voz por item y regeneracion con narrador fijo en foundations`.

---

## Task 9: Verificación end-to-end + docs

- [ ] **Step 1: Builds.** Back: `npx tsc --noEmit` + `npm run build` + boot. Front: `npm run lint` + `npx next build`.
- [ ] **Step 2: Preview** (backend local + `npm run dev`; requiere migraciones F3e y Task 1 aplicadas):
  - `/lesson/letters?id=…`: la ronda directa muestra avatar + nombre del personaje del ítem (cambia entre ítems por el reparto retro); la inversa muestra mini-avatar en cada botón 🔊.
  - `/lesson/vocab?id=…` (p.ej. days): listen muestra avatar+nombre; inversa con mini-avatares.
  - `/lesson/numbers?id=…`: recognize con avatar; ítems sin audio (eleven+) no muestran personaje.
  - Practice de un nivel con oraciones: junto al reproductor aparece Doty (voz legacy = default).
  - Admin foundations: columna "Voz" pobla nombres; selector "Narrador"; regenerar con personaje sin voice ID responde 400 con mensaje claro (esperado hasta que el usuario cargue `--voices`).
  - Confirmación del usuario en preview.
- [ ] **Step 3: Docs.** Marcar en `docs/superpowers/specs/2026-07-23-personajes-voz-design.md` el estado (implementado; pendientes: voice IDs `--voices`, arte Midjourney, batch retro F-media) y dejar constancia de la corrección de la derivada 1 (sentences fuera del reparto retro por acople URL↔personaje). Commit docs: `docs(contenido): personajes-voz implementado (fase datos + UI placeholder)`.

---

## Pendientes que NO bloquean (quedan detrás de este plan)

- **Voice IDs:** cuando el usuario elija las 4 voces → `npm run migrate:voice-characters -- --apply --voices doty=<id>,doty-fem=<id>,doty-captain=<id>,doty-scientist=<id>` (idempotente; solo actualiza voces).
- **Arte Midjourney:** cargar en `characters.img` (vía `PATCH /admin/characters/:id` o SQL); `VoiceAvatar` ya lo prefiere sobre el placeholder.
- **Regeneración retro (F-media):** batch que prioriza ítems cuyo personaje no calza con la voz legacy; ahí también se reparten las `sentences` (regenerar mueve el archivo a la subcarpeta correcta, así el reparto es seguro).
- **Gating por acento/nivel y juegos con personajes:** fases posteriores (columna `accent` ya queda).

## Self-Review

- **Cobertura del spec:** decisión 1 (reparto retro → Task 1, con la corrección documentada para sentences), 2 (elenco 4 → Task 1), 3 (accent → Tasks 1-2), 4 (mezcla por ítem — ya la produce el picker; el reparto retro la garantiza en catálogo viejo), 5 (Doty + nombre → Tasks 4-5), 6 (mini-avatar en inversa → Task 6), 7 (solo lecciones + practice → Tasks 5-7; juegos no se tocan), 8 (admin ver + override → Task 8), 9 (voces: `--voices` desacoplado, no bloquea), 10 (arte: `img` preferido en `VoiceAvatar`). ✓
- **Desviación consciente del spec:** derivada técnica 1 incluía "sentences legacy" en el reparto retro — excluido aquí porque `voice_character_id` construye la URL del clip (evidencia: `narration.service.ts:sentencePublicId`, `games.service.ts:573`); se resuelve en F-media al regenerar. Ratificar con el usuario. ✓
- **Tipos consistentes:** `ItemCharacterDto` (back) ↔ `ItemCharacter` (front) `{ key, name, img }`; `VoiceAvatar` props (`character`, `voiceKey`, `size`) iguales en Tasks 4-7; fetchers admin con `characterId?: number` igual que el existente `generateVocabAudio`. ✓
- **Sin placeholders:** todo step con código concreto; los dos puntos con incertidumbre real (export default vs nombrado de `Doty`, nombres exactos de letters/numbers managers) llevan instrucción de verificación contra archivos de referencia. ✓
- **Prod:** un solo write (Task 1), aditivo, con backup por fila y rollback completo; verificación automática post-apply (0 ítems con audio sin personaje + distribución impresa). ✓
