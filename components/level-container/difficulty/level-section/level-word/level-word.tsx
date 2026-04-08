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
  side?: "left" | "right";
};

const colorMap: Record<string, { bg: string; border: string; ring: string; text: string; dark: { bg: string; border: string; text: string } }> = {
  pink:       { bg: "#fce7f3", border: "#f472b6", ring: "#ec4899", text: "#9d174d", dark: { bg: "#3b0a24", border: "#f472b6", text: "#f9a8d4" } },
  orangered:  { bg: "#ffedd5", border: "#fb923c", ring: "#f97316", text: "#9a3412", dark: { bg: "#3b1300", border: "#f97316", text: "#fdba74" } },
  blue:       { bg: "#dbeafe", border: "#60a5fa", ring: "#3b82f6", text: "#1e40af", dark: { bg: "#0f1f4a", border: "#3b82f6", text: "#93c5fd" } },
  pale_blue:  { bg: "#e0f2fe", border: "#38bdf8", ring: "#0ea5e9", text: "#075985", dark: { bg: "#082039", border: "#38bdf8", text: "#7dd3fc" } },
  opal:       { bg: "#ccfbf1", border: "#2dd4bf", ring: "#14b8a6", text: "#134e4a", dark: { bg: "#042420", border: "#2dd4bf", text: "#5eead4" } },
  orange:     { bg: "#fef3c7", border: "#fbbf24", ring: "#f59e0b", text: "#92400e", dark: { bg: "#3b2000", border: "#fbbf24", text: "#fde68a" } },
  pale_green: { bg: "#ecfccb", border: "#a3e635", ring: "#84cc16", text: "#3f6212", dark: { bg: "#1a2e05", border: "#a3e635", text: "#d9f99d" } },
  yellow:     { bg: "#fef9c3", border: "#facc15", ring: "#eab308", text: "#713f12", dark: { bg: "#3b2e00", border: "#facc15", text: "#fef08a" } },
  green:      { bg: "#dcfce7", border: "#4ade80", ring: "#22c55e", text: "#14532d", dark: { bg: "#022c1e", border: "#4ade80", text: "#6ee7b7" } },
  disabled:   { bg: "#f3f4f6", border: "#d1d5db", ring: "#9ca3af", text: "#6b7280", dark: { bg: "#1f2937", border: "#4b5563", text: "#9ca3af" } },
};

/* Inject float keyframe once */
if (typeof document !== "undefined") {
  const STYLE_ID = "__lw_float__";
  if (!document.getElementById(STYLE_ID)) {
    const s = document.createElement("style");
    s.id = STYLE_ID;
    s.textContent = `
      @keyframes lw-float {
        0%,100% { transform: translateY(0px) scale(1); }
        50%      { transform: translateY(-6px) scale(1.04); }
      }
    `;
    document.head.appendChild(s);
  }
}

