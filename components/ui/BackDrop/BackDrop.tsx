"use client";

import React from "react";

interface BackDropProps {
  click?: () => void;
}

export default function BackDrop({ click }: BackDropProps) {
  return (
    <div
      onClick={click}
      className="fixed inset-0 -z-10 bg-black/40 backdrop-blur-sm transition-opacity"
    />
  );
}
