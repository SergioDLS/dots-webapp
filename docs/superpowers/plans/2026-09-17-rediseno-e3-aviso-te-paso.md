# E.3 — Aviso "te pasó" (fase 2 de gestos) · Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** que el gesto equipado tenga un escenario público — cuando alguien te adelanta en el ranking semanal, una tarjeta te lo dice con su nombre y su gesto.

**Architecture:** el backend añade dos campos a `GET /me/rival` (el gesto equipado de cada vecino y la semana del ranking) sin ninguna migración. El frontend mete un controlador en el layout del hub que, al entrar a Camino, Juegos o Retos, consulta el rival, compara el puesto con un snapshot en `localStorage` y pinta una tarjeta que se va sola. Toda la decisión —comparar, descartar el cambio de semana, elegir a quién nombrar y qué pose usar— vive en un módulo puro bajo `node --test`, separada del componente y del fetch.

**Tech Stack:** NestJS 11 + TypeORM + jest (dots-backend); Next.js 16 app router + React 19 + Tailwind 4 + `node --test` (dots-webapp).

**Spec:** `docs/superpowers/specs/2026-09-14-rediseno-look-and-feel-juvenil-design.md` §6.5 (y §6.4, que es la fase 1 de la que esta cuelga).

## Global Constraints

- **Dos repos.** Tasks 1-2 en `dots-backend`, Tasks 3-5 en `dots-webapp`, Task 6 en los dos. Cada repo tiene su propia rama y sus propios commits.
- **Node 24.** SIEMPRE `source ~/.nvm/nvm.sh && nvm use` antes de cualquier `npm`/`node`, en los dos repos.
- **Sin migraciones.** La BD es PostgreSQL remota COMPARTIDA de producción. Este plan no crea ni altera ninguna tabla ni columna: todo sale de `dots.user_items` y `dots.shop_items`, que ya existen. **Ningún script se ejecuta contra la BD.**
- **Navegación con `router.push`, nunca `window.location.*`** (regla 1 de CLAUDE.md).
- **RN-safe** (regla 2): solo tap/pointer, nada de `keydown` como input, animación solo `transform`/`opacity`.
- **Lint del compiler de React** (regla 3): `setState` síncrono en el cuerpo de un `useEffect` es ERROR. Dentro de callbacks de promesa, `setTimeout` o `requestAnimationFrame` sí está permitido.
- **Doty solo desde el registro generado** `components/ui/doty/poses.ts` (regla 10). Las poses que usa este plan —`flexeando`, `aplaudiendo`, `saludando`, `emocionado`, `feliz`— están verificadas en el registro.
- **Cero emoji como iconografía** (regla 11). El aviso que se retira lleva uno; el nuevo no lleva ninguno.
- **Nunca editar a mano** `app/themes.generated.css` ni `lib/theme-colors.ts` (regla 12).
- **Copy en español, tono juguetón.** Doty nunca regaña ni se burla de un fallo del usuario: que te adelanten no es un fallo tuyo, es un mérito del otro.
- Antes de commitear en `dots-webapp`: `npm run lint` y `npx next build` tienen que pasar. En `dots-backend`: `npm run lint` y `npm test`.

---

## Estructura de archivos

**dots-backend**

| Archivo | Responsabilidad |
|---|---|
| `src/common/gesture.query.ts` (nuevo) | Gesto equipado por usuario para un lote de ids, en una sola consulta. Hermano exacto de `avatar.query.ts`. |
| `src/common/gesture.query.spec.ts` (nuevo) | Su test. |
| `src/modules/me/me.dto.ts` (modificar) | `gesture` en el vecino, `weekStart` en la raíz. |
| `src/modules/me/me.service.ts` (modificar) | `getRival` rellena los dos campos nuevos. |
| `src/modules/me/me.service.spec.ts` (modificar) | Casos nuevos y **arreglo del doble**, que hoy no distingue las dos consultas a `dots.user_items`. |

**dots-webapp**

| Archivo | Responsabilidad |
|---|---|
| `lib/rival-alert.ts` (nuevo) | Módulo PURO: parsear el snapshot (tolerando el formato viejo) y decidir si hay aviso, cuál y con qué pose. |
| `lib/rival-alert.test.mjs` (nuevo) | Su test bajo `node --test`. |
| `components/rival/rival-alert.tsx` (nuevo) | La tarjeta. Solo pinta: no consulta, no mide, no guarda. |
| `components/rival/rival-watch.tsx` (nuevo) | El controlador: reacciona a la ruta, consulta, guarda el snapshot y decide si montar la tarjeta. |
| `app/(app)/(hub)/layout.tsx` (modificar) | Monta el controlador. |
| `services/engagement.service.ts` (modificar) | Los dos campos nuevos en los tipos. |
| `hooks/use-rival-watch.ts` (**borrar**) | Hace lo contrario de esto y fuera de las convenciones del repo. |
| `app/(app)/(hub)/quests/page.tsx` (modificar) | Deja de llamar al hook borrado. |

---

### Task 1: `gesturesByUser` (backend)

**Files:**
- Create: `src/common/gesture.query.ts`
- Test: `src/common/gesture.query.spec.ts`

**Interfaces:**
- Consumes: nada de tareas anteriores.
- Produces: `gesturesByUser(manager: EntityManager, ids: number[]): Promise<Map<number, string>>`. El valor del Map es la animación (`"bob"` | `"cheer"` | `"sad"` | `"wave"`). Los ids sin gesto equipado NO aparecen en el Map.

**Contexto que no está en el código:** el gesto equipado no es una columna. Vive en dos sitios a la vez: `dots.user_items.equipped_slot = 'gesture'` dice QUE está puesto, y `dots.shop_items.meta->>'animation'` dice CUÁL es. El frontend traduce esa animación a una pose de Doty, así que una animación desconocida produciría una pose inexistente: por eso se filtra aquí y no allí.

- [ ] **Step 1: Escribe el test que falla**

Crea `src/common/gesture.query.spec.ts`:

