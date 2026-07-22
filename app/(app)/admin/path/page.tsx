"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Spinner from "@/components/ui/Spinner/Spinner";
import UIButton from "@/components/ui/button/button";
import {
  AdminModal,
  Field,
  ModalError,
  Toggle,
  ToastBanner,
  modalInputCls,
  useToast,
} from "@/components/admin/ui";
import {
  getDifficulties,
  getStructure,
  getSectionNodes,
  createPathNode,
  updatePathNode,
  deletePathNode,
  getPronunciationUnits,
  getGrammarPills,
  getVocabPacks,
  getLetterPacks,
  getNumberPacks,
  getReadings,
  type AdminDifficulty,
  type AdminStructure,
  type AdminPathNode,
  type PathNodeType,
} from "@/services/admin.service";

type RefOption = { id: number; label: string };

const NODE_TYPES: { key: PathNodeType; label: string; color: string }[] = [
  { key: "practice", label: "Practice", color: "var(--accent)" },
  { key: "pronunciation", label: "Pronunciation", color: "var(--gem)" },
  { key: "grammar", label: "Grammar", color: "var(--primary)" },
  { key: "vocab", label: "Vocab", color: "var(--success)" },
  { key: "letters", label: "Letters", color: "var(--gold)" },
  { key: "numbers", label: "Numbers", color: "var(--navy)" },
  { key: "reading", label: "Reading", color: "var(--flame)" },
  { key: "checkpoint", label: "Checkpoint", color: "var(--danger)" },
];

const typeMeta = (t: PathNodeType) =>
  NODE_TYPES.find((n) => n.key === t) ?? NODE_TYPES[0];

// A large sentinel slot used to park a node while swapping two positions,
// so the (section_id, position) uniqueness never trips mid-swap.
const TEMP_POSITION = 1_000_000;

