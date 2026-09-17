/**
 * El usuario de la sesión, espejado en localStorage al iniciar sesión (el
 * access token vive en memoria, ver CLAUDE.md). Seis pantallas leían este
 * mismo bloque copiado. Estas funciones devuelven el "no hay nada" seguro
 * ante cualquier duda (SSR, storage bloqueado, JSON corrupto, o un valor que
 * ni siquiera es un objeto): quien llama debe funcionar sin esos datos.
 *
 * Lectura pura y siempre fresca — sin caché — para usar dentro de efectos o
 * manejadores de evento. Para leer en el CUERPO del render (donde hace falta
 * evitar el mismatch de hidratación) usa el hook `useStoredUser` de
 * hooks/use-stored-user.ts en su lugar: este módulo se queda sin React a
 * propósito para poder testearse con node:test (ver current-user.test.mjs).
 */
export type StoredUser = {
  id?: number;
  name?: string;
  last_name?: string;
  profile?: number;
};

const EMPTY_USER: StoredUser = Object.freeze({});

/**
 * Interpreta el string crudo de localStorage.getItem("user"). `{}` si no hay
 * nada, si el JSON está corrupto, o si el valor no es un objeto (array,
 * número, `null`...) — todos los casos en los que no hay un usuario que leer.
 * Pura y sin storage de por medio a propósito: es la parte bajo test (ver
 * current-user.test.mjs), como normalizeSound en sound-prefs.ts.
 */
export function parseStoredUser(raw: string | null | undefined): StoredUser {
  if (!raw) return EMPTY_USER;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
      return EMPTY_USER;
    }
    return parsed as StoredUser;
  } catch {
    return EMPTY_USER;
  }
}

/** Safe read del usuario guardado. `{}` ante cualquier problema (SSR incluido). */
export function readStoredUser(): StoredUser {
  try {
    const raw =
      typeof window === "undefined" ? null : window.localStorage.getItem("user");
    return parseStoredUser(raw);
  } catch {
    return EMPTY_USER;
  }
}

/**
 * El id del usuario de la sesión. Devuelve null ante cualquier duda (SSR,
 * storage bloqueado, JSON corrupto): quien llama debe funcionar sin el id.
 */
export function readCurrentUserId(): number | null {
  const { id } = readStoredUser();
  return typeof id === "number" ? id : null;
}
