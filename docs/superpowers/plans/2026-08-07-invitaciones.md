# Acceso solo por invitación — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que toda cuenta nueva nazca de una invitación creada por un admin, y que la academia pueda cortar accesos de verdad.

**Architecture:** Un módulo nuevo `invitations` en el backend, autocontenido, con dos controllers (uno bajo `AdminGuard`, otro público) sobre una tabla `dots.invitations`. La lógica pura vive en `invitations.util.ts` y se testea con jest; la capa NestJS se verifica con build, lint y prueba manual, que es el patrón real de este repo. En el frontend, una pantalla nueva `/invite/[token]` y una pestaña en el panel de usuarios.

**Tech Stack:** NestJS 11 + TypeORM 0.3 + PostgreSQL (schema `dots`) + `@nestjs-modules/mailer`; Next.js 16 (app router) + React 19 + Tailwind 4.

## Global Constraints

- **Node vía nvm:** ejecutar `source ~/.nvm/nvm.sh` antes de cualquier `node`/`npm`. El shell es fish.
- **BD de producción compartida.** `synchronize: false`. Todo cambio de schema pasa por un script en `dots-backend/scripts/`, idempotente. Ningún script modifica filas existentes.
- **Idioma.** Panel de admin en **inglés** (así está hoy: "Users", "Edit", "Could not load users."). Pantallas del alumno y correos en **español** con tono Doty. Comentarios de código: inglés en `dots-backend`, español en `dots-webapp`.
- **Navegación:** `router.push`, nunca `window.location.*` (rompe el token en memoria).
- **Lint del compiler de React:** prohibido `setState` síncrono en el cuerpo de un `useEffect`. Para reintentar, usar el patrón `fetchAttempt`: el botón bumpea un contador, el efecto solo fetchea.
- **Verificación obligatoria antes de cada commit:** `npx next build` + `npm run lint` en webapp; `npm run build` + `npm run lint` en backend.
- **Rama:** `feat/invitaciones` en ambos repos (ya creada).
- **Constantes fijas:** `ADMIN_PROFILE = 1`. TTL del link por defecto 48 h. Contacto público: `dotsglobalgroup@gmail.com`.
- **`git add` siempre con rutas explícitas.** Nunca `git add .`: `dots-backend/.env.bak-forgot-password` contiene credenciales de producción y no está ignorado hasta la Tarea 1.

---

## Tarea 1: Higiene de secretos y migración de schema

**Files:**
- Modify: `dots-backend/.gitignore`
- Create: `dots-backend/scripts/migrate-invitations.js`
- Modify: `dots-backend/package.json` (sección `scripts`)

**Interfaces:**
- Consumes: nada.
- Produce: la tabla `dots.invitations` y los índices únicos de `dots.users` que consumen todas las tareas siguientes.

- [ ] **Step 1: Tapar la fuga de credenciales**

`dots-backend/.env.bak-forgot-password` tiene la contraseña de la BD de producción, la app password de Gmail y los secretos JWT, y no está ignorado. Añadir al final de `dots-backend/.gitignore`:

```gitignore

# Backups de .env: mismo contenido sensible, misma exclusión
.env.bak*
.env.*.bak
```

- [ ] **Step 2: Verificar que el backup quedó ignorado**

```bash
cd /home/endurance/Projects/Endurance/dots/dots-backend
git check-ignore -v .env.bak-forgot-password
git status --short
```

Esperado: `check-ignore` imprime la regla `.gitignore:NN:.env.bak*`, y `git status --short` ya **no** lista `.env.bak-forgot-password` como `??`.

- [ ] **Step 3: Escribir el script de migración**

Crear `dots-backend/scripts/migrate-invitations.js`, copiando el patrón exacto de `scripts/migrate-engagement.js`:

```javascript
/**
 * Invite-only access: invitations table + uniqueness guarantees on users.
 * Idempotent: safe to run multiple times.
 *
 * Does NOT modify any existing row. The 12 users with a past `expires`
 * date are left untouched on purpose (see the design doc).
 *
 * Usage: npm run migrate:invitations
 */
/* eslint-disable @typescript-eslint/no-require-imports */
require('dotenv').config();
const { Client } = require('pg');

const STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS dots.invitations (
    id              serial PRIMARY KEY,
    email           text NOT NULL,
    name            varchar(100),
    last_name       varchar(100),
    token           varchar(64) NOT NULL UNIQUE,
    expires_at      timestamptz NOT NULL,
    access_expires  timestamp,
    status          varchar(16) NOT NULL DEFAULT 'pending',
    invited_by      integer NOT NULL REFERENCES dots.users(id),
    accepted_by     integer REFERENCES dots.users(id),
    created_at      timestamptz NOT NULL DEFAULT now(),
    last_sent_at    timestamptz NOT NULL DEFAULT now(),
    accepted_at     timestamptz,
    revoked_at      timestamptz
  )`,
  // Only one live invitation per address. 'expired' is derived, not stored,
  // so a stale pending row still occupies the slot and must be revoked
  // before a new invitation can be issued.
  `CREATE UNIQUE INDEX IF NOT EXISTS invitations_one_pending_per_email
     ON dots.invitations (lower(btrim(email))) WHERE status = 'pending'`,
  `CREATE INDEX IF NOT EXISTS invitations_status_idx
     ON dots.invitations (status)`,
];

// Uniqueness was only ever enforced in code. Verified 2026-08-07: zero
// duplicates. Guarded anyway because the DB is shared.
const UNIQUE_INDEXES = [
  {
    name: 'users_email_unique',
    column: 'email',
    sql: `CREATE UNIQUE INDEX IF NOT EXISTS users_email_unique
            ON dots.users (lower(btrim(email)))`,
  },
  {
    name: 'users_username_unique',
    column: 'username',
    sql: `CREATE UNIQUE INDEX IF NOT EXISTS users_username_unique
            ON dots.users (lower(btrim(username)))`,
  },
];

