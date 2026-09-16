# Rediseño look & feel — Subproyecto E (Avatares y tienda) — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** El avatar de Doty pasa a ser la cara pública del usuario en perfil, tienda, leaderboard, vecinos del Camino y avisos de rival; la tienda estrena su sección de avatares; y los gorros y fondos emoji se retiran devolviendo las gemas.

**Architecture:** Los avatares son filas de `shop_items` con `kind='avatar'` y `slot='avatar'` — ambas columnas son `varchar` libres, así que **no hay migración de esquema**. El backend expone `img` y `meta` en los DTO de la tienda, añade `POST /me/avatar` para conceder y equipar en una transacción, y suma un campo `avatar` a las tres caras públicas más `GET /me/settings`. En la webapp toda la geometría del marco vive en un único `<Avatar>` alimentado por lógica pura en `lib/avatar.ts`, bajo `node --test`. Dos scripts tocan la base de datos, los dos con dry-run, respaldo y `--apply` separado.

**Tech Stack:** NestJS 11 + TypeORM + Jest 30 (backend); Next.js 16 (app router) + React 19 + Tailwind 4 (webapp); `node --test` para la lógica pura; PostgreSQL remota compartida de producción.

**Spec:** `docs/superpowers/specs/2026-09-14-rediseno-look-and-feel-juvenil-design.md` — §6 completo (6.1 modelo, 6.2 retiro de gorros y fondos, 6.3 tienda), más §1 (principios) y §8 (orden y dependencias).

## Global Constraints

- Webapp: `source ~/.nvm/nvm.sh && nvm use` antes de cualquier `node`/`npm` (Node 24 por `.nvmrc`). **Es obligatorio**: sin eso el `node` del sistema no sabe ejecutar los `.ts` que importan los `.test.mjs` y verás fallos falsos. Verificación final: `npm run lint && npm run test:scripts && npx next build`.
- Backend: **nunca `npm run lint`** — ese script aplica `eslint --fix` sobre todo el árbol y `main` arrastra 187 errores preexistentes ajenos. Usa `npx eslint <archivos>`. Los tests son `npm test` (Jest).
- Ramas: `redesign/e-avatares` en **los dos** repos, desde `main`. **Sin push a origin.** Cada uno en su worktree, fuera de los checkouts principales, donde viven el dev server de Sergio (`:3000`) y el watcher del backend (`:4000`).
- **No toques `dots-backend/scripts/unlock-path.js`**: es un archivo sin trackear del checkout principal.
- **PROHIBIDO ejecutar `--apply` de cualquier script contra la base de datos.** Los dos scripts de este plan (`seed-avatars.js` y `retire-emoji-cosmetics.js`) se entregan probados y con su dry-run corrido; **el `--apply` lo autoriza y lo lanza Sergio**, nunca un implementador. Un dry-run es de solo lectura y sí se puede correr.
- **Sin migración de esquema.** `shop_items.kind` y `.slot` son `varchar(20)`: `'avatar'` cabe. `shop_items.img` ya existe en la entidad. Si algo pareciera exigir un `ALTER TABLE`, PARA e informa.
- Commits terminan con `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`.
- Regla 1: navegación con `router.push`, nunca `window.location.*`.
- Regla 2 (RN-safe): solo tap/pointer, nada de hover como única señal, animación solo `transform`/`opacity`.
- Regla 3: nada de `setState` síncrono en el cuerpo de un `useEffect`.
- Regla 10: Doty solo se renderiza con `<Doty pose=…>` y poses del registro generado. **Los avatares NO son poses**: viven en `public/images/avatars/` y se pintan con el `<Avatar>` de este plan, no con `<Doty>`.
- Regla 11: cero emoji como iconografía.
- Regla 12: `app/themes.generated.css` y `lib/theme-colors.ts` se generan; no se editan a mano.
- Copy en español neutro con tuteo. Los nombres de los avatares salen de `meta.label` y son los ya aprobados: Clásico, Nerd, Crack, Hype, Buena onda, Techie.
- Módulos puros bajo test (`lib/avatar.ts`): **solo `import type`**. Los tests son `*.test.mjs` junto al módulo e importan `./x.ts` con extensión; `npm run test:scripts` los recoge por glob, **no toques `package.json`**.

---

## Contexto medido del código (leído el 2026-09-16, no re-investigar)

**El arte ya está.** `public/images/avatars/` tiene los seis del set gratis, aplicados hoy: `clasico.png`, `nerd.png`, `crack.png`, `hype.png`, `buena-onda.png`, `techie.png`. Son retratos de cabeza y hombros de 512 px con fondo transparente. Los 19 de pago son la tanda 3 y **no existen todavía** — de ahí la desviación 2 de más abajo.

**Entidades (no se tocan):**

```ts
// src/common/entity/shop_item.entity.ts
export type ShopItemKind = 'streak_shield' | 'xp_boost' | 'cosmetic' | 'gesture';  // ← E añade 'avatar'
@Entity({ schema: 'dots', name: 'shop_items' })
export class ShopItem {
  id: number; key: string /*varchar 60, unique*/; kind: ShopItemKind /*varchar 20*/;
  name: string; description?: string | null; price: number;
  slot?: string | null /*varchar 20*/; meta?: Record<string, unknown> | null /*jsonb*/;
  img?: string | null /*varchar 255*/; enabled: boolean; position: number;
}
// src/common/entity/user_item.entity.ts
export class UserItem { id; userId /*user_id*/; itemId /*item_id*/; equippedSlot?: string | null /*equipped_slot*/; acquiredAt; }
// src/common/entity/gem_ledger.entity.ts
export class GemLedger { id; userId /*user_id*/; delta: number /*+ gana, − gasta*/; reason: string /*varchar 60*/; ref?: string | null; createdAt; }
```

**DTO de economía** (`src/modules/economy/economy.dto.ts`) — `ShopItemDto` e `InventoryItemDto` llevan hoy `id, key, kind, name, (description), price, slot, meta` y **NO llevan `img`**, que es lo que E añade. También están `BuyItemDto { key }` y `EquipItemDto { itemId, equip }`.

**`EconomyService`** (`src/modules/economy/economy.service.ts`) va por SQL crudo sobre `dots.shop_items` y `dots.user_items`. `getShop` filtra `WHERE enabled = true ORDER BY position, id`. `equip(user, {itemId, equip})` desequipa primero a todos los hermanos del mismo slot y luego marca el pedido — o sea que equipar un avatar ya desequipa el anterior sin código nuevo. `gems(userId)` lee `COALESCE(gems,0)` de `dots.users`.

**Caras públicas a tocar:**

```ts
// src/modules/leaderboard/leaderboard.dto.ts
export class LeaderboardEntryDto { rank; id; name; last_name; xp; streak; }        // ← + avatar
// src/modules/me/me.dto.ts
export class RivalNeighborDto { name: string; delta: number; }                      // ← + avatar
// src/modules/path/path-neighbors.service.ts → NeighborDto { id, name, lastName, nodeId, distance }  // ← + avatar
```

`path-neighbors.service.ts` arma sus vecinos en `toDto(ranked, catalog, byId)` a partir de un `Map<number, {id,name,lastName}>` que sale de `usersRepository.find({ select: ['id','name','lastName','expires'] })`.

**`GET /me/settings`** devuelve `UserSettings` de `src/common/user-settings.ts`, que **ya tiene el campo** `avatar_key: string | null` con su comentario "lo escribe `POST /me/avatar` (subproyecto E)". La lógica pura de ese archivo (`normalizeSettings`, `mergeSettings`) **no se toca**; lo que E añade es el objeto `avatar` resuelto en la respuesta del endpoint. Desde el subproyecto D, `patchSettings` escribe con `usersRepository.update(userId, { settings })`, de una sola columna.

**Frontend, lo que hoy pinta iniciales o nada:**

- `components/path/path-peer.tsx` — círculo de 34 px con la inicial del nombre y color de `lib/peer-colors.ts`. E lo cambia por el avatar.
- `components/interactive-column/top-students.tsx` — leaderboard; hoy solo texto, con `displayName()` que recorta a "Sofia G." por privacidad. Esa función **se conserva**.
- `components/quests/rival-banner.tsx` — aviso de rival.
- `app/(app)/(hub)/shop/page.tsx` — tienda. Trae un **filtro temporal de D** que oculta `slot === "hat"` y `slot === "background"`, con un comentario que apunta a §6.2: E lo retira, porque tras la retirada esos ítems quedan `enabled = false` y ya no llegan.
- `components/profile/profile-identity.tsx` — hoy pinta `<Doty pose="feliz" size="perfil">` (78 px móvil / 96 escritorio). E lo cambia por `<Avatar>`.
- `components/profile/settings-sheet.tsx` — hoy **no** lleva fila "Cambiar avatar"; es la desviación 1 que D declaró y que E cierra.