```ts
import { gesturesByUser } from './gesture.query';

/** Doble mínimo de EntityManager: solo necesitamos `.query`. */
function fakeManager(rows: unknown[]) {
  const query = jest.fn().mockResolvedValue(rows);
  return { manager: { query } as never, query };
}

describe('gesturesByUser', () => {
  it('devuelve la animación equipada de cada id, en una sola consulta en lote', async () => {
    const { manager, query } = fakeManager([
      { user_id: 2, meta: { animation: 'wave' } },
    ]);

    const out = await gesturesByUser(manager, [1, 2]);

    expect(out.get(2)).toBe('wave');
    expect(out.has(1)).toBe(false);
    expect(query).toHaveBeenCalledTimes(1);
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining("equipped_slot = 'gesture'"),
      [[1, 2]],
    );
  });

  it('descarta animaciones que Doty no sabe hacer, en vez de pasarlas al frontend', async () => {
    const { manager } = fakeManager([
      { user_id: 3, meta: { animation: 'breakdance' } },
      { user_id: 4, meta: { animation: 'cheer' } },
    ]);

    const out = await gesturesByUser(manager, [3, 4]);

    expect(out.has(3)).toBe(false);
    expect(out.get(4)).toBe('cheer');
  });

  it('meta nula o sin animation no rompe', async () => {
    const { manager } = fakeManager([
      { user_id: 5, meta: null },
      { user_id: 6, meta: { color: '#FF1F8F' } },
    ]);

    const out = await gesturesByUser(manager, [5, 6]);

    expect(out.size).toBe(0);
  });

  it('lote vacío: no consulta la base de datos', async () => {
    const { manager, query } = fakeManager([]);
    const out = await gesturesByUser(manager, []);
    expect(out.size).toBe(0);
    expect(query).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Corre el test para verificar que falla**

```bash
source ~/.nvm/nvm.sh && nvm use && npx jest src/common/gesture.query.spec.ts
```

Esperado: FAIL — no existe `./gesture.query`.

- [ ] **Step 3: Escribe la implementación**

Crea `src/common/gesture.query.ts`:

```ts
import { EntityManager } from 'typeorm';

/**
 * Las animaciones que Doty sabe hacer. Cualquier otra cosa en
 * `meta.animation` se descarta aquí: el frontend la traduciría a una pose que
 * no existe en el registro generado.
 */
const ANIMACIONES = new Set(['bob', 'cheer', 'sad', 'wave']);

/**
 * Gesto equipado por usuario, para un lote de ids — una sola consulta, nunca
 * una por fila. Hermano de `avatar.query.ts` y con su misma forma.
 *
 * El gesto vive en dos sitios: `user_items.equipped_slot` dice que está
 * puesto y `shop_items.meta->>'animation'` dice cuál es.
 */
export async function gesturesByUser(
  manager: EntityManager,
  ids: number[],
): Promise<Map<number, string>> {
  if (ids.length === 0) return new Map();
  const rows: Array<{ user_id: number; meta: Record<string, unknown> | null }> =
    await manager.query(
      `SELECT ui.user_id, si.meta FROM dots.user_items ui
         JOIN dots.shop_items si ON si.id = ui.item_id
        WHERE ui.equipped_slot = 'gesture' AND ui.user_id = ANY($1::int[])`,
      [ids],
    );
  const out = new Map<number, string>();
  for (const r of rows) {
    const animacion = r.meta?.animation;
    if (typeof animacion === 'string' && ANIMACIONES.has(animacion)) {
      out.set(Number(r.user_id), animacion);
    }
  }
  return out;
}
```

- [ ] **Step 4: Corre el test y el lint**

```bash
source ~/.nvm/nvm.sh && nvm use && npx jest src/common/gesture.query.spec.ts && npm run lint
```

Esperado: 4 tests PASS, lint limpio.

- [ ] **Step 5: Commit**

```bash
git add src/common/gesture.query.ts src/common/gesture.query.spec.ts
git commit -m "feat(rival): el gesto equipado de un lote de usuarios, en una sola consulta

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 2: `GET /me/rival` gana el gesto y la semana (backend)

**Files:**
- Modify: `src/modules/me/me.dto.ts` (clases `RivalNeighborDto` y `RivalDto`)
- Modify: `src/modules/me/me.service.ts` (método `getRival`)
- Test: `src/modules/me/me.service.spec.ts` (bloque `describe('MeService.getRival')`)

**Interfaces:**
- Consumes: `gesturesByUser(manager, ids): Promise<Map<number, string>>` de la Task 1.
- Produces: el payload de `GET /me/rival` pasa a ser
  `{ above: { name, delta, avatar, gesture } | null, below: { ... } | null, rank: number | null, weekStart: string | null }`,
  donde `gesture` es `"bob" | "cheer" | "sad" | "wave" | null` y `weekStart` es el lunes de la semana del ranking en formato `"YYYY-MM-DD"`, o `null` si la consulta falló.

**AVISO IMPORTANTE sobre el doble de test.** El `makeRivalService` que ya existe en `me.service.spec.ts` decide qué devolver mirando si el SQL contiene `'FROM dots.user_items'`. A partir de esta tarea **hay DOS consultas que contienen esa cadena** —la de avatares y la de gestos—, así que el doble devolvería filas de avatar a la consulta de gestos. Hay que distinguirlas por `equipped_slot`. Está en el Step 1.

- [ ] **Step 1: Arregla el doble y escribe los tests que fallan**

En `src/modules/me/me.service.spec.ts`, dentro de `describe('MeService.getRival')`, sustituye la función `makeRivalService` entera por esta:

```ts
  function makeRivalService(opts: {
    rows: Array<{ id: number; name: string; xp_week: number }>;
    avatarRows?: Row[];
    gestureRows?: Array<{ user_id: number; meta: Record<string, unknown> | null }>;
  }) {
    const query = jest.fn().mockImplementation((sql: string) => {
      const texto = String(sql);
      if (texto.includes('FROM dots.users'))
        return Promise.resolve(
          opts.rows.map((r) => ({
            id: String(r.id),
            name: r.name,
            xp_week: String(r.xp_week),
          })),
        );
      // OJO: las dos consultas de abajo leen dots.user_items. Se distinguen
      // por el slot, no por la tabla, o el doble serviría avatares a la
      // consulta de gestos.
      if (texto.includes("equipped_slot = 'gesture'"))
        return Promise.resolve(opts.gestureRows ?? []);
      if (texto.includes('FROM dots.user_items'))
        return Promise.resolve(opts.avatarRows ?? []);
      return Promise.resolve([]);
    });
    const usersRepository = {
      findOne: jest.fn(),
      update: jest.fn(),
      manager: { query },
    };
    const service = new MeService(
      usersRepository as never,
      { find: jest.fn().mockResolvedValue([]) } as never,
      { find: jest.fn().mockResolvedValue([]) } as never,
    );
    return { service, query };
  }
```