async function main() {
  const client = new Client({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    user: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    ssl: { rejectUnauthorized: false },
  });

  await client.connect();
  try {
    for (const sql of STATEMENTS) {
      await client.query(sql);
      console.log('OK:', sql.replace(/\s+/g, ' ').slice(0, 80));
    }

    for (const idx of UNIQUE_INDEXES) {
      const dupes = await client.query(
        `SELECT lower(btrim(${idx.column})) AS value, count(*) AS times
           FROM dots.users
          WHERE ${idx.column} IS NOT NULL AND btrim(${idx.column}) <> ''
          GROUP BY 1 HAVING count(*) > 1`,
      );
      if (dupes.rows.length > 0) {
        console.error(
          `\nABORT: duplicate ${idx.column} values block ${idx.name}:`,
          JSON.stringify(dupes.rows),
        );
        throw new Error(`Duplicate ${idx.column} values found`);
      }
      await client.query(idx.sql);
      console.log('OK:', idx.name);
    }

    const table = await client.query(
      `SELECT column_name FROM information_schema.columns
        WHERE table_schema = 'dots' AND table_name = 'invitations'
        ORDER BY ordinal_position`,
    );
    const indexes = await client.query(
      `SELECT indexname FROM pg_indexes
        WHERE schemaname = 'dots'
          AND indexname IN ('invitations_one_pending_per_email',
                            'users_email_unique', 'users_username_unique')
        ORDER BY 1`,
    );

    console.log('\ninvitations columns:', table.rows.map((r) => r.column_name).join(', '));
    console.log('indexes:', indexes.rows.map((r) => r.indexname).join(', '));

    if (table.rows.length !== 13 || indexes.rows.length !== 3) {
      throw new Error('Verification failed: expected objects are missing');
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

- [ ] **Step 4: Registrar el script en package.json**

En `dots-backend/package.json`, dentro de `"scripts"`, junto a los demás `migrate:*`:

```json
    "migrate:invitations": "node scripts/migrate-invitations.js",
```

- [ ] **Step 5: Correr la migración**

```bash
source ~/.nvm/nvm.sh
cd /home/endurance/Projects/Endurance/dots/dots-backend
npm run migrate:invitations
```

Esperado: una línea `OK:` por statement, luego `invitations columns:` con 13 nombres, `indexes:` con los 3 índices, y `Migration verified OK.`

- [ ] **Step 6: Verificar idempotencia**

```bash
npm run migrate:invitations
```

Esperado: exactamente la misma salida, sin errores. Si falla en la segunda corrida, el script no es idempotente y hay que arreglarlo antes de seguir.

- [ ] **Step 7: Commit**

```bash
cd /home/endurance/Projects/Endurance/dots/dots-backend
git add .gitignore scripts/migrate-invitations.js package.json
git commit -m "feat(invitaciones): tabla dots.invitations y unicidad en users

Crea la tabla de invitaciones con un indice parcial que garantiza una
sola invitacion viva por correo, y anade los indices unicos de email y
username que hasta ahora solo se validaban en codigo (verificado: 0
duplicados).

Tambien ignora los backups de .env: .env.bak-forgot-password tenia las
credenciales de produccion y no estaba excluido.

No modifica ninguna fila existente.

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Tarea 2: Lógica pura de invitaciones (TDD)

Esta es la única tarea con tests automatizados, y no por comodidad: el repo testea lógica pura (`streak.spec.ts`, `srs.spec.ts`, `wordle.logic.spec.ts`) y nunca controllers con BD. Concentrar aquí las decisiones testeables hace que el resto sea cableado verificable a ojo.

**Files:**
- Create: `dots-backend/src/modules/invitations/invitations.util.ts`
- Test: `dots-backend/src/modules/invitations/invitations.util.spec.ts`

**Interfaces:**
- Consumes: nada.
- Produce:
  - `type InvitationStatus = 'pending' | 'accepted' | 'revoked' | 'expired'`
  - `deriveInvitationStatus(row: { status: string; expiresAt: Date }, now: Date): InvitationStatus`
  - `normalizeEmail(raw: string): string`
  - `parseEmailList(raw: string): { valid: string[]; invalid: string[] }`
  - `isAccessExpired(expires: Date | null | undefined, now: Date): boolean`
  - `resolvePublicUrl(env: NodeJS.ProcessEnv): string`
  - `buildInviteLink(baseUrl: string, token: string): string`
  - `inviteTtlMs(env: NodeJS.ProcessEnv): number`

- [ ] **Step 1: Escribir el test que falla**

Crear `dots-backend/src/modules/invitations/invitations.util.spec.ts`:

```typescript
import {
  buildInviteLink,
  deriveInvitationStatus,
  inviteTtlMs,
  isAccessExpired,
  normalizeEmail,
  parseEmailList,
  resolvePublicUrl,
} from './invitations.util';

const NOW = new Date('2026-08-07T12:00:00Z');
const IN_ONE_HOUR = new Date('2026-08-07T13:00:00Z');
const ONE_HOUR_AGO = new Date('2026-08-07T11:00:00Z');

describe('deriveInvitationStatus', () => {
  it('keeps a live pending invitation pending', () => {
    expect(
      deriveInvitationStatus({ status: 'pending', expiresAt: IN_ONE_HOUR }, NOW),
    ).toBe('pending');
  });

  it('derives expired from the clock, never from a stored flag', () => {
    expect(
      deriveInvitationStatus({ status: 'pending', expiresAt: ONE_HOUR_AGO }, NOW),
    ).toBe('expired');
  });

  it('does not expire an invitation that was already accepted', () => {
    expect(
      deriveInvitationStatus({ status: 'accepted', expiresAt: ONE_HOUR_AGO }, NOW),
    ).toBe('accepted');
  });

  it('does not expire an invitation that was revoked', () => {
    expect(
      deriveInvitationStatus({ status: 'revoked', expiresAt: ONE_HOUR_AGO }, NOW),
    ).toBe('revoked');
  });

  it('treats the exact expiry instant as still valid', () => {
    expect(
      deriveInvitationStatus({ status: 'pending', expiresAt: NOW }, NOW),
    ).toBe('pending');
  });
});

describe('normalizeEmail', () => {
  it('lowercases and trims so the unique index cannot be dodged', () => {
    expect(normalizeEmail('  Sergio@Example.COM ')).toBe('sergio@example.com');
  });

  it('collapses inner whitespace pasted from a spreadsheet', () => {
    expect(normalizeEmail('sergio @example.com')).toBe('sergio@example.com');
  });
});

describe('parseEmailList', () => {
  it('splits on commas, semicolons and newlines', () => {
    const result = parseEmailList('a@x.com, b@x.com; c@x.com\nd@x.com');
    expect(result.valid).toEqual(['a@x.com', 'b@x.com', 'c@x.com', 'd@x.com']);
    expect(result.invalid).toEqual([]);
  });

  it('separates what it cannot use instead of silently dropping it', () => {
    const result = parseEmailList('good@x.com, not-an-email, also bad');
    expect(result.valid).toEqual(['good@x.com']);
    expect(result.invalid).toEqual(['not-an-email', 'also bad']);
  });

  it('dedupes case-insensitively, keeping the first occurrence', () => {
    const result = parseEmailList('A@x.com, a@x.com, b@x.com');
    expect(result.valid).toEqual(['a@x.com', 'b@x.com']);
  });

  it('ignores empty fragments from trailing separators', () => {
    expect(parseEmailList('a@x.com,\n\n , ;').valid).toEqual(['a@x.com']);
    expect(parseEmailList('a@x.com,\n\n , ;').invalid).toEqual([]);
  });

  it('returns empty lists for empty input', () => {
    expect(parseEmailList('')).toEqual({ valid: [], invalid: [] });
  });
});

describe('isAccessExpired', () => {
  it('is false when there is no expiry date (the common case)', () => {
    expect(isAccessExpired(null, NOW)).toBe(false);
    expect(isAccessExpired(undefined, NOW)).toBe(false);
  });

  it('is false while the date is still ahead', () => {
    expect(isAccessExpired(IN_ONE_HOUR, NOW)).toBe(false);
  });

  it('is true once the date has passed', () => {
    expect(isAccessExpired(ONE_HOUR_AGO, NOW)).toBe(true);
  });
});

describe('resolvePublicUrl', () => {
  it('prefers APP_PUBLIC_URL when set', () => {
    expect(
      resolvePublicUrl({
        APP_PUBLIC_URL: 'https://app.dots.cl',
        FRONTEND_ORIGIN: 'https://other.cl',
      }),
    ).toBe('https://app.dots.cl');
  });

  it('falls back to the first origin of the CORS list', () => {
    expect(
      resolvePublicUrl({
        FRONTEND_ORIGIN: 'https://app.dots.cl, https://staging.dots.cl',
      }),
    ).toBe('https://app.dots.cl');
  });

  it('strips a trailing slash so links never get a double slash', () => {
    expect(resolvePublicUrl({ APP_PUBLIC_URL: 'https://app.dots.cl/' })).toBe(
      'https://app.dots.cl',
    );
  });

  it('falls back to localhost in development', () => {
    expect(resolvePublicUrl({})).toBe('http://localhost:3000');
  });
});

describe('buildInviteLink', () => {
  it('points at the invite route', () => {
    expect(buildInviteLink('https://app.dots.cl', 'abc123')).toBe(
      'https://app.dots.cl/invite/abc123',
    );
  });
});

describe('inviteTtlMs', () => {
  it('defaults to 48 hours', () => {
    expect(inviteTtlMs({})).toBe(48 * 60 * 60 * 1000);
  });

  it('honours INVITE_TTL_HOURS', () => {
    expect(inviteTtlMs({ INVITE_TTL_HOURS: '2' })).toBe(2 * 60 * 60 * 1000);
  });

  it('ignores garbage and keeps the default rather than issuing a dead link', () => {
    expect(inviteTtlMs({ INVITE_TTL_HOURS: 'abc' })).toBe(48 * 60 * 60 * 1000);
    expect(inviteTtlMs({ INVITE_TTL_HOURS: '0' })).toBe(48 * 60 * 60 * 1000);
    expect(inviteTtlMs({ INVITE_TTL_HOURS: '-5' })).toBe(48 * 60 * 60 * 1000);
  });
});
```

- [ ] **Step 2: Correr el test y verificar que falla**

```bash
source ~/.nvm/nvm.sh
cd /home/endurance/Projects/Endurance/dots/dots-backend
npx jest src/modules/invitations/invitations.util.spec.ts
```

Esperado: FAIL — `Cannot find module './invitations.util'`.

- [ ] **Step 3: Escribir la implementación mínima**

Crear `dots-backend/src/modules/invitations/invitations.util.ts`:

```typescript
/**
 * Pure helpers for the invite-only flow. No NestJS, no DB, no clock reads:
 * every function that depends on time takes `now` as an argument so the
 * behaviour is testable and deterministic.
 */

export type InvitationStatus = 'pending' | 'accepted' | 'revoked' | 'expired';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DEFAULT_TTL_HOURS = 48;

/**
 * 'expired' is never stored. Deriving it from the clock means the table can
 * never lie about a link that quietly died, and no cron job is needed.
 */
export function deriveInvitationStatus(
  row: { status: string; expiresAt: Date },
  now: Date,
): InvitationStatus {
  if (row.status === 'accepted') return 'accepted';
  if (row.status === 'revoked') return 'revoked';
  return row.expiresAt.getTime() < now.getTime() ? 'expired' : 'pending';
}

/** Matches what the unique index does: lower(btrim(email)). */
export function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+/g, '');
}

/**
 * Parses a pasted list of addresses. Anything unusable is returned in
 * `invalid` rather than dropped, so the admin can be told what was skipped.
 */
export function parseEmailList(raw: string): {
  valid: string[];
  invalid: string[];
} {
  const valid: string[] = [];
  const invalid: string[] = [];
  const seen = new Set<string>();

  for (const chunk of raw.split(/[,;\n\r]+/)) {
    const trimmed = chunk.trim();
    if (!trimmed) continue;

    const email = normalizeEmail(trimmed);
    if (!EMAIL_REGEX.test(email)) {
      invalid.push(trimmed);
      continue;
    }
    if (seen.has(email)) continue;
    seen.add(email);
    valid.push(email);
  }

  return { valid, invalid };
}

export function isAccessExpired(
  expires: Date | null | undefined,
  now: Date,
): boolean {
  if (!expires) return false;
  return expires.getTime() < now.getTime();
}

/**
 * FRONTEND_ORIGIN is a comma-separated CORS whitelist; an email link needs
 * exactly one canonical URL, so we take the first and let APP_PUBLIC_URL
 * override it when the first origin is not the public one.
 */
export function resolvePublicUrl(env: NodeJS.ProcessEnv): string {
  const explicit = env.APP_PUBLIC_URL?.trim();
  if (explicit) return explicit.replace(/\/+$/, '');

  const first = env.FRONTEND_ORIGIN?.split(',')[0]?.trim();
  if (first) return first.replace(/\/+$/, '');

  return 'http://localhost:3000';
}

export function buildInviteLink(baseUrl: string, token: string): string {
  return `${baseUrl}/invite/${token}`;
}

/** A misconfigured TTL must not produce links that are born dead. */
export function inviteTtlMs(env: NodeJS.ProcessEnv): number {
  const parsed = Number(env.INVITE_TTL_HOURS);
  const hours =
    Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_TTL_HOURS;
  return hours * 60 * 60 * 1000;
}
```

- [ ] **Step 4: Correr el test y verificar que pasa**

```bash
npx jest src/modules/invitations/invitations.util.spec.ts
```

Esperado: PASS, 8 suites, 24 tests.

- [ ] **Step 5: Correr toda la suite para no haber roto nada**

```bash
npm test
```

Esperado: todas las suites en verde, incluidas las 14 preexistentes.

- [ ] **Step 6: Commit**

```bash
git add src/modules/invitations/invitations.util.ts src/modules/invitations/invitations.util.spec.ts
git commit -m "feat(invitaciones): logica pura del flujo de invitacion

Estado derivado del reloj (nunca almacenado), normalizacion de correos
igual a la del indice unico, parseo de listas pegadas que separa lo
inservible en vez de tragarselo, y resolucion de la URL publica a partir
de FRONTEND_ORIGIN.

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Tarea 3: Entidad, repositorio y DTOs

**Files:**
- Create: `dots-backend/src/common/entity/invitations.entity.ts`
- Create: `dots-backend/src/common/repository/invitations.repository.ts`
- Create: `dots-backend/src/modules/invitations/invitations.dto.ts`

**Interfaces:**
- Consumes: `dots.invitations` (Tarea 1).
- Produce: `Invitations` (entidad), `InvitationsRepository`, y los DTOs `CreateInvitationDto`, `BulkInvitationDto`, `AcceptInvitationDto`.

- [ ] **Step 1: Crear la entidad**

`dots-backend/src/common/entity/invitations.entity.ts`. Sigue el estilo de `users.entity.ts`. `invited_by` y `accepted_by` son columnas `int` planas, sin relación: el servicio resuelve los nombres con una consulta, lo que evita las sutilezas de TypeORM al insertar y mantiene la entidad legible.

```typescript
import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ schema: 'dots', name: 'invitations' })
export class Invitations {
  @PrimaryGeneratedColumn({ type: 'int' })
  id: number;

  @Column({ type: 'text' })
  email: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  name?: string | null;

  @Column({ name: 'last_name', type: 'varchar', length: 100, nullable: true })
  lastName?: string | null;

  @Column({ type: 'varchar', length: 64, unique: true })
  token: string;

  // Life of the LINK. Not to be confused with accessExpires below.
  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt: Date;

  // Copied into users.expires on accept: how long the student may use dots.
  @Column({ name: 'access_expires', type: 'timestamp', nullable: true })
  accessExpires?: Date | null;

  // Only 'pending' | 'accepted' | 'revoked' are stored. 'expired' is derived
  // from expiresAt — see deriveInvitationStatus in invitations.util.ts.
  @Column({ type: 'varchar', length: 16, default: 'pending' })
  status: string;

  @Column({ name: 'invited_by', type: 'int' })
  invitedBy: number;

  @Column({ name: 'accepted_by', type: 'int', nullable: true })
  acceptedBy?: number | null;

  @Column({ name: 'created_at', type: 'timestamptz', default: () => 'now()' })
  createdAt: Date;

  @Column({ name: 'last_sent_at', type: 'timestamptz', default: () => 'now()' })
  lastSentAt: Date;

  @Column({ name: 'accepted_at', type: 'timestamptz', nullable: true })
  acceptedAt?: Date | null;

  @Column({ name: 'revoked_at', type: 'timestamptz', nullable: true })
  revokedAt?: Date | null;
}
```

- [ ] **Step 2: Crear el repositorio**

`dots-backend/src/common/repository/invitations.repository.ts`, calcado de `users.repository.ts`:

```typescript
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Invitations } from '../entity/invitations.entity';

@Injectable()
export class InvitationsRepository extends Repository<Invitations> {
  constructor(
    @InjectRepository(Invitations)
    private readonly invitationsRepository: Repository<Invitations>,
  ) {
    super(
      invitationsRepository.target,
      invitationsRepository.manager,
      invitationsRepository.queryRunner,
    );
  }
}
```

- [ ] **Step 3: Crear los DTOs**

`dots-backend/src/modules/invitations/invitations.dto.ts`, con el estilo de `admin.dto.ts` (incluido el `@ValidateIf` para fechas nulables):

```typescript
import {
  IsDateString,
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';

export class CreateInvitationDto {
  @IsEmail()
  @MaxLength(255)
  email: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  lastName?: string;

  // ISO date or null (null = access never expires).
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsDateString()
  accessExpires?: string | null;
}

export class BulkInvitationDto {
  // Raw pasted text; parsed by parseEmailList so the admin gets told what
  // was skipped instead of the request failing as a whole.
  @IsString()
  @IsNotEmpty()
  @MaxLength(20000)
  emails: string;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsDateString()
  accessExpires?: string | null;
}

export class AcceptInvitationDto {
  @IsString()
  @IsNotEmpty()
  token: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  @MaxLength(100)
  username: string;

  @IsString()
  @MinLength(8)
  @MaxLength(100)
  password: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  lastName: string;

  @IsOptional()
  @IsDateString()
  birthday?: string;
}
```

- [ ] **Step 4: Verificar que compila**

```bash
source ~/.nvm/nvm.sh
cd /home/endurance/Projects/Endurance/dots/dots-backend
npm run build
```

Esperado: build sin errores. (Los archivos aún no se usan; esto solo valida tipos y decoradores.)

- [ ] **Step 5: Commit**

```bash
git add src/common/entity/invitations.entity.ts src/common/repository/invitations.repository.ts src/modules/invitations/invitations.dto.ts
git commit -m "feat(invitaciones): entidad, repositorio y DTOs

invited_by y accepted_by son columnas int planas: el servicio resuelve
los nombres con una consulta aparte, lo que evita las sutilezas de
TypeORM al insertar con relaciones eager.

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Tarea 4: Correo de invitación

Va antes del servicio para que el servicio pueda inyectarlo ya terminado.

**Files:**
- Modify: `dots-backend/src/modules/mail/mail.service.ts`

**Interfaces:**
- Consumes: `MailService.sendMail` (ya existe).
- Produce: `MailService.sendInvite(to: string, name: string, link: string, invitedBy: string): Promise<void>`

- [ ] **Step 1: Añadir sendInvite**

En `dots-backend/src/modules/mail/mail.service.ts`, después de `sendResetCode`, dentro de la clase:

```typescript
  /**
   * Sends an invitation link. Best-effort like sendResetCode: a failed send
   * must not roll back the invitation, because the admin can still copy the
   * link from the panel — which is the real fallback when Gmail files us
   * as spam.
   *
   * No remote images on purpose: many clients block them by default and the
   * email has to read just as well without them.
   */
  public async sendInvite(
    to: string,
    name: string,
    link: string,
    invitedBy: string,
  ): Promise<void> {
    const greeting = name ? `¡Hola, ${name}!` : '¡Hola!';
    const html = `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; color:#201a4d;">
        <h2 style="color:#e5077e; margin-bottom:4px;">Te invitaron a dots 🎉</h2>
        <p style="font-size:16px;">${greeting}</p>
        <p style="font-size:16px;">
          ${invitedBy} te abrió un lugar en <strong>dots</strong>, la app para
          aprender inglés sin que se sienta tarea. Soy Doty y te voy a
          acompañar.
        </p>
        <p style="text-align:center; margin:32px 0;">
          <a href="${link}"
             style="background:#e5077e; color:#ffffff; text-decoration:none;
                    font-weight:800; font-size:16px; padding:14px 28px;
                    border-radius:16px; display:inline-block;">
            Crear mi cuenta
          </a>
        </p>
        <p style="color:#6a6690; font-size:13px;">
          El enlace vence en 48 horas y solo funciona con este correo.
        </p>
        <p style="color:#6a6690; font-size:13px;">
          ¿El botón no hace nada? Copia y pega esta dirección:<br />
          <span style="word-break:break-all; color:#201a4d;">${link}</span>
        </p>
        <p style="color:#6a6690; font-size:13px;">
          Si no esperabas esta invitación, puedes ignorar este correo.
        </p>
      </div>`;

    try {
      await this.sendMail({
        to,
        subject: 'Te invitaron a dots 🎉',
        text: `${greeting} ${invitedBy} te invitó a dots. Crea tu cuenta aquí: ${link} (el enlace vence en 48 horas).`,
        html,
      });
      this.logger.log(`Invite emailed to ${to}`);
    } catch (err) {
      this.logger.warn(
        `Could not send invite email to ${to}: ${(err as Error).message}`,
      );
      if (process.env.NODE_ENV !== 'production') {
        this.logger.debug(`[DEV] Invite link for ${to}: ${link}`);
      }
    }
  }
```

- [ ] **Step 2: Verificar build y lint**

```bash
npm run build && npm run lint
```

Esperado: ambos sin errores.

- [ ] **Step 3: Commit**

```bash
git add src/modules/mail/mail.service.ts
git commit -m "feat(invitaciones): correo de invitacion con tono Doty

Sin imagenes remotas: muchos clientes las bloquean y el correo tiene que
leerse igual de bien sin ellas. El envio es best-effort como el de reset,
porque el plan B real es copiar el link desde el panel.

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Tarea 5: Servicio de invitaciones

**Files:**
- Create: `dots-backend/src/modules/invitations/invitations.service.ts`
- Modify: `dots-backend/src/modules/auth/auth.service.ts` (`issueSession` pasa de `private` a `public`)

**Interfaces:**
- Consumes: `Invitations`, `InvitationsRepository`, `UsersRepository`, `MailService.sendInvite`, todo `invitations.util.ts`, `AuthService.issueSession`.
- Produce: `InvitationsService` con `list()`, `create(dto, adminId)`, `bulk(dto, adminId)`, `resend(id)`, `revoke(id)`, `preview(token)`, `accept(dto, res)`.

- [ ] **Step 1: Hacer pública issueSession**

En `dots-backend/src/modules/auth/auth.service.ts`, cambiar la firma (el cuerpo no se toca):

```typescript
  /**
   * Sets the auth cookies and builds the profile payload for a logged-in user.
   * Shared by login and by accepting an invitation so both flows behave
   * identically.
   */
  public issueSession(user: Users, res: Response): AuthDtoResponse {
```

- [ ] **Step 2: Escribir el servicio**

Crear `dots-backend/src/modules/invitations/invitations.service.ts`:

```typescript
import { randomBytes } from 'crypto';
import {
  HttpException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { hash } from 'bcrypt';
import { EntityManager, In } from 'typeorm';
import type { Response } from 'express';
import { Invitations } from 'src/common/entity/invitations.entity';
import { Users } from 'src/common/entity/users.entity';
import { InvitationsRepository } from 'src/common/repository/invitations.repository';
import { UsersRepository } from 'src/common/repository/users.repository';
import { MailService } from '../mail/mail.service';
import { AuthService } from '../auth/auth.service';
import {
  AcceptInvitationDto,
  BulkInvitationDto,
  CreateInvitationDto,
} from './invitations.dto';
import {
  buildInviteLink,
  deriveInvitationStatus,
  inviteTtlMs,
  normalizeEmail,
  parseEmailList,
  resolvePublicUrl,
  type InvitationStatus,
} from './invitations.util';

const SALT_ROUNDS = 10;

/** Why an invitation link does not work. The frontend shows a different
 *  screen for each, so the reason has to survive the trip. */
export type InviteRejection = 'notfound' | 'expired' | 'revoked' | 'used';

export class InviteLinkException extends HttpException {
  constructor(reason: InviteRejection) {
    super({ reason, message: 'Invitation is not usable' }, 410);
  }
}

@Injectable()
export class InvitationsService {
  constructor(
    @InjectEntityManager() private readonly entityManager: EntityManager,
    private readonly invitationsRepo: InvitationsRepository,
    private readonly usersRepo: UsersRepository,
    private readonly mailService: MailService,
    private readonly authService: AuthService,
  ) {}

  // ── Admin ──────────────────────────────────────────────────────

  async list() {
    const rows = await this.invitationsRepo.find({ order: { id: 'DESC' } });
    const now = new Date();

    // Resolve inviter names in one query instead of N eager relations.
    const adminIds = [...new Set(rows.map((r) => r.invitedBy))];
    const admins = adminIds.length
      ? await this.usersRepo.find({ where: { id: In(adminIds) } })
      : [];
    const nameById = new Map(
      admins.map((a) => [a.id, `${a.name ?? ''} ${a.lastName ?? ''}`.trim() || a.username]),
    );

    return rows.map((r) => this.serialize(r, now, nameById.get(r.invitedBy) ?? '—'));
  }

  async create(dto: CreateInvitationDto, adminId: number) {
    const email = normalizeEmail(dto.email);
    await this.assertEmailIsFree(email);
    await this.clearStalePending(email);

    const invitation = await this.invitationsRepo.save(
      this.invitationsRepo.create({
        email,
        name: dto.name?.trim() || null,
        lastName: dto.lastName?.trim() || null,
        token: this.newToken(),
        expiresAt: new Date(Date.now() + inviteTtlMs(process.env)),
        accessExpires: dto.accessExpires ? new Date(dto.accessExpires) : null,
        status: 'pending',
        invitedBy: adminId,
      }),
    );

    await this.deliver(invitation, adminId);
    return this.serialize(invitation, new Date(), '');
  }

  /**
   * Never fails as a whole: every address is reported as created or skipped
   * with a reason, so a pasted class list does not turn into a silent
   * partial success.
   */
  async bulk(dto: BulkInvitationDto, adminId: number) {
    const { valid, invalid } = parseEmailList(dto.emails);
    const created: string[] = [];
    const skipped: { email: string; reason: string }[] = invalid.map((e) => ({
      email: e,
      reason: 'no parece un correo',
    }));

    for (const email of valid) {
      try {
        await this.create(
          { email, accessExpires: dto.accessExpires ?? null },
          adminId,
        );
        created.push(email);
      } catch (err) {
        const detail = (err as HttpException).getResponse?.();
        const reason =
          typeof detail === 'object' && detail !== null && 'message' in detail
            ? String((detail as { message: unknown }).message)
            : 'no se pudo invitar';
        skipped.push({ email, reason });
      }
    }

    return { created, skipped };
  }

  async resend(id: number) {
    const invitation = await this.invitationsRepo.findOne({ where: { id } });
    if (!invitation) throw new NotFoundException('Invitation not found');
    if (invitation.status !== 'pending') {
      throw new HttpException(
        'Only pending invitations can be resent',
        400,
      );
    }

    // A fresh token kills the previous link, which is the point: resending
    // must not leave two live doors open.
    invitation.token = this.newToken();
    invitation.expiresAt = new Date(Date.now() + inviteTtlMs(process.env));
    invitation.lastSentAt = new Date();
    const saved = await this.invitationsRepo.save(invitation);

    await this.deliver(saved, saved.invitedBy);
    return this.serialize(saved, new Date(), '');
  }

  async revoke(id: number) {
    const invitation = await this.invitationsRepo.findOne({ where: { id } });
    if (!invitation) throw new NotFoundException('Invitation not found');
    if (invitation.status === 'accepted') {
      throw new HttpException(
        'That invitation was already accepted; block the user instead',
        400,
      );
    }

    invitation.status = 'revoked';
    invitation.revokedAt = new Date();
    const saved = await this.invitationsRepo.save(invitation);
    return this.serialize(saved, new Date(), '');
  }

  // ── Public ─────────────────────────────────────────────────────

  async preview(token: string) {
    const invitation = await this.findUsable(token);
    return {
      email: invitation.email,
      name: invitation.name ?? '',
      lastName: invitation.lastName ?? '',
    };
  }

  /**
   * Creates the account and opens the session. The email always comes from
   * the invitation, never from the request body — that is what actually ties
   * the link to one person.
   */
  async accept(dto: AcceptInvitationDto, res: Response) {
    const user = await this.entityManager.transaction(async (manager) => {
      const invitation = await manager.findOne(Invitations, {
        where: { token: dto.token },
        lock: { mode: 'pessimistic_write' },
      });
      if (!invitation) throw new InviteLinkException('notfound');

      const status = deriveInvitationStatus(invitation, new Date());
      if (status !== 'pending') {
        throw new InviteLinkException(
          status === 'accepted' ? 'used' : (status as InviteRejection),
        );
      }

      const username = dto.username.trim();
      const clash = await manager.findOne(Users, { where: { username } });
      if (clash) throw new HttpException('That username is already taken', 409);

      const taken = await manager.findOne(Users, {
        where: { email: invitation.email },
      });
      if (taken) throw new HttpException('That email already has an account', 409);

      const hashed = await (
        hash as (data: string, rounds: number) => Promise<string>
      )(dto.password, SALT_ROUNDS);

      const created = await manager.save(
        manager.create(Users, {
          name: dto.name.trim(),
          lastName: dto.lastName.trim(),
          email: invitation.email,
          username,
          password: hashed,
          birth: dto.birthday ? new Date(dto.birthday) : undefined,
          profile: 0,
          streak: 0,
          blocked: false,
          expires: invitation.accessExpires ?? null,
        }),
      );

      invitation.status = 'accepted';
      invitation.acceptedAt = new Date();
      invitation.acceptedBy = created.id;
      await manager.save(invitation);

      return created;
    });

    return this.authService.issueSession(user, res);
  }

  // ── Internals ──────────────────────────────────────────────────

  private newToken(): string {
    // 32 bytes = 256 bits. Enumeration is not a threat model at this size,
    // which is why the token can be stored in the clear so the panel can
    // offer "copy link".
    return randomBytes(32).toString('base64url');
  }

  private async findUsable(token: string): Promise<Invitations> {
    const invitation = await this.invitationsRepo.findOne({ where: { token } });
    if (!invitation) throw new InviteLinkException('notfound');

    const status = deriveInvitationStatus(invitation, new Date());
    if (status === 'accepted') throw new InviteLinkException('used');
    if (status === 'revoked') throw new InviteLinkException('revoked');
    if (status === 'expired') throw new InviteLinkException('expired');

    return invitation;
  }

  private async assertEmailIsFree(email: string): Promise<void> {
    const existing = await this.usersRepo
      .createQueryBuilder('u')
      .where('lower(btrim(u.email)) = :email', { email })
      .getOne();

    if (existing) {
      throw new HttpException(
        existing.blocked
          ? 'That email already has an account (currently blocked — unblock it instead of inviting again)'
          : 'That email already has an account',
        409,
      );
    }
  }

  /**
   * The partial unique index only covers status='pending', and an expired
   * invitation is still 'pending' in the table. So a dead one has to be
   * revoked before a new invitation can take the slot; a live one is a
   * genuine conflict the admin should resolve by resending.
   */
  private async clearStalePending(email: string): Promise<void> {
    const pending = await this.invitationsRepo
      .createQueryBuilder('i')
      .where('lower(btrim(i.email)) = :email', { email })
      .andWhere('i.status = :status', { status: 'pending' })
      .getOne();

    if (!pending) return;

    if (deriveInvitationStatus(pending, new Date()) === 'pending') {
      throw new HttpException(
        'That email already has a live invitation — resend it instead',
        409,
      );
    }

    pending.status = 'revoked';
    pending.revokedAt = new Date();
    await this.invitationsRepo.save(pending);
  }

  private async deliver(invitation: Invitations, adminId: number): Promise<void> {
    const admin = await this.usersRepo.findOne({ where: { id: adminId } });
    const invitedBy = admin
      ? `${admin.name ?? ''} ${admin.lastName ?? ''}`.trim() || 'El equipo de dots'
      : 'El equipo de dots';

    await this.mailService.sendInvite(
      invitation.email,
      invitation.name ?? '',
      buildInviteLink(resolvePublicUrl(process.env), invitation.token),
      invitedBy,
    );
  }

  private serialize(row: Invitations, now: Date, invitedByName: string) {
    const status: InvitationStatus = deriveInvitationStatus(row, now);
    return {
      id: row.id,
      email: row.email,
      name: row.name ?? '',
      lastName: row.lastName ?? '',
      token: row.token,
      status,
      expiresAt: row.expiresAt,
      accessExpires: row.accessExpires ?? null,
      invitedByName,
      createdAt: row.createdAt,
      lastSentAt: row.lastSentAt,
      acceptedAt: row.acceptedAt ?? null,
    };
  }
}
```

- [ ] **Step 3: Verificar que compila**

```bash
source ~/.nvm/nvm.sh
cd /home/endurance/Projects/Endurance/dots/dots-backend
npm run build
```

Esperado: falla solo si hay error de tipos. El servicio aún no está registrado en ningún módulo, así que no arranca nada todavía.

- [ ] **Step 4: Commit**

```bash
git add src/modules/invitations/invitations.service.ts src/modules/auth/auth.service.ts
git commit -m "feat(invitaciones): servicio con la logica de negocio

El correo del usuario creado sale SIEMPRE de la invitacion, nunca del
body: eso es lo que ata el link a una persona. Aceptar corre en una
transaccion con lock pesimista para que dos aceptaciones simultaneas no
se pisen.

bulk() nunca falla entero: informa creadas y omitidas con motivo.

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Tarea 6: Controllers y módulo

**Files:**
- Create: `dots-backend/src/modules/invitations/admin-invitations.controller.ts`
- Create: `dots-backend/src/modules/invitations/invitations.controller.ts`
- Create: `dots-backend/src/modules/invitations/invitations.module.ts`
- Modify: `dots-backend/src/app.module.ts`
- Modify: `dots-backend/src/modules/auth/auth.module.ts` (exportar `AuthService`)

**Interfaces:**
- Consumes: `InvitationsService` (Tarea 5), `AdminGuard`, `CurrentUser`.
- Produce: los endpoints `GET/POST/DELETE /admin/invitations*` y `GET /auth/invitations/:token`, `POST /auth/invitations/accept`.

- [ ] **Step 1: Controller de admin**

Crear `dots-backend/src/modules/invitations/admin-invitations.controller.ts`:

```typescript
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AdminGuard } from '../admin/admin.guard';
import {
  CurrentUser,
  type AuthUser,
} from 'src/common/decorators/current-user.decorator';
import { InvitationsService } from './invitations.service';
import { BulkInvitationDto, CreateInvitationDto } from './invitations.dto';

