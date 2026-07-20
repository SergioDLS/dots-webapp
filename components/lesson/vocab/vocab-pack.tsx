"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import UIButton from "@/components/ui/button/button";
import { PanelWrapper, SectionLabel } from "@/components/lesson/panel";
import LessonTopBar from "@/components/lesson/lesson-top-bar";
import ResultScreen from "@/components/lesson/result-screen";
import WordCard from "@/components/lesson/vocab/word-card";
import MatchQuiz from "@/components/lesson/vocab/match-quiz";
import {
  putNodeProgressService,
  type NodeProgressReward,
  type VocabContent,
} from "@/services/lessons.service";

interface Props {
  nodeId: number;
  content: VocabContent;
}

/** Vocab pack: browse the words (tap each one) → match quiz → summary. */
export default function VocabPack({ nodeId, content }: Props) {
  const router = useRouter();
  const [stage, setStage] = useState<"present" | "quiz" | "summary">("present");
  const [seen, setSeen] = useState<Set<number>>(new Set());
  const [progress, setProgress] = useState(0);
  const [reward, setReward] = useState<NodeProgressReward | null>(null);
  const [flawless, setFlawless] = useState(true);
  const wrongByItem = useRef<Map<number, number>>(new Map());
  const sentRef = useRef(false);

  const goToPath = () => router.push("/levels");
  const allSeen = seen.size === content.items.length;

  // Report progress exactly once when the quiz completes. Matching always
  // finishes every pair, so answered=true; wrong picks feed times_wrong.
  useEffect(() => {
    if (stage !== "summary" || sentRef.current) return;
    sentRef.current = true;
    const items = content.items.map((item) => ({
      id: item.id,
      times_wrong: wrongByItem.current.get(item.id) ?? 0,
      answered: true,
    }));
    setFlawless(items.every((item) => item.times_wrong === 0));
    putNodeProgressService(nodeId, items).then(setReward).catch(console.error);
  }, [stage, content.items, nodeId]);

  if (content.items.length === 0) {
    return (
      <PanelWrapper>
        <SectionLabel emoji="🃏">{content.title}</SectionLabel>
        <p className="text-center text-sm" style={{ color: "var(--muted)" }}>
          Este pack aún no tiene palabras.
        </p>
        <UIButton tone="accent" onClick={goToPath} fullWidth>
          Volver al camino
        </UIButton>
      </PanelWrapper>
    );
  }

  if (stage === "present") {
    return (
      <div className="flex flex-col gap-4 w-full">
        <PanelWrapper>
          <SectionLabel emoji="🃏">{content.title}</SectionLabel>
          <p className="text-center text-sm" style={{ color: "var(--muted)" }}>
            Toca cada palabra para conocerla{" "}
            ({seen.size}/{content.items.length})
          </p>
          <div className="grid grid-cols-2 gap-3 w-full">
            {content.items.map((item) => (
              <WordCard
                key={item.id}
                item={item}
                seen={seen.has(item.id)}
                onSeen={() => setSeen((prev) => new Set(prev).add(item.id))}
              />
            ))}
          </div>
        </PanelWrapper>
        <div className="flex gap-3 w-full">
          <UIButton tone="neutral" onClick={goToPath}>
            ← Salir
          </UIButton>
          <UIButton
            tone="accent"
            onClick={() => setStage("quiz")}
            disabled={!allSeen}
            fullWidth
          >
            {allSeen ? "Practicar" : "Conócelas todas primero"}
          </UIButton>
        </div>
      </div>
    );
  }

  if (stage === "quiz") {
    return (
      <div className="flex flex-col gap-4 w-full">
        <LessonTopBar progress={progress} />
        <PanelWrapper>
          <SectionLabel emoji="🃏">{content.title}</SectionLabel>
          <MatchQuiz
            items={content.items}
            onWrong={(itemId) =>
              wrongByItem.current.set(
                itemId,
                (wrongByItem.current.get(itemId) ?? 0) + 1,
              )
            }
            onProgress={setProgress}
            onComplete={() => setStage("summary")}
          />
        </PanelWrapper>
        <UIButton tone="neutral" onClick={goToPath}>
          ← Salir
        </UIButton>
      </div>
    );
  }

  return (
    <ResultScreen
      mode={flawless ? "perfect" : "finished"}
      reward={reward}
      subtext={`¡${content.items.length} palabras nuevas en tu mochila!`}
      ctaLabel="Volver al camino"
      onCta={goToPath}
    />
  );
}