Y añade estos tests al final del mismo `describe`, antes de su `});` de cierre:

```ts
  it('cada vecino trae su gesto equipado, y null si no tiene ninguno', async () => {
    const { service } = makeRivalService({
      rows: [
        { id: 9, name: 'Arriba', xp_week: 500 },
        { id: 1, name: 'Yo', xp_week: 300 },
        { id: 7, name: 'Abajo', xp_week: 100 },
      ],
      gestureRows: [{ user_id: 9, meta: { animation: 'wave' } }],
    });

    const out = await service.getRival(1);

    expect(out.above?.gesture).toBe('wave');
    expect(out.below?.gesture).toBeNull();
  });

  it('devuelve la semana del ranking, para que el cliente no compare entre semanas', async () => {
    const { service } = makeRivalService({
      rows: [{ id: 1, name: 'Yo', xp_week: 300 }],
    });

    const out = await service.getRival(1);

    expect(out.weekStart).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('sin puesto esta semana, la semana viaja igual', async () => {
    const { service } = makeRivalService({ rows: [] });

    const out = await service.getRival(1);

    expect(out).toEqual({
      above: null,
      below: null,
      rank: null,
      weekStart: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
    });
  });

  it('si la consulta revienta, weekStart es null y el cliente no compara', async () => {
    const usersRepository = {
      findOne: jest.fn(),
      update: jest.fn(),
      manager: { query: jest.fn().mockRejectedValue(new Error('boom')) },
    };
    const service = new MeService(
      usersRepository as never,
      { find: jest.fn().mockResolvedValue([]) } as never,
      { find: jest.fn().mockResolvedValue([]) } as never,
    );

    const out = await service.getRival(1);

    expect(out).toEqual({
      above: null,
      below: null,
      rank: null,
      weekStart: null,
    });
  });
```

- [ ] **Step 2: Corre los tests para verificar que fallan**

```bash
source ~/.nvm/nvm.sh && nvm use && npx jest src/modules/me/me.service.spec.ts -t getRival
```

Esperado: FAIL — `gesture` y `weekStart` no existen en el payload.

- [ ] **Step 3: Añade los campos al DTO**

En `src/modules/me/me.dto.ts`, sustituye las dos clases:

```ts
export class RivalNeighborDto {
  name: string;
  delta: number;
  avatar: PublicAvatar;
  /**
   * Animación del gesto equipado ('bob' | 'cheer' | 'sad' | 'wave'), o null
   * si no tiene ninguno puesto. La usa el aviso "te pasó" (spec §6.5).
   */
  gesture: string | null;
}

export class RivalDto {
  above: RivalNeighborDto | null;
  below: RivalNeighborDto | null;
  /** Caller's 1-based position in the weekly leaderboard; null when unranked. */
  rank: number | null;
  /**
   * Lunes de la semana del ranking, 'YYYY-MM-DD'; null si la consulta falló.
   * El cliente guarda su puesto junto a esta semana y NO compara si cambió:
   * al reiniciarse el ranking los puestos se barajan sin que nadie te haya
   * pasado, y sin esto saldría un aviso falso señalando a una persona.
   */
  weekStart: string | null;
}
```

- [ ] **Step 4: Rellena los campos en el servicio**

En `src/modules/me/me.service.ts`, dentro de `getRival`:

1. Añade el import junto a los que ya hay:

```ts
import { gesturesByUser } from '../../common/gesture.query';
```

(ajusta la profundidad del `../` a la que usen los imports vecinos de ese archivo).

2. Sustituye los tres `return` del método por estos, dejando el resto igual:

- el de "usuario sin puesto":

```ts
      if (myIndex === -1) {
        return { above: null, below: null, rank: null, weekStart: monday };
      }
```

- el `catch` del final:

```ts
    } catch {
      return { above: null, below: null, rank: null, weekStart: null };
    }
```

3. Justo después del `const avatares = await avatarsByUser(...)` que ya existe, añade el lote de gestos reutilizando los mismos ids:

```ts
      const vecinos = [aboveRow, belowRow].filter(
        (r): r is { id: string; name: string; xp_week: string } => r != null,
      );
      const gestos = await gesturesByUser(
        this.usersRepository.manager,
        vecinos.map((r) => Number(r.id)),
      );
```

4. Añade `gesture` a los dos vecinos y `weekStart` al return final:

```ts
      const above = aboveRow
        ? {
            name: aboveRow.name ?? '',
            delta: Number(aboveRow.xp_week) - myXp,
            avatar: avatares.get(Number(aboveRow.id)) ?? publicAvatar(null),
            gesture: gestos.get(Number(aboveRow.id)) ?? null,
          }
        : null;

      const below = belowRow
        ? {
            name: belowRow.name ?? '',
            delta: myXp - Number(belowRow.xp_week),
            avatar: avatares.get(Number(belowRow.id)) ?? publicAvatar(null),
            gesture: gestos.get(Number(belowRow.id)) ?? null,
          }
        : null;

      return { above, below, rank, weekStart: monday };
```

**Nota:** el `const avatares = await avatarsByUser(...)` existente calcula su lista de ids en línea. Puedes dejarlo tal cual y usar `vecinos` solo para los gestos, o pasarle `vecinos.map(...)` también — las dos cosas valen, pero no dupliques el filtro tres veces.

- [ ] **Step 5: Corre los tests y el lint**

```bash
source ~/.nvm/nvm.sh && nvm use && npm test && npm run lint
```

Esperado: toda la suite en verde (los tests viejos de `getRival` comparan objetos completos con `toEqual`, así que si alguno falla por el campo nuevo, **añádele `gesture: null` al objeto esperado** — no quites la aserción).

- [ ] **Step 6: Commit**

