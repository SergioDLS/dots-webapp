# Modo admin — plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que una cuenta con perfil 1 pueda alternar entre "modo alumno" (la app tal cual, con sus candados reales) y "modo admin" (todo desbloqueado más una caja de herramientas para reiniciar su progreso, repetir el primer inicio, regalarse gemas/XP/racha y completar la sección actual), sin cambiar de cuenta y sin escribir progreso para desbloquear.

**Architecture:** Un flag `admin_mode` en `users.settings` (jsonb existente, sin migración) actúa como *lente del servidor*: `AdminModeService.isOn(userId)` lo consulta en los cuatro servicios que calculan `unlocked` (camino, niveles, juegos, lecturas) y en el límite diario del checkpoint. Un controlador `admin/me` bajo `AdminGuard` expone las acciones sobre la propia cuenta. En el frontend, un store de módulo (`lib/admin-mode.ts`) y un contador de "mi cuenta cambió" (`lib/account-refresh.ts`) alimentan el switch de Ajustes, la pastilla ADMIN del HUD y la caja de herramientas.

**Tech Stack:** Backend NestJS 11 + TypeORM + PostgreSQL (jest). Frontend Next.js 16 (app router) + React 19 + Tailwind 4 (node:test para lógica pura).

**Spec:** `docs/superpowers/specs/2026-09-29-modo-admin-design.md` (en dots-webapp). El plan argumenta desde la spec: léela antes de cada tarea.

## Global Constraints

- **Dos repos.** Parte A en `/home/endurance/Projects/Endurance/dots/dots-backend` (crear rama `feat/modo-admin` desde `main`). Parte B en el worktree de dots-webapp donde vive este plan (rama `claude/admin-panel-friendly-87d329`). Backend primero: el frontend se prueba contra él.
- **Antes de cualquier `node`/`npm`:** `source ~/.nvm/nvm.sh && nvm use` (bash/zsh) o `nvm use` a secas (fish). Node 24.
- **Backend, BD remota COMPARTIDA de producción.** Nada de scripts con `--apply`. Solo endpoints; ningún DDL (el jsonb `settings` ya existe). SQL crudo siempre parametrizado (`$1`). Gemas SOLO vía `awardGems(manager, userId, amount, reason, ref)`. `UPDATE`/`DELETE` crudos devuelven la tupla `[rows, affectedCount]`; `rowCount` NO existe.
- **Backend, lint:** NUNCA `npm run lint` (lleva `--fix` y reescribe todo el repo). Usa `npx eslint <archivos propios>` sin `--fix` y `npx prettier --write <archivos propios>`. `npm test` verde y `npm run build` limpio antes de cada commit.
- **Backend, ids:** el userId sale del token (`@CurrentUser()`), jamás del body. Todo controller nuevo con guard a nivel de clase; aquí `AdminGuard`.
- **Frontend, reglas duras del CLAUDE.md:** navegación con `router.push`/`replace`, nunca `window.location`; sin `setState` síncrono en el cuerpo de un `useEffect`; sin efectos colaterales en updaters; `useSearchParams` bajo `<Suspense>` (no aplica aquí); RN-safe: solo tap (`onClick`), nada de `<input>`/`<select>`/keydown para operar; ningún emoji como icono; navy `#1E1B5C` nunca como relleno; Doty solo vía `<Doty pose=…>` con poses del registro.
- **Frontend, copy:** la caja y el switch viven en la app del alumno → español, tono juguetón. El panel `/admin` (en inglés) no se toca.
- **Frontend, verificación:** `npm run lint`, `npx next build` y `npm run test:scripts` verdes antes de cada commit.
- **Commits:** un commit por tarea, mensaje en español como los del historial, y al final del cuerpo la línea `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`.
- **Nombres cerrados (no inventar variantes):** flag `admin_mode`; centinela `ALL_LEVELS`; motivo de ledger `admin_grant`; rutas `PATCH /admin/me/mode`, `POST /admin/me/reset`, `POST /admin/me/first-run/reset`, `POST /admin/me/grant`, `POST /admin/me/complete-current-section`; store frontend `estadoModoAdmin/fijarModoAdmin/suscribirModoAdmin/modoAdminDesdeAjustes`; contador `versionCuenta/bumpCuenta/suscribirCuenta`.

---

## Mapa de archivos

### Parte A — dots-backend

| Archivo | Responsabilidad |
|---|---|
| Create `src/common/admin-profile.ts` | La constante `ADMIN_PROFILE = 1`, compartida por guard y lente. |
| Modify `src/modules/admin/admin.guard.ts` | Importa y reexporta `ADMIN_PROFILE` desde common. |
| Modify `src/common/user-settings.ts` (+spec) | `admin_mode` en `UserSettings`, `normalizeSettings`, `withAdminMode`, `exposeAdminMode`. |
| Create `src/common/admin-mode.ts` (+spec) | Lógica pura: `isAdminModeOn(user)`, `ALL_LEVELS`. |
| Create `src/modules/admin-mode/admin-mode.service.ts` (+spec) y `admin-mode.module.ts` | `AdminModeService.isOn(userId)` con una consulta a `users`; módulo standalone exportado. |
| Modify `src/modules/me/me.service.ts` | `getSettings` devuelve `admin_mode` forzado a false si no es admin. |
| Modify `src/modules/path/path.service.ts`, `checkpoint.service.ts`, `path.module.ts` | Lente en `getPath`; salto del límite diario en `start`. |
| Modify `src/modules/levels/levels.service.ts` + `levels.module.ts` | Centinela `ALL_LEVELS`. |
| Modify `src/modules/games/games.service.ts` + `games.module.ts` | Centinela en `completedLevels` (único punto: arcade, dont-pop, dotaxi). |
| Modify `src/modules/readings/readings.service.ts` + `readings.module.ts` | Centinela en `completedLevels`. |
| Create `src/modules/admin/admin-me.dto.ts` (+spec) | `SetAdminModeDto`, `GrantDto`. |
| Create `src/modules/admin/admin-me.reset.ts` (+spec) | `RESET_TABLES`, `KEPT_TABLES`, `USER_COLUMNS`, `RESET_USER_SQL`. |
| Create `src/modules/admin/admin-me.logic.ts` (+spec) | Puro: `hasAnyGrant`, `streakUpdate`, `findCurrentSection`. |
| Create `src/modules/admin/admin-me.service.ts`, `admin-me.controller.ts` | Los cinco endpoints. |
| Modify `src/modules/admin/admin.module.ts`, `src/app.module.ts` | Registro del controlador y de `AdminModeModule`. |
| Delete `scripts/unlock-path.js` | Obsoleto (sin trackear). |
| Modify `docs/ARQUITECTURA.md` | Fila `admin/me` y módulo `admin-mode`. |

### Parte B — dots-webapp

| Archivo | Responsabilidad |
|---|---|
| Modify `services/settings.service.ts` | `admin_mode?: boolean`. |
| Create `services/admin-lab.service.ts` | Cinco fetchers. |
| Create `lib/admin-mode.ts` (+`.test.mjs`) | Store puro del modo. |
| Create `lib/account-refresh.ts` (+`.test.mjs`) | Contador puro "mi cuenta cambió". |
| Create `hooks/use-admin-mode.ts`, `hooks/use-account-version.ts` | Puentes React (single-flight de `/me/settings`). |
| Modify `components/shell/app-header.tsx`, `components/path/path-container.tsx`, `components/play/arcade-container.tsx` | Se refrescan al bumpear la cuenta; el header monta la pastilla. |
| Create `components/admin-lab/admin-mode-switch.tsx` | Fila con switch, compartida por Ajustes y la caja. |
| Modify `components/profile/settings-sheet.tsx` | Sección "Admin". |
| Create `components/admin-lab/admin-pill.tsx` | Pastilla ADMIN que abre la caja. |
| Create `components/admin-lab/admin-lab-sheet.tsx` | La caja: switch, Progreso, HUD, Este dispositivo, enlace al panel, confirmación del reset. |
| Modify `lib/install-browser.ts` | `borrarMarca()`. |
| Modify `docs/ARQUITECTURA.md`, `CLAUDE.md` | Subsección "Modo admin" y regla 13. |

---

# Parte A — Backend (dots-backend)

Antes de la Tarea 1:

```bash
cd /home/endurance/Projects/Endurance/dots/dots-backend
git status --short        # debe salir solo "?? scripts/unlock-path.js"
git checkout main && git pull --ff-only
git checkout -b feat/modo-admin
```

### Task 1: `admin_mode` en `user-settings.ts` y `ADMIN_PROFILE` compartido

**Files:**
- Create: `src/common/admin-profile.ts`
- Modify: `src/modules/admin/admin.guard.ts:12-13`
- Modify: `src/common/user-settings.ts`
- Test: `src/common/user-settings.spec.ts`

**Interfaces:**
- Produces: `ADMIN_PROFILE: 1` (`src/common/admin-profile.ts`); `UserSettings.admin_mode: boolean`; `withAdminMode(settings: UserSettings, on: boolean): UserSettings`; `exposeAdminMode(settings: UserSettings, profile: number | null | undefined): UserSettings`.

- [ ] **Step 1: Escribir los tests que fallan**

Añade al final de `src/common/user-settings.spec.ts`:

```ts
import { exposeAdminMode, withAdminMode } from './user-settings';

describe('admin_mode', () => {
  it('nace apagado y solo acepta booleanos', () => {
    expect(normalizeSettings({}).admin_mode).toBe(false);
    expect(normalizeSettings({ admin_mode: true }).admin_mode).toBe(true);
    expect(normalizeSettings({ admin_mode: 'true' }).admin_mode).toBe(false);
    expect(normalizeSettings({ admin_mode: 1 }).admin_mode).toBe(false);
  });

  it('mergeSettings no lo toca: no entra por PATCH /me/settings', () => {
    const encendido = { ...DEFAULT_SETTINGS, admin_mode: true };
    const out = mergeSettings(
      encendido,
      { palette: 'electrico', onboarded: true, tips_seen: ['x'] },
      NOW,
    );
    expect(out.admin_mode).toBe(true);
    const apagado = mergeSettings(DEFAULT_SETTINGS, { sound: false }, NOW);
    expect(apagado.admin_mode).toBe(false);
  });

  it('withAdminMode devuelve una copia con el flag cambiado', () => {
    const on = withAdminMode(DEFAULT_SETTINGS, true);
    expect(on.admin_mode).toBe(true);
    expect(DEFAULT_SETTINGS.admin_mode).toBe(false);
    expect(withAdminMode(on, false).admin_mode).toBe(false);
  });

  it('exposeAdminMode fuerza false para quien no es admin', () => {
    const on = withAdminMode(DEFAULT_SETTINGS, true);
    expect(exposeAdminMode(on, 1).admin_mode).toBe(true);
    expect(exposeAdminMode(on, 0).admin_mode).toBe(false);
    expect(exposeAdminMode(on, null).admin_mode).toBe(false);
    expect(exposeAdminMode(on, undefined).admin_mode).toBe(false);
  });
});
```

(El `import` va arriba, junto al import existente de `./user-settings`; fusiónalo en el mismo `import { ... }`.)

- [ ] **Step 2: Correr el test para verlo fallar**

Run: `npx jest src/common/user-settings.spec.ts`
Expected: FAIL — `exposeAdminMode`/`withAdminMode` no existen; `normalizeSettings({}).admin_mode` es `undefined`.

- [ ] **Step 3: Crear la constante compartida y reexportarla desde el guard**

`src/common/admin-profile.ts`:

```ts
/**
 * Admins = usuarios cuya columna `profile` vale esto. Vive en common porque lo
 * leen dos sitios: AdminGuard (quién entra a /admin/*) y la lente del modo
 * admin (src/common/admin-mode.ts), que exige perfil de admin además del flag.
 */
export const ADMIN_PROFILE = 1;
```

En `src/modules/admin/admin.guard.ts` reemplaza las líneas

```ts
// Admins are users whose `profile` column equals this value.
export const ADMIN_PROFILE = 1;
```

por

```ts
import { ADMIN_PROFILE } from 'src/common/admin-profile';

// Reexportado: quien ya importaba ADMIN_PROFILE desde el guard sigue funcionando.
export { ADMIN_PROFILE };
```

Comprueba con `grep -rn "ADMIN_PROFILE" src` que nadie más lo definía.

- [ ] **Step 4: Implementar en `user-settings.ts`**

En `UserSettings` añade, tras `tips_seen`:

```ts
  /**
   * Lente del modo admin (spec 2026-09-29): con perfil 1 y esto en true, el
   * backend reporta todo desbloqueado. NO entra por PATCH /me/settings (ni
   * SettingsPatch ni el DTO lo admiten): solo lo escribe PATCH /admin/me/mode.
   */
  admin_mode: boolean;
```

En `DEFAULT_SETTINGS` añade `admin_mode: false,`.

En `normalizeSettings` añade al objeto devuelto:

```ts
    admin_mode: r.admin_mode === true,
```

Al final del archivo, antes de `isStreakSecuredToday`:

```ts
/** Copia con el flag del modo admin cambiado; lo usa PATCH /admin/me/mode. */
export function withAdminMode(
  settings: UserSettings,
  on: boolean,
): UserSettings {
  return { ...settings, tips_seen: [...settings.tips_seen], admin_mode: on };
}

/**
 * Lo que GET /me/settings devuelve: el flag solo es verdad para un admin. Un
 * admin degradado pierde la lente en la siguiente lectura sin tocar la fila.
 */
export function exposeAdminMode(
  settings: UserSettings,
  profile: number | null | undefined,
): UserSettings {
  const isAdmin = profile === ADMIN_PROFILE;
  return { ...settings, admin_mode: isAdmin && settings.admin_mode };
}
```

