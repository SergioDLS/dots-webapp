# Forgot password funcional en la webapp — Diseño (brainstorming 2026-08-06)

- **Fecha:** 2026-08-06
- **Rama:** por crear, `feat/forgot-password` (solo `dots-webapp`).
- **Estado:** ✅ implementado 2026-08-06 en la rama `feat/forgot-password`. SMTP configurado y verificado (credencial válida + correo de prueba entregado). Pendientes: las mismas variables SMTP en el `.env` de producción del VPS, y el recorrido end-to-end con un usuario real de la BD (§6, §7).
- **Repos:** `dots-webapp` (todo el código nuevo) + `dots-backend` (**solo `.env`**, que no está versionado → sin commit ni rama allá). La credencial SMTP se toma de `dots-info-web/.env.local`.
- **BD:** PostgreSQL **compartida de producción**. Relevante aquí: activar SMTP hace que un `forgot-password` con el correo de un usuario real le mande un correo real. Ver §6.
- **Antecedente:** ninguno. El backend ya trae el flujo completo desde el commit `267bae8`; nunca tuvo UI.

## 1. Problema

El botón "Forgot password?" del login lleva a una ruta que no existe.

### 1.1 La ruta `/forgot` es un 404

`app/page.tsx:237` navega a `/forgot`, pero `app/` solo contiene `(app)/`, `favicon.ico`, `globals.css`, `layout.tsx` y `page.tsx`. No hay `app/forgot/`. **Este es el bug que el usuario reporta.**

### 1.2 Esa navegación viola la regla dura #1

```tsx
onClick={() => window.location.replace("/forgot")}   // app/page.tsx:237
```

`window.location.*` recarga la página y tira el access token que vive en memoria. En el login todavía no hay token, así que hoy el daño es solo un full reload innecesario — pero es la regla #1 de `CLAUDE.md` y queda como precedente copiable.

### 1.3 El backend ya está listo y nadie lo llama

`services/auth.service.ts:27-43` exporta `forgotPasswordService` y `resetPasswordService`, escritos y correctos. `grep` sobre `app/` y `components/`: **cero llamadas**. Son código muerto esperando pantalla.

### 1.4 El SMTP del backend nunca se configuró

`mail.module.ts:16` decide la autenticación así:

```ts
auth: process.env.SMTP_USER ? { user: SMTP_USER, pass: SMTP_PASS } : undefined
```

El `.env` del backend no tiene ninguna clave `SMTP_*` (tiene DB×6, `PORT`, `NAME`, `DEV`, JWT×5, Cloudinary×3, `ELEVENLABS_API_KEY`, `ALLOW_BLOCKED_LOGIN`). Sin `SMTP_USER` se conecta a `smtp.gmail.com:587` **sin autenticar**, Gmail rechaza, y `mail.service.ts:52-59` se traga el error y escribe el código en el log:

```ts
this.logger.debug(`[DEV] Password reset code for ${to}: ${code}`);
```

Es decir: el flujo "funciona" pero el código nunca sale del servidor.

**Arqueología (cerrada):** no se borró ninguna credencial. `git log --all -S` sobre ambos repos no encuentra `dotsonlinelearningapp` en ningún commit, y las dos únicas versiones de `src/modules/mail/*` ya leían de `process.env.SMTP_USER`/`SMTP_PASS`. Nunca hubo clave en duro. La app password **sí existe**, en otro proyecto: `dots-info-web/.env.local` define `GMAIL_USER=dotsonlinelearningapp@gmail.com`, `GMAIL_APP_PASSWORD` (16 caracteres) y `MAIL_RECIPIENT=dotsglobalgroup@gmail.com`, y `dots-info-web/lib/mail/service.ts` las usa contra `smtp.gmail.com:465` con `secure: true`. Nombres de variable distintos (`GMAIL_*` vs `SMTP_*`), por eso nunca se compartieron.

### 1.5 El remitente por defecto es de otro proyecto

`mail.service.ts:18` cae a `from: 'grulladepapel.cl@gmail.com'` si no hay `MAIL_FROM`. Es de la otra web del usuario, no de dots.

### 1.6 El copy del login está en inglés

`app/page.tsx` está entero en inglés ("Hi! I'm Doty…", "Let's go!"), contra la regla de `CLAUDE.md` de que la UI va en español con tono juguetón.

## 2. Lo que YA existe (verificado 2026-08-06 — no rehacer)

