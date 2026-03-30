"use client";

import React from "react";

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  fullWidth?: boolean;
}

export default function Input({ label, fullWidth = true, className = "", ...rest }: InputProps) {
  const widthCls = fullWidth ? "w-full" : "w-auto";
  return (
  <label className={`flex flex-col gap-1 text-sm font-medium text-foreground ${widthCls}`}>
      {label ? <span className="text-(--muted)">{label}</span> : null}
      <input
        {...rest}
        className={`rounded-xl border border-(--border) bg-(--input-bg) px-4 py-3 text-base text-foreground placeholder:text-(--muted) outline-none transition focus:border-(--accent) focus:ring-2 focus:ring-(--accent)/25 ${className}`}
      />
    </label>
  );
}