Y arriba del archivo: `import { ADMIN_PROFILE } from './admin-profile';`.

- [ ] **Step 5: Correr la suite y verificar que pasa entera**

Run: `npx jest src/common`
Expected: PASS (incluido `settings.dto.spec.ts`, que sigue sin admitir claves nuevas).

- [ ] **Step 6: Commit**

```bash
npx prettier --write src/common/admin-profile.ts src/common/user-settings.ts src/common/user-settings.spec.ts src/modules/admin/admin.guard.ts
npx eslint src/common/admin-profile.ts src/common/user-settings.ts src/common/user-settings.spec.ts src/modules/admin/admin.guard.ts
git add src/common/admin-profile.ts src/common/user-settings.ts src/common/user-settings.spec.ts src/modules/admin/admin.guard.ts
git commit -m "feat(settings): admin_mode nace en users.settings, fuera del alcance de PATCH /me/settings

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 2: `AdminModeService` (la lente) y su módulo

**Files:**
- Create: `src/common/admin-mode.ts`
- Create: `src/common/admin-mode.spec.ts`
- Create: `src/modules/admin-mode/admin-mode.service.ts`
- Create: `src/modules/admin-mode/admin-mode.service.spec.ts`
- Create: `src/modules/admin-mode/admin-mode.module.ts`

**Interfaces:**
- Consumes: `ADMIN_PROFILE`, `normalizeSettings` (Task 1).
- Produces: `isAdminModeOn(user: { profile?: number | null; settings?: unknown } | null | undefined): boolean`; `ALL_LEVELS = 1_000_000`; `AdminModeService.isOn(userId: number): Promise<boolean>`; `AdminModeModule` (exporta `AdminModeService`).

- [ ] **Step 1: Test puro que falla**

`src/common/admin-mode.spec.ts`:

```ts
import { ALL_LEVELS, isAdminModeOn } from './admin-mode';

describe('isAdminModeOn', () => {
  it('exige perfil de admin Y flag encendido', () => {
    expect(isAdminModeOn({ profile: 1, settings: { admin_mode: true } })).toBe(true);
    expect(isAdminModeOn({ profile: 1, settings: { admin_mode: false } })).toBe(false);
    expect(isAdminModeOn({ profile: 1, settings: {} })).toBe(false);
    expect(isAdminModeOn({ profile: 0, settings: { admin_mode: true } })).toBe(false);
  });

  it('falla cerrado ante cualquier duda', () => {
    expect(isAdminModeOn(null)).toBe(false);
    expect(isAdminModeOn(undefined)).toBe(false);
    expect(isAdminModeOn({ profile: 1, settings: 'garbage' })).toBe(false);
    expect(isAdminModeOn({ profile: null, settings: { admin_mode: true } })).toBe(false);
  });

  it('ALL_LEVELS cabe en int4 y supera cualquier unlock real', () => {
    expect(ALL_LEVELS).toBe(1_000_000);
    expect(ALL_LEVELS).toBeLessThan(2_147_483_647);
  });
});
```

- [ ] **Step 2: Correrlo y verlo fallar**

Run: `npx jest src/common/admin-mode.spec.ts`
Expected: FAIL — módulo inexistente.

- [ ] **Step 3: Implementar la lógica pura**

`src/common/admin-mode.ts`:

```ts
import { ADMIN_PROFILE } from './admin-profile';
import { normalizeSettings } from './user-settings';

/**
 * Lente del modo admin (spec 2026-09-29): con perfil de admin y
 * settings.admin_mode = true, el backend REPORTA todo desbloqueado (camino,
 * niveles, juegos, lecturas) y el checkpoint salta su límite diario. No se
 * escribe progreso: apagar el flag devuelve la vista exacta de alumno.
 *
 * Doble cerrojo a propósito: aunque un alumno lograra escribir el flag, el
 * perfil manda.
 */
export function isAdminModeOn(
  user: { profile?: number | null; settings?: unknown } | null | undefined,
): boolean {
  if (!user) return false;
  if (user.profile !== ADMIN_PROFILE) return false;
  return normalizeSettings(user.settings).admin_mode;
}

/**
 * "Niveles completados" con la lente encendida. Los tres servicios que
 * calculan `unlocked = completed >= unlock` reciben este número en vez del
 * conteo real: cabe en int4 (va como parámetro SQL en dont-pop) y ningún
 * `unlock` de contenido se le acerca.
 */
export const ALL_LEVELS = 1_000_000;
```

- [ ] **Step 4: Test del servicio con repositorio falso**

`src/modules/admin-mode/admin-mode.service.spec.ts`:

```ts
import { AdminModeService } from './admin-mode.service';
import type { UsersRepository } from 'src/common/repository/users.repository';

function serviceWith(findOne: jest.Mock): AdminModeService {
  const repo = { findOne } as unknown as UsersRepository;
  return new AdminModeService(repo);
}

describe('AdminModeService.isOn', () => {
  it('true solo para admin con el flag encendido', async () => {
    const svc = serviceWith(
      jest.fn().mockResolvedValue({ id: 7, profile: 1, settings: { admin_mode: true } }),
    );
    await expect(svc.isOn(7)).resolves.toBe(true);
  });

  it('false para alumno aunque tenga el flag', async () => {
    const svc = serviceWith(
      jest.fn().mockResolvedValue({ id: 7, profile: 0, settings: { admin_mode: true } }),
    );
    await expect(svc.isOn(7)).resolves.toBe(false);
  });

  it('false si el usuario no existe o la consulta falla: la lente nunca abre por error', async () => {
    await expect(serviceWith(jest.fn().mockResolvedValue(null)).isOn(7)).resolves.toBe(false);
    await expect(
      serviceWith(jest.fn().mockRejectedValue(new Error('db down'))).isOn(7),
    ).resolves.toBe(false);
  });

  it('consulta por el id recibido', async () => {
    const findOne = jest.fn().mockResolvedValue(null);
    await serviceWith(findOne).isOn(42);
    expect(findOne).toHaveBeenCalledWith({ where: { id: 42 } });
  });
});
```

- [ ] **Step 5: Correrlo y verlo fallar**

Run: `npx jest src/modules/admin-mode`
Expected: FAIL — servicio inexistente.

- [ ] **Step 6: Implementar servicio y módulo**

`src/modules/admin-mode/admin-mode.service.ts`:

```ts
import { Injectable } from '@nestjs/common';
import { isAdminModeOn } from 'src/common/admin-mode';
import { UsersRepository } from 'src/common/repository/users.repository';

/**
 * Una consulta a users por request en los servicios que calculan candados.
 * Falla cerrado: cualquier error = lente apagada (ver src/common/admin-mode.ts).
 */
@Injectable()
export class AdminModeService {
  constructor(private readonly usersRepository: UsersRepository) {}

  async isOn(userId: number): Promise<boolean> {
    try {
      const user = await this.usersRepository.findOne({ where: { id: userId } });
      return isAdminModeOn(user);
    } catch {
      return false;
    }
  }
}
```

`src/modules/admin-mode/admin-mode.module.ts`:

```ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Users } from 'src/common/entity/users.entity';
import { UsersRepository } from 'src/common/repository/users.repository';
import { AdminModeService } from './admin-mode.service';

/**
 * Standalone a propósito: no importa a nadie, así que PathModule, LevelsModule,
 * GamesModule, ReadingsModule y AdminModule pueden importarlo sin ciclos.
 */
@Module({
  imports: [TypeOrmModule.forFeature([Users])],
  providers: [AdminModeService, UsersRepository],
  exports: [AdminModeService],
})
export class AdminModeModule {}
```

- [ ] **Step 7: Correr tests y build**

Run: `npx jest src/common/admin-mode.spec.ts src/modules/admin-mode && npm run build`
Expected: PASS y build limpio.

- [ ] **Step 8: Commit**

```bash
npx prettier --write src/common/admin-mode.ts src/common/admin-mode.spec.ts src/modules/admin-mode
npx eslint src/common/admin-mode.ts src/common/admin-mode.spec.ts src/modules/admin-mode
git add src/common/admin-mode.ts src/common/admin-mode.spec.ts src/modules/admin-mode
git commit -m "feat(admin-mode): la lente — perfil 1 más flag, y falla cerrada

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 3: `GET /me/settings` expone `admin_mode` solo a admins

**Files:**
- Modify: `src/modules/me/me.service.ts:411-431` (`getSettings`)

**Interfaces:**
- Consumes: `exposeAdminMode` (Task 1).
- Produces: la respuesta de `GET /me/settings` incluye `admin_mode: boolean` (false salvo admin con flag). El frontend (Parte B, Task 11) lo lee.

- [ ] **Step 1: Modificar `getSettings`**

En `src/modules/me/me.service.ts`, dentro de `getSettings`, cambia

```ts
    const settings = normalizeSettings(user.settings);
```

por

```ts
    // La lente solo es verdad para un admin (spec modo admin 2026-09-29).
    const settings = exposeAdminMode(
      normalizeSettings(user.settings),
      user.profile,
    );
```

y añade `exposeAdminMode` al `import { ... } from 'src/common/user-settings'` existente (líneas 9-15).

`patchSettings` no cambia: `mergeSettings` conserva `admin_mode` por el spread (probado en Task 1) y devuelve la fila tal cual; no hace falta exponer ahí.

- [ ] **Step 2: Build y suite**

Run: `npm run build && npm test`
Expected: build limpio, suite verde.

- [ ] **Step 3: Commit**

```bash
npx prettier --write src/modules/me/me.service.ts
npx eslint src/modules/me/me.service.ts
git add src/modules/me/me.service.ts
git commit -m "feat(me): GET /me/settings cuenta si la lente está encendida, solo a admins

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 4: La lente en el camino y en el checkpoint

**Files:**
- Modify: `src/modules/path/path.module.ts`
- Modify: `src/modules/path/path.service.ts:32-42, 131-141, 168-172`
- Modify: `src/modules/path/checkpoint.service.ts:35-47, 70-84`

**Interfaces:**
- Consumes: `AdminModeService.isOn`, `AdminModeModule` (Task 2).
- Produces: con la lente, `GET /path` marca `unlocked: true` en todos los nodos y secciones y `checkpointAvailable = !skipped && oraciones >= 5`; `POST /path/checkpoint/:sectionId/start` (la ruta actual de `start`) ignora el límite de 3 intentos por día. `current`, `progress`, `completed`, `skipped` y `placementPending` no cambian.

No hay test unitario de `getPath` (va contra la BD); la verificación es build + Task 10 (curl con sesión real).

- [ ] **Step 1: Importar el módulo**

En `src/modules/path/path.module.ts` añade `import { AdminModeModule } from '../admin-mode/admin-mode.module';` y cambia `imports: [ TypeOrmModule.forFeature([...]) ]` por

```ts
  imports: [
    AdminModeModule,
    TypeOrmModule.forFeature([
      // ...lista existente sin cambios
    ]),
  ],
```

- [ ] **Step 2: Inyectar y aplicar en `PathService.getPath`**

En `src/modules/path/path.service.ts`:

1. `import { AdminModeService } from '../admin-mode/admin-mode.service';`
2. Constructor: añade como último parámetro `private readonly adminModeService: AdminModeService,`.
3. Justo antes de `let frontierOpen = true;` (línea ~131):

```ts
      // Lente del modo admin (spec 2026-09-29): todo se REPORTA abierto, pero
      // frontera, current y progreso se calculan igual que siempre.
      const lens = await this.adminModeService.isOn(userId);
```

4. Cambia `const sectionUnlocked = frontierOpen || skipped;` por `const sectionUnlocked = lens || frontierOpen || skipped;`.
5. Cambia

```ts
            const unlocked = isCheckpoint
              ? sectionUnlocked
              : skipped || frontierOpen;
```

por

```ts
            const unlocked =
              lens || (isCheckpoint ? sectionUnlocked : skipped || frontierOpen);
```

`checkpointAvailable` no cambia de texto: ya parte de `sectionUnlocked`, que ahora incluye la lente, y conserva `!skipped` y el mínimo de oraciones.

- [ ] **Step 3: Saltar el límite diario en `CheckpointService.start`**

En `src/modules/path/checkpoint.service.ts`:

1. `import { AdminModeService } from '../admin-mode/admin-mode.service';`
2. Constructor: añade `private readonly adminModeService: AdminModeService,` al final.
3. Envuelve el bloque del conteo diario (desde `// 3 intentos por día` hasta el `throw` del 429 inclusive):

```ts
    // La verja de unlocked/checkpointAvailable ya viene abierta por la lente
    // vía getPath; aquí solo se salta el cupo diario (spec modo admin).
    if (!(await this.adminModeService.isOn(userId))) {
      // 3 intentos por día (Santiago): cuenta los de hoy
      const attemptsToday = await this.checkpointAttemptRepository
        .createQueryBuilder('a')
        .where('a.user_id = :userId', { userId })
        .andWhere('a.section_id = :sectionId', { sectionId })
        .andWhere(
          `(a.created_at AT TIME ZONE 'America/Santiago')::date = (now() AT TIME ZONE 'America/Santiago')::date`,
        )
        .getCount();
      if (attemptsToday >= MAX_ATTEMPTS_PER_DAY) {
        throw new HttpException(
          'Daily attempt limit reached for this section',
          429,
        );
      }
    }
```

- [ ] **Step 4: Build y suite**

Run: `npm run build && npm test`
Expected: build limpio (el DI de Nest resuelve `AdminModeService` porque `PathModule` importa `AdminModeModule`), suite verde.

- [ ] **Step 5: Commit**

