"use client";

import React from "react";
import Modal from "../modal/modal";
import UIButton from "../button/button";
import Doty from "../doty/doty";

export type AlertType = "Danger" | "Warning" | "Info" | "Success";

interface AlertConfig {
  type: AlertType;
  message: string;
  accept?: () => void;
  cancel?: () => void;
  click?: () => void;
}

interface AlertProps {
  show: boolean;
  config: AlertConfig;
}

const toneByType: Record<AlertType, { pose: string; title: string; tone: "accent" | "primary" | "neutral" }> = {
  Danger: { pose: "05", title: "Oh no!", tone: "accent" },
  Warning: { pose: "07", title: "Heads up", tone: "accent" },
  Info: { pose: "01", title: "Info", tone: "primary" },
  Success: { pose: "02", title: "Success!", tone: "primary" },
};

export default function Alert({ show, config }: AlertProps) {
  if (!show) return null;

  const { pose, title, tone } = toneByType[config.type];

  return (
    <Modal click={config.click} tone={tone}>
      <div className="flex flex-col items-center gap-4 text-center">
        <h1 className="text-2xl font-bold text-(--primary)">{title}</h1>
        <Doty pose={pose} size="small" customClass="animate-pulse" />
        <p className="text-sm text-(--muted)">{config.message}</p>
        <div className="flex w-full flex-col gap-2 sm:flex-row sm:justify-center">
          <UIButton tone={tone} fullWidth onClick={config.accept}>
            Accept
          </UIButton>
          {config.cancel ? (
            <UIButton tone="neutral" fullWidth onClick={config.cancel}>
              Cancel
            </UIButton>
          ) : null}
        </div>
      </div>
    </Modal>
  );
}
