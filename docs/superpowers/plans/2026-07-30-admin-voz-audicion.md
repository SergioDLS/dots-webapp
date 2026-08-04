# Audición de voz en el admin — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que el admin pueda generar la voz de una oración o un fundamento, escucharla, y regenerarla hasta que le guste, sin que ninguna toma sin aprobar llegue al alumno.

**Architecture:** Generar sube a una ruta borrador de Cloudinary que ningún resolver del alumno referencia; publicar hace `rename` de esa ruta a la canónica y recién ahí escribe la BD. El `rename` es metadata, así que aprobar no gasta créditos de ElevenLabs. Los ajustes de voz (`voice_settings`) viajan efímeros en el borrador y se pueden guardar por personaje.

**Tech Stack:** NestJS + TypeORM + PostgreSQL (backend), Next.js 16 + React 19 + Tailwind 4 (webapp), ElevenLabs TTS, Cloudinary.

**Spec:** [`../specs/2026-07-30-admin-voz-audicion-design.md`](../specs/2026-07-30-admin-voz-audicion-design.md)

## Global Constraints

- **Node 22 vía nvm:** `source ~/.nvm/nvm.sh` SIEMPRE antes de cualquier `node`/`npm`. Sin eso `node` no existe en esta shell (fish/zsh).
- **Backend, verificación:** `npm test` (jest, `rootDir: src`, `testRegex: .*\.spec\.ts$`), `npx tsc --noEmit`, `npm run build`.
- **Webapp, verificación:** `npm run lint` + `npx next build`. **El webapp tiene CERO tests** — no inventes un test runner; la verificación es lint + build + preview manual.
- **BD PostgreSQL COMPARTIDA DE PRODUCCIÓN.** Ninguna migración se aplica sin el usuario. Los scripts van con dry-run por defecto y `--apply` explícito.
- **CLAUDE.md regla 3:** prohibido `setState` en el cuerpo de un `useEffect` y prohibidos efectos colaterales dentro de updaters de `setState` (StrictMode los doble-invoca).
- **CLAUDE.md regla 1:** navegación con `router.push`, nunca `window.location.*`.
- **CLAUDE.md regla 5:** todo fetch con estado de error + reintento por estado, nunca `window.location.reload`.
- **UI en español, tono juguetón.** El contenido a aprender en inglés.
- **Estilos:** variables CSS de `app/globals.css` (`--accent`, `--surface`, `--border`, `--muted`, `--danger`, `--success`), utilidades `dots-card`/`dots-pressable`. **No hay CSS modules.**
- `ButtonTone` válidos: `"accent" | "primary" | "neutral" | "ghost"`.

---

## File Structure

**Backend (`../dots-backend`)**

| Archivo | Responsabilidad |
|---|---|
| `scripts/migrate-voice-settings.js` | **Crear.** Migración aditiva de 4 columnas en `dots.characters` |
| `src/modules/admin/narration.util.ts` | **Modificar.** Helpers puros: ruta borrador + ajustes de voz |
| `src/modules/admin/narration.util.spec.ts` | **Crear.** Tests unitarios de esos helpers |
| `src/common/entity/character.entity.ts` | **Modificar.** 4 columnas nuevas |
| `src/modules/admin/tts.service.ts` | **Modificar.** `synthesize(text, voiceId, opts?)` + `getVoiceSettings(voiceId)` |
| `src/modules/admin/cloudinary.service.ts` | **Modificar.** `rename()` |
| `src/modules/admin/narration.service.ts` | **Modificar.** Extraer helpers + `draft*`/`publish*` ×5 |
| `src/modules/admin/admin.dto.ts` | **Modificar.** `GenerateNarrationDto` extendido + `PublishNarrationDto` + `UpdateCharacterDto` extendido |
| `src/modules/admin/admin.controller.ts` | **Modificar.** 11 rutas nuevas |
| `src/modules/admin/admin.service.ts` | **Modificar.** `serializeSentence` expone la voz |
| `scripts/generate-narrations.js` | **Modificar.** Honrar ajustes guardados del personaje |

**Webapp (`.`)**

| Archivo | Responsabilidad |
|---|---|
| `services/admin.service.ts` | **Modificar.** Fetchers de draft/publish/ajustes + tipos |
| `components/admin/voice-settings-panel.tsx` | **Crear.** Sliders de `voice_settings` |
| `components/admin/voice-studio.tsx` | **Crear.** Ciclo generar → escuchar → publicar |
| `components/admin/voice-modal.tsx` | **Crear.** `AdminModal` + `VoiceStudio` para filas |
| `components/admin/sentence-modal.tsx` | **Modificar.** Bloque de narración + relabel |
| `components/admin/foundations/{vocab,letters,numbers,pronunciation}-manager.tsx` | **Modificar.** Fila abre `VoiceModal` |

---

## Fase A — Backend

### Task 1: Migración de `dots.characters` (con gate humano)

**Files:**
- Create: `../dots-backend/scripts/migrate-voice-settings.js`
- Modify: `../dots-backend/package.json` (bloque `scripts`)

**Interfaces:**
- Consumes: nada.
- Produces: columnas `tts_stability`, `tts_similarity_boost`, `tts_style` (`double precision`) y `tts_speaker_boost` (`boolean`) en `dots.characters`, todas `NULL`.

⚠️ **Esta tarea NO toca el entity.** Si agregas columnas al `character.entity.ts` antes de que el usuario aplique la migración, TypeORM pide columnas inexistentes y rompe en caliente el backend del usuario, que corre con watcher contra producción. El entity se toca en la Task 3.

⚠️ **`double precision`, no `numeric`.** `pg` devuelve `numeric` como **string** en JS. Un `"0.5"` serializado a JSON llega a ElevenLabs como string y responde 422. `double precision` vuelve como `number` nativo.

- [ ] **Step 1: Crear el script de migración**

```javascript
#!/usr/bin/env node
/**
 * Additive schema migration: per-character ElevenLabs voice_settings overrides
 * on dots.characters. The four columns are nullable and start NULL, which means
 * "no override" — the request then carries no voice_settings and ElevenLabs uses
 * the settings saved on the voice. So applying this migration changes NOTHING
 * about current behaviour.
 *
 * double precision (not numeric) on purpose: node-postgres returns numeric as a
 * STRING, and a stringified "0.5" makes the ElevenLabs API reject the body.
 *
 * Usage (from dots-backend/):
 *   node scripts/migrate-voice-settings.js            # dry-run: shows DDL, no writes
 *   node scripts/migrate-voice-settings.js --apply    # DDL in a txn, backup in scripts/out/
 *   node scripts/migrate-voice-settings.js --rollback scripts/out/backup-voice-settings-<ts>.json
 *
 * Rollback drops only the columns this run created.
 */
/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require('fs');
const path = require('path');
require('dotenv').config();
const { Client } = require('pg');

const OUT_DIR = path.join(__dirname, 'out');

const NEW_COLUMNS = [
  { name: 'tts_stability', type: 'double precision' },
  { name: 'tts_similarity_boost', type: 'double precision' },
  { name: 'tts_style', type: 'double precision' },
  { name: 'tts_speaker_boost', type: 'boolean' },
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

async function existingColumns(client) {
  const res = await client.query(
    `SELECT column_name FROM information_schema.columns
      WHERE table_schema = 'dots' AND table_name = 'characters'
        AND column_name = ANY($1)`,
    [NEW_COLUMNS.map((c) => c.name)],
  );
  return new Set(res.rows.map((r) => r.column_name));
}

async function rollback(client, backup) {
  console.log(`== rollback of ${backup.script} @ ${backup.timestamp} ==`);
  for (const col of backup.createdColumns ?? []) {
    await client.query(`ALTER TABLE dots.characters DROP COLUMN IF EXISTS ${col}`);
    console.log(`dropped: dots.characters.${col}`);
  }
  console.log('Rollback complete.');
}

async function main() {
  const args = process.argv.slice(2);
  const apply = args.includes('--apply');
  const rollbackIdx = args.indexOf('--rollback');

  fs.mkdirSync(OUT_DIR, { recursive: true });
  const client = await connect();

  try {
    if (rollbackIdx !== -1) {
      const backupFile = args[rollbackIdx + 1];
      if (!backupFile) throw new Error('Usage: --rollback <backup.json>');
      await rollback(client, JSON.parse(fs.readFileSync(backupFile, 'utf8')));
      return;
    }

    const before = await existingColumns(client);
    const toCreate = NEW_COLUMNS.filter((c) => !before.has(c.name));
    const ddl = toCreate.map(
      (c) => `ALTER TABLE dots.characters ADD COLUMN ${c.name} ${c.type}`,
    );

    console.log('== voice_settings migration ==');
    console.log(
      `columns to create: ${toCreate.map((c) => c.name).join(', ') || '(none — all exist)'}`,
    );

    if (!apply) {
      console.log('\nDDL preview:');
      for (const sql of ddl) console.log('  ' + sql);
      console.log('\nDry-run only. Re-run with --apply to execute.');
      return;
    }

    const backup = {
      script: 'migrate-voice-settings',
      timestamp: new Date().toISOString(),
      createdColumns: toCreate.map((c) => c.name),
    };

    await client.query('BEGIN');
    try {
      for (const sql of ddl) {
        await client.query(sql);
        console.log('OK:', sql);
      }
      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    }

    const backupFile = path.join(
      OUT_DIR,
      `backup-voice-settings-${Date.now()}.json`,
    );
    fs.writeFileSync(backupFile, JSON.stringify(backup, null, 2));
    console.log(`\nBackup written: ${backupFile}`);

    const after = await existingColumns(client);
    if (after.size !== NEW_COLUMNS.length) {
      throw new Error('Verification failed: missing columns');
    }
    const nulls = await client.query(
      `SELECT count(*)::int AS n FROM dots.characters
        WHERE tts_stability IS NOT NULL OR tts_similarity_boost IS NOT NULL
           OR tts_style IS NOT NULL OR tts_speaker_boost IS NOT NULL`,
    );
    console.log(`characters with overrides: ${nulls.rows[0].n} (expected 0)`);
    console.log('\nMigration verified OK.');
  } finally {
    await client.end();
  }
}

void main().catch((e) => {
  console.error(e);
  process.exit(1);
});
```

- [ ] **Step 2: Registrar el script en `package.json`**

Agregar a `scripts`, junto a las otras `migrate:*`:

```json
    "migrate:voice-settings": "node scripts/migrate-voice-settings.js",
```

- [ ] **Step 3: Correr el dry-run**

```bash
source ~/.nvm/nvm.sh && cd ../dots-backend && npm run migrate:voice-settings
```

Esperado: lista las 4 columnas a crear, imprime los 4 `ALTER TABLE` y termina con `Dry-run only. Re-run with --apply to execute.` **Sin escribir nada.**

- [ ] **Step 4: Commit**

```bash
cd ../dots-backend
git add scripts/migrate-voice-settings.js package.json
git commit -m "feat(narration): migracion aditiva de voice_settings por personaje"
```

- [ ] **Step 5: 🛑 GATE — el usuario aplica la migración**

**DETENTE aquí y pide al usuario que corra:**

```bash
source ~/.nvm/nvm.sh && cd dots-backend && npm run migrate:voice-settings -- --apply
```

Esperado: 4 `OK: ALTER TABLE...`, un backup en `scripts/out/`, `characters with overrides: 0 (expected 0)` y `Migration verified OK.`

**No sigas a la Task 3 sin confirmación.** La Task 2 sí se puede hacer mientras (solo toca helpers puros).

---

### Task 2: Helpers puros de rutas borrador y ajustes de voz (TDD)

**Files:**
- Modify: `../dots-backend/src/modules/admin/narration.util.ts`
- Test: `../dots-backend/src/modules/admin/narration.util.spec.ts` (crear)

**Interfaces:**
- Consumes: `HttpException` de `@nestjs/common` (ya importado en el archivo).
- Produces:
  - `type VoiceSettings = { stability: number; similarityBoost: number; style: number; useSpeakerBoost: boolean }`
  - `draftPublicId(entity: string, characterKey: string, id: number | string, suffix?: string): string`
  - `parseVoiceSettings(raw: unknown): VoiceSettings | null`
  - `characterVoiceSettings(c: {...}): VoiceSettings | null`
  - `resolveVoiceSettings(fromBody: VoiceSettings | null, fromCharacter: VoiceSettings | null): VoiceSettings | null`
  - `toElevenLabsVoiceSettings(s: VoiceSettings): { stability: number; similarity_boost: number; style: number; use_speaker_boost: boolean }`

- [ ] **Step 1: Escribir el test que falla**

Crear `src/modules/admin/narration.util.spec.ts`:

```typescript
import {
  characterVoiceSettings,
  draftPublicId,
  parseVoiceSettings,
  resolveVoiceSettings,
  toElevenLabsVoiceSettings,
  type VoiceSettings,
} from './narration.util';

const FULL: VoiceSettings = {
  stability: 0.4,
  similarityBoost: 0.8,
  style: 0.1,
  useSpeakerBoost: true,
};

describe('draftPublicId', () => {
  it('builds a path under the drafts root, scoped by character', () => {
    expect(draftPublicId('sentences', 'doty-sailor', 42)).toBe(
      'dots/sounds/_drafts/sentences/doty-sailor/42',
    );
  });

  it('appends a suffix for multi-clip items (minimal pairs)', () => {
    expect(draftPublicId('pronunciation-items', 'doty', 7, '-a')).toBe(
      'dots/sounds/_drafts/pronunciation-items/doty/7-a',
    );
    expect(draftPublicId('pronunciation-items', 'doty', 7, '-b')).toBe(
      'dots/sounds/_drafts/pronunciation-items/doty/7-b',
    );
  });

  it('is deterministic so regenerating overwrites the previous take', () => {
    expect(draftPublicId('vocab-items', 'doty', 3)).toBe(
      draftPublicId('vocab-items', 'doty', 3),
    );
  });

  it('never collides across characters for the same item', () => {
    expect(draftPublicId('vocab-items', 'doty', 3)).not.toBe(
      draftPublicId('vocab-items', 'doty-scientist', 3),
    );
  });
});

describe('parseVoiceSettings', () => {
  it('returns null when absent so no voice_settings is sent at all', () => {
    expect(parseVoiceSettings(undefined)).toBeNull();
    expect(parseVoiceSettings(null)).toBeNull();
  });

  it('accepts a complete set', () => {
    expect(
      parseVoiceSettings({
        stability: 0.4,
        similarityBoost: 0.8,
        style: 0.1,
        useSpeakerBoost: true,
      }),
    ).toEqual(FULL);
  });

  it('accepts the boundary values 0 and 1', () => {
    expect(
      parseVoiceSettings({
        stability: 0,
        similarityBoost: 1,
        style: 0,
        useSpeakerBoost: false,
      }),
    ).toEqual({
      stability: 0,
      similarityBoost: 1,
      style: 0,
      useSpeakerBoost: false,
    });
  });

  it('rejects a partial set — all four or nothing', () => {
    expect(() => parseVoiceSettings({ stability: 0.4 })).toThrow();
    expect(() =>
      parseVoiceSettings({ stability: 0.4, similarityBoost: 0.8, style: 0.1 }),
    ).toThrow();
  });

  it('rejects values outside 0..1', () => {
    expect(() => parseVoiceSettings({ ...FULL, stability: 1.5 })).toThrow();
    expect(() => parseVoiceSettings({ ...FULL, style: -0.1 })).toThrow();
  });

  it('rejects non-numeric values, including numeric strings', () => {
    expect(() => parseVoiceSettings({ ...FULL, stability: '0.4' })).toThrow();
    expect(() => parseVoiceSettings({ ...FULL, stability: NaN })).toThrow();
  });

  it('rejects a non-boolean useSpeakerBoost', () => {
    expect(() =>
      parseVoiceSettings({ ...FULL, useSpeakerBoost: 'true' }),
    ).toThrow();
  });

  it('rejects non-objects', () => {
    expect(() => parseVoiceSettings('nope')).toThrow();
    expect(() => parseVoiceSettings([0.4, 0.8, 0.1, true])).toThrow();
  });
});

describe('characterVoiceSettings', () => {
  it('returns null when the character has no overrides', () => {
    expect(
      characterVoiceSettings({
        ttsStability: null,
        ttsSimilarityBoost: null,
        ttsStyle: null,
        ttsSpeakerBoost: null,
      }),
    ).toBeNull();
  });

  it('returns null when the override set is incomplete', () => {
    expect(
      characterVoiceSettings({
        ttsStability: 0.4,
        ttsSimilarityBoost: 0.8,
        ttsStyle: null,
        ttsSpeakerBoost: true,
      }),
    ).toBeNull();
  });

  it('reads a complete override set', () => {
    expect(
      characterVoiceSettings({
        ttsStability: 0.4,
        ttsSimilarityBoost: 0.8,
        ttsStyle: 0.1,
        ttsSpeakerBoost: true,
      }),
    ).toEqual(FULL);
  });

  it('coerces numeric strings, guarding against a numeric column', () => {
    const got = characterVoiceSettings({
      ttsStability: '0.4' as unknown as number,
      ttsSimilarityBoost: '0.8' as unknown as number,
      ttsStyle: '0.1' as unknown as number,
      ttsSpeakerBoost: true,
    });
    expect(got).toEqual(FULL);
    expect(typeof got?.stability).toBe('number');
  });
});

describe('resolveVoiceSettings', () => {
  const fromChar: VoiceSettings = { ...FULL, stability: 0.9 };

  it('prefers the body over the character', () => {
    expect(resolveVoiceSettings(FULL, fromChar)).toEqual(FULL);
  });

  it('falls back to the character when the body has none', () => {
    expect(resolveVoiceSettings(null, fromChar)).toEqual(fromChar);
  });

  it('returns null when neither has settings', () => {
    expect(resolveVoiceSettings(null, null)).toBeNull();
  });
});

describe('toElevenLabsVoiceSettings', () => {
  it('maps camelCase to the snake_case the API expects', () => {
    expect(toElevenLabsVoiceSettings(FULL)).toEqual({
      stability: 0.4,
      similarity_boost: 0.8,
      style: 0.1,
      use_speaker_boost: true,
    });
  });
});
```

- [ ] **Step 2: Correr el test para verificar que falla**

```bash
source ~/.nvm/nvm.sh && cd ../dots-backend && npm test -- narration.util
```

Esperado: FAIL. TypeScript no compila porque `draftPublicId`, `parseVoiceSettings`, `characterVoiceSettings`, `resolveVoiceSettings`, `toElevenLabsVoiceSettings` y `VoiceSettings` no existen en `./narration.util`.

- [ ] **Step 3: Implementar los helpers**

Agregar al final de `src/modules/admin/narration.util.ts`:

```typescript
/**
 * Ajustes de voz de ElevenLabs. Los cuatro juntos o ninguno: un
 * voice_settings parcial deja a la API decidiendo el resto, que es
 * justo la ambigüedad que no queremos (decisión 13 del spec).
 */
export type VoiceSettings = {
  stability: number;
  similarityBoost: number;
  style: number;
  useSpeakerBoost: boolean;
};

const DRAFT_ROOT = 'dots/sounds/_drafts';

/**
 * Ruta borrador, determinista por (entidad, personaje, ítem). Regenerar
 * sobrescribe la toma anterior, así que nunca queda más de un archivo por
 * personaje y por ítem. Va alcanzada por personaje para que publish se
 * autovalide: si el rename no encuentra el archivo, ese narrador no generó
 * borrador y la API responde 409 en vez de publicar algo incoherente.
 *
 * Ningún resolver del alumno construye rutas bajo DRAFT_ROOT — es lo que
 * hace seguro auditar tomas contra una BD de producción.
 */
export function draftPublicId(
  entity: string,
  characterKey: string,
  id: number | string,
  suffix = '',
): string {
  return `${DRAFT_ROOT}/${entity}/${characterKey}/${id}${suffix}`;
}

function unitInterval(value: unknown, field: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new HttpException(`voiceSettings.${field} must be a number`, 400);
  }
  if (value < 0 || value > 1) {
    throw new HttpException(`voiceSettings.${field} must be between 0 and 1`, 400);
  }
  return value;
}

/** Valida el voiceSettings crudo del body. Ausente → null (no se manda nada). */
export function parseVoiceSettings(raw: unknown): VoiceSettings | null {
  if (raw === undefined || raw === null) return null;
  if (typeof raw !== 'object' || Array.isArray(raw)) {
    throw new HttpException('voiceSettings must be an object', 400);
  }
  const o = raw as Record<string, unknown>;
  if (typeof o.useSpeakerBoost !== 'boolean') {
    throw new HttpException(
      'voiceSettings.useSpeakerBoost must be a boolean',
      400,
    );
  }
  return {
    stability: unitInterval(o.stability, 'stability'),
    similarityBoost: unitInterval(o.similarityBoost, 'similarityBoost'),
    style: unitInterval(o.style, 'style'),
    useSpeakerBoost: o.useSpeakerBoost,
  };
}

/**
 * Ajustes guardados en el personaje, o null si no tiene los cuatro.
 * El Number() es defensivo: si algún día las columnas pasan a `numeric`,
 * pg las devolvería como string y ElevenLabs rechazaría el body con 422.
 */
export function characterVoiceSettings(c: {
  ttsStability?: number | null;
  ttsSimilarityBoost?: number | null;
  ttsStyle?: number | null;
  ttsSpeakerBoost?: boolean | null;
}): VoiceSettings | null {
  if (
    c.ttsStability == null ||
    c.ttsSimilarityBoost == null ||
    c.ttsStyle == null ||
    c.ttsSpeakerBoost == null
  ) {
    return null;
  }
  return {
    stability: Number(c.ttsStability),
    similarityBoost: Number(c.ttsSimilarityBoost),
    style: Number(c.ttsStyle),
    useSpeakerBoost: c.ttsSpeakerBoost,
  };
}

/** Precedencia: body > personaje > nada (nada = no mandar voice_settings). */
export function resolveVoiceSettings(
  fromBody: VoiceSettings | null,
  fromCharacter: VoiceSettings | null,
): VoiceSettings | null {
  return fromBody ?? fromCharacter ?? null;
}

/** camelCase interno → snake_case que espera la API de ElevenLabs. */
export function toElevenLabsVoiceSettings(s: VoiceSettings): {
  stability: number;
  similarity_boost: number;
  style: number;
  use_speaker_boost: boolean;
} {
  return {
    stability: s.stability,
    similarity_boost: s.similarityBoost,
    style: s.style,
    use_speaker_boost: s.useSpeakerBoost,
  };
}
```

- [ ] **Step 4: Correr el test para verificar que pasa**

```bash
source ~/.nvm/nvm.sh && cd ../dots-backend && npm test -- narration.util
```

Esperado: PASS, 21 tests.

- [ ] **Step 5: Commit**

```bash
cd ../dots-backend
git add src/modules/admin/narration.util.ts src/modules/admin/narration.util.spec.ts
git commit -m "feat(narration): helpers puros de ruta borrador y voice_settings"
```

---

### Task 3: Entity + `ElevenLabsTtsService` con ajustes

**Requiere:** el gate de la Task 1 confirmado por el usuario. Sin la migración aplicada, agregar las columnas al entity rompe el backend en caliente.

**Files:**
- Modify: `../dots-backend/src/common/entity/character.entity.ts`
- Modify: `../dots-backend/src/modules/admin/tts.service.ts`

**Interfaces:**
- Consumes: `VoiceSettings` y `toElevenLabsVoiceSettings` de la Task 2.
- Produces:
  - `Character.ttsStability?: number | null`, `.ttsSimilarityBoost?`, `.ttsStyle?`, `.ttsSpeakerBoost?: boolean | null`
  - `ElevenLabsTtsService.synthesize(text: string, voiceId: string, opts?: { settings?: VoiceSettings | null; seed?: number }): Promise<Buffer>`
  - `ElevenLabsTtsService.getVoiceSettings(voiceId: string): Promise<VoiceSettings>`

- [ ] **Step 1: Agregar las 4 columnas al entity**

En `src/common/entity/character.entity.ts`, después del campo `accent`:

```typescript
  /**
   * Overrides de voice_settings de ElevenLabs para este personaje. Los cuatro
   * o ninguno: con alguno en NULL no se manda voice_settings y la API usa los
   * ajustes guardados en la voz. `float` (double precision) a propósito —
   * `numeric` volvería como string desde pg y ElevenLabs rechazaría el body.
   */
  @Column({ name: 'tts_stability', type: 'float', nullable: true })
  ttsStability?: number | null;

  @Column({ name: 'tts_similarity_boost', type: 'float', nullable: true })
  ttsSimilarityBoost?: number | null;

  @Column({ name: 'tts_style', type: 'float', nullable: true })
  ttsStyle?: number | null;

  @Column({ name: 'tts_speaker_boost', type: 'bool', nullable: true })
  ttsSpeakerBoost?: boolean | null;
```

- [ ] **Step 2: Extender `synthesize` y agregar `getVoiceSettings`**

En `src/modules/admin/tts.service.ts`, agregar el import:

```typescript
import {
  toElevenLabsVoiceSettings,
  type VoiceSettings,
} from './narration.util';
```

Reemplazar el método `synthesize` completo por:

```typescript
  /**
   * Synthesizes `text` with the given ElevenLabs voice. Returns MP3 bytes.
   *
   * Without `opts` the request body is byte-for-byte what it always was
   * ({ text, model_id }), so ElevenLabs applies the settings saved on the
   * voice and nothing about existing generation changes.
   */
  async synthesize(
    text: string,
    voiceId: string,
    opts?: { settings?: VoiceSettings | null; seed?: number },
  ): Promise<Buffer> {
    if (!this.apiKey) {
      throw new HttpException('Narration generation is not configured', 503);
    }

    const url =
      `${ELEVENLABS_API_BASE}/text-to-speech/${encodeURIComponent(voiceId)}` +
      `?output_format=mp3_44100_128`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'xi-api-key': this.apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text,
        model_id: this.modelId,
        ...(opts?.settings
          ? { voice_settings: toElevenLabsVoiceSettings(opts.settings) }
          : {}),
        ...(opts?.seed != null ? { seed: opts.seed } : {}),
      }),
    });

    if (res.status === 429) throw new TtsRateLimitException();
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      this.logger.error(
        `ElevenLabs HTTP ${res.status}: ${detail.slice(0, 300)}`,
      );
      throw new HttpException('Narration synthesis failed', 502);
    }

    return Buffer.from(await res.arrayBuffer());
  }

  /**
   * Settings currently saved on a voice. Read-only metadata call: it does NOT
   * spend generation credits, which is what lets the admin panel seed its
   * sliders with honest values instead of invented defaults.
   */
  async getVoiceSettings(voiceId: string): Promise<VoiceSettings> {
    if (!this.apiKey) {
      throw new HttpException('Narration generation is not configured', 503);
    }
    const res = await fetch(
      `${ELEVENLABS_API_BASE}/voices/${encodeURIComponent(voiceId)}/settings`,
      { headers: { 'xi-api-key': this.apiKey } },
    );
    if (res.status === 429) throw new TtsRateLimitException();
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      this.logger.error(
        `ElevenLabs settings HTTP ${res.status}: ${detail.slice(0, 300)}`,
      );
      throw new HttpException('Could not read the voice settings', 502);
    }
    const raw = (await res.json()) as Record<string, unknown>;
    return {
      stability: Number(raw.stability ?? 0.5),
      similarityBoost: Number(raw.similarity_boost ?? 0.75),
      style: Number(raw.style ?? 0),
      useSpeakerBoost: Boolean(raw.use_speaker_boost ?? true),
    };
  }
```

- [ ] **Step 3: Type-check y build**

```bash
source ~/.nvm/nvm.sh && cd ../dots-backend && npx tsc --noEmit && npm run build
```

Esperado: sin errores.

- [ ] **Step 4: Verificar que el backend sigue leyendo personajes**

Con el backend corriendo, confirmar que las columnas nuevas no rompieron nada:

```bash
curl -s localhost:4000/admin/characters -H "Authorization: Bearer <token>" | head -c 400
```

Esperado: JSON con los personajes. Si responde error de columna inexistente, **la migración de la Task 1 no se aplicó** — detente y avisa.

- [ ] **Step 5: Commit**

```bash
cd ../dots-backend
git add src/common/entity/character.entity.ts src/modules/admin/tts.service.ts
git commit -m "feat(narration): voice_settings y seed opcionales en la sintesis"
```

---

### Task 4: `CloudinaryService.rename`

**Files:**
- Modify: `../dots-backend/src/modules/admin/cloudinary.service.ts`

**Interfaces:**
- Consumes: nada nuevo.
- Produces: `CloudinaryService.rename(fromPublicId: string, toPublicId: string, kind: UploadKind): Promise<{ url: string }>` — lanza `HttpException(409)` si el origen no existe.

- [ ] **Step 1: Agregar el método**

Al final de la clase `CloudinaryService`, después de `uploadBuffer`:

```typescript
  /**
   * Moves an existing asset to another public_id. This is what makes the
   * draft→publish flow free: approving a take is a metadata operation, so it
   * spends no ElevenLabs credits and re-uploads no bytes.
   *
   * A missing source means that narrator never produced a draft for this item,
   * which is a 409 (not a 500) — the caller turns it into a real message.
   */
  async rename(
    fromPublicId: string,
    toPublicId: string,
    kind: UploadKind,
  ): Promise<{ url: string }> {
    if (!this.configured) {
      throw new HttpException('Media uploads are not configured', 503);
    }
    const resourceType = kind === 'image' ? 'image' : 'video';
    try {
      const result = await cloudinary.uploader.rename(
        fromPublicId,
        toPublicId,
        {
          resource_type: resourceType,
          overwrite: true,
          invalidate: true,
        },
      );
      return { url: result.secure_url };
    } catch (error) {
      const status = (error as { http_code?: number })?.http_code;
      if (status === 404) {
        throw new HttpException(
          'There is no draft take to publish for that narrator',
          409,
        );
      }
      this.logger.error(
        `Cloudinary rename ${fromPublicId} → ${toPublicId} failed: ${String(error)}`,
      );
      throw new HttpException('Could not publish the take, please try again', 502);
    }
  }
```

- [ ] **Step 2: Type-check**

```bash
source ~/.nvm/nvm.sh && cd ../dots-backend && npx tsc --noEmit
```

Esperado: sin errores. Si `result.secure_url` da error de tipo, el SDK tipa `rename` como devolviendo `any`/`ResourceApiResponse`; castea con `as { secure_url: string }`.

- [ ] **Step 3: Commit**

```bash
cd ../dots-backend
git add src/modules/admin/cloudinary.service.ts
git commit -m "feat(cloudinary): rename para publicar una toma sin re-subirla"
```

---

### Task 5: `NarrationService` — job genérico + draft/publish

**Files:**
- Modify: `../dots-backend/src/modules/admin/narration.service.ts`

**Interfaces:**
- Consumes: `draftPublicId`, `parseVoiceSettings`, `characterVoiceSettings`, `resolveVoiceSettings`, `VoiceSettings` (Task 2); `Character.tts*` (Task 3); `CloudinaryService.rename` (Task 4).
- Produces:
  - `type NarrationEntity = 'sentences' | 'vocab-items' | 'letter-items' | 'number-items' | 'pronunciation-items'`
  - `type NarrationClip = { label?: string; url: string }`
  - `type NarrationTake = { characterId: number; characterKey: string; characterName: string; spokenText: string; clips: NarrationClip[]; voiceSettings: VoiceSettings | null }`
  - `draftNarration(entity, id, opts): Promise<NarrationTake>`
  - `publishNarration(entity, id, characterId): Promise<{ characterKey: string; url: string; urls: string[] }>`
  - Los cinco `generate*` **conservan su firma y su shape de retorno actuales**.

**Nota de diseño (desviación deliberada del spec §5.1.2):** el spec decía que los `generate*` pasaran a ser "draft + publish inmediato". Eso agregaría un `rename` a cada generación y cambiaría `tryNarration`, que hoy funciona. En vez de eso se extrae **un** método genérico `runNarration` con destino `'canonical' | 'draft'`: los `generate*` siguen subiendo directo a la ruta canónica (byte por byte igual que hoy, cero llamadas extra) y el borrador reusa la misma maquinaria. Mismo DRY, sin riesgo de regresión.

- [ ] **Step 1: Actualizar los imports del archivo**

Reemplazar la línea de import de `narration.util`:

```typescript
import {
  audioSlug,
  buildNarrationText,
  buildWordText,
  characterVoiceSettings,
  draftPublicId,
  resolveVoiceSettings,
  type VoiceSettings,
} from './narration.util';
```

- [ ] **Step 2: Agregar los tipos exportados, arriba de la clase**

Justo después de `const BASE_ACCENT = 'en-US';`:

```typescript
/** Entidades narrables. El valor coincide con el segmento de la ruta HTTP. */
export type NarrationEntity =
  | 'sentences'
  | 'vocab-items'
  | 'letter-items'
  | 'number-items'
  | 'pronunciation-items';

export type NarrationClip = { label?: string; url: string };

export type NarrationTake = {
  characterId: number;
  characterKey: string;
  characterName: string;
  spokenText: string;
  clips: NarrationClip[];
  voiceSettings: VoiceSettings | null;
};

/**
 * Todo lo que la generación necesita saber de una entidad, resuelto UNA vez:
 * qué se habla, cuántos clips son, dónde vive cada clip publicado y cómo se
 * estampan las columnas. Aísla el conocimiento por entidad en un solo lugar,
 * para que draft, publish y generate compartan la misma maquinaria.
 */
type NarrationJob = {
  spokenText: string;
  clips: { suffix: string; label?: string; text: string }[];
  canonical: (character: Character) => string[];
  persist: (character: Character, urls: string[]) => Promise<void>;
};
```

- [ ] **Step 3: Agregar `buildJob` como método privado de la clase**

```typescript
  /** Resuelve el job de narración de cualquier entidad soportada. */
  private async buildJob(
    entity: NarrationEntity,
    id: number,
  ): Promise<NarrationJob> {
    if (entity === 'sentences') {
      const row = await this.sentencesRepository.findOne({
        where: { id: String(id) },
      });
      if (!row) throw new NotFoundException('Sentence not found');
      const text = buildNarrationText(row.text, row.mWord);
      return {
        spokenText: text,
        clips: [{ suffix: '', text }],
        canonical: (c) => [this.sentencePublicId(Number(row.id), c)],
        persist: async (c) => {
          row.voiceCharacterId = c.id;
          row.sentenceExtension = 'mp3';
          await this.sentencesRepository.save(row);
        },
      };
    }

    if (entity === 'vocab-items') {
      const row = await this.vocabItemRepository.findOne({
        where: { id },
        relations: ['pack'],
      });
      if (!row) throw new NotFoundException('Vocab item not found');
      const text = buildWordText(row.text);
      const packKey = row.pack?.key || `pack-${row.packId}`;
      return {
        spokenText: text,
        clips: [{ suffix: '', text }],
        canonical: (c) => [
          `dots/sounds/vocab/${packKey}/${c.key}/${audioSlug(row.text, String(row.id))}`,
        ],
        persist: async (c, urls) => {
          row.audio = urls[0];
          row.voiceCharacterId = c.id;
          await this.vocabItemRepository.save(row);
        },
      };
    }

    if (entity === 'letter-items') {
      const row = await this.letterItemRepository.findOne({ where: { id } });
      if (!row) throw new NotFoundException('Letter item not found');
      const text = buildWordText(row.name || row.letter);
      return {
        spokenText: text,
        clips: [{ suffix: '', text }],
        canonical: (c) => [
          `dots/sounds/letters/${c.key}/${audioSlug(row.letter, String(row.id))}`,
        ],
        persist: async (c, urls) => {
          row.audio = urls[0];
          row.voiceCharacterId = c.id;
          await this.letterItemRepository.save(row);
        },
      };
    }

    if (entity === 'number-items') {
      const row = await this.numberItemRepository.findOne({ where: { id } });
      if (!row) throw new NotFoundException('Number item not found');
      const text = buildWordText(row.word);
      return {
        spokenText: text,
        clips: [{ suffix: '', text }],
        canonical: (c) => [
          `dots/sounds/numbers/${c.key}/${audioSlug(row.word, String(row.id))}`,
        ],
        persist: async (c, urls) => {
          row.audio = urls[0];
          row.voiceCharacterId = c.id;
          await this.numberItemRepository.save(row);
        },
      };
    }

    const row = await this.pronunciationItemRepository.findOne({
      where: { id },
      relations: ['unit'],
    });
    if (!row) throw new NotFoundException('Pronunciation item not found');
    const textA = buildWordText(row.wordA);
    const textB = buildWordText(row.wordB);
    const unitKey = row.unit?.key || `unit-${row.unitId}`;
    return {
      // Par mínimo: los dos los dice el MISMO personaje, para que el contraste
      // que oye el alumno sea el sonido y nunca el hablante.
      spokenText: `${textA} / ${textB}`,
      clips: [
        { suffix: '-a', label: row.wordA, text: textA },
        { suffix: '-b', label: row.wordB, text: textB },
      ],
      canonical: (c) => {
        const base = `dots/sounds/pronunciation/${unitKey}/${c.key}`;
        return [
          `${base}/${audioSlug(row.wordA, `${row.id}-a`)}`,
          `${base}/${audioSlug(row.wordB, `${row.id}-b`)}`,
        ];
      },
      persist: async (c, urls) => {
        row.audioA = urls[0];
        row.audioB = urls[1];
        row.voiceCharacterId = c.id;
        await this.pronunciationItemRepository.save(row);
      },
    };
  }
```

- [ ] **Step 4: Agregar `runNarration`, `draftNarration` y `publishNarration`**

