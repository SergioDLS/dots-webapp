# Acceso solo por invitación — diseño

**Fecha:** 2026-08-07
**Repos afectados:** `dots-webapp` y `dots-backend`
**Estado:** aprobado, pendiente de plan de implementación

## Problema

Cualquiera puede crear una cuenta en dots. La academia no controla quién usa
su aplicación ni tiene forma de cortar el acceso de manera confiable.

El diagnóstico del código revela que el problema no está donde parece:

1. **El registro de la web ya está roto.** `app/page.tsx:139` hace
   `POST /newUser`, un endpoint que no existe en el backend NestJS. Quien
   intenta registrarse desde la web recibe un 404. Quitar ese formulario no
   rompe nada: ya está roto.
2. **El agujero real es `POST /auth/register`**, que sí existe, está abierto y
   sin autenticación. Cualquiera con `curl` crea una cuenta.
3. **`users.expires` es decorativa.** El admin la edita
   (`admin.service.ts:1378`) pero ningún endpoint la valida. Se puede fijar un
   vencimiento y la persona entra igual.
4. **Bloquear a alguien no lo expulsa.** `refreshUser`
   (`auth.service.ts:156`) solo verifica la firma del refresh token; no
   reconsulta `blocked`. Un usuario bloqueado con la app abierta sigue
   renovando su sesión hasta siete días.

## Estado de la base de datos (verificado 2026-08-07)

Consultas de solo lectura contra la BD de producción:

| Métrica | Valor |
|---|---|
| Usuarios totales | 28 (3 admins, 1 bloqueado) |
| Sin email / sin username / duplicados | 0 |
| Con `expires` seteado | 12, **todos ya vencidos** (fechas de 2024) |
| De esos 12: admins | 0 |
| De esos 12: con `xp > 0` | 0 |
| Activos últimos 30 días | 0 (14 nunca entraron, 3 tienen XP) |
| Constraints en `dots.users` | solo `PRIMARY KEY (id)` |

Dos conclusiones que condicionan el diseño:

- **Activar `expires` es seguro.** Los 12 vencidos son cuentas de 2024 sin uso;
  ningún admin queda fuera de su panel y nadie pierde progreso.
- **La unicidad de email y username solo se valida en código.** No hay índice
  único en la BD, así que dos aceptaciones simultáneas podrían chocar.

## Alcance

Toda cuenta nueva nace de una invitación creada por un admin. El invitado
recibe un correo con un link de 48 horas atado a su dirección, y con él crea su
cuenta. El login solo ofrece entrar y recuperar contraseña.

### Decisiones

| Tema | Decisión |
|---|---|
| Registro público | Se elimina `POST /auth/register`. Lo reemplaza `POST /auth/invitations/accept`, que exige token |
| Quién invita | Solo `profile = 1` (`ADMIN_PROFILE`) |
| Rol invitado | Siempre alumno. Los admins se siguen promoviendo con SQL a mano |
| Vida del link | 48 h (configurable), un solo uso, atado al email |
| Datos del admin | Email obligatorio; nombre, apellido y fecha de acceso opcionales |
| Datos del invitado | Todo editable menos el email |
| Bloqueo | Corte inmediato: el refresh revalida contra la BD |
| `expires` | Se valida en login y refresh |
| Usuarios existentes | Nadie se desactiva. Los 12 con fecha vencida quedan fuera por su propia fecha y el admin los reactiva desde la ficha |
| Volumen | Decenas de usuarios; sin paginación, búsqueda en cliente |
| Ubicación en el panel | Pestañas dentro de `/admin/users` |

### Fuera de alcance

- Verificación de email para cuentas existentes.
- Roles intermedios (profesor) o invitaciones que creen admins.
- Importación de CSV.
- Paginación en servidor.
- Rate limiting en los endpoints públicos. Con tokens de 256 bits la
  enumeración es inviable; si el volumen crece, se revisa.

## Modelo de datos

### Tabla nueva `dots.invitations`