```bash
npx prettier --write src/modules/path/path.module.ts src/modules/path/path.service.ts src/modules/path/checkpoint.service.ts
npx eslint src/modules/path/path.module.ts src/modules/path/path.service.ts src/modules/path/checkpoint.service.ts
git add src/modules/path/path.module.ts src/modules/path/path.service.ts src/modules/path/checkpoint.service.ts
git commit -m "feat(path): con la lente encendida el camino se reporta abierto y el checkpoint no cuenta intentos

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 5: La lente en niveles, juegos y lecturas (centinela `ALL_LEVELS`)

**Files:**
- Modify: `src/modules/levels/levels.module.ts`, `src/modules/levels/levels.service.ts:9-18, 53-55`
- Modify: `src/modules/games/games.module.ts`, `src/modules/games/games.service.ts:200-204`
- Modify: `src/modules/readings/readings.module.ts`, `src/modules/readings/readings.service.ts:19-34`

**Interfaces:**
- Consumes: `ALL_LEVELS` (Task 2), `AdminModeService`.
- Produces: con la lente, `GET /levels` (`unlocked: true`, `levels_left: 0`), `GET /games` (`unlocked: true`, `levelsLeft: 0`, `tournamentPass: false`), `GET /games/dont-pop` y `GET /games/dotaxi` sirven el pool entero, `GET /readings` (`unlocked: true`).

- [ ] **Step 1: Niveles**

`src/modules/levels/levels.module.ts`: `import { AdminModeModule } from '../admin-mode/admin-mode.module';` y `imports: [AdminModeModule, TypeOrmModule.forFeature([...])]`.

`src/modules/levels/levels.service.ts`:

```ts
import { ALL_LEVELS } from 'src/common/admin-mode';
import { AdminModeService } from '../admin-mode/admin-mode.service';
```

Constructor: añade `private readonly adminModeService: AdminModeService,` al final. Reemplaza

```ts
      const completedLevels = levelsProgress.filter(
        (lp) => lp.progress === 100,
      ).length;
```

por

```ts
      // Lente del modo admin: todo abierto sin tocar levels_progress.
      const completedLevels = (await this.adminModeService.isOn(userId))
        ? ALL_LEVELS
        : levelsProgress.filter((lp) => lp.progress === 100).length;
```

- [ ] **Step 2: Juegos**

`src/modules/games/games.module.ts`: mismo import y `imports: [AdminModeModule, TypeOrmModule.forFeature([...])]`.

`src/modules/games/games.service.ts`: mismos dos imports; constructor con `private readonly adminModeService: AdminModeService,` al final; reemplaza `completedLevels`:

```ts
  /**
   * Único punto de la puerta por nivel en este módulo: arcade (getGames),
   * dont-pop y dotaxi. Con la lente del modo admin devuelve ALL_LEVELS y los
   * tres sirven todo (spec 2026-09-29).
   */
  private async completedLevels(userId: number): Promise<number> {
    if (await this.adminModeService.isOn(userId)) return ALL_LEVELS;
    return this.levelsProgressRepository.count({
      where: { userId, progress: 100 },
    });
  }
```

- [ ] **Step 3: Lecturas**

`src/modules/readings/readings.module.ts`: mismo import y `imports: [AdminModeModule, TypeOrmModule.forFeature([...])]`.

`src/modules/readings/readings.service.ts`: mismos dos imports; constructor con `private readonly adminModeService: AdminModeService,` al final; `completedLevels`:

```ts
  private async completedLevels(userId: number): Promise<number> {
    if (await this.adminModeService.isOn(userId)) return ALL_LEVELS;
    return this.levelsProgressRepository.count({
      where: { userId, progress: 100 },
    });
  }
```

- [ ] **Step 4: Build y suite**

Run: `npm run build && npm test`
Expected: limpio y verde.

- [ ] **Step 5: Commit**

```bash
npx prettier --write src/modules/levels/levels.module.ts src/modules/levels/levels.service.ts src/modules/games/games.module.ts src/modules/games/games.service.ts src/modules/readings/readings.module.ts src/modules/readings/readings.service.ts
npx eslint src/modules/levels/levels.module.ts src/modules/levels/levels.service.ts src/modules/games/games.module.ts src/modules/games/games.service.ts src/modules/readings/readings.module.ts src/modules/readings/readings.service.ts
git add src/modules/levels src/modules/games src/modules/readings
git commit -m "feat(gating): niveles, juegos y lecturas se abren con la lente vía el centinela ALL_LEVELS

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 6: Controlador `admin/me` con `PATCH /admin/me/mode`

**Files:**
- Create: `src/modules/admin/admin-me.dto.ts`
- Create: `src/modules/admin/admin-me.dto.spec.ts`
- Create: `src/modules/admin/admin-me.service.ts`
- Create: `src/modules/admin/admin-me.controller.ts`
- Modify: `src/modules/admin/admin.module.ts`

**Interfaces:**
- Consumes: `withAdminMode`, `normalizeSettings` (Task 1); `AdminModeModule` (Task 2); `PathModule` exporta `PathService` y `SkipApplierService` (ya existe).
- Produces: `SetAdminModeDto { on: boolean }`; `GrantDto { gems?, xp?, streak? }`; `AdminMeService.setMode(userId, on): Promise<{ admin_mode: boolean }>`; controlador `@Controller('admin/me')` donde las tareas 7-9 añaden rutas.

- [ ] **Step 1: Test de DTOs que falla**

`src/modules/admin/admin-me.dto.spec.ts`:

```ts
import { validateSync } from 'class-validator';
import { GrantDto, SetAdminModeDto } from './admin-me.dto';

const errorsOf = (dto: object) => validateSync(dto).map((e) => e.property);

describe('SetAdminModeDto', () => {
  it('exige un booleano', () => {
    expect(errorsOf(Object.assign(new SetAdminModeDto(), { on: true }))).toEqual([]);
    expect(errorsOf(Object.assign(new SetAdminModeDto(), { on: 'yes' }))).toEqual(['on']);
    expect(errorsOf(Object.assign(new SetAdminModeDto(), {}))).toEqual(['on']);
  });
});

describe('GrantDto', () => {
  it('acepta cada palanca dentro de sus límites', () => {
    expect(errorsOf(Object.assign(new GrantDto(), { gems: 100 }))).toEqual([]);
    expect(errorsOf(Object.assign(new GrantDto(), { xp: 500 }))).toEqual([]);
    expect(errorsOf(Object.assign(new GrantDto(), { streak: 0 }))).toEqual([]);
    expect(errorsOf(Object.assign(new GrantDto(), { streak: 30 }))).toEqual([]);
    expect(errorsOf(Object.assign(new GrantDto(), {}))).toEqual([]);
  });

  it('rechaza deltas nulos, negativos, decimales o desmesurados', () => {
    expect(errorsOf(Object.assign(new GrantDto(), { gems: 0 }))).toEqual(['gems']);
    expect(errorsOf(Object.assign(new GrantDto(), { gems: 100001 }))).toEqual(['gems']);
    expect(errorsOf(Object.assign(new GrantDto(), { xp: -5 }))).toEqual(['xp']);
    expect(errorsOf(Object.assign(new GrantDto(), { xp: 1000001 }))).toEqual(['xp']);
    expect(errorsOf(Object.assign(new GrantDto(), { streak: 1.5 }))).toEqual(['streak']);
    expect(errorsOf(Object.assign(new GrantDto(), { streak: 3651 }))).toEqual(['streak']);
  });
});
```

- [ ] **Step 2: Correrlo y verlo fallar**

Run: `npx jest src/modules/admin/admin-me.dto.spec.ts`
Expected: FAIL — módulo inexistente.

- [ ] **Step 3: DTOs**

`src/modules/admin/admin-me.dto.ts`:

```ts
import { IsBoolean, IsInt, IsOptional, Max, Min } from 'class-validator';

/** PATCH /admin/me/mode */
export class SetAdminModeDto {
  @IsBoolean()
  on: boolean;
}

/**
 * POST /admin/me/grant. gems y xp son deltas; streak es valor absoluto (0 la
 * apaga). Al menos uno: lo comprueba el servicio (hasAnyGrant), no el DTO.
 */
export class GrantDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100000)
  gems?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1000000)
  xp?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(3650)
  streak?: number;
}
```

- [ ] **Step 4: Servicio (solo `setMode` por ahora) y controlador**

`src/modules/admin/admin-me.service.ts`:

```ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { UsersRepository } from 'src/common/repository/users.repository';
import { normalizeSettings, withAdminMode } from 'src/common/user-settings';

/**
 * Acciones de un admin sobre SU PROPIA cuenta (spec modo admin 2026-09-29).
 * Ningún método recibe otro id que el del token: es imposible apuntarlas a
 * otra cuenta.
 */
@Injectable()
export class AdminMeService {
  constructor(private readonly usersRepository: UsersRepository) {}

  async setMode(userId: number, on: boolean): Promise<{ admin_mode: boolean }> {
    const user = await this.usersRepository.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    const next = withAdminMode(normalizeSettings(user.settings), on);
    // update, no save: save() reescribe la fila entera (mismo motivo que
    // MeService.patchSettings). `as never`: el jsonb tipa mal, como allí.
    await this.usersRepository.update(userId, { settings: next as never });
    return { admin_mode: on };
  }
}
```

`src/modules/admin/admin-me.controller.ts`:

```ts
import { Body, Controller, Patch, UseGuards } from '@nestjs/common';
import {
  CurrentUser,
  type AuthUser,
} from 'src/common/decorators/current-user.decorator';
import { AdminGuard } from './admin.guard';
import { AdminMeService } from './admin-me.service';
import { SetAdminModeDto } from './admin-me.dto';

/**
 * /admin/me/*: el admin actúa sobre su propia cuenta. AdminGuard reconsulta el
 * perfil en la BD en cada petición y deja `req.user = { id, profile }`, que es
 * lo que lee @CurrentUser.
 */
@Controller('admin/me')
@UseGuards(AdminGuard)
export class AdminMeController {
  constructor(private readonly adminMeService: AdminMeService) {}

  @Patch('mode')
  setMode(@CurrentUser() admin: AuthUser, @Body() dto: SetAdminModeDto) {
    return this.adminMeService.setMode(admin.id, dto.on);
  }
}
```

`src/modules/admin/admin.module.ts`: añade los imports

```ts
import { AdminMeController } from './admin-me.controller';
import { AdminMeService } from './admin-me.service';
import { AdminModeModule } from '../admin-mode/admin-mode.module';
import { PathModule } from '../path/path.module';
```

y cambia `imports: [ TypeOrmModule.forFeature([...]) ]` por `imports: [ AdminModeModule, PathModule, TypeOrmModule.forFeature([...]) ]`, `controllers: [AdminController]` por `controllers: [AdminController, AdminMeController]`, y añade `AdminMeService,` a `providers` (tras `AdminService,`).

- [ ] **Step 5: Tests, build, suite**

Run: `npx jest src/modules/admin && npm run build && npm test`
Expected: verde y limpio.

- [ ] **Step 6: Prueba en vivo del interruptor (watcher en :4000)**

Con el backend corriendo (`npm run start:dev` si no hay watcher) y un token de admin (`TOKEN`, obtenido del login de Sergio en el navegador o con `curl -c` a `/auth/login`; no se escribe la contraseña en el chat):

```bash
curl -s -X PATCH http://localhost:4000/admin/me/mode -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' -d '{"on":true}'
# → {"admin_mode":true}
curl -s http://localhost:4000/me/settings -H "Authorization: Bearer $TOKEN" | grep -o '"admin_mode":[a-z]*'
# → "admin_mode":true
curl -s http://localhost:4000/path -H "Authorization: Bearer $TOKEN" | grep -o '"unlocked":false' | wc -l
# → 0
curl -s -X PATCH http://localhost:4000/admin/me/mode -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' -d '{"on":false}'
# → {"admin_mode":false}; repetir el grep del camino: vuelven los false
```

Si no hay token a mano, deja esta comprobación para la Task 19 (preview con sesión real) y anótalo en el commit.

- [ ] **Step 7: Commit**

```bash
npx prettier --write src/modules/admin/admin-me.dto.ts src/modules/admin/admin-me.dto.spec.ts src/modules/admin/admin-me.service.ts src/modules/admin/admin-me.controller.ts src/modules/admin/admin.module.ts
npx eslint src/modules/admin/admin-me.dto.ts src/modules/admin/admin-me.dto.spec.ts src/modules/admin/admin-me.service.ts src/modules/admin/admin-me.controller.ts src/modules/admin/admin.module.ts
git add src/modules/admin/admin-me.dto.ts src/modules/admin/admin-me.dto.spec.ts src/modules/admin/admin-me.service.ts src/modules/admin/admin-me.controller.ts src/modules/admin/admin.module.ts
git commit -m "feat(admin/me): PATCH /admin/me/mode enciende y apaga la lente de la propia cuenta

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 7: `POST /admin/me/reset` con lista de tablas verificada contra los metadatos

**Files:**
- Create: `src/modules/admin/admin-me.reset.ts`
- Create: `src/modules/admin/admin-me.reset.spec.ts`
- Modify: `src/modules/admin/admin-me.service.ts`
- Modify: `src/modules/admin/admin-me.controller.ts`

**Interfaces:**
- Produces: `RESET_TABLES: readonly { table: string; column: string }[]`, `KEPT_TABLES: readonly string[]`, `USER_COLUMNS: ReadonlySet<string>`, `RESET_USER_SQL: string`; `AdminMeService.resetMyProgress(userId): Promise<{ deleted: Record<string, number> }>`; ruta `POST /admin/me/reset`.

- [ ] **Step 1: Test de cobertura que falla**

`src/modules/admin/admin-me.reset.spec.ts`:

```ts
import * as fs from 'fs';
import * as path from 'path';
import { getMetadataArgsStorage } from 'typeorm';
import {
  KEPT_TABLES,
  RESET_TABLES,
  RESET_USER_SQL,
  USER_COLUMNS,
} from './admin-me.reset';

