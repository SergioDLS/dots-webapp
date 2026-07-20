"use client";

import Confetti from "@/components/ui/confetti/confetti";
import Doty from "@/components/ui/doty/doty";
import UIButton from "@/components/ui/button/button";
import { PanelWrapper, SectionLabel } from "@/components/lesson/panel";
import type { CheckpointResult as CheckpointResultData } from "@/services/lessons.service";

interface Props {
  result: CheckpointResultData;
  onRetry: () => void;
  onExit: () => void;
}

export default function CheckpointResult({ result, onRetry, onExit }: Props) {
  const pct = result.total > 0 ? Math.round((result.correct / result.total) * 100) : 0;

  if (result.passed) {
    return (
      <div className="flex flex-col gap-4 w-full">
        <PanelWrapper>
          <Confetti burstKey="checkpoint-passed" count={50} />
          <SectionLabel emoji="🏆">¡Sección superada!</SectionLabel>
          <Doty pose="17" size="small" animation="cheer" say="¡Eres increíble!" />
          <p className="font-display text-2xl font-extrabold text-center">
            {result.correct} de {result.total} correctas ({pct}%)
          </p>
          {result.xpGained > 0 && (
            <span
              className="px-4 py-1.5 rounded-full font-bold text-sm"
              style={{
                background: "color-mix(in srgb, var(--accent) 15%, transparent)",
                color: "var(--accent)",
              }}
            >
              +{result.xpGained} XP
            </span>
          )}
          <p className="text-center text-sm" style={{ color: "var(--muted)" }}>
            Saltaste la sección completa. El camino sigue más adelante.
          </p>
        </PanelWrapper>
        <UIButton tone="accent" onClick={onExit} fullWidth>
          Continuar el camino
        </UIButton>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 w-full">
      <PanelWrapper>
        <SectionLabel emoji="🏁">Esta vez no fue</SectionLabel>
        <Doty pose="05" size="small" animation="sad" say="¡Casi! Sigamos practicando." />
        <p className="font-display text-2xl font-extrabold text-center">
          {result.correct} de {result.total} correctas ({pct}%)
        </p>
        <p className="text-center text-sm" style={{ color: "var(--muted)" }}>
          Necesitas 85% para saltar la sección. Puedes practicar las lecciones o
          intentarlo de nuevo (máximo 3 intentos por día).
        </p>
      </PanelWrapper>
      <div className="flex gap-3 w-full">
        <UIButton tone="neutral" onClick={onExit}>
          Ir a practicar
        </UIButton>
        <UIButton tone="accent" onClick={onRetry} fullWidth>
          Intentar de nuevo
        </UIButton>
      </div>
    </div>
  );
}