export default function LevelWord({
  on_construction, id, color, name, src,
  available, unlocked, levels_left, progress,
  animationIndex = 0, side = "left",
}: LevelWordProps) {
  const [open, setOpen]         = useState(false);
  const [mounted, setMounted]   = useState(false);
  const [isDark, setIsDark]     = useState(false);
  const [barWidth, setBarWidth] = useState(0);
  const [imgFloat, setImgFloat] = useState(false);
  const wrapperRef              = useRef<HTMLDivElement>(null);

  const canOpen         = on_construction !== 1 || profile === "1";
  const isUnlocked      = unlocked ?? available ?? true;
  const progressClamped = Math.max(0, Math.min(100, Math.round(progress)));

  useEffect(() => {
    const check = () => setIsDark(document.documentElement.classList.contains("dark"));
    check();
    const obs = new MutationObserver(check);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    const delay = animationIndex * 90 + 40;
    const t1 = setTimeout(() => setMounted(true), delay);
    const t2 = setTimeout(() => setBarWidth(progressClamped), delay + 300);
    /* start float animation staggered so cards don't all move in sync */
    const t3 = setTimeout(() => setImgFloat(true), delay + 600);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [animationIndex, progressClamped]);

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

  const c      = colorMap[resolvedKey] ?? colorMap.blue;
  const ring   = c.ring;
  const txt    = isDark ? c.dark.text : c.text;
  const cardBg = isDark ? c.dark.bg : c.bg;

  const displayName = String(name || "")
    .split(" ")
    .map((w) => (w.length ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ");

  const goTo      = (path: string) => window.location.replace(`${path}?id=${id}`);
  const slideFrom = side === "left" ? "translateX(-60px) scale(0.92)" : "translateX(60px) scale(0.92)";
  /* stagger float phase so adjacent cards are offset */
  const floatDelay = `${(animationIndex % 3) * 0.9}s`;

  return (
    <div
      ref={wrapperRef}
      className="w-full"
      style={{
        opacity:    mounted ? 1 : 0,
        transform:  mounted ? "translateX(0) scale(1)" : slideFrom,
        transition: "opacity 420ms ease, transform 540ms cubic-bezier(.34,1.45,.64,1)",
        transitionDelay: `${animationIndex * 60}ms`,
      }}
    >
      <div
        className="relative overflow-hidden w-full"
        style={{
          borderRadius: 16,
          background: cardBg,
          border: `2px solid ${isDark ? c.dark.border : c.border}`,
          boxShadow: open
            ? `0 0 0 3px ${ring}33, 0 6px 20px ${ring}22`
            : `0 2px 8px rgba(0,0,0,0.07)`,
          transition: "box-shadow 200ms ease, transform 160ms ease",
        }}
        onMouseEnter={(e) => { if (isUnlocked && canOpen) (e.currentTarget as HTMLElement).style.transform = "translateY(-3px)"; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.transform = ""; }}
        onMouseDown={(e)  => { (e.currentTarget as HTMLElement).style.transform = "scale(0.97)"; }}
        onMouseUp={(e)    => { (e.currentTarget as HTMLElement).style.transform = ""; }}
      >
        <button
          onClick={() => isUnlocked && canOpen && setOpen((v) => !v)}
          disabled={!isUnlocked || !canOpen}
          aria-expanded={open}
          className="w-full flex flex-col items-center focus-visible:outline-none"
          style={{ cursor: isUnlocked && canOpen ? "pointer" : "not-allowed" }}
        >
          {/* ── Image panel ─────────────────────────────────────────── */}
          <div
            className="relative w-full flex items-center justify-center overflow-hidden"
            style={{
              height: 110,
              background: isDark ? `${c.dark.bg}cc` : `${c.bg}cc`,
              borderBottom: `2px solid ${isDark ? c.dark.border : c.border}`,
            }}
          >
            {/* Floating image */}
            <div
              style={{
                position: "relative",
                opacity: isUnlocked ? 1 : 0.25,
                animation: imgFloat && isUnlocked
                  ? `lw-float ${3.6 + (animationIndex % 3) * 0.5}s ease-in-out ${floatDelay} infinite`
                  : "none",
              }}
            >
              <WordImg
                size="medium"
                src={src}
                opacity={1}
                customClass="w-[84px] h-[84px] object-contain drop-shadow-md"
              />
            </div>

            {/* Lock overlay */}
            {!isUnlocked && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-black/30">
                <Image src="/images/Lock_icon.png" alt="Locked" width={28} height={28} />
                <span className="text-[10px] font-black" style={{ color: ring }}>{levels_left} left</span>
              </div>
            )}

            {/* ✓ badge */}
            {progressClamped === 100 && (
              <div
                className="absolute top-2 right-2 rounded-full text-[9px] font-black px-2 py-0.5 leading-none"
                style={{ background: ring, color: "#fff" }}
              >
                ✓
              </div>
            )}
          </div>

          {/* ── Info row ──────────────────────────────────────────── */}
          <div
            className="w-full flex items-center gap-2 px-3 py-2.5"
            style={{ opacity: isUnlocked ? 1 : 0.5 }}
          >
            <div className="flex flex-col gap-1.5 flex-1 min-w-0">
              <span
                className="font-extrabold truncate leading-none"
                style={{ color: txt, fontSize: "0.82rem", letterSpacing: "-0.01em" }}
              >
                {displayName}
              </span>
              {isUnlocked ? (
                <div className="flex items-center gap-1.5">
                  <div
                    className="flex-1 rounded-full overflow-hidden"
                    style={{ height: 5, background: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.08)" }}
                  >
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${barWidth}%`,
                        background: ring,
                        transition: "width 900ms cubic-bezier(.2,.9,.2,1)",
                      }}
                    />
                  </div>
                  <span className="shrink-0 font-black tabular-nums" style={{ color: ring, fontSize: "0.65rem" }}>
                    {progressClamped}%
                  </span>
                </div>
              ) : (
                <span style={{ color: txt, opacity: 0.5, fontSize: "0.65rem" }}>🔒 {levels_left} away</span>
              )}
            </div>

            {isUnlocked && canOpen && (
              <svg width="13" height="13" viewBox="0 0 16 16" fill="none" className="shrink-0"
                style={{
                  color: ring, opacity: 0.7,
                  transform: open ? "rotate(90deg)" : "rotate(0deg)",
                  transition: "transform 240ms cubic-bezier(.34,1.3,.64,1)",
                }}
              >
                <path d="M6 3l5 5-5 5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </div>
        </button>

        {/* ── Action panel ──────────────────────────────────────── */}
        <div
          aria-hidden={!open}
          style={{
            maxHeight: open ? "52px" : "0px",
            opacity:   open ? 1 : 0,
            overflow:  "hidden",
            transition: "max-height 300ms cubic-bezier(.34,1.3,.64,1), opacity 180ms ease",
          }}
        >
          <div
            className="flex gap-2 px-3 pt-1 pb-3"
            style={{ borderTop: `2px solid ${isDark ? c.dark.border : c.border}` }}
          >
            <button
              onClick={() => goTo("/practice")}
              className="flex-1 rounded-xl py-1.5 text-xs font-black tracking-wide active:scale-95 transition-transform duration-100"
              style={{ background: ring, color: "#fff" }}
            >
              ▶ Practice
            </button>
            <button
              onClick={() => goTo("/spelling")}
              className="flex-1 rounded-xl py-1.5 text-xs font-black tracking-wide active:scale-95 transition-transform duration-100"
              style={{ background: "transparent", color: txt, border: `2px solid ${isDark ? c.dark.border : c.border}` }}
            >
              ✏️ Spell
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
