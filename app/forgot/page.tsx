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
  PendingLabel,
} from "@/components/auth/auth-ui";

/** El backend responde en inglés; aquí se traduce lo que ve el usuario. */
const ERROR_ES: Record<string, string> = {
  "Invalid or expired code": "Ese código no es válido o ya venció. Pide uno nuevo.",
  "That code has expired. Please request a new one":
    "El código venció. Pide uno nuevo.",
};

const GENERIC_ERROR = "Algo falló de nuestro lado. Intenta de nuevo.";
const RESEND_COOLDOWN_S = 30;

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isValidEmail(email: string): boolean {
  return EMAIL_REGEX.test(email.trim());
}

function translateError(e: unknown): string {
  const raw = (e as { response?: { data?: { message?: string | string[] } } })
    ?.response?.data?.message;
  if (Array.isArray(raw)) {
    const first = raw[0];
    return (first && ERROR_ES[first]) ?? "Revisa los datos: algo no tiene el formato correcto.";
  }
  if (!raw) return GENERIC_ERROR;
  return ERROR_ES[raw] ?? GENERIC_ERROR;
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

  const validateEmailField = (): boolean => {
    const clean = email.trim();
    if (!clean) {
      setError("Escribe tu correo.");
      return false;
    }
    if (!isValidEmail(clean)) {
      setError("Ese correo no se ve bien.");
      return false;
    }
    return true;
  };

  const sendCode = async () => {
    if (!validateEmailField()) return;
    const clean = email.trim();
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
            {loading ? <PendingLabel text="Enviando…" /> : "Enviar código"}
          </button>
        </div>

        <div
          className="flex flex-col gap-2.5"
          style={{ animation: "dots-slide-up 0.5s ease-out 0.2s both" }}
        >
          <button
            type="button"
            onClick={() => {
              if (!validateEmailField()) return;
              setError("");
              setPhase("code");
            }}
            className={btnOutline}
          >
            Ya tengo un código
          </button>
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
            {loading ? <PendingLabel text="Cambiando…" /> : "Cambiar contraseña"}
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
              setPassword("");
              setPassword2("");
              setCooldown(0);
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
