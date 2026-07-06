"use client";

import React from "react";
import Image from "next/image";

export type DotyAnimation = "none" | "bob" | "cheer" | "sad" | "wave";

interface DotyProps {
  pose: string;
  size?: "micro" | "mini" | "small" | "tiny" | "smaller" | "medium" | "big";
  customClass?: string;
  /** Named animation from the DOTY motion vocabulary (globals.css) */
  animation?: DotyAnimation;
  /** Optional speech bubble text shown above DOTY */
  say?: string;
}

const sizeClass: Record<NonNullable<DotyProps["size"]>, string> = {
  micro: "w-8",
  mini: "w-20",
  small: "w-36",
  tiny: "w-24",
  smaller: "w-28",
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
}: DotyProps) {
  const img = (
    <Image
      src={`/images/Doty/DOTTY-POSES-${pose}.png`}
      alt="DOTY, your learning buddy"
      width={320}
      height={320}
      className={`h-auto select-none ${sizeClass[size]} ${animationClass[animation]} ${customClass}`}
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
        {/* bubble tail */}
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