**Servicios del front** (`services/shop.service.ts`): `ShopItem`/`InventoryItem` espejan los DTO del backend y tampoco llevan `img`. `getShopService`, `buyItemService(key)`, `getInventoryService`, `equipItemService(id, equip)`.

**Patrón de script de base de datos**: `dots-backend/scripts/migrate-settings.js` es el modelo a imitar — dry-run por defecto, `--apply` explícito, respaldo en `scripts/out/` y verificación al final. El catálogo de economía se sembró con `scripts/migrate-economy.js`.

---

## Tres desviaciones del spec, decididas y justificadas

Se anotan en el spec en la Task 9. Un implementador **no debe "arreglarlas"**.

1. **El avatar del perfil mide 78 px en móvil y 96 en escritorio, no 128.** El spec se contradice: §5 fija 78/96 (que es lo que D implementó, con el tamaño `perfil` del registro de `doty.tsx`) y §6.1 dice "128 perfil" en su lista de tamaños. Gana §5, porque el 78 se eligió para que identidad y stats quepan sobre el pliegue a 390 px —criterio de aceptación del propio §5, medido: la fila de stats termina a 254 px de 844— y porque un retrato de cabeza y hombros llena mucho más el círculo que el cuerpo entero. El resto de la lista de §6.1 (96 selector y tienda, 48 toasts, 34 leaderboard y vecinos) se respeta tal cual.
2. **Solo se siembran los seis avatares gratis.** Los 19 de pago son la tanda 3 de arte y sus PNG no existen; sembrarlos ahora llenaría la tienda de imágenes rotas. El modelo, el endpoint y la tienda los soportan sin cambios: aparecen solos en cuanto se aplique la tanda 3 y se corra el sembrado con sus filas.
3. **La retirada de gorros y fondos se entrega como script probado, no aplicada.** Toca saldos de gemas en la base de datos compartida de producción; el `--apply` lo lanza Sergio. Mientras no se aplique, esos ítems siguen ocultos por el filtro que D dejó en la tienda — por eso la Task 7 retira ese filtro **y** deja en su lugar el filtro por `enabled`, que es el que vale tras la retirada.

---

## Estructura de archivos

**Backend — crear**
- `scripts/seed-avatars.js` — siembra las seis filas de `shop_items`; dry-run, `--apply`, respaldo.
- `scripts/retire-emoji-cosmetics.js` — retira gorros y fondos con reembolso; dry-run, `--apply`, respaldo, `--rollback`.
- `src/common/avatar.ts` + `src/common/avatar.spec.ts` — lógica pura: resolver el avatar de una fila de `shop_items`, y el fallback a `clasico`.
- `src/modules/me/avatar.dto.ts` — `SetAvatarDto { key }`.

**Backend — modificar**
- `src/common/entity/shop_item.entity.ts` — `ShopItemKind` suma `'avatar'`.
- `src/modules/economy/economy.dto.ts` — `ShopItemDto` e `InventoryItemDto` suman `img`.
- `src/modules/economy/economy.service.ts` — las dos consultas devuelven `img`.
- `src/modules/me/me.service.ts` — `setAvatar`, y `getSettings` resuelve el avatar equipado.
- `src/modules/me/me.controller.ts` — `POST /me/avatar`.
- `src/modules/me/me.module.ts` — repositorios que haga falta inyectar.
- `src/modules/leaderboard/leaderboard.dto.ts` y su servicio — campo `avatar`.
- `src/modules/me/me.dto.ts` y el servicio de rival — campo `avatar`.
- `src/modules/path/path-neighbors.service.ts` — campo `avatar`.

**Webapp — crear**
- `lib/avatar.ts` + `lib/avatar.test.mjs` — lógica pura del marco y del fallback.
- `components/ui/avatar/avatar.tsx` — el componente único.
- `components/profile/avatar-picker.tsx` — hoja de selección de avatar.

**Webapp — modificar**
- `services/shop.service.ts` — `img` en los tipos.
- `services/settings.service.ts` — `avatar` en `UserSettings`.
- `services/settings.service.ts` — `postMyAvatarService`, junto a `patchMySettingsService`.
- `types/path.types.ts` — `PathPeer` suma `avatar`.
- `services/engagement.service.ts` — `LeaderboardEntry` y `RivalNeighbor` suman `avatar`.
- `components/profile/profile-identity.tsx` — `<Avatar>` con lápiz.
- `components/profile/settings-sheet.tsx` — fila "Cambiar avatar".
- `app/(app)/(hub)/profile/page.tsx` — cablea el selector.
- `app/(app)/(hub)/shop/page.tsx` — sección "Avatares", botón "Usar", fuera el filtro temporal.
- `components/path/path-peer.tsx` — avatar en vez de inicial.
- `components/interactive-column/top-students.tsx` — avatar en la fila.
- `components/quests/rival-banner.tsx` — avatar en el aviso.
- `docs/ARQUITECTURA.md` y el spec — documentación.

---

## Geometría y copy fijos (spec §6.1 y §6.3)

| Elemento | Valor |
|---|---|
| Marco | círculo, fondo `color-mix(in srgb, <meta.color> 42%, var(--surface))` |
| Anillo | `var(--accent)`; **3 px** a 128, **2 px** a 34; interpolado en los intermedios |
| Tamaños | 128 (no usado en perfil, ver desviación 1), 96 selector y tienda, 48 toasts, 34 leaderboard y vecinos |
| Perfil | 78 px móvil / 96 px escritorio (desviación 1) |
| Sin avatar equipado | el cliente muestra `clasico` |
| Sección de tienda | "Avatares" |
| Botón de equipar en la tienda | "Usar" |
| Estado comprado | "Lo tienes" |
| Reembolso | `gem_ledger.reason = 'refund'` |

**Los seis avatares gratis**, con el color de disco que viaja en `meta.color`:

| key | label | color | position |
|---|---|---|---|
| `clasico` | Clásico | `#FF1F8F` | 10 |
| `nerd` | Nerd | `#35D8F5` | 11 |
| `crack` | Crack | `#3768FF` | 12 |
| `hype` | Hype | `#FFB020` | 13 |
| `buena-onda` | Buena onda | `#22C55E` | 14 |
| `techie` | Techie | `#9982D9` | 15 |

Todos con `kind='avatar'`, `slot='avatar'`, `price=0`, `enabled=true`, `img='/images/avatars/<key>.png'` y `description=null`.

---

### Task 1: Backend — el modelo de avatar y su lógica pura

**Files:**
- Modify: `src/common/entity/shop_item.entity.ts`
- Modify: `src/modules/economy/economy.dto.ts`
- Modify: `src/modules/economy/economy.service.ts`
- Create: `src/common/avatar.ts`, `src/common/avatar.spec.ts`

**Interfaces:**
- Consumes: las entidades y DTO descritos en el contexto.
- Produces (lo consumen las Tasks 2, 3 y 4): de `src/common/avatar.ts`, `type PublicAvatar = { img: string; color: string }`, `DEFAULT_AVATAR_KEY = 'clasico'`, `avatarFromRow(row): PublicAvatar | null` y `publicAvatar(row): PublicAvatar`. En los DTO, `ShopItemDto.img: string | null` e `InventoryItemDto.img: string | null`.

- [ ] **Step 1: Escribir los tests de `src/common/avatar.spec.ts`**

```ts
import { avatarFromRow, publicAvatar, DEFAULT_AVATAR_KEY } from './avatar';

describe('avatarFromRow', () => {
  it('saca img y color de una fila de shop_items', () => {
    expect(
      avatarFromRow({ img: '/images/avatars/nerd.png', meta: { color: '#35D8F5', label: 'Nerd' } }),
    ).toEqual({ img: '/images/avatars/nerd.png', color: '#35D8F5' });
  });

  it('devuelve null si la fila no tiene imagen', () => {
    expect(avatarFromRow({ img: null, meta: { color: '#35D8F5' } })).toBeNull();
    expect(avatarFromRow(null)).toBeNull();
    expect(avatarFromRow(undefined)).toBeNull();
  });

  it('cae al rosa de marca si meta no trae un color usable', () => {
    // El color pinta el disco del marco; sin él el avatar se vería sobre nada.
    expect(avatarFromRow({ img: '/images/avatars/x.png', meta: null })).toEqual({
      img: '/images/avatars/x.png',
      color: '#FF1F8F',
    });
    expect(avatarFromRow({ img: '/images/avatars/x.png', meta: { color: 42 } })).toEqual({
      img: '/images/avatars/x.png',
      color: '#FF1F8F',
    });
  });
});

describe('publicAvatar', () => {
  it('devuelve el avatar de la fila cuando la hay', () => {
    expect(publicAvatar({ img: '/images/avatars/crack.png', meta: { color: '#3768FF' } })).toEqual({
      img: '/images/avatars/crack.png',
      color: '#3768FF',
    });
  });

  it('cae al clasico cuando no hay fila, para que nadie salga sin cara', () => {
    expect(publicAvatar(null)).toEqual({
      img: `/images/avatars/${DEFAULT_AVATAR_KEY}.png`,
      color: '#FF1F8F',
    });
  });

  it('DEFAULT_AVATAR_KEY es clasico', () => {
    expect(DEFAULT_AVATAR_KEY).toBe('clasico');
  });
});
```

