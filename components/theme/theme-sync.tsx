"use client";

import { useEffect } from "react";
import { getMySettingsService } from "@/services/settings.service";
import { applyThemePrefs, normalizePrefs, readMirror, writeMirror } from "@/lib/theme-prefs";

/**
 * El primer paint usa el espejo de localStorage (script inline de app/layout.tsx).
 * Aquí se reconcilia con el servidor: si /me/settings difiere, se aplica y se
 * reescribe el espejo. Sin estado ni setState (regla 3): solo un efecto.
 */
export default function ThemeSync() {
  useEffect(() => {
    let alive = true;
    getMySettingsService().then((settings) => {
      if (!alive || !settings) return;
      const server = normalizePrefs(settings);
      const mirror = readMirror();
      if (mirror.palette === server.palette && mirror.mode === server.mode) return;
      applyThemePrefs(server);
      writeMirror(server);
    });
    return () => {
      alive = false;
    };
  }, []);
  return null;
}
