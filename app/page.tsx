"use client";

import React, { useCallback, useEffect, useState } from "react";
import axios from "axios";
import type { AxiosError, AxiosResponse } from "axios";
import { loginService } from "@/services/auth.service";
import * as moment from "moment";
import { useAuth } from "@/context/auth-context";

export default function Login() {
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
      console.log("response", response);
      if (response && response.token) {
        setIncorrect(false);
        setMsg("");
        setAccessToken(response.token);
        window.location.replace("/levels");
      } else {
        setIncorrect(true);
        const text = (response && (response.message || response.error)) || "Incorrect username or password!";
        setMsg(text);
      }
    } catch (e: unknown) {
      setIncorrect(true);
      const ex = e as { response?: { data?: { message?: string; error?: string } }; message?: string };
      const errMsg = ex?.response?.data?.message || ex?.response?.data?.error || ex?.message || "Login failed. Please try again.";
      setMsg(errMsg);
    } finally {
      setLoginLoading(false);
    }
  }, [user, password, setAccessToken]);

  useEffect(() => {
    const keyDownHandler = (event: KeyboardEvent) => {
      if (event.key === "Enter") {
        event.preventDefault();
        if (password.split("").length > 4) {
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
      setMsg("Please fill the Name input!");
    } else if (lastName === "") {
      setMsg("Please fill the Last name input!");
    } else if (birthday === "") {
      setMsg("Please fill the Birthday input!");
    } else if (birthday === "") {
      setMsg("Please fill the Birthday input!");
    } else if (email !== email2) {
      setMsg("Emails must match!");
    } else if (password.length < 8) {
      setMsg("Your password must be 8 or more characters long!");
    } else if (password !== password2) {
      setMsg("Both passwords must be the same!");
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
      setBirthday("");
      setEmail("");
      setMsg("");
    }
  };

  const sendNewUser = () => {
    const data = {
      name: name,
      lastName: lastName,
      email: email,

      code: code,
    };
    axios
      .post("/newUser", data)
      .then(
        (response: AxiosResponse<{ result: string; username?: string }>) => {
          if (response.data.result === "OK") {
            setLogin("username");
            setNewUsername(String(response.data.username));
          } else if (response.data.result === "NOK5") {
            setLogin("wrongcode");
          }
        },
      )
      .catch((error: AxiosError<{ error?: string }>) => {
        console.log(error.response);
        setLogin("error");
        setErrorMessage(error.response?.data?.error ?? "Unexpected error");
      });
  };

  // ─── Shared classes — Tailwind v4 CSS-var syntax ──────────────
  // mapped @theme tokens:  bg-background · text-foreground
  // unmapped custom vars:  (--surface) · (--border) · (--muted) · (--accent) · (--primary-accent) …
  const inputCls =
    "w-full rounded-2xl border-2 border-(--border) bg-(--input-bg) px-4 py-3 text-base text-foreground placeholder:text-(--muted) outline-none transition-all duration-200 focus:border-(--accent) focus:ring-4 focus:ring-(--accent)/15 focus:bg-(--surface)";

  const btnPrimary =
    "w-full rounded-2xl bg-linear-to-r from-(--primary-accent) to-(--accent) px-4 py-3 text-sm font-bold text-(--primary-accent-contrast) shadow-md shadow-(--primary-accent)/20 transition-all duration-200 hover:opacity-90 hover:shadow-lg hover:-translate-y-0.5 active:scale-[.98] active:translate-y-0";

  const btnOutline =
    "w-full rounded-2xl border-2 border-(--border) bg-transparent px-4 py-3 text-sm font-semibold text-(--muted) transition-all duration-200 hover:border-(--accent) hover:text-(--accent) hover:bg-(--accent)/5";

  let content = null;
  if (login === "login") {
    content = (
      <div className="flex w-full max-w-sm flex-col gap-8">
        {/* Brand */}
        <div className="flex flex-col items-center gap-1 text-center">
          <h1 className="text-4xl font-extrabold tracking-tight text-(--primary)">
            dots
          </h1>
          <p className="text-sm text-(--muted)">
            Language Online Learning
          </p>
        </div>

        {/* Error */}
        {incorrect && (
          <p className="rounded-2xl bg-(--primary)/10 px-4 py-2 text-center text-sm font-medium text-(--primary)">
            {msg}
          </p>
        )}

        {/* Form */}
        <div className="flex flex-col gap-4">
          <input
            value={user}
            onChange={(e) => setUser(e.target.value)}
            placeholder="Username"
            type="text"
            className={inputCls}
          />
          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            type="password"
            className={inputCls}
          />
          <button type="button" onClick={loginHandler} disabled={loginLoading} className={btnPrimary}>
            {loginLoading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                Logging in…
              </span>
            ) : (
              "Log in"
            )}
          </button>
        </div>

        {/* Secondary links */}
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={() => window.location.replace("/forgot")}
            className={btnOutline}
          >
            Forgot password?
          </button>
          <button
            type="button"
            onClick={() => newUserHandler(true)}
            className={btnOutline}
          >
            New to Dots? Create account
          </button>
        </div>
      </div>
    );
  } else if (login === "new-user") {
    content = (
      <div className="flex w-full max-w-2xl flex-col gap-8">
        {/* Header */}
        <div className="flex flex-col items-center gap-1 text-center">
          <h2 className="text-3xl font-extrabold tracking-tight text-foreground">
            Create account
          </h2>
          <p className="text-sm text-(--muted)">
            Fill in the form to get started
          </p>
        </div>

        {/* Error */}
        {msg && (
          <p className="rounded-2xl bg-(--primary)/10 px-4 py-2 text-center text-sm font-medium text-(--primary)">
            {msg}
          </p>
        )}

        {/* Fields */}
        <div className="grid gap-4 md:grid-cols-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="First name"
            type="text"
            className={inputCls}
          />
          <input
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            placeholder="Last name"
            type="text"
            className={inputCls}
          />
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email address"
            type="email"
            className={inputCls}
          />
          <input
            value={email2}
            onChange={(e) => setEmail2(e.target.value)}
            placeholder="Confirm email"
            type="email"
            className={inputCls}
          />
          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            type="password"
            className={inputCls}
          />
          <input
            value={password2}
            onChange={(e) => setPassword2(e.target.value)}
            placeholder="Confirm password"
            type="password"
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
            Back
          </button>
          <button type="button" onClick={signInHandler} className={btnPrimary}>
            Create account
          </button>
        </div>
      </div>
    );
  } else if (login === "loading") {
    content = (
      <div className="flex flex-col items-center gap-4 text-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-(--border) border-t-(--accent)" />
        <p className="text-sm font-medium text-(--muted)">
          Getting things ready…
        </p>
      </div>
    );
  } else if (login === "username") {
    content = (
      <div className="flex w-full max-w-sm flex-col items-center gap-6 text-center">
        <h2 className="text-3xl font-extrabold tracking-tight text-foreground">
          You&apos;re in!
        </h2>
        <p className="text-sm text-(--muted)">
          We sent a confirmation email to{" "}
          <span className="font-semibold text-foreground">{email}</span>.
        </p>
        {newUsername && (
          <p className="text-sm text-(--muted)">
            Your username:{" "}
            <span className="font-semibold text-foreground">{newUsername}</span>
          </p>
        )}
        <button
          type="button"
          onClick={() => setLogin("login")}
          className={btnPrimary}
        >
          Go to login
        </button>
      </div>
    );
  } else if (login === "error") {
    content = (
      <div className="flex w-full max-w-sm flex-col items-center gap-6 text-center">
        <h2 className="text-3xl font-extrabold tracking-tight text-foreground">
          Oops!
        </h2>
        <p className="text-sm text-(--muted)">{errorMessage}</p>
        <div className="flex w-full flex-col gap-3">
          <button
            type="button"
            onClick={() => newUserHandler(false)}
            className={btnPrimary}
          >
            Try again
          </button>
          <button
            type="button"
            onClick={() => setLogin("login")}
            className={btnOutline}
          >
            Back to login
          </button>
        </div>
      </div>
    );
  }
  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-background px-6 py-12 text-foreground">
      {content}
    </div>
  );
}
