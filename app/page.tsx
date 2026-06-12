"use client";

import React, { useCallback, useEffect, useState } from "react";
import type { AxiosError } from "axios";
import { loginService } from "@/services/auth.service";
import { useAuth } from "@/context/auth-context";
import api from "@/lib/api-client";
import Doty from "@/components/ui/doty/doty";

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
        window.location.replace("/levels");
      } else {
        setIncorrect(true);
        const text =
          (response && (response.message || response.error)) ||
          "Incorrect username or password!";
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
        "Login failed. Please try again.";
      setMsg(errMsg);
    } finally {
      setLoginLoading(false);
    }
  }, [user, password, setAccessToken]);

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
      setMsg("Please fill the Name input!");
    } else if (lastName === "") {
      setMsg("Please fill the Last name input!");
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
      setErrorMessage(err.response?.data?.error ?? "Unexpected error");
    }
  };

  /* ─── Shared classes ───────────────────────────────────────── */
  const inputCls =
    "w-full rounded-2xl border-2 border-(--border) bg-(--input-bg) px-4 py-3 text-base text-foreground placeholder:text-(--muted) outline-none transition-all duration-200 focus:border-(--accent) focus:ring-4 focus:ring-(--accent)/15";

  const btnPrimary =
    "dots-pressable w-full rounded-2xl bg-(--accent) px-4 py-3.5 text-sm font-extrabold tracking-wide text-(--accent-contrast) [--press-color:#9c005d] disabled:opacity-60";

  const btnOutline =
    "dots-pressable w-full rounded-2xl border-2 border-(--border) bg-(--surface) px-4 py-3 text-sm font-bold text-(--muted) hover:text-(--accent) hover:border-(--accent)";

  const errorBanner = (text: string) => (
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
            Hi! I&apos;m Doty. Ready to learn something new?
          </p>
        </div>

        {incorrect && errorBanner(msg)}

        {/* Form */}
        <div
          className="flex flex-col gap-4"
          style={{ animation: "dots-slide-up 0.5s ease-out 0.1s both" }}
        >
          <input
            value={user}
            onChange={(e) => setUser(e.target.value)}
            placeholder="Username"
            type="text"
            autoComplete="username"
            className={inputCls}
          />
          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
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
                Logging in…
              </span>
            ) : (
              "Let's go!"
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
            New to dots? Create account
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
            Join the club!
          </h2>
          <p className="text-sm font-semibold text-(--muted)">
            Fill in the form and let&apos;s get started
          </p>
        </div>

        {msg && errorBanner(msg)}

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
            autoComplete="new-password"
            className={inputCls}
          />
          <input
            value={password2}
            onChange={(e) => setPassword2(e.target.value)}
            placeholder="Confirm password"
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
        <div style={{ animation: "dots-float 1.5s ease-in-out infinite" }}>
          <Doty pose="07" size="tiny" />
        </div>
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-(--border) border-t-(--accent)" />
        <p className="text-sm font-bold text-(--muted)">
          Getting things ready…
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
          You&apos;re in! 🎉
        </h2>
        <p className="text-sm font-semibold text-(--muted)">
          We sent a confirmation email to{" "}
          <span className="font-extrabold text-foreground">{email}</span>.
        </p>
        {newUsername && (
          <p className="text-sm font-semibold text-(--muted)">
            Your username:{" "}
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
          Go to login
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
          Oops!
        </h2>
        <p className="text-sm font-semibold text-(--muted)">{errorMessage}</p>
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
    <div className="relative flex min-h-screen w-full items-center justify-center overflow-hidden px-6 py-12 text-foreground">
      {/* Drifting color blobs behind the card */}
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

      {/* Card */}
      <div className="dots-card relative z-10 flex w-full max-w-3xl items-center justify-center px-6 py-10 md:px-12 md:py-12">
        {content}
      </div>
    </div>
  );
}
