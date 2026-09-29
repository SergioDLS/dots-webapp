import type { UserSettings } from "@/services/settings.service";

/**
 * Modo admin (spec 2026-09-29): el flag vive en el servidor
 * (users.settings.admin_mode) y aquí solo se espeja para esta carga de página.
 * Store de módulo con el mismo patrón que lib/first-run.ts: puro, sin React,
 * solo `import type`, para que `node --test` lo ejecute tal cual.
 *
 * "desconocido" = todavía no se preguntó a /me/settings. La pastilla y el
 * switch no se pintan encendidos hasta que el servidor lo confirme.
 */
export type EstadoModoAdmin = "desconocido" | "apagado" | "encendido";

let estado: EstadoModoAdmin = "desconocido";
const escuchas = new Set<() => void>();

export function estadoModoAdmin(): EstadoModoAdmin {
  return estado;
}

/** Para `useSyncExternalStore`. */
export function suscribirModoAdmin(alCambiar: () => void): () => void {
  escuchas.add(alCambiar);
  return () => {
    escuchas.delete(alCambiar);
  };
}

export function fijarModoAdmin(siguiente: EstadoModoAdmin): void {
  if (estado === siguiente) return;
  estado = siguiente;
  for (const alCambiar of escuchas) alCambiar();
}

/** Traduce la respuesta de GET /me/settings. Ausente, null o fallo = apagado. */
export function modoAdminDesdeAjustes(
  settings: Pick<UserSettings, "admin_mode"> | null | undefined,
): EstadoModoAdmin {
  return settings?.admin_mode === true ? "encendido" : "apagado";
}
