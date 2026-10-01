# Reportes de ejercicios — plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** que el alumno reporte errores de cualquier ejercicio (bugs, ortografía, «no se entiende», «mi respuesta debería estar bien») y que el admin los revise agrupados, arregle el contenido, acepte respuestas alternativas y cierre con aviso y gemas al alumno.

**Architecture:** el backend guarda cada reporte con una foto de lo que vio el alumno en `dots.content_reports` y las respuestas aceptadas en `dots.answer_alternatives`, las dos con SQL crudo que degrada si la migración no está aplicada. Las alternativas se enchufan en el helper compartido `buildOptionSet` y en los cuatro juegos que sortean por su cuenta. En el webapp, cada pantalla publica en un store de módulo lo que tiene delante; la banderita lo lee y abre una hoja común. El admin tiene una sección nueva `/admin/reports` con bandeja agrupada y bandeja de bugs.

**Tech Stack:** NestJS 11 + TypeORM (SQL crudo vía `DataSource`/`manager.query`) + PostgreSQL remota; Next.js 16 (app router) + React 19 + Tailwind 4; jest en el backend y `node --test` en el webapp.

**Spec:** `docs/superpowers/specs/2026-10-01-reportes-de-ejercicios-design.md` (webapp). Léelo antes de cualquier tarea: el plan argumenta desde él.

## Global Constraints

- **Worktrees.** Webapp: `/home/endurance/Projects/Endurance/dots/dots-webapp/.claude/worktrees/current-section-always-visible-48540d` (rama `claude/exercise-report-system-700d21`). Backend: `/home/endurance/Projects/Endurance/dots/dots-backend/.claude/worktrees/reportes-ejercicios` (rama `feat/reportes-ejercicios`, `node_modules` y `.env` son symlinks al checkout principal). Trabaja SOLO ahí; nunca en el checkout principal de ninguno de los dos.
- **Node 24.** Antes de cualquier `node`/`npm`/`npx`: `export PATH="$HOME/.nvm/versions/node/v24.19.0/bin:$PATH"`. Los shells de subagente arrancan con Node 20 y dan falsos rojos (`ERR_UNKNOWN_FILE_EXTENSION` al importar `.ts`).
- **La BD es remota y de PRODUCCIÓN.** Ningún test toca la BD: todo con fakes. **Prohibido** `node scripts/migrate-reports.js --apply`; solo el dry-run (es de lectura) y únicamente en la tarea A1. No arranques el backend contra la BD para escribir datos.
- **Backend:** SQL crudo siempre parametrizado (`$1, $2…`); guards a nivel de clase; el `userId` sale del JWT (`@CurrentUser()`), jamás del body. Driver pg de TypeORM: `INSERT … RETURNING` devuelve un array de filas; `UPDATE`/`DELETE` crudos devuelven la tupla `[filas, afectadas]`; **`rowCount` no existe**. Premios exactamente una vez: premiar solo las filas que devolvió el `UPDATE … WHERE status = 'pending'`. Lint solo de tus archivos y sin `--fix`: `npx eslint <archivos>` (el `npm run lint` del backend reformatea archivos ajenos).
- **Webapp:** navegación con `router.push`, nunca `window.location.*` para navegar. RN-safe: solo toques (`onClick`/`onPointerUp`), nada de `keydown` como input de juego, ni drag HTML5, ni `<select>`. Lint del compiler de React: nada de `setState` síncrono en el cuerpo de un `useEffect`, ni efectos dentro de updaters de `setState`, ni leer `ref.current` durante el render. Ningún emoji como icono: `<Icon name=…>` (SVG) o `<UiIcon name=…>` (PNG). Doty solo con `<Doty pose=…>` y poses del registro (`feliz`, `muy-feliz`, `pensando`, `aplaudiendo`, `pulgar-arriba`, `excelente`…).
- **Copy:** todo texto de producto en español, tono juguetón, tuteo. La sección de admin nueva también en español.
- **Lib puro del webapp:** los archivos de `lib/` que se prueban con `node --test` solo usan `import type` de otros módulos de la app, y los imports de valor entre archivos de `lib/` llevan la extensión `.ts` (`import { x } from "./report.ts"`), como `lib/rival-alert.ts`.
- **Valores fijos del spec:** 10 gemas por reporte aceptado (`GEMS_PER_ACCEPTED_REPORT`), nunca a perfil 1; tope de 30 reportes creados en 24 h por alumno (429); comentario ≤ 500; `answer`/`expected` ≤ 300; `snapshot` y `context` ≤ 4096 caracteres serializados; motivos `answer | typo | meaning | audio | image | bug | other`.
- **Commits** en español, estilo `feat(reportes): …`, uno por tarea como mínimo, terminando con la línea `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Nada de push: la subida a main es la tarea C4 y necesita el «sí» de Sergio.

## Mapa de archivos

**Backend (`dots-backend`):**
- `scripts/migrate-reports.js` — crea las dos tablas (dry-run / `--apply` / `--rollback`).
- `src/common/answer-alternatives.ts` (+ spec) — cargar alternativas y normalizar; puro salvo la consulta.
- `src/common/sentence-quiz.ts` (+ spec) — `buildOptionSet` acepta `excluir`.
- `src/common/gems.ts` — `GEMS_PER_ACCEPTED_REPORT`.
- `src/modules/sentences/sentences.service.ts` (+ `sentences.practice.spec.ts`), `src/modules/review/review.service.ts`, `src/modules/path/node-content.service.ts`, `src/modules/path/checkpoint-quiz.ts` (+ spec), `src/modules/path/checkpoint.service.ts`, `src/modules/placement/placement.service.ts` — alternativas.
- `src/modules/games/games.service.ts`, `games.dto.ts`, `src/modules/daily-games/daily-games.service.ts`, `daily-games.dto.ts` — alternativas en juegos e ids que faltan.
- `src/modules/reports/` — módulo nuevo del alumno: `reports.constants.ts`, `reports.logic.ts` (+ spec), `reports.dto.ts` (+ spec), `reports.service.ts` (+ spec), `reports.controller.ts`, `reports.module.ts`.
- `src/modules/admin/admin-reports.logic.ts` (+ spec), `admin-reports.dto.ts`, `admin-reports.service.ts` (+ spec), `admin-reports.controller.ts`; `admin.service.ts` gana `getReportContent`; `admin.module.ts` los registra; `admin-me.reset.ts` gana un comentario.
- `docs/ARQUITECTURA.md`, `CLAUDE.md` — documentación.

**Webapp (`dots-webapp`):**
- `components/ui/icon/paths.tsx` — glifo `bandera`.
- `lib/report.ts` (+ test) — tipos, constructores de objetivos, motivos, validación y cuerpo.
- `lib/report-targets.ts` (+ test) + `hooks/use-report-targets.ts` — store de lo que hay en pantalla.
- `lib/accepted-answers.ts` (+ test) — normalización y orden aceptado en el cliente.
- `lib/error-trail.ts` (+ test), `lib/report-browser.ts`, `components/report/error-trail-capture.tsx` — contexto técnico.
- `services/reports.service.ts` — fetchers del alumno.
- `components/report/report-sheet.tsx`, `report-flag.tsx`, `report-button.tsx` — la hoja y sus dos entradas.
- `lib/report-notice.ts` (+ test), `components/report/report-notice.tsx`, `report-notice-watch.tsx` — el aviso de vuelta.
- Integraciones: `components/lesson/lesson-top-bar.tsx`, práctica, gramática, pronunciación, repaso, vocabulario, letras, números, checkpoint, placement, lecturas, ajustes, `GameResult` y los 12 juegos.
- Admin: `services/admin.service.ts` (sección Reportes), `lib/admin-reports.ts` (+ test), `app/(app)/admin/reports/page.tsx`, `components/admin/reports/*`, `components/admin/answer-alternatives-editor.tsx`, `lib/report-counts.ts` (+ test), `hooks/use-report-counts.ts`, export de los modales de fundamentos.
- `docs/ARQUITECTURA.md`.

---

# Parte A — Backend

Todas las rutas de esta parte son relativas a `/home/endurance/Projects/Endurance/dots/dots-backend/.claude/worktrees/reportes-ejercicios`.

### Task A1: Migración de las dos tablas

**Files:**
- Create: `scripts/migrate-reports.js`
- Modify: `package.json` (bloque `scripts`)

**Interfaces:**
- Produces: tablas `dots.content_reports` y `dots.answer_alternatives` con las columnas del spec §3.1 (las usan A2–A7).

- [ ] **Step 1: Escribir el script**

Calca `scripts/migrate-srs.js` (dry-run por defecto, `--apply`, backup, `--rollback`). Contenido completo:

```js
#!/usr/bin/env node
/**
 * Migración aditiva de los reportes de ejercicios (spec 2026-10-01): dos
 * tablas nuevas, nada existente se toca.
 *
 * - dots.content_reports: cada reporte de un alumno, con la foto de lo que vio.
 * - dots.answer_alternatives: respuestas que el admin aceptó como válidas.
 *
 * Usage (from dots-backend/):
 *   node scripts/migrate-reports.js            # dry-run
 *   node scripts/migrate-reports.js --apply    # crea tablas e índices, backup en scripts/out/
 *   node scripts/migrate-reports.js --rollback scripts/out/backup-reports-<ts>.json
 */
/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require('fs');
const path = require('path');
require('dotenv').config();
const { Client } = require('pg');

const OUT_DIR = path.join(__dirname, 'out');
const NEW_TABLES = ['content_reports', 'answer_alternatives'];