| Pieza | Ubicación | Estado |
|---|---|---|
| `POST /auth/forgot-password` | `BE/src/modules/auth/auth.controller.ts` | ✅ genera código de 6 dígitos, guarda `reset_code`/`reset_code_date`, manda correo |
| `POST /auth/reset-password` | idem | ✅ valida código + TTL, re-hashea con bcrypt(10), limpia el código |
| TTL del código | `BE/auth.service.ts` (`RESET_CODE_TTL_MS`) | ✅ 30 min |
| Columnas `reset_code`, `reset_code_date` | `BE/src/common/entity/users.entity.ts` | ✅ ya migradas, nullable |
| `forgotPasswordService`, `resetPasswordService` | `services/auth.service.ts:27-43` | ✅ escritos, sin usar |
| Axios + token en memoria + refresh single-flight | `lib/api-client.ts` | ✅ |
| `MailService.sendResetCode` (HTML rosa + fallback a log) | `BE/src/modules/mail/mail.service.ts:30-60` | ✅ |
| App password de Gmail | `dots-info-web/.env.local` | ✅ existe, hay que copiarla |
| `Doty` (22 poses, animaciones `bob`/`cheer`/`sad`/`wave`, prop `say`) | `components/ui/doty/doty.tsx` | ✅ |
| Clases visuales `inputCls`, `btnPrimary`, `btnOutline`, `errorBanner` | `app/page.tsx:148-168` | ⚠️ existen pero **dentro** del componente → inalcanzables desde otra pantalla |
| Shell visual (2 blobs a la deriva + `dots-card max-w-3xl`) | `app/page.tsx:413-436` | ⚠️ igual, embebido en el login |
| Vars y keyframes (`--accent`, `--danger-soft`, `dots-slide-up`, `dots-pop-in`, `dots-float`, `dots-blob-drift`) | `app/globals.css` | ✅ |

## 3. Decisiones (cerradas en brainstorming)

