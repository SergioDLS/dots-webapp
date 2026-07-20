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
}

/** Generic end-of-lesson screen (Doty + confetti + reward chips + CTA) */
export default function ResultScreen({
  mode,
  reward = null,
  subtext,
  ctaLabel,
  onCta,
}: ResultScreenProps) {
  const isGameover = mode === "gameover";
  const emoji   = mode === "perfect" ? "🌟" : isGameover ? "💔" : "🎉";
  const title   = mode === "perfect" ? "Perfect!" : isGameover ? "Oh no!" : "Success!";
  const defaultSubtext = mode === "perfect" ? "No mistakes! DOTY is SO proud of you!" : isGameover ? "You ran out of hearts!" : "You completed the level!";
  const dotySays = mode === "perfect" ? "WOW! You're a star!" : isGameover ? "Let's try again together!" : "I knew you could do it!";
  const gradient = isGameover
    ? "linear-gradient(135deg, #f43f5e, #ef4444)"
    : "linear-gradient(135deg, var(--accent), #fbbf24)";
  return (
    <div className="flex flex-col gap-5 w-full">
      <PanelWrapper>
        {!isGameover && <Confetti burstKey={mode} count={40} />}
        <SectionLabel emoji={emoji}>{title}</SectionLabel>
        <Doty
          pose={isGameover ? "05" : mode === "perfect" ? "17" : "02"}
          size="small"
          animation={isGameover ? "sad" : "cheer"}
          say={dotySays}
        />
        <p
          className="font-display text-2xl font-extrabold text-center"
          style={{
            background: gradient,
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
          }}
        >
          {subtext ?? defaultSubtext}
        </p>
        <RewardPanel reward={reward} />
      </PanelWrapper>
      <div
        className="w-full"
        style={{ animation: "dots-pop-in 0.4s ease-out both" }}
      >
        <UIButton tone="accent" onClick={onCta} fullWidth>
          {ctaLabel ?? (isGameover ? "Try again" : "Continue")}
        </UIButton>
      </div>
    </div>
  );
}
