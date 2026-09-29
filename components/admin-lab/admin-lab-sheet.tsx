"use client";

import { useEffect, useRef } from "react";

import { Icon } from "@/components/ui/icon";
import OverlayPortal from "@/components/ui/overlay-portal";
import { bloquearScroll } from "@/lib/scroll-lock";
import AdminModeSwitch from "./admin-mode-switch";

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function AdminLabSheet({ open, onClose }: Props) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    panelRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const soltar = bloquearScroll();
    return () => {
      document.removeEventListener("keydown", onKey);
      soltar();
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <OverlayPortal>
      <div className="fixed inset-0 z-50 flex items-end justify-center md:items-stretch md:justify-end">
        <div aria-hidden onClick={onClose} className="absolute inset-0" style={{ background: "var(--scrim)" }} />
        <div
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-label="Modo admin"
          tabIndex={-1}
          className="relative z-10 flex max-h-[85svh] w-full flex-col overflow-y-auto rounded-t-3xl bg-(--surface) px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-4 [animation:dots-slide-up_.25s_ease-out_both] md:max-h-none md:w-[380px] md:rounded-none md:rounded-l-3xl md:pb-5 md:[animation:dots-slide-right_.25s_ease-out_both]"
        >
          <div className="flex items-center justify-between gap-2 pb-2">
            <h2 className="font-display text-xl font-extrabold text-foreground">Modo admin</h2>
            <button
              type="button"
              onClick={onClose}
              aria-label="Cerrar"
              className="rounded-full p-2 text-(--muted) transition-transform duration-150 active:scale-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--accent)"
            >
              <Icon name="cruz" size={20} mono />
            </button>
          </div>
          <section className="border-t border-(--border)">
            <AdminModeSwitch subtitle="Todo abierto. Nadie más ve esto." />
          </section>
        </div>
      </div>
    </OverlayPortal>
  );
}
