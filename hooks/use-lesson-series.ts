"use client";

import { useCallback, useState } from "react";
import { playSound } from "@/lib/feedback-sounds";

type AnswerState = "" | "correct" | "wrong";

interface UseLessonSeriesOptions<T> {
  items: T[];
  /** Starting lives; wrong answers decrement and 0 finishes the series. Omit for unlimited. */
  hearts?: number;
  /** "confirm" = select then confirm (practice-style); "instant" = one tap answers */
  confirmMode: "confirm" | "instant";
  /** Skip feedback sounds (exam flows) */
  silent?: boolean;
}

/** Drives a series of answerable items: selection, lives, streak and progress. */
export function useLessonSeries<T>({
  items,
  hearts,
  confirmMode,
  silent = false,
}: UseLessonSeriesOptions<T>) {
  const [index, setIndex] = useState(0);
  const [answerState, setAnswerState] = useState<AnswerState>("");
  const [pending, setPending] = useState<boolean | null>(null);
  const [streak, setStreak] = useState(0);
  const [lifes, setLifes] = useState(hearts ?? Infinity);
  const [correctCount, setCorrectCount] = useState(0);
  const [answeredCount, setAnsweredCount] = useState(0);

  const total = items.length;

  const resolve = useCallback(
    (correct: boolean) => {
      if (!silent) playSound(correct ? "correct" : "wrong");
      setAnswerState(correct ? "correct" : "wrong");
      setAnsweredCount((n) => n + 1);
      if (correct) {
        setStreak((s) => s + 1);
        setCorrectCount((n) => n + 1);
      } else {
        setStreak(0);
        setLifes((l) => l - 1);
      }
    },
    [silent],
  );

  const select = useCallback(
    (correct: boolean) => {
      if (answerState !== "") return;
      if (confirmMode === "instant") resolve(correct);
      else setPending(correct);
    },
    [answerState, confirmMode, resolve],
  );

  const confirm = useCallback(() => {
    if (answerState !== "" || pending === null) return;
    resolve(pending);
  }, [answerState, pending, resolve]);

  const next = useCallback(() => {
    setPending(null);
    setAnswerState("");
    setIndex((i) => i + 1);
  }, []);

  const finished = total > 0 && (index >= total || lifes <= 0);

  return {
    current: items[index] as T | undefined,
    index,
    progress: total === 0 ? 0 : Math.floor((answeredCount / total) * 100),
    answerState,
    streak,
    lifes,
    select,
    confirm,
    next,
    finished,
    summary: { correct: correctCount, total },
  };
}
