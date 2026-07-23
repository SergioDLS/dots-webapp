"use client";

import Doty from "@/components/ui/doty/doty";
import Confetti from "@/components/ui/confetti/confetti";
import UIButton from "@/components/ui/button/button";
import { PanelWrapper, SectionLabel } from "@/components/lesson/panel";
import RewardPanel from "@/components/lesson/reward-panel";
import type { ProgressReward } from "@/services/engagement.service";

export type ResultMode = "perfect" | "finished" | "gameover";

interface ResultScreenProps {
  mode: ResultMode;
  reward?: ProgressReward | null;
  /** Overrides the per-mode default subtext */
  subtext?: string;
  /** Overrides the per-mode default CTA label */
  ctaLabel?: string;
  onCta: () => void;
  /** Optional second action rendered under the CTA (ghost tone). */
  secondaryLabel?: string;
  onSecondary?: () => void;
}

/**
 * Pantalla de fin de lección (Doty + confeti + chips de recompensa + CTA).
 * El contenido se revela por etapas para dar el "golpe de dopamina":
 * título → Doty → mensaje → recompensa (chips escalonados) → botón.
 */
export default function ResultScreen({
  mode,
  reward = null,
  subtext,
  ctaLabel,
  onCta,
  secondaryLabel,
  onSecondary,
}: ResultScreenProps) {
  const isGameover = mode === "gameover";
  const emoji = mode === "perfect" ? "🌟" : isGameover ? "💔" : "🎉";
  const title =
    mode === "perfect" ? "¡Perfecto!" : isGameover ? "¡Oh no!" : "¡Muy bien!";
  const defaultSubtext =
    mode === "perfect"
      ? "¡Sin errores! Doty está orgullosísimo de ti."
      : isGameover
        ? "Te quedaste sin corazones."
        : "¡Completaste la lección!";
  const dotySays =
    mode === "perfect"
      ? "¡Guau! ¡Eres una estrella!"
      : isGameover
        ? "¡Lo intentamos de nuevo juntos!"
        : "¡Sabía que podías!";
  const gradient = isGameover
    ? "linear-gradient(135deg, #f43f5e, #ef4444)"
    : "linear-gradient(135deg, var(--accent), #fbbf24)";

  return (
    <div className="flex flex-col gap-5 w-full">
      <PanelWrapper>
        {!isGameover && <Confetti burstKey={mode} count={40} />}
        <div style={{ animation: "dots-pop-in 0.4s ease-out both" }}>
          <SectionLabel emoji={emoji}>{title}</SectionLabel>
        </div>
        <div style={{ animation: "dots-pop-in 0.45s ease-out 0.15s both" }}>
          <Doty
            pose={isGameover ? "05" : mode === "perfect" ? "17" : "02"}
            size="small"
            animation={isGameover ? "sad" : "cheer"}
            say={dotySays}
          />
        </div>
        <p
          className="font-display text-2xl font-extrabold text-center"
          style={{
            background: gradient,
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            animation: "dots-pop-in 0.4s ease-out 0.3s both",
          }}
        >
          {subtext ?? defaultSubtext}
        </p>
        <RewardPanel reward={reward} />
      </PanelWrapper>
      <div
        className="flex flex-col gap-2"
        style={{ animation: "dots-pop-in 0.4s ease-out 0.55s both" }}
      >
        <UIButton tone="accent" onClick={onCta} fullWidth>
          {ctaLabel ?? (isGameover ? "Reintentar" : "Continuar")}
        </UIButton>
        {secondaryLabel && onSecondary && (
          <UIButton tone="ghost" onClick={onSecondary} fullWidth>
            {secondaryLabel}
          </UIButton>
        )}
      </div>
    </div>
  );
}
