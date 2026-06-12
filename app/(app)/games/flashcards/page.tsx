"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import Doty from "@/components/ui/doty/doty";
import WordImg from "@/components/ui/word-img/word-img";
import UIButton from "@/components/ui/button/button";
import Spinner from "@/components/ui/Spinner/Spinner";
import { getFlashcardsService, type Flashcard } from "@/services/games.service";

const TIME_TRIAL_SECONDS = 60;
const ENDURANCE_LIMIT = 360;

type Place = "start" | "game" | "endgame";
type GameMode = "trial" | "endurance";

const playSound = (type: "correct" | "wrong") => {
  const src =
    type === "correct"
      ? "/sounds/answers/correct.wav"
      : "/sounds/answers/wrong.wav";
  new Audio(src).play().catch(() => {});
};

const isCardDone = (card: Flashcard) =>
  card.options[card.correct - 1]?.marked ?? false;

export default function FlashcardsPage() {
  const [place, setPlace] = useState<Place>("start");
  const [mode, setMode] = useState<GameMode>("trial");
  const [cards, setCards] = useState<Flashcard[]>([]);
  const [position, setPosition] = useState(0);
  const [pose, setPose] = useState("14");
  const [seconds, setSeconds] = useState(TIME_TRIAL_SECONDS);
  const [result, setResult] = useState("");
  const [finalTime, setFinalTime] = useState(0);
  const [loading, setLoading] = useState(true);

  const secondsRef = useRef(seconds);
  useEffect(() => {
    secondsRef.current = seconds;
  }, [seconds]);

  useEffect(() => {
    let active = true;
    getFlashcardsService()
      .then((data) => {
        if (active) setCards(data.slice(0, 10));
      })
      .catch(() => {})
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, []);

  const doneCount = cards.filter(isCardDone).length;

  const endgame = useCallback(
    (reason: "success" | "timeout" | "quit") => {
      const elapsed =
        mode === "trial" ? TIME_TRIAL_SECONDS - secondsRef.current : seconds;
      setFinalTime(elapsed);
      setResult(
        reason === "timeout"
          ? "Time's up! ⏰"
          : reason === "quit"
            ? "Game ended"
            : "All cleared! 🎉",
      );
      setPose(reason === "success" ? "02" : "05");
      setPlace("endgame");
    },
    [mode, seconds],
  );

  // timer
  useEffect(() => {
    if (place !== "game") return;
    const id = setInterval(() => {
      setSeconds((s) => {
        if (mode === "trial") {
          if (s <= 1) {
            clearInterval(id);
            endgame("timeout");
            return 0;
          }
          return s - 1;
        }
        // endurance: count up to a limit
        if (s >= ENDURANCE_LIMIT) {
          clearInterval(id);
          endgame("timeout");
          return s;
        }
        return s + 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [place, mode, endgame]);

  const startGame = (selectedMode: GameMode) => {
    setMode(selectedMode);
    setSeconds(selectedMode === "trial" ? TIME_TRIAL_SECONDS : 0);
    setCards((prev) =>
      prev.map((c) => ({
        ...c,
        options: c.options.map((o) => ({ ...o, marked: false })),
      })),
    );
    setPosition(0);
    setPose("14");
    setPlace("game");
  };

  const advance = useCallback((current: Flashcard[], from: number) => {
    for (let step = 1; step <= current.length; step++) {
      const i = (from + step) % current.length;
      if (!isCardDone(current[i])) {
        setPosition(i);
        setPose("14");
        return;
      }
    }
  }, []);

  const answer = (optionIdx: number) => {
    const card = cards[position];
    if (!card || card.options[optionIdx].marked) return;

    const correct = card.correct - 1 === optionIdx;
    const updated = cards.map((c, ci) =>
      ci === position
        ? {
            ...c,
            options: c.options.map((o, oi) =>
              oi === optionIdx ? { ...o, marked: true } : o,
            ),
          }
        : c,
    );
    setCards(updated);
    setPose(correct ? "12" : "05");
    playSound(correct ? "correct" : "wrong");

    if (correct) {
      const remaining = updated.filter((c) => !isCardDone(c)).length;
      if (remaining === 0) {
        setTimeout(() => endgame("success"), 700);
      } else {
        setTimeout(() => advance(updated, position), 700);
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

  const card = cards[position];
  const mmss = (total: number) =>
    `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;

  return (
    <div className="relative flex min-h-screen w-full flex-col items-center overflow-hidden px-4 py-6">
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-32 -left-24 h-80 w-80 rounded-full opacity-25 blur-3xl"
        style={{ background: "var(--accent)" }}
      />

      {/* Top bar */}
      <div className="dots-card z-10 flex w-full max-w-xl items-center justify-between gap-3 px-4 py-3">
        <button
          onClick={() =>
            place === "game" ? endgame("quit") : window.location.assign("/levels")
          }
          className="text-sm font-bold text-(--muted) hover:text-(--accent) transition-colors"
        >
          ← Exit
        </button>
        <span className="font-display text-lg font-extrabold text-(--accent)">
          Flashcards
        </span>
        {place === "game" ? (
          <span className="text-sm font-extrabold text-foreground tabular-nums">
            {mode === "trial" ? "⏱ " : "↑ "}
            {mmss(seconds)}
          </span>
        ) : (
          <span className="w-10" />
        )}
      </div>

      <div className="relative z-10 mt-4 flex w-full max-w-xl flex-1 flex-col items-center">
        {place === "start" && (
          <div className="dots-card mt-8 flex flex-col items-center gap-6 px-8 py-12 text-center">
            <div style={{ animation: "dots-float 3s ease-in-out infinite" }}>
              <Doty pose="03" size="small" />
            </div>
            <h2 className="font-display text-2xl font-extrabold text-foreground">
              Match every picture to its word
            </h2>
            <p className="max-w-sm text-sm font-semibold text-(--muted)">
              Pick the correct word for each card. Choose your challenge:
            </p>
            <div className="flex flex-col gap-3 w-full max-w-xs">
              <UIButton tone="accent" fullWidth onClick={() => startGame("trial")}>
                Time Trial · 60s
              </UIButton>
              <UIButton
                tone="neutral"
                fullWidth
                onClick={() => startGame("endurance")}
              >
                Endurance
              </UIButton>
            </div>
          </div>
        )}

        {place === "game" && card && (
          <div className="flex w-full flex-col items-center gap-5">
            {/* progress */}
            <div className="flex w-full items-center gap-3">
              <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-(--border)">
                <div
                  className="h-full rounded-full bg-(--accent) transition-all duration-500"
                  style={{ width: `${(doneCount / cards.length) * 100}%` }}
                />
              </div>
              <span className="text-xs font-extrabold text-(--muted) tabular-nums">
                {doneCount}/{cards.length}
              </span>
            </div>

            {/* card */}
            <div
              key={position}
              className="dots-card flex w-full flex-col items-center gap-3 px-6 py-7"
              style={{ animation: "dots-pop-in 0.35s ease-out both" }}
            >
              <span className="text-xs font-bold uppercase tracking-widest text-(--muted)">
                {card.title}
              </span>
              {card.src && <WordImg src={card.src} size="large" />}
            </div>

            <Doty pose={pose} size="tiny" />

            {/* options */}
            <div className="grid w-full grid-cols-2 gap-3">
              {card.options.map((opt, i) => {
                const isCorrect = card.correct - 1 === i;
                const marked = opt.marked;
                let cls =
                  "border-(--border) bg-(--surface) text-foreground hover:border-(--accent) hover:text-(--accent)";
                if (marked && isCorrect)
                  cls =
                    "border-(--success) bg-(--success-soft) text-(--success)";
                else if (marked && !isCorrect)
                  cls =
                    "border-(--danger) bg-(--danger-soft) text-(--danger) opacity-70";
                return (
                  <button
                    key={i}
                    disabled={marked}
                    onClick={() => answer(i)}
                    className={`dots-pressable rounded-2xl border-2 px-4 py-5 text-base font-extrabold capitalize [--press-color:var(--border)] disabled:cursor-default ${cls}`}
                  >
                    {opt.name}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {place === "endgame" && (
          <div className="dots-card mt-8 flex flex-col items-center gap-5 px-8 py-12 text-center">
            <Doty pose={pose} size="medium" />
            <h2 className="font-display text-3xl font-extrabold text-foreground">
              {result}
            </h2>
            <div className="flex flex-col gap-1 text-sm font-bold text-(--muted)">
              <span className="capitalize">
                {mode === "trial" ? "Time Trial" : "Endurance"}
              </span>
              <span>Time: {mmss(finalTime)}</span>
              <span>
                Cleared: {doneCount}/{cards.length}
              </span>
            </div>
            <div className="flex flex-col gap-3 w-full max-w-xs">
              <UIButton tone="accent" fullWidth onClick={() => setPlace("start")}>
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