1. **Idioma: español**, y se traduce además el login/registro completo (`app/page.tsx`). Decidido contra la alternativa de escribir la pantalla nueva en inglés por coherencia local.
2. **Una sola ruta `/forgot`** con tres fases en estado interno, en vez de dos rutas. El backend necesita `email` + `code` juntos en el paso 2; guardarlo en estado evita pasarlo por query param (no queda en la URL ni en el historial) y evita el `Suspense` que exigiría `useSearchParams` (regla #6). Tampoco se agrega una fase al state machine del login: `app/page.tsx` ya tiene 436 líneas.
3. **Código en 6 casillas de presentación con un único input real superpuesto**, no seis `<input>`. Ver §5.3.
4. **Se configura el SMTP** del backend con la credencial de `dots-info-web`, replicando `465` + `secure: true`. La clave se mueve de archivo a archivo, nunca por el chat.
5. **Se extrae `components/auth/auth-ui.tsx`** con las clases, el `errorBanner` y un `AuthShell`. Sin esto, "acorde al diseño actual" degenera en copiar y pegar y las dos pantallas se separan con el tiempo.
6. **Mensajería honesta:** el backend responde `{ ok: true }` incluso si el correo no existe, a propósito, para que nadie enumere emails registrados. La UI **no** afirma "te enviamos un correo"; dice "si ese correo está registrado…". Ver §5.2.
7. **No se toca `mail.service.ts`.** El remitente se corrige por `MAIL_FROM` en el `.env`, sin editar el fallback en duro.
8. **La verificación usa una cuenta de prueba**, nunca el correo de un usuario real de la BD de producción.

## 4. Contrato de API (ya expuesto por el backend, no se modifica)

### `POST /auth/forgot-password`

```
body   { email: string }            // @IsEmail
200    { ok: true }                 // SIEMPRE, exista o no el usuario
```

### `POST /auth/reset-password`

```
body   { email: string, code: string, password: string }   // @IsEmail, @IsNotEmpty, @MinLength(8) @MaxLength(100)
200    { ok: true }
400    { message: "Invalid or expired code" }                              // no existe user, o sin código guardado, o no coincide
400    { message: "That code has expired. Please request a new one" }      // > 30 min
400    { message: string[] }                                              // fallo de class-validator
```

### Traducción de errores a español

| Origen | Mensaje en pantalla |
|---|---|
| `Invalid or expired code` | "Ese código no es válido o ya venció. Pide uno nuevo." |
| `That code has expired. Please request a new one` | "El código venció. Pide uno nuevo." |
| `message` es un array (validación) | Se muestra el primer ítem mapeado, o el genérico si no hay mapeo. |
| Cualquier otra cosa / red caída | "Algo falló de nuestro lado. Intenta de nuevo." |

El mapeo va en un objeto a nivel de módulo en `app/forgot/page.tsx`, con fallback genérico. Un fallo **no** borra lo que el usuario ya escribió.

## 5. Derivadas técnicas

### 5.1 Archivos

| Archivo | Acción |
|---|---|
| `components/auth/auth-ui.tsx` | **nuevo** — `inputCls`, `btnPrimary`, `btnOutline`, `ErrorBanner`, `AuthShell` |
| `app/forgot/page.tsx` | **nuevo** — la pantalla, client component |
| `app/page.tsx` | editar — `router.push`, consumir `auth-ui`, traducir todo el copy |
| `dots-backend/.env` | editar — 6 líneas de SMTP (sin commit: no está versionado) |

`app/forgot/` va en la raíz de `app/`, hermana del login y **fuera** del grupo `(app)`: es un flujo inmersivo sin nav ni HUD.

`AuthShell` recibe `children` y aporta el fondo (los dos blobs con `dots-blob-drift` de 14 s y 18 s en reverse) más la `dots-card max-w-3xl`. El login pasa a envolverse en él, sin cambio visual.

### 5.2 Las tres fases

Todas comparten `AuthShell` y entran con `dots-slide-up` escalonado (0 s / 0.1 s / 0.2 s), igual que el login.

**Fase `email`**

- Doty pose `13`, `animation="bob"`. Título "¿Olvidaste tu contraseña?", subtítulo "Pasa. Escribe tu correo y te mandamos un código para crear una nueva."
- Un input: `type="email"`, `inputMode="email"`, `autoComplete="email"`, placeholder "Tu correo".
- Primario "Enviar código" (cargando: "Enviando…"). Secundario "Volver al inicio" → `router.push("/")`.
- Validación cliente: no vacío y formato plausible. Errores: "Escribe tu correo." / "Ese correo no se ve bien."
- Llama `forgotPasswordService(email)`. Ante `200` pasa a `code`. Como el backend responde `ok` siempre, el paso **no** confirma que el correo exista — de ahí el copy de la fase siguiente.

**Fase `code`**

- Doty pose `07`, `animation="bob"`. Título "Revisa tu correo".
- Subtítulo honesto: **"Si {email} está registrado, ahí te espera un código de 6 dígitos. Vence en 30 minutos."**
- Campos: las 6 casillas (§5.3), "Contraseña nueva" y "Repite la contraseña" (`type="password"`, `autoComplete="new-password"`).
- Primario "Cambiar contraseña" (cargando: "Cambiando…"), deshabilitado hasta que las validaciones de cliente pasen.
- Secundarios: "Reenviar código", con cooldown de 30 s que muestra la cuenta atrás ("Reenviar en 24 s") y re-llama `forgotPasswordService`; y "Usar otro correo", que vuelve a la fase `email` conservando el correo escrito.
- Validación cliente, espejo de la del backend: código de 6 dígitos, contraseña de 8+, confirmación coincidente. Errores: "El código son 6 dígitos." / "Tu contraseña debe tener 8 caracteres o más." / "Las contraseñas no coinciden."
- Llama `resetPasswordService(email, code, password)`. Ante `200` pasa a `done`.

**Fase `done`**

- Doty pose `17`, `animation="cheer"` (la convención de celebración que ya usa la app). Título "¡Listo!", subtítulo "Tu contraseña nueva ya está activa."
- Primario "Iniciar sesión" → `router.push("/")`.
- No auto-loguea: el backend no devuelve token en `reset-password`, y forzarlo pediría un segundo viaje con credenciales. Fuera de alcance.

### 5.3 El input de 6 casillas

Un contenedor `relative` con:

- **Seis cajas de presentación**, `aria-hidden` y `pointer-events-none`: `rounded-2xl border-2 border-(--border)` sobre `--input-bg`, dígito en `font-display text-2xl font-extrabold`. Renderizan `code[i] ?? ""`.
- **Un `<input>` real superpuesto** en `absolute inset-0`, con texto y caret transparentes (`text-transparent caret-transparent`, **no** `opacity-0`, que en iOS dispara zoom y confunde a los lectores de pantalla). Lleva `inputMode="numeric"`, `maxLength={6}`, `autoComplete="one-time-code"`, `aria-label="Código de 6 dígitos"`, y filtra la entrada a dígitos.
- La caja activa es `code.length`, y toma el mismo foco rosa que los inputs del login (`border-(--accent)` + `ring-4 ring-(--accent)/15`) más un caret simulado con `animate-pulse`.

Por qué así y no seis inputs: pegar el código funciona nativo (con seis campos, pegar `483920` cae entero en el primero o se pierde), el autofill de `one-time-code` no se rompe, y borrar/seleccionar/mover son nativos — cero `onKeyDown`, cero array de refs, cero lógica de "avanzar el foco", que es donde este componente acumula bugs. Además traduce directo a React Native (un `TextInput` + seis `View`), sin pedir excepción a la regla #2.

### 5.4 Backend: `.env`

Se añaden, tomando el valor de `GMAIL_APP_PASSWORD` de `dots-info-web/.env.local` por copia entre archivos:

```
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=dotsonlinelearningapp@gmail.com
SMTP_PASS=<copiada de dots-info-web/.env.local>
MAIL_FROM=Dots <dotsonlinelearningapp@gmail.com>
```

`465` + `secure: true` replica lo que ya funciona en `dots-info-web`, en vez del `587` + STARTTLS que trae el default de `mail.module.ts`. `MAIL_FROM` desplaza el remitente `grulladepapel.cl@gmail.com` sin tocar código. Requiere reiniciar el watcher del backend para que lea el `.env`.

**`MAIL_FROM` va sin comillas, a propósito.** La forma "natural" `MAIL_FROM="Dots" <dots…@gmail.com>` se rompe: dotenv ve que el valor abre con `"`, corta en la comilla de cierre y guarda solo `Dots`, descartando la dirección. Nodemailer parsea `Dots <dots…@gmail.com>` sin comillas perfectamente, así que esa es la forma correcta aquí.

### 5.5 Cumplimiento de las reglas duras de `CLAUDE.md`

| Regla | Cómo se cumple |
|---|---|
| #1 `router.push`, nunca `window.location` | La pantalla nueva usa `useRouter`, y se corrige la infracción existente en `app/page.tsx:237` |
| #2 RN-safe | Solo tap/pointer. El input de 6 casillas no usa `keydown` como mecanismo (§5.3). Animación solo `transform`/`opacity` |
| #3 Lint del compiler de React | Ningún `setState` en el cuerpo de un `useEffect`: las transiciones de fase salen de handlers `onClick`. El cooldown de reenvío corre con `setInterval` + cleanup, y el `setState` va dentro del callback del timer, no en el cuerpo del efecto. Ningún efecto colateral dentro de un updater de `setState` |
| #4 Score/XP | No aplica |
| #5 Fetch con `loadError` + Reintentar | No aplica: no hay fetch al montar. Todo request nace de un botón, y su error se muestra en el banner con el botón disponible para reintentar |
| #6 `useSearchParams` en `Suspense` | No se usa `useSearchParams` (decisión 2) |
| #7 `?seed=` | No aplica |

## 6. Verificación

1. `npm run lint` y `npx next build` (type-check incluido) en `dots-webapp`. Ambos deben pasar antes de commitear.
2. Reiniciar el backend y confirmar en su log que arranca sin error de SMTP.
3. **Cuenta de prueba, no un usuario real.** Con el SMTP activo, un `forgot-password` sobre un correo de la tabla `dots.users` le manda un correo de verdad a esa persona. Antes de probar hay que acordar con el usuario qué cuenta usar (p. ej. una cuyo email sea `dotsglobalgroup@gmail.com`) y confirmar que existe en la BD. Si no existe, el backend responde `ok` y no manda nada: útil para probar la fase 1 sin efectos.
4. Preview manual del camino completo: login → "¿Olvidaste tu contraseña?" → correo → código del email → contraseña nueva → "Iniciar sesión" → entrar con la contraseña nueva.
5. Casos de error a recorrer a mano: código equivocado, código expirado (o alterado a mano en la BD por el usuario, no por Claude), contraseña corta, contraseñas que no coinciden, backend caído.
6. Revisar que el login siga funcionando tras la traducción y la extracción del shell: entrar, credenciales malas, y el flujo de registro.

## 7. Pendientes / fuera de alcance

- **`.env` de producción del VPS.** Este spec configura solo el local. Para que el reset funcione en producción hay que añadir allá las mismas variables.
- **Auto-login tras el reset.** `reset-password` no devuelve token; queda en iniciar sesión a mano (§5.2).
- **Rate limiting en `forgot-password`.** Hoy el cooldown es solo de UI: nada impide llamar al endpoint en bucle y quemar la cuota de Gmail. Blindarlo es trabajo de backend, en otro spec.
- **El remitente en duro de `mail.service.ts:18`.** Sigue apuntando a `grulladepapel.cl@gmail.com` como fallback. Se neutraliza con `MAIL_FROM`, no se borra (decisión 7).
- **Correo del reset en español.** El HTML de `sendResetCode` está en inglés ("Password reset", "It expires in 30 minutes"). Traducirlo es backend y queda fuera; solo la webapp se traduce aquí.
- **Unificar los nombres de variable entre proyectos** (`GMAIL_*` en `dots-info-web` vs `SMTP_*` en el backend). No vale el riesgo ahora.
