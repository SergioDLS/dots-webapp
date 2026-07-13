"use client";

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Image from "next/image";
import Doty from "@/components/ui/doty/doty";
import UIButton from "@/components/ui/button/button";
import Spinner from "@/components/ui/Spinner/Spinner";
import { getDotaxiService, type DotaxiQuestion } from "@/services/games.service";

// ── Tunables ──────────────────────────────────────────────────────────────────
const LANES = 3;
const START_HEARTS = 5;
const WIN_CORRECT = 10;
const TIMER_START = 5000;
const TIMER_STEP = 280; // shaved per round played
const TIMER_MIN = 2500;
const RESOLVE_MS = 1300;
const LANE_CENTERS = ["16.67%", "50%", "83.33%"]; // x of each lane

type Phase = "start" | "driving" | "result" | "win" | "gameover";

// ── Web Audio engine hum (toggleable) ───────────────────────────────────────────
function useEngine() {
  const ctxRef = useRef<AudioContext | null>(null);
  const gainRef = useRef<GainNode | null>(null);
  const oscRef = useRef<OscillatorNode | null>(null);

  const start = useCallback(() => {
    if (ctxRef.current) return;
    try {
      const Ctx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      const ctx = new Ctx();
      const osc = ctx.createOscillator();
      const filter = ctx.createBiquadFilter();
      const gain = ctx.createGain();
      osc.type = "sawtooth";
      osc.frequency.value = 70;
      filter.type = "lowpass";
      filter.frequency.value = 320;
      gain.gain.value = 0.04;
      osc.connect(filter).connect(gain).connect(ctx.destination);
      osc.start();
      ctxRef.current = ctx;
      gainRef.current = gain;
      oscRef.current = osc;
    } catch {
      /* audio unavailable */
    }
  }, []);

  const setSpeed = useCallback((t: number) => {
    // t in 0..1 → engine pitch
    if (oscRef.current && ctxRef.current) {
      oscRef.current.frequency.setTargetAtTime(
        62 + t * 46,
        ctxRef.current.currentTime,
        0.1,
      );
    }
  }, []);

  const setMuted = useCallback((muted: boolean) => {
    if (gainRef.current && ctxRef.current) {
      gainRef.current.gain.setTargetAtTime(
        muted ? 0 : 0.04,
        ctxRef.current.currentTime,
        0.05,
      );
    }
  }, []);

  const stop = useCallback(() => {
    try {
      oscRef.current?.stop();
      ctxRef.current?.close();
    } catch {
      /* noop */
    }
    ctxRef.current = null;
    gainRef.current = null;
    oscRef.current = null;
  }, []);

  useEffect(() => stop, [stop]);
  return { start, setSpeed, setMuted, stop };
}

const playSfx = (file: string, muted: boolean) => {
  if (muted) return;
  const a = new Audio(file);
  a.volume = 0.6;
  a.play().catch(() => {});
};

// ── Taxi (top-down, Doty in the cabin) ──────────────────────────────────────────
function Taxi({
  tilt,
  crashing,
  pose,
}: {
  tilt: number;
  crashing: boolean;
  pose: string;
}) {
  return (
    <div
      className="relative"
      style={{
        width: 78,
        height: 116,
        ["--tilt" as string]: `${tilt}deg`,
        animation: crashing
          ? "dotaxi-shake 0.5s ease-in-out"
          : "dotaxi-bob 0.8s ease-in-out infinite",
        transition: "transform 0.25s ease",
      }}
    >
      {/* wheels */}
      {[18, 74].map((top) =>
        [-4, 70].map((left) => (
          <div
            key={`${top}-${left}`}
            className="absolute rounded-md"
            style={{
              top,
              left,
              width: 12,
              height: 26,
              background: "#1b1340",
            }}
          />
        )),
      )}

      {/* body */}
      <div
        className="absolute inset-0 rounded-[28px]"
        style={{
          background: "linear-gradient(180deg,#ffd21e,#f7b500)",
          border: "3px solid #1b1340",
          boxShadow: "0 6px 16px rgba(0,0,0,0.35)",
        }}
      >
        {/* roof sign */}
        <div
          className="absolute left-1/2 -translate-x-1/2 rounded-md px-1.5 py-0.5 text-[8px] font-black tracking-widest"
          style={{
            top: 2,
            background: "#1b1340",
            color: "#ffd21e",
          }}
        >
          TAXI
        </div>

        {/* headlights */}
        <div className="absolute top-2 left-2 h-2 w-3 rounded-full bg-white/90" />
        <div className="absolute top-2 right-2 h-2 w-3 rounded-full bg-white/90" />

        {/* cabin window with Doty */}
        <div
          className="absolute left-1/2 -translate-x-1/2 overflow-hidden rounded-2xl"
          style={{
            top: 24,
            width: 56,
            height: 52,
            background: "#bfe9ff",
            border: "2px solid #1b1340",
          }}
        >
          <div className="absolute left-1/2 -translate-x-1/2" style={{ top: 2 }}>
            <Doty pose={pose} size="mini" />
          </div>
        </div>

        {/* checker stripe */}
        <div
          className="absolute left-0 right-0"
          style={{
            bottom: 16,
            height: 8,
            background:
              "repeating-linear-gradient(90deg,#1b1340 0 8px,#fff 8px 16px)",
          }}
        />

        {/* taillights */}
        <div className="absolute bottom-2 left-2 h-2 w-3 rounded-full bg-red-500" />
        <div className="absolute bottom-2 right-2 h-2 w-3 rounded-full bg-red-500" />
      </div>
    </div>
  );
}

