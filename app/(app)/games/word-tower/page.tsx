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
import {
  getWordTowerService,
  type TowerRound,
} from "@/services/games.service";
import { useTicker } from "@/hooks/use-ticker";
import { playSound } from "@/lib/feedback-sounds";

// ── Constants ─────────────────────────────────────────────────────────────────

const TOTAL_ROUNDS = 20;
const MAX_LIVES = 3;
const FALL_DURATION_INITIAL = 5000; // ms for round 1
const FALL_DURATION_STEP = 150; // ms reduction per round
const FALL_DURATION_MIN = 2500; // floor
const CORRECTION_MS = 1000; // show correct answer for 1s after miss
const BETWEEN_ROUNDS_MS = 400; // pause before next word
const TICKER_FPS = 60;

type Phase = "intro" | "playing" | "result";
// "falling"  — word is in the air, ticker running
// "correction" — briefly showing the right answer (ticker paused)
// "between"  — tiny pause before the next word (ticker paused)
type RoundPhase = "falling" | "correction" | "between";

// ── Seed reader (inside Suspense boundary) ────────────────────────────────────

function WordTowerGame() {
  const searchParams = useSearchParams();
  const seedParam = searchParams.get("seed");
  const seed =
    seedParam !== null && seedParam !== ""
      ? parseInt(seedParam, 10)
      : undefined;
  return <WordTowerInner seed={seed} />;
}

// ── Shuffle helper (client-side re-order of lane buttons each round) ──────────