```typescript
  /**
   * Síntesis + subida de todos los clips de un job.
   * destination 'canonical' escribe donde el alumno lee (y el llamador
   * persiste); 'draft' escribe en la ruta borrador, que nadie referencia.
   */
  private async runNarration(
    entity: NarrationEntity,
    id: number,
    destination: 'canonical' | 'draft',
    opts: {
      characterId?: number;
      seed?: number;
      voiceSettings?: VoiceSettings | null;
    },
  ): Promise<{ job: NarrationJob; character: Character; take: NarrationTake }> {
    const job = await this.buildJob(entity, id);
    const { character, voiceId } = await this.pickCharacter(opts.characterId);
    const settings = resolveVoiceSettings(
      opts.voiceSettings ?? null,
      characterVoiceSettings(character),
    );

    const targets =
      destination === 'canonical'
        ? job.canonical(character)
        : job.clips.map((c) => draftPublicId(entity, character.key, id, c.suffix));

    const clips: NarrationClip[] = [];
    for (let i = 0; i < job.clips.length; i++) {
      const audio = await this.tts.synthesize(job.clips[i].text, voiceId, {
        settings,
        seed: opts.seed,
      });
      const { url } = await this.cloudinary.uploadBuffer(audio, {
        publicId: targets[i],
        kind: 'audio',
      });
      clips.push({ label: job.clips[i].label, url });
    }

    return {
      job,
      character,
      take: {
        characterId: character.id,
        characterKey: character.key,
        characterName: character.name,
        spokenText: job.spokenText,
        clips,
        voiceSettings: settings,
      },
    };
  }

  /**
   * Genera una toma a la ruta borrador. NO toca la BD ni lo que oye el alumno:
   * el admin puede regenerar cuantas veces quiera antes de aprobar. La ruta es
   * determinista por personaje, así que cada toma sobrescribe la anterior.
   */
  async draftNarration(
    entity: NarrationEntity,
    id: number,
    opts: {
      characterId?: number;
      seed?: number;
      voiceSettings?: VoiceSettings | null;
    },
  ): Promise<NarrationTake> {
    const { take } = await this.runNarration(entity, id, 'draft', opts);
    return take;
  }

  /**
   * Promueve el borrador de ese narrador a la ruta canónica y recién entonces
   * estampa las columnas. El rename no gasta créditos: aprobar es gratis.
   * Sin borrador para ese narrador, Cloudinary da 404 → 409 al cliente.
   */
  async publishNarration(
    entity: NarrationEntity,
    id: number,
    characterId: number,
  ): Promise<{ characterKey: string; url: string; urls: string[] }> {
    const job = await this.buildJob(entity, id);
    // pickCharacter con id explícito valida existencia y que tenga voz.
    const { character } = await this.pickCharacter(characterId);
    const canonical = job.canonical(character);

    const urls: string[] = [];
    for (let i = 0; i < job.clips.length; i++) {
      const { url } = await this.cloudinary.rename(
        draftPublicId(entity, character.key, id, job.clips[i].suffix),
        canonical[i],
        'audio',
      );
      urls.push(url);
    }

    // Igual que en generate*: las columnas se escriben SOLO después de que el
    // archivo está en su sitio. Al revés, un 404 silencioso en reproducción.
    await job.persist(character, urls);
    return { characterKey: character.key, url: urls[0], urls };
  }
```

- [ ] **Step 5: Reescribir los cinco `generate*` como wrappers finos**

Reemplazar los cinco métodos `generateSentenceNarration`, `generateVocabAudio`, `generateLetterAudio`, `generateNumberAudio` y `generatePronunciationAudio` completos por:

```typescript
  /** Genera y publica en un paso (comportamiento histórico, firma intacta). */
  private async generateDirect(
    entity: NarrationEntity,
    id: number,
    characterId?: number,
  ): Promise<{ characterKey: string; urls: string[] }> {
    const { job, character, take } = await this.runNarration(
      entity,
      id,
      'canonical',
      { characterId },
    );
    const urls = take.clips.map((c) => c.url);
    await job.persist(character, urls);
    return { characterKey: character.key, urls };
  }

  async generateSentenceNarration(
    sentenceId: number,
    characterId?: number,
  ): Promise<{ characterKey: string; url: string }> {
    const r = await this.generateDirect('sentences', sentenceId, characterId);
    return { characterKey: r.characterKey, url: r.urls[0] };
  }

  async generateVocabAudio(
    vocabItemId: number,
    characterId?: number,
  ): Promise<{ characterKey: string; url: string }> {
    const r = await this.generateDirect('vocab-items', vocabItemId, characterId);
    return { characterKey: r.characterKey, url: r.urls[0] };
  }

  /** TTS del nombre de la letra ("bee" para B); cae a la letra si no hay name. */
  async generateLetterAudio(
    letterItemId: number,
    characterId?: number,
  ): Promise<{ characterKey: string; url: string }> {
    const r = await this.generateDirect('letter-items', letterItemId, characterId);
    return { characterKey: r.characterKey, url: r.urls[0] };
  }

  async generateNumberAudio(
    numberItemId: number,
    characterId?: number,
  ): Promise<{ characterKey: string; url: string }> {
    const r = await this.generateDirect('number-items', numberItemId, characterId);
    return { characterKey: r.characterKey, url: r.urls[0] };
  }

  async generatePronunciationAudio(
    pronunciationItemId: number,
    characterId?: number,
  ): Promise<{ characterKey: string; urlA: string; urlB: string }> {
    const r = await this.generateDirect(
      'pronunciation-items',
      pronunciationItemId,
      characterId,
    );
    return { characterKey: r.characterKey, urlA: r.urls[0], urlB: r.urls[1] };
  }
```

- [ ] **Step 6: Type-check, tests y build**

```bash
source ~/.nvm/nvm.sh && cd ../dots-backend && npx tsc --noEmit && npm test && npm run build
```

Esperado: sin errores de tipos, todos los specs en verde, build OK.

⚠️ Si `tsc` se queja de que `sentencePublicId` no se usa, es porque quedó huérfano: debe seguir usándose desde `buildJob` en la rama `'sentences'`. No lo borres — es lo que preserva la ruta legacy sin subcarpeta del personaje default.

- [ ] **Step 7: Commit**

```bash
cd ../dots-backend
git add src/modules/admin/narration.service.ts
git commit -m "feat(narration): job generico + draft/publish reusando la maquinaria"
```

---

### Task 6: DTOs, rutas HTTP y la voz expuesta en las oraciones

**Files:**
- Modify: `../dots-backend/src/modules/admin/admin.dto.ts`
- Modify: `../dots-backend/src/modules/admin/admin.controller.ts`
- Modify: `../dots-backend/src/modules/admin/admin.service.ts` (`listCharacters:99`, `updateCharacter:132`, `listSentences:383`, `serializeSentence:1378`)

**Interfaces:**
- Consumes: `draftNarration`/`publishNarration` (Task 5); `parseVoiceSettings` (Task 2); `getVoiceSettings` (Task 3).
- Produces:
  - `POST /admin/{sentences,vocab-items,letter-items,number-items,pronunciation-items}/:id/narration-draft`
  - `POST /admin/{...}/:id/narration-publish`
  - `GET /admin/characters/:id/voice-settings`
  - `PATCH /admin/characters/:id` acepta los 4 `tts*`
  - `listCharacters` y `serializeSentence` devuelven los campos nuevos

- [ ] **Step 1: Extender los imports de class-validator en `admin.dto.ts`**

Agregar `IsNumber`, `IsObject` y `Max` al import existente (que ya trae `IsArray, IsBoolean, IsDateString, IsEmail, IsIn, IsInt, IsNotEmpty, IsOptional, IsString, Min, ValidateIf`).

- [ ] **Step 2: Agregar los DTOs nuevos y extender `UpdateCharacterDto`**

Agregar después de `GenerateNarrationDto` (línea ~246). **`GenerateNarrationDto` queda intacto** para no cambiar la superficie de los `generate-*` existentes:

```typescript
/**
 * Borrador: además del narrador acepta ajustes de voz efímeros y un seed.
 * voiceSettings va como objeto sin validación anidada a propósito — lo valida
 * parseVoiceSettings(), que es una función pura con tests (regla "todo o nada").
 */
export class DraftNarrationDto {
  @IsOptional()
  @IsInt()
  characterId?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(4294967295)
  seed?: number;

  @IsOptional()
  @IsObject()
  voiceSettings?: unknown;
}

/** Publicar exige narrador: define la ruta canónica y el borrador a promover. */
export class PublishNarrationDto {
  @IsInt()
  characterId: number;
}
```

Agregar al final de `UpdateCharacterDto`:

```typescript
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  ttsStability?: number | null;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  ttsSimilarityBoost?: number | null;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  ttsStyle?: number | null;

  @IsOptional()
  @IsBoolean()
  ttsSpeakerBoost?: boolean | null;
```

- [ ] **Step 3: Agregar las 11 rutas al controller**

En `admin.controller.ts`, importar `DraftNarrationDto` y `PublishNarrationDto` junto a `GenerateNarrationDto`, y agregar después de la última ruta `generate-audio`:

```typescript
  // ── Audición de voz: borrador → escuchar → publicar ────────────

  @Get('characters/:id/voice-settings')
  getCharacterVoiceSettings(@Param('id', ParseIntPipe) id: number) {
    return this.adminService.getCharacterVoiceSettings(id);
  }

  @Post('sentences/:id/narration-draft')
  draftSentenceNarration(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: DraftNarrationDto,
  ) {
    return this.adminService.draftNarration('sentences', id, dto);
  }

  @Post('sentences/:id/narration-publish')
  publishSentenceNarration(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: PublishNarrationDto,
  ) {
    return this.narrationService.publishNarration(
      'sentences',
      id,
      dto.characterId,
    );
  }

  @Post('vocab-items/:id/narration-draft')
  draftVocabNarration(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: DraftNarrationDto,
  ) {
    return this.adminService.draftNarration('vocab-items', id, dto);
  }

  @Post('vocab-items/:id/narration-publish')
  publishVocabNarration(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: PublishNarrationDto,
  ) {
    return this.narrationService.publishNarration(
      'vocab-items',
      id,
      dto.characterId,
    );
  }

  @Post('letter-items/:id/narration-draft')
  draftLetterNarration(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: DraftNarrationDto,
  ) {
    return this.adminService.draftNarration('letter-items', id, dto);
  }

  @Post('letter-items/:id/narration-publish')
  publishLetterNarration(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: PublishNarrationDto,
  ) {
    return this.narrationService.publishNarration(
      'letter-items',
      id,
      dto.characterId,
    );
  }

  @Post('number-items/:id/narration-draft')
  draftNumberNarration(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: DraftNarrationDto,
  ) {
    return this.adminService.draftNarration('number-items', id, dto);
  }

  @Post('number-items/:id/narration-publish')
  publishNumberNarration(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: PublishNarrationDto,
  ) {
    return this.narrationService.publishNarration(
      'number-items',
      id,
      dto.characterId,
    );
  }

  @Post('pronunciation-items/:id/narration-draft')
  draftPronunciationNarration(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: DraftNarrationDto,
  ) {
    return this.adminService.draftNarration('pronunciation-items', id, dto);
  }

  @Post('pronunciation-items/:id/narration-publish')
  publishPronunciationNarration(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: PublishNarrationDto,
  ) {
    return this.narrationService.publishNarration(
      'pronunciation-items',
      id,
      dto.characterId,
    );
  }
```

⚠️ El borrador pasa por `adminService.draftNarration` (no directo al `narrationService`) porque hay que validar `voiceSettings` con `parseVoiceSettings` antes. Publicar sí va directo.

- [ ] **Step 4: Agregar los métodos nuevos a `admin.service.ts`**

Importar en `admin.service.ts`:

```typescript
import { parseVoiceSettings } from './narration.util';
import type { NarrationEntity } from './narration.service';
```

Agregar como métodos públicos, junto a `updateCharacter`:

```typescript
  /** Valida los ajustes crudos del body y delega el borrador. */
  async draftNarration(
    entity: NarrationEntity,
    id: number,
    dto: { characterId?: number; seed?: number; voiceSettings?: unknown },
  ) {
    return this.narrationService.draftNarration(entity, id, {
      characterId: dto.characterId,
      seed: dto.seed,
      voiceSettings: parseVoiceSettings(dto.voiceSettings),
    });
  }

  /**
   * Ajustes efectivos de un personaje: sus overrides si los tiene, o los que
   * la voz tiene guardados en ElevenLabs. Lectura de metadata, no gasta
   * créditos — es lo que permite que los sliders del admin arranquen en
   * valores reales en vez de inventados.
   */
  async getCharacterVoiceSettings(id: number) {
    const character = await this.characterRepository.findOne({ where: { id } });
    if (!character) throw new NotFoundException('Character not found');

    const saved = characterVoiceSettings(character);
    if (saved) return { source: 'character' as const, ...saved };

    // Misma resolución que NarrationService.resolveVoiceId: el personaje
    // default puede hablar con la voz del entorno aunque no tenga columna
    // propia. Sin esta rama, el panel no podría sembrar los sliders para Doty.
    const voiceId =
      character.elevenlabsVoiceId ||
      (character.isDefault ? process.env.ELEVENLABS_VOICE_ID : undefined);
    if (!voiceId) {
      throw new HttpException('Character has no ElevenLabs voice configured', 404);
    }
    const fromVoice = await this.tts.getVoiceSettings(voiceId);
    return { source: 'elevenlabs' as const, ...fromVoice };
  }
```

