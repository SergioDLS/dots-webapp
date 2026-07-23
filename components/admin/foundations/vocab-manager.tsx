"use client";

import React, { useCallback, useEffect, useState } from "react";
import Spinner from "@/components/ui/Spinner/Spinner";
import UIButton from "@/components/ui/button/button";
import {
  AdminModal,
  Field,
  ModalError,
  Toggle,
  UploadTile,
  modalInputCls,
  resolveImageUrl,
} from "@/components/admin/ui";
import {
  getVocabPacks,
  createVocabPack,
  updateVocabPack,
  deleteVocabPack,
  getVocabItems,
  createVocabItem,
  updateVocabItem,
  deleteVocabItem,
  generateVocabAudio,
  getAdminCharacters,
  uploadMedia,
  type AdminVocabPack,
  type AdminVocabItem,
  type AdminCharacter,
} from "@/services/admin.service";

export default function VocabManager({
  flash,
}: {
  flash: (text: string, kind?: "ok" | "error") => void;
}) {
  const [packs, setPacks] = useState<AdminVocabPack[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPack, setSelectedPack] = useState<AdminVocabPack | null>(null);
  const [packModalOpen, setPackModalOpen] = useState(false);
  const [editingPack, setEditingPack] = useState<AdminVocabPack | null>(null);

  useEffect(() => {
    getVocabPacks()
      .then(setPacks)
      .catch(() => flash("Could not load vocab packs.", "error"))
      .finally(() => setLoading(false));
  }, [flash]);

  const refreshPacks = useCallback(() => {
    getVocabPacks().then(setPacks).catch(() => {});
  }, []);

  const togglePack = async (pack: AdminVocabPack) => {
    try {
      await updateVocabPack(pack.id, { enabled: !pack.enabled });
      setPacks((prev) =>
        prev.map((p) =>
          p.id === pack.id ? { ...p, enabled: !p.enabled } : p,
        ),
      );
    } catch {
      flash("Could not update the pack.", "error");
    }
  };

  const removePack = async (pack: AdminVocabPack) => {
    if (!confirm(`Delete pack "${pack.title}" and all its words?`)) return;
    try {
      await deleteVocabPack(pack.id);
      setPacks((prev) => prev.filter((p) => p.id !== pack.id));
      flash("Pack deleted.");
    } catch {
      flash("Could not delete the pack.", "error");
    }
  };

  if (selectedPack) {
    return (
      <PackDetail
        pack={selectedPack}
        onBack={() => setSelectedPack(null)}
        flash={flash}
      />
    );
  }

  // ── List view ────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-extrabold text-foreground">
          Vocab packs
        </h1>
        <UIButton
          tone="accent"
          onClick={() => {
            setEditingPack(null);
            setPackModalOpen(true);
          }}
        >
          + New pack
        </UIButton>
      </div>

      {loading ? (
        <div className="py-16">
          <Spinner title="Loading vocab packs…" />
        </div>
      ) : packs.length === 0 ? (
        <p className="rounded-2xl border-2 border-dashed border-(--border) px-5 py-8 text-center text-sm font-semibold text-(--muted)">
          No vocab packs yet. Add the first one!
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
              {packs.map((pack) => (
                <tr key={pack.id} className="border-t border-(--border) align-middle">
                  <td className="px-4 py-3 font-bold text-foreground">
                    {pack.title}
                    <span className="ml-2 text-xs font-semibold text-(--muted)">
                      {pack.key}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <Toggle on={pack.enabled} onClick={() => togglePack(pack)} />
                  </td>
                  <td className="px-4 py-3">
                    <UIButton
                      tone="neutral"
                      onClick={() => setSelectedPack(pack)}
                    >
                      Manage →
                    </UIButton>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => {
                          setEditingPack(pack);
                          setPackModalOpen(true);
                        }}
                        className="rounded-lg border-2 border-(--border) px-2.5 py-1 text-xs font-bold text-(--muted) transition-colors hover:border-(--accent) hover:text-(--accent)"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => removePack(pack)}
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

      {packModalOpen && (
        <PackModal
          pack={editingPack}
          onClose={() => setPackModalOpen(false)}
          onSaved={(msg) => {
            setPackModalOpen(false);
            refreshPacks();
            flash(msg);
          }}
        />
      )}
    </div>
  );
}

// ── Pack detail: vocab items ──────────────────────────────────
function PackDetail({
  pack,
  onBack,
  flash,
}: {
  pack: AdminVocabPack;
  onBack: () => void;
  flash: (text: string, kind?: "ok" | "error") => void;
}) {
  const [items, setItems] = useState<AdminVocabItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [itemModalOpen, setItemModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<AdminVocabItem | null>(null);
  const [generatingId, setGeneratingId] = useState<number | null>(null);
  const [characters, setCharacters] = useState<AdminCharacter[]>([]);
  const [narratorId, setNarratorId] = useState<number | undefined>(undefined);

  useEffect(() => {
    let alive = true;
    getAdminCharacters()
      .then((rows) => { if (alive) setCharacters(rows); })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    getVocabItems(pack.id)
      .then(setItems)
      .catch(() => flash("Could not load items.", "error"))
      .finally(() => setLoading(false));
  }, [pack.id, flash]);

  const characterName = (id?: number | null) =>
    characters.find((c) => c.id === id)?.name ?? (id != null ? `#${id}` : "—");

  const refreshItems = useCallback(() => {
    getVocabItems(pack.id).then(setItems).catch(() => {});
  }, [pack.id]);

  const removeItem = async (item: AdminVocabItem) => {
    if (!confirm(`Delete this word?\n\n"${item.text}"`)) return;
    try {
      await deleteVocabItem(item.id);
      setItems((prev) => prev.filter((x) => x.id !== item.id));
      flash("Word deleted.");
    } catch {
      flash("Could not delete the word.", "error");
    }
  };

  const genAudio = async (item: AdminVocabItem) => {
    setGeneratingId(item.id);
    try {
      await generateVocabAudio(item.id, narratorId);
      refreshItems();
      flash("Audio generado.");
    } catch {
      flash("No se pudo generar el audio.", "error");
    } finally {
      setGeneratingId(null);
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <button
        onClick={onBack}
        className="self-start text-sm font-bold text-(--muted) transition-colors hover:text-(--accent)"
      >
        ← Back to packs
      </button>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-extrabold text-foreground">
          {pack.title}
        </h1>
        <div className="flex items-center gap-3">
          <select
            value={narratorId ?? ""}
            onChange={(e) =>
              setNarratorId(e.target.value === "" ? undefined : Number(e.target.value))
            }
            className="rounded-lg border px-2 py-1 text-sm"
            style={{ borderColor: "var(--border)" }}
          >
            <option value="">Narrador: Auto (balanceado)</option>
            {characters.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <UIButton
            tone="accent"
            onClick={() => {
              setEditingItem(null);
              setItemModalOpen(true);
            }}
          >
            + New word
          </UIButton>
        </div>
      </div>

      {loading ? (
        <div className="py-16">
          <Spinner title="Loading words…" />
        </div>
      ) : items.length === 0 ? (
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
                <th className="px-4 py-3">Voz</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className="border-t border-(--border) align-middle">
                  <td className="px-4 py-3 text-xs font-bold text-(--muted)">
                    {item.position ?? "—"}
                  </td>
                  <td className="px-4 py-3 font-bold text-foreground">
                    {item.text}
                  </td>
                  <td className="px-4 py-3 font-semibold text-(--muted)">
                    {item.meaning || "—"}
                  </td>
                  <td className="px-4 py-3">
                    <span className="flex items-center gap-1.5 text-xs font-bold text-(--muted)">
                      {item.img ? "🖼️" : "—"} {item.audio ? "🔊" : ""}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs font-semibold text-(--muted)">
                    {characterName(item.voiceCharacterId)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => genAudio(item)}
                        disabled={generatingId != null}
                        className="rounded-lg border-2 border-(--border) px-2.5 py-1 text-xs font-bold text-(--muted) transition-colors hover:border-(--accent) hover:text-(--accent) disabled:opacity-50"
                      >
                        {generatingId === item.id ? "…" : "Generate audio"}
                      </button>
                      <button
                        onClick={() => {
                          setEditingItem(item);
                          setItemModalOpen(true);
                        }}
                        className="rounded-lg border-2 border-(--border) px-2.5 py-1 text-xs font-bold text-(--muted) transition-colors hover:border-(--accent) hover:text-(--accent)"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => removeItem(item)}
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

      {itemModalOpen && (
        <ItemModal
          packId={pack.id}
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

// ── Pack modal (create / edit) ────────────────────────────────
function PackModal({
  pack,
  onClose,
  onSaved,
}: {
  pack: AdminVocabPack | null; // null → create
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const isEdit = Boolean(pack);
  const [key, setKey] = useState(pack?.key ?? "");
  const [title, setTitle] = useState(pack?.title ?? "");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  const save = async () => {
    if (!isEdit && !key.trim()) {
      setErr("Please write the key.");
      return;
    }
    if (!title.trim()) {
      setErr("Please write the title.");
      return;
    }
    setSaving(true);
    setErr("");
    try {
      if (isEdit && pack) {
        await updateVocabPack(pack.id, { title: title.trim() });
        onSaved("Pack updated.");
      } else {
        await createVocabPack({ key: key.trim(), title: title.trim() });
        onSaved("Pack created.");
      }
    } catch (e: unknown) {
      const ex = e as { response?: { data?: { message?: string } } };
      setErr(ex?.response?.data?.message ?? "Could not save. Please try again.");
      setSaving(false);
    }
  };

  return (
    <AdminModal
      title={isEdit ? "Edit pack" : "New pack"}
      onClose={onClose}
      footer={
        <>
          <UIButton tone="neutral" onClick={onClose}>
            Cancel
          </UIButton>
          <UIButton tone="accent" onClick={save} disabled={saving}>
            {saving ? "Saving…" : isEdit ? "Save changes" : "Create pack"}
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
            placeholder="food-basics"
            className={modalInputCls}
          />
        </Field>
      )}

      <Field label="Title">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Food basics"
          className={modalInputCls}
        />
      </Field>
    </AdminModal>
  );
}

// ── Item modal (create / edit) — mirrors the word modal, no audio ──
function ItemModal({
  packId,
  item,
  onClose,
  onSaved,
}: {
  packId: number;
  item: AdminVocabItem | null; // null → create
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const isEdit = Boolean(item);
  const [text, setText] = useState(item?.text ?? "");
  const [meaning, setMeaning] = useState(item?.meaning ?? "");
  const [img, setImg] = useState(item?.img ?? "");
  const [position, setPosition] = useState<string>(
    item?.position != null ? String(item.position) : "",
  );
  const [uploadingImg, setUploadingImg] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  const handleUpload = async (file: File | undefined) => {
    if (!file) return;
    setUploadingImg(true);
    setErr("");
    try {
      const { url } = await uploadMedia(file, "image");
      setImg(url);
    } catch {
      setErr(
        "Upload failed. Media uploads need Cloudinary configured on the server.",
      );
    } finally {
      setUploadingImg(false);
    }
  };

  const save = async () => {
    if (!text.trim()) {
      setErr("Please write the word.");
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
        await updateVocabItem(item.id, {
          text: text.trim(),
          meaning: meaning.trim(),
          img,
          ...(position !== "" ? { position: Number(position) } : {}),
        });
        onSaved("Word updated.");
      } else {
        await createVocabItem({
          packId,
          text: text.trim(),
          meaning: meaning.trim() || undefined,
          img: img || undefined,
          ...(position !== "" ? { position: Number(position) } : {}),
        });
        onSaved("Word created.");
      }
    } catch (e: unknown) {
      const ex = e as { response?: { data?: { message?: string } } };
      setErr(ex?.response?.data?.message ?? "Could not save. Please try again.");
      setSaving(false);
    }
  };

  return (
    <AdminModal
      title={isEdit ? "Edit word" : "New word"}
      onClose={onClose}
      footer={
        <>
          <UIButton tone="neutral" onClick={onClose}>
            Cancel
          </UIButton>
          <UIButton
            tone="accent"
            onClick={save}
            disabled={saving || uploadingImg}
          >
            {saving ? "Saving…" : isEdit ? "Save changes" : "Create word"}
          </UIButton>
        </>
      }
    >
      <ModalError text={err} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Word">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="apple"
            className={modalInputCls}
          />
        </Field>

        <Field label="Meaning (optional)">
          <input
            value={meaning}
            onChange={(e) => setMeaning(e.target.value)}
            placeholder="manzana"
            className={modalInputCls}
          />
        </Field>
      </div>

      <Field label="Position (optional — order inside the pack)">
        <input
          value={position}
          onChange={(e) => setPosition(e.target.value)}
          placeholder="Auto"
          inputMode="numeric"
          className={modalInputCls}
        />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <UploadTile
          label="Image"
          accept="image/*"
          uploading={uploadingImg}
          hasValue={Boolean(img)}
          onFile={(f) => handleUpload(f)}
          onClear={() => setImg("")}
          preview={resolveImageUrl(img)}
        />
      </div>
    </AdminModal>
  );
}
