"use client";

import React, { useCallback, useEffect, useState } from "react";
import Spinner from "@/components/ui/Spinner/Spinner";
import UIButton from "@/components/ui/button/button";
import SentenceModal from "@/components/admin/sentence-modal";
import WordModal from "@/components/admin/word-modal";
import {
  Toggle,
  ToastBanner,
  useToast,
} from "@/components/admin/ui";
import {
  getDifficulties,
  getStructure,
  getSentences,
  getWords,
  setLevelEnabled,
  setSentenceEnabled,
  deleteSentence,
  deleteWord,
  type AdminDifficulty,
  type AdminStructure,
  type AdminLevel,
  type AdminSentence,
  type AdminWord,
} from "@/services/admin.service";

type LevelTab = "sentences" | "words";

export default function AdminLevelsPage() {
  const [difficulties, setDifficulties] = useState<AdminDifficulty[]>([]);
  const [difficultyId, setDifficultyId] = useState<number | null>(null);
  const [structure, setStructure] = useState<AdminStructure | null>(null);
  const [sectionFilter, setSectionFilter] = useState<number>(0); // 0 = all
  const [loadingStructure, setLoadingStructure] = useState(false);

  const [selectedLevel, setSelectedLevel] = useState<AdminLevel | null>(null);
  const [toast, flash] = useToast();
  const [error, setError] = useState<string | null>(null);

  const loadStructure = useCallback((id: number) => {
    setDifficultyId(id);
    setSectionFilter(0);
    setLoadingStructure(true);
    getStructure(id)
      .then(setStructure)
      .catch(() => setError("Could not load levels."))
      .finally(() => setLoadingStructure(false));
  }, []);

  // Load difficulties once, then the first difficulty's structure
  useEffect(() => {
    getDifficulties()
      .then((d) => {
        setDifficulties(d);
        if (d.length > 0) loadStructure(d[0].id);
      })
      .catch(() => setError("Could not load difficulties."));
  }, [loadStructure]);

  const toggleLevel = async (level: AdminLevel) => {
    try {
      await setLevelEnabled(level.id, !level.enabled);
      setStructure((prev) =>
        prev
          ? {
              ...prev,
              sections: prev.sections.map((s) => ({
                ...s,
                levels: s.levels.map((l) =>
                  l.id === level.id ? { ...l, enabled: !l.enabled } : l,
                ),
              })),
            }
          : prev,
      );
      flash(`Level ${!level.enabled ? "enabled" : "disabled"}.`);
    } catch {
      flash("Could not update the level.", "error");
    }
  };

  if (error) {
    return (
      <div className="rounded-2xl border-2 border-(--danger)/30 bg-(--danger)/10 px-5 py-4 text-sm font-bold text-(--danger)">
        {error}
      </div>
    );
  }

  if (selectedLevel) {
    return (
      <>
        <LevelDetail
          level={selectedLevel}
          onBack={() => setSelectedLevel(null)}
          flash={flash}
        />
        {toast && <ToastBanner toast={toast} />}
      </>
    );
  }

  // ── Browse view ──────────────────────────────────────────────
  const sections = structure?.sections ?? [];
  const visibleSections =
    sectionFilter === 0
      ? sections
      : sections.filter((s) => s.id === sectionFilter);

  return (
    <div className="flex flex-col gap-5">
      <h1 className="font-display text-2xl font-extrabold text-foreground">
        Levels &amp; Content
      </h1>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <select
          value={difficultyId ?? ""}
          onChange={(e) => loadStructure(Number(e.target.value))}
          className="rounded-xl border-2 border-(--border) bg-(--surface) px-4 py-2.5 text-sm font-bold text-foreground outline-none focus:border-(--accent)"
        >
          {difficulties.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>

        <select
          value={sectionFilter}
          onChange={(e) => setSectionFilter(Number(e.target.value))}
          className="rounded-xl border-2 border-(--border) bg-(--surface) px-4 py-2.5 text-sm font-bold text-foreground outline-none focus:border-(--accent)"
        >
          <option value={0}>All sections</option>
          {sections.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </div>

      {loadingStructure ? (
        <div className="py-16">
          <Spinner title="Loading levels…" />
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {visibleSections.map((section) => (
            <div key={section.id} className="flex flex-col gap-2">
              <h2 className="font-display text-lg font-extrabold text-foreground">
                {section.name}
              </h2>
              <div className="overflow-hidden rounded-2xl border-2 border-(--border)">
                <table className="w-full text-left text-sm">
                  <thead className="bg-(--surface) text-(--muted)">
                    <tr className="text-xs font-extrabold uppercase tracking-wide">
                      <th className="px-4 py-3">Level</th>
                      <th className="px-4 py-3 text-center">Enabled</th>
                      <th className="px-4 py-3 text-right">Content</th>
                    </tr>
                  </thead>
                  <tbody>
                    {section.levels.map((level) => (
                      <tr
                        key={level.id}
                        className="border-t border-(--border)"
                      >
                        <td className="px-4 py-3 font-bold capitalize text-foreground">
                          {level.name}
                          {level.onConstruction && (
                            <span className="ml-2 rounded-full bg-(--sun)/20 px-2 py-0.5 text-[10px] font-extrabold text-(--sun)">
                              WIP
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <Toggle
                            on={level.enabled}
                            onClick={() => toggleLevel(level)}
                          />
                        </td>
                        <td className="px-4 py-3 text-right">
                          <UIButton
                            tone="neutral"
                            onClick={() => setSelectedLevel(level)}
                          >
                            Manage →
                          </UIButton>
                        </td>
                      </tr>
                    ))}
                    {section.levels.length === 0 && (
                      <tr>
                        <td
                          colSpan={3}
                          className="px-4 py-5 text-center text-sm font-semibold text-(--muted)"
                        >
                          No levels in this section.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
          {visibleSections.length === 0 && (
            <p className="rounded-2xl border-2 border-dashed border-(--border) px-5 py-8 text-center text-sm font-semibold text-(--muted)">
              No sections for this difficulty.
            </p>
          )}
        </div>
      )}

      {toast && <ToastBanner toast={toast} />}
    </div>
  );
}

// ── Level detail: Sentences | Words tabs ──────────────────────
function LevelDetail({
  level,
  onBack,
  flash,
}: {
  level: AdminLevel;
  onBack: () => void;
  flash: (text: string, kind?: "ok" | "error") => void;
}) {
  const [tab, setTab] = useState<LevelTab>("sentences");

  const [sentences, setSentences] = useState<AdminSentence[]>([]);
  const [loadingSentences, setLoadingSentences] = useState(true);
  const [sentenceModalOpen, setSentenceModalOpen] = useState(false);
  const [editingSentence, setEditingSentence] = useState<AdminSentence | null>(
    null,
  );

  const [words, setWords] = useState<AdminWord[]>([]);
  const [loadingWords, setLoadingWords] = useState(true);
  const [wordModalOpen, setWordModalOpen] = useState(false);
  const [editingWord, setEditingWord] = useState<AdminWord | null>(null);

  useEffect(() => {
    getSentences(level.id)
      .then(setSentences)
      .catch(() => flash("Could not load sentences.", "error"))
      .finally(() => setLoadingSentences(false));
    getWords(level.id)
      .then(setWords)
      .catch(() => flash("Could not load words.", "error"))
      .finally(() => setLoadingWords(false));
  }, [level.id, flash]);

  const refreshSentences = useCallback(() => {
    getSentences(level.id).then(setSentences).catch(() => {});
  }, [level.id]);

  const refreshWords = useCallback(() => {
    getWords(level.id).then(setWords).catch(() => {});
  }, [level.id]);

  const toggleSentence = async (s: AdminSentence) => {
    try {
      await setSentenceEnabled(s.id, !s.enabled);
      setSentences((prev) =>
        prev.map((x) => (x.id === s.id ? { ...x, enabled: !x.enabled } : x)),
      );
    } catch {
      flash("Could not update the sentence.", "error");
    }
  };

  const removeSentence = async (s: AdminSentence) => {
    if (!confirm(`Delete this sentence?\n\n"${s.text}"`)) return;
    try {
      await deleteSentence(s.id);
      setSentences((prev) => prev.filter((x) => x.id !== s.id));
      flash("Sentence deleted.");
    } catch {
      flash("Could not delete the sentence.", "error");
    }
  };

  const removeWord = async (w: AdminWord) => {
    if (!confirm(`Delete this word?\n\n"${w.text ?? ""}"`)) return;
    try {
      await deleteWord(w.id);
      setWords((prev) => prev.filter((x) => x.id !== w.id));
      flash("Word deleted.");
    } catch {
      flash("Could not delete the word.", "error");
    }
  };

  const tabCls = (active: boolean) =>
    `rounded-xl px-4 py-2 text-sm font-extrabold transition-colors ${
      active
        ? "bg-(--accent) text-white"
        : "text-(--muted) hover:bg-(--accent)/10 hover:text-(--accent)"
    }`;

  return (
    <div className="flex flex-col gap-5">
      <button
        onClick={onBack}
        className="self-start text-sm font-bold text-(--muted) transition-colors hover:text-(--accent)"
      >
        ← Back to levels
      </button>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-4">
          <h1 className="font-display text-2xl font-extrabold capitalize text-foreground">
            {level.name}
          </h1>
          <div className="flex gap-1 rounded-2xl border-2 border-(--border) bg-(--surface) p-1">
            <button
              onClick={() => setTab("sentences")}
              className={tabCls(tab === "sentences")}
            >
              Sentences{" "}
              <span className="opacity-70">({sentences.length})</span>
            </button>
            <button
              onClick={() => setTab("words")}
              className={tabCls(tab === "words")}
            >
              Words <span className="opacity-70">({words.length})</span>
            </button>
          </div>
        </div>

        {tab === "sentences" ? (
          <UIButton
            tone="accent"
            onClick={() => {
              setEditingSentence(null);
              setSentenceModalOpen(true);
            }}
          >
            + New sentence
          </UIButton>
        ) : (
          <UIButton
            tone="accent"
            onClick={() => {
              setEditingWord(null);
              setWordModalOpen(true);
            }}
          >
            + New word
          </UIButton>
        )}
      </div>

      {tab === "sentences" ? (
        loadingSentences ? (
          <div className="py-16">
            <Spinner title="Loading sentences…" />
          </div>
        ) : sentences.length === 0 ? (
          <p className="rounded-2xl border-2 border-dashed border-(--border) px-5 py-8 text-center text-sm font-semibold text-(--muted)">
            No sentences yet. Add the first one!
          </p>
        ) : (
          <div className="overflow-x-auto rounded-2xl border-2 border-(--border)">
            <table className="w-full text-left text-sm">
              <thead className="bg-(--surface) text-(--muted)">
                <tr className="text-xs font-extrabold uppercase tracking-wide">
                  <th className="px-4 py-3">Sentence</th>
                  <th className="px-4 py-3">Missing word</th>
                  <th className="px-4 py-3">Media</th>
                  <th className="px-4 py-3 text-center">Enabled</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {sentences.map((s) => (
                  <tr
                    key={s.id}
                    className="border-t border-(--border) align-middle"
                  >
                    <td className="px-4 py-3 font-semibold text-foreground">
                      {s.text}
                    </td>
                    <td className="px-4 py-3 font-bold text-(--accent)">
                      {s.mWord}
                    </td>
                    <td className="px-4 py-3">
                      <span className="flex items-center gap-1.5 text-xs font-bold text-(--muted)">
                        {s.img ? "🖼️" : "—"} {s.imgSound ? "🔊" : ""}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Toggle on={s.enabled} onClick={() => toggleSentence(s)} />
                    </td>
                    <td className="px-4 py-3">
                      <RowActions
                        onEdit={() => {
                          setEditingSentence(s);
                          setSentenceModalOpen(true);
                        }}
                        onDelete={() => removeSentence(s)}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      ) : loadingWords ? (
        <div className="py-16">
          <Spinner title="Loading words…" />
        </div>
      ) : words.length === 0 ? (
        <p className="rounded-2xl border-2 border-dashed border-(--border) px-5 py-8 text-center text-sm font-semibold text-(--muted)">
          No words yet. Add the first one!
        </p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border-2 border-(--border)">
          <table className="w-full text-left text-sm">
            <thead className="bg-(--surface) text-(--muted)">
              <tr className="text-xs font-extrabold uppercase tracking-wide">
                <th className="px-4 py-3">#</th>
                <th className="px-4 py-3">Word</th>
                <th className="px-4 py-3">Meaning</th>
                <th className="px-4 py-3">Media</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {words.map((w) => (
                <tr key={w.id} className="border-t border-(--border) align-middle">
                  <td className="px-4 py-3 text-xs font-bold text-(--muted)">
                    {w.position ?? "—"}
                  </td>
                  <td className="px-4 py-3 font-bold text-foreground">
                    {w.text}
                  </td>
                  <td className="px-4 py-3 font-semibold text-(--muted)">
                    {w.meaning || "—"}
                  </td>
                  <td className="px-4 py-3">
                    <span className="flex items-center gap-1.5 text-xs font-bold text-(--muted)">
                      {w.img ? "🖼️" : "—"} {w.audio ? "🔊" : ""}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <RowActions
                      onEdit={() => {
                        setEditingWord(w);
                        setWordModalOpen(true);
                      }}
                      onDelete={() => removeWord(w)}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {sentenceModalOpen && (
        <SentenceModal
          levelId={level.id}
          sentence={editingSentence}
          onClose={() => setSentenceModalOpen(false)}
          onSaved={(msg) => {
            setSentenceModalOpen(false);
            refreshSentences();
            flash(msg);
          }}
        />
      )}

      {wordModalOpen && (
        <WordModal
          levelId={level.id}
          word={editingWord}
          onClose={() => setWordModalOpen(false)}
          onSaved={(msg) => {
            setWordModalOpen(false);
            refreshWords();
            flash(msg);
          }}
        />
      )}
    </div>
  );
}

function RowActions({
  onEdit,
  onDelete,
}: {
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="flex items-center justify-end gap-2">
      <button
        onClick={onEdit}
        className="rounded-lg border-2 border-(--border) px-2.5 py-1 text-xs font-bold text-(--muted) transition-colors hover:border-(--accent) hover:text-(--accent)"
      >
        Edit
      </button>
      <button
        onClick={onDelete}
        className="rounded-lg border-2 border-(--danger)/40 px-2.5 py-1 text-xs font-bold text-(--danger) transition-colors hover:bg-(--danger)/10"
      >
        Delete
      </button>
    </div>
  );
}
