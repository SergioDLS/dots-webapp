"use client";

import { useEffect } from "react";
import { getMySettingsService, patchMySettingsService } from "@/services/settings.service";
import { readSoundEnabled } from "@/lib/sound-prefs";
import {
  applyThemePrefs,
  clearSettingsDirty,
  hasPendingSettings,
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
 * "El servidor manda" tiene una excepción: si queda una escritura local sin
 * confirmar (`hasPendingSettings()`), el PATCH de la hoja de ajustes pudo
 * perderse por falta de red, y este componente se remonta cada vez que se
 * entra y se sale de una lección, práctica, checkpoint, juego o lectura —
 * frecuente en una PWA con conectividad imperfecta. Aplicar en ese momento lo
 * que diga el servidor revertiría el cambio local sin avisar. Por eso, con
 * marca pendiente, la rama reenvía al servidor el estado completo de los
 * espejos locales (paleta, modo y sonido), no solo el tema: la marca es una
 * sola y no distingue qué control la dejó pendiente, así que en vez de
 * adivinar cuál PATCH falló se sincroniza todo de una vez y se acaba la
 * ambigüedad. Solo se limpia la marca si ese reintento confirma; si vuelve a
 * fallar, no hace nada y se reintenta en el próximo montaje. Sin nada
 * pendiente, el comportamiento es el de siempre: pide `/me/settings` y, si
 * difiere del espejo, aplica y reescribe.
 *
 * Además, en modo Auto sigue los cambios de tema del SO con la pestaña abierta:
 * el CSS cambia solo, pero la clase `dark`, `colorScheme` y la meta no.
 *
 * Sin estado ni setState (regla 3): solo efectos.
 */
export default function ThemeSync() {
  useEffect(() => {
    let alive = true;
    if (hasPendingSettings()) {
      const { palette, mode } = readMirror();
      void patchMySettingsService({ palette, mode, sound: readSoundEnabled() })
        .then(() => {
          if (alive) clearSettingsDirty();
        })
        .catch(() => {});
    } else {
      getMySettingsService().then((settings) => {
        if (!alive || !settings) return;
        const server = normalizePrefs(settings);
        const local = readMirror();
        if (server.palette === local.palette && server.mode === local.mode) return;
        applyThemePrefs(server);
        writeMirror(server);
      });
    }
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
