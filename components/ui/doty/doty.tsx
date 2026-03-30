"use client";

import React, { useEffect, useState } from "react";
import Image from "next/image";

interface DotyProps {
  pose: string;
  size?: "micro" | "mini" | "small" | "tiny" | "smaller" | "medium" | "big";
  customClass?: string;
}

const sizeClass: Record<NonNullable<DotyProps["size"]>, string> = {
  micro: "w-8",
  mini: "w-20",
  small: "w-36",
  tiny: "w-24",
  smaller: "w-28",
  medium: "w-48",
  big: "w-[35rem]",
};

export default function Doty({
  pose,
  size = "small",
  customClass = "",
}: DotyProps) {
  const cls = `${sizeClass[size]} ${customClass}`;

  return (
    <Image
      src={`/images/Doty/DOTTY-POSES-${pose}.png`}
      alt="Doty"
      width={320}
      height={320}
      className={`transition ${cls}`}
      priority
    />
  );
}