/**
 * Carga TODAS las entities para que sus decoradores se registren en el
 * storage de TypeORM; así el test ve tablas nuevas aunque nadie las importe.
 */
const ENTITY_DIR = path.join(__dirname, '..', '..', 'common', 'entity');
for (const file of fs.readdirSync(ENTITY_DIR)) {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  if (file.endsWith('.entity.ts')) require(path.join(ENTITY_DIR, file));
}

type Linked = { table: string; columns: string[] };

/** Tablas con alguna columna que apunte a un usuario, según los decoradores. */
function userLinkedTables(): Linked[] {
  const storage = getMetadataArgsStorage();
  const out: Linked[] = [];
  for (const table of storage.tables) {
    if (!table.name) continue;
    const names = new Set<string>();
    for (const col of storage.columns) {
      if (col.target === table.target && col.options.name && USER_COLUMNS.has(col.options.name)) {
        names.add(col.options.name);
      }
    }
    for (const join of storage.joinColumns) {
      if (join.target === table.target && join.name && USER_COLUMNS.has(join.name)) {
        names.add(join.name);
      }
    }
    if (names.size > 0) out.push({ table: table.name, columns: [...names] });
  }
  return out;
}

describe('RESET_TABLES cubre todo el progreso del usuario', () => {
  const linked = userLinkedTables();

  it('encuentra tablas ligadas a usuario (sanidad del cargador)', () => {
    expect(linked.length).toBeGreaterThan(10);
  });

  it('toda tabla con columna de usuario está clasificada: se borra o se conserva', () => {
    const reset = new Map(RESET_TABLES.map((t) => [t.table, t.column]));
    const unclassified = linked
      .filter((l) => !reset.has(l.table) && !KEPT_TABLES.includes(l.table))
      .map((l) => l.table);
    expect(unclassified).toEqual([]);
  });

  it('cada entrada de RESET_TABLES existe y usa la columna real', () => {
    for (const { table, column } of RESET_TABLES) {
      const found = linked.find((l) => l.table === table);
      expect(found).toBeDefined();
      expect(found?.columns).toContain(column);
    }
  });

  it('ninguna tabla está en las dos listas', () => {
    for (const { table } of RESET_TABLES) expect(KEPT_TABLES).not.toContain(table);
  });

  it('el UPDATE de users pone a cero lo que la spec enumera', () => {
    for (const col of [
      'xp = 0',
      'xp_week = 0',
      'week_start = NULL',
      'streak = 0',
      'best_streak = 0',
      'last_streak_day = NULL',
      'streak_freezes = 0',
      'gems = 0',
      'xp_boost_until = NULL',
      'current_level = NULL',
      "- 'onboarded_at'",
      "- 'tips_seen'",
      "- 'avatar_key'",
    ]) {
      expect(RESET_USER_SQL).toContain(col);
    }
    expect(RESET_USER_SQL).toContain('WHERE id = $1');
  });
});
```

- [ ] **Step 2: Correrlo y verlo fallar**

Run: `npx jest src/modules/admin/admin-me.reset.spec.ts`
Expected: FAIL — módulo inexistente.

- [ ] **Step 3: Las listas**

`src/modules/admin/admin-me.reset.ts`:

```ts
/**
 * Qué borra POST /admin/me/reset (spec modo admin 2026-09-29): la cuenta queda
 * como recién invitada. La lista se contrasta con los decoradores de TypeORM
 * en admin-me.reset.spec.ts: una tabla nueva con columna de usuario que nadie
 * clasifique aquí rompe la suite.
 *
 * Los nombres de tabla se interpolan en SQL: son constantes de este archivo,
 * nunca entrada del usuario.
 */
export type UserTable = { table: string; column: string };

export const RESET_TABLES: readonly UserTable[] = [
  { table: 'levels_progress', column: 'id_user' },
  { table: 'section_progress', column: 'user_id' },
  { table: 'difficulty_progress', column: 'user_id' },
  { table: 'node_progress', column: 'user_id' },
  { table: 'item_progress', column: 'user_id' },
  { table: 'sentences_progress', column: 'user_id' },
  { table: 'review_items', column: 'user_id' },
  { table: 'placement_tests', column: 'user_id' },
  { table: 'checkpoint_attempts', column: 'user_id' },
  { table: 'daily_use', column: 'id_user' },
  { table: 'daily_game_state', column: 'user_id' },
  { table: 'user_game_scores', column: 'id_user' },
  { table: 'game_runs', column: 'user_id' },
  { table: 'tournament_scores', column: 'user_id' },
  { table: 'gem_ledger', column: 'user_id' },
  { table: 'user_items', column: 'user_id' },
];

/**
 * Se conservan a propósito: los retos involucran a otra persona y las
 * invitaciones no son progreso.
 */
export const KEPT_TABLES: readonly string[] = ['challenges', 'invitations'];

/** Nombres de columna que denotan "pertenece a un usuario" en las entities. */
export const USER_COLUMNS: ReadonlySet<string> = new Set([
  'user_id',
  'id_user',
  'challenger_id',
  'challenged_id',
  'invited_by',
  'accepted_by',
]);

/** Columnas de progreso en users; conserva paleta/modo/sonido/admin_mode en settings. */
export const RESET_USER_SQL = `UPDATE dots.users
   SET xp = 0,
       xp_week = 0,
       week_start = NULL,
       streak = 0,
       best_streak = 0,
       last_streak_day = NULL,
       streak_freezes = 0,
       gems = 0,
       xp_boost_until = NULL,
       current_level = NULL,
       settings = COALESCE(settings, '{}'::jsonb) - 'onboarded_at' - 'tips_seen' - 'avatar_key'
 WHERE id = $1`;
```

- [ ] **Step 4: Correr el test de cobertura**

Run: `npx jest src/modules/admin/admin-me.reset.spec.ts`
Expected: PASS. Si falla por una tabla sin clasificar, la spec decide: progreso → `RESET_TABLES`; involucra a terceros o no es progreso → `KEPT_TABLES`. No la ignores.

- [ ] **Step 5: Servicio y ruta**

En `admin-me.service.ts` añade el import `import { RESET_TABLES, RESET_USER_SQL } from './admin-me.reset';` y el método:

```ts
  /**
   * Cuenta como recién invitada. Una transacción: todo o nada. DELETE crudo
   * devuelve [rows, affected] con el driver pg de TypeORM (CLAUDE.md).
   */
  async resetMyProgress(
    userId: number,
  ): Promise<{ deleted: Record<string, number> }> {
    return this.usersRepository.manager.transaction(async (em) => {
      const deleted: Record<string, number> = {};
      for (const { table, column } of RESET_TABLES) {
        const [, affected] = (await em.query(
          `DELETE FROM dots.${table} WHERE ${column} = $1`,
          [userId],
        )) as [unknown[], number];
        deleted[table] = affected ?? 0;
      }
      await em.query(RESET_USER_SQL, [userId]);
      return { deleted };
    });
  }
```

En `admin-me.controller.ts` añade `Post` al import de `@nestjs/common` y la ruta:

```ts
  @Post('reset')
  reset(@CurrentUser() admin: AuthUser) {
    return this.adminMeService.resetMyProgress(admin.id);
  }
```

- [ ] **Step 6: Build y suite**

Run: `npm run build && npm test`
Expected: limpio y verde. **No** pruebes el reset en vivo con la cuenta de Sergio: borra progreso real. Se prueba en Task 19 con cuenta de prueba y consentimiento.

- [ ] **Step 7: Commit**

```bash
npx prettier --write src/modules/admin/admin-me.reset.ts src/modules/admin/admin-me.reset.spec.ts src/modules/admin/admin-me.service.ts src/modules/admin/admin-me.controller.ts
npx eslint src/modules/admin/admin-me.reset.ts src/modules/admin/admin-me.reset.spec.ts src/modules/admin/admin-me.service.ts src/modules/admin/admin-me.controller.ts
git add src/modules/admin/admin-me.reset.ts src/modules/admin/admin-me.reset.spec.ts src/modules/admin/admin-me.service.ts src/modules/admin/admin-me.controller.ts
git commit -m "feat(admin/me): POST /admin/me/reset deja la propia cuenta como recién invitada, con la lista de tablas bajo test

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 8: `POST /admin/me/first-run/reset` y `POST /admin/me/grant`

**Files:**
- Create: `src/modules/admin/admin-me.logic.ts`
- Create: `src/modules/admin/admin-me.logic.spec.ts`
- Modify: `src/modules/admin/admin-me.service.ts`
- Modify: `src/modules/admin/admin-me.controller.ts`

**Interfaces:**
- Consumes: `GrantDto` (Task 6), `awardGems` (`src/common/gems.ts`), `santiagoToday` (`src/common/santiago-day.ts`).
- Produces: `hasAnyGrant(dto: GrantDto): boolean`; `streakUpdate(streak: number, today: string): { sql: string; params: (string | number)[] }` (sin el userId; el servicio lo añade como último parámetro); `AdminMeService.resetFirstRun(userId): Promise<{ ok: true }>`; `AdminMeService.grant(userId, dto): Promise<{ gems: number; xp: number; streak: number }>`.

- [ ] **Step 1: Tests puros que fallan**

`src/modules/admin/admin-me.logic.spec.ts` (la parte de grant; `findCurrentSection` se añade en Task 9):

```ts
import { hasAnyGrant, streakUpdate } from './admin-me.logic';

describe('hasAnyGrant', () => {
  it('true con al menos una palanca, false sin ninguna', () => {
    expect(hasAnyGrant({ gems: 1 })).toBe(true);
    expect(hasAnyGrant({ xp: 1 })).toBe(true);
    expect(hasAnyGrant({ streak: 0 })).toBe(true);
    expect(hasAnyGrant({})).toBe(false);
    expect(hasAnyGrant({ gems: undefined })).toBe(false);
  });
});

describe('streakUpdate', () => {
  it('con 0 apaga la racha y borra el día', () => {
    const { sql, params } = streakUpdate(0, '2026-09-29');
    expect(sql).toContain('streak = 0');
    expect(sql).toContain('last_streak_day = NULL');
    expect(sql).toContain('WHERE id = $1');
    expect(params).toEqual([]);
  });

  it('con N fija la racha, sube best_streak si hace falta y enciende la llama hoy', () => {
    const { sql, params } = streakUpdate(7, '2026-09-29');
    expect(sql).toContain('streak = $1');
    expect(sql).toContain('best_streak = GREATEST(COALESCE(best_streak, 0), $1)');
    expect(sql).toContain('last_streak_day = $2');
    expect(sql).toContain('WHERE id = $3');
    expect(params).toEqual([7, '2026-09-29']);
  });
});
```

- [ ] **Step 2: Correrlo y verlo fallar**

Run: `npx jest src/modules/admin/admin-me.logic.spec.ts`
Expected: FAIL — módulo inexistente.

- [ ] **Step 3: Lógica pura**

`src/modules/admin/admin-me.logic.ts`:

```ts
import type { GrantDto } from './admin-me.dto';

/** POST /admin/me/grant exige al menos una palanca; el DTO solo acota cada una. */
export function hasAnyGrant(dto: GrantDto): boolean {
  return dto.gems !== undefined || dto.xp !== undefined || dto.streak !== undefined;
}

/**
 * UPDATE de racha para grant. Devuelve el SQL y los parámetros SIN el userId,
 * que el servicio añade al final (último `$n`). 0 apaga la racha; N la fija,
 * sube best_streak si hace falta y estampa hoy en last_streak_day para que la
 * llama del HUD se encienda (isStreakSecuredToday).
 */
export function streakUpdate(
  streak: number,
  today: string,
): { sql: string; params: (string | number)[] } {
  if (streak === 0) {
    return {
      sql: `UPDATE dots.users SET streak = 0, last_streak_day = NULL WHERE id = $1`,
      params: [],
    };
  }
  return {
    sql: `UPDATE dots.users
             SET streak = $1,
                 best_streak = GREATEST(COALESCE(best_streak, 0), $1),
                 last_streak_day = $2
           WHERE id = $3`,
    params: [streak, today],
  };
}
```

- [ ] **Step 4: Correr el test puro**

Run: `npx jest src/modules/admin/admin-me.logic.spec.ts`
Expected: PASS.

- [ ] **Step 5: Servicio y rutas**

En `admin-me.service.ts` añade imports:

```ts
import { BadRequestException } from '@nestjs/common'; // fusiónalo con el import existente de @nestjs/common
import { awardGems } from 'src/common/gems';
import { santiagoToday } from 'src/common/santiago-day';
import type { GrantDto } from './admin-me.dto';
import { hasAnyGrant, streakUpdate } from './admin-me.logic';
```

y los métodos:

```ts
  /** Vuelve a ver la bienvenida y las pistas sin perder nada más. */
  async resetFirstRun(userId: number): Promise<{ ok: true }> {
    await this.usersRepository.manager.query(
      `UPDATE dots.users
          SET settings = COALESCE(settings, '{}'::jsonb) - 'onboarded_at' - 'tips_seen'
        WHERE id = $1`,
      [userId],
    );
    return { ok: true };
  }

  /**
   * Palancas del HUD. Gemas solo vía awardGems (ledger con motivo admin_grant);
   * xp es delta sobre users.xp (xp_week es contabilidad semanal y no se toca);
   * streak es absoluto (ver streakUpdate).
   */
  async grant(
    userId: number,
    dto: GrantDto,
  ): Promise<{ gems: number; xp: number; streak: number }> {
    if (!hasAnyGrant(dto)) throw new BadRequestException('Nothing to grant');
    await this.usersRepository.manager.transaction(async (em) => {
      if (dto.gems !== undefined) {
        await awardGems(em, userId, dto.gems, 'admin_grant');
      }
      if (dto.xp !== undefined) {
        await em.query(
          `UPDATE dots.users SET xp = COALESCE(xp, 0) + $1 WHERE id = $2`,
          [dto.xp, userId],
        );
      }
      if (dto.streak !== undefined) {
        const { sql, params } = streakUpdate(dto.streak, santiagoToday());
        await em.query(sql, [...params, userId]);
      }
    });
    const rows = (await this.usersRepository.manager.query(
      `SELECT COALESCE(gems, 0) AS gems, COALESCE(xp, 0) AS xp, COALESCE(streak, 0) AS streak
         FROM dots.users WHERE id = $1`,
      [userId],
    )) as Array<{ gems: string; xp: string; streak: string }>;
    const row = rows[0] ?? { gems: '0', xp: '0', streak: '0' };
    return { gems: Number(row.gems), xp: Number(row.xp), streak: Number(row.streak) };
  }
```

