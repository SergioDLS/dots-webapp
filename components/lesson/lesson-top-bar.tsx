import LoadBar from "@/components/ui/load-bar/load-bar";

interface LessonTopBarProps {
  progress: number;
  streak?: number | null;
  /** When provided, renders the hearts row before the progress bar */
  hearts?: { lifes: number; total: number };
}

export default function LessonTopBar({ progress, streak = null, hearts }: LessonTopBarProps) {
  return (
    <div className="dots-card flex items-center gap-3 w-full px-4 py-3">
      {/* Hearts */}
      {hearts && (
        <div className="flex items-center gap-1 shrink-0">
          {Array.from({ length: hearts.total }).map((_, i) => {
            const alive = i < hearts.lifes;
            const critical = hearts.lifes <= 2 && alive;
            return (
              <span
                key={i}
                className="text-xl leading-none select-none"
                style={{
                  filter: alive ? "none" : "grayscale(1)",
                  opacity: alive ? 1 : 0.25,
                  animation: critical
                    ? "dots-heart-pop 0.8s ease-in-out infinite"
                    : !alive
                      ? "dots-heart-break 0.5s ease forwards"
                      : "none",
                  animationDelay: critical ? `${i * 0.15}s` : "0s",
                }}
              >
                ❤️
              </span>
            );
          })}
        </div>
      )}

      {/* Progress bar */}
      <div className="flex-1">
        <LoadBar progress={progress} streak={streak} />
      </div>
    </div>
  );
}
