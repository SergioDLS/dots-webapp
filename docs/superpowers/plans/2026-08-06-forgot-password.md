# Forgot password funcional — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que el botón "¿Olvidaste tu contraseña?" del login lleve a una pantalla funcional que permita recuperar la cuenta con el código de 6 dígitos que el backend ya emite.

**Architecture:** Se extraen a `components/auth/` las piezas visuales que hoy viven encerradas dentro del componente del login (clases, banner de error, shell con blobs y card), para que login y la pantalla nueva compartan una sola fuente de verdad. Sobre esa base se construye `app/forgot/page.tsx`: un client component con tres fases en estado interno (`email` → `code` → `done`) que consume los services ya escritos. El campo del código es un componente aparte: seis cajas de presentación con un único input real superpuesto.

**Tech Stack:** Next.js 16 (app router), React 19, Tailwind 4, axios. Sin dependencias nuevas.

**Spec:** [`docs/superpowers/specs/2026-08-06-forgot-password-design.md`](../specs/2026-08-06-forgot-password-design.md)

## Global Constraints

Aplican a **todas** las tareas:

- `source ~/.nvm/nvm.sh` antes de cualquier `node`/`npm` (Node 22 vía nvm).
- **Verificación real del proyecto:** no hay test runner de componentes. Cada tarea cierra con `npm run lint` + `npx next build` (que incluye type-check) y, donde se indique, preview manual. Ambos comandos deben pasar antes de commitear.
- **Regla dura #1:** navegación con `router.push`, **nunca** `window.location.*`.
- **Regla dura #2 (RN-safe):** solo tap/pointer. Nada de `keydown` como mecanismo de entrada, ni Drag API, ni canvas, ni `<select>`. Animación solo con `transform`/`opacity`.
- **Regla dura #3 (lint del compiler de React):** prohibido `setState` síncrono en el cuerpo de un `useEffect`, y prohibidos efectos colaterales dentro de updaters de `setState`.
- **Regla dura #6:** `useSearchParams` siempre dentro de `<Suspense>`. Este plan no lo usa, a propósito.
- **Idioma:** todo el copy de UI en **español, tono juguetón**. Los términos técnicos del código (nombres de variables, funciones) siguen en inglés como el resto del repo.
- **Estilos:** solo variables CSS de `app/globals.css` (`--accent`, `--surface`, `--border`, `--muted`, `--danger`, `--danger-soft`, `--input-bg`) y utilidades existentes (`dots-card`, `dots-pressable`). No hay CSS modules. No inventar colores en hex.
- **Rama:** `feat/forgot-password`, ya creada y con el spec commiteado.

---

### Task 1: Extraer las piezas visuales compartidas a `components/auth/auth-ui.tsx`

Hoy `inputCls`, `btnPrimary`, `btnOutline` y `errorBanner` se definen **dentro** del cuerpo de `Login()` (`app/page.tsx:148-168`), y el shell visual está inline en su `return` (`app/page.tsx:413-436`). Ninguna otra pantalla puede alcanzarlos. Esta tarea los saca sin cambiar ni un pixel de cómo se ve el login.

**Files:**
- Create: `components/auth/auth-ui.tsx`
- Modify: `app/page.tsx` (borrar las definiciones locales, importar, envolver el `return` en `AuthShell`)

**Interfaces:**
- Consumes: nada.
- Produces: `inputCls: string`, `btnPrimary: string`, `btnOutline: string`, `ErrorBanner: ({ text }: { text: string }) => JSX.Element`, `AuthShell: ({ children }: { children: React.ReactNode }) => JSX.Element`.

- [ ] **Step 1: Crear `components/auth/auth-ui.tsx`**

Los strings de clase se copian **literales** de `app/page.tsx:148-155`, y el shell de `app/page.tsx:413-436`. No "mejorar" nada aquí: el objetivo es que el login quede idéntico.