```bash
git add src/modules/me/me.dto.ts src/modules/me/me.service.ts src/modules/me/me.service.spec.ts
git commit -m "feat(rival): el payload del rival lleva el gesto del vecino y la semana del ranking

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 3: `lib/rival-alert.ts` — la decisión, pura y probada (webapp)

**Files:**
- Create: `lib/rival-alert.ts`
- Test: `lib/rival-alert.test.mjs`

**Interfaces:**
- Consumes: `gesturePose(animation: DotyAnimation): DotyPose` de `lib/avatar-flip.ts` (ya existe; traduce `wave` → `saludando`, `cheer` → `emocionado`, el resto → `feliz`).
- Produces:
  - `DURACION_MS = 6000`
  - `claveSnapshot(userId: number): string`
  - `parsearSnapshot(raw: string | null): SnapshotRival | null`
  - `serializarSnapshot(snap: SnapshotRival): string`
  - `decidirAviso(anterior: SnapshotRival | null, actual: EstadoRival): Aviso | null`
  - tipos `SnapshotRival`, `VecinoRival`, `EstadoRival`, `Aviso`

**Reglas del archivo:** SOLO `import type` para rutas con alias `@/` (Node ejecuta el test sin bundler y no resolvería el alias). El import de `./avatar-flip.ts` SÍ puede ser de valor, porque es una ruta relativa y ese archivo a su vez solo usa `import type`. Mismo patrón que `lib/tips.ts`.

- [ ] **Step 1: Escribe el test que falla**

Crea `lib/rival-alert.test.mjs`:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DURACION_MS,
  claveSnapshot,
  decidirAviso,
  parsearSnapshot,
  serializarSnapshot,
} from "./rival-alert.ts";

const SEMANA = "2026-09-14";

/** Estado del servidor con los dos vecinos puestos, para no repetirlo. */
function estado(over = {}) {
  return {
    rank: 5,
    weekStart: SEMANA,
    above: { name: "Camila", delta: 40, gesture: null },
    below: { name: "Bruno", delta: 25, gesture: null },
    ...over,
  };
}

test("la primera vez no avisa, solo guarda", () => {
  assert.equal(decidirAviso(null, estado()), null);
});

test("si no cambia el puesto no hay aviso", () => {
  const anterior = { rank: 5, weekStart: SEMANA };
  assert.equal(decidirAviso(anterior, estado({ rank: 5 })), null);
});

test("bajar de puesto avisa y nombra a quien quedó justo encima", () => {
  const anterior = { rank: 4, weekStart: SEMANA };
  const aviso = decidirAviso(anterior, estado({ rank: 5 }));
  assert.equal(aviso.tipo, "perdiste");
  assert.equal(aviso.nombre, "Camila");
  assert.equal(aviso.delta, 40);
});

test("sin gesto equipado, el rival presume con la pose fija", () => {
  const anterior = { rank: 4, weekStart: SEMANA };
  const aviso = decidirAviso(anterior, estado({ rank: 5 }));
  assert.equal(aviso.pose, "flexeando");
  assert.equal(aviso.animacion, "cheer");
});

test("con gesto equipado, se usa el gesto del rival y su pose", () => {
  const anterior = { rank: 4, weekStart: SEMANA };
  const aviso = decidirAviso(
    anterior,
    estado({ rank: 5, above: { name: "Camila", delta: 40, gesture: "wave" } }),
  );
  assert.equal(aviso.animacion, "wave");
  assert.equal(aviso.pose, "saludando");
});

test("subir de puesto avisa, nombra a quien quedó debajo y NUNCA usa su gesto", () => {
  const anterior = { rank: 6, weekStart: SEMANA };
  const aviso = decidirAviso(
    anterior,
    estado({ rank: 5, below: { name: "Bruno", delta: 25, gesture: "wave" } }),
  );
  assert.equal(aviso.tipo, "ganaste");
  assert.equal(aviso.nombre, "Bruno");
  assert.equal(aviso.pose, "aplaudiendo");
  assert.equal(aviso.animacion, "cheer", "el gesto es el premio de ganar, no de perder");
});

test("si cambió la semana no se compara: el ranking se reinicia y barajaría los puestos", () => {
  const anterior = { rank: 4, weekStart: "2026-09-07" };
  assert.equal(decidirAviso(anterior, estado({ rank: 5 })), null);
});

test("semana desconocida en cualquiera de los dos lados tampoco compara", () => {
  assert.equal(decidirAviso({ rank: 4, weekStart: null }, estado({ rank: 5 })), null);
  assert.equal(
    decidirAviso({ rank: 4, weekStart: SEMANA }, estado({ rank: 5, weekStart: null })),
    null,
  );
});

test("sin puesto en alguno de los dos lados no hay nada que comparar", () => {
  assert.equal(decidirAviso({ rank: null, weekStart: SEMANA }, estado()), null);
  assert.equal(
    decidirAviso({ rank: 4, weekStart: SEMANA }, estado({ rank: null })),
    null,
  );
});

test("bajar sin vecino arriba no inventa a nadie", () => {
  const anterior = { rank: 4, weekStart: SEMANA };
  assert.equal(decidirAviso(anterior, estado({ rank: 5, above: null })), null);
});

test("un nombre vacío no deja la frase coja", () => {
  const anterior = { rank: 4, weekStart: SEMANA };
  const aviso = decidirAviso(
    anterior,
    estado({ rank: 5, above: { name: "", delta: 40, gesture: null } }),
  );
  assert.equal(aviso.nombre, "Alguien");
});

test("el delta siempre se enseña en positivo", () => {
  const anterior = { rank: 4, weekStart: SEMANA };
  const aviso = decidirAviso(
    anterior,
    estado({ rank: 5, above: { name: "Camila", delta: -40, gesture: null } }),
  );
  assert.equal(aviso.delta, 40);
});

test("una animación que Doty no sabe hacer cae en la pose fija, no en una pose inventada", () => {
  const anterior = { rank: 4, weekStart: SEMANA };
  const aviso = decidirAviso(
    anterior,
    estado({ rank: 5, above: { name: "Camila", delta: 40, gesture: "breakdance" } }),
  );
  assert.equal(aviso.pose, "flexeando");
  assert.equal(aviso.animacion, "cheer");
});

test("el snapshot viejo (solo rank) se lee sin romperse y se trata como semana desconocida", () => {
  const snap = parsearSnapshot('{"rank":7}');
  assert.deepEqual(snap, { rank: 7, weekStart: null });
});

test("un snapshot ilegible o ausente es como no tener ninguno", () => {
  assert.equal(parsearSnapshot(null), null);
  assert.equal(parsearSnapshot("no soy json"), null);
});

test("lo que se serializa se vuelve a leer igual", () => {
  const snap = { rank: 3, weekStart: SEMANA };
  assert.deepEqual(parsearSnapshot(serializarSnapshot(snap)), snap);
});

test("la clave del snapshot es la que ya usaban los navegadores", () => {
  assert.equal(claveSnapshot(42), "dots.rival.rank.42");
});

test("la tarjeta dura más que el gesto más largo", () => {
  assert.ok(DURACION_MS >= 3000);
});
```

