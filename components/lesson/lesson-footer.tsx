"use client";

import UIButton from "@/components/ui/button/button";

interface LessonFooterProps {
  confirmLabel: string;
  confirmDisabled?: boolean;
  onExit: () => void;
  onConfirm: () => void;
  /** End screens: single full-width CTA, no exit button */
  finalMode?: boolean;
}

export default function LessonFooter({
  confirmLabel,
  confirmDisabled = false,
  onExit,
  onConfirm,
  finalMode = false,
}: LessonFooterProps) {
  if (finalMode) {
    return (
      <div
        className="w-full"
        style={{ animation: "dots-pop-in 0.4s ease-out both" }}
      >
        <UIButton tone="accent" onClick={onConfirm} fullWidth>
          {confirmLabel}
        </UIButton>
      </div>
    );
  }
  return (
    <div
      className="flex gap-3 w-full"
      style={{ animation: "dots-slide-up 0.3s ease-out 0.1s both" }}
    >
      <UIButton tone="neutral" onClick={onExit}>
        ← Exit
      </UIButton>
      <UIButton
        tone="accent"
        onClick={onConfirm}
        disabled={confirmDisabled}
        fullWidth
      >
        {confirmLabel}
      </UIButton>
    </div>
  );
}
