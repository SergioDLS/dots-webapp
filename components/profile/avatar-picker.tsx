"use client";

import { useEffect, useRef, useState } from "react";

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
 *
 * Elegir y confirmar son dos gestos distintos. Tocar un retrato solo lo marca;
 * hasta que no se pulsa Confirmar no sale ningún POST ni se cierra la hoja. Con
 * el toque único, un dedo resbalado en una rejilla de retratos de 96 px cambiaba
 * el avatar y cerraba, y deshacerlo obligaba a reabrir y buscar el anterior.
 */
interface Props {
  open: boolean;
  onClose: () => void;
  /** Avatares equipables: gratis o ya comprados. */
  items: ShopItem[];
  /** Key del que lleva puesto, para marcarlo. */
  currentKey: string | null;
  onPick: (key: string) => void;
  /** POST en vuelo: lo sabe la página, que es quien llama al servicio. */
  guardando?: boolean;
}

export default function AvatarPicker({ open, onClose, items, currentKey, onPick, guardando = false }: Props) {
  const panelRef = useRef<HTMLDivElement>(null);
  // `null` = "todavía no ha tocado nada", y entonces lo marcado es el que lleva
  // puesto. Se deriva de `currentKey` en vez de sembrarse en un efecto: un
  // `setState` de siembra tendría que correr en el cuerpo del efecto, que es
  // justo lo que prohíbe la regla 3.
  const [elegida, setElegida] = useState<string | null>(null);
  const seleccionada = elegida ?? currentKey;
  const sinCambio = seleccionada === currentKey;

  // Cerrar olvida la elección a medias. Hoy la página desmonta la hoja al
  // cerrarla, así que esto es redundante — pero deja el componente correcto por
  // sí solo, sin depender de cómo lo monte quien lo use.
  const cerrar = () => {
    setElegida(null);
    onClose();
  };

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
      // Mismo olvido que `cerrar`: `setElegida` es estable, así que no entra en
      // las dependencias y el listener no se resuscribe en cada repintado.
      if (e.key === "Escape") {
        setElegida(null);
        onClose();
      }
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
      <div aria-hidden onClick={cerrar} className="absolute inset-0" style={{ background: "var(--scrim)" }} />
      <div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label="Elegir avatar"
        className="relative z-10 flex max-h-[85svh] w-full flex-col overflow-y-auto rounded-t-3xl bg-(--surface) px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-4 [animation:dots-slide-up_.25s_ease-out_both] md:max-h-none md:w-[380px] md:rounded-none md:rounded-l-3xl md:pb-5 md:[animation:dots-slide-right_.25s_ease-out_both]"
      >
        <div className="flex items-center justify-between gap-2 pb-3">
          <h2 className="font-display text-xl font-extrabold text-foreground">Elige tu avatar</h2>
          <button
            type="button"
            onClick={cerrar}
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
              const on = item.key === seleccionada;
              const puesto = item.key === currentKey;
              const avatar = {
                img: item.img ?? "",
                color: (item.meta?.color as string) ?? "#FF1F8F",
              } as PublicAvatar;
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => setElegida(item.key)}
                    aria-pressed={on}
                    className="relative flex w-full flex-col items-center gap-1.5 rounded-2xl px-1 py-2 transition-transform duration-150 active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--accent)"
                    style={{
                      background: on ? "color-mix(in srgb, var(--accent) 12%, transparent)" : "transparent",
                      border: on ? "2px solid var(--accent)" : "2px solid transparent",
                    }}
                  >
                    {/* El que lleva puesto se marca aparte del que esta elegido:
                        en cuanto toca otro retrato el anillo se muda, y sin esto
                        se perderia de vista cual tenia antes de cambiar. Va
                        encima del retrato para no robarle alto a la celda. */}
                    {puesto && (
                      <span
                        aria-label="Lo llevas puesto"
                        title="Lo llevas puesto"
                        className="absolute right-1 top-1 z-10 inline-flex items-center justify-center rounded-full p-0.5"
                        style={{ background: "var(--accent)", color: "var(--accent-contrast)" }}
                      >
                        <Icon name="check" size={13} mono />
                      </span>
                    )}
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

        {items.length > 0 && (
          // `sticky` y no un pie fuera del scroll: el panel entero es el que
          // desplaza, y sacarlo de ahi obligaria a partirlo en cabecera, lista y
          // pie con su propio overflow. Con 25 avatares en rejilla de tres, el
          // boton tiene que alcanzarse sin bajar hasta el final.
          <div className="sticky bottom-0 -mx-5 mt-3 px-5 pb-1 pt-3 bg-(--surface)">
            <button
              type="button"
              onClick={() => seleccionada && onPick(seleccionada)}
              disabled={sinCambio || guardando || !seleccionada}
              className="dots-pressable w-full rounded-2xl px-4 py-3 text-sm font-black disabled:opacity-55"
              style={{
                background: "var(--accent)",
                color: "var(--accent-contrast)",
                ["--press-color" as string]: "var(--accent-edge)",
              }}
            >
              {guardando ? "…" : sinCambio ? "Ya lo llevas puesto" : "Confirmar"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
