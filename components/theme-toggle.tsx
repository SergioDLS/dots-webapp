"use client";

import { useEffect, useState } from "react";
import { Icon, type IconName } from "@/components/ui/icon";
import { applyThemePrefs, readMirror, resolveMode, writeMirror } from "@/lib/theme-prefs";

type Resolved = "light" | "dark";

const label: Record<Resolved, string> = { light: "Tema claro", dark: "Tema oscuro" };
const icon: Record<Resolved, IconName> = { light: "sol", dark: "luna" };

export default function ThemeToggle() {
  const [mode, setMode] = useState<Resolved>(() =>
    typeof window === "undefined" ? "light" : resolveMode(readMirror().mode),
  );

  useEffect(() => {
    const prefs = { palette: readMirror().palette, mode };
    applyThemePrefs(prefs);
  }, [mode]);

  const toggle = () => {
    const next: Resolved = mode === "light" ? "dark" : "light";
    setMode(next);
    writeMirror({ palette: readMirror().palette, mode: next });
  };

  return (
    <button
      type="button"
      onClick={toggle}
      title={`${label[mode]} — toca para cambiar`}
      className="w-full rounded-xl border border-(--border) px-4 py-2 text-sm font-semibold text-(--muted) transition-all duration-200 hover:border-(--accent) hover:text-(--accent) hover:bg-(--accent)/8 focus:outline-none flex items-center justify-between gap-2"
    >
      <span className="inline-flex items-center gap-1.5">
        <Icon name={icon[mode]} size={16} /> {label[mode]}
      </span>
    </button>
  );
}