@Controller('admin/invitations')
@UseGuards(AdminGuard)
export class AdminInvitationsController {
  constructor(private readonly invitations: InvitationsService) {}

  @Get()
  list() {
    return this.invitations.list();
  }

  @Post()
  create(@Body() dto: CreateInvitationDto, @CurrentUser() admin: AuthUser) {
    return this.invitations.create(dto, admin.id);
  }

  @Post('bulk')
  bulk(@Body() dto: BulkInvitationDto, @CurrentUser() admin: AuthUser) {
    return this.invitations.bulk(dto, admin.id);
  }

  @Post(':id/resend')
  resend(@Param('id', ParseIntPipe) id: number) {
    return this.invitations.resend(id);
  }

  @Delete(':id')
  revoke(@Param('id', ParseIntPipe) id: number) {
    return this.invitations.revoke(id);
  }
}
```

- [ ] **Step 2: Controller público**

Crear `dots-backend/src/modules/invitations/invitations.controller.ts`:

```typescript
import { Body, Controller, Get, Param, Post, Res } from '@nestjs/common';
import type { Response } from 'express';
import { InvitationsService } from './invitations.service';
import { AcceptInvitationDto } from './invitations.dto';

/**
 * Public, unauthenticated. This is the only route in the app that can
 * create a user, and it cannot do so without a valid token.
 */
