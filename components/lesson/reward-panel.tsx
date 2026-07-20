import type { ProgressReward } from "@/services/engagement.service";

/** Day-streak milestones that earn an extra celebration */
const STREAK_MILESTONES = [3, 7, 14, 30, 50, 100];

/** Engagement reward chips: +XP / Day N / freeze (arrives async from PUT /sentences/progress) */
export default function RewardPanel({ reward }: { reward: ProgressReward | null }) {
  if (
    !reward ||
    !(reward.xpGained > 0 || reward.streakUp || reward.freezeUsed || reward.freezeEarned)
  ) {
    return null;
  }

  return (
    <div
      className="flex flex-col items-center gap-2"
      style={{ animation: "dots-pop-in 0.4s ease-out both" }}
    >
      <div className="flex flex-wrap items-center justify-center gap-2">
        {reward.xpGained > 0 && (
          <span
            className="rounded-full px-4 py-1.5 text-sm font-black"
            style={{
              background: "color-mix(in srgb, var(--gold) 18%, transparent)",
              border: "2px solid color-mix(in srgb, var(--gold) 45%, transparent)",
              color: "var(--gold-edge)",
            }}
          >
            ✨ +{reward.xpGained} XP
          </span>
        )}
        {reward.streakUp && (
          <span
            className="rounded-full px-4 py-1.5 text-sm font-black"
            style={{
              background: "rgba(251,191,36,0.15)",
              border: "2px solid rgba(251,191,36,0.4)",
              color: "var(--gold-edge)",
            }}
          >
            🔥 Day {reward.streak}
          </span>
        )}
        {reward.freezeUsed && (
          <span
            className="rounded-full px-4 py-1.5 text-sm font-black"
            style={{
              background: "rgba(56,189,248,0.14)",
              border: "2px solid rgba(56,189,248,0.4)",
              color: "#0284c7",
            }}
          >
            ❄️ A streak freeze saved your streak!
          </span>
        )}
        {reward.freezeEarned && (
          <span
            className="rounded-full px-4 py-1.5 text-sm font-black"
            style={{
              background: "rgba(56,189,248,0.14)",
              border: "2px solid rgba(56,189,248,0.4)",
              color: "#0284c7",
            }}
          >
            ❄️ +1 streak freeze earned!
          </span>
        )}
      </div>
      {reward.streakUp && STREAK_MILESTONES.includes(reward.streak) && (
        <p
          className="font-display text-xl font-extrabold text-center"
          style={{
            background:
              "linear-gradient(135deg, var(--accent), #fbbf24, #f97316)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            animation: "pc-streak-glow 2s ease-in-out infinite",
          }}
        >
          🎉 {reward.streak}-day streak — amazing!
        </p>
      )}
    </div>
  );
}
