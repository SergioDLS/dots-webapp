/**
 * Marco del avatar (spec §6.1, variante A): círculo con el color propio del
 * avatar al 42 % sobre la superficie y un anillo del acento del tema.
 *
 * Lógica pura para poder probarse con `node --test`: por eso SOLO admite
 * `import type` — Node ejecuta este archivo sin bundler y no resolvería `@/`.
 */
export type PublicAvatar = {
  img: string;
  color: string;
};

/** Sin avatar equipado se muestra el clásico (spec §6.1). */
export const DEFAULT_AVATAR: PublicAvatar = {
  img: "/images/avatars/clasico.png",
  color: "#FF1F8F",
};

/** Sanea lo que llegue del servidor: cualquier cosa sin imagen cae al clásico. */
export function avatarOrDefault(a: Partial<PublicAvatar> | null | undefined): PublicAvatar {
  if (!a || typeof a.img !== "string" || a.img.length === 0) return DEFAULT_AVATAR;
  const color = typeof a.color === "string" && a.color.length > 0 ? a.color : DEFAULT_AVATAR.color;
  return { img: a.img, color };
}

export function discBackground(color: string): string {
  return `color-mix(in srgb, ${color} 42%, var(--surface))`;
}

/**
 * Grosor del anillo. El spec fija dos anclajes —3 px a 128 y 2 px a 34— y el
 * resto se interpola, para que el marco no se vea desproporcionado en los
 * tamaños intermedios (96 del selector, 48 de los toasts).
 */
export function ringWidth(size: number): number {
  const t = (size - 34) / (128 - 34);
  const w = 2 + t * (3 - 2);
  return Math.min(3, Math.max(2, Math.round(w * 10) / 10));
}