@Controller('auth/invitations')
export class InvitationsController {
  constructor(private readonly invitations: InvitationsService) {}

  @Get(':token')
  preview(@Param('token') token: string) {
    return this.invitations.preview(token);
  }

  @Post('accept')
  accept(
    @Body() dto: AcceptInvitationDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.invitations.accept(dto, res);
  }
}
```

Nota de orden de rutas: `@Get(':token')` está en el controller de `auth/invitations` y `@Post('accept')` es POST, así que no compiten. No hay ambigüedad.

- [ ] **Step 3: Módulo**

Crear `dots-backend/src/modules/invitations/invitations.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Invitations } from 'src/common/entity/invitations.entity';
import { Users } from 'src/common/entity/users.entity';
import { InvitationsRepository } from 'src/common/repository/invitations.repository';
import { UsersRepository } from 'src/common/repository/users.repository';
import { AdminGuard } from '../admin/admin.guard';
import { AuthModule } from '../auth/auth.module';
import { MailModule } from '../mail/mail.module';
import { AdminInvitationsController } from './admin-invitations.controller';
import { InvitationsController } from './invitations.controller';
import { InvitationsService } from './invitations.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Invitations, Users]),
    MailModule,
    AuthModule,
  ],
  controllers: [AdminInvitationsController, InvitationsController],
  providers: [
    InvitationsService,
    InvitationsRepository,
    UsersRepository,
    AdminGuard,
  ],
})
export class InvitationsModule {}
```

- [ ] **Step 4: Exportar AuthService**

En `dots-backend/src/modules/auth/auth.module.ts`, añadir la línea `exports`:

```typescript
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, UsersRepository],
  exports: [AuthService],
})
export class AuthModule {}
```

- [ ] **Step 5: Registrar el módulo**

En `dots-backend/src/app.module.ts`, añadir el import arriba:

```typescript
import { InvitationsModule } from './modules/invitations/invitations.module';
```

y `InvitationsModule,` en el array `imports`, justo después de `AuthModule,`.

- [ ] **Step 6: Verificar que arranca**

```bash
source ~/.nvm/nvm.sh
cd /home/endurance/Projects/Endurance/dots/dots-backend
npm run build && npm run lint
```

Esperado: ambos limpios.

- [ ] **Step 7: Probar los endpoints contra el servidor**

Con el backend corriendo en `:4000` (el watcher suele estar activo; si no, `npm run start:dev`):

```bash
# Sin sesión de admin: 401
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:4000/admin/invitations

