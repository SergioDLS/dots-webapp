/**
 * El id del usuario de la sesión. El access token vive en memoria, pero el
 * perfil se espeja en localStorage al iniciar sesión; seis pantallas leían
 * este mismo bloque copiado. Devuelve null ante cualquier duda (SSR, storage
 * bloqueado, JSON corrupto): quien llama debe funcionar sin el id.
 */
export function readCurrentUserId(): number | null {
  try {
    const raw = typeof window === "undefined" ? null : window.localStorage.getItem("user");
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { id?: number };
    return typeof parsed.id === "number" ? parsed.id : null;
  } catch {
    return null;
  }
}
