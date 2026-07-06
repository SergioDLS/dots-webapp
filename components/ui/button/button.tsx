"use client";

import React from "react";

export type ButtonTone = "accent" | "primary" | "purple" | "success" | "neutral" | "ghost";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  tone?: ButtonTone;
  fullWidth?: boolean;
}

/* Chunky "pushable" buttons: flat top + darker bottom edge.
   Pressing translates the button down onto its edge (see .btn-3d). */
const toneStyles: Record<ButtonTone, React.CSSProperties> = {
  accent: {
    background: "var(--accent)",
    color: "var(--accent-contrast)",
    boxShadow: "0 4px 0 var(--accent-edge)",
  },
  primary: {
    background: "var(--accent)",
    color: "var(--accent-contrast)",
    boxShadow: "0 4px 0 var(--accent-edge)",
  },
  purple: {
    background: "var(--purple)",
    color: "#fff",
    boxShadow: "0 4px 0 var(--purple-edge)",
  },
  success: {
    background: "var(--success)",
    color: "#fff",
    boxShadow: "0 4px 0 var(--success-edge)",
  },
  neutral: {
    background: "var(--surface)",
    color: "var(--foreground)",
    border: "2px solid var(--border)",
    boxShadow: "0 4px 0 var(--neutral-edge)",
  },
  ghost: {
    background: "transparent",
    color: "var(--muted)",
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
    ...(rest.style as React.CSSProperties),
  };

  return (
    <button
      {...rest}
      disabled={disabled}
      className={[
        "btn-3d inline-flex items-center justify-center gap-2",
        "rounded-2xl px-5 py-3.5 text-sm font-extrabold uppercase tracking-wide",
        widthClass,
        className,
      ].join(" ")}
      style={style}
    >
      {children}
    </button>
  );
}
