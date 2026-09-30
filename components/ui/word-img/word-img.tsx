import React from "react";
import NextImage from "next/image";
import { BASE_URL_IMAGES } from "../../../constants";
import { wordImageUrl } from "@/lib/media-url";

interface Props {
  size?: "small" | "medium" | "large" | string;
  opacity?: number;
  src: string;
  customClass?: string;
}

// Clases literales a propósito: Tailwind solo genera las que encuentra escritas
// enteras en el código, y un `w-[${dim}px]` armado en runtime nunca llegaba al
// CSS (el wrapper quedaba sin tamaño y encogía como flex item). `px` alimenta
// el width/height de NextImage, que elige la resolución a pedir.
const SIZES = {
  small: { px: 48, cls: "w-12 h-12" },
  medium: { px: 80, cls: "w-20 h-20" },
  large: { px: 128, cls: "w-32 h-32" },
} as const;

export default function WordImg({ size, opacity = 1, src, customClass }: Props) {
  // Ver lib/media-url.ts: absolutas y rutas `/…` tal cual; nombre suelto = legacy de `words`.
  const url = wordImageUrl(src, BASE_URL_IMAGES);

  // Sin `size` = medium. Cualquier otro string es una clase de Tailwind del
  // caller (p. ej. "w-24 h-24"): no sabemos sus px, así que va con fill.
  const preset =
    size === undefined ? SIZES.medium
    : Object.hasOwn(SIZES, size) ? SIZES[size as keyof typeof SIZES]
    : null;

  const wrapperCls = [
    "inline-block overflow-hidden rounded",
    "transition-transform duration-150 group-active:scale-[.92]",
    // shrink-0: overflow-hidden deja el min-width en 0, y en una fila flex
    // el wrapper cedía ancho a sus hermanos.
    preset ? `${preset.cls} shrink-0` : size,
    customClass ?? "",
  ]
    .filter(Boolean)
    .join(" ");

  if (!preset) {
    // Use fill layout so the image covers whatever dimensions the wrapper provides
    return (
      <span className={`relative ${wrapperCls}`} style={{ opacity }}>
        <NextImage
          src={url}
          alt=""
          fill
          className="object-cover"
          loading="lazy"
        />
      </span>
    );
  }

  return (
    <span className={wrapperCls} style={{ opacity }}>
      <NextImage
        src={url}
        alt=""
        width={preset.px}
        height={preset.px}
        className="object-cover w-full h-full"
        loading="lazy"
      />
    </span>
  );
}
