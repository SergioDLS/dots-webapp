# Modo admin: probar como alumno y como admin — diseño

**Fecha:** 2026-09-29
**Repos afectados:** `dots-webapp` y `dots-backend`
**Estado:** aprobado en conversación, pendiente de plan de implementación

## Problema

Quien administra dots necesita dos cosas que hoy no tiene: ver la app con todo
abierto para revisar cualquier lección, juego o checkpoint sin ganárselo, y
volver a empezar de cero para vivir el flujo de un alumno recién invitado. Y
necesita poder alternar entre las dos vistas sin cambiar de cuenta.

Lo que el código muestra:

1. **Una cuenta de admin ya es una cuenta de alumno.** El perfil 1 solo abre
   `/admin/*` (guardado en servidor por `AdminGuard`, que reconsulta el perfil
   en cada petición) y el enlace "Panel de admin" en Ajustes. Camino, gemas,
   racha, juegos y tienda funcionan igual que para cualquiera. "Probar como
   alumno" ya es el estado por defecto; falta el estado "como admin" y el
   interruptor entre los dos.
2. **Los candados son casi todos de pintura.** El backend calcula `unlocked`
   en cuatro sitios (camino, niveles, juegos, lecturas) pero la única ruta que
   lo aplica de verdad es arrancar un checkpoint (`CheckpointService.start`),
   y esa lo lee del mismo `getPath` que pinta el camino. Abrir todo es, por
   tanto, cambiar lo que el servidor *reporta*, sin escribir progreso.
3. **El progreso vive en 16 tablas** más nueve columnas de `users` (xp,
   xp_week, week_start, streak, best_streak, last_streak_day, streak_freezes,
   gems, xp_boost_until, current_level) y tres claves de `settings`
   (`onboarded_at`, `tips_seen`, `avatar_key`). Cuatro tablas son visibles
   para otros: récords de juegos (el trono), corridas de ghost-race, puntajes
   del torneo y retos 1v1.
4. **No existe ningún endpoint** para reiniciar, impersonar ni actuar sobre la
   propia cuenta. Lo más cercano es `scripts/unlock-path.js`, un script sin
   trackear que abre el camino escribiendo `section_test = true`: ensucia el
   progreso (todo sale al 100 %) y no se deshace sin un reset.

## Decisiones tomadas en conversación

- **"Probar como alumno" = la propia cuenta con sus candados reales.** No se
  impersona a nadie. Impersonar a un alumno concreto queda para una segunda
  fase (ver "Fuera de alcance").
- **Enfoque A, lente en el servidor.** Un flag `admin_mode` en
  `users.settings`. Encendido, el backend reporta todo desbloqueado; apagado,
  la vista es exactamente la de un alumno. No se toca ninguna tabla de
  progreso para desbloquear. Descartados: escribir el progreso (lo que hace el
  script) y hacerlo solo en el frontend (el checkpoint sí está verjado y el
  reset necesita backend igual).
- **Todo actúa sobre la propia cuenta.** Ningún endpoint nuevo recibe un id
  de usuario: el sujeto es siempre el del token.
- **Se incluyen las palancas del HUD** (gemas, XP, racha) y "Completar la
  sección actual", aprobadas tal cual.

## Concepto

Una cuenta con perfil 1 tiene dos estados:

- **Modo alumno (por defecto).** La app se comporta como para cualquier
  estudiante, con el progreso y los candados reales. La única señal de ser
  admin es una sección "Admin" al final de la hoja de Ajustes, con el
  interruptor y el enlace al panel.
- **Modo admin.** Camino, niveles, juegos y lecturas llegan desbloqueados; el
  checkpoint se puede arrancar en cualquier sección y sin límite diario; en el
  HUD de las pantallas hub aparece una pastilla "ADMIN" que abre la caja de
  herramientas. La pastilla es el recordatorio permanente de que lo que ves no
  es lo que ve un alumno. El interruptor de apagado está también dentro de la
  caja.

