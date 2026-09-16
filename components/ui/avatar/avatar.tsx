"use client";

import Image from "next/image";

import { avatarOrDefault, discBackground, ringWidth, type PublicAvatar } from "@/lib/avatar";

/**
 * La cara pública del usuario (spec §6.1). Único sitio donde vive la geometría
 * del marco: perfil, selector, tienda, leaderboard, vecinos del Camino y avisos
 * de rival lo usan todos con el mismo componente y solo cambian `size`.
 *
 * NO es un `<Doty>`: los avatares viven en public/images/avatars/ y están fuera
 * del registro de poses (regla 10).
 */
interface Props {
  avatar: PublicAvatar | null | undefined;
  /** Diámetro en px. Los del spec: 96 selector y tienda, 48 toasts, 34 leaderboard y vecinos. */
  size: number;
  alt?: string;
  className?: string;
}

export default function Avatar({ avatar, size, alt = "", className }: Props) {
  const a = avatarOrDefault(avatar);
  const ring = ringWidth(size);
  return (
    <span
      className={`relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full ${className ?? ""}`}
      style={{
        width: size,
        height: size,
        background: discBackground(a.color),
        border: `${ring}px solid var(--accent)`,
      }}
    >
      <Image
        src={a.img}
        alt={alt}
        width={size}
        height={size}
        // El retrato ya viene recortado a cabeza y hombros con margen: se pinta
        // completo dentro del disco, sin recorte extra.
        style={{ objectFit: "contain" }}
      />
    </span>
  );
}
