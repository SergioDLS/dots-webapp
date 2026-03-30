"use client";

import { useEffect, useState } from "react";

type Theme = "light" | "dark";

const STORAGE_KEY = "dots-theme";

const getSystemTheme = () =>
  window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";

const applyTheme = (theme: Theme) => {
  const root = document.documentElement;
  root.setAttribute("data-theme", theme);
  // also toggle the `dark` class to support Tailwind dark: utilities
  if (theme === "dark") {
    root.classList.add("dark");
  } else {
    root.classList.remove("dark");
  }
  root.style.colorScheme = theme;
};

export default function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(() => {
    if (typeof window === "undefined") {
      return "light";
    }

    const stored = window.localStorage.getItem(STORAGE_KEY) as Theme | null;
    return stored ?? getSystemTheme();
  });
  const [useSystem, setUseSystem] = useState(() => {
    if (typeof window === "undefined") {
      return true;
    }

    return !window.localStorage.getItem(STORAGE_KEY);
  });

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = () => {
      if (useSystem) {
        setTheme(getSystemTheme());
      }
    };

    media.addEventListener("change", handleChange);
    return () => media.removeEventListener("change", handleChange);
  }, [useSystem]);

  const toggleTheme = () => {
    const nextTheme = theme === "dark" ? "light" : "dark";
    setTheme(nextTheme);
    setUseSystem(false);
    window.localStorage.setItem(STORAGE_KEY, nextTheme);
  };

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className="inline-flex items-center gap-2 rounded-full border border-(--border) bg-(--surface) px-4 py-2 text-sm font-medium text-foreground shadow-sm transition hover:bg-(--border)"
    >
      Cambiar a {theme === "dark" ? "claro" : "oscuro"}
    </button>
  );
}
