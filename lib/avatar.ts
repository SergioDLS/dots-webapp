/**
 * Presentación del avatar (spec §6.1). El retrato NO va enmarcado: flota sobre
 * el fondo como el arte de los nodos del Camino (principio 4 del spec, "sin
 * contenedor"), y su color propio es lo único que lo apoya, en forma de sombra
 * tenue bajo la silueta.
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

/**
 * La sombra que apoya al retrato, teñida con su color.
 *
 * `drop-shadow` y no `box-shadow` porque sigue la SILUETA del PNG, no su caja:
 * es el mismo recurso con el que los nodos del Camino y los tiles del arcade
 * flotan sin caja (`.doty-shadow` en globals.css). La geometría escala con el
 * tamaño para que a 34 px no sea un borrón y a 96 no sea una línea: a los 78
 * del perfil da 4.7 px de caída y 9.4 de difuminado.
 */
export function avatarShadow(color: string, size: number): string {
  const y = Math.round(size * 0.06 * 10) / 10;
  const blur = Math.round(size * 0.12 * 10) / 10;
  return `drop-shadow(0 ${y}px ${blur}px color-mix(in srgb, ${color} 45%, transparent))`;
}
