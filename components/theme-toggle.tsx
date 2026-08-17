"use client";

import { useEffect, useState } from "react";

type Mode = "light" | "dark";

const STORAGE_KEY = "dots-theme";

// Mismo color que el script anti-flash de app/layout.tsx y que
// app/manifest.ts. Debe existir siempre exactamente una
// meta[name="theme-color"] sin atributo `media`: esa es la etiqueta
// autoritativa que gobierna la barra de estado, así que el toggle no puede
// divergir de la semántica del script inline (limpiar todas, insertar una).
const THEME_COLOR: Record<Mode, string> = {
  light: "#fff7fb",
  dark: "#14122e",
};

const applyTheme = (resolved: "light" | "dark") => {
  const root = document.documentElement;
  root.setAttribute("data-theme", resolved);
  if (resolved === "dark") root.classList.add("dark");
  else root.classList.remove("dark");
  root.style.colorScheme = resolved;

  document
    .querySelectorAll('meta[name="theme-color"]')
    .forEach((el) => el.remove());
  const meta = document.createElement("meta");
  meta.setAttribute("name", "theme-color");
  meta.setAttribute("content", THEME_COLOR[resolved]);
  document.head.appendChild(meta);
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