# Token inventado: 410 con reason notfound
curl -s http://localhost:4000/auth/invitations/no-existe
```

Esperado: `401` en el primero; en el segundo, un JSON que incluye `"reason":"notfound"`.

- [ ] **Step 8: Commit**

```bash
git add src/modules/invitations/ src/modules/auth/auth.module.ts src/app.module.ts
git commit -m "feat(invitaciones): endpoints de admin y publicos

Modulo autocontenido en vez de engordar admin.service.ts, que ya pasa de
1400 lineas. Dos controllers sobre el mismo servicio: uno bajo AdminGuard
y otro publico que es la unica ruta capaz de crear un usuario, y solo con
token valido.

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Tarea 7: Cerrar el registro abierto y hacer efectivo el bloqueo

Esta es la tarea que realmente cierra el agujero. Las anteriores construyeron la puerta nueva; esta tapia la vieja.

**Files:**
- Modify: `dots-backend/src/modules/auth/auth.controller.ts`
- Modify: `dots-backend/src/modules/auth/auth.service.ts`
- Modify: `dots-backend/src/modules/auth/auth.dto.ts`

**Interfaces:**
- Consumes: `isAccessExpired` de `invitations.util.ts`.
- Produce: `POST /auth/register` deja de existir; `/auth/login` y `/auth/refresh` rechazan con `reason` distinguible.

- [ ] **Step 1: Eliminar el endpoint de registro**

En `dots-backend/src/modules/auth/auth.controller.ts`, borrar el bloque completo:

```typescript
  @Post('register')
  async registerUser(
    @Body() dto: RegisterDtoRequest,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthDtoResponse> {
    return await this.authService.registerUser(dto, res);
  }
```

y quitar `RegisterDtoRequest` de la lista de imports de `./auth.dto`.

- [ ] **Step 2: Eliminar el servicio y el DTO de registro**

En `auth.service.ts`, borrar el método `registerUser` completo (desde `public async registerUser(` hasta su llave de cierre) y quitar `RegisterDtoRequest` del import de `./auth.dto`.

En `auth.dto.ts`, borrar la clase `RegisterDtoRequest` completa. Si tras el borrado quedan decoradores sin uso (`IsDateString`), quitarlos del import; el lint lo señalará.

- [ ] **Step 3: Validar el vencimiento en el login**

En `auth.service.ts`, añadir el import:

```typescript
import { isAccessExpired } from '../invitations/invitations.util';
```

y en `loginUser`, justo después del bloque de `blocked`, antes del `return this.issueSession(...)`:

```typescript
    // Access can be time-limited (users.expires). Distinct message from
    // "blocked" because they are different situations and the student needs
    // to know which one applies.
    if (
      isAccessExpired(userFind.expires, new Date()) &&
      process.env.ALLOW_BLOCKED_LOGIN !== '1'
    ) {
      throw new HttpException(
        { reason: 'expired', message: 'Tu acceso venció' },
        403,
      );
    }
```

Y cambiar el throw de bloqueado por uno con `reason`, para que el frontend distinga los dos casos:

```typescript
    if (userFind.blocked && process.env.ALLOW_BLOCKED_LOGIN !== '1') {
      throw new HttpException(
        { reason: 'blocked', message: 'Usuario bloqueado' },
        403,
      );
    }
```

- [ ] **Step 4: Corte inmediato en el refresh**

En `auth.service.ts`, reemplazar `refreshUser` entero. Pasa a `async` porque ahora consulta la BD:

```typescript
  /**
   * Rotates the session. Unlike a plain signature check, this re-reads the
   * user so that blocking someone (or their access expiring) takes effect
   * within one access-token lifetime instead of lingering for days.
   */
  public async refreshUser(req: Request, res: Response): Promise<any> {
    const token = (req.cookies?.refresh_token as string) ?? null;
    // Log presence of refresh cookie for debugging (do not log the token value)
    console.log('[auth.refreshUser] refresh_token present:', !!token);
    if (!token) throw new UnauthorizedException();

    const payload = this.verifyRefreshToken(token) as { id: number };
    if (!payload) throw new UnauthorizedException();

    const user = await this.userRepo.findOne({ where: { id: payload.id } });
    if (!user) throw new UnauthorizedException();

    if (process.env.ALLOW_BLOCKED_LOGIN !== '1') {
      const reason = user.blocked
        ? 'blocked'
        : isAccessExpired(user.expires, new Date())
          ? 'expired'
          : null;

      if (reason) {
        this.clearAuthCookies(res);
        throw new HttpException(
          {
            reason,
            message:
              reason === 'blocked' ? 'Usuario bloqueado' : 'Tu acceso venció',
          },
          403,
        );
      }
    }

    const newAccess = this.createAccessToken({ id: payload.id });
    const newRefresh = this.createRefreshToken({ id: payload.id });

    this.setAuthCookies(res, newAccess, newRefresh);

    // return new access token in body as well for client-side usage if needed
    return { token: newAccess };
  }

  /** Same options the cookies were set with, or browsers ignore the delete. */
  private clearAuthCookies(res: Response): void {
    const isProd = process.env.NODE_ENV === 'production';
    const opts = {
      httpOnly: true,
      path: '/',
      secure: isProd,
      sameSite: isProd ? ('none' as const) : ('lax' as const),
    };
    res.clearCookie('access_token', opts);
    res.clearCookie('refresh_token', opts);
  }
```

- [ ] **Step 5: Verificar build y lint**

```bash
npm run build && npm run lint
```

Esperado: limpios. Si el lint marca imports sin usar en `auth.dto.ts`, quitarlos.

- [ ] **Step 6: Confirmar que la puerta vieja está tapiada**

Con el backend corriendo:

```bash
curl -s -o /dev/null -w '%{http_code}\n' -X POST http://localhost:4000/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"name":"X","lastName":"Y","email":"x@y.com","username":"xy","password":"12345678"}'
```

Esperado: `404`. Cualquier otra cosa significa que el endpoint sigue vivo.

- [ ] **Step 7: Correr la suite completa**

```bash
npm test
```

Esperado: todo en verde.

- [ ] **Step 8: Commit**

```bash
git add src/modules/auth/
git commit -m "fix(auth): cerrar el registro abierto y hacer efectivo el bloqueo

POST /auth/register desaparece: era la unica ruta que creaba usuarios sin
invitacion y estaba abierta sin autenticacion.

Ademas el login empieza a respetar users.expires (hasta ahora la columna
existia y nadie la miraba) y el refresh recarga al usuario, de modo que
bloquear a alguien lo expulsa en menos de 15 minutos en lugar de dejarlo
renovando la sesion durante dias.

Los rechazos llevan un reason distinguible para que el frontend pueda
decir "tu acceso fue desactivado" en vez de "sesion expirada".

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Tarea 8: Servicios del frontend

**Files:**
- Modify: `dots-webapp/services/auth.service.ts`
- Modify: `dots-webapp/services/admin.service.ts`

**Interfaces:**
- Consumes: los endpoints de las Tareas 6 y 7.
- Produce:
  - `getInvitationService(token: string): Promise<InvitationPreview>`
  - `acceptInvitationService(payload: AcceptInvitePayload): Promise<LoginResponse>`
  - `getInvitations(): Promise<AdminInvitation[]>`
  - `createInvitation(payload): Promise<AdminInvitation>`
  - `bulkInvitations(emails, accessExpires): Promise<BulkInviteResult>`
  - `resendInvitation(id): Promise<AdminInvitation>`
  - `revokeInvitation(id): Promise<AdminInvitation>`
  - Tipos `InvitationPreview`, `AcceptInvitePayload`, `AdminInvitation`, `InvitationStatus`, `BulkInviteResult`

- [ ] **Step 1: Reemplazar registerService en auth.service.ts**

En `dots-webapp/services/auth.service.ts`, borrar el tipo `RegisterPayload` y la función `registerService` (el endpoint que llamaban ya no existe), y añadir en su lugar:

```typescript
export type InvitationPreview = {
  email: string;
  name: string;
  lastName: string;
};

export type AcceptInvitePayload = {
  token: string;
  username: string;
  password: string;
  name: string;
  lastName: string;
  birthday?: string;
};

async function getInvitationService(token: string): Promise<InvitationPreview> {
  const response = await api.get(`/auth/invitations/${token}`);
  return response.data;
}

async function acceptInvitationService(payload: AcceptInvitePayload) {
  const response = await api.post("/auth/invitations/accept", payload);
  return response.data;
}
```

Actualizar el bloque `export` del final:

```typescript
export {
  loginService,
  forgotPasswordService,
  resetPasswordService,
  getInvitationService,
  acceptInvitationService,
};
```

- [ ] **Step 2: Añadir las funciones de admin**

En `dots-webapp/services/admin.service.ts`, después del bloque de funciones de usuarios (`setUserBlocked`), añadir:

```typescript
export type InvitationStatus = "pending" | "accepted" | "revoked" | "expired";

export type AdminInvitation = {
  id: number;
  email: string;
  name: string;
  lastName: string;
  token: string;
  status: InvitationStatus;
  expiresAt: string;
  accessExpires: string | null;
  invitedByName: string;
  createdAt: string;
  lastSentAt: string;
  acceptedAt: string | null;
};

export type BulkInviteResult = {
  created: string[];
  skipped: { email: string; reason: string }[];
};

export async function getInvitations(): Promise<AdminInvitation[]> {
  const { data } = await api.get("/admin/invitations");
  return data;
}

export async function createInvitation(payload: {
  email: string;
  name?: string;
  lastName?: string;
  accessExpires?: string | null;
}): Promise<AdminInvitation> {
  const { data } = await api.post("/admin/invitations", payload);
  return data;
}

export async function bulkInvitations(
  emails: string,
  accessExpires: string | null,
): Promise<BulkInviteResult> {
  const { data } = await api.post("/admin/invitations/bulk", {
    emails,
    accessExpires,
  });
  return data;
}