En `admin-me.controller.ts` importa `GrantDto` junto a `SetAdminModeDto` y añade:

```ts
  @Post('first-run/reset')
  resetFirstRun(@CurrentUser() admin: AuthUser) {
    return this.adminMeService.resetFirstRun(admin.id);
  }

  @Post('grant')
  grant(@CurrentUser() admin: AuthUser, @Body() dto: GrantDto) {
    return this.adminMeService.grant(admin.id, dto);
  }
```

- [ ] **Step 6: Build y suite; prueba en vivo de grant (reversible) si hay token**

Run: `npm run build && npm test`

Opcional con `TOKEN` de admin (suma 1 gema, que Sergio puede gastar o ignorar):

```bash
curl -s -X POST http://localhost:4000/admin/me/grant -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' -d '{"gems":1}'
# → {"gems":<n+1>,"xp":<igual>,"streak":<igual>}
curl -s -X POST http://localhost:4000/admin/me/grant -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' -d '{}'
# → 400 Nothing to grant
```

No pruebes `first-run/reset` con la cuenta de Sergio sin avisarle: le vuelve a salir la bienvenida.

- [ ] **Step 7: Commit**

```bash
npx prettier --write src/modules/admin/admin-me.logic.ts src/modules/admin/admin-me.logic.spec.ts src/modules/admin/admin-me.service.ts src/modules/admin/admin-me.controller.ts
npx eslint src/modules/admin/admin-me.logic.ts src/modules/admin/admin-me.logic.spec.ts src/modules/admin/admin-me.service.ts src/modules/admin/admin-me.controller.ts
git add src/modules/admin/admin-me.logic.ts src/modules/admin/admin-me.logic.spec.ts src/modules/admin/admin-me.service.ts src/modules/admin/admin-me.controller.ts
git commit -m "feat(admin/me): repetir el primer inicio y regalarse gemas, XP o racha

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 9: `POST /admin/me/complete-current-section`

**Files:**
- Modify: `src/modules/admin/admin-me.logic.ts`, `src/modules/admin/admin-me.logic.spec.ts`
- Modify: `src/modules/admin/admin-me.service.ts`, `src/modules/admin/admin-me.controller.ts`

**Interfaces:**
- Consumes: `PathService.getPath(user: { id })` → `PathResponseDto` (`difficulties[].sections[].nodes[].current`), `SkipApplierService.skipSection(userId, sectionId)` (ambos exportados por `PathModule`, ya importado en Task 6).
- Produces: `findCurrentSection(difficulties): { id: number; name: string } | null`; `AdminMeService.completeCurrentSection(userId): Promise<{ sectionId: number; name: string }>`.

- [ ] **Step 1: Test puro que falla**

Añade a `admin-me.logic.spec.ts`:

```ts
import { findCurrentSection } from './admin-me.logic';

describe('findCurrentSection', () => {
  const node = (id: number, current: boolean) => ({ id, current });
  const difficulties = [
    {
      sections: [
        { id: 1, name: 'Hola', nodes: [node(10, false), node(11, false)] },
        { id: 2, name: 'Colores', nodes: [node(20, false), node(21, true)] },
      ],
    },
    { sections: [{ id: 3, name: 'Números', nodes: [node(30, false)] }] },
  ];

  it('devuelve la sección del nodo current', () => {
    expect(findCurrentSection(difficulties)).toEqual({ id: 2, name: 'Colores' });
  });

  it('null si no hay nodo current (camino terminado)', () => {
    expect(findCurrentSection([{ sections: [{ id: 1, name: 'x', nodes: [node(1, false)] }] }])).toBeNull();
    expect(findCurrentSection([])).toBeNull();
  });
});
```

(Fusiona el import con el existente de `./admin-me.logic`.)

- [ ] **Step 2: Correrlo y verlo fallar**

Run: `npx jest src/modules/admin/admin-me.logic.spec.ts`
Expected: FAIL — `findCurrentSection` no existe.

- [ ] **Step 3: Implementar**

Añade a `admin-me.logic.ts`:

```ts
type SectionLike = { id: number; name: string; nodes: { current: boolean }[] };

/** La sección que contiene el nodo `current` del camino, o null si no hay. */
export function findCurrentSection(
  difficulties: ReadonlyArray<{ sections: SectionLike[] }>,
): { id: number; name: string } | null {
  for (const d of difficulties) {
    for (const s of d.sections) {
      if (s.nodes.some((n) => n.current)) return { id: s.id, name: s.name };
    }
  }
  return null;
}
```

En `admin-me.service.ts`:

```ts
import { PathService } from '../path/path.service';
import { SkipApplierService } from '../path/skip-applier.service';
import { findCurrentSection } from './admin-me.logic'; // fusiona con el import existente
```

Constructor:

```ts
  constructor(
    private readonly usersRepository: UsersRepository,
    private readonly pathService: PathService,
    private readonly skipApplierService: SkipApplierService,
  ) {}
```

Método:

```ts
  /**
   * El único endpoint de admin/me que ESCRIBE progreso: aplica a la sección del
   * nodo actual el mismo skip que usa el placement. La lente no altera
   * `current`, así que vale con el modo encendido o apagado.
   */
  async completeCurrentSection(
    userId: number,
  ): Promise<{ sectionId: number; name: string }> {
    const path = await this.pathService.getPath({ id: userId });
    const section = findCurrentSection(path.difficulties);
    if (!section) throw new NotFoundException('No current section');
    await this.skipApplierService.skipSection(userId, section.id);
    return { sectionId: section.id, name: section.name };
  }
```

Controlador:

```ts
  @Post('complete-current-section')
  completeCurrentSection(@CurrentUser() admin: AuthUser) {
    return this.adminMeService.completeCurrentSection(admin.id);
  }
```

- [ ] **Step 4: Tests, build, suite**

Run: `npx jest src/modules/admin && npm run build && npm test`
Expected: verde y limpio. No lo pruebes en vivo con la cuenta de Sergio: escribe progreso.

- [ ] **Step 5: Commit**

```bash
npx prettier --write src/modules/admin/admin-me.logic.ts src/modules/admin/admin-me.logic.spec.ts src/modules/admin/admin-me.service.ts src/modules/admin/admin-me.controller.ts
npx eslint src/modules/admin/admin-me.logic.ts src/modules/admin/admin-me.logic.spec.ts src/modules/admin/admin-me.service.ts src/modules/admin/admin-me.controller.ts
git add src/modules/admin/admin-me.logic.ts src/modules/admin/admin-me.logic.spec.ts src/modules/admin/admin-me.service.ts src/modules/admin/admin-me.controller.ts
git commit -m "feat(admin/me): completar la sección actual con el skip del placement

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 10: Limpieza, documentación del backend y verificación final

**Files:**
- Delete: `scripts/unlock-path.js` (sin trackear)
- Modify: `docs/ARQUITECTURA.md` (tabla de módulos)

- [ ] **Step 1: Borrar el script obsoleto**

```bash
rm scripts/unlock-path.js
git status --short   # no debe listarlo (era untracked); si aparece como "D", es que estaba trackeado: entonces `git rm` y sigue
```

- [ ] **Step 2: Documentar**

En `docs/ARQUITECTURA.md`, en la tabla "Módulos y endpoints principales", cambia la fila `admin` por:

```md
| admin | CRUD contenido + upload + narraciones; `admin/me/*`: `PATCH mode`, `POST reset`, `POST first-run/reset`, `POST grant`, `POST complete-current-section` | ADMIN_PROFILE=1 (`common/admin-profile.ts`). `admin/me` actúa SOLO sobre la cuenta del token: reset = cuenta recién invitada (tablas en `admin-me.reset.ts`, bajo test contra los metadatos de TypeORM); grant = gemas por ledger `admin_grant`, xp delta, racha absoluta |
| admin-mode | (sin endpoints) `AdminModeService.isOn(userId)` | Lente: perfil 1 + `settings.admin_mode` → path/levels/games/readings reportan todo `unlocked` (centinela `ALL_LEVELS`) y checkpoint salta el cupo diario. No escribe progreso. Spec en dots-webapp `docs/superpowers/specs/2026-09-29-modo-admin-design.md` |
```

- [ ] **Step 3: Verificación completa**

Run: `npm test && npm run build && npx eslint src/common/admin-mode.ts src/common/admin-profile.ts src/modules/admin-mode src/modules/admin/admin-me.controller.ts src/modules/admin/admin-me.service.ts src/modules/admin/admin-me.dto.ts src/modules/admin/admin-me.logic.ts src/modules/admin/admin-me.reset.ts`
Expected: todo verde, sin errores de lint en lo propio.

- [ ] **Step 4: Commit**

```bash
git add docs/ARQUITECTURA.md
git commit -m "docs(backend): admin/me y la lente del modo admin en la arquitectura; fuera el script unlock-path

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

Backend listo en `feat/modo-admin`. Déjalo corriendo con `npm run start:dev` (o el watcher existente en :4000, que recarga solo) para la Parte B.

---

# Parte B — Frontend (dots-webapp)

Todo en el worktree de este plan. Antes de la Task 11, si aún no está hecho: `ln -s ../../../node_modules node_modules` (o `npm ci`) y copiar `.env.local` del checkout principal (ver memoria «Verificación visual con preview»).

### Task 11: Tipos y fetchers

**Files:**
- Modify: `services/settings.service.ts:8-16`
- Create: `services/admin-lab.service.ts`

**Interfaces:**
- Produces: `UserSettings.admin_mode?: boolean`; `setAdminModeService(on: boolean): Promise<{ admin_mode: boolean }>`; `resetMyProgressService(): Promise<ResetResult>`; `resetMyFirstRunService(): Promise<{ ok: true }>`; `grantMyselfService(p: GrantPayload): Promise<GrantResult>`; `completeCurrentSectionService(): Promise<CompletedSection>`; tipos `GrantPayload`, `GrantResult`, `ResetResult`, `CompletedSection`.

- [ ] **Step 1: El tipo**

En `services/settings.service.ts`, en `UserSettings`, tras `tips_seen: string[];`:

```ts
  /**
   * Lente del modo admin (spec 2026-09-29). Solo llega true a un admin con el
   * flag encendido; un backend viejo no lo manda, y ausente = apagado.
   */
  admin_mode?: boolean;
```

- [ ] **Step 2: Los fetchers**

`services/admin-lab.service.ts`:

```ts
import api from "@/lib/api-client";

/**
 * Acciones de un admin sobre SU cuenta (spec modo admin 2026-09-29). Todas
 * bajo /admin/me, guardadas por AdminGuard en el servidor. Propagan el error a
 * propósito: quien las llama lo muestra y no cambia estado.
 *
 * Los POST sin cuerpo mandan `{}`: axios con `undefined` omite el body y el
 * parser JSON de Express se queda sin objeto que leer.
 */

export type GrantPayload = { gems?: number; xp?: number; streak?: number };
export type GrantResult = { gems: number; xp: number; streak: number };
export type ResetResult = { deleted: Record<string, number> };
export type CompletedSection = { sectionId: number; name: string };

export async function setAdminModeService(on: boolean): Promise<{ admin_mode: boolean }> {
  const { data } = await api.patch<{ admin_mode: boolean }>("/admin/me/mode", { on });
  return data;
}

export async function resetMyProgressService(): Promise<ResetResult> {
  const { data } = await api.post<ResetResult>("/admin/me/reset", {});
  return data;
}

export async function resetMyFirstRunService(): Promise<{ ok: true }> {
  const { data } = await api.post<{ ok: true }>("/admin/me/first-run/reset", {});
  return data;
}

export async function grantMyselfService(payload: GrantPayload): Promise<GrantResult> {
  const { data } = await api.post<GrantResult>("/admin/me/grant", payload);
  return data;
}

export async function completeCurrentSectionService(): Promise<CompletedSection> {
  const { data } = await api.post<CompletedSection>("/admin/me/complete-current-section", {});
  return data;
}
```

- [ ] **Step 3: Type-check y commit**

Run: `npx tsc --noEmit`
Expected: sin errores.

```bash
git add services/settings.service.ts services/admin-lab.service.ts
git commit -m "feat(admin-lab): fetchers de /admin/me y admin_mode en los ajustes

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 12: Stores puros: modo admin y "mi cuenta cambió"

**Files:**
- Create: `lib/admin-mode.ts`, `lib/admin-mode.test.mjs`
- Create: `lib/account-refresh.ts`, `lib/account-refresh.test.mjs`

**Interfaces:**
- Consumes: `UserSettings` (solo `import type`).
- Produces: `EstadoModoAdmin = "desconocido" | "apagado" | "encendido"`; `estadoModoAdmin()`, `fijarModoAdmin(s)`, `suscribirModoAdmin(fn)`, `modoAdminDesdeAjustes(settings)`; `versionCuenta(): number`, `bumpCuenta()`, `suscribirCuenta(fn)`.

