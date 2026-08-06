"use client";

import React from "react";

/* Clases compartidas por las pantallas de autenticación (login y /forgot). */

export const inputCls =
  "w-full rounded-2xl border-2 border-(--border) bg-(--input-bg) px-4 py-3 text-base text-foreground placeholder:text-(--muted) outline-none transition-all duration-200 focus:border-(--accent) focus:ring-4 focus:ring-(--accent)/15";

export const btnPrimary =
  "dots-pressable w-full rounded-2xl bg-(--accent) px-4 py-3.5 text-sm font-extrabold tracking-wide text-(--accent-contrast) [--press-color:var(--accent-edge)] disabled:opacity-60";

export const btnOutline =
  "dots-pressable w-full rounded-2xl border-2 border-(--border) bg-(--surface) px-4 py-3 text-sm font-bold text-(--muted) hover:text-(--accent) hover:border-(--accent)";

export function ErrorBanner({ text }: { text: string }) {
  return (
    <p
      className="rounded-2xl px-4 py-2.5 text-center text-sm font-bold"
      style={{
        background: "var(--danger-soft)",
        color: "var(--danger)",
        animation: "dots-pop-in 0.3s ease-out both",
      }}
    >
      {text}
    </p>
  );
}

/** Fondo con blobs a la deriva + tarjeta central. Compartido por login y /forgot. */
export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-screen w-full items-center justify-center overflow-hidden px-6 py-12 text-foreground">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-32 -left-32 h-96 w-96 rounded-full opacity-30 blur-3xl"
        style={{
          background: "var(--accent)",
          animation: "dots-blob-drift 14s ease-in-out infinite",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -right-32 -bottom-32 h-96 w-96 rounded-full opacity-25 blur-3xl"
        style={{
          background: "var(--primary)",
          animation: "dots-blob-drift 18s ease-in-out infinite reverse",
        }}
      />
      <div className="dots-card relative z-10 flex w-full max-w-3xl items-center justify-center px-6 py-10 md:px-12 md:py-12">
        {children}
      </div>
    </div>
  );
}
