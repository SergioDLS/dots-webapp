"use client";

import { useEffect } from "react";

import Doty from "@/components/ui/doty/doty";
import { Icon } from "@/components/ui/icon";
import { DURACION_MS, type Aviso } from "@/lib/rival-alert";

/**
 * La tarjeta del aviso "te pasó" (spec §6.5). Solo pinta: quién decide que hay
 * aviso y quién guarda el puesto es `components/rival/rival-watch.tsx`.
 *
 * NO es un modal: no bloquea el scroll ni se come los toques de lo que hay
 * debajo. La pista contextual del §7.3 sí puede interrumpir porque se ve una
 * vez en la vida; esto puede pasar varias veces por semana.
 */
interface Props {
  aviso: Aviso;
  onCerrar: () => void;
  onAbrirRetos: () => void;
}

export default function RivalAlert({ aviso, onCerrar, onAbrirRetos }: Props) {
  useEffect(() => {
    const t = setTimeout(onCerrar, DURACION_MS);
    return () => clearTimeout(t);
  }, [aviso, onCerrar]);

  const perdiste = aviso.tipo === "perdiste";
  const titulo = perdiste ? `Te pasó ${aviso.nombre}` : `Le pasaste a ${aviso.nombre}`;
  const frase = perdiste
    ? `Por ${aviso.delta} XP. ¿Lo vas a dejar así?`
    : `Vas ${aviso.delta} XP arriba. Que no te alcance.`;

  return (
    <div
      // `pointer-events-none` en el envoltorio y `auto` en la tarjeta: el
      // aviso ocupa el ancho de la pantalla para centrarse, pero solo la
      // tarjeta debe recibir toques.
      className="pointer-events-none fixed inset-x-0 z-40 flex justify-center px-4 md:pl-[84px]"
      style={{ bottom: "calc(env(safe-area-inset-bottom) + 76px)" }}
      role="status"
      aria-live="polite"
    >
      <div
        className="pointer-events-auto flex w-full max-w-sm items-center gap-3 rounded-2xl p-3 text-left"
        style={{
          background: "var(--surface)",
          border: "2px solid var(--border)",
          boxShadow: "0 8px 24px rgba(0,0,0,0.18)",
          animation: "dots-slide-up 0.3s ease-out both",
        }}
      >
        <button
          type="button"
          onClick={onAbrirRetos}
          className="flex min-w-0 flex-1 items-center gap-3 text-left transition-transform duration-150 active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--accent)"
        >
          <Doty pose={aviso.pose} size="smaller" animation={aviso.animacion} />
          <span className="flex min-w-0 flex-col gap-0.5">
            <span className="truncate font-display text-base font-extrabold text-foreground">
              {titulo}
            </span>
            <span className="text-xs font-semibold text-(--muted)">{frase}</span>
          </span>
        </button>
        <button
          type="button"
          onClick={onCerrar}
          aria-label="Cerrar"
          className="shrink-0 self-start rounded-full p-1 text-(--muted) transition-transform duration-150 active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--accent)"
        >
          <Icon name="cruz" size={18} mono />
        </button>
      </div>
    </div>
  );
}