- [ ] **Step 2: Correr los tests para verlos fallar**

```bash
source ~/.nvm/nvm.sh && nvm use && npx jest src/common/avatar.spec.ts
```

Esperado: FAIL, `Cannot find module './avatar'`.

- [ ] **Step 3: Escribir `src/common/avatar.ts`**

```ts
/**
 * Avatar público del usuario (subproyecto E). Lógica pura, sin BD, para que el
 * fallback y la lectura de `meta` se prueben solos. El contrato viaja a la
 * webapp en tres sitios — leaderboard, vecinos del Camino y aviso de rival —
 * más `GET /me/settings`.
 */
export type PublicAvatar = {
  /** Ruta servida por la webapp, p. ej. "/images/avatars/nerd.png". */
  img: string;
  /** Color del disco del marco (spec §6.1). */
  color: string;
};

/** Sin avatar equipado, el cliente muestra este (spec §6.1). */
export const DEFAULT_AVATAR_KEY = 'clasico';

/** Rosa de marca: el disco necesita un color aunque `meta` venga vacío. */
const FALLBACK_COLOR = '#FF1F8F';

type AvatarRow = { img?: string | null; meta?: unknown } | null | undefined;

/** El avatar de una fila de `shop_items`, o null si esa fila no sirve. */
export function avatarFromRow(row: AvatarRow): PublicAvatar | null {
  const img = row?.img;
  if (typeof img !== 'string' || img.length === 0) return null;
  const meta = (row?.meta ?? {}) as Record<string, unknown>;
  const color = typeof meta.color === 'string' ? meta.color : FALLBACK_COLOR;
  return { img, color };
}

/** Igual que `avatarFromRow` pero nunca devuelve null: cae al clásico. */
export function publicAvatar(row: AvatarRow): PublicAvatar {
  return (
    avatarFromRow(row) ?? {
      img: `/images/avatars/${DEFAULT_AVATAR_KEY}.png`,
      color: FALLBACK_COLOR,
    }
  );
}
```

- [ ] **Step 4: Correr los tests para verlos pasar**

```bash
source ~/.nvm/nvm.sh && nvm use && npx jest src/common/avatar.spec.ts
```

Esperado: PASS, 7 tests.

- [ ] **Step 5: Añadir `'avatar'` al tipo de `kind`**

En `src/common/entity/shop_item.entity.ts`, la unión `ShopItemKind` pasa a incluir `'avatar'`:

```ts
export type ShopItemKind =
  | 'streak_shield'
  | 'xp_boost'
  | 'cosmetic'
  | 'gesture'
  | 'avatar';
```

La columna es `varchar(20)`, así que **no hace falta ninguna migración**: el valor cabe y la base de datos no valida la unión.

- [ ] **Step 6: Exponer `img` en los DTO de economía**

En `src/modules/economy/economy.dto.ts`, añade `img: string | null;` a `ShopItemDto` (junto a `meta`) y a `InventoryItemDto` (junto a `meta`). Comenta en una línea por qué: la tienda y el inventario necesitan la imagen para pintar el avatar, y hasta E la columna existía pero no viajaba.

- [ ] **Step 7: Devolver `img` desde el servicio**

En `src/modules/economy/economy.service.ts`, la consulta de `getShop` selecciona hoy `id, key, kind, name, description, price, slot, meta` y la del inventario su equivalente. Añade `img` a **las dos** consultas y mapéalo en los dos `return` con la misma forma que `meta`:

```ts
        img: (it.img as string) ?? null,
```

Busca ambos sitios; el del inventario mapea desde la fila `r` en vez de `it`.

- [ ] **Step 8: Verificar tipos, lint y la suite completa**

```bash
source ~/.nvm/nvm.sh && nvm use && npx tsc --noEmit -p tsconfig.json && npx eslint src/common/avatar.ts src/common/avatar.spec.ts src/common/entity/shop_item.entity.ts src/modules/economy/economy.dto.ts src/modules/economy/economy.service.ts && npm test
```

Esperado: sin errores nuevos de tipos (queda uno preexistente en `src/modules/path/path-neighbors.service.spec.ts`, ajeno a esta tarea), lint limpio y la suite en verde. Anota el total de tests.

- [ ] **Step 9: Commit**

```bash
git add src/common/avatar.ts src/common/avatar.spec.ts src/common/entity/shop_item.entity.ts src/modules/economy/economy.dto.ts src/modules/economy/economy.service.ts
git commit -m "feat(avatares): el modelo admite kind avatar y la tienda expone img

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 2: Backend — `POST /me/avatar` y el avatar en `/me/settings`

**Files:**
- Create: `src/modules/me/avatar.dto.ts`
- Modify: `src/modules/me/me.service.ts`, `src/modules/me/me.controller.ts`, `src/modules/me/me.module.ts`
- Modify: `src/modules/me/me.service.spec.ts`

**Interfaces:**
- Consumes de Task 1: `publicAvatar(row)`, `avatarFromRow(row)`, `type PublicAvatar`, `DEFAULT_AVATAR_KEY`.
- Produces (lo consume la webapp en las Tasks 6 y 7): `POST /me/avatar` con cuerpo `{ key: string }`, que responde `PublicAvatar`; y `GET /me/settings` que suma `avatar: PublicAvatar` a lo que ya devolvía.

- [ ] **Step 1: Crear el DTO de entrada**

`src/modules/me/avatar.dto.ts`:

```ts
import { IsString, MaxLength, MinLength } from 'class-validator';

