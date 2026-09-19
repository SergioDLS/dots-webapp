"use client";

import { useEffect, useRef, type CSSProperties } from "react";

import Doty from "@/components/ui/doty/doty";
import type { Recorte } from "@/hooks/use-tip-anchor";
import type { Tip } from "@/lib/tips";
import OverlayPortal from "@/components/ui/overlay-portal";

/**
 * Una pista contextual (spec §7.3): oscurece la pantalla menos el elemento del
 * que habla, y explica en una frase qué es.
 *
 * El foco es un `box-shadow` de 9999 px: el hueco es el propio div y la sombra
 * pinta todo lo demás. El bocadillo NO lleva flecha ni persigue la posición
 * exacta; se centra y se pone del lado donde hay sitio, que en un teléfono es
 * más fiable que recortar contra los bordes.
 */
interface Props {
  tip: Tip;
  recorte: Recorte;
  /** 1-based, para "Pista 1 de 2". */
  indice: number;
  total: number;
  onEntendido: () => void;
}

/**
 * Lo que mide el bocadillo entero: Doty de 84, título, frase, botón y contador.
 * Con la frase más larga (`camino.racha`) a 390 px de ancho pasa de 300, así
 * que se redondea hacia arriba: quedarse corto solo hace que elija un lado
 * donde no cabe del todo.
 */
const ALTO_BOCADILLO = 300;

/** Aire entre el foco y el bocadillo. */
const MARGEN = 16;

export default function DotyTip({ tip, recorte, indice, total, onEntendido }: Props) {
  const botonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    botonRef.current?.focus();
  }, []);

  useEffect(() => {
    const alPulsar = (e: KeyboardEvent) => {
      // Descartar cuenta como haberla visto: una pista se enseña una sola vez.
      if (e.key === "Escape") {
        onEntendido();
        return;
      }
      // Trampa de foco. El bocadillo tiene un solo control, así que basta con
      // devolverle el foco: sin esto se puede tabular hasta la página de
      // debajo y abrir la hoja de ajustes ENCIMA de la pista, y entonces un
      // solo Escape cierra la hoja Y da la pista por vista sin haberla
      // enseñado — irreversible, porque el PATCH viaja a la cuenta.
      if (e.key === "Tab") {
        e.preventDefault();
        botonRef.current?.focus();
      }
    };
    document.addEventListener("keydown", alPulsar);
    return () => document.removeEventListener("keydown", alPulsar);
  }, [onEntendido]);

  // Arriba o abajo del foco, según dónde quepa de verdad — no según en qué
  // mitad de la pantalla cae el objetivo, que con un objetivo alto elegía el
  // lado sin sitio. Si no cabe a ninguno de los dos, se centra ENCIMA del foco:
  // tapar el objetivo es malo, pero dejar "Entendido" fuera de la pantalla es
  // peor, porque en un teléfono no hay Escape que lo rescate.
  // `window` en el render es seguro aquí y solo aquí: este componente nunca
  // llega al servidor, porque el controlador no lo monta hasta tener la
  // respuesta de `/me/settings`, que solo puede llegar en cliente.
  const alto = window.innerHeight;
  const aireAbajo = alto - (recorte.top + recorte.height) - MARGEN;
  const aireArriba = recorte.top - MARGEN;
  const posicion: CSSProperties =
    Math.max(aireAbajo, aireArriba) < ALTO_BOCADILLO
      ? { top: 0, bottom: 0, alignItems: "center" }
      : aireAbajo >= aireArriba
        ? { top: recorte.top + recorte.height + MARGEN }
        : { bottom: alto - recorte.top + MARGEN };

  return (
    <OverlayPortal>
      <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label={tip.titulo}>
        {/* El hueco: la sombra gigante pinta todo lo que queda fuera. */}
        <div
          aria-hidden
          className="absolute"
          style={{
            top: recorte.top,
            left: recorte.left,
            width: recorte.width,
            height: recorte.height,
            borderRadius: recorte.radio,
            boxShadow: "0 0 0 9999px var(--scrim)",
            pointerEvents: "none",
          }}
        />

        <div
          className="absolute inset-x-0 flex justify-center px-4"
          style={{ ...posicion, animation: "dots-pop-in 0.35s ease-out both" }}
        >
          <div
            className="flex w-full max-w-sm flex-col items-center gap-2 rounded-2xl p-4 text-center"
            style={{
              background: "var(--surface)",
              border: "2px solid var(--border)",
              boxShadow: "0 8px 24px rgba(0,0,0,0.18)",
            }}
          >
            <Doty pose={tip.pose} size="pista" />
            <h2 className="font-display text-lg font-extrabold text-foreground">{tip.titulo}</h2>
            <p className="text-sm font-semibold text-(--muted)">{tip.frase}</p>
            <button
              ref={botonRef}
              type="button"
              onClick={onEntendido}
              className="dots-pressable mt-1 w-full rounded-2xl px-6 py-3 text-base font-black transition-transform duration-150 active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--accent)"
              style={{ background: "var(--accent)", color: "var(--accent-contrast)" }}
            >
              Entendido
            </button>
            {total > 1 && (
              <span className="text-xs font-extrabold text-(--muted)">
                Pista {indice} de {total}
              </span>
            )}
          </div>
        </div>
      </div>
    </OverlayPortal>
  );
}
