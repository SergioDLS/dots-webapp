"use client";

import React, { useMemo, useSyncExternalStore } from "react";
import Doty from "@/components/ui/doty/doty";

const timeGreeting = (): string => {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 19) return "Good afternoon";
  return "Good evening";
};

const CHEERS = [
  "Ready to practice?",
  "Let's learn something new!",
  "One more level today?",
  "I missed you! Let's play!",
];

const emptySubscribe = () => () => {};

export default function LevelsHeader() {
  // Two-pass rendering: the server (and first client render) show a neutral
  // greeting, then we swap in localStorage data + time of day after hydration.
  const hydrated = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  );

  const name = useMemo(() => {
    if (!hydrated) return "";
    try {
      const raw = localStorage.getItem("user");
      return raw ? ((JSON.parse(raw)?.name as string) ?? "") : "";
    } catch {
      return "";
    }
  }, [hydrated]);

  // Rotate the cheer by day so it changes session to session
  // (deterministic — random values are impure during render).
  const cheer = useMemo(
    () => (hydrated ? CHEERS[new Date().getDate() % CHEERS.length] : CHEERS[0]),
    [hydrated],
  );

  const greeting = hydrated
    ? `${timeGreeting()}${name ? `, ${name}` : ""}!`
    : "Welcome back!";

  return (
    <div
      className="pop-in relative mb-6 flex items-center gap-4 overflow-hidden rounded-3xl px-5 py-4 md:px-7"
      style={{
        background:
          "linear-gradient(120deg, var(--accent) 0%, var(--accent-soft) 60%, var(--purple) 130%)",
        boxShadow: "0 6px 24px rgba(229,7,126,0.25)",
      }}
    >
      {/* ambient dots */}
      <span aria-hidden className="absolute -right-4 -top-6 h-24 w-24 rounded-full bg-white/10" />
      <span aria-hidden className="absolute -bottom-2 right-16 h-10 w-10 rounded-full bg-white/10" />

      <Doty pose="02" size="tiny" animation="wave" customClass="drop-shadow-lg" />
      <div className="flex min-w-0 flex-col">
        <h1 className="font-display truncate text-2xl font-extrabold leading-tight text-white md:text-3xl">
          {greeting}
        </h1>
        <p className="text-sm font-bold text-white/85">{cheer}</p>
      </div>
    </div>
  );
}
