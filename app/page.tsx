"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { loginService } from "@/services/auth.service";
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

/** El backend distingue bloqueo de vencimiento; el usuario merece saber cuál. */
const REASON_ES: Record<string, string> = {
  blocked: "Tu acceso fue desactivado. Escríbenos si crees que es un error.",
  expired: "Tu acceso venció. Contacta a tu academia para renovarlo.",
};

export default function Login() {
  const router = useRouter();
  const [user, setUser] = useState("");
  const [password, setPassword] = useState("");
  const [incorrect, setIncorrect] = useState(false);
  const [msg, setMsg] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);
  const { setAccessToken } = useAuth();

  const loginHandler = useCallback(async () => {
    setLoginLoading(true);
    try {
      const response = await loginService(user, password);
      if (response && response.token) {
        setIncorrect(false);
        setMsg("");
        setAccessToken(response.token);
        // Persiste el perfil para que los componentes (saludo, menú admin,
        // foto de perfil) puedan renderizarlo sin refetchear.
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
        // La navegación client-side mantiene AuthProvider montado, así el
        // token en memoria sobrevive. La cookie de refresh solo se usa como
        // respaldo en recargas completas.
        router.push("/levels");
      } else {
        setIncorrect(true);
        const text =
          (response && (response.message || response.error)) ||
          "¡Usuario o contraseña incorrectos!";
        setMsg(text);
      }
    } catch (e: unknown) {
      setIncorrect(true);
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
    } finally {
      setLoginLoading(false);
    }
  }, [user, password, setAccessToken, router]);

  useEffect(() => {
    const keyDownHandler = (event: KeyboardEvent) => {
      if (event.key === "Enter") {
        event.preventDefault();
        if (password.length > 4) {
          loginHandler();
        }
      }
    };

    document.addEventListener("keydown", keyDownHandler);

    return () => {
      document.removeEventListener("keydown", keyDownHandler);
    };
  }, [password, loginHandler]);

  return (
    <AuthShell>
      <div className="flex w-full max-w-sm flex-col gap-7">
        {/* Marca + mascota */}
        <div
          className="flex flex-col items-center gap-2 text-center"
          style={{ animation: "dots-slide-up 0.5s ease-out both" }}
        >
          <div style={{ animation: "dots-float 3.5s ease-in-out infinite" }}>
            <Doty pose="17" size="smaller" />
          </div>
          <h1 className="font-display text-5xl font-extrabold leading-none tracking-tight text-(--accent)">
            dots
          </h1>
          <p className="text-sm font-semibold text-(--muted)">
            ¡Hola! Soy Doty. ¿Aprendemos algo nuevo?
          </p>
        </div>

        {incorrect && <ErrorBanner text={msg} />}

        {/* Formulario */}
        <div
          className="flex flex-col gap-4"
          style={{ animation: "dots-slide-up 0.5s ease-out 0.1s both" }}
        >
          <input
            value={user}
            onChange={(e) => setUser(e.target.value)}
            placeholder="Usuario"
            type="text"
            autoComplete="username"
            className={inputCls}
          />
          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Contraseña"
            type="password"
            autoComplete="current-password"
            className={inputCls}
          />
          <button
            type="button"
            onClick={loginHandler}
            disabled={loginLoading}
            className={btnPrimary}
          >
            {loginLoading ? <PendingLabel text="Entrando…" /> : "¡Vamos!"}
          </button>
        </div>

        {/* Enlaces secundarios */}
        <div
          className="flex flex-col gap-2.5"
          style={{ animation: "dots-slide-up 0.5s ease-out 0.2s both" }}
        >
          <button
            type="button"
            onClick={() => router.push("/forgot")}
            className={btnOutline}
          >
            ¿Olvidaste tu contraseña?
          </button>
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
        </div>
      </div>
    </AuthShell>
  );
}