```tsx
"use client";

import React from "react";

/* Clases compartidas por las pantallas de autenticación (login y /forgot). */

export const inputCls =
  "w-full rounded-2xl border-2 border-(--border) bg-(--input-bg) px-4 py-3 text-base text-foreground placeholder:text-(--muted) outline-none transition-all duration-200 focus:border-(--accent) focus:ring-4 focus:ring-(--accent)/15";

export const btnPrimary =
  "dots-pressable w-full rounded-2xl bg-(--accent) px-4 py-3.5 text-sm font-extrabold tracking-wide text-(--accent-contrast) [--press-color:var(--accent-edge)] disabled:opacity-60";

export const btnOutline =
  "dots-pressable w-full rounded-2xl border-2 border-(--border) bg-(--surface) px-4 py-3 text-sm font-bold text-(--muted) hover:text-(--accent) hover:border-(--accent)";

export function ErrorBanner({ text }: { text: string }) {
  return (
    <p
      className="rounded-2xl px-4 py-2.5 text-center text-sm font-bold"
      style={{
        background: "var(--danger-soft)",
        color: "var(--danger)",
        animation: "dots-pop-in 0.3s ease-out both",
      }}
    >
      {text}
    </p>
  );
}

/** Fondo con blobs a la deriva + tarjeta central. Compartido por login y /forgot. */
export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-screen w-full items-center justify-center overflow-hidden px-6 py-12 text-foreground">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-32 -left-32 h-96 w-96 rounded-full opacity-30 blur-3xl"
        style={{
          background: "var(--accent)",
          animation: "dots-blob-drift 14s ease-in-out infinite",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -right-32 -bottom-32 h-96 w-96 rounded-full opacity-25 blur-3xl"
        style={{
          background: "var(--primary)",
          animation: "dots-blob-drift 18s ease-in-out infinite reverse",
        }}
      />
      <div className="dots-card relative z-10 flex w-full max-w-3xl items-center justify-center px-6 py-10 md:px-12 md:py-12">
        {children}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Importar en `app/page.tsx` y borrar las definiciones locales**

Añadir al bloque de imports (después de la línea 9, `import Doty from "@/components/ui/doty/doty";`):

```tsx
import {
  inputCls,
  btnPrimary,
  btnOutline,
  ErrorBanner,
  AuthShell,
} from "@/components/auth/auth-ui";
```

Borrar el bloque completo `app/page.tsx:147-168` (el comentario `/* ─── Shared classes ─── */`, las tres `const` de clases y la función `errorBanner`).

- [ ] **Step 3: Reemplazar los tres usos de `errorBanner(...)`**

Eran llamadas a función; ahora son un componente. Hay **dos usos** (`grep -n 'errorBanner' app/page.tsx` devuelve tres líneas: estos dos más la definición, que el Step 2 ya borró):

- `app/page.tsx:190` — `{incorrect && errorBanner(msg)}` → `{incorrect && <ErrorBanner text={msg} />}`
- `app/page.tsx:269` — `{msg && errorBanner(msg)}` → `{msg && <ErrorBanner text={msg} />}`

Tras el cambio, `grep -n 'errorBanner' app/page.tsx` no debe devolver nada (la mayúscula de `ErrorBanner` no coincide con el patrón).

- [ ] **Step 4: Envolver el `return` final en `AuthShell`**

Sustituir todo el bloque desde `return (` (línea ~413) hasta el cierre del componente por:

```tsx
  return <AuthShell>{content}</AuthShell>;
```

- [ ] **Step 5: Verificar que compila y que el login no cambió**

```bash
source ~/.nvm/nvm.sh
npm run lint
npx next build
```

Esperado: ambos terminan sin errores ni warnings nuevos.

Luego preview manual en `/`: la pantalla de login debe verse **exactamente igual** que antes (blobs rosados a la deriva, tarjeta blanca centrada, Doty flotando). Probar credenciales incorrectas para confirmar que el banner rosa de error sigue apareciendo con su animación.

- [ ] **Step 6: Commit**

```bash
git add components/auth/auth-ui.tsx app/page.tsx
git commit -m "refactor(auth): extraer shell y clases del login a components/auth/auth-ui

Las clases y el shell visual vivian dentro del cuerpo de Login(), asi que
ninguna otra pantalla podia reusarlos. Se extraen sin cambio visual para
que /forgot comparta una sola fuente de verdad.

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 2: Traducir el login al español y arreglar la navegación a `/forgot`

**Files:**
- Modify: `app/page.tsx`

**Interfaces:**
- Consumes: `inputCls`, `btnPrimary`, `btnOutline`, `ErrorBanner`, `AuthShell` de Task 1.
- Produces: nada nuevo. El `router` ya existe en el componente (`app/page.tsx:12`).

- [ ] **Step 1: Arreglar la navegación (regla dura #1)**

En `app/page.tsx:237`, dentro del botón "Forgot password?":

```tsx
onClick={() => window.location.replace("/forgot")}
```

pasa a:

```tsx
onClick={() => router.push("/forgot")}
```

`router` ya está declarado en la línea 12, no hay que importar nada.

- [ ] **Step 2: Traducir todos los strings de UI**

Tabla completa. La columna de línea es orientativa (se corre al editar); localizar por el texto en inglés.

| Línea aprox. | Inglés | Español |
|---|---|---|
| 60 | `Incorrect username or password!` | `¡Usuario o contraseña incorrectos!` |
| 73 | `Login failed. Please try again.` | `No pudimos entrar. Intenta de nuevo.` |
| 99 | `Please fill the Name input!` | `¡Falta tu nombre!` |
| 101 | `Please fill the Last name input!` | `¡Falta tu apellido!` |
| 103 | `Please fill the Birthday input!` | `¡Falta tu fecha de nacimiento!` |
| 105 | `Emails must match!` | `¡Los correos no coinciden!` |
| 107 | `Your password must be 8 or more characters long!` | `¡Tu contraseña debe tener 8 caracteres o más!` |
| 109 | `Both passwords must be the same!` | `¡Las contraseñas no coinciden!` |
| 143 | `Unexpected error` | `Error inesperado` |
| 186 | `Hi! I&apos;m Doty. Ready to learn something new?` | `¡Hola! Soy Doty. ¿Aprendemos algo nuevo?` |
| 200 | `Username` (placeholder) | `Usuario` |
| 208 | `Password` (placeholder) | `Contraseña` |
| 222 | `Logging in…` | `Entrando…` |
| 225 | `Let&apos;s go!` | `¡Vamos!` |
| 240 | `Forgot password?` | `¿Olvidaste tu contraseña?` |
| 247 | `New to dots? Create account` | `¿Nuevo en dots? Crea tu cuenta` |
| 262 | `Join the club!` | `¡Únete al club!` |
| 265 | `Fill in the form and let&apos;s get started` | `Llena el formulario y empezamos` |
| 276 | `First name` (placeholder) | `Nombre` |
| 283 | `Last name` (placeholder) | `Apellido` |
| 290 | `Email address` (placeholder) | `Correo` |
| 297 | `Confirm email` (placeholder) | `Repite el correo` |
| 304 | `Password` (placeholder) | `Contraseña` |
| 312 | `Confirm password` (placeholder) | `Repite la contraseña` |
| 332 | `Back` | `Volver` |
| 335 | `Create account` | `Crear cuenta` |
| 348 | `Getting things ready…` | `Preparando todo…` |
| 360 | `You&apos;re in! 🎉` | `¡Estás dentro! 🎉` |
| 363 | `We sent a confirmation email to` | `Te mandamos un correo de confirmación a` |
| 368 | `Your username:` | `Tu usuario:` |
| 379 | `Go to login` | `Ir a iniciar sesión` |
| 391 | `Oops!` | `¡Ups!` |
| 400 | `Try again` | `Intentar de nuevo` |
| 407 | `Back to login` | `Volver a iniciar sesión` |

Dos cuidados con JSX:
- Las entidades `&apos;` desaparecen: `let&apos;s` → `¡Vamos!` no lleva apóstrofe. Si alguna traducción necesitara una comilla simple, usar `&apos;`.
- `¡` y `¿` son seguros en JSX, no hay que escaparlos.

- [ ] **Step 3: Confirmar que no queda copy en inglés**

```bash
grep -nE '"[A-Z][a-z]+ [a-z]+|placeholder="[A-Z]' app/page.tsx
```

Esperado: solo coincidencias en atributos técnicos (`autoComplete="new-password"`, `type="text"`, nombres de clase). Ningún texto visible en inglés.

- [ ] **Step 4: Verificar**

```bash
source ~/.nvm/nvm.sh
npm run lint
npx next build
```

Esperado: ambos pasan.

Preview manual en `/`: todo el copy en español. Recorrer los estados: login, "¿Nuevo en dots? Crea tu cuenta" (registro), y forzar un error de validación (contraseñas distintas) para ver el banner en español. Pulsar "¿Olvidaste tu contraseña?": debe navegar a `/forgot` **sin recargar la página** — el 404 de Next es esperado en este punto, lo resuelve la Task 4.

- [ ] **Step 5: Commit**

```bash
git add app/page.tsx
git commit -m "i18n(auth): traducir el login al espanol y navegar con router.push

CLAUDE.md pide UI en espanol y el login estaba entero en ingles. De paso
se corrige la infraccion de la regla #1: window.location.replace recargaba
la pagina y tiraba el token en memoria.

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 3: Componente del código de 6 casillas

**Files:**
- Create: `components/auth/code-input.tsx`

**Interfaces:**
- Consumes: nada (autocontenido).
- Produces: `CodeInput`, default export, con props `{ value: string; onChange: (value: string) => void; disabled?: boolean }`. `value` es siempre string de 0 a 6 dígitos; `onChange` recibe ya filtrado a dígitos y recortado a 6.

- [ ] **Step 1: Crear `components/auth/code-input.tsx`**

Seis cajas de presentación (`aria-hidden`, `pointer-events-none`) con un input real superpuesto. El input lleva `text-transparent caret-transparent` y **no** `opacity-0`: con `opacity-0` iOS hace zoom al enfocar y los lectores de pantalla se confunden.

```tsx
"use client";

import React, { useRef } from "react";

const CELLS = [0, 1, 2, 3, 4, 5];

type CodeInputProps = {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
};

/**
 * Código de 6 dígitos: seis cajas de presentación con UN input real
 * superpuesto. Con seis inputs separados se rompen el pegado y el autofill
 * de `one-time-code`, y hay que manejar foco a mano; así todo eso es nativo.
 */
export default function CodeInput({
  value,
  onChange,
  disabled = false,
}: CodeInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const activeIndex = Math.min(value.length, CELLS.length - 1);

  return (
    <div
      className="relative"
      onPointerUp={() => inputRef.current?.focus()}
    >
      <div className="flex justify-center gap-2" aria-hidden>
        {CELLS.map((i) => {
          const isActive = !disabled && i === activeIndex;
          return (
            <div
              key={i}
              className={`flex h-14 w-11 items-center justify-center rounded-2xl border-2 bg-(--input-bg) font-display text-2xl font-extrabold text-foreground transition-all duration-150 ${
                isActive
                  ? "border-(--accent) ring-4 ring-(--accent)/15"
                  : "border-(--border)"
              }`}
            >
              {value[i] ??
                (isActive ? (
                  <span className="h-6 w-0.5 animate-pulse bg-(--accent)" />
                ) : (
                  ""
                ))}
            </div>
          );
        })}
      </div>

      <input
        ref={inputRef}
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, 6))}
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={6}
        disabled={disabled}
        aria-label="Código de 6 dígitos"
        className="absolute inset-0 h-full w-full cursor-pointer rounded-2xl bg-transparent text-center text-base text-transparent caret-transparent outline-none disabled:cursor-not-allowed"
      />
    </div>
  );
}
```

- [ ] **Step 2: Verificar que compila**

```bash
source ~/.nvm/nvm.sh
npm run lint
npx next build
```

Esperado: ambos pasan. El componente todavía no se renderiza en ninguna ruta; se prueba visualmente en la Task 4.

- [ ] **Step 3: Commit**

```bash
git add components/auth/code-input.tsx
git commit -m "feat(auth): componente de codigo de 6 casillas