```sql
CREATE TABLE IF NOT EXISTS dots.invitations (
  id              serial PRIMARY KEY,
  email           text NOT NULL,
  name            varchar(100),
  last_name       varchar(100),
  token           varchar(64) NOT NULL UNIQUE,
  expires_at      timestamptz NOT NULL,
  access_expires  timestamp,
  status          varchar(16) NOT NULL DEFAULT 'pending',
  invited_by      int NOT NULL REFERENCES dots.users(id),
  accepted_by     int REFERENCES dots.users(id),
  created_at      timestamptz NOT NULL DEFAULT now(),
  last_sent_at    timestamptz NOT NULL DEFAULT now(),
  accepted_at     timestamptz,
  revoked_at      timestamptz
);

CREATE UNIQUE INDEX IF NOT EXISTS invitations_one_pending_per_email
  ON dots.invitations (lower(btrim(email))) WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS invitations_status_idx ON dots.invitations (status);
```

Campos que merecen explicación:

- `expires_at` es la vida del **link** (48 h). `access_expires` es la fecha
  hasta la que el alumno podrá usar la app, y se copia a `users.expires` al
  aceptar. Son dos relojes distintos y conviene no confundirlos.
- `status` solo toma tres valores: `pending`, `accepted`, `revoked`.
  **"Vencida" no se guarda**: se deriva de `status = 'pending' AND expires_at
  < now()`. Así no hace falta un cron que barra invitaciones muertas ni existe
  el riesgo de que la tabla mienta si el cron falla.
- El índice único parcial garantiza **una sola invitación viva por email**.
  Evita tres links simultáneos para la misma persona.

### Cambios a `dots.users`

Ninguna columna nueva. Solo dos índices, aprovechando que hoy hay 0 duplicados:

```sql
CREATE UNIQUE INDEX IF NOT EXISTS users_email_unique
  ON dots.users (lower(btrim(email)));
CREATE UNIQUE INDEX IF NOT EXISTS users_username_unique
  ON dots.users (lower(btrim(username)));
```

Pasan la unicidad de una validación en código a una garantía de la BD.

## Backend

### Endpoints de admin

Bajo el `AdminGuard` existente (`admin.guard.ts`).

| Endpoint | Cuerpo | Resultado |
|---|---|---|
| `GET /admin/invitations` | — | Lista con estado derivado, invitador, fechas y `token` (lo necesita *copiar link*) |
| `POST /admin/invitations` | `{ email, name?, lastName?, accessExpires? }` | Crea y envía el correo |
| `POST /admin/invitations/bulk` | `{ emails: string[] }` | Crea las que puede; devuelve creadas y omitidas con motivo |
| `POST /admin/invitations/:id/resend` | — | Token nuevo, reloj a 48 h, reenvía. El link anterior muere |
| `DELETE /admin/invitations/:id` | — | Revoca (`status = 'revoked'`) |

Reglas de validación al crear:

- Email con formato válido, normalizado a minúsculas y sin espacios.
- Si ya existe un usuario con ese email → 409 `Ese correo ya tiene cuenta`.
  Si esa cuenta está bloqueada, el mensaje sugiere desbloquearla en vez de
  invitar de nuevo.
- Si ya existe una invitación `pending` no vencida → 409 con la sugerencia de
  reenviar.
- Una invitación vencida o revocada **no bloquea** una nueva para el mismo
  email: el índice parcial solo cubre `pending`, y una vencida sigue siendo
  `pending`, así que crear una nueva **revoca la anterior en la misma
  transacción**.

`bulk` aplica las mismas reglas por email y nunca falla entero: informa el
resultado de cada uno.

### Configuración

Dos variables de entorno en `dots-backend`, ambas con valor por defecto para
que nada se rompa si faltan:

| Variable | Default | Para qué |
|---|---|---|
| `INVITE_TTL_HOURS` | `48` | Vida del link. Configurable sin tocar código |
| `APP_PUBLIC_URL` | primer valor de `FRONTEND_ORIGIN` | Base del link del correo |

`FRONTEND_ORIGIN` ya existe y admite una lista separada por comas para CORS
(`main.ts:11`). Para el correo hace falta **una** URL canónica, así que se
toma la primera de la lista y `APP_PUBLIC_URL` permite sobrescribirla cuando
el primer origen no sea el público.

El link queda como `{APP_PUBLIC_URL}/invite/{token}`.

