import api from "@/lib/api-client";

/**
 * Acciones de un admin sobre SU cuenta (spec modo admin 2026-09-29). Todas
 * bajo /admin/me, guardadas por AdminGuard en el servidor. Propagan el error a
 * propósito: quien las llama lo muestra y no cambia estado.
 *
 * Los POST sin cuerpo mandan `{}`: axios con `undefined` omite el body y el
 * parser JSON de Express se queda sin objeto que leer.
 */

export type GrantPayload = { gems?: number; xp?: number; streak?: number };
export type GrantResult = { gems: number; xp: number; streak: number };
export type ResetResult = { deleted: Record<string, number> };
export type CompletedSection = { sectionId: number; name: string };

export async function setAdminModeService(on: boolean): Promise<{ admin_mode: boolean }> {
  const { data } = await api.patch<{ admin_mode: boolean }>("/admin/me/mode", { on });
  return data;
}

export async function resetMyProgressService(): Promise<ResetResult> {
  const { data } = await api.post<ResetResult>("/admin/me/reset", {});
  return data;
}

export async function resetMyFirstRunService(): Promise<{ ok: true }> {
  const { data } = await api.post<{ ok: true }>("/admin/me/first-run/reset", {});
  return data;
}

export async function grantMyselfService(payload: GrantPayload): Promise<GrantResult> {
  const { data } = await api.post<GrantResult>("/admin/me/grant", payload);
  return data;
}

export async function completeCurrentSectionService(): Promise<CompletedSection> {
  const { data } = await api.post<CompletedSection>("/admin/me/complete-current-section", {});
  return data;
}
