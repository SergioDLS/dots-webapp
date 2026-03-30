"use client";

import React from "react";
import BackDrop from "../BackDrop/BackDrop";

interface ModalProps {
  children: React.ReactNode;
  click?: () => void;
  tone?: "accent" | "primary" | "neutral";
}

const toneClasses: Record<NonNullable<ModalProps["tone"]>, string> = {
  accent: "border-(--accent)",
  primary: "border-(--primary)",
  neutral: "border-(--border)",
};

export default function Modal({ children, click, tone = "accent" }: ModalProps) {
  const toneClass = toneClasses[tone];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <BackDrop click={click} />
      <div
        className={`relative z-10 w-full max-w-lg rounded-2xl border bg-(--surface) p-6 shadow-2xl ${toneClass}`}
      >
        {children}
      </div>
    </div>
  );
}
