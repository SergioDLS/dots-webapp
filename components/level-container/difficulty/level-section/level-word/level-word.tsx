"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import WordImg from "@/components/ui/word-img/word-img";
import UIButton from "@/components/ui/button/button";
import Modal from "@/components/ui/modal/modal";

const profile =
  typeof window !== "undefined" ? localStorage.getItem("profile") : null;

type LevelWordProps = {
  on_construction: number;
  id: number;
  color?: string;
  name: string;
  src: string;
  animation?: string;
  available: boolean;
  levels_left: number;
  progress: number;
  animationIndex?: number;
};

const colorClassMap: Record<string, string> = {
  pink: "border-pink-400 shadow-[0_15px_40px_rgba(244,114,182,0.4)]",
  orangered: "border-orange-500 shadow-[0_15px_40px_rgba(249,115,22,0.4)]",
  blue: "border-blue-700 shadow-[0_15px_40px_rgba(29,78,216,0.4)]",
  pale_blue: "border-sky-300 shadow-[0_15px_40px_rgba(125,211,252,0.4)]",
  opal: "border-cyan-300 shadow-[0_15px_40px_rgba(94,234,212,0.4)]",
  orange: "border-amber-400 shadow-[0_15px_40px_rgba(251,191,36,0.4)]",
  pale_green: "border-lime-300 shadow-[0_15px_40px_rgba(190,242,100,0.4)]",
  yellow: "border-yellow-400 shadow-[0_15px_40px_rgba(250,204,21,0.4)]",
  green: "border-emerald-400 shadow-[0_15px_40px_rgba(52,211,153,0.4)]",
  disabled: "border-gray-300 shadow-[0_15px_40px_rgba(209,213,219,0.4)]",
};

