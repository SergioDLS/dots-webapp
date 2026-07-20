"use client";

import Doty from "@/components/ui/doty/doty";
import { PanelWrapper, SectionLabel } from "@/components/lesson/panel";

interface Props {
  onSkip: () => void;
  onStartTest: () => void;
  busy: boolean;
}

/** First screen of onboarding: start from zero or take the placement test. */
export default function WelcomeScreen({ onSkip, onStartTest, busy }: Props) {
  const card =
    "w-full flex flex-col items-start gap-1 rounded-2xl px-5 py-4 text-left transition-all duration-200 cursor-pointer active:scale-[.98] disabled:opacity-50";
  return (
    <PanelWrapper>
      <SectionLabel emoji="👋">¡Bienvenido a Dots!</SectionLabel>
      <Doty pose="17" size="small" animation="cheer" say="¡Hola! Soy Doty." />
      <p className="text-center text-sm" style={{ color: "var(--muted)" }}>
        Antes de empezar, cuéntanos cuánto inglés sabes para llevarte al punto
        exacto del camino.
      </p>
      <div className="flex flex-col gap-3 w-full">
        <button
          className={card}
          style={{
            background: "color-mix(in srgb, var(--accent) 10%, var(--surface))",
            border: "2px solid var(--accent)",
          }}
          onClick={onSkip}
          disabled={busy}
        >
          <span className="font-display font-extrabold text-lg">
            🌱 Empiezo desde cero
          </span>
          <span className="text-sm" style={{ color: "var(--muted)" }}>
            Arranca en los primeros pasos: saludos, sonidos y frases básicas.
          </span>
        </button>
        <button
          className={card}
          style={{
            background: "var(--surface)",
            border: "2px solid var(--border)",
          }}
          onClick={onStartTest}
          disabled={busy}
        >
          <span className="font-display font-extrabold text-lg">
            🚀 Ya sé algo de inglés
          </span>
          <span className="text-sm" style={{ color: "var(--muted)" }}>
            Haz una prueba corta (5-14 preguntas) y salta lo que ya dominas.
          </span>
        </button>
      </div>
    </PanelWrapper>
  );
}
