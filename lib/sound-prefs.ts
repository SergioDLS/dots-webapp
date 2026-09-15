/**
 * Espejo local de la preferencia de sonido, hermano del de tema
 * (lib/theme-prefs.ts). El servidor es la fuente de verdad (users.settings.sound,
 * spec §2.4), pero `playSound` se llama desde manejadores de evento sin acceso a
 * React ni tiempo para un fetch, así que consulta este espejo.
 *
 * `normalizeSound` es la parte pura y está bajo test; la lectura y escritura
 * tocan localStorage y tragan cualquier error (modo privado, storage lleno).
 * Solo `import type` en este archivo: `node --test` lo ejecuta sin bundler.
 */
export const SOUND_KEY = "dots-sound";

/** Cualquier cosa que no sea exactamente "off" significa sonido encendido. */
export function normalizeSound(raw: string | null | undefined): boolean {
  return raw !== "off";
}

export function readSoundEnabled(): boolean {
  if (typeof window === "undefined") return true;
  try {
    return normalizeSound(window.localStorage.getItem(SOUND_KEY));
  } catch {
    return true;
  }
}

export function writeSoundEnabled(on: boolean): void {
  try {
    window.localStorage.setItem(SOUND_KEY, on ? "on" : "off");
  } catch {
    /* modo privado o storage lleno: el servidor sigue teniendo la verdad */
  }
}