/** Cuerpo de POST /me/avatar. `key` es la de shop_items (varchar 60). */
export class SetAvatarDto {
  @IsString()
  @MinLength(1)
  @MaxLength(60)
  key: string;
}
```

- [ ] **Step 2: Escribir los tests, en `src/modules/me/me.service.spec.ts`**

Añade al final del archivo, sin tocar los `describe` que ya existen. El helper `makeService` del archivo construye `MeService` con tres repositorios falsos; esta tarea necesita además que el repositorio de usuarios sirva consultas de `shop_items`/`user_items` por `manager.query`, así que el bloque trae su propio helper:

```ts
describe('MeService.setAvatar', () => {
  type Row = Record<string, unknown>;

  /** Repositorio falso cuyo manager.query responde por el SQL que recibe. */
  function makeAvatarService(opts: {
    item?: Row | null;
    owned?: boolean;
  }) {
    const item = opts.item === undefined ? { id: 7, key: 'nerd', kind: 'avatar', price: 0, img: '/images/avatars/nerd.png', meta: { color: '#35D8F5' } } : opts.item;
    const query = jest.fn().mockImplementation((sql: string) => {
      if (sql.includes('FROM dots.shop_items')) return Promise.resolve(item ? [item] : []);
      if (sql.includes('FROM dots.user_items')) return Promise.resolve(opts.owned ? [{ id: 1 }] : []);
      return Promise.resolve([]);
    });
    const usersRepository = {
      findOne: jest.fn().mockResolvedValue({ id: 1, settings: {} }),
      save: jest.fn(),
      update: jest.fn().mockResolvedValue(undefined),
      manager: { query, transaction: (fn: (tx: unknown) => unknown) => fn({ query }) },
    };
    const service = new MeService(
      usersRepository as never,
      { find: jest.fn().mockResolvedValue([]) } as never,
      { find: jest.fn().mockResolvedValue([]) } as never,
    );
    return { service, query, usersRepository };
  }

  it('equipa un avatar gratis que el usuario no tenía y lo devuelve', async () => {
    const { service, query } = makeAvatarService({ owned: false });
    const out = await service.setAvatar(1, { key: 'nerd' });
    expect(out).toEqual({ img: '/images/avatars/nerd.png', color: '#35D8F5' });
    // lo concede...
    expect(query.mock.calls.some(([sql]) => String(sql).includes('INSERT INTO dots.user_items'))).toBe(true);
    // ...y lo equipa
    expect(query.mock.calls.some(([sql]) => String(sql).includes('equipped_slot'))).toBe(true);
  });

  it('equipa un avatar de pago que el usuario YA posee, sin concederlo otra vez', async () => {
    const { service, query } = makeAvatarService({
      item: { id: 9, key: 'campeon', kind: 'avatar', price: 800, img: '/images/avatars/campeon.png', meta: { color: '#FFB020' } },
      owned: true,
    });
    const out = await service.setAvatar(1, { key: 'campeon' });
    expect(out.img).toBe('/images/avatars/campeon.png');
    expect(query.mock.calls.some(([sql]) => String(sql).includes('INSERT INTO dots.user_items'))).toBe(false);
  });

  it('rechaza un avatar de pago que el usuario no posee: se compra por /shop/buy', async () => {
    const { service } = makeAvatarService({
      item: { id: 9, key: 'campeon', kind: 'avatar', price: 800, img: '/images/avatars/campeon.png', meta: {} },
      owned: false,
    });
    await expect(service.setAvatar(1, { key: 'campeon' })).rejects.toMatchObject({ status: 403 });
  });

  it('rechaza una key que no es de un avatar', async () => {
    const { service } = makeAvatarService({
      item: { id: 3, key: 'hat_party', kind: 'cosmetic', price: 300, img: null, meta: {} },
    });
    await expect(service.setAvatar(1, { key: 'hat_party' })).rejects.toMatchObject({ status: 400 });
  });

  it('404 si la key no existe', async () => {
    const { service } = makeAvatarService({ item: null });
    await expect(service.setAvatar(1, { key: 'no-existe' })).rejects.toMatchObject({ status: 404 });
  });

  it('guarda la key en settings.avatar_key para que /me/settings la resuelva', async () => {
    const { service, usersRepository } = makeAvatarService({ owned: false });
    await service.setAvatar(1, { key: 'nerd' });
    expect(usersRepository.update).toHaveBeenCalledWith(1, {
      settings: expect.objectContaining({ avatar_key: 'nerd' }),
    });
  });
});
```

**Antes de escribirlo**, abre `me.service.ts` y comprueba el orden real de los parámetros del constructor; el bloque asume `usersRepository` primero, como el helper que ya existe en el archivo.

- [ ] **Step 3: Correr los tests para verlos fallar**

```bash
source ~/.nvm/nvm.sh && nvm use && npx jest src/modules/me/me.service.spec.ts
```

Esperado: FAIL, `service.setAvatar is not a function`.

- [ ] **Step 4: Implementar `setAvatar` en `src/modules/me/me.service.ts`**

Añade el import de la Task 1 y el método. Va en una transacción porque conceder y equipar tienen que pasar juntos o no pasar:

```ts
  // ── Avatar (subproyecto E) ───────────────────────────────────────────────
  /**
   * Concede el avatar si hace falta y lo equipa, en una transacción. Gratis se
   * concede al vuelo; de pago exige poseerlo ya, porque la compra va por
   * /shop/buy. Guarda la key en settings.avatar_key para que GET /me/settings
   * la resuelva sin volver a consultar user_items.
   */
  async setAvatar(userId: number, body: { key: string }): Promise<PublicAvatar> {
    const user = await this.usersRepository.findOne({ where: { id: userId } });
    if (!user) throw new HttpException('User not found', 404);

    return this.usersRepository.manager.transaction(async (tx) => {
      const [item]: Array<{
        id: number; key: string; kind: string; price: number;
        img: string | null; meta: Record<string, unknown> | null;
      }> = await tx.query(
        `SELECT id, key, kind, price, img, meta FROM dots.shop_items WHERE key = $1 AND enabled = true`,
        [body.key],
      );
      if (!item) throw new HttpException('Avatar no encontrado', 404);
      if (item.kind !== 'avatar') throw new HttpException('Ese artículo no es un avatar', 400);

      const owned: Array<{ id: number }> = await tx.query(
        `SELECT id FROM dots.user_items WHERE user_id = $1 AND item_id = $2`,
        [userId, item.id],
      );
      if (owned.length === 0) {
        if (item.price > 0) {
          throw new HttpException('Compra el avatar antes de usarlo', 403);
        }
        await tx.query(
          `INSERT INTO dots.user_items (user_id, item_id) VALUES ($1, $2)`,
          [userId, item.id],
        );
      }

      // Un solo avatar equipado a la vez.
      await tx.query(
        `UPDATE dots.user_items SET equipped_slot = NULL
          WHERE user_id = $1 AND item_id IN (SELECT id FROM dots.shop_items WHERE slot = 'avatar')`,
        [userId],
      );
      await tx.query(
        `UPDATE dots.user_items SET equipped_slot = 'avatar' WHERE user_id = $1 AND item_id = $2`,
        [userId, item.id],
      );

      const current = normalizeSettings(user.settings);
      await this.usersRepository.update(userId, {
        settings: { ...current, avatar_key: item.key } as never,
      });

      return publicAvatar(item);
    });
  }
```

El `as never` del `update` es el mismo escape que D dejó documentado en `patchSettings`: TypeORM tipa mal una columna jsonb cuyo valor tiene propiedades nullable.

- [ ] **Step 5: Que `getSettings` resuelva el avatar**

`GET /me/settings` debe devolver, además de lo de siempre, un campo `avatar` con el equipado — o el clásico si no hay ninguno. Amplía `getSettings` para que, tras normalizar los ajustes, consulte la fila del avatar equipado y la pase por `publicAvatar`:

```ts
    const [row]: Array<{ img: string | null; meta: Record<string, unknown> | null }> =
      await this.usersRepository.manager.query(
        `SELECT si.img, si.meta FROM dots.user_items ui
           JOIN dots.shop_items si ON si.id = ui.item_id
          WHERE ui.user_id = $1 AND ui.equipped_slot = 'avatar'
          LIMIT 1`,
        [userId],
      );
```

y devuelve `{ ...settings, avatar: publicAvatar(row) }`. Ajusta el tipo de retorno a `UserSettings & { avatar: PublicAvatar }` y documenta en una línea que `avatar` es derivado y no se guarda en la columna.

- [ ] **Step 6: Exponer el endpoint**

En `src/modules/me/me.controller.ts`, añade la ruta siguiendo el estilo de las que ya hay (mismo guard de autenticación, mismo modo de sacar el usuario de la petición):

```ts
  @Post('avatar')
  setAvatar(@Req() req: RequestWithUser, @Body() body: SetAvatarDto) {
    return this.meService.setAvatar(req.user.id, body);
  }
```

Copia el nombre exacto del tipo de la petición y del decorador de usuario de los métodos vecinos del propio archivo; **no inventes uno**. Si el módulo necesita algún import nuevo (`Post`, `Body`), añádelo.

- [ ] **Step 7: Correr los tests para verlos pasar**

```bash
source ~/.nvm/nvm.sh && nvm use && npx jest src/modules/me/me.service.spec.ts && npm test
```

Esperado: los seis tests nuevos en verde y la suite completa sin regresiones.

- [ ] **Step 8: Lint y tipos**

```bash
npx eslint src/modules/me/me.service.ts src/modules/me/me.controller.ts src/modules/me/avatar.dto.ts src/modules/me/me.service.spec.ts && npx tsc --noEmit -p tsconfig.json
```

- [ ] **Step 9: Commit**

```bash
git add src/modules/me/
git commit -m "feat(avatares): POST /me/avatar concede y equipa en transacción, y /me/settings devuelve el equipado

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 3: Backend — el avatar en las tres caras públicas

**Files:**
- Modify: `src/modules/leaderboard/leaderboard.dto.ts` y su servicio
- Modify: `src/modules/me/me.dto.ts` y el servicio que arma el rival
- Modify: `src/modules/path/path-neighbors.service.ts`
- Modify: los `.spec.ts` correspondientes

**Interfaces:**
- Consumes de Task 1: `publicAvatar(row)`, `type PublicAvatar`.
- Produces (lo consumen las Tasks 8): `LeaderboardEntryDto.avatar: PublicAvatar`, `RivalNeighborDto.avatar: PublicAvatar` y el `NeighborDto` de `/path/neighbors` con `avatar: PublicAvatar`. **Los tres devuelven siempre un objeto, nunca null**: el fallback al clásico lo resuelve el backend para que el cliente no tenga que decidir.

- [ ] **Step 1: Escribir un test por cara pública**

Añade a los spec existentes de cada módulo un test con esta forma, adaptando el nombre del servicio y su constructor a lo que el archivo ya use:

```ts
  it('cada fila trae el avatar equipado, y el clasico si no hay ninguno', async () => {
    // … monta el servicio con dos usuarios: uno con avatar equipado y otro sin él
    const out = await service.<método>(…);
    expect(out[0].avatar).toEqual({ img: '/images/avatars/nerd.png', color: '#35D8F5' });
    expect(out[1].avatar).toEqual({ img: '/images/avatars/clasico.png', color: '#FF1F8F' });
  });
```

En cada módulo, **lee antes cómo monta el spec sus dobles** y sigue ese patrón; no introduzcas un estilo nuevo de mock.

- [ ] **Step 2: Correr los tests para verlos fallar**

```bash
source ~/.nvm/nvm.sh && nvm use && npm test
```

