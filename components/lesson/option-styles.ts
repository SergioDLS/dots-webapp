import type React from "react";

// ── Option visual state ───────────────────────────────────────────────────────
export type OptionState = "idle" | "selected" | "correct" | "wrong" | "reveal-correct" | "reveal-wrong";

export function getOptionState(selected: boolean, answered: string, correct: boolean): OptionState {
  if (answered === "") return selected ? "selected" : "idle";
  if (selected && answered === "correct") return "correct";
  if (selected && answered === "wrong") return "wrong";
  if (!selected && correct) return "reveal-correct";
  return "reveal-wrong";
}

/* Style map: { background, border, color, shadow, animation } */
export const optionStyles: Record<OptionState, React.CSSProperties> = {
  idle: {
    background: "var(--surface)",
    border: "2px solid var(--border)",
    color: "var(--foreground)",
  },
  selected: {
    background: "var(--surface)",
    border: "2px solid var(--accent)",
    color: "var(--accent)",
    boxShadow: "0 0 0 3px color-mix(in srgb, var(--accent) 15%, transparent)",
  },
  correct: {
    background: "linear-gradient(135deg, #22c55e, #10b981)",
    border: "2px solid #22c55e",
    color: "#fff",
    animation: "pc-correct-flash 0.6s ease-out",
  },
  wrong: {
    background: "linear-gradient(135deg, #f43f5e, #ef4444)",
    border: "2px solid #f43f5e",
    color: "#fff",
    animation: "pc-wrong-shake 0.4s ease-out",
  },
  "reveal-correct": {
    background: "rgba(34,197,94,0.12)",
    border: "2px solid rgba(34,197,94,0.5)",
    color: "#059669",
  },
  "reveal-wrong": {
    background: "var(--surface)",
    border: "2px solid var(--border)",
    color: "var(--muted)",
    opacity: 0.4,
  },
};

export const baseOptionCls =
  "flex items-center justify-center text-center rounded-2xl px-4 py-3 text-sm font-bold transition-all duration-200 cursor-pointer select-none active:scale-[.96]";
