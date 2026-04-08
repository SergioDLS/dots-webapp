"use client";

import React from "react";

export type ButtonTone = "accent" | "primary" | "neutral" | "ghost";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  tone?: ButtonTone;
  fullWidth?: boolean;
}

const toneStyles: Record<ButtonTone, React.CSSProperties> = {
  accent: {
    background: "linear-gradient(135deg, var(--accent), #f472b6)",
    color: "#fff",
    border: "none",
    boxShadow: "0 3px 12px rgba(212,0,126,0.25)",
  },
  primary: {
    background: "linear-gradient(135deg, var(--primary), var(--accent))",
    color: "var(--primary-contrast)",
    border: "none",
    boxShadow: "0 3px 12px rgba(0,0,0,0.15)",
  },
  neutral: {
    background: "var(--surface)",
    color: "var(--foreground)",
    border: "2px solid var(--border)",
    boxShadow: "none",
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
    ...(disabled ? { opacity: 0.5, pointerEvents: "none" as const, filter: "grayscale(0.4)" } : {}),
    ...(rest.style as React.CSSProperties),
  };

  return (
    <button
      {...rest}
      disabled={disabled}
      className={[
        "inline-flex items-center justify-center gap-2",
        "rounded-2xl px-5 py-3.5 text-sm font-extrabold cursor-pointer",
        "transition-all duration-200",
        "hover:brightness-110 hover:scale-[1.02]",
        "active:scale-[.97] active:brightness-95",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
        widthClass,
        className,
      ].join(" ")}
      style={style}
    >
      {children}
    </button>
  );
}
