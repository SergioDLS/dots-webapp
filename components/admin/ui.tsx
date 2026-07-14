"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { BASE_URL_IMAGES, BASE_URL_SOUNDS } from "@/constants";

// Absolute URLs (Cloudinary uploads) are used as-is; legacy relative paths
// resolve against the backend's static folders, same as the learner UI.
export function resolveImageUrl(src: string): string {
  if (!src) return "";
  return /^https?:\/\//.test(src) ? src : `${BASE_URL_IMAGES}/words/${src}`;
}

export function resolveAudioUrl(src: string): string {
  if (!src) return "";
  return /^https?:\/\//.test(src) ? src : `${BASE_URL_SOUNDS}/${src}`;
}

// Shared building blocks for the admin screens: toast feedback, enable
// toggles, search boxes, the modal shell and media upload tiles.

export type Toast = { text: string; kind: "ok" | "error" } | null;

export function useToast(): [Toast, (text: string, kind?: "ok" | "error") => void] {
  const [toast, setToast] = useState<Toast>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const flash = useCallback((text: string, kind: "ok" | "error" = "ok") => {
    setToast({ text, kind });
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setToast(null), 2600);
  }, []);

  return [toast, flash];
}

export function ToastBanner({ toast }: { toast: NonNullable<Toast> }) {
  return (
    <div
      className="pop-in fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-2xl px-5 py-3 text-sm font-extrabold text-white shadow-lg"
      style={{
        background: toast.kind === "ok" ? "var(--success)" : "var(--danger)",
      }}
    >
      {toast.text}
    </div>
  );
}

export function Toggle({
  on,
  onClick,
  title,
}: {
  on: boolean;
  onClick: () => void;
  title?: string;
}) {
  return (
    <button
      onClick={onClick}
      className="inline-flex h-6 w-11 items-center rounded-full p-0.5 transition-colors"
      style={{ background: on ? "var(--success)" : "var(--border)" }}
      aria-pressed={on}
      title={title ?? (on ? "Enabled" : "Disabled")}
    >
      <span
        className="h-5 w-5 rounded-full bg-white transition-transform"
        style={{ transform: on ? "translateX(20px)" : "translateX(0)" }}
      />
    </button>
  );
}

export function SearchInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  return (
    <div className="relative w-full max-w-xs">
      <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-sm">
        🔍
      </span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-xl border-2 border-(--border) bg-(--surface) py-2.5 pl-10 pr-9 text-sm font-bold text-foreground placeholder:font-medium placeholder:text-(--muted) outline-none transition-all focus:border-(--accent)"
      />
      {value && (
        <button
          onClick={() => onChange("")}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-(--muted) hover:text-(--danger)"
          aria-label="Clear search"
        >
          ×
        </button>
      )}
    </div>
  );
}

export function AdminModal({
  title,
  onClose,
  children,
  footer,
  wide,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  footer: React.ReactNode;
  wide?: boolean;
}) {
  // Close on Escape for keyboard comfort
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden
      />
      <div
        className={`pop-in relative z-10 w-full ${wide ? "max-w-2xl" : "max-w-lg"} overflow-hidden rounded-3xl border-2 border-(--border) bg-(--surface) shadow-2xl`}
      >
        <div className="flex items-center justify-between border-b border-(--border) px-6 py-4">
          <h3 className="font-display text-xl font-extrabold text-foreground">
            {title}
          </h3>
          <button
            onClick={onClose}
            className="text-2xl leading-none text-(--muted) hover:text-(--accent)"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div className="flex max-h-[70vh] flex-col gap-4 overflow-y-auto px-6 py-5">
          {children}
        </div>

        <div className="flex justify-end gap-3 border-t border-(--border) px-6 py-4">
          {footer}
        </div>
      </div>
    </div>
  );
}

export function ModalError({ text }: { text: string }) {
  if (!text) return null;
  return (
    <p className="rounded-2xl border-2 border-(--danger)/30 bg-(--danger)/10 px-4 py-2.5 text-center text-sm font-bold text-(--danger)">
      {text}
    </p>
  );
}

export const modalInputCls =
  "w-full rounded-2xl border-2 border-(--border) bg-(--input-bg) px-4 py-3 text-base font-semibold text-foreground placeholder:text-(--muted) placeholder:font-medium outline-none transition-all focus:border-(--accent) focus:ring-4 focus:ring-(--accent)/15";

export function Field({
  label,
  children,
}: {
  label: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="px-1 text-xs font-bold text-(--muted)">{label}</span>
      {children}
    </label>
  );
}

export function UploadTile({
  label,
  accept,
  uploading,
  hasValue,
  onFile,
  onClear,
  preview,
}: {
  label: string;
  accept: string;
  uploading: boolean;
  hasValue: boolean;
  onFile: (f: File | undefined) => void;
  onClear: () => void;
  preview?: string;
}) {
  const id = `upload-${label.replace(/\s+/g, "-").toLowerCase()}`;
  return (
    <div className="flex flex-col gap-2 rounded-2xl border-2 border-(--border) p-3">
      <span className="text-xs font-bold text-(--muted)">{label}</span>
      {preview && accept.startsWith("image") && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={preview}
          alt={label}
          className="h-16 w-16 rounded-lg object-cover"
        />
      )}
      {preview && accept.startsWith("audio") && (
        <audio src={preview} controls className="h-8 w-full" />
      )}
      <div className="flex items-center gap-2">
        <input
          id={id}
          type="file"
          accept={accept}
          hidden
          onChange={(e) => onFile(e.target.files?.[0])}
        />
        <label
          htmlFor={id}
          className="cursor-pointer rounded-lg border-2 border-(--border) px-3 py-1.5 text-xs font-bold text-(--muted) transition-colors hover:border-(--accent) hover:text-(--accent)"
        >
          {uploading ? "Uploading…" : hasValue ? "Replace" : "Upload"}
        </label>
        {hasValue && !uploading && (
          <>
            <span className="text-sm text-(--success)" title="Uploaded">
              ✓
            </span>
            <button
              onClick={onClear}
              className="text-xs font-bold text-(--muted) hover:text-(--danger)"
            >
              clear
            </button>
          </>
        )}
      </div>
    </div>
  );
}
