import React from "react";
import Image from "next/image";

interface Props {
  streak?: number | null;
  progress: number;
}

const LoadBar: React.FC<Props> = ({ streak = null, progress }) => {
  const showFire = (streak ?? 0) > 2;

  /* gradient color based on progress */
  const progressGradient =
    progress >= 100
      ? "linear-gradient(90deg, #22c55e, #10b981)"
      : progress >= 80
        ? "linear-gradient(90deg, #34d399, #22c55e)"
        : progress >= 50
          ? "linear-gradient(90deg, #fbbf24, #f59e0b)"
          : progress >= 20
            ? "linear-gradient(90deg, #fb923c, #f97316)"
            : "linear-gradient(90deg, var(--accent), #f472b6)";

  return (
    <div className="w-full flex items-center gap-2.5">
      {/* Progress track */}
      <div
        className="flex-1 h-3.5 rounded-full overflow-hidden"
        style={{
          background: "var(--border)",
        }}
      >
        <div
          className="h-full rounded-full relative"
          style={{
            width: `${Math.max(progress, 2)}%`,
            background: progressGradient,
            transition: "width 0.6s cubic-bezier(0.34,1.56,0.64,1)",
            boxShadow: progress > 0 ? "0 0 8px rgba(var(--accent), 0.3)" : "none",
          }}
        >
          {/* Shimmer highlight */}
          {progress > 0 && progress < 100 && (
            <div
              className="absolute inset-0 rounded-full"
              style={{
                background:
                  "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.35) 50%, transparent 100%)",
                backgroundSize: "200% 100%",
                animation: "shimmer 2s linear infinite",
              }}
            />
          )}
        </div>
      </div>

      {/* Streak badge */}
      {streak !== null && (streak ?? 0) > 0 && (
        <div
          className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-extrabold shrink-0"
          style={{
            background: "var(--surface)",
            border: "2px solid var(--border)",
            color: "var(--foreground)",
          }}
        >
          <span className="text-sm">{streak}</span>
          {showFire && (
            <div className="w-4 h-4 relative" style={{ animation: "prac-heart-pop 1.2s ease-in-out infinite" }}>
              <Image src="/images/icons/fire.png" alt="fire" fill className="object-contain" />
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default LoadBar;