export async function resendInvitation(id: number): Promise<AdminInvitation> {
  const { data } = await api.post(`/admin/invitations/${id}/resend`);
  return data;
}

export async function revokeInvitation(id: number): Promise<AdminInvitation> {
  const { data } = await api.delete(`/admin/invitations/${id}`);
  return data;
}
```

- [ ] **Step 3: Verificar que compila**

```bash
source ~/.nvm/nvm.sh
cd /home/endurance/Projects/Endurance/dots/dots-webapp
npx tsc --noEmit
```

Esperado: si `registerService` estaba importado en algún sitio, aquí sale el error. La única referencia conocida está en `app/page.tsx`, que se limpia en la Tarea 10; si el type-check falla solo por eso, continuar y volver a verificar tras la Tarea 10.

- [ ] **Step 4: Commit**

```bash
cd /home/endurance/Projects/Endurance/dots/dots-webapp
git add services/auth.service.ts services/admin.service.ts
git commit -m "feat(invitaciones): fetchers de invitacion

registerService desaparece junto con el endpoint que llamaba.

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Tarea 9: Pantalla de aceptar invitación

**Files:**
- Create: `dots-webapp/app/invite/[token]/page.tsx`

**Interfaces:**
- Consumes: `getInvitationService`, `acceptInvitationService`, `AuthShell`, `inputCls`, `btnPrimary`, `btnOutline`, `ErrorBanner`, `PendingLabel`, `Doty`, `useAuth`.
- Produce: la ruta `/invite/<token>`.

- [ ] **Step 1: Crear la pantalla**

Crear `dots-webapp/app/invite/[token]/page.tsx`. Vive fuera del grupo `(app)`, así que no lleva nav. Usa `useParams()` en lugar de la prop `params` para no lidiar con la promesa que Next 16 pasa a las páginas.

```typescript
"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  acceptInvitationService,
  getInvitationService,
  type InvitationPreview,
} from "@/services/auth.service";
import { useAuth } from "@/context/auth-context";
import Doty from "@/components/ui/doty/doty";
import {
  inputCls,
  btnPrimary,
  btnOutline,
  ErrorBanner,
  AuthShell,
  PendingLabel,
} from "@/components/auth/auth-ui";

/** Por qué el link no sirve. El backend lo manda en `reason`. */
type Rejection = "notfound" | "expired" | "revoked" | "used";

const REJECTION_COPY: Record<Rejection, { title: string; body: string; pose: string }> = {
  expired: {
    title: "Este enlace ya venció",
    body: "Las invitaciones duran 48 horas. Pídele a tu academia que te mande una nueva.",
    pose: "05",
  },
  revoked: {
    title: "Esta invitación fue cancelada",
    body: "Tu academia canceló este enlace. Si crees que es un error, escríbeles.",
    pose: "05",
  },
  used: {
    title: "Esta invitación ya se usó",
    body: "Tu cuenta ya existe. Entra con tu usuario y contraseña.",
    pose: "02",
  },
  notfound: {
    title: "No encontramos esta invitación",
    body: "Revisa que hayas copiado el enlace completo, sin cortar nada.",
    pose: "05",
  },
};

const GENERIC_ERROR = "Algo falló de nuestro lado. Intenta de nuevo.";

function readRejection(e: unknown): Rejection | null {
  const reason = (e as { response?: { data?: { reason?: string } } })?.response
    ?.data?.reason;
  return reason && reason in REJECTION_COPY ? (reason as Rejection) : null;
}

function readMessage(e: unknown): string {
  const raw = (e as { response?: { data?: { message?: string | string[] } } })
    ?.response?.data?.message;
  if (Array.isArray(raw)) return "Revisa los datos: algo no tiene el formato correcto.";
  if (raw === "That username is already taken")
    return "Ese usuario ya está tomado. Prueba con otro.";
  return raw || GENERIC_ERROR;
}

export default function AcceptInvite() {
  const router = useRouter();
  const params = useParams<{ token: string }>();
  const token = params.token;
  const { setAccessToken } = useAuth();

  const [invite, setInvite] = useState<InvitationPreview | null>(null);
  const [rejection, setRejection] = useState<Rejection | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [fetchAttempt, setFetchAttempt] = useState(0);

  const [name, setName] = useState("");
  const [lastName, setLastName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [birthday, setBirthday] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  // Patrón fetchAttempt (regla #3 de CLAUDE.md): el efecto solo fetchea; el
  // botón Reintentar bumpea el contador. Nada de setState síncrono aquí.
  useEffect(() => {
    let mounted = true;
    getInvitationService(token)
      .then((data) => {
        if (!mounted) return;
        setInvite(data);
        setName(data.name);
        setLastName(data.lastName);
      })
      .catch((e) => {
        if (!mounted) return;
        const reason = readRejection(e);
        if (reason) setRejection(reason);
        else setLoadError(true);
      });
    return () => {
      mounted = false;
    };
  }, [token, fetchAttempt]);

  const submit = async () => {
    if (!name.trim()) {
      setError("Escribe tu nombre.");
      return;
    }
    if (!lastName.trim()) {
      setError("Escribe tu apellido.");
      return;
    }
    if (username.trim().length < 3) {
      setError("Tu usuario necesita al menos 3 caracteres.");
      return;
    }
    if (password.length < 8) {
      setError("Tu contraseña debe tener 8 caracteres o más.");
      return;
    }
    if (password !== password2) {
      setError("Las contraseñas no coinciden.");
      return;
    }

    setError("");
    setSaving(true);
    try {
      const response = await acceptInvitationService({
        token,
        username: username.trim(),
        password,
        name: name.trim(),
        lastName: lastName.trim(),
        birthday: birthday || undefined,
      });
      setAccessToken(response.token);
      localStorage.setItem(
        "user",
        JSON.stringify({
          id: response.id,
          username: response.username,
          name: response.name,
          last_name: response.last_name,
          profile: response.profile,
          streak: response.streak,
          profile_pic: response.profile_picture ?? null,
        }),
      );
      router.push("/onboarding");
    } catch (e) {
      const reason = readRejection(e);
      if (reason) setRejection(reason);
      else setError(readMessage(e));
      setSaving(false);
    }
  };

  let content = null;

  if (rejection) {
    const copy = REJECTION_COPY[rejection];
    content = (
      <div
        className="flex w-full max-w-sm flex-col items-center gap-6 text-center"
        style={{ animation: "dots-pop-in 0.5s ease-out both" }}
      >
        <Doty pose={copy.pose} size="smaller" animation={rejection === "used" ? "cheer" : "sad"} />
        <h1 className="font-display text-3xl font-extrabold tracking-tight text-foreground">
          {copy.title}
        </h1>
        <p className="text-sm font-semibold text-(--muted)">{copy.body}</p>
        <button type="button" onClick={() => router.push("/")} className={btnPrimary}>
          Ir a iniciar sesión
        </button>
      </div>
    );
  } else if (loadError) {
    content = (
      <div className="flex w-full max-w-sm flex-col items-center gap-6 text-center">
        <Doty pose="05" size="smaller" animation="sad" />
        <h1 className="font-display text-3xl font-extrabold tracking-tight text-foreground">
          ¡Ups!
        </h1>
        <p className="text-sm font-semibold text-(--muted)">
          No pudimos revisar tu invitación. Puede ser la conexión.
        </p>
        <button
          type="button"
          onClick={() => {
            setLoadError(false);
            setFetchAttempt((n) => n + 1);
          }}
          className={btnPrimary}
        >
          Reintentar
        </button>
      </div>
    );
  } else if (!invite) {
    content = (
      <div className="flex flex-col items-center gap-4 text-center">
        <div style={{ animation: "dots-float 1.5s ease-in-out infinite" }}>
          <Doty pose="07" size="tiny" />
        </div>
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-(--border) border-t-(--accent)" />
        <p className="text-sm font-bold text-(--muted)">Revisando tu invitación…</p>
      </div>
    );
  } else {
    content = (
      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        className="flex w-full max-w-2xl flex-col gap-7"
      >
        <div
          className="flex flex-col items-center gap-2 text-center"
          style={{ animation: "dots-slide-up 0.5s ease-out both" }}
        >
          <Doty pose="17" size="smaller" animation="cheer" />
          <h1 className="font-display text-3xl font-extrabold tracking-tight text-foreground">
            ¡Te estábamos esperando!
          </h1>
          <p className="text-sm font-semibold text-(--muted)">
            Te invitaron a dots con el correo{" "}
            <span className="font-extrabold text-foreground">{invite.email}</span>.
            Crea tu cuenta y empezamos.
          </p>
        </div>

        {error && <ErrorBanner text={error} />}

        <div className="grid gap-4 md:grid-cols-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nombre"
            type="text"
            autoComplete="given-name"
            className={inputCls}
          />
          <input
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            placeholder="Apellido"
            type="text"
            autoComplete="family-name"
            className={inputCls}
          />
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Elige tu usuario"
            type="text"
            autoComplete="username"
            className={`${inputCls} md:col-span-2`}
          />
          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Contraseña"
            type="password"
            autoComplete="new-password"
            className={inputCls}
          />
          <input
            value={password2}
            onChange={(e) => setPassword2(e.target.value)}
            placeholder="Repite la contraseña"
            type="password"
            autoComplete="new-password"
            className={inputCls}
          />
          <input
            value={birthday}
            onChange={(e) => setBirthday(e.target.value)}
            type="date"
            className={`${inputCls} md:col-span-2 text-(--muted)`}
          />
        </div>

        <div className="flex flex-col gap-2.5">
          <button type="submit" disabled={saving} className={btnPrimary}>
            {saving ? <PendingLabel text="Creando tu cuenta…" /> : "Crear mi cuenta"}
          </button>
          <button type="button" onClick={() => router.push("/")} className={btnOutline}>
            Ya tengo cuenta
          </button>
        </div>
      </form>
    );
  }

  return <AuthShell>{content}</AuthShell>;
}
```

- [ ] **Step 2: Verificar lint y build**

```bash
source ~/.nvm/nvm.sh
cd /home/endurance/Projects/Endurance/dots/dots-webapp
npm run lint
```

Esperado: sin errores. Prestar atención a las reglas del compiler de React: no debe haber `setState` en el cuerpo del efecto.

- [ ] **Step 3: Commit**

