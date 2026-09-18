"use client";

import { useEffect, useRef } from "react";

import Avatar from "@/components/ui/avatar/avatar";
import Doty from "@/components/ui/doty/doty";
import { Icon } from "@/components/ui/icon";
import type { PublicAvatar } from "@/lib/avatar";
import type { ShopItem } from "@/services/shop.service";
import { bloquearScroll } from "@/lib/scroll-lock";

/**
 * Selector de avatar (spec §6.1). Lista los que el usuario puede usar ya: los
 * gratis y los que haya comprado. Los de pago que no tiene se compran en la
 * tienda, no aquí — por eso esta hoja no habla de gemas.
 */
interface Props {
  open: boolean;
  onClose: () => void;
  /** Avatares equipables: gratis o ya comprados. */
  items: ShopItem[];
  /** Key del que lleva puesto, para marcarlo. */
  currentKey: string | null;
  onPick: (key: string) => void;
}

export default function AvatarPicker({ open, onClose, items, currentKey, onPick }: Props) {
  const panelRef = useRef<HTMLDivElement>(null);

  // Va en su propio efecto con [open] como única dependencia: si dependiera de
  // onClose, que llega nueva en cada render de la página, le robaría el foco al
  // usuario en cada repintado en vez de moverlo una sola vez al abrir.
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
    <div className="fixed inset-0 z-50 flex items-end justify-center md:items-stretch md:justify-end">
      <div aria-hidden onClick={onClose} className="absolute inset-0" style={{ background: "var(--scrim)" }} />
      <div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label="Elegir avatar"
        className="relative z-10 flex max-h-[85vh] w-full flex-col overflow-y-auto rounded-t-3xl bg-(--surface) px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-4 [animation:dots-slide-up_.25s_ease-out_both] md:max-h-none md:w-[380px] md:rounded-none md:rounded-l-3xl md:pb-5 md:[animation:dots-slide-right_.25s_ease-out_both]"
      >
        <div className="flex items-center justify-between gap-2 pb-3">
          <h2 className="font-display text-xl font-extrabold text-foreground">Elige tu avatar</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="rounded-full p-2 text-(--muted) transition-transform duration-150 active:scale-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--accent)"
          >
            <Icon name="cruz" size={20} mono />
          </button>
        </div>

        {items.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-10 text-center">
            <Doty pose="timido" size="small" />
            <p className="text-sm font-semibold text-(--muted)">
              Todavía no hay avatares para elegir. Vuelve pronto.
            </p>
          </div>
        ) : (
          <ul className="grid grid-cols-3 gap-3">
            {items.map((item) => {
              const on = item.key === currentKey;
              const avatar = {
                img: item.img ?? "",
                color: (item.meta?.color as string) ?? "#FF1F8F",
              } as PublicAvatar;
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => onPick(item.key)}
                    aria-pressed={on}
                    className="flex w-full flex-col items-center gap-1.5 rounded-2xl px-1 py-2 transition-transform duration-150 active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--accent)"
                    style={{
                      background: on ? "color-mix(in srgb, var(--accent) 12%, transparent)" : "transparent",
                      border: on ? "2px solid var(--accent)" : "2px solid transparent",
                    }}
                  >
                    <Avatar avatar={avatar} size={96} alt="" />
                    {/* Dos lineas, no una: los 22 disfraces llevan el prefijo
                        "Doty: " y a 11 px en una celda de un tercio de pantalla
                        "Doty: Astronauta" no cabe de una. Con line-clamp-1 se
                        cortaba justo en el tema, que es la parte que informa. */}
                    <span
                      className="line-clamp-2 text-[11px] font-extrabold"
                      style={{ color: on ? "var(--accent)" : "var(--foreground)" }}
                    >
                      {(item.meta?.label as string) ?? item.name}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