- [ ] **Step 1: Tests que fallan**

`lib/admin-mode.test.mjs`:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  estadoModoAdmin,
  fijarModoAdmin,
  modoAdminDesdeAjustes,
  suscribirModoAdmin,
} from "./admin-mode.ts";

test("nace desconocido", () => {
  assert.equal(estadoModoAdmin(), "desconocido");
});

test("modoAdminDesdeAjustes: solo true explícito enciende", () => {
  assert.equal(modoAdminDesdeAjustes({ admin_mode: true }), "encendido");
  assert.equal(modoAdminDesdeAjustes({ admin_mode: false }), "apagado");
  assert.equal(modoAdminDesdeAjustes({}), "apagado");
  assert.equal(modoAdminDesdeAjustes(null), "apagado");
  assert.equal(modoAdminDesdeAjustes(undefined), "apagado");
});

test("fijar avisa a los suscritos una vez por cambio real", () => {
  let avisos = 0;
  const soltar = suscribirModoAdmin(() => {
    avisos += 1;
  });
  fijarModoAdmin("encendido");
  fijarModoAdmin("encendido");
  assert.equal(estadoModoAdmin(), "encendido");
  assert.equal(avisos, 1);
  fijarModoAdmin("apagado");
  assert.equal(avisos, 2);
  soltar();
  fijarModoAdmin("encendido");
  assert.equal(avisos, 2);
  fijarModoAdmin("desconocido");
});
```

`lib/account-refresh.test.mjs`:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { bumpCuenta, suscribirCuenta, versionCuenta } from "./account-refresh.ts";

test("empieza en 0 y sube de uno en uno", () => {
  const inicial = versionCuenta();
  bumpCuenta();
  assert.equal(versionCuenta(), inicial + 1);
});

test("cada bump avisa a los suscritos; soltar deja de avisar", () => {
  let avisos = 0;
  const soltar = suscribirCuenta(() => {
    avisos += 1;
  });
  bumpCuenta();
  bumpCuenta();
  assert.equal(avisos, 2);
  soltar();
  bumpCuenta();
  assert.equal(avisos, 2);
});
```

- [ ] **Step 2: Correrlos y verlos fallar**

Run: `node --test lib/admin-mode.test.mjs lib/account-refresh.test.mjs`
Expected: FAIL — módulos inexistentes.

- [ ] **Step 3: Implementar**

`lib/admin-mode.ts`:

```ts
import type { UserSettings } from "@/services/settings.service";

/**
 * Modo admin (spec 2026-09-29): el flag vive en el servidor
 * (users.settings.admin_mode) y aquí solo se espeja para esta carga de página.
 * Store de módulo con el mismo patrón que lib/first-run.ts: puro, sin React,
 * solo `import type`, para que `node --test` lo ejecute tal cual.
 *
 * "desconocido" = todavía no se preguntó a /me/settings. La pastilla y el
 * switch no se pintan encendidos hasta que el servidor lo confirme.
 */
export type EstadoModoAdmin = "desconocido" | "apagado" | "encendido";

let estado: EstadoModoAdmin = "desconocido";
const escuchas = new Set<() => void>();

export function estadoModoAdmin(): EstadoModoAdmin {
  return estado;
}

/** Para `useSyncExternalStore`. */
export function suscribirModoAdmin(alCambiar: () => void): () => void {
  escuchas.add(alCambiar);
  return () => {
    escuchas.delete(alCambiar);
  };
}

export function fijarModoAdmin(siguiente: EstadoModoAdmin): void {
  if (estado === siguiente) return;
  estado = siguiente;
  for (const alCambiar of escuchas) alCambiar();
}

/** Traduce la respuesta de GET /me/settings. Ausente, null o fallo = apagado. */
export function modoAdminDesdeAjustes(
  settings: Pick<UserSettings, "admin_mode"> | null | undefined,
): EstadoModoAdmin {
  return settings?.admin_mode === true ? "encendido" : "apagado";
}
```

`lib/account-refresh.ts`:

```ts
/**
 * "Algo de MI cuenta cambió sin navegar" (spec modo admin 2026-09-29). Las
 * acciones de la caja de herramientas lo bumpean; el HUD, el Camino y el
 * arcade lo llevan en las dependencias de su efecto de carga y vuelven a
 * pedir. Sin esto habría que recargar la página, que tira el token en memoria
 * (CLAUDE.md regla 1). Puro, sin React, bajo node --test.
 */
let version = 0;
const escuchas = new Set<() => void>();

export function versionCuenta(): number {
  return version;
}

export function suscribirCuenta(alCambiar: () => void): () => void {
  escuchas.add(alCambiar);
  return () => {
    escuchas.delete(alCambiar);
  };
}

export function bumpCuenta(): void {
  version += 1;
  for (const alCambiar of escuchas) alCambiar();
}
```

- [ ] **Step 4: Correr los tests**

Run: `npm run test:scripts`
Expected: PASS (el script ya recorre `lib/*.test.mjs`).

- [ ] **Step 5: Commit**

```bash
git add lib/admin-mode.ts lib/admin-mode.test.mjs lib/account-refresh.ts lib/account-refresh.test.mjs
git commit -m "feat(admin-lab): stores puros del modo admin y de «mi cuenta cambió»

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 13: Hooks `useAdminMode` y `useAccountVersion`

**Files:**
- Create: `hooks/use-admin-mode.ts`
- Create: `hooks/use-account-version.ts`

**Interfaces:**
- Consumes: Task 12; `useStoredUser` (`hooks/use-stored-user.ts`); `ADMIN_PROFILE` (`constants.ts`); `getMySettingsService`.
- Produces: `useAdminMode(): { esAdmin: boolean; estado: EstadoModoAdmin; encendido: boolean }`; `useAccountVersion(): number`.

- [ ] **Step 1: `hooks/use-admin-mode.ts`**

```ts
"use client";

import { useEffect, useSyncExternalStore } from "react";

import { ADMIN_PROFILE } from "@/constants";
import { useStoredUser } from "@/hooks/use-stored-user";
import {
  estadoModoAdmin,
  fijarModoAdmin,
  modoAdminDesdeAjustes,
  suscribirModoAdmin,
  type EstadoModoAdmin,
} from "@/lib/admin-mode";
import { getMySettingsService } from "@/services/settings.service";

// Single-flight: la pastilla del HUD y el switch de Ajustes pueden montarse a
// la vez; una sola petición a /me/settings las sirve a las dos.
let consulta: Promise<void> | null = null;

function averiguar(): Promise<void> {
  if (!consulta) {
    consulta = getMySettingsService()
      .then((settings) => {
        fijarModoAdmin(modoAdminDesdeAjustes(settings));
      })
      .finally(() => {
        consulta = null;
      });
  }
  return consulta;
}

const servidor = (): EstadoModoAdmin => "desconocido";

/**
 * Estado del modo admin para esta cuenta. Un alumno no paga la petición: sin
 * perfil de admin no se pregunta nada y `encendido` es siempre false. El
 * fetch va en un efecto (no hay setState síncrono: el store avisa cuando
 * responde el servidor).
 */
export function useAdminMode(): {
  esAdmin: boolean;
  estado: EstadoModoAdmin;
  encendido: boolean;
} {
  const user = useStoredUser();
  const esAdmin = user.profile === ADMIN_PROFILE;
  const estado = useSyncExternalStore(suscribirModoAdmin, estadoModoAdmin, servidor);

  useEffect(() => {
    if (!esAdmin || estado !== "desconocido") return;
    void averiguar();
  }, [esAdmin, estado]);

  return { esAdmin, estado, encendido: esAdmin && estado === "encendido" };
}
```

- [ ] **Step 2: `hooks/use-account-version.ts`**

```ts
"use client";

import { useSyncExternalStore } from "react";

import { suscribirCuenta, versionCuenta } from "@/lib/account-refresh";

const servidor = () => 0;

/**
 * Sube cada vez que una acción de la caja de admin cambia la cuenta. Ponlo en
 * las dependencias del efecto de carga y ese efecto vuelve a pedir.
 */
export function useAccountVersion(): number {
  return useSyncExternalStore(suscribirCuenta, versionCuenta, servidor);
}
```

- [ ] **Step 3: Lint, type-check y commit**

Run: `npm run lint && npx tsc --noEmit`
Expected: limpio.

```bash
git add hooks/use-admin-mode.ts hooks/use-account-version.ts
git commit -m "feat(admin-lab): hooks del modo admin (single-flight) y de la versión de cuenta

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 14: El HUD, el Camino y el arcade se refrescan al bumpear la cuenta

**Files:**
- Modify: `components/shell/app-header.tsx:15-27`
- Modify: `components/path/path-container.tsx:50-96`
- Modify: `components/play/arcade-container.tsx:38-51`

**Interfaces:**
- Consumes: `useAccountVersion` (Task 13).

- [ ] **Step 1: AppHeader**

En `components/shell/app-header.tsx`:

```ts
import { useAccountVersion } from "@/hooks/use-account-version";
```

Dentro del componente, antes del `useEffect`:

```ts
  // Vuelve a pedir stats cuando la caja de admin regala gemas/XP/racha o cambia
  // de modo: sin recarga (regla 1). Efecto con dependencia extra a propósito.
  const version = useAccountVersion();
```

y cambia `}, []);` del efecto de stats por `}, [version]);`.

- [ ] **Step 2: PathContainer**

En `components/path/path-container.tsx`: `import { useAccountVersion } from "@/hooks/use-account-version";`; en el componente, justo después de `const router = useRouter();`:

```ts
  // Cambiar de modo admin cambia qué llega `unlocked`: se vuelve a pedir el
  // camino sin navegar.
  const version = useAccountVersion();
```

y cambia la línea `}, [isBootstrapping]);` del primer efecto (el que pide `/path`) por `}, [isBootstrapping, version]);`.

- [ ] **Step 3: ArcadeContainer**

En `components/play/arcade-container.tsx`: `import { useAccountVersion } from "@/hooks/use-account-version";`; tras `const [attempt, setAttempt] = useState(0);`:

```ts
  // El modo admin abre los candados de la grilla: mismo refetch que Reintentar.
  const version = useAccountVersion();
```

y cambia `}, [attempt]);` del primer efecto (el de `getGamesService`) por `}, [attempt, version]);`. El segundo efecto (torneo y diarios) se queda como está.

- [ ] **Step 4: Lint, build y commit**

Run: `npm run lint && npx next build`
Expected: limpio (la dependencia extra en un `useEffect` es válida para `react-hooks/exhaustive-deps`, igual que `attempt`).

```bash
git add components/shell/app-header.tsx components/path/path-container.tsx components/play/arcade-container.tsx
git commit -m "feat(hub): HUD, Camino y arcade vuelven a pedir cuando la cuenta cambia sin navegar

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 15: Switch "Modo admin" en Ajustes

**Files:**
- Create: `components/admin-lab/admin-mode-switch.tsx`
- Modify: `components/profile/settings-sheet.tsx:264-296` (sección Acciones)

**Interfaces:**
- Consumes: `useAdminMode` (Task 13), `setAdminModeService` (Task 11), `fijarModoAdmin` (Task 12), `bumpCuenta` (Task 12).
- Produces: `<AdminModeSwitch subtitle?: string />`, reutilizado por la caja (Task 17).

- [ ] **Step 1: El switch**

`components/admin-lab/admin-mode-switch.tsx`:

```tsx
"use client";

import { useState } from "react";

import { useAdminMode } from "@/hooks/use-admin-mode";
import { bumpCuenta } from "@/lib/account-refresh";
import { fijarModoAdmin } from "@/lib/admin-mode";
import { setAdminModeService } from "@/services/admin-lab.service";

/**
 * Fila "Modo admin" con switch (mismo control visual que "Sonidos" en la hoja
 * de ajustes). Nada optimista: publica en el store solo cuando el PATCH
 * confirma; si falla (backend viejo, red), el switch no se mueve y la fila lo
 * dice. Vive en Ajustes y en la caja de herramientas.
 */
export default function AdminModeSwitch({
  subtitle = "Todo abierto y herramientas de prueba",
}: {
  subtitle?: string;
}) {
  const { estado, encendido } = useAdminMode();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggle = () => {
    if (busy || estado === "desconocido") return;
    const siguiente = !encendido;
    setBusy(true);
    setError(null);
    setAdminModeService(siguiente)
      .then((r) => {
        fijarModoAdmin(r.admin_mode ? "encendido" : "apagado");
        bumpCuenta();
      })
      .catch(() => setError("No se pudo cambiar. ¿El backend está al día?"))
      .finally(() => setBusy(false));
  };

  return (
    <div className="flex items-center justify-between gap-3 py-3">
      <span className="flex min-w-0 flex-col">
        <span className="text-sm font-extrabold text-foreground">Modo admin</span>
        <span className="text-xs font-semibold text-(--muted)">{error ?? subtitle}</span>
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={encendido}
        aria-label="Modo admin"
        aria-busy={busy}
        disabled={estado === "desconocido"}
        onClick={toggle}
        className="relative h-7 w-12 shrink-0 rounded-full transition-transform duration-150 active:scale-95 disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--accent)"
        style={{ background: encendido ? "var(--purple)" : "var(--border)" }}
      >
        <span
          aria-hidden
          className="absolute top-1 left-1 h-5 w-5 rounded-full bg-white transition-transform duration-200"
          style={{ transform: encendido ? "translateX(20px)" : "none" }}
        />
      </button>
    </div>
  );
}
```

- [ ] **Step 2: La sección en Ajustes**

En `components/profile/settings-sheet.tsx`, añade `import AdminModeSwitch from "@/components/admin-lab/admin-mode-switch";` y reemplaza el bloque

```tsx
            {isAdmin && (
              <Link
                href="/admin"
                onClick={onClose}
                className="flex items-center justify-between rounded-2xl bg-(--surface-2) px-4 py-3 text-sm font-extrabold text-foreground"
              >
                Panel de admin
                <Icon name="derecha" size={16} mono />
              </Link>
            )}
