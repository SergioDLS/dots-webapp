"use client";

import React, { useCallback, useEffect, useState } from "react";
import {
  loginService,
  registerService,
  forgotPasswordService,
  resetPasswordService,
} from "@/services/auth.service";
import { useAuth } from "@/context/auth-context";
import Doty from "@/components/ui/doty/doty";
import UIButton from "@/components/ui/button/button";

type Screen = "login" | "register" | "forgot" | "reset";

type SessionResponse = {
  token?: string;
  name?: string;
  last_name?: string;
  profile?: number;
  profile_picture?: string | null;
  streak?: number;
};

const errText = (e: unknown, fallback: string): string => {
  const ex = e as {
    response?: { data?: { message?: string; error?: string } };
    message?: string;
  };
  return (
    ex?.response?.data?.message ||
    ex?.response?.data?.error ||
    ex?.message ||
    fallback
  );
};

export default function Login() {
  const { setAccessToken } = useAuth();
  const [screen, setScreen] = useState<Screen>("login");
  const [msg, setMsg] = useState("");
  const [isError, setIsError] = useState(false);
  const [loading, setLoading] = useState(false);

  // login
  const [user, setUser] = useState("");
  const [password, setPassword] = useState("");

  // register
  const [regName, setRegName] = useState("");
  const [regLastName, setRegLastName] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regUsername, setRegUsername] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regPassword2, setRegPassword2] = useState("");
  const [regBirthday, setRegBirthday] = useState("");

  // forgot / reset
  const [resetEmail, setResetEmail] = useState("");
  const [resetCode, setResetCode] = useState("");
  const [resetPassword, setResetPasswordVal] = useState("");
  const [resetPassword2, setResetPassword2] = useState("");

  const goTo = (next: Screen) => {
    setScreen(next);
    setMsg("");
    setIsError(false);
  };

  const persistAndEnter = useCallback(
    (response: SessionResponse) => {
      setAccessToken(response.token ?? null);
      try {
        localStorage.setItem(
          "user",
          JSON.stringify({
            name: response.name,
            last_name: response.last_name,
            profile: response.profile,
            profile_pic: response.profile_picture ?? null,
          }),
        );
        localStorage.setItem("streak", String(response.streak ?? 0));
      } catch {
        /* storage unavailable — non-fatal */
      }
      window.location.replace("/levels");
    },
    [setAccessToken],
  );

  // ── Login ──────────────────────────────────────────────────
  const loginHandler = useCallback(async () => {
    setLoading(true);
    try {
      const response = await loginService(user, password);
      if (response && response.token) {
        persistAndEnter(response);
      } else {
        setIsError(true);
        setMsg(
          (response && (response.message || response.error)) ||
            "Incorrect username or password!",
        );
        setLoading(false);
      }
    } catch (e: unknown) {
      setIsError(true);
      setMsg(errText(e, "Login failed. Please try again."));
      setLoading(false);
    }
  }, [user, password, persistAndEnter]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Enter") return;
      event.preventDefault();
      if (screen === "login" && password.length > 4) loginHandler();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [screen, password, loginHandler]);

  // ── Register ───────────────────────────────────────────────
  const registerHandler = async () => {
    if (!regName.trim()) return fail("Please enter your first name.");
    if (!regLastName.trim()) return fail("Please enter your last name.");
    if (!/^\S+@\S+\.\S+$/.test(regEmail)) return fail("Please enter a valid email.");
    if (regUsername.trim().length < 3)
      return fail("Username must be at least 3 characters.");
    if (regPassword.length < 8)
      return fail("Your password must be 8 or more characters long.");
    if (regPassword !== regPassword2) return fail("Both passwords must match.");

    setLoading(true);
    setMsg("");
    setIsError(false);
    try {
      const response = await registerService({
        name: regName.trim(),
        lastName: regLastName.trim(),
        email: regEmail.trim(),
        username: regUsername.trim(),
        password: regPassword,
        birthday: regBirthday || undefined,
      });
      if (response && response.token) {
        persistAndEnter(response);
      } else {
        fail("Could not create your account. Please try again.");
        setLoading(false);
      }
    } catch (e: unknown) {
      fail(errText(e, "Could not create your account. Please try again."));
      setLoading(false);
    }
  };

  const fail = (text: string) => {
    setIsError(true);
    setMsg(text);
  };

  // ── Forgot password ────────────────────────────────────────
  const forgotHandler = async () => {
    if (!/^\S+@\S+\.\S+$/.test(resetEmail))
      return fail("Please enter a valid email.");
    setLoading(true);
    setMsg("");
    setIsError(false);
    try {
      await forgotPasswordService(resetEmail.trim());
      setLoading(false);
      goTo("reset");
      setMsg("");
    } catch (e: unknown) {
      setLoading(false);
      fail(errText(e, "Something went wrong. Please try again."));
    }
  };

  // ── Reset password ─────────────────────────────────────────
  const resetHandler = async () => {
    if (!resetCode.trim()) return fail("Enter the code we sent to your email.");
    if (resetPassword.length < 8)
      return fail("Your new password must be 8 or more characters long.");
    if (resetPassword !== resetPassword2) return fail("Both passwords must match.");
    setLoading(true);
    setMsg("");
    setIsError(false);
    try {
      await resetPasswordService(
        resetEmail.trim(),
        resetCode.trim(),
        resetPassword,
      );
      setLoading(false);
      setScreen("login");
      setIsError(false);
      setMsg("Password updated! You can log in now.");
    } catch (e: unknown) {
      setLoading(false);
      fail(errText(e, "Could not reset your password. Please try again."));
    }
  };

  // ── Shared styles ──────────────────────────────────────────
  const inputCls =
    "w-full rounded-2xl border-2 border-(--border) bg-(--input-bg) px-4 py-3 text-base font-semibold text-foreground placeholder:text-(--muted) placeholder:font-medium outline-none transition-all duration-200 focus:border-(--accent) focus:ring-4 focus:ring-(--accent)/15";

  const linkBtn =
    "text-sm font-bold text-(--muted) transition-colors hover:text-(--accent) cursor-pointer";

  const banner =
    msg &&
    (isError ? (
      <p className="pop-in rounded-2xl border-2 border-(--danger)/30 bg-(--danger)/10 px-4 py-2.5 text-center text-sm font-bold text-(--danger)">
        {msg}
      </p>
    ) : (
      <p className="pop-in rounded-2xl border-2 border-(--success)/30 bg-(--success)/10 px-4 py-2.5 text-center text-sm font-bold text-(--success)">
        {msg}
      </p>
    ));

  const wordmark = (
    <h1 className="font-display flex items-end justify-center text-6xl font-extrabold leading-none tracking-tight text-foreground">
      d
      <span className="relative mx-0.5 inline-flex w-11 items-center justify-center">
        <span
          className="inline-block h-10 w-10 rounded-full"
          style={{ background: "var(--accent)" }}
        />
      </span>
      ts
    </h1>
  );

  let content: React.ReactNode = null;

  if (screen === "login") {
    content = (
      <div className="flex w-full max-w-sm flex-col gap-7">
        <div className="flex flex-col items-center gap-4">
          <Doty
            pose="02"
            size="small"
            animation="wave"
            say="Hi! I'm DOTY. Ready to learn English?"
          />
          {wordmark}
          <p className="-mt-2 text-sm font-semibold text-(--muted)">
            Learn English, one dot at a time
          </p>
        </div>

        {banner}

        <div className="flex flex-col gap-3.5">
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
          <UIButton
            tone="accent"
            onClick={loginHandler}
            disabled={loading}
            fullWidth
            className="py-4 text-base"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2 normal-case">
                <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                Logging in…
              </span>
            ) : (
              "Let's go!"
            )}
          </UIButton>
        </div>

        <div className="flex items-center justify-center gap-6">
          <button type="button" onClick={() => goTo("forgot")} className={linkBtn}>
            Forgot password?
          </button>
          <span className="text-(--border)">•</span>
          <button
            type="button"
            onClick={() => goTo("register")}
            className={linkBtn}
          >
            Create account
          </button>
        </div>
      </div>
    );
  } else if (screen === "register") {
    content = (
      <div className="flex w-full max-w-2xl flex-col gap-8">
        <div className="flex flex-col items-center gap-2 text-center">
          <Doty pose="06" size="tiny" animation="bob" />
          <h2 className="font-display text-4xl font-extrabold tracking-tight text-foreground">
            Join the club!
          </h2>
          <p className="text-sm font-semibold text-(--muted)">
            Fill in the form and DOTY will be waiting for you
          </p>
        </div>

        {banner}

        <div className="grid gap-4 md:grid-cols-2">
          <input
            value={regName}
            onChange={(e) => setRegName(e.target.value)}
            placeholder="First name"
            type="text"
            autoComplete="given-name"
            className={inputCls}
          />
          <input
            value={regLastName}
            onChange={(e) => setRegLastName(e.target.value)}
            placeholder="Last name"
            type="text"
            autoComplete="family-name"
            className={inputCls}
          />
          <input
            value={regEmail}
            onChange={(e) => setRegEmail(e.target.value)}
            placeholder="Email address"
            type="email"
            autoComplete="email"
            className={`${inputCls} md:col-span-2`}
          />
          <input
            value={regUsername}
            onChange={(e) => setRegUsername(e.target.value)}
            placeholder="Choose a username"
            type="text"
            autoComplete="username"
            className={`${inputCls} md:col-span-2`}
          />
          <input
            value={regPassword}
            onChange={(e) => setRegPassword(e.target.value)}
            placeholder="Password"
            type="password"
            autoComplete="new-password"
            className={inputCls}
          />
          <input
            value={regPassword2}
            onChange={(e) => setRegPassword2(e.target.value)}
            placeholder="Confirm password"
            type="password"
            autoComplete="new-password"
            className={inputCls}
          />
          <label className="md:col-span-2 flex flex-col gap-1">
            <span className="px-1 text-xs font-bold text-(--muted)">
              Birthday (optional)
            </span>
            <input
              value={regBirthday}
              onChange={(e) => setRegBirthday(e.target.value)}
              type="date"
              className={`${inputCls} text-(--muted)`}
            />
          </label>
        </div>

        <div className="flex gap-3">
          <UIButton tone="neutral" onClick={() => goTo("login")}>
            Back
          </UIButton>
          <UIButton
            tone="accent"
            onClick={registerHandler}
            disabled={loading}
            fullWidth
          >
            {loading ? "Creating…" : "Create account"}
          </UIButton>
        </div>
      </div>
    );
  } else if (screen === "forgot") {
    content = (
      <div className="flex w-full max-w-sm flex-col gap-6">
        <div className="flex flex-col items-center gap-3 text-center">
          <Doty pose="07" size="tiny" animation="bob" say="No worries, I'll help!" />
          <h2 className="font-display text-3xl font-extrabold tracking-tight text-foreground">
            Forgot password?
          </h2>
          <p className="text-sm font-semibold text-(--muted)">
            Enter your email and we&apos;ll send you a reset code.
          </p>
        </div>

        {banner}

        <input
          value={resetEmail}
          onChange={(e) => setResetEmail(e.target.value)}
          placeholder="Email address"
          type="email"
          autoComplete="email"
          className={inputCls}
        />

        <div className="flex flex-col gap-3">
          <UIButton
            tone="accent"
            onClick={forgotHandler}
            disabled={loading}
            fullWidth
          >
            {loading ? "Sending…" : "Send code"}
          </UIButton>
          <button
            type="button"
            onClick={() => goTo("login")}
            className={`${linkBtn} text-center`}
          >
            Back to login
          </button>
        </div>
      </div>
    );
  } else if (screen === "reset") {
    content = (
      <div className="flex w-full max-w-sm flex-col gap-6">
        <div className="flex flex-col items-center gap-3 text-center">
          <Doty pose="11" size="tiny" animation="bob" />
          <h2 className="font-display text-3xl font-extrabold tracking-tight text-foreground">
            Check your email
          </h2>
          <p className="text-sm font-semibold text-(--muted)">
            Enter the code we sent to{" "}
            <span className="font-extrabold text-foreground">
              {resetEmail || "your email"}
            </span>{" "}
            and pick a new password.
          </p>
        </div>

        {banner}

        <div className="flex flex-col gap-3.5">
          <input
            value={resetCode}
            onChange={(e) => setResetCode(e.target.value)}
            placeholder="6-digit code"
            type="text"
            inputMode="numeric"
            className={`${inputCls} text-center tracking-[0.4em]`}
          />
          <input
            value={resetPassword}
            onChange={(e) => setResetPasswordVal(e.target.value)}
            placeholder="New password"
            type="password"
            autoComplete="new-password"
            className={inputCls}
          />
          <input
            value={resetPassword2}
            onChange={(e) => setResetPassword2(e.target.value)}
            placeholder="Confirm new password"
            type="password"
            autoComplete="new-password"
            className={inputCls}
          />
          <UIButton
            tone="accent"
            onClick={resetHandler}
            disabled={loading}
            fullWidth
          >
            {loading ? "Saving…" : "Reset password"}
          </UIButton>
          <button
            type="button"
            onClick={() => goTo("forgot")}
            className={`${linkBtn} text-center`}
          >
            Didn&apos;t get a code? Try again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex min-h-screen w-full items-center justify-center overflow-hidden bg-background px-6 py-12 text-foreground">
      {/* Ambient dots — the brand, literally */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <span className="absolute left-[8%] top-[12%] h-6 w-6 rounded-full bg-(--accent)/10" />
        <span className="absolute right-[12%] top-[22%] h-10 w-10 rounded-full bg-(--purple)/10" />
        <span className="absolute left-[18%] bottom-[18%] h-8 w-8 rounded-full bg-(--sun)/15" />
        <span className="absolute right-[20%] bottom-[10%] h-5 w-5 rounded-full bg-(--accent)/10" />
        <span className="absolute left-[45%] top-[6%] h-4 w-4 rounded-full bg-(--success)/10" />
      </div>
      {content}
    </div>
  );
}
