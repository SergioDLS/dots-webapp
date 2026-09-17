"use client";

import Doty from "@/components/ui/doty/doty";

/**
 * Pantalla 1 del primer inicio (spec §7.2): Doty se presenta. El copy es
 * literal del spec y de la tabla de voz de docs/brand/doty-identity.md.
 */
interface Props {
  onNext: () => void;
}

export default function WelcomeHello({ onNext }: Props) {
  return (
    <div className="flex flex-col items-center gap-5 text-center">
      <Doty pose="saludando" size="bienvenida" animation="wave" say="¡Hola! Soy Doty. Tu coach de inglés." />
      <h1 className="font-display text-3xl font-extrabold text-foreground">Prometo no regañarte.</h1>
      <p className="max-w-sm text-base font-semibold text-(--muted)">
        Ni cuando te equivoques. Sobre todo cuando te equivoques. Vamos a armar tu dots en tres toques.
      </p>
      <button
        type="button"
        onClick={onNext}
        className="dots-pressable mt-2 w-full max-w-xs rounded-2xl px-6 py-3.5 text-base font-black transition-transform duration-150 active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--accent)"
        style={{ background: "var(--accent)", color: "var(--accent-contrast)" }}
      >
        Vamos
      </button>
    </div>
  );
}
