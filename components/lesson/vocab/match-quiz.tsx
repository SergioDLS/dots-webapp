"use client";

import { useMemo, useState } from "react";

import { baseOptionCls } from "@/components/lesson/option-styles";
import { playSound } from "@/lib/feedback-sounds";
import type { VocabContent } from "@/services/lessons.service";

type VocabItem = VocabContent["items"][number];

const ROUND_SIZE = 5;

interface Props {
  items: VocabItem[];
  /** Called once per wrong EN-word pick (feeds times_wrong). */
  onWrong: (itemId: number) => void;
  /** Called when every pair is matched. */
  onComplete: () => void;
  /** Reports overall progress 0-100 as pairs are matched. */
  onProgress: (pct: number) => void;
}

function shuffle<T>(arr: T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** Match EN words to ES meanings in rounds of up to 5 pairs. */
export default function MatchQuiz({ items, onWrong, onComplete, onProgress }: Props) {
  const rounds = useMemo(() => {
    const chunks: VocabItem[][] = [];
    for (let i = 0; i < items.length; i += ROUND_SIZE) {
      chunks.push(items.slice(i, i + ROUND_SIZE));
    }
    return chunks;
  }, [items]);

  const [roundIdx, setRoundIdx] = useState(0);
  const [matched, setMatched] = useState<Set<number>>(new Set());
  const [totalMatched, setTotalMatched] = useState(0);
  const [selectedEn, setSelectedEn] = useState<number | null>(null);
  const [selectedEs, setSelectedEs] = useState<number | null>(null);
  const [shakeId, setShakeId] = useState<number | null>(null);

  const round = useMemo(() => rounds[roundIdx] ?? [], [rounds, roundIdx]);
  const esColumn = useMemo(() => shuffle(round), [round]);

  const evaluate = (enId: number, esId: number) => {
    if (enId === esId) {
      playSound("correct");
      const nextMatched = new Set(matched).add(enId);
      const nextTotal = totalMatched + 1;
      setMatched(nextMatched);
      setTotalMatched(nextTotal);
      onProgress(Math.floor((nextTotal / items.length) * 100));
      if (nextMatched.size === round.length) {
        if (roundIdx + 1 < rounds.length) {
          setTimeout(() => {
            setRoundIdx((r) => r + 1);
            setMatched(new Set());
          }, 500);
        } else {
          setTimeout(onComplete, 500);
        }
      }
    } else {
      playSound("wrong");
      onWrong(enId);
      setShakeId(enId);
      setTimeout(() => setShakeId(null), 450);
    }
    setSelectedEn(null);
    setSelectedEs(null);
  };

  const pickEn = (id: number) => {
    if (matched.has(id)) return;
    setSelectedEn(id);
    if (selectedEs !== null) evaluate(id, selectedEs);
  };
  const pickEs = (id: number) => {
    if (matched.has(id)) return;
    setSelectedEs(id);
    if (selectedEn !== null) evaluate(selectedEn, id);
  };

  const optionStyle = (id: number, selected: boolean) => ({
    background: matched.has(id)
      ? "rgba(34,197,94,0.12)"
      : selected
        ? "color-mix(in srgb, var(--accent) 14%, var(--surface))"
        : "var(--surface)",
    border: matched.has(id)
      ? "2px solid rgba(34,197,94,0.5)"
      : selected
        ? "2px solid var(--accent)"
        : "2px solid var(--border)",
    opacity: matched.has(id) ? 0.5 : 1,
    animation: shakeId === id ? "pc-wrong-shake 0.4s ease-out" : undefined,
  });

  return (
    <div className="w-full">
      <p className="text-center text-sm mb-3" style={{ color: "var(--muted)" }}>
        Empareja cada palabra con su significado · ronda {roundIdx + 1} de {rounds.length}
      </p>
      <div className="grid grid-cols-2 gap-3 w-full">
        <div className="flex flex-col gap-2">
          {round.map((item) => (
            <button
              key={item.id}
              className={baseOptionCls}
              style={optionStyle(item.id, selectedEn === item.id)}
              onClick={() => pickEn(item.id)}
            >
              {item.text}
            </button>
          ))}
        </div>
        <div className="flex flex-col gap-2">
          {esColumn.map((item) => (
            <button
              key={item.id}
              className={baseOptionCls}
              style={optionStyle(item.id, selectedEs === item.id)}
              onClick={() => pickEs(item.id)}
            >
              {item.meaning}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
