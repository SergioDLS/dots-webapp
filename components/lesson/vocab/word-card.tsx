"use client";

import Sound from "@/components/ui/sound/sound";
import WordImg from "@/components/ui/word-img/word-img";
import type { VocabContent } from "@/services/lessons.service";

type VocabItem = VocabContent["items"][number];

interface Props {
  item: VocabItem;
  seen: boolean;
  onSeen: () => void;
}

/** Presentation card: image (if any) + EN word + ES meaning + tap-to-hear. */
export default function WordCard({ item, seen, onSeen }: Props) {
  return (
    <button
      className="relative flex flex-col items-center gap-1 rounded-2xl p-3 text-center transition-all duration-200 active:scale-[.97]"
      style={{
        background: "var(--surface)",
        border: seen
          ? "2px solid color-mix(in srgb, #22c55e 60%, transparent)"
          : "2px solid var(--border)",
      }}
      onClick={onSeen}
    >
      {seen && (
        <span className="absolute top-2 right-2 text-sm leading-none">✅</span>
      )}
      {item.img && <WordImg src={item.img} size="small" />}
      <span className="font-display font-extrabold text-base leading-tight">
        {item.text}
      </span>
      <span className="text-xs" style={{ color: "var(--muted)" }}>
        {item.meaning}
      </span>
      {item.audio && (
        <span onClick={(e) => e.stopPropagation()}>
          <Sound icon size="small" src={item.audio} className="mt-1" />
        </span>
      )}
    </button>
  );
}
