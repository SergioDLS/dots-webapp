"use client";

import { useEffect, useState } from "react";

type Mode = "light" | "dark" | "system";

const STORAGE_KEY = "dots-theme";

const getSystemTheme = () =>
  window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";

const applyTheme = (resolved: "light" | "dark") => {
  const root = document.documentElement;
  root.setAttribute("data-theme", resolved);
  if (resolved === "dark") root.classList.add("dark");
  else root.classList.remove("dark");
  root.style.colorScheme = resolved;
};

const cycle: Record<Mode, Mode> = { light: "dark", dark: "system", system: "light" };

const modeLabel: Record<Mode, string> = {
  light: "Light",
  dark: "Dark",
  system: "Auto",
};

const modeIcon: Record<Mode, string> = {
  light: "☀️",
  dark: "🌙",
  system: "✨",
};

export default function ThemeToggle() {
  const [mode, setMode] = useState<Mode>(() => {
    if (typeof window === "undefined") return "system";
    return (window.localStorage.getItem(STORAGE_KEY) as Mode | null) ?? "system";
  });

  // Resolve and apply whenever mode or system preference changes
  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");

    const apply = () => {
      const resolved = mode === "system" ? getSystemTheme() : mode;
      applyTheme(resolved);
    };

    apply();

    if (mode === "system") {
      media.addEventListener("change", apply);
      return () => media.removeEventListener("change", apply);
    }
  }, [mode]);

  const toggle = () => {
    const next = cycle[mode];
    setMode(next);
    if (next === "system") {
      window.localStorage.removeItem(STORAGE_KEY);
    } else {
      window.localStorage.setItem(STORAGE_KEY, next);
    }
  };

  return (
    <button
      type="button"
      onClick={toggle}
      title={`Current theme: ${modeLabel[mode]} — click to change`}
      className="w-full rounded-xl border border-(--border) px-4 py-2 text-sm font-semibold text-(--muted) transition-all duration-200 hover:border-(--accent) hover:text-(--accent) hover:bg-(--accent)/8 focus:outline-none flex items-center justify-between gap-2"
    >
      <span>{modeIcon[mode]} {modeLabel[mode]} theme</span>
      <span className="text-[10px] font-bold uppercase tracking-widest opacity-50">
        {mode}
      </span>
    </button>
  );
}
