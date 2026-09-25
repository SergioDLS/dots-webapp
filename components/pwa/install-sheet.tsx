"use client";

import { useEffect, useRef } from "react";

import Doty from "@/components/ui/doty/doty";
import UIButton from "@/components/ui/button/button";
import OverlayPortal from "@/components/ui/overlay-portal";
import { Icon } from "@/components/ui/icon";
import { GUIONES, type Guion } from "@/lib/install-prompt";
import { bloquearScroll } from "@/lib/scroll-lock";

/**
 * La invitación a instalar dots: Doty pidiendo el favor y, debajo, los toques
 * exactos que hay que dar en ESTE navegador.
 *
 * Solo pinta. Quién la ve, cuándo y cuántas veces lo decide
 * `components/pwa/install-watch.tsx` con `lib/install-prompt.ts`.
 *
 * Es un diálogo de verdad —bloquea el scroll y atrapa la atención— al revés
 * que el aviso de rival, que es una tarjeta que pasa sola. Aquí hace falta:
 * el usuario tiene que mirar los pasos mientras toca botones del sistema, y
 * si el fondo se mueve pierde el sitio.
 *
 * RN-safe (regla 2): todo se resuelve con toques. Escape existe porque en
 * escritorio se espera, pero no es la única salida — hay botón de cerrar,
 * "Ahora no" y el fondo.
 */
interface Props {
  guion: Guion;
  /** Solo en el guion "nativo": abre el diálogo del sistema. */
  onInstalar: () => void;
  /** Cerrar sin instalar. Consume una de las dos oportunidades. */
  onCerrar: () => void;
}

export default function InstallSheet({ guion, onInstalar, onCerrar }: Props) {
  const texto = GUIONES[guion];
  const nativo = guion === "nativo";
  const panelRef = useRef<HTMLDivElement>(null);

  // Foco al abrir, en su propio efecto y sin depender de `onCerrar`: esa
  // función es nueva en cada render del controlador, y robaría el foco en
  // cada repintado en vez de moverlo una sola vez (mismo motivo que en
  // components/profile/settings-sheet.tsx).
  useEffect(() => {
    panelRef.current?.focus();
  }, []);

  useEffect(() => {
    const alTeclear = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCerrar();
    };
    document.addEventListener("keydown", alTeclear);
    const soltar = bloquearScroll();
    return () => {
      document.removeEventListener("keydown", alTeclear);
      soltar();
    };
  }, [onCerrar]);

  return (
    <OverlayPortal>
      <div className="fixed inset-0 z-50 flex items-end justify-center md:items-center">
        <div
          aria-hidden
          onClick={onCerrar}
          className="absolute inset-0"
          style={{ background: "var(--scrim)" }}
        />

        <div
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby="install-titulo"
          tabIndex={-1}
          className="relative z-10 flex max-h-[88svh] w-full flex-col overflow-y-auto rounded-t-3xl bg-(--surface) px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-5 [animation:dots-slide-up_.28s_ease-out_both] md:max-w-md md:rounded-3xl md:pb-5"
        >
          <button
            type="button"
            onClick={onCerrar}
            aria-label="Cerrar"
            className="absolute right-4 top-4 rounded-full p-2 text-(--muted) transition-transform duration-150 active:scale-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--accent)"
          >
            <Icon name="cruz" size={18} mono />
          </button>

          <div className="flex items-center gap-3 pr-8">
            <Doty pose={texto.pose} size="pista" animation="bob" />
            <div className="flex min-w-0 flex-col gap-1">
              <h2
                id="install-titulo"
                className="font-display text-xl font-extrabold leading-tight text-foreground"
              >
                {texto.titulo}
              </h2>
              <p className="text-sm font-semibold text-(--muted)">{texto.frase}</p>
            </div>
          </div>

          {texto.pasos.length > 0 && (
            <ol className="mt-4 flex flex-col gap-2">
              {texto.pasos.map((paso, i) => (
                <li
                  key={paso.texto}
                  className="flex items-center gap-3 rounded-2xl px-3 py-2.5"
                  style={{ background: "var(--surface-2)" }}
                >
                  <span
                    aria-hidden
                    className="flex size-7 shrink-0 items-center justify-center rounded-full font-display text-sm font-extrabold"
                    style={{ background: "var(--accent)", color: "var(--accent-contrast)" }}
                  >
                    {i + 1}
                  </span>
                  <span className="min-w-0 flex-1 text-sm font-bold text-foreground">
                    {paso.texto}
                  </span>
                  {/* El glifo del sistema va al final y no dentro de la
                      frase: así se puede mirar la columna de símbolos sin
                      leer, que es lo que hace quien tiene el menú abierto. */}
                  {paso.icono && (
                    <span className="shrink-0">
                      <Icon name={paso.icono} size={22} />
                    </span>
                  )}
                </li>
              ))}
            </ol>
          )}

          <div className="mt-5 flex flex-col gap-1">
            <UIButton tone="accent" onClick={nativo ? onInstalar : onCerrar} fullWidth>
              {texto.cta}
            </UIButton>
            {/* Solo donde el botón de arriba instala de verdad hace falta una
                salida aparte: en los guiones con pasos, el CTA ya es "cerrar"
                y dos botones que hacen lo mismo son ruido. */}
            {nativo && (
              <UIButton tone="ghost" onClick={onCerrar} fullWidth>
                Ahora no
              </UIButton>
            )}
          </div>
        </div>
      </div>
    </OverlayPortal>
  );
}
