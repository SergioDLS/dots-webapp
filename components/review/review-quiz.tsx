"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { Icon } from "@/components/ui/icon";
import { PanelWrapper, SectionLabel } from "@/components/lesson/panel";
import {
  baseOptionCls,
  getOptionState,
  optionStyles,
} from "@/components/lesson/option-styles";
import AnswerFlash from "@/components/lesson/answer-flash";
import LessonFooter from "@/components/lesson/lesson-footer";
import LessonTopBar from "@/components/lesson/lesson-top-bar";
import ResultScreen from "@/components/lesson/result-screen";
import { useLessonSeries } from "@/hooks/use-lesson-series";
import { useLessonKeys } from "@/hooks/use-lesson-keys";
import { usePublicarObjetivos } from "@/hooks/use-report-targets";
import { conRespuesta, objetivoDeOracion } from "@/lib/report";
import { registrarRespondido } from "@/lib/report-targets";
import type { ProgressReward } from "@/services/engagement.service";
import {
  submitReviewService,
  type ReviewQuestion,
  type ReviewResult,
} from "@/services/review.service";

/** La pregunta del repaso como objetivo de reporte: la misma para lo que se publica y lo que se registra. */
const objetivoDeRepaso = (q: ReviewQuestion) =>
  objetivoDeOracion(
    { id: q.sentenceId, text: q.text, options: q.options.map((o) => o.word) },
    "review",
  );

/** Sesión de repaso ya cargada: cloze con corrección local + envío SRS. */
export default function ReviewQuiz({ items }: { items: ReviewQuestion[] }) {
  const router = useRouter();
  const [selectedWord, setSelectedWord] = useState<string | null>(null);
  const [reward, setReward] = useState<ProgressReward | null>(null);
  const resultsRef = useRef<ReviewResult[]>([]);
  const sentRef = useRef(false);

  const series = useLessonSeries({ items, confirmMode: "confirm" });
  const goToPath = () => router.push("/levels");

  useEffect(() => {
    if (!series.finished || sentRef.current) return;
    sentRef.current = true;
    submitReviewService(resultsRef.current)
      .then((res) => setReward({ message: "", ...res }))
      .catch(() => setReward(null));
  }, [series.finished]);

  const cur = series.current;
  const answered = series.answerState !== "";

  const confirmHandler = () => {
    if (!cur) return;
    if (answered) {
      setSelectedWord(null);
      series.next();
      return;
    }
    if (selectedWord === null) return;
    const correct =
      cur.options.find((o) => o.word === selectedWord)?.correct ?? false;
    resultsRef.current.push({ kind: cur.kind, refId: cur.refId, correct });
    registrarRespondido(
      conRespuesta(objetivoDeRepaso(cur), {
        answer: selectedWord,
        expected: cur.options.find((o) => o.correct)?.word,
        wasWrong: !correct,
      }),
    );
    series.confirm();
  };

  useLessonKeys({
    enabled: !!cur && !series.finished,
    onSelect: (i) => {
      if (!cur || answered) return;
      const o = cur.options[i];
      if (o) {
        setSelectedWord(o.word);
        series.select(o.correct);
      }
    },
    onEnter: confirmHandler,
  });

  // Reportes (spec 2026-10-01): la pregunta en pantalla, con la respuesta si ya se corrigió.
  const objetivos = useMemo(() => {
    if (series.finished || !cur) return [];
    const base = objetivoDeRepaso(cur);
    if (!answered || selectedWord === null) return [base];
    return [
      conRespuesta(base, {
        answer: selectedWord,
        expected: cur.options.find((o) => o.correct)?.word,
        wasWrong: series.answerState === "wrong",
      }),
    ];
  }, [series.finished, cur, answered, selectedWord, series.answerState]);
  usePublicarObjetivos(objetivos);

  if (series.finished) {
    const { correct, total } = series.summary;
    return (
      <ResultScreen
        mode={correct === total ? "perfect" : "finished"}
        reward={reward}
        subtext={`Repasaste ${total} · acertaste ${correct}`}
        ctaLabel="Volver al camino"
        onCta={goToPath}
      />
    );
  }

  if (!cur) return null;

  return (
    <div className="flex flex-col gap-4 w-full">
      <LessonTopBar progress={series.progress} streak={series.streak} />
      <PanelWrapper>
        <SectionLabel emoji={<Icon name="repaso" size={20} />}>Repaso</SectionLabel>
        <p className="font-display text-xl font-extrabold text-center leading-relaxed">
          {cur.text.split("__").map((part, i, arr) => (
            <span key={i}>
              {part}
              {i < arr.length - 1 && (
                <span
                  className="inline-block min-w-16 border-b-4 mx-1 align-baseline"
                  style={{ borderColor: "var(--accent)" }}
                >
                  {answered || selectedWord ? (
                    <span style={{ color: "var(--accent)" }}>{selectedWord}</span>
                  ) : (
                    " "
                  )}
                </span>
              )}
            </span>
          ))}
        </p>
        <div className="grid grid-cols-2 gap-3 w-full">
          {cur.options.map((option) => (
            <button
              key={option.word}
              className={baseOptionCls}
              style={
                optionStyles[
                  getOptionState(
                    selectedWord === option.word,
                    series.answerState,
                    option.correct,
                  )
                ]
              }
              onClick={() => {
                if (!answered) {
                  setSelectedWord(option.word);
                  series.select(option.correct);
                }
              }}
            >
              {option.word}
            </button>
          ))}
        </div>
      </PanelWrapper>
      <AnswerFlash state={series.answerState} />
      <LessonFooter
        confirmLabel={answered ? "Continuar" : "Confirmar"}
        confirmDisabled={!answered && selectedWord === null}
        onExit={goToPath}
        avisoSalida={"Perderás lo repasado en esta sesión."}
        onConfirm={confirmHandler}
      />
    </div>
  );
}
