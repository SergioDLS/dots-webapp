interface AnswerFlashProps {
  /** "" | "correct" | "wrong" — nothing renders while "" */
  state: string;
  /** Suppress the banner entirely (exam flows) */
  silent?: boolean;
}

export default function AnswerFlash({ state, silent = false }: AnswerFlashProps) {
  if (silent || state === "") return null;
  const correct = state === "correct";
  return (
    <div
      className="flex items-center gap-3 w-full px-5 py-3.5 rounded-2xl text-sm font-extrabold"
      style={{
        animation: "dots-pop-in 0.35s ease-out both",
        background: correct
          ? "linear-gradient(135deg, rgba(34,197,94,0.15), rgba(16,185,129,0.08))"
          : "linear-gradient(135deg, rgba(244,63,94,0.15), rgba(239,68,68,0.08))",
        border: correct
          ? "2px solid rgba(34,197,94,0.4)"
          : "2px solid rgba(244,63,94,0.4)",
        color: correct ? "var(--success)" : "var(--danger)",
      }}
    >
      <span
        className="text-2xl leading-none"
        style={{ animation: "dots-pop-in 0.5s ease-out both" }}
      >
        {correct ? "🎉" : "😅"}
      </span>
      <span>{correct ? "Great job!" : "Keep going!"}</span>
    </div>
  );
}
