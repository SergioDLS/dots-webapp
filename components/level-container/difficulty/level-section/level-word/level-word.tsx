"use client";

import React, { useState, useEffect, useRef } from "react";
import Image from "next/image";
import WordImg from "@/components/ui/word-img/word-img";

const profile =
  typeof window !== "undefined" ? localStorage.getItem("profile") : null;

type LevelWordProps = {
  on_construction: number;
  id: number;
  color?: string;
  name: string;
  src: string;
  animation?: string;
  available?: boolean;
  unlocked?: boolean;
  levels_left: number;
  progress: number;
  current?: boolean;
  animationIndex?: number;
  side?: "left" | "right";
};

const colorMap: Record<
  string,
  {
    bg: string;
    ring: string;
    accent: string;
    text: string;
    dark: { bg: string; ring: string; accent: string; text: string };
  }
> = {
  pink:       { bg: "#fce7f3", ring: "#f9a8d4", accent: "#ec4899", text: "#9d174d", dark: { bg: "#4a0e2e", ring: "#f472b6", accent: "#f472b6", text: "#fce7f3" } },
  orangered:  { bg: "#ffedd5", ring: "#fdba74", accent: "#f97316", text: "#9a3412", dark: { bg: "#451a03", ring: "#f97316", accent: "#fb923c", text: "#ffedd5" } },
  blue:       { bg: "#dbeafe", ring: "#93c5fd", accent: "#3b82f6", text: "#1e40af", dark: { bg: "#172554", ring: "#3b82f6", accent: "#60a5fa", text: "#dbeafe" } },
  pale_blue:  { bg: "#e0f2fe", ring: "#7dd3fc", accent: "#0ea5e9", text: "#075985", dark: { bg: "#0c4a6e", ring: "#38bdf8", accent: "#38bdf8", text: "#e0f2fe" } },
  opal:       { bg: "#ccfbf1", ring: "#5eead4", accent: "#14b8a6", text: "#134e4a", dark: { bg: "#134e4a", ring: "#2dd4bf", accent: "#2dd4bf", text: "#ccfbf1" } },
  orange:     { bg: "#fef3c7", ring: "#fde68a", accent: "#f59e0b", text: "#92400e", dark: { bg: "#451a03", ring: "#fbbf24", accent: "#fbbf24", text: "#fef3c7" } },
  pale_green: { bg: "#ecfccb", ring: "#d9f99d", accent: "#84cc16", text: "#3f6212", dark: { bg: "#1a2e05", ring: "#a3e635", accent: "#a3e635", text: "#ecfccb" } },
  yellow:     { bg: "#fef9c3", ring: "#fef08a", accent: "#eab308", text: "#713f12", dark: { bg: "#422006", ring: "#facc15", accent: "#facc15", text: "#fef9c3" } },
  green:      { bg: "#dcfce7", ring: "#86efac", accent: "#22c55e", text: "#14532d", dark: { bg: "#052e16", ring: "#4ade80", accent: "#4ade80", text: "#dcfce7" } },
  disabled:   { bg: "#f3f4f6", ring: "#e5e7eb", accent: "#9ca3af", text: "#6b7280", dark: { bg: "#1f2937", ring: "#374151", accent: "#6b7280", text: "#9ca3af" } },
};

/* ── Inject keyframes once ────────────────────────────────── */
if (typeof document !== "undefined") {
  const STYLE_ID = "__lw_kf2__";
  if (!document.getElementById(STYLE_ID)) {
    const s = document.createElement("style");
    s.id = STYLE_ID;
    s.textContent = `
      @keyframes lw-float {
        0%,100% { transform: translateY(0) scale(1); }
        50%     { transform: translateY(-6px) scale(1.05); }
      }
      @keyframes lw-pulse-ring {
        0%   { box-shadow: 0 0 0 0px var(--pulse-color, #3b82f6); }
        50%  { box-shadow: 0 0 0 8px transparent; }
        100% { box-shadow: 0 0 0 0px transparent; }
      }
      @keyframes lw-pop-in {
        0%   { transform: translateX(-50%) scale(0.3); opacity: 0; }
        60%  { transform: translateX(-50%) scale(1.08); opacity: 1; }
        100% { transform: translateX(-50%) scale(1);    opacity: 1; }
      }
      @keyframes lw-wiggle {
        0%,100% { transform: rotate(0deg); }
        25%     { transform: rotate(-3deg); }
        75%     { transform: rotate(3deg); }
      }
      @keyframes lw-star-spin {
        0%   { transform: scale(1)   rotate(0deg); }
        50%  { transform: scale(1.2) rotate(180deg); }
        100% { transform: scale(1)   rotate(360deg); }
      }
    `;
    document.head.appendChild(s);
  }
}