Esperado: FAIL en los tres tests nuevos, por `avatar` indefinido.

- [ ] **Step 3: Añadir el campo a los tres DTO**

`LeaderboardEntryDto` y `RivalNeighborDto` suman `avatar: PublicAvatar;`. El `NeighborDto` de los vecinos del Camino, igual. Importa el tipo de `src/common/avatar`.

- [ ] **Step 4: Resolver el avatar en las tres consultas**

El patrón es el mismo en los tres: una consulta que, dada una lista de ids de usuario, devuelve el avatar equipado de cada uno. Añade este helper donde lo necesite cada servicio (o compártelo si dos servicios del mismo módulo lo usan):

```ts
  /** avatar equipado por usuario, para un lote de ids. */
  private async avatarsByUser(ids: number[]): Promise<Map<number, PublicAvatar>> {
    if (ids.length === 0) return new Map();
    const rows: Array<{ user_id: number; img: string | null; meta: Record<string, unknown> | null }> =
      await this.<repositorio>.manager.query(
        `SELECT ui.user_id, si.img, si.meta FROM dots.user_items ui
           JOIN dots.shop_items si ON si.id = ui.item_id
          WHERE ui.equipped_slot = 'avatar' AND ui.user_id = ANY($1::int[])`,
        [ids],
      );
    return new Map(rows.map((r) => [Number(r.user_id), publicAvatar(r)]));
  }
```

Y en cada mapeo a DTO, `avatar: avatares.get(id) ?? publicAvatar(null)`.

**Una sola consulta por lote, nunca una por fila**: el leaderboard devuelve decenas de filas y una consulta por cada una sería N+1.

- [ ] **Step 5: Correr los tests para verlos pasar**

```bash
source ~/.nvm/nvm.sh && nvm use && npm test
```

Esperado: la suite completa en verde. Anota el total.

- [ ] **Step 6: Lint y tipos**

```bash
npx eslint src/modules/leaderboard/ src/modules/me/ src/modules/path/ && npx tsc --noEmit -p tsconfig.json
```

- [ ] **Step 7: Commit**

```bash
git add src/modules/leaderboard/ src/modules/me/ src/modules/path/
git commit -m "feat(avatares): leaderboard, vecinos del Camino y aviso de rival devuelven el avatar equipado

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 4: Backend — los dos scripts de base de datos

**Files:**
- Create: `scripts/seed-avatars.js`
- Create: `scripts/retire-emoji-cosmetics.js`

**Interfaces:**
- Consumes: nada de las tareas anteriores; son scripts sueltos.
- Produces: nada que consuma código. Los ejecuta Sergio.

**El patrón a imitar es `scripts/migrate-settings.js`**: léelo entero antes de escribir. Dry-run por defecto, `--apply` explícito, respaldo en `scripts/out/` y verificación al final. Toma de él la forma de conectar y de leer el `.env`.

- [ ] **Step 1: Escribir `scripts/seed-avatars.js`**

Siembra las seis filas del set gratis. Requisitos:

- Por defecto **dry-run**: imprime, por cada key, si falta, si ya existe idéntica o si existe con datos distintos, y no escribe nada.
- Con `--apply`: hace `INSERT ... ON CONFLICT (key) DO UPDATE` de `name, price, slot, kind, meta, img, enabled, position`, dentro de una transacción.
- Antes de escribir, vuelca a `scripts/out/backup-avatars-<timestamp>.json` las filas de `shop_items` cuyas keys coincidan, para poder deshacer.
- Al terminar con `--apply`, verifica releyendo las seis filas y avisa si alguna no cuadra.
- Los datos son exactamente los de la tabla "Los seis avatares gratis" de este plan: key, label en `meta.label`, color en `meta.color`, `kind='avatar'`, `slot='avatar'`, `price=0`, `enabled=true`, `img='/images/avatars/<key>.png'`, `description=null` y las posiciones 10 a 15.

- [ ] **Step 2: Escribir `scripts/retire-emoji-cosmetics.js`**

Retira gorros y fondos devolviendo las gemas (spec §6.2). Requisitos:

- Alcance exacto: `shop_items` con `kind = 'cosmetic'` **y** `slot IN ('hat','background')`. **Los `gesture` se conservan** — si el script los tocara, sería un defecto.
- Por defecto **dry-run**: imprime cuántos ítems entran, cuántas filas de `user_items` se desequiparían, cuántos usuarios recibirían reembolso y **cuántas gemas suma el reembolso**, sin escribir nada.
- Con `--apply`, en una transacción: marca esos `shop_items` con `enabled = false`; pone `equipped_slot = NULL` en sus `user_items`; y por cada fila de `user_items` de esos ítems inserta en `gem_ledger` un `delta` igual al `price` del ítem con `reason = 'refund'` y `ref` = la key del ítem. Suma el reembolso al saldo del usuario por el mismo camino que ya use el backend para las gemas.
- **Idempotencia**: correrlo dos veces no debe reembolsar dos veces. Antes de insertar, comprueba si ya existe una fila de `gem_ledger` con ese `user_id`, ese `ref` y `reason='refund'`.
- Respaldo antes de escribir en `scripts/out/backup-retire-<timestamp>.json`, con las filas de `shop_items` y de `user_items` afectadas y el saldo previo de cada usuario tocado.
- `--rollback <archivo>`: lee un respaldo y deshace — reactiva los ítems, restaura `equipped_slot` y anota en `gem_ledger` el contra-asiento con `reason = 'refund-rollback'`.

- [ ] **Step 3: Correr los dos dry-runs**

Son de solo lectura. Necesitan las variables del `.env` del checkout principal; tómalas sin copiar el archivo ni imprimir su contenido:

```bash
source ~/.nvm/nvm.sh && nvm use && set -a; . /home/endurance/Projects/Endurance/dots/dots-backend/.env; set +a; node scripts/seed-avatars.js
```

```bash
source ~/.nvm/nvm.sh && nvm use && set -a; . /home/endurance/Projects/Endurance/dots/dots-backend/.env; set +a; node scripts/retire-emoji-cosmetics.js
```

Pega las dos salidas literales en tu informe. **Nunca pases `--apply`**: eso lo autoriza y lo lanza Sergio.

- [ ] **Step 4: Lint**

```bash
npx eslint scripts/seed-avatars.js scripts/retire-emoji-cosmetics.js
```

Si el `eslint.config` del repo no cubre `scripts/`, dilo en el informe y sigue: los scripts del repo no están todos cubiertos.

- [ ] **Step 5: Commit**

```bash
git add scripts/seed-avatars.js scripts/retire-emoji-cosmetics.js
git commit -m "feat(avatares): scripts de sembrado y de retiro de gorros y fondos, con dry-run y respaldo

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 5: Webapp — la lógica pura del marco y el componente `<Avatar>`

**Files:**
- Create: `lib/avatar.ts`, `lib/avatar.test.mjs`
- Create: `components/ui/avatar/avatar.tsx`
- Modify: `services/shop.service.ts`, `services/settings.service.ts`, `types/path.types.ts`, `services/engagement.service.ts`

**Interfaces:**
- Consumes: nada de las tareas del backend en tiempo de compilación; solo espeja sus tipos.
- Produces (lo consumen las Tasks 6, 7 y 8): de `lib/avatar.ts`, `type PublicAvatar = { img: string; color: string }`, `DEFAULT_AVATAR`, `avatarOrDefault(a)`, `discBackground(color)`, `ringWidth(size)`; de `components/ui/avatar/avatar.tsx`, el default export `Avatar` con props `{ avatar: PublicAvatar | null | undefined; size: number; alt?: string; className?: string }`.

- [ ] **Step 1: Escribir los tests de `lib/avatar.test.mjs`**

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_AVATAR, avatarOrDefault, discBackground, ringWidth } from "./avatar.ts";

test("DEFAULT_AVATAR es el clasico en rosa de marca", () => {
  assert.deepEqual(DEFAULT_AVATAR, { img: "/images/avatars/clasico.png", color: "#FF1F8F" });
});

test("avatarOrDefault deja pasar un avatar válido", () => {
  const a = { img: "/images/avatars/nerd.png", color: "#35D8F5" };
  assert.deepEqual(avatarOrDefault(a), a);
});

test("avatarOrDefault cae al clasico con null, undefined o basura", () => {
  assert.deepEqual(avatarOrDefault(null), DEFAULT_AVATAR);
  assert.deepEqual(avatarOrDefault(undefined), DEFAULT_AVATAR);
  assert.deepEqual(avatarOrDefault({ img: "", color: "#fff" }), DEFAULT_AVATAR);
  assert.deepEqual(avatarOrDefault({ color: "#fff" }), DEFAULT_AVATAR);
});

