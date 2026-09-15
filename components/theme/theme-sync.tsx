"use client";

import { useEffect } from "react";
import { getMySettingsService } from "@/services/settings.service";
import {
  applyThemePrefs,
  normalizePrefs,
  readMirror,
  writeMirror,
} from "@/lib/theme-prefs";

/**
 * El primer paint usa el espejo de localStorage (script inline de app/layout.tsx).
 * Aquí se reconcilia con el servidor, que desde el subproyecto D es AUTORITATIVO:
 * la hoja de ajustes escribe paleta, modo y sonido en `/me/settings` en cada
 * cambio, así que un espejo que difiera es de otro dispositivo o de un PATCH que
 * no llegó, y se reescribe. Antes de D solo se completaban los dispositivos sin
 * espejo, porque la paleta no tenía escritor y un servidor con defaults habría
 * pisado una elección local.
 *
 * Además, en modo Auto sigue los cambios de tema del SO con la pestaña abierta:
 * el CSS cambia solo, pero la clase `dark`, `colorScheme` y la meta no.
 *
 * Sin estado ni setState (regla 3): solo efectos.
 */
export default function ThemeSync() {
  useEffect(() => {
    let alive = true;
    getMySettingsService().then((settings) => {
      if (!alive || !settings) return;
      const server = normalizePrefs(settings);
      const local = readMirror();
      if (server.palette === local.palette && server.mode === local.mode) return;
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
