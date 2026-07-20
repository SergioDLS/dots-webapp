"use client";

import React, { useEffect, useRef } from "react";
import Image from "next/image";
import WordImg from "@/components/ui/word-img/word-img";
import NodePopover from "./node-popover";
import { NODE_META } from "@/lib/path-node-meta";
import type { PathNode as PathNodeType } from "@/types/path.types";

/* Geometry shared with path-section for slot/connector math */
const RING_W = 6;
const CIRCLE = 100;
const CP_CIRCLE = 130; // checkpoint ≈ 1.3x
export const NODE_SVG_SIZE = CIRCLE + RING_W * 2 + 10;
export const CHECKPOINT_SVG_SIZE = CP_CIRCLE + RING_W * 2 + 16;

interface PathNodeProps {
  node: PathNodeType;
  accentHex: string;
  checkpointAvailable: boolean;
  animationIndex: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  popoverAlign: "left" | "center" | "right";
}

export default function PathNode({
  node,
  accentHex,
  checkpointAvailable,
  animationIndex,
  open,
  onOpenChange,
  popoverAlign,
}: PathNodeProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);

  const isCheckpoint = node.type === "checkpoint";
  const isLocked = !node.unlocked;
  const progress = Math.max(0, Math.min(100, Math.round(node.progress)));
  const isDone = node.completed;
  const isCurrent = node.current && !isLocked && !isDone;
  const isTestable =
    isCheckpoint && node.unlocked && !node.completed && checkpointAvailable;

  const meta = NODE_META[node.type];

  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node))
        onOpenChange(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open, onOpenChange]);

  /* ── Dark-mode-safe tints: hex + color-mix over theme vars ── */
  const bg = isLocked
    ? "var(--surface-2)"
    : `color-mix(in srgb, ${accentHex} 16%, var(--surface))`;
  const ringColor = isLocked
    ? "var(--border)"
    : `color-mix(in srgb, ${accentHex} 45%, var(--surface))`;
  const txt = isLocked
    ? "var(--muted)"
    : isDone
      ? "var(--success)"
      : `color-mix(in srgb, ${accentHex} 55%, var(--foreground))`;

  const circle = isCheckpoint ? CP_CIRCLE : CIRCLE;
  const svgSize = isCheckpoint ? CHECKPOINT_SVG_SIZE : NODE_SVG_SIZE;
  const radius = circle / 2 + RING_W / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeOffset = circumference - (progress / 100) * circumference;
  const shapeRadius = isCheckpoint ? 36 : circle / 2; // checkpoint = squircle

  const border = isTestable
    ? "3px solid var(--gold)"
    : isCurrent
      ? `3px solid ${accentHex}`
      : `2px solid ${ringColor}`;
  const shadow = isLocked
    ? "none"
    : isTestable
      ? "0 4px 20px color-mix(in srgb, var(--gold) 45%, transparent)"
      : isDone
        ? "0 4px 12px color-mix(in srgb, var(--success) 25%, transparent)"
        : isCurrent
          ? `0 4px 20px ${accentHex}40, inset 0 0 20px ${accentHex}10`
          : `0 4px 12px ${accentHex}20`;

  const delay = Math.min(animationIndex, 8) * 80;

  return (
    <div
      ref={wrapperRef}
      className="relative flex flex-col items-center gap-1.5"
      style={{
        animation: `dots-pop-in 500ms cubic-bezier(.34,1.56,.64,1) ${delay}ms both`,
      }}
    >
      {/* ── Node shape ─────────────────────────────────────── */}
      <div
        className="relative flex items-center justify-center"
        style={{
          width: svgSize,
          height: svgSize,
          cursor: !isLocked ? "pointer" : "default",
          animation: isCurrent
            ? `dots-float 2.5s ease-in-out ${(animationIndex % 3) * 0.4}s infinite`
            : "none",
        }}
        onClick={() => !isLocked && onOpenChange(!open)}
        onMouseEnter={(e) => {
          if (!isLocked)
            (e.currentTarget as HTMLElement).style.transform = "scale(1.08)";
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLElement).style.transform = "";
        }}
        onMouseDown={(e) => {
          if (!isLocked)
            (e.currentTarget as HTMLElement).style.transform = "scale(0.94)";
        }}
        onMouseUp={(e) => {
          (e.currentTarget as HTMLElement).style.transform = "";
        }}
      >
        {/* Progress ring (circular nodes only) */}
        {!isCheckpoint && (
          <svg
            width={svgSize}
            height={svgSize}
            className="absolute inset-0"
            style={{ transform: "rotate(-90deg)" }}
          >
            <circle
              cx={svgSize / 2}
              cy={svgSize / 2}
              r={radius}
              fill="none"
              stroke="color-mix(in srgb, var(--foreground) 10%, transparent)"
              strokeWidth={RING_W}
            />
            {!isLocked && progress > 0 && (
              <circle
                cx={svgSize / 2}
                cy={svgSize / 2}
                r={radius}
                fill="none"
                stroke={isDone ? "var(--success)" : accentHex}
                strokeWidth={RING_W}
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={strokeOffset}
                style={{ transition: "stroke-dashoffset 1s ease-out" }}
              />
            )}
          </svg>
        )}

        {/* Pulse: accent for current, soft gold for testable checkpoint */}
        {(isCurrent || isTestable) && (
          <div
            className="absolute inset-0"
            style={{
              borderRadius: isCheckpoint ? shapeRadius + 6 : "50%",
              "--pulse-color": isTestable
                ? "color-mix(in srgb, var(--gold) 35%, transparent)"
                : `${accentHex}44`,
              animation: `dots-pulse-ring ${isTestable ? "2.6s" : "2s"} ease-out infinite`,
            } as React.CSSProperties}
          />
        )}

        {/* Inner shape: circle, or squircle for checkpoints */}
        <div
          className="relative overflow-hidden flex items-center justify-center"
          style={{
            width: circle,
            height: circle,
            borderRadius: shapeRadius,
            background: bg,
            border,
            boxShadow: shadow,
            transition: "box-shadow 200ms, border 200ms",
          }}
        >
          {/* Content: level image for practice, type icon otherwise */}
          <div
            style={{
              opacity: isLocked ? 0.25 : isDone ? 0.75 : 1,
              filter: isLocked ? "grayscale(1)" : "none",
              animation: isCurrent
                ? `dots-wiggle 3s ease-in-out ${animationIndex * 0.2}s infinite`
                : "none",
            }}
          >
            {node.type === "practice" && node.src ? (
              <WordImg
                size="medium"
                src={node.src}
                opacity={1}
                customClass="w-[68px] h-[68px] object-contain drop-shadow-md"
              />
            ) : (
              <span
                aria-hidden
                style={{
                  fontSize: isCheckpoint ? 52 : 40,
                  lineHeight: 1,
                  display: "inline-block",
                  filter: "drop-shadow(0 2px 3px rgba(0,0,0,0.15))",
                }}
              >
                {meta.icon}
              </span>
            )}
          </div>

          {/* Lock overlay */}
          {isLocked && (
            <div
              className="absolute inset-0 flex items-center justify-center bg-black/10"
              style={{ borderRadius: shapeRadius }}
            >
              <Image
                src="/images/Lock_icon.png"
                alt="Bloqueado"
                width={28}
                height={28}
                style={{ opacity: 0.45 }}
              />
            </div>
          )}
        </div>

        {/* ── Badge: type (bottom-left, section color) ──────── */}
        <div
          className="absolute flex items-center justify-center"
          style={{
            bottom: 2,
            left: 2,
            width: 28,
            height: 28,
            borderRadius: "50%",
            background: isLocked ? "var(--border)" : accentHex,
            border: "2px solid var(--surface)",
            boxShadow: isLocked ? "none" : `0 2px 6px ${accentHex}55`,
            filter: isLocked ? "grayscale(1)" : "none",
            zIndex: 10,
          }}
          title={meta.label}
        >
          <span style={{ fontSize: 13, lineHeight: 1 }}>{meta.icon}</span>
        </div>

        {/* ── Badge: current star ───────────────────────────── */}
        {isCurrent && (
          <div
            className="absolute flex items-center justify-center"
            style={{
              top: 0,
              right: 4,
              width: 30,
              height: 30,
              borderRadius: "50%",
              background: "linear-gradient(135deg, #fbbf24, #f59e0b)",
              border: "2px solid var(--surface)",
              boxShadow: "0 2px 8px rgba(245,158,11,0.5)",
              zIndex: 10,
            }}
          >
            <span
              style={{
                fontSize: 15,
                lineHeight: 1,
                animation: "dots-star-spin 3s linear infinite",
                display: "inline-block",
              }}
            >
              ⭐
            </span>
          </div>
        )}

        {/* ── Badge: done crown (checkpoints wear it too) ───── */}
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
            <span
              style={{
                fontSize: 24,
                lineHeight: 1,
                filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.3))",
              }}
            >
              👑
            </span>
          </div>
        )}

        {/* ── Badge: done check ─────────────────────────────── */}
        {isDone && !isLocked && (
          <div
            className="absolute flex items-center justify-center"
            style={{
              bottom: 0,
              right: 4,
              width: 26,
              height: 26,
              borderRadius: "50%",
              background: "var(--success)",
              border: "2px solid var(--surface)",
              boxShadow: "0 2px 6px color-mix(in srgb, var(--success) 40%, transparent)",
              zIndex: 10,
            }}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 16 16"
              fill="none"
              stroke="#fff"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M3.5 8.5l3 3 6-7" />
            </svg>
          </div>
        )}

        {/* ── Progress % pill ───────────────────────────────── */}
        {!isLocked && !isDone && progress > 0 && (
          <div
            className="absolute flex items-center justify-center"
            style={{
              bottom: -2,
              left: "50%",
              transform: "translateX(-50%)",
              background: accentHex,
              color: "#fff",
              fontSize: "0.65rem",
              fontWeight: 900,
              lineHeight: 1,
              padding: "3px 8px",
              borderRadius: 10,
              boxShadow: `0 2px 6px ${accentHex}55`,
              zIndex: 10,
              letterSpacing: "0.02em",
            }}
          >
            {progress}%
          </div>
        )}
      </div>

      {/* ── Label ──────────────────────────────────────────── */}
      <span
        className="font-extrabold text-center leading-tight w-full truncate"
        style={{ color: txt, fontSize: "0.78rem", letterSpacing: "-0.01em" }}
      >
        {node.title}
      </span>

      {/* ── Popover ────────────────────────────────────────── */}
      {open && !isLocked && (
        <NodePopover
          node={node}
          accentHex={accentHex}
          align={popoverAlign}
          onClose={() => onOpenChange(false)}
        />
      )}
    </div>
  );
}