Agregar `characterVoiceSettings` al import de `./narration.util` y `ElevenLabsTtsService` como dependencia inyectada (`private readonly tts: ElevenLabsTtsService`) en el constructor de `AdminService`. Ya está registrado como provider en `admin.module.ts`, no hace falta tocar el módulo.

- [ ] **Step 5: Extender `listCharacters` y `updateCharacter`**

En `listCharacters` (línea 104), agregar al objeto devuelto, después de `accent: c.accent,`:

```typescript
      ttsStability: c.ttsStability ?? null,
      ttsSimilarityBoost: c.ttsSimilarityBoost ?? null,
      ttsStyle: c.ttsStyle ?? null,
      ttsSpeakerBoost: c.ttsSpeakerBoost ?? null,
```

En `updateCharacter`, antes del `return`, agregar:

```typescript
    // Todo o nada: un voice_settings parcial deja a ElevenLabs decidiendo el
    // resto. Se aceptan los 4 con valor, o los 4 en null para volver a los
    // ajustes guardados en la voz.
    const overrideKeys = [
      'ttsStability',
      'ttsSimilarityBoost',
      'ttsStyle',
      'ttsSpeakerBoost',
    ] as const;
    const touched = overrideKeys.filter((k) => dto[k] !== undefined);
    if (touched.length > 0) {
      if (touched.length !== overrideKeys.length) {
        throw new HttpException(
          'Send all four tts* settings together, or none',
          400,
        );
      }
      const allNull = touched.every((k) => dto[k] === null);
      const noneNull = touched.every((k) => dto[k] !== null);
      if (!allNull && !noneNull) {
        throw new HttpException(
          'The four tts* settings must be all set or all null',
          400,
        );
      }
      character.ttsStability = dto.ttsStability ?? null;
      character.ttsSimilarityBoost = dto.ttsSimilarityBoost ?? null;
      character.ttsStyle = dto.ttsStyle ?? null;
      character.ttsSpeakerBoost = dto.ttsSpeakerBoost ?? null;
    }
```

- [ ] **Step 6: Exponer la voz en las oraciones**

Agregar como método privado de `AdminService`:

```typescript
  /** Mapa id→personaje. La tabla tiene ~4 filas: una query, no un N+1. */
  private async charactersById() {
    const rows = await this.characterRepository.find();
    return new Map(rows.map((c) => [c.id, c]));
  }
```

Cambiar la firma de `serializeSentence` (línea 1378) para recibir el mapa y devolver la voz:

```typescript
  private serializeSentence(
    s: {
      id: string;
      text?: string | null;
      mWord?: string | null;
      levelId?: number | null;
      img?: string | null;
      imgSound?: string | null;
      enabled?: boolean | null;
      sentenceExtension?: string | null;
      voiceCharacterId?: number | null;
    },
    characters?: Map<number, { key: string; name: string }>,
  ) {
    const voice =
      s.voiceCharacterId != null ? characters?.get(s.voiceCharacterId) : undefined;
    return {
      id: Number(s.id),
      text: s.text ?? '',
      mWord: s.mWord ?? '',
      levelId: s.levelId ?? null,
      img: s.img ?? '',
      imgSound: s.imgSound ?? '',
      enabled: s.enabled ?? false,
      sentenceExtension: s.sentenceExtension ?? '',
      // Sin esto el admin no puede construir la URL de la narración: el
      // alumno la deriva de (id, extension, voiceKey), no de una columna.
      voiceCharacterId: s.voiceCharacterId ?? null,
      voiceKey: voice?.key ?? null,
      voiceCharacterName: voice?.name ?? null,
    };
  }
```

Actualizar los 6 call sites para pasar el mapa:

- `listSentences` (383): `const [sentences, chars] = await Promise.all([this.sentencesRepository.find({ where: { levelId }, order: { id: 'ASC' } }), this.charactersById()]); return sentences.map((s) => this.serializeSentence(s, chars));`
- Líneas 427, 465, 467, 477: obtener `const chars = await this.charactersById();` antes del return y pasarlo como segundo argumento.

- [ ] **Step 7: Type-check, tests, build**

```bash
source ~/.nvm/nvm.sh && cd ../dots-backend && npx tsc --noEmit && npm test && npm run build
```

- [ ] **Step 8: Verificar las rutas contra el backend corriendo**

```bash
# Debe responder 200 con los ajustes de la voz (source: 'elevenlabs')
curl -s -X GET localhost:4000/admin/characters/1/voice-settings -H "Authorization: Bearer <token>"

# Debe responder 409, no 500: no hay borrador todavía
curl -s -X POST localhost:4000/admin/sentences/1/narration-publish \
  -H "Authorization: Bearer <token>" -H "Content-Type: application/json" \
  -d '{"characterId":1}'
```

- [ ] **Step 9: Commit**

```bash
cd ../dots-backend
git add src/modules/admin/admin.dto.ts src/modules/admin/admin.controller.ts src/modules/admin/admin.service.ts
git commit -m "feat(admin): rutas de borrador/publicacion y voz expuesta en oraciones"
```

---

### Task 7: El script de batch honra los ajustes del personaje

**Files:**
- Modify: `../dots-backend/scripts/generate-narrations.js` (`loadCharacters` ~119, `synthesize` ~76-90)

**Interfaces:**
- Consumes: las 4 columnas de la Task 1.
- Produces: nada nuevo para otros; cierra la divergencia admin↔batch.

**Por qué es obligatoria:** el script **no** usa `ElevenLabsTtsService` — duplica la llamada a ElevenLabs. Sin esta tarea, guardar ajustes en un personaje los aplicaría solo en el admin y el batch generaría distinto para la misma voz. Ese tipo de divergencia silenciosa es carísima de diagnosticar después.

- [ ] **Step 1: Traer las columnas nuevas en el SELECT**

Reemplazar la query de `loadCharacters`:

```javascript
  const res = await db.query(
    `SELECT id, key, name, elevenlabs_voice_id, is_default, enabled,
            tts_stability, tts_similarity_boost, tts_style, tts_speaker_boost
       FROM dots.characters ORDER BY id`,
  );
```

- [ ] **Step 2: Agregar el resolutor de ajustes (espeja `characterVoiceSettings`)**

Junto a `voiceOf`:

```javascript
/**
 * Overrides de voice_settings del personaje, o null si no tiene los cuatro.
 * Espeja characterVoiceSettings() de src/modules/admin/narration.util.ts —
 * si cambias uno, cambia el otro o el admin y el batch divergen.
 */
function voiceSettingsOf(character) {
  const s = character.tts_stability;
  const sim = character.tts_similarity_boost;
  const st = character.tts_style;
  const boost = character.tts_speaker_boost;
  if (s == null || sim == null || st == null || boost == null) return null;
  return {
    stability: Number(s),
    similarity_boost: Number(sim),
    style: Number(st),
    use_speaker_boost: boost,
  };
}
```

- [ ] **Step 3: Pasar los ajustes a `synthesize`**

Cambiar la firma y el body:

```javascript
async function synthesize(text, voiceId, voiceSettings) {
  const url =
    `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}` +
    `?output_format=mp3_44100_128`;
  for (let attempt = 1; ; attempt++) {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'xi-api-key': process.env.ELEVENLABS_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text,
        model_id: MODEL_ID,
        ...(voiceSettings ? { voice_settings: voiceSettings } : {}),
      }),
    });
    if (res.status === 429 && attempt <= 3) {
      await new Promise((r) => setTimeout(r, 1000 * 2 ** (attempt - 1)));
      continue;
    }
    if (!res.ok) {
      throw new Error(`ElevenLabs HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
    }
    return Buffer.from(await res.arrayBuffer());
  }
}
```

- [ ] **Step 4: Actualizar todos los call sites de `synthesize`**

```bash
source ~/.nvm/nvm.sh && cd ../dots-backend && grep -n 'synthesize(' scripts/generate-narrations.js
```

En cada llamada donde ya hay un `character` en alcance, pasar `voiceSettingsOf(character)` como tercer argumento. Sin ajustes guardados devuelve `null` y el body queda idéntico al actual.

- [ ] **Step 5: Verificar con dry-run**

```bash
source ~/.nvm/nvm.sh && cd ../dots-backend && npm run narrations:generate
```

Esperado: el dry-run lista targets y costo estimado igual que antes, **sin generar nada**. Si falla por columna inexistente, la migración de la Task 1 no se aplicó.

- [ ] **Step 6: Commit**

```bash
cd ../dots-backend
git add scripts/generate-narrations.js
git commit -m "feat(narration): el batch honra los voice_settings del personaje"
```

---

## Fase B — Frontend

### Task 8: Fetchers y tipos en `admin.service.ts`

**Files:**
- Modify: `services/admin.service.ts` (`AdminCharacter:5`, `AdminSentence:49`)

**Interfaces:**
- Consumes: las rutas de la Task 6.
- Produces: `VoiceSettings`, `VoiceClip`, `VoiceTake`, `NarrationEntity`, `CharacterVoiceSettings`, `draftNarration`, `publishNarration`, `getCharacterVoiceSettings`, `updateCharacter`; `AdminCharacter` con los 4 `tts*`; `AdminSentence` con `voiceCharacterId`/`voiceKey`/`voiceCharacterName`.

- [ ] **Step 1: Extender `AdminCharacter`**

Agregar al type (línea 5-15), después de `accent?: string;`:

```typescript
  ttsStability?: number | null;
  ttsSimilarityBoost?: number | null;
  ttsStyle?: number | null;
  ttsSpeakerBoost?: boolean | null;
```

- [ ] **Step 2: Extender `AdminSentence`**

Agregar al type (línea 49-58), después de `sentenceExtension: string;`:

```typescript
  /** Personaje que narra la oración. Sin esto no se puede armar la URL de la
   *  narración: el alumno la deriva de (id, extension, voiceKey). */
  voiceCharacterId?: number | null;
  voiceKey?: string | null;
  voiceCharacterName?: string | null;
```

- [ ] **Step 3: Agregar la sección de audición de voz**

Al final del archivo:

```typescript
// ── Audición de voz: borrador → escuchar → publicar ────────────

export type NarrationEntity =
  | "sentences"
  | "vocab-items"
  | "letter-items"
  | "number-items"
  | "pronunciation-items";

export type VoiceSettings = {
  stability: number;
  similarityBoost: number;
  style: number;
  useSpeakerBoost: boolean;
};

export type VoiceClip = { label?: string; url: string };

export type VoiceTake = {
  characterId: number;
  characterKey: string;
  characterName: string;
  spokenText: string;
  clips: VoiceClip[];
  voiceSettings: VoiceSettings | null;
};

/** Genera una toma en la ruta borrador. No toca lo que oye el alumno. */
export async function draftNarration(
  entity: NarrationEntity,
  id: number,
  opts: {
    characterId?: number;
    seed?: number;
    voiceSettings?: VoiceSettings | null;
  } = {},
): Promise<VoiceTake> {
  const { data } = await api.post<VoiceTake>(
    `/admin/${entity}/${id}/narration-draft`,
    {
      ...(opts.characterId != null && { characterId: opts.characterId }),
      ...(opts.seed != null && { seed: opts.seed }),
      ...(opts.voiceSettings && { voiceSettings: opts.voiceSettings }),
    },
  );
  return data;
}

/** Promueve el borrador de ese narrador a la ruta canónica. */
export async function publishNarration(
  entity: NarrationEntity,
  id: number,
  characterId: number,
): Promise<{ characterKey: string; url: string; urls: string[] }> {
  const { data } = await api.post(`/admin/${entity}/${id}/narration-publish`, {
    characterId,
  });
  return data;
}

export type CharacterVoiceSettings = VoiceSettings & {
  source: "character" | "elevenlabs";
};

/** Ajustes efectivos de un personaje. Lectura de metadata: no gasta créditos. */
export async function getCharacterVoiceSettings(characterId: number) {
  const { data } = await api.get<CharacterVoiceSettings>(
    `/admin/characters/${characterId}/voice-settings`,
  );
  return data;
}

