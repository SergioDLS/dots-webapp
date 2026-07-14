"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Doty from "@/components/ui/doty/doty";
import UIButton from "@/components/ui/button/button";
import Spinner from "@/components/ui/Spinner/Spinner";
import { getDotaxiService, type DotaxiQuestion } from "@/services/games.service";
import {
  submitGameScoreService,
  type ScoreResult,
} from "@/services/engagement.service";
import XpReward from "@/components/ui/xp-reward";

const ROUND_SECONDS = 60;
const TICK_MS = 100;

type Place = "start" | "game" | "endgame";

const playSound = (type: "correct" | "wrong") => {
  const src =
    type === "correct"
      ? "/sounds/answers/correct.wav"
      : "/sounds/answers/wrong.wav";
  new Audio(src).play().catch(() => {});
};

const shuffle = <T,>(arr: T[]): T[] => {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
};

export default function SpeedRoundPage() {
  const [place, setPlace] = useState<Place>("start");
  const [questions, setQuestions] = useState<DotaxiQuestion[]>([]);
  const [deck, setDeck] = useState<DotaxiQuestion[]>([]);
  const [index, setIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [answeredCount, setAnsweredCount] = useState(0);
  const [msLeft, setMsLeft] = useState(ROUND_SECONDS * 1000);
  const [pose, setPose] = useState("13");
  const [loading, setLoading] = useState(true);
  const [reward, setReward] = useState<ScoreResult | null>(null);

  const scoreRef = useRef(0);
  const scoreSubmittedRef = useRef(false);

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

  const endgame = useCallback(() => {
    setPose(scoreRef.current > 0 ? "02" : "05");
    setPlace("endgame");
    // fire-and-forget: sync the run's score, show "+N XP" if it arrives
    if (!scoreSubmittedRef.current) {
      scoreSubmittedRef.current = true;
      submitGameScoreService("speed-round", scoreRef.current)
        .then(setReward)
        .catch(() => {});
    }
  }, []);

  // countdown
  useEffect(() => {
    if (place !== "game") return;
    const id = setInterval(() => {
      setMsLeft((t) => {
        const next = t - TICK_MS;
        if (next <= 0) {
          clearInterval(id);
          endgame();
          return 0;
        }
        return next;
      });
    }, TICK_MS);
    return () => clearInterval(id);
  }, [place, endgame]);

  const start = () => {
    setDeck(shuffle(questions));
    setIndex(0);
    setScore(0);
    setAnsweredCount(0);
    setMsLeft(ROUND_SECONDS * 1000);
    setPose("13");
    scoreRef.current = 0;
    scoreSubmittedRef.current = false;
    setReward(null);
    setPlace("game");
  };

  const question = deck[index] ?? null;

  // shuffle each question's options once per appearance
  const options = useMemo(
    () => (question ? shuffle(question.options) : []),
    [question],
  );

  const answer = (opt: string) => {
    if (place !== "game" || !question) return;
    const correct = opt === question.correct;
    if (correct) {
      scoreRef.current += 1;
      setScore(scoreRef.current);
      setPose("02");
    } else {
      setPose("05"); // wrongs cost nothing — keep rolling!
    }
    playSound(correct ? "correct" : "wrong");
    setAnsweredCount((n) => n + 1);
    // instant next; reshuffle the deck when we run out
    if (index + 1 >= deck.length) {
      setDeck(shuffle(questions));
      setIndex(0);
    } else {
      setIndex((i) => i + 1);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner title="Loading game..." />
      </div>
    );
  }

  const seconds = Math.ceil(msLeft / 1000);
  const timeFrac = msLeft / (ROUND_SECONDS * 1000);
  const parts = question ? question.text.split("__") : ["", ""];

  return (
    <div className="relative flex min-h-screen w-full flex-col items-center overflow-hidden px-4 py-6">
      {/* ambient blob */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-32 -left-24 h-80 w-80 rounded-full opacity-25 blur-3xl"
        style={{ background: "var(--primary)" }}
      />

      {/* Top bar */}
      <div className="dots-card z-10 flex w-full max-w-xl items-center justify-between gap-3 px-4 py-3">
        <button
          onClick={() =>
            place === "game" ? endgame() : window.location.assign("/levels")
          }
          className="text-sm font-bold text-(--muted) hover:text-(--accent) transition-colors"
        >
          ← Exit
        </button>
        <span className="font-display text-lg font-extrabold text-(--accent)">
          Speed Round ⚡
        </span>
        {place === "game" ? (
          <span
            className="text-sm font-extrabold tabular-nums"
            style={{ color: seconds <= 10 ? "var(--danger)" : "var(--foreground)" }}
          >
            ⏱ {seconds}s
          </span>
        ) : (
          <span className="w-10" />
        )}
      </div>

      <div className="relative z-10 mt-4 flex w-full max-w-xl flex-1 flex-col items-center">
        {place === "start" && (
          <div className="dots-card mt-8 flex flex-col items-center gap-6 px-8 py-12 text-center">
            <div style={{ animation: "dots-float 3s ease-in-out infinite" }}>
              <Doty pose="12" size="small" />
            </div>
            <h2 className="font-display text-2xl font-extrabold text-foreground">
              How many can you get in {ROUND_SECONDS} seconds?
            </h2>
            <p className="max-w-sm text-sm font-semibold text-(--muted)">
              Fill in the missing word as fast as you can. Right answers score a
              point — wrong ones cost nothing, so keep going!
            </p>
            <UIButton tone="accent" onClick={start} disabled={questions.length === 0}>
              {questions.length === 0 ? "No questions yet" : "Start the clock!"}
            </UIButton>
          </div>
        )}

        {place === "game" && question && (
          <div className="flex w-full flex-col items-center gap-5">
            {/* timer bar */}
            <div className="h-2.5 w-full overflow-hidden rounded-full bg-(--border)">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${timeFrac * 100}%`,
                  background: timeFrac > 0.25 ? "var(--success)" : "var(--danger)",
                  transition: "width 0.1s linear",
                }}
              />
            </div>

            {/* score */}
            <div className="flex items-center gap-3">
              <span className="rounded-full bg-(--accent)/12 px-4 py-1 text-sm font-black text-(--accent) tabular-nums">
                ⚡ {score}
              </span>
              <span className="text-xs font-bold text-(--muted) tabular-nums">
                {answeredCount} answered
              </span>
            </div>

            {/* question card */}
            <div
              key={`${index}-${answeredCount}`}
              className="dots-card flex w-full flex-col items-center gap-3 px-6 py-7"
              style={{ animation: "dots-pop-in 0.25s ease-out both" }}
            >
              <span className="text-xs font-bold uppercase tracking-widest text-(--muted)">
                Fill in the blank!
              </span>
              <p className="text-xl font-extrabold text-foreground text-center">
                {parts[0]}
                <span className="mx-1 inline-block min-w-12 rounded-md border-b-4 border-(--accent) px-2 text-(--accent)">
                  ?
                </span>
                {parts[1]}
              </p>
            </div>

            <Doty pose={pose} size="tiny" />

            {/* option chips */}
            <div className="flex w-full flex-wrap justify-center gap-3">
              {options.map((opt) => (
                <button
                  key={opt}
                  onClick={() => answer(opt)}
                  className="dots-pressable rounded-2xl border-2 border-(--border) bg-(--surface) px-6 py-4 text-base font-extrabold capitalize text-foreground [--press-color:var(--border)] hover:border-(--accent) hover:text-(--accent)"
                >
                  {opt.toLowerCase()}
                </button>
              ))}
            </div>
          </div>
        )}

        {place === "endgame" && (
          <div className="dots-card mt-8 flex flex-col items-center gap-5 px-8 py-12 text-center">
            <Doty pose={pose} size="medium" animation={score > 0 ? "cheer" : "sad"} />
            <h2 className="font-display text-3xl font-extrabold text-foreground">
              Time&apos;s up! ⏰
            </h2>
            <p className="font-display text-5xl font-extrabold text-(--accent) tabular-nums">
              {score}
            </p>
            <p className="text-sm font-bold text-(--muted)">
              correct answer{score === 1 ? "" : "s"} in {ROUND_SECONDS} seconds
            </p>
            <XpReward reward={reward} />
            <div className="flex w-full max-w-xs flex-col gap-3">
              <UIButton tone="accent" fullWidth onClick={start}>
                Play again
              </UIButton>
              <UIButton
                tone="neutral"
                fullWidth
                onClick={() => window.location.assign("/levels")}
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
