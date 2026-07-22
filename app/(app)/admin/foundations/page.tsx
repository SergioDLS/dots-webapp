"use client";

import React, { useState } from "react";
import { ToastBanner, useToast } from "@/components/admin/ui";
import PronunciationManager from "@/components/admin/foundations/pronunciation-manager";
import GrammarManager from "@/components/admin/foundations/grammar-manager";
import VocabManager from "@/components/admin/foundations/vocab-manager";

type FoundationType = "pronunciation" | "grammar" | "vocab";

const TABS: { key: FoundationType; label: string; hint: string }[] = [
  { key: "pronunciation", label: "Pronunciation", hint: "Minimal pairs" },
  { key: "grammar", label: "Grammar", hint: "Pills & drills" },
  { key: "vocab", label: "Vocab", hint: "Word packs" },
];

export default function AdminFoundationsPage() {
  const [type, setType] = useState<FoundationType>("pronunciation");
  const [toast, flash] = useToast();

  const tabCls = (active: boolean) =>
    `rounded-xl px-4 py-2 text-sm font-extrabold transition-colors ${
      active
        ? "bg-(--accent) text-white"
        : "text-(--muted) hover:bg-(--accent)/10 hover:text-(--accent)"
    }`;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h1 className="font-display text-2xl font-extrabold text-foreground">
          Foundations
        </h1>
        <p className="text-sm font-semibold text-(--muted)">
          Pronunciation units, grammar pills and vocab packs — the building
          blocks placed along the path.
        </p>
      </div>

      <div className="flex w-fit gap-1 rounded-2xl border-2 border-(--border) bg-(--surface) p-1">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setType(t.key)}
            className={tabCls(type === t.key)}
            title={t.hint}
          >
            {t.label}
          </button>
        ))}
      </div>

      {type === "pronunciation" && <PronunciationManager flash={flash} />}
      {type === "grammar" && <GrammarManager flash={flash} />}
      {type === "vocab" && <VocabManager flash={flash} />}

      {toast && <ToastBanner toast={toast} />}
    </div>
  );
}
