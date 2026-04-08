"use client";

import { useEffect, useRef, useState } from "react";
import { BASE_URL_SOUNDS } from "@/constants";

/* ── Inject keyframes once ─────────────────────────────────── */
if (typeof document !== "undefined") {
  const ID = "__snd_kf__";
  if (!document.getElementById(ID)) {
    const s = document.createElement("style");
    s.id = ID;
    s.textContent = `
      @keyframes snd-ping {
        0%   { transform: scale(1);   opacity: 0.7; }
        70%  { transform: scale(1.8); opacity: 0; }
        100% { transform: scale(1.8); opacity: 0; }
      }
      @keyframes snd-bounce {
        0%,100% { transform: translateY(0); }
        40%     { transform: translateY(-2px); }
      }
    `;
    document.head.appendChild(s);
  }
}

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
  const playedRef = useRef(false);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    const audio = new Audio(`${BASE_URL_SOUNDS}/${src}`);
    audioRef.current = audio;
    playedRef.current = false;

    const onEnd = () => setPlaying(false);
    audio.addEventListener("ended", onEnd);

    if (autoplay) {
      audio.play().catch(() => {});
      playedRef.current = true;
      setPlaying(true);
    }

    return () => {
      audio.removeEventListener("ended", onEnd);
      audio.pause();
      audioRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src]);

  const handlePlay = () => {
    if (audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch(() => {});
    }
    playedRef.current = true;
    setPlaying(true);
    onClick?.();
  };

  // ── Speaker icon ────────────────────────────────────────────────────────
  const speakerIcon = icon ? (
    <span
      className={[
        "absolute z-10 flex items-center justify-center",
        "w-6 h-6 rounded-full cursor-pointer",
        "transition-all duration-200 hover:scale-125 active:scale-95",
        position === "right"
          ? "top-1/2 -translate-y-1/2 -right-3.5"
          : "-top-4 -right-4",
      ].join(" ")}
      style={{
        background: "var(--accent)",
        opacity: playing ? 0.95 : 0.45,
        color: "#fff",
        animation: playing ? "snd-bounce 0.6s ease-in-out infinite" : "none",
      }}
      aria-hidden="true"
    >
      {/* Ping ring when playing */}
      {playing && (
        <span
          className="absolute inset-0 rounded-full"
          style={{
            border: "2px solid var(--accent)",
            animation: "snd-ping 1s ease-out infinite",
          }}
        />
      )}
      {/* 🔊 mini icon */}
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
        {playing && <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />}
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
