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
  getPronunciationUnits,
  createPronunciationUnit,
  updatePronunciationUnit,
  deletePronunciationUnit,
  getPronunciationItems,
  createPronunciationItem,
  updatePronunciationItem,
  deletePronunciationItem,
  generatePronunciationAudio,
  type AdminPronunciationUnit,
  type AdminPronunciationItem,
} from "@/services/admin.service";

export default function PronunciationManager({
  flash,
}: {
  flash: (text: string, kind?: "ok" | "error") => void;
}) {
  const [units, setUnits] = useState<AdminPronunciationUnit[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedUnit, setSelectedUnit] =
    useState<AdminPronunciationUnit | null>(null);

  const [unitModalOpen, setUnitModalOpen] = useState(false);
  const [editingUnit, setEditingUnit] = useState<AdminPronunciationUnit | null>(
    null,
  );

  // Load units once on mount
  useEffect(() => {
    getPronunciationUnits()
      .then(setUnits)
      .catch(() => flash("Could not load pronunciation units.", "error"))
      .finally(() => setLoading(false));
  }, [flash]);

  const refreshUnits = useCallback(() => {
    getPronunciationUnits().then(setUnits).catch(() => {});
  }, []);

  const toggleUnit = async (u: AdminPronunciationUnit) => {
    try {
      await updatePronunciationUnit(u.id, { enabled: !u.enabled });
      setUnits((prev) =>
        prev.map((x) => (x.id === u.id ? { ...x, enabled: !x.enabled } : x)),
      );
    } catch {
      flash("Could not update the unit.", "error");
    }
  };

  const removeUnit = async (u: AdminPronunciationUnit) => {
    if (!confirm(`Delete this unit?\n\n"${u.title}"`)) return;
    try {
      await deletePronunciationUnit(u.id);
      setUnits((prev) => prev.filter((x) => x.id !== u.id));
      flash("Unit deleted.");
    } catch {
      flash("Could not delete the unit.", "error");
    }
  };

  if (selectedUnit) {
    return (
      <UnitDetail
        unit={selectedUnit}
        onBack={() => setSelectedUnit(null)}
        flash={flash}
      />
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-extrabold text-foreground">
          Pronunciation
        </h1>
        <UIButton
          tone="accent"
          onClick={() => {
            setEditingUnit(null);
            setUnitModalOpen(true);
          }}
        >
          + New unit
        </UIButton>
      </div>

      {loading ? (
        <div className="py-16">
          <Spinner title="Loading units…" />
        </div>
      ) : units.length === 0 ? (
        <p className="rounded-2xl border-2 border-dashed border-(--border) px-5 py-8 text-center text-sm font-semibold text-(--muted)">
          No units yet. Add the first one!
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
              {units.map((u) => (
                <tr
                  key={u.id}
                  className="border-t border-(--border) align-middle"
                >
                  <td className="px-4 py-3">
                    <div className="font-bold text-foreground">{u.title}</div>
                    <div className="flex items-center gap-2 text-xs font-bold text-(--muted)">
                      <span>{u.key}</span>
                      {(u.soundA || u.soundB) && (
                        <span className="text-(--accent)">
                          {u.soundA || "?"} vs {u.soundB || "?"}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <Toggle on={u.enabled} onClick={() => toggleUnit(u)} />
                  </td>
                  <td className="px-4 py-3">
                    <UIButton
                      tone="neutral"
                      onClick={() => setSelectedUnit(u)}
                    >
                      Manage →
                    </UIButton>
                  </td>
                  <td className="px-4 py-3">
                    <RowActions
                      onEdit={() => {
                        setEditingUnit(u);
                        setUnitModalOpen(true);
                      }}
                      onDelete={() => removeUnit(u)}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {unitModalOpen && (
        <UnitModal
          unit={editingUnit}
          onClose={() => setUnitModalOpen(false)}
          onSaved={(msg) => {
            setUnitModalOpen(false);
            refreshUnits();
            flash(msg);
          }}
        />
      )}
    </div>
  );
}

// ── Unit detail: minimal pairs ─────────────────────────────────
function UnitDetail({
  unit,
  onBack,
  flash,
}: {
  unit: AdminPronunciationUnit;
  onBack: () => void;
  flash: (text: string, kind?: "ok" | "error") => void;
}) {
  const [items, setItems] = useState<AdminPronunciationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [itemModalOpen, setItemModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<AdminPronunciationItem | null>(
    null,
  );
  const [generatingId, setGeneratingId] = useState<number | null>(null);

  useEffect(() => {
    getPronunciationItems(unit.id)
      .then(setItems)
      .catch(() => flash("Could not load pairs.", "error"))
      .finally(() => setLoading(false));
  }, [unit.id, flash]);

  const refreshItems = useCallback(() => {
    getPronunciationItems(unit.id).then(setItems).catch(() => {});
  }, [unit.id]);

  const removeItem = async (it: AdminPronunciationItem) => {
    if (!confirm(`Delete this pair?\n\n"${it.wordA}" / "${it.wordB}"`)) return;
    try {
      await deletePronunciationItem(it.id);
      setItems((prev) => prev.filter((x) => x.id !== it.id));
      flash("Pair deleted.");
    } catch {
      flash("Could not delete the pair.", "error");
    }
  };

  const generateAudio = async (it: AdminPronunciationItem) => {
    setGeneratingId(it.id);
    try {
      await generatePronunciationAudio(it.id);
      refreshItems();
      flash("Audio generado.");
    } catch {
      flash("Could not generate audio.", "error");
    } finally {
      setGeneratingId(null);
    }
  };

  const audioBadge = (it: AdminPronunciationItem) => {
    if (it.audioA && it.audioB) return "🔊🔊";
    if (it.audioA || it.audioB) return "🔊";
    return "—";
  };

  const orderedItems = [...items].sort((a, b) => a.position - b.position);

  return (
    <div className="flex flex-col gap-5">
      <button
        onClick={onBack}
        className="self-start text-sm font-bold text-(--muted) transition-colors hover:text-(--accent)"
      >
        ← Back to units
      </button>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-extrabold text-foreground">
          {unit.title}
        </h1>
        <UIButton
          tone="accent"
          onClick={() => {
            setEditingItem(null);
            setItemModalOpen(true);
          }}
        >
          + New pair
        </UIButton>
      </div>

      {loading ? (
        <div className="py-16">
          <Spinner title="Loading pairs…" />
        </div>
      ) : orderedItems.length === 0 ? (
        <p className="rounded-2xl border-2 border-dashed border-(--border) px-5 py-8 text-center text-sm font-semibold text-(--muted)">
          No pairs yet. Add the first one!
        </p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border-2 border-(--border)">
          <table className="w-full text-left text-sm">
            <thead className="bg-(--surface) text-(--muted)">
              <tr className="text-xs font-extrabold uppercase tracking-wide">
                <th className="px-4 py-3">#</th>
                <th className="px-4 py-3">Word A</th>
                <th className="px-4 py-3">Word B</th>
                <th className="px-4 py-3">Audio</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {orderedItems.map((it) => (
                <tr
                  key={it.id}
                  className="border-t border-(--border) align-middle"
                >
                  <td className="px-4 py-3 text-xs font-bold text-(--muted)">
                    {it.position ?? "—"}
                  </td>
                  <td className="px-4 py-3 font-bold text-foreground">
                    {it.wordA}
                  </td>
                  <td className="px-4 py-3 font-bold text-foreground">
                    {it.wordB}
                  </td>
                  <td className="px-4 py-3 text-sm font-bold text-(--muted)">
                    {audioBadge(it)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => generateAudio(it)}
                        disabled={generatingId === it.id}
                        className="rounded-lg border-2 border-(--border) px-2.5 py-1 text-xs font-bold text-(--muted) transition-colors hover:border-(--accent) hover:text-(--accent) disabled:opacity-50"
                      >
                        {generatingId === it.id ? "…" : "Generate audio"}
                      </button>
                      <RowActions
                        onEdit={() => {
                          setEditingItem(it);
                          setItemModalOpen(true);
                        }}
                        onDelete={() => removeItem(it)}
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {itemModalOpen && (
        <ItemModal
          unitId={unit.id}
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

// ── Unit modal (create/edit) ───────────────────────────────────
function UnitModal({
  unit,
  onClose,
  onSaved,
}: {
  unit: AdminPronunciationUnit | null; // null → create
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const isEdit = Boolean(unit);
  const [key, setKey] = useState(unit?.key ?? "");
  const [title, setTitle] = useState(unit?.title ?? "");
  const [descriptionEs, setDescriptionEs] = useState(unit?.descriptionEs ?? "");
  const [soundA, setSoundA] = useState(unit?.soundA ?? "");
  const [soundB, setSoundB] = useState(unit?.soundB ?? "");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  const save = async () => {
    if (!title.trim()) {
      setErr("Please write the title.");
      return;
    }
    if (!isEdit && !key.trim()) {
      setErr("Please write the key.");
      return;
    }
    setSaving(true);
    setErr("");
    try {
      if (isEdit && unit) {
        await updatePronunciationUnit(unit.id, {
          title: title.trim(),
          descriptionEs: descriptionEs.trim(),
          soundA: soundA.trim(),
          soundB: soundB.trim(),
        });
        onSaved("Unit updated.");
      } else {
        await createPronunciationUnit({
          key: key.trim(),
          title: title.trim(),
          descriptionEs: descriptionEs.trim() || undefined,
          soundA: soundA.trim() || undefined,
          soundB: soundB.trim() || undefined,
        });
        onSaved("Unit created.");
      }
    } catch (e: unknown) {
      const ex = e as { response?: { data?: { message?: string } } };
      setErr(ex?.response?.data?.message ?? "Could not save. Please try again.");
      setSaving(false);
    }
  };

  return (
    <AdminModal
      title={isEdit ? "Edit unit" : "New unit"}
      onClose={onClose}
      footer={
        <>
          <UIButton tone="neutral" onClick={onClose}>
            Cancel
          </UIButton>
          <UIButton tone="accent" onClick={save} disabled={saving}>
            {saving ? "Saving…" : isEdit ? "Save changes" : "Create unit"}
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
            placeholder="ship-sheep"
            className={modalInputCls}
          />
        </Field>
      )}

      <Field label="Title">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Ship vs Sheep"
          className={modalInputCls}
        />
      </Field>

      <Field label="Description (ES) (optional)">
        <textarea
          value={descriptionEs}
          onChange={(e) => setDescriptionEs(e.target.value)}
          placeholder="La diferencia entre la /ɪ/ corta y la /iː/ larga."
          rows={3}
          className={modalInputCls}
        />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Sound A (optional)">
          <input
            value={soundA}
            onChange={(e) => setSoundA(e.target.value)}
            placeholder="/ɪ/"
            className={modalInputCls}
          />
        </Field>
        <Field label="Sound B (optional)">
          <input
            value={soundB}
            onChange={(e) => setSoundB(e.target.value)}
            placeholder="/iː/"
            className={modalInputCls}
          />
        </Field>
      </div>
    </AdminModal>
  );
}

// ── Item modal (create/edit) ───────────────────────────────────
function ItemModal({
  unitId,
  item,
  onClose,
  onSaved,
}: {
  unitId: number;
  item: AdminPronunciationItem | null; // null → create
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const isEdit = Boolean(item);
  const [wordA, setWordA] = useState(item?.wordA ?? "");
  const [wordB, setWordB] = useState(item?.wordB ?? "");
  const [position, setPosition] = useState<string>(
    item?.position != null ? String(item.position) : "",
  );
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  const save = async () => {
    if (!wordA.trim()) {
      setErr("Please write word A.");
      return;
    }
    if (!wordB.trim()) {
      setErr("Please write word B.");
      return;
    }
    if (position !== "" && (!/^\d+$/.test(position) || Number(position) < 0)) {
      setErr("Position must be a positive number.");
      return;
    }
    setSaving(true);
    setErr("");
    try {
      if (isEdit && item) {
        await updatePronunciationItem(item.id, {
          wordA: wordA.trim(),
          wordB: wordB.trim(),
          ...(position !== "" ? { position: Number(position) } : {}),
        });
        onSaved("Pair updated.");
      } else {
        await createPronunciationItem({
          unitId,
          wordA: wordA.trim(),
          wordB: wordB.trim(),
          ...(position !== "" ? { position: Number(position) } : {}),
        });
        onSaved("Pair created.");
      }
    } catch (e: unknown) {
      const ex = e as { response?: { data?: { message?: string } } };
      setErr(ex?.response?.data?.message ?? "Could not save. Please try again.");
      setSaving(false);
    }
  };

  return (
    <AdminModal
      title={isEdit ? "Edit pair" : "New pair"}
      onClose={onClose}
      footer={
        <>
          <UIButton tone="neutral" onClick={onClose}>
            Cancel
          </UIButton>
          <UIButton tone="accent" onClick={save} disabled={saving}>
            {saving ? "Saving…" : isEdit ? "Save changes" : "Create pair"}
          </UIButton>
        </>
      }
    >
      <ModalError text={err} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Word A">
          <input
            value={wordA}
            onChange={(e) => setWordA(e.target.value)}
            placeholder="ship"
            className={modalInputCls}
          />
        </Field>
        <Field label="Word B">
          <input
            value={wordB}
            onChange={(e) => setWordB(e.target.value)}
            placeholder="sheep"
            className={modalInputCls}
          />
        </Field>
      </div>

      <Field label="Position (optional — order inside the unit)">
        <input
          value={position}
          onChange={(e) => setPosition(e.target.value)}
          placeholder="Auto"
          inputMode="numeric"
          className={modalInputCls}
        />
      </Field>
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