export async function updateCharacter(
  id: number,
  payload: Partial<{
    name: string;
    elevenlabsVoiceId: string;
    img: string;
    enabled: boolean;
    accent: string;
    ttsStability: number | null;
    ttsSimilarityBoost: number | null;
    ttsStyle: number | null;
    ttsSpeakerBoost: boolean | null;
  }>,
) {
  const { data } = await api.patch<AdminCharacter>(
    `/admin/characters/${id}`,
    payload,
  );
  return data;
}
```

- [ ] **Step 4: Lint y build**

```bash
source ~/.nvm/nvm.sh && npm run lint && npx next build
```

- [ ] **Step 5: Commit**

```bash
git add services/admin.service.ts
git commit -m "feat(admin): fetchers de borrador, publicacion y ajustes de voz"
```

---

### Task 9: `VoiceSettingsPanel`

**Files:**
- Create: `components/admin/voice-settings-panel.tsx`

**Interfaces:**
- Consumes: `AdminCharacter`, `VoiceSettings`, `getCharacterVoiceSettings`, `updateCharacter` (Task 8).
- Produces:
  ```typescript
  interface VoiceSettingsPanelProps {
    character: AdminCharacter | null
    value: VoiceSettings | null
    onChange: (v: VoiceSettings | null) => void
    seed: number | null
    onSeedChange: (s: number | null) => void
  }
  export default function VoiceSettingsPanel(p: VoiceSettingsPanelProps): React.ReactElement
  ```

**Contrato clave:** `value === null` significa **panel apagado** → el padre no manda `voiceSettings` → el backend usa los del personaje, o ninguno. Encenderlo siembra los sliders con `getCharacterVoiceSettings`, en el handler del click, **nunca en un `useEffect`** (regla 3).

- [ ] **Step 1: Crear el componente**

```tsx
"use client";

import React, { useState } from "react";
import {
  getCharacterVoiceSettings,
  updateCharacter,
  type AdminCharacter,
  type VoiceSettings,
} from "@/services/admin.service";

/** Defaults genéricos documentados por ElevenLabs, solo si no se pueden leer. */
const FALLBACK: VoiceSettings = {
  stability: 0.5,
  similarityBoost: 0.75,
  style: 0,
  useSpeakerBoost: true,
};

interface VoiceSettingsPanelProps {
  /** Narrador elegido; null = Auto (balanceado), sin personaje al que guardar. */
  character: AdminCharacter | null;
  /** null = panel apagado: no se manda voiceSettings. */
  value: VoiceSettings | null;
  onChange: (v: VoiceSettings | null) => void;
  seed: number | null;
  onSeedChange: (s: number | null) => void;
}

function Slider({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-baseline justify-between px-1">
        <span className="text-xs font-bold text-(--muted)">{label}</span>
        <span className="text-xs font-bold text-(--accent)">
          {value.toFixed(2)}
        </span>
      </div>
      <input
        type="range"
        min={0}
        max={1}
        step={0.05}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-(--accent)"
      />
      <span className="px-1 text-[11px] font-medium text-(--muted)">{hint}</span>
    </div>
  );
}