```bash
git add "app/invite/[token]/page.tsx"
git commit -m "feat(invitaciones): pantalla para aceptar la invitacion

El correo se muestra fijo y no editable, porque es lo que ata el link a
una persona. Cada motivo de rechazo (vencida, revocada, ya usada, no
existe) tiene su propia pantalla: decirle 'invalido' a las cuatro seria
mentirle al usuario sobre que hacer.

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Tarea 10: Login sin registro

**Files:**
- Modify: `dots-webapp/app/page.tsx`

**Interfaces:**
- Consumes: `loginService` (sin cambios).
- Produce: un login con tres estados en vez de seis.

- [ ] **Step 1: Podar los estados muertos**

En `dots-webapp/app/page.tsx`:

1. Quitar el import `import api from "@/lib/api-client";` (deja de usarse).
2. Borrar los estados `password2`, `name`, `lastName`, `birthday`, `email`, `email2`, `code`, `newUsername`, `errorMessage`.
3. Borrar las funciones `signInHandler`, `newUserHandler` y `sendNewUser` completas.
4. Borrar las ramas `login === "new-user"`, `login === "username"` y `login === "error"` del render.
5. Borrar el estado `"wrongcode"` de cualquier referencia.

Quedan los estados `login`, `loading`, y los hooks `user`, `password`, `msg`, `incorrect`, `loginLoading`.

- [ ] **Step 2: Traducir los rechazos nuevos**

Añadir arriba del componente, tras los imports:

```typescript
/** El backend distingue bloqueo de vencimiento; el usuario merece saber cuál. */
const REASON_ES: Record<string, string> = {
  blocked: "Tu acceso fue desactivado. Escríbenos si crees que es un error.",
  expired: "Tu acceso venció. Contacta a tu academia para renovarlo.",
};
```

y dentro del `catch` de `loginHandler`, antes de armar `errMsg`:

```typescript
      const ex = e as {
        response?: { data?: { message?: string; error?: string; reason?: string } };
        message?: string;
      };
      const reason = ex?.response?.data?.reason;
      const errMsg =
        (reason && REASON_ES[reason]) ||
        ex?.response?.data?.message ||
        ex?.response?.data?.error ||
        ex?.message ||
        "No pudimos entrar. Intenta de nuevo.";
      setMsg(errMsg);
```

- [ ] **Step 3: Reemplazar el botón de crear cuenta**

En el bloque de enlaces secundarios, sustituir el `<button>` de "¿Nuevo en dots? Crea tu cuenta" por:

```typescript
          <div className="flex flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-(--border) px-4 py-4 text-center">
            <Doty pose="13" size="micro" />
            <p className="text-xs font-bold text-(--muted)">
              ¿No tienes cuenta? dots es solo por invitación. Si tu academia te
              inscribió, revisa tu correo — y si no llegó, escríbenos a{" "}
              <a
                href="mailto:dotsglobalgroup@gmail.com"
                className="font-extrabold text-(--accent) underline"
              >
                dotsglobalgroup@gmail.com
              </a>
            </p>
          </div>
```

- [ ] **Step 4: Verificar**

```bash
source ~/.nvm/nvm.sh
cd /home/endurance/Projects/Endurance/dots/dots-webapp
npm run lint && npx next build
```

Esperado: ambos limpios. El build es el que confirma que no quedó ninguna referencia a `registerService` ni a variables borradas.

- [ ] **Step 5: Commit**

```bash
git add app/page.tsx
git commit -m "feat(invitaciones): login sin registro publico

Borra el formulario de registro y la llamada a POST /newUser, un endpoint
que no existia en el backend: llevaba tiempo devolviendo 404 a quien
intentara crear cuenta desde la web.

En su lugar, un aviso con Doty que explica que dots es por invitacion. El
login tambien distingue ahora acceso desactivado de acceso vencido.

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Tarea 11: Pestaña de invitaciones en el panel

**Files:**
- Create: `dots-webapp/components/admin/invitations-tab.tsx`
- Create: `dots-webapp/components/admin/invite-modal.tsx`
- Modify: `dots-webapp/app/(app)/admin/users/page.tsx`

**Interfaces:**
- Consumes: los fetchers de la Tarea 8; `SearchInput`, `Toggle`, `ToastBanner`, `useToast`, `AdminModal`, `Field`, `ModalError`, `modalInputCls` de `components/admin/ui`; `UIButton`.
- Produce: `<InvitationsTab flash={...} />` y `<InviteModal onClose onSent />`.

Este módulo va **en inglés**, como el resto del panel.

- [ ] **Step 1: Crear el modal de invitar**

Crear `dots-webapp/components/admin/invite-modal.tsx`:

```typescript
"use client";

import React, { useState } from "react";
import UIButton from "@/components/ui/button/button";
import {
  bulkInvitations,
  createInvitation,
  type BulkInviteResult,
} from "@/services/admin.service";
import {
  AdminModal,
  Field,
  ModalError,
  modalInputCls,
} from "@/components/admin/ui";

interface Props {
  onClose: () => void;
  onSent: (message: string) => void;
}

type Mode = "single" | "bulk";

export default function InviteModal({ onClose, onSent }: Props) {
  const [mode, setMode] = useState<Mode>("single");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [lastName, setLastName] = useState("");
  const [emails, setEmails] = useState("");
  const [accessExpires, setAccessExpires] = useState("");
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState("");

  const describe = (result: BulkInviteResult): string => {
    const parts = [`${result.created.length} invited`];
    if (result.skipped.length > 0) {
      const detail = result.skipped
        .map((s) => `${s.email} (${s.reason})`)
        .join("; ");
      parts.push(`${result.skipped.length} skipped: ${detail}`);
    }
    return parts.join(" — ");
  };

  const send = async () => {
    setErr("");
    setSending(true);
    try {
      if (mode === "single") {
        if (!email.trim() || !email.includes("@")) {
          setErr("Please write a valid email.");
          setSending(false);
          return;
        }
        await createInvitation({
          email: email.trim(),
          name: name.trim() || undefined,
          lastName: lastName.trim() || undefined,
          accessExpires: accessExpires || null,
        });
        onSent(`Invitation sent to ${email.trim()}.`);
      } else {
        if (!emails.trim()) {
          setErr("Paste at least one email.");
          setSending(false);
          return;
        }
        const result = await bulkInvitations(emails, accessExpires || null);
        onSent(describe(result));
      }
    } catch (e: unknown) {
      const ex = e as { response?: { data?: { message?: string } } };
      setErr(ex?.response?.data?.message ?? "Could not send. Please try again.");
      setSending(false);
    }
  };

  const tabCls = (active: boolean) =>
    `rounded-xl px-4 py-2 text-sm font-extrabold transition-colors ${
      active
        ? "bg-(--accent) text-white"
        : "text-(--muted) hover:bg-(--accent)/10 hover:text-(--accent)"
    }`;

  return (
    <AdminModal
      title="Invite someone"
      onClose={onClose}
      footer={
        <>
          <UIButton tone="neutral" onClick={onClose}>
            Cancel
          </UIButton>
          <UIButton tone="accent" onClick={send} disabled={sending}>
            {sending ? "Sending…" : "Send invitation"}
          </UIButton>
        </>
      }
    >
      <ModalError text={err} />

      <div className="flex w-fit gap-1 rounded-2xl border-2 border-(--border) bg-(--surface) p-1">
        <button onClick={() => setMode("single")} className={tabCls(mode === "single")}>
          One person
        </button>
        <button onClick={() => setMode("bulk")} className={tabCls(mode === "bulk")}>
          Paste a list
        </button>
      </div>

      {mode === "single" ? (
        <>
          <Field label="Email">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="student@example.com"
              className={modalInputCls}
            />
          </Field>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Name (optional)">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={modalInputCls}
              />
            </Field>
            <Field label="Last name (optional)">
              <input
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className={modalInputCls}
              />
            </Field>
          </div>
        </>
      ) : (
        <Field label="Emails (comma, semicolon or one per line)">
          <textarea
            value={emails}
            onChange={(e) => setEmails(e.target.value)}
            rows={6}
            placeholder={"ana@example.com\nluis@example.com"}
            className={modalInputCls}
          />
        </Field>
      )}

      <Field label="Access expires (empty = never)">
        <input
          type="date"
          value={accessExpires}
          onChange={(e) => setAccessExpires(e.target.value)}
          className={modalInputCls}
        />
      </Field>
    </AdminModal>
  );
}
```

- [ ] **Step 2: Crear la pestaña**

Crear `dots-webapp/components/admin/invitations-tab.tsx`:

