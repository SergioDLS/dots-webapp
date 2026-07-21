"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import Doty from "@/components/ui/doty/doty";
import Sound from "@/components/ui/sound/sound";
import UIButton from "@/components/ui/button/button";
import { PanelWrapper, SectionLabel } from "@/components/lesson/panel";
import {
  baseOptionCls,
  getOptionState,
  optionStyles,
} from "@/components/lesson/option-styles";
import LessonTopBar from "@/components/lesson/lesson-top-bar";
import ExplanationHint from "@/components/lesson/explanation-hint";
import ResultScreen from "@/components/lesson/result-screen";
import { useLessonSeries } from "@/hooks/use-lesson-series";
import {
  putNodeProgressService,
  type NodeProgressReward,
  type PronunciationContent,
} from "@/services/lessons.service";

const ADVANCE_DELAY_MS = 900;

interface Props {
  nodeId: number;
  content: PronunciationContent;
}

/** Minimal-pair listening drill: hear one word, tap which one it was. */
export default function PronunciationDrill({ nodeId, content }: Props) {
  const router = useRouter();
  const [stage, setStage] = useState<"start" | "play" | "done">("start");
  const [selectedWord, setSelectedWord] = useState<string | null>(null);
  const [reward, setReward] = useState<NodeProgressReward | null>(null);
  const wrongByItem = useRef<Map<number, number>>(new Map());
  const answeredByItem = useRef<Map<number, boolean>>(new Map());
  const sentRef = useRef(false);

  const series = useLessonSeries({
    items: content.items,
    confirmMode: "instant",
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

  // No audio generated yet for this unit — friendly empty state.
  if (content.items.length === 0) {
    return (
      <PanelWrapper>
        <SectionLabel emoji="👂">{content.title}</SectionLabel>
        <Doty pose="05" size="small" say="¡Vuelve pronto!" />
        <p className="text-center text-sm" style={{ color: "var(--muted)" }}>
          Este ejercicio de escucha aún no tiene audio. ¡Estamos grabándolo!
        </p>
        <UIButton tone="accent" onClick={goToPath} fullWidth>
          Volver al camino
        </UIButton>
      </PanelWrapper>
    );
  }

  if (stage === "start") {
    return (
      <PanelWrapper>
        <SectionLabel emoji="👂">{content.title}</SectionLabel>
        {(content.soundA || content.soundB) && (
          <div className="flex items-center gap-3 font-display font-extrabold text-lg">
            <span
              className="px-3 py-1 rounded-full"
              style={{ background: "color-mix(in srgb, var(--accent) 14%, transparent)" }}
            >
              {content.soundA}
            </span>
            <span style={{ color: "var(--muted)" }}>vs</span>
            <span
              className="px-3 py-1 rounded-full"
              style={{ background: "color-mix(in srgb, var(--accent) 14%, transparent)" }}
            >
              {content.soundB}
            </span>
          </div>
        )}
        {content.descriptionEs && (
          <p className="text-center text-sm leading-relaxed" style={{ color: "var(--muted)" }}>
            {content.descriptionEs}
          </p>
        )}
        <Doty pose="02" size="small" say="¡Escucha con atención!" />
        {/* The start tap is the user gesture the browser needs before autoplay */}
        <UIButton tone="accent" onClick={() => setStage("play")} fullWidth>
          Empezar
        </UIButton>
      </PanelWrapper>
    );
  }

  if (stage === "done" || series.finished) {
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

  const advance = () => {
    setSelectedWord(null);
    series.next();
  };

  const tap = (word: string, correct: boolean) => {
    if (series.answerState !== "") return;
    setSelectedWord(word);
    series.select(correct);
    if (!correct) {
      wrongByItem.current.set(item.id, (wrongByItem.current.get(item.id) ?? 0) + 1);
    }
    answeredByItem.current.set(item.id, correct);
    // Al acertar, avanza solo (ritmo rápido). Al fallar, se detiene para
    // mostrar la explicación; el usuario continúa cuando la leyó.
    if (correct) setTimeout(advance, ADVANCE_DELAY_MS);
  };

  return (
    <div className="flex flex-col gap-4 w-full">
      <LessonTopBar progress={series.progress} streak={series.streak} />
      <PanelWrapper>
        <SectionLabel emoji="👂">¿Qué palabra oíste?</SectionLabel>
        {/* key remounts Sound per item so autoplay fires on each new audio */}
        <div className="flex flex-col items-center gap-2 py-2" key={item.id}>
          <Sound autoplay icon src={item.audio} className="scale-150" />
          <span className="text-xs" style={{ color: "var(--muted)" }}>
            Toca el altavoz para repetir
          </span>
        </div>
        <div className="grid grid-cols-2 gap-3 w-full">
          {item.options.map((option) => (
            <button
              key={option.word}
              className={`${baseOptionCls} text-lg py-5`}
              style={
                optionStyles[
                  getOptionState(
                    selectedWord === option.word,
                    series.answerState,
                    option.correct,
                  )
                ]
              }
              onClick={() => tap(option.word, option.correct)}
            >
              {option.word}
            </button>
          ))}
        </div>
        {series.answerState === "wrong" && (
          <div className="flex w-full flex-col gap-3">
            <ExplanationHint hint={item.hint} />
            <UIButton tone="accent" onClick={advance} fullWidth>
              Continuar
            </UIButton>
          </div>
        )}
      </PanelWrapper>
      {series.answerState !== "wrong" && (
        <UIButton tone="neutral" onClick={goToPath}>
          ← Salir
        </UIButton>
      )}
    </div>
  );
}
