"use client";

import type { ReactNode } from "react";
import Image from "next/image";

import { avatarOrDefault, avatarShadow, type PublicAvatar } from "@/lib/avatar";

/**
 * La cara pública del usuario (spec §6.1). Único sitio donde vive su
 * presentación: perfil, selector, tienda, leaderboard, vecinos del Camino y
 * avisos de rival lo usan todos con el mismo componente y solo cambian `size`.
 *
 * Sin marco: el retrato flota igual que el arte de los nodos del Camino, y lo
 * único que lo apoya es una sombra tenue teñida con su color. El círculo con
 * anillo que llevaba antes competía con el arte y metía una caja donde el
 * principio 4 del spec pide que no haya ninguna.
 *
 * NO es un `<Doty>`: los avatares viven en public/images/avatars/ y están fuera
 * del registro de poses (regla 10). El dorso del avatar del perfil (spec §6.4)
 * sí lleva un Doty, pero con esta misma sombra: por eso `AvatarShadow` se
 * exporta aparte.
 */
interface ShadowProps {
  /** Color propio del avatar (`meta.color`): tiñe la sombra. */
  color: string;
  /** Lado de la caja en px. */
  size: number;
  className?: string;
  children: ReactNode;
}

/** La caja y su sombra, sin contenido: la comparten el retrato y el dorso. */
export function AvatarShadow({ color, size, className, children }: ShadowProps) {
  return (
    <span
      className={`relative inline-flex shrink-0 items-center justify-center ${className ?? ""}`}
      style={{ width: size, height: size, filter: avatarShadow(color, size) }}
    >
      {children}
    </span>
  );
}

interface Props {
  avatar: PublicAvatar | null | undefined;
  /** Lado de la caja en px. Los del spec: 96 selector y tienda, 48 toasts, 34 leaderboard y vecinos. */
  size: number;
  alt?: string;
  className?: string;
}

export default function Avatar({ avatar, size, alt = "", className }: Props) {
  const a = avatarOrDefault(avatar);
  return (
    <AvatarShadow color={a.color} size={size} className={className}>
      <Image
        src={a.img}
        alt={alt}
        width={size}
        height={size}
        // El retrato ya viene recortado a cabeza y hombros con margen: se pinta
        // completo, sin recorte de ningún tipo.
        style={{ objectFit: "contain" }}
      />
    </AvatarShadow>
  );
}