```typescript
"use client";

import React, { useEffect, useMemo, useState } from "react";
import Spinner from "@/components/ui/Spinner/Spinner";
import UIButton from "@/components/ui/button/button";
import InviteModal from "@/components/admin/invite-modal";
import { SearchInput } from "@/components/admin/ui";
import {
  getInvitations,
  resendInvitation,
  revokeInvitation,
  type AdminInvitation,
  type InvitationStatus,
} from "@/services/admin.service";

const fmtDate = (iso: string | null): string => {
  if (!iso) return "—";
  const d = new Date(iso);
  return isNaN(d.getTime())
    ? "—"
    : d.toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
};

const STATUS_STYLE: Record<InvitationStatus, string> = {
  pending: "bg-(--accent)/15 text-(--accent)",
  accepted: "bg-(--gem)/15 text-(--gem)",
  expired: "bg-(--flame)/15 text-(--flame)",
  revoked: "bg-(--danger)/15 text-(--danger)",
};

interface Props {
  // Firma exacta de useToast en components/admin/ui.tsx:23 — "ok", no "success".
  flash: (text: string, kind?: "ok" | "error") => void;
}

export default function InvitationsTab({ flash }: Props) {
  const [rows, setRows] = useState<AdminInvitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [fetchAttempt, setFetchAttempt] = useState(0);
  const [search, setSearch] = useState("");
  const [inviting, setInviting] = useState(false);

  // Patrón fetchAttempt: el efecto solo fetchea; Retry bumpea el contador.
  useEffect(() => {
    let mounted = true;
    getInvitations()
      .then((data) => {
        if (mounted) setRows(data);
      })
      .catch(() => {
        if (mounted) setLoadError(true);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [fetchAttempt]);

  const reload = () => {
    setLoading(true);
    setLoadError(false);
    setFetchAttempt((n) => n + 1);
  };

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) =>
      [r.email, r.name, r.lastName, r.status].join(" ").toLowerCase().includes(q),
    );
  }, [rows, search]);

  const failed = (e: unknown) => {
    const ex = e as { response?: { data?: { message?: string } } };
    flash(ex?.response?.data?.message ?? "Something went wrong.", "error");
  };

  const resend = async (row: AdminInvitation) => {
    if (!confirm(`Resend to ${row.email}? The previous link stops working.`)) return;
    try {
      const updated = await resendInvitation(row.id);
      setRows((prev) => prev.map((r) => (r.id === row.id ? updated : r)));
      flash(`Invitation resent to ${row.email}.`);
    } catch (e) {
      failed(e);
    }
  };

  const revoke = async (row: AdminInvitation) => {
    if (!confirm(`Revoke the invitation for ${row.email}?`)) return;
    try {
      const updated = await revokeInvitation(row.id);
      setRows((prev) => prev.map((r) => (r.id === row.id ? updated : r)));
      flash(`Invitation revoked.`);
    } catch (e) {
      failed(e);
    }
  };

  // El link se arma con el origen actual, no con el del backend: así en
  // desarrollo no se copia un enlace que apunta a producción.
  const copyLink = async (row: AdminInvitation) => {
    const link = `${window.location.origin}/invite/${row.token}`;
    try {
      await navigator.clipboard.writeText(link);
      flash("Link copied to clipboard.");
    } catch {
      flash(link, "error");
    }
  };

  if (loadError) {
    return (
      <div className="flex flex-col items-center gap-4 rounded-2xl border-2 border-dashed border-(--border) px-5 py-10 text-center">
        <p className="text-sm font-bold text-(--muted)">
          Could not load invitations.
        </p>
        <UIButton tone="accent" onClick={reload}>
          Retry
        </UIButton>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="text-sm font-bold text-(--muted)">
          {rows.filter((r) => r.status === "pending").length} pending ·{" "}
          {rows.length} total
        </span>
        <UIButton tone="accent" onClick={() => setInviting(true)}>
          Invite someone
        </UIButton>
      </div>

      <SearchInput
        value={search}
        onChange={setSearch}
        placeholder="Search by email or status…"
      />

      {loading ? (
        <div className="py-16">
          <Spinner title="Loading invitations…" />
        </div>
      ) : visible.length === 0 ? (
        <p className="rounded-2xl border-2 border-dashed border-(--border) px-5 py-8 text-center text-sm font-semibold text-(--muted)">
          {rows.length === 0
            ? "No invitations yet. Invite someone to get started."
            : "No invitations match your search."}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border-2 border-(--border)">
          <table className="w-full text-left text-sm">
            <thead className="bg-(--surface) text-(--muted)">
              <tr className="text-xs font-extrabold uppercase tracking-wide">
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3 text-center">Status</th>
                <th className="px-4 py-3">Invited by</th>
                <th className="px-4 py-3">Sent</th>
                <th className="px-4 py-3">Link expires</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((r) => (
                <tr key={r.id} className="border-t border-(--border) align-middle">
                  <td className="px-4 py-3 font-bold text-foreground">{r.email}</td>
                  <td className="px-4 py-3 font-semibold text-(--muted)">
                    {`${r.name} ${r.lastName}`.trim() || "—"}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-[10px] font-extrabold uppercase ${STATUS_STYLE[r.status]}`}
                    >
                      {r.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs font-semibold text-(--muted)">
                    {r.invitedByName || "—"}
                  </td>
                  <td className="px-4 py-3 text-xs font-semibold text-(--muted)">
                    {fmtDate(r.lastSentAt)}
                  </td>
                  <td className="px-4 py-3 text-xs font-semibold text-(--muted)">
                    {r.status === "pending" ? fmtDate(r.expiresAt) : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1.5">
                      {r.status === "pending" && (
                        <>
                          <button
                            onClick={() => copyLink(r)}
                            className="rounded-lg border-2 border-(--border) px-2.5 py-1 text-xs font-bold text-(--muted) transition-colors hover:border-(--accent) hover:text-(--accent)"
                          >
                            Copy link
                          </button>
                          <button
                            onClick={() => resend(r)}
                            className="rounded-lg border-2 border-(--border) px-2.5 py-1 text-xs font-bold text-(--muted) transition-colors hover:border-(--accent) hover:text-(--accent)"
                          >
                            Resend
                          </button>
                          <button
                            onClick={() => revoke(r)}
                            className="rounded-lg border-2 border-(--border) px-2.5 py-1 text-xs font-bold text-(--muted) transition-colors hover:border-(--danger) hover:text-(--danger)"
                          >
                            Revoke
                          </button>
                        </>
                      )}
                      {r.status === "expired" && (
                        <button
                          onClick={() => resend(r)}
                          className="rounded-lg border-2 border-(--border) px-2.5 py-1 text-xs font-bold text-(--muted) transition-colors hover:border-(--accent) hover:text-(--accent)"
                        >
                          Resend
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {inviting && (
        <InviteModal
          onClose={() => setInviting(false)}
          onSent={(message) => {
            setInviting(false);
            flash(message);
            reload();
          }}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 3: Añadir las pestañas a la página de usuarios**

En `dots-webapp/app/(app)/admin/users/page.tsx`:

1. Añadir el import: `import InvitationsTab from "@/components/admin/invitations-tab";`
2. Añadir el estado: `const [tab, setTab] = useState<"users" | "invitations">("users");`
3. Justo debajo del `<h1>`/contador y encima del `<SearchInput>`, insertar la barra de pestañas (mismo patrón que `admin/foundations/page.tsx`):

```typescript
      <div className="flex w-fit gap-1 rounded-2xl border-2 border-(--border) bg-(--surface) p-1">
        <button
          onClick={() => setTab("users")}
          className={`rounded-xl px-4 py-2 text-sm font-extrabold transition-colors ${
            tab === "users"
              ? "bg-(--accent) text-white"
              : "text-(--muted) hover:bg-(--accent)/10 hover:text-(--accent)"
          }`}
        >
          Users
        </button>
        <button
          onClick={() => setTab("invitations")}
          className={`rounded-xl px-4 py-2 text-sm font-extrabold transition-colors ${
            tab === "invitations"
              ? "bg-(--accent) text-white"
              : "text-(--muted) hover:bg-(--accent)/10 hover:text-(--accent)"
          }`}
        >
          Invitations
        </button>
      </div>
```

4. Envolver el contenido existente (el `SearchInput`, el bloque `loading ? … : …` y el `editing && <UserModal …>`) en `{tab === "users" && ( … )}`, y añadir después:

```typescript
      {tab === "invitations" && <InvitationsTab flash={flash} />}
```

El `{toast && <ToastBanner toast={toast} />}` queda fuera de ambas ramas, al final, para que sirva a las dos pestañas.

- [ ] **Step 4: Verificar**

```bash
source ~/.nvm/nvm.sh
cd /home/endurance/Projects/Endurance/dots/dots-webapp
npm run lint && npx next build
```

Esperado: ambos limpios.

- [ ] **Step 5: Commit**

```bash
git add components/admin/invitations-tab.tsx components/admin/invite-modal.tsx "app/(app)/admin/users/page.tsx"
git commit -m "feat(invitaciones): pestana de invitaciones en el panel

Copiar link va visible y no escondido en un menu: es el plan B real
cuando Gmail manda la invitacion a spam. El link se arma con el origen
actual para no copiar enlaces a produccion mientras se desarrolla.

Al pegar una lista, el resultado dice cuantas se crearon y cuales se
omitieron con su motivo, en vez de un 'listo' que oculte lo que no paso.

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Tarea 12: Verificación end-to-end y documentación

**Files:**
- Modify: `dots-webapp/CLAUDE.md`
- Modify: `dots-backend/.env` y `dots-webapp/docs/ARQUITECTURA.md`
- Create: `dots-webapp/docs/superpowers/verificacion-invitaciones.md`

- [ ] **Step 1: Configurar el entorno local**

En `dots-backend/.env`, añadir:

```
INVITE_TTL_HOURS=48
APP_PUBLIC_URL=http://localhost:3000
```

En producción, `APP_PUBLIC_URL` debe apuntar al dominio real de la webapp.

- [ ] **Step 2: Recorrido completo con los dos servidores arriba**

Con el backend en `:4000` y `npm run dev` en la webapp:

1. Entrar como admin, ir a `/admin/users`, pestaña **Invitations**.
2. Invitar a una dirección propia. Verificar que llega el correo (o, si SMTP falla, que el log de dev imprime `[DEV] Invite link for …`).
3. Abrir el link. Confirmar que el correo aparece fijo y que nombre y apellido vienen precargados.
4. Crear la cuenta. Confirmar que cae en `/onboarding` con sesión iniciada.
5. Volver al panel: la invitación aparece **accepted** y el usuario nuevo está en la pestaña Users.

- [ ] **Step 3: Probar los cuatro caminos muertos**

1. **Ya usada:** reabrir el link recién aceptado → "Esta invitación ya se usó".
2. **Revocada:** invitar a otra dirección, revocar, abrir el link → "Esta invitación fue cancelada".
3. **Vencida:** poner `INVITE_TTL_HOURS=0.001` en `.env`, reiniciar el backend, invitar, esperar unos segundos y abrir → "Este enlace ya venció". **Devolver `INVITE_TTL_HOURS=48` y reiniciar.**
4. **Inexistente:** abrir `/invite/basura` → "No encontramos esta invitación".

- [ ] **Step 4: Probar el corte de acceso**

Con el usuario nuevo logueado en otra ventana:

1. Bloquearlo desde el panel.
2. Esperar a que caduque su access token (15 min) o forzar el refresh recargando la página.
3. Confirmar que cae al login con **"Tu acceso fue desactivado"**, no con un error genérico de sesión.
4. Desbloquearlo y confirmar que vuelve a entrar.
5. Ponerle una fecha `expires` pasada desde la ficha y confirmar que el login dice **"Tu acceso venció"**.

- [ ] **Step 5: Confirmar que no queda ninguna puerta abierta**

```bash
curl -s -o /dev/null -w 'register: %{http_code}\n' -X POST http://localhost:4000/auth/register \
  -H 'Content-Type: application/json' -d '{"username":"x","password":"12345678"}'
curl -s -o /dev/null -w 'newUser:  %{http_code}\n' -X POST http://localhost:4000/newUser \
  -H 'Content-Type: application/json' -d '{}'
curl -s -o /dev/null -w 'invites:  %{http_code}\n' http://localhost:4000/admin/invitations
```

Esperado: `register: 404`, `newUser: 404`, `invites: 401`.

- [ ] **Step 6: Actualizar la documentación**

En `dots-webapp/CLAUDE.md`, añadir a las reglas duras:

```markdown
8. **Acceso solo por invitación.** No existe registro público: `POST /auth/register` fue eliminado. La única ruta que crea usuarios es `POST /auth/invitations/accept`, y exige un token válido. Si necesitas una cuenta de prueba, invítate desde `/admin/users` → Invitations.
```

En `dots-webapp/docs/ARQUITECTURA.md`, registrar la ruta `/invite/[token]` entre los flujos que viven fuera del grupo `(app)`.

Crear `dots-webapp/docs/superpowers/verificacion-invitaciones.md` con el resultado real de los pasos 2 a 5: qué se probó, qué pasó y qué quedó pendiente. Si algo no se pudo verificar, decirlo explícitamente en vez de omitirlo.

- [ ] **Step 7: Commit final en ambos repos**

`dots-backend/.env` está en `.gitignore` y no se commitea: las dos variables nuevas quedan documentadas en las notas de despliegue de abajo y hay que ponerlas a mano en el entorno de producción.

```bash
cd /home/endurance/Projects/Endurance/dots/dots-webapp
git add CLAUDE.md docs/ARQUITECTURA.md docs/superpowers/verificacion-invitaciones.md
git commit -m "docs(invitaciones): registrar la verificacion end-to-end

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Notas de despliegue

Al desplegar hay que hacer, **en este orden**:

1. Correr `npm run migrate:invitations` contra la BD de producción.
2. Definir `APP_PUBLIC_URL` en el entorno del backend de producción. Sin ella, los links del correo apuntarán al primer valor de `FRONTEND_ORIGIN`, que puede no ser el dominio público.
3. Desplegar backend y frontend.

**Cambio de comportamiento visible:** los 12 usuarios con `expires` en el pasado dejarán de poder entrar. Está verificado que ninguno es admin y ninguno tiene progreso, pero si alguno reclama, se reactiva editando `expires` en su ficha del panel.
