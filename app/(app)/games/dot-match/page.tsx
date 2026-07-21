"use client";

import React, {
  Suspense,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";
import GameIntro from "@/components/games/shared/game-intro";
import GameResult from "@/components/games/shared/game-result";
import Spinner from "@/components/ui/Spinner/Spinner";
import { getMatchPairsService, type MatchPair } from "@/services/games.service";
import { useCountdown } from "@/hooks/use-countdown";
import { useGameRecords } from "@/hooks/use-game-records";
import { useTournamentMode } from "@/hooks/use-tournament-mode";
import { playSound } from "@/lib/feedback-sounds";

// ── Constants ─────────────────────────────────────────────────────────────────

const ROUNDS = [
  { seconds: 60, target: 15 },
  { seconds: 45, target: 20 },
  { seconds: 30, target: 25 },
] as const;

const BOARD_ROWS = 5; // visible rows per column
const SHAKE_MS = 500;
const BANNER_MS = 1200;
const SCORE_PER_MATCH = 10;
const SCORE_MAX_COMBO = 5; // multiplier on maxCombo at end

type Phase = "intro" | "playing" | "banner" | "result";

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Fisher-Yates in-place shuffle (mutates). */
function shuffleInPlace<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/** Slot in a board column. */
type Slot = {
  pairId: number; // which MatchPair this slot belongs to
  text: string; // displayed text
  side: "en" | "es";
  leaving: boolean; // animating out
};

/** Build the initial 5-slot column from the first 5 queue items. */
function buildColumn(
  items: MatchPair[],
  side: "en" | "es",
): Slot[] {
  return items.map((p) => ({ pairId: p.id, text: side === "en" ? p.en : p.es, side, leaving: false }));
}

// ── Seed reader (inside Suspense boundary) ────────────────────────────────────

function DotMatchGame() {
  const searchParams = useSearchParams();
  const seedParam = searchParams.get("seed");
  const seed =
    seedParam !== null && seedParam !== ""
      ? parseInt(seedParam, 10)
      : undefined;
  return <DotMatchInner seed={seed} />;
}

// ── Main game component ───────────────────────────────────────────────────────

function DotMatchInner({ seed }: { seed?: number }) {
  const router = useRouter();
  const { record, throne } = useGameRecords("dot-match");
  const { submitTournamentScore } = useTournamentMode();

  const [phase, setPhase] = useState<Phase>("intro");
  const [allPairs, setAllPairs] = useState<MatchPair[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  // Round state
  const [round, setRound] = useState(0); // 0-indexed
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [maxCombo, setMaxCombo] = useState(0);
  const [roundMatches, setRoundMatches] = useState(0); // matches in current round

  // Board state
  const [leftCol, setLeftCol] = useState<Slot[]>([]);
  const [rightCol, setRightCol] = useState<Slot[]>([]);
  const [selLeft, setSelLeft] = useState<number | null>(null); // index in leftCol
  const [selRight, setSelRight] = useState<number | null>(null); // index in rightCol
  // shake holds the indices of both slots involved in a wrong match
  const [shake, setShake] = useState<{ left: number; right: number } | null>(null);
  const shakeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Queue pointer (we consume from a shuffled queue)
  const queueRef = useRef<MatchPair[]>([]);
  const queueIdxRef = useRef(0);

  // Banner "¡Ronda 2!" / "¡Ronda 3!"
  const [bannerText, setBannerText] = useState("");
  const bannerTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Prevent double-processing during animations
  const processingRef = useRef(false);

  // Tracks pairIds currently visible on the board (used by nextPair recycler)
  const onBoardIdsRef = useRef<Set<number>>(new Set());

  // ── Countdown (changes per round) ────────────────────────────────────────
  const currentRound = ROUNDS[Math.min(round, ROUNDS.length - 1)];

  const handleTimeUp = useCallback(() => {
    // Time ran out — end the game with accumulated score
    setPhase("result");
  }, []);

  const { remaining, start: startCountdown, stop: stopCountdown } = useCountdown(
    currentRound.seconds,
    handleTimeUp,
  );

  // ── Load pairs once ───────────────────────────────────────────────────────
  useEffect(() => {
    let active = true;
    getMatchPairsService(seed)
      .then((data) => {
        if (active) setAllPairs(data);
      })
      .catch(() => {
        if (active) setLoadError(true);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [seed]);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (bannerTimerRef.current) clearTimeout(bannerTimerRef.current);
      if (shakeTimerRef.current) clearTimeout(shakeTimerRef.current);
    };
  }, []);

  // Keep on-board id set in sync with the left column (pairIds are shared across both columns)
  useEffect(() => {
    onBoardIdsRef.current = new Set(leftCol.map((s) => s.pairId));
  }, [leftCol]);

  // ── Queue helpers ─────────────────────────────────────────────────────────

  /** Get next pair from queue, recycling if exhausted.
   *  On recycle, excludes pairs whose pairId is still on the board
   *  to avoid dealing the same word twice simultaneously. */
  const nextPair = useCallback((): MatchPair => {
    const q = queueRef.current;
    if (queueIdxRef.current >= q.length) {
      // Derive currently-displayed pairIds from the left column state.
      // We use a functional updater form to read the latest leftCol without
      // capturing it in the closure (avoids stale-closure issues).
      // Instead, store on-board ids in a ref updated each render.
      const onBoardIds = onBoardIdsRef.current;
      const filtered = q.filter((p) => !onBoardIds.has(p.id));
      // Fall back to full queue if exclusion empties the pool (tiny pool edge case)
      const recyclePool = filtered.length > 0 ? filtered : [...q];
      shuffleInPlace(recyclePool);
      queueRef.current = recyclePool;
      queueIdxRef.current = 0;
    }
    return queueRef.current[queueIdxRef.current++];
  }, []);

  // ── Board initialization ──────────────────────────────────────────────────

  const initBoard = useCallback((pool: MatchPair[]) => {
    // Build a fresh queue for this round segment
    const q = shuffleInPlace([...pool]);
    queueRef.current = q;
    queueIdxRef.current = 0;

    // Pull first BOARD_ROWS pairs for initial board
    // (pool is guaranteed >= BOARD_ROWS by service contract; no recycle needed here)
    const initialPairs: MatchPair[] = [];
    for (let i = 0; i < BOARD_ROWS; i++) {
      initialPairs.push(q[queueIdxRef.current++]);
    }

    // Left col: EN words in order; right col: ES meanings shuffled independently
    const leftSlots = buildColumn(initialPairs, "en");
    const rightSlots = shuffleInPlace(buildColumn(initialPairs, "es"));
    setLeftCol(leftSlots);
    setRightCol(rightSlots);
    setSelLeft(null);
    setSelRight(null);
    processingRef.current = false;
  }, []);

  // ── Start game ────────────────────────────────────────────────────────────

  const startGame = useCallback(() => {
    if (allPairs.length === 0) return;
    // Clear any in-flight banner timer from a previous run
    if (bannerTimerRef.current) {
      clearTimeout(bannerTimerRef.current);
      bannerTimerRef.current = null;
    }
    if (shakeTimerRef.current) {
      clearTimeout(shakeTimerRef.current);
      shakeTimerRef.current = null;
    }
    setRound(0);
    setScore(0);
    setCombo(0);
    setMaxCombo(0);
    setRoundMatches(0);
    setShake(null);
    initBoard(allPairs);
    setPhase("playing");
    // Countdown starts via effect below when phase changes to "playing"
  }, [allPairs, initBoard]);

  // Start countdown when entering "playing" phase (and when round changes)
  const roundRef = useRef(round);
  useEffect(() => {
    roundRef.current = round;
  }, [round]);

  useEffect(() => {
    if (phase === "playing") {
      startCountdown();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, round]);

  // ── Handle a match attempt ────────────────────────────────────────────────

  const processMatch = useCallback(
    (lIdx: number, rIdx: number) => {
      if (processingRef.current) return;
      const lSlot = leftCol[lIdx];
      const rSlot = rightCol[rIdx];
      if (!lSlot || !rSlot) return;

      if (lSlot.pairId === rSlot.pairId) {
        // Correct match
        processingRef.current = true;
        playSound("correct");

        const newCombo = combo + 1;
        const newMaxCombo = Math.max(maxCombo, newCombo);
        setCombo(newCombo);
        setMaxCombo(newMaxCombo);
        const newScore = score + SCORE_PER_MATCH;
        setScore(newScore);

        const newRoundMatches = roundMatches + 1;
        setRoundMatches(newRoundMatches);

        // Mark both slots as leaving
        setLeftCol((prev) =>
          prev.map((s, i) => (i === lIdx ? { ...s, leaving: true } : s)),
        );
        setRightCol((prev) =>
          prev.map((s, i) => (i === rIdx ? { ...s, leaving: true } : s)),
        );
        setSelLeft(null);
        setSelRight(null);

        // After animation, refill the freed slots
        setTimeout(() => {
          const replacement = nextPair();
          setLeftCol((prev) =>
            prev.map((s, i) =>
              i === lIdx
                ? { pairId: replacement.id, text: replacement.en, side: "en", leaving: false }
                : s,
            ),
          );
          setRightCol((prev) => {
            // Place ES replacement at the vacated slot
            const updated = prev.map((s, i) =>
              i === rIdx
                ? { pairId: replacement.id, text: replacement.es, side: "es" as const, leaving: false }
                : s,
            );
            return updated;
          });
          processingRef.current = false;

          // Check if round target reached
          const currentRoundDef = ROUNDS[roundRef.current];
          if (newRoundMatches >= currentRoundDef.target) {
            const nextRound = roundRef.current + 1;
            if (nextRound >= ROUNDS.length) {
              // Completed all rounds
              stopCountdown();
              setPhase("result");
            } else {
              stopCountdown();
              const text = nextRound === 1 ? "¡Ronda 2!" : "¡Ronda 3!";
              setBannerText(text);
              setPhase("banner");
              bannerTimerRef.current = setTimeout(() => {
                setRound(nextRound);
                setRoundMatches(0);
                initBoard(allPairs);
                setPhase("playing");
              }, BANNER_MS);
            }
          }
        }, 250); // matches the CSS transition duration
      } else {
        // Wrong match
        playSound("wrong");
        setCombo(0);

        // Shake animation: store the tapped indices so JSX can gate on them
        // independently of selection state (which we clear immediately below)
        setShake({ left: lIdx, right: rIdx });
        if (shakeTimerRef.current) clearTimeout(shakeTimerRef.current);
        shakeTimerRef.current = setTimeout(() => {
          setShake(null);
          shakeTimerRef.current = null;
        }, SHAKE_MS);

        setSelLeft(null);
        setSelRight(null);
      }
    },
    [
      leftCol,
      rightCol,
      combo,
      maxCombo,
      score,
      roundMatches,
      nextPair,
      stopCountdown,
      initBoard,
      allPairs,
    ],
  );

  // ── Tap handlers ──────────────────────────────────────────────────────────

  const tapLeft = useCallback(
    (idx: number) => {
      if (phase !== "playing" || processingRef.current) return;
      if (leftCol[idx]?.leaving) return;

      if (selLeft === idx) {
        // Deselect
        setSelLeft(null);
        return;
      }
      setSelLeft(idx);
      if (selRight !== null) {
        processMatch(idx, selRight);
      }
    },
    [phase, leftCol, selLeft, selRight, processMatch],
  );

  const tapRight = useCallback(
    (idx: number) => {
      if (phase !== "playing" || processingRef.current) return;
      if (rightCol[idx]?.leaving) return;

      if (selRight === idx) {
        // Deselect
        setSelRight(null);
        return;
      }
      setSelRight(idx);
      if (selLeft !== null) {
        processMatch(selLeft, idx);
      }
    },
    [phase, rightCol, selRight, selLeft, processMatch],
  );

  // ── Derived values ────────────────────────────────────────────────────────

  const timeLeft = Math.ceil(remaining);
  const timeColor =
    timeLeft <= 10
      ? "var(--danger)"
      : timeLeft <= 20
        ? "var(--gold)"
        : "var(--accent)";

  const finalScore = score + maxCombo * SCORE_MAX_COMBO;

  // Submit tournament score once when result phase is reached
  useEffect(() => {
    if (phase === "result") submitTournamentScore(finalScore);
  }, [phase]); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner title="Cargando parejas…" />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="text-lg font-bold" style={{ color: "var(--foreground)" }}>
          No se pudieron cargar las parejas.
        </p>
        <p className="text-sm" style={{ color: "var(--muted)" }}>
          Comprueba tu conexión e inténtalo de nuevo.
        </p>
        <button
          onPointerUp={() => {
            setLoadError(false);
            setLoading(true);
            getMatchPairsService(seed)
              .then((data) => setAllPairs(data))
              .catch(() => setLoadError(true))
              .finally(() => setLoading(false));
          }}
          className="dots-pressable rounded-2xl px-6 py-3 text-sm font-bold"
          style={{
            background: "var(--accent)",
            color: "var(--accent-foreground)",
          }}
        >
          Reintentar
        </button>
      </div>
    );
  }

  return (
    <div className="relative flex min-h-screen w-full flex-col items-center overflow-hidden px-4 py-6">
      {/* Background glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-32 -left-24 h-80 w-80 rounded-full opacity-20 blur-3xl"
        style={{ background: "var(--accent)" }}
      />

      {/* ── Intro ── */}
      {phase === "intro" && (
        <>
          <div className="z-10 flex w-full max-w-sm justify-start">
            <button
              onPointerUp={() => router.push("/play")}
              className="text-sm font-bold transition-colors"
              style={{ color: "var(--muted)" }}
            >
              ← Salir
            </button>
          </div>
          <GameIntro
            emoji="🔗"
            title="Dot Match"
            howTo={[
              "Toca una palabra en inglés (izquierda) y su traducción en español (derecha).",
              "Si forman pareja: ¡desaparecen y entran nuevas!",
              "Si te equivocas: combo roto y un pequeño temblor.",
              "3 rondas con más pares cada vez. ¡Combo máximo suma puntos al final!",
            ]}
            record={record}
            throne={throne}
            onStart={startGame}
          />
        </>
      )}

      {/* ── Banner entre rondas ── */}
      {phase === "banner" && (
        <div className="flex min-h-screen w-full flex-col items-center justify-center">
          <div
            className="font-display text-5xl font-extrabold text-center"
            style={{
              color: "var(--accent)",
              animation: "dots-pop-in 0.3s ease-out both",
            }}
          >
            {bannerText}
          </div>
          <p className="mt-3 text-base font-bold" style={{ color: "var(--muted)" }}>
            ¡Prepárate!
          </p>
        </div>
      )}

      {/* ── Playing ── */}
      {phase === "playing" && (
        <>
          {/* Top bar */}
          <div
            className="dots-card z-10 flex w-full max-w-sm items-center justify-between gap-3 px-4 py-3"
            style={{ marginBottom: "0.75rem" }}
          >
            <button
              onPointerUp={() => { stopCountdown(); setPhase("result"); }}
              className="text-sm font-bold transition-colors"
              style={{ color: "var(--muted)" }}
            >
              ← Salir
            </button>
            {/* Round indicator */}
            <div className="flex flex-col items-center">
              <span className="text-xs font-black uppercase tracking-widest" style={{ color: "var(--muted)" }}>
                Ronda {round + 1}/3
              </span>
              <span
                className="font-display text-2xl font-extrabold tabular-nums"
                style={{ color: timeColor }}
              >
                {timeLeft}s
              </span>
            </div>
            {/* Score + combo */}
            <div className="flex flex-col items-end gap-0.5">
              <span className="text-xs font-black uppercase tracking-widest" style={{ color: "var(--muted)" }}>
                Puntos
              </span>
              <span className="font-display text-lg font-extrabold" style={{ color: "var(--accent)" }}>
                {score}
              </span>
            </div>
          </div>

          {/* Progress + combo row */}
          <div className="z-10 flex w-full max-w-sm items-center justify-between px-1 mb-3">
            <span className="text-xs font-bold" style={{ color: "var(--muted)" }}>
              {roundMatches}/{ROUNDS[round]?.target ?? 0} parejas
            </span>
            {combo > 0 && (
              <span
                className="rounded-full px-3 py-0.5 text-xs font-black"
                style={{
                  background: "color-mix(in srgb, var(--gold) 20%, transparent)",
                  color: "var(--gold-edge)",
                  border: "2px solid color-mix(in srgb, var(--gold) 50%, transparent)",
                  animation: "dots-pop-in 0.15s ease-out both",
                }}
              >
                🔥 {combo}
              </span>
            )}
          </div>

          {/* Board */}
          <div className="z-10 flex w-full max-w-sm gap-3">
            {/* Left column — EN */}
            <div className="flex flex-1 flex-col gap-2">
              {leftCol.map((slot, idx) => {
                const selected = selLeft === idx;
                const shaking = shake !== null && shake.left === idx;
                return (
                  <button
                    key={`left-${idx}-${slot.pairId}`}
                    onPointerUp={() => tapLeft(idx)}
                    className="dots-pressable w-full rounded-2xl border-2 px-3 py-3 text-center text-sm font-bold select-none"
                    style={{
                      borderColor: selected
                        ? "var(--accent)"
                        : "var(--border)",
                      background: selected
                        ? "color-mix(in srgb, var(--accent) 12%, transparent)"
                        : "var(--surface)",
                      color: "var(--foreground)",
                      opacity: slot.leaving ? 0 : 1,
                      transform: slot.leaving
                        ? "scale(0.8)"
                        : shaking
                          ? "translateX(4px)"
                          : "scale(1)",
                      transition: slot.leaving
                        ? "opacity 0.25s ease, transform 0.25s ease"
                        : shaking
                          ? "transform 0.05s ease"
                          : "border-color 0.15s, background 0.15s, opacity 0.25s, transform 0.25s",
                      minHeight: "3rem",
                      ["--press-color" as string]: "var(--accent-soft)",
                    }}
                    aria-label={`EN: ${slot.text}`}
                  >
                    {slot.text}
                  </button>
                );
              })}
            </div>

            {/* Right column — ES */}
            <div className="flex flex-1 flex-col gap-2">
              {rightCol.map((slot, idx) => {
                const selected = selRight === idx;
                const shaking = shake !== null && shake.right === idx;
                return (
                  <button
                    key={`right-${idx}-${slot.pairId}`}
                    onPointerUp={() => tapRight(idx)}
                    className="dots-pressable w-full rounded-2xl border-2 px-3 py-3 text-center text-sm font-bold select-none"
                    style={{
                      borderColor: selected
                        ? "var(--accent)"
                        : "var(--border)",
                      background: selected
                        ? "color-mix(in srgb, var(--accent) 12%, transparent)"
                        : "var(--surface)",
                      color: "var(--foreground)",
                      opacity: slot.leaving ? 0 : 1,
                      transform: slot.leaving
                        ? "scale(0.8)"
                        : shaking
                          ? "translateX(-4px)"
                          : "scale(1)",
                      transition: slot.leaving
                        ? "opacity 0.25s ease, transform 0.25s ease"
                        : shaking
                          ? "transform 0.05s ease"
                          : "border-color 0.15s, background 0.15s, opacity 0.25s, transform 0.25s",
                      minHeight: "3rem",
                      ["--press-color" as string]: "var(--accent-soft)",
                    }}
                    aria-label={`ES: ${slot.text}`}
                  >
                    {slot.text}
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}

      {/* ── Result ── */}
      {phase === "result" && (
        <GameResult
          gameKey="dot-match"
          score={finalScore}
          onReplay={startGame}
          onExit={() => router.push("/play")}
        />
      )}
    </div>
  );
}

// ── Page export with Suspense gate ────────────────────────────────────────────

export default function DotMatchPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <Spinner title="Cargando…" />
        </div>
      }
    >
      <DotMatchGame />
    </Suspense>
  );
}
