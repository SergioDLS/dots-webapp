"use client";

import React, { useCallback, useEffect, useState } from "react";
import Spinner from "@/components/ui/Spinner/Spinner";
import UIButton from "@/components/ui/button/button";
import {
  AdminModal,
  Field,
  ModalError,
  Toggle,
  modalInputCls,
} from "@/components/admin/ui";
import {
  getGrammarPills,
  createGrammarPill,
  updateGrammarPill,
  deleteGrammarPill,
  getGrammarItems,
  createGrammarItem,
  updateGrammarItem,
  deleteGrammarItem,
  type GrammarBlock,
  type AdminGrammarPill,
  type AdminGrammarItem,
} from "@/services/admin.service";

export default function GrammarManager({
  flash,
}: {
  flash: (text: string, kind?: "ok" | "error") => void;
}) {
  const [pills, setPills] = useState<AdminGrammarPill[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedPill, setSelectedPill] = useState<AdminGrammarPill | null>(
    null,
  );
  const [pillModalOpen, setPillModalOpen] = useState(false);
  const [editingPill, setEditingPill] = useState<AdminGrammarPill | null>(null);

  // Load pills on mount
  useEffect(() => {
    getGrammarPills()
      .then(setPills)
      .catch(() => setError("Could not load grammar pills."))
      .finally(() => setLoading(false));
  }, []);

  const refreshPills = useCallback(() => {
    getGrammarPills().then(setPills).catch(() => {});
  }, []);

  const togglePill = async (pill: AdminGrammarPill) => {
    try {
      await updateGrammarPill(pill.id, { enabled: !pill.enabled });
      setPills((prev) =>
        prev.map((p) =>
          p.id === pill.id ? { ...p, enabled: !p.enabled } : p,
        ),
      );
    } catch {
      flash("Could not update the pill.", "error");
    }
  };

  const removePill = async (pill: AdminGrammarPill) => {
    if (!confirm(`Delete pill "${pill.title}" and all its items?`)) return;
    try {
      await deleteGrammarPill(pill.id);
      setPills((prev) => prev.filter((p) => p.id !== pill.id));
      flash("Pill deleted.");
    } catch {
      flash("Could not delete the pill.", "error");
    }
  };

  if (error) {
    return (
      <div className="rounded-2xl border-2 border-(--danger)/30 bg-(--danger)/10 px-5 py-4 text-sm font-bold text-(--danger)">
        {error}
      </div>
    );
  }

  if (selectedPill) {
    return (
      <PillDetail
        pill={selectedPill}
        onBack={() => setSelectedPill(null)}
        flash={flash}
      />
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-extrabold text-foreground">
          Grammar pills
        </h1>
        <UIButton
          tone="accent"
          onClick={() => {
            setEditingPill(null);
            setPillModalOpen(true);
          }}
        >
          + New pill
        </UIButton>
      </div>

      {loading ? (
        <div className="py-16">
          <Spinner title="Loading grammar pills…" />
        </div>
      ) : pills.length === 0 ? (
        <p className="rounded-2xl border-2 border-dashed border-(--border) px-5 py-8 text-center text-sm font-semibold text-(--muted)">
          No pills yet. Add the first one!
        </p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border-2 border-(--border)">
          <table className="w-full text-left text-sm">
            <thead className="bg-(--surface) text-(--muted)">
              <tr className="text-xs font-extrabold uppercase tracking-wide">
                <th className="px-4 py-3">Title</th>
                <th className="px-4 py-3 text-center">Enabled</th>
                <th className="px-4 py-3">Items</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {pills.map((pill) => (
                <tr
                  key={pill.id}
                  className="border-t border-(--border) align-middle"
                >
                  <td className="px-4 py-3">
                    <div className="font-bold text-foreground">
                      {pill.title}
                    </div>
                    <div className="flex items-center gap-2 text-xs font-semibold text-(--muted)">
                      <span>{pill.key}</span>
                      <span>·</span>
                      <span>{pill.explanation.length} blocks</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <Toggle
                      on={pill.enabled}
                      onClick={() => togglePill(pill)}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <UIButton
                      tone="neutral"
                      onClick={() => setSelectedPill(pill)}
                    >
                      Manage →
                    </UIButton>
                  </td>
                  <td className="px-4 py-3">
                    <RowActions
                      onEdit={() => {
                        setEditingPill(pill);
                        setPillModalOpen(true);
                      }}
                      onDelete={() => removePill(pill)}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {pillModalOpen && (
        <PillModal
          pill={editingPill}
          onClose={() => setPillModalOpen(false)}
          onSaved={(msg) => {
            setPillModalOpen(false);
            refreshPills();
            flash(msg);
          }}
        />
      )}
    </div>
  );
}

// ── Pill detail: items table ──────────────────────────────────
function PillDetail({
  pill,
  onBack,
  flash,
}: {
  pill: AdminGrammarPill;
  onBack: () => void;
  flash: (text: string, kind?: "ok" | "error") => void;
}) {
  const [items, setItems] = useState<AdminGrammarItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [itemModalOpen, setItemModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<AdminGrammarItem | null>(null);

  useEffect(() => {
    getGrammarItems(pill.id)
      .then(setItems)
      .catch(() => flash("Could not load items.", "error"))
      .finally(() => setLoading(false));
  }, [pill.id, flash]);

  const refreshItems = useCallback(() => {
    getGrammarItems(pill.id).then(setItems).catch(() => {});
  }, [pill.id]);

  const removeItem = async (item: AdminGrammarItem) => {
    if (!confirm(`Delete this item?\n\n"${item.text}"`)) return;
    try {
      await deleteGrammarItem(item.id);
      setItems((prev) => prev.filter((x) => x.id !== item.id));
      flash("Item deleted.");
    } catch {
      flash("Could not delete the item.", "error");
    }
  };

  const ordered = [...items].sort((a, b) => a.position - b.position);

  return (
    <div className="flex flex-col gap-5">
      <button
        onClick={onBack}
        className="self-start text-sm font-bold text-(--muted) transition-colors hover:text-(--accent)"
      >
        ← Back to pills
      </button>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-extrabold text-foreground">
          {pill.title}
        </h1>
        <UIButton
          tone="accent"
          onClick={() => {
            setEditingItem(null);
            setItemModalOpen(true);
          }}
        >
          + New item
        </UIButton>
      </div>

      {loading ? (
        <div className="py-16">
          <Spinner title="Loading items…" />
        </div>
      ) : ordered.length === 0 ? (
        <p className="rounded-2xl border-2 border-dashed border-(--border) px-5 py-8 text-center text-sm font-semibold text-(--muted)">
          No items yet. Add the first one!
        </p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border-2 border-(--border)">
          <table className="w-full text-left text-sm">
            <thead className="bg-(--surface) text-(--muted)">
              <tr className="text-xs font-extrabold uppercase tracking-wide">
                <th className="px-4 py-3">#</th>
                <th className="px-4 py-3">Sentence</th>
                <th className="px-4 py-3">Answer</th>
                <th className="px-4 py-3">Distractors</th>
                <th className="px-4 py-3">Mode</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {ordered.map((item) => (
                <tr
                  key={item.id}
                  className="border-t border-(--border) align-middle"
                >
                  <td className="px-4 py-3 text-xs font-bold text-(--muted)">
                    {item.position}
                  </td>
                  <td className="px-4 py-3 font-semibold text-foreground">
                    {item.text}
                  </td>
                  <td className="px-4 py-3 font-bold text-(--accent)">
                    {item.answer}
                  </td>
                  <td className="px-4 py-3 font-semibold text-(--muted)">
                    {item.distractors.length > 0
                      ? item.distractors.join(" · ")
                      : "—"}
                  </td>
                  <td className="px-4 py-3 font-semibold text-(--muted)">
                    {item.mode}
                  </td>
                  <td className="px-4 py-3">
                    <RowActions
                      onEdit={() => {
                        setEditingItem(item);
                        setItemModalOpen(true);
                      }}
                      onDelete={() => removeItem(item)}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {itemModalOpen && (
        <ItemModal
          pillId={pill.id}
          item={editingItem}
          onClose={() => setItemModalOpen(false)}
          onSaved={(msg) => {
            setItemModalOpen(false);
            refreshItems();
            flash(msg);
          }}
        />
      )}
    </div>
  );
}

// ── Pill modal (create / edit) ────────────────────────────────
function PillModal({
  pill,
  onClose,
  onSaved,
}: {
  pill: AdminGrammarPill | null;
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const isEdit = Boolean(pill);
  const [key, setKey] = useState(pill?.key ?? "");
  const [title, setTitle] = useState(pill?.title ?? "");
  const [blocks, setBlocks] = useState<GrammarBlock[]>(
    pill?.explanation ?? [],
  );
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  const addBlock = () => {
    setBlocks((prev) => [...prev, { type: "p", text: "" }]);
  };

  const updateBlock = (index: number, patch: Partial<GrammarBlock>) => {
    setBlocks((prev) =>
      prev.map((b, i) => (i === index ? { ...b, ...patch } : b)),
    );
  };

  const removeBlock = (index: number) => {
    setBlocks((prev) => prev.filter((_, i) => i !== index));
  };

  const save = async () => {
    if (!isEdit && !key.trim()) {
      setErr("Please write the key.");
      return;
    }
    if (!title.trim()) {
      setErr("Please write the title.");
      return;
    }
    const explanation = blocks
      .filter((b) => b.text.trim() !== "")
      .map((b) => ({
        type: b.type,
        text: b.text.trim(),
        ...(b.en && b.en.trim() ? { en: b.en.trim() } : {}),
      }));
    setSaving(true);
    setErr("");
    try {
      if (isEdit && pill) {
        await updateGrammarPill(pill.id, {
          title: title.trim(),
          explanation,
        });
        onSaved("Pill updated.");
      } else {
        await createGrammarPill({
          key: key.trim(),
          title: title.trim(),
          explanation,
        });
        onSaved("Pill created.");
      }
    } catch (e: unknown) {
      const ex = e as { response?: { data?: { message?: string } } };
      setErr(ex?.response?.data?.message ?? "Could not save. Please try again.");
      setSaving(false);
    }
  };

  return (
    <AdminModal
      title={isEdit ? "Edit pill" : "New pill"}
      onClose={onClose}
      wide
      footer={
        <>
          <UIButton tone="neutral" onClick={onClose}>
            Cancel
          </UIButton>
          <UIButton tone="accent" onClick={save} disabled={saving}>
            {saving ? "Saving…" : isEdit ? "Save changes" : "Create pill"}
          </UIButton>
        </>
      }
    >
      <ModalError text={err} />

      {!isEdit && (
        <Field label="Key">
          <input
            value={key}
            onChange={(e) => setKey(e.target.value)}
            placeholder="present-simple"
            className={modalInputCls}
          />
        </Field>
      )}

      <Field label="Title">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Present simple"
          className={modalInputCls}
        />
      </Field>

      {/* Explanation editor */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between px-1">
          <span className="text-xs font-bold text-(--muted)">Explanation</span>
          <button
            onClick={addBlock}
            className="rounded-lg border-2 border-(--border) px-2.5 py-1 text-xs font-bold text-(--muted) transition-colors hover:border-(--accent) hover:text-(--accent)"
          >
            + Add block
          </button>
        </div>

        {blocks.length === 0 ? (
          <p className="rounded-2xl border-2 border-dashed border-(--border) px-4 py-5 text-center text-xs font-semibold text-(--muted)">
            No blocks yet. Add the first one!
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            {blocks.map((block, i) => (
              <div
                key={i}
                className="flex flex-col gap-2 rounded-2xl border-2 border-(--border) p-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <select
                    value={block.type}
                    onChange={(e) =>
                      updateBlock(i, {
                        type: e.target.value as GrammarBlock["type"],
                      })
                    }
                    className="rounded-xl border-2 border-(--border) bg-(--surface) px-3 py-2 text-sm font-bold text-foreground outline-none focus:border-(--accent)"
                  >
                    <option value="p">Paragraph</option>
                    <option value="example">Example</option>
                    <option value="tip">Tip</option>
                  </select>
                  <button
                    onClick={() => removeBlock(i)}
                    className="rounded-lg border-2 border-(--danger)/40 px-2.5 py-1 text-xs font-bold text-(--danger) transition-colors hover:bg-(--danger)/10"
                  >
                    Remove
                  </button>
                </div>
                <textarea
                  value={block.text}
                  onChange={(e) => updateBlock(i, { text: e.target.value })}
                  placeholder="Text"
                  rows={2}
                  className={modalInputCls}
                />
                <input
                  value={block.en ?? ""}
                  onChange={(e) => updateBlock(i, { en: e.target.value })}
                  placeholder="English gloss (optional)"
                  className={modalInputCls}
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </AdminModal>
  );
}

// ── Item modal (create / edit) ────────────────────────────────
function ItemModal({
  pillId,
  item,
  onClose,
  onSaved,
}: {
  pillId: number;
  item: AdminGrammarItem | null;
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const isEdit = Boolean(item);
  const [text, setText] = useState(item?.text ?? "");
  const [answer, setAnswer] = useState(item?.answer ?? "");
  const [distractors, setDistractors] = useState<string[]>(
    item?.distractors ?? [],
  );
  const [mode, setMode] = useState<"complete" | "select">(
    item?.mode ?? "complete",
  );
  const [position, setPosition] = useState<string>(
    item?.position != null ? String(item.position) : "",
  );
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  const addDistractor = () => {
    setDistractors((prev) => [...prev, ""]);
  };

  const updateDistractor = (index: number, value: string) => {
    setDistractors((prev) => prev.map((d, i) => (i === index ? value : d)));
  };

  const removeDistractor = (index: number) => {
    setDistractors((prev) => prev.filter((_, i) => i !== index));
  };

  const save = async () => {
    const blanks = (text.match(/__/g) ?? []).length;
    if (blanks !== 1) {
      setErr('The text must contain "__" exactly once');
      return;
    }
    if (!answer.trim()) {
      setErr("Please write the answer.");
      return;
    }
    if (position !== "" && (!/^\d+$/.test(position) || Number(position) < 0)) {
      setErr("Position must be a positive number.");
      return;
    }
    const cleanDistractors = distractors
      .map((d) => d.trim())
      .filter((d) => d !== "");
    setSaving(true);
    setErr("");
    try {
      if (isEdit && item) {
        await updateGrammarItem(item.id, {
          text: text.trim(),
          answer: answer.trim(),
          distractors: cleanDistractors,
          mode,
          ...(position !== "" ? { position: Number(position) } : {}),
        });
        onSaved("Item updated.");
      } else {
        await createGrammarItem({
          pillId,
          text: text.trim(),
          answer: answer.trim(),
          distractors: cleanDistractors,
          mode,
          ...(position !== "" ? { position: Number(position) } : {}),
        });
        onSaved("Item created.");
      }
    } catch (e: unknown) {
      const ex = e as { response?: { data?: { message?: string } } };
      setErr(ex?.response?.data?.message ?? "Could not save. Please try again.");
      setSaving(false);
    }
  };

  return (
    <AdminModal
      title={isEdit ? "Edit item" : "New item"}
      onClose={onClose}
      footer={
        <>
          <UIButton tone="neutral" onClick={onClose}>
            Cancel
          </UIButton>
          <UIButton tone="accent" onClick={save} disabled={saving}>
            {saving ? "Saving…" : isEdit ? "Save changes" : "Create item"}
          </UIButton>
        </>
      }
    >
      <ModalError text={err} />

      <Field label='Sentence (use "__" for the blank)'>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="She __ to school every day."
          className={modalInputCls}
        />
      </Field>

      <Field label="Answer">
        <input
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          placeholder="goes"
          className={modalInputCls}
        />
      </Field>

      {/* Distractors editor */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between px-1">
          <span className="text-xs font-bold text-(--muted)">Distractors</span>
          <button
            onClick={addDistractor}
            className="rounded-lg border-2 border-(--border) px-2.5 py-1 text-xs font-bold text-(--muted) transition-colors hover:border-(--accent) hover:text-(--accent)"
          >
            + Add distractor
          </button>
        </div>

        {distractors.length === 0 ? (
          <p className="rounded-2xl border-2 border-dashed border-(--border) px-4 py-5 text-center text-xs font-semibold text-(--muted)">
            No distractors yet.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {distractors.map((d, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  value={d}
                  onChange={(e) => updateDistractor(i, e.target.value)}
                  placeholder="go"
                  className={modalInputCls}
                />
                <button
                  onClick={() => removeDistractor(i)}
                  className="shrink-0 rounded-lg border-2 border-(--danger)/40 px-2.5 py-1 text-xs font-bold text-(--danger) transition-colors hover:bg-(--danger)/10"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Mode">
          <select
            value={mode}
            onChange={(e) => setMode(e.target.value as "complete" | "select")}
            className={modalInputCls}
          >
            <option value="complete">complete</option>
            <option value="select">select</option>
          </select>
        </Field>

        <Field label="Position (optional)">
          <input
            value={position}
            onChange={(e) => setPosition(e.target.value)}
            placeholder="Auto"
            inputMode="numeric"
            className={modalInputCls}
          />
        </Field>
      </div>
    </AdminModal>
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