const DDL = [
  `CREATE TABLE IF NOT EXISTS dots.content_reports (
    id serial PRIMARY KEY,
    user_id integer NOT NULL REFERENCES dots.users(id) ON DELETE CASCADE,
    surface varchar(40) NOT NULL,
    mode varchar(40),
    target_type varchar(30),
    target_id bigint,
    reasons text[] NOT NULL,
    comment text,
    answer text,
    expected text,
    was_wrong boolean,
    snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
    context jsonb NOT NULL DEFAULT '{}'::jsonb,
    status varchar(12) NOT NULL DEFAULT 'pending',
    resolution_note text,
    resolved_by integer,
    resolved_at timestamptz,
    gems_awarded integer NOT NULL DEFAULT 0,
    notice_seen_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE INDEX IF NOT EXISTS content_reports_status_idx
     ON dots.content_reports (status, created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS content_reports_target_idx
     ON dots.content_reports (target_type, target_id)`,
  `CREATE INDEX IF NOT EXISTS content_reports_notice_idx
     ON dots.content_reports (user_id)
     WHERE resolved_at IS NOT NULL AND notice_seen_at IS NULL`,
  `CREATE TABLE IF NOT EXISTS dots.answer_alternatives (
    id serial PRIMARY KEY,
    target_type varchar(30) NOT NULL,
    target_id bigint NOT NULL,
    kind varchar(10) NOT NULL,
    value text NOT NULL,
    created_by integer,
    source_report_id integer,
    created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS answer_alternatives_unique
     ON dots.answer_alternatives (target_type, target_id, kind, upper(value))`,
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

async function existingTables(client) {
  const res = await client.query(
    `SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'dots' AND table_name = ANY($1)`,
    [NEW_TABLES],
  );
  return new Set(res.rows.map((r) => r.table_name));
}

async function rollback(client, backup) {
  console.log(`== rollback of ${backup.script} @ ${backup.timestamp} ==`);
  // Se crearon en el orden de NEW_TABLES y no hay FK entre ellas: el orden da igual.
  for (const table of backup.createdTables ?? []) {
    await client.query(`DROP TABLE IF EXISTS dots.${table}`);
    console.log(`dropped: dots.${table}`);
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

    const before = await existingTables(client);
    console.log('== Reports migration ==');
    console.log(
      `tables to create: ${NEW_TABLES.filter((t) => !before.has(t)).join(', ') || '(none — all exist)'}`,
    );

    if (!apply) {
      console.log('\nDry-run only. Re-run with --apply to execute.');
      return;
    }

    const backup = {
      script: 'migrate-reports',
      timestamp: new Date().toISOString(),
      createdTables: NEW_TABLES.filter((t) => !before.has(t)),
    };

    for (const sql of DDL) {
      await client.query(sql);
      console.log('OK:', sql.replace(/\s+/g, ' ').slice(0, 80));
    }

    const backupFile = path.join(OUT_DIR, `backup-reports-${Date.now()}.json`);
    fs.writeFileSync(backupFile, JSON.stringify(backup, null, 2));
    console.log(`\nBackup written: ${backupFile}`);

    const after = await existingTables(client);
    if (after.size !== NEW_TABLES.length) {
      throw new Error('Verification failed: some report table is missing');
    }
    console.log('Migration verified OK.');
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
```

- [ ] **Step 2: Alias de npm**

En `package.json`, dentro de `"scripts"`, junto a `"migrate:srs"`, añade:

```json
"migrate:reports": "node scripts/migrate-reports.js",
```

- [ ] **Step 3: Verificar sintaxis y dry-run (solo lectura)**

Run: `node --check scripts/migrate-reports.js && node scripts/migrate-reports.js`
Expected: sin errores de sintaxis y la salida `== Reports migration ==` / `tables to create: content_reports, answer_alternatives` / `Dry-run only. Re-run with --apply to execute.` **No** corras `--apply`.

- [ ] **Step 4: Commit**

```bash
git add scripts/migrate-reports.js package.json
git commit -m "feat(reportes): migración aditiva de content_reports y answer_alternatives

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task A2: Alternativas — cargador, normalización y `buildOptionSet`

**Files:**
- Create: `src/common/answer-alternatives.ts`
- Create: `src/common/answer-alternatives.spec.ts`
- Modify: `src/common/sentence-quiz.ts:33-46`
- Modify: `src/common/sentence-quiz.spec.ts` (añadir un caso)

**Interfaces:**
- Produces:
  - `type AlternativeTarget = 'sentence' | 'grammar_item'`, `type AlternativeKind = 'word' | 'sentence'`, `type Alternativas = { words: string[]; sentences: string[] }`
  - `sinAlternativas(): Alternativas`
  - `cargarAlternativas(manager: { query: (sql: string, params?: unknown[]) => Promise<unknown> }, targetType: AlternativeTarget, ids: ReadonlyArray<number | string>): Promise<Map<string, Alternativas>>` — clave = `String(id)`; mapa vacío si la tabla no existe.
  - `alternativasDe(mapa: Map<string, Alternativas>, id: number | string): Alternativas`
  - `normalizarPalabra(w: string): string`, `normalizarOracion(s: string): string`, `tokenizarOracion(s: string): string[]`
  - `palabraAceptada(dada: string, correcta: string, alternativas: readonly string[]): boolean`
  - `distractoresPosibles(pool: readonly string[], correcta: string, alternativas: readonly string[]): string[]`
  - `respuestasDelConstructor(referencia: readonly string[], alternativas: readonly string[]): string[][]`
  - `buildOptionSet(correct, pool, rng = Math.random, wrongCount = 3, excluir: readonly string[] = [])`

- [ ] **Step 1: Escribir los tests que fallan**

`src/common/answer-alternatives.spec.ts`:

```ts
import {
  alternativasDe,
  cargarAlternativas,
  distractoresPosibles,
  normalizarOracion,
  normalizarPalabra,
  palabraAceptada,
  respuestasDelConstructor,
  tokenizarOracion,
} from './answer-alternatives';

describe('normalización', () => {
  it('normalizarPalabra quita espacios, puntuación final y pasa a mayúsculas', () => {
    expect(normalizarPalabra('  feel. ')).toBe('FEEL');
    expect(normalizarPalabra('am')).toBe('AM');
  });

  it('normalizarOracion colapsa espacios y quita la puntuación final', () => {
    expect(normalizarOracion('  Today   I am happy .')).toBe('TODAY I AM HAPPY');
    expect(normalizarOracion('I am happy today!')).toBe('I AM HAPPY TODAY');
  });

  it('tokenizarOracion parte en espacios y limpia solo la última ficha', () => {
    expect(tokenizarOracion('Today, I am happy.')).toEqual(['Today,', 'I', 'am', 'happy']);
    expect(tokenizarOracion('   ')).toEqual([]);
  });
});

describe('palabraAceptada', () => {
  it('acepta la correcta como hoy (mayúsculas y espacios)', () => {
    expect(palabraAceptada(' AM ', 'am', [])).toBe(true);
  });
  it('acepta una alternativa y rechaza lo demás', () => {
    expect(palabraAceptada('Feel', 'am', ['feel'])).toBe(true);
    expect(palabraAceptada('is', 'am', ['feel'])).toBe(false);
    expect(palabraAceptada('', 'am', [''])).toBe(false);
  });
});

describe('distractoresPosibles', () => {
  it('saca la correcta y sus alternativas del mazo', () => {
    expect(distractoresPosibles(['am', 'feel', 'is', 'FEEL', 'are'], 'am', ['feel'])).toEqual([
      'is',
      'are',
    ]);
  });
});

describe('respuestasDelConstructor', () => {
  it('la referencia va primero y las alternativas se tokenizan sin repetir', () => {
    expect(
      respuestasDelConstructor(['I', 'am', 'happy', 'today'], [
        'Today I am happy.',
        'today i am happy',
        'I am happy today',
      ]),
    ).toEqual([
      ['I', 'am', 'happy', 'today'],
      ['Today', 'I', 'am', 'happy'],
    ]);
  });
});

describe('cargarAlternativas', () => {
  it('agrupa por id en una sola consulta parametrizada', async () => {
    const query = jest.fn().mockResolvedValue([
      { target_id: '12', kind: 'word', value: 'feel' },
      { target_id: '12', kind: 'sentence', value: 'Today I am happy' },
      { target_id: '30', kind: 'word', value: 'large' },
    ]);
    const mapa = await cargarAlternativas({ query }, 'sentence', [12, '30', 12]);
    expect(query).toHaveBeenCalledTimes(1);
    const [sql, params] = query.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain('FROM dots.answer_alternatives');
    expect(params).toEqual(['sentence', ['12', '30']]);
    expect(alternativasDe(mapa, 12)).toEqual({ words: ['feel'], sentences: ['Today I am happy'] });
    expect(alternativasDe(mapa, '30').words).toEqual(['large']);
    expect(alternativasDe(mapa, 99)).toEqual({ words: [], sentences: [] });
  });

  it('sin ids no consulta, y si la tabla no existe devuelve un mapa vacío', async () => {
    const query = jest.fn().mockRejectedValue(Object.assign(new Error('nope'), { code: '42P01' }));
    expect((await cargarAlternativas({ query }, 'sentence', [])).size).toBe(0);
    expect(query).not.toHaveBeenCalled();
    expect((await cargarAlternativas({ query }, 'sentence', [1])).size).toBe(0);
  });
});
```

Y en `src/common/sentence-quiz.spec.ts`, dentro del `describe('buildOptionSet', …)`, añade:

```ts
  it('never offers an excluded word (an accepted alternative) as a wrong option', () => {
    const pool = ['feel', 'FEEL ', 'cat', 'bird', 'fish', 'horse'].map(src);
    for (let seed = 1; seed <= 20; seed++) {
      const options = buildOptionSet(src('am'), pool, mulberry32(seed), 3, ['Feel']);
      expect(options.some((o) => /feel/i.test(o.word))).toBe(false);
      expect(options.filter((o) => o.correct)).toHaveLength(1);
    }
  });
```

- [ ] **Step 2: Correrlos y ver que fallan**

Run: `npx jest src/common/answer-alternatives.spec.ts src/common/sentence-quiz.spec.ts`
Expected: FAIL — `Cannot find module './answer-alternatives'` y el caso nuevo de `buildOptionSet` ofrece `feel`.

- [ ] **Step 3: Implementar `src/common/answer-alternatives.ts`**

```ts
/**
 * Respuestas alternativas (spec reportes 2026-10-01 §4). Una alternativa
 * aceptada deja de salir como opción incorrecta y cuenta como buena donde el
 * alumno puede producirla. Todo es puro salvo `cargarAlternativas`, que hace
 * UNA consulta por petición y es defensiva: si la migración no está aplicada
 * devuelve un mapa vacío y cada ejercicio queda exactamente como antes.
 *
 * La normalización de oraciones tiene un gemelo en el webapp
 * (`lib/accepted-answers.ts`): si cambias una, cambia la otra.
 */

export type AlternativeTarget = 'sentence' | 'grammar_item';
export type AlternativeKind = 'word' | 'sentence';
export type Alternativas = { words: string[]; sentences: string[] };

type Consultable = {
  query: (sql: string, params?: unknown[]) => Promise<unknown>;
};

export function sinAlternativas(): Alternativas {
  return { words: [], sentences: [] };
}

export async function cargarAlternativas(
  manager: Consultable,
  targetType: AlternativeTarget,
  ids: ReadonlyArray<number | string>,
): Promise<Map<string, Alternativas>> {
  const mapa = new Map<string, Alternativas>();
  const unicos = [...new Set(ids.map((id) => String(id)))].filter((id) =>
    /^-?\d+$/.test(id),
  );
  if (unicos.length === 0) return mapa;

  let rows: Array<{ target_id: string; kind: string; value: string }>;
  try {
    rows = (await manager.query(
      `SELECT target_id::text AS target_id, kind, value
         FROM dots.answer_alternatives
        WHERE target_type = $1 AND target_id = ANY($2::bigint[])
        ORDER BY id ASC`,
      [targetType, unicos],
    )) as Array<{ target_id: string; kind: string; value: string }>;
  } catch {
    // Tabla ausente (migración sin aplicar): sin alternativas, nunca fatal.
    return mapa;
  }

  for (const row of rows) {
    const alt = mapa.get(row.target_id) ?? sinAlternativas();
    if (row.kind === 'word') alt.words.push(row.value);
    else if (row.kind === 'sentence') alt.sentences.push(row.value);
    mapa.set(row.target_id, alt);
  }
  return mapa;
}

export function alternativasDe(
  mapa: Map<string, Alternativas>,
  id: number | string,
): Alternativas {
  return mapa.get(String(id)) ?? sinAlternativas();
}

export function normalizarPalabra(w: string): string {
  return String(w).trim().replace(/[.,;:!?]+$/, '').trim().toUpperCase();
}

export function normalizarOracion(s: string): string {
  return String(s)
    .replace(/\s+/g, ' ')
    .replace(/[\s.,;:!?]+$/, '')
    .trim()
    .toUpperCase();
}

/** Igual que `buildAnswer` del Constructor: espacios y sin puntuación en la última ficha. */
export function tokenizarOracion(s: string): string[] {
  const tokens = String(s)
    .split(/\s+/)
    .filter((t) => t.length > 0);
  if (tokens.length > 0) {
    tokens[tokens.length - 1] = tokens[tokens.length - 1].replace(/[.,;:!?]+$/, '');
  }
  return tokens.filter((t) => t.length > 0);
}

export function palabraAceptada(
  dada: string,
  correcta: string,
  alternativas: readonly string[],
): boolean {
  const d = normalizarPalabra(dada);
  if (!d) return false;
  if (d === normalizarPalabra(correcta)) return true;
  return alternativas.some((a) => normalizarPalabra(a) === d);
}

export function distractoresPosibles(
  pool: readonly string[],
  correcta: string,
  alternativas: readonly string[],
): string[] {
  const fuera = new Set([correcta, ...alternativas].map(normalizarPalabra));
  return pool.filter((w) => !fuera.has(normalizarPalabra(w)));
}

export function respuestasDelConstructor(
  referencia: readonly string[],
  alternativas: readonly string[],
): string[][] {
  const out: string[][] = [[...referencia]];
  const vistas = new Set([normalizarOracion(referencia.join(' '))]);
  for (const alt of alternativas) {
    const tokens = tokenizarOracion(alt);
    const clave = normalizarOracion(tokens.join(' '));
    if (tokens.length === 0 || vistas.has(clave)) continue;
    vistas.add(clave);
    out.push(tokens);
  }
  return out;
}
```

- [ ] **Step 4: `buildOptionSet` acepta `excluir`**

En `src/common/sentence-quiz.ts`, cambia la firma y la siembra del set (el resto queda igual):

```ts
export function buildOptionSet(
  correct: QuizOptionSource,
  pool: QuizOptionSource[],
  rng: () => number = Math.random,
  wrongCount = 3,
  /** Alternativas aceptadas: nunca salen como incorrectas (spec reportes §4). */
  excluir: readonly string[] = [],
): QuizOption[] {
  const seen = new Set<string>([norm(correct.word), ...excluir.map(norm)]);
```

Y en el comentario JSDoc de la función añade una línea: «`excluir`: palabras que también valen; se descartan del pool como la correcta.»

- [ ] **Step 5: Correr los tests**

Run: `npx jest src/common/answer-alternatives.spec.ts src/common/sentence-quiz.spec.ts`
Expected: PASS (todos).

- [ ] **Step 6: Lint y commit**

```bash
npx eslint src/common/answer-alternatives.ts src/common/answer-alternatives.spec.ts src/common/sentence-quiz.ts src/common/sentence-quiz.spec.ts
git add src/common/answer-alternatives.ts src/common/answer-alternatives.spec.ts src/common/sentence-quiz.ts src/common/sentence-quiz.spec.ts
git commit -m "feat(reportes): cargador de respuestas alternativas y buildOptionSet que las excluye

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task A3: Alternativas en práctica, repaso y gramática (+ `refId` del nodo)

**Files:**
- Modify: `src/modules/sentences/sentences.service.ts:51-200` (`getSentencesPractice`)
- Create: `src/modules/sentences/sentences.practice.spec.ts`
- Modify: `src/modules/review/review.service.ts:57-80` (`getSession`)
- Modify: `src/modules/path/node-content.service.ts` (contenido de gramática y de pronunciación) y el DTO de contenido de nodo que tipa esos dos (búscalo con `grep -rn "type: 'grammar'" src/modules/path`)

**Interfaces:**
- Consumes: `cargarAlternativas`, `alternativasDe`, `buildOptionSet(…, excluir)` (A2).
- Produces:
  - Práctica: cada ítem en modo `buildUp` lleva `accepted_texts?: string[]` (oraciones alternativas tal como se guardaron) — lo consume B7.
  - `GET /path/nodes/:id` de tipo `grammar` y `pronunciation` lleva `refId: number` (id de la píldora / unidad) — lo consume B8.

- [ ] **Step 1: Test que falla para la práctica**

`src/modules/sentences/sentences.practice.spec.ts`:

```ts
import { SentencesService } from './sentences.service';

/**
 * GET /sentences/practice/:levelId con repositorio falso: nunca toca la BD.
 * Fija que una alternativa aceptada no sale como opción incorrecta y que el
 * modo «Arma la oración» manda las oraciones alternativas.
 */
function entity(id: string, text: string, mWord: string) {
  return {
    id,
    text,
    mWord,
    levelId: 5,
    img: '',
    imgSound: '',
    enabled: true,
    noImg: true,
    sentenceExtension: 'mp3',
    voiceCharacterId: null,
  };
}

function makeService(alternatives: Array<{ target_id: string; kind: string; value: string }>) {
  const entities = [
    entity('1', 'I __ happy today.', 'am'),
    entity('2', 'She __ to school.', 'goes'),
    entity('3', 'They __ tired.', 'feel'),
    entity('4', 'We __ friends.', 'are'),
  ];
  const query = jest.fn(async (sql: string) => {
    if (sql.includes('dots.characters')) return [];
    if (sql.includes('dots.answer_alternatives')) return alternatives;
    throw new Error(`unexpected SQL: ${sql}`);
  });
  const sentencesRepository = {
    find: jest.fn().mockResolvedValue(entities),
    manager: { query },
  };
  const service = new SentencesService(
    sentencesRepository as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
  );
  return { service, query };
}

describe('SentencesService.getSentencesPractice — alternativas', () => {
  it('nunca ofrece una alternativa aceptada como opción incorrecta', async () => {
    const { service } = makeService([{ target_id: '1', kind: 'word', value: 'feel' }]);
    for (let i = 0; i < 25; i++) {
      const items = await service.getSentencesPractice(5);
      const first = items.find((s) => String(s.id) === '1');
      const wrong = (first.options as Array<{ word: string; correct: boolean }>).filter(
        (o) => !o.correct && o.word.toUpperCase() === 'FEEL',
      );
      expect(wrong).toHaveLength(0);
    }
  });

  it('en «Arma la oración» manda las oraciones alternativas', async () => {
    const { service } = makeService([
      { target_id: '1', kind: 'sentence', value: 'Today I am happy' },
    ]);
    let seen = false;
    for (let i = 0; i < 60 && !seen; i++) {
      const items = await service.getSentencesPractice(5);
      const first = items.find((s) => String(s.id) === '1');
      if (first.mode === 'buildUp') {
        expect(first.accepted_texts).toEqual(['Today I am happy']);
        seen = true;
      }
    }
    expect(seen).toBe(true);
  });
});
```

Antes de escribirlo, comprueba con `sed -n 25,42p src/modules/sentences/sentences.service.ts` cuántos parámetros tiene el constructor de `SentencesService` y ajusta la cantidad de `{} as never` para que coincida (el primero es `sentencesRepository`).

- [ ] **Step 2: Verlo fallar**

Run: `npx jest src/modules/sentences/sentences.practice.spec.ts`
Expected: FAIL — `feel` aparece como incorrecta en alguna vuelta, `accepted_texts` es `undefined`, y/o `unexpected SQL` no salta porque todavía no se consulta `answer_alternatives`.

- [ ] **Step 3: Implementar en la práctica**

En `src/modules/sentences/sentences.service.ts`:

1. Import: `import { alternativasDe, cargarAlternativas } from 'src/common/answer-alternatives';`
2. En el tipo local `SentencePracticeItem` añade `accepted_texts?: string[];` debajo de `options?: SentenceOption[];`.
3. Justo después del bloque que arma `voiceKeyById` (antes de `const response`), carga las alternativas:

```ts
      // Respuestas que el admin aceptó (spec reportes §4): no salen como
      // incorrectas y, en «Arma la oración», otro orden también vale.
      const alternativas = await cargarAlternativas(
        this.sentencesRepository.manager,
        'sentence',
        entities.map((e) => e.id),
      );
```

4. En el bucle, sustituye la llamada a `buildOptionSet` por:

```ts
        const alts = alternativasDe(alternativas, item.id);
        // 3 distinct wrong words sampled from the level's other sentences,
        // correct answer spliced at a random position (src/common/sentence-quiz.ts)
        const options: SentenceOption[] = buildOptionSet(
          { word: item.m_word, img: item.img, imgSound: item.img_sound },
          response
            .filter((_, idx) => idx !== i)
            .map((s) => ({
              word: s.m_word,
              img: s.img,
              imgSound: s.img_sound,
            })),
          Math.random,
          3,
          alts.words,
        );
```

5. Dentro de `if (item.mode === 'buildUp') { … }`, justo después de `item.text = String(item.text).replace('__', item.m_word);`, añade:

```ts
            if (alts.sentences.length > 0) item.accepted_texts = alts.sentences;
```

- [ ] **Step 4: Repaso**

En `src/modules/review/review.service.ts`, importa `alternativasDe, cargarAlternativas` y, después de calcular `poolWords`, carga las alternativas de todos los `due`:

```ts
    const alternativas = await cargarAlternativas(
      manager,
      'sentence',
      due.map((row) => row.ref_id),
    );
```

y cambia la línea de `options` del `items.push` por:

```ts
        options: buildOptionSet(
          { word: sentence.mWord },
          poolWords,
          Math.random,
          3,
          alternativasDe(alternativas, row.ref_id).words,
        ).map(({ word, correct }) => ({ word, correct })),
```

(`manager` es la variable que el método ya usa para sus `query`; si se llama distinto, usa esa.)

- [ ] **Step 5: Gramática y `refId`**

En `src/modules/path/node-content.service.ts`, en el método que arma el contenido de gramática (el que hace `buildOptionSet({ word: item.answer }, …)`), importa `alternativasDe, cargarAlternativas`, carga después de `items`:

```ts
    const alternativas = await cargarAlternativas(
      this.grammarItemRepository.manager,
      'grammar_item',
      items.map((i) => i.id),
    );
```

cambia `options` por:

```ts
        options: buildOptionSet(
          { word: item.answer },
          (item.distractors ?? []).map((word) => ({ word })),
          Math.random,
          3,
          alternativasDe(alternativas, item.id).words,
        ).map(({ word, correct }) => ({ word, correct })),
```

y añade `refId: pill.id,` al objeto devuelto (junto a `type: 'grammar'`). En el método de pronunciación del mismo archivo añade `refId: unit.id,` (usa el nombre real de la variable de la unidad en ese método). Añade `refId: number;` a los dos tipos del DTO de contenido de nodo que describen esas respuestas.

- [ ] **Step 6: Correr tests y build**

Run: `npx jest src/modules/sentences src/common && npm run build`
Expected: PASS y build sin errores de tipos.

- [ ] **Step 7: Lint y commit**

```bash
npx eslint src/modules/sentences/sentences.service.ts src/modules/sentences/sentences.practice.spec.ts src/modules/review/review.service.ts src/modules/path/node-content.service.ts
git add -A src/modules/sentences src/modules/review src/modules/path
git commit -m "feat(reportes): práctica, repaso y gramática respetan las respuestas aceptadas

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task A4: Alternativas en checkpoint y placement

**Files:**
- Modify: `src/modules/path/checkpoint-quiz.ts`
- Modify: `src/modules/path/checkpoint-quiz.spec.ts`
- Modify: `src/modules/path/checkpoint.service.ts:189-207` (`loadSectionSentences`)
- Modify: `src/modules/placement/placement.service.ts:122-150` (`answer`), `:254-300` (`pickQuestion`), `:303-336` (`resumeQuestion`)

**Interfaces:**
- Consumes: `cargarAlternativas`, `alternativasDe`, `palabraAceptada`, `buildOptionSet(…, excluir)` (A2).
- Produces: `CheckpointSentence.alternativas?: string[]`; `CheckpointQuestion.accepted: string[]` (nunca viaja al cliente).

- [ ] **Step 1: Tests que fallan del checkpoint**

En `src/modules/path/checkpoint-quiz.spec.ts` añade (usa los helpers de construcción de oraciones que ya tenga el archivo; si no hay, este bloque es autosuficiente):

```ts
describe('checkpoint con alternativas', () => {
  const sentences = Array.from({ length: 14 }, (_, i) => ({
    id: i + 1,
    text: `Sentence ${i + 1} __ here.`,
    mWord: i === 0 ? 'am' : `word${i + 1}`,
    alternativas: i === 0 ? ['feel'] : [],
  }));
  // Una oración cuya alternativa también está en el pool de otra.
  sentences[1].mWord = 'feel';

  it('no ofrece la alternativa como opción de la pregunta que la acepta', () => {
    for (let seed = 1; seed <= 30; seed++) {
      const quiz = generateCheckpointQuiz(seed, sentences, 14);
      const q = quiz.find((x) => x.sentenceId === 1);
      expect(q?.options.map((o) => o.toUpperCase())).not.toContain('FEEL');
    }
  });

  it('corrige como buena una alternativa aceptada', () => {
    const quiz = generateCheckpointQuiz(7, sentences, 14);
    const { correct } = gradeCheckpoint(quiz, [{ sentenceId: 1, word: 'Feel' }]);
    expect(correct).toBe(1);
  });
});
```

Run: `npx jest src/modules/path/checkpoint-quiz.spec.ts`
Expected: FAIL (`alternativas` no existe en el tipo / `feel` aparece / `correct` es 0).

- [ ] **Step 2: Implementar en `checkpoint-quiz.ts`**

```ts
import { palabraAceptada } from '../../common/answer-alternatives';

export type CheckpointSentence = {
  id: number;
  text: string;
  mWord: string;
  /** Palabras aceptadas además de mWord (spec reportes §4). */
  alternativas?: string[];
};

export type CheckpointQuestion = {
  sentenceId: number;
  text: string;
  options: string[];
  /** Correct word — MUST be stripped before sending the quiz to a client. */
  answer: string;
  /** Alternativas aceptadas — MUST be stripped before sending, como `answer`. */
  accepted: string[];
};
```

En `generateCheckpointQuiz`, el `map` final queda:

```ts
  return picked.map((sentence) => ({
    sentenceId: sentence.id,
    text: sentence.text,
    options: buildOptionSet(
      { word: sentence.mWord },
      pool,
      rng,
      3,
      sentence.alternativas ?? [],
    ).map((o) => o.word),
    answer: sentence.mWord,
    accepted: sentence.alternativas ?? [],
  }));
```

En `gradeCheckpoint`, el `if` del bucle queda:

```ts
    if (
      submitted &&
      palabraAceptada(submitted, question.answer, question.accepted ?? [])
    ) {
      correct++;
    }
```

- [ ] **Step 3: Cargar las alternativas en el servicio del checkpoint**

En `checkpoint.service.ts`, importa `alternativasDe, cargarAlternativas` y cambia el final de `loadSectionSentences`:

```ts
    const alternativas = await cargarAlternativas(
      this.sentencesRepository.manager,
      'sentence',
      rows.map((r) => r.id),
    );
    return rows.map((r) => ({
      id: Number(r.id),
      text: r.text,
      mWord: r.m_word,
      alternativas: alternativasDe(alternativas, r.id).words,
    }));
```

Comprueba que `start()` sigue mandando solo `{ sentenceId, text, options }` (destructura y no expone `answer` ni `accepted`).

- [ ] **Step 4: Placement**

En `placement.service.ts`, importa `alternativasDe, cargarAlternativas, palabraAceptada`.

En `answer()`, sustituye el cálculo de `correct`:

```ts
    const alternativas = await cargarAlternativas(
      this.sentencesRepository.manager,
      'sentence',
      [sentence.id],
    );
    const correct = palabraAceptada(
      body.word,
      String(sentence.mWord ?? ''),
      alternativasDe(alternativas, sentence.id).words,
    );
```

En `pickQuestion()`, antes del `buildOptionSet`:

```ts
    const alts = alternativasDe(
      await cargarAlternativas(this.sentencesRepository.manager, 'sentence', [sentence.id]),
      sentence.id,
    );
```

y la llamada pasa a `buildOptionSet({ word: sentence.m_word }, pool.map((p) => ({ word: p.m_word })), Math.random, 3, alts.words)`. En `resumeQuestion()`, lo mismo con `sentence.id` y `sentence.mWord`.

- [ ] **Step 5: Tests y build**

Run: `npx jest src/modules/path src/modules/placement && npm run build`
Expected: PASS y build limpio.

- [ ] **Step 6: Lint y commit**

```bash
npx eslint src/modules/path/checkpoint-quiz.ts src/modules/path/checkpoint-quiz.spec.ts src/modules/path/checkpoint.service.ts src/modules/placement/placement.service.ts
git add src/modules/path src/modules/placement
git commit -m "feat(reportes): checkpoint y placement no ofrecen ni rechazan una respuesta aceptada

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task A5: Juegos — alternativas e ids que faltan

**Files:**
- Modify: `src/modules/games/games.dto.ts` (`GameWordDto`, `BuilderSentenceDto`, `TowerRoundDto`)
- Modify: `src/modules/games/games.service.ts` (`getDontPop` ~l.432, `getAudioBlitz` ~l.620-700, `getWordTower` ~l.709-800, `getSentenceBuilder` ~l.800-905, `getDotaxi` ~l.905-968)
- Modify: `src/modules/daily-games/daily-games.dto.ts` (`WordleStateDto`, `CrosswordAnswerDto`)
- Modify: `src/modules/daily-games/daily-games.service.ts` (`wordPool`, `wordOfDay`, `toDto`, `crosswordPool`, `crosswordOfDay`, `toCrosswordDto` y sus llamadas en l.130-226 y l.341-357)

**Interfaces:**
- Consumes: `cargarAlternativas`, `alternativasDe`, `distractoresPosibles`, `respuestasDelConstructor`, `normalizarPalabra` (A2).
- Produces (los consume B12/B13):
  - `GameWordDto.accepted?: string[]` (solo ¡No lo revientes!, solo si hay alternativas).
  - `BuilderSentenceDto.answers: string[][]` (siempre; la primera es `answer`).
  - `TowerRoundDto.id: number` (id del `vocab_item`).
  - `WordleStateDto.answerId: number | null` (no nulo solo con `done`).
  - `CrosswordAnswerDto.vocabId: number | null` (solo viaja con `done`, como `answers`).

- [ ] **Step 1: DTOs**

En `games.dto.ts`:

```ts
export class GameWordDto {
  id: number;
  title: string;
  src: string | null;
  answered: boolean;
  /** ¡No lo revientes!: palabras que también valen; el cliente las saca de sus distractores. */
  accepted?: string[];
}
```

En `BuilderSentenceDto`, debajo de `answer`:

```ts
  /** Secuencias válidas: `answer` primero y luego cada orden aceptado (spec reportes §4). */
  answers: string[][];
```

En `TowerRoundDto`, arriba de `word`:

```ts
  /** vocab_items.id — para poder reportar la palabra. */
  id: number;
```

En `daily-games.dto.ts`: `WordleStateDto` gana, debajo de `answer`:

```ts
  /** vocab_items.id de la respuesta — non-null ONLY when done, igual que `answer`. */
  answerId: number | null;
```

y `CrosswordAnswerDto` gana `vocabId: number | null;`.

- [ ] **Step 2: Escucha Rápida (también alimenta Carrera Fantasma) y Dotaxi**

En `games.service.ts`, importa `alternativasDe, cargarAlternativas, distractoresPosibles, normalizarPalabra, respuestasDelConstructor` de `'src/common/answer-alternatives'`.

En `getAudioBlitz`, cambia el `return shuffled.slice(0, AUDIO_BLITZ_QUESTIONS).map((r) => { … })` por un mazo cortado primero, alternativas del mazo y el mismo mapeo con el filtro nuevo:

```ts
    const deck = shuffled.slice(0, AUDIO_BLITZ_QUESTIONS);
    const alternativas = await cargarAlternativas(
      this.sentencesRepository.manager,
      'sentence',
      deck.map((r) => r.id),
    );

    return deck.map((r) => {
      const correct = clean(r.m_word);
      const distractorPool = distractoresPosibles(
        wordPool,
        correct,
        alternativasDe(alternativas, r.id).words,
      );
      // … el resto del cuerpo del map queda EXACTAMENTE igual (distractors, options, item)
```

En `getDotaxi`, igual: después de calcular `deck`, carga `alternativas` para `deck.map((r) => r.id)` y sustituye `wordPool.filter((w) => w.toUpperCase() !== correct.toUpperCase())` por `distractoresPosibles(wordPool, correct, alternativasDe(alternativas, r.id).words)`.

- [ ] **Step 3: Constructor**

En `getSentenceBuilder`, después de `const selected = shuffledPool.slice(0, BUILDER_SENTENCES);`:

```ts
    const alternativas = await cargarAlternativas(
      this.sentencesRepository.manager,
      'sentence',
      selected.map((r) => r.id),
    );
```

Dentro del `selected.map((r) => { … })`:

```ts
      const answer = buildAnswer(r.text, r.m_word);
      const alts = alternativasDe(alternativas, r.id);
      // Ni las fichas de la oración ni las palabras que también valen salen como señuelo.
      const fuera = new Set(
        [...answer, ...alts.words].map((t) => normalizarPalabra(t)),
      );
      const distractorPool = sh(
        wordPool.filter((w) => !fuera.has(normalizarPalabra(w))),
      );
```

(esto sustituye a `answerUpperSet` y su filtro) y, al armar el DTO, debajo de `dto.answer = answer;`:

```ts
      dto.answers = respuestasDelConstructor(answer, alts.sentences);
```

- [ ] **Step 4: ¡No lo revientes!**

En `getDontPop`, sustituye el `return this.shuffle(rows).slice(0, DONT_POP_WORDS).map(…)` por:

```ts
    const deck = this.shuffle(rows).slice(0, DONT_POP_WORDS);
    const alternativas = await cargarAlternativas(
      this.sentencesRepository.manager,
      'sentence',
      deck.map((r) => r.id),
    );
    return deck.map((r) => {
      const accepted = alternativasDe(alternativas, r.id).words;
      return {
        id: Number(r.id),
        title: r.title ?? '',
        src: r.src ?? null,
        answered: false,
        ...(accepted.length > 0 ? { accepted } : {}),
      };
    });
```

(Si el objeto devuelto original tiene más campos que los cuatro de arriba, consérvalos.)

- [ ] **Step 5: Torre de Palabras**

En `getWordTower`, los ítems de los packs son entities `VocabItem` (tienen `id`). Cambia los dos `as Array<{ text: string; meaning: string }>` (y el tipo del `Map` `itemPools`) por `Array<{ id: number; text: string; meaning: string }>` y el push por:

```ts
      rounds.push({ id: item.id, word: item.text, correct: pack.title, options });
```

- [ ] **Step 6: Palabra del Día**

En `daily-games.service.ts`:

- `wordPool()` devuelve `{ id: number; text: string; meaning: string }[]` y hace `pool.push({ id: item.id, text: upper, meaning: item.meaning });`.
- `wordOfDay(day)` devuelve `{ answer, hintEs, answerId: picked.id }`.
- `toDto(day, answer, hintEs, guesses, answerId: number)` añade `answerId: done ? answerId : null,` debajo de `answer: …`.
- En las dos llamadas (l.~130 y l.~147/226) desestructura `answerId` de `wordOfDay` y pásalo a `toDto`.

- [ ] **Step 7: Mini Crucigrama**

Sin tocar `crossword-gen.ts` (puro y con tests):

- `crosswordPool()` devuelve `{ id: number; text: string; meaning: string }[]` (`pool.push({ id: item.id, text: upper, meaning: item.meaning })`). `buildCrossword` acepta objetos con campos de más.
- `crosswordOfDay(day)` devuelve `Promise<{ cw: Crossword; vocabIds: Map<string, number> }>`, con `const vocabIds = new Map(pool.map((p) => [p.text, p.id]));` (el pool ya viene en mayúsculas y sin duplicados, igual que `Slot.answer`).
- `toCrosswordDto(day, cw, stored, correct, done, won, vocabIds: Map<string, number>)`, y `answers` pasa a:

```ts
      answers: done
        ? cw.slots.map((sl) => ({
            id: sl.id,
            answer: sl.answer,
            vocabId: vocabIds.get(sl.answer) ?? null,
          }))
        : null,
```

- En las dos llamadas (l.~341 y l.~357): `const { cw, vocabIds } = await this.crosswordOfDay(day);` y pasa `vocabIds` a cada `toCrosswordDto`.

- [ ] **Step 8: Tests y build**

Run: `npx jest src/modules/games src/modules/daily-games src/common && npm run build`
Expected: PASS (los specs existentes de `crossword-gen` y `wordle.logic` no cambian) y build limpio. Los helpers nuevos ya están probados en A2; aquí el cambio es de cableado.

- [ ] **Step 9: Lint y commit**

```bash
npx eslint src/modules/games/games.service.ts src/modules/games/games.dto.ts src/modules/daily-games/daily-games.service.ts src/modules/daily-games/daily-games.dto.ts
git add src/modules/games src/modules/daily-games
git commit -m "feat(reportes): los juegos respetan las respuestas aceptadas y mandan el id de lo que muestran

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task A6: Módulo de reportes del alumno

**Files:**
- Create: `src/modules/reports/reports.constants.ts`
- Create: `src/modules/reports/reports.logic.ts`, `src/modules/reports/reports.logic.spec.ts`
- Create: `src/modules/reports/reports.dto.ts`, `src/modules/reports/reports.dto.spec.ts`
- Create: `src/modules/reports/reports.service.ts`, `src/modules/reports/reports.service.spec.ts`
- Create: `src/modules/reports/reports.controller.ts`, `src/modules/reports/reports.module.ts`
- Modify: `src/app.module.ts` (importar `ReportsModule`)

**Interfaces:**
- Produces:
  - `POST /reports` → `{ id: number; merged: boolean }` (400 reglas, 429 tope, 503 sin tabla).
  - `GET /me/report-notices` → `{ notices: Array<{ id: number; outcome: 'fixed' | 'dismissed'; note: string | null; gems: number; prompt: string | null; resolvedAt: string }> }`.
  - `POST /me/report-notices/seen` `{ ids: number[] }` → `{ updated: number }` (200).
  - Exporta para A7: `REPORT_REASONS`, `REPORT_TARGET_TYPES`, `type ReportReason`, `type ReportTargetType`, `REPORT_JSON_MAX`, `esTablaAusente(err)`, `unirMotivos(a, b)`.

- [ ] **Step 1: Constantes**

`src/modules/reports/reports.constants.ts`:

```ts
import { GAME_KEYS } from '../games/games.dto';

/** Motivos de la hoja de reporte, en el orden en que se pintan (spec §1.3). */
export const REPORT_REASONS = [
  'answer',
  'typo',
  'meaning',
  'audio',
  'image',
  'bug',
  'other',
] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];

export const REPORT_TARGET_TYPES = [
  'sentence',
  'word',
  'vocab_item',
  'grammar_item',
  'grammar_pill',
  'pronunciation_item',
  'pronunciation_unit',
  'letter_item',
  'number_item',
  'reading',
  'false_friend',
] as const;
export type ReportTargetType = (typeof REPORT_TARGET_TYPES)[number];

/** Pantallas desde las que se reporta; los juegos van como `game:<key>`. */
export const REPORT_SURFACES: readonly string[] = [
  'practice',
  'lesson-grammar',
  'lesson-pronunciation',
  'lesson-vocab',
  'lesson-letters',
  'lesson-numbers',
  'checkpoint',
  'placement',
  'review',
  'reading',
  'app',
  ...GAME_KEYS.map((key) => `game:${key}`),
];

/** Reportes NUEVOS por alumno en 24 h; las fusiones no cuentan. */
export const REPORT_DAILY_LIMIT = 30;
/** Tope de `snapshot` y `context` serializados. */
export const REPORT_JSON_MAX = 4096;
```

Comprueba con `sed -n 26,45p src/modules/games/games.dto.ts` que `GAME_KEYS` contiene las doce claves (`dot-bombs`, `dont-pop`, `dotaxi`, `dot-match`, `true-false`, `memory`, `audio-blitz`, `word-tower`, `sentence-builder`, `wordle`, `crossword`, `ghost-race`). Si falta alguna, NO la añadas a `GAME_KEYS` (afecta a los scores): lista las que falten a mano en `REPORT_SURFACES`.

- [ ] **Step 2: Tests de la lógica pura (fallan)**

`src/modules/reports/reports.logic.spec.ts`:

```ts
import { esTablaAusente, unirMotivos, validarReporte } from './reports.logic';

const base = {
  reasons: ['typo'] as const,
  targetType: 'sentence',
  targetId: '12',
  snapshot: { prompt: 'I __ happy.' },
  context: {},
};

describe('validarReporte', () => {
  it('acepta un reporte normal', () => {
    expect(validarReporte({ ...base, reasons: ['typo'] })).toBeNull();
  });
  it('targetType y targetId van juntos', () => {
    expect(validarReporte({ ...base, reasons: ['typo'], targetId: undefined })).not.toBeNull();
  });
  it('sin ejercicio solo valen bug y other', () => {
    expect(
      validarReporte({ ...base, targetType: undefined, targetId: undefined, reasons: ['typo'] }),
    ).not.toBeNull();
    expect(
      validarReporte({ ...base, targetType: undefined, targetId: undefined, reasons: ['bug'] }),
    ).toBeNull();
  });
  it('«debería estar bien» exige la respuesta y «otra cosa» el comentario', () => {
    expect(validarReporte({ ...base, reasons: ['answer'] })).not.toBeNull();
    expect(validarReporte({ ...base, reasons: ['answer'], answer: 'feel' })).toBeNull();
    expect(validarReporte({ ...base, reasons: ['other'], comment: '   ' })).not.toBeNull();
  });
  it('rechaza fotos o contextos de más de 4 KB', () => {
    expect(
      validarReporte({ ...base, reasons: ['typo'], snapshot: { prompt: 'x'.repeat(5000) } }),
    ).not.toBeNull();
  });
});

describe('unirMotivos', () => {
  it('une sin repetir y en el orden canónico', () => {
    expect(unirMotivos(['other', 'typo'], ['typo', 'answer'])).toEqual(['answer', 'typo', 'other']);
  });
});

describe('esTablaAusente', () => {
  it('reconoce el 42P01 directo o envuelto por TypeORM', () => {
    expect(esTablaAusente({ code: '42P01' })).toBe(true);
    expect(esTablaAusente({ driverError: { code: '42P01' } })).toBe(true);
    expect(esTablaAusente(new Error('otra cosa'))).toBe(false);
  });
});
```

Run: `npx jest src/modules/reports/reports.logic.spec.ts`
Expected: FAIL — módulo inexistente.

- [ ] **Step 3: Implementar `reports.logic.ts`**

```ts
import { REPORT_JSON_MAX, REPORT_REASONS, type ReportReason } from './reports.constants';

export type ReglasReporte = {
  reasons: readonly string[];
  targetType?: string;
  targetId?: string;
  comment?: string;
  answer?: string;
  snapshot: Record<string, unknown>;
  context: Record<string, unknown>;
};

/** Las reglas que class-validator no expresa (spec §3.2). `null` = válido. */
export function validarReporte(r: ReglasReporte): string | null {
  const conObjetivo = Boolean(r.targetType);
  if (conObjetivo !== Boolean(r.targetId)) {
    return 'targetType y targetId van juntos';
  }
  if (!conObjetivo && r.reasons.some((m) => m !== 'bug' && m !== 'other')) {
    return 'Sin ejercicio solo valen «Algo no funciona» y «Otra cosa»';
  }
  if (r.reasons.includes('answer') && !r.answer?.trim()) {
    return '«Mi respuesta debería estar bien» necesita la respuesta';
  }
  if (r.reasons.includes('other') && !r.comment?.trim()) {
    return '«Otra cosa» necesita un comentario';
  }
  if (JSON.stringify(r.snapshot ?? {}).length > REPORT_JSON_MAX) {
    return 'La foto del ejercicio es demasiado grande';
  }
  if (JSON.stringify(r.context ?? {}).length > REPORT_JSON_MAX) {
    return 'El contexto del reporte es demasiado grande';
  }
  return null;
}

export function unirMotivos(
  a: readonly string[],
  b: readonly string[],
): ReportReason[] {
  return REPORT_REASONS.filter((m) => a.includes(m) || b.includes(m));
}

/** Postgres «undefined_table»: la migración de reportes aún no se aplicó. */
export function esTablaAusente(err: unknown): boolean {
  if (typeof err !== 'object' || err === null) return false;
  const e = err as { code?: string; driverError?: { code?: string } };
  return e.code === '42P01' || e.driverError?.code === '42P01';
}
```

Run: `npx jest src/modules/reports/reports.logic.spec.ts` → PASS.

- [ ] **Step 4: DTOs y su test**

`src/modules/reports/reports.dto.ts`:

```ts
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';
import {
  REPORT_REASONS,
  REPORT_SURFACES,
  REPORT_TARGET_TYPES,
  type ReportReason,
  type ReportTargetType,
} from './reports.constants';

export class CreateReportDto {
  @IsIn(REPORT_SURFACES as string[])
  surface: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  mode?: string;

  @IsOptional()
  @IsIn(REPORT_TARGET_TYPES as unknown as string[])
  targetType?: ReportTargetType;

  /** String siempre: sentences.id es bigint. Negativo solo para false_friend. */
  @IsOptional()
  @Matches(/^-?\d{1,18}$/)
  targetId?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(REPORT_REASONS.length)
  @ArrayUnique()
  @IsIn(REPORT_REASONS as unknown as string[], { each: true })
  reasons: ReportReason[];

  @IsOptional()
  @IsString()
  @MaxLength(500)
  comment?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  answer?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  expected?: string;

  @IsOptional()
  @IsBoolean()
  wasWrong?: boolean;

  @IsObject()
  snapshot: Record<string, unknown>;

  @IsObject()
  context: Record<string, unknown>;
}

export class MarkNoticesSeenDto {
  @IsArray()
  @ArrayMaxSize(100)
  @IsInt({ each: true })
  ids: number[];
}

export type ReportNoticeDto = {
  id: number;
  outcome: 'fixed' | 'dismissed';
  note: string | null;
  gems: number;
  prompt: string | null;
  resolvedAt: string;
};
```

`src/modules/reports/reports.dto.spec.ts` (mismo patrón que `admin-path-node.dto.spec.ts`; ábrelo para copiar sus imports):

```ts
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { CreateReportDto, MarkNoticesSeenDto } from './reports.dto';

const ok = {
  surface: 'practice',
  mode: 'complete',
  targetType: 'sentence',
  targetId: '1234567890123',
  reasons: ['typo', 'answer'],
  answer: 'feel',
  snapshot: { prompt: 'I __ happy.' },
  context: { levelId: '5' },
};
const errores = (cls: new () => object, o: object) =>
  validateSync(plainToInstance(cls, o)).map((e) => e.property);

describe('CreateReportDto', () => {
  it('acepta un reporte de práctica y uno de juego', () => {
    expect(errores(CreateReportDto, ok)).toEqual([]);
    expect(errores(CreateReportDto, { ...ok, surface: 'game:dotaxi' })).toEqual([]);
  });
  it('rechaza superficie, motivo o tipo desconocidos', () => {
    expect(errores(CreateReportDto, { ...ok, surface: 'shop' })).toContain('surface');
    expect(errores(CreateReportDto, { ...ok, reasons: ['spam'] })).toContain('reasons');
    expect(errores(CreateReportDto, { ...ok, targetType: 'users' })).toContain('targetType');
  });
  it('rechaza motivos vacíos o repetidos y un id no numérico', () => {
    expect(errores(CreateReportDto, { ...ok, reasons: [] })).toContain('reasons');
    expect(errores(CreateReportDto, { ...ok, reasons: ['typo', 'typo'] })).toContain('reasons');
    expect(errores(CreateReportDto, { ...ok, targetId: '12; DROP' })).toContain('targetId');
  });
  it('rechaza comentarios de más de 500', () => {
    expect(errores(CreateReportDto, { ...ok, comment: 'x'.repeat(501) })).toContain('comment');
  });
});

describe('MarkNoticesSeenDto', () => {
  it('exige enteros', () => {
    expect(errores(MarkNoticesSeenDto, { ids: [1, 2] })).toEqual([]);
    expect(errores(MarkNoticesSeenDto, { ids: ['x'] })).toContain('ids');
  });
});
```

Run: `npx jest src/modules/reports/reports.dto.spec.ts` → PASS.

- [ ] **Step 5: Tests del servicio (fallan)**

`src/modules/reports/reports.service.spec.ts`:

```ts
import { HttpException, ServiceUnavailableException } from '@nestjs/common';
import { ReportsService } from './reports.service';
import type { CreateReportDto } from './reports.dto';

type Call = [string, unknown[]];

/** DataSource falso: responde según un fragmento del SQL. Nunca toca la BD. */
function makeService(answers: Array<[string, unknown]>) {
  const query = jest.fn(async (sql: string) => {
    for (const [fragment, value] of answers) {
      if (sql.includes(fragment)) {
        if (value instanceof Error) throw value;
        return value;
      }
    }
    throw new Error(`unexpected SQL: ${sql}`);
  });
  const service = new ReportsService({ query } as never);
  return { service, calls: () => query.mock.calls as Call[] };
}

const dto = (over: Partial<CreateReportDto> = {}): CreateReportDto => ({
  surface: 'practice',
  mode: 'complete',
  targetType: 'sentence',
  targetId: '12',
  reasons: ['answer'],
  answer: 'feel',
  expected: 'am',
  wasWrong: true,
  snapshot: { prompt: 'I __ happy.' },
  context: { levelId: '5' },
  ...over,
});

describe('ReportsService.create', () => {
  it('crea un reporte nuevo con SQL parametrizado', async () => {
    const { service, calls } = makeService([
      ['SELECT id, reasons FROM dots.content_reports', []],
      ['count(*)::int', [{ n: 0 }]],
      ['INSERT INTO dots.content_reports', [{ id: 77 }]],
    ]);
    await expect(service.create(9, dto())).resolves.toEqual({ id: 77, merged: false });
    const insert = calls().find(([sql]) => sql.includes('INSERT INTO'));
    expect(insert?.[1].slice(0, 6)).toEqual([9, 'practice', 'complete', 'sentence', '12', ['answer']]);
  });

  it('fusiona con el pendiente del mismo alumno y ejercicio', async () => {
    const { service, calls } = makeService([
      ['SELECT id, reasons FROM dots.content_reports', [{ id: 5, reasons: ['typo'] }]],
      ['UPDATE dots.content_reports', [[], 1]],
    ]);
    await expect(service.create(9, dto())).resolves.toEqual({ id: 5, merged: true });
    const update = calls().find(([sql]) => sql.includes('UPDATE'));
    expect(update?.[1][0]).toBe(5);
    expect(update?.[1][1]).toEqual(['answer', 'typo']);
    expect(calls().some(([sql]) => sql.includes('INSERT'))).toBe(false);
  });

  it('un bug sin ejercicio nunca se fusiona', async () => {
    const { service, calls } = makeService([
      ['count(*)::int', [{ n: 0 }]],
      ['INSERT INTO dots.content_reports', [{ id: 8 }]],
    ]);
    await service.create(
      9,
      dto({ targetType: undefined, targetId: undefined, reasons: ['bug'], answer: undefined }),
    );
    expect(calls().some(([sql]) => sql.includes('SELECT id, reasons'))).toBe(false);
  });

  it('corta con 429 al llegar a 30 en 24 h', async () => {
    const { service } = makeService([
      ['SELECT id, reasons FROM dots.content_reports', []],
      ['count(*)::int', [{ n: 30 }]],
    ]);
    await expect(service.create(9, dto())).rejects.toMatchObject({ status: 429 });
    await expect(service.create(9, dto())).rejects.toBeInstanceOf(HttpException);
  });

  it('rechaza con 400 lo que no cumple las reglas, sin consultar', async () => {
    const { service, calls } = makeService([]);
    await expect(service.create(9, dto({ answer: undefined }))).rejects.toMatchObject({ status: 400 });
    expect(calls()).toHaveLength(0);
  });

  it('responde 503 si la tabla no existe', async () => {
    const missing = Object.assign(new Error('relation does not exist'), { code: '42P01' });
    const { service } = makeService([['SELECT id, reasons', missing]]);
    await expect(service.create(9, dto())).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
});

describe('ReportsService.notices / markSeen', () => {
  it('devuelve solo lo resuelto y no visto del alumno', async () => {
    const { service, calls } = makeService([
      [
        'notice_seen_at IS NULL',
        [
          {
            id: 3,
            status: 'fixed',
            resolution_note: 'Ahora «feel» también vale',
            gems_awarded: 10,
            prompt: 'I __ happy.',
            resolved_at: new Date('2026-10-01T10:00:00Z'),
          },
        ],
      ],
    ]);
    await expect(service.notices(9)).resolves.toEqual([
      {
        id: 3,
        outcome: 'fixed',
        note: 'Ahora «feel» también vale',
        gems: 10,
        prompt: 'I __ happy.',
        resolvedAt: '2026-10-01T10:00:00.000Z',
      },
    ]);
    expect(calls()[0][1]).toEqual([9]);
  });

  it('sin tabla, los avisos son una lista vacía', async () => {
    const missing = Object.assign(new Error('x'), { code: '42P01' });
    const { service } = makeService([['notice_seen_at IS NULL', missing]]);
    await expect(service.notices(9)).resolves.toEqual([]);
  });

  it('marcar vistos filtra por el propio alumno', async () => {
    const { service, calls } = makeService([['SET notice_seen_at', [[], 2]]]);
    await expect(service.markSeen(9, [3, 4])).resolves.toEqual({ updated: 2 });
    expect(calls()[0][1]).toEqual([9, [3, 4]]);
    await expect(service.markSeen(9, [])).resolves.toEqual({ updated: 0 });
  });
});
```

Run: `npx jest src/modules/reports/reports.service.spec.ts`
Expected: FAIL — `Cannot find module './reports.service'`.

- [ ] **Step 6: Implementar `reports.service.ts`**

```ts
import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { REPORT_DAILY_LIMIT } from './reports.constants';
import type { CreateReportDto, ReportNoticeDto } from './reports.dto';
import { esTablaAusente, unirMotivos, validarReporte } from './reports.logic';

/**
 * Reportes de ejercicios del alumno (spec 2026-10-01 §3.2). SQL crudo sobre
 * dots.content_reports, sin entity: si la migración no está aplicada, el 42P01
 * se traduce aquí y el resto de la app ni se entera.
 */
@Injectable()
export class ReportsService {
  constructor(private readonly dataSource: DataSource) {}

  async create(
    userId: number,
    dto: CreateReportDto,
  ): Promise<{ id: number; merged: boolean }> {
    const error = validarReporte(dto);
    if (error) throw new BadRequestException(error);

    const reasons = unirMotivos(dto.reasons, []);
    const comment = dto.comment?.trim() || null;
    const snapshot = JSON.stringify(dto.snapshot ?? {});
    const context = JSON.stringify(dto.context ?? {});

    try {
      if (dto.targetType && dto.targetId) {
        const previos = (await this.dataSource.query(
          `SELECT id, reasons FROM dots.content_reports
            WHERE user_id = $1 AND target_type = $2 AND target_id = $3
              AND status = 'pending'
            ORDER BY id DESC
            LIMIT 1`,
          [userId, dto.targetType, dto.targetId],
        )) as Array<{ id: number; reasons: string[] }>;
        if (previos.length > 0) {
          const previo = previos[0];
          await this.dataSource.query(
            `UPDATE dots.content_reports
                SET reasons = $2, comment = COALESCE($3, comment), answer = $4,
                    expected = $5, was_wrong = $6, snapshot = $7, context = $8,
                    surface = $9, mode = $10, updated_at = CURRENT_TIMESTAMP
              WHERE id = $1`,
            [
              previo.id,
              unirMotivos(previo.reasons ?? [], reasons),
              comment,
              dto.answer ?? null,
              dto.expected ?? null,
              dto.wasWrong ?? null,
              snapshot,
              context,
              dto.surface,
              dto.mode ?? null,
            ],
          );
          return { id: previo.id, merged: true };
        }
      }

      const [{ n }] = (await this.dataSource.query(
        `SELECT count(*)::int AS n FROM dots.content_reports
          WHERE user_id = $1 AND created_at > CURRENT_TIMESTAMP - interval '24 hours'`,
        [userId],
      )) as Array<{ n: number }>;
      if (n >= REPORT_DAILY_LIMIT) {
        throw new HttpException(
          'Ya mandaste muchos reportes hoy',
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }

      const insertados = (await this.dataSource.query(
        `INSERT INTO dots.content_reports
           (user_id, surface, mode, target_type, target_id, reasons, comment,
            answer, expected, was_wrong, snapshot, context)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
         RETURNING id`,
        [
          userId,
          dto.surface,
          dto.mode ?? null,
          dto.targetType ?? null,
          dto.targetId ?? null,
          reasons,
          comment,
          dto.answer ?? null,
          dto.expected ?? null,
          dto.wasWrong ?? null,
          snapshot,
          context,
        ],
      )) as Array<{ id: number }>;
      return { id: insertados[0].id, merged: false };
    } catch (err) {
      if (esTablaAusente(err)) {
        throw new ServiceUnavailableException(
          'Los reportes aún no están disponibles',
        );
      }
      throw err;
    }
  }

  async notices(userId: number): Promise<ReportNoticeDto[]> {
    try {
      const rows = (await this.dataSource.query(
        `SELECT id, status, resolution_note, gems_awarded,
                snapshot->>'prompt' AS prompt, resolved_at
           FROM dots.content_reports
          WHERE user_id = $1 AND resolved_at IS NOT NULL
            AND notice_seen_at IS NULL AND status IN ('fixed', 'dismissed')
          ORDER BY resolved_at DESC
          LIMIT 20`,
        [userId],
      )) as Array<{
        id: number;
        status: 'fixed' | 'dismissed';
        resolution_note: string | null;
        gems_awarded: number | null;
        prompt: string | null;
        resolved_at: Date | string;
      }>;
      return rows.map((r) => ({
        id: r.id,
        outcome: r.status,
        note: r.resolution_note ?? null,
        gems: r.gems_awarded ?? 0,
        prompt: r.prompt ?? null,
        resolvedAt: new Date(r.resolved_at).toISOString(),
      }));
    } catch (err) {
      if (esTablaAusente(err)) return [];
      throw err;
    }
  }

  async markSeen(userId: number, ids: number[]): Promise<{ updated: number }> {
    if (ids.length === 0) return { updated: 0 };
    try {
      const [, updated] = (await this.dataSource.query(
        `UPDATE dots.content_reports SET notice_seen_at = CURRENT_TIMESTAMP
          WHERE user_id = $1 AND id = ANY($2::int[]) AND notice_seen_at IS NULL`,
        [userId, ids],
      )) as [unknown[], number];
      return { updated };
    } catch (err) {
      if (esTablaAusente(err)) return { updated: 0 };
      throw err;
    }
  }
}
```

Run: `npx jest src/modules/reports` → PASS.

- [ ] **Step 7: Controller, módulo y registro**

`src/modules/reports/reports.controller.ts`:

```ts
import { Body, Controller, Get, HttpCode, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import {
  CurrentUser,
  type AuthUser,
} from '../../common/decorators/current-user.decorator';
import { CreateReportDto, MarkNoticesSeenDto } from './reports.dto';
import { ReportsService } from './reports.service';

/** Reportes del alumno. El autor sale del token, nunca del body. */
@Controller()
@UseGuards(JwtAuthGuard)
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Post('reports')
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateReportDto) {
    return this.reportsService.create(user.id, dto);
  }

  @Get('me/report-notices')
  async notices(@CurrentUser() user: AuthUser) {
    return { notices: await this.reportsService.notices(user.id) };
  }

  @Post('me/report-notices/seen')
  @HttpCode(200)
  seen(@CurrentUser() user: AuthUser, @Body() dto: MarkNoticesSeenDto) {
    return this.reportsService.markSeen(user.id, dto.ids);
  }
}
```

`src/modules/reports/reports.module.ts`:

```ts
import { Module } from '@nestjs/common';
import { JwtStrategy } from '../auth/jwt.strategy';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';

@Module({
  controllers: [ReportsController],
  providers: [ReportsService, JwtStrategy],
})
export class ReportsModule {}
```

En `src/app.module.ts`, importa `ReportsModule` de `'./modules/reports/reports.module'` y añádelo al final del array `imports`.

- [ ] **Step 8: Tests, build, lint y commit**

```bash
npx jest src/modules/reports && npm run build
npx eslint src/modules/reports src/app.module.ts
git add src/modules/reports src/app.module.ts
git commit -m "feat(reportes): POST /reports con fusión y tope diario, y avisos de vuelta para el alumno

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task A7: Admin — bandeja, cierre con gemas y alternativas

**Files:**
- Modify: `src/common/gems.ts` (constante)
- Modify: `src/modules/admin/admin.service.ts` (método público `getReportContent`)
- Create: `src/modules/admin/admin-reports.logic.ts`, `src/modules/admin/admin-reports.logic.spec.ts`
- Create: `src/modules/admin/admin-reports.dto.ts`
- Create: `src/modules/admin/admin-reports.service.ts`, `src/modules/admin/admin-reports.service.spec.ts`
- Create: `src/modules/admin/admin-reports.controller.ts`
- Modify: `src/modules/admin/admin.module.ts` (controller + provider)
- Modify: `src/modules/admin/admin-me.reset.ts` (comentario sobre `KEPT_TABLES`)

**Interfaces:**
- Consumes: `REPORT_TARGET_TYPES`, `esTablaAusente` (A6); `awardGems` (`src/common/gems.ts`).
- Produces (los consume B15):
  - `GET /admin/reports/summary` → `{ content: number; bugs: number }`
  - `GET /admin/reports/groups?status=pending|closed` → `AdminReportGroup[]` = `{ type, id, prompt, surface, where: string | null, reasons: Record<string, number>, students, reports, lastAt }`
  - `GET /admin/reports/groups/:type/:id` → `{ type, id, prompt, where, content: { content: object; parentId: number | null; parentLabel: string | null } | null, alternatives: AdminAlternative[], answers: Array<{ answer, kind: 'word' | 'sentence', count, reportIds }>, reports: AdminReport[] }`
  - `GET /admin/reports/bugs?status=pending|closed` → `Array<AdminReport & { where: string | null }>`
  - `POST /admin/reports/resolve` `{ ids, outcome, note? }` → `{ resolved: number; gems: number }` (200)
  - `GET /admin/answer-alternatives?targetType=&targetId=` → `AdminAlternative[]`; `POST /admin/answer-alternatives` → `AdminAlternative`; `DELETE /admin/answer-alternatives/:id` → `{ deleted: boolean }`
  - `AdminReport` = `{ id, userId, userName, isAdmin, surface, mode, targetType, targetId, reasons, comment, answer, expected, wasWrong, snapshot, context, status, note, gems, createdAt, resolvedAt }`; `AdminAlternative` = `{ id, targetType, targetId, kind, value, createdAt }`.

- [ ] **Step 1: Constante de gemas**

En `src/common/gems.ts`, debajo de `GEMS_PER_CHECKPOINT`:

```ts
/** Reporte que el admin cierra como arreglado (spec reportes §3.4). Nunca a perfil 1. */
export const GEMS_PER_ACCEPTED_REPORT = 10;
```

- [ ] **Step 2: Tests de la lógica pura (fallan)**

`src/modules/admin/admin-reports.logic.spec.ts`:

```ts
import {
  aReporteAdmin,
  agruparReportes,
  esBug,
  esDeContenido,
  respuestasDistintas,
  tipoDeRespuesta,
  type FilaReporte,
} from './admin-reports.logic';

let nextId = 1;
const fila = (over: Partial<FilaReporte> = {}): FilaReporte => ({
  id: nextId++,
  user_id: 9,
  user_name: 'Camila',
  username: 'cami',
  profile: 0,
  surface: 'practice',
  mode: 'complete',
  target_type: 'sentence',
  target_id: '12',
  reasons: ['answer'],
  comment: null,
  answer: 'feel',
  expected: 'am',
  was_wrong: true,
  snapshot: { prompt: 'I __ happy.' },
  context: {},
  status: 'pending',
  resolution_note: null,
  gems_awarded: 0,
  created_at: '2026-10-01T10:00:00.000Z',
  resolved_at: null,
  ...over,
});

describe('clasificación', () => {
  it('contenido = con objetivo y algún motivo que no sea bug; bug = sin objetivo o con bug', () => {
    expect(esDeContenido(fila())).toBe(true);
    expect(esDeContenido(fila({ reasons: ['bug'] }))).toBe(false);
    expect(esBug(fila({ reasons: ['bug', 'typo'] }))).toBe(true);
    expect(esBug(fila({ target_type: null, target_id: null, reasons: ['other'] }))).toBe(true);
  });
  it('la respuesta es una oración en «Arma la oración» y en el Constructor', () => {
    expect(tipoDeRespuesta(fila({ mode: 'buildUp' }))).toBe('sentence');
    expect(tipoDeRespuesta(fila({ surface: 'game:sentence-builder', mode: 'order' }))).toBe('sentence');
    expect(tipoDeRespuesta(fila())).toBe('word');
  });
});

describe('agruparReportes', () => {
  it('agrupa por ejercicio, cuenta motivos y alumnos y ordena por alumnos', () => {
    const grupos = agruparReportes([
      fila({ user_id: 1, created_at: '2026-10-01T12:00:00.000Z', snapshot: { prompt: 'nuevo' } }),
      fila({ user_id: 2, reasons: ['answer', 'typo'] }),
      fila({ user_id: 1, target_id: '30', reasons: ['typo'] }),
    ]);
    expect(grupos.map((g) => `${g.type}:${g.id}`)).toEqual(['sentence:12', 'sentence:30']);
    expect(grupos[0]).toMatchObject({
      prompt: 'nuevo',
      students: 2,
      reports: 2,
      reasons: { answer: 2, typo: 1 },
      lastAt: '2026-10-01T12:00:00.000Z',
    });
  });
});

describe('respuestasDistintas', () => {
  it('junta las respuestas iguales sin mirar mayúsculas y las ordena por frecuencia', () => {
    const r = respuestasDistintas([
      fila({ id: 101, answer: 'feel' }),
      fila({ id: 102, answer: 'Feel ' }),
      fila({ id: 103, answer: 'was' }),
      fila({ id: 104, answer: null }),
      fila({ id: 105, answer: 'is', was_wrong: false }),
    ]);
    expect(r).toEqual([
      { answer: 'feel', kind: 'word', count: 2, reportIds: [101, 102] },
      { answer: 'was', kind: 'word', count: 1, reportIds: [103] },
    ]);
  });
});

describe('aReporteAdmin', () => {
  it('pasa a camelCase, marca al admin y da nombre aunque falte', () => {
    expect(aReporteAdmin(fila({ id: 7, profile: 1, user_name: null }))).toMatchObject({
      id: 7,
      userName: 'cami',
      isAdmin: true,
      targetId: '12',
      createdAt: '2026-10-01T10:00:00.000Z',
    });
  });
});
```

Run: `npx jest src/modules/admin/admin-reports.logic.spec.ts` → FAIL (módulo inexistente).

- [ ] **Step 3: Implementar `admin-reports.logic.ts`**

```ts
/**
 * Vista del admin sobre los reportes (spec 2026-10-01 §2): agrupar, contar y
 * proyectar filas de dots.content_reports. Puro: lo prueba jest sin BD.
 */

export type FilaReporte = {
  id: number;
  user_id: number;
  user_name: string | null;
  username: string | null;
  profile: number | null;
  surface: string;
  mode: string | null;
  target_type: string | null;
  target_id: string | null;
  reasons: string[];
  comment: string | null;
  answer: string | null;
  expected: string | null;
  was_wrong: boolean | null;
  snapshot: Record<string, unknown> | null;
  context: Record<string, unknown> | null;
  status: string;
  resolution_note: string | null;
  gems_awarded: number | null;
  created_at: Date | string;
  resolved_at: Date | string | null;
};

export type AdminReport = {
  id: number;
  userId: number;
  userName: string;
  isAdmin: boolean;
  surface: string;
  mode: string | null;
  targetType: string | null;
  targetId: string | null;
  reasons: string[];
  comment: string | null;
  answer: string | null;
  expected: string | null;
  wasWrong: boolean | null;
  snapshot: Record<string, unknown>;
  context: Record<string, unknown>;
  status: string;
  note: string | null;
  gems: number;
  createdAt: string;
  resolvedAt: string | null;
};

export type AdminReportGroup = {
  type: string;
  id: string;
  prompt: string;
  surface: string;
  where: string | null;
  reasons: Record<string, number>;
  students: number;
  reports: number;
  lastAt: string;
};

export type RespuestaDistinta = {
  answer: string;
  kind: 'word' | 'sentence';
  count: number;
  reportIds: number[];
};

const iso = (d: Date | string): string => new Date(d).toISOString();
const promptDe = (f: Pick<FilaReporte, 'snapshot'>): string =>
  typeof f.snapshot?.prompt === 'string' ? f.snapshot.prompt : '';

export function esDeContenido(f: Pick<FilaReporte, 'target_type' | 'reasons'>): boolean {
  return f.target_type !== null && f.reasons.some((m) => m !== 'bug');
}

export function esBug(f: Pick<FilaReporte, 'target_type' | 'reasons'>): boolean {
  return f.target_type === null || f.reasons.includes('bug');
}

export function tipoDeRespuesta(
  f: Pick<FilaReporte, 'mode' | 'surface'>,
): 'word' | 'sentence' {
  return f.mode === 'buildUp' || f.surface === 'game:sentence-builder'
    ? 'sentence'
    : 'word';
}

export function aReporteAdmin(f: FilaReporte): AdminReport {
  return {
    id: f.id,
    userId: f.user_id,
    userName: f.user_name || f.username || `Alumno ${f.user_id}`,
    isAdmin: f.profile === 1,
    surface: f.surface,
    mode: f.mode,
    targetType: f.target_type,
    targetId: f.target_id,
    reasons: f.reasons,
    comment: f.comment,
    answer: f.answer,
    expected: f.expected,
    wasWrong: f.was_wrong,
    snapshot: f.snapshot ?? {},
    context: f.context ?? {},
    status: f.status,
    note: f.resolution_note,
    gems: f.gems_awarded ?? 0,
    createdAt: iso(f.created_at),
    resolvedAt: f.resolved_at ? iso(f.resolved_at) : null,
  };
}

/** Filas en orden de más nueva a más vieja → grupos por ejercicio, el más reportado primero. */
export function agruparReportes(filas: readonly FilaReporte[]): AdminReportGroup[] {
  const grupos = new Map<string, AdminReportGroup & { alumnos: Set<number> }>();
  for (const f of filas) {
    if (f.target_type === null || f.target_id === null) continue;
    const clave = `${f.target_type}:${f.target_id}`;
    let g = grupos.get(clave);
    if (!g) {
      g = {
        type: f.target_type,
        id: f.target_id,
        prompt: promptDe(f),
        surface: f.surface,
        where: null,
        reasons: {},
        students: 0,
        reports: 0,
        lastAt: iso(f.created_at),
        alumnos: new Set<number>(),
      };
      grupos.set(clave, g);
    }
    g.reports += 1;
    g.alumnos.add(f.user_id);
    for (const m of f.reasons) g.reasons[m] = (g.reasons[m] ?? 0) + 1;
    if (iso(f.created_at) > g.lastAt) {
      g.lastAt = iso(f.created_at);
      g.prompt = promptDe(f);
      g.surface = f.surface;
    }
  }
  return [...grupos.values()]
    .map(({ alumnos, ...g }) => ({ ...g, students: alumnos.size }))
    .sort((a, b) => b.students - a.students || b.lastAt.localeCompare(a.lastAt));
}

/** Respuestas de los alumnos que fallaron, juntas por texto: lo que se puede «Aceptar». */
export function respuestasDistintas(filas: readonly FilaReporte[]): RespuestaDistinta[] {
  const mapa = new Map<string, RespuestaDistinta>();
  for (const f of filas) {
    const texto = f.answer?.trim();
    if (!texto || f.was_wrong !== true) continue;
    const kind = tipoDeRespuesta(f);
    const clave = `${kind}:${texto.replace(/\s+/g, ' ').toUpperCase()}`;
    const r = mapa.get(clave) ?? { answer: texto, kind, count: 0, reportIds: [] };
    r.count += 1;
    r.reportIds.push(f.id);
    mapa.set(clave, r);
  }
  return [...mapa.values()].sort((a, b) => b.count - a.count);
}
```

Run: `npx jest src/modules/admin/admin-reports.logic.spec.ts` → PASS.

- [ ] **Step 4: `AdminService.getReportContent`**

En `src/modules/admin/admin.service.ts` añade al final de la clase (antes del cierre), un método público que reutiliza los serializers privados. Verifica antes los nombres reales de los repositorios con `sed -n 60,100p src/modules/admin/admin.service.ts`:

```ts
  // ── Reportes (spec 2026-10-01 §2.5) ──────────────────────────────

  /**
   * El contenido reportado tal como está AHORA, en la misma forma que ya
   * consumen los modales de admin, más el padre que pide cada modal. `null` si
   * ya no existe (se borró después del reporte).
   */
  async getReportContent(
    type: string,
    id: string,
  ): Promise<{
    content: Record<string, unknown>;
    parentId: number | null;
    parentLabel: string | null;
  } | null> {
    const n = Number(id);
    switch (type) {
      case 'sentence': {
        const s = await this.sentencesRepository.findOne({ where: { id } });
        if (!s) return null;
        const level = s.levelId
          ? await this.levelsRepository.findOne({ where: { id: s.levelId } })
          : null;
        return {
          content: this.serializeSentence(s, await this.charactersById()),
          parentId: s.levelId ?? null,
          parentLabel: level?.name ?? null,
        };
      }
      case 'word': {
        const w = await this.wordsRepository.findOne({ where: { id: n } });
        if (!w) return null;
        const levelId = w.levelId ? Number(w.levelId) : null;
        const level = levelId
          ? await this.levelsRepository.findOne({ where: { id: levelId } })
          : null;
        return { content: this.serializeWord(w), parentId: levelId, parentLabel: level?.name ?? null };
      }
      case 'vocab_item': {
        const i = await this.vocabItemRepository.findOne({ where: { id: n } });
        if (!i) return null;
        const p = await this.vocabPackRepository.findOne({ where: { id: i.packId } });
        return { content: this.serializeVocabItem(i), parentId: i.packId, parentLabel: p?.title ?? null };
      }
      case 'grammar_item': {
        const i = await this.grammarItemRepository.findOne({ where: { id: n } });
        if (!i) return null;
        const p = await this.grammarPillRepository.findOne({ where: { id: i.pillId } });
        return { content: this.serializeGrammarItem(i), parentId: i.pillId, parentLabel: p?.title ?? null };
      }
      case 'grammar_pill': {
        const p = await this.grammarPillRepository.findOne({ where: { id: n } });
        return p ? { content: this.serializeGrammarPill(p), parentId: null, parentLabel: null } : null;
      }
      case 'pronunciation_item': {
        const i = await this.pronunciationItemRepository.findOne({ where: { id: n } });
        if (!i) return null;
        const u = await this.pronunciationUnitRepository.findOne({ where: { id: i.unitId } });
        return { content: this.serializePronunciationItem(i), parentId: i.unitId, parentLabel: u?.title ?? null };
      }
      case 'pronunciation_unit': {
        const u = await this.pronunciationUnitRepository.findOne({ where: { id: n } });
        return u ? { content: this.serializePronunciationUnit(u), parentId: null, parentLabel: null } : null;
      }
      case 'letter_item': {
        const i = await this.letterItemRepository.findOne({ where: { id: n } });
        if (!i) return null;
        const p = await this.letterPackRepository.findOne({ where: { id: i.packId } });
        return { content: this.serializeLetterItem(i), parentId: i.packId, parentLabel: p?.title ?? null };
      }
      case 'number_item': {
        const i = await this.numberItemRepository.findOne({ where: { id: n } });
        if (!i) return null;
        const p = await this.numberPackRepository.findOne({ where: { id: i.packId } });
        return { content: this.serializeNumberItem(i), parentId: i.packId, parentLabel: p?.title ?? null };
      }
      case 'reading': {
        const r = await this.readingsRepository.findOne({ where: { id: n } });
        return r ? { content: this.serializeReading(r), parentId: null, parentLabel: null } : null;
      }
      default:
        return null;
    }
  }
```

Si algún serializer recibe otra forma (p. ej. `serializeWord` tipa su parámetro a mano), pásale la entity igual que hacen sus llamadas existentes en el mismo archivo. Si `levelId` de `Words` es string, el `Number(...)` de arriba ya lo cubre.

- [ ] **Step 5: DTOs del admin**

`src/modules/admin/admin-reports.dto.ts`:

```ts
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import type { AlternativeKind, AlternativeTarget } from 'src/common/answer-alternatives';

export class ResolveReportsDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(200)
  @IsInt({ each: true })
  ids: number[];

  @IsIn(['fixed', 'dismissed'])
  outcome: 'fixed' | 'dismissed';

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

export class CreateAlternativeDto {
  @IsIn(['sentence', 'grammar_item'])
  targetType: AlternativeTarget;

  @Matches(/^\d{1,18}$/)
  targetId: string;

  @IsIn(['word', 'sentence'])
  kind: AlternativeKind;

  @IsString()
  @MinLength(1)
  @MaxLength(300)
  value: string;

  @IsOptional()
  @IsInt()
  sourceReportId?: number;
}
```

- [ ] **Step 6: Tests del servicio (fallan)**

`src/modules/admin/admin-reports.service.spec.ts`:

```ts
import { AdminReportsService } from './admin-reports.service';

type Call = [string, unknown[]];

/**
 * DataSource falso: `query` fuera de transacción, `em.query` dentro. Las
 * respuestas se eligen por fragmento de SQL. Nunca toca la BD.
 */
function makeService(answers: Array<[string, unknown]>) {
  const responder = async (sql: string) => {
    for (const [fragment, value] of answers) {
      if (sql.includes(fragment)) {
        if (value instanceof Error) throw value;
        return value;
      }
    }
    throw new Error(`unexpected SQL: ${sql}`);
  };
  const em = { query: jest.fn(responder) };
  const dataSource = {
    query: jest.fn(responder),
    transaction: jest.fn(async (fn: (e: typeof em) => Promise<unknown>) => fn(em)),
  };
  const adminService = { getReportContent: jest.fn().mockResolvedValue(null) };
  const service = new AdminReportsService(dataSource as never, adminService as never);
  return { service, em, dataSource, adminService };
}

const calls = (q: jest.Mock) => q.mock.calls as Call[];

describe('AdminReportsService.resolve', () => {
  it('cierra solo los pendientes y paga 10 gemas a cada alumno, nunca a un admin', async () => {
    const { service, em } = makeService([
      [
        'SET status',
        [
          [
            { id: 1, user_id: 9, profile: 0 },
            { id: 2, user_id: 14, profile: 1 },
          ],
          2,
        ],
      ],
      ['UPDATE dots.users SET gems', [[], 1]],
      ['INSERT INTO dots.gem_ledger', []],
      ['SET gems_awarded', [[], 1]],
    ]);
    await expect(
      service.resolve(14, { ids: [1, 2, 3], outcome: 'fixed', note: 'Ahora vale' }),
    ).resolves.toEqual({ resolved: 2, gems: 10 });
    const ledger = calls(em.query).filter(([sql]) => sql.includes('gem_ledger'));
    expect(ledger).toHaveLength(1);
    expect(ledger[0][1]).toEqual([9, 10, 'report_accepted', '1']);
    const status = calls(em.query).find(([sql]) => sql.includes('SET status'));
    expect(status?.[0]).toContain("status = 'pending'");
    expect(status?.[1]).toEqual([[1, 2, 3], 'fixed', 'Ahora vale', 14]);
  });

  it('descartar no paga', async () => {
    const { service, em } = makeService([['SET status', [[{ id: 1, user_id: 9, profile: 0 }], 1]]]);
    await expect(service.resolve(14, { ids: [1], outcome: 'dismissed' })).resolves.toEqual({
      resolved: 1,
      gems: 0,
    });
    expect(calls(em.query).some(([sql]) => sql.includes('gem_ledger'))).toBe(false);
  });

  it('una segunda llamada no devuelve filas y no vuelve a pagar', async () => {
    const { service, em } = makeService([['SET status', [[], 0]]]);
    await expect(service.resolve(14, { ids: [1], outcome: 'fixed' })).resolves.toEqual({
      resolved: 0,
      gems: 0,
    });
    expect(calls(em.query)).toHaveLength(1);
  });
});

describe('AdminReportsService.summary', () => {
  it('sin tabla, cuenta cero en vez de romper', async () => {
    const missing = Object.assign(new Error('x'), { code: '42P01' });
    const { service } = makeService([['count(*)', missing]]);
    await expect(service.summary()).resolves.toEqual({ content: 0, bugs: 0 });
  });
});

describe('AdminReportsService.createAlternative', () => {
  it('inserta normalizando espacios y, si ya existía, devuelve la existente', async () => {
    const existing = {
      id: 4,
      target_type: 'sentence',
      target_id: '12',
      kind: 'sentence',
      value: 'Today I am happy',
      created_at: '2026-10-01T10:00:00.000Z',
    };
    const { service, dataSource } = makeService([
      ['INSERT INTO dots.answer_alternatives', []],
      ['FROM dots.answer_alternatives', [existing]],
    ]);
    await expect(
      service.createAlternative(14, {
        targetType: 'sentence',
        targetId: '12',
        kind: 'sentence',
        value: '  Today   I am happy ',
      }),
    ).resolves.toMatchObject({ id: 4, value: 'Today I am happy' });
    const insert = calls(dataSource.query).find(([sql]) => sql.includes('INSERT'));
    expect(insert?.[1]).toEqual(['sentence', '12', 'sentence', 'Today I am happy', 14, null]);
  });
});
```

Run: `npx jest src/modules/admin/admin-reports.service.spec.ts` → FAIL (módulo inexistente).

- [ ] **Step 7: Implementar `admin-reports.service.ts`**

```ts
import {
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { awardGems, GEMS_PER_ACCEPTED_REPORT } from 'src/common/gems';
import { REPORT_TARGET_TYPES } from '../reports/reports.constants';
import { esTablaAusente } from '../reports/reports.logic';
import { AdminService } from './admin.service';
import type { CreateAlternativeDto, ResolveReportsDto } from './admin-reports.dto';
import {
  aReporteAdmin,
  agruparReportes,
  respuestasDistintas,
  type FilaReporte,
} from './admin-reports.logic';

const COLUMNAS = `r.id, r.user_id, u.name AS user_name, u.username, u.profile,
  r.surface, r.mode, r.target_type, r.target_id::text AS target_id, r.reasons,
  r.comment, r.answer, r.expected, r.was_wrong, r.snapshot, r.context, r.status,
  r.resolution_note, r.gems_awarded, r.created_at, r.resolved_at`;
const DESDE = `FROM dots.content_reports r JOIN dots.users u ON u.id = r.user_id`;
const ES_CONTENIDO = `r.target_type IS NOT NULL
  AND EXISTS (SELECT 1 FROM unnest(r.reasons) m WHERE m <> 'bug')`;
const ES_BUG = `(r.target_type IS NULL OR 'bug' = ANY(r.reasons))`;

/** Dónde vive cada tipo de contenido, en una consulta por tipo. */
const DONDE_SQL: Record<string, string> = {
  sentence: `SELECT s.id::text AS id, l.name AS label FROM dots.sentences s
    LEFT JOIN dots.levels l ON l.id = s.level_id WHERE s.id = ANY($1::bigint[])`,
  word: `SELECT w.id::text AS id, l.name AS label FROM dots.words w
    LEFT JOIN dots.levels l ON l.id::text = w.level_id WHERE w.id = ANY($1::int[])`,
  vocab_item: `SELECT i.id::text AS id, p.title AS label FROM dots.vocab_items i
    LEFT JOIN dots.vocab_packs p ON p.id = i.pack_id WHERE i.id = ANY($1::int[])`,
  grammar_item: `SELECT i.id::text AS id, p.title AS label FROM dots.grammar_items i
    LEFT JOIN dots.grammar_pills p ON p.id = i.pill_id WHERE i.id = ANY($1::int[])`,
  grammar_pill: `SELECT p.id::text AS id, p.title AS label FROM dots.grammar_pills p
    WHERE p.id = ANY($1::int[])`,
  pronunciation_item: `SELECT i.id::text AS id, u.title AS label FROM dots.pronunciation_items i
    LEFT JOIN dots.pronunciation_units u ON u.id = i.unit_id WHERE i.id = ANY($1::int[])`,
  pronunciation_unit: `SELECT u.id::text AS id, u.title AS label FROM dots.pronunciation_units u
    WHERE u.id = ANY($1::int[])`,
  letter_item: `SELECT i.id::text AS id, p.title AS label FROM dots.letter_items i
    LEFT JOIN dots.letter_packs p ON p.id = i.pack_id WHERE i.id = ANY($1::int[])`,
  number_item: `SELECT i.id::text AS id, p.title AS label FROM dots.number_items i
    LEFT JOIN dots.number_packs p ON p.id = i.pack_id WHERE i.id = ANY($1::int[])`,
  reading: `SELECT r.id::text AS id, r.title AS label FROM dots.readings r
    WHERE r.id = ANY($1::int[])`,
};

type FilaAlternativa = {
  id: number;
  target_type: string;
  target_id: string;
  kind: string;
  value: string;
  created_at: Date | string;
};

const aAlternativa = (a: FilaAlternativa) => ({
  id: a.id,
  targetType: a.target_type,
  targetId: String(a.target_id),
  kind: a.kind,
  value: a.value,
  createdAt: new Date(a.created_at).toISOString(),
});

/**
 * La bandeja del admin (spec 2026-10-01 §2 y §3.3). SQL crudo; si la
 * migración no está aplicada, lecturas vacías y escrituras con 503.
 */
@Injectable()
export class AdminReportsService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly adminService: AdminService,
  ) {}

  async summary(): Promise<{ content: number; bugs: number }> {
    try {
      const [row] = (await this.dataSource.query(
        `SELECT
           (SELECT count(*)::int FROM (
              SELECT 1 FROM dots.content_reports r
               WHERE r.status = 'pending' AND ${ES_CONTENIDO}
               GROUP BY r.target_type, r.target_id) g) AS content,
           (SELECT count(*)::int FROM dots.content_reports r
             WHERE r.status = 'pending' AND ${ES_BUG}) AS bugs`,
      )) as Array<{ content: number; bugs: number }>;
      return { content: row?.content ?? 0, bugs: row?.bugs ?? 0 };
    } catch (err) {
      if (esTablaAusente(err)) return { content: 0, bugs: 0 };
      throw err;
    }
  }

  async groups(status: 'pending' | 'closed') {
    const filas = await this.filas(
      `${status === 'pending' ? "r.status = 'pending'" : "r.status <> 'pending'"} AND ${ES_CONTENIDO}`,
      status === 'pending' ? 'r.created_at DESC LIMIT 500' : 'r.resolved_at DESC LIMIT 100',
    );
    const grupos = agruparReportes(filas);
    const donde = await this.dondeViven(grupos);
    return grupos.map((g) => ({ ...g, where: donde.get(`${g.type}:${g.id}`) ?? null }));
  }

  async group(type: string, id: string) {
    if (!(REPORT_TARGET_TYPES as readonly string[]).includes(type) || !/^-?\d{1,18}$/.test(id)) {
      throw new BadRequestException('Ejercicio desconocido');
    }
    const filas = await this.filas(
      `r.target_type = $1 AND r.target_id = $2`,
      `(r.status = 'pending') DESC, r.created_at DESC LIMIT 200`,
      [type, id],
    );
    const content = type === 'false_friend' ? null : await this.adminService.getReportContent(type, id);
    const alternatives =
      type === 'sentence' || type === 'grammar_item'
        ? await this.listAlternatives(type, id)
        : [];
    const donde = await this.dondeViven([{ type, id }]);
    const ultimoPrompt = filas[0]?.snapshot?.prompt;
    return {
      type,
      id,
      prompt: typeof ultimoPrompt === 'string' ? ultimoPrompt : '',
      where: donde.get(`${type}:${id}`) ?? null,
      content,
      alternatives,
      answers: respuestasDistintas(filas.filter((f) => f.status === 'pending')),
      reports: filas.map(aReporteAdmin),
    };
  }

  async bugs(status: 'pending' | 'closed') {
    const filas = await this.filas(
      `${status === 'pending' ? "r.status = 'pending'" : "r.status <> 'pending'"} AND ${ES_BUG}`,
      status === 'pending' ? 'r.created_at DESC LIMIT 200' : 'r.resolved_at DESC LIMIT 100',
    );
    const conObjetivo = filas
      .filter((f) => f.target_type !== null && f.target_id !== null)
      .map((f) => ({ type: f.target_type as string, id: f.target_id as string }));
    const donde = await this.dondeViven(conObjetivo);
    return filas.map((f) => ({
      ...aReporteAdmin(f),
      where: f.target_type ? (donde.get(`${f.target_type}:${f.target_id}`) ?? null) : null,
    }));
  }

  async resolve(adminId: number, dto: ResolveReportsDto): Promise<{ resolved: number; gems: number }> {
    const note = dto.note?.trim() || null;
    try {
      return await this.dataSource.transaction(async (em) => {
        const [rows] = (await em.query(
          `UPDATE dots.content_reports r
              SET status = $2, resolution_note = $3, resolved_by = $4,
                  resolved_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
             FROM dots.users u
            WHERE r.id = ANY($1::int[]) AND r.status = 'pending' AND u.id = r.user_id
        RETURNING r.id, r.user_id, u.profile`,
          [dto.ids, dto.outcome, note, adminId],
        )) as [Array<{ id: number; user_id: number; profile: number | null }>, number];

        let gems = 0;
        if (dto.outcome === 'fixed') {
          for (const row of rows) {
            if (row.profile === 1) continue; // los admins no compiten ni cobran
            await awardGems(em, row.user_id, GEMS_PER_ACCEPTED_REPORT, 'report_accepted', String(row.id));
            await em.query(`UPDATE dots.content_reports SET gems_awarded = $2 WHERE id = $1`, [
              row.id,
              GEMS_PER_ACCEPTED_REPORT,
            ]);
            gems += GEMS_PER_ACCEPTED_REPORT;
          }
        }
        return { resolved: rows.length, gems };
      });
    } catch (err) {
      if (esTablaAusente(err)) throw new ServiceUnavailableException('Los reportes aún no están disponibles');
      throw err;
    }
  }

  async listAlternatives(targetType: string, targetId: string) {
    if (!/^\d{1,18}$/.test(targetId)) throw new BadRequestException('Id inválido');
    try {
      const rows = (await this.dataSource.query(
        `SELECT id, target_type, target_id::text AS target_id, kind, value, created_at
           FROM dots.answer_alternatives
          WHERE target_type = $1 AND target_id = $2
          ORDER BY id ASC`,
        [targetType, targetId],
      )) as FilaAlternativa[];
      return rows.map(aAlternativa);
    } catch (err) {
      if (esTablaAusente(err)) return [];
      throw err;
    }
  }

  async createAlternative(adminId: number, dto: CreateAlternativeDto) {
    const value = dto.value.replace(/\s+/g, ' ').trim();
    if (!value) throw new BadRequestException('La respuesta está vacía');
    try {
      const insertadas = (await this.dataSource.query(
        `INSERT INTO dots.answer_alternatives
           (target_type, target_id, kind, value, created_by, source_report_id)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT DO NOTHING
         RETURNING id, target_type, target_id::text AS target_id, kind, value, created_at`,
        [dto.targetType, dto.targetId, dto.kind, value, adminId, dto.sourceReportId ?? null],
      )) as FilaAlternativa[];
      if (insertadas.length > 0) return aAlternativa(insertadas[0]);
      const [existente] = (await this.dataSource.query(
        `SELECT id, target_type, target_id::text AS target_id, kind, value, created_at
           FROM dots.answer_alternatives
          WHERE target_type = $1 AND target_id = $2 AND kind = $3 AND upper(value) = upper($4)`,
        [dto.targetType, dto.targetId, dto.kind, value],
      )) as FilaAlternativa[];
      return aAlternativa(existente);
    } catch (err) {
      if (esTablaAusente(err)) throw new ServiceUnavailableException('Los reportes aún no están disponibles');
      throw err;
    }
  }

  async deleteAlternative(id: number): Promise<{ deleted: boolean }> {
    try {
      const [, affected] = (await this.dataSource.query(
        `DELETE FROM dots.answer_alternatives WHERE id = $1`,
        [id],
      )) as [unknown[], number];
      return { deleted: affected > 0 };
    } catch (err) {
      if (esTablaAusente(err)) return { deleted: false };
      throw err;
    }
  }

  // ── privados ───────────────────────────────────────────────────

  private async filas(where: string, orden: string, params: unknown[] = []): Promise<FilaReporte[]> {
    try {
      return (await this.dataSource.query(
        `SELECT ${COLUMNAS} ${DESDE} WHERE ${where} ORDER BY ${orden}`,
        params,
      )) as FilaReporte[];
    } catch (err) {
      if (esTablaAusente(err)) return [];
      throw err;
    }
  }

  private async dondeViven(
    objetivos: ReadonlyArray<{ type: string; id: string }>,
  ): Promise<Map<string, string>> {
    const porTipo = new Map<string, Set<string>>();
    for (const o of objetivos) {
      if (!DONDE_SQL[o.type]) continue;
      const ids = porTipo.get(o.type) ?? new Set<string>();
      ids.add(o.id);
      porTipo.set(o.type, ids);
    }
    const donde = new Map<string, string>();
    for (const o of objetivos) {
      if (o.type === 'false_friend') donde.set(`${o.type}:${o.id}`, 'Contenido fijo del código');
    }
    for (const [type, ids] of porTipo) {
      const rows = (await this.dataSource.query(DONDE_SQL[type], [[...ids]])) as Array<{
        id: string;
        label: string | null;
      }>;
      for (const r of rows) if (r.label) donde.set(`${type}:${r.id}`, r.label);
    }
    return donde;
  }
}
```

El `ORDER BY` y el `WHERE` se interpolan solo desde constantes de este archivo, nunca desde la entrada; los valores van como `$n`.

- [ ] **Step 8: Controller y registro**

`src/modules/admin/admin-reports.controller.ts`:

```ts
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  CurrentUser,
  type AuthUser,
} from 'src/common/decorators/current-user.decorator';
import { AdminGuard } from './admin.guard';
import { AdminReportsService } from './admin-reports.service';
import { CreateAlternativeDto, ResolveReportsDto } from './admin-reports.dto';

const estado = (s?: string): 'pending' | 'closed' => (s === 'closed' ? 'closed' : 'pending');

/** Bandeja de reportes y respuestas aceptadas (spec 2026-10-01 §3.3). Solo perfil 1. */
@Controller('admin')
@UseGuards(AdminGuard)
export class AdminReportsController {
  constructor(private readonly reports: AdminReportsService) {}

  @Get('reports/summary')
  summary() {
    return this.reports.summary();
  }

  @Get('reports/groups')
  groups(@Query('status') status?: string) {
    return this.reports.groups(estado(status));
  }

  @Get('reports/groups/:type/:id')
  group(@Param('type') type: string, @Param('id') id: string) {
    return this.reports.group(type, id);
  }

  @Get('reports/bugs')
  bugs(@Query('status') status?: string) {
    return this.reports.bugs(estado(status));
  }

  @Post('reports/resolve')
  @HttpCode(200)
  resolve(@CurrentUser() admin: AuthUser, @Body() dto: ResolveReportsDto) {
    return this.reports.resolve(admin.id, dto);
  }

  @Get('answer-alternatives')
  listAlternatives(
    @Query('targetType') targetType: string,
    @Query('targetId') targetId: string,
  ) {
    return this.reports.listAlternatives(targetType, targetId);
  }

  @Post('answer-alternatives')
  createAlternative(@CurrentUser() admin: AuthUser, @Body() dto: CreateAlternativeDto) {
    return this.reports.createAlternative(admin.id, dto);
  }

  @Delete('answer-alternatives/:id')
  deleteAlternative(@Param('id', ParseIntPipe) id: number) {
    return this.reports.deleteAlternative(id);
  }
}
```

En `admin.module.ts`: importa los dos, añade `AdminReportsController` a `controllers` y `AdminReportsService` a `providers`.

En `admin-me.reset.ts`, encima de `KEPT_TABLES`, amplía el comentario:

```ts
/**
 * Se conservan a propósito: los retos involucran a otra persona y las
 * invitaciones no son progreso. dots.content_reports también se conserva —es
 * feedback sobre el contenido, no progreso— pero no está en esta lista porque
 * se usa con SQL crudo y sin entity, y el test solo admite tablas con entity.
 */
```

- [ ] **Step 9: Suite completa, build, lint y commit**

```bash
npm test && npm run build
npx eslint src/common/gems.ts src/modules/admin/admin.service.ts src/modules/admin/admin-reports.* src/modules/admin/admin.module.ts src/modules/admin/admin-me.reset.ts
git add src/common/gems.ts src/modules/admin
git commit -m "feat(reportes): bandeja del admin agrupada, cierre que paga una sola vez y respuestas aceptadas

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

Expected: toda la suite en verde (incluido `admin-me.reset.spec.ts`, que no cambia porque no hay entity nueva).

### Task A8: Documentación del backend

**Files:**
- Modify: `docs/ARQUITECTURA.md`
- Modify: `CLAUDE.md`

- [ ] **Step 1: ARQUITECTURA.md**

Añade una sección «Reportes de ejercicios» (busca dónde se describen los módulos y tablas, y sigue su formato): las dos tablas y sus columnas clave; los endpoints del alumno (`POST /reports`, `GET /me/report-notices`, `POST /me/report-notices/seen`) y del admin (`/admin/reports/*`, `/admin/answer-alternatives`); que todo es SQL crudo y degrada con `42P01`; que las alternativas se aplican en `buildOptionSet` (práctica, repaso, checkpoint, placement, gramática) y en Escucha Rápida, Dotaxi, Constructor y ¡No lo revientes!; que cerrar paga `GEMS_PER_ACCEPTED_REPORT` una sola vez por el claim del `UPDATE … WHERE status = 'pending'` y nunca a perfil 1; y los ids nuevos (`TowerRoundDto.id`, `WordleStateDto.answerId`, `CrosswordAnswerDto.vocabId`, `refId` en el contenido de gramática y pronunciación).

- [ ] **Step 2: CLAUDE.md**

En «Módulos», añade `reports (reportes de ejercicios del alumno; la bandeja vive en admin)`. En la línea de migraciones disponibles, añade `migrate:reports`.

- [ ] **Step 3: Commit**

```bash
git add docs/ARQUITECTURA.md CLAUDE.md
git commit -m "docs(reportes): tablas, endpoints y reglas de los reportes de ejercicios

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

# Parte B — Webapp

Todas las rutas de esta parte son relativas a `/home/endurance/Projects/Endurance/dots/dots-webapp/.claude/worktrees/current-section-always-visible-48540d`.

### Task B1: El glifo `bandera`

**Files:**
- Modify: `components/ui/icon/paths.tsx` (familia glifo, junto a `aviso`)

**Interfaces:**
- Produces: `IconName` incluye `"bandera"` (lo usan B6, B11, B12).

- [ ] **Step 1: Añadir el glifo**

Dentro de la familia glifo (`── familia glifo · stroke-width 3.5 ──`), justo después de `aviso`:

```tsx
  bandera: (
    <g fill="none" stroke="currentColor" strokeWidth={3.5}>
      <path d="M12,42 V7" />
      <path
        d="M12,9 Q19,5 26,9 Q33,13 40,9 V27 Q33,31 26,27 Q19,23 12,27 Z"
        fill="#FF1F8F"
      />
    </g>
  ),
```

- [ ] **Step 2: Comprobar el lint de iconos**

Run: `node scripts/check-icons.mjs`
Expected: termina sin errores (relleno rosa permitido, grosor 3.5 de la familia).

- [ ] **Step 3: Commit**

```bash
git add components/ui/icon/paths.tsx
git commit -m "feat(reportes): glifo bandera para reportar un problema

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task B2: `lib/report.ts` — objetivos, motivos y cuerpo del reporte

**Files:**
- Create: `lib/report.ts`
- Create: `lib/report.test.mjs`

**Interfaces:**
- Produces (todo lo usan B3–B13):
  - Tipos: `ReportReason`, `ReportTargetType`, `ReportSurface`, `ReportSnapshot`, `ReportTarget`, `Borrador`, `CuerpoReporte`; constantes `MOTIVOS`, `MAX_COMENTARIO = 500`, `LUGARES_APP`.
  - `objetivo(n)`, `conRespuesta(t, r)`, `objetivoGeneral(surface, label)`, `candidatosDeReporte(actuales, anterior)`, `motivosPara(t)`, `etiquetaMotivo(m, t)`, `detalleMotivo(m, t)`, `validarBorrador(b)`, `cuerpoDelReporte(t, b, contexto)`, `recortarFoto(f)`, `ordenarParaJuego(vistos, max?)`.
  - Constructores: `objetivoDePractica(s, mode, levelId)`, `esperadaDePractica(s, mode)`, `objetivoDeOracion(s, surface, extra?)`, `objetivoDeGramatica(item, nodeId)`, `objetivoDePildora(p, nodeId)`, `objetivoDePronunciacion(item, nodeId)`, `objetivoDeUnidad(u, nodeId)`, `objetivoDeVocab(item, surface, mode, context?)`, `objetivoDeLetra(item, mode, nodeId)`, `objetivoDeNumero(item, mode, nodeId)`, `objetivoDeLectura(r)`, `objetivoDePregunta(r, q)`, `objetivoDePalabra(w, surface)`, `objetivoDeTarjeta(card, surface)`.

- [ ] **Step 1: Escribir el test que falla**

`lib/report.test.mjs`:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  candidatosDeReporte,
  conRespuesta,
  cuerpoDelReporte,
  detalleMotivo,
  esperadaDePractica,
  etiquetaMotivo,
  motivosPara,
  objetivo,
  objetivoDeLectura,
  objetivoDeOracion,
  objetivoDePractica,
  objetivoDePregunta,
  objetivoDeTarjeta,
  objetivoGeneral,
  ordenarParaJuego,
  recortarFoto,
  validarBorrador,
} from "./report.ts";

const oracion = (over = {}) =>
  objetivoDeOracion({ id: "12", text: "I __ happy.", options: ["am", "feel"] }, "review", over);

test("la clave es tipo:id, o superficie:prompt si no hay ejercicio", () => {
  assert.equal(oracion().key, "sentence:12");
  assert.equal(objetivoGeneral("game:dotaxi", "El juego en general").key, "game:dotaxi:El juego en general");
});

test("sentences.id llega como string y se queda como string", () => {
  const t = objetivoDeOracion({ id: 1234567890123, text: "x __" }, "checkpoint");
  assert.equal(t.id, "1234567890123");
});

test("sin id no hay tipo: un juego viejo sin ids solo ofrece bug y otra cosa", () => {
  const t = objetivo({ type: "vocab_item", id: null, surface: "game:word-tower", snapshot: { prompt: "dog" } });
  assert.equal(t.type, null);
  assert.deepEqual(motivosPara(t), ["bug", "other"]);
});

test("candidatos: lo respondido manda; si no, se añade el anterior", () => {
  const a = oracion();
  const b = objetivoDeOracion({ id: "30", text: "She __ tired." }, "review");
  const bRespondida = conRespuesta(b, { answer: "is", expected: "feels", wasWrong: true });
  assert.deepEqual(candidatosDeReporte([a], null), [a]);
  assert.deepEqual(candidatosDeReporte([a], bRespondida), [a, bRespondida]);
  const aRespondida = conRespuesta(a, { answer: "am", wasWrong: false });
  assert.deepEqual(candidatosDeReporte([aRespondida], bRespondida), [aRespondida]);
  // Re-encolado: el anterior respondido sustituye a su gemelo sin responder.
  assert.deepEqual(candidatosDeReporte([b], bRespondida), [bRespondida]);
});

test("motivos según el ejercicio", () => {
  assert.deepEqual(motivosPara(objetivoGeneral("app", "x")), ["bug", "other"]);
  assert.deepEqual(motivosPara(oracion()), ["typo", "meaning", "bug", "other"]);
  const fallada = conRespuesta(oracion({ hasAudio: true }), { answer: "feel", expected: "am", wasWrong: true });
  assert.deepEqual(motivosPara(fallada), ["answer", "typo", "meaning", "audio", "bug", "other"]);
  // wasWrong null (checkpoint): nunca «debería estar bien».
  const examen = conRespuesta(oracion(), { answer: "feel", wasWrong: null });
  assert.equal(motivosPara(examen).includes("answer"), false);
  // Una palabra con imagen no tiene «no se entiende».
  const palabra = objetivo({ type: "word", id: 3, surface: "game:memory", snapshot: { prompt: "cat", image: "cat.png" } });
  assert.deepEqual(motivosPara(palabra), ["typo", "image", "bug", "other"]);
});

test("etiquetas y detalle", () => {
  assert.equal(etiquetaMotivo("meaning", oracion()), "La oración no se entiende");
  const vocab = objetivo({ type: "vocab_item", id: 1, surface: "lesson-vocab", snapshot: { prompt: "big" } });
  assert.equal(etiquetaMotivo("meaning", vocab), "La traducción no cuadra");
  const pregunta = objetivoDePregunta({ id: 4, title: "Mi casa" }, { idx: 2, prompt: "The __ is red.", options: ["house"] });
  assert.equal(etiquetaMotivo("meaning", pregunta), "La pregunta no se entiende");
  const fallada = conRespuesta(oracion(), { answer: "feel", expected: "am", wasWrong: true });
  assert.equal(detalleMotivo("answer", fallada), "Elegiste «feel» · esperábamos «am»");
  assert.equal(detalleMotivo("typo", fallada), null);
});

test("validación del borrador", () => {
  assert.equal(validarBorrador({ motivos: [], comentario: "" }), "Marca al menos un motivo");
  assert.match(validarBorrador({ motivos: ["other"], comentario: "  " }), /Otra cosa/);
  assert.equal(validarBorrador({ motivos: ["typo"], comentario: "" }), null);
});

test("el cuerpo ordena motivos, recorta y une el contexto", () => {
  const t = conRespuesta(oracion({ context: { levelId: "5" } }), { answer: "feel", expected: "am", wasWrong: true });
  const cuerpo = cuerpoDelReporte(t, { motivos: ["other", "answer"], comentario: "  ojo  " }, { route: "/review" });
  assert.deepEqual(cuerpo.reasons, ["answer", "other"]);
  assert.equal(cuerpo.comment, "ojo");
  assert.equal(cuerpo.targetType, "sentence");
  assert.equal(cuerpo.targetId, "12");
  assert.equal(cuerpo.wasWrong, true);
  assert.deepEqual(cuerpo.context, { levelId: "5", route: "/review" });
  const general = cuerpoDelReporte(objetivoGeneral("app", "Reportar"), { motivos: ["bug"], comentario: "", lugar: "tienda" }, {});
  assert.equal(general.targetType, undefined);
  assert.equal(general.targetId, undefined);
  assert.equal(general.context.lugar, "tienda");
});

test("la foto recortada nunca pasa de 4 KB", () => {
  const enorme = recortarFoto({
    prompt: "x".repeat(5000),
    options: Array.from({ length: 30 }, () => "y".repeat(500)),
    image: "i".repeat(900),
    audio: "a".repeat(900),
    meaning: "m".repeat(900),
  });
  assert.ok(JSON.stringify(enorme).length <= 4096);
});

test("práctica: modos, imagen y esperada", () => {
  const s = { id: "7", text: "I __ happy.", img: "img.png", sentence_extension: "mp3", options: [{ word: "am", correct: true }, { word: "is", correct: false }] };
  const witch = objetivoDePractica(s, "witchIs", 5);
  assert.equal(witch.snapshot.prompt, "Which is: am?");
  assert.equal(witch.hasImage, true);
  assert.equal(objetivoDePractica(s, "complete", 5).hasImage, false);
  assert.equal(objetivoDePractica(s, "buildUp", 5).snapshot.options, undefined);
  assert.equal(esperadaDePractica(s, "complete"), "am");
  assert.equal(esperadaDePractica({ ...s, text: "I am happy" }, "buildUp"), "I am happy");
});

test("tarjetas: las trampas con id negativo son false_friend", () => {
  assert.equal(objetivoDeTarjeta({ id: -3, en: "actually", es: "actualmente" }, "game:true-false").type, "false_friend");
  assert.equal(objetivoDeTarjeta({ id: 9, en: "big", es: "grande" }, "game:true-false").type, "vocab_item");
});

test("lectura y preguntas tienen claves distintas pero el mismo objetivo", () => {
  const r = { id: 4, title: "Mi casa", text: "My house is red." };
  const lectura = objetivoDeLectura(r);
  const pregunta = objetivoDePregunta(r, { idx: 0, prompt: "My __ is red.", options: ["house"] });
  assert.notEqual(lectura.key, pregunta.key);
  assert.equal(pregunta.type, "reading");
  assert.equal(pregunta.id, "4");
  assert.equal(pregunta.context.idx, 0);
});

test("juego: sin repetir, la fallada gana y va primero", () => {
  const a = oracion();
  const aBien = conRespuesta(a, { answer: "am", wasWrong: false });
  const aMal = conRespuesta(a, { answer: "feel", wasWrong: true });
  const b = objetivoDeOracion({ id: "30", text: "y __" }, "game:dotaxi");
  const lista = ordenarParaJuego([b, aBien, aMal]);
  assert.deepEqual(lista.map((t) => t.key), ["sentence:12", "sentence:30"]);
  assert.equal(lista[0].wasWrong, true);
});
```

- [ ] **Step 2: Verlo fallar**

Run: `node --test lib/report.test.mjs`
Expected: FAIL — `Cannot find module …/lib/report.ts`.

- [ ] **Step 3: Implementar `lib/report.ts`**

```ts
/**
 * Reportes de ejercicios (spec 2026-10-01): qué se reporta, qué motivos salen
 * y qué viaja al servidor. Puro y sin React, para que `node --test` lo corra
 * tal cual. La hoja (components/report/) solo pinta.
 */

export const MOTIVOS = ["answer", "typo", "meaning", "audio", "image", "bug", "other"] as const;
export type ReportReason = (typeof MOTIVOS)[number];

export type ReportTargetType =
  | "sentence"
  | "word"
  | "vocab_item"
  | "grammar_item"
  | "grammar_pill"
  | "pronunciation_item"
  | "pronunciation_unit"
  | "letter_item"
  | "number_item"
  | "reading"
  | "false_friend";

export type ReportSurface =
  | "practice"
  | "lesson-grammar"
  | "lesson-pronunciation"
  | "lesson-vocab"
  | "lesson-letters"
  | "lesson-numbers"
  | "checkpoint"
  | "placement"
  | "review"
  | "reading"
  | "app"
  | `game:${string}`;

/** La foto: lo que el alumno tenía delante, por si el contenido cambia después. */
export type ReportSnapshot = {
  prompt: string;
  options?: string[];
  image?: string;
  audio?: string;
  meaning?: string;
};

type Contexto = Record<string, string | number>;

export type ReportTarget = {
  /** Identidad para elegir y fusionar: "sentence:12", o superficie:prompt sin ejercicio. */
  key: string;
  type: ReportTargetType | null;
  /** String siempre: sentences.id es bigint. */
  id: string | null;
  surface: ReportSurface;
  mode?: string;
  /** Lo que se lee en «¿Sobre cuál?». */
  label: string;
  snapshot: ReportSnapshot;
  answer?: string;
  expected?: string;
  /** null = la pantalla no revela si falló (checkpoint, placement, lecturas). */
  wasWrong: boolean | null;
  hasAudio: boolean;
  hasImage: boolean;
  context: Contexto;
};

type NuevoObjetivo = {
  type: ReportTargetType | null;
  id: string | number | null;
  surface: ReportSurface;
  mode?: string;
  label?: string;
  snapshot: ReportSnapshot;
  hasAudio?: boolean;
  hasImage?: boolean;
  context?: Contexto;
};

const recortar = (s: string, max: number) => (s.length > max ? `${s.slice(0, max - 1)}…` : s);

export function objetivo(n: NuevoObjetivo): ReportTarget {
  const id = n.id === null || n.id === undefined ? null : String(n.id);
  // Sin id no hay ejercicio que arreglar: cae en Bugs con «Algo no funciona» y
  // «Otra cosa», que es lo único que el servidor acepta sin objetivo.
  const type = id === null ? null : n.type;
  const prompt = n.snapshot.prompt.trim();
  return {
    key: type && id !== null ? `${type}:${id}` : `${n.surface}:${prompt}`,
    type,
    id,
    surface: n.surface,
    mode: n.mode,
    label: recortar((n.label ?? prompt).trim(), 80),
    snapshot: { ...n.snapshot, prompt },
    wasWrong: null,
    hasAudio: n.hasAudio ?? Boolean(n.snapshot.audio),
    hasImage: n.hasImage ?? Boolean(n.snapshot.image),
    context: n.context ?? {},
  };
}

export function conRespuesta(
  t: ReportTarget,
  r: { answer: string; expected?: string; wasWrong: boolean | null },
): ReportTarget {
  return { ...t, answer: r.answer, expected: r.expected, wasWrong: r.wasWrong };
}

/** «El juego en general» o la pantalla de Ajustes: sin tipo, cae en la pestaña Bugs. */
export function objetivoGeneral(surface: ReportSurface, label: string): ReportTarget {
  return objetivo({ type: null, id: null, surface, label, snapshot: { prompt: label } });
}

export function candidatosDeReporte(
  actuales: readonly ReportTarget[],
  anterior: ReportTarget | null,
): ReportTarget[] {
  if (!anterior || actuales.some((t) => t.answer !== undefined)) return [...actuales];
  const gemelo = actuales.findIndex((t) => t.key === anterior.key);
  if (gemelo >= 0) return actuales.map((t, i) => (i === gemelo ? anterior : t));
  return [...actuales, anterior];
}

const FRASE_POR_TIPO: Partial<Record<ReportTargetType, string>> = {
  sentence: "La oración no se entiende",
  grammar_item: "La oración no se entiende",
  vocab_item: "La traducción no cuadra",
  false_friend: "La traducción no cuadra",
  grammar_pill: "La explicación no se entiende",
  pronunciation_unit: "La explicación no se entiende",
  reading: "La lectura no se entiende",
};

const ETIQUETAS: Record<ReportReason, string> = {
  answer: "Mi respuesta debería estar bien",
  typo: "Hay una falta de ortografía",
  meaning: "La oración no se entiende",
  audio: "El audio está mal",
  image: "La imagen no corresponde",
  bug: "Algo no funciona",
  other: "Otra cosa",
};

export function motivosPara(t: ReportTarget): ReportReason[] {
  if (t.type === null) return ["bug", "other"];
  const out: ReportReason[] = [];
  if (t.wasWrong === true && t.answer) out.push("answer");
  out.push("typo");
  if (FRASE_POR_TIPO[t.type]) out.push("meaning");
  if (t.hasAudio) out.push("audio");
  if (t.hasImage) out.push("image");
  out.push("bug", "other");
  return out;
}

export function etiquetaMotivo(m: ReportReason, t: ReportTarget): string {
  if (m !== "meaning" || !t.type) return ETIQUETAS[m];
  if (t.type === "reading" && t.mode === "quiz") return "La pregunta no se entiende";
  return FRASE_POR_TIPO[t.type] ?? ETIQUETAS.meaning;
}

export function detalleMotivo(m: ReportReason, t: ReportTarget): string | null {
  if (m === "answer" && t.answer) {
    return t.expected
      ? `Elegiste «${t.answer}» · esperábamos «${t.expected}»`
      : `Elegiste «${t.answer}»`;
  }
  if (m === "other") return "Cuéntanos qué pasó abajo";
  return null;
}

export const MAX_COMENTARIO = 500;

/** Chips de «¿Dónde pasó?» del reporte general de Ajustes. */
export const LUGARES_APP = [
  { clave: "camino", etiqueta: "Camino" },
  { clave: "repaso", etiqueta: "Repaso" },
  { clave: "retos", etiqueta: "Retos" },
  { clave: "juegos", etiqueta: "Juegos" },
  { clave: "perfil", etiqueta: "Perfil" },
  { clave: "tienda", etiqueta: "Tienda" },
  { clave: "otra", etiqueta: "Otra" },
] as const;

export type Borrador = { motivos: readonly ReportReason[]; comentario: string; lugar?: string };

export function validarBorrador(b: Borrador): string | null {
  if (b.motivos.length === 0) return "Marca al menos un motivo";
  if (b.motivos.includes("other") && b.comentario.trim() === "") {
    return "Cuéntanos qué pasó en «Otra cosa»";
  }
  if (b.comentario.length > MAX_COMENTARIO) {
    return `El comentario se pasa de ${MAX_COMENTARIO} caracteres`;
  }
  return null;
}

/** Cuerpo de POST /reports. */
export type CuerpoReporte = {
  surface: ReportSurface;
  mode?: string;
  targetType?: ReportTargetType;
  targetId?: string;
  reasons: ReportReason[];
  comment?: string;
  answer?: string;
  expected?: string;
  wasWrong?: boolean;
  snapshot: ReportSnapshot;
  context: Record<string, unknown>;
};

/** Ninguna foto pasa de los 4 KB que acepta el servidor (spec §3.2). */
export function recortarFoto(f: ReportSnapshot): ReportSnapshot {
  return {
    prompt: recortar(f.prompt, 1000),
    ...(f.options ? { options: f.options.slice(0, 8).map((o) => recortar(o, 150)) } : {}),
    ...(f.image ? { image: recortar(f.image, 400) } : {}),
    ...(f.audio ? { audio: recortar(f.audio, 400) } : {}),
    ...(f.meaning ? { meaning: recortar(f.meaning, 300) } : {}),
  };
}

export function cuerpoDelReporte(
  t: ReportTarget,
  b: Borrador,
  contexto: Record<string, unknown>,
): CuerpoReporte {
  const conObjetivo = t.type !== null && t.id !== null;
  return {
    surface: t.surface,
    ...(t.mode ? { mode: t.mode } : {}),
    ...(conObjetivo ? { targetType: t.type as ReportTargetType, targetId: t.id as string } : {}),
    reasons: MOTIVOS.filter((m) => b.motivos.includes(m)),
    ...(b.comentario.trim() ? { comment: b.comentario.trim() } : {}),
    ...(t.answer ? { answer: recortar(t.answer, 300) } : {}),
    ...(t.expected ? { expected: recortar(t.expected, 300) } : {}),
    ...(t.wasWrong !== null ? { wasWrong: t.wasWrong } : {}),
    snapshot: recortarFoto(t.snapshot),
    context: { ...t.context, ...contexto, ...(b.lugar ? { lugar: b.lugar } : {}) },
  };
}

/** Los ítems de una partida para el selector: sin repetir, la versión fallada gana y va primero. */
export function ordenarParaJuego(vistos: readonly ReportTarget[], max = 30): ReportTarget[] {
  const porClave = new Map<string, ReportTarget>();
  for (const t of vistos) {
    const previo = porClave.get(t.key);
    if (
      !previo ||
      (t.wasWrong === true && previo.wasWrong !== true) ||
      (previo.answer === undefined && t.answer !== undefined && previo.wasWrong !== true)
    ) {
      porClave.set(t.key, t);
    }
  }
  const lista = [...porClave.values()];
  return [...lista.filter((t) => t.wasWrong === true), ...lista.filter((t) => t.wasWrong !== true)].slice(0, max);
}

// ── Constructores por tipo de contenido ────────────────────────────────────

type Opcion = { word: string; correct: boolean };

export function objetivoDePractica(
  s: { id: string | number; text: string; img?: string; sentence_extension?: string; options: readonly Opcion[] },
  mode: string,
  levelId: string | number,
): ReportTarget {
  const correcta = s.options.find((o) => o.correct)?.word ?? "";
  return objetivo({
    type: "sentence",
    id: s.id,
    surface: "practice",
    mode,
    snapshot: {
      prompt: mode === "witchIs" ? `Which is: ${correcta}?` : s.text,
      ...(mode === "buildUp" ? {} : { options: s.options.map((o) => o.word) }),
      ...(mode === "guessImg" && s.img ? { image: s.img } : {}),
    },
    hasAudio: Boolean(s.sentence_extension),
    hasImage: mode === "guessImg" || mode === "witchIs",
    context: { levelId: String(levelId) },
  });
}

export function esperadaDePractica(s: { text: string; options: readonly Opcion[] }, mode: string): string {
  return mode === "buildUp" ? s.text : (s.options.find((o) => o.correct)?.word ?? "");
}

export function objetivoDeOracion(
  s: { id: string | number; text: string; options?: readonly string[]; image?: string | null },
  surface: ReportSurface,
  extra: { mode?: string; hasAudio?: boolean; context?: Contexto } = {},
): ReportTarget {
  return objetivo({
    type: "sentence",
    id: s.id,
    surface,
    mode: extra.mode,
    snapshot: {
      prompt: s.text,
      ...(s.options ? { options: [...s.options] } : {}),
      ...(s.image ? { image: s.image } : {}),
    },
    hasAudio: extra.hasAudio ?? false,
    hasImage: Boolean(s.image),
    context: extra.context,
  });
}

export function objetivoDeGramatica(
  item: { id: number; text: string; options: readonly { word: string }[] },
  nodeId: number,
): ReportTarget {
  return objetivo({
    type: "grammar_item",
    id: item.id,
    surface: "lesson-grammar",
    mode: "practice",
    snapshot: { prompt: item.text, options: item.options.map((o) => o.word) },
    context: { nodeId },
  });
}

export function objetivoDePildora(
  p: { refId?: number | null; title: string; explanation: readonly { text: string }[] },
  nodeId: number,
): ReportTarget {
  return objetivo({
    type: p.refId ? "grammar_pill" : null,
    id: p.refId ?? null,
    surface: "lesson-grammar",
    mode: "explain",
    label: p.title,
    snapshot: { prompt: [p.title, ...p.explanation.map((b) => b.text)].join(" · ") },
    context: { nodeId },
  });
}

export function objetivoDePronunciacion(
  item: { id: number; audio?: string | null; options: readonly { word: string }[] },
  nodeId: number,
): ReportTarget {
  const palabras = item.options.map((o) => o.word);
  return objetivo({
    type: "pronunciation_item",
    id: item.id,
    surface: "lesson-pronunciation",
    mode: "drill",
    snapshot: { prompt: palabras.join(" / "), options: palabras, ...(item.audio ? { audio: item.audio } : {}) },
    hasAudio: true,
    context: { nodeId },
  });
}

export function objetivoDeUnidad(
  u: { refId?: number | null; title: string; descriptionEs?: string | null },
  nodeId: number,
): ReportTarget {
  return objetivo({
    type: u.refId ? "pronunciation_unit" : null,
    id: u.refId ?? null,
    surface: "lesson-pronunciation",
    mode: "intro",
    label: u.title,
    snapshot: { prompt: [u.title, u.descriptionEs].filter(Boolean).join(" · ") },
    context: { nodeId },
  });
}

export function objetivoDeVocab(
  item: { id: number; text: string; meaning: string; img?: string | null; audio?: string | null },
  surface: ReportSurface,
  mode: string,
  context: Contexto = {},
): ReportTarget {
  return objetivo({
    type: "vocab_item",
    id: item.id,
    surface,
    mode,
    label: `${item.text} · ${item.meaning}`,
    snapshot: {
      prompt: item.text,
      meaning: item.meaning,
      ...(item.img ? { image: item.img } : {}),
      ...(item.audio ? { audio: item.audio } : {}),
    },
    context,
  });
}

export function objetivoDeLetra(
  item: { id: number; letter: string; name?: string | null; exampleWord?: string | null; audio?: string | null },
  mode: string,
  nodeId: number,
): ReportTarget {
  return objetivo({
    type: "letter_item",
    id: item.id,
    surface: "lesson-letters",
    mode,
    label: item.letter,
    snapshot: {
      prompt: [item.letter, item.name, item.exampleWord].filter(Boolean).join(" · "),
      ...(item.audio ? { audio: item.audio } : {}),
    },
    context: { nodeId },
  });
}

export function objetivoDeNumero(
  item: { id: number; value: number; word: string; audio?: string | null },
  mode: string,
  nodeId: number,
): ReportTarget {
  return objetivo({
    type: "number_item",
    id: item.id,
    surface: "lesson-numbers",
    mode,
    label: `${item.value} · ${item.word}`,
    snapshot: { prompt: `${item.value} · ${item.word}`, ...(item.audio ? { audio: item.audio } : {}) },
    context: { nodeId },
  });
}

export function objetivoDeLectura(r: { id: number; title: string; text: string; src?: string | null }): ReportTarget {
  return objetivo({
    type: "reading",
    id: r.id,
    surface: "reading",
    mode: "read",
    label: `La lectura: ${r.title}`,
    snapshot: { prompt: `${r.title} — ${r.text}`, ...(r.src ? { audio: r.src } : {}) },
    hasAudio: Boolean(r.src),
    context: { readingId: r.id },
  });
}

export function objetivoDePregunta(
  r: { id: number; title: string },
  q: { idx: number; prompt: string; options: readonly string[] },
): ReportTarget {
  return {
    ...objetivo({
      type: "reading",
      id: r.id,
      surface: "reading",
      mode: "quiz",
      label: `Pregunta ${q.idx + 1}: ${q.prompt}`,
      snapshot: { prompt: q.prompt, options: [...q.options] },
      context: { readingId: r.id, idx: q.idx },
    }),
    // Misma lectura, otra pregunta: el selector necesita distinguirlas.
    key: `reading:${r.id}#${q.idx}`,
  };
}

export function objetivoDePalabra(w: { id: number; word: string; img?: string | null }, surface: ReportSurface): ReportTarget {
  return objetivo({
    type: "word",
    id: w.id,
    surface,
    label: w.word,
    snapshot: { prompt: w.word, ...(w.img ? { image: w.img } : {}) },
  });
}

/** ¿Verdad o Trampa?: las trampas de FALSE_FRIENDS traen id negativo y viven en el código. */
export function objetivoDeTarjeta(
  card: { id: number; en: string; es: string; realEs?: string | null },
  surface: ReportSurface,
): ReportTarget {
  return objetivo({
    type: card.id < 0 ? "false_friend" : "vocab_item",
    id: card.id,
    surface,
    mode: "true-false",
    label: `${card.en} = ${card.es}`,
    snapshot: { prompt: `${card.en} = ${card.es}`, ...(card.realEs ? { meaning: card.realEs } : {}) },
  });
}
```

- [ ] **Step 4: Correr el test**

Run: `node --test lib/report.test.mjs`
Expected: PASS (todos).

- [ ] **Step 5: Commit**

```bash
git add lib/report.ts lib/report.test.mjs
git commit -m "feat(reportes): lógica pura de objetivos, motivos y cuerpo del reporte

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task B3: Store de lo que hay en pantalla

**Files:**
- Create: `lib/report-targets.ts`, `lib/report-targets.test.mjs`
- Create: `hooks/use-report-targets.ts`

**Interfaces:**
- Consumes: `candidatosDeReporte`, `ReportTarget` (B2).
- Produces: `publicarObjetivos(lista)`, `registrarRespondido(t)`, `limpiarObjetivos()`, `leerCandidatos()`, `suscribirObjetivos(cb)`; hooks `usePublicarObjetivos(lista)` y `useCandidatosReporte()`.

- [ ] **Step 1: Test que falla**

`lib/report-targets.test.mjs`:

```js
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { conRespuesta, objetivoDeOracion } from "./report.ts";
import {
  leerCandidatos,
  limpiarObjetivos,
  publicarObjetivos,
  registrarRespondido,
  suscribirObjetivos,
} from "./report-targets.ts";

const a = objetivoDeOracion({ id: "1", text: "a __" }, "review");
const b = objetivoDeOracion({ id: "2", text: "b __" }, "review");

beforeEach(() => limpiarObjetivos());

test("publicar avisa una vez y repetir lo mismo no vuelve a avisar", () => {
  let avisos = 0;
  const soltar = suscribirObjetivos(() => avisos++);
  publicarObjetivos([a]);
  publicarObjetivos([{ ...a }]);
  assert.equal(avisos, 1);
  assert.deepEqual(leerCandidatos(), [a]);
  soltar();
});

test("leerCandidatos devuelve la misma referencia mientras nada cambie", () => {
  publicarObjetivos([a]);
  assert.equal(leerCandidatos(), leerCandidatos());
});

test("lo respondido entra como anterior hasta que se limpia", () => {
  publicarObjetivos([a]);
  const aRespondida = conRespuesta(a, { answer: "x", wasWrong: true });
  registrarRespondido(aRespondida);
  publicarObjetivos([b]);
  assert.deepEqual(leerCandidatos(), [b, aRespondida]);
  limpiarObjetivos();
  assert.deepEqual(leerCandidatos(), []);
});
```

Run: `node --test lib/report-targets.test.mjs` → FAIL (módulo inexistente).

- [ ] **Step 2: Implementar `lib/report-targets.ts`**

```ts
import { candidatosDeReporte, type ReportTarget } from "./report.ts";

/**
 * Qué hay en pantalla para reportar (spec 2026-10-01 §1.2). Store de módulo,
 * mismo patrón que lib/admin-mode.ts: la pantalla que conoce el ejercicio
 * publica, la banderita lee con `useSyncExternalStore`. Hace falta porque en
 * vocabulario, letras y números el estado vive en componentes hijos y la
 * barra la pinta el padre.
 *
 * Publicar compara una firma (claves, respuestas y fallos): si nada cambió no
 * avisa, así que una pantalla que publica en cada render no provoca bucles.
 */
let actuales: readonly ReportTarget[] = [];
let anterior: ReportTarget | null = null;
let candidatos: ReportTarget[] = [];
let firma = "";
const escuchas = new Set<() => void>();

const firmaDe = (lista: readonly ReportTarget[]) =>
  lista.map((t) => `${t.key}|${t.answer ?? ""}|${String(t.wasWrong)}`).join("·");

function recalcular(): void {
  candidatos = candidatosDeReporte(actuales, anterior);
  for (const alCambiar of escuchas) alCambiar();
}

export function publicarObjetivos(lista: readonly ReportTarget[]): void {
  const nueva = firmaDe(lista);
  if (nueva === firma) return;
  firma = nueva;
  actuales = lista;
  recalcular();
}

/** Desde el handler que corrige (un evento, nunca un efecto: regla 3). */
export function registrarRespondido(t: ReportTarget): void {
  anterior = t;
  recalcular();
}

/** Al salir de la pantalla: nada queda colgado para la siguiente. */
export function limpiarObjetivos(): void {
  actuales = [];
  anterior = null;
  firma = "";
  recalcular();
}

export function leerCandidatos(): ReportTarget[] {
  return candidatos;
}

export function suscribirObjetivos(alCambiar: () => void): () => void {
  escuchas.add(alCambiar);
  return () => {
    escuchas.delete(alCambiar);
  };
}
```

Run: `node --test lib/report-targets.test.mjs` → PASS.

- [ ] **Step 3: Hooks**

`hooks/use-report-targets.ts`:

```ts
"use client";

import { useEffect, useSyncExternalStore } from "react";

import type { ReportTarget } from "@/lib/report";
import {
  leerCandidatos,
  limpiarObjetivos,
  publicarObjetivos,
  suscribirObjetivos,
} from "@/lib/report-targets";

const NINGUNO: ReportTarget[] = [];

/**
 * La pantalla publica lo que tiene delante y lo retira al desmontarse.
 * Publicar desde el efecto escribe en un store externo, no en un setState:
 * no rompe la regla 3. Pasa la lista memoizada; si no, igual no hay bucle
 * porque el store compara firmas.
 */
export function usePublicarObjetivos(lista: readonly ReportTarget[] | null): void {
  // `null` = esta pantalla no publica ahora (p. ej. el padre mientras un hijo
  // tiene el ejercicio): no pisa lo que el hijo publicó.
  useEffect(() => {
    if (lista) publicarObjetivos(lista);
  }, [lista]);
  useEffect(() => () => limpiarObjetivos(), []);
}

export function useCandidatosReporte(): ReportTarget[] {
  return useSyncExternalStore(suscribirObjetivos, leerCandidatos, () => NINGUNO);
}
```

- [ ] **Step 4: Commit**

```bash
git add lib/report-targets.ts lib/report-targets.test.mjs hooks/use-report-targets.ts
git commit -m "feat(reportes): store de lo que hay en pantalla para la banderita

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task B4: Respuestas aceptadas en el cliente

**Files:**
- Create: `lib/accepted-answers.ts`, `lib/accepted-answers.test.mjs`

**Interfaces:**
- Produces: `normalizarOracion(s)`, `normalizarPalabra(w)`, `esOracionAceptada(armada, referencia, alternativas?)`, `primerFalloEnOrden(bandeja, aceptadas)`, `sinAceptadas(opciones, aceptadas?)` (los usan B7 y B12).

- [ ] **Step 1: Test que falla**

`lib/accepted-answers.test.mjs`:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  esOracionAceptada,
  normalizarOracion,
  primerFalloEnOrden,
  sinAceptadas,
} from "./accepted-answers.ts";

test("misma normalización que el backend", () => {
  assert.equal(normalizarOracion("  Today   I am happy ."), "TODAY I AM HAPPY");
});

test("«Arma la oración»: la referencia como siempre y las alternativas normalizadas", () => {
  assert.equal(esOracionAceptada("i am happy today", "I am happy today"), true);
  assert.equal(esOracionAceptada("today I am happy", "I am happy today"), false);
  assert.equal(esOracionAceptada("today I am happy", "I am happy today", ["Today I am happy."]), true);
  assert.equal(esOracionAceptada("", "x", [""]), false);
});

test("Constructor: primera ficha mal puesta respecto de la secuencia más parecida", () => {
  const ref = ["I", "am", "happy", "today"];
  const alt = ["Today", "I", "am", "happy"];
  assert.equal(primerFalloEnOrden(["I", "am", "happy", "today"], [ref, alt]), null);
  assert.equal(primerFalloEnOrden(["today", "i", "am", "happy"], [ref, alt]), null);
  assert.equal(primerFalloEnOrden(["I", "am", "today", "happy"], [ref, alt]), 2);
  assert.equal(primerFalloEnOrden(["Today", "I", "happy", "am"], [ref, alt]), 2);
});

test("¡No lo revientes!: las aceptadas salen de los distractores", () => {
  assert.deepEqual(sinAceptadas(["kitten", "dog", "Kitten "], ["kitten"]), ["dog"]);
  assert.deepEqual(sinAceptadas(["dog"], undefined), ["dog"]);
});
```

Run: `node --test lib/accepted-answers.test.mjs` → FAIL.

- [ ] **Step 2: Implementar `lib/accepted-answers.ts`**

```ts
/**
 * Respuestas aceptadas en el cliente (spec 2026-10-01 §4). La normalización
 * es gemela de `dots-backend/src/common/answer-alternatives.ts`: si cambias
 * una, cambia la otra.
 */

export function normalizarOracion(s: string): string {
  return String(s).replace(/\s+/g, " ").replace(/[\s.,;:!?]+$/, "").trim().toUpperCase();
}

export function normalizarPalabra(w: string): string {
  return String(w).trim().replace(/[.,;:!?]+$/, "").trim().toUpperCase();
}

/** «Arma la oración»: la referencia se compara como siempre (mayúsculas); las alternativas, normalizadas. */
export function esOracionAceptada(
  armada: string,
  referencia: string,
  alternativas: readonly string[] = [],
): boolean {
  if (armada.toUpperCase() === referencia.toUpperCase()) return true;
  const n = normalizarOracion(armada);
  return n !== "" && alternativas.some((a) => normalizarOracion(a) === n);
}

/**
 * Constructor: índice de la primera ficha mal puesta contra la secuencia
 * válida que más se le parece, o `null` si coincide entera con alguna.
 */
export function primerFalloEnOrden(
  bandeja: readonly string[],
  aceptadas: readonly (readonly string[])[],
): number | null {
  let mejor = -1;
  for (const seq of aceptadas) {
    if (seq.length !== bandeja.length) continue;
    let i = 0;
    while (i < seq.length && bandeja[i].toUpperCase() === seq[i].toUpperCase()) i++;
    if (i === seq.length) return null;
    if (i > mejor) mejor = i;
  }
  return mejor === -1 ? 0 : mejor;
}

/** Saca de las opciones incorrectas las palabras que también valen. */
export function sinAceptadas(opciones: readonly string[], aceptadas: readonly string[] = []): string[] {
  if (aceptadas.length === 0) return [...opciones];
  const fuera = new Set(aceptadas.map(normalizarPalabra));
  return opciones.filter((o) => !fuera.has(normalizarPalabra(o)));
}
```

Run: `node --test lib/accepted-answers.test.mjs` → PASS.

- [ ] **Step 3: Commit**

```bash
git add lib/accepted-answers.ts lib/accepted-answers.test.mjs
git commit -m "feat(reportes): normalización y orden aceptado de respuestas en el cliente

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task B5: Contexto técnico de los bugs

**Files:**
- Create: `lib/error-trail.ts`, `lib/error-trail.test.mjs`
- Create: `lib/report-browser.ts`
- Create: `components/report/error-trail-capture.tsx`
- Modify: `app/layout.tsx` (montar `ErrorTrailCapture` junto a `InstallCapture`, l.~123)

**Interfaces:**
- Produces: `crearRastro(max?)`, `rastroDeErrores`; `contextoTecnico(ruta: string, conErrores: boolean): Record<string, unknown>` (lo usa B6).

- [ ] **Step 1: Test que falla**

`lib/error-trail.test.mjs`:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { crearRastro } from "./error-trail.ts";

test("guarda los últimos N, recorta y descarta vacíos", () => {
  const r = crearRastro(2);
  r.anotar({ mensaje: "" });
  r.anotar({ mensaje: "uno" }, new Date("2026-10-01T10:00:00Z"));
  r.anotar({ mensaje: "dos" });
  r.anotar({ mensaje: "x".repeat(400), origen: "y".repeat(400) });
  const lista = r.leer();
  assert.equal(lista.length, 2);
  assert.equal(lista[0].mensaje, "dos");
  assert.equal(lista[1].mensaje.length, 200);
  assert.equal(lista[1].origen.length, 150);
});

test("leer devuelve una copia", () => {
  const r = crearRastro();
  r.anotar({ mensaje: "a" });
  r.leer().pop();
  assert.equal(r.leer().length, 1);
});
```

Run: `node --test lib/error-trail.test.mjs` → FAIL.

- [ ] **Step 2: Implementar `lib/error-trail.ts`**

```ts
/**
 * Los últimos errores de la app, en memoria, para adjuntarlos a un reporte de
 * «Algo no funciona» (spec 2026-10-01 §6). Puro: el enganche a `window` vive
 * en components/report/error-trail-capture.tsx.
 */
export type ErrorAnotado = { mensaje: string; origen?: string; hora: string };

export function crearRastro(max = 5) {
  let lista: ErrorAnotado[] = [];
  return {
    anotar(e: { mensaje: string; origen?: string }, ahora: Date = new Date()): void {
      const mensaje = String(e.mensaje ?? "").slice(0, 200);
      if (!mensaje) return;
      const origen = e.origen ? e.origen.slice(0, 150) : undefined;
      lista = [...lista, { mensaje, ...(origen ? { origen } : {}), hora: ahora.toISOString() }].slice(-max);
    },
    leer(): ErrorAnotado[] {
      return [...lista];
    },
  };
}

export const rastroDeErrores = crearRastro();
```

Run: `node --test lib/error-trail.test.mjs` → PASS.

- [ ] **Step 3: `lib/report-browser.ts` y el enganche**

`lib/report-browser.ts`:

```ts
import { rastroDeErrores } from "@/lib/error-trail";

/**
 * Lo que viaja en `context` de todo reporte (spec 2026-10-01 §6). Solo se
 * llama desde un handler (al enviar), nunca en render: lee `window` y
 * `matchMedia` sin riesgo de hidratación. La ruta la pasa quien llama
 * (usePathname), para no leer `window.location`.
 */
export function contextoTecnico(ruta: string, conErrores: boolean): Record<string, unknown> {
  if (typeof window === "undefined") return { route: ruta };
  const standalone =
    window.matchMedia?.("(display-mode: standalone)").matches === true ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
  return {
    route: ruta,
    ua: navigator.userAgent.slice(0, 300),
    viewport: `${window.innerWidth}x${window.innerHeight}`,
    standalone,
    build: (process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA ?? "dev").slice(0, 7),
    ...(conErrores ? { errores: rastroDeErrores.leer() } : {}),
  };
}
```

`components/report/error-trail-capture.tsx`:

```tsx
"use client";

import { useEffect } from "react";

import { rastroDeErrores } from "@/lib/error-trail";

/** Anota los errores de la app para los reportes de «Algo no funciona». No pinta nada. */
export default function ErrorTrailCapture() {
  useEffect(() => {
    const alError = (e: ErrorEvent) =>
      rastroDeErrores.anotar({
        mensaje: e.message,
        origen: e.filename ? `${e.filename}:${e.lineno}` : undefined,
      });
    const alRechazo = (e: PromiseRejectionEvent) =>
      rastroDeErrores.anotar({
        mensaje: e.reason instanceof Error ? e.reason.message : String(e.reason),
      });
    window.addEventListener("error", alError);
    window.addEventListener("unhandledrejection", alRechazo);
    return () => {
      window.removeEventListener("error", alError);
      window.removeEventListener("unhandledrejection", alRechazo);
    };
  }, []);
  return null;
}
```

En `app/layout.tsx`, importa `ErrorTrailCapture from "@/components/report/error-trail-capture"` y móntalo justo después de `<InstallCapture />`.

- [ ] **Step 4: Type-check y commit**

```bash
npx tsc --noEmit
git add lib/error-trail.ts lib/error-trail.test.mjs lib/report-browser.ts components/report/error-trail-capture.tsx app/layout.tsx
git commit -m "feat(reportes): los reportes de fallos viajan con pantalla, navegador y últimos errores

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task B6: La hoja de reporte, la banderita y el botón de los juegos

**Files:**
- Create: `services/reports.service.ts`
- Create: `components/report/report-sheet.tsx`, `components/report/report-flag.tsx`, `components/report/report-button.tsx`
- Modify: `components/lesson/lesson-top-bar.tsx`

**Interfaces:**
- Consumes: B2 (`motivosPara`, `etiquetaMotivo`, `detalleMotivo`, `validarBorrador`, `cuerpoDelReporte`, `objetivoGeneral`, `ordenarParaJuego`, `LUGARES_APP`, `MAX_COMENTARIO`), B3 (`useCandidatosReporte`), B5 (`contextoTecnico`), B1 (`bandera`).
- Produces:
  - `createReportService(body: CuerpoReporte): Promise<{ id: number; merged: boolean }>`; `type ReportNotice = { id: number; outcome: "fixed" | "dismissed"; note: string | null; gems: number; prompt: string | null; resolvedAt: string }`; `getReportNoticesService(): Promise<ReportNotice[]>` (nunca lanza); `markReportNoticesSeenService(ids: number[]): Promise<void>`.
  - `<ReportSheet candidatos modo? onCerrar />`, `<ReportFlag objetivos? />`, `<ReportButton objetivos surface />`.
  - `LessonTopBar` pinta `ReportFlag` a la derecha cuando hay objetivos publicados.

- [ ] **Step 1: Servicio**

`services/reports.service.ts`:

```ts
import api from "@/lib/api-client";
import type { CuerpoReporte } from "@/lib/report";

/** Reportes del alumno (spec 2026-10-01 §3.2). El autor lo pone el servidor desde el token. */
export async function createReportService(
  body: CuerpoReporte,
): Promise<{ id: number; merged: boolean }> {
  const { data } = await api.post<{ id: number; merged: boolean }>("/reports", body);
  return data;
}

export type ReportNotice = {
  id: number;
  outcome: "fixed" | "dismissed";
  note: string | null;
  gems: number;
  prompt: string | null;
  resolvedAt: string;
};

/** Resultados aún no vistos. Nunca lanza: un aviso que falla no debe romper el hub. */
export async function getReportNoticesService(): Promise<ReportNotice[]> {
  try {
    const { data } = await api.get<{ notices: ReportNotice[] }>("/me/report-notices");
    return data.notices ?? [];
  } catch {
    return [];
  }
}

export async function markReportNoticesSeenService(ids: number[]): Promise<void> {
  await api.post("/me/report-notices/seen", { ids });
}
```

- [ ] **Step 2: La hoja**

`components/report/report-sheet.tsx`:

```tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

import Doty from "@/components/ui/doty/doty";
import UIButton from "@/components/ui/button/button";
import OverlayPortal from "@/components/ui/overlay-portal";
import { Icon } from "@/components/ui/icon";
import {
  LUGARES_APP,
  MAX_COMENTARIO,
  cuerpoDelReporte,
  detalleMotivo,
  etiquetaMotivo,
  motivosPara,
  objetivoGeneral,
  validarBorrador,
  type ReportReason,
  type ReportTarget,
} from "@/lib/report";
import { contextoTecnico } from "@/lib/report-browser";
import { bloquearScroll } from "@/lib/scroll-lock";
import { createReportService } from "@/services/reports.service";

interface Props {
  /** Lo que se puede reportar, congelado al abrir. Con más de uno, primero se elige. */
  candidatos: ReportTarget[];
  /** "app": el reporte general de Ajustes, sin ejercicio y con «¿Dónde pasó?». */
  modo?: "ejercicio" | "app";
  /** Estable (useCallback): el efecto de scroll depende de ella. */
  onCerrar: () => void;
}

type Paso = "elegir" | "motivos" | "gracias";

/**
 * La hoja de reporte (spec 2026-10-01 §1.3): «¿sobre cuál?» si hace falta,
 * «¿qué pasó?», comentario y envío. Solo pinta y envía: qué motivos salen, la
 * validación y el cuerpo viven en lib/report.ts. Es un diálogo de verdad
 * —toma el scroll con lib/scroll-lock—, así que pistas y avisos esperan a
 * que se cierre. RN-safe: todo con toques; la caja de comentario no es una
 * entrada para jugar.
 */
export default function ReportSheet({ candidatos, modo = "ejercicio", onCerrar }: Props) {
  const pathname = usePathname();
  const panelRef = useRef<HTMLDivElement>(null);
  const [elegido, setElegido] = useState<ReportTarget | null>(() =>
    modo === "app"
      ? objetivoGeneral("app", "Reportar un problema")
      : candidatos.length === 1
        ? candidatos[0]
        : null,
  );
  const [paso, setPaso] = useState<Paso>(elegido ? "motivos" : "elegir");
  const [motivos, setMotivos] = useState<ReportReason[]>([]);
  const [comentario, setComentario] = useState("");
  const [lugar, setLugar] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  // Foco al abrir, en su propio efecto (mismo motivo que install-sheet.tsx).
  useEffect(() => {
    panelRef.current?.focus();
  }, []);

  useEffect(() => {
    // En captura y sin propagar: si la hoja se abrió sobre Ajustes, Escape
    // cierra solo esta y no también la de abajo.
    const alTeclear = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      onCerrar();
    };
    document.addEventListener("keydown", alTeclear, true);
    const soltar = bloquearScroll();
    return () => {
      document.removeEventListener("keydown", alTeclear, true);
      soltar();
    };
  }, [onCerrar]);

  const alternar = (m: ReportReason) => {
    setError(null);
    setMotivos((prev) => (prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m]));
  };

  const enviar = () => {
    if (!elegido || enviando) return;
    const borrador = { motivos, comentario, lugar: lugar ?? undefined };
    const invalido = validarBorrador(borrador);
    if (invalido) {
      setError(invalido);
      return;
    }
    setEnviando(true);
    setError(null);
    const conErrores = motivos.includes("bug") || elegido.type === null;
    createReportService(cuerpoDelReporte(elegido, borrador, contextoTecnico(pathname, conErrores)))
      .then(() => setPaso("gracias"))
      .catch((e: unknown) => {
        const status = (e as { response?: { status?: number } })?.response?.status;
        setError(
          status === 429
            ? "Ya mandaste muchos reportes hoy. ¡Gracias! Vuelve mañana."
            : status === 503
              ? "Los reportes aún no están disponibles. Prueba más tarde."
              : "No se pudo enviar. Revisa tu conexión y vuelve a intentarlo.",
        );
      })
      .finally(() => setEnviando(false));
  };

  const fila = (on: boolean) => ({
    background: on ? "color-mix(in srgb, var(--accent) 12%, transparent)" : "var(--surface-2)",
    border: on ? "2px solid var(--accent)" : "2px solid transparent",
  });

  return (
    <OverlayPortal>
      <div className="fixed inset-0 z-50 flex items-end justify-center md:items-center">
        <div
          aria-hidden
          onClick={onCerrar}
          className="absolute inset-0"
          style={{ background: "var(--scrim)" }}
        />
        <div
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby="reporte-titulo"
          tabIndex={-1}
          className="relative z-10 flex max-h-[88svh] w-full flex-col overflow-y-auto rounded-t-3xl bg-(--surface) px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-5 [animation:dots-slide-up_.28s_ease-out_both] md:max-w-md md:rounded-3xl md:pb-5"
        >
          <button
            type="button"
            onClick={onCerrar}
            aria-label="Cerrar"
            className="absolute right-4 top-4 rounded-full p-2 text-(--muted) transition-transform duration-150 active:scale-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--accent)"
          >
            <Icon name="cruz" size={18} mono />
          </button>

          {paso === "elegir" && (
            <>
              <h2 id="reporte-titulo" className="pr-10 font-display text-xl font-extrabold text-foreground">
                ¿Sobre cuál ejercicio?
              </h2>
              <div className="mt-4 flex flex-col gap-2">
                {candidatos.map((c) => (
                  <button
                    key={c.key}
                    type="button"
                    onClick={() => {
                      setElegido(c);
                      setPaso("motivos");
                    }}
                    className="flex flex-col items-start gap-0.5 rounded-2xl px-4 py-3 text-left transition-transform duration-150 active:scale-[.98]"
                    style={fila(false)}
                  >
                    <span className="text-sm font-extrabold text-foreground">{c.label}</span>
                    {c.answer !== undefined && (
                      <span className="text-xs font-semibold text-(--muted)">Elegiste «{c.answer}»</span>
                    )}
                  </button>
                ))}
              </div>
            </>
          )}

          {paso === "motivos" && elegido && (
            <>
              <h2 id="reporte-titulo" className="pr-10 font-display text-xl font-extrabold text-foreground">
                ¿Qué pasó?
              </h2>
              {elegido.type !== null && (
                <p className="mt-1 line-clamp-2 text-sm font-semibold text-(--muted)">{elegido.label}</p>
              )}

              {modo === "app" && (
                <div className="mt-4 flex flex-col gap-2">
                  <span className="text-xs font-bold uppercase tracking-widest text-(--muted)">¿Dónde pasó?</span>
                  <div className="flex flex-wrap gap-2">
                    {LUGARES_APP.map((l) => {
                      const on = lugar === l.clave;
                      return (
                        <button
                          key={l.clave}
                          type="button"
                          aria-pressed={on}
                          onClick={() => setLugar(on ? null : l.clave)}
                          className="rounded-full px-3 py-1.5 text-sm font-extrabold transition-transform duration-150 active:scale-95"
                          style={{ ...fila(on), color: on ? "var(--accent)" : "var(--foreground)" }}
                        >
                          {l.etiqueta}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="mt-4 flex flex-col gap-2">
                {motivosPara(elegido).map((m) => {
                  const on = motivos.includes(m);
                  const detalle = detalleMotivo(m, elegido);
                  return (
                    <button
                      key={m}
                      type="button"
                      role="checkbox"
                      aria-checked={on}
                      onClick={() => alternar(m)}
                      className="flex items-start gap-3 rounded-2xl px-4 py-3 text-left transition-transform duration-150 active:scale-[.98]"
                      style={fila(on)}
                    >
                      <span
                        aria-hidden
                        className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-md"
                        style={{
                          background: on ? "var(--accent)" : "transparent",
                          border: on ? "none" : "2px solid var(--border)",
                          color: "var(--accent-contrast)",
                        }}
                      >
                        {on && <Icon name="check" size={14} mono />}
                      </span>
                      <span className="flex min-w-0 flex-col gap-0.5">
                        <span className="text-sm font-extrabold text-foreground">{etiquetaMotivo(m, elegido)}</span>
                        {detalle && <span className="text-xs font-semibold text-(--muted)">{detalle}</span>}
                      </span>
                    </button>
                  );
                })}
              </div>

              <label className="mt-4 flex flex-col gap-1">
                <span className="text-xs font-bold uppercase tracking-widest text-(--muted)">Cuéntanos más</span>
                <textarea
                  value={comentario}
                  onChange={(e) => {
                    setError(null);
                    setComentario(e.target.value);
                  }}
                  maxLength={MAX_COMENTARIO}
                  rows={3}
                  placeholder={motivos.includes("other") ? "¿Qué viste?" : "Opcional"}
                  className="w-full resize-none rounded-2xl border-2 border-(--border) bg-(--surface-2) px-4 py-3 text-sm font-semibold text-foreground outline-none focus:border-(--accent)"
                />
              </label>

              {error && (
                <p role="alert" className="mt-3 text-sm font-bold text-(--danger)">
                  {error}
                </p>
              )}

              <div className="mt-4">
                <UIButton tone="accent" onClick={enviar} disabled={enviando} fullWidth>
                  {enviando ? "Enviando…" : "Enviar reporte"}
                </UIButton>
              </div>
            </>
          )}

          {paso === "gracias" && (
            <div className="flex flex-col items-center gap-3 py-4 text-center">
              <Doty pose="aplaudiendo" size="small" animation="bob" />
              <h2 id="reporte-titulo" className="font-display text-xl font-extrabold text-foreground">
                ¡Gracias! Lo revisamos
              </h2>
              <p className="text-sm font-semibold text-(--muted)">
                {modo === "app"
                  ? "Si es un fallo, lo vamos a arreglar."
                  : "Sigue con lo tuyo: reportar no gasta vidas ni avance."}
              </p>
              <div className="mt-2 w-full">
                <UIButton tone="accent" onClick={onCerrar} fullWidth>
                  {modo === "app" ? "Listo" : "Volver al ejercicio"}
                </UIButton>
              </div>
            </div>
          )}
        </div>
      </div>
    </OverlayPortal>
  );
}
```

Antes de dar por buenos los props: comprueba que `Icon` acepta `mono` (`grep -n "mono" components/ui/icon/*.tsx`) y que `Doty` acepta `animation="bob"` (ya lo usan `install-sheet.tsx` y `practice-container.tsx`).

- [ ] **Step 3: La banderita y el botón**

`components/report/report-flag.tsx`:

```tsx
"use client";

import { useCallback, useState } from "react";

import ReportSheet from "@/components/report/report-sheet";
import { Icon } from "@/components/ui/icon";
import { useCandidatosReporte } from "@/hooks/use-report-targets";
import type { ReportTarget } from "@/lib/report";

/**
 * La banderita (spec 2026-10-01 §1.1). Sin props lee lo que la pantalla
 * publicó en lib/report-targets.ts; con `objetivos`, usa esos. Congela la
 * lista al abrir: si la pantalla avanza sola, la hoja no cambia bajo el dedo.
 * El área táctil (46 px) es mayor que el glifo, como el lápiz del perfil.
 */
export default function ReportFlag({ objetivos }: { objetivos?: ReportTarget[] }) {
  const publicados = useCandidatosReporte();
  const lista = objetivos ?? publicados;
  const [abierta, setAbierta] = useState<ReportTarget[] | null>(null);
  const cerrar = useCallback(() => setAbierta(null), []);

  return (
    <>
      {lista.length > 0 && (
        <button
          type="button"
          onClick={() => setAbierta(lista)}
          aria-label="Reportar un problema"
          className="relative shrink-0 rounded-full p-1.5 text-(--muted) transition-transform duration-150 before:absolute before:-inset-1.5 before:content-[''] active:scale-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--accent)"
        >
          <Icon name="bandera" size={22} />
        </button>
      )}
      {abierta && <ReportSheet candidatos={abierta} onCerrar={cerrar} />}
    </>
  );
}
```

`components/report/report-button.tsx`:

```tsx
"use client";

import { useCallback, useState } from "react";

import ReportSheet from "@/components/report/report-sheet";
import UIButton from "@/components/ui/button/button";
import { Icon } from "@/components/ui/icon";
import {
  objetivoGeneral,
  ordenarParaJuego,
  type ReportSurface,
  type ReportTarget,
} from "@/lib/report";

/**
 * «Reportar un problema» al final de una partida (spec 2026-10-01 §1.5): los
 * ítems de la ronda, primero los fallados, y al final «El juego en general».
 */
export default function ReportButton({
  objetivos,
  surface,
}: {
  objetivos: readonly ReportTarget[];
  surface: ReportSurface;
}) {
  const [abierta, setAbierta] = useState<ReportTarget[] | null>(null);
  const cerrar = useCallback(() => setAbierta(null), []);
  return (
    <>
      <UIButton
        tone="ghost"
        fullWidth
        onClick={() =>
          setAbierta([...ordenarParaJuego(objetivos), objetivoGeneral(surface, "El juego en general")])
        }
      >
        <span className="inline-flex items-center gap-2">
          <Icon name="bandera" size={18} />
          Reportar un problema
        </span>
      </UIButton>
      {abierta && <ReportSheet candidatos={abierta} onCerrar={cerrar} />}
    </>
  );
}
```

- [ ] **Step 4: `LessonTopBar` pinta la banderita**

En `components/lesson/lesson-top-bar.tsx`, importa `ReportFlag from "@/components/report/report-flag"` y, después del `<div className="flex-1">…</div>` de la barra de progreso, añade:

```tsx
      {/* Solo aparece si la pantalla publicó qué reportar (lib/report-targets.ts). */}
      <ReportFlag />
```

Añade `"use client";` como primera línea del archivo (ahora usa un hook a través de `ReportFlag`; todos sus importadores ya son cliente).

- [ ] **Step 5: Lint, build y commit**

```bash
npm run lint && npx next build
git add services/reports.service.ts components/report components/lesson/lesson-top-bar.tsx
git commit -m "feat(reportes): hoja de reporte, banderita en la barra de las lecciones y botón para los juegos

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

Expected: lint y build limpios. Todavía ninguna pantalla publica objetivos, así que nada cambia a la vista.

### Patrón de integración (vale para B7–B10)

Cada pantalla hace exactamente dos cosas, y nada más:

1. **Publicar** lo que tiene delante, con un `useMemo` que arma los objetivos desde su estado y `usePublicarObjetivos(objetivos)` llamado **antes de cualquier `return` temprano** (regla de hooks). Si el ítem ya está respondido, el objetivo va con `conRespuesta(...)`. Si en ese momento la pantalla no es la dueña del ejercicio (un hijo lo es), pasa `null`.
2. **Registrar** lo respondido con `registrarRespondido(conRespuesta(objetivo, { answer, expected, wasWrong }))` **dentro del handler que corrige** (evento), nunca en un efecto. `wasWrong: null` en checkpoint, placement y lecturas.

Donde ya hay `LessonTopBar`, la banderita aparece sola. Donde no la hay, monta `<ReportFlag />` en la fila superior de la pantalla, alineada a la derecha.

Imports habituales:

```ts
import ReportFlag from "@/components/report/report-flag";
import { usePublicarObjetivos } from "@/hooks/use-report-targets";
import { conRespuesta /* + el constructor que toque */ } from "@/lib/report";
import { registrarRespondido } from "@/lib/report-targets";
```

### Task B7: Práctica (y «Arma la oración» acepta otro orden)

**Files:**
- Modify: `types/practice.types.ts` (`Sentence`)
- Modify: `components/practice-container/practice-container.tsx:23-31` (props), `:73-117` (`selectHandler`, `reorderHandler`)
- Modify: `app/(app)/practice/page.tsx`

**Interfaces:**
- Consumes: `objetivoDePractica`, `esperadaDePractica`, `conRespuesta` (B2); `usePublicarObjetivos`, `registrarRespondido` (B3); `esOracionAceptada` (B4); `accepted_texts` del backend (A3).
- Produces: `PracticeContainer` `click: (correct: boolean, respuesta: string) => void`.

- [ ] **Step 1: Tipo**

En `types/practice.types.ts`, dentro de `Sentence`, añade:

```ts
  /** «Arma la oración»: otros órdenes que el admin aceptó (spec reportes §4). */
  accepted_texts?: string[];
```

- [ ] **Step 2: El contenedor pasa la respuesta y acepta otro orden**

En `practice-container.tsx`:

- importa `import { esOracionAceptada } from "@/lib/accepted-answers";`
- la prop pasa a `click: (correct: boolean, respuesta: string) => void;`
- en `selectHandler`, rama `buildUp`, dentro del `setTimeout`, cambia `click(text.toUpperCase() === dataSentence.text.toUpperCase());` por:

```ts
        click(esOracionAceptada(text, dataSentence.text, dataSentence.accepted_texts), text);
```

- en la rama de elegir, `click(item.correct);` pasa a `click(item.correct, item.word);`
- en `reorderHandler`, cambia `click(text.toUpperCase() === dataSentence.text.toUpperCase());` por `click(esOracionAceptada(text, dataSentence.text, dataSentence.accepted_texts), text);`

- [ ] **Step 3: La página publica y registra**

En `app/(app)/practice/page.tsx`:

- añade `useMemo` al import de React y los imports del patrón (`conRespuesta, esperadaDePractica, objetivoDePractica`).
- estado nuevo junto a `answer`: `const [respuesta, setRespuesta] = useState<string | null>(null);`
- `isSelectedHandler` pasa a:

```ts
  const isSelectedHandler = (correct: boolean, texto: string) => {
    setAnswer(correct);
    setRespuesta(texto);
    setConfirmReady(true);
  };
```

- mueve la declaración `const isFinalMode = mode === "finished" || mode === "perfect" || mode === "gameover";` justo debajo de los `useState` (hoy está en la sección de render; las funciones que la usan son closures y no se enteran).
- debajo de esa línea:

```ts
  // Reportes (spec 2026-10-01): la oración en pantalla, con su respuesta si ya se corrigió.
  const sentenciaActual = arraySentences[indexSentence];
  const objetivosPractica = useMemo(() => {
    if (!sentenciaActual || isFinalMode || mode === "streak") return [];
    const base = objetivoDePractica(sentenciaActual, mode, id);
    if (answerState === "" || respuesta === null) return [base];
    return [
      conRespuesta(base, {
        answer: respuesta,
        expected: esperadaDePractica(sentenciaActual, mode),
        wasWrong: answerState === "wrong",
      }),
    ];
  }, [sentenciaActual, isFinalMode, mode, id, answerState, respuesta]);
  usePublicarObjetivos(objetivosPractica);
```

- en `confirmSelectedHandler`, primera línea dentro de `if (answerState === "") {`:

```ts
      if (sentenciaActual && respuesta !== null) {
        registrarRespondido(
          conRespuesta(objetivoDePractica(sentenciaActual, mode, id), {
            answer: respuesta,
            expected: esperadaDePractica(sentenciaActual, mode),
            wasWrong: !answer,
          }),
        );
      }
```

- en `nextSentenceHandler`, junto a `setAnswer(null);`, añade `setRespuesta(null);`.

- [ ] **Step 4: Verificar y commit**

```bash
npm run lint && npx tsc --noEmit
git add types/practice.types.ts components/practice-container/practice-container.tsx "app/(app)/practice/page.tsx"
git commit -m "feat(reportes): la práctica publica la oración en pantalla y «Arma la oración» acepta otros órdenes

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task B8: Gramática, pronunciación y repaso

**Files:**
- Modify: `services/lessons.service.ts` (`GrammarContent`, `PronunciationContent`: `refId?: number`)
- Modify: `components/lesson/grammar/grammar-pill.tsx`
- Modify: `components/lesson/pronunciation/pronunciation-drill.tsx`
- Modify: `components/review/review-quiz.tsx`

**Interfaces:**
- Consumes: `objetivoDeGramatica`, `objetivoDePildora`, `objetivoDePronunciacion`, `objetivoDeUnidad`, `objetivoDeOracion` (B2); `refId` del backend (A3).

- [ ] **Step 1: Tipos**

En `services/lessons.service.ts`, añade `refId?: number;` a `GrammarContent` y a `PronunciationContent` (id de la píldora / unidad; lo manda el backend desde A3).

- [ ] **Step 2: Gramática**

En `grammar-pill.tsx`, con los imports del patrón (`conRespuesta, objetivoDeGramatica, objetivoDePildora`, `useMemo`), justo después del `useEffect` que manda el progreso y antes de `if (stage === "explain")`:

```ts
  const itemActual = series.current;
  const objetivos = useMemo(() => {
    if (stage === "explain") return [objetivoDePildora(content, nodeId)];
    if (series.finished || !itemActual) return [];
    const base = objetivoDeGramatica(itemActual, nodeId);
    if (series.answerState === "" || selectedWord === null) return [base];
    return [
      conRespuesta(base, {
        answer: selectedWord,
        expected: itemActual.options.find((o) => o.correct)?.word,
        wasWrong: series.answerState === "wrong",
      }),
    ];
  }, [stage, series.finished, itemActual, series.answerState, selectedWord, content, nodeId]);
  usePublicarObjetivos(objetivos);
```

En los dos caminos que confirman —`confirmHandler` y el `onEnter` de `useLessonKeys`—, justo después de calcular `correct` y antes de `series.confirm()`:

```ts
    registrarRespondido(
      conRespuesta(objetivoDeGramatica(item, nodeId), {
        answer: selectedWord,
        expected: item.options.find((o) => o.correct)?.word,
        wasWrong: !correct,
      }),
    );
```

(en `onEnter` la variable del ítem se llama `cur`: usa esa.)

En la etapa `explain`, como primer hijo del `<div className="flex flex-col gap-4 w-full">`, añade la fila de la banderita:

```tsx
        <div className="flex justify-end">
          <ReportFlag />
        </div>
```

- [ ] **Step 3: Pronunciación**

En `pronunciation-drill.tsx`, antes del primer `return` (con `useMemo` e imports del patrón: `conRespuesta, objetivoDePronunciacion, objetivoDeUnidad`):

```ts
  const itemActual = series.current;
  const objetivos = useMemo(() => {
    if (stage === "start") return [objetivoDeUnidad(content, nodeId)];
    if (stage === "done" || series.finished || !itemActual) return [];
    const base = objetivoDePronunciacion(itemActual, nodeId);
    if (series.answerState === "" || selectedWord === null) return [base];
    return [
      conRespuesta(base, {
        answer: selectedWord,
        expected: itemActual.options.find((o) => o.correct)?.word,
        wasWrong: series.answerState === "wrong",
      }),
    ];
  }, [stage, series.finished, itemActual, series.answerState, selectedWord, content, nodeId]);
  usePublicarObjetivos(objetivos);
```

En `tap(word, correct)`, después de `series.select(correct);`:

```ts
    registrarRespondido(
      conRespuesta(objetivoDePronunciacion(cur, nodeId), {
        answer: word,
        expected: cur.options.find((o) => o.correct)?.word,
        wasWrong: !correct,
      }),
    );
```

En la etapa `start`, como primer hijo de `<PanelWrapper>`: `<div className="flex w-full justify-end"><ReportFlag /></div>`. La etapa `play` ya tiene `LessonTopBar`. Al acertar avanza sola a los 900 ms: el registro hace que «el anterior» siga disponible.

- [ ] **Step 4: Repaso**

En `review-quiz.tsx`, antes del `if (series.finished)` (imports: `conRespuesta, objetivoDeOracion`):

```ts
  const objetivos = useMemo(() => {
    if (series.finished || !cur) return [];
    const base = objetivoDeOracion(
      { id: cur.sentenceId, text: cur.text, options: cur.options.map((o) => o.word) },
      "review",
    );
    if (!answered || selectedWord === null) return [base];
    return [
      conRespuesta(base, {
        answer: selectedWord,
        expected: cur.options.find((o) => o.correct)?.word,
        wasWrong: series.answerState === "wrong",
      }),
    ];
  }, [series.finished, cur, answered, selectedWord, series.answerState]);
  usePublicarObjetivos(objetivos);
```

En `confirmHandler`, después de `resultsRef.current.push(...)`:

```ts
    registrarRespondido(
      conRespuesta(
        objetivoDeOracion(
          { id: cur.sentenceId, text: cur.text, options: cur.options.map((o) => o.word) },
          "review",
        ),
        { answer: selectedWord, expected: cur.options.find((o) => o.correct)?.word, wasWrong: !correct },
      ),
    );
```

- [ ] **Step 5: Verificar y commit**

```bash
npm run lint && npx tsc --noEmit
git add services/lessons.service.ts components/lesson/grammar/grammar-pill.tsx components/lesson/pronunciation/pronunciation-drill.tsx components/review/review-quiz.tsx
git commit -m "feat(reportes): gramática, pronunciación y repaso publican lo que hay en pantalla

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task B9: Vocabulario, letras y números

**Files:**
- Modify: `components/lesson/shared/audio-choice-quiz.tsx` (tipo `AudioChoice`, publicar y registrar)
- Modify: `components/lesson/vocab/listen-quiz.tsx`, `components/lesson/vocab/match-quiz.tsx` (prop `nodeId`, publicar y registrar)
- Modify: `components/lesson/vocab/vocab-pack.tsx` (presentación, `inverseItems`/`inversePool` l.~69-82, pasar `nodeId`)
- Modify: `app/(app)/lesson/letters/page.tsx`, `app/(app)/lesson/numbers/page.tsx`

**Interfaces:**
- Consumes: `objetivoDeVocab`, `objetivoDeLetra`, `objetivoDeNumero`, `conRespuesta` (B2).
- Produces: `AudioChoice` gana `objetivo?: ReportTarget` (el ítem como objetivo) y `respuesta?: string` (cómo se nombra al elegirlo: la palabra en inglés, la letra o el número en palabra). `ListenQuiz` y `MatchQuiz` ganan `nodeId: number`.

- [ ] **Step 1: `AudioChoiceQuiz` (compartido por los tres)**

En el tipo `AudioChoice` añade:

```ts
  /** El ítem como objetivo de reporte; sin él, el quiz no publica nada. */
  objetivo?: ReportTarget;
  /** Cómo se nombra este audio al elegirlo («Elegiste «big»»). */
  respuesta?: string;
```

(importa `type ReportTarget` de `@/lib/report`). Antes del `if (!target) return null;`:

```ts
  const objetivos = useMemo(() => {
    if (!target?.objetivo) return null;
    if (feedback === null || selected === null) return [target.objetivo];
    const elegido = options.find((o) => o.id === selected);
    return [
      conRespuesta(target.objetivo, {
        answer: elegido?.respuesta ?? elegido?.prompt ?? "",
        expected: target.respuesta ?? target.prompt,
        wasWrong: feedback === "wrong",
      }),
    ];
  }, [target, feedback, selected, options]);
  usePublicarObjetivos(objetivos);
```

En `check()`, justo después de `lockRef.current = true;`:

```ts
    if (target.objetivo) {
      const elegido = options.find((o) => o.id === selected);
      registrarRespondido(
        conRespuesta(target.objetivo, {
          answer: elegido?.respuesta ?? elegido?.prompt ?? "",
          expected: target.respuesta ?? target.prompt,
          wasWrong: selected !== target.id,
        }),
      );
    }
```

- [ ] **Step 2: `ListenQuiz`**

Prop nueva `nodeId: number`. Antes del `if (!target) return null;`:

```ts
  const objetivos = useMemo(() => {
    if (!target) return [];
    const base = objetivoDeVocab(target, "lesson-vocab", "listen", { nodeId });
    if (!feedback) return [base];
    const elegido = options.find((o) => o.id === feedback.id);
    return [
      conRespuesta(base, {
        answer: elegido?.meaning ?? "",
        expected: target.meaning,
        wasWrong: !feedback.ok,
      }),
    ];
  }, [target, feedback, options, nodeId]);
  usePublicarObjetivos(objetivos);
```

En `answer(option)`, después de `lockRef.current = true;`:

```ts
    registrarRespondido(
      conRespuesta(objetivoDeVocab(target, "lesson-vocab", "listen", { nodeId }), {
        answer: option.meaning,
        expected: target.meaning,
        wasWrong: option.id !== target.id,
      }),
    );
```

- [ ] **Step 3: `MatchQuiz`**

Prop nueva `nodeId: number`. Después de `esColumn`:

```ts
  const objetivos = useMemo(
    () => round.map((item) => objetivoDeVocab(item, "lesson-vocab", "match", { nodeId })),
    [round, nodeId],
  );
  usePublicarObjetivos(objetivos);
```

En `evaluate(enId, esId)`, en la rama de fallo (`else`), antes de lo que ya hace:

```ts
      const en = round.find((i) => i.id === enId);
      const es = round.find((i) => i.id === esId);
      if (en && es) {
        registrarRespondido(
          conRespuesta(objetivoDeVocab(en, "lesson-vocab", "match", { nodeId }), {
            answer: es.meaning,
            expected: en.meaning,
            wasWrong: true,
          }),
        );
      }
```

- [ ] **Step 4: `VocabPack`**

- Pasa `nodeId={nodeId}` a `ListenQuiz` y `MatchQuiz`.
- Donde se arman `inverseItems` y `inversePool` (l.~69-82), añade a cada `AudioChoice` `respuesta: item.text`, y a los de `inverseItems` además `objetivo: objetivoDeVocab(item, "lesson-vocab", "inverse", { nodeId })` (añade `nodeId` a las dependencias del memo).
- Presentación: antes del primer `return` del componente:

```ts
  const objetivosPresentacion = useMemo(
    () => newItems.map((item) => objetivoDeVocab(item, "lesson-vocab", "present", { nodeId })),
    [newItems, nodeId],
  );
  // En las otras etapas publica el hijo; en el resumen no hay nada que reportar.
  usePublicarObjetivos(
    stage === "present" ? objetivosPresentacion : stage === "summary" ? [] : null,
  );
```

  (si `newItems` se calcula más abajo con otra forma, usa la variable real que alimenta las `WordCard` de la presentación).
- En la etapa `present`, como primer hijo del contenedor: `<div className="flex justify-end"><ReportFlag /></div>`. Las demás etapas tienen `LessonTopBar`.

- [ ] **Step 5: Letras**

En `LettersDrill` (`app/(app)/lesson/letters/page.tsx`), antes del primer `return`:

```ts
  const objetivos = useMemo(() => {
    if (stage === "present") return tramo.map((it) => objetivoDeLetra(it, "present", nodeId));
    if (stage === "inverse") return null; // publica AudioChoiceQuiz
    if (stage === "done" || !target) return [];
    const base = objetivoDeLetra(target, "direct", nodeId);
    if (feedback === "idle" || picked === null) return [base];
    return [conRespuesta(base, { answer: picked, expected: target.letter, wasWrong: feedback !== "correct" })];
  }, [stage, tramo, target, feedback, picked, nodeId]);
  usePublicarObjetivos(objetivos);
```

(usa los valores reales del tipo `Feedback`: `grep -n "type Feedback" app/\(app\)/lesson/letters/page.tsx`.) En `onPick(letter)`, después de `advancingRef.current = true;`:

```ts
    registrarRespondido(
      conRespuesta(objetivoDeLetra(target, "direct", nodeId), {
        answer: letter,
        expected: target.letter,
        wasWrong: letter !== target.letter,
      }),
    );
```

En el memo de `inverseItems`, añade a cada ítem `respuesta: it.letter` y `objetivo: objetivoDeLetra(it, "inverse", nodeId)`; en el pool, `respuesta: it.letter`. En las etapas `present`, `inverse` y la directa, envuelve la línea de progreso (`<p className="text-center text-xs font-bold text-(--muted)">…</p>`) en una fila con la banderita:

```tsx
      <div className="flex items-center justify-between gap-2">
        <p className="flex-1 text-center text-xs font-bold text-(--muted)">…</p>
        <ReportFlag />
      </div>
```

- [ ] **Step 6: Números**

En `NumbersDrill`, antes del primer `return`:

```ts
  const objetivos = useMemo(() => {
    if (phase !== "recognize") return phase === "done" ? [] : null; // inverse y match publican sus hijos
    if (!target) return [];
    const base = objetivoDeNumero(target, "recognize", nodeId);
    if (!feedback) return [base];
    return [
      conRespuesta(base, {
        answer: String(feedback.value),
        expected: String(target.value),
        wasWrong: feedback.kind !== "correct",
      }),
    ];
  }, [phase, target, feedback, nodeId]);
  usePublicarObjetivos(objetivos);
```

(ajusta `feedback.value`/`feedback.kind` a los nombres reales del estado de l.~148-151). En el handler de l.~330 (`if (value === target.value)`), antes del `if`:

```ts
    registrarRespondido(
      conRespuesta(objetivoDeNumero(target, "recognize", nodeId), {
        answer: String(value),
        expected: String(target.value),
        wasWrong: value !== target.value,
      }),
    );
```

En los ítems de la ronda inversa, `respuesta: it.word` y `objetivo: objetivoDeNumero(it, "inverse", nodeId)` (pool: `respuesta: it.word`).

En `MatchRound` (mismo archivo, l.~447) añade la prop `nodeId: number` (y pásala desde `NumbersDrill`). Después de `const words = useMemo(...)`:

```ts
  const objetivos = useMemo(
    () => chunk.map((it) => objetivoDeNumero(it, "match", nodeId)),
    [chunk, nodeId],
  );
  usePublicarObjetivos(objetivos);
```

y en `evaluate`, en la rama `else` (pareja errada), antes de `onWrong(leftId);`:

```ts
      const izq = chunk.find((it) => it.id === leftId);
      const der = chunk.find((it) => it.id === rightId);
      if (izq && der) {
        registrarRespondido(
          conRespuesta(objetivoDeNumero(izq, "match", nodeId), {
            answer: der.word,
            expected: izq.word,
            wasWrong: true,
          }),
        );
      }
```

En cada fase (`recognize`, `inverse`, `match`), primer hijo del contenedor: `<div className="flex justify-end"><ReportFlag /></div>`.

- [ ] **Step 7: Verificar y commit**

```bash
npm run lint && npx tsc --noEmit
git add components/lesson app/\(app\)/lesson
git commit -m "feat(reportes): vocabulario, letras y números publican lo que hay en pantalla, también al avanzar solos

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task B10: Checkpoint, placement y lecturas

**Files:**
- Modify: `components/checkpoint/checkpoint-exam.tsx`
- Modify: `components/onboarding/placement-test.tsx`
- Modify: `app/(app)/readings/[id]/page.tsx`

**Interfaces:**
- Consumes: `objetivoDeOracion`, `objetivoDeLectura`, `objetivoDePregunta`, `conRespuesta` (B2).

- [ ] **Step 1: Checkpoint (sin «debería estar bien»: `wasWrong: null`)**

En `checkpoint-exam.tsx`, antes de `if (!question) return null;`:

```ts
  const objetivos = useMemo(() => {
    if (!question) return [];
    const base = objetivoDeOracion(
      { id: question.sentenceId, text: question.text, options: question.options },
      "checkpoint",
      { context: { attemptId: exam.attemptId } },
    );
    return [selected === null ? base : conRespuesta(base, { answer: selected, wasWrong: null })];
  }, [question, selected, exam.attemptId]);
  usePublicarObjetivos(objetivos);
```

En `confirm()`, después del `if (!question || selected === null) return;`:

```ts
    registrarRespondido(
      conRespuesta(
        objetivoDeOracion(
          { id: question.sentenceId, text: question.text, options: question.options },
          "checkpoint",
          { context: { attemptId: exam.attemptId } },
        ),
        { answer: selected, wasWrong: null },
      ),
    );
```

- [ ] **Step 2: Placement**

En `placement-test.tsx`, lo mismo con `"placement"` y `{ context: { testId: test.testId } }`, usando `question` y `selected`; el registro va al principio de `confirm()`, tras el guard.

- [ ] **Step 3: Lecturas**

En `app/(app)/readings/[id]/page.tsx`, después del `useMemo` de `quiz` y antes de cualquier `return`:

```ts
  const objetivos = useMemo(() => {
    if (!reading) return [];
    const lectura = objetivoDeLectura(reading);
    if (stage === "read") return [lectura];
    return [
      lectura,
      ...quiz.map((q) => {
        const t = objetivoDePregunta(reading, q);
        return answers[q.idx] !== undefined ? conRespuesta(t, { answer: answers[q.idx], wasWrong: null }) : t;
      }),
    ];
  }, [reading, stage, quiz, answers]);
  usePublicarObjetivos(objetivos);
```

En la barra superior, después del `<Icon name="lectura" size={24} />`, añade `<ReportFlag />`. No hay registro: la lectura no corrige pregunta a pregunta.

- [ ] **Step 4: Verificar y commit**

```bash
npm run lint && npx tsc --noEmit
git add components/checkpoint/checkpoint-exam.tsx components/onboarding/placement-test.tsx "app/(app)/readings/[id]/page.tsx"
git commit -m "feat(reportes): checkpoint, placement y lecturas se pueden reportar sin revelar la corrección

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task B11: «Reportar un problema» en Ajustes

**Files:**
- Modify: `components/profile/settings-sheet.tsx` (sección «Acciones», l.~281)

- [ ] **Step 1: Fila y hoja**

Importa `ReportSheet from "@/components/report/report-sheet"` y `useCallback`. Estado: `const [reportando, setReportando] = useState(false);` y `const cerrarReporte = useCallback(() => setReportando(false), []);`. En la sección «Acciones», como primer botón (encima de «Cambiar avatar»), con el mismo estilo que ese:

```tsx
            <button
              type="button"
              onClick={() => setReportando(true)}
              className="flex items-center justify-between rounded-2xl bg-(--surface-2) px-4 py-3 text-sm font-extrabold text-foreground"
            >
              <span className="inline-flex items-center gap-2">
                <Icon name="bandera" size={18} />
                Reportar un problema
              </span>
              <Icon name="derecha" size={16} mono />
            </button>
```

Y justo antes de cerrar el `</OverlayPortal>`: `{reportando && <ReportSheet candidatos={[]} modo="app" onCerrar={cerrarReporte} />}`. La hoja se abre ENCIMA de Ajustes (las dos toman el scroll; `lib/scroll-lock` cuenta) y al cerrarla vuelves a Ajustes.

- [ ] **Step 2: Verificar y commit**

```bash
npm run lint && npx tsc --noEmit
git add components/profile/settings-sheet.tsx
git commit -m "feat(reportes): Ajustes gana «Reportar un problema» para lo que no es un ejercicio

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task B12: Juegos de oraciones (+ alternativas en el cliente)

**Files:**
- Modify: `components/games/shared/game-result.tsx` (prop `reportables`)
- Modify: `services/games.service.ts` (`BuilderSentence.answers?`, `GameWord.accepted?`)
- Modify: `app/(app)/games/audio-blitz/page.tsx`, `ghost-race/page.tsx`, `dotaxi/page.tsx`, `sentence-builder/page.tsx`, `dont-pop/page.tsx`

**Interfaces:**
- Consumes: `objetivoDeOracion`, `objetivo`, `conRespuesta` (B2); `ReportButton` (B6); `primerFalloEnOrden`, `sinAceptadas` (B4); `answers`/`accepted` del backend (A5).
- Produces: `GameResult` acepta `reportables?: readonly ReportTarget[]`.

**Patrón de juego:** cada página guarda los ítems vistos en estado —`const [vistos, setVistos] = useState<ReportTarget[]>([]);`—, los añade en el handler que corrige con `setVistos((v) => [...v, objetivo])` (updater puro), los vacía en el handler que arranca partida (`startGame` o el equivalente) con `setVistos([])` y los pasa a `<GameResult … reportables={vistos} />`. Nunca leas un ref para pasarlo como prop (lint del compiler).

- [ ] **Step 1: `GameResult`**

Prop nueva `reportables?: readonly ReportTarget[]` (importa `type ReportTarget` de `@/lib/report` y `ReportButton`). Dentro del bloque de acciones, después del botón «Salir»:

```tsx
          {reportables && <ReportButton objetivos={reportables} surface={`game:${gameKey}`} />}
```

- [ ] **Step 2: Tipos de servicio**

En `services/games.service.ts`: `BuilderSentence` gana `answers?: string[][];` y `GameWord` gana `accepted?: string[];`.

- [ ] **Step 3: Escucha Rápida y Carrera Fantasma**

En `audio-blitz/page.tsx`, en el handler de l.~207 (`if (option === item.correct)`), justo antes del `if`:

```ts
      setVistos((v) => [
        ...v,
        conRespuesta(
          objetivoDeOracion({ id: item.id, text: item.text, options: item.options }, "game:audio-blitz", { hasAudio: true }),
          { answer: option, expected: item.correct, wasWrong: option !== item.correct },
        ),
      ]);
```

Si existe un handler de tiempo agotado por pregunta, añade allí el objetivo sin respuesta: `setVistos((v) => [...v, objetivoDeOracion({ id: item.id, text: item.text, options: item.options }, "game:audio-blitz", { hasAudio: true })])`. Pasa `reportables={vistos}` al `<GameResult>` de l.~492 y vacía en `startGame`.

En `ghost-race/page.tsx` haz lo mismo en el handler de l.~411 con superficie `"game:ghost-race"`. Este juego no usa `GameResult`: pasa `vistos` como prop nueva al `ResultCard` local (l.~72-100) y, dentro de su bloque de botones, monta `<ReportButton objetivos={vistos} surface="game:ghost-race" />`. Vacía en el `onReplay` de l.~792.

- [ ] **Step 4: Dotaxi**

En `resolve()` (l.~533), justo después de `const hit = chosen === question.correct;`:

```ts
    setVistos((v) => [
      ...v,
      conRespuesta(
        objetivoDeOracion({ id: question.id, text: question.text, options: laneOptions }, "game:dotaxi"),
        { answer: chosen ?? "", expected: question.correct, wasWrong: !hit },
      ),
    ]);
```

Si `resolve` es un `useCallback`, `setVistos` es estable y no hace falta en las dependencias. `reportables={vistos}` en el `<GameResult>` de l.~1115; vaciar en `startGame`.

- [ ] **Step 5: Constructor (acepta otro orden)**

En `handleCheck` (l.~264), sustituye el bucle que calcula `wrongIdx` por:

```ts
    // Cualquier orden aceptado vale (spec reportes §4); sin `answers` (backend viejo), solo el de referencia.
    const wrongIdx = primerFalloEnOrden(trayChips, s.answers ?? [s.answer]);
```

y antes del `if (wrongIdx === null)`:

```ts
    setVistos((v) => [
      ...v,
      conRespuesta(
        objetivoDeOracion({ id: s.id, text: s.answer.join(" ") }, "game:sentence-builder", { mode: "order", hasAudio: true }),
        { answer: trayChips.join(" "), expected: s.answer.join(" "), wasWrong: wrongIdx !== null },
      ),
    ]);
```

(importa `primerFalloEnOrden` de `@/lib/accepted-answers`; `wrongIdx` deja de ser `let`). `reportables={vistos}` en su `<GameResult>`; vaciar al arrancar.

- [ ] **Step 6: ¡No lo revientes!**

Donde se arma `current` (`setCurrent({ word, options })`), filtra los distractores antes de mezclarlos con la correcta: `const distractores = sinAceptadas(candidatos, word.accepted);` (usa el nombre real del array de candidatos; importa `sinAceptadas`). En `answer(option)` (l.~208), antes del `if (option === current.word.title)`:

```ts
      setVistos((v) => [
        ...v,
        conRespuesta(
          objetivo({
            type: "sentence",
            id: current.word.id,
            surface: "game:dont-pop",
            mode: "image",
            label: current.word.title,
            snapshot: { prompt: current.word.title, image: current.word.src ?? undefined, options: current.options },
            hasImage: true,
          }),
          { answer: option, expected: current.word.title, wasWrong: option !== current.word.title },
        ),
      ]);
```

`reportables={vistos}` en el `<GameResult>` de l.~386; vaciar en `startGame`.

- [ ] **Step 7: Verificar y commit**

```bash
npm run lint && npx tsc --noEmit
git add components/games/shared/game-result.tsx services/games.service.ts "app/(app)/games"
git commit -m "feat(reportes): los juegos de oraciones se reportan desde el resultado y respetan las respuestas aceptadas

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task B13: Juegos de palabras y diarios

**Files:**
- Modify: `services/games.service.ts` (`TowerRound.id?`, `WordleState.answerId?`, respuestas del crucigrama `vocabId?`)
- Modify: `app/(app)/games/dot-match/page.tsx`, `true-false/page.tsx`, `memory/page.tsx`, `word-tower/page.tsx`, `dot-bombs/page.tsx` (+ su `engine.ts`), `wordle/page.tsx`, `crossword/page.tsx`

**Interfaces:**
- Consumes: `objetivoDeVocab`, `objetivoDeTarjeta`, `objetivoDePalabra`, `objetivo`, `conRespuesta` (B2); `ReportButton` (B6); ids del backend (A5).

- [ ] **Step 1: Tipos**

`TowerRound` gana `id?: number;`, `WordleState` gana `answerId?: number | null;` y el tipo de cada respuesta del crucigrama (`{ id, answer }`) gana `vocabId?: number | null;`.

- [ ] **Step 2: Dot Match**

En el handler de l.~327 (`if (lSlot.pairId === rSlot.pairId)`), antes del `if`, con `pairs` el array de `MatchPair` del juego:

```ts
      const par = pairs.find((p) => p.id === lSlot.pairId);
      const elegido = pairs.find((p) => p.id === rSlot.pairId);
      if (par) {
        setVistos((v) => [
          ...v,
          conRespuesta(objetivoDeVocab({ id: par.id, text: par.en, meaning: par.es }, "game:dot-match", "match"), {
            answer: elegido?.es ?? "",
            expected: par.es,
            wasWrong: lSlot.pairId !== rSlot.pairId,
          }),
        ]);
      }
```

(si los slots de la izquierda son los ES y los de la derecha los EN, invierte `par`/`elegido`). `reportables={vistos}`; vaciar en `startGame`.

- [ ] **Step 3: ¿Verdad o Trampa?**

En `answer` (l.~141), después de `const isRight = guessedCorrect === card.isCorrect;`:

```ts
      setVistos((v) => [
        ...v,
        conRespuesta(objetivoDeTarjeta(card, "game:true-false"), {
          answer: guessedCorrect ? "Verdad" : "Trampa",
          expected: card.isCorrect ? "Verdad" : "Trampa",
          wasWrong: !isRight,
        }),
      ]);
```

- [ ] **Step 4: Memoria**

Después de `const isMatch = cardA.pairId === cardB.pairId;` (l.~210), añade los dos pares vistos sin respuesta (es un juego de memoria, no de acertar significado), con `pairs` el array de `MemoryPair`:

```ts
      const vistosAhora = [cardA.pairId, cardB.pairId]
        .map((id) => pairs.find((p) => p.id === id))
        .filter((p): p is (typeof pairs)[number] => Boolean(p))
        .map((p) => objetivoDePalabra({ id: p.id, word: p.word, img: p.img }, "game:memory"));
      setVistos((v) => [...v, ...vistosAhora]);
```

- [ ] **Step 5: Torre de Palabras**

En el handler de l.~281, antes del `if (option === round.correct)`:

```ts
      setVistos((v) => [
        ...v,
        conRespuesta(
          objetivo({
            type: "vocab_item",
            id: round.id ?? null,
            surface: "game:word-tower",
            mode: "category",
            label: round.word,
            snapshot: { prompt: round.word, options: round.options },
          }),
          { answer: option, expected: round.correct, wasWrong: option !== round.correct },
        ),
      ]);
```

- [ ] **Step 6: Dot Bombs**

En `engine.ts`, el tipo `Bomb` gana `wordId: number;` (debajo de `id`). En `page.tsx`:

- en `spawnBomb` (l.~184), el objeto nuevo gana `wordId: word.id,`;
- en el handler de la bandeja, rama `if (result === "complete")` (l.~294), justo después del guard `if (!bomb || bomb.word !== state.word) return;`:

```ts
        setVistos((v) => [
          ...v,
          objetivoDePalabra({ id: bomb.wordId, word: bomb.word, img: bomb.img }, "game:dot-bombs"),
        ]);
```

- en el tick, dentro de `if (landed.length > 0) {` (l.~229), primera línea:

```ts
        setVistos((v) => [
          ...v,
          ...landed.map((b) => objetivoDePalabra({ id: b.wordId, word: b.word, img: b.img }, "game:dot-bombs")),
        ]);
```

Sin respuesta en los dos casos: deletrear no admite alternativas. Vacía `vistos` en `startGame(m)` (l.~136; no en `onReplay`, que vuelve al menú de modos) y pasa `reportables={vistos}` al `<GameResult>` de l.~559.

- [ ] **Step 7: Palabra del Día y Mini Crucigrama**

En `wordle/page.tsx`, dentro del bloque `{done && state && (…)}` (l.~506), al final:

```tsx
            <ReportButton
              objetivos={[
                objetivo({
                  type: "vocab_item",
                  id: state.answerId ?? null,
                  surface: "game:wordle",
                  label: state.answer ?? "La palabra del día",
                  snapshot: { prompt: state.answer ?? "", ...(state.hintEs ? { meaning: state.hintEs } : {}) },
                }),
              ]}
              surface="game:wordle"
            />
```

En `crossword/page.tsx`, en su bloque de partida terminada, lo mismo con una entrada por respuesta: `state.answers.map((a) => objetivo({ type: "vocab_item", id: a.vocabId ?? null, surface: "game:crossword", label: a.answer, snapshot: { prompt: a.answer, meaning: state.slots.find((s) => s.id === a.id)?.clueEs } }))` (con `meaning` solo si existe).

- [ ] **Step 8: Verificar y commit**

```bash
npm run lint && npx tsc --noEmit
git add services/games.service.ts "app/(app)/games"
git commit -m "feat(reportes): los juegos de palabras y los diarios se reportan desde su final

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task B14: El aviso de vuelta al alumno

**Files:**
- Create: `lib/report-notice.ts`, `lib/report-notice.test.mjs`
- Create: `components/report/report-notice.tsx`, `components/report/report-notice-watch.tsx`
- Modify: `components/rival/rival-alert.tsx` (atributo `data-rival-alert` en el elemento raíz)
- Modify: `app/(app)/(hub)/layout.tsx` (montar `ReportNoticeWatch` debajo de `RivalWatch`)

**Interfaces:**
- Consumes: `getReportNoticesService`, `markReportNoticesSeenService`, `type ReportNotice` (B6); `bumpCuenta` (`lib/account-refresh.ts`); `hayScrollBloqueado` (`lib/scroll-lock.ts`).
- Produces: `resumenDeAvisos(avisos): ResumenAvisos | null`, `MAX_LINEAS = 3`.

- [ ] **Step 1: Test que falla**

`lib/report-notice.test.mjs`:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { resumenDeAvisos } from "./report-notice.ts";

const aviso = (over = {}) => ({
  id: 1,
  outcome: "fixed",
  note: null,
  gems: 10,
  prompt: "I __ happy today.",
  resolvedAt: "2026-10-01T10:00:00.000Z",
  ...over,
});

test("sin avisos no hay hoja", () => {
  assert.equal(resumenDeAvisos([]), null);
});

test("uno arreglado: aplausos, título en singular y sus gemas", () => {
  const r = resumenDeAvisos([aviso()]);
  assert.equal(r.pose, "aplaudiendo");
  assert.equal(r.titulo, "¡Arreglamos lo que reportaste!");
  assert.equal(r.gemas, 10);
  assert.deepEqual(r.lineas[0], { id: 1, texto: "«I __ happy today.»", nota: null, arreglado: true });
});

test("solo descartados: Doty pensando y sin gemas", () => {
  const r = resumenDeAvisos([
    aviso({ id: 2, outcome: "dismissed", gems: 0, note: "«am» es la única que va" }),
    aviso({ id: 3, outcome: "dismissed", gems: 0, prompt: null }),
  ]);
  assert.equal(r.pose, "pensando");
  assert.equal(r.titulo, "Revisamos tus 2 reportes");
  assert.equal(r.gemas, 0);
  assert.equal(r.lineas[1].texto, "Un ejercicio");
});

test("más de tres: tres líneas y el resto se cuenta", () => {
  const r = resumenDeAvisos([1, 2, 3, 4, 5].map((id) => aviso({ id })));
  assert.equal(r.lineas.length, 3);
  assert.equal(r.extra, 2);
  assert.equal(r.titulo, "¡Arreglamos 5 cosas que reportaste!");
  assert.equal(r.gemas, 50);
});
```

Run: `node --test lib/report-notice.test.mjs` → FAIL.

- [ ] **Step 2: Implementar `lib/report-notice.ts`**

```ts
import type { ReportNotice } from "@/services/reports.service";

/**
 * El aviso de vuelta (spec 2026-10-01 §1.6): qué dice la hoja cuando el admin
 * cerró reportes del alumno. Puro; las gemas ya se sumaron en el servidor.
 */
export const MAX_LINEAS = 3;

export type LineaAviso = { id: number; texto: string; nota: string | null; arreglado: boolean };

export type ResumenAvisos = {
  pose: "aplaudiendo" | "pensando";
  titulo: string;
  lineas: LineaAviso[];
  extra: number;
  gemas: number;
};

const recortar = (s: string, max: number) => (s.length > max ? `${s.slice(0, max - 1)}…` : s);

export function resumenDeAvisos(avisos: readonly ReportNotice[]): ResumenAvisos | null {
  if (avisos.length === 0) return null;
  const arreglados = avisos.filter((a) => a.outcome === "fixed").length;
  const titulo =
    arreglados === 0
      ? avisos.length === 1
        ? "Revisamos tu reporte"
        : `Revisamos tus ${avisos.length} reportes`
      : arreglados === 1
        ? "¡Arreglamos lo que reportaste!"
        : `¡Arreglamos ${arreglados} cosas que reportaste!`;
  return {
    pose: arreglados > 0 ? "aplaudiendo" : "pensando",
    titulo,
    lineas: avisos.slice(0, MAX_LINEAS).map((a) => ({
      id: a.id,
      texto: a.prompt ? `«${recortar(a.prompt, 60)}»` : "Un ejercicio",
      nota: a.note,
      arreglado: a.outcome === "fixed",
    })),
    extra: Math.max(0, avisos.length - MAX_LINEAS),
    gemas: avisos.reduce((total, a) => total + (a.gems ?? 0), 0),
  };
}
```

Run: `node --test lib/report-notice.test.mjs` → PASS.

- [ ] **Step 3: La hoja del aviso**

`components/report/report-notice.tsx` (mismo esqueleto de diálogo que `components/pwa/install-sheet.tsx`: `OverlayPortal`, fondo con `var(--scrim)`, `bloquearScroll`, Escape, foco al abrir):

```tsx
"use client";

import { useEffect, useRef } from "react";

import Doty from "@/components/ui/doty/doty";
import UIButton from "@/components/ui/button/button";
import OverlayPortal from "@/components/ui/overlay-portal";
import { UiIcon } from "@/components/ui/ui-icon";
import { resumenDeAvisos } from "@/lib/report-notice";
import { bloquearScroll } from "@/lib/scroll-lock";
import type { ReportNotice as Aviso } from "@/services/reports.service";

/**
 * «Arreglamos lo que reportaste» (spec 2026-10-01 §1.6). Es un diálogo de
 * verdad: toma el scroll, así que pistas, aviso de rival e invitación a
 * instalar esperan a que se cierre. No se va solo: se cierra con «¡Genial!».
 */
export default function ReportNotice({ avisos, onCerrar }: { avisos: Aviso[]; onCerrar: () => void }) {
  const panelRef = useRef<HTMLDivElement>(null);
  const resumen = resumenDeAvisos(avisos);

  useEffect(() => {
    panelRef.current?.focus();
  }, []);

  useEffect(() => {
    const alTeclear = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCerrar();
    };
    document.addEventListener("keydown", alTeclear);
    const soltar = bloquearScroll();
    return () => {
      document.removeEventListener("keydown", alTeclear);
      soltar();
    };
  }, [onCerrar]);

  if (!resumen) return null;

  return (
    <OverlayPortal>
      <div className="fixed inset-0 z-50 flex items-end justify-center md:items-center">
        <div aria-hidden onClick={onCerrar} className="absolute inset-0" style={{ background: "var(--scrim)" }} />
        <div
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby="aviso-reporte-titulo"
          tabIndex={-1}
          className="relative z-10 flex max-h-[88svh] w-full flex-col items-center gap-3 overflow-y-auto rounded-t-3xl bg-(--surface) px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-6 text-center [animation:dots-slide-up_.28s_ease-out_both] md:max-w-md md:rounded-3xl md:pb-6"
        >
          <Doty pose={resumen.pose} size="small" animation="bob" />
          <h2 id="aviso-reporte-titulo" className="font-display text-xl font-extrabold text-foreground">
            {resumen.titulo}
          </h2>
          <ul className="flex w-full flex-col gap-2 text-left">
            {resumen.lineas.map((l) => (
              <li key={l.id} className="flex flex-col gap-1 rounded-2xl px-4 py-3" style={{ background: "var(--surface-2)" }}>
                <span className="flex items-center gap-2">
                  <span
                    className="rounded-full px-2 py-0.5 text-[11px] font-black uppercase tracking-wide"
                    style={{
                      background: l.arreglado
                        ? "color-mix(in srgb, var(--success) 16%, transparent)"
                        : "color-mix(in srgb, var(--muted) 14%, transparent)",
                      color: l.arreglado ? "var(--success)" : "var(--muted)",
                    }}
                  >
                    {l.arreglado ? "Arreglado" : "Revisado"}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm font-extrabold text-foreground">{l.texto}</span>
                </span>
                {l.nota && <span className="text-xs font-semibold text-(--muted)">{l.nota}</span>}
              </li>
            ))}
          </ul>
          {resumen.extra > 0 && <p className="text-xs font-bold text-(--muted)">y {resumen.extra} más</p>}
          {resumen.gemas > 0 && (
            <span
              className="inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-black"
              style={{
                background: "color-mix(in srgb, var(--gem) 16%, transparent)",
                border: "2px solid color-mix(in srgb, var(--gem) 40%, transparent)",
                color: "var(--gem)",
              }}
            >
              <UiIcon name="gemas" size={18} /> +{resumen.gemas} por ayudarnos
            </span>
          )}
          <div className="mt-1 w-full">
            <UIButton tone="accent" onClick={onCerrar} fullWidth>
              ¡Genial!
            </UIButton>
          </div>
        </div>
      </div>
    </OverlayPortal>
  );
}
```

(comprueba que `UiIcon` acepta `name="gemas"` con `grep -rn "gemas" components/ui/ui-icon*`.)

- [ ] **Step 4: El vigilante en el hub**

`components/report/report-notice-watch.tsx`, calcado de `components/rival/rival-watch.tsx`:

```tsx
"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname } from "next/navigation";

import ReportNotice from "@/components/report/report-notice";
import { useAuth } from "@/context/auth-context";
import { bumpCuenta } from "@/lib/account-refresh";
import { hayScrollBloqueado } from "@/lib/scroll-lock";
import {
  getReportNoticesService,
  markReportNoticesSeenService,
  type ReportNotice as Aviso,
} from "@/services/reports.service";

/** Mismo sondeo y mismo techo que rival-watch.tsx y use-tip-anchor.ts. */
const INTERVALO_MS = 80;
const ESPERA_TAPADO_MS = 20000;

/** Los tapones de rival-watch más el propio aviso de rival, que no toma el scroll. */
function pantallaTapada(): boolean {
  return (
    document.querySelector("[data-doty-entrada]") !== null ||
    document.querySelector("[data-rival-alert]") !== null ||
    hayScrollBloqueado() ||
    document.visibilityState === "hidden"
  );
}

/**
 * Resultados de los reportes del alumno (spec 2026-10-01 §1.6). Solo al
 * entrar al Camino. El aviso viaja con su ruta, como en RivalWatch, para no
 * colarse en otra pestaña si el layout no se remonta.
 */
export default function ReportNoticeWatch() {
  const pathname = usePathname();
  const { isBootstrapping, accessToken } = useAuth();
  const [aviso, setAviso] = useState<{ ruta: string; avisos: Aviso[] } | null>(null);

  useEffect(() => {
    if (pathname !== "/levels" || isBootstrapping || !accessToken) return;
    let vivo = true;
    let reloj = 0;
    getReportNoticesService().then((avisos) => {
      if (!vivo || avisos.length === 0) return;
      const desde = performance.now();
      const emitir = () => {
        if (!vivo) return;
        if (!pantallaTapada()) {
          setAviso({ ruta: pathname, avisos });
          return;
        }
        if (performance.now() - desde >= ESPERA_TAPADO_MS) return;
        reloj = window.setTimeout(emitir, INTERVALO_MS);
      };
      reloj = window.setTimeout(emitir, 0);
    });
    return () => {
      vivo = false;
      clearTimeout(reloj);
    };
  }, [pathname, isBootstrapping, accessToken]);

  const cerrar = useCallback(() => {
    const ids = aviso?.avisos.map((a) => a.id) ?? [];
    setAviso(null);
    // Si marcar falla, el aviso vuelve a salir la próxima vez: mejor que perderlo.
    markReportNoticesSeenService(ids)
      .catch(() => {})
      .finally(() => bumpCuenta());
  }, [aviso]);

  const visibles = aviso !== null && aviso.ruta === pathname ? aviso.avisos : null;
  if (!visibles) return null;
  return <ReportNotice avisos={visibles} onCerrar={cerrar} />;
}
```

En `components/rival/rival-alert.tsx`, añade `data-rival-alert` al elemento raíz que se pinta. En `app/(app)/(hub)/layout.tsx`, importa y monta `<ReportNoticeWatch />` justo debajo de `<RivalWatch />`, con un comentario de una línea: «Resultados de los reportes del alumno: hoja al entrar al Camino, espera a que nada tape la pantalla».

- [ ] **Step 5: Verificar y commit**

```bash
npm run lint && npx tsc --noEmit && node --test lib/report-notice.test.mjs
git add lib/report-notice.ts lib/report-notice.test.mjs components/report/report-notice.tsx components/report/report-notice-watch.tsx components/rival/rival-alert.tsx "app/(app)/(hub)/layout.tsx"
git commit -m "feat(reportes): al entrar al Camino, el alumno ve qué pasó con lo que reportó y sus gemas

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task B15: Admin — servicios y lógica de vista

**Files:**
- Modify: `services/admin.service.ts` (sección nueva `// ── Reportes ──` al final)
- Create: `lib/admin-reports.ts`, `lib/admin-reports.test.mjs`

**Interfaces:**
- Consumes: endpoints de A7.
- Produces:
  - Tipos `AdminReport`, `AdminReportGroup`, `AdminReportContent`, `AdminReportAnswer`, `AdminAnswerAlternative`, `AdminReportGroupDetail`, `AdminBugReport`.
  - `getReportSummary()`, `getReportGroups(status)`, `getReportGroup(type, id)`, `getBugReports(status)`, `resolveReports(ids, outcome, note?)`, `getAnswerAlternatives(targetType, targetId)`, `createAnswerAlternative(body)`, `deleteAnswerAlternative(id)`.
  - `lib/admin-reports.ts`: `ETIQUETA_TIPO`, `etiquetaSuperficie(surface)`, `resumenMotivos(reasons)`, `etiquetaMotivoAdmin(m)`, `puedeAceptar(type)`, `alternativaPara(type, answer)`, `notaPorDefecto(answer)`, `fechaCorta(iso, ahora?)`, `camposVisibles(type, content)`, `idsPendientes(reports)`.

- [ ] **Step 1: Servicios**

Al final de `services/admin.service.ts`:

```ts
// ── Reportes (spec 2026-10-01) ──────────────────────────────────

export type AdminReportStatus = "pending" | "closed";

export type AdminReport = {
  id: number;
  userId: number;
  userName: string;
  isAdmin: boolean;
  surface: string;
  mode: string | null;
  targetType: string | null;
  targetId: string | null;
  reasons: string[];
  comment: string | null;
  answer: string | null;
  expected: string | null;
  wasWrong: boolean | null;
  snapshot: Record<string, unknown>;
  context: Record<string, unknown>;
  status: "pending" | "fixed" | "dismissed";
  note: string | null;
  gems: number;
  createdAt: string;
  resolvedAt: string | null;
};

export type AdminReportGroup = {
  type: string;
  id: string;
  prompt: string;
  surface: string;
  where: string | null;
  reasons: Record<string, number>;
  students: number;
  reports: number;
  lastAt: string;
};

export type AdminReportContent = {
  content: Record<string, unknown>;
  parentId: number | null;
  parentLabel: string | null;
};

export type AdminReportAnswer = {
  answer: string;
  kind: "word" | "sentence";
  count: number;
  reportIds: number[];
};

export type AdminAnswerAlternative = {
  id: number;
  targetType: string;
  targetId: string;
  kind: "word" | "sentence";
  value: string;
  createdAt: string;
};

export type AdminReportGroupDetail = {
  type: string;
  id: string;
  prompt: string;
  where: string | null;
  content: AdminReportContent | null;
  alternatives: AdminAnswerAlternative[];
  answers: AdminReportAnswer[];
  reports: AdminReport[];
};

export type AdminBugReport = AdminReport & { where: string | null };

export async function getReportSummary(): Promise<{ content: number; bugs: number }> {
  const { data } = await api.get("/admin/reports/summary");
  return data;
}

export async function getReportGroups(status: AdminReportStatus): Promise<AdminReportGroup[]> {
  const { data } = await api.get("/admin/reports/groups", { params: { status } });
  return data;
}

export async function getReportGroup(type: string, id: string): Promise<AdminReportGroupDetail> {
  const { data } = await api.get(`/admin/reports/groups/${type}/${id}`);
  return data;
}

export async function getBugReports(status: AdminReportStatus): Promise<AdminBugReport[]> {
  const { data } = await api.get("/admin/reports/bugs", { params: { status } });
  return data;
}

export async function resolveReports(
  ids: number[],
  outcome: "fixed" | "dismissed",
  note?: string,
): Promise<{ resolved: number; gems: number }> {
  const { data } = await api.post("/admin/reports/resolve", { ids, outcome, ...(note ? { note } : {}) });
  return data;
}

export async function getAnswerAlternatives(
  targetType: "sentence" | "grammar_item",
  targetId: string | number,
): Promise<AdminAnswerAlternative[]> {
  const { data } = await api.get("/admin/answer-alternatives", {
    params: { targetType, targetId: String(targetId) },
  });
  return data;
}

export async function createAnswerAlternative(body: {
  targetType: "sentence" | "grammar_item";
  targetId: string;
  kind: "word" | "sentence";
  value: string;
  sourceReportId?: number;
}): Promise<AdminAnswerAlternative> {
  const { data } = await api.post("/admin/answer-alternatives", body);
  return data;
}

export async function deleteAnswerAlternative(id: number): Promise<void> {
  await api.delete(`/admin/answer-alternatives/${id}`);
}
```

- [ ] **Step 2: Test que falla de la lógica de vista**

`lib/admin-reports.test.mjs`:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  alternativaPara,
  camposVisibles,
  etiquetaSuperficie,
  fechaCorta,
  idsPendientes,
  notaPorDefecto,
  puedeAceptar,
  resumenMotivos,
} from "./admin-reports.ts";

test("superficies legibles", () => {
  assert.equal(etiquetaSuperficie("practice"), "Práctica");
  assert.equal(etiquetaSuperficie("lesson-vocab"), "Vocabulario");
  assert.equal(etiquetaSuperficie("game:dotaxi"), "Juego · Dotaxi");
  assert.equal(etiquetaSuperficie("app"), "Ajustes");
  assert.equal(etiquetaSuperficie("game:nuevo"), "Juego · nuevo");
});

test("recuento de motivos en orden canónico", () => {
  assert.equal(resumenMotivos({ typo: 1, answer: 3 }), "3 debería estar bien · 1 ortografía");
  assert.equal(resumenMotivos({}), "");
});

test("aceptar: oraciones (palabra u orden) y gramática (solo palabra)", () => {
  assert.equal(puedeAceptar("sentence"), true);
  assert.equal(puedeAceptar("vocab_item"), false);
  const palabra = { answer: "feel", kind: "word", count: 1, reportIds: [1] };
  const orden = { answer: "Today I am happy", kind: "sentence", count: 1, reportIds: [2] };
  assert.deepEqual(alternativaPara("sentence", orden), { targetType: "sentence", kind: "sentence" });
  assert.deepEqual(alternativaPara("grammar_item", palabra), { targetType: "grammar_item", kind: "word" });
  assert.equal(alternativaPara("grammar_item", orden), null);
  assert.equal(alternativaPara("vocab_item", palabra), null);
  assert.equal(notaPorDefecto("feel"), "Ahora «feel» también vale");
});

test("fecha corta relativa a hoy", () => {
  const ahora = new Date("2026-10-01T15:00:00");
  assert.match(fechaCorta("2026-10-01T10:05:00", ahora), /^hoy \d{2}:\d{2}$/);
  assert.equal(fechaCorta("2026-09-30T10:05:00", ahora), "ayer");
  assert.equal(fechaCorta("2026-09-12T10:05:00", ahora), "12 sep");
});

test("campos visibles por tipo, sin vacíos", () => {
  assert.deepEqual(camposVisibles("sentence", { text: "I __ happy.", mWord: "am", img: "" }), [
    { label: "Oración", value: "I __ happy." },
    { label: "Palabra correcta", value: "am" },
  ]);
  assert.deepEqual(camposVisibles("vocab_item", { text: "big", meaning: "grande" }), [
    { label: "Inglés", value: "big" },
    { label: "Significado", value: "grande" },
  ]);
});

test("solo los pendientes se cierran", () => {
  assert.deepEqual(
    idsPendientes([
      { id: 1, status: "pending" },
      { id: 2, status: "fixed" },
      { id: 3, status: "pending" },
    ]),
    [1, 3],
  );
});
```

Run: `node --test lib/admin-reports.test.mjs` → FAIL.

- [ ] **Step 3: Implementar `lib/admin-reports.ts`**

```ts
import type { AdminReportAnswer } from "@/services/admin.service";

/**
 * Vista de la bandeja de reportes del admin (spec 2026-10-01 §2): etiquetas,
 * recuentos y qué se puede aceptar. Puro, bajo `node --test`.
 */

const MOTIVOS_ORDEN = ["answer", "typo", "meaning", "audio", "image", "bug", "other"] as const;

const ETIQUETA_MOTIVO: Record<string, string> = {
  answer: "debería estar bien",
  typo: "ortografía",
  meaning: "no se entiende",
  audio: "audio",
  image: "imagen",
  bug: "no funciona",
  other: "otra cosa",
};

export const ETIQUETA_TIPO: Record<string, string> = {
  sentence: "Oración",
  word: "Palabra",
  vocab_item: "Vocabulario",
  grammar_item: "Gramática",
  grammar_pill: "Píldora de gramática",
  pronunciation_item: "Pronunciación",
  pronunciation_unit: "Unidad de pronunciación",
  letter_item: "Letra",
  number_item: "Número",
  reading: "Lectura",
  false_friend: "Falso amigo",
};

const SUPERFICIES: Record<string, string> = {
  practice: "Práctica",
  "lesson-grammar": "Gramática",
  "lesson-pronunciation": "Pronunciación",
  "lesson-vocab": "Vocabulario",
  "lesson-letters": "Letras",
  "lesson-numbers": "Números",
  checkpoint: "Checkpoint",
  placement: "Prueba de nivel",
  review: "Repaso",
  reading: "Lectura",
  app: "Ajustes",
};

const JUEGOS: Record<string, string> = {
  "true-false": "¿Verdad o Trampa?",
  "dot-match": "Dot Match",
  memory: "Memoria Relámpago",
  "audio-blitz": "Escucha Rápida",
  "word-tower": "Torre de Palabras",
  "sentence-builder": "Constructor",
  wordle: "Palabra del Día",
  crossword: "Mini Crucigrama",
  "ghost-race": "Carrera Fantasma",
  "dot-bombs": "Dot Bombs",
  "dont-pop": "¡No lo revientes!",
  dotaxi: "Dotaxi",
};

export function etiquetaSuperficie(surface: string): string {
  if (surface.startsWith("game:")) {
    const key = surface.slice(5);
    return `Juego · ${JUEGOS[key] ?? key}`;
  }
  return SUPERFICIES[surface] ?? surface;
}

export function etiquetaMotivoAdmin(m: string): string {
  return ETIQUETA_MOTIVO[m] ?? m;
}

export function resumenMotivos(reasons: Record<string, number>): string {
  return MOTIVOS_ORDEN.filter((m) => (reasons[m] ?? 0) > 0)
    .map((m) => `${reasons[m]} ${ETIQUETA_MOTIVO[m]}`)
    .join(" · ");
}

export function puedeAceptar(type: string): boolean {
  return type === "sentence" || type === "grammar_item";
}

export function alternativaPara(
  type: string,
  respuesta: Pick<AdminReportAnswer, "kind">,
): { targetType: "sentence" | "grammar_item"; kind: "word" | "sentence" } | null {
  if (type === "sentence") return { targetType: "sentence", kind: respuesta.kind };
  if (type === "grammar_item" && respuesta.kind === "word") return { targetType: "grammar_item", kind: "word" };
  return null;
}

export function notaPorDefecto(answer: string): string {
  return `Ahora «${answer}» también vale`;
}

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

export function fechaCorta(iso: string, ahora: Date = new Date()): string {
  const d = new Date(iso);
  const dia = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const dias = Math.round((dia(ahora) - dia(d)) / 86_400_000);
  if (dias === 0) {
    return `hoy ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  }
  if (dias === 1) return "ayer";
  return `${d.getDate()} ${MESES[d.getMonth()]}`;
}

const CAMPOS: Record<string, Array<[string, string]>> = {
  sentence: [["text", "Oración"], ["mWord", "Palabra correcta"]],
  word: [["text", "Palabra"], ["meaning", "Significado"]],
  vocab_item: [["text", "Inglés"], ["meaning", "Significado"]],
  grammar_item: [["text", "Oración"], ["answer", "Respuesta"]],
  grammar_pill: [["title", "Título"]],
  pronunciation_item: [["wordA", "Palabra A"], ["wordB", "Palabra B"]],
  pronunciation_unit: [["title", "Título"], ["descriptionEs", "Descripción"]],
  letter_item: [["letter", "Letra"], ["name", "Nombre"], ["exampleWord", "Ejemplo"], ["exampleMeaning", "Significado"]],
  number_item: [["value", "Número"], ["word", "En inglés"]],
  reading: [["title", "Título"], ["text", "Texto"]],
};

/** Lo que se enseña del contenido actual en el detalle, sin campos vacíos. */
export function camposVisibles(type: string, content: Record<string, unknown>): Array<{ label: string; value: string }> {
  return (CAMPOS[type] ?? [])
    .map(([campo, label]) => ({ label, value: content[campo] == null ? "" : String(content[campo]) }))
    .filter((c) => c.value.trim() !== "");
}

export function idsPendientes(reports: ReadonlyArray<{ id: number; status: string }>): number[] {
  return reports.filter((r) => r.status === "pending").map((r) => r.id);
}
```

Comprueba los nombres de campo reales con los serializers del backend (`serializePronunciationItem`, `serializeLetterItem`, `serializeReading` en `dots-backend/src/modules/admin/admin.service.ts`) y ajusta `CAMPOS` si alguno difiere (p. ej. `wordA`/`wordB`).

Run: `node --test lib/admin-reports.test.mjs` → PASS.

- [ ] **Step 4: Commit**

```bash
npx tsc --noEmit
git add services/admin.service.ts lib/admin-reports.ts lib/admin-reports.test.mjs
git commit -m "feat(reportes): servicios del admin y lógica de vista de la bandeja

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task B16: Contadores de pendientes

**Files:**
- Create: `lib/report-counts.ts`, `lib/report-counts.test.mjs`
- Create: `hooks/use-report-counts.ts`
- Modify: `components/profile/settings-sheet.tsx` (puntito en «Panel de admin»)
- Modify: `components/admin-lab/admin-pill.tsx` (puntito en el chip)
- Modify: `app/(app)/admin/layout.tsx` (pestaña «Reportes» con globo) y `app/(app)/admin/page.tsx` (tarjeta)

**Interfaces:**
- Consumes: `getReportSummary` (B15).
- Produces: `refrescarConteoReportes()` (lo llama B17 tras cerrar algo), `useReportCounts(activo: boolean): { content: number; bugs: number } | null`, `totalPendientes(c)`.

- [ ] **Step 1: Test que falla**

`lib/report-counts.test.mjs`:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  fijarConteo,
  leerConteo,
  refrescarConteoReportes,
  suscribirConteo,
  totalPendientes,
  versionConteo,
} from "./report-counts.ts";

test("fijar avisa y leer devuelve lo último", () => {
  let avisos = 0;
  const soltar = suscribirConteo(() => avisos++);
  fijarConteo({ content: 2, bugs: 1 });
  assert.deepEqual(leerConteo(), { content: 2, bugs: 1 });
  assert.equal(avisos, 1);
  soltar();
});

test("refrescar sube la versión", () => {
  const antes = versionConteo();
  refrescarConteoReportes();
  assert.equal(versionConteo(), antes + 1);
});

test("total de pendientes", () => {
  assert.equal(totalPendientes({ content: 2, bugs: 3 }), 5);
  assert.equal(totalPendientes(null), 0);
});
```

Run: `node --test lib/report-counts.test.mjs` → FAIL.

- [ ] **Step 2: Store y hook**

`lib/report-counts.ts`:

```ts
/**
 * Pendientes de la bandeja de reportes, para el puntito de Ajustes y del chip
 * ADMIN y el globo del panel (spec 2026-10-01 §2.1). Store de módulo, mismo
 * patrón que lib/admin-mode.ts y lib/account-refresh.ts.
 */
export type ConteoReportes = { content: number; bugs: number };

let conteo: ConteoReportes | null = null;
let version = 0;
const escuchas = new Set<() => void>();
const avisar = () => {
  for (const f of escuchas) f();
};

export function leerConteo(): ConteoReportes | null {
  return conteo;
}

export function versionConteo(): number {
  return version;
}

export function fijarConteo(siguiente: ConteoReportes): void {
  conteo = siguiente;
  avisar();
}

/** Tras cerrar reportes: los que miran el conteo vuelven a pedirlo. */
export function refrescarConteoReportes(): void {
  version += 1;
  avisar();
}

export function suscribirConteo(alCambiar: () => void): () => void {
  escuchas.add(alCambiar);
  return () => {
    escuchas.delete(alCambiar);
  };
}

export function totalPendientes(c: ConteoReportes | null): number {
  return c ? c.content + c.bugs : 0;
}
```

`hooks/use-report-counts.ts`:

```ts
"use client";

import { useEffect, useSyncExternalStore } from "react";

import {
  fijarConteo,
  leerConteo,
  suscribirConteo,
  versionConteo,
  type ConteoReportes,
} from "@/lib/report-counts";
import { getReportSummary } from "@/services/admin.service";

/** Una sola petición por versión aunque lo monten Ajustes, el chip y el panel a la vez. */
let enCurso: { version: number; promesa: Promise<void> } | null = null;

function pedir(version: number): Promise<void> {
  if (enCurso && enCurso.version === version) return enCurso.promesa;
  const promesa = getReportSummary()
    .then(fijarConteo)
    .catch(() => {}); // sin conteo no hay puntito; nada se rompe
  enCurso = { version, promesa };
  return promesa;
}

/** Solo para admins (`activo`): un alumno nunca pide /admin/*. */
export function useReportCounts(activo: boolean): ConteoReportes | null {
  const version = useSyncExternalStore(suscribirConteo, versionConteo, () => 0);
  const conteo = useSyncExternalStore(suscribirConteo, leerConteo, () => null);
  useEffect(() => {
    if (!activo) return;
    void pedir(version); // escribe en el store externo, no hace setState
  }, [activo, version]);
  return activo ? conteo : null;
}
```

Run: `node --test lib/report-counts.test.mjs` → PASS.

- [ ] **Step 3: Puntitos y globo**

Un puntito es `<span aria-hidden className="absolute -right-0.5 -top-0.5 size-2.5 rounded-full" style={{ background: "var(--danger)" }} />` dentro de un padre `relative`, más el número en el `aria-label` del enlace/botón.

- `settings-sheet.tsx`: `const pendientes = totalPendientes(useReportCounts(isAdmin));`. En el `<Link href="/admin">`, añade `relative` a la clase y el puntito si `pendientes > 0`; texto del enlace: `Panel de admin{pendientes > 0 ? ` · ${pendientes} reportes` : ""}`.
- `admin-pill.tsx`: `const pendientes = totalPendientes(useReportCounts(encendido));` (antes del `if (!encendido) return null;`) y el puntito dentro del botón si `pendientes > 0`; `aria-label` pasa a ``Modo admin: abrir herramientas${pendientes > 0 ? ` · ${pendientes} reportes pendientes` : ""}``.
- `app/(app)/admin/layout.tsx`: añade `{ label: "Reportes", href: "/admin/reports" }` a `NAV_ITEMS` (después de «Readings»). Llama `const pendientes = totalPendientes(useReportCounts(access === "granted"));` y, en los dos renders de la navegación (escritorio y móvil), cuando `item.href === "/admin/reports" && pendientes > 0`, pinta tras la etiqueta un globo `<span className="ml-1.5 rounded-full bg-(--danger) px-1.5 py-0.5 text-[10px] font-black text-white">{pendientes > 9 ? "9+" : pendientes}</span>`.
- `app/(app)/admin/page.tsx`: tarjeta nueva en `cards`: `{ title: "Reportes", desc: "Lo que los alumnos marcaron: erratas, oraciones raras, respuestas que deberían valer y fallos.", href: "/admin/reports", pose: "pensando", accent: "var(--flame)", edge: "var(--flame-edge)" }` (comprueba que existen los tokens `--flame-edge`; si no, usa el par `accent`/`edge` de otra tarjeta).

- [ ] **Step 4: Verificar y commit**

```bash
npm run lint && npx tsc --noEmit
git add lib/report-counts.ts lib/report-counts.test.mjs hooks/use-report-counts.ts components/profile/settings-sheet.tsx components/admin-lab/admin-pill.tsx "app/(app)/admin/layout.tsx" "app/(app)/admin/page.tsx"
git commit -m "feat(reportes): el admin ve los pendientes en Ajustes, en el chip ADMIN y en el panel

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task B17: Admin — la página de Reportes

**Files:**
- Create: `app/(app)/admin/reports/page.tsx`
- Create: `components/admin/reports/group-list.tsx`, `group-detail.tsx`, `bug-list.tsx`, `resolve-bar.tsx`, `content-editor.tsx`
- Modify: `components/admin/foundations/{grammar,vocab,pronunciation,letters,numbers}-manager.tsx` (exportar los modales privados)

**Interfaces:**
- Consumes: servicios y `lib/admin-reports.ts` (B15), `refrescarConteoReportes` (B16), modales de admin existentes (`SentenceModal`, `WordModal`, `ReadingModal`), kit `components/admin/ui.tsx` (`useToast`, `ToastBanner`, `AdminModal`, `Field`, `modalInputCls`).
- Produces: ruta `/admin/reports`.

- [ ] **Step 1: Exportar los modales de fundamentos**

Al final de cada manager, sin renombrar nada dentro:

- `grammar-manager.tsx`: `export { ItemModal as GrammarItemModal, PillModal as GrammarPillModal };`
- `vocab-manager.tsx`: `export { ItemModal as VocabItemModal };`
- `pronunciation-manager.tsx`: `export { ItemModal as PronunciationItemModal, UnitModal as PronunciationUnitModal };`
- `letters-manager.tsx`: `export { ItemModal as LetterItemModal };`
- `numbers-manager.tsx`: `export { ItemModal as NumberItemModal };`

Si el lint del compiler protesta por exportar un componente no default desde un archivo con default, no lo silencies: mueve cada `ItemModal` a un archivo propio (`components/admin/foundations/<tipo>-item-modal.tsx`) y que el manager lo importe.

- [ ] **Step 2: `content-editor.tsx` — abre el modal que toca**

```tsx
"use client";

import SentenceModal from "@/components/admin/sentence-modal";
import WordModal from "@/components/admin/word-modal";
import ReadingModal from "@/components/admin/reading-modal";
import { GrammarItemModal, GrammarPillModal } from "@/components/admin/foundations/grammar-manager";
import { VocabItemModal } from "@/components/admin/foundations/vocab-manager";
import { PronunciationItemModal, PronunciationUnitModal } from "@/components/admin/foundations/pronunciation-manager";
import { LetterItemModal } from "@/components/admin/foundations/letters-manager";
import { NumberItemModal } from "@/components/admin/foundations/numbers-manager";
import type {
  AdminGrammarItem,
  AdminGrammarPill,
  AdminLetterItem,
  AdminNumberItem,
  AdminPronunciationItem,
  AdminPronunciationUnit,
  AdminReading,
  AdminReportContent,
  AdminSentence,
  AdminVocabItem,
  AdminWord,
} from "@/services/admin.service";

/**
 * «Editar» desde un reporte (spec 2026-10-01 §2.5): el mismo modal que se usa
 * en Levels y Foundations, con el contenido tal como está ahora.
 */
export default function ContentEditor({
  type,
  data,
  onClose,
  onSaved,
}: {
  type: string;
  data: AdminReportContent;
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const parent = data.parentId ?? 0;
  const c = data.content;
  switch (type) {
    case "sentence":
      return <SentenceModal levelId={parent} sentence={c as unknown as AdminSentence} onClose={onClose} onSaved={onSaved} />;
    case "word":
      return <WordModal levelId={parent} word={c as unknown as AdminWord} onClose={onClose} onSaved={onSaved} />;
    case "reading":
      return <ReadingModal reading={c as unknown as AdminReading} onClose={onClose} onSaved={onSaved} />;
    case "vocab_item":
      return <VocabItemModal packId={parent} item={c as unknown as AdminVocabItem} onClose={onClose} onSaved={onSaved} />;
    case "grammar_item":
      return <GrammarItemModal pillId={parent} item={c as unknown as AdminGrammarItem} onClose={onClose} onSaved={onSaved} />;
    case "grammar_pill":
      return <GrammarPillModal pill={c as unknown as AdminGrammarPill} onClose={onClose} onSaved={onSaved} />;
    case "pronunciation_item":
      return <PronunciationItemModal unitId={parent} item={c as unknown as AdminPronunciationItem} onClose={onClose} onSaved={onSaved} />;
    case "pronunciation_unit":
      return <PronunciationUnitModal unit={c as unknown as AdminPronunciationUnit} onClose={onClose} onSaved={onSaved} />;
    case "letter_item":
      return <LetterItemModal packId={parent} item={c as unknown as AdminLetterItem} onClose={onClose} onSaved={onSaved} />;
    case "number_item":
      return <NumberItemModal packId={parent} item={c as unknown as AdminNumberItem} onClose={onClose} onSaved={onSaved} />;
    default:
      return null;
  }
}
```

Ajusta los nombres de tipo (`AdminVocabItem`, `AdminLetterItem`…) a los que exporte de verdad `services/admin.service.ts` (`grep -n "^export type Admin" services/admin.service.ts`) y los props de cada modal a su firma real.

Y en el mismo archivo, la palanca de apagar/encender:

```ts
import {
  setReadingEnabled,
  setSentenceEnabled,
  updateGrammarItem,
  updateGrammarPill,
  updateLetterItem,
  updateNumberItem,
  updatePronunciationItem,
  updatePronunciationUnit,
  updateVocabItem,
} from "@/services/admin.service";

/** Tipos con `enabled` (todos menos palabras y falsos amigos). */
export function tieneInterruptor(type: string, content: Record<string, unknown>): boolean {
  return type !== "word" && type !== "false_friend" && typeof content.enabled === "boolean";
}

export async function cambiarEncendido(type: string, id: number, enabled: boolean): Promise<void> {
  switch (type) {
    case "sentence": return void (await setSentenceEnabled(id, enabled));
    case "reading": return void (await setReadingEnabled(id, enabled));
    case "vocab_item": return void (await updateVocabItem(id, { enabled }));
    case "grammar_item": return void (await updateGrammarItem(id, { enabled }));
    case "grammar_pill": return void (await updateGrammarPill(id, { enabled }));
    case "pronunciation_item": return void (await updatePronunciationItem(id, { enabled }));
    case "pronunciation_unit": return void (await updatePronunciationUnit(id, { enabled }));
    case "letter_item": return void (await updateLetterItem(id, { enabled }));
    case "number_item": return void (await updateNumberItem(id, { enabled }));
  }
}
```

(si alguna `updateX` no acepta `enabled` en su tipo de payload, amplía ese `Partial<…>` en `admin.service.ts`: el backend ya lo acepta.)

- [ ] **Step 3: `resolve-bar.tsx` — cerrar lo marcado**

```tsx
"use client";

import { useState } from "react";

import UIButton from "@/components/ui/button/button";
import { modalInputCls } from "@/components/admin/ui";
import { refrescarConteoReportes } from "@/lib/report-counts";
import { resolveReports } from "@/services/admin.service";

/** Cerrar uno o varios reportes con nota opcional para el alumno (spec §2.3). */
export default function ResolveBar({
  ids,
  notaInicial = "",
  flash,
  onResuelto,
}: {
  ids: number[];
  notaInicial?: string;
  flash: (text: string, kind?: "ok" | "error") => void;
  onResuelto: () => void;
}) {
  const [nota, setNota] = useState(notaInicial);
  const [enviando, setEnviando] = useState(false);

  const cerrar = (outcome: "fixed" | "dismissed") => {
    if (ids.length === 0 || enviando) return;
    setEnviando(true);
    resolveReports(ids, outcome, nota.trim() || undefined)
      .then(({ resolved, gems }) => {
        flash(
          outcome === "fixed"
            ? `${resolved} arreglado${resolved === 1 ? "" : "s"} · ${gems} gemas repartidas`
            : `${resolved} descartado${resolved === 1 ? "" : "s"}`,
        );
        refrescarConteoReportes();
        onResuelto();
      })
      .catch(() => flash("No se pudo cerrar. Inténtalo otra vez.", "error"))
      .finally(() => setEnviando(false));
  };

  return (
    <div className="flex flex-col gap-3 rounded-2xl border-2 border-(--border) bg-(--surface) p-4">
      <label className="flex flex-col gap-1">
        <span className="text-xs font-bold uppercase tracking-widest text-(--muted)">
          Nota para el alumno (opcional)
        </span>
        <textarea
          value={nota}
          onChange={(e) => setNota(e.target.value)}
          maxLength={500}
          rows={2}
          placeholder="Ej.: «am» es la única que va con I"
          className={modalInputCls}
        />
      </label>
      <div className="flex flex-wrap gap-2">
        <UIButton tone="accent" onClick={() => cerrar("fixed")} disabled={enviando || ids.length === 0}>
          Arreglado ({ids.length})
        </UIButton>
        <UIButton tone="neutral" onClick={() => cerrar("dismissed")} disabled={enviando || ids.length === 0}>
          Descartar
        </UIButton>
      </div>
    </div>
  );
}
```

Como la nota inicial cambia al aceptar una respuesta, el padre monta `ResolveBar` con `key={notaInicial}` para reiniciar el estado (patrón «derived state by key», sin efecto).

- [ ] **Step 4: `group-list.tsx`**

```tsx
"use client";

import { ETIQUETA_TIPO, etiquetaSuperficie, fechaCorta, resumenMotivos } from "@/lib/admin-reports";
import type { AdminReportGroup } from "@/services/admin.service";

export default function GroupList({
  grupos,
  onAbrir,
}: {
  grupos: AdminReportGroup[];
  onAbrir: (type: string, id: string) => void;
}) {
  if (grupos.length === 0) {
    return (
      <div className="rounded-2xl border-2 border-dashed border-(--border) p-8 text-center text-sm font-semibold text-(--muted)">
        Nada por aquí. Cuando un alumno reporte un ejercicio, aparece en esta lista.
      </div>
    );
  }
  return (
    <ul className="flex flex-col gap-2">
      {grupos.map((g) => (
        <li key={`${g.type}:${g.id}`}>
          <button
            type="button"
            onClick={() => onAbrir(g.type, g.id)}
            className="flex w-full flex-col gap-1.5 rounded-2xl border-2 border-(--border) bg-(--surface) px-4 py-3 text-left transition-colors hover:border-(--accent)"
          >
            <span className="line-clamp-2 font-display text-base font-extrabold text-foreground">
              {g.prompt || "(sin texto)"}
            </span>
            <span className="flex flex-wrap items-center gap-2 text-xs font-bold text-(--muted)">
              <span className="rounded-full bg-(--accent)/15 px-2 py-0.5 text-[10px] font-extrabold uppercase text-(--accent)">
                {ETIQUETA_TIPO[g.type] ?? g.type}
              </span>
              <span>{etiquetaSuperficie(g.surface)}</span>
              {g.where && <span>· {g.where}</span>}
            </span>
            <span className="text-sm font-semibold text-foreground">{resumenMotivos(g.reasons)}</span>
            <span className="text-xs font-semibold text-(--muted)">
              {g.students} {g.students === 1 ? "alumno" : "alumnos"} · último {fechaCorta(g.lastAt)}
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}
```

- [ ] **Step 5: `group-detail.tsx`**

Estructura (todo en español, mismo kit que el resto del admin):

```tsx
"use client";

import { useEffect, useState } from "react";

import Spinner from "@/components/ui/Spinner/Spinner";
import UIButton from "@/components/ui/button/button";
import ContentEditor, { cambiarEncendido, tieneInterruptor } from "@/components/admin/reports/content-editor";
import ResolveBar from "@/components/admin/reports/resolve-bar";
import {
  ETIQUETA_TIPO,
  alternativaPara,
  camposVisibles,
  etiquetaMotivoAdmin,
  etiquetaSuperficie,
  fechaCorta,
  idsPendientes,
  notaPorDefecto,
  puedeAceptar,
} from "@/lib/admin-reports";
import {
  createAnswerAlternative,
  deleteAnswerAlternative,
  getReportGroup,
  type AdminReportAnswer,
  type AdminReportGroupDetail,
} from "@/services/admin.service";

export default function GroupDetail({
  type,
  id,
  flash,
  onVolver,
}: {
  type: string;
  id: string;
  flash: (text: string, kind?: "ok" | "error") => void;
  onVolver: () => void;
}) {
  const [detalle, setDetalle] = useState<AdminReportGroupDetail | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [fetchAttempt, setFetchAttempt] = useState(0);
  const [marcados, setMarcados] = useState<number[] | null>(null); // null = todos los pendientes
  const [nota, setNota] = useState("");
  const [editando, setEditando] = useState(false);

  useEffect(() => {
    let vivo = true;
    getReportGroup(type, id)
      .then((d) => {
        if (vivo) setDetalle(d);
      })
      .catch(() => {
        if (vivo) setLoadError(true);
      });
    return () => {
      vivo = false;
    };
  }, [type, id, fetchAttempt]);

  // Recargar por evento (patrón fetchAttempt, regla 3): el handler resetea y bumpea.
  const recargar = () => {
    setLoadError(false);
    setDetalle(null);
    setMarcados(null);
    setFetchAttempt((n) => n + 1);
  };

  if (loadError) {
    return (
      <div className="flex flex-col items-start gap-3">
        <button type="button" onClick={onVolver} className="text-sm font-extrabold text-(--accent)">← Volver a reportes</button>
        <div className="rounded-2xl border-2 border-(--danger)/30 bg-(--danger)/10 p-4 text-sm font-bold text-(--danger)">
          No se pudo cargar este reporte.
        </div>
        <UIButton onClick={recargar}>Reintentar</UIButton>
      </div>
    );
  }
  if (!detalle) return <div className="py-16"><Spinner title="Cargando el reporte…" /></div>;

  const pendientes = idsPendientes(detalle.reports);
  const seleccion = marcados ?? pendientes;
  const contenido = detalle.content;

  const aceptar = (r: AdminReportAnswer) => {
    const alt = alternativaPara(type, r);
    if (!alt) return;
    createAnswerAlternative({ targetType: alt.targetType, targetId: id, kind: alt.kind, value: r.answer, sourceReportId: r.reportIds[0] })
      .then(() => {
        flash(notaPorDefecto(r.answer));
        setMarcados(r.reportIds.filter((rid) => pendientes.includes(rid)));
        setNota(notaPorDefecto(r.answer));
        setFetchAttempt((n) => n + 1);
      })
      .catch(() => flash("No se pudo aceptar la respuesta.", "error"));
  };

  const quitar = (altId: number) => {
    deleteAnswerAlternative(altId)
      .then(() => {
        flash("Respuesta quitada.");
        setFetchAttempt((n) => n + 1);
      })
      .catch(() => flash("No se pudo quitar.", "error"));
  };

  const alternar = (rid: number) =>
    setMarcados((prev) => {
      const base = prev ?? pendientes;
      return base.includes(rid) ? base.filter((x) => x !== rid) : [...base, rid];
    });

  // … render: ver Step 6
}
```

- [ ] **Step 6: Render del detalle**

Sustituye el comentario `// … render: ver Step 6` por este `return` (importa además `import { Icon } from "@/components/ui/icon";`):

```tsx
  const chip = "rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase";
  const botonFila =
    "rounded-lg border-2 border-(--border) px-2.5 py-1 text-xs font-bold text-(--muted) hover:border-(--accent) hover:text-(--accent)";
  const encendido = contenido?.content.enabled === true;

  const alternarEncendido = () =>
    cambiarEncendido(type, Number(id), !encendido)
      .then(() => {
        flash(encendido ? "Ejercicio apagado." : "Ejercicio encendido.");
        setFetchAttempt((n) => n + 1);
      })
      .catch(() => flash("No se pudo cambiar.", "error"));

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <button type="button" onClick={onVolver} className="w-fit text-sm font-extrabold text-(--accent)">
          ← Volver a reportes
        </button>
        <div className="flex flex-wrap items-center gap-2 text-xs font-bold text-(--muted)">
          <span className={`${chip} bg-(--accent)/15 text-(--accent)`}>{ETIQUETA_TIPO[type] ?? type}</span>
          {detalle.where && <span>{detalle.where}</span>}
        </div>
        <h1 className="font-display text-xl font-extrabold text-foreground">{detalle.prompt || "(sin texto)"}</h1>
      </div>

      <section className="flex flex-col gap-3 rounded-2xl border-2 border-(--border) bg-(--surface) p-4">
        <h2 className="text-xs font-extrabold uppercase tracking-widest text-(--muted)">Así está ahora</h2>
        {contenido === null ? (
          <p className="text-sm font-semibold text-(--muted)">
            {type === "false_friend"
              ? "Falso amigo fijo en el código (FALSE_FRIENDS en games.service.ts): se arregla en el backend."
              : "Este contenido ya no existe; queda la foto que mandó el alumno."}
          </p>
        ) : (
          <>
            <dl className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {camposVisibles(type, contenido.content).map((c) => (
                <div key={c.label} className="flex flex-col">
                  <dt className="text-xs font-bold text-(--muted)">{c.label}</dt>
                  <dd className="text-sm font-semibold text-foreground">{c.value}</dd>
                </div>
              ))}
            </dl>
            {contenido.parentLabel && (
              <p className="text-xs font-semibold text-(--muted)">Vive en {contenido.parentLabel}</p>
            )}
            <div className="flex flex-wrap gap-2">
              <button type="button" className={botonFila} onClick={() => setEditando(true)}>
                Editar
              </button>
              {tieneInterruptor(type, contenido.content) && (
                <button type="button" className={botonFila} onClick={alternarEncendido}>
                  {encendido ? "Apagar" : "Encender"}
                </button>
              )}
            </div>
          </>
        )}
      </section>

      {detalle.answers.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-xs font-extrabold uppercase tracking-widest text-(--muted)">Lo que respondieron</h2>
          <ul className="flex flex-col gap-2">
            {detalle.answers.map((r) => (
              <li
                key={`${r.kind}:${r.answer}`}
                className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-(--surface) px-4 py-3"
              >
                <span className="text-sm font-semibold text-foreground">
                  «{r.answer}» · {r.count} {r.count === 1 ? "alumno" : "alumnos"}
                </span>
                {puedeAceptar(type) && alternativaPara(type, r) && (
                  <button type="button" className={botonFila} onClick={() => aceptar(r)}>
                    Aceptar «{r.answer}»
                  </button>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {puedeAceptar(type) && (
        <section className="flex flex-col gap-2">
          <h2 className="text-xs font-extrabold uppercase tracking-widest text-(--muted)">Respuestas que ya valen</h2>
          {detalle.alternatives.length === 0 ? (
            <p className="text-sm font-semibold text-(--muted)">Todavía ninguna.</p>
          ) : (
            <ul className="flex flex-wrap gap-2">
              {detalle.alternatives.map((a) => (
                <li
                  key={a.id}
                  className="flex items-center gap-2 rounded-full bg-(--accent)/15 px-3 py-1 text-xs font-bold text-(--accent)"
                >
                  {a.value}
                  <span className="text-(--muted)">· {a.kind === "word" ? "palabra" : "orden"}</span>
                  <button type="button" onClick={() => quitar(a.id)} className="font-black underline">
                    Quitar
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <section className="flex flex-col gap-2">
        <h2 className="text-xs font-extrabold uppercase tracking-widest text-(--muted)">
          Reportes ({detalle.reports.length})
        </h2>
        <ul className="flex flex-col gap-2">
          {detalle.reports.map((r) => {
            const pendiente = r.status === "pending";
            const on = seleccion.includes(r.id);
            return (
              <li key={r.id} className="flex gap-3 rounded-2xl border-2 border-(--border) bg-(--surface) px-4 py-3">
                {pendiente ? (
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={on}
                    aria-label={`Incluir el reporte de ${r.userName}`}
                    onClick={() => alternar(r.id)}
                    className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-md"
                    style={{
                      background: on ? "var(--accent)" : "transparent",
                      border: on ? "none" : "2px solid var(--border)",
                      color: "var(--accent-contrast)",
                    }}
                  >
                    {on && <Icon name="check" size={14} mono />}
                  </button>
                ) : (
                  <span
                    className={`${chip} h-fit ${
                      r.status === "fixed" ? "bg-(--success)/15 text-(--success)" : "bg-(--muted)/15 text-(--muted)"
                    }`}
                  >
                    {r.status === "fixed" ? "Arreglado" : "Descartado"}
                  </span>
                )}
                <div className="flex min-w-0 flex-col gap-1">
                  <span className="flex flex-wrap items-center gap-2 text-sm font-extrabold text-foreground">
                    {r.userName}
                    {r.isAdmin && <span className={`${chip} bg-(--purple)/15 text-(--purple)`}>admin</span>}
                    <span className="text-xs font-semibold text-(--muted)">{fechaCorta(r.createdAt)}</span>
                  </span>
                  <span className="text-xs font-bold text-(--muted)">
                    {r.reasons.map(etiquetaMotivoAdmin).join(" · ")} — {etiquetaSuperficie(r.surface)}
                    {r.mode ? ` · ${r.mode}` : ""}
                  </span>
                  {r.answer && (
                    <span className="text-sm font-semibold text-foreground">
                      Respondió «{r.answer}»{r.expected ? `, se esperaba «${r.expected}»` : ""}
                    </span>
                  )}
                  {r.comment && <span className="text-sm text-foreground">«{r.comment}»</span>}
                  {!pendiente && r.note && (
                    <span className="text-xs font-semibold text-(--muted)">Nota: {r.note}</span>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      {pendientes.length > 0 && (
        <ResolveBar key={nota} ids={seleccion} notaInicial={nota} flash={flash} onResuelto={recargar} />
      )}

      {editando && contenido && (
        <ContentEditor
          type={type}
          data={contenido}
          onClose={() => setEditando(false)}
          onSaved={(m) => {
            flash(m);
            setEditando(false);
            setFetchAttempt((n) => n + 1);
          }}
        />
      )}
    </div>
  );
```

- [ ] **Step 7: `bug-list.tsx`**

```tsx
"use client";

import { useState } from "react";

import ResolveBar from "@/components/admin/reports/resolve-bar";
import { etiquetaMotivoAdmin, etiquetaSuperficie, fechaCorta } from "@/lib/admin-reports";
import type { AdminBugReport } from "@/services/admin.service";

type ErrorAnotado = { mensaje?: string; origen?: string; hora?: string };
const texto = (v: unknown) => (v == null ? "" : String(v));

/** Pestaña Bugs (spec 2026-10-01 §2.4): uno por uno, con el contexto técnico al expandir. */
export default function BugList({
  bugs,
  flash,
  onCambio,
}: {
  bugs: AdminBugReport[];
  flash: (text: string, kind?: "ok" | "error") => void;
  onCambio: () => void;
}) {
  const [abierto, setAbierto] = useState<number | null>(null);

  if (bugs.length === 0) {
    return (
      <div className="rounded-2xl border-2 border-dashed border-(--border) p-8 text-center text-sm font-semibold text-(--muted)">
        Sin fallos reportados. Ojalá siga así.
      </div>
    );
  }

  return (
    <ul className="flex flex-col gap-2">
      {bugs.map((r) => {
        const expandido = abierto === r.id;
        const ctx = r.context;
        const errores = Array.isArray(ctx.errores) ? (ctx.errores as ErrorAnotado[]) : [];
        const lugar = texto(ctx.lugar);
        const foto = typeof r.snapshot.prompt === "string" ? r.snapshot.prompt : "";
        const tecnico: Array<[string, unknown]> = [
          ["Ruta", ctx.route],
          ["Navegador", ctx.ua],
          ["Pantalla", ctx.viewport],
          ["Instalada", ctx.standalone === true ? "sí" : "no"],
          ["Versión", ctx.build],
        ];
        return (
          <li key={r.id} className="rounded-2xl border-2 border-(--border) bg-(--surface)">
            <button
              type="button"
              onClick={() => setAbierto(expandido ? null : r.id)}
              aria-expanded={expandido}
              className="flex w-full flex-col gap-1 px-4 py-3 text-left"
            >
              <span className="flex flex-wrap items-center gap-2 text-sm font-extrabold text-foreground">
                {r.userName}
                {r.isAdmin && (
                  <span className="rounded-full bg-(--purple)/15 px-2 py-0.5 text-[10px] font-extrabold uppercase text-(--purple)">
                    admin
                  </span>
                )}
                <span className="text-xs font-semibold text-(--muted)">{fechaCorta(r.createdAt)}</span>
              </span>
              <span className="text-xs font-bold text-(--muted)">
                {etiquetaSuperficie(r.surface)}
                {lugar ? ` · ${lugar}` : ""}
                {r.where ? ` · ${r.where}` : ""} — {r.reasons.map(etiquetaMotivoAdmin).join(" · ")}
              </span>
              {r.comment && <span className="text-sm text-foreground">«{r.comment}»</span>}
            </button>
            {expandido && (
              <div className="flex flex-col gap-3 border-t-2 border-(--border) px-4 py-3">
                <dl className="grid grid-cols-1 gap-1 text-xs sm:grid-cols-2">
                  {tecnico.map(([k, v]) => (
                    <div key={k} className="flex gap-2">
                      <dt className="font-bold text-(--muted)">{k}</dt>
                      <dd className="min-w-0 break-words font-semibold text-foreground">{texto(v)}</dd>
                    </div>
                  ))}
                </dl>
                {foto && <p className="text-sm font-semibold text-foreground">Lo que veía: «{foto}»</p>}
                {errores.length > 0 && (
                  <div className="flex flex-col gap-1">
                    <span className="text-xs font-bold uppercase tracking-widest text-(--muted)">Últimos errores</span>
                    <ul className="flex flex-col gap-1 font-mono text-[11px] text-foreground">
                      {errores.map((e, i) => (
                        <li key={i} className="break-words">
                          {texto(e.hora).slice(11, 19)} · {texto(e.mensaje)}
                          {e.origen ? ` · ${e.origen}` : ""}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {r.status === "pending" ? (
                  <ResolveBar ids={[r.id]} flash={flash} onResuelto={onCambio} />
                ) : (
                  <p className="text-xs font-semibold text-(--muted)">
                    {r.status === "fixed" ? "Arreglado" : "Descartado"}
                    {r.note ? ` · ${r.note}` : ""}
                  </p>
                )}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
```

- [ ] **Step 8: La página**

`app/(app)/admin/reports/page.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";

import Spinner from "@/components/ui/Spinner/Spinner";
import UIButton from "@/components/ui/button/button";
import { ToastBanner, useToast } from "@/components/admin/ui";
import BugList from "@/components/admin/reports/bug-list";
import GroupDetail from "@/components/admin/reports/group-detail";
import GroupList from "@/components/admin/reports/group-list";
import { refrescarConteoReportes } from "@/lib/report-counts";
import {
  getBugReports,
  getReportGroups,
  type AdminBugReport,
  type AdminReportGroup,
  type AdminReportStatus,
} from "@/services/admin.service";

type Pestana = "contenido" | "bugs";

const tabCls = (on: boolean) =>
  `rounded-xl px-4 py-2 text-sm font-extrabold transition-colors ${
    on ? "bg-(--accent) text-white" : "text-(--muted) hover:bg-(--accent)/10 hover:text-(--accent)"
  }`;

/** Bandeja de reportes (spec 2026-10-01 §2). */
export default function AdminReportsPage() {
  const [pestana, setPestana] = useState<Pestana>("contenido");
  const [estado, setEstado] = useState<AdminReportStatus>("pending");
  const [grupos, setGrupos] = useState<AdminReportGroup[] | null>(null);
  const [bugs, setBugs] = useState<AdminBugReport[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [fetchAttempt, setFetchAttempt] = useState(0);
  const [abierto, setAbierto] = useState<{ type: string; id: string } | null>(null);
  const [toast, flash] = useToast();

  useEffect(() => {
    let vivo = true;
    const pedido =
      pestana === "contenido"
        ? getReportGroups(estado).then((g) => {
            if (vivo) setGrupos(g);
          })
        : getBugReports(estado).then((b) => {
            if (vivo) setBugs(b);
          });
    pedido.catch(() => {
      if (vivo) setLoadError(true);
    });
    return () => {
      vivo = false;
    };
  }, [pestana, estado, fetchAttempt]);

  // Todo reset va en el evento, nunca en el efecto (regla 3).
  const recargar = () => {
    setLoadError(false);
    setGrupos(null);
    setBugs(null);
    setFetchAttempt((n) => n + 1);
    refrescarConteoReportes();
  };
  const cambiarPestana = (p: Pestana) => {
    setPestana(p);
    setLoadError(false);
  };
  const cambiarEstado = (e: AdminReportStatus) => {
    setEstado(e);
    setGrupos(null);
    setBugs(null);
    setLoadError(false);
  };

  if (abierto) {
    return (
      <>
        <GroupDetail
          type={abierto.type}
          id={abierto.id}
          flash={flash}
          onVolver={() => {
            setAbierto(null);
            recargar();
          }}
        />
        {toast && <ToastBanner toast={toast} />}
      </>
    );
  }

  const lista = pestana === "contenido" ? grupos : bugs;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-extrabold text-foreground">Reportes</h1>
        <div className="flex w-fit gap-1 rounded-2xl border-2 border-(--border) bg-(--surface) p-1">
          <button type="button" onClick={() => cambiarEstado("pending")} className={tabCls(estado === "pending")}>
            Pendientes
          </button>
          <button type="button" onClick={() => cambiarEstado("closed")} className={tabCls(estado === "closed")}>
            Cerrados
          </button>
        </div>
      </div>

      <div className="flex w-fit gap-1 rounded-2xl border-2 border-(--border) bg-(--surface) p-1">
        <button type="button" onClick={() => cambiarPestana("contenido")} className={tabCls(pestana === "contenido")}>
          Contenido
        </button>
        <button type="button" onClick={() => cambiarPestana("bugs")} className={tabCls(pestana === "bugs")}>
          Bugs
        </button>
      </div>

      {loadError ? (
        <div className="flex flex-col items-start gap-3">
          <div className="rounded-2xl border-2 border-(--danger)/30 bg-(--danger)/10 p-4 text-sm font-bold text-(--danger)">
            No se pudieron cargar los reportes.
          </div>
          <UIButton onClick={recargar}>Reintentar</UIButton>
        </div>
      ) : lista === null ? (
        <div className="py-16">
          <Spinner title="Cargando reportes…" />
        </div>
      ) : pestana === "contenido" ? (
        <GroupList grupos={grupos ?? []} onAbrir={(type, id) => setAbierto({ type, id })} />
      ) : (
        <BugList bugs={bugs ?? []} flash={flash} onCambio={recargar} />
      )}

      {toast && <ToastBanner toast={toast} />}
    </div>
  );
}
```

- [ ] **Step 9: Verificar y commit**

```bash
npm run lint && npx next build
git add "app/(app)/admin/reports" components/admin/reports components/admin/foundations
git commit -m "feat(reportes): bandeja del admin con grupos por ejercicio, bugs, edición en el sitio y respuestas aceptadas

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

Expected: build con la ruta `/admin/reports` en la lista.

### Task B18: Respuestas aceptadas en los editores

**Files:**
- Create: `components/admin/answer-alternatives-editor.tsx`
- Modify: `components/admin/sentence-modal.tsx` (sección nueva, solo en edición)
- Modify: el `ItemModal` de `components/admin/foundations/grammar-manager.tsx` (sección nueva, solo en edición)

**Interfaces:**
- Consumes: `getAnswerAlternatives`, `createAnswerAlternative`, `deleteAnswerAlternative` (B15).
- Produces: `<AnswerAlternativesEditor targetType targetId kinds />`.

- [ ] **Step 1: El editor**

```tsx
"use client";

import { useEffect, useState } from "react";

import { Field, modalInputCls } from "@/components/admin/ui";
import {
  createAnswerAlternative,
  deleteAnswerAlternative,
  getAnswerAlternatives,
  type AdminAnswerAlternative,
} from "@/services/admin.service";

const TITULO = { word: "Otras palabras que valen", sentence: "Otros órdenes que valen" } as const;
const AYUDA = {
  word: "No salen como opción incorrecta de este ejercicio.",
  sentence: "«Arma la oración» y el Constructor los aceptan.",
} as const;

/**
 * Respuestas aceptadas de un ejercicio (spec 2026-10-01 §2.6). Guarda al
 * momento contra /admin/answer-alternatives, sin pasar por «Guardar» del modal.
 */
export default function AnswerAlternativesEditor({
  targetType,
  targetId,
  kinds,
}: {
  targetType: "sentence" | "grammar_item";
  targetId: number;
  kinds: ReadonlyArray<"word" | "sentence">;
}) {
  const [lista, setLista] = useState<AdminAnswerAlternative[] | null>(null);
  const [borradores, setBorradores] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [fetchAttempt, setFetchAttempt] = useState(0);

  useEffect(() => {
    let vivo = true;
    getAnswerAlternatives(targetType, targetId)
      .then((l) => {
        if (vivo) setLista(l);
      })
      .catch(() => {
        if (vivo) setError("No se pudieron cargar las respuestas aceptadas.");
      });
    return () => {
      vivo = false;
    };
  }, [targetType, targetId, fetchAttempt]);

  const anadir = (kind: "word" | "sentence") => {
    const value = (borradores[kind] ?? "").trim();
    if (!value) return;
    setError(null);
    createAnswerAlternative({ targetType, targetId: String(targetId), kind, value })
      .then(() => {
        setBorradores((b) => ({ ...b, [kind]: "" }));
        setFetchAttempt((n) => n + 1);
      })
      .catch(() => setError("No se pudo guardar."));
  };

  const quitar = (id: number) => {
    setError(null);
    deleteAnswerAlternative(id)
      .then(() => setFetchAttempt((n) => n + 1))
      .catch(() => setError("No se pudo quitar."));
  };

  return (
    <div className="flex flex-col gap-4 rounded-2xl border-2 border-dashed border-(--border) p-4">
      {kinds.map((kind) => (
        <Field key={kind} label={TITULO[kind]}>
          <p className="text-xs font-semibold text-(--muted)">{AYUDA[kind]}</p>
          <ul className="flex flex-wrap gap-2">
            {(lista ?? [])
              .filter((a) => a.kind === kind)
              .map((a) => (
                <li key={a.id} className="flex items-center gap-1 rounded-full bg-(--accent)/15 px-3 py-1 text-xs font-bold text-(--accent)">
                  {a.value}
                  <button type="button" onClick={() => quitar(a.id)} aria-label={`Quitar ${a.value}`} className="ml-1 font-black">
                    ×
                  </button>
                </li>
              ))}
          </ul>
          <div className="flex gap-2">
            <input
              value={borradores[kind] ?? ""}
              onChange={(e) => setBorradores((b) => ({ ...b, [kind]: e.target.value }))}
              placeholder={kind === "word" ? "feel" : "Today I am happy"}
              className={modalInputCls}
            />
            <button
              type="button"
              onClick={() => anadir(kind)}
              className="shrink-0 rounded-lg border-2 border-(--border) px-3 text-xs font-bold text-(--muted) hover:border-(--accent)"
            >
              Añadir
            </button>
          </div>
        </Field>
      ))}
      {error && <p className="text-xs font-bold text-(--danger)">{error}</p>}
    </div>
  );
}
```

(el «×» es un carácter de texto, no un emoji; si el lint de iconos lo marca, usa `<Icon name="cruz" size={12} mono />`.)

- [ ] **Step 2: Montarlo**

- `sentence-modal.tsx`: al final del cuerpo del modal, solo cuando hay id (edición o recién creada: el modal usa `savedId`/`sentence?.id`), `<AnswerAlternativesEditor targetType="sentence" targetId={idActual} kinds={["word", "sentence"]} />`.
- `ItemModal` de gramática: al final del cuerpo, solo en edición (`item`), `<AnswerAlternativesEditor targetType="grammar_item" targetId={item.id} kinds={["word"]} />`.

- [ ] **Step 3: Verificar y commit**

```bash
npm run lint && npx tsc --noEmit
git add components/admin/answer-alternatives-editor.tsx components/admin/sentence-modal.tsx components/admin/foundations/grammar-manager.tsx
git commit -m "feat(reportes): los editores de oraciones y gramática muestran y gestionan las respuestas aceptadas

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task B19: Documentación del webapp

**Files:**
- Modify: `docs/ARQUITECTURA.md`

- [ ] **Step 1: Sección nueva**

Añade «### Reportes de ejercicios» (después de «Pistas contextuales» o de «Modo admin»): la banderita y el store `lib/report-targets.ts` (quién publica, quién registra, por qué un store y no props); la hoja (`components/report/report-sheet.tsx`) y la lógica pura (`lib/report.ts`, `lib/accepted-answers.ts`, `lib/report-notice.ts`, `lib/admin-reports.ts`, `lib/report-counts.ts`, todos bajo `node --test`); el reporte de Ajustes; los juegos (`ReportButton` en `GameResult`, ghost-race, Palabra del Día y Mini Crucigrama); el aviso de vuelta en el hub (`ReportNoticeWatch`, solo en el Camino, toma el scroll, espera a `[data-rival-alert]`); la bandeja `/admin/reports` (grupos, bugs, editar en el sitio, aceptar respuestas, cerrar con nota y gemas) y los contadores. Añade una línea de deuda: «el aviso de resultados puede quedar debajo de una pista que suba después de pintarse, como el de rival; no se pierde porque no se cierra solo».

- [ ] **Step 2: Commit**

```bash
git add docs/ARQUITECTURA.md
git commit -m "docs(reportes): banderita, hoja, aviso de vuelta y bandeja del admin

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

# Parte C — Cierre

### Task C1: Verificación completa

- [ ] **Step 1: Backend**

Run (en el worktree del backend): `npm test && npm run build`
Expected: toda la suite en verde y build limpio. Copia la línea de resumen de jest (`Tests: N passed`).

- [ ] **Step 2: Webapp**

Run (en el worktree del webapp): `npm run lint && npm run test:scripts && npx next build`
Expected: lint limpio (incluye `check-icons` y `check-doty-assets`), todos los `node --test` en verde y build con `/admin/reports` en la lista de rutas.

- [ ] **Step 3: Barrido de reglas**

Run: `git -C <webapp-wt> diff origin/main --stat` y revisa a mano que ningún archivo nuevo use `window.location` para navegar, emoji como icono, `<select>` en un juego, ni `setState` dentro de un `useEffect` síncrono.

### Task C2: Migración en producción (necesita el «sí» de Sergio)

- [ ] **Step 1: Dry-run**

Run (backend): `node scripts/migrate-reports.js`
Expected: `tables to create: content_reports, answer_alternatives`.

- [ ] **Step 2: PARAR y pedir consentimiento**

Enséñale a Sergio la salida del dry-run y el DDL (spec §3.1) y pregúntale si corres la migración en la BD de producción. Sin una frase explícita suya en esta conversación («corre la migración»), no sigas.

- [ ] **Step 3: Aplicar y verificar**

Run: `node scripts/migrate-reports.js --apply`
Expected: `Migration verified OK.` y un `scripts/out/backup-reports-<ts>.json`. Anota la ruta del backup.

### Task C3: Verificación en el preview

- [ ] **Step 1: Levantar backend y webapp de los worktrees**

El watcher de Sergio en `:4000` sirve el checkout principal, no esta rama. Añade temporalmente a `.claude/launch.json` del webapp dos configuraciones: `dots-backend-reportes` (`cd /home/endurance/Projects/Endurance/dots/dots-backend/.claude/worktrees/reportes-ejercicios && PORT=4100 npm run start:dev`, port 4100) y `dots-webapp-reportes` (`NEXT_PUBLIC_API_URL=http://localhost:4100 npm run dev`, autoPort). Arráncalas con `preview_start`. **Revierte `launch.json` al terminar** (está trackeado).

- [ ] **Step 2: Comprobar lo que no escribe**

Con la sesión que Sergio abra él mismo en el Browser pane (no escribas contraseñas): en `/practice?id=19` la banderita aparece en la barra, la hoja abre con los motivos correctos antes y después de responder, y tras fallar sale «Mi respuesta debería estar bien» con «Elegiste… · esperábamos…». Repite en una lección de vocabulario (avanza sola: debe ofrecer «el anterior»), en un juego (botón en el resultado) y en Ajustes. En `/admin/reports` (con el perfil admin de Sergio) la página carga, las pestañas cambian y los vacíos se ven bien. Mide con `read_page`/`javascript_tool` y captura pantalla de la hoja y de la bandeja.

- [ ] **Step 3: Un reporte real, con permiso**

Enviar un reporte escribe en producción. Pide a Sergio que lo envíe él o que te autorice a enviarlo; luego ábrelo en la bandeja, acéptale una alternativa si aplica, ciérralo como **descartado** (no paga gemas) y comprueba en el Camino que sale el aviso. Si aceptaste una alternativa de prueba, quítala desde el detalle.

### Task C4: Revisión final y subida a main (necesita el «sí» de Sergio)

- [ ] **Step 1: Revisión de código**

Usa `superpowers:requesting-code-review` sobre el diff de los dos repos contra `origin/main`; corrige lo que salga y vuelve a correr C1.

- [ ] **Step 2: Rebase**

En cada worktree: `git fetch origin && git rebase origin/main`. Si entraron commits nuevos, vuelve a correr C1 completo. Resuelve conflictos a mano (otras sesiones tocan `games.service.ts` y el admin en paralelo).

- [ ] **Step 3: PARAR y pedir consentimiento**

Pregunta a Sergio si subes los dos repos a main. Con su «sí»: backend primero (`git push origin HEAD:main` en el worktree del backend), luego webapp (`git push origin HEAD:main` en el worktree del webapp). Si el clasificador bloquea el push, déjale los dos comandos en bloques `bash` para que los corra él.

- [ ] **Step 4: Memoria**

Actualiza `reportes-de-ejercicios.md` en la memoria del proyecto: en main (con los SHAs), migración aplicada (con la ruta del backup) y lo que quedó sin probar en vivo.
