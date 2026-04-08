"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";

import LoadBar from "@/components/ui/load-bar/load-bar";
import Doty from "@/components/ui/doty/doty";
import Spinner from "@/components/ui/Spinner/Spinner";
import UIButton from "@/components/ui/button/button";
import PracticeContainer from "@/components/practice-container/practice-container";
import api from "@/lib/api-client";
import { useAuth } from "@/context/auth-context";

/* ── Inject practice keyframes once ────────────────────────── */
if (typeof document !== "undefined") {
  const STYLE_ID = "__prac_kf__";
  if (!document.getElementById(STYLE_ID)) {
    const s = document.createElement("style");
    s.id = STYLE_ID;
    s.textContent = `
      @keyframes prac-heart-pop {
        0%   { transform: scale(1); }
        40%  { transform: scale(1.35); }
        100% { transform: scale(1); }
      }
      @keyframes prac-heart-break {
        0%   { transform: scale(1) rotate(0deg); }
        30%  { transform: scale(1.2) rotate(-8deg); }
        60%  { transform: scale(0.85) rotate(4deg); }
        100% { transform: scale(0.7) rotate(0deg); opacity: 0.3; filter: grayscale(1); }
      }
      @keyframes prac-slide-up {
        0%   { transform: translateY(12px); opacity: 0; }
        100% { transform: translateY(0); opacity: 1; }
      }
      @keyframes prac-bounce-in {
        0%   { transform: scale(0.6); opacity: 0; }
        60%  { transform: scale(1.08); opacity: 1; }
        100% { transform: scale(1); opacity: 1; }
      }
      @keyframes prac-confetti {
        0%   { background-position: 0% 0%; }
        100% { background-position: 200% 200%; }
      }
    `;
    document.head.appendChild(s);
  }
}

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
  const { isBootstrapping } = useAuth();

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
    if (isBootstrapping) return; // wait for auth to finish before calling API
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
  }, [id, isBootstrapping]);

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
        <div
          className="flex items-center gap-3 w-full px-4 py-3 rounded-2xl"
          style={{
            background: "var(--surface)",
            border: "2px solid var(--border)",
            boxShadow: "0 2px 12px rgba(0,0,0,0.06)",
          }}
        >
          {/* Hearts */}
          <div className="flex items-center gap-1 shrink-0">
            {Array.from({ length: 4 }).map((_, i) => {
              const alive = i < lifes;
              const critical = lifes <= 2 && alive;
              return (
                <span
                  key={i}
                  className="text-xl leading-none select-none"
                  style={{
                    filter: alive ? "none" : "grayscale(1)",
                    opacity: alive ? 1 : 0.25,
                    animation: critical
                      ? "prac-heart-pop 0.8s ease-in-out infinite"
                      : !alive
                        ? "prac-heart-break 0.5s ease forwards"
                        : "none",
                    animationDelay: critical ? `${i * 0.15}s` : "0s",
                  }}
                >
                  ❤️
                </span>
              );
            })}
          </div>

          {/* Progress bar */}
          <div className="flex-1">
            <LoadBar progress={progress} streak={streak} />
          </div>
        </div>

        {/* ── Practice area ── */}
        <div
          style={{ animation: "prac-slide-up 0.4s ease-out both" }}
          className="w-full"
        >
          <PracticeContainer
            doty={doty}
            dataSentence={arraySentences[indexSentence]}
            mode={mode}
            click={isSelectedHandler}
            answered={answerState}
            streak={streak}
          />
        </div>

        {/* ── Answer feedback flash ── */}
        {answerState !== "" && !isFinalMode && mode !== "streak" && (
          <div
            className="flex items-center gap-3 w-full px-5 py-3.5 rounded-2xl text-sm font-extrabold"
            style={{
              animation: "prac-bounce-in 0.35s ease-out both",
              background: answerState === "correct"
                ? "linear-gradient(135deg, rgba(34,197,94,0.15), rgba(16,185,129,0.08))"
                : "linear-gradient(135deg, rgba(244,63,94,0.15), rgba(239,68,68,0.08))",
              border: answerState === "correct"
                ? "2px solid rgba(34,197,94,0.4)"
                : "2px solid rgba(244,63,94,0.4)",
              color: answerState === "correct" ? "#059669" : "#e11d48",
            }}
          >
            <span
              className="text-2xl leading-none"
              style={{ animation: "prac-bounce-in 0.5s ease-out both" }}
            >
              {answerState === "correct" ? "🎉" : "😅"}
            </span>
            <span>{answerState === "correct" ? "Great job!" : "Keep going!"}</span>
          </div>
        )}

        {/* ── Action buttons ── */}
        {!isFinalMode && (
          <div
            className="flex gap-3 w-full"
            style={{ animation: "prac-slide-up 0.3s ease-out 0.1s both" }}
          >
            <UIButton tone="neutral" onClick={goToLevels}>
              ← Exit
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
          <div
            className="w-full"
            style={{ animation: "prac-bounce-in 0.4s ease-out both" }}
          >
            <UIButton tone="accent" onClick={confirmSelectedHandler} fullWidth>
              {confirmLabel}
            </UIButton>
          </div>
        )}
      </>
    );
  } else if (noSentences) {
    content = (
      <div
        className="flex flex-col items-center gap-5 py-16"
        style={{ animation: "prac-bounce-in 0.5s ease-out both" }}
      >
        <div style={{ animation: "prac-heart-pop 2s ease-in-out infinite" }}>
          <Doty pose="05" size="small" />
        </div>
        <p className="text-sm font-semibold" style={{ color: "var(--muted)" }}>
          Something went wrong, please try again later.
        </p>
        <UIButton tone="neutral" onClick={goToLevels}>
          ← Back to levels
        </UIButton>
      </div>
    );
  }

  return (
    <div
      className="relative flex flex-col items-center gap-5 w-full max-w-2xl mx-auto px-4 py-6 md:py-10"
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

