"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import Image from "next/image";

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

export default function Practice() {
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

  // ── Audio ────────────────────────────────────────────────────────────────
  const playSound = (type: "correct" | "wrong") => {
    const src =
      type === "correct"
        ? "/sounds/answers/correct.wav"
        : "/sounds/answers/wrong.wav";
    new Audio(src).play().catch(() => {});
  };

  // ── Fetch ────────────────────────────────────────────────────────────────
  useEffect(() => {
    api
      .get<Sentence[]>(`/sentences/sentences-practice/${id}`)
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
          className="flex items-center gap-4 w-full px-4 py-3 rounded-2xl relative overflow-hidden"
          style={{
            background:
              "linear-gradient(155deg, rgba(255,255,255,0.07) 0%, rgba(255,255,255,0.12) 100%)",
            backdropFilter: "blur(14px)",
            WebkitBackdropFilter: "blur(14px)",
            border: "1.5px solid rgba(255,255,255,0.18)",
            boxShadow:
              "0 4px 20px rgba(0,0,0,0.08), inset 0 1px 0 rgba(255,255,255,0.24)",
          }}
        >
          {/* Top sheen */}
          <div
            className="pointer-events-none absolute inset-x-0 top-0 h-1/2"
            style={{
              background:
                "linear-gradient(to bottom, rgba(255,255,255,0.16) 0%, transparent 100%)",
            }}
          />
          {/* Hearts */}
          <div className="relative flex flex-col items-center gap-0.5 shrink-0">
            <div
              className={`relative w-7 h-7 ${lifes <= 2 ? "animate-pulse" : ""}`}
            >
              <Image
                src="/images/heart.png"
                alt="Hearts"
                fill
                className="object-contain"
              />
            </div>
            <span
              className={`text-xs font-bold ${lifes <= 2 ? "text-rose-400" : "text-foreground"}`}
            >
              {lifes}
            </span>
          </div>
          {/* Progress bar */}
          <div className="relative flex-1">
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

        {/* ── Action buttons ── */}
        {!isFinalMode && (
          <div className="flex gap-3 w-full">
            <UIButton tone="neutral" onClick={goToLevels} className="flex-1">
              Exit
            </UIButton>
            <UIButton
              tone="accent"
              onClick={confirmSelectedHandler}
              disabled={!confirmReady && answerState === ""}
              className="flex-1"
            >
              {confirmLabel}
            </UIButton>
          </div>
        )}
        {isFinalMode && (
          <div className="flex gap-3 w-full">
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
    <div className="relative flex flex-col items-center gap-4 w-full max-w-2xl mx-auto px-4 py-6 md:py-10">
      {content}
    </div>
  );
}
