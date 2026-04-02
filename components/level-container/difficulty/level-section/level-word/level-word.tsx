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
  animationIndex?: number;
  /** Which edge to anchor to — drives the slide-in direction */
  side?: "left" | "right";
};

// ── Color palette ─────────────────────────────────────────────────────────────
const colorMap: Record<string, { bg: string; ring: string; text: string; glow: string; dark: { bg: string; text: string } }> = {
  pink:       { bg: "#fdf2f8", ring: "#f472b6", text: "#be185d", glow: "244,114,182", dark: { bg: "#3b0a24", text: "#f9a8d4" } },
  orangered:  { bg: "#fff7ed", ring: "#f97316", text: "#c2410c", glow: "249,115,22",  dark: { bg: "#3b1300", text: "#fdba74" } },
  blue:       { bg: "#eff6ff", ring: "#3b82f6", text: "#1d4ed8", glow: "59,130,246",  dark: { bg: "#0f1f4a", text: "#93c5fd" } },
  pale_blue:  { bg: "#f0f9ff", ring: "#38bdf8", text: "#0369a1", glow: "56,189,248",  dark: { bg: "#082039", text: "#7dd3fc" } },
  opal:       { bg: "#f0fdfa", ring: "#2dd4bf", text: "#0f766e", glow: "45,212,191",  dark: { bg: "#042420", text: "#5eead4" } },
  orange:     { bg: "#fffbeb", ring: "#fbbf24", text: "#b45309", glow: "251,191,36",  dark: { bg: "#3b2000", text: "#fde68a" } },
  pale_green: { bg: "#f7fee7", ring: "#a3e635", text: "#4d7c0f", glow: "163,230,53",  dark: { bg: "#1a2e05", text: "#d9f99d" } },
  yellow:     { bg: "#fefce8", ring: "#facc15", text: "#92400e", glow: "250,204,21",  dark: { bg: "#3b2e00", text: "#fef08a" } },
  green:      { bg: "#f0fdf4", ring: "#34d399", text: "#065f46", glow: "52,211,153",  dark: { bg: "#022c1e", text: "#6ee7b7" } },
  disabled:   { bg: "#f3f4f6", ring: "#d1d5db", text: "#6b7280", glow: "209,213,219", dark: { bg: "#1f2937", text: "#9ca3af" } },
};

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
  animationIndex = 0,
  side = "left",
}: LevelWordProps) {
  const [open, setOpen]       = useState(false);
  const [mounted, setMounted] = useState(false);
  const [isDark, setIsDark]   = useState(false);
  const [barWidth, setBarWidth] = useState(0);
  const wrapperRef            = useRef<HTMLDivElement>(null);

  const canOpen       = on_construction !== 1 || profile === "1";
  const isUnlocked    = unlocked ?? available ?? true;
  const progressClamped = Math.max(0, Math.min(100, Math.round(progress)));

  // detect dark mode
  useEffect(() => {
    const check = () => setIsDark(document.documentElement.classList.contains("dark"));
    check();
    const obs = new MutationObserver(check);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => obs.disconnect();
  }, []);

  // staggered slide-in from edge + progress bar fill
  useEffect(() => {
    const delay = animationIndex * 90 + 40;
    const t1 = setTimeout(() => setMounted(true), delay);
    const t2 = setTimeout(() => setBarWidth(progressClamped), delay + 200);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [animationIndex, progressClamped]);

  // close on outside click
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
    if (!isUnlocked) return "disabled";
    if (color && colorMap[color]) return color;
    const keys = Object.keys(colorMap).filter((k) => k !== "disabled");
    return keys[((id * 2654435761) >>> 0) % keys.length];
  })();

  const c   = colorMap[resolvedKey] ?? colorMap.blue;
  const ring = c.ring;
  const glow = c.glow;
  const txt  = isDark ? c.dark.text : c.text;
  const cardBg = isDark
    ? `linear-gradient(145deg,#1a1a2e,#16213e)`
    : `linear-gradient(145deg,${c.bg},${c.bg}ee)`;

  const displayName = String(name || "")
    .split(" ")
    .map((w) => (w.length ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ");

  const goTo = (path: string) => window.location.replace(`${path}?id=${id}`);
  const slideFrom = side === "left" ? "translateX(-72px)" : "translateX(72px)";

  return (
    <div
      ref={wrapperRef}
      className={`w-full flex ${side === "right" ? "justify-end" : "justify-start"}`}
      style={{
        opacity: mounted ? 1 : 0,
        transform: mounted ? "translateX(0)" : slideFrom,
        transition: "opacity 400ms ease, transform 520ms cubic-bezier(.34,1.45,.64,1)",
        transitionDelay: `${animationIndex * 65}ms`,
      }}
    >
      {/* ── CARD ─────────────────────────────────────────────────────────── */}
      <div
        className="relative overflow-hidden"
        style={{
          width: "74%",
          borderRadius: 24,
          background: cardBg,
          border: `2px solid rgba(${glow},${isDark ? 0.3 : 0.4})`,
          boxShadow: open
            ? `0 0 0 4px rgba(${glow},0.2),0 20px 56px rgba(${glow},0.32)`
            : `0 8px 36px rgba(${glow},0.22), inset 0 1px 0 rgba(255,255,255,0.55)`,
          transition: "box-shadow 280ms ease, transform 200ms ease",
        }}
        onMouseEnter={(e) => { if (isUnlocked && canOpen) (e.currentTarget as HTMLElement).style.transform = "translateY(-5px) scale(1.02)"; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.transform = ""; }}
        onMouseDown={(e)  => { (e.currentTarget as HTMLElement).style.transform = "scale(0.97)"; }}
        onMouseUp={(e)    => { (e.currentTarget as HTMLElement).style.transform = ""; }}
      >
        {/* Ambient blob */}
        <span
          className="absolute pointer-events-none"
          style={{
            width: 140, height: 140, borderRadius: "50%",
            background: `radial-gradient(circle,rgba(${glow},0.28) 0%,transparent 68%)`,
            top: -40,
            right: side === "left" ? -30 : "auto",
            left:  side === "right" ? -30 : "auto",
            filter: "blur(20px)",
          }}
        />

        <button
          onClick={() => isUnlocked && canOpen && setOpen((v) => !v)}
          disabled={!isUnlocked || !canOpen}
          aria-expanded={open}
          className="w-full flex items-stretch text-left focus-visible:outline-none"
          style={{ cursor: isUnlocked && canOpen ? "pointer" : "not-allowed", opacity: isUnlocked ? 1 : 0.6 }}
        >
          {/* Image block */}
          <div
            className="relative shrink-0 flex items-center justify-center"
            style={{
              width: 96, height: 96,
              background: `rgba(${glow},${isDark ? 0.14 : 0.16})`,
              borderRight: side === "left" ? `1.5px solid rgba(${glow},0.18)` : "none",
              borderLeft:  side === "right" ? `1.5px solid rgba(${glow},0.18)` : "none",
              order: side === "left" ? 0 : 1,
            }}
          >
            <WordImg
              size="medium"
              src={src}
              opacity={isUnlocked ? 1 : 0.22}
              customClass="w-[68px] h-[68px] object-contain drop-shadow-md"
            />
            {!isUnlocked && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-0.5 bg-black/20 backdrop-blur-[2px]">
                <Image src="/images/Lock_icon.png" alt="Locked" width={26} height={26} />
                <span className="text-[11px] font-black" style={{ color: ring }}>{levels_left}</span>
              </div>
            )}
          </div>

          {/* Text block */}
          <div
            className="flex flex-col justify-center gap-2 px-4 py-3 flex-1 min-w-0"
            style={{ order: side === "left" ? 1 : 0 }}
          >
            <span
              className="font-black leading-snug"
              style={{ color: txt, fontSize: "1.1rem", letterSpacing: "-0.015em" }}
            >
              {displayName}
            </span>

            {isUnlocked ? (
              <div className="flex flex-col gap-1">
                {/* Glowing progress bar */}
                <div className="relative w-full rounded-full overflow-hidden" style={{ height: 9, background: `rgba(${glow},0.16)` }}>
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${barWidth}%`,
                      background: `linear-gradient(90deg,${ring},rgba(${glow},0.6))`,
                      boxShadow: `0 0 10px rgba(${glow},0.75),0 0 22px rgba(${glow},0.4)`,
                      transition: "width 1000ms cubic-bezier(.2,.9,.2,1)",
                    }}
                  >
                    {/* sheen */}
                    <span className="absolute right-0 inset-y-0 w-3" style={{ background: "rgba(255,255,255,0.45)", filter: "blur(3px)" }} />
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-[11px] font-extrabold tabular-nums" style={{ color: ring }}>
                    {progressClamped}%
                  </span>
                  {progressClamped === 100 && <span className="text-xs">⭐</span>}
                </div>
              </div>
            ) : (
              <span className="text-[11px] font-semibold" style={{ color: txt, opacity: 0.55 }}>
                🔒 {levels_left} levels away
              </span>
            )}
          </div>

          {/* Chevron */}
          {isUnlocked && canOpen && (
            <div className="shrink-0 flex items-center pr-3" style={{ order: 2, color: ring, opacity: 0.55 }}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none"
                style={{ transform: open ? "rotate(90deg)" : "rotate(0deg)", transition: "transform 300ms cubic-bezier(.34,1.3,.64,1)" }}>
                <path d="M6 3l5 5-5 5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          )}
        </button>

        {/* ── Action panel ─────────────────────────────────────────────── */}
        <div
          aria-hidden={!open}
          style={{
            maxHeight: open ? "68px" : "0px",
            opacity: open ? 1 : 0,
            overflow: "hidden",
            transition: "max-height 380ms cubic-bezier(.34,1.3,.64,1),opacity 240ms ease",
          }}
        >
          <div
            className="flex gap-2 px-4 pt-1.5 pb-3"
            style={{ borderTop: `1px solid rgba(${glow},0.18)` }}
          >
            <button
              onClick={() => goTo("/practice")}
              className="flex-1 rounded-2xl py-2 text-sm font-black tracking-wide active:scale-95 transition-transform duration-100"
              style={{ background: ring, color: isDark ? "#0f172a" : "#fff", boxShadow: `0 4px 18px rgba(${glow},0.48)` }}
            >
              ▶ Practice
            </button>
            <button
              onClick={() => goTo("/spelling")}
              className="flex-1 rounded-2xl py-2 text-sm font-black tracking-wide active:scale-95 transition-transform duration-100"
              style={{ background: `rgba(${glow},0.12)`, color: txt, border: `1.5px solid rgba(${glow},0.38)` }}
            >
              ✏️ Spelling
            </button>
          </div>
        </div>

        {/* ✓ Done badge */}
        {progressClamped === 100 && (
          <div
            className="absolute top-2 right-2 rounded-full text-[10px] font-black px-2 py-0.5"
            style={{ background: ring, color: isDark ? "#0f172a" : "#fff", boxShadow: `0 2px 8px rgba(${glow},0.5)` }}
          >
            ✓ Done
          </div>
        )}
      </div>
    </div>
  );
}
