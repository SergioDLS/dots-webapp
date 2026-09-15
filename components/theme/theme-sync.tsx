"use client";

import { useEffect } from "react";
import { getMySettingsService } from "@/services/settings.service";
import {
  applyThemePrefs,
  hasMirror,
  normalizePrefs,
  readMirror,
  writeMirror,
} from "@/lib/theme-prefs";

/**
 * El primer paint usa el espejo de localStorage (script inline de app/layout.tsx).
 * Aquí se completa con el servidor SOLO en un dispositivo sin espejo (primera
 * visita): el toggle escribe el modo en el servidor en segundo plano, pero la
 * paleta no tiene escritor hasta la hoja de ajustes (subproyecto D), así que un
 * servidor con defaults nunca debe pisar una elección local explícita. Cuando D
 * traiga la hoja, este componente puede volver a hacer autoritativo al servidor.
 *
 * Además, en modo Auto sigue los cambios de tema del SO con la pestaña abierta:
 * el CSS cambia solo, pero la clase `dark`, `colorScheme` y la meta no.
 *
 * Sin estado ni setState (regla 3): solo efectos.
 */
export default function ThemeSync() {
  useEffect(() => {
    if (hasMirror()) return;
    let alive = true;
    getMySettingsService().then((settings) => {
      if (!alive || !settings || hasMirror()) return;
      const server = normalizePrefs(settings);
      applyThemePrefs(server);
      writeMirror(server);
    });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      const prefs = readMirror();
      if (prefs.mode === "auto") applyThemePrefs(prefs);
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  return null;
}
