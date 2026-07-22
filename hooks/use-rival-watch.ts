"use client";

import { useEffect, useRef } from "react";
import { getRivalService } from "@/services/engagement.service";

// ── localStorage snapshot ─────────────────────────────────────────────────────

interface RankSnapshot {
  /** The user's rank (position) in the weekly leaderboard at last visit. */
  rank: number;
  /** Name of the rival who was above the user at last visit (for the toast). */
  aboveName: string | null;
}

function snapshotKey(userId: number): string {
  return `dots.rival.rank.${userId}`;
}

function readSnapshot(userId: number): RankSnapshot | null {
  try {
    const raw = window.localStorage.getItem(snapshotKey(userId));
    if (!raw) return null;
    return JSON.parse(raw) as RankSnapshot;
  } catch {
    return null;
  }
}

function writeSnapshot(userId: number, snap: RankSnapshot): void {
  try {
    window.localStorage.setItem(snapshotKey(userId), JSON.stringify(snap));
  } catch {
    // storage quota — ignore
  }
}

// ── Toast helper ──────────────────────────────────────────────────────────────

function showOvertakeToast(message: string): void {
  if (typeof document === "undefined") return;

  const el = document.createElement("div");
  el.textContent = message;
  el.setAttribute("role", "status");
  el.setAttribute("aria-live", "polite");

  Object.assign(el.style, {
    position: "fixed",
    bottom: "5rem",
    left: "50%",
    transform: "translateX(-50%) translateY(20px)",
    opacity: "0",
    transition: "opacity 0.3s ease, transform 0.3s ease",
    background: "var(--accent, #6c63ff)",
    color: "var(--accent-foreground, #fff)",
    padding: "0.75rem 1.25rem",
    borderRadius: "1rem",
    fontWeight: "700",
    fontSize: "0.9rem",
    zIndex: "9999",
    pointerEvents: "auto",
    cursor: "pointer",
    maxWidth: "90vw",
    textAlign: "center",
    boxShadow: "0 4px 16px rgba(0,0,0,0.18)",
  });

  document.body.appendChild(el);

  // Animate in
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      el.style.opacity = "1";
      el.style.transform = "translateX(-50%) translateY(0)";
    });
  });

  // Dismiss on tap or after 4s
  const dismiss = () => {
    el.style.opacity = "0";
    el.style.transform = "translateX(-50%) translateY(20px)";
    setTimeout(() => {
      if (el.parentNode) el.parentNode.removeChild(el);
    }, 350);
  };

  el.addEventListener("click", dismiss);
  setTimeout(dismiss, 4000);
}

// ── Hook ──────────────────────────────────────────────────────────────────────

/**
 * Fetches the current user's rival data on mount.  If the user's rank improved
 * since the last visit (stored in localStorage keyed per user id), shows a
 * celebratory toast.  Always updates the snapshot with the current rank.
 *
 * Safe to call anywhere inside the app — idempotent, fire-and-forget.
 */
export function useRivalWatch(): void {
  // Prevent double-fire in React StrictMode
  const ranRef = useRef(false);

  useEffect(() => {
    if (ranRef.current) return;
    ranRef.current = true;

    // Resolve user id from localStorage (same pattern as use-game-records.ts)
    const userId: number | null = (() => {
      try {
        const raw = window.localStorage.getItem("user");
        if (!raw) return null;
        const parsed = JSON.parse(raw) as { id?: number };
        return typeof parsed.id === "number" ? parsed.id : null;
      } catch {
        return null;
      }
    })();

    if (userId === null) return;

    const prevSnap = readSnapshot(userId);

    getRivalService().then((rival) => {
      if (!rival) return;

      // Determine current rank:
      // - above !== null → user is ranked (not #1 if also below !== null, or #1 if above=null)
      // - If user is in the leaderboard at all, we can estimate rank from
      //   position context: above=null means rank=1; above=something means rank>1.
      // We store a numeric rank approximation based on what we know.
      // Since the endpoint gives neighbours, not the user's own rank directly,
      // we use a proxy: if above is null, rank=1; otherwise rank=prev_rank (unknown).
      // Better: we track improvement as "above changed to null" (overtook the rival).

      const currentAboveName = rival.above?.name ?? null;

      // Detect overtake: previous session had an above-rival, now they're gone
      // (above is null = user is #1) OR the above.name changed (user climbed past).
      if (prevSnap !== null) {
        const hadRival = prevSnap.aboveName !== null;
        const lostRival =
          hadRival &&
          (currentAboveName === null ||
            currentAboveName !== prevSnap.aboveName);

        if (lostRival) {
          if (currentAboveName === null) {
            // User is now #1
            showOvertakeToast(`🎉 ¡Superaste a ${prevSnap.aboveName} y eres el #1!`);
          } else {
            // Climbed past the old rival (now chasing someone else)
            showOvertakeToast(`😤 ¡Superaste a ${prevSnap.aboveName}! Sigue subiendo.`);
          }
        } else if (
          prevSnap.rank !== undefined &&
          rival.above === null &&
          prevSnap.rank > 1
        ) {
          // Fallback: if we stored a rank > 1 before and now above is null
          showOvertakeToast(`🎉 ¡Llegaste al puesto #1 de la semana!`);
        }
      }

      // Compute current rank estimate for next visit.
      // above=null and the leaderboard has rows → rank 1.
      // above=something → we don't know exact rank, carry prev rank or default high.
      const currentRank = rival.above === null ? 1 : (prevSnap?.rank ?? 999);

      writeSnapshot(userId, {
        rank: currentRank,
        aboveName: currentAboveName,
      });
    });
    // No cleanup needed — fire-and-forget
  }, []);
}
