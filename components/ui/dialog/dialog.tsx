"use client";

import React from "react";
import Doty from "../doty/doty";
import UIButton from "../button/button";

type DialogTone = "success" | "warning" | "error" | "info" | "";

interface AlertDialogProps {
  text?: React.ReactNode;
  title?: string;
  accept?: () => void;
  cancel?: () => void;
  accept_text?: string;
  cancel_text?: string;
  type?: DialogTone;
  show: boolean;
  content?: React.ReactNode;
}

const toneConfig: Record<DialogTone, { fallbackTitle: string; dotyPose?: string; headerBg: string; border: string }> = {
  success: {
    fallbackTitle: "Great!",
    dotyPose: "02",
    headerBg: "bg-green-100 text-green-900",
    border: "border-green-200",
  },
  warning: {
    fallbackTitle: "Warning!",
    dotyPose: "07",
    headerBg: "bg-amber-100 text-amber-900",
    border: "border-amber-200",
  },
  error: {
    fallbackTitle: "Oh no!",
    dotyPose: "05",
    headerBg: "bg-red-100 text-red-900",
    border: "border-red-200",
  },
  info: {
    fallbackTitle: "Heads up",
    dotyPose: "17",
    headerBg: "bg-blue-100 text-blue-900",
    border: "border-blue-200",
  },
  "": {
    fallbackTitle: "",
    dotyPose: undefined,
    headerBg: "bg-(--surface)",
    border: "border-(--border)",
  },
};

export default function AlertDialog({
  text,
  title = "",
  accept,
  cancel,
  accept_text = "",
  cancel_text = "",
  type = "",
  show,
  content,
}: AlertDialogProps) {
  if (!show) return null;

  const { fallbackTitle, dotyPose, headerBg, border } = toneConfig[type] ?? toneConfig[""];
  const heading = title || fallbackTitle;
  const dialogId = "alert-dialog";
  const descriptionId = `${dialogId}-description`;

  return (
  <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div
        className="absolute inset-0 bg-black/35 backdrop-blur-sm"
        onClick={cancel}
        aria-hidden="true"
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={heading ? `${dialogId}-title` : undefined}
        aria-describedby={descriptionId}
        className={`relative z-10 w-full max-w-lg overflow-hidden rounded-2xl border bg-(--surface) shadow-2xl ring-1 ring-black/5 ${border}`}
      >
        {(heading || type) && (
          <div className={`flex items-center gap-3 border-b px-6 py-4 ${headerBg}`}>
            {heading ? (
              <h3 id={`${dialogId}-title`} className="text-lg font-semibold leading-tight">
                {heading}
              </h3>
            ) : null}
          </div>
        )}

        <div className="flex items-start gap-4 px-6 py-6">
          {dotyPose ? <Doty pose={dotyPose} size="smaller" /> : null}
          <div className="space-y-3 text-sm">
            {text ? (
              <p id={descriptionId} className="text-base text-foreground">
                {text}
              </p>
            ) : (
              <p id={descriptionId} className="text-base text-foreground" />
            )}
            {content ? <div className="text-(--muted)">{content}</div> : null}
          </div>
        </div>

        {(cancel_text || (accept_text && accept)) && (
          <div className="flex justify-end gap-3 border-t px-6 py-4">
            {cancel_text ? (
              <UIButton tone="neutral" onClick={cancel}>
                {cancel_text}
              </UIButton>
            ) : null}
            {accept_text && accept ? (
              <UIButton tone="accent" onClick={accept}>
                {accept_text}
              </UIButton>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}
