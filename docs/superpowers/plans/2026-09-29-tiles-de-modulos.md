# Tiles de módulos del Camino — plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que los 58 nodos-módulo de las secciones 1 a 3 del Camino pinten una imagen que describe su contenido en vez del icono de su tipo.

**Architecture:** La imagen vive en una columna nueva `path_nodes.src` que `GET /path` devuelve en todo nodo (los `practice` siguen heredando `levels.src`). Un script de backend (`set-node-art.js`) la rellena por `tipo:ref_id` y solo escribe las filas cuyo PNG ya responde 200 en producción, así que se corre una vez por tanda. El arte sale del pipeline `scripts/mj/` en un catálogo nuevo `fase-5.json` que crece tanda a tanda.

**Tech Stack:** NestJS 11 + TypeORM + pg (dots-backend), Next.js 16 + React 19 (dots-webapp), Python 3.12 + Pillow + rembg vía `uv` (pipeline de Midjourney), jest, pytest.

**Spec:** `docs/superpowers/specs/2026-09-29-tiles-de-modulos-design.md`

## Global Constraints

- Node 24: `nvm use` antes de cualquier `node`/`npm` (en fish, `nvm use` a secas; en bash, `source ~/.nvm/nvm.sh && nvm use`).
- **Nunca `--apply` ni `--rollback` contra la BD sin consentimiento explícito de Sergio en esa conversación** (regla 1 del CLAUDE.md del backend). Los dry-run son de solo lectura y no lo necesitan. Si el clasificador de permisos bloquea un `--apply`, no se rodea: se le pasa a Sergio el comando exacto para su terminal.
- Todo script que toque tablas: dry-run por defecto, `--apply`, respaldo JSON en `scripts/out/`, `--rollback <respaldo>`. DDL solo aditivo (`ADD COLUMN IF NOT EXISTS`).
- **El checkout `/home/endurance/Projects/Endurance/dots/dots-backend` es compartido** (otra sesión lo tiene en `feat/modo-admin` y corre el watcher en :4000): nunca cambiar de branch ahí. Todo el backend se trabaja en el worktree `/home/endurance/Projects/Endurance/dots/dots-backend/.claude/worktrees/tiles-modulos`.
- Webapp: `npm run lint` y `npx next build` antes de cada commit con código. Backend: `npx jest` en verde; lint solo de los archivos propios y sin `--fix` (`npm run lint` reformatea archivos ajenos).
- Paleta de rellenos: rosa `#FF1F8F`, azul `#3768FF`, cyan `#35D8F5` y blanco; el navy `#1E1B5C` es solo línea. Única excepción: el tile `colores`.
- Tiles: 512 px en `public/images/levels/<slug>.png`; el Camino los pinta a 128 px (`ART` en `components/path/path-node.tsx`).
- Producción: `https://app.dotsonlinelearning.com` (Vercel) y `https://api.dotsonlinelearning.com` (Render).
- Descargas de Midjourney (fuera de git): `/home/endurance/Projects/Endurance/dots/imagenes/mj/<fase>/`.
- Copy del admin en inglés (como el resto de `/admin`); UI de producto en español.
- Cada commit termina con `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Mapa de archivos

**dots-backend** (worktree `tiles-modulos`, branch `feat/tiles-modulos`):

| Archivo | Qué hace |
|---|---|
| `scripts/merge-duplicate-nodes.js` | (ya escrito y aplicado) se commitea tal cual |
| `src/modules/path/node-src.ts` | **nuevo** — `resolveNodeSrc`: qué imagen lleva un nodo |
| `src/modules/path/node-src.spec.ts` | **nuevo** — test de la regla |
| `src/common/entity/path_node.entity.ts` | columna `src` |
| `src/modules/path/path.service.ts` | `toNodeDto` usa `resolveNodeSrc` |
| `src/modules/path/path.dto.ts` | comentario de `src` (ya no es solo de `practice`) |
| `src/modules/admin/admin.dto.ts` | `src` en `CreatePathNodeDto` / `UpdatePathNodeDto` |
| `src/modules/admin/admin-path-node.dto.spec.ts` | **nuevo** — validación de `src` |
| `src/modules/admin/admin.service.ts` | crear, editar y serializar `src` |
| `scripts/migrate-path-node-src.js` | **nuevo** — DDL aditivo |
| `scripts/set-node-art.js` | **nuevo** — asignación `tipo:ref_id → slug` |
| `package.json` | alias `migrate:path-node-src` y `nodes:art` |

**dots-webapp** (este worktree, branch `claude/level-1-descriptive-images-af7087`):

| Archivo | Qué hace |
|---|---|
| `services/admin.service.ts` | `src` en `AdminPathNode` y en los payloads |
| `app/(app)/admin/path/page.tsx` | campo «Image» con vista previa en el modal del nodo |
| `scripts/mj/mjlib.py` | `anchor_sref` también en la línea de slots del lote, `glyphs` (permite texto), `icon_block` por pieza |
| `scripts/mj/tests/test_mjlib.py` | tests de las tres opciones |
| `scripts/mj/batches/fase-5.json` | **nuevo** — catálogo; crece por tanda |
| `scripts/mj/tests/test_catalogo_fase5.py` | **nuevo** — el catálogo cumple la spec |
| `scripts/mj/tile_sheet.py` | **nuevo** — hoja de revisión a 128 px en los dos temas |
| `public/images/levels/*.png` | 46 PNG nuevos, tres tandas |
| `docs/superpowers/specs/2026-09-29-tiles-de-modulos-design.md` | se corrige el rollback de la migración (ver Task 4) |

---

## Parte A — Código (nada toca producción)

### Task 1: Worktree del backend y el script de fusión en git

**Files:**
- Create: worktree `/home/endurance/Projects/Endurance/dots/dots-backend/.claude/worktrees/tiles-modulos`
- Add: `scripts/merge-duplicate-nodes.js` (copiado del checkout compartido, donde está sin trackear)

**Interfaces:**
- Produces: branch `feat/tiles-modulos` desde `origin/main`, con `.env` enlazado y `node_modules` instalado. Todas las tareas de backend trabajan aquí.

- [ ] **Step 1: Crear el worktree**

```bash
git -C /home/endurance/Projects/Endurance/dots/dots-backend fetch origin
git -C /home/endurance/Projects/Endurance/dots/dots-backend worktree add /home/endurance/Projects/Endurance/dots/dots-backend/.claude/worktrees/tiles-modulos -b feat/tiles-modulos origin/main
```

Expected: `Preparing worktree (new branch 'feat/tiles-modulos')`.

- [ ] **Step 2: Enlazar el `.env` e instalar dependencias**

Los scripts leen `../.env` relativo a `scripts/` y `dotenv` lo busca en el cwd. `.env` está en `.gitignore`, así que el enlace no entra en git.

```bash
cd /home/endurance/Projects/Endurance/dots/dots-backend/.claude/worktrees/tiles-modulos
ln -s /home/endurance/Projects/Endurance/dots/dots-backend/.env .env
ln -s /home/endurance/Projects/Endurance/dots/dots-backend/scripts/out scripts/out
source ~/.nvm/nvm.sh && nvm use && npm ci
```

El segundo enlace hace que los respaldos de las escrituras a producción sobrevivan al worktree: `scripts/out/` está en `.gitignore` y `git worktree remove` borra los archivos ignorados. Va antes de correr ningún script, porque `fs.mkdirSync` lo crearía como directorio real y el enlace acabaría dentro de él. Ojo: la regla `scripts/out/` (con barra final) solo ignora directorios, así que `git status` mostrará el enlace como `?? scripts/out`; es lo esperado y nunca se añade (los `git add` de este plan van siempre con rutas explícitas, jamás `-A` ni `.`).

Expected: `added N packages`, sin errores.

- [ ] **Step 3: Traer el script de fusión y comprobar que parsea**

```bash
cp /home/endurance/Projects/Endurance/dots/dots-backend/scripts/merge-duplicate-nodes.js scripts/
node --check scripts/merge-duplicate-nodes.js && git status --short
```

Expected: `?? scripts/merge-duplicate-nodes.js` y el enlace `?? scripts/out` del Step 2, nada más.

- [ ] **Step 4: Commit y retirar la copia sin trackear del checkout compartido**

```bash
git add scripts/merge-duplicate-nodes.js
git commit -m "$(cat <<'EOF'
chore(scripts): la fusión de nodos duplicados del Camino entra en git

Aplicado en producción el 2026-09-29 (respaldo
scripts/out/backup-merge-duplicates-2026-09-29T18-02-00-335Z.json): retira
La casa, El cuerpo, La escuela y el nivel 32 vacío, y pasa cinco palabras de
La escuela a school.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
rm /home/endurance/Projects/Endurance/dots/dots-backend/scripts/merge-duplicate-nodes.js
```

---

### Task 2: `GET /path` devuelve la imagen de todo nodo

**Files:**
- Create: `src/modules/path/node-src.ts`
- Test: `src/modules/path/node-src.spec.ts`
- Modify: `src/common/entity/path_node.entity.ts` (tras la columna `title`)
- Modify: `src/modules/path/path.service.ts` (`toNodeDto`, ~líneas 252-290, y los imports)
- Modify: `src/modules/path/path.dto.ts:12-15`

**Interfaces:**
- Produces: `resolveNodeSrc(node: { type: PathNodeType; src?: string | null }, levelSrc?: string | null): string | null`; `PathNode.src?: string | null` (columna `src varchar(255) NULL`).

- [ ] **Step 1: Escribir el test que falla**

`src/modules/path/node-src.spec.ts`:

```ts
import { resolveNodeSrc } from './node-src';

describe('resolveNodeSrc', () => {
  it('un nodo módulo con imagen propia la devuelve', () => {
    expect(
      resolveNodeSrc({ type: 'vocab', src: '/images/levels/dias.png' }),
    ).toBe('/images/levels/dias.png');
  });

  it('un nodo módulo sin imagen devuelve null: el Camino pinta el icono del tipo', () => {
    expect(resolveNodeSrc({ type: 'letters', src: null })).toBeNull();
    expect(resolveNodeSrc({ type: 'reading' })).toBeNull();
  });

  it('un módulo nunca hereda nada aunque le pasen una imagen de nivel', () => {
    expect(
      resolveNodeSrc({ type: 'grammar', src: null }, '/images/levels/x.png'),
    ).toBeNull();
  });

  it('un practice sin imagen propia hereda la de su nivel, como hasta hoy', () => {
    expect(
      resolveNodeSrc({ type: 'practice', src: null }, '/images/levels/pasado.png'),
    ).toBe('/images/levels/pasado.png');
  });

  it('la imagen propia del nodo manda sobre la del nivel', () => {
    expect(
      resolveNodeSrc(
        { type: 'practice', src: '/images/levels/futuro.png' },
        '/images/levels/pasado.png',
      ),
    ).toBe('/images/levels/futuro.png');
  });

  it('un practice sin imagen propia ni de nivel devuelve null', () => {
    expect(resolveNodeSrc({ type: 'practice', src: null }, null)).toBeNull();
    expect(resolveNodeSrc({ type: 'practice' })).toBeNull();
  });

  it('una cadena vacía cuenta como "sin imagen"', () => {
    expect(resolveNodeSrc({ type: 'vocab', src: '' })).toBeNull();
    expect(resolveNodeSrc({ type: 'practice', src: '' }, '/a.png')).toBe('/a.png');
  });
});
```

- [ ] **Step 2: Correrlo y verlo fallar**

Run: `npx jest src/modules/path/node-src.spec.ts`
Expected: FAIL — `Cannot find module './node-src'`.

- [ ] **Step 3: Implementar la regla**

`src/modules/path/node-src.ts`:

```ts
import type { PathNodeType } from 'src/common/entity/path_node.entity';

/**
 * Imagen de un nodo del Camino (spec webapp 2026-09-29-tiles-de-modulos).
 *
 * Manda la del propio nodo (`path_nodes.src`). Un `practice` sin imagen propia
 * hereda la de su nivel (`levels.src`), que es lo que hacía el Camino antes de
 * la columna. Un módulo sin imagen devuelve null y el frontend pinta el icono
 * de su tipo. La cadena vacía cuenta como "sin imagen": el admin la limpia a
 * null, pero una fila escrita a mano no tiene por qué.
 */
