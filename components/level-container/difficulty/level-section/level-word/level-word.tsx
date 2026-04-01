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
  unlocked?: boolean;
  levels_left: number;
  progress: number;
  animationIndex?: number;
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

// Node size: large enough so only ~3 fit in the viewport vertically
// clamp(148px, 22vmin, 192px) — scales with screen height
const SIZE_CSS = "clamp(148px, 22vmin, 192px)";
// Numeric fallback for SVG calculations (use the middle of the clamp range)
const SIZE_NUM = 170;
const STROKE = 10;
const Rc = SIZE_NUM / 2;
const nr = Rc - STROKE / 2;
const circ = 2 * Math.PI * nr;

export default function LevelWord({
  on_construction,
  id,
  color,
  name,
  src,
  unlocked,
  levels_left,
  progress,
  animationIndex,
}: LevelWordProps) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [bounced, setBounced] = useState(false);
  const [isDark, setIsDark] = useState(false);
  const [animOffset, setAnimOffset] = useState(circ);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const canOpen = on_construction !== 1 || profile === "1";
  const isUnlocked = unlocked ?? true;
  const progressClamped = Math.max(0, Math.min(100, Math.round(progress)));

  // detect dark mode
  useEffect(() => {
    const check = () => setIsDark(document.documentElement.classList.contains("dark"));
    check();
    const obs = new MutationObserver(check);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => obs.disconnect();
  }, []);

  // staggered bounce-in entry
  useEffect(() => {
    const delay = (animationIndex ?? 0) * 80 + 30;
    const t1 = setTimeout(() => setMounted(true), delay);
    const t2 = setTimeout(() => setBounced(true), delay + 20);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [animationIndex]);

  // animate progress ring after entry
  useEffect(() => {
    const target = circ * (1 - progressClamped / 100);
    const t = setTimeout(() => setAnimOffset(target), (animationIndex ?? 0) * 80 + 300);
    return () => clearTimeout(t);
  }, [progressClamped, animationIndex]);

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

  const c = colorMap[resolvedKey] ?? colorMap.blue;
  const pal = { bg: isDark ? c.dark.bg : c.bg, ring: c.ring, text: isDark ? c.dark.text : c.text, glow: c.glow };

  const displayName = String(name || "")
    .split(" ")
    .map((w) => (w.length ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ");

  const goTo = (path: string) => window.location.replace(`${path}?id=${id}`);

  return (
    <div
      ref={wrapperRef}
      className="flex flex-col items-center"
      style={{
        // bounce-in: scale overshoots then settles
        opacity: mounted ? 1 : 0,
        transform: bounced
          ? "translateY(0) scale(1)"
          : mounted
            ? "translateY(-4px) scale(1.06)"
            : "translateY(24px) scale(0.78)",
        transition: bounced
          ? "opacity 320ms ease, transform 420ms cubic-bezier(.34,1.56,.64,1)"
          : "opacity 120ms ease, transform 120ms ease",
        transitionDelay: `${(animationIndex ?? 0) * 70}ms`,
      }}
    >
      {/* ── Node ─────────────────────────────────────────────────────────────── */}
      <button
        onClick={() => isUnlocked && canOpen && setOpen((v) => !v)}
        disabled={!isUnlocked || !canOpen}
        aria-expanded={open}
        className="relative flex items-center justify-center rounded-full focus-visible:outline-none group"
        style={{
          width: SIZE_CSS,
          height: SIZE_CSS,
          background: pal.bg,
          border: `4px solid ${pal.ring}`,
          boxShadow: open
            ? `0 0 0 6px rgba(${pal.glow},0.22), 0 10px 40px rgba(${pal.glow},0.45)`
            : `0 6px 28px rgba(${pal.glow},0.38)`,
          cursor: isUnlocked && canOpen ? "pointer" : "not-allowed",
          opacity: isUnlocked ? 1 : 0.7,
          // smooth shadow transition when opening
          transition: "box-shadow 280ms ease, transform 180ms ease",
        }}
        // hover lift + subtle scale via inline style (avoids Tailwind group-hover conflict with open state)
        onMouseEnter={(e) => { if (isUnlocked && canOpen) (e.currentTarget as HTMLElement).style.transform = "translateY(-5px) scale(1.04)"; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.transform = ""; }}
        onMouseDown={(e) => { (e.currentTarget as HTMLElement).style.transform = "scale(0.96)"; }}
        onMouseUp={(e) => { (e.currentTarget as HTMLElement).style.transform = ""; }}
      >
        {/* SVG progress ring — uses SIZE_NUM for math, CSS size for display */}
        <svg
          viewBox={`0 0 ${SIZE_NUM} ${SIZE_NUM}`}
          className="absolute inset-0 w-full h-full -rotate-90 pointer-events-none"
          aria-hidden
        >
          {/* track */}
          <circle cx={Rc} cy={Rc} r={nr} fill="none" stroke={`rgba(${pal.glow},0.15)`} strokeWidth={STROKE} />
          {/* animated fill */}
          <circle
            cx={Rc} cy={Rc} r={nr}
            fill="none"
            stroke={pal.ring}
            strokeWidth={STROKE}
            strokeLinecap="round"
            strokeDasharray={`${circ} ${circ}`}
            strokeDashoffset={animOffset}
            style={{ transition: "stroke-dashoffset 900ms cubic-bezier(.2,.9,.2,1)" }}
          />
        </svg>

        {/* word image — 58% of node diameter */}
        <div
          className="relative z-10 flex items-center justify-center rounded-full overflow-hidden"
          style={{ width: "58%", height: "58%" }}
        >
          <WordImg
            size="large"
            src={src}
            opacity={isUnlocked ? 1 : 0.35}
            customClass="w-full h-full object-contain"
          />
        </div>

        {/* locked overlay */}
        {!isUnlocked && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-1 rounded-full bg-white/45 dark:bg-black/45">
            <Image src="/images/Lock_icon.png" alt="Locked" width={36} height={36} />
            <span className="text-sm font-bold leading-none" style={{ color: pal.text }}>{levels_left}</span>
          </div>
        )}

        {/* open-state inner glow ring */}
        {open && (
          <span
            className="absolute inset-0 rounded-full pointer-events-none"
            style={{
              boxShadow: `inset 0 0 0 3px rgba(${pal.glow},0.30)`,
              animation: "pulse-ring 1.4s ease-in-out infinite",
            }}
          />
        )}
      </button>

      {/* ── Label ─────────────────────────────────────────────────────────────── */}
      <div className="mt-3 flex flex-col items-center gap-1.5">
        <span
          className="text-sm font-extrabold tracking-wide text-center leading-snug"
          style={{ color: pal.text, maxWidth: "calc(clamp(148px, 22vmin, 192px) + 8px)" }}
        >
          {displayName}
        </span>
        {isUnlocked && (
          <div
            className="rounded-full overflow-hidden"
            style={{ width: "calc(clamp(148px,22vmin,192px) * 0.55)", height: "6px", background: `rgba(${pal.glow},0.18)` }}
          >
            <div
              className="h-full rounded-full"
              style={{
                width: `${progressClamped}%`,
                background: pal.ring,
                transition: "width 900ms cubic-bezier(.2,.9,.2,1)",
                boxShadow: `0 0 8px rgba(${pal.glow},0.5)`,
              }}
            />
          </div>
        )}
      </div>

      {/* ── Slide-down action panel ───────────────────────────────────────────── */}
      <div
        aria-hidden={!open}
        className="overflow-hidden w-full"
        style={{
          maxHeight: open ? "140px" : "0px",
          opacity: open ? 1 : 0,
          transform: open ? "scaleY(1)" : "scaleY(0.85)",
          transformOrigin: "top center",
          transition: "max-height 350ms cubic-bezier(.34,1.3,.64,1), opacity 220ms ease, transform 350ms cubic-bezier(.34,1.3,.64,1)",
        }}
      >
        <div
          className="flex flex-col gap-2.5 pt-4 items-stretch"
          style={{ width: "calc(clamp(148px,22vmin,192px) - 8px)", margin: "0 auto" }}
        >
          <button
            onClick={() => goTo("/practice")}
            className="rounded-2xl py-2.5 text-sm font-extrabold tracking-wide transition-all duration-150 active:scale-95"
            style={{
              background: pal.ring,
              color: isDark ? "#0f172a" : "#fff",
              boxShadow: `0 5px 18px rgba(${pal.glow},0.5)`,
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.filter = "brightness(1.1)"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.filter = ""; }}
          >
            ▶ Practice
          </button>
          <button
            onClick={() => goTo("/spelling")}
            className="rounded-2xl py-2.5 text-sm font-extrabold tracking-wide transition-all duration-150 active:scale-95"
            style={{
              background: pal.bg,
              color: pal.text,
              border: `2.5px solid ${pal.ring}`,
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.filter = "brightness(1.05)"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.filter = ""; }}
          >
            ✏️ Spelling
          </button>
        </div>
      </div>
    </div>
  );
}
