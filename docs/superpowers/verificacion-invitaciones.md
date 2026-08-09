# Verificación del acceso solo por invitación

**Fecha:** 2026-08-08
**Rama:** `feat/invitaciones` en `dots-webapp` y `dots-backend`
**Spec:** `docs/superpowers/specs/2026-08-07-invitaciones-design.md`

## Qué se probó y con qué resultado

Verificación por API contra el backend real y la **base de datos de producción**,
con autorización explícita del usuario. Backend levantado en un puerto aparte
(`4100`/`4200`) para no interferir con el de desarrollo.

### Flujo completo de invitación

| Paso | Esperado | Resultado |
|---|---|---|
| `POST /admin/invitations` | crea y envía correo | ✅ id 1, token generado, `invitedByName: "Sergio Landaeta"` |
| Invitar el mismo correo otra vez | 409 con motivo legible | ✅ `409 — "That email already has a live invitation — resend it instead"` |
| `GET /auth/invitations/:token` | solo email, nombre, apellido | ✅ devuelve los tres, **sin el token** |
| `GET /auth/invitations/<inventado>` | 410 `notfound` | ✅ `{"reason":"notfound"}` |
| `POST /auth/invitations/accept` | crea usuario y abre sesión | ✅ usuario id 9 con token de sesión |
| Reusar el mismo token | 410 `used` | ✅ `{"reason":"used"}` |
| Login del usuario nuevo | entra | ✅ 201 |

**Comprobación en la base:** el usuario quedó con el correo **de la invitación**
(`sergiolandaeta93+dotstest@gmail.com`), `profile: 0` y `blocked: false`; la
invitación pasó a `accepted` con `accepted_by = 9` y fecha de aceptación. Es
decir, el correo no se puede inyectar desde el cuerpo de la petición.

**Correo:** enviado de verdad. Log del backend:
`[MailService] Invite emailed to sergiolandaeta93+dotstest@gmail.com`.

### Control de acceso

Probado con el backend arrancado **sin** `ALLOW_BLOCKED_LOGIN`, que es como
corre producción.

| Caso | Resultado |
|---|---|
| Login de usuario bloqueado | ✅ `403 {"reason":"blocked","message":"Usuario bloqueado"}` |
| Login con contraseña incorrecta | ✅ `401` genérico — no revela que la cuenta existe ni que está bloqueada |
| Login con `expires` en el pasado | ✅ `403 {"reason":"expired","message":"Tu acceso venció"}` |

### Corte de sesión en curso

Este era el objetivo de la Tarea 7: antes, bloquear a alguien no lo expulsaba.

| Momento | Antes | Ahora |
|---|---|---|
| Refresh con sesión sana | 201 | ✅ 201 |
| *(el admin bloquea al usuario)* | | |
| Siguiente refresh | 201 — seguía dentro hasta 7 días | ✅ `403 {"reason":"blocked"}` |

### La puerta vieja

| Endpoint | Resultado |
|---|---|
| `POST /auth/register` | ✅ **404** — eliminado |
| `POST /newUser` | ✅ 404 (nunca existió en este backend) |
| `GET /admin/invitations` sin credenciales | ✅ 401 |

Una review con el modelo más capaz verificó por cuatro vías independientes que
la **única** creación de usuario en todo `src/` es `manager.create(Users, ...)`
dentro de `accept`: no hay `new Users(`, ni `INSERT` crudo, ni altas en
`scripts/` o `test/`, ni endpoint de alta en el panel de admin.

## Lo que NO se pudo verificar

Honestidad sobre los límites de esta verificación:

- **La interfaz no se probó en un navegador.** Las herramientas de preview no
  estaban disponibles en la sesión. Se comprobó que `npm run lint` y
  `npx next build` pasan limpios y que `/invite/[token]` se registra como ruta
  dinámica, pero **nadie hizo clic en la pantalla de invitación, ni en la
  pestaña del panel, ni copió un enlace**. Queda pendiente una pasada manual.
- **El vencimiento del enlace a las 48 h** no se probó dejando pasar el tiempo
  ni manipulando `INVITE_TTL_HOURS`. Sí se probó el resto de estados muertos
  (`notfound`, `used`).
- **El caso "revocada"** no se ejerció por API.
- **El rebote al login** cuando un usuario bloqueado tiene la app abierta: el
  backend devuelve 403 correctamente, pero el frontend se traga ese error en
  `refreshAccessToken` y el usuario queda sin token **sin** que se limpie
  `localStorage.user` ni haya un guard de ruta global. Verá paneles que fallan
  en vez de un rebote limpio. Es el camino que le tocará a una persona real y
  merece revisarse.

## Rastro dejado en producción

- **Usuario de prueba `dotstest_invitacion` (id 9)**, correo
  `sergiolandaeta93+dotstest@gmail.com`, actualmente **bloqueado**. Creado a
  propósito para esta verificación. Se puede borrar o desbloquear según
  convenga; se dejó bloqueado para que no cuente como acceso activo.
- **Invitación id 1** en estado `accepted`, asociada a ese usuario.
- Ninguna otra fila fue creada ni modificada.

## Configuración pendiente para el despliegue

En el entorno del backend de producción hay que definir:

```
INVITE_TTL_HOURS=48
APP_PUBLIC_URL=https://<dominio-publico-de-la-webapp>
```

Sin `APP_PUBLIC_URL`, los enlaces del correo apuntarán al primer valor de
`FRONTEND_ORIGIN`, que puede no ser el dominio público.

Y hay que correr la migración, si no se ha hecho ya en ese entorno:

```
npm run migrate:invitations
```

**Nunca poner `ALLOW_BLOCKED_LOGIN` en producción.** Desde este trabajo el flag
solo surte efecto si además `NODE_ENV !== 'production'`, y el arranque emite un
`WARNING` bien visible cuando está activo — pero la variable no debería estar
ahí en primer lugar.