En el panel, en cambio, *copiar link* lo construye el frontend con su propio
`window.location.origin` a partir del `token` que devuelve el listado. Así el
link copiado siempre apunta al mismo dominio desde el que el admin está
mirando, y en desarrollo no sale un link a producción.

### Endpoints públicos

| Endpoint | Cuerpo | Resultado |
|---|---|---|
| `GET /auth/invitations/:token` | — | `{ email, name, lastName }` si sirve; si no, error con motivo distinguible |
| `POST /auth/invitations/accept` | `{ token, username, password, name, lastName, birthday? }` | Crea el usuario y abre sesión |

El motivo de rechazo viaja en el cuerpo como `reason`, con cuatro valores:
`notfound`, `expired`, `revoked`, `used`. El frontend necesita distinguirlos
para decir la verdad al usuario en cada caso.

`accept` en una transacción:

1. Relee la invitación con `FOR UPDATE` y revalida estado y vencimiento.
2. Valida username libre y contraseña de 8 caracteres o más.
3. Crea el usuario con `profile = 0`, `blocked = false`, el email de la
   invitación (nunca el que venga en el cuerpo) y `expires = access_expires`.
4. Marca la invitación `accepted`, con `accepted_by` y `accepted_at`.
5. Emite la sesión con `issueSession`, igual que hacía el registro.

El email lo pone el servidor desde la invitación. Que el cliente no pueda
elegirlo es lo que hace que el link esté realmente atado a una persona.

### Endpoints modificados

**`loginUser`** — tras el check de `blocked`, valida vencimiento:

```
if (userFind.expires && userFind.expires < now) → 403 'Tu acceso venció'
```

Mensaje distinto al de bloqueado, porque son cosas distintas y el alumno
necesita saber a qué atenerse.

**`refreshUser`** — pasa a `async`. Después de verificar el refresh token,
carga el usuario y revalida `blocked` y `expires`. Si falla, limpia las
cookies y responde 403 con `reason` (`blocked` o `expired`) para que el
frontend muestre el motivo real en vez de "sesión expirada".

El flag `ALLOW_BLOCKED_LOGIN` sigue funcionando igual en ambos, para no perder
la escotilla de desarrollo.

### Eliminado

- `POST /auth/register` y su `RegisterDtoRequest`.
- `registerService` en `services/auth.service.ts` del frontend.

## Frontend

### Pantalla nueva `app/invite/[token]/page.tsx`

Fuera del grupo `(app)`, sin nav, reutilizando `AuthShell` y los estilos de
`components/auth/auth-ui.tsx`.

Estados:

- **Cargando** — valida el token contra `GET /auth/invitations/:token`.
- **Válido** — formulario con el email fijo y no editable, precedido de un
  texto que explica de dónde salió; nombre y apellido precargados pero
  editables; username, contraseña ×2 y cumpleaños.
- **Token muerto** — pantalla con Doty y el mensaje que corresponde a cada
  motivo: *venció* invita a pedir otra a la academia, *revocada* dice que fue
  cancelada, *ya usada* manda al login.
- **Error de red** — botón Reintentar.

El token viaja en la ruta, no en query string, así que no hace falta
`<Suspense>`. El fetch sigue el patrón `fetchAttempt` de la regla 3 del
CLAUDE.md: el botón bumpea un contador y el efecto solo fetchea; nunca hay un
`setState` síncrono en el cuerpo del efecto.

Al aceptar: `router.push("/onboarding")`. Nunca `window.location`, que
perdería el token recién puesto en memoria.

### `app/page.tsx` (login)

Se le quitan los estados `new-user`, `username` y `wrongcode`, junto con la
llamada muerta a `/newUser`. Quedan `login`, `loading` y `error`.

En lugar del botón de crear cuenta, un bloque con Doty:

> **¿No tienes cuenta?** dots es solo por invitación. Si tu academia te
> inscribió, revisa tu correo — y si no llegó, escríbenos a
> dotsglobalgroup@gmail.com

El login también aprende a mostrar los dos rechazos nuevos: cuenta bloqueada y
acceso vencido.

### `app/(app)/admin/users/page.tsx`

