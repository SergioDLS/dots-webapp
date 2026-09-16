import api from "@/lib/api-client";
import type { PublicAvatar } from "@/lib/avatar";
import type { Palette } from "@/lib/theme-colors";
import type { ThemeMode } from "@/lib/theme-prefs";

/** Espejo del contrato del backend: src/common/user-settings.ts. */
export type UserSettings = {
  palette: Palette;
  mode: ThemeMode;
  sound: boolean;
  avatar_key: string | null;
  avatar: PublicAvatar;
  onboarded_at: string | null;
  tips_seen: string[];
};

export type SettingsPatch = {
  palette?: Palette;
  mode?: ThemeMode;
  sound?: boolean;
  /** true estampa onboarded_at una sola vez. */
  onboarded?: boolean;
  /** Claves a añadir a tips_seen. */
  tips_seen?: string[];
};

/** null si no hay sesión o el backend aún no expone el endpoint: el shell no se rompe. */
export async function getMySettingsService(): Promise<UserSettings | null> {
  try {
    const { data } = await api.get<UserSettings>("/me/settings");
    return data;
  } catch {
    return null;
  }
}

export async function patchMySettingsService(patch: SettingsPatch): Promise<UserSettings> {
  const { data } = await api.patch<UserSettings>("/me/settings", patch);
  return data;
}

/** Concede si hace falta y equipa el avatar. Propaga el error (403 si es de pago y no lo tienes). */
export async function postMyAvatarService(key: string): Promise<PublicAvatar> {
  const { data } = await api.post<PublicAvatar>("/me/avatar", { key });
  return data;
}