function shuffled<T>(arr: T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// ── Main game component ───────────────────────────────────────────────────────

function WordTowerInner({ seed }: { seed?: number }) {
  const router = useRouter();

  const [phase, setPhase] = useState<Phase>("intro");
  const [rounds, setRounds] = useState<TowerRound[]>([]);
  const [loading, setLoading] = useState(true); // true = initial fetch in progress
  const [loadError, setLoadError] = useState(false);

  // Game state
  const [roundIndex, setRoundIndex] = useState(0);
  const [lives, setLives] = useState(MAX_LIVES);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [progress, setProgress] = useState(0); // 0 → 1 during fall

  // Round sub-phase and lane buttons order
  const [roundPhase, setRoundPhase] = useState<RoundPhase>("falling");
  const [laneOptions, setLaneOptions] = useState<string[]>([]);
  const [correctLabel, setCorrectLabel] = useState<string>("");

  // Ref guards
  const resolvedRef = useRef(false); // prevents tap + landing race
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // advanceRound + handleMissStable refs so callbacks/effects can call the
  // latest version without stale closures.
  const advanceRoundRef = useRef<() => void>(() => {});
  const handleMissRef = useRef<() => void>(() => {});

  // ── Load rounds ──────────────────────────────────────────────────────────

  // fetchRounds is used by the Reintentar button (event handler — not an effect).
  // The initial load uses a direct useEffect with the fetch inlined so the linter
  // does not trace synchronous setState calls through a callback ref.
  useEffect(() => {
    let active = true;
    getWordTowerService(seed)
      .then((data) => {
        if (active) {
          setRounds(data);
          setLoadError(false);
          setLoading(false);
        }
      })
      .catch(() => {
        if (active) {
          setLoadError(true);
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, [seed]);

  const fetchRounds = useCallback(() => {
    setLoading(true);
    setLoadError(false);
    getWordTowerService(seed)
      .then((data) => {
        setRounds(data);
        setLoadError(false);
      })
      .catch(() => setLoadError(true))
      .finally(() => setLoading(false));
  }, [seed]);

  // ── Cleanup on unmount ───────────────────────────────────────────────────

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  // ── Fall duration for the current round ─────────────────────────────────

  const fallDuration = Math.max(
    FALL_DURATION_MIN,
    FALL_DURATION_INITIAL - roundIndex * FALL_DURATION_STEP,
  );

  // ── Ticker: advances `progress` while falling ────────────────────────────

  const tickerRunning = phase === "playing" && roundPhase === "falling";

  const onTick = useCallback(
    (dtMs: number) => {
      setProgress((prev) => {
        const next = prev + dtMs / fallDuration;
        if (next >= 1) {
          return 1; // will be handled by effect below
        }
        return next;
      });
    },
    [fallDuration],
  );

  useTicker(TICKER_FPS, onTick, tickerRunning);

  const advanceRound = useCallback(() => {
    setRoundIndex((prev) => {
      const next = prev + 1;
      if (next >= TOTAL_ROUNDS) {
        setPhase("result");
        return prev;
      }
      // reset for the next round
      const nextRound = rounds[next];
      if (nextRound) {
        setLaneOptions(shuffled(nextRound.options));
        setCorrectLabel("");
      }
      resolvedRef.current = false;
      setProgress(0);
      setRoundPhase("between");
      timerRef.current = setTimeout(() => {
        setRoundPhase("falling");
      }, BETWEEN_ROUNDS_MS);
      return next;
    });
  }, [rounds]);

  // keep ref in sync
  useEffect(() => {
    advanceRoundRef.current = advanceRound;
  }, [advanceRound]);

  // Re-wire handleMiss to use the ref so it doesn't go stale
  const handleMissStable = useCallback(() => {
    playSound("wrong");
    const round = rounds[roundIndex];
    setCorrectLabel(round?.correct ?? "");
    setCombo(0);
    setLives((prev) => {
      const next = prev - 1;
      if (next <= 0) {
        setRoundPhase("correction");
        timerRef.current = setTimeout(() => {
          setPhase("result");
        }, CORRECTION_MS);
        return 0;
      }
      setRoundPhase("correction");
      timerRef.current = setTimeout(() => {
        advanceRoundRef.current();
      }, CORRECTION_MS);
      return next;
    });
  }, [rounds, roundIndex]);

  // Keep handleMissRef in sync so the landing effect can call it stably
  useEffect(() => {
    handleMissRef.current = handleMissStable;
  }, [handleMissStable]);

  // ── Detect landing (progress reaches 1) ─────────────────────────────────

  useEffect(() => {
    if (phase !== "playing" || roundPhase !== "falling") return;
    if (progress < 1) return;
    if (resolvedRef.current) return;
    resolvedRef.current = true;
    handleMissRef.current();
  }, [progress, phase, roundPhase]);

  // ── Tap a lane button ────────────────────────────────────────────────────

  const handleLaneTap = useCallback(
    (option: string) => {
      if (roundPhase !== "falling") return;
      if (resolvedRef.current) return;
      resolvedRef.current = true;

      const round = rounds[roundIndex];
      if (!round) return;

      if (option === round.correct) {
        playSound("correct");
        const newCombo = combo + 1;
        setCombo(newCombo);
        setScore((s) => s + 100 * newCombo);
        // brief between-round pause
        setRoundPhase("between");
        timerRef.current = setTimeout(() => {
          advanceRoundRef.current();
        }, BETWEEN_ROUNDS_MS);
      } else {
        handleMissStable();
      }
    },
    [roundPhase, rounds, roundIndex, combo, handleMissStable],
  );

  // ── Start / restart ──────────────────────────────────────────────────────

  const startGame = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    const firstRound = rounds[0];
    setRoundIndex(0);
    setLives(MAX_LIVES);
    setScore(0);
    setCombo(0);
    setProgress(0);
    setRoundPhase("between"); // will flip to falling after BETWEEN_ROUNDS_MS
    setCorrectLabel("");
    if (firstRound) setLaneOptions(shuffled(firstRound.options));
    resolvedRef.current = false;
    setPhase("playing");
    timerRef.current = setTimeout(() => {
      setRoundPhase("falling");
    }, BETWEEN_ROUNDS_MS);
  }, [rounds]);

  // ── Derived display ──────────────────────────────────────────────────────

  const fallY = Math.min(progress, 1) * 100; // 0 → 100 (%)
  const round = rounds[roundIndex];

  // ── Loading / error screens ──────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner title="Preparando la torre…" />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-6">
        <span className="text-4xl">😬</span>
        <p
          className="text-center text-base font-bold"
          style={{ color: "var(--foreground)" }}
        >
          No se pudo cargar la torre.
        </p>
        <button
          onPointerUp={fetchRounds}
          className="dots-pressable rounded-2xl px-6 py-3 text-sm font-black"
          style={{
            background:
              "color-mix(in srgb, var(--accent) 15%, transparent)",
            border: "2px solid var(--accent)",
            color: "var(--accent)",
          }}
        >
          Reintentar
        </button>
      </div>
    );
  }

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="relative flex min-h-screen w-full flex-col items-center overflow-hidden px-4 py-6">
      {/* Background glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-32 -left-24 h-80 w-80 rounded-full opacity-20 blur-3xl"
        style={{ background: "var(--accent)" }}
      />

      {/* ── Intro ─────────────────────────────────────────────────────── */}
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
            emoji="🗼"
            title="Torre de Palabras"
            howTo={[
              "Una palabra cae desde arriba hacia los carriles.",
              "Toca el carril con la categoría correcta ANTES de que aterrice.",
              "Acierta → +100 × combo 🔥. Falla o deja aterrizar → pierde una vida ❤️.",
              "3 vidas fuera = fin. ¡Sobrevive las 20 rondas!",
            ]}
            record={null}
            throne={null}
            onStart={startGame}
          />
        </>
      )}

      {/* ── Playing ───────────────────────────────────────────────────── */}
      {phase === "playing" && (
        <>
          {/* HUD */}
          <div className="dots-card z-10 flex w-full max-w-sm items-center justify-between gap-2 px-4 py-3 mb-3">
            <button
              onPointerUp={() => setPhase("result")}
              className="text-sm font-bold"
              style={{ color: "var(--muted)" }}
            >
              ← Salir
            </button>

            {/* Lives */}
            <div className="flex gap-0.5">
              {Array.from({ length: MAX_LIVES }).map((_, i) => (
                <span
                  key={i}
                  className="text-lg"
                  style={{ opacity: i < lives ? 1 : 0.2 }}
                >
                  ❤️
                </span>
              ))}
            </div>

            {/* Round */}
            <span
              className="text-xs font-black tabular-nums"
              style={{ color: "var(--muted)" }}
            >
              {roundIndex + 1}/{TOTAL_ROUNDS}
            </span>

            {/* Score */}
            <div className="flex flex-col items-end">
              <span
                className="text-xs font-black uppercase tracking-widest"
                style={{ color: "var(--muted)" }}
              >
                Pts
              </span>
              <span
                className="font-display text-base font-extrabold tabular-nums"
                style={{ color: "var(--accent)" }}
              >
                {score}
              </span>
            </div>

            {/* Combo */}
            {combo > 1 && (
              <span
                className="rounded-full px-2 py-0.5 text-xs font-black"
                style={{
                  background:
                    "color-mix(in srgb, var(--gold) 20%, transparent)",
                  border:
                    "2px solid color-mix(in srgb, var(--gold) 50%, transparent)",
                  color: "var(--gold-edge)",
                  animation: "dots-pop-in 0.15s ease-out both",
                }}
              >
                🔥×{combo}
              </span>
            )}
          </div>

          {/* Fall arena */}
          <div
            className="relative w-full max-w-sm flex-1"
            style={{ minHeight: "340px" }}
          >
            {/* Falling word */}
            {round && (
              <div
                key={`word-${roundIndex}`}
                style={{
                  position: "absolute",
                  left: 0,
                  right: 0,
                  top: 0,
                  transform: `translateY(${fallY * 2.8}px)`,
                  transition:
                    roundPhase === "falling" ? "none" : undefined,
                  display: "flex",
                  justifyContent: "center",
                  pointerEvents: "none",
                }}
              >
                <div
                  className="dots-card px-8 py-4 text-center"
                  style={{
                    animation:
                      roundPhase === "between"
                        ? "dots-pop-in 0.3s ease-out both"
                        : undefined,
                  }}
                >
                  <span
                    className="font-display text-2xl font-extrabold"
                    style={{ color: "var(--foreground)" }}
                  >
                    {round.word}
                  </span>
                </div>
              </div>
            )}

            {/* Correction overlay */}
            {roundPhase === "correction" && correctLabel && (
              <div
                className="absolute inset-x-0 top-1/3 flex justify-center px-4"
                style={{ pointerEvents: "none" }}
              >
                <div
                  className="rounded-2xl px-5 py-3 text-center text-sm font-bold"
                  style={{
                    background:
                      "color-mix(in srgb, var(--danger) 12%, transparent)",
                    border:
                      "2px solid color-mix(in srgb, var(--danger) 40%, transparent)",
                    color: "var(--danger)",
                    animation: "dots-pop-in 0.2s ease-out both",
                  }}
                >
                  Era: <span className="font-black">{correctLabel}</span>
                </div>
              </div>
            )}
          </div>

          {/* Lane buttons */}
          <div className="z-10 mt-4 flex w-full max-w-sm gap-2">
            {laneOptions.map((opt) => {
              const isCorrect =
                roundPhase === "correction" && opt === correctLabel;
              const isWrong =
                roundPhase === "correction" && opt !== correctLabel;

              return (
                <button
                  key={opt}
                  onPointerUp={() => handleLaneTap(opt)}
                  disabled={roundPhase !== "falling"}
                  className="dots-pressable flex-1 rounded-2xl border-2 py-4 text-sm font-black leading-tight text-center disabled:opacity-50"
                  style={{
                    borderColor: isCorrect
                      ? "var(--success)"
                      : isWrong
                        ? "color-mix(in srgb, var(--border) 60%, transparent)"
                        : "color-mix(in srgb, var(--accent) 50%, transparent)",
                    background: isCorrect
                      ? "color-mix(in srgb, var(--success) 12%, transparent)"
                      : isWrong
                        ? "color-mix(in srgb, var(--border) 30%, transparent)"
                        : "color-mix(in srgb, var(--accent) 8%, transparent)",
                    color: isCorrect
                      ? "var(--success)"
                      : isWrong
                        ? "var(--muted)"
                        : "var(--accent)",
                    transition: "background 0.2s, border-color 0.2s",
                  }}
                >
                  {opt}
                </button>
              );
            })}
          </div>
        </>
      )}

      {/* ── Result ────────────────────────────────────────────────────── */}
      {phase === "result" && (
        <GameResult
          gameKey="word-tower"
          score={score}
          onReplay={startGame}
          onExit={() => router.push("/play")}
        />
      )}
    </div>
  );
}

// ── Page export with Suspense gate ────────────────────────────────────────────

export default function WordTowerPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <Spinner title="Cargando…" />
        </div>
      }
    >
      <WordTowerGame />
    </Suspense>
  );
}