export default function LevelWord({
  on_construction,
  id,
  color,
  name,
  src,
  available,
  levels_left,
  progress,
  animationIndex,
}: LevelWordProps) {
  const [open, setOpen] = useState(false);
  const canOpen = on_construction !== 1 || profile === "1";

  const goTo = (path: string) => {
    window.location.replace(`${path}?id=${id}`);
  };

  // compute a deterministic color if one wasn't supplied
  const resolvedColor =
    color ??
    (() => {
      const keys = Object.keys(colorClassMap) as Array<
        keyof typeof colorClassMap
      >;
      const idx = ((id * 2654435761) >>> 0) % keys.length;
      return keys[idx];
    })();

  // const colorClass = colorClassMap[resolvedColor] ?? colorClassMap.blue;
  const colorHexMap: Record<string, string> = {
    pink: "#F472B6",
    orangered: "#F97316",
    blue: "#1D4ED8",
    pale_blue: "#7DD3FC",
    opal: "#5EEAD4",
    orange: "#FBBF24",
    pale_green: "#BEF264",
    yellow: "#FACC15",
    green: "#34D399",
    disabled: "#9CA3AF",
  };
  const cssColor = colorHexMap[resolvedColor] ?? colorHexMap.blue;

  // circular progress params
  const R = 30; // radius
  const stroke = 6;
  const normalizedRadius = R - stroke * 0.5;
  const circumference = 2 * Math.PI * normalizedRadius;
  const progressClamped = Math.max(0, Math.min(100, Math.round(progress)));
  const dashOffset = circumference * (1 - progressClamped / 100);

  const [animatedOffset, setAnimatedOffset] = useState<number>(circumference);
  const [mounted, setMounted] = useState(false);

  // animate progress ring on mount/when progress changes
  useEffect(() => {
    // entry animation for node (staggered by animationIndex)
    const entryDelay = (animationIndex ?? 0) * 80 + 20;
    const entryTimer = setTimeout(() => setMounted(true), entryDelay);

    // animate circle progress after a short delay so entry anim is visible
    const t = setTimeout(() => setAnimatedOffset(dashOffset), entryDelay + 80);

    return () => {
      clearTimeout(t);
      clearTimeout(entryTimer);
    };
  }, [dashOffset, circumference, animationIndex]);

  return (
    <div
      className="flex flex-col items-center justify-center gap-2"
      onClick={() => available && canOpen && setOpen(true)}
    >
      {open && (
        <Modal click={() => setOpen(false)} tone="neutral">
          <span className="mb-2 text-2xl font-semibold text-foreground">
            {name}
          </span>
          <WordImg size="medium" src={src} opacity={1} customClass="mx-auto" />
          <div className="mt-4 flex w-full max-w-xs flex-col gap-2">
            <UIButton fullWidth tone="accent" onClick={() => goTo("/practice")}>
              Practice
            </UIButton>
            <UIButton fullWidth tone="accent" onClick={() => goTo("/spelling")}>
              Spelling
            </UIButton>
          </div>
        </Modal>
      )}
      <div
        className={`relative flex flex-col items-center justify-center gap-2 ${available ? "cursor-pointer" : "cursor-not-allowed"}`}
        style={{
          opacity: mounted ? 1 : 0,
          transform: mounted ? "translateY(0)" : "translateY(-6px)",
          transition: "opacity 260ms ease, transform 260ms ease",
          transitionDelay: `${(animationIndex ?? 0) * 60}ms`,
        }}
      >
        <div className="relative z-10 w-20 h-20">
          <svg
            viewBox={`0 0 ${R * 2} ${R * 2}`}
            className="absolute inset-0 w-full h-full block"
            style={{ color: cssColor }}
          >
            <defs>
              <filter
                id={`glass-${id}`}
                x="-50%"
                y="-50%"
                width="200%"
                height="200%"
              >
                <feGaussianBlur
                  in="SourceGraphic"
                  stdDeviation="6"
                  result="blur"
                />
                <feBlend in="SourceGraphic" in2="blur" mode="normal" />
              </filter>
            </defs>
            {/* background circle (glass) */}
            <circle
              cx={R}
              cy={R}
              r={normalizedRadius}
              fill="rgba(255,255,255,0.04)"
              stroke="rgba(255,255,255,0.06)"
              strokeWidth={1}
              filter={`url(#glass-${id})`}
            />
            {/* progress ring */}
            <circle
              stroke="rgba(255,255,255,0.12)"
              fill="transparent"
              strokeWidth={stroke}
              r={normalizedRadius}
              cx={R}
              cy={R}
              className="opacity-40"
            />
            <circle
              stroke="currentColor"
              fill="transparent"
              strokeWidth={stroke}
              strokeLinecap="round"
              strokeDasharray={`${circumference} ${circumference}`}
              strokeDashoffset={animatedOffset}
              r={normalizedRadius}
              cx={R}
              cy={R}
              style={{
                color: resolvedColor === "disabled" ? "#9CA3AF" : undefined,
                transition: "stroke-dashoffset 700ms cubic-bezier(.2,.9,.2,1)",
              }}
            />
          </svg>
          <div className="relative z-20 w-full h-full rounded-full overflow-hidden p-0.5 bg-white/5">
            <WordImg
              size="medium"
              src={src}
              opacity={1}
              customClass="mx-auto"
            />
          </div>

          {!available && (
            <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-1 bg-black/30 backdrop-blur-sm rounded-full">
              <Image
                src="/images/Lock_icon.png"
                alt="Locked"
                width={36}
                height={36}
                className="w-9"
              />
              <span className="text-xs text-foreground">{levels_left}</span>
            </div>
          )}
        </div>

        {/* floating title that slightly overlaps the node and protrudes */}
        <div className="relative -mt-3 z-20">
          <div
            className={`px-3 py-1 rounded-full bg-(--surface) border border-(--border) shadow-md text-sm font-semibold text-center ${progress > 99 ? "text-green-500" : "text-foreground"}`}
          >
            {name}
          </div>
        </div>
      </div>
    </div>
  );
}
