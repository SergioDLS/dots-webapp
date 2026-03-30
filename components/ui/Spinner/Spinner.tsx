"use client";

import React from "react";

interface SpinnerProps {
  title?: string;
  tone?: "accent" | "primary" | "neutral";
  size?: "sm" | "md" | "lg";
}

const sizeMap = { sm: "h-6 w-6", md: "h-10 w-10", lg: "h-14 w-14" };
const toneMap = {
  accent: "border-(--accent) border-t-transparent",
  primary: "border-(--primary) border-t-transparent",
  neutral: "border-(--border) border-t-transparent",
};

export default function Spinner({ title, tone = "accent", size = "md" }: SpinnerProps) {
  const sizeCls = sizeMap[size];
  const toneCls = toneMap[tone];

  return (
    <div className="flex flex-col items-center gap-2 text-center">
      <div className={`animate-spin rounded-full border-4 ${toneCls} ${sizeCls}`} />
      {title ? <span className="text-sm text-(--muted)">{title}</span> : null}
    </div>
  );
}
