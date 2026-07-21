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
  /**
   * "linear" (default): each item is shown once, in order.
   * "requeue": a wrong item is sent to the back of the queue and repeats until
   * answered correctly — for path lessons (learn-safe, no game over).
   */
  mode?: "linear" | "requeue";
}

/** Drives a series of answerable items: selection, lives, streak and progress. */
export function useLessonSeries<T>({
  items,
  hearts,
  confirmMode,
  silent = false,
  mode = "linear",
}: UseLessonSeriesOptions<T>) {
  const total = items.length;
  // Queue of remaining item indices. Wrong items requeue (in "requeue" mode).
  const [queue, setQueue] = useState<number[]>(() => items.map((_, i) => i));
  const [answerState, setAnswerState] = useState<AnswerState>("");
  const [pending, setPending] = useState<boolean | null>(null);
  const [streak, setStreak] = useState(0);
  const [lifes, setLifes] = useState(hearts ?? Infinity);
  const [correctCount, setCorrectCount] = useState(0);
  const [answeredCount, setAnsweredCount] = useState(0);
  // Unique items cleared from the queue (drives the progress bar).
  const [doneCount, setDoneCount] = useState(0);

  const currentIndex = queue[0];
  const current = (currentIndex != null ? items[currentIndex] : undefined) as
    | T
    | undefined;

  const resolve = useCallback(
    (correct: boolean) => {
      if (!silent) playSound(correct ? "correct" : "wrong");
      setAnswerState(correct ? "correct" : "wrong");
      setAnsweredCount((n) => n + 1);
      if (correct) {
        setStreak((s) => s + 1);
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
    const wasWrong = answerState === "wrong";
    const requeue = wasWrong && mode === "requeue" && lifes > 0;
    setQueue((q) => {
      if (q.length === 0) return q;
      const [head, ...rest] = q;
      return requeue ? [...rest, head] : rest;
    });
    if (!requeue) {
      // item leaves the queue for good
      setDoneCount((d) => d + 1);
      if (!wasWrong) setCorrectCount((c) => c + 1);
    }
    setPending(null);
    setAnswerState("");
  }, [answerState, mode, lifes]);

  const finished = total > 0 && (queue.length === 0 || lifes <= 0);

  return {
    current,
    index: total - queue.length,
    progress: total === 0 ? 0 : Math.floor((doneCount / total) * 100),
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
