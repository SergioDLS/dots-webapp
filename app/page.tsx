"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { AxiosError } from "axios";
import { loginService } from "@/services/auth.service";
import { useAuth } from "@/context/auth-context";
import api from "@/lib/api-client";
import Doty from "@/components/ui/doty/doty";
import {
  inputCls,
  btnPrimary,
  btnOutline,
  ErrorBanner,
  AuthShell,
} from "@/components/auth/auth-ui";

export default function Login() {
  const router = useRouter();
  const [user, setUser] = useState("");
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [login, setLogin] = useState("login");
  const [incorrect, setIncorrect] = useState(false);
  const [name, setName] = useState("");
  const [lastName, setLastName] = useState("");
  const [birthday, setBirthday] = useState("2022-04-17");
  const [email, setEmail] = useState("");
  const [email2, setEmail2] = useState("");
  const [msg, setMsg] = useState("");
  const [code] = useState("");
  const [newUsername, setNewUsername] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
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
        // Persist the profile so components (greeting, admin menu,
        // profile picture) can render it without refetching.
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
        // Client-side navigation keeps the AuthProvider mounted, so the
        // access token from the login response stays in memory. The refresh
        // cookie is only needed as a fallback on full page reloads.
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
        response?: { data?: { message?: string; error?: string } };
        message?: string;
      };
      const errMsg =
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

  const signInHandler = () => {
    if (name === "") {
      setMsg("¡Falta tu nombre!");
    } else if (lastName === "") {
      setMsg("¡Falta tu apellido!");
    } else if (birthday === "") {
      setMsg("¡Falta tu fecha de nacimiento!");
    } else if (email !== email2) {
      setMsg("¡Los correos no coinciden!");
    } else if (password.length < 8) {
      setMsg("¡Tu contraseña debe tener 8 caracteres o más!");
    } else if (password !== password2) {
      setMsg("¡Las contraseñas no coinciden!");
    } else {
      setMsg("");
      setLogin("loading");
      sendNewUser();
    }
  };

  const newUserHandler = (clean: boolean) => {
    setLogin("new-user");
    if (clean) {
      setName("");
      setLastName("");
      setBirthday("");
      setEmail("");
      setMsg("");
    }
  };

  const sendNewUser = async () => {
    try {
      const response = await api.post<{ result: string; username?: string }>(
        "/newUser",
        { name, lastName, email, code },
      );
      if (response.data.result === "OK") {
        setLogin("username");
        setNewUsername(String(response.data.username));
      } else if (response.data.result === "NOK5") {
        setLogin("wrongcode");
      }
    } catch (error) {
      const err = error as AxiosError<{ error?: string }>;
      setLogin("error");
      setErrorMessage(err.response?.data?.error ?? "Error inesperado");
    }
  };

  let content = null;
  if (login === "login") {
    content = (
      <div className="flex w-full max-w-sm flex-col gap-7">
        {/* Brand + mascot */}
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

        {/* Form */}
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
            {loginLoading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                Entrando…
              </span>
            ) : (
              "¡Vamos!"
            )}
          </button>
        </div>

        {/* Secondary links */}
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
          <button
            type="button"
            onClick={() => newUserHandler(true)}
            className={btnOutline}
          >
            ¿Nuevo en dots? Crea tu cuenta
          </button>
        </div>
      </div>
    );
  } else if (login === "new-user") {
    content = (
      <div className="flex w-full max-w-2xl flex-col gap-7">
        {/* Header */}
        <div
          className="flex flex-col items-center gap-2 text-center"
          style={{ animation: "dots-slide-up 0.5s ease-out both" }}
        >
          <Doty pose="13" size="tiny" />
          <h2 className="font-display text-3xl font-extrabold tracking-tight text-foreground">
            ¡Únete al club!
          </h2>
          <p className="text-sm font-semibold text-(--muted)">
            Llena el formulario y empezamos
          </p>
        </div>

        {msg && <ErrorBanner text={msg} />}

        {/* Fields */}
        <div className="grid gap-4 md:grid-cols-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nombre"
            type="text"
            className={inputCls}
          />
          <input
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            placeholder="Apellido"
            type="text"
            className={inputCls}
          />
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Correo"
            type="email"
            className={inputCls}
          />
          <input
            value={email2}
            onChange={(e) => setEmail2(e.target.value)}
            placeholder="Repite el correo"
            type="email"
            className={inputCls}
          />
          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Contraseña"
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
          <input
            value={birthday}
            onChange={(e) => setBirthday(e.target.value)}
            type="date"
            className={`${inputCls} md:col-span-2 text-(--muted)`}
          />
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => setLogin("login")}
            className={btnOutline}
          >
            Volver
          </button>
          <button type="button" onClick={signInHandler} className={btnPrimary}>
            Crear cuenta
          </button>
        </div>
      </div>
    );
  } else if (login === "loading") {
    content = (
      <div className="flex flex-col items-center gap-4 text-center">
        <div style={{ animation: "dots-float 1.5s ease-in-out infinite" }}>
          <Doty pose="07" size="tiny" />
        </div>
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-(--border) border-t-(--accent)" />
        <p className="text-sm font-bold text-(--muted)">
          Preparando todo…
        </p>
      </div>
    );
  } else if (login === "username") {
    content = (
      <div
        className="flex w-full max-w-sm flex-col items-center gap-6 text-center"
        style={{ animation: "dots-pop-in 0.5s ease-out both" }}
      >
        <Doty pose="02" size="smaller" />
        <h2 className="font-display text-3xl font-extrabold tracking-tight text-foreground">
          ¡Estás dentro! 🎉
        </h2>
        <p className="text-sm font-semibold text-(--muted)">
          Te mandamos un correo de confirmación a{" "}
          <span className="font-extrabold text-foreground">{email}</span>.
        </p>
        {newUsername && (
          <p className="text-sm font-semibold text-(--muted)">
            Tu usuario:{" "}
            <span className="font-extrabold text-foreground">
              {newUsername}
            </span>
          </p>
        )}
        <button
          type="button"
          onClick={() => setLogin("login")}
          className={btnPrimary}
        >
          Ir a iniciar sesión
        </button>
      </div>
    );
  } else if (login === "error") {
    content = (
      <div
        className="flex w-full max-w-sm flex-col items-center gap-6 text-center"
        style={{ animation: "dots-pop-in 0.5s ease-out both" }}
      >
        <Doty pose="05" size="smaller" />
        <h2 className="font-display text-3xl font-extrabold tracking-tight text-foreground">
          ¡Ups!
        </h2>
        <p className="text-sm font-semibold text-(--muted)">{errorMessage}</p>
        <div className="flex w-full flex-col gap-3">
          <button
            type="button"
            onClick={() => newUserHandler(false)}
            className={btnPrimary}
          >
            Intentar de nuevo
          </button>
          <button
            type="button"
            onClick={() => setLogin("login")}
            className={btnOutline}
          >
            Volver a iniciar sesión
          </button>
        </div>
      </div>
    );
  }

  return <AuthShell>{content}</AuthShell>;
}