export function resolveNodeSrc(
  node: { type: PathNodeType; src?: string | null },
  levelSrc?: string | null,
): string | null {
  if (node.src) return node.src;
  if (node.type === 'practice') return levelSrc || null;
  return null;
}
```

- [ ] **Step 4: Correr el test y verlo pasar**

Run: `npx jest src/modules/path/node-src.spec.ts`
Expected: PASS, 7 tests.

- [ ] **Step 5: Declarar la columna en la entity**

En `src/common/entity/path_node.entity.ts`, entre la columna `title` y `enabled`:

```ts
  // Imagen del tile en el Camino (`/images/levels/<slug>.png` o URL absoluta).
  // NULL: un practice hereda levels.src y un módulo pinta el icono de su tipo.
  // Ver src/modules/path/node-src.ts.
  @Column({ type: 'varchar', length: 255, nullable: true })
  src?: string | null;
```

- [ ] **Step 6: Usar la regla en `toNodeDto`**

En `src/modules/path/path.service.ts`, añadir el import junto a los demás de `./`:

```ts
import { resolveNodeSrc } from './node-src';
```

En `toNodeDto`, añadir `src` al literal (después de `current: ctx.current,`):

```ts
      current: ctx.current,
      src: resolveNodeSrc(node),
    };
```

y en la rama `practice` sustituir `dto.src = level?.src ?? null;` por:

```ts
      dto.src = resolveNodeSrc(node, level?.src);
```

- [ ] **Step 7: Corregir el comentario del DTO**

En `src/modules/path/path.dto.ts`, `src` deja de ser solo de `practice`. Sustituir:

```ts
  // practice nodes only: the level behind the node (frontend keeps using
  // GET /sentences/practice/:levelId + PUT /sentences/progress for these).
  levelId?: number;
  src?: string | null;
```

por:

```ts
  // practice nodes only: the level behind the node (frontend keeps using
  // GET /sentences/practice/:levelId + PUT /sentences/progress for these).
  levelId?: number;
  // Every node: its tile. NULL → the frontend paints the type icon.
  // Rule in node-src.ts (practice falls back to levels.src).
  src?: string | null;
```

- [ ] **Step 8: Tipos, suite y lint de lo propio**

`prettier/prettier` es error en el eslint del backend; se formatean solo los archivos propios (nunca `npm run lint`, que reformatea ajenos):

```bash
npx prettier --write src/modules/path/node-src.ts src/modules/path/node-src.spec.ts src/modules/path/path.service.ts src/modules/path/path.dto.ts src/common/entity/path_node.entity.ts
npx tsc --noEmit -p tsconfig.json
npx jest
npx eslint src/modules/path/node-src.ts src/modules/path/node-src.spec.ts src/modules/path/path.service.ts src/modules/path/path.dto.ts src/common/entity/path_node.entity.ts
```

Expected: sin errores de tipos; toda la suite en verde; eslint sin errores. `resolveNodeSrc` es la regla entera de `toNodeDto` para `src`: el test de la spec ("nodo módulo con `src`, sin `src`, `practice` que hereda") se cubre sobre ella, y el cableado (que un `practice` hereda `levels.src` y uno propio lo gana) lo cubre `src/modules/path/to-node-dto.spec.ts`, añadido en la tanda de arreglos de la revisión final.

- [ ] **Step 9: Commit**

```bash
git add src/modules/path/node-src.ts src/modules/path/node-src.spec.ts src/common/entity/path_node.entity.ts src/modules/path/path.service.ts src/modules/path/path.dto.ts
git commit -m "$(cat <<'EOF'
feat(camino): todo nodo trae su imagen, no solo los practice

path_nodes.src manda; un practice sin imagen propia sigue heredando
levels.src. Requiere la migración migrate-path-node-src.js aplicada
antes del deploy: la entity declara la columna y el find() la pide.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: El admin lee y escribe la imagen del nodo

**Files:**
- Modify: `src/modules/admin/admin.dto.ts` (import de class-validator, `CreatePathNodeDto`, `UpdatePathNodeDto`)
- Test: `src/modules/admin/admin-path-node.dto.spec.ts`
- Modify: `src/modules/admin/admin.service.ts` (`createPathNode`, `updatePathNode`, `serializePathNode`)

**Interfaces:**
- Consumes: `PathNode.src` (Task 2).
- Produces: `POST /admin/path-nodes` acepta `src?: string`; `PATCH /admin/path-nodes/:id` acepta `src?: string | null` (null borra); la respuesta de ambos y de `GET /admin/sections/:id/nodes` trae `src: string | null`.

- [ ] **Step 1: Escribir el test que falla**

`src/modules/admin/admin-path-node.dto.spec.ts`:

```ts
import { validateSync } from 'class-validator';
import { CreatePathNodeDto, UpdatePathNodeDto } from './admin.dto';

const errorsOf = (dto: object) => validateSync(dto).map((e) => e.property);
const base = { sectionId: 1, position: 10, type: 'vocab', refId: 1 };

describe('CreatePathNodeDto.src', () => {
  it('es opcional', () => {
    expect(errorsOf(Object.assign(new CreatePathNodeDto(), base))).toEqual([]);
  });

  it('acepta una ruta de tile', () => {
    expect(
      errorsOf(
        Object.assign(new CreatePathNodeDto(), {
          ...base,
          src: '/images/levels/dias.png',
        }),
      ),
    ).toEqual([]);
  });

  it('rechaza lo que no es texto o pasa de 255', () => {
    expect(
      errorsOf(Object.assign(new CreatePathNodeDto(), { ...base, src: 42 })),
    ).toEqual(['src']);
    expect(
      errorsOf(
        Object.assign(new CreatePathNodeDto(), { ...base, src: 'x'.repeat(256) }),
      ),
    ).toEqual(['src']);
  });
});

describe('UpdatePathNodeDto.src', () => {
  it('null borra la imagen', () => {
    expect(
      errorsOf(Object.assign(new UpdatePathNodeDto(), { src: null })),
    ).toEqual([]);
  });

  it('acepta una ruta y rechaza más de 255', () => {
    expect(
      errorsOf(
        Object.assign(new UpdatePathNodeDto(), { src: '/images/levels/luna.png' }),
      ),
    ).toEqual([]);
    expect(
      errorsOf(Object.assign(new UpdatePathNodeDto(), { src: 'x'.repeat(256) })),
    ).toEqual(['src']);
  });
});
```

- [ ] **Step 2: Correrlo y verlo fallar**

Run: `npx jest src/modules/admin/admin-path-node.dto.spec.ts`
Expected: FAIL — los casos de `src: 42` y de 256 caracteres devuelven `[]` en vez de `['src']` (sin decoradores, `whitelist` no valida nada).

- [ ] **Step 3: Añadir `src` a los DTO**

En el import de `class-validator` de `src/modules/admin/admin.dto.ts`, añadir `MaxLength` en orden alfabético (entre `Max` y `Min`):

```ts
  Max,
  MaxLength,
  Min,
```

En `CreatePathNodeDto`, después de `title`:

```ts
  // Tile del nodo en el Camino (`/images/levels/<slug>.png` o URL absoluta).
  @IsOptional()
  @IsString()
  @MaxLength(255)
  src?: string;
```

En `UpdatePathNodeDto`, después de `title`:

```ts
  // null borra la imagen: el practice vuelve a heredar la de su nivel y el
  // módulo vuelve al icono de su tipo.
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(255)
  src?: string | null;
```

- [ ] **Step 4: Correr el test y verlo pasar**

Run: `npx jest src/modules/admin/admin-path-node.dto.spec.ts`
Expected: PASS, 5 tests.

- [ ] **Step 5: Crear, editar y serializar `src` en el servicio**

En `src/modules/admin/admin.service.ts`:

`createPathNode`, en el `create({...})`, después de `title: dto.title ?? null,`:

```ts
      src: dto.src ?? null,
```

`updatePathNode`, después de `if (dto.title !== undefined) node.title = dto.title;`:

```ts
    if (dto.src !== undefined) node.src = dto.src;
```

`serializePathNode`, después de `title: n.title ?? '',`:

```ts
      src: n.src ?? null,
```

- [ ] **Step 6: Tipos, suite y lint de lo propio**

```bash
npx prettier --write src/modules/admin/admin.dto.ts src/modules/admin/admin-path-node.dto.spec.ts src/modules/admin/admin.service.ts
npx tsc --noEmit -p tsconfig.json
npx jest
npx eslint src/modules/admin/admin.dto.ts src/modules/admin/admin-path-node.dto.spec.ts src/modules/admin/admin.service.ts
```

Expected: todo en verde.

- [ ] **Step 7: Commit**

