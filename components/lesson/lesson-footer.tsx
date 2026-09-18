"use client";

import UIButton from "@/components/ui/button/button";
import ExitFlow from "@/components/ui/exit-flow/exit-flow";

interface LessonFooterProps {
  confirmLabel: string;
  confirmDisabled?: boolean;
  onExit: () => void;
  /**
   * Qué se pierde al salir, en una frase, o `null` si no hay nada que perder
   * (la portada de una lección). Obligatorio y sin valor por defecto: este pie
   * lo comparten cinco flujos —práctica, examen, repaso, gramática y
   * nivelación— y cada uno se deja cosas distintas. Un texto genérico aquí
   * seria un aviso que no avisa de nada.
   */
  avisoSalida: string | null;
  onConfirm: () => void;
  /** End screens: single full-width CTA, no exit button */
  finalMode?: boolean;
}

export default function LessonFooter({
  confirmLabel,
  confirmDisabled = false,
  onExit,
  avisoSalida,
  onConfirm,
  finalMode = false,
}: LessonFooterProps) {
  if (finalMode) {
    return (
      <div
        className="w-full pb-[env(safe-area-inset-bottom)]"
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
      className="flex gap-3 w-full pb-[env(safe-area-inset-bottom)]"
      style={{ animation: "dots-slide-up 0.3s ease-out 0.1s both" }}
    >
      <ExitFlow onExit={onExit} aviso={avisoSalida} />
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
