"use client";

import React from "react";
import UIButton, { ButtonTone } from "../button/button";

interface ConfirmButtonsProps {
  name1: React.ReactNode;
  name2: React.ReactNode;
  click1?: () => void;
  click2?: () => void;
  btnClass1?: string;
  btnClass2?: string;
  tone1?: ButtonTone;
  tone2?: ButtonTone;
  className?: string;
}

export default function ConfirmButtons({
  name1,
  name2,
  click1,
  click2,
  btnClass1 = "",
  btnClass2 = "",
  tone1 = "neutral",
  tone2 = "neutral",
  className = "",
}: ConfirmButtonsProps) {
  return (
    <div
      className={`flex h-60 w-full items-center justify-around rounded-b-2xl border-[0.3rem] border-(--primary) px-12 py-14 ${className}`}
    >
      <UIButton
        onClick={click1}
        tone={tone1}
        fullWidth
        className={`flex-1 max-w-xs ${btnClass1}`}
      >
        {name1}
      </UIButton>
      <UIButton
        onClick={click2}
        tone={tone2}
        fullWidth
        className={`flex-1 max-w-xs ${btnClass2}`}
      >
        {name2}
      </UIButton>
    </div>
  );
}
