"use client";

import { useEffect, useRef } from "react";
import { getRivalService } from "@/services/engagement.service";

// ── localStorage snapshot ─────────────────────────────────────────────────────

interface RankSnapshot {
  /** The user's 1-based rank in the weekly leaderboard at last visit. */
  rank: number | null;
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

/**
 * Shows a self-dismissing toast and returns a cleanup function that cancels
 * the auto-dismiss timer and removes the DOM node if still attached.
 */
function showOvertakeToast(message: string): () => void {
  if (typeof document === "undefined") return () => {};

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

  let dismissed = false;

  const dismiss = () => {
    if (dismissed) return;
    dismissed = true;
    el.style.opacity = "0";
    el.style.transform = "translateX(-50%) translateY(20px)";
    setTimeout(() => {
      if (el.parentNode) el.parentNode.removeChild(el);
    }, 350);
  };

  el.addEventListener("click", dismiss);
  const timerId = setTimeout(dismiss, 4000);

  // Return cleanup: cancel the timer and remove the node immediately
  return () => {
    clearTimeout(timerId);
    if (el.parentNode) el.parentNode.removeChild(el);
  };
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
  // Holds the cleanup for any toast that was shown during this mount
  const toastCleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (ranRef.current) return;
    ranRef.current = true;

    let active = true;

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
      if (!active) return;
      if (!rival) return;

      const { rank } = rival;

      // Fire toast only when rank genuinely improved (lower number = better rank).
      // First-ever load (prevSnap === null) never toasts.
      if (
        prevSnap !== null &&
        prevSnap.rank != null &&
        rank != null &&
        rank < prevSnap.rank
      ) {
        toastCleanupRef.current = showOvertakeToast(
          `🎉 ¡Subiste al puesto #${rank} de la semana!`,
        );
      }

      // Always persist the current rank (even when null = unranked)
      writeSnapshot(userId, { rank });
    });

    return () => {
      active = false;
      // Clear the auto-dismiss timer and remove the toast node on unmount
      if (toastCleanupRef.current) {
        toastCleanupRef.current();
        toastCleanupRef.current = null;
      }
    };
  }, []);
}
