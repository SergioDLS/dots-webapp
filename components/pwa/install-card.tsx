"use client";

import { useCallback, useState } from "react";

import InstallSheet from "@/components/pwa/install-sheet";
import Doty from "@/components/ui/doty/doty";
import { Icon } from "@/components/ui/icon";
import { useInstallPrompt } from "@/hooks/use-install-prompt";

/**
 * "Instala dots" en el Perfil: la puerta que sigue ahí cuando la invitación
 * automática ya se gastó, o para quien la cerró y se arrepintió.
 *
 * Desaparece sola en cuanto la app está instalada —ahí no hay nada que
 * ofrecer— y también antes de hidratar, para no pintar una tarjeta que se
 * quita medio segundo después.
 *
 * Al revés que `install-watch`, esta NO mira la marca ni el tamaño de la
 * pantalla: si el usuario ha venido hasta aquí a buscarla, no es una
 * interrupción, es lo que pidió. En escritorio enseña el guion de escritorio
 * en vez de esconderse.
 */
export default function InstallCard() {
  const { listo, instalada, guion, instalar } = useInstallPrompt();
  const [abierta, setAbierta] = useState(false);

  const cerrar = useCallback(() => setAbierta(false), []);
  const aceptar = useCallback(() => {
    setAbierta(false);
    void instalar();
  }, [instalar]);

  if (!listo || instalada) return null;

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-xs font-bold uppercase tracking-widest text-(--muted)">La app</h2>
      <button
        type="button"
        onClick={() => setAbierta(true)}
        className="dots-card flex items-center gap-3 p-3 text-left transition-transform duration-150 active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--accent)"
      >
        <Doty pose="en-celular" size="chip" />
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="font-display text-base font-extrabold text-foreground">
            Instala dots
          </span>
          <span className="text-xs font-semibold text-(--muted)">
            Entro en tu pantalla de inicio y abro a pantalla completa.
          </span>
        </span>
        <span className="shrink-0 text-(--muted)">
          <Icon name="derecha" size={16} mono />
        </span>
      </button>

      {abierta && (
        <InstallSheet guion={guion} onInstalar={aceptar} onCerrar={cerrar} />
      )}
    </section>
  );
}