- [ ] **Step 2: Corre el test para verificar que falla**

```bash
source ~/.nvm/nvm.sh && nvm use && node --test lib/rival-alert.test.mjs
```

Esperado: FAIL — no existe `./rival-alert.ts`.

- [ ] **Step 3: Escribe el módulo**

Crea `lib/rival-alert.ts`:

```ts
import { gesturePose } from "./avatar-flip";
import type { DotyAnimation, DotyPose } from "@/components/ui/doty/doty";

/**
 * Aviso "te pasó" (spec §6.5): decide si alguien te adelantó en el ranking
 * semanal desde la última comprobación, a quién nombrar y con qué cara.
 *
 * Lógica pura para poder probarse con `node --test`: por eso SOLO admite
 * `import type` para el alias `@/` — Node ejecuta este archivo sin bundler y
 * no lo resolvería. `./avatar-flip` sí entra como valor porque es una ruta
 * relativa y ese archivo tampoco importa valores con alias.
 */

/** Lo que la tarjeta se queda a la vista. Da para leer dos líneas y ver un
 *  ciclo entero del gesto más largo, que dura 3 s. */
export const DURACION_MS = 6000;

/** Prefijo de la clave en localStorage. El que ya usaban los navegadores. */
const PREFIJO = "dots.rival.rank.";

/** Las animaciones que Doty sabe hacer; cualquier otra cae en la pose fija. */
const ANIMACIONES: readonly string[] = ["bob", "cheer", "sad", "wave"];

/** Cuando el ranking no trae nombre, la frase tiene que seguir funcionando. */
const SIN_NOMBRE = "Alguien";

/** Puesto y semana de la última comprobación, por usuario y por dispositivo. */
export interface SnapshotRival {
  rank: number | null;
  weekStart: string | null;
}

/** Un vecino del ranking, tal como llega de `GET /me/rival`. */
export interface VecinoRival {
  name: string;
  delta: number;
  gesture: string | null;
}

/** La respuesta del servidor, en lo que a esta decisión le importa. */
export interface EstadoRival {
  rank: number | null;
  weekStart: string | null;
  above: VecinoRival | null;
  below: VecinoRival | null;
}

/** Lo que hay que pintar, o null si no hay nada que decir. */
export interface Aviso {
  tipo: "perdiste" | "ganaste";
  nombre: string;
  /** Diferencia de XP con el vecino, siempre positiva. */
  delta: number;
  pose: DotyPose;
  animacion: DotyAnimation;
}

export function claveSnapshot(userId: number): string {
  return `${PREFIJO}${userId}`;
}

/**
 * Tolera el formato viejo `{ rank }` —el que hay hoy en los navegadores de la
 * gente— tratándolo como semana desconocida: así la primera comprobación tras
 * actualizar no compara y nadie recibe un aviso falso.
 */
export function parsearSnapshot(raw: string | null): SnapshotRival | null {
  if (raw === null) return null;
  try {
    const v: unknown = JSON.parse(raw);
    if (typeof v !== "object" || v === null) return null;
    const o = v as { rank?: unknown; weekStart?: unknown };
    return {
      rank: typeof o.rank === "number" ? o.rank : null,
      weekStart: typeof o.weekStart === "string" ? o.weekStart : null,
    };
  } catch {
    return null;
  }
}

export function serializarSnapshot(snap: SnapshotRival): string {
  return JSON.stringify({ rank: snap.rank, weekStart: snap.weekStart });
}

function animacionValida(gesture: string | null): DotyAnimation | null {
  return gesture !== null && ANIMACIONES.includes(gesture)
    ? (gesture as DotyAnimation)
    : null;
}

function nombreVisible(name: string): string {
  return name.trim() === "" ? SIN_NOMBRE : name;
}

/**
 * Un puesto en un ranking solo empeora si alguien te cruzó, así que quien
 * quede justo encima ES alguien que te pasó; y solo mejora si tú cruzaste a
 * alguien, que es quien queda justo debajo. No hace falta rastrear identidades.
 */
export function decidirAviso(
  anterior: SnapshotRival | null,
  actual: EstadoRival,
): Aviso | null {
  if (anterior === null) return null;
  // Entre semanas no se compara: el ranking se reinicia y los puestos se
  // barajan sin que nadie te haya pasado.
  if (anterior.weekStart === null || actual.weekStart === null) return null;
  if (anterior.weekStart !== actual.weekStart) return null;
  if (anterior.rank === null || actual.rank === null) return null;

  if (actual.rank > anterior.rank) {
    const vecino = actual.above;
    if (vecino === null) return null;
    const animacion = animacionValida(vecino.gesture);
    return {
      tipo: "perdiste",
      nombre: nombreVisible(vecino.name),
      delta: Math.abs(vecino.delta),
      // El sujeto del gesto es el rival presumiendo, nunca Doty burlándose de
      // ti: que te adelanten no es un fallo tuyo, es un mérito del otro.
      pose: animacion === null ? "flexeando" : gesturePose(animacion),
      animacion: animacion ?? "cheer",
    };
  }

  if (actual.rank < anterior.rank) {
    const vecino = actual.below;
    if (vecino === null) return null;
    return {
      tipo: "ganaste",
      nombre: nombreVisible(vecino.name),
      delta: Math.abs(vecino.delta),
      // Aquí NUNCA el gesto del otro: el gesto es exclusivamente la carga del
      // aviso de derrota, y esa exclusividad es lo que lo convierte en un flex.
      pose: "aplaudiendo",
      animacion: "cheer",
    };
  }

  return null;
}
```

