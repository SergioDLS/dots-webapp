"use client";

import React from "react";
import Image from "next/image";
import { POSES, FALLBACK_POSE, isDotyPose, toDotyPose, type DotyPose } from "./poses";

export type DotyAnimation = "none" | "bob" | "cheer" | "sad" | "wave";
export type DotySize = "micro" | "mini" | "small" | "tiny" | "smaller" | "medium" | "big";
export type { DotyPose };
export { toDotyPose, isDotyPose };

interface DotyProps {
  /** Pose semántica del registro (components/ui/doty/poses.ts). Para strings dinámicos usa toDotyPose(). */
  pose: DotyPose;
  size?: DotySize;
  customClass?: string;
  /** Animación del vocabulario de movimiento de Doty (globals.css): solo transform. */
  animation?: DotyAnimation;
  /** Burbuja de texto sobre Doty. */
  say?: string;
  /**
   * Sombra por CSS (drop-shadow). Los PNG nuevos nacen sin sombra a propósito
   * (spec §4.3). Sin especificar, se activa sola en cuanto la pose deja de
   * apuntar a un sprite legacy (que ya trae la elipse dibujada); pásalo
   * explícito (`true`/`false`) para forzarla en cualquier caso.
   */
  shadow?: boolean;
}

/** Ancho renderizado en px por tamaño; alimenta `sizes` para que next/image no sirva 1024px a un sprite de 32. */
const SIZE_PX: Record<DotySize, number> = {
  micro: 32,
  mini: 80,
  tiny: 96,
  smaller: 112,
  small: 144,
  medium: 192,
  big: 352,
};

const sizeClass: Record<DotySize, string> = {
  micro: "w-8",
  mini: "w-20",
  tiny: "w-24",
  smaller: "w-28",
  small: "w-36",
  medium: "w-48",
  big: "w-[22rem] max-w-full",
};

const animationClass: Record<DotyAnimation, string> = {
  none: "",
  bob: "doty-bob",
  cheer: "doty-cheer",
  sad: "doty-sad",
  wave: "doty-wave",
};

export default function Doty({
  pose,
  size = "small",
  customClass = "",
  animation = "none",
  say,
  shadow,
}: DotyProps) {
  // Guardia de runtime: un `as DotyPose` mal puesto cae a la cara amable, no a un 404.
  const entry = POSES[isDotyPose(pose) ? pose : FALLBACK_POSE];
  // Los 22 sprites legacy traen la elipse de sombra dibujada; el arte nuevo nace sin
  // ella y la recibe por CSS (spec §4.3). Mientras una pose siga apuntando a un legacy,
  // sumar el drop-shadow duplicaría la sombra — así que se activa por sprite, no en
  // bloque, y cada pieza empieza a proyectarla sola en cuanto llega su arte real.
  const conSombra = shadow ?? !entry.src.includes("DOTTY-POSES");
  const img = (
    <Image
      src={entry.src}
      alt=""
      aria-hidden
      width={1024}
      height={1024}
      sizes={`${SIZE_PX[size]}px`}
      className={`h-auto select-none ${sizeClass[size]} ${animationClass[animation]} ${conSombra ? "doty-shadow" : ""} ${customClass}`}
      priority
      draggable={false}
    />
  );

  if (!say) return img;

  return (
    <div className="flex flex-col items-center gap-1">
      <div
        className="bubble-pop relative max-w-55 rounded-2xl px-4 py-2.5 text-center text-sm font-bold"
        style={{
          background: "var(--surface)",
          border: "2px solid var(--border)",
          color: "var(--foreground)",
          boxShadow: "0 4px 16px rgba(0,0,0,0.08)",
        }}
      >
        {say}
        <span
          aria-hidden
          className="absolute -bottom-2 left-1/2 h-4 w-4 -translate-x-1/2 rotate-45"
          style={{
            background: "var(--surface)",
            borderRight: "2px solid var(--border)",
            borderBottom: "2px solid var(--border)",
          }}
        />
      </div>
      {img}
    </div>
  );
}
