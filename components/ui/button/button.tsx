"use client";

import React from "react";

export type ButtonTone = "accent" | "primary" | "neutral" | "ghost";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  tone?: ButtonTone;
  fullWidth?: boolean;
}

const toneClasses: Record<ButtonTone, string> = {
  accent:
    "bg-(--accent) text-(--accent-contrast) hover:opacity-90 focus-visible:ring-(--accent)/40",
  primary:
    "bg-(--primary) text-(--primary-contrast) hover:opacity-90 focus-visible:ring-(--primary)/40",
  neutral:
    "bg-(--surface) text-(--foreground) border border-(--border) hover:border-(--accent) hover:text-(--accent) focus-visible:ring-(--accent)/30",
  ghost: "bg-transparent text-(--muted) hover:text-(--accent) hover:bg-(--border)/40 focus-visible:ring-(--accent)/20",
};

export default function UIButton({
  children,
  tone = "accent",
  fullWidth = false,
  className = "",
  ...rest
}: ButtonProps) {
  const toneClass = toneClasses[tone];
  const widthClass = fullWidth ? "w-full" : "w-auto";

  return (
    <button
      {...rest}
      className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold transition active:scale-[.98] focus-visible:outline-none focus-visible:ring-2 ${toneClass} ${widthClass} ${className}`}
    >
      {children}
    </button>
  );
}