- [ ] **Step 4: Corre el test y verifica que pasa**

```bash
source ~/.nvm/nvm.sh && nvm use && node --test lib/rival-alert.test.mjs && npm run test:scripts
```

Esperado: los 18 tests nuevos en verde y la suite entera sin regresiones.

- [ ] **Step 5: Commit**

```bash
git add lib/rival-alert.ts lib/rival-alert.test.mjs
git commit -m "feat(rival): la decisión del aviso te pasó, pura y probada

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 4: la tarjeta del aviso (webapp)

**Files:**
- Create: `components/rival/rival-alert.tsx`

**Interfaces:**
- Consumes: `Aviso` y `DURACION_MS` de `lib/rival-alert.ts` (Task 3).
- Produces: `export default function RivalAlert({ aviso, onCerrar, onAbrirRetos }: Props)`, donde `onCerrar: () => void` y `onAbrirRetos: () => void`.

**Contexto:** el componente SOLO pinta. No consulta, no guarda el snapshot y no decide nada: eso es de la Task 5. No bloquea el scroll ni se come los toques de lo que hay debajo — no es un modal. `dots-slide-up` ya existe en `app/globals.css` y es solo `transform`/`opacity`: **no escribas CSS nuevo.**

Colocación: `fixed`, centrado horizontalmente, por encima de la barra inferior en móvil (que mide ~64 px más el `safe-area-inset-bottom`) y separado del borde en escritorio, donde la navegación es un riel de 84 px a la izquierda.

- [ ] **Step 1: Escribe el componente**

Crea `components/rival/rival-alert.tsx`:

```tsx
"use client";

import { useEffect } from "react";

import Doty from "@/components/ui/doty/doty";
import { Icon } from "@/components/ui/icon";
import { DURACION_MS, type Aviso } from "@/lib/rival-alert";

/**
 * La tarjeta del aviso "te pasó" (spec §6.5). Solo pinta: quién decide que hay
 * aviso y quién guarda el puesto es `components/rival/rival-watch.tsx`.
 *
 * NO es un modal: no bloquea el scroll ni se come los toques de lo que hay
 * debajo. La pista contextual del §7.3 sí puede interrumpir porque se ve una
 * vez en la vida; esto puede pasar varias veces por semana.
 */
interface Props {
  aviso: Aviso;
  onCerrar: () => void;
  onAbrirRetos: () => void;
}

export default function RivalAlert({ aviso, onCerrar, onAbrirRetos }: Props) {
  useEffect(() => {
    const t = setTimeout(onCerrar, DURACION_MS);
    return () => clearTimeout(t);
  }, [onCerrar]);

  const perdiste = aviso.tipo === "perdiste";
  const titulo = perdiste ? `Te pasó ${aviso.nombre}` : `Le pasaste a ${aviso.nombre}`;
  const frase = perdiste
    ? `Por ${aviso.delta} XP. ¿Lo vas a dejar así?`
    : `Vas ${aviso.delta} XP arriba. Que no te alcance.`;

  return (
    <div
      // `pointer-events-none` en el envoltorio y `auto` en la tarjeta: el
      // aviso ocupa el ancho de la pantalla para centrarse, pero solo la
      // tarjeta debe recibir toques.
      className="pointer-events-none fixed inset-x-0 z-40 flex justify-center px-4 md:pl-[84px]"
      style={{ bottom: "calc(env(safe-area-inset-bottom) + 76px)" }}
      role="status"
      aria-live="polite"
    >
      <div
        className="pointer-events-auto flex w-full max-w-sm items-center gap-3 rounded-2xl p-3 text-left"
        style={{
          background: "var(--surface)",
          border: "2px solid var(--border)",
          boxShadow: "0 8px 24px rgba(0,0,0,0.18)",
          animation: "dots-slide-up 0.3s ease-out both",
        }}
      >
        <button
          type="button"
          onClick={onAbrirRetos}
          className="flex min-w-0 flex-1 items-center gap-3 text-left transition-transform duration-150 active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--accent)"
        >
          <Doty pose={aviso.pose} size="smaller" animation={aviso.animacion} />
          <span className="flex min-w-0 flex-col gap-0.5">
            <span className="truncate font-display text-base font-extrabold text-foreground">
              {titulo}
            </span>
            <span className="text-xs font-semibold text-(--muted)">{frase}</span>
          </span>
        </button>
        <button
          type="button"
          onClick={onCerrar}
          aria-label="Cerrar"
          className="shrink-0 self-start rounded-full p-1 text-(--muted) transition-transform duration-150 active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--accent)"
        >
          <Icon name="cruz" size={18} mono />
        </button>
      </div>
    </div>
  );
}
```

**El icono se llama `cruz`** y está verificado en `components/ui/icon/paths.tsx`. Si algo no cuadrara, NO dibujes uno nuevo ni inventes un nombre: dilo en tu informe. Los iconos tienen sus propias reglas de grosor y color (regla 11) y `npm run lint` las comprueba.

- [ ] **Step 2: Verifica que compila y pasa el lint**

```bash
source ~/.nvm/nvm.sh && nvm use && npx tsc --noEmit && npm run lint
```

Esperado: los dos limpios. Si el lint se queja del `useEffect` con `setTimeout`, **no lo silencies**: `setState` dentro de un callback de `setTimeout` está permitido y aquí ni siquiera hay `setState` — el efecto solo agenda y limpia. Si aun así protesta, dilo en tu informe.

- [ ] **Step 3: Commit**

```bash
git add components/rival/rival-alert.tsx
git commit -m "feat(rival): la tarjeta del aviso, con el gesto del rival y sin bloquear nada

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 5: el controlador, y fuera el aviso viejo (webapp)

**Files:**
- Create: `components/rival/rival-watch.tsx`
- Modify: `services/engagement.service.ts` (tipos `RivalNeighbor` y `RivalData`)
- Modify: `app/(app)/(hub)/layout.tsx`
- Modify: `app/(app)/(hub)/quests/page.tsx`
- Delete: `hooks/use-rival-watch.ts`

