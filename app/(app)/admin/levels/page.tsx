"use client";

import React, { useCallback, useEffect, useState } from "react";
import Spinner from "@/components/ui/Spinner/Spinner";
import UIButton from "@/components/ui/button/button";
import SentenceModal from "@/components/admin/sentence-modal";
import {
  getDifficulties,
  getStructure,
  getSentences,
  setLevelEnabled,
  setSentenceEnabled,
  deleteSentence,
  type AdminDifficulty,
  type AdminStructure,
  type AdminLevel,
  type AdminSentence,
} from "@/services/admin.service";

type Toast = { text: string; kind: "ok" | "error" } | null;

export default function AdminLevelsPage() {
  const [difficulties, setDifficulties] = useState<AdminDifficulty[]>([]);
  const [difficultyId, setDifficultyId] = useState<number | null>(null);
  const [structure, setStructure] = useState<AdminStructure | null>(null);
  const [sectionFilter, setSectionFilter] = useState<number>(0); // 0 = all
  const [loadingStructure, setLoadingStructure] = useState(false);

  const [selectedLevel, setSelectedLevel] = useState<AdminLevel | null>(null);
  const [sentences, setSentences] = useState<AdminSentence[]>([]);
  const [loadingSentences, setLoadingSentences] = useState(false);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<AdminSentence | null>(null);
  const [toast, setToast] = useState<Toast>(null);
  const [error, setError] = useState<string | null>(null);

  const flash = (text: string, kind: "ok" | "error" = "ok") => {
    setToast({ text, kind });
    setTimeout(() => setToast(null), 2600);
  };

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

  const openLevel = useCallback((level: AdminLevel) => {
    setSelectedLevel(level);
    setLoadingSentences(true);
    getSentences(level.id)
      .then(setSentences)
      .catch(() => flash("Could not load sentences.", "error"))
      .finally(() => setLoadingSentences(false));
  }, []);

  const refreshSentences = useCallback(() => {
    if (!selectedLevel) return;
    getSentences(selectedLevel.id).then(setSentences).catch(() => {});
  }, [selectedLevel]);

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

  if (error) {
    return (
      <div className="rounded-2xl border-2 border-(--danger)/30 bg-(--danger)/10 px-5 py-4 text-sm font-bold text-(--danger)">
        {error}
      </div>
    );
  }

  // ── Sentence editor view ─────────────────────────────────────
  if (selectedLevel) {
    return (
      <div className="flex flex-col gap-5">
        <button
          onClick={() => setSelectedLevel(null)}
          className="self-start text-sm font-bold text-(--muted) transition-colors hover:text-(--accent)"
        >
          ← Back to levels
        </button>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="font-display text-2xl font-extrabold capitalize text-foreground">
            {selectedLevel.name}
          </h1>
          <UIButton
            tone="accent"
            onClick={() => {
              setEditing(null);
              setModalOpen(true);
            }}
          >
            + New sentence
          </UIButton>
        </div>

        {loadingSentences ? (
          <div className="py-16">
            <Spinner title="Loading sentences…" />
          </div>
        ) : sentences.length === 0 ? (
          <p className="rounded-2xl border-2 border-dashed border-(--border) px-5 py-8 text-center text-sm font-semibold text-(--muted)">
            No sentences yet. Add the first one!
          </p>
        ) : (
          <div className="overflow-hidden rounded-2xl border-2 border-(--border)">
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
                      <button
                        onClick={() => toggleSentence(s)}
                        className="inline-flex h-6 w-11 items-center rounded-full p-0.5 transition-colors"
                        style={{
                          background: s.enabled
                            ? "var(--success)"
                            : "var(--border)",
                        }}
                        aria-pressed={s.enabled}
                        title={s.enabled ? "Enabled" : "Disabled"}
                      >
                        <span
                          className="h-5 w-5 rounded-full bg-white transition-transform"
                          style={{
                            transform: s.enabled
                              ? "translateX(20px)"
                              : "translateX(0)",
                          }}
                        />
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => {
                            setEditing(s);
                            setModalOpen(true);
                          }}
                          className="rounded-lg border-2 border-(--border) px-2.5 py-1 text-xs font-bold text-(--muted) transition-colors hover:border-(--accent) hover:text-(--accent)"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => removeSentence(s)}
                          className="rounded-lg border-2 border-(--danger)/40 px-2.5 py-1 text-xs font-bold text-(--danger) transition-colors hover:bg-(--danger)/10"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {modalOpen && selectedLevel && (
          <SentenceModal
            levelId={selectedLevel.id}
            sentence={editing}
            onClose={() => setModalOpen(false)}
            onSaved={(msg) => {
              setModalOpen(false);
              refreshSentences();
              flash(msg);
            }}
          />
        )}

        {toast && <ToastBanner toast={toast} />}
      </div>
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
        Levels &amp; Sentences
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
                      <th className="px-4 py-3 text-right">Sentences</th>
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
                          <button
                            onClick={() => toggleLevel(level)}
                            className="inline-flex h-6 w-11 items-center rounded-full p-0.5 transition-colors"
                            style={{
                              background: level.enabled
                                ? "var(--success)"
                                : "var(--border)",
                            }}
                            aria-pressed={level.enabled}
                          >
                            <span
                              className="h-5 w-5 rounded-full bg-white transition-transform"
                              style={{
                                transform: level.enabled
                                  ? "translateX(20px)"
                                  : "translateX(0)",
                              }}
                            />
                          </button>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <UIButton tone="neutral" onClick={() => openLevel(level)}>
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

function ToastBanner({ toast }: { toast: NonNullable<Toast> }) {
  return (
    <div
      className="pop-in fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-2xl px-5 py-3 text-sm font-extrabold text-white shadow-lg"
      style={{
        background: toast.kind === "ok" ? "var(--success)" : "var(--danger)",
      }}
    >
      {toast.text}
    </div>
  );
}
