"use client";

import Doty from "@/components/ui/doty/doty";

interface Props {
  visible: boolean;
  onClick: () => void;
  /** `floating`: píldora fija abajo a la derecha (móvil). `inline`: botón dentro del panel (escritorio). */
  variant: "floating" | "inline";
}

const PILL =
  "dots-pressable relative inline-flex items-center rounded-full bg-(--accent) text-[13px] font-black text-(--accent-contrast) [--press-color:var(--accent-edge)]";

/** "Volver a mi nivel" (spec §3.2): visible cuando el nodo actual no está en pantalla o se mira otra dificultad. */
export default function BackToCurrent({ visible, onClick, variant }: Props) {
  if (!visible) return null;
  if (variant === "inline") {
    return (
      <button type="button" onClick={onClick} className={`${PILL} w-full justify-center gap-2 px-4 py-2.5`}>
        <Doty pose="corriendo" size="chip" shadow={false} /> Volver a mi nivel
      </button>
    );
  }
  return (
    <button
      type="button"
      onClick={onClick}
      className={`${PILL} fixed right-4 z-30 py-2.5 pr-4 pl-14 md:hidden`}
      style={{
        bottom: "calc(76px + env(safe-area-inset-bottom))",
        animation: "dots-pop-in 250ms cubic-bezier(.34,1.56,.64,1) both",
      }}
    >
      <span aria-hidden className="absolute" style={{ left: -6, top: -30 }}>
        <Doty pose="corriendo" size="mini" shadow={false} />
      </span>
      Volver a mi nivel
    </button>
  );
}
