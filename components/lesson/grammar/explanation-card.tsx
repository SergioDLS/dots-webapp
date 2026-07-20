"use client";

import Doty from "@/components/ui/doty/doty";
import type { GrammarBlock } from "@/services/lessons.service";

/** Renders one Spanish explanation block of a grammar pill. */
export default function ExplanationCard({ block }: { block: GrammarBlock }) {
  if (block.type === "example") {
    return (
      <div
        className="w-full rounded-2xl px-4 py-3"
        style={{
          background: "color-mix(in srgb, var(--accent) 8%, var(--surface))",
          border: "2px solid color-mix(in srgb, var(--accent) 25%, transparent)",
        }}
      >
        <p className="font-display font-extrabold text-lg">{block.text}</p>
        {block.en && (
          <p className="text-sm mt-1" style={{ color: "var(--muted)" }}>
            {block.en}
          </p>
        )}
      </div>
    );
  }
  if (block.type === "tip") {
    return (
      <div
        className="w-full flex items-center gap-3 rounded-2xl px-4 py-3"
        style={{
          background: "color-mix(in srgb, #fbbf24 12%, var(--surface))",
          border: "2px solid color-mix(in srgb, #fbbf24 40%, transparent)",
        }}
      >
        <Doty pose="02" size="mini" />
        <p className="text-sm leading-relaxed">{block.text}</p>
      </div>
    );
  }
  return <p className="text-sm leading-relaxed w-full">{block.text}</p>;
}
