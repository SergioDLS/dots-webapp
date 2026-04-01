"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";

import LoadBar from "@/components/ui/load-bar/load-bar";
import Doty from "@/components/ui/doty/doty";
import Spinner from "@/components/ui/Spinner/Spinner";
import UIButton from "@/components/ui/button/button";
import PracticeContainer from "@/components/practice-container/practice-container";
import api from "@/lib/api-client";

// ── Types ────────────────────────────────────────────────────────────────────
type Sentence = {
  id: number;
  text: string;
  mode: string;
  img?: string;
  img_sound?: string;
  sentence_extension?: string;
  options: Array<{
    id: number;
    word: string;
    correct: boolean;
    img?: string;
    img_sound?: string;
    selected?: boolean;
    order?: number;
  }>;
  answered?: boolean;
  times_wrong: number;
};
// Move the client-side logic into a Suspense-wrapped inner component so
// that hooks like `useSearchParams()` are isolated and can be rendered
// inside a Suspense boundary. This addresses cases where router-read
// hooks should be resolved inside a suspense/async boundary.
function PracticeClient() {
  const searchParams = useSearchParams();
  const id = searchParams.get("id") ?? "0";

  const [progress, setProgress] = useState(0);
  const [streak, setStreak] = useState(0);
  const [arraySentences, setArraySentences] = useState<Sentence[]>([]);
  const [doty, setDoty] = useState("07");
  const [indexSentence, setIndexSentence] = useState(0);
  const [noSentences, setNoSentences] = useState(false);
  const [mode, setMode] = useState("complete");
  const [answer, setAnswer] = useState<boolean | null>(null);
  const [answerState, setAnswerState] = useState("");
  const [totalSentences, setTotalSentences] = useState(0);
  const [answered, setAnsweredCount] = useState(0);
  const [lifes, setLifes] = useState(4);
  const [confirmLabel, setConfirmLabel] = useState("Confirm");
  const [confirmReady, setConfirmReady] = useState(false);

  // ── Audio ───────────────────────────────────────────────────────────────
  const playSound = (type: "correct" | "wrong") => {
    const src =
      type === "correct"
        ? "/sounds/answers/correct.wav"
        : "/sounds/answers/wrong.wav";
    new Audio(src).play().catch(() => {});
  };

  // ── Fetch ───────────────────────────────────────────────────────────────
  useEffect(() => {
    api
      .get<Sentence[]>(`/sentences/practice/${id}`)
      .then((res) => {
        if (res.data.length > 0) {
          setArraySentences(res.data);
          setTotalSentences(res.data.length);
          setMode(res.data[0].mode);
        } else {
          setNoSentences(true);
        }
      })
      .catch(console.error);
  }, [id]);

  useEffect(() => {
    if (lifes <= 0) levelFinishedHandler();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lifes]);

  // ── Handlers ─────────────────────────────────────────────────────────────
  const isSelectedHandler = (correct: boolean) => {
    setAnswer(correct);
    setConfirmReady(true);
  };

  const goToLevels = () => window.location.replace("/levels");

  const confirmSelectedHandler = () => {
    if(isFinalMode) {
      goToLevels();
      return;
    }
    if (answerState === "") {
      if (answer) {
        const newAnswered = answered + 1;
        const updated = [...arraySentences];
        updated[indexSentence] = { ...updated[indexSentence], answered: true };
        setAnswerState("correct");
        setDoty("02");
        setStreak((s) => s + 1);
        setProgress(Math.floor((newAnswered / totalSentences) * 100));
        setAnsweredCount(newAnswered);
        setArraySentences(updated);
        playSound("correct");
      } else {
        const updated = [...arraySentences];
        updated[indexSentence] = {
          ...updated[indexSentence],
          times_wrong: updated[indexSentence].times_wrong + 1,
        };
        setArraySentences(updated);
        playSound("wrong");
        setAnswerState("wrong");
        setDoty("05");
        setStreak(0);
        setLifes((l) => l - 1);
      }
      setConfirmLabel("Continue");
    } else {
      whatsNextHandler();
    }
  };

  const nextSentenceHandler = () => {
    const list = [...arraySentences];
    let index = indexSentence + 1;
    let count = 0;
    while (count <= list.length * 2) {
      if (index === list.length) index = 0;
      if (!list[index].answered) break;
      index++;
      count++;
    }
    setIndexSentence(index);
    setDoty("07");
    setAnswer(null);
    setAnswerState("");
    setMode(list[index].mode);
    setConfirmLabel("Confirm");
    setConfirmReady(false);
  };

  const levelFinishedHandler = () => {
    const finalMode =
      totalSentences === streak
        ? "perfect"
        : lifes <= 0
          ? "gameover"
          : "finished";
    if (finalMode === "gameover") setConfirmLabel("Try again");
    setMode(finalMode);
    sendProgress();
  };

  const sendProgress = () => {
    const sentences = arraySentences
      .filter((s) => s.answered || s.times_wrong > 0)
      .map((s) => ({
        id_sentence: s.id,
        answered: s.answered,
        times_wrong: s.times_wrong,
      }));
    try {
      const user = JSON.parse(localStorage.getItem("user") ?? "{}");
      api
        .post("/sentences/progress", {
          sentences,
          level_id: id,
          user_id: user.id,
        })
        .catch(() => {});
    } catch {
      /* ignore */
    }
  };

  const whatsNextHandler = () => {
    if (mode === "finished" || mode === "perfect") return goToLevels();
    if (mode === "gameover") return window.location.reload();
    if (mode !== "streak") {
      if (answered >= totalSentences) return levelFinishedHandler();
      const lastDigit = Number(String(streak).slice(-1));
      if (streak >= 5 && (lastDigit === 5 || lastDigit === 0)) {
        setMode("streak");
      } else {
        nextSentenceHandler();
      }
    } else {
      nextSentenceHandler();
    }
  };

  // ── Render ───────────────────────────────────────────────────────────────
  const isFinalMode =
    mode === "finished" || mode === "perfect" || mode === "gameover";

  let content: React.ReactNode = (
    <div className="flex h-full items-center justify-center">
      <Spinner />
    </div>
  );

  if (arraySentences.length > 0) {
    content = (
      <>
        {/* ── Top bar: hearts + progress ── */}
        <div className="flex items-center gap-3 w-full px-3 py-2.5 rounded-2xl bg-surface border border-(--border)">
          {/* Hearts as emoji */}
          <div className="flex items-center gap-0.5 shrink-0">
            {Array.from({ length: 4 }).map((_, i) => (
              <span
                key={i}
                className={`text-lg leading-none transition-all duration-300 ${
                  i < lifes ? "" : "grayscale opacity-30"
                } ${lifes <= 2 && i < lifes ? "animate-pulse" : ""}`}
              >
                ❤️
              </span>
            ))}
          </div>
          {/* Progress bar */}
          <div className="flex-1">
            <LoadBar progress={progress} streak={streak} />
          </div>
        </div>

        {/* ── Practice area ── */}
        <PracticeContainer
          doty={doty}
          dataSentence={arraySentences[indexSentence]}
          mode={mode}
          click={isSelectedHandler}
          answered={answerState}
          streak={streak}
        />

        {/* ── Answer feedback flash ── */}
        {answerState !== "" && !isFinalMode && mode !== "streak" && (
          <div
            className={`flex items-center gap-2 w-full px-4 py-3 rounded-2xl text-sm font-bold transition-all duration-300 ${
              answerState === "correct"
                ? "bg-emerald-500/15 border border-emerald-500/40 text-emerald-600 dark:text-emerald-400"
                : "bg-rose-500/15 border border-rose-500/40 text-rose-600 dark:text-rose-400"
            }`}
          >
            <span className="text-base">{answerState === "correct" ? "✅" : "❌"}</span>
            <span>{answerState === "correct" ? "Great job!" : "Keep going!"}</span>
          </div>
        )}

        {/* ── Action buttons ── */}
        {!isFinalMode && (
          <div className="flex gap-3 w-full">
            <UIButton tone="neutral" onClick={goToLevels}>
              Exit
            </UIButton>
            <UIButton
              tone="accent"
              onClick={confirmSelectedHandler}
              disabled={!confirmReady && answerState === ""}
              fullWidth
            >
              {confirmLabel}
            </UIButton>
          </div>
        )}
        {isFinalMode && (
          <div className="w-full">
            <UIButton tone="accent" onClick={confirmSelectedHandler} fullWidth>
              {confirmLabel}
            </UIButton>
          </div>
        )}
      </>
    );
  } else if (noSentences) {
    content = (
      <div className="flex flex-col items-center gap-4 py-12 text-(--muted)">
        <Doty pose="05" size="small" />
        <p className="text-sm">Something went wrong, please try again later.</p>
        <UIButton tone="neutral" onClick={goToLevels}>
          ← Back to levels
        </UIButton>
      </div>
    );
  }

  return (
    <div
      className="relative flex flex-col items-center gap-4 w-full max-w-2xl mx-auto px-4 py-6 md:py-10"
    >
      {content}
    </div>
  );
}

export default function Practice() {
  return (
    <Suspense fallback={<div className="flex h-full items-center justify-center"><Spinner /></div>}>
      <PracticeClient />
    </Suspense>
  );
}

