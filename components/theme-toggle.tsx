"use client";

import { useEffect, useState } from "react";

type Mode = "light" | "dark";

const STORAGE_KEY = "dots-theme";

const applyTheme = (resolved: "light" | "dark") => {
  const root = document.documentElement;
  root.setAttribute("data-theme", resolved);
  if (resolved === "dark") root.classList.add("dark");
  else root.classList.remove("dark");
  root.style.colorScheme = resolved;
};

const cycle: Record<Mode, Mode> = { light: "dark", dark: "light" };

const modeLabel: Record<Mode, string> = {
  light: "Light",
  dark: "Dark",
};

const modeIcon: Record<Mode, string> = {
  light: "☀️",
  dark: "🌙",
};

export default function ThemeToggle() {
  const [mode, setMode] = useState<Mode>(() => {
    if (typeof window === "undefined") return "light";
    return (window.localStorage.getItem(STORAGE_KEY) as Mode | null) ?? "light";
  });

  // Resolve and apply whenever mode changes
  useEffect(() => {
    applyTheme(mode);
  }, [mode]);

  const toggle = () => {
    const next = cycle[mode];
    setMode(next);
    window.localStorage.setItem(STORAGE_KEY, next);
  };

  return (
    <button
      type="button"
      onClick={toggle}
      title={`Current theme: ${modeLabel[mode]} — click to change`}
      className="w-full rounded-xl border border-(--border) px-4 py-2 text-sm font-semibold text-(--muted) transition-all duration-200 hover:border-(--accent) hover:text-(--accent) hover:bg-(--accent)/8 focus:outline-none flex items-center justify-between gap-2"
    >
      <span>{modeIcon[mode]} {modeLabel[mode]} theme</span>
    </button>
  );
}