```bash
git add src/modules/admin/admin.dto.ts src/modules/admin/admin-path-node.dto.spec.ts src/modules/admin/admin.service.ts
git commit -m "$(cat <<'EOF'
feat(admin): la imagen del nodo se edita desde el CRUD del Camino

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: La migración de la columna

**Files:**
- Create: `scripts/migrate-path-node-src.js`
- Modify: `package.json` (bloque `scripts`, junto a `migrate:settings`)
- Modify (webapp): `docs/superpowers/specs/2026-09-29-tiles-de-modulos-design.md` — §Despliegue, frase del rollback

**Interfaces:**
- Produces: `node scripts/migrate-path-node-src.js [--apply | --rollback <respaldo>]`. Tras `--apply` existe `dots.path_nodes.src varchar(255) NULL`.

- [ ] **Step 1: Escribir el script**

`scripts/migrate-path-node-src.js` (calcado de `migrate-settings.js`):

```js
#!/usr/bin/env node
/**
 * Additive migration: path_nodes.src — el tile de cada nodo del Camino (spec
 * webapp 2026-09-29-tiles-de-modulos). NULL en todas las filas: nada cambia
 * hasta que scripts/set-node-art.js las rellene.
 *
 * Tiene que correr ANTES de desplegar el backend que declara la columna en la
 * entity PathNode: en cuanto la entity la declara, TODO find() de PathNode la
 * pide en el SELECT (GET /path, node-progress —completar nodos—, checkpoint,
 * node-content, path-neighbors, skip-applier —placement— y el admin), así que
 * todo eso responde 500 hasta que la migración se aplica.
 *
 * Usage (from dots-backend/):
 *   node scripts/migrate-path-node-src.js            # dry-run
 *   node scripts/migrate-path-node-src.js --apply    # DDL, backup en scripts/out/
 *   node scripts/migrate-path-node-src.js --rollback scripts/out/backup-path-node-src-<ts>.json
 */
/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require('fs');
const path = require('path');
require('dotenv').config();
const { Client } = require('pg');

const OUT_DIR = path.join(__dirname, 'out');
const DDL = [
  `ALTER TABLE dots.path_nodes ADD COLUMN IF NOT EXISTS src varchar(255)`,
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
    `SELECT 1 FROM information_schema.columns WHERE table_schema='dots' AND table_name=$1 AND column_name=$2`,
    [table, column],
  );
  return res.rows.length > 0;
}