test("discBackground mezcla el color del avatar al 42 % sobre la superficie", () => {
  // spec §6.1: el disco es color-mix(meta.color 42 %, surface)
  assert.equal(discBackground("#35D8F5"), "color-mix(in srgb, #35D8F5 42%, var(--surface))");
});

test("ringWidth da 3 px a 128 y 2 px a 34, que son los dos anclajes del spec", () => {
  assert.equal(ringWidth(128), 3);
  assert.equal(ringWidth(34), 2);
});

test("ringWidth interpola entre los dos anclajes y no se sale de ellos", () => {
  const w96 = ringWidth(96);
  assert.ok(w96 > 2 && w96 <= 3, `esperaba entre 2 y 3, dio ${w96}`);
  assert.equal(ringWidth(200), 3);
  assert.equal(ringWidth(16), 2);
});
```

- [ ] **Step 2: Correr los tests para verlos fallar**

```bash
source ~/.nvm/nvm.sh && nvm use && node --test lib/avatar.test.mjs
```

Esperado: FAIL, `Cannot find module …/lib/avatar.ts`.

- [ ] **Step 3: Escribir `lib/avatar.ts`**

```ts
/**
 * Marco del avatar (spec §6.1, variante A): círculo con el color propio del
 * avatar al 42 % sobre la superficie y un anillo del acento del tema.
 *
 * Lógica pura para poder probarse con `node --test`: por eso SOLO admite
 * `import type` — Node ejecuta este archivo sin bundler y no resolvería `@/`.
 */
export type PublicAvatar = {
  img: string;
  color: string;
};

/** Sin avatar equipado se muestra el clásico (spec §6.1). */
export const DEFAULT_AVATAR: PublicAvatar = {
  img: "/images/avatars/clasico.png",
  color: "#FF1F8F",
};

/** Sanea lo que llegue del servidor: cualquier cosa sin imagen cae al clásico. */
export function avatarOrDefault(a: Partial<PublicAvatar> | null | undefined): PublicAvatar {
  if (!a || typeof a.img !== "string" || a.img.length === 0) return DEFAULT_AVATAR;
  const color = typeof a.color === "string" && a.color.length > 0 ? a.color : DEFAULT_AVATAR.color;
  return { img: a.img, color };
}

export function discBackground(color: string): string {
  return `color-mix(in srgb, ${color} 42%, var(--surface))`;
}

/**
 * Grosor del anillo. El spec fija dos anclajes —3 px a 128 y 2 px a 34— y el
 * resto se interpola, para que el marco no se vea desproporcionado en los
 * tamaños intermedios (96 del selector, 48 de los toasts).
 */
export function ringWidth(size: number): number {
  const t = (size - 34) / (128 - 34);
  const w = 2 + t * (3 - 2);
  return Math.min(3, Math.max(2, Math.round(w * 10) / 10));
}
```

- [ ] **Step 4: Correr los tests para verlos pasar**

```bash
source ~/.nvm/nvm.sh && nvm use && node --test lib/avatar.test.mjs
```

Esperado: PASS, 6 tests.

- [ ] **Step 5: Escribir `components/ui/avatar/avatar.tsx`**

```tsx
"use client";

import Image from "next/image";

import { avatarOrDefault, discBackground, ringWidth, type PublicAvatar } from "@/lib/avatar";

/**
 * La cara pública del usuario (spec §6.1). Único sitio donde vive la geometría
 * del marco: perfil, selector, tienda, leaderboard, vecinos del Camino y avisos
 * de rival lo usan todos con el mismo componente y solo cambian `size`.
 *
 * NO es un `<Doty>`: los avatares viven en public/images/avatars/ y están fuera
 * del registro de poses (regla 10).
 */
interface Props {
  avatar: PublicAvatar | null | undefined;
  /** Diámetro en px. Los del spec: 96 selector y tienda, 48 toasts, 34 leaderboard y vecinos. */
  size: number;
  alt?: string;
  className?: string;
}

export default function Avatar({ avatar, size, alt = "", className }: Props) {
  const a = avatarOrDefault(avatar);
  const ring = ringWidth(size);
  return (
    <span
      className={`relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full ${className ?? ""}`}
      style={{
        width: size,
        height: size,
        background: discBackground(a.color),
        border: `${ring}px solid var(--accent)`,
      }}
    >
      <Image
        src={a.img}
        alt={alt}
        width={size}
        height={size}
        // El retrato ya viene recortado a cabeza y hombros con margen: se pinta
        // completo dentro del disco, sin recorte extra.
        style={{ objectFit: "contain" }}
      />
    </span>
  );
}
```

`alt` va vacío por defecto porque en leaderboard y vecinos el nombre viaja **siempre** al lado como texto visible, así que el retrato es decorativo. Donde el avatar sea la única identificación, quien lo use pasa un `alt`.

- [ ] **Step 6: Espejar los tipos del backend en los servicios**

Cuatro cambios pequeños, todos de tipos:

1. `services/shop.service.ts`: `ShopItem` e `InventoryItem` suman `img: string | null;`.
2. `services/settings.service.ts`: `UserSettings` suma `avatar: PublicAvatar;` (importa el tipo de `@/lib/avatar`).
3. `types/path.types.ts`: `PathPeer` suma `avatar: PublicAvatar;`.
4. `services/engagement.service.ts`: `LeaderboardEntry` y `RivalNeighbor` suman `avatar: PublicAvatar;`.

- [ ] **Step 7: Verificar tipos, lint y tests**

```bash
source ~/.nvm/nvm.sh && nvm use && npx tsc --noEmit && npx eslint lib/avatar.ts components/ui/avatar/avatar.tsx && npm run test:scripts
```

Esperado: sin errores y todos los tests en verde. Anota el total.

- [ ] **Step 8: Commit**

```bash
git add lib/avatar.ts lib/avatar.test.mjs components/ui/avatar/ services/ types/path.types.ts
git commit -m "feat(avatares): componente Avatar con el marco del spec y la lógica pura bajo test

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 6: Webapp — el avatar en el perfil y su selector

**Files:**
- Create: `components/profile/avatar-picker.tsx`
- Modify: `components/profile/profile-identity.tsx`, `components/profile/settings-sheet.tsx`, `app/(app)/(hub)/profile/page.tsx`
- Modify: el servicio donde vivan los fetchers de `/me` (crea `postMyAvatarService` junto a `patchMySettingsService` en `services/settings.service.ts`)

**Interfaces:**
- Consumes de Task 5: `Avatar`, `type PublicAvatar`, `avatarOrDefault`.
- Produces (lo consume la Task 9): la pantalla de perfil con avatar y selector funcionando.

- [ ] **Step 1: Añadir el fetcher**

En `services/settings.service.ts`, junto a `patchMySettingsService`:

```ts
/** Concede si hace falta y equipa el avatar. Propaga el error (403 si es de pago y no lo tienes). */
export async function postMyAvatarService(key: string): Promise<PublicAvatar> {
  const { data } = await api.post<PublicAvatar>("/me/avatar", { key });
  return data;
}
```

- [ ] **Step 2: Crear `components/profile/avatar-picker.tsx`**

Una hoja con la misma forma que la de ajustes (inferior en móvil, lateral en escritorio) que lista los avatares disponibles a 96 px y deja elegir uno.