```

por nada (se muda abajo), y justo ANTES de `{/* Acciones */}` inserta:

```tsx
          {/* Admin: solo para perfil 1 (spec modo admin 2026-09-29). */}
          {isAdmin && (
            <section className="flex flex-col gap-2 border-t border-(--border) pt-3">
              <span className="text-xs font-bold uppercase tracking-widest text-(--muted)">Admin</span>
              <AdminModeSwitch />
              <Link
                href="/admin"
                onClick={onClose}
                className="flex items-center justify-between rounded-2xl bg-(--surface-2) px-4 py-3 text-sm font-extrabold text-foreground"
              >
                Panel de admin
                <Icon name="derecha" size={16} mono />
              </Link>
            </section>
          )}
```

- [ ] **Step 3: Lint, build y comprobación en preview**

Run: `npm run lint && npx next build`

Preview: `preview_start {name:"dots-webapp"}` y `preview_start {name:"dots-backend"}` (o el watcher). Sergio entra con su cuenta; abrir `/profile` → engranaje → sección "Admin" con el switch. Encenderlo: `read_network_requests` muestra `PATCH /admin/me/mode` 200. Apagarlo: otro 200. Con el backend parado, el switch no se mueve y la fila dice «No se pudo cambiar…».

- [ ] **Step 4: Commit**

```bash
git add components/admin-lab/admin-mode-switch.tsx components/profile/settings-sheet.tsx
git commit -m "feat(ajustes): la sección Admin trae el switch del modo admin y el enlace al panel

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 16: La pastilla ADMIN del HUD

**Files:**
- Create: `components/admin-lab/admin-pill.tsx`
- Create: `components/admin-lab/admin-lab-sheet.tsx` (versión mínima: solo el cascarón, se completa en Task 17)
- Modify: `components/shell/app-header.tsx` (fila del HUD)

**Interfaces:**
- Consumes: `useAdminMode` (Task 13).
- Produces: `<AdminPill />`; `<AdminLabSheet open onClose />` (cascarón).

- [ ] **Step 1: Cascarón de la caja**

`components/admin-lab/admin-lab-sheet.tsx` (mínimo; Task 17 lo reemplaza entero):

```tsx
"use client";

import { useEffect, useRef } from "react";

import { Icon } from "@/components/ui/icon";
import OverlayPortal from "@/components/ui/overlay-portal";
import { bloquearScroll } from "@/lib/scroll-lock";
import AdminModeSwitch from "./admin-mode-switch";

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function AdminLabSheet({ open, onClose }: Props) {
  const panelRef = useRef<HTMLDivElement>(null);

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
    const soltar = bloquearScroll();
    return () => {
      document.removeEventListener("keydown", onKey);
      soltar();
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <OverlayPortal>
      <div className="fixed inset-0 z-50 flex items-end justify-center md:items-stretch md:justify-end">
        <div aria-hidden onClick={onClose} className="absolute inset-0" style={{ background: "var(--scrim)" }} />
        <div
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-label="Modo admin"
          tabIndex={-1}
          className="relative z-10 flex max-h-[85svh] w-full flex-col overflow-y-auto rounded-t-3xl bg-(--surface) px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-4 [animation:dots-slide-up_.25s_ease-out_both] md:max-h-none md:w-[380px] md:rounded-none md:rounded-l-3xl md:pb-5 md:[animation:dots-slide-right_.25s_ease-out_both]"
        >
          <div className="flex items-center justify-between gap-2 pb-2">
            <h2 className="font-display text-xl font-extrabold text-foreground">Modo admin</h2>
            <button
              type="button"
              onClick={onClose}
              aria-label="Cerrar"
              className="rounded-full p-2 text-(--muted) transition-transform duration-150 active:scale-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--accent)"
            >
              <Icon name="cruz" size={20} mono />
            </button>
          </div>
          <section className="border-t border-(--border)">
            <AdminModeSwitch subtitle="Todo abierto. Nadie más ve esto." />
          </section>
        </div>
      </div>
    </OverlayPortal>
  );
}
```

- [ ] **Step 2: La pastilla**

`components/admin-lab/admin-pill.tsx`:

```tsx
"use client";

import { useState } from "react";

import { useAdminMode } from "@/hooks/use-admin-mode";
import AdminLabSheet from "./admin-lab-sheet";

/**
 * Recordatorio permanente de que lo que ves NO es lo que ve un alumno (spec
 * modo admin 2026-09-29). Solo con la lente encendida y confirmada por el
 * servidor. Fondo púrpura y texto blanco: nada de navy como relleno (regla
 * 11), sin icono ni Doty dentro. Abre la caja de herramientas.
 */
export default function AdminPill() {
  const { encendido } = useAdminMode();
  const [open, setOpen] = useState(false);

  if (!encendido) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Modo admin: abrir herramientas"
        className="shrink-0 rounded-full px-2.5 py-1 text-[11px] font-black tracking-widest text-white transition-transform active:scale-95"
        style={{ background: "var(--purple)", boxShadow: "0 2px 0 var(--purple-edge)" }}
      >
        ADMIN
      </button>
      <AdminLabSheet open={open} onClose={() => setOpen(false)} />
    </>
  );
}
```

- [ ] **Step 3: Montarla en el HUD**

En `components/shell/app-header.tsx`: `import AdminPill from "@/components/admin-lab/admin-pill";` y, tras el `</div>` que cierra el bloque "Nivel + XP" (justo antes de `</header>`):

```tsx
      {/* Modo admin: pinta null para todo el mundo salvo un admin con la lente encendida. */}
      <AdminPill />
```

- [ ] **Step 4: Lint, build, preview**

Run: `npm run lint && npx next build`

Preview (sesión de Sergio): con el switch de Ajustes encendido, la pastilla ADMIN aparece a la derecha del HUD en `/levels`, `/review`, `/quests`, `/play` y `/profile`; el Camino se ve con todos los nodos abiertos (vuelve a pedir `/path` por el bump); tocar la pastilla abre la hoja con el switch; apagarlo desde ahí cierra la lente y la pastilla desaparece al cerrar. A 375 px la fila del HUD no desborda (`document.documentElement.scrollWidth <= innerWidth` con `javascript_tool`). Capturar screenshot claro y oscuro.

- [ ] **Step 5: Commit**

```bash
git add components/admin-lab/admin-pill.tsx components/admin-lab/admin-lab-sheet.tsx components/shell/app-header.tsx
git commit -m "feat(hud): la pastilla ADMIN avisa de la lente y abre la caja de herramientas

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 17: La caja de herramientas: HUD, primer inicio, sección actual y dispositivo

**Files:**
- Modify: `lib/install-browser.ts` (añadir `borrarMarca`)
- Modify: `components/admin-lab/admin-lab-sheet.tsx` (reemplazo completo)

**Interfaces:**
- Consumes: Task 11 fetchers; `bumpCuenta`; `borrarEspejo` (`lib/first-run.ts`); `useToast` (`components/admin/ui.tsx`).
- Produces: `borrarMarca(): void` en `lib/install-browser.ts`; la hoja completa salvo el reset (Task 18 añade la confirmación).

- [ ] **Step 1: `borrarMarca`**

En `lib/install-browser.ts`, tras `guardarMarca`:

```ts
/** Olvida la marca: la invitación a instalar vuelve a salir. Lo usa la caja de admin. */
export function borrarMarca(): void {
  try {
    window.localStorage.removeItem(CLAVE_MARCA);
  } catch {
    // modo privado: no había nada que olvidar
  }
}
```

- [ ] **Step 2: La hoja completa**

Reemplaza `components/admin-lab/admin-lab-sheet.tsx` entero por:

```tsx
"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

import { useToast } from "@/components/admin/ui";
import { Icon } from "@/components/ui/icon";
import OverlayPortal from "@/components/ui/overlay-portal";
import { bumpCuenta } from "@/lib/account-refresh";
import { borrarEspejo } from "@/lib/first-run";
import { borrarMarca } from "@/lib/install-browser";
import { bloquearScroll } from "@/lib/scroll-lock";
import {
  completeCurrentSectionService,
  grantMyselfService,
  resetMyFirstRunService,
  type GrantPayload,
} from "@/services/admin-lab.service";
import AdminModeSwitch from "./admin-mode-switch";

/**
 * Caja de herramientas del modo admin (spec 2026-09-29). Misma hoja que
 * Ajustes: inferior en móvil, lateral en escritorio. Todo es tap: sin
 * teclado, sin <input>, sin <select> (regla 2). Cada botón lleva su propio
 * "ocupado"; el resultado se dice en una línea dentro de la hoja (un toast
 * `fixed` dentro del panel animado con transform se posicionaría respecto al
 * panel, no al viewport). Tras cada acción exitosa se bumpea la cuenta para
 * que HUD, Camino y arcade vuelvan a pedir.
 */

interface Props {
  open: boolean;
  onClose: () => void;
}

type Accion = "primer-inicio" | "seccion" | "gemas100" | "gemas1000" | "xp500" | "racha7" | "racha30";

const PALANCAS: Array<{ key: Accion; label: string; payload: GrantPayload }> = [
  { key: "gemas100", label: "+100 gemas", payload: { gems: 100 } },
  { key: "gemas1000", label: "+1000 gemas", payload: { gems: 1000 } },
  { key: "xp500", label: "+500 XP", payload: { xp: 500 } },
  { key: "racha7", label: "Racha de 7", payload: { streak: 7 } },
  { key: "racha30", label: "Racha de 30", payload: { streak: 30 } },
];

function Grupo({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2 border-t border-(--border) pt-3">
      <span className="text-xs font-bold uppercase tracking-widest text-(--muted)">{titulo}</span>
      {children}
    </section>
  );
}

function Boton({
  children,
  subtitle,
  busy,
  danger = false,
  onClick,
}: {
  children: React.ReactNode;
  subtitle?: string;
  busy?: boolean;
  danger?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      aria-busy={busy}
      className="flex items-center justify-between gap-3 rounded-2xl px-4 py-3 text-left text-sm font-extrabold transition-transform duration-150 active:scale-95 disabled:opacity-60"
      style={
        danger
          ? { background: "color-mix(in srgb, var(--danger) 12%, transparent)", color: "var(--danger)" }
          : { background: "var(--surface-2)", color: "var(--foreground)" }
      }
    >
      <span className="flex min-w-0 flex-col">
        <span>{children}</span>
        {subtitle && <span className="text-xs font-semibold text-(--muted)">{subtitle}</span>}
      </span>
      <Icon name="derecha" size={16} mono />
    </button>
  );
}

export default function AdminLabSheet({ open, onClose }: Props) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [ocupado, setOcupado] = useState<Accion | null>(null);
  const [aviso, decir] = useToast();

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
    const soltar = bloquearScroll();
    return () => {
      document.removeEventListener("keydown", onKey);
      soltar();
    };
  }, [open, onClose]);

  if (!open) return null;

  const correr = (key: Accion, tarea: () => Promise<string>) => {
    if (ocupado) return;
    setOcupado(key);
    tarea()
      .then((texto) => {
        bumpCuenta();
        decir(texto);
      })
      .catch(() => decir("No salió. Revisa el backend.", "error"))
      .finally(() => setOcupado(null));
  };

  const palanca = (key: Accion, payload: GrantPayload, label: string) =>
    correr(key, () => grantMyselfService(payload).then(() => `Listo: ${label}.`));

  const primerInicio = () =>
    correr("primer-inicio", () =>
      resetMyFirstRunService().then(() => {
        borrarEspejo();
        return "La bienvenida vuelve a salir al entrar.";
      }),
    );

  const seccion = () =>
    correr("seccion", () =>
      completeCurrentSectionService().then((s) => `«${s.name}» completada.`),
    );

  const olvidarDispositivo = () => {
    borrarMarca();
    borrarEspejo();
    decir("Este dispositivo ya no recuerda los avisos.");
  };

  return (
    <OverlayPortal>
      <div className="fixed inset-0 z-50 flex items-end justify-center md:items-stretch md:justify-end">
        <div aria-hidden onClick={onClose} className="absolute inset-0" style={{ background: "var(--scrim)" }} />
        <div
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-label="Modo admin"
          tabIndex={-1}
          className="relative z-10 flex max-h-[85svh] w-full flex-col overflow-y-auto rounded-t-3xl bg-(--surface) px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-4 [animation:dots-slide-up_.25s_ease-out_both] md:max-h-none md:w-[380px] md:rounded-none md:rounded-l-3xl md:pb-5 md:[animation:dots-slide-right_.25s_ease-out_both]"
        >
          <div className="flex items-center justify-between gap-2 pb-2">
            <h2 className="font-display text-xl font-extrabold text-foreground">Modo admin</h2>
            <button
              type="button"
              onClick={onClose}
              aria-label="Cerrar"
              className="rounded-full p-2 text-(--muted) transition-transform duration-150 active:scale-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--accent)"
            >
              <Icon name="cruz" size={20} mono />
            </button>
          </div>

          {/* Resultado de la última acción, dentro de la hoja. */}
          <p
            role="status"
            aria-live="polite"
            className="min-h-5 text-xs font-bold"
            style={{ color: aviso ? (aviso.kind === "ok" ? "var(--success)" : "var(--danger)") : "transparent" }}
          >
            {aviso?.text ?? "·"}
          </p>

          <section className="border-t border-(--border)">
            <AdminModeSwitch subtitle="Todo abierto. Nadie más ve esto." />
          </section>

          <Grupo titulo="Progreso">
            <Boton busy={ocupado === "primer-inicio"} onClick={primerInicio}>
              Repetir el primer inicio
            </Boton>
            <Boton
              busy={ocupado === "seccion"}
              subtitle="Escribe progreso de verdad, como el placement"
              onClick={seccion}
            >
              Completar la sección actual
            </Boton>
          </Grupo>

          <Grupo titulo="HUD">
            <div className="grid grid-cols-2 gap-2">
              {PALANCAS.map((p) => (
                <button
                  key={p.key}
                  type="button"
                  disabled={ocupado !== null}
                  aria-busy={ocupado === p.key}
                  onClick={() => palanca(p.key, p.payload, p.label)}
                  className="rounded-2xl bg-(--surface-2) px-3 py-2.5 text-sm font-extrabold text-foreground transition-transform duration-150 active:scale-95 disabled:opacity-60"
                >
                  {p.label}
                </button>
              ))}
            </div>
          </Grupo>

          <Grupo titulo="Este dispositivo">
            <Boton subtitle="La invitación a instalar y la bienvenida local" onClick={olvidarDispositivo}>
              Olvidar avisos de instalación
            </Boton>
          </Grupo>

          <section className="flex flex-col gap-2 border-t border-(--border) pt-3">
            <Link
              href="/admin"
              onClick={onClose}
              className="flex items-center justify-between rounded-2xl bg-(--surface-2) px-4 py-3 text-sm font-extrabold text-foreground"
            >
              Panel de admin
              <Icon name="derecha" size={16} mono />
            </Link>
          </section>
        </div>
      </div>
    </OverlayPortal>
  );
}
```

- [ ] **Step 3: Lint, build, preview**

Run: `npm run lint && npx next build`

Preview (sesión de Sergio, lente encendida): tocar «+100 gemas» → `POST /admin/me/grant` 200, la línea de estado dice «Listo: +100 gemas.» y el contador de gemas del HUD sube sin recargar (el bump). «Racha de 7» enciende la llama. «Olvidar avisos de instalación»: `localStorage.getItem("dots.install.aviso")` pasa a `null`. NO tocar «Repetir el primer inicio» ni «Completar la sección actual» con la cuenta de Sergio salvo que él lo pida en ese momento (la primera le repite la bienvenida; la segunda escribe progreso).

- [ ] **Step 4: Commit**

```bash
git add lib/install-browser.ts components/admin-lab/admin-lab-sheet.tsx
git commit -m "feat(admin-lab): la caja de herramientas — palancas del HUD, primer inicio, sección actual y dispositivo

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 18: «Reiniciar todo» en dos pasos

