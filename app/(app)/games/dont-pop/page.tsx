"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import Doty from "@/components/ui/doty/doty";
import WordImg from "@/components/ui/word-img/word-img";
import UIButton from "@/components/ui/button/button";
import Spinner from "@/components/ui/Spinner/Spinner";
import HotAirBalloon, {
  type BalloonPhase,
} from "@/components/games/dont-pop/hot-air-balloon";
import { getDontPopService, type GameWord } from "@/services/games.service";
import {
  submitGameScoreService,
  type ScoreResult,
} from "@/services/engagement.service";
import XpReward from "@/components/ui/xp-reward";

// Pressure model (same tuning as the mobile app): the balloon inflates on
// its own — it IS the timer. Right answers vent air, wrong ones pump it in.
const PRESSURE_MAX = 100;
const START_PRESSURE = 15;
const INFLATE_PER_SEC = 6;
const CORRECT_DEFLATE = 25;
const WRONG_INFLATE = 30;
const TICK_MS = 100;
const CRASH_DELAY_MS = 1500; // let the burst + fall play out
const LANDING_DELAY_MS = 1400;

type Place = "start" | "game" | "endgame";
type Option = { text: string; id: number };

export default function DontPopPage() {
  const [place, setPlace] = useState<Place>("start");
  const [phase, setPhase] = useState<BalloonPhase>("flying");
  const [pressure, setPressure] = useState(START_PRESSURE);
  const [index, setIndex] = useState(-1);
  const [options, setOptions] = useState<Option[]>([]);
  const [data, setData] = useState<GameWord[]>([]);
  const [loading, setLoading] = useState(true);
  const [won, setWon] = useState(false);
  const [reward, setReward] = useState<ScoreResult | null>(null);

  // score = words cleared this run; refs because the endgame path resets state
  const scoreRef = useRef(0);
  const scoreSubmittedRef = useRef(false);
  const pressureRef = useRef(pressure);
  const phaseRef = useRef(phase);
  useEffect(() => {
    pressureRef.current = pressure;
  }, [pressure]);
  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  useEffect(() => {
    let active = true;
    getDontPopService()
      .then((words) => {
        if (active) setData(words.map((w) => ({ ...w, answered: false })));
      })
      .catch(() => {})
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, []);

  const answeredCount = data.filter((d) => d.answered).length;

  const submitScore = useCallback(() => {
    if (scoreSubmittedRef.current) return;
    scoreSubmittedRef.current = true;
    submitGameScoreService("dont-pop", scoreRef.current)
      .then(setReward)
      .catch(() => {});
  }, []);

  // Balloon burst: play the fall, then show the endgame card.
  const crash = useCallback(() => {
    if (phaseRef.current !== "flying") return;
    setPhase("exploded");
    setWon(false);
    submitScore();
    setTimeout(() => setPlace("endgame"), CRASH_DELAY_MS);
  }, [submitScore]);

  // All words cleared: gentle touchdown, then the endgame card.
  const land = useCallback(() => {
    if (phaseRef.current !== "flying") return;
    setPhase("landed");
    setWon(true);
    submitScore();
    setTimeout(() => setPlace("endgame"), LANDING_DELAY_MS);
  }, [submitScore]);

  // Build the next round: find an unanswered word, pair it with a distractor.
  const nextRound = useCallback(() => {
    setData((current) => {
      const firstUnanswered = current.findIndex((d) => !d.answered);
      if (firstUnanswered === -1) {
        land();
        return current;
      }

      setIndex((prevIndex) => {
        let newIndex = prevIndex + 1;
        if (newIndex >= current.length) newIndex = 0;
        let guard = 0;
        while (current[newIndex]?.answered && guard < current.length) {
          newIndex = (newIndex + 1) % current.length;
          guard++;
        }

        let distractor = Math.floor(Math.random() * current.length);
        if (distractor === newIndex) {
          distractor = (distractor + 1) % current.length;
        }

        const correctOpt = {
          text: current[newIndex].title,
          id: current[newIndex].id,
        };
        const wrongOpt = {
          text: current[distractor].title,
          id: current[distractor].id,
        };
        setOptions(
          Math.random() < 0.5
            ? [correctOpt, wrongOpt]
            : [wrongOpt, correctOpt],
        );
        return newIndex;
      });

      return current;
    });
  }, [land]);

  // Inflation loop — stops as soon as the balloon isn't flying anymore.
  useEffect(() => {
    if (place !== "game" || phase !== "flying") return;
    const interval = setInterval(() => {
      if (pressureRef.current >= PRESSURE_MAX) {
        crash();
      } else {
        setPressure((p) =>
          Math.min(PRESSURE_MAX, p + INFLATE_PER_SEC * (TICK_MS / 1000)),
        );
      }
    }, TICK_MS);
    return () => clearInterval(interval);
  }, [place, phase, crash]);

  const start = () => {
    setPressure(START_PRESSURE);
    setIndex(-1);
    setPhase("flying");
    phaseRef.current = "flying";
    scoreRef.current = 0;
    scoreSubmittedRef.current = false;
    setReward(null);
    setData((prev) => prev.map((d) => ({ ...d, answered: false })));
    setPlace("game");
    setTimeout(() => nextRound(), 0);
  };

  const answer = (optId: number) => {
    if (place !== "game" || phase !== "flying" || index < 0) return;
    const current = data[index];
    if (!current) return;

    if (optId === current.id) {
      scoreRef.current += 1;
      setData((prev) => {
        const copy = [...prev];
        copy[index] = { ...copy[index], answered: true };
        return copy;
      });
      setPressure((p) => Math.max(0, p - CORRECT_DEFLATE));
      nextRound();
    } else {
      const next = pressureRef.current + WRONG_INFLATE;
      if (next >= PRESSURE_MAX) {
        setPressure(PRESSURE_MAX);
        crash();
      } else {
        setPressure(next);
        nextRound();
      }
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner title="Loading game..." />
      </div>
    );
  }

  const danger = pressure / PRESSURE_MAX;

  return (
    <div
      className="relative flex min-h-screen w-full flex-col items-center overflow-hidden px-4 py-6"
      style={{
        background:
          "linear-gradient(to bottom, var(--sky-top, #7ec8f5) 0%, var(--sky-bottom, #cdeafd) 78%, transparent 78%)",
      }}
    >
      <style>{`
        @keyframes dp-cloud {
          from { transform: translateX(-18vw); }
          to { transform: translateX(110vw); }
        }
      `}</style>

      {/* drifting clouds */}
      {[
        { top: "12%", dur: "46s", delay: "0s", scale: 1 },
        { top: "28%", dur: "62s", delay: "-24s", scale: 0.7 },
        { top: "48%", dur: "54s", delay: "-40s", scale: 1.2 },
      ].map((c, i) => (
        <span
          key={i}
          aria-hidden
          className="pointer-events-none absolute left-0 text-6xl opacity-70"
          style={{
            top: c.top,
            transform: `scale(${c.scale})`,
            animation: `dp-cloud ${c.dur} linear ${c.delay} infinite`,
          }}
        >
          ☁️
        </span>
      ))}

      {/* ground strip */}
      <div
        aria-hidden
        className="pointer-events-none absolute bottom-0 left-0 h-[22%] w-full"
        style={{
          background:
            "linear-gradient(to bottom, var(--success) 0%, color-mix(in srgb, var(--success) 70%, black) 100%)",
          opacity: 0.85,
        }}
      />

      {/* Top bar */}
      <div className="dots-card z-10 flex w-full max-w-xl items-center justify-between gap-3 px-4 py-3">
        <button
          onClick={() => window.location.assign("/levels")}
          className="text-sm font-bold text-(--muted) hover:text-(--accent) transition-colors"
        >
          ← Exit
        </button>
        <span className="font-display text-lg font-extrabold text-(--accent)">
          Don&apos;t Pop!
        </span>
        <span className="text-sm font-bold text-(--muted) tabular-nums">
          {answeredCount}/{data.length}
        </span>
      </div>

      {/* Play area */}
      <div className="relative z-10 mt-4 flex w-full max-w-xl flex-1 flex-col items-center">
        {place === "start" && (
          <div className="dots-card mt-8 flex flex-col items-center gap-6 px-8 py-12 text-center">
            <div style={{ animation: "dots-float 3s ease-in-out infinite" }}>
              <HotAirBalloon pressure={0.25} phase="flying" />
            </div>
            <h2 className="font-display text-2xl font-extrabold text-foreground">
              Keep Doty in the air!
            </h2>
            <p className="max-w-sm text-sm font-semibold text-(--muted)">
              Doty&apos;s balloon inflates on its own. Right answers let air
              out — wrong ones pump it up. If it bursts, Doty falls! Clear all{" "}
              {data.length} words to land safely.
            </p>
            <UIButton tone="accent" onClick={start}>
              Start flying
            </UIButton>
          </div>
        )}

        {place === "game" && index >= 0 && data[index] && (
          <>
            {/* Pressure meter */}
            <div className="mt-2 h-3 w-full max-w-sm overflow-hidden rounded-full border-2 border-(--border) bg-(--surface)">
              <div
                className="h-full rounded-full transition-all duration-200"
                style={{
                  width: `${Math.round(danger * 100)}%`,
                  background:
                    danger > 0.72
                      ? "var(--danger)"
                      : danger > 0.45
                        ? "var(--sun)"
                        : "var(--success)",
                }}
              />
            </div>

            {/* Balloon scene */}
            <div className="relative mt-3 flex h-80 w-full items-start justify-center">
              <HotAirBalloon pressure={danger} phase={phase} />

              <div
                className="dots-card absolute right-0 top-6 flex flex-col items-center gap-2 px-5 py-4"
                style={{ animation: "dots-pop-in 0.3s ease-out both" }}
              >
                <span className="text-xs font-bold uppercase tracking-widest text-(--muted)">
                  What is this?
                </span>
                {data[index].src && (
                  <WordImg
                    key={data[index].src}
                    src={data[index].src}
                    size="medium"
                  />
                )}
              </div>
            </div>

            {/* Options */}
            <div className="grid w-full grid-cols-2 gap-4">
              {options.map((opt, i) => (
                <button
                  key={`${opt.id}-${i}`}
                  onClick={() => answer(opt.id)}
                  disabled={phase !== "flying"}
                  className="dots-pressable rounded-2xl bg-(--surface) border-2 border-(--border) px-4 py-6 text-lg font-extrabold text-foreground [--press-color:var(--border)] hover:border-(--accent) hover:text-(--accent) disabled:opacity-60"
                >
                  {opt.text}
                </button>
              ))}
            </div>
          </>
        )}

        {place === "endgame" && (
          <div className="dots-card mt-8 flex flex-col items-center gap-5 px-8 py-12 text-center">
            {won ? (
              <HotAirBalloon pressure={0.1} phase="landed" />
            ) : (
              <Doty pose="05" size="small" animation="sad" />
            )}
            <h2 className="font-display text-3xl font-extrabold text-foreground">
              {won
                ? "Safe landing! 🎈"
                : "The balloon popped — down goes Doty!"}
            </h2>
            <p className="text-sm font-semibold text-(--muted)">
              {answeredCount} word{answeredCount === 1 ? "" : "s"} correct
            </p>
            <XpReward reward={reward} />
            <div className="flex w-full max-w-xs flex-col gap-3">
              <UIButton tone="accent" onClick={start} fullWidth>
                Fly again
              </UIButton>
              <UIButton
                tone="neutral"
                onClick={() => window.location.assign("/levels")}
                fullWidth
              >
                Back to levels
              </UIButton>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
