"use client";

import { useMemo, useRef, useState } from "react";

import { baseOptionCls, optionStyles } from "@/components/lesson/option-styles";
import { BASE_URL_SOUNDS } from "@/constants";
import { playSound } from "@/lib/feedback-sounds";
import type { VocabContent } from "@/services/lessons.service";

type VocabItem = VocabContent["items"][number];

interface Props {
  items: VocabItem[];
  /** Called once per wrong meaning pick (feeds times_wrong). */
  onWrong: (itemId: number) => void;
  /** Reports overall progress 0-100 as items are mastered. */
  onProgress: (pct: number) => void;
  /** Called when every listenable item has been answered correctly. */
  onComplete: () => void;
}

const resolveAudio = (src: string) =>
  /^https?:\/\//.test(src) ? src : `${BASE_URL_SOUNDS}/${src}`;

function shuffle<T>(arr: T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** Ear-first round: hear the EN word, pick its ES meaning. Wrong picks re-queue. */
export default function ListenQuiz({ items, onWrong, onProgress, onComplete }: Props) {
  // Items still to master; wrong answers move to the end until answered right.
  const [queue, setQueue] = useState<VocabItem[]>(() =>
    shuffle(items.filter((item) => item.audio)),
  );
  const [total] = useState(() => queue.length);
  const [mastered, setMastered] = useState<Set<number>>(new Set());
  const [feedback, setFeedback] = useState<{ id: number; ok: boolean } | null>(null);
  const lockRef = useRef(false);

  const target = queue[0];

  // Target meaning + up to 3 distractor meanings (deduped by text), reshuffled per turn.
  const options = useMemo(() => {
    if (!target) return [];
    const picked = [target];
    const seenMeanings = new Set([target.meaning]);
    for (const item of shuffle(items)) {
      if (picked.length >= 4) break;
      if (item.id === target.id || seenMeanings.has(item.meaning)) continue;
      seenMeanings.add(item.meaning);
      picked.push(item);
    }
    return shuffle(picked);
  }, [target, items]);

  if (!target) return null;

  const play = () => {
    if (!target.audio) return;
    new Audio(resolveAudio(target.audio)).play().catch(() => {});
  };

  const answer = (option: VocabItem) => {
    if (lockRef.current) return;
    lockRef.current = true;
    if (option.id === target.id) {
      playSound("correct");
      const nextMastered = new Set(mastered).add(target.id);
      setMastered(nextMastered);
      onProgress(Math.floor((nextMastered.size / total) * 100));
      setFeedback({ id: option.id, ok: true });
      const rest = queue.slice(1);
      setTimeout(() => {
        lockRef.current = false;
        setFeedback(null);
        setQueue(rest);
        if (rest.length === 0) onComplete();
      }, 450);
    } else {
      playSound("wrong");
      onWrong(target.id);
      setFeedback({ id: option.id, ok: false });
      const requeued = [...queue.slice(1), target];
      setTimeout(() => {
        lockRef.current = false;
        setFeedback(null);
        setQueue(requeued);
      }, 450);
    }
  };

  const optionStyle = (id: number) =>
    feedback?.id === id
      ? feedback.ok
        ? optionStyles.correct
        : optionStyles.wrong
      : optionStyles.idle;

  return (
    <div className="w-full">
      <p className="text-center text-sm mb-3" style={{ color: "var(--muted)" }}>
        Escucha y elige el significado · dominadas {mastered.size} de {total}
      </p>
      <button
        className="w-full rounded-2xl py-6 mb-4 font-display font-extrabold text-lg transition-all duration-200 cursor-pointer select-none active:scale-[.97]"
        style={{
          background: "color-mix(in srgb, var(--accent) 14%, var(--surface))",
          border: "2px solid var(--accent)",
          color: "var(--accent)",
        }}
        onClick={play}
      >
        🔊 Escuchar
      </button>
      <div className="flex flex-col gap-2 w-full">
        {options.map((option) => (
          <button
            key={option.id}
            className={baseOptionCls}
            style={optionStyle(option.id)}
            onClick={() => answer(option)}
          >
            {option.meaning}
          </button>
        ))}
      </div>
    </div>
  );
}