**Interfaces:**
- Consumes: `decidirAviso`, `parsearSnapshot`, `serializarSnapshot`, `claveSnapshot`, tipo `Aviso` de `lib/rival-alert.ts` (Task 3); `RivalAlert` de `components/rival/rival-alert.tsx` (Task 4); `getRivalService(): Promise<RivalData | null>` y `useStoredUser(): StoredUser` (ya existen).
- Produces: `export default function RivalWatch()`, sin props.

**Por qué se borra el hook viejo.** `hooks/use-rival-watch.ts` hace lo CONTRARIO de esto —felicita cuando tu puesto mejora y nunca avisa de que te pasaron— y lo hace fuera de las convenciones del repo: pinta el aviso con `document.createElement` y estilos en línea, usa el token inexistente `--accent-foreground` (aquí es `--accent-contrast`), lleva un emoji como iconografía (regla 11) y lee el usuario de `localStorage` a mano. El controlador nuevo cubre los dos sentidos, así que el viejo se va entero. **Los dos no pueden convivir**: dispararían dos avisos a la vez.

- [ ] **Step 1: Añade los campos nuevos a los tipos del servicio**

En `services/engagement.service.ts`, sustituye los dos tipos:

```ts
/** One neighbour in the weekly XP leaderboard. */
export type RivalNeighbor = {
  name: string;
  avatar: PublicAvatar;
  delta: number;
  /** Animación del gesto equipado ("bob"|"cheer"|"sad"|"wave"), o null. */
  gesture: string | null;
};

/** Response of GET /me/rival */
export type RivalData = {
  above: RivalNeighbor | null;
  below: RivalNeighbor | null;
  /** Caller's 1-based position in the weekly leaderboard; null when unranked. */
  rank: number | null;
  /** Lunes de la semana del ranking, "YYYY-MM-DD"; null si el servidor falló. */
  weekStart: string | null;
};
```

- [ ] **Step 2: Escribe el controlador**

Crea `components/rival/rival-watch.tsx`:

```tsx
"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

import RivalAlert from "@/components/rival/rival-alert";
import { useAuth } from "@/context/auth-context";
import { useStoredUser } from "@/hooks/use-stored-user";
import {
  claveSnapshot,
  decidirAviso,
  parsearSnapshot,
  serializarSnapshot,
  type Aviso,
} from "@/lib/rival-alert";
import { getRivalService } from "@/services/engagement.service";

/**
 * Las tres pantallas donde se avisa. A Repaso, al Perfil y a la Tienda se va
 * con una intención concreta —practicar o gestionar algo— y el aviso la
 * interrumpiría.
 */
const RUTAS = new Set(["/levels", "/play", "/quests"]);

/**
 * Aviso "te pasó" (spec §6.5). Vive en el layout del hub y reacciona a la
 * ruta: consulta en CADA entrada a esas tres, volver de una lección incluida.
 * Ese es el momento con más dramatismo, porque acabas de sumar XP y aun así te
 * adelantaron.
 */
export default function RivalWatch() {
  const pathname = usePathname();
  const router = useRouter();
  const { isBootstrapping, accessToken } = useAuth();
  const usuario = useStoredUser();
  const userId = usuario.id;
  const [aviso, setAviso] = useState<Aviso | null>(null);

  useEffect(() => {
    if (!RUTAS.has(pathname)) return;
    if (isBootstrapping || !accessToken) return;
    if (typeof userId !== "number") return;

    let vivo = true;
    getRivalService().then((data) => {
      if (!vivo || data === null) return;

      const clave = claveSnapshot(userId);
      let anterior = null;
      try {
        anterior = parsearSnapshot(window.localStorage.getItem(clave));
      } catch {
        // localStorage puede lanzar en modo privado: sin snapshot no se avisa,
        // que es exactamente lo que queremos cuando no sabemos nada.
      }

      // El puesto se guarda SIEMPRE, se avise o no: si solo se guardara al
      // avisar, una bajada sin vecino dejaría el snapshot viejo y el siguiente
      // cambio se mediría contra un puesto que ya no es el último conocido.
      try {
        window.localStorage.setItem(
          clave,
          serializarSnapshot({ rank: data.rank, weekStart: data.weekStart }),
        );
      } catch {
        // cuota llena — se avisa igual, solo que la próxima vez no habrá con qué comparar
      }

      const siguiente = decidirAviso(anterior, {
        rank: data.rank,
        weekStart: data.weekStart,
        above: data.above,
        below: data.below,
      });
      if (siguiente !== null) setAviso(siguiente);
    });

    return () => {
      vivo = false;
    };
  }, [pathname, isBootstrapping, accessToken, userId]);

  const cerrar = useCallback(() => setAviso(null), []);
  const abrirRetos = useCallback(() => {
    setAviso(null);
    router.push("/quests");
  }, [router]);

  if (aviso === null) return null;

  return <RivalAlert aviso={aviso} onCerrar={cerrar} onAbrirRetos={abrirRetos} />;
}
```

- [ ] **Step 3: Móntalo en el layout del hub**

En `app/(app)/(hub)/layout.tsx`, añade el import junto a los demás:

```tsx
import RivalWatch from "@/components/rival/rival-watch";
```

y el componente justo DESPUÉS de `<TipsController />` y antes de `<AppNav />`:

```tsx
      {/* Aviso "te pasó" (spec §6.5): reacciona a la ruta y solo en Camino,
          Juegos y Retos. No bloquea nada: no es un modal. */}
      <RivalWatch />
```

- [ ] **Step 4: Retira el aviso viejo**

Borra el archivo:

```bash
git rm hooks/use-rival-watch.ts
```

Y en `app/(app)/(hub)/quests/page.tsx` quita las dos líneas que lo usan: el `import { useRivalWatch } from "@/hooks/use-rival-watch";` y la llamada `useRivalWatch();` dentro de `QuestsPageInner`. No toques nada más de ese archivo.

- [ ] **Step 5: Verifica**

```bash
source ~/.nvm/nvm.sh && nvm use && npx tsc --noEmit && npm run lint && npm run test:scripts && npx next build
```

Esperado: todo limpio y el build verde. El único otro consumidor de estos tipos es `components/quests/rival-banner.tsx`, que solo LEE la respuesta del servicio y no construye ningún literal, así que no debería romperse. Si aun así `tsc` se queja de alguien que ahora exige `gesture`, **arréglalo añadiendo el campo**, nunca relajando el tipo, y dilo en tu informe.

