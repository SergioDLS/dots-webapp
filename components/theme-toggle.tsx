"use client";

import { useSyncExternalStore } from "react";
import { Icon, type IconName } from "@/components/ui/icon";
import { applyThemePrefs, readMirror, writeMirror, type ThemePrefs } from "@/lib/theme-prefs";

type Resolved = "light" | "dark";

const label: Record<Resolved, string> = { light: "Tema claro", dark: "Tema oscuro" };
const icon: Record<Resolved, IconName> = { light: "sol", dark: "luna" };

/** El DOM es la fuente de verdad del modo resuelto: lo fija el script
 *  anti-parpadeo de app/layout.tsx antes del primer paint y lo cambia
 *  applyThemePrefs. Leerlo con useSyncExternalStore evita el mismatch de
 *  hidratación (el servidor no sabe si el SO está en oscuro) sin un setState
 *  dentro de un efecto (regla 3 del CLAUDE.md). */
function subscribe(onChange: () => void): () => void {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
  return () => observer.disconnect();
}
const getSnapshot = (): Resolved =>
  document.documentElement.classList.contains("dark") ? "dark" : "light";
const getServerSnapshot = (): Resolved => "light";

export default function ThemeToggle() {
  const mode = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const toggle = () => {
    const next: Resolved = mode === "light" ? "dark" : "light";
    const prefs: ThemePrefs = { palette: readMirror().palette, mode: next };
    writeMirror(prefs);
    applyThemePrefs(prefs);
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