async function rollback(client, backup) {
  // Como migrate-settings y migrate-economy: la columna añadida se deja inerte.
  // Con el backend nuevo desplegado, dropearla rompería GET /path; sin él,
  // nadie la lee. Para deshacer las imágenes está set-node-art.js --rollback.
  for (const c of backup.addedColumns ?? []) {
    console.log(`rollback: la columna ${c.table}.${c.column} queda inerte (no se dropea)`);
  }
  console.log('Rollback complete (nada que deshacer más allá de lo registrado).');
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
    const before = await columnExists(client, 'path_nodes', 'src');
    console.log('== path_nodes.src migration ==');
    console.log(`path_nodes.src: ${before ? 'exists' : 'will be added'}`);
    if (!apply) {
      console.log('\nDry-run only. Re-run with --apply to execute.');
      return;
    }
    const backup = {
      script: 'migrate-path-node-src',
      timestamp: new Date().toISOString(),
      addedColumns: before ? [] : [{ table: 'path_nodes', column: 'src' }],
    };
    // El ADD COLUMN es solo de metadatos, pero espera un lock ACCESS EXCLUSIVE:
    // en la BD compartida, una transacción larga dejaría las lecturas en cola
    // detrás de él. Con el timeout falla rápido y se puede reintentar.
    await client.query(`SET lock_timeout = '5s'`);
    for (const sql of DDL) {
      await client.query(sql);
      console.log('OK:', sql.replace(/\s+/g, ' ').slice(0, 80));
    }
    const backupFile = path.join(OUT_DIR, `backup-path-node-src-${Date.now()}.json`);
    fs.writeFileSync(backupFile, JSON.stringify(backup, null, 2));
    console.log(`\nBackup written: ${backupFile}`);
    if (!(await columnExists(client, 'path_nodes', 'src'))) {
      throw new Error('Verification failed: path_nodes.src missing');
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

- [ ] **Step 2: Alias en `package.json`**

En el bloque `scripts`, después de `"migrate:settings": "node scripts/migrate-settings.js",`:

```json
    "migrate:path-node-src": "node scripts/migrate-path-node-src.js",
```

- [ ] **Step 3: Dry-run (solo lectura)**

Run: `node scripts/migrate-path-node-src.js`
Expected:

```
== path_nodes.src migration ==
path_nodes.src: will be added

Dry-run only. Re-run with --apply to execute.
```

- [ ] **Step 4: Alinear la spec con la convención del repo**

En `docs/superpowers/specs/2026-09-29-tiles-de-modulos-design.md` (webapp), §Despliegue, sustituir:

```
anteriores. La migración solo se deshace antes del paso 2; después, primero
se vuelve al backend anterior y luego se quita la columna.
```

por:

```
anteriores. La migración no se deshace dropeando la columna — como
`migrate-settings` y `migrate-economy`, su `--rollback` la deja inerte: con
el backend nuevo desplegado, quitarla rompería `GET /path`, y sin él nadie la
lee.
```

- [ ] **Step 5: Commit (backend) y commit (webapp)**

```bash
git add scripts/migrate-path-node-src.js package.json
git commit -m "$(cat <<'EOF'
feat(scripts): migración aditiva de path_nodes.src

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
cd /home/endurance/Projects/Endurance/dots/dots-webapp/.claude/worktrees/level-1-descriptive-images-af7087
git add docs/superpowers/specs/2026-09-29-tiles-de-modulos-design.md
git commit -m "$(cat <<'EOF'
docs(spec): la migración de path_nodes.src deja la columna inerte al revertir

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: `set-node-art.js`, la asignación que espera a producción

**Files:**
- Create: `scripts/set-node-art.js`
- Modify: `package.json` (junto a `"levels:art"`)

**Interfaces:**
- Consumes: la columna `path_nodes.src` (Task 4, en producción desde la Parte B).
- Produces: `node scripts/set-node-art.js [--apply [--pisar] | --rollback <respaldo>]`. Respaldo en `scripts/out/backup-node-art-<ts>.json` como array `{ id, key, old, new }`. Un nodo con un `src` distinto y no nulo (puesto a mano desde `/admin/path`) se respeta y se lista como `respeta`; solo `--pisar` lo sobrescribe.

- [ ] **Step 1: Escribir el script**

`scripts/set-node-art.js`:

```js
/**
 * Tiles de los nodos-módulo del Camino (spec webapp 2026-09-29-tiles-de-modulos
 * §"Asignación").
 *
 *   node scripts/set-node-art.js                    # dry-run
 *   node scripts/set-node-art.js --apply            # UPDATE de las filas publicadas
 *   node scripts/set-node-art.js --apply --pisar    # también reemplaza imágenes puestas a mano
 *   node scripts/set-node-art.js --rollback scripts/out/backup-node-art-<ts>.json
 *
 * Un nodo cuyo `src` ya tiene otro valor (alguien lo puso a mano desde
 * /admin/path) se respeta y se lista como `respeta`; solo --pisar lo sobrescribe.
 *
 * El mapa va por `tipo:ref_id` y no por id de nodo: identifica el contenido
 * aunque alguien recree el nodo desde /admin/path.
 *
 * Antes de escribir una fila pide su PNG a producción, y si no responde 200 la
 * salta. El 2026-09-10 se escribió en la BD un valor que solo entendía un
 * frontend sin desplegar y producción quedó con tres imágenes rotas: así el
 * orden "PNG publicado antes que la BD" lo garantiza el script, y el mismo
 * comando sirve para cada tanda — asigna lo publicado y deja el resto.
 *
 * Patrón obligatorio del CLAUDE.md del backend: dry-run por defecto, --apply
 * explícito, respaldo JSON tras cada fila y --rollback.
 */
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

const OUT_DIR = path.join(__dirname, 'out');
const BASE = '/images/levels';
const PROD = 'https://app.dotsonlinelearning.com';

// tipo:ref_id → slug. Copiado de las tablas de la spec: 10 reutilizados de la
// fase 2 y 48 nodos con pieza nueva (sonido cubre tres).
const ASIGNACION = {
  // Reutilizados (tiles de la fase 2, ya publicados)
  'grammar:1': 'presente', 'grammar:7': 'presente', 'grammar:2': 'articulos',
  'grammar:6': 'esto-eso', 'grammar:5': 'singular-plural',
  'grammar:8': 'preguntas', 'grammar:11': 'preguntas', 'grammar:9': 'modales',
  'grammar:4': 'pronombres', 'vocab:15': 'acciones',
  // Tanda 1: ancla, letras, números y vocabulario
  'vocab:17': 'formas', 'letters:1': 'abecedario', 'numbers:1': 'numeros-1-20',
  'numbers:2': 'decenas', 'vocab:10': 'dias', 'vocab:12': 'meses',
  'vocab:22': 'estaciones', 'vocab:27': 'partes-del-dia', 'vocab:23': 'clima',
  'vocab:16': 'hora', 'vocab:11': 'colores', 'vocab:13': 'familia',
  'vocab:24': 'profesiones', 'vocab:14': 'ropa', 'vocab:31': 'cuerpo',
  'vocab:25': 'cuidado-personal', 'vocab:19': 'alimentos', 'vocab:20': 'comidas',
  'vocab:28': 'frutas', 'vocab:18': 'cocina', 'vocab:21': 'deportes',
  'vocab:26': 'animales', 'vocab:30': 'casa', 'vocab:29': 'muebles',
  'vocab:32': 'escuela', 'vocab:6': 'ciudad',
  // Tanda 2: lecturas y frases con Doty
  'reading:1': 'luna', 'reading:2': 'peces', 'reading:3': 'volcan',
  'reading:4': 'pelo', 'reading:5': 'oceano', 'reading:6': 'telefono',
  'vocab:1': 'saludos', 'vocab:2': 'supervivencia', 'vocab:5': 'frases-clase',
  'vocab:3': 'cognados', 'vocab:4': 'falsos-amigos',
  // Tanda 3: pronunciación y gramática
  'pronunciation:1': 'ship-sheep', 'pronunciation:2': 'hat-hut',
  'pronunciation:3': 'bath-bat', 'pronunciation:6': 'heart-art',
  'pronunciation:7': 'van-ban', 'pronunciation:8': 'cash-catch',
  'pronunciation:4': 'sonido', 'pronunciation:5': 'sonido',
  'pronunciation:9': 'sonido', 'grammar:3': 'adjetivos', 'grammar:10': 'hay',
};

function loadEnv() {
  const file = path.join(__dirname, '..', '.env');
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    const i = line.indexOf('=');
    if (i > 0 && !line.trim().startsWith('#')) {
      const k = line.slice(0, i).trim();
      if (!(k in process.env)) process.env[k] = line.slice(i + 1).trim();
    }
  }
}

function arg(name) {
  const i = process.argv.indexOf(name);
  return i === -1 ? null : (process.argv[i + 1] ?? true);
}

async function publicado(url) {
  try {
    const res = await fetch(url, { method: 'HEAD', signal: AbortSignal.timeout(10000) });
    return res.status === 200;
  } catch {
    return false;
  }
}

async function rollback(db, file) {
  const entries = JSON.parse(fs.readFileSync(file, 'utf8'));
  for (const e of entries) {
    await db.query('UPDATE path_nodes SET src = $1 WHERE id = $2', [e.old, e.id]);
    console.log(`  nodo ${e.id} (${e.key}): ${e.new} → ${e.old ?? 'null'}`);
  }
  console.log(`Revertidas ${entries.length} filas`);
}

async function main() {
  loadEnv();
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const apply = process.argv.includes('--apply');
  const pisar = process.argv.includes('--pisar');
  const rollbackFile = arg('--rollback');

  const db = new Client({
    host: process.env.DB_HOST, port: Number(process.env.DB_PORT),
    user: process.env.DB_USERNAME, password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME, ssl: { rejectUnauthorized: false },
  });
  await db.connect();
  await db.query('SET search_path TO dots');
  try {
    const col = await db.query(
      `SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'dots' AND table_name = 'path_nodes' AND column_name = 'src'`);
    if (!col.rows.length) {
      console.error('path_nodes.src no existe: corre antes scripts/migrate-path-node-src.js --apply');
      process.exitCode = 1;
      return;
    }
    if (rollbackFile) return await rollback(db, rollbackFile);

    // Un tipo:ref_id sin exactamente un nodo activo es un error del mapa, no un
    // aviso: la fila no se actualizaría y nadie se enteraría.
    const nodos = (await db.query(
      'SELECT id, type, ref_id, section_id, position, src FROM path_nodes WHERE enabled',
    )).rows;
    const errores = [];
    const plan = [];
    for (const [key, slug] of Object.entries(ASIGNACION)) {
      const [type, ref] = key.split(':');
      const hits = nodos.filter((n) => n.type === type && n.ref_id === Number(ref));
      if (hits.length !== 1) {
        errores.push(`${key}: ${hits.length} nodos activos (se esperaba 1)`);
        continue;
      }
      plan.push({ key, slug, node: hits[0], nuevo: `${BASE}/${slug}.png` });
    }
    if (errores.length) {
      console.error('El mapa no coincide con el Camino; no se escribe nada:');
      for (const e of errores) console.error(`  - ${e}`);
      process.exitCode = 1;
      return;
    }

    const visto = new Map();
    const listos = [];
    const esperan = [];
    const iguales = [];
    const propias = [];
    for (const p of plan) {
      if (p.node.src === p.nuevo) { iguales.push(p); continue; }
      // Un src distinto y no nulo lo puso alguien a mano: no se pisa sin --pisar.
      if (p.node.src && !pisar) { propias.push(p); continue; }
      if (!visto.has(p.slug)) visto.set(p.slug, await publicado(PROD + p.nuevo));
      (visto.get(p.slug) ? listos : esperan).push(p);
    }
    const fila = (p) => `${String(p.node.id).padStart(4)}  ${p.key.padEnd(16)}`;
    for (const p of listos) console.log(`  asigna  ${fila(p)} ${p.node.src ?? 'null'} → ${p.nuevo}`);
    for (const p of esperan) console.log(`  espera  ${fila(p)} ${p.slug}.png no responde 200 en producción`);
    for (const p of propias) console.log(`  respeta ${fila(p)} ${p.node.src} (puesta a mano; --pisar para reemplazarla)`);
    console.log(`\n${listos.length} se asignan · ${esperan.length} esperan su PNG · ${iguales.length} ya estaban`
      + (propias.length ? ` · ${propias.length} con imagen puesta a mano` : ''));
    if (!apply) return console.log('\n(dry-run — nada escrito. Usa --apply.)');
    if (!listos.length) return console.log('\nNada que escribir.');

    const backup = [];
    const backupFile = path.join(
      OUT_DIR, `backup-node-art-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
    for (const p of listos) {
      await db.query('UPDATE path_nodes SET src = $1 WHERE id = $2', [p.nuevo, p.node.id]);
      backup.push({ id: p.node.id, key: p.key, old: p.node.src, new: p.nuevo });
      fs.writeFileSync(backupFile, JSON.stringify(backup, null, 2));
    }
    console.log(`\n${backup.length} filas escritas. Respaldo: ${backupFile}`);
  } finally {
    await db.end();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
```

- [ ] **Step 2: Alias en `package.json`**

Después de `"levels:art": "node scripts/set-level-art.js",`:

```json
    "nodes:art": "node scripts/set-node-art.js",
```

- [ ] **Step 3: Comprobar el recuento del mapa y la guarda de la columna**

```bash
node -e "const s=require('fs').readFileSync('scripts/set-node-art.js','utf8'); const m=s.match(/const ASIGNACION = \{([\s\S]*?)\n\};/)[1]; const keys=[...m.matchAll(/'([a-z]+:\d+)'/g)].map(x=>x[1]); console.log(keys.length, new Set(keys).size)"
node scripts/set-node-art.js; echo "exit=$?"
```

Expected: `58 58` (58 claves, ninguna repetida). El script, todavía sin la columna en producción, imprime `path_nodes.src no existe: corre antes scripts/migrate-path-node-src.js --apply` y `exit=1` — es la guarda funcionando. El dry-run completo se hace en la Task 11.

- [ ] **Step 4: Commit**

```bash
git add scripts/set-node-art.js package.json
git commit -m "$(cat <<'EOF'
feat(scripts): set-node-art asigna tiles a los nodos del Camino

Solo escribe las filas cuyo PNG ya responde 200 en producción, así que se
corre una vez por tanda y el orden PNG→BD no depende de nadie.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: Campo «Image» en `/admin/path` (webapp)

**Files:**
- Modify: `services/admin.service.ts:704-747` (`AdminPathNode`, `createPathNode`, `updatePathNode`)
- Modify: `app/(app)/admin/path/page.tsx` (imports y el modal del nodo, ~líneas 440-586)

**Interfaces:**
- Consumes: el contrato de la Task 3 (`src: string | null` en respuesta; `src?: string | null` en payload).

- [ ] **Step 1: Instalar dependencias del worktree**

```bash
cd /home/endurance/Projects/Endurance/dots/dots-webapp/.claude/worktrees/level-1-descriptive-images-af7087
source ~/.nvm/nvm.sh && nvm use && npm ci
```

- [ ] **Step 2: Tipos y payloads del servicio**

En `services/admin.service.ts`, `AdminPathNode` gana, después de `title: string;`:

```ts
  /** Tile del nodo en el Camino; null = hereda (practice) o icono del tipo. */
  src: string | null;
```

El payload de `createPathNode`, después de `title?: string;`:

```ts
  src?: string | null;
```

El `Partial<{...}>` de `updatePathNode`, después de `title: string;`:

```ts
    src: string | null;
```

- [ ] **Step 3: El campo en el modal**

En `app/(app)/admin/path/page.tsx`, añadir el import (después del de `UIButton`):

```ts
import WordImg from "@/components/ui/word-img/word-img";
```

En el modal, después de `const [title, setTitle] = useState(node?.title ?? "");`:

```ts
  const [src, setSrc] = useState(node?.src ?? "");
  // Solo se previsualiza una ruta que ya parece un archivo de imagen: mientras
  // se escribe, "/images/lev" pediría un 404 por tecla.
  const preview = /\.(png|webp|jpe?g)$/i.test(src.trim()) ? src.trim() : null;
```

En `payload`, después de `title: title.trim() || undefined,`:

```ts
      src: src.trim() || null,
```

Y después del `<Field>` del título, antes de `</AdminModal>`:

```tsx
      <Field label="Image (tile on the path — /images/levels/<slug>.png)">
        <div className="flex items-center gap-3">
          <input
            value={src}
            onChange={(e) => setSrc(e.target.value)}
            placeholder={type === "practice" ? "Auto (level image)" : "None (type icon)"}
            className={modalInputCls}
          />
          {preview && <WordImg src={preview} size="small" />}
        </div>
      </Field>
```

- [ ] **Step 4: Lint y build**

```bash
npm run lint
npx next build
```

Expected: los dos sin errores.

- [ ] **Step 5: Commit**

```bash
git add services/admin.service.ts "app/(app)/admin/path/page.tsx"
git commit -m "$(cat <<'EOF'
feat(admin): el modal del nodo edita su tile, con vista previa

Necesita el backend con path_nodes.src desplegado: el viejo descarta el
campo en silencio (whitelist) y la imagen no se guardaría.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 7: Tres opciones nuevas en el pipeline de Midjourney

**Files:**
- Modify: `scripts/mj/mjlib.py` — `build_prompt` (~línea 214), `_slots_line` (~línea 303)
- Test: `scripts/mj/tests/test_mjlib.py` (al final del archivo)

**Interfaces:**
- Produces, como campos opcionales de una pieza del catálogo:
  - `anchor_sref: "<ruta>"` (existente) — ahora también se muestra en la línea de slots del lote (antes solo en el encabezado).
  - `glyphs: true` — quita `text` del `--no`.
  - `icon_block: "<texto>"` — sustituye `style["icon_block"]` en esa pieza.

- [ ] **Step 1: Escribir los tests que fallan**

Añadir al final de `scripts/mj/tests/test_mjlib.py`:

```python
# ── fase 5: ancla heredada, glifos y paleta propia ────────────────────────────

def _cat_levels(ancla_extra=None, *extra):
    ancla = {"slug": "formas", "group": "levels", "prefix": "Level tile shapes",
             "prompt": "shapes", "size": 512, "mascot": False, "anchor": True, "done": False}
    ancla.update(ancla_extra or {})
    otra = {"slug": "dias", "group": "levels", "prefix": "Level tile week strip",
            "prompt": "a strip", "size": 512, "mascot": False, "done": False}
    return {"fase": "fase-t", "pieces": [ancla, otra, *extra]}


def test_slots_del_ancla_con_anchor_sref_pone_la_imagen_en_style_reference():
    cat = _cat_levels({"anchor_sref": "public/images/levels/estructuras.png"})
    out = mjlib.emit_lote(cat, STYLE, ["levels"])
    assert "Style reference:** `public/images/levels/estructuras.png`" in out
    assert "esta pieza ES el ancla del grupo" not in out


def test_ancla_con_anchor_sref_encabezado_y_slots_dicen_lo_mismo():
    cat = _cat_levels({"anchor_sref": "public/images/levels/estructuras.png"})
    out = mjlib.emit_lote(cat, STYLE, ["levels"])
    # No line should say "sin nada adjunto" for the anchor when it has anchor_sref
    linea_ancla = next(l for l in out.splitlines() if "`formas`" in l)
    assert "sin nada adjunto" not in linea_ancla


def test_slots_del_ancla_sin_anchor_sref_sigue_vacio():
    out = mjlib.emit_lote(_cat_levels(), STYLE, ["levels"])
    assert "esta pieza ES el ancla del grupo" in out


def test_build_prompt_quita_text_del_negativo_si_la_pieza_lleva_glifos():
    style = dict(STYLE, negative=["text", "glasses", "shadow"])
    out = mjlib.build_prompt(piece(group="levels", mascot=False, glyphs=True), style)
    assert out.endswith("--no glasses, shadow")


def test_build_prompt_mantiene_text_en_el_negativo_por_defecto():
    style = dict(STYLE, negative=["text", "glasses", "shadow"])
    out = mjlib.build_prompt(piece(group="levels", mascot=False), style)
    assert out.endswith("--no text, glasses, shadow")


def test_build_prompt_usa_el_icon_block_de_la_pieza():
    style = dict(STYLE, icon_block="fills only in pink")
    out = mjlib.build_prompt(
        piece(group="levels", mascot=False, icon_block="blobs in their true colors"), style)
    assert "blobs in their true colors" in out
    assert "fills only in pink" not in out


def test_build_prompt_sin_icon_block_propio_usa_el_del_estilo():
    style = dict(STYLE, icon_block="fills only in pink")
    out = mjlib.build_prompt(piece(group="levels", mascot=False), style)
    assert "fills only in pink" in out
```

- [ ] **Step 2: Correrlos y verlos fallar**

Run: `uv run --python 3.12 --with pytest --with pillow python -m pytest scripts/mj/tests/test_mjlib.py -q -k "anchor_sref or glifos or text_en or icon_block"`
Expected: FAIL en `test_slots_del_ancla_con_anchor_sref…`, `test_ancla_con_anchor_sref…`, `test_build_prompt_quita_text…` y `test_build_prompt_usa_el_icon_block…` (los otros cuatro ya pasan: fijan el comportamiento actual).

- [ ] **Step 3: `glyphs` e `icon_block` en `build_prompt`**

Sustituir:

```python
    negativos = style["negative"]
    if piece.get("glasses"):
        negativos = [n for n in negativos if n != "glasses"]
    body = ", ".join([piece["prefix"], piece["prompt"], style["icon_block"]])
```

por:

```python
    negativos = style["negative"]
    if piece.get("glasses"):
        negativos = [n for n in negativos if n != "glasses"]
    # Letras y cifras sueltas (abecedario, números): el texto ES el contenido.
    if piece.get("glyphs"):
        negativos = [n for n in negativos if n != "text"]
    # La paleta cerrada vive en icon_block; `colores` trae el suyo porque ahí el
    # color es el tema (spec 2026-09-29-tiles-de-modulos, decisión 3).
    bloque = piece.get("icon_block") or style["icon_block"]
    body = ", ".join([piece["prefix"], piece["prompt"], bloque])
```

- [ ] **Step 4: `anchor_sref` en la línea de slots del lote**

En `_slots_line`, sustituir:

```python
    if ancla is None or ancla["slug"] == piece["slug"]:
        return "> 📎 **Attach to prompt:** nada · 🎨 **Style reference:** VACÍO (esta pieza ES el ancla del grupo)"
```

por:

```python
    if ancla is None or ancla["slug"] == piece["slug"]:
        if piece.get("anchor_sref"):
            return (f"> 📎 **Attach to prompt:** nada · 🎨 **Style reference:** `{piece['anchor_sref']}` "
                    "(ancla que toma prestado el acabado de otra fase: esta pieza fija el look del grupo a partir de ella)")
        return "> 📎 **Attach to prompt:** nada · 🎨 **Style reference:** VACÍO (esta pieza ES el ancla del grupo)"
```

- [ ] **Step 5: Correr toda la suite del pipeline**

Run: `uv run --python 3.12 --with pytest --with pillow python -m pytest scripts/mj/tests -q`
Expected: todo en verde.

- [ ] **Step 6: Commit**

```bash
git add scripts/mj/mjlib.py scripts/mj/tests/test_mjlib.py
git commit -m "$(cat <<'EOF'
feat(mj): glifos permitidos, paleta por pieza, y anchor_sref en slots del lote

Lo que pide la fase 5 de tiles: el abecedario y los números llevan sus letras,
colores sale de la paleta cerrada, y el ancla gemas (que hereda el look de
estructuras vía anchor_sref) ahora lo muestra en la línea de slots además del
encabezado.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 8: El catálogo `fase-5.json` con la tanda 1

**Files:**
- Create: `scripts/mj/batches/fase-5.json`
- Test: `scripts/mj/tests/test_catalogo_fase5.py`

**Interfaces:**
- Consumes: `anchor_sref`, `glyphs`, `icon_block` (Task 7).
- Produces: `TANDAS` en el test (los slugs de cada tanda); las Tasks 13 y 14 añaden piezas a este mismo archivo.

- [ ] **Step 1: Escribir el test que falla**

`scripts/mj/tests/test_catalogo_fase5.py`:

```python
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import mjlib  # noqa: E402

BATCHES = Path(__file__).resolve().parents[1] / "batches"
BATCH = BATCHES / "fase-5.json"

# Las 46 piezas nuevas de la spec 2026-09-29-tiles-de-modulos, por tanda. El
# catálogo crece tanda a tanda: una tanda entra entera o no entra.
TANDAS = {
    1: {"formas", "abecedario", "numeros-1-20", "decenas", "dias", "meses",
        "estaciones", "partes-del-dia", "clima", "hora", "colores", "familia",
        "profesiones", "ropa", "cuerpo", "cuidado-personal", "alimentos",
        "comidas", "frutas", "cocina", "deportes", "animales", "casa",
        "muebles", "escuela", "ciudad"},
    2: {"luna", "peces", "volcan", "pelo", "oceano", "telefono", "saludos",
        "supervivencia", "frases-clase", "cognados", "falsos-amigos"},
    3: {"ship-sheep", "hat-hut", "bath-bat", "heart-art", "van-ban",
        "cash-catch", "sonido", "adjetivos", "hay"},
}
NUEVAS = set().union(*TANDAS.values())
MASCOTA = {"familia", "saludos", "supervivencia", "frases-clase", "falsos-amigos", "hay"}


def _cat():
    return mjlib.load_catalog(BATCH)


def _slugs():
    return {p["slug"] for p in _cat()["pieces"]}


def test_las_tandas_suman_46_sin_repetir():
    todas = [s for t in TANDAS.values() for s in t]
    assert (len(TANDAS[1]), len(TANDAS[2]), len(TANDAS[3])) == (26, 11, 9)
    assert len(todas) == len(set(todas)) == 46


def test_el_catalogo_solo_trae_piezas_de_la_spec():
    assert _slugs() <= NUEVAS, _slugs() - NUEVAS


def test_las_tandas_entran_enteras_y_en_orden():
    slugs = _slugs()
    parciales = [n for n, t in TANDAS.items() if t & slugs and not t <= slugs]
    assert not parciales, parciales
    presentes = [n for n, t in TANDAS.items() if t <= slugs]
    assert presentes == list(range(1, len(presentes) + 1))


def test_todas_son_del_grupo_levels_a_512():
    for p in _cat()["pieces"]:
        assert p["group"] == "levels", p["slug"]
        assert p["size"] == 512, p["slug"]


def test_ningun_slug_pisa_un_tile_de_la_fase_2():
    fase2 = {p["slug"] for p in mjlib.load_catalog(BATCHES / "fase-2.json")["pieces"]}
    assert not (NUEVAS & fase2), NUEVAS & fase2


def test_el_ancla_es_formas_y_hereda_de_estructuras():
    anclas = [p for p in _cat()["pieces"] if p.get("anchor")]
    assert [p["slug"] for p in anclas] == ["formas"]
    assert anclas[0]["anchor_sref"] == "public/images/levels/estructuras.png"
    assert (BATCHES.parents[2] / anclas[0]["anchor_sref"]).exists()


def test_doty_solo_donde_la_spec_lo_pone():
    assert {p["slug"] for p in _cat()["pieces"] if p.get("mascot")} == MASCOTA & _slugs()


def test_solo_abecedario_y_numeros_llevan_glifos():
    assert {p["slug"] for p in _cat()["pieces"] if p.get("glyphs")} == \
        {"abecedario", "numeros-1-20"} & _slugs()


def test_solo_colores_sale_de_la_paleta_cerrada():
    assert {p["slug"] for p in _cat()["pieces"] if p.get("icon_block")} == {"colores"} & _slugs()
```

- [ ] **Step 2: Correrlo y verlo fallar**

Run: `uv run --python 3.12 --with pytest --with pillow python -m pytest scripts/mj/tests/test_catalogo_fase5.py -q`
Expected: FAIL — `fase-5.json` no existe (`FileNotFoundError`).

- [ ] **Step 3: Crear el catálogo con la tanda 1**

Se escribe con el mismo formato que usa `mjlib` al guardar (`indent=2`, `ensure_ascii=False`, salto final), para que el diff del primer `--apply` solo muestre `done` y `source_file`:

```bash
uv run --python 3.12 python - <<'EOF'
import json
from pathlib import Path
piezas = json.loads(r'''[
  {"slug": "formas", "group": "levels", "prefix": "Level tile shapes", "prompt": "a circle, a triangle, a square and a star in a loose cluster, the circle pink, the triangle cyan, the square blue and the star pink", "size": 512, "mascot": false, "done": false, "anchor": true, "anchor_sref": "public/images/levels/estructuras.png"},
  {"slug": "abecedario", "group": "levels", "prefix": "Level tile ABC blocks", "prompt": "three chunky toy blocks in a small pyramid, their front faces showing the capital letters A, B and C in thick white letters, the blocks pink, cyan and blue", "size": 512, "mascot": false, "done": false, "glyphs": true},
  {"slug": "numeros-1-20", "group": "levels", "prefix": "Level tile number blocks", "prompt": "three chunky toy blocks in a row, their front faces showing the digits 1, 2 and 3 in thick white numerals, the blocks blue, pink and cyan", "size": 512, "mascot": false, "done": false, "glyphs": true},
  {"slug": "decenas", "group": "levels", "prefix": "Level tile ten rods", "prompt": "three upright base-ten rods standing side by side, each rod made of ten small stacked cubes, the rods pink, cyan and blue, no numbers", "size": 512, "mascot": false, "done": false},
  {"slug": "dias", "group": "levels", "prefix": "Level tile week strip", "prompt": "a horizontal strip of seven rounded square boxes in a row, all white except the fourth one filled pink", "size": 512, "mascot": false, "done": false},
  {"slug": "meses", "group": "levels", "prefix": "Level tile wall calendar", "prompt": "a wall calendar with two cyan binder rings on top and a grid of twelve small squares, three of them filled pink and two blue", "size": 512, "mascot": false, "done": false},
  {"slug": "estaciones", "group": "levels", "prefix": "Level tile seasons tree", "prompt": "a round tree crown split into four quarters: one covered in white snow, one with pink blossoms, one full of cyan leaves and one bare with a single blue leaf falling", "size": 512, "mascot": false, "done": false},
  {"slug": "partes-del-dia", "group": "levels", "prefix": "Level tile sun and moon arc", "prompt": "a dotted arc over a flat horizon line, a small pink sun rising at the left end, a big pink sun at the top of the arc and a blue crescent moon at the right end", "size": 512, "mascot": false, "done": false},
  {"slug": "clima", "group": "levels", "prefix": "Level tile storm cloud", "prompt": "a fluffy white cloud with cyan raindrops and a pink lightning bolt underneath, a small pink sun peeking out from behind its top", "size": 512, "mascot": false, "done": false},
  {"slug": "hora", "group": "levels", "prefix": "Level tile alarm clock", "prompt": "a round alarm clock with two bells on top, pink body, white face and blue hands pointing at ten past two", "size": 512, "mascot": false, "done": false},
  {"slug": "colores", "group": "levels", "prefix": "Level tile paint palette", "prompt": "a painter's palette with a thumb hole and six round paint blobs, a brush resting across it", "size": 512, "mascot": false, "done": false, "icon_block": "flat icon, thick rounded #1E1B5C navy outline, the paint blobs in their true colors (red, orange, yellow, green, blue and purple) and the palette itself white, centered, plain white background"},
  {"slug": "familia", "group": "levels", "prefix": "Doty and a little Doty", "prompt": "holding hands with a much smaller Doty child standing beside him, both smiling, walking together", "size": 512, "mascot": true, "done": false},
  {"slug": "profesiones", "group": "levels", "prefix": "Level tile work hats", "prompt": "three hats side by side: a tall white chef hat, a blue hard hat and a pink nurse cap with a white cross", "size": 512, "mascot": false, "done": false},
  {"slug": "ropa", "group": "levels", "prefix": "Level tile clothes set", "prompt": "a pink t-shirt, a cyan baseball cap and a pair of blue sneakers arranged together", "size": 512, "mascot": false, "done": false},
  {"slug": "cuerpo", "group": "levels", "prefix": "Level tile hand eye foot", "prompt": "an open waving hand, one big cartoon eye and a bare foot in a row, the hand and foot pink, the eye white with a blue iris", "size": 512, "mascot": false, "done": false},
  {"slug": "cuidado-personal", "group": "levels", "prefix": "Level tile toothbrush comb", "prompt": "a toothbrush with a blob of toothpaste, a comb and a small lotion bottle with a pump, in pink, cyan and blue", "size": 512, "mascot": false, "done": false},
  {"slug": "alimentos", "group": "levels", "prefix": "Level tile cheese and bread", "prompt": "a wedge of cheese with holes, a loaf of bread and a sausage grouped together, each in a flat pink, blue or cyan fill", "size": 512, "mascot": false, "done": false},
  {"slug": "comidas", "group": "levels", "prefix": "Level tile meal plates", "prompt": "three round plates in a row with a fork and a knife, above them a small rising sun, a high sun and a crescent moon, one over each plate", "size": 512, "mascot": false, "done": false},
  {"slug": "frutas", "group": "levels", "prefix": "Level tile fruit bowl", "prompt": "a round bowl holding an apple, a banana and a bunch of grapes, all in flat pink, cyan and blue fills", "size": 512, "mascot": false, "done": false},
  {"slug": "cocina", "group": "levels", "prefix": "Level tile pot and pan", "prompt": "a cooking pot with a lid, a frying pan and a spatula crossed in front of them", "size": 512, "mascot": false, "done": false},
  {"slug": "deportes", "group": "levels", "prefix": "Level tile sports balls", "prompt": "a basketball, a soccer ball and a tennis ball grouped together, each with its seam pattern drawn in navy lines", "size": 512, "mascot": false, "done": false},
  {"slug": "animales", "group": "levels", "prefix": "Level tile cat dog bird", "prompt": "a sitting cat and a sitting dog side by side with a small bird perched between them, simple friendly faces", "size": 512, "mascot": false, "done": false},
  {"slug": "casa", "group": "levels", "prefix": "Level tile house front", "prompt": "a small house seen from the front with a pink triangular roof, a blue door, two windows and a patch of front yard with a little fence", "size": 512, "mascot": false, "done": false},
  {"slug": "muebles", "group": "levels", "prefix": "Level tile sofa and lamp", "prompt": "a cozy two-seat sofa with cushions and a tall floor lamp standing beside it", "size": 512, "mascot": false, "done": false},
  {"slug": "escuela", "group": "levels", "prefix": "Level tile backpack and book", "prompt": "a school backpack with a pencil sticking out of it and a closed book leaning against it", "size": 512, "mascot": false, "done": false},
  {"slug": "ciudad", "group": "levels", "prefix": "Level tile city bus stop", "prompt": "three city buildings of different heights with windows, and a bus stop sign with a small bench in front of them", "size": 512, "mascot": false, "done": false}
]''')
Path("scripts/mj/batches/fase-5.json").write_text(
    json.dumps({"fase": "fase-5", "pieces": piezas}, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
print(len(piezas), "piezas")
EOF
```

Expected: `26 piezas`.

- [ ] **Step 4: Correr el test del catálogo y toda la suite**

```bash
uv run --python 3.12 --with pytest --with pillow python -m pytest scripts/mj/tests/test_catalogo_fase5.py -q
uv run --python 3.12 --with pytest --with pillow python -m pytest scripts/mj/tests -q
```

Expected: los dos en verde. `test_catalogs.py::test_prefijos_no_colisionan…` recorre `fase-*.json` y ya incluye el nuevo.

- [ ] **Step 5: Commit**

```bash
git add scripts/mj/batches/fase-5.json scripts/mj/tests/test_catalogo_fase5.py
git commit -m "$(cat <<'EOF'
feat(mj): catálogo de la fase 5 con la tanda 1 de tiles de módulos

El ancla formas, el abecedario, los números y 22 packs de vocabulario.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

## Parte B — Tanda 0 en producción (sin arte)

> Cada paso con 🔒 es un checkpoint: se detiene la ejecución, se le enseña a Sergio lo que va a pasar y se espera un sí explícito.

### Task 9: Migración y backend en producción

**Files:** ninguno nuevo.

- [ ] **Step 1: Dry-run de la migración** (worktree del backend)

Run: `node scripts/migrate-path-node-src.js`
Expected: `path_nodes.src: will be added`.

- [ ] **Step 2: 🔒 `--apply` de la migración**

Antes, comprobar que los respaldos caerán fuera del worktree: `ls -l scripts/out` tiene que mostrar el enlace simbólico al checkout compartido (`scripts/out -> /home/endurance/Projects/Endurance/dots/dots-backend/scripts/out`), no un directorio real.

Pedir consentimiento. Con el sí: `node scripts/migrate-path-node-src.js --apply`
Expected: `OK: ALTER TABLE dots.path_nodes ADD COLUMN IF NOT EXISTS src varchar(255)`, `Backup written: …`, `Migration verified OK.`
Si el clasificador lo bloquea, pasarle a Sergio (fish):

```bash
cd /home/endurance/Projects/Endurance/dots/dots-backend/.claude/worktrees/tiles-modulos; and nvm use; and node scripts/migrate-path-node-src.js --apply
```

- [ ] **Step 3: Comprobar que la guarda de `set-node-art` ya no salta**

Run: `node scripts/set-node-art.js`
Expected: ya no dice `path_nodes.src no existe`. Termina en `10 se asignan · 48 esperan su PNG · 0 ya estaban` y `(dry-run — nada escrito…)`. **Este es el criterio de aceptación 6**: los 48 slugs sin publicar se saltan.

- [ ] **Step 4: 🔒 Integrar el backend en `main` y verificar el deploy**

(a) Justo antes de integrar, volver a correr `node scripts/migrate-path-node-src.js` y exigir `path_nodes.src: exists`. Y `npx jest` en verde en el worktree.

(b) 🔒 Integrar como prefiera Sergio (PR o merge directo). Render despliega `main` solo, así que integrar ES desplegar.

(c) Con el deploy terminado, abrir el Camino en producción y comprobar: carga; la sección 1 se ve exactamente como antes (iconos de tipo); las secciones 2+ conservan sus tiles de la fase 2; y al abrir un nodo y recorrer su flujo hasta completarlo, nada responde 500.

(d) Revisar los logs de Render: ninguna línea con `column` y `src does not exist`.

---

### Task 10: El admin en producción

- [ ] **Step 1: Sincronizar la branch del webapp con `main`**

Con la herramienta del host `sync_with_base_branch` (no `git merge` a mano). Resolver conflictos si los hay, y después `npm run lint` y `npx next build`.

- [ ] **Step 2: 🔒 Integrar el webapp en `main`**

Pedir a Sergio cómo integrarlo (PR o merge directo). Vercel despliega `main`.

- [ ] **Step 3: Humo del admin**

Sergio abre `/admin/path` en producción, edita un nodo de la sección 1 y ve el campo «Image» vacío. No guardar nada todavía.

---

### Task 11: Los 10 tiles reutilizados, con rollback probado

- [ ] **Step 1: Dry-run**

Run (worktree del backend): `node scripts/set-node-art.js`
Expected: diez líneas `asigna` (`grammar:1 … /images/levels/presente.png`, …, `vocab:15 … /images/levels/acciones.png`) y el resumen `10 se asignan · 48 esperan su PNG · 0 ya estaban`.

- [ ] **Step 2: 🔒 `--apply`**

Con el sí: `node scripts/set-node-art.js --apply`
Expected: `10 filas escritas. Respaldo: scripts/out/backup-node-art-<ts>.json`. Anotar la ruta.

- [ ] **Step 3: Verificar en la BD (solo lectura)**

```bash
node -e "
const fs=require('fs');for(const l of fs.readFileSync('.env','utf8').split('\n')){const i=l.indexOf('=');if(i>0&&!l.startsWith('#'))process.env[l.slice(0,i).trim()]??=l.slice(i+1).trim()}
const {Client}=require('pg');(async()=>{const db=new Client({host:process.env.DB_HOST,port:+process.env.DB_PORT,user:process.env.DB_USERNAME,password:process.env.DB_PASSWORD,database:process.env.DB_NAME,ssl:{rejectUnauthorized:false}});await db.connect();await db.query('SET default_transaction_read_only = on');
const r=await db.query(\"SELECT section_id, count(*) FILTER (WHERE src IS NOT NULL) con_src, count(*) total FROM dots.path_nodes WHERE enabled AND type NOT IN ('practice','checkpoint') GROUP BY section_id ORDER BY section_id\");console.table(r.rows);await db.end()})()"
```

Expected: sección 1 `con_src = 9` de 56; sección 2 `1` de 1; sección 3 `0` de 1.

- [ ] **Step 4: 🔒 Probar el rollback y volver a aplicar**

Con el sí: `node scripts/set-node-art.js --rollback scripts/out/backup-node-art-<ts>.json` → `Revertidas 10 filas`; repetir el Step 3 → `con_src = 0` en todas; `node scripts/set-node-art.js --apply` → `10 filas escritas` (respaldo nuevo). Repetir el Step 3 → otra vez 9, 1 y 0.

- [ ] **Step 5: Ver el Camino**

Sergio abre el Camino en producción: los nodos «El verbo TO BE», «A, AN y THE», «This, that, these, those», etc. muestran su tile en lugar del icono de gramática. El admin, al editar uno de ellos, enseña la ruta y su vista previa.

---

## Parte C — Tandas de arte

### Task 12: Tanda 1 (26 piezas)

**Files:**
- Create: `scripts/mj/tile_sheet.py`
- Create: 26 × `public/images/levels/<slug>.png` (los escribe `process.py --apply`)
- Modify: `scripts/mj/batches/fase-5.json` (`done`, `source_file`: los escribe `--apply`)

- [ ] **Step 1: Crear la hoja de revisión**

`scripts/mj/tile_sheet.py`:

```python
# /// script
# requires-python = ">=3.11"
# dependencies = ["pillow>=10"]
# ///
"""Hoja de revisión de tiles del Camino a su tamaño real sobre los dos temas.

  uv run scripts/mj/tile_sheet.py FILA [FILA ...] --out /ruta/hoja.png

Cada FILA es una lista de slugs separados por ':' que se pintan juntos —
un grupo que tiene que distinguirse entre sí (spec 2026-09-29, §Legibilidad)
o una pieza nueva al lado del tile existente que más se le parece. La hoja
sale dos veces, sobre el fondo claro y el oscuro de la paleta rosa.
"""
import argparse
from pathlib import Path

from PIL import Image

REPO = Path(__file__).resolve().parents[2]
LEVELS = REPO / "public" / "images" / "levels"
ART = 128  # `ART` de components/path/path-node.tsx: el tamaño real del arte del nodo
PAD = 16
FONDOS = ["#fff7fb", "#14122e"]  # --background rosa claro y oscuro (lib/theme-colors.ts)


def tile(slug: str) -> Image.Image:
    return Image.open(LEVELS / f"{slug}.png").convert("RGBA").resize((ART, ART), Image.LANCZOS)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("filas", nargs="+")
    ap.add_argument("--out", type=Path, required=True)
    a = ap.parse_args()
    filas = [f.split(":") for f in a.filas]
    celda = ART + PAD
    ancho = max(len(f) for f in filas) * celda
    alto = len(filas) * celda
    hoja = Image.new("RGBA", (ancho * len(FONDOS), alto))
    for i, fondo in enumerate(FONDOS):
        x0 = i * ancho
        hoja.paste(Image.new("RGBA", (ancho, alto), fondo), (x0, 0))
        for fi, fila in enumerate(filas):
            for ci, slug in enumerate(fila):
                hoja.alpha_composite(tile(slug), (x0 + ci * celda + PAD // 2, fi * celda + PAD // 2))
    hoja.save(a.out)
    print(a.out)


if __name__ == "__main__":
    main()
```

Comprobarla con tiles que ya existen:

```bash
uv run scripts/mj/tile_sheet.py presente:pasado:futuro comparativo:singular-plural --out /tmp/claude-1000/hoja-prueba.png
```

Expected: imprime la ruta; la imagen muestra dos filas repetidas sobre fondo claro y oscuro.

- [ ] **Step 2: Emitir el lote**

```bash
uv run scripts/mj/process.py --emit-lote levels --fase fase-5 --raw /home/endurance/Projects/Endurance/dots/imagenes/mj --pendientes
```

Expected: `26 piezas (1 mascota, 25 icono) → /home/endurance/Projects/Endurance/dots/imagenes/mj/fase-5/LOTE-levels.md`. Comprobar que la línea de `formas` dice `Style reference:** \`public/images/levels/estructuras.png\``.

- [ ] **Step 3: 🔒 Sergio genera en Midjourney**

Pasarle el `LOTE-levels.md`. Genera `formas` primero; su mejor candidata va a *Style reference* del resto de piezas sin mascota; `familia` va con `ref-patron.png` adjunto y Style reference vacío. Descarga todo en `/home/endurance/Projects/Endurance/dots/imagenes/mj/fase-5/`.

- [ ] **Step 4: Emparejar y procesar**

```bash
uv run scripts/mj/process.py --dry-run fase-5 --raw /home/endurance/Projects/Endurance/dots/imagenes/mj
```

Expected: 26 líneas `OK`. Si hay `FALTA`, esa pieza no se descargó: volver al Step 3. Si hay `AMBIGUO` (varias candidatas para un slug), elegir con Sergio cuál y añadir un `--pick slug=archivo.png` por cada una al comando siguiente — por ejemplo `--pick dias=Mandrakin_Level_tile_week_strip_…_2.png`. Sin ambiguos, va sin `--pick`:

```bash
uv run scripts/mj/process.py --apply fase-5 --raw /home/endurance/Projects/Endurance/dots/imagenes/mj
```

Expected: el informe lista 26 en *hechas*; *halo* y *relleno* vacíos. Las piezas en esas dos listas se regeneran (en el catálogo, `regen: true`, nunca `done: false`).

- [ ] **Step 5: Revisar a 128 px**

```bash
uv run scripts/mj/tile_sheet.py \
  dias:meses:estaciones:partes-del-dia:clima:hora \
  alimentos:comidas:frutas:cocina \
  casa:muebles:escuela:ciudad \
  abecedario:numeros-1-20:decenas \
  colores:profesiones:ropa:cuerpo:cuidado-personal:animales \
  formas:deportes:estructuras \
  familia:comparativo:singular-plural \
  comidas:partes-del-dia \
  meses:frecuencia \
  --out /tmp/claude-1000/hoja-tanda-1.png
```

Abrir la hoja con Read y comprobar, sobre los dos fondos: (a) cada pieza se reconoce; (b) las de una misma fila se distinguen; (c) A B C y 1 2 3 son correctos — si tras una regeneración siguen deformes, se para aquí: el plan B de la spec (bloques en blanco y glifos compuestos con Baloo 2) es una tarea nueva que se diseña con Sergio, no un apaño dentro de esta; (d) sin rellenos fuera de la paleta de marca salvo `colores`; (e) `formas` y `deportes` comparten grosor con `estructuras`; (f) `familia` no se confunde con `comparativo` ni con `singular-plural`; (g) `comidas` no se confunde con `partes-del-dia` ni `meses` con `frecuencia`. Enseñarle la hoja a Sergio; lo que no pase se marca `regen: true` y se vuelve al Step 2.

- [ ] **Step 6: Lint, build y commit**

```bash
npm run lint
npx next build
git add scripts/mj/tile_sheet.py scripts/mj/batches/fase-5.json public/images/levels/
git commit -m "$(cat <<'EOF'
feat(camino): tanda 1 de tiles de módulos — letras, números y vocabulario

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 7: 🔒 Publicar**

Sincronizar con `main` (`sync_with_base_branch`) e integrar como prefiera Sergio. Esperar a que Vercel termine el deploy.

- [ ] **Step 8: 🔒 Asignar**

`node scripts/set-node-art.js` (worktree del backend) → `26 se asignan · 22 esperan su PNG · 10 ya estaban`. Con el sí, `--apply` → `26 filas escritas`. Verificación de la Task 11 Step 3 → sección 1 con `con_src = 35` de 56. Sergio ve el Camino: el abecedario, los números y el vocabulario con su tile.

---

### Task 13: Tanda 2 (11 piezas)

**Files:**
- Modify: `scripts/mj/batches/fase-5.json` (+11 piezas)
- Create: 11 × `public/images/levels/<slug>.png`

- [ ] **Step 1: Añadir las piezas al catálogo**

```bash
uv run --python 3.12 python - <<'EOF'
import json
from pathlib import Path
p = Path("scripts/mj/batches/fase-5.json")
cat = json.loads(p.read_text(encoding="utf-8"))
cat["pieces"] += json.loads(r'''[
  {"slug": "luna", "group": "levels", "prefix": "Level tile glowing moon", "prompt": "a big crescent moon on the right lit by rays coming from a small pink sun on the left", "size": 512, "mascot": false, "done": false},
  {"slug": "peces", "group": "levels", "prefix": "Level tile fish bubbles", "prompt": "a round cyan fish with visible gill lines on its side and a trail of bubbles rising from its mouth", "size": 512, "mascot": false, "done": false},
  {"slug": "volcan", "group": "levels", "prefix": "Level tile erupting volcano", "prompt": "a cone-shaped blue volcano erupting pink lava with a puff of white smoke", "size": 512, "mascot": false, "done": false},
  {"slug": "pelo", "group": "levels", "prefix": "Level tile straight curly hair", "prompt": "two locks of hair side by side, one straight and one tightly curly, with a cyan raindrop above them", "size": 512, "mascot": false, "done": false},
  {"slug": "oceano", "group": "levels", "prefix": "Level tile deep sea submarine", "prompt": "a small round submarine diving down past three wavy water layers, the layers cyan, blue and pink", "size": 512, "mascot": false, "done": false},
  {"slug": "telefono", "group": "levels", "prefix": "Level tile two phones", "prompt": "two old-fashioned telephone handsets facing each other with curved sound waves between them", "size": 512, "mascot": false, "done": false},
  {"slug": "saludos", "group": "levels", "prefix": "Doty waving hello", "prompt": "one hand raised high above his head waving hello, big friendly smile, the other arm relaxed at his side", "size": 512, "mascot": true, "done": false},
  {"slug": "supervivencia", "group": "levels", "prefix": "Doty holding a lifebuoy", "prompt": "hugging a pink and white striped lifebuoy ring around his waist, relieved smile", "size": 512, "mascot": true, "done": false},
  {"slug": "frases-clase", "group": "levels", "prefix": "Doty raising his hand", "prompt": "one arm stretched straight up like asking a question in class, eager expression", "size": 512, "mascot": true, "done": false},
  {"slug": "cognados", "group": "levels", "prefix": "Level tile gift of words", "prompt": "an open gift box with a pink ribbon and three empty speech bubbles popping out of it", "size": 512, "mascot": false, "done": false},
  {"slug": "falsos-amigos", "group": "levels", "prefix": "Doty eyeing a masked bubble", "prompt": "looking suspiciously sideways at a speech bubble that wears a cyan eye mask, one eyebrow raised", "size": 512, "mascot": true, "done": false}
]''')
p.write_text(json.dumps(cat, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
print(len(cat["pieces"]), "piezas")
EOF
uv run --python 3.12 --with pytest --with pillow python -m pytest scripts/mj/tests -q
```

Expected: `37 piezas`; la suite en verde (`test_las_tandas_entran_enteras_y_en_orden` exige las 11 a la vez).

- [ ] **Step 2: Commit del catálogo**

```bash
git add scripts/mj/batches/fase-5.json
git commit -m "$(cat <<'EOF'
feat(mj): tanda 2 de tiles de módulos en el catálogo — lecturas y frases

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 3: Emitir el lote**

```bash
uv run scripts/mj/process.py --emit-lote levels --fase fase-5 --raw /home/endurance/Projects/Endurance/dots/imagenes/mj --pendientes
```

Expected: `11 piezas (4 mascota, 7 icono) → …/fase-5/LOTE-levels.md`. Las siete sin mascota llevan en *Style reference* la descarga elegida de `formas` (`fase-5/<source_file de formas>`).

- [ ] **Step 4: 🔒 Sergio genera en Midjourney** y descarga en `…/imagenes/mj/fase-5/`. Las cuatro con Doty van con `ref-patron.png` adjunto y Style reference vacío.

- [ ] **Step 5: Emparejar y procesar**

```bash
uv run scripts/mj/process.py --dry-run fase-5 --raw /home/endurance/Projects/Endurance/dots/imagenes/mj
uv run scripts/mj/process.py --apply fase-5 --raw /home/endurance/Projects/Endurance/dots/imagenes/mj
```

Expected: 26 `HECHO` y 11 `OK` en el dry-run; 11 en *hechas* en el informe, *halo* y *relleno* vacíos. Resolver `AMBIGUO` con `--pick slug=archivo.png`.

- [ ] **Step 6: Revisar a 128 px**

```bash
uv run scripts/mj/tile_sheet.py \
  luna:peces:volcan:pelo:oceano:telefono \
  saludos:presentarse \
  supervivencia:frases-clase:cognados:falsos-amigos:preguntas \
  --out /tmp/claude-1000/hoja-tanda-2.png
```

Comprobar sobre los dos fondos que cada pieza se reconoce, que `saludos` no se confunde con `presentarse`, que `frases-clase` y `falsos-amigos` no se confunden con `preguntas`, y la paleta. Enseñarla a Sergio; lo que no pase, `regen: true` y volver al Step 3.

- [ ] **Step 7: Lint, build y commit**

```bash
npm run lint
npx next build
git add scripts/mj/batches/fase-5.json public/images/levels/
git commit -m "$(cat <<'EOF'
feat(camino): tanda 2 de tiles de módulos — lecturas y frases con Doty

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 8: 🔒 Publicar** — sincronizar con `main`, integrar, esperar a Vercel.

- [ ] **Step 9: 🔒 Asignar** — `node scripts/set-node-art.js` → `11 se asignan · 11 esperan su PNG · 36 ya estaban`; con el sí, `--apply` → `11 filas escritas`; verificación (Task 11 Step 3) → sección 1 `con_src = 46` de 56.

---

### Task 14: Tanda 3 (9 piezas) y cierre

**Files:**
- Modify: `scripts/mj/batches/fase-5.json` (+9 piezas)
- Create: 9 × `public/images/levels/<slug>.png`

- [ ] **Step 1: Añadir las piezas al catálogo**

```bash
uv run --python 3.12 python - <<'EOF'
import json
from pathlib import Path
p = Path("scripts/mj/batches/fase-5.json")
cat = json.loads(p.read_text(encoding="utf-8"))
cat["pieces"] += json.loads(r'''[
  {"slug": "ship-sheep", "group": "levels", "prefix": "Level tile ship and sheep", "prompt": "a small sailing ship on the left and a fluffy sheep on the right, separated by a thin vertical line", "size": 512, "mascot": false, "done": false},
  {"slug": "hat-hut", "group": "levels", "prefix": "Level tile hat and hut", "prompt": "a round hat on the left and a little round hut with a pointed roof on the right, separated by a thin vertical line", "size": 512, "mascot": false, "done": false},
  {"slug": "bath-bat", "group": "levels", "prefix": "Level tile bathtub and bat", "prompt": "a bathtub full of bubbles on the left and a small cute bat with open wings on the right, separated by a thin vertical line", "size": 512, "mascot": false, "done": false},
  {"slug": "heart-art", "group": "levels", "prefix": "Level tile heart and easel", "prompt": "a big pink heart on the left and a painter's easel holding a small blank canvas on the right, separated by a thin vertical line", "size": 512, "mascot": false, "done": false},
  {"slug": "van-ban", "group": "levels", "prefix": "Level tile van and ban sign", "prompt": "a delivery van on the left and a round prohibition sign, a circle crossed by a diagonal bar, on the right, separated by a thin vertical line", "size": 512, "mascot": false, "done": false},
  {"slug": "cash-catch", "group": "levels", "prefix": "Level tile cash and catch", "prompt": "a small stack of banknotes on the left and a baseball glove catching a ball on the right, separated by a thin vertical line", "size": 512, "mascot": false, "done": false},
  {"slug": "sonido", "group": "levels", "prefix": "Level tile mouth sound waves", "prompt": "a pair of open cartoon lips with three curved sound waves coming out to the right", "size": 512, "mascot": false, "done": false},
  {"slug": "adjetivos", "group": "levels", "prefix": "Level tile ball with a tag", "prompt": "a round cyan ball with a small blank pink label tag tied to it by a string", "size": 512, "mascot": false, "done": false},
  {"slug": "hay", "group": "levels", "prefix": "Doty at a shelf", "prompt": "pointing at a two-level shelf: one pink ball alone on the top shelf and several cyan balls on the bottom shelf", "size": 512, "mascot": true, "done": false}
]''')
p.write_text(json.dumps(cat, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
print(len(cat["pieces"]), "piezas")
EOF
uv run --python 3.12 --with pytest --with pillow python -m pytest scripts/mj/tests -q
```

Expected: `46 piezas`; la suite en verde.

- [ ] **Step 2: Commit del catálogo**

```bash
git add scripts/mj/batches/fase-5.json
git commit -m "$(cat <<'EOF'
feat(mj): tanda 3 de tiles de módulos en el catálogo — pronunciación y gramática

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 3: Emitir el lote**

```bash
uv run scripts/mj/process.py --emit-lote levels --fase fase-5 --raw /home/endurance/Projects/Endurance/dots/imagenes/mj --pendientes
```

Expected: `9 piezas (1 mascota, 8 icono) → …/fase-5/LOTE-levels.md`.

- [ ] **Step 4: 🔒 Sergio genera en Midjourney** y descarga en `…/imagenes/mj/fase-5/`.

- [ ] **Step 5: Emparejar y procesar**

```bash
uv run scripts/mj/process.py --dry-run fase-5 --raw /home/endurance/Projects/Endurance/dots/imagenes/mj
uv run scripts/mj/process.py --apply fase-5 --raw /home/endurance/Projects/Endurance/dots/imagenes/mj
```

Expected: 37 `HECHO` y 9 `OK`; 9 en *hechas*, *halo* y *relleno* vacíos.

- [ ] **Step 6: Revisar a 128 px**

```bash
uv run scripts/mj/tile_sheet.py \
  ship-sheep:hat-hut:bath-bat:heart-art:van-ban:cash-catch \
  sonido:adjetivos:formas \
  hay:cantidad:preposiciones \
  --out /tmp/claude-1000/hoja-tanda-3.png
```

Comprobar que cada par se lee como dos objetos, que ninguno repite el barco de `ship-sheep`, que `hay` no se confunde con `cantidad` ni con `preposiciones`, y la paleta. Enseñarla a Sergio; lo que no pase, `regen: true` y volver al Step 3.

- [ ] **Step 7: Lint, build y commit**

```bash
npm run lint
npx next build
git add scripts/mj/batches/fase-5.json public/images/levels/
git commit -m "$(cat <<'EOF'
feat(camino): tanda 3 de tiles de módulos — pronunciación y gramática

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 8: 🔒 Publicar** — sincronizar con `main`, integrar, esperar a Vercel.

- [ ] **Step 9: 🔒 Asignar** — `node scripts/set-node-art.js` → `11 se asignan · 0 esperan su PNG · 47 ya estaban` (9 piezas, pero `sonido` cubre tres nodos); con el sí, `--apply` → `11 filas escritas`.

- [ ] **Step 10: Criterio de aceptación 1**

Verificación de la Task 11 Step 3. Expected: sección 1 `con_src = 56` de 56, sección 2 `1` de 1, sección 3 `1` de 1. Un último `node scripts/set-node-art.js` → `0 se asignan · 0 esperan su PNG · 58 ya estaban`.

- [ ] **Step 11: Cierre**

Sergio recorre el Camino en producción, en claro y en oscuro: ningún nodo de las secciones 1 a 3, salvo los checkpoints, pinta el icono de su tipo. Actualizar la memoria `tiles-seccion-1-y-duplicados` con el estado final.