- [ ] **Step 6: Commit**

```bash
git add components/rival/rival-watch.tsx services/engagement.service.ts "app/(app)/(hub)/layout.tsx" "app/(app)/(hub)/quests/page.tsx" hooks/use-rival-watch.ts
git commit -m "feat(rival): el aviso te pasó entra al hub y el toast imperativo se va

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 6: Documentación

**Files:**
- Modify: `docs/ARQUITECTURA.md` (dots-webapp)
- Modify: `docs/ARQUITECTURA.md` (dots-backend)

**Interfaces:** ninguna; es documentación.

- [ ] **Step 1: Registra el aviso en la arquitectura del frontend**

En `docs/ARQUITECTURA.md` de **dots-webapp**, inserta esta sección completa **justo antes** de la línea `### Pistas contextuales`, dejando una línea en blanco antes y después:

```
### Aviso "te pasó"

Cuando alguien te adelanta en el ranking semanal, una tarjeta te lo dice con su
nombre y **su gesto equipado**. Es el escenario público que le da sentido a
comprar un gesto: lo que ven los demás cuando les ganas. Un solo `RivalWatch` en
el layout del hub reacciona a la ruta y consulta `GET /me/rival` al entrar a
**Camino, Juegos o Retos**, y en ninguna otra pantalla — a Repaso, al Perfil y a
la Tienda se va con una intención concreta y el aviso la interrumpiría.

La detección es una comparación de puestos contra un snapshot en `localStorage`
(`dots.rival.rank.<userId>`, `{ rank, weekStart }`): un puesto solo empeora si
alguien te cruzó, así que quien quede justo encima ES alguien que te pasó. El
`weekStart` está para que no se compare entre semanas: al reiniciarse el ranking
los puestos se barajan sin que nadie te haya pasado. Un snapshot con el formato
viejo (`{ rank }` a secas) se lee como semana desconocida y solo migra.

La decisión es pura y está probada (`lib/rival-alert.ts`, bajo `node --test`);
pintar es `components/rival/rival-alert.tsx`. Sin gesto equipado —hoy, todos— el
rival presume con la pose `flexeando`. Cuando subes de puesto sale Doty
aplaudiendo y **nunca** el gesto del otro: esa exclusividad es lo que convierte
al gesto en un flex. La tarjeta no es un modal: no bloquea el scroll, no se come
los toques y se va sola a los 6 s.
```

- [ ] **Step 2: Registra los campos nuevos en la arquitectura del backend**

En `docs/ARQUITECTURA.md` de **dots-backend**, busca la sección que documenta `GET /me/rival`. Si existe, añádele esta frase al final; si no existe ninguna mención de esa ruta, **dilo en tu informe y no inventes una sección nueva**:

```
Desde E.3 cada vecino trae además `gesture` (la animación del gesto equipado, de
`user_items.equipped_slot = 'gesture'` cruzado con `shop_items.meta->>'animation'`,
resuelto en lote por `src/common/gesture.query.ts`) y la raíz trae `weekStart`, el
lunes de la semana del ranking: el cliente guarda su puesto junto a esa semana y no
compara si cambió, porque al reiniciarse el ranking los puestos se barajan sin que
nadie haya adelantado a nadie.
```

- [ ] **Step 3: Verifica y commitea**

En dots-webapp:

```bash
source ~/.nvm/nvm.sh && nvm use && npm run lint
```

```bash
git add docs/ARQUITECTURA.md
git commit -m "docs(rival): la arquitectura registra el aviso te pasó

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

En dots-backend:

```bash
git add docs/ARQUITECTURA.md
git commit -m "docs(rival): el payload del rival documenta gesture y weekStart

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

## Verificación en navegador (la hace Sergio)

Hace falta bajar tu puesto a mano en el ranking semanal, o pedirle a otra cuenta que sume XP. Para forzarlo desde la consola del navegador, estando ya dentro de la app, se puede envejecer el snapshot:

```bash
localStorage.setItem("dots.rival.rank.<TU_ID>", JSON.stringify({rank: 1, weekStart: "<EL weekStart QUE DEVUELVE /me/rival>"}))
```

y luego navegar a Juegos o a Retos: el cliente creerá que estabas primero y que ahora no.

1. Entrar a Camino, Juegos y Retos: aparece la tarjeta con el nombre del rival, el XP y Doty flexeando.
2. En Repaso, Perfil y Tienda **no** aparece nunca.
3. Tocar la tarjeta lleva a Retos. La X la cierra. Sola se va a los 6 s.
4. Con la tarjeta puesta, la página sigue scrolleando y lo que hay debajo sigue siendo tocable: no es un modal.
5. La primera vez en un navegador nuevo no sale nada, solo se guarda.
6. Cambiando a mano el `weekStart` del snapshot no sale nada aunque el puesto baje.
7. Subiendo de puesto sale Doty aplaudiendo, y nunca el gesto del otro.
8. En 390 px la tarjeta no tapa la barra de navegación ni se sale.

## Cobertura de la spec §6.5

| Requisito | Tarea |
|---|---|
| Solo en Camino, Juegos y Retos; nunca en Repaso, Perfil ni Tienda | Task 5 (`RUTAS`) |
| Se consulta en cada entrada a esas tres | Task 5 (efecto con `pathname` en deps) |
| Detección por baja de puesto, nombrando al vecino | Task 3 (`decidirAviso`) |
| No comparar entre semanas | Task 2 (`weekStart`) + Task 3 |
| Snapshot viejo `{ rank }` se lee sin romperse | Task 3 (`parsearSnapshot`) |
| Sin gesto: pose `flexeando`, animación `cheer` | Task 3 |
| Con gesto: el gesto del rival y su pose | Task 1 + Task 2 + Task 3 |
| Subida: `aplaudiendo`, nunca el gesto del otro | Task 3 |
| Doty en tamaño `smaller`, 6 s, tap a Retos, X para cerrar | Task 4 |
| No bloquea scroll ni toques; `role="status"` | Task 4 |
| El hook imperativo viejo se retira | Task 5 |
| Sin migraciones | Tasks 1-2 (solo lecturas de tablas existentes) |
