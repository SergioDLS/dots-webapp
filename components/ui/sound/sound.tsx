"use client";

import { useEffect, useRef } from "react";
import { BASE_URL_SOUNDS } from "@/constants";

// ── Types ─────────────────────────────────────────────────────────────────────
interface SoundProps {
  /** Path relative to BASE_URL_SOUNDS, e.g. "animals/cat.mp3" */
  src: string;
  /** Play automatically when the component mounts or src changes */
  autoplay?: boolean;
  /** Show the speaker icon button */
  icon?: boolean;
  /** Make the icon smaller */
  size?: "small" | "normal";
  /** Position of the icon: default top-right, "right" → vertically centred right */
  position?: "default" | "right";
  /** Extra Tailwind classes applied to the wrapper */
  className?: string;
  /** Called after each manual play */
  onClick?: () => void;
  children?: React.ReactNode;
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function Sound({
  src,
  autoplay = false,
  icon = false,
  position = "default",
  className = "",
  onClick,
  children,
}: SoundProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  // Track whether autoplay has fired for the current src (avoids double-play on re-renders)
  const playedRef = useRef(false);

  // Build or rebuild the Audio instance whenever src changes
  useEffect(() => {
    const audio = new Audio(`${BASE_URL_SOUNDS}/${src}`);
    
    
    audioRef.current = audio;
    playedRef.current = false;

    if (autoplay) {
      audio.play().catch(() => {});
      playedRef.current = true;
    }

    return () => {
      audio.pause();
      audioRef.current = null;
    };
  // autoplay is intentionally excluded: we only want this to run when src changes
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src]);

  const handlePlay = () => {
    audioRef.current?.play().catch(() => {});
    playedRef.current = true;
    onClick?.();
  };

  // ── Speaker icon ────────────────────────────────────────────────────────
  const speakerIcon = icon ? (
    <span
      className={[
        "absolute z-10 flex items-center justify-center",
        "w-8 h-8 rounded-full",
        "bg-(--accent) text-white shadow-sm",
        "transition-transform duration-150 hover:scale-110 active:scale-95",
        position === "right" ? "top-1/2 -translate-y-1/2 -right-5" : "-bottom-4 left-1/2 -translate-x-1/2",
      ].join(" ")}
      aria-hidden="true"
    >
      {/* Speaker / volume-up SVG */}
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
        <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
        <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
      </svg>
    </span>
  ) : null;

  // ── Render ──────────────────────────────────────────────────────────────
  return (
    <div
      role="button"
      tabIndex={0}
      aria-label="Play sound"
      onClick={handlePlay}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && handlePlay()}
      className={[
        "group relative text-center cursor-pointer select-none",
        "transition-transform duration-150 active:scale-[.93]",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--accent)",
        className,
      ].join(" ")}
    >
      {speakerIcon}
      {children}
    </div>
  );
}