Gana dos pestañas: *Usuarios* (lo que ya hay) e *Invitaciones*.

La tabla de invitaciones muestra email, nombre, estado con color, quién
invitó, envío y vencimiento. Cada fila lleva sus acciones: reenviar, revocar y
copiar link. Copiar link es el plan B cuando el correo no llega, así que va
visible y no escondido en un menú.

El modal de invitar tiene dos modos: uno a uno (email, nombre, apellido, fecha
de acceso opcional) o pegar una lista de correos separados por coma o salto de
línea.

Al enviar una lista, el resultado se informa por correo individual — *creadas:
8; omitidas: 2 (ya tienen cuenta), 1 (invitación pendiente)* — nunca un
"listo" genérico que oculte lo que no se hizo.

### Componentes y servicios

- `components/admin/invitations-tab.tsx` — tabla y acciones.
- `components/admin/invite-modal.tsx` — los dos modos de invitación.
- `services/admin.service.ts` — cinco funciones nuevas.
- `services/auth.service.ts` — `getInvitationService` y
  `acceptInvitationService`; se borra `registerService`.

## Correo de invitación

`sendInvite(to, name, link, invitedByName)` en el `MailService` existente.

HTML con los colores de marca (`--accent` `#e5077e` sobre `--surface` oscuro
`#201a4d`), en español y con el tono de Doty. Incluye quién invita, un botón
grande al link, la misma URL en texto plano por si el botón no funciona, y el
aviso de que vence en 48 horas.

Sin imágenes remotas en la primera versión: buena parte de los clientes las
bloquea por defecto y el correo tiene que leerse igual de bien sin ellas.

Si el envío falla, el `MailService` ya registra un warning sin tumbar la
petición. La invitación queda creada igual y el admin puede copiar el link.

## Migración

`dots-backend/scripts/migrate-invitations.js`, siguiendo el patrón de los
`migrate-*.js` existentes. Idempotente: `CREATE TABLE IF NOT EXISTS` y
`CREATE INDEX IF NOT EXISTS`.

Crea la tabla, sus índices y los dos únicos de `users`. **No modifica ninguna
fila existente**: los 12 usuarios con fecha vencida se quedan como están.

Antes de crear los índices únicos, el script verifica que no haya duplicados y
aborta con un listado si los encuentra. Hoy no los hay, pero la BD es
compartida y el script podría correrse más tarde.

## Riesgos y contrapartidas

**El token se guarda en claro.** Lo habitual sería guardar solo un hash, pero
*copiar link* como acción permanente obliga a poder reconstruirlo. La
contrapartida es consciente: quien lea la BD puede aceptar invitaciones
pendientes — aunque con ese acceso ya podría crear usuarios directamente, así
que el hash no compraría mucho. Se mitiga con 32 bytes aleatorios
(`crypto.randomBytes(32)`, base64url), un solo uso y 48 horas.

**El refresh consulta la BD** cada 15 minutos por usuario. Con 28 usuarios es
irrelevante; a escala de miles habría que cachear el estado.

**Los 12 usuarios con fecha vencida perderán el acceso** al desplegar. Está
verificado que no hay admins ni progreso entre ellos, pero es un cambio de
comportamiento visible y el admin debe saber que se reactivan editando
`expires` en la ficha.

**Los correos de Gmail pueden caer en spam.** Por eso copiar link no es un
lujo: es el plan B real.

**El guard de admin del frontend lee `localStorage`**
(`app/(app)/admin/layout.tsx:40`). Es cosmético y sigue igual; la seguridad
real la da el `AdminGuard` del backend, que es quien protege los endpoints
nuevos.

## Verificación

No hay test runner de componentes en este repo, así que:

- `npx next build` y `npm run lint` en `dots-webapp`.
- `npm run build` y `npm run lint` en `dots-backend`.
- Prueba manual del recorrido completo: invitar → recibir correo → aceptar →
  onboarding → bloquear desde el panel → confirmar el corte en menos de 15
  minutos → desbloquear → volver a entrar.
- Casos borde del link: vencido, revocado, ya usado e inexistente.
- Confirmar con `curl` que `POST /auth/register` responde 404.