Los flujos inmersivos (lección, práctica, checkpoint, juegos, lecturas,
onboarding) no tienen HUD y no llevan pastilla: el desbloqueo viene del
servidor y ahí no hace falta nada.

El flag vive en el servidor (jsonb ya existente, sin migración), así que se
respeta en cualquier dispositivo y el backend lo lee sin que el frontend mande
nada especial. El progreso, `current` y `completed` siguen siendo los reales
en los dos modos.

## Backend

### El flag

- `src/common/user-settings.ts`: `UserSettings.admin_mode: boolean`
  (`DEFAULT_SETTINGS.admin_mode = false`); `normalizeSettings` lo lee como
  booleano estricto. `SettingsPatch` y `PatchSettingsDto` **no** lo aceptan:
  `PATCH /me/settings` no puede encenderlo ni por accidente (el `whitelist`
  global lo descarta).
- `ADMIN_PROFILE` sale de `admin.guard.ts` a `src/common/admin-profile.ts`,
  importado por el guard y por el helper de abajo.
- `GET /me/settings` devuelve `admin_mode`, forzado a `false` si
  `user.profile !== ADMIN_PROFILE`: un admin degradado pierde la lente en la
  siguiente lectura.

### Dónde se lee: `AdminModeService`

Módulo standalone `src/modules/admin-mode/` (solo depende de `Users`), con un
único método `isOn(userId): Promise<boolean>`: una consulta a `users` y
`profile === ADMIN_PROFILE && normalizeSettings(settings).admin_mode`. Doble
cerrojo: aunque un alumno lograra escribir el flag, el perfil manda.

Quién lo consulta y qué cambia:

| Servicio | Cambio con la lente encendida |
|---|---|
| `PathService.getPath` | `sectionUnlocked` y `unlocked` de cada nodo son `true`; `checkpointAvailable = !skipped && oraciones >= CHECKPOINT_MIN_SENTENCES` (el mínimo de contenido se conserva porque sin oraciones no hay examen). `current`, `progress`, `completed`, `skipped` y `placementPending` no cambian. |
| `CheckpointService.start` | La verja de `unlocked`/`checkpointAvailable` ya se abre sola porque lee `getPath`. Además salta el límite de 3 intentos por día. El rechazo "sección ya superada por test" se mantiene. |
| `LevelsService.getLevels` | `completedLevels` se sustituye por el centinela `ALL_LEVELS = 1_000_000` (cabe en `int4`): `unlocked` true y `levels_left` 0. |
| `GamesService.completedLevels` | Mismo centinela. Es el único punto del módulo: abre `getGames` (`unlocked` true, `levelsLeft` 0, `tournamentPass` false) y también los filtros de contenido por nivel de dont-pop y dotaxi, para que en modo admin no fallen por falta de frases. |
| `ReadingsService.getReadings` | Mismo centinela: todas las lecturas `unlocked`. |

Fuera de eso nada cambia: `PUT /sentences/progress`, `PUT /path/nodes/:id/progress`,
`POST /games/score`, gemas por lección y torneo siguen su lógica normal. Si el
admin juega en modo admin, gana XP y gemas como cualquiera; es su cuenta.

### Endpoints nuevos: `admin/me`

Controlador `src/modules/admin/admin-me.controller.ts`
(`@Controller('admin/me')`, `@UseGuards(AdminGuard)` a nivel de clase) y
servicio `admin-me.service.ts`. El id sale del `req.user` que fija
`AdminGuard`, igual que el guard de "no te bloquees a ti mismo". Ninguna ruta
recibe id de usuario.

**`PATCH /admin/me/mode`** — body `{ on: boolean }` (`IsBoolean`). Escribe
`settings.admin_mode` con `usersRepository.update` (no `save`, por el mismo
motivo que `patchSettings`). Devuelve `{ admin_mode }`.

**`POST /admin/me/reset`** — deja la cuenta como recién invitada. Una sola
transacción (`dataSource.transaction`), SQL parametrizado:

- Borra las filas del usuario en: `levels_progress` (`id_user`),
  `section_progress`, `difficulty_progress`, `node_progress`,
  `item_progress`, `sentences_progress`, `review_items`, `placement_tests`,
  `checkpoint_attempts`, `daily_use` (`id_user`), `daily_game_state`,
  `user_game_scores` (`id_user`), `game_runs`, `tournament_scores`,
  `gem_ledger`, `user_items` (todas `user_id` salvo donde se indica).
- `UPDATE users SET xp=0, xp_week=0, week_start=NULL, streak=0,
  best_streak=0, last_streak_day=NULL, streak_freezes=0, gems=0,
  xp_boost_until=NULL, current_level=NULL,
  settings = settings - 'onboarded_at' - 'tips_seen' - 'avatar_key'`.
- **Conserva**: paleta, modo, sonido y `admin_mode` en `settings`; `profile`,
  `blocked`, `expires`, contraseña y datos personales; `invitations` (no es
  progreso); `challenges` (involucran a otra persona: se dejan tal cual y la
  confirmación lo dice).
- Devuelve `{ deleted: { <tabla>: <filas> } }` para el toast.

La lista de tablas vive en un módulo puro `admin-me.reset.ts`
(`RESET_TABLES` y `KEPT_TABLES`) con un test que recorre
`getMetadataArgsStorage()` de TypeORM: toda entidad con una columna
`user_id`, `id_user`, `challenger_id` o `challenged_id` debe estar en una de
las dos listas. Una tabla nueva de progreso que nadie clasificó rompe la
suite.

**`POST /admin/me/first-run/reset`** — `settings = settings - 'onboarded_at'
- 'tips_seen'`. Para volver a ver la bienvenida y las pistas sin perder nada.
Devuelve `{ ok: true }`.

**`POST /admin/me/grant`** — body `{ gems?, xp?, streak? }`, al menos uno
(`IsInt`, `gems` 1..100000, `xp` 1..1000000, `streak` 0..3650).

- `gems`: delta, vía `awardGems(manager, id, gems, 'admin_grant')` (regla del
  backend: gemas solo por esa función).
- `xp`: delta sobre `users.xp` solamente (el nivel se deriva de xp;
  `xp_week` no se toca: es contabilidad del ranking semanal).
- `streak`: valor absoluto; `best_streak = GREATEST(best_streak, $n)` y
  `last_streak_day = santiagoToday()` (de `src/common/santiago-day`) para
  que la llama se encienda. `streak = 0` apaga la racha y deja
  `last_streak_day` en NULL.

Devuelve `{ gems, xp, streak }` finales.

**`POST /admin/me/complete-current-section`** — localiza la sección del nodo
`current` con `pathService.getPath` (la lente no altera `current`) y aplica
`SkipApplierService.skipSection(userId, sectionId)`, la misma maquinaria del
placement. 404 si no hay nodo actual (camino terminado). Devuelve
`{ sectionId, name }`. Es el único endpoint nuevo que escribe progreso, y su
botón lo dice.

`AdminModule` importa `PathModule` para `PathService` y `SkipApplierService`;
`PathModule`, `LevelsModule`, `GamesModule` y `ReadingsModule` importan
`AdminModeModule`. No hay ciclo: `AdminModeModule` no importa a nadie.

### Limpieza

`scripts/unlock-path.js` (sin trackear) se elimina: queda obsoleto.

## Frontend

### Servicios y tipos

- `services/settings.service.ts`: `UserSettings.admin_mode?: boolean`
  (opcional: un backend viejo no lo manda y eso significa apagado).
- `services/admin-lab.service.ts`: `setAdminModeService(on)`,
  `resetMyProgressService()`, `resetMyFirstRunService()`,
  `grantMyselfService({ gems?, xp?, streak? })`,
  `completeCurrentSectionService()`. Propagan el error: quien los llama
  muestra el fallo.

### Estado compartido (lógica pura, con tests)

- `lib/admin-mode.ts`: store de módulo con el mismo patrón que
  `lib/first-run.ts`: `estadoModoAdmin(): "desconocido" | "apagado" |
  "encendido"`, `fijarModoAdmin`, `suscribirModoAdmin`, más
  `modoAdminDesdeAjustes(settings)` que traduce `admin_mode` (ausente =
  apagado).