export default function LevelWord({
  on_construction,
  id,
  color,
  name,
  src,
  available,
  unlocked,
  levels_left,
  progress,
  current = false,
  animationIndex = 0,
}: LevelWordProps) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [isDark, setIsDark] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const canOpen = on_construction !== 1 || profile === "1";
  const isUnlocked = unlocked ?? available ?? true;
  const progressClamped = Math.max(0, Math.min(100, Math.round(progress)));
  const isDone = progressClamped >= 100;
  const isLocked = !isUnlocked;

  useEffect(() => {
    const check = () =>
      setIsDark(document.documentElement.classList.contains("dark"));
    check();
    const obs = new MutationObserver(check);
    obs.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), animationIndex * 100 + 50);
    return () => clearTimeout(t);
  }, [animationIndex]);

  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node))
        setOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open]);

  const resolvedKey = (() => {
    if (isLocked) return "disabled";
    if (color && colorMap[color]) return color;
    const keys = Object.keys(colorMap).filter((k) => k !== "disabled");
    return keys[((id * 2654435761) >>> 0) % keys.length];
  })();

  const c = colorMap[resolvedKey] ?? colorMap.blue;
  const accent = isDark ? c.dark.accent : c.accent;
  const ringColor = isDark ? c.dark.ring : c.ring;
  const txt = isDark ? c.dark.text : c.text;
  const bg = isDark ? c.dark.bg : c.bg;

  const displayName = String(name || "")
    .split(" ")
    .map((w) => (w.length ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ");

  const goTo = (path: string) => window.location.replace(`${path}?id=${id}`);

  /* ── Sizes ──────────────────────────────────────────────── */
  const CIRCLE = 112;
  const RING_W = 6;

  /* ── Progress ring (SVG) ────────────────────────────────── */
  const svgSize = CIRCLE + RING_W * 2 + 10; // breathing room
  const radius = CIRCLE / 2 + RING_W / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeOffset = circumference - (progressClamped / 100) * circumference;

  return (
    <div
      ref={wrapperRef}
      className="flex flex-col items-center gap-1.5"
      style={{
        animation: mounted
          ? `lw-pop-in 500ms cubic-bezier(.34,1.56,.64,1) ${animationIndex * 90}ms both`
          : "none",
        opacity: mounted ? undefined : 0,
        width: 156,
      }}
    >
      {/* ── Circular node ────────────────────────────────── */}
      <div
        className="relative flex items-center justify-center"
        style={{
          width: svgSize,
          height: svgSize,
          cursor: isUnlocked && canOpen ? "pointer" : "default",
          animation: current && !isLocked && !isDone
            ? `lw-float 2.5s ease-in-out ${(animationIndex % 3) * 0.4}s infinite`
            : "none",
        }}
        onClick={() => isUnlocked && canOpen && setOpen((v) => !v)}
        onMouseEnter={(e) => {
          if (isUnlocked && canOpen)
            (e.currentTarget as HTMLElement).style.transform = "scale(1.08)";
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLElement).style.transform = "";
        }}
        onMouseDown={(e) => {
          if (isUnlocked && canOpen)
            (e.currentTarget as HTMLElement).style.transform = "scale(0.94)";
        }}
        onMouseUp={(e) => {
          (e.currentTarget as HTMLElement).style.transform = "";
        }}
      >
        {/* Progress ring SVG */}
        <svg
          width={svgSize}
          height={svgSize}
          className="absolute inset-0"
          style={{ transform: "rotate(-90deg)" }}
        >
          {/* Background ring */}
          <circle
            cx={svgSize / 2}
            cy={svgSize / 2}
            r={radius}
            fill="none"
            stroke={isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.08)"}
            strokeWidth={RING_W}
          />
          {/* Progress arc */}
          {isUnlocked && progressClamped > 0 && (
            <circle
              cx={svgSize / 2}
              cy={svgSize / 2}
              r={radius}
              fill="none"
              stroke={isDone ? "#22c55e" : accent}
              strokeWidth={RING_W}
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={strokeOffset}
              style={{ transition: "stroke-dashoffset 1s ease-out" }}
            />
          )}
        </svg>

        {/* Pulse ring for current */}
        {current && !isLocked && !isDone && (
          <div
            className="absolute inset-0 rounded-full"
            style={{
              "--pulse-color": `${accent}44`,
              animation: "lw-pulse-ring 2s ease-out infinite",
            } as React.CSSProperties}
          />
        )}

        {/* Inner circle (the node itself) */}
        <div
          className="relative rounded-full overflow-hidden flex items-center justify-center"
          style={{
            width: CIRCLE,
            height: CIRCLE,
            background: isLocked
              ? (isDark ? "#1f2937" : "#f3f4f6")
              : isDone
                ? `${bg}`
                : bg,
            border: current && !isDone
              ? `3px solid ${accent}`
              : `2px solid ${isLocked ? (isDark ? "#374151" : "#e5e7eb") : ringColor}`,
            boxShadow: isLocked
              ? "none"
              : isDone
                ? `0 4px 12px rgba(34,197,94,0.25)`
                : current
                  ? `0 4px 20px ${accent}40, inset 0 0 20px ${accent}10`
                  : `0 4px 12px ${accent}20`,
            transition: "box-shadow 200ms, border 200ms",
          }}
        >
          {/* Image */}
          <div
            style={{
              opacity: isLocked ? 0.18 : isDone ? 0.7 : 1,
              filter: isLocked ? "grayscale(1)" : "none",
              animation: !isLocked && !isDone && isUnlocked
                ? `lw-wiggle 3s ease-in-out ${animationIndex * 0.2}s infinite`
                : "none",
            }}
          >
            <WordImg
              size="medium"
              src={src}
              opacity={1}
              customClass="w-[76px] h-[76px] object-contain drop-shadow-md"
            />
          </div>

          {/* Lock overlay */}
          {isLocked && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/10 rounded-full">
              <Image
                src="/images/Lock_icon.png"
                alt="Locked"
                width={28}
                height={28}
                style={{ opacity: 0.45 }}
              />
            </div>
          )}
        </div>

        {/* ── Badge: Current star ─────────────────────────── */}
        {current && !isLocked && !isDone && (
          <div
            className="absolute flex items-center justify-center"
            style={{
              top: 0,
              right: 4,
              width: 30,
              height: 30,
              borderRadius: "50%",
              background: `linear-gradient(135deg, #fbbf24, #f59e0b)`,
              border: "2px solid #fff",
              boxShadow: "0 2px 8px rgba(245,158,11,0.5)",
              zIndex: 10,
            }}
          >
            <span
              style={{
                fontSize: 15,
                lineHeight: 1,
                animation: "lw-star-spin 3s linear infinite",
                display: "inline-block",
              }}
            >
              ⭐
            </span>
          </div>
        )}

        {/* ── Badge: Done crown ───────────────────────────── */}
        {isDone && !isLocked && (
          <div
            className="absolute flex items-center justify-center"
            style={{
              top: -6,
              left: "50%",
              transform: "translateX(-50%)",
              width: 32,
              height: 32,
              zIndex: 10,
            }}
          >
            <span style={{ fontSize: 24, lineHeight: 1, filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.3))" }}>
              👑
            </span>
          </div>
        )}

        {/* ── Badge: Done check ───────────────────────────── */}
        {isDone && !isLocked && (
          <div
            className="absolute flex items-center justify-center"
            style={{
              bottom: 0,
              right: 4,
              width: 26,
              height: 26,
              borderRadius: "50%",
              background: "#22c55e",
              border: "2px solid #fff",
              boxShadow: "0 2px 6px rgba(34,197,94,0.4)",
              zIndex: 10,
            }}
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none"
              stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3.5 8.5l3 3 6-7" />
            </svg>
          </div>
        )}

        {/* ── Badge: Locked count ─────────────────────────── */}
        {isLocked && (
          <div
            className="absolute flex items-center justify-center"
            style={{
              bottom: 2,
              right: 2,
              width: 28,
              height: 28,
              borderRadius: "50%",
              background: isDark ? "#374151" : "#e5e7eb",
              border: "2px solid #fff",
              zIndex: 10,
            }}
          >
            <span className="text-[10px] font-black" style={{ color: isDark ? "#9ca3af" : "#6b7280" }}>
              {levels_left}
            </span>
          </div>
        )}

        {/* ── Progress % pill (visible on the ring) ───────── */}
        {isUnlocked && !isDone && progressClamped > 0 && (
          <div
            className="absolute flex items-center justify-center"
            style={{
              bottom: -2,
              left: "50%",
              transform: "translateX(-50%)",
              background: accent,
              color: "#fff",
              fontSize: "0.65rem",
              fontWeight: 900,
              lineHeight: 1,
              padding: "3px 8px",
              borderRadius: 10,
              boxShadow: `0 2px 6px ${accent}55`,
              zIndex: 10,
              letterSpacing: "0.02em",
            }}
          >
            {progressClamped}%
          </div>
        )}
      </div>

      {/* ── Label ─────────────────────────────────────────── */}
      <span
        className="font-extrabold text-center leading-tight w-full truncate"
        style={{
          color: isLocked ? (isDark ? "#6b7280" : "#9ca3af") : isDone ? "#22c55e" : txt,
          fontSize: "0.78rem",
          letterSpacing: "-0.01em",
        }}
      >
        {displayName}
      </span>

      {/* ── Action popover ────────────────────────────────── */}
      <div
        aria-hidden={!open}
        style={{
          maxHeight: open ? "48px" : "0px",
          opacity: open ? 1 : 0,
          overflow: "hidden",
          transition: "max-height 300ms cubic-bezier(.34,1.3,.64,1), opacity 180ms ease",
          width: "100%",
        }}
      >
        <div className="flex gap-1 pt-1">
          <button
            onClick={(e) => { e.stopPropagation(); goTo("/practice"); }}
            className="flex-1 rounded-xl py-1.5 text-[10px] font-black tracking-wide cursor-pointer active:scale-95 transition-transform duration-100"
            style={{ background: accent, color: "#fff" }}
          >
            ▶ Play
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); goTo("/spelling"); }}
            className="flex-1 rounded-xl py-1.5 text-[10px] font-black tracking-wide cursor-pointer active:scale-95 transition-transform duration-100"
            style={{
              background: "transparent",
              color: txt,
              border: `2px solid ${ringColor}`,
            }}
          >
            ✏️ Spell
          </button>
        </div>
      </div>
    </div>
  );
}
