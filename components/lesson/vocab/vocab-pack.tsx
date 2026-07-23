"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import UIButton from "@/components/ui/button/button";
import { PanelWrapper, SectionLabel } from "@/components/lesson/panel";
import LessonTopBar from "@/components/lesson/lesson-top-bar";
import ResultScreen from "@/components/lesson/result-screen";
import WordCard from "@/components/lesson/vocab/word-card";
import ListenQuiz from "@/components/lesson/vocab/listen-quiz";
import MatchQuiz from "@/components/lesson/vocab/match-quiz";
import AudioChoiceQuiz, {
  type AudioChoice,
} from "@/components/lesson/shared/audio-choice-quiz";
import { useLessonAudio } from "@/hooks/use-lesson-audio";
import { useLessonSession } from "@/hooks/use-lesson-session";
import {
  putNodeProgressService,
  type NodeProgressReward,
  type VocabContent,
} from "@/services/lessons.service";

interface Props {
  nodeId: number;
  content: VocabContent;
  /** Re-fetchea el contenido → nueva sesión con otro tramo. */
  onRestart: () => void;
}

type Stage = "present" | "listen" | "inverse" | "quiz" | "summary";

/**
 * Vocab pack por tramos (F3e): presenta SOLO las palabras nuevas del tramo →
 * escucha-y-selecciona (autoplay) → ronda inversa (significado → audio) →
 * emparejar → resumen con "Seguir practicando". Cubre months/days/seasons y
 * todo pack de vocabulario.
 */
export default function VocabPack({ nodeId, content, onRestart }: Props) {
  const router = useRouter();
  const play = useLessonAudio();
  const session = useLessonSession(content.items);
  const tramo = session.tramo;

  const tramoAudio = useMemo(
    () => tramo.filter((i) => i.audio).length,
    [tramo],
  );
  const canListen = tramoAudio >= 2;

  const [stage, setStage] = useState<Stage>(() =>
    session.newItems.length > 0 ? "present" : canListen ? "listen" : "quiz",
  );
  const [seen, setSeen] = useState<Set<number>>(new Set());
  const [progress, setProgress] = useState(0);
  const [reward, setReward] = useState<NodeProgressReward | null>(null);
  const [flawless, setFlawless] = useState(true);
  const wrongByItem = useRef<Map<number, number>>(new Map());
  const sentRef = useRef(false);

  const goToPath = () => router.push("/levels");
  const newItems = session.newItems;
  const allSeen = seen.size === newItems.length;

  // Ronda inversa: significado (ES) → elige el audio (EN) entre altavoces.
  const inverseItems = useMemo<AudioChoice[]>(
    () =>
      tramo
        .filter((i) => i.audio)
        .map((i) => ({ id: i.id, prompt: i.meaning, audio: i.audio!, character: i.character ?? null })),
    [tramo],
  );
  const inversePool = useMemo<AudioChoice[]>(
    () =>
      content.items
        .filter((i) => i.audio)
        .map((i) => ({ id: i.id, prompt: i.meaning, audio: i.audio!, character: i.character ?? null })),
    [content.items],
  );

  // Report progress exactly once when the match quiz completes. Sends ONLY the
  // session items (tramo); times_wrong accumulates across all rounds.
  useEffect(() => {
    if (stage !== "summary" || sentRef.current) return;
    sentRef.current = true;
    const items = tramo.map((item) => ({
      id: item.id,
      times_wrong: wrongByItem.current.get(item.id) ?? 0,
      answered: true,
    }));
    setFlawless(items.every((item) => item.times_wrong === 0));
    putNodeProgressService(nodeId, items).then(setReward).catch(console.error);
  }, [stage, tramo, nodeId]);

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

  const onWrong = (itemId: number) =>
    wrongByItem.current.set(itemId, (wrongByItem.current.get(itemId) ?? 0) + 1);

  if (stage === "present") {
    return (
      <div className="flex flex-col gap-4 w-full">
        <PanelWrapper>
          <SectionLabel emoji="🃏">{content.title}</SectionLabel>
          <p className="text-center text-sm" style={{ color: "var(--muted)" }}>
            Palabras nuevas de esta sesión — toca cada una para conocerla{" "}
            ({seen.size}/{newItems.length})
          </p>
          <div className="grid grid-cols-2 gap-3 w-full">
            {newItems.map((item) => (
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
            onClick={() => setStage(canListen ? "listen" : "quiz")}
            disabled={!allSeen}
            fullWidth
          >
            {allSeen ? "Practicar" : "Conócelas todas primero"}
          </UIButton>
        </div>
      </div>
    );
  }

  if (stage === "listen") {
    return (
      <div className="flex flex-col gap-4 w-full">
        <LessonTopBar progress={progress} />
        <PanelWrapper>
          <SectionLabel emoji="👂">{content.title}</SectionLabel>
          <ListenQuiz
            items={tramo}
            pool={content.items}
            play={play}
            onWrong={onWrong}
            onProgress={setProgress}
            onComplete={() => {
              setProgress(0);
              setStage(inverseItems.length >= 2 ? "inverse" : "quiz");
            }}
          />
        </PanelWrapper>
        <UIButton tone="neutral" onClick={goToPath}>
          ← Salir
        </UIButton>
      </div>
    );
  }

  if (stage === "inverse") {
    return (
      <div className="flex flex-col gap-4 w-full">
        <LessonTopBar progress={progress} />
        <PanelWrapper>
          <SectionLabel emoji="🔊">{content.title}</SectionLabel>
          <AudioChoiceQuiz
            items={inverseItems}
            pool={inversePool}
            play={play}
            onWrong={onWrong}
            onProgress={setProgress}
            onComplete={() => {
              setProgress(0);
              setStage("quiz");
            }}
          />
        </PanelWrapper>
        <UIButton tone="neutral" onClick={goToPath}>
          ← Salir
        </UIButton>
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
            items={tramo}
            onWrong={onWrong}
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

  const learnedNow =
    reward?.mastery != null
      ? Math.round((reward.mastery / 100) * session.packTotal)
      : null;
  return (
    <ResultScreen
      mode={flawless ? "perfect" : "finished"}
      reward={reward}
      subtext={
        session.isReview
          ? "¡Repaso completo! Estas palabras siguen firmes."
          : learnedNow != null
            ? `👑 Aprendidas ${learnedNow} de ${session.packTotal} palabras`
            : `¡${tramo.length} palabras practicadas!`
      }
      ctaLabel="Seguir practicando"
      onCta={onRestart}
      secondaryLabel="Volver al camino"
      onSecondary={goToPath}
    />
  );
}
