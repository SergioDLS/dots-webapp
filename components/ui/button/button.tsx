"use client";

import React from "react";

export type ButtonTone = "accent" | "primary" | "neutral" | "ghost";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  tone?: ButtonTone;
  fullWidth?: boolean;
}

// Each tone pairs a fill with a darker --press-color for the 3-D edge.
const toneStyles: Record<ButtonTone, React.CSSProperties> = {
  accent: {
    background: "var(--accent)",
    color: "var(--accent-contrast)",
    border: "none",
    ["--press-color" as string]: "#9c005d",
  },
  primary: {
    background: "var(--primary)",
    color: "var(--primary-contrast)",
    border: "none",
    ["--press-color" as string]: "rgba(0,0,0,0.35)",
  },
  neutral: {
    background: "var(--surface)",
    color: "var(--foreground)",
    border: "2px solid var(--border)",
    ["--press-color" as string]: "var(--border)",
  },
  ghost: {
    background: "transparent",
    color: "var(--muted)",
    border: "none",
    boxShadow: "none",
  },
};

export default function UIButton({
  children,
  tone = "accent",
  fullWidth = false,
  className = "",
  disabled,
  ...rest
}: ButtonProps) {
  const widthClass = fullWidth ? "w-full" : "w-auto";

  const style: React.CSSProperties = {
    ...toneStyles[tone],
    ...(disabled
      ? { opacity: 0.5, pointerEvents: "none" as const, filter: "grayscale(0.4)" }
      : {}),
    ...(rest.style as React.CSSProperties),
  };

  return (
    <button
      {...rest}
      disabled={disabled}
      className={[
        "inline-flex items-center justify-center gap-2",
        "rounded-2xl px-5 py-3.5 text-sm font-extrabold cursor-pointer",
        tone === "ghost" ? "transition-all duration-200 hover:text-(--accent)" : "dots-pressable",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--accent) focus-visible:ring-offset-2",
        widthClass,
        className,
      ].join(" ")}
      style={style}
    >
      {children}
    </button>
  );
}