```tsx
"use client";

import { useEffect, useRef } from "react";

import Avatar from "@/components/ui/avatar/avatar";
import { Icon } from "@/components/ui/icon";
import type { PublicAvatar } from "@/lib/avatar";
import type { ShopItem } from "@/services/shop.service";

/**
 * Selector de avatar (spec §6.1). Lista los que el usuario puede usar ya: los
 * gratis y los que haya comprado. Los de pago que no tiene se compran en la
 * tienda, no aquí — por eso esta hoja no habla de gemas.
 */
interface Props {
  open: boolean;
  onClose: () => void;
  /** Avatares equipables: gratis o ya comprados. */
  items: ShopItem[];
  /** Key del que lleva puesto, para marcarlo. */
  currentKey: string | null;
  onPick: (key: string) => void;
}

export default function AvatarPicker({ open, onClose, items, currentKey, onPick }: Props) {
  const panelRef = useRef<HTMLDivElement>(null);

  // Va en su propio efecto con [open] como única dependencia: si dependiera de
  // onClose, que llega nueva en cada render de la página, le robaría el foco al
  // usuario en cada repintado en vez de moverlo una sola vez al abrir.
  useEffect(() => {
    if (!open) return;
    panelRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center md:items-stretch md:justify-end">
      <div aria-hidden onClick={onClose} className="absolute inset-0" style={{ background: "var(--scrim)" }} />
      <div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label="Elegir avatar"
        className="relative z-10 flex max-h-[85vh] w-full flex-col overflow-y-auto rounded-t-3xl bg-(--surface) px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-4 [animation:dots-slide-up_.25s_ease-out_both] md:max-h-none md:w-[380px] md:rounded-none md:rounded-l-3xl md:pb-5 md:[animation:dots-slide-right_.25s_ease-out_both]"
      >
        <div className="flex items-center justify-between gap-2 pb-3">
          <h2 className="font-display text-xl font-extrabold text-foreground">Elige tu avatar</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="rounded-full p-2 text-(--muted) transition-transform duration-150 active:scale-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--accent)"
          >
            <Icon name="cruz" size={20} mono />
          </button>
        </div>

        <ul className="grid grid-cols-3 gap-3">
          {items.map((item) => {
            const on = item.key === currentKey;
            const avatar = {
              img: item.img ?? "",
              color: (item.meta?.color as string) ?? "#FF1F8F",
            } as PublicAvatar;
            return (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => onPick(item.key)}
                  aria-pressed={on}
                  className="flex w-full flex-col items-center gap-1.5 rounded-2xl px-1 py-2 transition-transform duration-150 active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--accent)"
                  style={{
                    background: on ? "color-mix(in srgb, var(--accent) 12%, transparent)" : "transparent",
                    border: on ? "2px solid var(--accent)" : "2px solid transparent",
                  }}
                >
                  <Avatar avatar={avatar} size={96} alt="" />
                  <span
                    className="line-clamp-1 text-[11px] font-extrabold"
                    style={{ color: on ? "var(--accent)" : "var(--foreground)" }}
                  >
                    {(item.meta?.label as string) ?? item.name}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Poner el avatar en la identidad del perfil**

En `components/profile/profile-identity.tsx`, sustituye el bloque del `<Doty pose="feliz" size="perfil">` por el `<Avatar>`, **conservando los 78 px de móvil y 96 de escritorio** (desviación 1 de este plan), y añade el lápiz que abre el selector. El componente gana dos props: `avatar: PublicAvatar | null` y `onChangeAvatar: () => void`.

El tamaño responsive se resuelve con dos instancias y las utilidades de Tailwind, porque `<Avatar>` recibe un número:

```tsx
      <button
        type="button"
        onClick={onChangeAvatar}
        aria-label="Cambiar avatar"
        className="relative shrink-0 rounded-full transition-transform duration-150 active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--accent)"
      >
        <span className="md:hidden"><Avatar avatar={avatar} size={78} /></span>
        <span className="hidden md:inline-flex"><Avatar avatar={avatar} size={96} /></span>
        <span
          aria-hidden
          className="absolute -bottom-0.5 -right-0.5 flex h-7 w-7 items-center justify-center rounded-full"
          style={{ background: "var(--accent)", color: "var(--accent-contrast)" }}
        >
          <Icon name="lapiz" size={14} mono />
        </span>
      </button>
```

Quita el import de `Doty` y el de `DotyAnimation` si dejan de usarse en el archivo, y la prop `gestureAnimation` si queda huérfana — **compruébalo con grep antes de borrarla**, porque la página se la pasa.

- [ ] **Step 4: Añadir la fila "Cambiar avatar" a la hoja de ajustes**

En `components/profile/settings-sheet.tsx`, la sección de acciones gana una fila por encima de "Panel de admin", con el mismo estilo que esa. El componente recibe una prop nueva `onChangeAvatar: () => void`; al pulsar, cierra la hoja y abre el selector. Esto cierra la desviación 1 que declaró el subproyecto D.

- [ ] **Step 5: Cablear la página**

En `app/(app)/(hub)/profile/page.tsx`:

- Estado `avatar` con lo que devuelva `getMySettingsService()` (campo `avatar`), y `avatarKey` con `settings.avatar_key`.
- Estado `pickerOpen`.
- Lista de avatares equipables: de `getShopService()`, los `kind === "avatar"` que sean `price === 0` o `owned`.
- `onPick(key)` llama a `postMyAvatarService(key)`, y con lo que devuelve actualiza el avatar mostrado y cierra la hoja. Si falla, cierra igual y no cambia nada: el avatar de pago no comprado se compra en la tienda.
- Monta el selector junto a la hoja de ajustes, al mismo nivel:

```tsx
      <AvatarPicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        items={avatarItems}
        currentKey={avatarKey}
        onPick={pick}
      />
```

- Respeta la regla 3: los fetch van en el efecto y el `setState` dentro del `.then`, con el guard `active` que ya usa el archivo.

- [ ] **Step 6: Verificación completa**

```bash
source ~/.nvm/nvm.sh && nvm use && npm run lint && npm run test:scripts && npx next build
```

Esperado: los tres en verde. El build tarda varios minutos; espéralo.

- [ ] **Step 7: Commit**

```bash
git add components/profile/ app/\(app\)/\(hub\)/profile/page.tsx services/settings.service.ts
git commit -m "feat(avatares): el perfil muestra el avatar equipado y estrena su selector

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 7: Webapp — la sección de avatares en la tienda

**Files:**
- Modify: `app/(app)/(hub)/shop/page.tsx`

**Interfaces:**
- Consumes de Task 5: `Avatar`, `type PublicAvatar`. De Task 6: `postMyAvatarService(key)`.
- Produces (lo consume la Task 9): la tienda terminada.

- [ ] **Step 1: Añadir la sección "Avatares"**

Los avatares se pintan distinto al resto: retrato en el marco a 96 px en vez del icono de la tarjeta. Añade una sección propia **antes** de los grupos que ya existen, con la rejilla a tres columnas, y deja fuera de `groups` los ítems `kind === "avatar"` para que no salgan dos veces.

Cada tarjeta muestra el `<Avatar size={96}>`, el `meta.label` y, debajo, uno de tres estados:

- No comprado y de pago: botón con el chip de gemas y el precio, que llama a `buyItemService`.
- Comprado (o gratis) y **no** equipado: botón **"Usar"**, que llama a `postMyAvatarService(item.key)`.
- Equipado: texto **"Lo tienes"** con el check, sin botón.

Para saber cuál está equipado, la página necesita la key del equipado: pídela con `getMySettingsService()` y guárdala en estado, y refréscala tras un "Usar" con lo que devuelva el POST.

- [ ] **Step 2: Retirar el filtro temporal de D**

El archivo tiene hoy:

```tsx
  const shoppable = items.filter((i) => i.slot !== "hat" && i.slot !== "background");
```

con un comentario que dice que es temporal y que el retiro de verdad es §6.2. Sustitúyelo por `const shoppable = items;` y borra el comentario: tras el script de retirada esos ítems quedan `enabled = false` y `getShop` ya no los devuelve.

**Y actualiza `KIND_LABEL`**: la entrada `cosmetic: "Para tu Doty"` desaparece con los cosméticos emoji (spec §6.3). Deja `gesture: "Gestos de Doty"`, que se conservan.

- [ ] **Step 3: Limpiar los emoji cableados**

`kindIcon()` devuelve hoy `"❄️"` para `streak_shield` y `"🎭"` para `gesture`, y lee `item.meta?.emoji`. Son emoji como iconografía en código de producto, que viola la regla 11. Sustitúyelos por iconos de verdad y quita la rama de `meta.emoji`. Ojo con la familia: `escudo` es un icono de sistema y se pinta con **`<Icon name="escudo">`** (SVG), mientras que `regalo` y `rayo` son de economía y van con **`<UiIcon>`** (PNG). Para `gesture` no hay icono propio: deja el `<UiIcon name="regalo">` que ya es el caso por defecto y **dilo en el informe**; no dibujes uno nuevo.

Comprueba las dos familias antes de elegir:

```bash
grep -oE "^  [a-z-]+:" components/ui/icon/paths.tsx | tr -d ' :' | tr '\n' ' '; echo; ls public/images/ui/ | sed 's/\.png//' | tr '\n' ' '
```

- [ ] **Step 4: Verificación completa**

```bash
source ~/.nvm/nvm.sh && nvm use && npm run lint && npm run test:scripts && npx next build
```

`npm run lint` incluye `check-icons.mjs`, que es quien caza los emoji: si queda alguno, falla.

- [ ] **Step 5: Commit**

