"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";

import Doty from "@/components/ui/doty/doty";
import Spinner from "@/components/ui/Spinner/Spinner";
import UIButton from "@/components/ui/button/button";
import PracticeContainer from "@/components/practice-container/practice-container";
import LessonTopBar from "@/components/lesson/lesson-top-bar";
import AnswerFlash from "@/components/lesson/answer-flash";
import LessonFooter from "@/components/lesson/lesson-footer";
import api from "@/lib/api-client";
import { playSound } from "@/lib/feedback-sounds";
import { useAuth } from "@/context/auth-context";
import type { PracticeSentence } from "@/types/practice.types";
import {
  putSentencesProgressService,
  type ProgressReward,
} from "@/services/engagement.service";

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
  const [arraySentences, setArraySentences] = useState<PracticeSentence[]>([]);
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
  const [reward, setReward] = useState<ProgressReward | null>(null);

  // ── Fetch ───────────────────────────────────────────────────────────────
  useEffect(() => {
    if (isBootstrapping) return; // wait for auth to finish before calling API
    api
      .get<PracticeSentence[]>(`/sentences/practice/${id}`)
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
    if (sentences.length === 0) return;
    // the backend resolves the user from the access token
    putSentencesProgressService({ sentences, level_id: Number(id) })
      .then((res) => {
        setReward(res);
        // keep the sidebar streak pill (localStorage-backed) in sync
        try {
          localStorage.setItem("streak", String(res.streak));
        } catch {
          /* ignore */
        }
      })
      .catch(() => {});
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
        <LessonTopBar
          progress={progress}
          streak={streak}
          hearts={{ lifes, total: 4 }}
        />

        {/* ── Practice area ── */}
        <div
          style={{ animation: "dots-slide-up 0.4s ease-out both" }}
          className="w-full"
        >
          <PracticeContainer
            doty={doty}
            dataSentence={arraySentences[indexSentence]}
            mode={mode}
            click={isSelectedHandler}
            answered={answerState}
            streak={streak}
            reward={reward}
          />
        </div>

        {/* ── Answer feedback flash ── */}
        {!isFinalMode && mode !== "streak" && (
          <AnswerFlash state={answerState} />
        )}

        {/* ── Action buttons ── */}
        <LessonFooter
          finalMode={isFinalMode}
          confirmLabel={confirmLabel}
          confirmDisabled={!confirmReady && answerState === ""}
          onExit={goToLevels}
          onConfirm={confirmSelectedHandler}
        />
      </>
    );
  } else if (noSentences) {
    content = (
      <div
        className="flex flex-col items-center gap-5 py-16"
        style={{ animation: "dots-pop-in 0.5s ease-out both" }}
      >
        <div style={{ animation: "dots-heart-pop 2s ease-in-out infinite" }}>
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

