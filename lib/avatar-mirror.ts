/**
 * Espejo local del avatar equipado, hermano del de sonido (lib/sound-prefs.ts)
 * y del de tema (lib/theme-prefs.ts). El servidor manda —`/me/settings` es la
 * fuente de verdad— y esto solo existe para el primer pintado.
 *
 * Sin espejo, entrar al perfil pintaba SIEMPRE el clásico: `avatar` arranca en
 * null, `avatarOrDefault` cae al clásico y ahí se queda hasta que responde
 * `/me/settings`. Eso es una peticion de red entera, y con el backend de Render
 * dormido pueden ser segundos de avatar ajeno.
 *
 * Guarda `{img, color}` y no la key: es exactamente lo que `<Avatar>` necesita,
 * asi que no hace falta el catalogo de la tienda para resolverlo. A cambio, si
 * algun dia cambia el arte de una pieza, el espejo sirve la ruta vieja hasta el
 * siguiente `/me/settings` — y como la ruta no lleva hash, el PNG nuevo entra
 * igual. Es un cache de un paint, no un estado.
 *
 * `normalizeAvatarMirror` es la parte pura y está bajo test; leer y escribir
 * tocan localStorage y tragan cualquier error (modo privado, storage lleno).
 * Solo `import type` en este archivo: `node --test` lo ejecuta sin bundler.
 */
import type { PublicAvatar } from "./avatar.ts";

export const AVATAR_KEY = "dots-avatar";

/** Devuelve el avatar espejado, o null si no hay nada utilizable.
 *
 *  null y no el clásico a propósito: "no sé cuál lleva" y "lleva el clásico"
 *  se pintan igual, pero solo el primero debe dejar que el servidor mande sin
 *  discutir. Quien consuma esto ya cae al clásico por su cuenta.
 */
export function normalizeAvatarMirror(raw: string | null | undefined): PublicAvatar | null {
  if (!raw) return null;
  let dato: unknown;
  try {
    dato = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof dato !== "object" || dato === null) return null;
  const { img, color } = dato as { img?: unknown; color?: unknown };
  // Una ruta de otro origen aqui acabaría en el `src` de un <img>, asi que solo
  // se aceptan rutas propias. El color se exige con forma de hex porque va a
  // parar a un `color-mix` de CSS.
  if (typeof img !== "string" || !img.startsWith("/images/avatars/")) return null;
  if (typeof color !== "string" || !/^#[0-9a-fA-F]{6}$/.test(color)) return null;
  return { img, color };
}

export function readAvatarMirror(): PublicAvatar | null {
  if (typeof window === "undefined") return null;
  try {
    return normalizeAvatarMirror(window.localStorage.getItem(AVATAR_KEY));
  } catch {
    return null;
  }
}

export function writeAvatarMirror(avatar: PublicAvatar | null | undefined): void {
  try {
    if (!avatar) return;
    window.localStorage.setItem(AVATAR_KEY, JSON.stringify({ img: avatar.img, color: avatar.color }));
  } catch {
    /* modo privado o storage lleno: el servidor sigue teniendo la verdad */
  }
}

/** La llama el logout: en un equipo compartido, el siguiente en entrar no debe
 *  ver por un instante la cara del anterior. */
export function clearAvatarMirror(): void {
  try {
    window.localStorage.removeItem(AVATAR_KEY);
  } catch {
    /* nada que limpiar */
  }
}