- `lib/account-refresh.ts`: contador puro `versionCuenta()`, `bumpCuenta()`,
  `suscribirCuenta()`. Significa "algo de mi cuenta cambió sin navegar".
- `hooks/use-admin-mode.ts`: `useSyncExternalStore` sobre el store. Solo si
  `useStoredUser().profile === ADMIN_PROFILE` y el estado es "desconocido"
  pide `/me/settings` una vez (single-flight en el store) y publica. Un
  alumno no paga la petición. No escribe `localStorage.user`, así que la
  caché de `useStoredUser` no se ve afectada.
- `hooks/use-account-version.ts`: `useSyncExternalStore` sobre el contador.

### Quién se refresca

`AppHeader` (stats), `PathContainer` (camino) y `ArcadeContainer` (juegos)
añaden la versión de cuenta a las dependencias de su efecto de carga: al
bumpear, vuelven a pedir. Cambiar de modo o regalarse gemas se ve al instante,
sin recargar y sin `window.location` (regla 1). Los efectos siguen sin
`setState` síncrono en el cuerpo (regla 3): solo disparan el fetch.

### Ajustes (`components/profile/settings-sheet.tsx`)

Para admins, una sección "Admin" al final, antes de "Cerrar sesión": fila
"Modo admin" con el mismo switch visual que "Sonidos" (subtítulo: "Todo
abierto y herramientas de prueba") y debajo el enlace "Panel de admin" que
ya existe. El switch llama a `setAdminModeService`, y al confirmar publica en
el store y bumpea la cuenta; si falla, vuelve a su posición y muestra el
error en la fila. Nada optimista: un 404 de backend viejo no puede dejar el
switch encendido.

### Pastilla (`components/admin-lab/admin-pill.tsx`)

Montada al final de la fila de `AppHeader`, renderiza solo con el modo
encendido. Botón con texto "ADMIN", fondo `var(--purple)` y borde inferior
`var(--purple-edge)`, texto blanco, sin icono ni Doty (regla 11: nada de
navy como relleno, nada de Doty dentro de iconos). `aria-label="Modo admin:
abrir herramientas"`. Abre la caja; el estado de apertura vive en la
pastilla.

### Caja de herramientas (`components/admin-lab/admin-lab-sheet.tsx`)

Misma hoja que Ajustes (inferior en móvil, lateral en escritorio, misma
`OverlayPortal`, bloqueo de scroll y cierre con Escape). Todo es tap: sin
teclado, sin `<input>`, sin `<select>`. Contenido, de arriba abajo:

1. Cabecera "Modo admin" con el switch de apagado y el subtítulo "Todo
   abierto. Nadie más ve esto."
2. **Progreso**: "Reiniciar todo", "Repetir el primer inicio", "Completar la
   sección actual" (subtítulo: "Escribe progreso de verdad, como el
   placement").
3. **HUD**: "+100 gemas", "+1000 gemas", "+500 XP", "Racha de 7", "Racha de
   30".
4. **Este dispositivo**: "Olvidar avisos de instalación": borra la marca
   `dots.install.aviso` (`lib/install-browser.ts`) y el espejo
   `dots-onboarded`. Solo frontend.
5. Enlace "Panel de admin".

Cada botón tiene su propio `busy`; el resultado se muestra con
`useToast`/`ToastBanner` de `components/admin/ui.tsx` (son genéricos), en
español. Tras cada acción exitosa: `bumpCuenta()`.

**Reiniciar todo** va en dos pasos dentro de la hoja: el primer tap
reemplaza el grupo por una confirmación con Doty en pose `oh-no`, el título
"¿Borrar todo tu progreso?", la lista de lo que se borra (camino, repaso,
placement, checkpoints, récords y ghosts, torneo, gemas e inventario,
bienvenida y pistas) y lo que se conserva (retos 1v1, tema, modo admin), y
dos botones: "Sí, borrar mi progreso" (`--danger`) y "Mejor no". Al
confirmar: `resetMyProgressService()`, luego `borrarEspejo()` (primer
inicio), `clearAvatarMirror()`, `fijarPrimerInicio("pendiente")` y
`router.push("/welcome")`. Se va directo a la bienvenida y no a `/levels`
porque `FirstRunGate` ya corrió en esta carga y no volvería a preguntar; la
bienvenida estampa `onboarded` y sigue al placement o al Camino, el mismo
recorrido de un alumno recién invitado.

Copy en español, tono juguetón coherente con el resto del hub (no con el
panel `/admin`, que está en inglés: la caja vive en la app del alumno, no en
el panel).

## Errores y seguridad

- Todos los endpoints nuevos pasan por `AdminGuard`, que reconsulta el perfil
  en la BD en cada petición. `admin_mode` no es escribible por
  `/me/settings`, y la lente exige perfil 1 aunque el flag esté encendido.
- El reset no tiene parámetros: es imposible apuntarlo a otra cuenta. La
  transacción garantiza todo o nada.
- `grant` acota cada valor con class-validator; las gemas pasan por el
  ledger con motivo `admin_grant`, así que quedan auditadas.
- Frontend: si un endpoint no existe (backend viejo), el switch y los botones
  muestran el error y no cambian estado. La pastilla solo aparece cuando el
  backend confirmó el flag.
- Los cambios en los cuatro servicios de gating son de una línea cada uno y
  caen a la conducta actual si `isOn` devuelve `false` o falla (try/catch
  → `false`): un error en la lente nunca abre nada.

## Pruebas

- **Backend (jest, `npm test` verde):** `user-settings.spec.ts` ampliado
  (`admin_mode` normaliza y no entra por `mergeSettings`);
  `admin-me.reset.spec.ts` (cobertura de tablas contra los metadatos de
  TypeORM); `admin-me.dto.spec.ts` (límites de `grant`); un spec del helper
  de lente con repositorio falso (perfil 0 con flag = false; perfil 1 sin
  flag = false; perfil 1 con flag = true; error = false). `npm run build`.
- **Frontend (node:test, `npm run test:scripts`, que ya recorre `lib/*.test.mjs`):**
  `lib/admin-mode.test.mjs`, `lib/account-refresh.test.mjs`. `npm run lint`
  y `npx next build`.
- **En vivo (preview):** hace falta una cuenta con perfil 1 que no sea la de
  Sergio, porque el reset borra progreso real en la BD compartida. Opción:
  reactivar `dotstest_invitacion` (id 9) y ponerle perfil 1 con un `UPDATE`
  de una fila. Ese `UPDATE` toca producción y requiere consentimiento
  explícito en la conversación (regla 1 del backend); sin él, la
  verificación en vivo se limita a encender la lente y las palancas del HUD
  con la cuenta de Sergio, y el reset se prueba solo con los tests.
- Verificación visual: móvil a 375 px y escritorio, claro y oscuro, con la
  pastilla y la hoja abiertas.

## Despliegue

Backend primero, frontend después. Con el frontend nuevo y el backend viejo:
la pastilla no aparece (el flag llega indefinido = apagado), el switch de
Ajustes da error al tocarlo y todo lo demás sigue igual. Con el backend nuevo
y el frontend viejo: no cambia nada visible, porque el flag nace apagado.

## Fuera de alcance (segunda fase)

- Impersonar a un alumno concreto ("ver como Juan").
- Editar el progreso de otros usuarios desde `/admin/users`.
- Un indicador por nodo de "abierto por admin": la pastilla global basta.
- Pastilla en los flujos inmersivos.
- Contabilidad de `xp_week` en `grant`.

## Hallazgo colateral (no se toca aquí)

`sentences.service.ts:241` lee `level.progress?.progress` de una relación
uno a uno con `levels_progress` sin filtrar por usuario: si recalcular el
progreso de un nivel puede depender de la fila de otro usuario, es un bug
aparte. Queda anotado para su propia conversación.