```bash
git add app/\(app\)/\(hub\)/shop/page.tsx
git commit -m "feat(avatares): la tienda estrena su sección de avatares y se despide de los cosméticos emoji

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 8: Webapp — el avatar en leaderboard, vecinos del Camino y rival

**Files:**
- Modify: `components/path/path-peer.tsx`
- Modify: `components/interactive-column/top-students.tsx`
- Modify: `components/quests/rival-banner.tsx`

**Interfaces:**
- Consumes de Task 5: `Avatar`, `type PublicAvatar`, y los tipos ya ampliados de `services/engagement.service.ts` y `types/path.types.ts`.
- Produces (lo consume la Task 9): las tres caras públicas pintando avatares.

- [ ] **Step 1: Los vecinos del Camino**

En `components/path/path-peer.tsx`, sustituye el círculo con la inicial por `<Avatar avatar={peer.avatar} size={34} />`. El `CIRCLE = 34` se queda como está: es el mismo tamaño que pide el spec.

**Conserva**: el nombre visible debajo (`label`), el `pointer-events-none`, el anclaje por `side` y el apilado por `stackIndex`. La spec de vecinos del 2026-08-09 sigue vigente en todo salvo en las iniciales.

Si `lib/peer-colors.ts` queda sin consumidores tras el cambio, **no lo borres**: compruébalo con grep y dilo en el informe.

- [ ] **Step 2: El leaderboard**

En `components/interactive-column/top-students.tsx`, cada fila gana un `<Avatar avatar={entry.avatar} size={34} />` a la izquierda del nombre.

**Conserva `displayName()` tal cual**: recorta a nombre más inicial del apellido por privacidad de menores, y eso no cambia.

- [ ] **Step 3: El aviso de rival**

En `components/quests/rival-banner.tsx`, el vecino de arriba y el de abajo ganan su `<Avatar size={34} />` junto al nombre, donde el componente ya los pinte.

- [ ] **Step 4: Verificación completa**

```bash
source ~/.nvm/nvm.sh && nvm use && npm run lint && npm run test:scripts && npx next build
```

- [ ] **Step 5: Commit**

```bash
git add components/path/path-peer.tsx components/interactive-column/top-students.tsx components/quests/rival-banner.tsx
git commit -m "feat(avatares): leaderboard, vecinos del Camino y aviso de rival muestran la cara del usuario

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 9: Verificación en navegador, documentación y desviaciones

**Files:**
- Modify: `docs/ARQUITECTURA.md` (webapp) y `docs/ARQUITECTURA.md` (backend)
- Modify: `docs/superpowers/specs/2026-09-14-rediseno-look-and-feel-juvenil-design.md` (§6)

- [ ] **Step 1: Levantar los servidores y comprobar contra datos reales**

El dev server y el backend se levantan con el preview, nunca con Bash, y se apagan al terminar.

**Ojo**: hasta que Sergio corra `seed-avatars.js --apply` **no habrá ninguna fila de avatar en la base de datos**, así que la tienda mostrará la sección vacía y todo el mundo verá el `clasico` por fallback. Eso es lo correcto y hay que comprobarlo así:

1. Sin filas sembradas, el perfil, el leaderboard y los vecinos muestran el `clasico` y **nada se rompe**.
2. La sección "Avatares" de la tienda no aparece o aparece vacía, sin error.
3. El selector abre y lista cero avatares, sin romperse.

- [ ] **Step 2: Medir los criterios del spec §6**

Mide en el navegador, no a ojo, y anota el número de cada uno:

1. **Marco**: a 34 px el anillo mide 2 px y a 96 mide entre 2 y 3; el fondo del disco es `color-mix` del color del avatar al 42 %.
2. **Tamaños**: 78 px en el perfil a 390 px de ancho y 96 a 1280; 96 en el selector y en la tienda; 34 en leaderboard y vecinos.
3. **Fallback**: un usuario sin avatar equipado muestra `clasico` en las tres caras públicas.
4. **Sin recargar**: elegir un avatar en el selector cambia el del perfil sin recargar la página.
5. **Vecinos**: en `/levels`, los compañeros muestran avatar y **siguen mostrando el nombre debajo**.
6. **Tienda**: los gorros y fondos no aparecen; los gestos sí.
7. **Cierre de la hoja**: el selector cierra por botón, por Escape y tocando fuera, y el scroll del fondo se restaura en los tres.

- [ ] **Step 3: Documentar en `docs/ARQUITECTURA.md` de la webapp**

Añade una sección corta:

```markdown
### Avatares (`components/ui/avatar/`)

La cara pública del usuario. Un único `<Avatar avatar size>` pinta el marco —disco
del color propio del avatar al 42 % sobre la superficie y anillo del acento del
tema— y lo usan el perfil (78/96), el selector y la tienda (96), y el leaderboard,
los vecinos del Camino y el aviso de rival (34). La geometría y el fallback viven
en `lib/avatar.ts`, puro y bajo `node --test`.

Los avatares **no son poses de Doty**: son filas de `shop_items` con `kind='avatar'`,
sus PNG viven en `public/images/avatars/` y están fuera del registro generado
(`components/ui/doty/poses.ts`). Quien no tiene avatar equipado ve `clasico`, y ese
fallback lo resuelve el backend para que ninguna pantalla tenga que decidirlo.

Equipar va por `POST /me/avatar { key }`, que concede el ítem si es gratis y lo
equipa en una transacción; los de pago se compran antes por `/shop/buy`.
```

- [ ] **Step 4: Documentar en `docs/ARQUITECTURA.md` del backend**

Añade `POST /me/avatar` a la tabla de rutas del módulo `me`, y una línea diciendo que `GET /me/settings` devuelve además el avatar resuelto.

- [ ] **Step 5: Anotar las tres desviaciones en el spec §6**

Añade al final de §6.1:

```markdown
- **Tres desviaciones decididas durante la implementación (2026-09-16):** (1) el avatar
  del perfil mide 78 px en móvil y 96 en escritorio, no 128: el §5 fija esos valores y
  el 78 se eligió para que identidad y stats quepan sobre el pliegue a 390 px, que es
  criterio de aceptación de ese mismo §5; el resto de la lista de tamaños se respeta;
  (2) solo se siembran los seis avatares gratis, porque los 19 de pago son la tanda 3
  de arte y sus PNG no existen — el modelo y la tienda los soportan sin cambios y
  aparecen al sembrarlos; (3) el retiro de gorros y fondos se entrega como script
  probado con su dry-run corrido, no aplicado: toca saldos de gemas en la base de
  datos compartida y el `--apply` lo lanza Sergio.
```

- [ ] **Step 6: Verificación final de los dos repos**

```bash
source ~/.nvm/nvm.sh && nvm use && npm run lint && npm run test:scripts && npx next build
```

Y en el worktree del backend: `npm test` más `npx eslint` sobre los archivos tocados.

- [ ] **Step 7: Commit**

```bash
git add docs/
git commit -m "docs(avatares): ARQUITECTURA describe el sistema de avatares y el spec anota las tres desviaciones

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

## Cobertura del spec §6

| Requisito | Dónde se implementa |
|---|---|
| Avatares como `shop_items` con `kind='avatar'`, `slot='avatar'`, `img`, `meta` | Task 1 (tipo) + Task 4 (`seed-avatars.js`) |
| Set gratis a precio 0 y `position` bajo; de pago 300-1500 | Task 4 (los seis gratis); los de pago, **desviación 2** |
| Los tres personajes como premium | **Desviación 2**: son de la tanda 3 |
| Sin migración de esquema | Global Constraints; `kind`/`slot` son `varchar(20)` |
| Los DTO de `/shop` y `/shop/inventory` exponen `img` y `meta` | Task 1 |
| `POST /me/avatar { key }`: concede si gratis o poseído, y equipa en transacción | Task 2 |
| La compra de avatares de pago sigue por `/shop/buy` y luego `POST /me/avatar` | Task 2 (403 si no lo posee) + Task 7 (la tienda encadena las dos) |
| `LeaderboardEntryDto`, `PathPeer` y `RivalNeighborDto` suman `avatar` | Task 3 |
| `GET /me/settings` incluye el equipado | Task 2 |
| Sin avatar equipado, el cliente muestra `clasico` | Task 1 (`publicAvatar`) + Task 5 (`avatarOrDefault`) |
| Marco variante A: disco al 42 % y anillo del acento, 3 px a 128 y 2 px a 34 | Task 5 (`discBackground`, `ringWidth`) |
| Tamaños 128 / 96 / 48 / 34; componente único `<Avatar>` | Task 5; el 128 del perfil es la **desviación 1** |
| Los vecinos del Camino pasan de iniciales a avatares | Task 8 |
| §6.2 retiro de gorros y fondos con reembolso en `gem_ledger` reason `'refund'` | Task 4 |
| §6.2 script con dry-run, `--apply`, respaldo y `--rollback` | Task 4 |
| §6.2 los gestos se conservan | Task 4 (alcance del script) + Task 7 (`KIND_LABEL`) |
| §6.3 sección "Avatares" con marco a 96 px, precio en chip, "Lo tienes" y "Usar" | Task 7 |
| §6.3 "Para tu Doty" desaparece | Task 7 |
| §6.3 criterio: comprar y equipar se ve sin recargar | Task 9, paso 2.4 |
| §6.3 criterio: el usuario sin avatar ve `clasico` | Task 9, paso 2.3 |
| §6.3 criterio: el script deja saldo y ledger coherentes en dry-run | Task 4, paso 3 |

**Nada del spec §6 queda sin tarea.** Las tres desviaciones están decididas, justificadas y se escriben en el propio spec en la Task 9.