export default function AdminPathPage() {
  const [difficulties, setDifficulties] = useState<AdminDifficulty[]>([]);
  const [difficultyId, setDifficultyId] = useState<number | null>(null);
  const [structure, setStructure] = useState<AdminStructure | null>(null);
  const [sectionId, setSectionId] = useState<number | null>(null);

  const [nodes, setNodes] = useState<AdminPathNode[]>([]);
  const [loadingNodes, setLoadingNodes] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Ref catalogs (loaded once) used to resolve refId → title and to fill the
  // ref dropdown when composing a node.
  const [pronunciation, setPronunciation] = useState<RefOption[]>([]);
  const [grammar, setGrammar] = useState<RefOption[]>([]);
  const [vocab, setVocab] = useState<RefOption[]>([]);
  const [letters, setLetters] = useState<RefOption[]>([]);
  const [numbers, setNumbers] = useState<RefOption[]>([]);
  const [readings, setReadings] = useState<RefOption[]>([]);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingNode, setEditingNode] = useState<AdminPathNode | null>(null);

  const [toast, flash] = useToast();

  const loadNodes = useCallback(
    (sid: number) => {
      setLoadingNodes(true);
      getSectionNodes(sid)
        .then(setNodes)
        .catch(() => flash("Could not load nodes.", "error"))
        .finally(() => setLoadingNodes(false));
    },
    [flash],
  );

  const loadStructure = useCallback(
    (id: number) => {
      setDifficultyId(id);
      setSectionId(null);
      setNodes([]);
      getStructure(id)
        .then((s) => {
          setStructure(s);
          if (s.sections.length > 0) {
            setSectionId(s.sections[0].id);
            loadNodes(s.sections[0].id);
          }
        })
        .catch(() => setError("Could not load the difficulty structure."));
    },
    [loadNodes],
  );

  // Difficulties + ref catalogs, once.
  useEffect(() => {
    getDifficulties()
      .then((d) => {
        setDifficulties(d);
        if (d.length > 0) loadStructure(d[0].id);
      })
      .catch(() => setError("Could not load difficulties."));
    getPronunciationUnits()
      .then((u) => setPronunciation(u.map((x) => ({ id: x.id, label: x.title }))))
      .catch(() => {});
    getGrammarPills()
      .then((p) => setGrammar(p.map((x) => ({ id: x.id, label: x.title }))))
      .catch(() => {});
    getVocabPacks()
      .then((p) => setVocab(p.map((x) => ({ id: x.id, label: x.title }))))
      .catch(() => {});
    getLetterPacks()
      .then((p) => setLetters(p.map((x) => ({ id: x.id, label: x.title }))))
      .catch(() => {});
    getNumberPacks()
      .then((p) => setNumbers(p.map((x) => ({ id: x.id, label: x.title }))))
      .catch(() => {});
    getReadings()
      .then((r) => setReadings(r.map((x) => ({ id: x.id, label: x.title }))))
      .catch(() => {});
  }, [loadStructure]);

  // Handler-only refresh (never called from an effect → no cascading render).
  const refreshNodes = useCallback(() => {
    if (sectionId != null) loadNodes(sectionId);
  }, [sectionId, loadNodes]);

  // Practice nodes point at levels.id — options are the levels of the current
  // difficulty, labelled with their section for disambiguation.
  const levelOptions = useMemo<RefOption[]>(
    () =>
      (structure?.sections ?? []).flatMap((s) =>
        s.levels.map((l) => ({ id: l.id, label: `${s.name} · ${l.name}` })),
      ),
    [structure],
  );

  const optionsFor = useCallback(
    (type: PathNodeType): RefOption[] => {
      switch (type) {
        case "practice":
          return levelOptions;
        case "pronunciation":
          return pronunciation;
        case "grammar":
          return grammar;
        case "vocab":
          return vocab;
        case "letters":
          return letters;
        case "numbers":
          return numbers;
        case "reading":
          return readings;
        default:
          return [];
      }
    },
    [levelOptions, pronunciation, grammar, vocab, letters, numbers, readings],
  );

  const refLabel = useCallback(
    (node: AdminPathNode): string => {
      if (node.type === "checkpoint") return node.title || "Checkpoint";
      if (node.refId == null) return "—";
      const found = optionsFor(node.type).find((o) => o.id === node.refId);
      return found ? found.label : `#${node.refId}`;
    },
    [optionsFor],
  );

  const sortedNodes = useMemo(
    () => [...nodes].sort((a, b) => a.position - b.position),
    [nodes],
  );

  const toggleNode = async (node: AdminPathNode) => {
    try {
      await updatePathNode(node.id, { enabled: !node.enabled });
      setNodes((prev) =>
        prev.map((n) =>
          n.id === node.id ? { ...n, enabled: !n.enabled } : n,
        ),
      );
    } catch {
      flash("Could not update the node.", "error");
    }
  };

  const removeNode = async (node: AdminPathNode) => {
    if (
      !confirm(
        `Delete this ${node.type} node at position ${node.position}?\nProgress rows for it will also be cleared.`,
      )
    )
      return;
    try {
      await deletePathNode(node.id);
      setNodes((prev) => prev.filter((n) => n.id !== node.id));
      flash("Node deleted.");
    } catch {
      flash("Could not delete the node.", "error");
    }
  };

  // Swap a node with its neighbour by parking it at TEMP_POSITION first.
  const move = async (node: AdminPathNode, dir: "up" | "down") => {
    const idx = sortedNodes.findIndex((n) => n.id === node.id);
    const swapIdx = dir === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= sortedNodes.length) return;
    const a = sortedNodes[idx];
    const b = sortedNodes[swapIdx];
    try {
      await updatePathNode(a.id, { position: TEMP_POSITION });
      await updatePathNode(b.id, { position: a.position });
      await updatePathNode(a.id, { position: b.position });
      refreshNodes();
    } catch {
      flash("Could not reorder.", "error");
      refreshNodes();
    }
  };

  if (error) {
    return (
      <div className="flex flex-col gap-4">
        <div className="rounded-2xl border-2 border-(--danger)/30 bg-(--danger)/10 px-5 py-4 text-sm font-bold text-(--danger)">
          {error}
        </div>
        <UIButton
          tone="neutral"
          onClick={() => {
            setError(null);
            if (difficultyId != null) loadStructure(difficultyId);
          }}
        >
          Retry
        </UIButton>
      </div>
    );
  }

  const sections = structure?.sections ?? [];

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h1 className="font-display text-2xl font-extrabold text-foreground">
          Learning path
        </h1>
        <p className="text-sm font-semibold text-(--muted)">
          Arrange the nodes learners walk through, section by section.
        </p>
      </div>

      {/* Difficulty + section pickers */}
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
          value={sectionId ?? ""}
          onChange={(e) => {
            const sid = Number(e.target.value);
            setSectionId(sid);
            loadNodes(sid);
          }}
          className="rounded-xl border-2 border-(--border) bg-(--surface) px-4 py-2.5 text-sm font-bold text-foreground outline-none focus:border-(--accent)"
        >
          {sections.length === 0 && <option value="">No sections</option>}
          {sections.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>

        <div className="ml-auto">
          <UIButton
            tone="accent"
            disabled={sectionId == null}
            onClick={() => {
              setEditingNode(null);
              setModalOpen(true);
            }}
          >
            + New node
          </UIButton>
        </div>
      </div>

      {loadingNodes ? (
        <div className="py-16">
          <Spinner title="Loading nodes…" />
        </div>
      ) : sortedNodes.length === 0 ? (
        <p className="rounded-2xl border-2 border-dashed border-(--border) px-5 py-8 text-center text-sm font-semibold text-(--muted)">
          No nodes in this section yet. Add the first one!
        </p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border-2 border-(--border)">
          <table className="w-full text-left text-sm">
            <thead className="bg-(--surface) text-(--muted)">
              <tr className="text-xs font-extrabold uppercase tracking-wide">
                <th className="px-4 py-3">Pos</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Points to</th>
                <th className="px-4 py-3">Title</th>
                <th className="px-4 py-3 text-center">Enabled</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {sortedNodes.map((node, i) => {
                const meta = typeMeta(node.type);
                return (
                  <tr
                    key={node.id}
                    className="border-t border-(--border) align-middle"
                  >
                    <td className="px-4 py-3 font-bold text-(--muted)">
                      <div className="flex items-center gap-1.5">
                        <span className="w-6 tabular-nums">{node.position}</span>
                        <div className="flex flex-col">
                          <button
                            onClick={() => move(node, "up")}
                            disabled={i === 0}
                            className="text-xs leading-none text-(--muted) hover:text-(--accent) disabled:opacity-30"
                            aria-label="Move up"
                          >
                            ▲
                          </button>
                          <button
                            onClick={() => move(node, "down")}
                            disabled={i === sortedNodes.length - 1}
                            className="text-xs leading-none text-(--muted) hover:text-(--accent) disabled:opacity-30"
                            aria-label="Move down"
                          >
                            ▼
                          </button>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className="inline-block rounded-full px-2.5 py-0.5 text-[11px] font-extrabold text-white"
                        style={{ background: meta.color }}
                      >
                        {meta.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-semibold text-foreground">
                      {refLabel(node)}
                    </td>
                    <td className="px-4 py-3 font-semibold text-(--muted)">
                      {node.title || "—"}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Toggle
                        on={node.enabled}
                        onClick={() => toggleNode(node)}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => {
                            setEditingNode(node);
                            setModalOpen(true);
                          }}
                          className="rounded-lg border-2 border-(--border) px-2.5 py-1 text-xs font-bold text-(--muted) transition-colors hover:border-(--accent) hover:text-(--accent)"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => removeNode(node)}
                          className="rounded-lg border-2 border-(--danger)/40 px-2.5 py-1 text-xs font-bold text-(--danger) transition-colors hover:bg-(--danger)/10"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {modalOpen && sectionId != null && (
        <NodeModal
          sectionId={sectionId}
          node={editingNode}
          existing={nodes}
          optionsFor={optionsFor}
          onClose={() => setModalOpen(false)}
          onSaved={(msg) => {
            setModalOpen(false);
            refreshNodes();
            flash(msg);
          }}
        />
      )}

      {toast && <ToastBanner toast={toast} />}
    </div>
  );
}

// ── Node create/edit modal ─────────────────────────────────────
function NodeModal({
  sectionId,
  node,
  existing,
  optionsFor,
  onClose,
  onSaved,
}: {
  sectionId: number;
  node: AdminPathNode | null;
  existing: AdminPathNode[];
  optionsFor: (type: PathNodeType) => RefOption[];
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const isEdit = Boolean(node);
  const [type, setType] = useState<PathNodeType>(node?.type ?? "practice");
  const [refId, setRefId] = useState<string>(
    node?.refId != null ? String(node.refId) : "",
  );
  const [position, setPosition] = useState<string>(
    node ? String(node.position) : "",
  );
  const [title, setTitle] = useState(node?.title ?? "");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  const needsRef = type !== "checkpoint";
  const options = optionsFor(type);

  const save = async () => {
    if (!/^\d+$/.test(position)) {
      setErr("Position must be a whole number.");
      return;
    }
    const pos = Number(position);
    if (needsRef && !refId) {
      setErr("Pick the content this node points to.");
      return;
    }
    // Client-side collision hint (server also enforces it).
    const clash = existing.find(
      (n) => n.position === pos && n.id !== node?.id,
    );
    if (clash) {
      setErr(
        `Position ${pos} is already taken by a ${clash.type} node (#${clash.id}). Pick another.`,
      );
      return;
    }

    setSaving(true);
    setErr("");
    const payload = {
      position: pos,
      type,
      refId: needsRef ? Number(refId) : null,
      title: title.trim() || undefined,
    };
    try {
      if (isEdit && node) {
        await updatePathNode(node.id, payload);
        onSaved("Node updated.");
      } else {
        await createPathNode({ sectionId, ...payload });
        onSaved("Node created.");
      }
    } catch (e: unknown) {
      const ex = e as { response?: { data?: { message?: string } } };
      setErr(ex?.response?.data?.message ?? "Could not save. Please try again.");
      setSaving(false);
    }
  };

  return (
    <AdminModal
      title={isEdit ? "Edit node" : "New node"}
      onClose={onClose}
      footer={
        <>
          <UIButton tone="neutral" onClick={onClose}>
            Cancel
          </UIButton>
          <UIButton tone="accent" onClick={save} disabled={saving}>
            {saving ? "Saving…" : isEdit ? "Save changes" : "Create node"}
          </UIButton>
        </>
      }
    >
      <ModalError text={err} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Type">
          <select
            value={type}
            onChange={(e) => {
              setType(e.target.value as PathNodeType);
              setRefId("");
            }}
            className={modalInputCls}
          >
            {NODE_TYPES.map((t) => (
              <option key={t.key} value={t.key}>
                {t.label}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Position (order in the section)">
          <input
            value={position}
            onChange={(e) => setPosition(e.target.value)}
            placeholder="0"
            inputMode="numeric"
            className={modalInputCls}
          />
        </Field>
      </div>

      {needsRef && (
        <Field label="Points to">
          <select
            value={refId}
            onChange={(e) => setRefId(e.target.value)}
            className={modalInputCls}
          >
            <option value="">— Select —</option>
            {options.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>
        </Field>
      )}

      <Field
        label={
          type === "checkpoint"
            ? "Title (shown on the checkpoint)"
            : "Title (optional override)"
        }
      >
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={type === "checkpoint" ? "Checkpoint" : "Auto"}
          className={modalInputCls}
        />
      </Field>
    </AdminModal>
  );
}
