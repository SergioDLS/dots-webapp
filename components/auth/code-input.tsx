"use client";

import React, { useRef } from "react";

const CELLS = [0, 1, 2, 3, 4, 5];

type CodeInputProps = {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
};

/**
 * Código de 6 dígitos: seis cajas de presentación con UN input real
 * superpuesto. Con seis inputs separados se rompen el pegado y el autofill
 * de `one-time-code`, y hay que manejar foco a mano; así todo eso es nativo.
 */
export default function CodeInput({
  value,
  onChange,
  disabled = false,
}: CodeInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const activeIndex = Math.min(value.length, CELLS.length - 1);

  return (
    <div
      className="relative"
      onPointerUp={() => inputRef.current?.focus()}
    >
      <div className="flex justify-center gap-2 pointer-events-none" aria-hidden>
        {CELLS.map((i) => {
          const isActive = !disabled && i === activeIndex;
          return (
            <div
              key={i}
              className={`flex h-14 w-11 items-center justify-center rounded-2xl border-2 bg-(--input-bg) font-display text-2xl font-extrabold text-foreground transition-all duration-150 ${
                isActive
                  ? "border-(--accent) ring-4 ring-(--accent)/15"
                  : "border-(--border)"
              }`}
            >
              {value[i] ??
                (isActive ? (
                  <span className="h-6 w-0.5 animate-pulse bg-(--accent)" />
                ) : (
                  ""
                ))}
            </div>
          );
        })}
      </div>

      <input
        ref={inputRef}
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, 6))}
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={6}
        disabled={disabled}
        aria-label="Código de 6 dígitos"
        className="absolute inset-0 h-full w-full cursor-pointer rounded-2xl bg-transparent text-center text-base text-transparent caret-transparent outline-none disabled:cursor-not-allowed"
      />
    </div>
  );
}