**Files:**
- Modify: `components/admin-lab/admin-lab-sheet.tsx`

**Interfaces:**
- Consumes: `resetMyProgressService` (Task 11); `clearAvatarMirror` (`lib/avatar-mirror.ts`); `borrarEspejo`, `fijarPrimerInicio` (`lib/first-run.ts`); `useRouter`.

- [ ] **Step 1: Imports y estado**

En `admin-lab-sheet.tsx` añade:

```tsx
import { useRouter } from "next/navigation";
import Doty from "@/components/ui/doty/doty";
import { clearAvatarMirror } from "@/lib/avatar-mirror";
import { fijarPrimerInicio } from "@/lib/first-run"; // fusiona con el import de borrarEspejo
import { resetMyProgressService } from "@/services/admin-lab.service"; // fusiona con el import existente
```

Amplía el tipo `Accion` con `| "reset"`. Dentro del componente, junto a los otros `useState`:

```tsx
  const router = useRouter();
  // Dos pasos: el primer tap solo abre la confirmación; nada se borra sin el segundo.
  const [confirmando, setConfirmando] = useState(false);

  // `if (!open) return null` no desmonta el estado: sin esto, la confirmación
  // quedaría abierta al volver a abrir la hoja. Se resetea desde los
  // manejadores de cierre, nunca desde un efecto (regla 3).
  const cerrar = () => {
    setConfirmando(false);
    onClose();
  };
```

Usa `cerrar` en el `onClick` del fondo (`aria-hidden`) y en el botón «Cerrar». En el `useEffect` de Escape deja las dependencias `[open, onClose]` tal cual y cambia el cuerpo del manejador a:

```tsx
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setConfirmando(false);
      onClose();
    };
```

(Llamar a `setConfirmando` dentro de un listener de evento no es un `setState` síncrono en el cuerpo del efecto; y así el efecto no depende de `cerrar`, que cambia en cada render.)

- [ ] **Step 2: La acción**

Tras `seccion`:

```tsx
  const reiniciar = () =>
    correr("reset", () =>
      resetMyProgressService().then(({ deleted }) => {
        // Este dispositivo también olvida: sin esto la bienvenida no saldría
        // (espejo dots-onboarded) y la cara sería la anterior un instante.
        borrarEspejo();
        clearAvatarMirror();
        fijarPrimerInicio("pendiente");
        const filas = Object.values(deleted).reduce((a, b) => a + b, 0);
        // Directo a /welcome y no a /levels: FirstRunGate ya corrió en esta
        // carga y no volvería a preguntar. La bienvenida estampa onboarded y
        // sigue al placement, el mismo recorrido de un alumno recién invitado.
        router.push("/welcome");
        onClose();
        return `Cuenta como recién invitada (${filas} filas menos).`;
      }),
    );
```

- [ ] **Step 3: La confirmación en el grupo Progreso**

Reemplaza el `<Grupo titulo="Progreso">…</Grupo>` por:

```tsx
          <Grupo titulo="Progreso">
            {confirmando ? (
              <div
                className="flex flex-col items-center gap-3 rounded-2xl px-4 py-4 text-center"
                style={{ background: "color-mix(in srgb, var(--danger) 8%, var(--surface-2))" }}
              >
                <Doty pose="oh-no" size="tiny" animation="sad" />
                <p className="font-display text-base font-extrabold text-foreground">
                  ¿Borrar todo tu progreso?
                </p>
                <p className="text-xs font-semibold text-(--muted)">
                  Se va: camino, repaso, placement, checkpoints, récords y ghosts, torneo,
                  gemas e inventario, bienvenida y pistas.
                </p>
                <p className="text-xs font-semibold text-(--muted)">
                  Se queda: retos 1v1, tema y el modo admin.
                </p>
                <div className="grid w-full grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setConfirmando(false)}
                    disabled={ocupado === "reset"}
                    className="rounded-2xl bg-(--surface) px-3 py-2.5 text-sm font-extrabold text-foreground transition-transform duration-150 active:scale-95"
                  >
                    Mejor no
                  </button>
                  <button
                    type="button"
                    onClick={reiniciar}
                    disabled={ocupado !== null}
                    aria-busy={ocupado === "reset"}
                    className="rounded-2xl px-3 py-2.5 text-sm font-extrabold text-white transition-transform duration-150 active:scale-95 disabled:opacity-60"
                    style={{ background: "var(--danger)", boxShadow: "0 3px 0 var(--danger-edge)" }}
                  >
                    Sí, borrar mi progreso
                  </button>
                </div>
              </div>
            ) : (
              <Boton danger subtitle="Cuenta como recién invitada" onClick={() => setConfirmando(true)}>
                Reiniciar todo
              </Boton>
            )}
            <Boton busy={ocupado === "primer-inicio"} onClick={primerInicio}>
              Repetir el primer inicio
            </Boton>
            <Boton
              busy={ocupado === "seccion"}
              subtitle="Escribe progreso de verdad, como el placement"
              onClick={seccion}
            >
              Completar la sección actual
            </Boton>
          </Grupo>
```

Comprueba que `--danger-edge` existe en `lib/theme-colors.ts` (`grep danger-edge lib/theme-colors.ts`); si no, usa `boxShadow: "none"`.

- [ ] **Step 4: Lint, build, preview del primer paso**

Run: `npm run lint && npx next build`

Preview (sesión de Sergio): tocar «Reiniciar todo» muestra la confirmación con Doty `oh-no`; «Mejor no» vuelve atrás sin ninguna petición de red (`read_network_requests` no muestra `/admin/me/reset`). **No** confirmar con la cuenta de Sergio. El segundo paso se prueba en Task 19 con cuenta de prueba.

- [ ] **Step 5: Commit**

```bash
git add components/admin-lab/admin-lab-sheet.tsx
git commit -m "feat(admin-lab): «Reiniciar todo» en dos pasos, con Doty avisando y la lista de lo que se va

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 19: Documentación, verificación completa y prueba del reset con cuenta de prueba

**Files:**
- Modify: `docs/ARQUITECTURA.md` (tras «El perfil»)
- Modify: `CLAUDE.md` (regla 13)

- [ ] **Step 1: Documentar en el frontend**

En `docs/ARQUITECTURA.md`, tras la subsección «El perfil (`/profile`)» y antes de «Avatares», añade:

```md
### Modo admin (`components/admin-lab/`)

Spec: `docs/superpowers/specs/2026-09-29-modo-admin-design.md`. Una cuenta con perfil 1
tiene dos estados. *Modo alumno* (por defecto): la app tal cual, con candados reales; la
única señal es la sección «Admin» de la hoja de ajustes (switch + enlace al panel). *Modo
admin*: el backend reporta todo `unlocked` (es una lente en `users.settings.admin_mode`,
NO se escribe progreso) y en el HUD sale la pastilla ADMIN (`admin-pill.tsx`), que abre la
caja (`admin-lab-sheet.tsx`): reiniciar la cuenta en dos pasos, repetir el primer inicio,
completar la sección actual (la única que escribe progreso), palancas de gemas/XP/racha y
«olvidar avisos» del dispositivo. El estado del modo se espeja en `lib/admin-mode.ts`
(store puro, single-flight de `/me/settings` en `hooks/use-admin-mode.ts`, solo para
admins) y las acciones bumpean `lib/account-refresh.ts`, que HUD, Camino y arcade llevan
en las dependencias de su efecto de carga para volver a pedir sin recargar. Tras el reset
se navega a `/welcome` (no a `/levels`: `FirstRunGate` ya corrió en esa carga). Fetchers en
`services/admin-lab.service.ts`.
```

En `CLAUDE.md`, tras la regla 12, añade:

```md
13. **Modo admin.** El desbloqueo total de un admin es una LENTE del servidor (`users.settings.admin_mode`, leída por `AdminModeService` en el backend): nunca se escribe progreso para abrir candados, y nunca se ignora `unlocked` en el frontend por ser admin. Las acciones sobre la propia cuenta van por `/admin/me/*` (`services/admin-lab.service.ts`); tras cada una, `bumpCuenta()` de `lib/account-refresh.ts` es lo que refresca HUD, Camino y arcade sin recargar. Spec: `docs/superpowers/specs/2026-09-29-modo-admin-design.md`.
```

- [ ] **Step 2: Verificación completa del frontend**

Run: `npm run lint && npx next build && npm run test:scripts`
Expected: todo verde; el build no lista rutas nuevas (no se añadió ninguna página).

- [ ] **Step 3: Recorrido completo en preview con la cuenta de Sergio (acciones reversibles)**

Con backend (`feat/modo-admin`) y frontend levantados, Sergio entra:

1. `/profile` → Ajustes → sección Admin: switch apagado; el Camino muestra candados reales.
2. Encender el switch → pastilla ADMIN en el HUD; `/levels` sin candados; `/play` sin tiles grises; el popover de un nodo lejano abre y navega a su lección.
3. Pastilla → caja: «+100 gemas» y «Racha de 7» → HUD actualizado sin recarga (misma pestaña, sin navegación). «Olvidar avisos» → marca borrada.
4. Apagar desde la caja → pastilla fuera al cerrar; `/levels` recupera candados.
5. Móvil 375 px y escritorio, claro y oscuro: screenshots de HUD con pastilla y de la caja abierta. Sin scroll horizontal.
6. Con el backend parado: el switch no se mueve y explica el fallo; la pastilla no aparece al recargar.

- [ ] **Step 4: Prueba del reset y de «completar sección» con cuenta de prueba (requiere consentimiento)**

El reset borra progreso real en la BD compartida. Antes de esto, pedir a Sergio en la conversación una frase explícita del tipo «sí, promueve la cuenta de prueba» (regla 1 del backend). Con ella:

1. Un `UPDATE` de una fila desde un script `pg` en el scratchpad (patrón de la memoria «invitaciones»: `NODE_PATH` del backend, `ssl: { rejectUnauthorized: false }`, credenciales de `dots-backend/.env`):

```sql
UPDATE dots.users SET profile = 1, blocked = false WHERE id = 9 AND username = 'dotstest_invitacion';
```

2. Sergio (o quien tenga la contraseña de esa cuenta; nunca se teclea desde aquí) entra con `dotstest_invitacion` en el preview; encender la lente; «Completar la sección actual» → `/levels` muestra esa sección al 100 %; «Reiniciar todo» → confirmar → aterriza en `/welcome`, luego placement; `GET /me/stats` en 0; `/admin/me/reset` devolvió `deleted` con conteos.
3. Revertir: `UPDATE dots.users SET profile = 0, blocked = true WHERE id = 9;` (mismo consentimiento).

Sin consentimiento: dejar este paso documentado como NO ejecutado en el mensaje final; el reset queda cubierto solo por los tests del backend.

- [ ] **Step 5: Commit final del frontend**

```bash
git add docs/ARQUITECTURA.md CLAUDE.md
git commit -m "docs: modo admin — lente del servidor, caja de herramientas y regla 13

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

- [ ] **Step 6: Cierre**

Invocar `superpowers:finishing-a-development-branch` para las dos ramas (`feat/modo-admin` en dots-backend, la del worktree en dots-webapp). Orden de despliegue: backend primero.