export default function VoiceSettingsPanel({
  character,
  value,
  onChange,
  seed,
  onSeedChange,
}: VoiceSettingsPanelProps) {
  const [open, setOpen] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [note, setNote] = useState("");

  // Encender siembra los sliders con los ajustes reales de la voz. Va en el
  // handler del click, no en un efecto: la regla 3 prohíbe setState en el
  // cuerpo de un useEffect, y además no queremos fetchear sin que lo pidan.
  const enable = async () => {
    setSeeding(true);
    setNote("");
    try {
      if (character) {
        const real = await getCharacterVoiceSettings(character.id);
        onChange({
          stability: real.stability,
          similarityBoost: real.similarityBoost,
          style: real.style,
          useSpeakerBoost: real.useSpeakerBoost,
        });
      } else {
        onChange(FALLBACK);
        setNote("Con narrador Auto no hay voz que leer: partimos de los valores genéricos.");
      }
    } catch {
      onChange(FALLBACK);
      setNote("No se pudieron leer los ajustes de la voz. Partimos de los genéricos.");
    } finally {
      setSeeding(false);
    }
  };

  const saveToCharacter = async () => {
    if (!character || !value) return;
    setSaving(true);
    setNote("");
    try {
      await updateCharacter(character.id, {
        ttsStability: value.stability,
        ttsSimilarityBoost: value.similarityBoost,
        ttsStyle: value.style,
        ttsSpeakerBoost: value.useSpeakerBoost,
      });
      setNote(`Guardado en ${character.name}: lo usará todo audio nuevo de esa voz.`);
    } catch {
      setNote("No se pudo guardar en el personaje.");
    } finally {
      setSaving(false);
    }
  };

  const clearOnCharacter = async () => {
    if (!character) return;
    setSaving(true);
    setNote("");
    try {
      await updateCharacter(character.id, {
        ttsStability: null,
        ttsSimilarityBoost: null,
        ttsStyle: null,
        ttsSpeakerBoost: null,
      });
      setNote(`${character.name} vuelve a los ajustes guardados en su voz.`);
    } catch {
      setNote("No se pudo limpiar los ajustes del personaje.");
    } finally {
      setSaving(false);
    }
  };

  const set = (patch: Partial<VoiceSettings>) => {
    if (!value) return;
    onChange({ ...value, ...patch });
  };

  return (
    <div className="rounded-2xl border-2 border-(--border) p-3">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between text-xs font-bold text-(--muted) transition-colors hover:text-(--accent)"
      >
        <span>Ajustes avanzados de voz</span>
        <span>{open ? "▾" : "▸"}</span>
      </button>

      {open && (
        <div className="mt-3 flex flex-col gap-3">
          {!value ? (
            <div className="flex flex-col gap-2">
              <p className="text-[11px] font-medium text-(--muted)">
                Apagado: se usan los ajustes guardados en la voz. Enciéndelo para
                experimentar con la expresividad de las tomas.
              </p>
              <button
                onClick={enable}
                disabled={seeding}
                className="self-start rounded-lg border-2 border-(--border) px-3 py-1.5 text-xs font-bold text-(--muted) transition-colors hover:border-(--accent) hover:text-(--accent) disabled:opacity-50"
              >
                {seeding ? "Leyendo la voz…" : "Encender ajustes"}
              </button>
            </div>
          ) : (
            <>
              <Slider
                label="Estabilidad"
                hint="Bajo = más expresivo y más variación entre tomas. Ojo: también más pronunciaciones raras."
                value={value.stability}
                onChange={(stability) => set({ stability })}
              />
              <Slider
                label="Parecido a la voz"
                hint="Qué tanto se apega al timbre original."
                value={value.similarityBoost}
                onChange={(similarityBoost) => set({ similarityBoost })}
              />
              <Slider
                label="Estilo"
                hint="Exageración del estilo. Sube la latencia y puede desestabilizar."
                value={value.style}
                onChange={(style) => set({ style })}
              />

              <button
                onClick={() => set({ useSpeakerBoost: !value.useSpeakerBoost })}
                className="flex items-center gap-2 self-start text-xs font-bold text-(--muted)"
              >
                <span
                  className={`inline-block h-4 w-4 rounded border-2 ${
                    value.useSpeakerBoost
                      ? "border-(--accent) bg-(--accent)"
                      : "border-(--border)"
                  }`}
                />
                Refuerzo de claridad
              </button>

              <div className="flex flex-col gap-1">
                <span className="px-1 text-xs font-bold text-(--muted)">
                  Seed (opcional)
                </span>
                <input
                  value={seed ?? ""}
                  onChange={(e) => {
                    const raw = e.target.value.trim();
                    onSeedChange(raw === "" ? null : Number(raw));
                  }}
                  placeholder="vacío = al azar"
                  inputMode="numeric"
                  className="w-full rounded-xl border-2 border-(--border) bg-(--input-bg) px-3 py-2 text-sm font-semibold text-foreground placeholder:font-medium placeholder:text-(--muted) outline-none focus:border-(--accent)"
                />
                <span className="px-1 text-[11px] font-medium text-(--muted)">
                  Fíjalo para aislar la variable: mismo seed y distinta
                  estabilidad, y la diferencia es el ajuste, no el azar.
                </span>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  onClick={saveToCharacter}
                  disabled={saving || !character}
                  title={
                    character
                      ? undefined
                      : "Elige un narrador concreto para poder guardar"
                  }
                  className="rounded-lg border-2 border-(--accent) px-3 py-1.5 text-xs font-bold text-(--accent) transition-colors hover:bg-(--accent)/10 disabled:opacity-40"
                >
                  {saving ? "Guardando…" : "Guardar en el personaje"}
                </button>
                <button
                  onClick={clearOnCharacter}
                  disabled={saving || !character}
                  className="rounded-lg border-2 border-(--border) px-3 py-1.5 text-xs font-bold text-(--muted) transition-colors hover:border-(--danger) hover:text-(--danger) disabled:opacity-40"
                >
                  Volver a los de la voz
                </button>
                <button
                  onClick={() => {
                    onChange(null);
                    onSeedChange(null);
                    setNote("");
                  }}
                  className="rounded-lg px-3 py-1.5 text-xs font-bold text-(--muted) transition-colors hover:text-(--danger)"
                >
                  Apagar
                </button>
              </div>
            </>
          )}

          {note && (
            <p className="text-[11px] font-bold text-(--accent)">{note}</p>
          )}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Lint y build**

```bash
source ~/.nvm/nvm.sh && npm run lint && npx next build
```

Esperado: sin errores. En particular **sin warnings del compiler de React** sobre `setState` en efectos — este componente no tiene ningún `useEffect`.

- [ ] **Step 3: Commit**

```bash
git add components/admin/voice-settings-panel.tsx
git commit -m "feat(admin): panel de ajustes de voz con guardado por personaje"
```

---

### Task 10: `VoiceStudio`

**Files:**
- Create: `components/admin/voice-studio.tsx`

**Interfaces:**
- Consumes: `AdminCharacter`, `VoiceClip`, `VoiceSettings` (Task 8); `VoiceSettingsPanel` (Task 9).
- Produces:
  ```typescript
  export type StudioTake = {
    characterId?: number
    characterName: string
    spokenText?: string
    clips: VoiceClip[]
  }
  export type DraftOpts = {
    characterId?: number
    seed?: number
    voiceSettings?: VoiceSettings | null
  }
  interface VoiceStudioProps {
    live: StudioTake | null
    characters: AdminCharacter[]
    onDraft: (opts: DraftOpts) => Promise<StudioTake & { characterId: number }>
    onPublish: (characterId: number) => Promise<{ urls: string[] }>
    disabled?: boolean
    disabledReason?: string
  }
  export default function VoiceStudio(p: VoiceStudioProps): React.ReactElement
  export function singleClipTake(
    item: { audio?: string | null; voiceCharacterId?: number | null },
    characterName: (id?: number | null) => string,
  ): StudioTake | null
  ```

⚠️ **El componente debe remontarse por ítem** (dale `key={item.id}` donde lo uses). Inicializa su estado interno desde `live`, así que reusar la instancia entre dos ítems distintos mostraría la toma del anterior.

- [ ] **Step 1: Crear el componente**

```tsx
"use client";

import React, { useState } from "react";
import type {
  AdminCharacter,
  VoiceClip,
  VoiceSettings,
} from "@/services/admin.service";
import VoiceSettingsPanel from "@/components/admin/voice-settings-panel";

export type StudioTake = {
  characterId?: number;
  characterName: string;
  spokenText?: string;
  clips: VoiceClip[];
  /** Ajustes con los que se generó realmente. Revela los del personaje
   *  cuando el panel está apagado, que es lo que no se puede inferir. */
  voiceSettings?: VoiceSettings | null;
};

export type DraftOpts = {
  characterId?: number;
  seed?: number;
  voiceSettings?: VoiceSettings | null;
};

/**
 * Toma viva de las entidades de UN solo clip (vocab, letters, numbers), que
 * comparten shape: `audio` + `voiceCharacterId`. pronunciation arma la suya
 * aparte porque es un par mínimo de dos clips etiquetados.
 */
export function singleClipTake(
  item: { audio?: string | null; voiceCharacterId?: number | null },
  characterName: (id?: number | null) => string,
): StudioTake | null {
  if (!item.audio) return null;
  return {
    characterId: item.voiceCharacterId ?? undefined,
    characterName: characterName(item.voiceCharacterId),
    clips: [{ url: item.audio }],
  };
}

interface VoiceStudioProps {
  /** Toma que oye el alumno hoy, o null si el ítem aún no tiene narración. */
  live: StudioTake | null;
  characters: AdminCharacter[];
  onDraft: (opts: DraftOpts) => Promise<StudioTake & { characterId: number }>;
  onPublish: (characterId: number) => Promise<{ urls: string[] }>;
  disabled?: boolean;
  disabledReason?: string;
}

function errorMessage(e: unknown): string {
  const status = (e as { response?: { status?: number } })?.response?.status;
  if (status === 409) return "No hay borrador de ese narrador para este ítem.";
  if (status === 429) return "ElevenLabs pidió esperar. Prueba en un momento.";
  if (status === 400)
    return "ElevenLabs rechazó los ajustes. Revisa los valores del panel.";
  if (status === 503)
    return "Falta configurar ElevenLabs o Cloudinary en el servidor.";
  const msg = (e as { response?: { data?: { message?: string } } })?.response
    ?.data?.message;
  return msg ?? "No se pudo completar. Inténtalo otra vez.";
}

function Player({
  clips,
  autoPlay,
}: {
  clips: VoiceClip[];
  autoPlay?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      {clips.map((clip, i) => (
        <div key={clip.url} className="flex items-center gap-2">
          {clip.label && (
            <span className="min-w-16 text-xs font-bold text-(--muted)">
              {clip.label}
            </span>
          )}
          {/* key por URL: cada toma nueva remonta el <audio>, así autoPlay
              suena UNA vez por toma y nunca se repite en un re-render. */}
          <audio
            key={clip.url}
            src={clip.url}
            controls
            autoPlay={autoPlay && i === 0}
            className="h-8 w-full"
          />
        </div>
      ))}
    </div>
  );
}

export default function VoiceStudio({
  live,
  characters,
  onDraft,
  onPublish,
  disabled,
  disabledReason,
}: VoiceStudioProps) {
  const [published, setPublished] = useState<StudioTake | null>(live);
  const [draft, setDraft] = useState<(StudioTake & { characterId: number }) | null>(null);
  const [takeCount, setTakeCount] = useState(0);
  const [generating, setGenerating] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [err, setErr] = useState("");
  const [narratorId, setNarratorId] = useState<number | undefined>(undefined);
  const [settings, setSettings] = useState<VoiceSettings | null>(null);
  const [seed, setSeed] = useState<number | null>(null);

  // La URL viva se construye en cliente sin segmento de versión, así que el
  // navegador podría servir una copia vieja. Sello de montaje para romper la
  // caché. Inicializador lazy, no un efecto (regla 3).
  const [cacheBust] = useState(() => Date.now());

  const selected = characters.find((c) => c.id === narratorId) ?? null;

  const bust = (url: string) =>
    url.includes("?") ? `${url}&t=${cacheBust}` : `${url}?t=${cacheBust}`;

  const generate = async () => {
    setGenerating(true);
    setErr("");
    try {
      const take = await onDraft({
        characterId: narratorId,
        seed: seed ?? undefined,
        voiceSettings: settings,
      });
      setDraft(take);
      setTakeCount((n) => n + 1);
    } catch (e) {
      setErr(errorMessage(e));
    } finally {
      setGenerating(false);
    }
  };

  const publish = async () => {
    if (!draft) return;
    setPublishing(true);
    setErr("");
    try {
      const { urls } = await onPublish(draft.characterId);
      // La respuesta trae solo las URLs canónicas versionadas; el nombre y el
      // texto hablado ya venían en el borrador, así que la toma viva se arma
      // sin refetch.
      setPublished({
        characterId: draft.characterId,
        characterName: draft.characterName,
        spokenText: draft.spokenText,
        clips: draft.clips.map((c, i) => ({
          label: c.label,
          url: urls[i] ?? c.url,
        })),
      });
      setDraft(null);
    } catch (e) {
      setErr(errorMessage(e));
    } finally {
      setPublishing(false);
    }
  };

  return (
    <div className="flex flex-col gap-3 rounded-2xl border-2 border-(--border) p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs font-bold text-(--muted)">Narración</span>
        <select
          value={narratorId ?? ""}
          onChange={(e) =>
            setNarratorId(
              e.target.value === "" ? undefined : Number(e.target.value),
            )
          }
          className="rounded-lg border-2 border-(--border) bg-(--input-bg) px-2 py-1 text-xs font-bold text-foreground"
        >
          <option value="">Narrador: Auto (balanceado)</option>
          {characters
            .filter((c) => c.enabled)
            .map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
        </select>
      </div>

      {published ? (
        <div className="flex flex-col gap-1.5 rounded-xl bg-(--background) p-2.5">
          <span className="text-[11px] font-bold uppercase tracking-wide text-(--muted)">
            En vivo · {published.characterName}
          </span>
          <Player clips={published.clips.map((c) => ({ ...c, url: bust(c.url) }))} />
        </div>
      ) : (
        <p className="rounded-xl bg-(--background) p-2.5 text-xs font-semibold text-(--muted)">
          Este ítem todavía no tiene narración.
        </p>
      )}

      {draft && (
        <div className="flex flex-col gap-2 rounded-xl border-2 border-(--accent) bg-(--accent)/8 p-2.5">
          <div className="flex items-baseline justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wide text-(--accent)">
              Borrador · {draft.characterName}
            </span>
            <span className="text-[11px] font-bold text-(--accent)">
              toma {takeCount}
            </span>
          </div>
          {draft.spokenText && (
            <p className="text-xs font-semibold text-(--accent)">
              Dice: “{draft.spokenText}”
            </p>
          )}
          {draft.voiceSettings && (
            <p className="text-[11px] font-medium text-(--accent)">
              Ajustes usados · estabilidad {draft.voiceSettings.stability.toFixed(2)}
              {" · "}parecido {draft.voiceSettings.similarityBoost.toFixed(2)}
              {" · "}estilo {draft.voiceSettings.style.toFixed(2)}
              {draft.voiceSettings.useSpeakerBoost ? " · con refuerzo" : ""}
            </p>
          )}
          <Player clips={draft.clips} autoPlay />
          <div className="flex flex-wrap gap-2">
            <button
              onClick={publish}
              disabled={publishing || generating}
              className="rounded-lg border-2 border-(--accent) bg-(--accent) px-3 py-1.5 text-xs font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {publishing ? "Publicando…" : "Usar esta toma"}
            </button>
            <button
              onClick={generate}
              disabled={generating || publishing}
              className="rounded-lg border-2 border-(--border) px-3 py-1.5 text-xs font-bold text-(--muted) transition-colors hover:border-(--accent) hover:text-(--accent) disabled:opacity-50"
            >
              {generating ? "Generando…" : "Regenerar"}
            </button>
            <button
              onClick={() => {
                setDraft(null);
                setErr("");
              }}
              disabled={publishing}
              className="rounded-lg px-3 py-1.5 text-xs font-bold text-(--muted) transition-colors hover:text-(--danger) disabled:opacity-50"
            >
              Descartar
            </button>
          </div>
        </div>
      )}

      {!draft && (
        <button
          onClick={generate}
          disabled={generating || disabled}
          title={disabled ? disabledReason : undefined}
          className="self-start rounded-lg border-2 border-(--accent) px-3 py-1.5 text-xs font-bold text-(--accent) transition-colors hover:bg-(--accent)/10 disabled:opacity-40"
        >
          {generating ? "Generando…" : published ? "Generar otra toma" : "Generar voz"}
        </button>
      )}

      {disabled && disabledReason && (
        <p className="text-[11px] font-semibold text-(--muted)">{disabledReason}</p>
      )}

      {err && (
        <p className="rounded-xl bg-(--danger)/10 px-3 py-2 text-xs font-bold text-(--danger)">
          {err}
        </p>
      )}

      <VoiceSettingsPanel
        character={selected}
        value={settings}
        onChange={setSettings}
        seed={seed}
        onSeedChange={setSeed}
      />
    </div>
  );
}
```

- [ ] **Step 2: Lint y build**

```bash
source ~/.nvm/nvm.sh && npm run lint && npx next build
```

Esperado: sin errores ni warnings del compiler de React. El componente no tiene ningún `useEffect`; todo pasa en handlers.

- [ ] **Step 3: Commit**

```bash
git add components/admin/voice-studio.tsx
git commit -m "feat(admin): VoiceStudio con toma viva, borrador y publicacion"
```

---

### Task 11: `VoiceModal` y los cuatro managers de fundamentos

**Files:**
- Create: `components/admin/voice-modal.tsx`
- Modify: `components/admin/foundations/vocab-manager.tsx` (`genAudio:240`, fila `:311-356`)
- Modify: `components/admin/foundations/letters-manager.tsx` (`genAudio:230`)
- Modify: `components/admin/foundations/numbers-manager.tsx` (`genAudio:230`)
- Modify: `components/admin/foundations/pronunciation-manager.tsx` (`generateAudio:221`)

**Interfaces:**
- Consumes: `VoiceStudio`, `StudioTake`, `DraftOpts` (Task 10); `draftNarration`, `publishNarration` (Task 8).
- Produces: `VoiceModal` reusable por cualquier manager.

- [ ] **Step 1: Crear `voice-modal.tsx`**

```tsx
"use client";

import React from "react";
import UIButton from "@/components/ui/button/button";
import { AdminModal } from "@/components/admin/ui";
import VoiceStudio, {
  type DraftOpts,
  type StudioTake,
} from "@/components/admin/voice-studio";
import type { AdminCharacter } from "@/services/admin.service";

interface VoiceModalProps {
  title: string;
  live: StudioTake | null;
  characters: AdminCharacter[];
  onDraft: (opts: DraftOpts) => Promise<StudioTake & { characterId: number }>;
  onPublish: (characterId: number) => Promise<{ urls: string[] }>;
  onClose: () => void;
}

export default function VoiceModal({
  title,
  live,
  characters,
  onDraft,
  onPublish,
  onClose,
}: VoiceModalProps) {
  return (
    <AdminModal
      title={title}
      onClose={onClose}
      footer={
        <UIButton tone="neutral" onClick={onClose}>
          Cerrar
        </UIButton>
      }
    >
      <VoiceStudio
        live={live}
        characters={characters}
        onDraft={onDraft}
        onPublish={onPublish}
      />
    </AdminModal>
  );
}
```

- [ ] **Step 2: `vocab-manager.tsx` — reemplazar `genAudio` por el modal**

Agregar a los imports de `@/services/admin.service` (y **quitar** `generateVocabAudio`, que queda sin uso):

```typescript
  draftNarration,
  publishNarration,
```

Agregar el import del modal:

```typescript
import VoiceModal from "@/components/admin/voice-modal";
```

Reemplazar el estado `generatingId` y la función `genAudio` completa por:

```typescript
  const [voiceItem, setVoiceItem] = useState<AdminVocabItem | null>(null);
```

La toma viva la arma el helper compartido, así que no hay un `liveTake` por manager. Agregar `singleClipTake` al import de `voice-studio`:

```typescript
import VoiceModal from "@/components/admin/voice-modal";
import { singleClipTake } from "@/components/admin/voice-studio";
```

Reemplazar el botón `Generate audio` de la fila por:

```tsx
                      <button
                        onClick={() => setVoiceItem(item)}
                        className="rounded-lg border-2 border-(--border) px-2.5 py-1 text-xs font-bold text-(--muted) transition-colors hover:border-(--accent) hover:text-(--accent)"
                      >
                        Voz
                      </button>
```

Y renderizar el modal junto a los demás modales del componente:

```tsx
      {voiceItem && (
        <VoiceModal
          key={voiceItem.id}
          title={`Voz · ${voiceItem.text}`}
          live={singleClipTake(voiceItem, characterName)}
          characters={characters}
          onDraft={(opts) => draftNarration("vocab-items", voiceItem.id, opts)}
          onPublish={(characterId) =>
            publishNarration("vocab-items", voiceItem.id, characterId)
          }
          onClose={() => {
            setVoiceItem(null);
            refreshItems();
          }}
        />
      )}
```

⚠️ El `key={voiceItem.id}` no es decorativo: `VoiceStudio` inicializa su estado desde `live`, así que sin remontar mostraría la toma del ítem anterior. Y `refreshItems()` al cerrar es lo que actualiza el badge 🔊 y la columna de personaje de la fila.

- [ ] **Step 3: `letters-manager.tsx` — el mismo cambio**

Imports: quitar `generateLetterAudio`, agregar `draftNarration`, `publishNarration` y el import de `VoiceModal`.

Reemplazar `generatingId` + `genAudio` por:

```typescript
  const [voiceItem, setVoiceItem] = useState<AdminLetterItem | null>(null);
```

Importar también el helper compartido: `import { singleClipTake } from "@/components/admin/voice-studio";`

Botón de fila → `onClick={() => setVoiceItem(item)}` con el texto `Voz`. Modal:

```tsx
      {voiceItem && (
        <VoiceModal
          key={voiceItem.id}
          title={`Voz · ${voiceItem.letter}`}
          live={singleClipTake(voiceItem, characterName)}
          characters={characters}
          onDraft={(opts) => draftNarration("letter-items", voiceItem.id, opts)}
          onPublish={(characterId) =>
            publishNarration("letter-items", voiceItem.id, characterId)
          }
          onClose={() => {
            setVoiceItem(null);
            refreshItems();
          }}
        />
      )}
```

- [ ] **Step 4: `numbers-manager.tsx` — el mismo cambio**

Imports: quitar `generateNumberAudio`, agregar `draftNarration`, `publishNarration`, `VoiceModal`.

```typescript
  const [voiceItem, setVoiceItem] = useState<AdminNumberItem | null>(null);
```

Importar también el helper compartido: `import { singleClipTake } from "@/components/admin/voice-studio";`

Modal:

```tsx
      {voiceItem && (
        <VoiceModal
          key={voiceItem.id}
          title={`Voz · ${voiceItem.word}`}
          live={singleClipTake(voiceItem, characterName)}
          characters={characters}
          onDraft={(opts) => draftNarration("number-items", voiceItem.id, opts)}
          onPublish={(characterId) =>
            publishNarration("number-items", voiceItem.id, characterId)
          }
          onClose={() => {
            setVoiceItem(null);
            refreshItems();
          }}
        />
      )}
```

- [ ] **Step 5: `pronunciation-manager.tsx` — dos clips**

Este es el único con par mínimo: la toma viva son **dos** clips con etiqueta, y los dos los dice el mismo personaje.

Imports: quitar `generatePronunciationAudio`, agregar `draftNarration`, `publishNarration`, `VoiceModal`, y `getAdminCharacters` + `type AdminCharacter` si el archivo aún no los trae.

```typescript
  const [voiceItem, setVoiceItem] = useState<AdminPronunciationItem | null>(null);
  const [characters, setCharacters] = useState<AdminCharacter[]>([]);

  useEffect(() => {
    let alive = true;
    getAdminCharacters()
      .then((rows) => { if (alive) setCharacters(rows); })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  const characterName = (id?: number | null) =>
    characters.find((c) => c.id === id)?.name ?? (id != null ? `#${id}` : "—");

  const liveTake = (item: AdminPronunciationItem) =>
    item.audioA || item.audioB
      ? {
          characterId: item.voiceCharacterId ?? undefined,
          characterName: characterName(item.voiceCharacterId),
          clips: [
            ...(item.audioA ? [{ label: item.wordA, url: item.audioA }] : []),
            ...(item.audioB ? [{ label: item.wordB, url: item.audioB }] : []),
          ],
        }
      : null;
```

Reemplazar `generatingId` + `generateAudio`, cambiar el botón de fila a `onClick={() => setVoiceItem(it)}` con texto `Voz`, y renderizar:

```tsx
      {voiceItem && (
        <VoiceModal
          key={voiceItem.id}
          title={`Voz · ${voiceItem.wordA} / ${voiceItem.wordB}`}
          live={liveTake(voiceItem)}
          characters={characters}
          onDraft={(opts) =>
            draftNarration("pronunciation-items", voiceItem.id, opts)
          }
          onPublish={(characterId) =>
            publishNarration("pronunciation-items", voiceItem.id, characterId)
          }
          onClose={() => {
            setVoiceItem(null);
            refreshItems();
          }}
        />
      )}
```

⚠️ **Pronunciation es el único que no expone el personaje, ni en back ni en front.** La columna existe en BD y el backend la estampa al generar, pero no viaja. Hay que abrir los dos extremos:

**Backend** — en `../dots-backend/src/modules/admin/admin.service.ts`, `serializePronunciationItem` (línea 712) no incluye el campo. Agregar después de `enabled`:

```typescript
      voiceCharacterId: i.voiceCharacterId ?? null,
```

**Frontend** — `AdminPronunciationItem` en `services/admin.service.ts` (línea 321-330), agregar:

```typescript
  voiceCharacterId?: number | null;
```

Sin el cambio del backend, `characterName(item.voiceCharacterId)` siempre mostraría "—" y la toma viva no diría quién habla.

- [ ] **Step 6: Lint y build**

```bash
source ~/.nvm/nvm.sh && npm run lint && npx next build
```

Esperado: sin errores. Si el lint marca `generateVocabAudio` y compañía como importados sin uso, es porque quedó un import viejo: bórralos. Las funciones en `services/admin.service.ts` **se conservan** (el endpoint sigue existiendo y `tryNarration` lo usa desde el backend), solo dejan de llamarse desde los managers.

- [ ] **Step 7: Commit**

```bash
git add components/admin/voice-modal.tsx components/admin/foundations/ services/admin.service.ts
git commit -m "feat(admin): audicion de voz en los cuatro managers de fundamentos"
```

---

### Task 12: `sentence-modal.tsx`

**Files:**
- Modify: `components/admin/sentence-modal.tsx`

**Interfaces:**
- Consumes: `VoiceStudio` (Task 10); `draftNarration`/`publishNarration` y `AdminSentence.voiceKey` (Task 8).
- Produces: nada para otros.

Cierra los tres huecos del §1 del spec: la narración se ve y se oye, el resultado de la autogeneración deja de descartarse, y `imgSound` deja de confundirse con la narración.

- [ ] **Step 1: Agregar imports y el resolutor de la URL de narración**

```typescript
import VoiceStudio from "@/components/admin/voice-studio";
import {
  draftNarration,
  getAdminCharacters,
  publishNarration,
  type AdminCharacter,
} from "@/services/admin.service";
import { resolveSentenceSoundUrl } from "@/constants";
```

- [ ] **Step 2: Estado nuevo del modal**

```typescript
  // La oración recién creada pasa a modo edición sin cerrar el modal, para que
  // crear → escuchar → regenerar sea un solo flujo.
  const [savedId, setSavedId] = useState<number | null>(sentence?.id ?? null);
  const [voiceKey, setVoiceKey] = useState<string | null>(
    sentence?.voiceKey ?? null,
  );
  const [voiceName, setVoiceName] = useState<string | null>(
    sentence?.voiceCharacterName ?? null,
  );
  const [ext, setExt] = useState<string>(sentence?.sentenceExtension ?? "");
  const [characters, setCharacters] = useState<AdminCharacter[]>([]);

  useEffect(() => {
    let alive = true;
    getAdminCharacters()
      .then((rows) => { if (alive) setCharacters(rows); })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  const liveTake =
    savedId != null && ext
      ? {
          characterName: voiceName ?? "voz sin identificar",
          clips: [
            { url: resolveSentenceSoundUrl(savedId, ext, voiceKey ?? undefined) },
          ],
        }
      : null;
```

- [ ] **Step 3: Consumir el resultado de la autogeneración en `save`**

Reemplazar el bloque `try` de `save` por:

```typescript
    try {
      if (isEdit && sentence) {
        const updated = await updateSentence(sentence.id, {
          text: text.trim(),
          mWord: mWord.trim(),
          img,
          imgSound,
        });
        applyNarrationResult(updated);
        onSaved(narrationNote(updated, "Oración actualizada."));
        setSaving(false);
      } else {
        const created = await createSentence({
          levelId,
          text: text.trim(),
          mWord: mWord.trim(),
          img: img || undefined,
          imgSound: imgSound || undefined,
        });
        applyNarrationResult(created);
        // El modal NO se cierra: queda en modo edición con la narración lista
        // para escuchar y regenerar.
        setSavedId(created.id);
        onSaved(narrationNote(created, "Oración creada."));
        setSaving(false);
      }
    } catch (e: unknown) {
      const ex = e as { response?: { data?: { message?: string } } };
      setErr(ex?.response?.data?.message ?? "No se pudo guardar. Inténtalo otra vez.");
      setSaving(false);
    }
```

Y agregar los dos helpers, antes de `save`:

```typescript
  type SavedSentence = {
    id: number;
    sentenceExtension?: string;
    voiceKey?: string | null;
    voiceCharacterName?: string | null;
    narration?: "generated" | "failed";
  };

  /** El backend narra al crear y al cambiar el texto; refleja el resultado. */
  const applyNarrationResult = (row: SavedSentence) => {
    setExt(row.sentenceExtension ?? "");
    setVoiceKey(row.voiceKey ?? null);
    setVoiceName(row.voiceCharacterName ?? null);
  };

  /**
   * Hasta ahora este resultado se descartaba: la narración fallaba en silencio
   * y el admin no tenía forma de enterarse.
   */
  const narrationNote = (row: SavedSentence, base: string) =>
    row.narration === "failed"
      ? `${base} La narración NO se pudo generar — revísala abajo.`
      : base;
```

⚠️ `createSentence`/`updateSentence` en `services/admin.service.ts` deben devolver el objeto tipado con `narration`, `voiceKey` y `voiceCharacterName`. Si hoy devuelven `any`/`AdminSentence` sin `narration`, extiende el tipo de retorno a `AdminSentence & { narration?: "generated" | "failed" }`.

- [ ] **Step 4: Renombrar el `UploadTile` de `imgSound` e insertar el bloque de narración**

Reemplazar el `UploadTile` de `Word audio` por:

```tsx
        <UploadTile
          label="Audio de la palabra"
          accept="audio/*"
          uploading={uploadingAudio}
          hasValue={Boolean(imgSound)}
          onFile={(f) => handleUpload(f, "audio")}
          onClear={() => setImgSound("")}
          preview={resolveAudioUrl(imgSound)}
        />
```

Y agregar, debajo de la grilla de subidas, el bloque de narración:

```tsx
      <p className="px-1 text-[11px] font-medium text-(--muted)">
        “Audio de la palabra” es el clip de “{mWord || "la palabra faltante"}”
        que suena en los botones de respuesta — no es la narración de la oración.
      </p>

      {savedId != null ? (
        <VoiceStudio
          key={savedId}
          live={liveTake}
          characters={characters}
          onDraft={(opts) => draftNarration("sentences", savedId, opts)}
          onPublish={(characterId) =>
            publishNarration("sentences", savedId, characterId)
          }
        />
      ) : (
        <div className="rounded-2xl border-2 border-dashed border-(--border) p-3 text-xs font-semibold text-(--muted)">
          Crea la oración y aquí mismo podrás escuchar su narración y regenerarla.
        </div>
      )}
```

- [ ] **Step 5: Ajustar el footer para el modo "creada, sigue abierta"**

El botón principal debe reflejar que la oración ya existe:

```tsx
          <UIButton
            tone="accent"
            onClick={save}
            disabled={saving || uploadingImg || uploadingAudio}
          >
            {saving
              ? "Guardando…"
              : savedId != null
                ? "Guardar cambios"
                : "Crear oración"}
          </UIButton>
```

Y `Cancel` pasa a `Cerrar` cuando `savedId != null`, porque ya no se cancela nada:

```tsx
          <UIButton tone="neutral" onClick={onClose}>
            {savedId != null ? "Cerrar" : "Cancelar"}
          </UIButton>
```

⚠️ Con `savedId != null` y `isEdit === false`, `save` debe entrar por la rama de **update**, no crear una segunda oración. Cambia la condición de `save` de `if (isEdit && sentence)` a `if (savedId != null)` y usa `savedId` como id en `updateSentence`.

- [ ] **Step 6: Lint y build**

```bash
source ~/.nvm/nvm.sh && npm run lint && npx next build
```

- [ ] **Step 7: Commit**

```bash
git add components/admin/sentence-modal.tsx services/admin.service.ts
git commit -m "feat(admin): narracion audible y regenerable en el modal de oraciones"
```

---

## Verificación final (preview manual, contra producción)

Corre los 10 pasos de §6 del spec. Los cuatro que más importan:

1. **Nada sin aprobar llega al alumno.** Genera un borrador de una oración, y en otra pestaña abre la URL canónica (`https://res.cloudinary.com/<cloud>/video/upload/dots/sounds/sentences/<voiceKey>/<id>.mp3`). Debe seguir sirviendo la toma vieja hasta que pulses "Usar esta toma".
2. **Que el modificador realmente modifique.** Mismo `seed`, `stability` 0.3 vs 0.9. Si las dos tomas no se distinguen, el ajuste no está llegando a la API y el panel es decorativo.
3. **La migración por sí sola no cambió nada.** Con el panel apagado y un personaje sin overrides, confirma en el log del backend que el body **no** lleva `voice_settings`.
4. **Admin y batch coinciden.** Guarda ajustes en un personaje, luego corre `npm run narrations:generate -- --apply --limit 1 --ids <id> --character <key> --force` y confirma que suena igual que en el admin.

**Créditos:** cada borrador gasta ElevenLabs (plan gratuito). Prueba con pocos ítems.
