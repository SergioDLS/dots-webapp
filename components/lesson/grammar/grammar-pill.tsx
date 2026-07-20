"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

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
import ExplanationCard from "@/components/lesson/grammar/explanation-card";
import { useLessonSeries } from "@/hooks/use-lesson-series";
import {
  putNodeProgressService,
  type GrammarContent,
  type NodeProgressReward,
} from "@/services/lessons.service";

interface Props {
  nodeId: number;
  content: GrammarContent;
}

/** Grammar pill: short Spanish explanation → immediate practice → summary. */
export default function GrammarPill({ nodeId, content }: Props) {
  const router = useRouter();
  const [stage, setStage] = useState<"explain" | "practice">("explain");
  const [selectedWord, setSelectedWord] = useState<string | null>(null);
  const [reward, setReward] = useState<NodeProgressReward | null>(null);
  const wrongByItem = useRef<Map<number, number>>(new Map());
  const answeredByItem = useRef<Map<number, boolean>>(new Map());
  const sentRef = useRef(false);

  const series = useLessonSeries({
    items: content.items,
    confirmMode: "confirm",
  });

  const goToPath = () => router.push("/levels");

  // Report progress exactly once when the series ends.
  useEffect(() => {
    if (!series.finished || sentRef.current) return;
    sentRef.current = true;
    const items = content.items.map((item) => ({
      id: item.id,
      times_wrong: wrongByItem.current.get(item.id) ?? 0,
      answered: answeredByItem.current.get(item.id) ?? false,
    }));
    putNodeProgressService(nodeId, items).then(setReward).catch(console.error);
  }, [series.finished, content.items, nodeId]);

  if (stage === "explain") {
    return (
      <div className="flex flex-col gap-4 w-full">
        <PanelWrapper>
          <SectionLabel emoji="✏️">{content.title}</SectionLabel>
          <div className="flex flex-col gap-3 w-full">
            {content.explanation.map((block, i) => (
              <ExplanationCard key={i} block={block} />
            ))}
          </div>
        </PanelWrapper>
        <LessonFooter
          confirmLabel={content.items.length > 0 ? "Practicar" : "Volver al camino"}
          onExit={goToPath}
          onConfirm={() =>
            content.items.length > 0 ? setStage("practice") : goToPath()
          }
        />
      </div>
    );
  }

  if (series.finished) {
    const { correct, total } = series.summary;
    return (
      <ResultScreen
        mode={correct === total ? "perfect" : "finished"}
        reward={reward}
        subtext={`Acertaste ${correct} de ${total}`}
        ctaLabel="Volver al camino"
        onCta={goToPath}
      />
    );
  }

  const item = series.current;
  if (!item) return null;
  const answered = series.answerState !== "";

  const confirmHandler = () => {
    if (answered) {
      setSelectedWord(null);
      series.next();
      return;
    }
    if (selectedWord === null) return;
    const correct =
      item.options.find((o) => o.word === selectedWord)?.correct ?? false;
    if (!correct) {
      wrongByItem.current.set(item.id, (wrongByItem.current.get(item.id) ?? 0) + 1);
    }
    answeredByItem.current.set(item.id, correct);
    series.confirm();
  };

  return (
    <div className="flex flex-col gap-4 w-full">
      <LessonTopBar progress={series.progress} streak={series.streak} />
      <PanelWrapper>
        <SectionLabel emoji="✏️">{content.title}</SectionLabel>
        <p className="font-display text-xl font-extrabold text-center leading-relaxed">
          {item.text.split("__").map((part, i, arr) => (
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
                    " "
                  )}
                </span>
              )}
            </span>
          ))}
        </p>
        <div className="grid grid-cols-2 gap-3 w-full">
          {item.options.map((option) => (
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
        onConfirm={confirmHandler}
      />
    </div>
  );
}