Seis cajas de presentacion sobre un unico input real: mantiene nativos el
pegado, el autofill de one-time-code y el borrado, sin manejo manual de
foco. Traduce directo a React Native (un TextInput + seis View).

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 4: La pantalla `/forgot`

**Files:**
- Create: `app/forgot/page.tsx`

**Interfaces:**
- Consumes: `inputCls`, `btnPrimary`, `btnOutline`, `ErrorBanner`, `AuthShell` (Task 1); `CodeInput` (Task 3); `forgotPasswordService(email: string)` y `resetPasswordService(email: string, code: string, password: string)` de `services/auth.service.ts:27-43`; `Doty` de `components/ui/doty/doty.tsx`.
- Produces: la ruta `/forgot`. Nada que consuman otras tareas.

Va en la raíz de `app/`, hermana del login y **fuera** del grupo `(app)`: es un flujo inmersivo, sin nav ni HUD.

- [ ] **Step 1: Crear `app/forgot/page.tsx`**

Puntos a respetar, todos verificables al leer el código:

- Cada fase es un `<form onSubmit>` con `noValidate`. Da Enter nativo y deja que el gestor de contraseñas ofrezca guardar la nueva, sin el listener global de `keydown` que usa el login (regla #2).
- El cooldown corre con `setTimeout` dentro de un `useEffect` que depende de `cooldown`; el `setState` vive en el callback del timer, nunca en el cuerpo del efecto (regla #3).
- Toda navegación con `router.push` (regla #1).
- Un error **no** borra lo que el usuario escribió.

```tsx
"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  forgotPasswordService,
  resetPasswordService,
} from "@/services/auth.service";
import Doty from "@/components/ui/doty/doty";
import CodeInput from "@/components/auth/code-input";
import {
  inputCls,
  btnPrimary,
  btnOutline,
  ErrorBanner,
  AuthShell,
} from "@/components/auth/auth-ui";

/** El backend responde en inglés; aquí se traduce lo que ve el usuario. */
const ERROR_ES: Record<string, string> = {
  "Invalid or expired code": "Ese código no es válido o ya venció. Pide uno nuevo.",
  "That code has expired. Please request a new one":
    "El código venció. Pide uno nuevo.",
};

const GENERIC_ERROR = "Algo falló de nuestro lado. Intenta de nuevo.";
const RESEND_COOLDOWN_S = 30;

function translateError(e: unknown): string {
  const raw = (e as { response?: { data?: { message?: string | string[] } } })
    ?.response?.data?.message;
  const first = Array.isArray(raw) ? raw[0] : raw;
  if (!first) return GENERIC_ERROR;
  return ERROR_ES[first] ?? GENERIC_ERROR;
}

export default function ForgotPassword() {
  const router = useRouter();
  const [phase, setPhase] = useState<"email" | "code" | "done">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  // Cuenta atrás del reenvío. El setState va dentro del callback del timer,
  // no en el cuerpo del efecto (regla #3 de CLAUDE.md).
  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setTimeout(() => setCooldown(cooldown - 1), 1000);
    return () => clearTimeout(id);
  }, [cooldown]);

  const sendCode = async () => {
    const clean = email.trim();
    if (!clean) {
      setError("Escribe tu correo.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean)) {
      setError("Ese correo no se ve bien.");
      return;
    }
    setError("");
    setLoading(true);
    try {
      await forgotPasswordService(clean);
      setEmail(clean);
      setCooldown(RESEND_COOLDOWN_S);
      setPhase("code");
    } catch (e) {
      setError(translateError(e));
    } finally {
      setLoading(false);
    }
  };

  const resend = async () => {
    if (cooldown > 0 || loading) return;
    setError("");
    setLoading(true);
    try {
      await forgotPasswordService(email);
      setCooldown(RESEND_COOLDOWN_S);
    } catch (e) {
      setError(translateError(e));
    } finally {
      setLoading(false);
    }
  };

  const changePassword = async () => {
    if (code.length !== 6) {
      setError("El código son 6 dígitos.");
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
    setLoading(true);
    try {
      await resetPasswordService(email, code, password);
      setPhase("done");
    } catch (e) {
      setError(translateError(e));
    } finally {
      setLoading(false);
    }
  };

  let content = null;

  if (phase === "email") {
    content = (
      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          sendCode();
        }}
        className="flex w-full max-w-sm flex-col gap-7"
      >
        <div
          className="flex flex-col items-center gap-2 text-center"
          style={{ animation: "dots-slide-up 0.5s ease-out both" }}
        >
          <Doty pose="13" size="smaller" animation="bob" />
          <h1 className="font-display text-3xl font-extrabold tracking-tight text-foreground">
            ¿Olvidaste tu contraseña?
          </h1>
          <p className="text-sm font-semibold text-(--muted)">
            Pasa. Escribe tu correo y te mandamos un código para crear una
            nueva.
          </p>
        </div>

        {error && <ErrorBanner text={error} />}

        <div
          className="flex flex-col gap-4"
          style={{ animation: "dots-slide-up 0.5s ease-out 0.1s both" }}
        >
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Tu correo"
            type="email"
            inputMode="email"
            autoComplete="email"
            className={inputCls}
          />
          <button type="submit" disabled={loading} className={btnPrimary}>
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                Enviando…
              </span>
            ) : (
              "Enviar código"
            )}
          </button>
        </div>

        <div style={{ animation: "dots-slide-up 0.5s ease-out 0.2s both" }}>
          <button
            type="button"
            onClick={() => router.push("/")}
            className={btnOutline}
          >
            Volver al inicio
          </button>
        </div>
      </form>
    );
  } else if (phase === "code") {
    content = (
      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          changePassword();
        }}
        className="flex w-full max-w-sm flex-col gap-7"
      >
        <div
          className="flex flex-col items-center gap-2 text-center"
          style={{ animation: "dots-slide-up 0.5s ease-out both" }}
        >
          <Doty pose="07" size="smaller" animation="bob" />
          <h1 className="font-display text-3xl font-extrabold tracking-tight text-foreground">
            Revisa tu correo
          </h1>
          <p className="text-sm font-semibold text-(--muted)">
            Si{" "}
            <span className="font-extrabold text-foreground">{email}</span> está
            registrado, ahí te espera un código de 6 dígitos. Vence en 30
            minutos.
          </p>
        </div>

        {error && <ErrorBanner text={error} />}

        <div
          className="flex flex-col gap-4"
          style={{ animation: "dots-slide-up 0.5s ease-out 0.1s both" }}
        >
          <CodeInput value={code} onChange={setCode} disabled={loading} />
          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Contraseña nueva"
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
          <button type="submit" disabled={loading} className={btnPrimary}>
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                Cambiando…
              </span>
            ) : (
              "Cambiar contraseña"
            )}
          </button>
        </div>

        <div
          className="flex flex-col gap-2.5"
          style={{ animation: "dots-slide-up 0.5s ease-out 0.2s both" }}
        >
          <button
            type="button"
            onClick={resend}
            disabled={cooldown > 0 || loading}
            className={btnOutline}
          >
            {cooldown > 0 ? `Reenviar en ${cooldown} s` : "Reenviar código"}
          </button>
          <button
            type="button"
            onClick={() => {
              setPhase("email");
              setCode("");
              setError("");
            }}
            className={btnOutline}
          >
            Usar otro correo
          </button>
        </div>
      </form>
    );
  } else {
    content = (
      <div
        className="flex w-full max-w-sm flex-col items-center gap-6 text-center"
        style={{ animation: "dots-pop-in 0.5s ease-out both" }}
      >
        <Doty pose="17" size="smaller" animation="cheer" />
        <h1 className="font-display text-3xl font-extrabold tracking-tight text-foreground">
          ¡Listo!
        </h1>
        <p className="text-sm font-semibold text-(--muted)">
          Tu contraseña nueva ya está activa.
        </p>
        <button
          type="button"
          onClick={() => router.push("/")}
          className={btnPrimary}
        >
          Iniciar sesión
        </button>
      </div>
    );
  }

  return <AuthShell>{content}</AuthShell>;
}
```

- [ ] **Step 2: Verificar que compila**

```bash
source ~/.nvm/nvm.sh
npm run lint
npx next build
```

Esperado: ambos pasan. Prestar atención a que el lint del compiler de React **no** se queje del `useEffect` del cooldown.

- [ ] **Step 3: Preview manual del flujo**

Requiere el backend corriendo en `:4000`. El SMTP todavía no está configurado (eso es la Task 5), así que **el código se lee del log del backend**, en la línea `[DEV] Password reset code for <correo>: <código>`.

Usar un correo que exista en la BD. Recorrido:

1. `/` → "¿Olvidaste tu contraseña?" → debe abrir `/forgot` sin recargar.
2. Escribir el correo → "Enviar código" → pasa a la fase del código; el botón de reenvío arranca la cuenta atrás desde 30 s.
3. Buscar el código en el log del backend.
4. Escribirlo: las casillas se llenan una a una, la activa se marca en rosa con el caret pulsando.
5. Contraseña nueva (8+) dos veces → "Cambiar contraseña" → pantalla de "¡Listo!" con Doty celebrando.
6. "Iniciar sesión" → entrar con la contraseña nueva. **Debe funcionar.**

Casos de error a recorrer, confirmando que el mensaje sale en español y **no se borra lo escrito**:

- Correo vacío → "Escribe tu correo."
- Correo mal formado (`hola@`) → "Ese correo no se ve bien."
- Código de 3 dígitos → "El código son 6 dígitos."
- Código de 6 dígitos equivocado → "Ese código no es válido o ya venció. Pide uno nuevo."
- Contraseña de 4 caracteres → "Tu contraseña debe tener 8 caracteres o más."
- Contraseñas distintas → "Las contraseñas no coinciden."

Comprobaciones específicas del campo de código:
- **Pegar** `123456` de una vez llena las seis casillas.
- Escribir letras no hace nada (el filtro las descarta).
- Backspace borra de a un dígito.
- Tap sobre cualquier casilla enfoca el campo.

- [ ] **Step 4: Commit**

```bash
git add app/forgot/page.tsx
git commit -m "feat(auth): pantalla /forgot funcional en tres fases

La ruta era un 404 desde siempre: el backend ya emitia el codigo de 6
digitos y los services estaban escritos sin usarse. Correo -> codigo +
contrasena nueva -> listo, con reenvio en cooldown de 30 s.

El copy no afirma que el correo se envio: el backend responde ok aunque
la cuenta no exista, para que nadie pueda enumerar emails registrados.

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 5: Activar el envío real de correo

Esta tarea toca `dots-backend`, no la webapp. El archivo **no está versionado**: no hay commit que hacer allá.

**Files:**
- Modify: `/home/endurance/Projects/Endurance/dots/dots-backend/.env` (append)

**Interfaces:**
- Consumes: la app password de `dots-info-web/.env.local` (variable `GMAIL_APP_PASSWORD`).
- Produces: envío real de correo desde `dotsonlinelearningapp@gmail.com`.

⚠️ **Antes de empezar: acordar con el usuario qué cuenta de prueba usar.** Con el SMTP activo, un `forgot-password` sobre el correo de un usuario real de la BD **le manda un correo de verdad**. La BD es la de producción compartida.

- [ ] **Step 1: Añadir las variables al `.env` del backend**

La clave se copia **de archivo a archivo**, sin pasarla por el chat ni por el historial del shell:

```bash
cd /home/endurance/Projects/Endurance/dots/dots-backend
PW=$(grep -E '^GMAIL_APP_PASSWORD=' ../dots-info-web/.env.local | cut -d= -f2-)
{
  echo ""
  echo "# SMTP (Gmail) — credencial compartida con dots-info-web"
  echo "SMTP_HOST=smtp.gmail.com"
  echo "SMTP_PORT=465"
  echo "SMTP_SECURE=true"
  echo "SMTP_USER=dotsonlinelearningapp@gmail.com"
  echo "SMTP_PASS=$PW"
  echo "MAIL_FROM=Dots <dotsonlinelearningapp@gmail.com>"
} >> .env
unset PW
```

`465` + `secure: true` replica lo que ya funciona en `dots-info-web`, en vez del `587` + STARTTLS que trae el default de `mail.module.ts:13-15`.

**`MAIL_FROM` va sin comillas a propósito.** Con `MAIL_FROM="Dots" <...>`, dotenv ve que el valor abre con `"`, corta en la comilla de cierre y guarda solo `Dots`, tirando la dirección. Nodemailer parsea `Dots <correo>` sin comillas perfectamente.

- [ ] **Step 2: Confirmar que las seis variables quedaron bien escritas**

```bash
cd /home/endurance/Projects/Endurance/dots/dots-backend
grep -cE '^(SMTP_|MAIL_FROM)' .env
grep -E '^(SMTP_HOST|SMTP_PORT|SMTP_SECURE|SMTP_USER|MAIL_FROM)=' .env
```

Esperado: el primer comando imprime `6`. El segundo muestra las cinco líneas no sensibles con sus valores (`SMTP_PASS` no se imprime).

- [ ] **Step 3: Reiniciar el backend**

El watcher no relee el `.env` solo. Reiniciarlo y confirmar que arranca sin errores de SMTP.

- [ ] **Step 4: Verificación end-to-end con la cuenta de prueba**

Con la cuenta acordada en el preámbulo:

1. `/forgot` → escribir el correo de prueba → "Enviar código".
2. **El correo debe llegar de verdad**, remitido por `Dots <dotsonlinelearningapp@gmail.com>` (no por `grulladepapel.cl@gmail.com`), con asunto "Your Dots password reset code" y el código en grande.
3. En el log del backend debe aparecer `Reset code emailed to <correo>` — **no** el `[DEV] Password reset code…`, que solo sale cuando el envío falla.
4. Completar el flujo con el código del correo y entrar con la contraseña nueva.

Si el correo no llega: revisar el log del backend. `Invalid login: 535-5.7.8` significa app password inválida o revocada, y hay que generar otra en `myaccount.google.com/apppasswords`.

- [ ] **Step 5: Actualizar el estado del spec**

En `docs/superpowers/specs/2026-08-06-forgot-password-design.md`, cambiar la línea de estado por:

```markdown
- **Estado:** ✅ implementado 2026-08-06. Pendiente: las mismas variables SMTP en el `.env` de producción del VPS (§7).
```

```bash
cd /home/endurance/Projects/Endurance/dots/dots-webapp
git add docs/superpowers/specs/2026-08-06-forgot-password-design.md
git commit -m "docs: marcar el spec de forgot password como implementado

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Fuera de alcance (del spec §7, no hacer en este plan)

- **`.env` de producción del VPS.** Sin esas variables, el reset no manda correos en producción.
- **Rate limiting de `forgot-password`.** El cooldown de 30 s es solo de UI; nada impide llamar al endpoint en bucle y quemar la cuota de Gmail. Es trabajo de backend, en otro spec.
- **Auto-login tras el reset.** El endpoint no devuelve token.
- **Traducir el correo del reset**, que está en inglés en `mail.service.ts:35-42`.
- **El fallback en duro `grulladepapel.cl@gmail.com`** de `mail.service.ts:18`: se neutraliza con `MAIL_FROM`, no se borra.
- **Bug preexistente ajeno:** `sendNewUser` hace `setLogin("wrongcode")` (`app/page.tsx:138`) pero no existe bloque de render para ese estado, así que la tarjeta queda vacía. No tocarlo aquí.
