import React from "react";
import NextImage from "next/image";
import { BASE_URL_IMAGES } from "../../../constants";

interface Props {
  size?: "small" | "medium" | "large" | string;
  opacity?: number;
  src: string;
  customClass?: string;
}

export default function WordImg({ size, opacity = 1, src, customClass }: Props) {
  const url = `${BASE_URL_IMAGES}/words/${src}`;

  // Resolve numeric dimensions from semantic size names
  const dim =
    size === "small"  ? 48  :
    size === "medium" ? 80  :
    size === "large"  ? 128 :
    80; // default

  // When a custom Tailwind size class is passed (e.g. "w-32 h-32") we can't
  // know the exact px, so we use a generous fill layout instead.
  const isCustomSize = typeof size === "string" && !["small", "medium", "large"].includes(size);

  const wrapperCls = [
    "inline-block overflow-hidden rounded",
    isCustomSize ? size : `w-[${dim}px] h-[${dim}px]`,
    customClass ?? "",
  ]
    .filter(Boolean)
    .join(" ");

  if (isCustomSize) {
    // Use fill layout so the image covers whatever dimensions the wrapper provides
    return (
      <span className={`relative ${wrapperCls}`} style={{ opacity }}>
        <NextImage
          src={url}
          alt=""
          fill
          className="object-cover"
          loading="lazy"
          unoptimized={!process.env.REACT_APP_BACKEND}
        />
      </span>
    );
  }

  return (
    <span className={wrapperCls} style={{ opacity }}>
      <NextImage
        src={url}
        alt=""
        width={dim}
        height={dim}
        className="object-cover w-full h-full"
        loading="lazy"
        unoptimized={!process.env.REACT_APP_BACKEND}
      />
    </span>
  );
}