export default function DotaxiPage() {
  const [questions, setQuestions] = useState<DotaxiQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [phase, setPhase] = useState<Phase>("start");
  const [round, setRound] = useState(0);
  const [lane, setLane] = useState(1);
  const [tilt, setTilt] = useState(0);
  const [hearts, setHearts] = useState(START_HEARTS);
  const [correctCount, setCorrectCount] = useState(0);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [timeLeft, setTimeLeft] = useState(TIMER_START);
  const [duration, setDuration] = useState(TIMER_START);
  const [pose, setPose] = useState("13");
  const [outcome, setOutcome] = useState<"none" | "pass" | "crash">("none");
  const [muted, setMuted] = useState(false);

  const engine = useEngine();

  // refs for values read inside timers
  const phaseRef = useRef(phase);
  const laneRef = useRef(lane);
  const resolvedRef = useRef(false);
  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);
  useEffect(() => {
    laneRef.current = lane;
  }, [lane]);

  useEffect(() => {
    let active = true;
    getDotaxiService()
      .then((q) => active && setQuestions(q))
      .catch(() => {})
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, []);

  const question = questions.length
    ? questions[round % questions.length]
    : null;
  const correctIndex = useMemo(
    () => (question ? question.options.indexOf(question.correct) : -1),
    [question],
  );

  // reflect progress into engine pitch + mute
  useEffect(() => {
    engine.setMuted(muted);
  }, [muted, engine]);
  useEffect(() => {
    engine.setSpeed(correctCount / WIN_CORRECT);
  }, [correctCount, engine]);

  const moveTo = useCallback(
    (target: number) => {
      if (phaseRef.current !== "driving") return;
      const clamped = Math.max(0, Math.min(LANES - 1, target));
      setLane((prev) => {
        if (clamped !== prev) {
          setTilt(clamped > prev ? 9 : -9);
          setTimeout(() => setTilt(0), 250);
        }
        return clamped;
      });
    },
    [],
  );

  const resolve = useCallback(() => {
    if (resolvedRef.current) return;
    resolvedRef.current = true;
    setPhase("result");
    const pass = laneRef.current === correctIndex;
    setOutcome(pass ? "pass" : "crash");

    // let obstacles rush in, then apply the result
    window.setTimeout(() => {
      if (pass) {
        setPose("17");
        playSfx("/sounds/answers/correct.wav", muted);
        setCombo((c) => {
          const next = c + 1;
          setScore((s) => s + 100 * next);
          return next;
        });
        setCorrectCount((n) => {
          const next = n + 1;
          if (next >= WIN_CORRECT) {
            playSfx("/sounds/answers/correct_2.wav", muted);
            setPhase("win");
          }
          return next;
        });
      } else {
        setPose("05");
        playSfx("/sounds/answers/wrong.wav", muted);
        setCombo(0);
        setHearts((h) => {
          const next = h - 1;
          if (next <= 0) {
            playSfx("/sounds/answers/wrong_2.wav", muted);
            setPhase("gameover");
          }
          return next;
        });
      }
    }, RESOLVE_MS - 450);
  }, [correctIndex, muted]);

  // advance to next round once a result has settled
  useEffect(() => {
    if (phase !== "result") return;
    const t = setTimeout(() => {
      if (phaseRef.current === "result") {
        setRound((r) => r + 1);
        setOutcome("none");
        setPose("13");
        resolvedRef.current = false;
        const played = round + 1;
        const dur = Math.max(TIMER_MIN, TIMER_START - played * TIMER_STEP);
        setDuration(dur);
        setTimeLeft(dur);
        setPhase("driving");
      }
    }, RESOLVE_MS);
    return () => clearTimeout(t);
  }, [phase, round]);

  // countdown timer during driving
  useEffect(() => {
    if (phase !== "driving") return;
    const tick = 50;
    const id = setInterval(() => {
      setTimeLeft((t) => {
        const next = t - tick;
        if (next <= 0) {
          clearInterval(id);
          resolve();
          return 0;
        }
        return next;
      });
    }, tick);
    return () => clearInterval(id);
  }, [phase, round, resolve]);

  // keyboard controls
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (phaseRef.current !== "driving") return;
      if (e.key === "ArrowLeft") moveTo(laneRef.current - 1);
      else if (e.key === "ArrowRight") moveTo(laneRef.current + 1);
      else if (e.key === "1") moveTo(0);
      else if (e.key === "2") moveTo(1);
      else if (e.key === "3") moveTo(2);
      else if (e.key === "Enter" || e.key === " ") resolve();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [moveTo, resolve]);

  const startGame = () => {
    engine.start();
    setRound(0);
    setLane(1);
    setHearts(START_HEARTS);
    setCorrectCount(0);
    setScore(0);
    setCombo(0);
    setDuration(TIMER_START);
    setTimeLeft(TIMER_START);
    setPose("13");
    setOutcome("none");
    resolvedRef.current = false;
    setPhase("driving");
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner title="Warming up the engine..." />
      </div>
    );
  }

  const progress = correctCount / WIN_CORRECT;
  const timeFrac = Math.max(0, timeLeft / duration);

  // sentence split around the blank
  const parts = question ? question.text.split("__") : ["", ""];

  return (
    <div
      className="relative flex min-h-screen w-full flex-col overflow-hidden"
      style={{
        // day → sunset as you progress
        background: `linear-gradient(180deg,
          hsl(${210 - progress * 190}, ${60 + progress * 20}%, ${72 - progress * 18}%) 0%,
          hsl(${250 - progress * 30}, 45%, ${40 - progress * 8}%) 100%)`,
        transition: "background 0.8s linear",
      }}
    >
      {/* ── HUD ── */}
      <div className="z-30 flex items-center justify-between gap-2 px-4 py-3">
        <button
          onClick={() => window.location.assign("/levels")}
          className="rounded-full bg-black/25 px-3 py-1.5 text-sm font-bold text-white backdrop-blur hover:bg-black/40 transition"
        >
          ← Exit
        </button>

        <div className="flex items-center gap-3 rounded-full bg-black/25 px-3 py-1.5 backdrop-blur">
          <div className="flex items-center gap-0.5">
            {Array.from({ length: START_HEARTS }).map((_, i) => (
              <span
                key={i}
                className="text-base leading-none"
                style={{
                  filter: i < hearts ? "none" : "grayscale(1)",
                  opacity: i < hearts ? 1 : 0.3,
                }}
              >
                ❤️
              </span>
            ))}
          </div>
          <span className="text-sm font-extrabold text-white tabular-nums">
            🏁 {correctCount}/{WIN_CORRECT}
          </span>
        </div>

        <button
          onClick={() => setMuted((m) => !m)}
          className="rounded-full bg-black/25 px-3 py-1.5 text-sm text-white backdrop-blur hover:bg-black/40 transition"
          aria-label="Toggle sound"
        >
          {muted ? "🔇" : "🔊"}
        </button>
      </div>

      {/* score + combo */}
      {phase !== "start" && (
        <div className="z-30 flex items-center justify-center gap-3 -mt-1">
          <span className="rounded-full bg-black/25 px-3 py-1 text-sm font-extrabold text-white tabular-nums backdrop-blur">
            {score} pts
          </span>
          {combo > 1 && (
            <span
              className="rounded-full bg-(--accent) px-3 py-1 text-sm font-black text-white"
              style={{ animation: "dots-pop-in 0.3s ease-out" }}
            >
              Combo x{combo}!
            </span>
          )}
        </div>
      )}

      {/* ── Road ── */}
      <div className="relative flex-1">
        {/* roadside grass */}
        <div className="absolute inset-y-0 left-0 w-[10%] bg-[#3f8f55]/70" />
        <div className="absolute inset-y-0 right-0 w-[10%] bg-[#3f8f55]/70" />

        {/* asphalt */}
        <div className="absolute inset-y-0 left-[10%] right-[10%] overflow-hidden bg-[#2c2750]">
          {/* lane divider dashes (scrolling) */}
          {[33.33, 66.66].map((x) => (
            <div
              key={x}
              className="absolute top-0 bottom-0"
              style={{
                left: `${x}%`,
                width: 6,
                transform: "translateX(-50%)",
                backgroundImage:
                  "linear-gradient(#ffe34d 0 60%, transparent 60% 100%)",
                backgroundSize: "100% 64px",
                animation:
                  phase === "driving" || phase === "result"
                    ? `dotaxi-road ${Math.max(0.25, 0.7 - progress * 0.4)}s linear infinite`
                    : "none",
              }}
            />
          ))}

          {/* speed lines */}
          {(phase === "driving" || phase === "result") &&
            Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                className="absolute w-0.5 rounded-full bg-white/40"
                style={{
                  left: `${12 + i * 18}%`,
                  height: 50 + (i % 3) * 26,
                  animation: `dotaxi-speedline ${Math.max(0.5, 1.1 - progress * 0.6)}s linear ${i * 0.18}s infinite`,
                }}
              />
            ))}

          {/* lane option signs / obstacles */}
          {question &&
            (phase === "driving" || phase === "result") &&
            Array.from({ length: LANES }).map((_, i) => {
              const isCorrect = i === correctIndex;
              if (phase === "driving") {
                return (
                  <div
                    key={i}
                    className="absolute -translate-x-1/2"
                    style={{
                      left: LANE_CENTERS[i],
                      top: "14%",
                      animation: "dots-float 2.2s ease-in-out infinite",
                    }}
                  >
                    <div className="dots-card flex items-center justify-center px-4 py-3 min-w-24 text-center">
                      <span className="text-base font-extrabold capitalize text-foreground">
                        {question.options[i].toLowerCase()}
                      </span>
                    </div>
                  </div>
                );
              }
              // result phase: clear lane vs obstacle rushing down
              return (
                <div
                  key={i}
                  className="absolute -translate-x-1/2 flex flex-col items-center"
                  style={{
                    left: LANE_CENTERS[i],
                    top: "62%",
                    transition: "top 0.8s ease-in",
                    animation: "none",
                  }}
                >
                  {isCorrect ? (
                    <div
                      className="rounded-full bg-(--success) px-4 py-2 text-sm font-black text-white shadow-lg"
                      style={{ animation: "dots-pop-in 0.4s ease-out" }}
                    >
                      ✓ CLEAR
                    </div>
                  ) : (
                    <span
                      className="text-5xl"
                      style={{ animation: "dots-pop-in 0.3s ease-out" }}
                    >
                      🚧
                    </span>
                  )}
                </div>
              );
            })}

          {/* tap zones (mobile) */}
          {phase === "driving" &&
            Array.from({ length: LANES }).map((_, i) => (
              <button
                key={i}
                onClick={() => (lane === i ? resolve() : moveTo(i))}
                aria-label={`Lane ${i + 1}`}
                className="absolute top-0 bottom-0 cursor-pointer"
                style={{ left: `${(i * 100) / LANES}%`, width: `${100 / LANES}%` }}
              />
            ))}

          {/* the taxi */}
          {phase !== "start" && (
            <div
              className="absolute -translate-x-1/2 z-20"
              style={{
                left: LANE_CENTERS[lane],
                bottom: "6%",
                transition: "left 0.32s cubic-bezier(.34,1.4,.64,1)",
              }}
            >
              <Taxi tilt={tilt} crashing={outcome === "crash"} pose={pose} />
            </div>
          )}

          {/* damage flash — base opacity 0 so it only shows while animating */}
          {outcome === "crash" && (
            <div
              className="pointer-events-none absolute inset-0 z-30 bg-red-600"
              style={{ opacity: 0, animation: "dotaxi-flash 0.5s ease-out" }}
            />
          )}
        </div>

        {/* ── Timer bar (during driving) ── */}
        {phase === "driving" && (
          <div className="absolute left-1/2 top-2 z-30 w-[70%] -translate-x-1/2">
            <div className="h-2.5 overflow-hidden rounded-full bg-black/30">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${timeFrac * 100}%`,
                  background:
                    timeFrac > 0.4 ? "var(--success)" : "var(--danger)",
                  transition: "width 0.05s linear",
                }}
              />
            </div>
          </div>
        )}
      </div>

      {/* ── Question prompt ── */}
      {phase === "driving" && question && (
        <div className="z-30 px-4 pb-5 pt-3">
          <div className="dots-card mx-auto flex max-w-lg flex-col items-center gap-1 px-5 py-3 text-center">
            <span className="text-[10px] font-bold uppercase tracking-widest text-(--muted)">
              Steer into the right word!
            </span>
            <p className="text-lg font-extrabold text-foreground">
              {parts[0]}
              <span className="mx-1 inline-block min-w-12 rounded-md border-b-4 border-(--accent) px-2 text-(--accent)">
                ?
              </span>
              {parts[1]}
            </p>
          </div>
        </div>
      )}

      {/* ── Start / Win / Gameover overlays ── */}
      {(phase === "start" || phase === "win" || phase === "gameover") && (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/40 px-4 backdrop-blur-sm">
          <div className="dots-card flex max-w-md flex-col items-center gap-5 px-8 py-10 text-center">
            {phase === "start" && (
              <>
                <div style={{ animation: "dots-float 3s ease-in-out infinite" }}>
                  <Doty pose="13" size="small" />
                </div>
                <h2 className="font-display text-3xl font-extrabold text-foreground">
                  Dotaxi 🚕
                </h2>
                <p className="max-w-sm text-sm font-semibold text-(--muted)">
                  Doty&apos;s driving! Read each sentence and steer into the lane
                  with the missing word. The right lane is clear — the wrong
                  ones have potholes. Reach the destination with{" "}
                  <b>{WIN_CORRECT} correct answers</b> before you take{" "}
                  <b>{START_HEARTS} hits</b>.
                </p>
                <p className="text-xs font-bold text-(--muted)">
                  ← → or 1 / 2 / 3 to steer · tap a lane on mobile
                </p>
                <UIButton tone="accent" onClick={startGame}>
                  Start driving
                </UIButton>
              </>
            )}
            {phase === "win" && (
              <>
                <Image
                  src="/images/PopIt/win.gif"
                  alt=""
                  width={150}
                  height={150}
                  unoptimized
                />
                <h2 className="font-display text-3xl font-extrabold text-foreground">
                  You reached the destination! 🏁
                </h2>
                <Doty pose="17" size="small" />
                <p className="text-sm font-bold text-(--muted)">
                  Score: {score} · {correctCount}/{WIN_CORRECT} correct
                </p>
                <div className="flex w-full max-w-xs flex-col gap-3">
                  <UIButton tone="accent" fullWidth onClick={startGame}>
                    Drive again
                  </UIButton>
                  <UIButton
                    tone="neutral"
                    fullWidth
                    onClick={() => window.location.assign("/levels")}
                  >
                    Back to levels
                  </UIButton>
                </div>
              </>
            )}
            {phase === "gameover" && (
              <>
                <Doty pose="05" size="medium" />
                <h2 className="font-display text-3xl font-extrabold text-foreground">
                  The taxi broke down! 🔧
                </h2>
                <p className="text-sm font-bold text-(--muted)">
                  You got {correctCount}/{WIN_CORRECT} · Score: {score}
                </p>
                <div className="flex w-full max-w-xs flex-col gap-3">
                  <UIButton tone="accent" fullWidth onClick={startGame}>
                    Try again
                  </UIButton>
                  <UIButton
                    tone="neutral"
                    fullWidth
                    onClick={() => window.location.assign("/levels")}
                  >
                    Back to levels
                  </UIButton>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
