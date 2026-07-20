"use client";

import Confetti from "@/components/ui/confetti/confetti";
import Doty from "@/components/ui/doty/doty";
import UIButton from "@/components/ui/button/button";
import { PanelWrapper, SectionLabel } from "@/components/lesson/panel";
import type { PlacementResult } from "@/services/placement.service";

interface Props {
  result: PlacementResult;
  onContinue: () => void;
}

export default function PlacementResultScreen({ result, onContinue }: Props) {
  return (
    <div className="flex flex-col gap-4 w-full">
      <PanelWrapper>
        <Confetti burstKey="placement-done" count={50} />
        <SectionLabel emoji="🧭">¡Prueba completada!</SectionLabel>
        <Doty pose="17" size="small" animation="cheer" say="¡Ya te conozco mejor!" />
        {result.startFromZero ? (
          <>
            <p className="font-display text-2xl font-extrabold text-center">
              Empezarás desde el principio
            </p>
            <p className="text-center text-sm" style={{ color: "var(--muted)" }}>
              ¡Perfecto para construir una base sólida! El camino arranca con
              los primeros pasos.
            </p>
          </>
        ) : (
          <>
            <p
              className="font-display text-2xl font-extrabold text-center"
              style={{
                background: "linear-gradient(135deg, var(--accent), #fbbf24)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              Empezarás en {result.placedAtDifficultyName}
            </p>
            <p className="text-center text-sm" style={{ color: "var(--muted)" }}>
              {result.skippedDifficulties === 1
                ? "Saltaste 1 nivel completo"
                : `Saltaste ${result.skippedDifficulties} niveles completos`}{" "}
              — el camino te espera justo donde lo necesitas. Si algo te parece
              muy fácil, cada sección tiene un checkpoint para saltarla.
            </p>
          </>
        )}
      </PanelWrapper>
      <UIButton tone="accent" onClick={onContinue} fullWidth>
        Ir a mi camino
      </UIButton>
    </div>
  );
}
