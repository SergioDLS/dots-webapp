"use client";

import React from "react";

export type ButtonTone = "accent" | "primary" | "neutral" | "ghost";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  tone?: ButtonTone;
  fullWidth?: boolean;
}

// Keep presentational classes but drive actual colors from CSS variables so
// light/dark themes can override tone colors centrally.
const toneClasses: Record<ButtonTone, string> = {
  accent: "hover:opacity-95 focus-visible:ring-2",
  primary: "hover:opacity-95 focus-visible:ring-2",
  neutral: "border border-gray-200 hover:bg-gray-50 focus-visible:ring-2",
  ghost: "bg-transparent text-gray-500 hover:bg-transparent focus-visible:ring-2",
};

const toneStyles: Record<ButtonTone, React.CSSProperties> = {
  accent: { backgroundColor: 'var(--btn-accent, #ffb86b)', color: 'var(--btn-accent-foreground, #000)', boxShadow: 'none' },
  primary: { backgroundColor: 'var(--btn-primary, #7c3aed)', color: 'var(--btn-primary-foreground, #fff)', boxShadow: 'none' },
  neutral: { backgroundColor: 'var(--btn-neutral, #ffffff)', color: 'var(--btn-neutral-foreground, #000)' },
  ghost: { backgroundColor: 'transparent', color: 'var(--btn-ghost-foreground, #6b7280)' },
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
      className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold transition active:scale-[.98] focus-visible:outline-none ${toneClass} ${widthClass} ${className}`}
      style={{ ...(toneStyles[tone] || {}), ...(rest.style as React.CSSProperties) }}
    >
      {children}
    </button>
  );
}
