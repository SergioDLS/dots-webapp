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
  resolveAudioUrl,
  resolveImageUrl,
} from "@/components/admin/ui";
import {
  getLetterPacks,
  createLetterPack,
  updateLetterPack,
  deleteLetterPack,
  getLetterItems,
  createLetterItem,
  updateLetterItem,
  deleteLetterItem,
  uploadMedia,
  type AdminLetterPack,
  type AdminLetterItem,
} from "@/services/admin.service";

export default function LettersManager({
  flash,
}: {
  flash: (text: string, kind?: "ok" | "error") => void;
}) {
  const [packs, setPacks] = useState<AdminLetterPack[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPack, setSelectedPack] = useState<AdminLetterPack | null>(null);
  const [packModalOpen, setPackModalOpen] = useState(false);
  const [editingPack, setEditingPack] = useState<AdminLetterPack | null>(null);

  useEffect(() => {
    getLetterPacks()
      .then(setPacks)
      .catch(() => flash("Could not load letter packs.", "error"))
      .finally(() => setLoading(false));
  }, [flash]);

  const refreshPacks = useCallback(() => {
    getLetterPacks().then(setPacks).catch(() => {});
  }, []);

  const togglePack = async (pack: AdminLetterPack) => {
    try {
      await updateLetterPack(pack.id, { enabled: !pack.enabled });
      setPacks((prev) =>
        prev.map((p) =>
          p.id === pack.id ? { ...p, enabled: !p.enabled } : p,
        ),
      );
    } catch {
      flash("Could not update the pack.", "error");
    }
  };

  const removePack = async (pack: AdminLetterPack) => {
    if (!confirm(`Delete pack "${pack.title}" and all its letters?`)) return;
    try {
      await deleteLetterPack(pack.id);
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
          Letter packs
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
          <Spinner title="Loading letter packs…" />
        </div>
      ) : packs.length === 0 ? (
        <p className="rounded-2xl border-2 border-dashed border-(--border) px-5 py-8 text-center text-sm font-semibold text-(--muted)">
          No letter packs yet. Add the first one!
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

// ── Pack detail: letter items ─────────────────────────────────
function PackDetail({
  pack,
  onBack,
  flash,
}: {
  pack: AdminLetterPack;
  onBack: () => void;
  flash: (text: string, kind?: "ok" | "error") => void;
}) {
  const [items, setItems] = useState<AdminLetterItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [itemModalOpen, setItemModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<AdminLetterItem | null>(null);

  useEffect(() => {
    getLetterItems(pack.id)
      .then(setItems)
      .catch(() => flash("Could not load items.", "error"))
      .finally(() => setLoading(false));
  }, [pack.id, flash]);

  const refreshItems = useCallback(() => {
    getLetterItems(pack.id).then(setItems).catch(() => {});
  }, [pack.id]);

  const removeItem = async (item: AdminLetterItem) => {
    if (!confirm(`Delete this letter?\n\n"${item.letter}"`)) return;
    try {
      await deleteLetterItem(item.id);
      setItems((prev) => prev.filter((x) => x.id !== item.id));
      flash("Letter deleted.");
    } catch {
      flash("Could not delete the letter.", "error");
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
        <UIButton
          tone="accent"
          onClick={() => {
            setEditingItem(null);
            setItemModalOpen(true);
          }}
        >
          + New letter
        </UIButton>
      </div>

      {loading ? (
        <div className="py-16">
          <Spinner title="Loading letters…" />
        </div>
      ) : items.length === 0 ? (
        <p className="rounded-2xl border-2 border-dashed border-(--border) px-5 py-8 text-center text-sm font-semibold text-(--muted)">
          No letters yet. Add the first one!
        </p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border-2 border-(--border)">
          <table className="w-full text-left text-sm">
            <thead className="bg-(--surface) text-(--muted)">
              <tr className="text-xs font-extrabold uppercase tracking-wide">
                <th className="px-4 py-3">#</th>
                <th className="px-4 py-3">Letter</th>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Media</th>
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
                    {item.letter}
                  </td>
                  <td className="px-4 py-3 font-semibold text-(--muted)">
                    {item.name || "—"}
                  </td>
                  <td className="px-4 py-3">
                    <span className="flex items-center gap-1.5 text-xs font-bold text-(--muted)">
                      {item.img ? "🖼️" : ""} {item.audio ? "🔊" : ""}
                      {!item.img && !item.audio ? "—" : ""}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
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
  pack: AdminLetterPack | null; // null → create
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
        await updateLetterPack(pack.id, { title: title.trim() });
        onSaved("Pack updated.");
      } else {
        await createLetterPack({ key: key.trim(), title: title.trim() });
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
            placeholder="alphabet-basics"
            className={modalInputCls}
          />
        </Field>
      )}

      <Field label="Title">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Alphabet basics"
          className={modalInputCls}
        />
      </Field>
    </AdminModal>
  );
}

// ── Item modal (create / edit) — mirrors the word modal (image + audio) ──
function ItemModal({
  packId,
  item,
  onClose,
  onSaved,
}: {
  packId: number;
  item: AdminLetterItem | null; // null → create
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const isEdit = Boolean(item);
  const [letter, setLetter] = useState(item?.letter ?? "");
  const [name, setName] = useState(item?.name ?? "");
  const [soundIpa, setSoundIpa] = useState(item?.soundIpa ?? "");
  const [exampleWord, setExampleWord] = useState(item?.exampleWord ?? "");
  const [exampleMeaning, setExampleMeaning] = useState(
    item?.exampleMeaning ?? "",
  );
  const [img, setImg] = useState(item?.img ?? "");
  const [audio, setAudio] = useState(item?.audio ?? "");
  const [position, setPosition] = useState<string>(
    item?.position != null ? String(item.position) : "",
  );
  const [uploadingImg, setUploadingImg] = useState(false);
  const [uploadingAudio, setUploadingAudio] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  const handleUpload = async (
    file: File | undefined,
    kind: "image" | "audio",
  ) => {
    if (!file) return;
    const setUploading = kind === "image" ? setUploadingImg : setUploadingAudio;
    setUploading(true);
    setErr("");
    try {
      const { url } = await uploadMedia(file, kind);
      if (kind === "image") setImg(url);
      else setAudio(url);
    } catch {
      setErr(
        "Upload failed. Media uploads need Cloudinary configured on the server.",
      );
    } finally {
      setUploading(false);
    }
  };

  const save = async () => {
    if (!letter.trim()) {
      setErr("Please write the letter.");
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
        await updateLetterItem(item.id, {
          letter: letter.trim(),
          name: name.trim(),
          soundIpa: soundIpa.trim(),
          exampleWord: exampleWord.trim(),
          exampleMeaning: exampleMeaning.trim(),
          img,
          audio,
          ...(position !== "" ? { position: Number(position) } : {}),
        });
        onSaved("Letter updated.");
      } else {
        await createLetterItem({
          packId,
          letter: letter.trim(),
          name: name.trim() || undefined,
          soundIpa: soundIpa.trim() || undefined,
          exampleWord: exampleWord.trim() || undefined,
          exampleMeaning: exampleMeaning.trim() || undefined,
          img: img || undefined,
          audio: audio || undefined,
          ...(position !== "" ? { position: Number(position) } : {}),
        });
        onSaved("Letter created.");
      }
    } catch (e: unknown) {
      const ex = e as { response?: { data?: { message?: string } } };
      setErr(ex?.response?.data?.message ?? "Could not save. Please try again.");
      setSaving(false);
    }
  };

  return (
    <AdminModal
      title={isEdit ? "Edit letter" : "New letter"}
      onClose={onClose}
      footer={
        <>
          <UIButton tone="neutral" onClick={onClose}>
            Cancel
          </UIButton>
          <UIButton
            tone="accent"
            onClick={save}
            disabled={saving || uploadingImg || uploadingAudio}
          >
            {saving ? "Saving…" : isEdit ? "Save changes" : "Create letter"}
          </UIButton>
        </>
      }
    >
      <ModalError text={err} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Letter">
          <input
            value={letter}
            onChange={(e) => setLetter(e.target.value)}
            placeholder="B"
            className={modalInputCls}
          />
        </Field>

        <Field label="Name (optional)">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="bee"
            className={modalInputCls}
          />
        </Field>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Sound (IPA) (optional)">
          <input
            value={soundIpa}
            onChange={(e) => setSoundIpa(e.target.value)}
            placeholder="/eɪ/"
            className={modalInputCls}
          />
        </Field>

        <Field label="Position (optional — order inside the pack)">
          <input
            value={position}
            onChange={(e) => setPosition(e.target.value)}
            placeholder="Auto"
            inputMode="numeric"
            className={modalInputCls}
          />
        </Field>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Example word (optional)">
          <input
            value={exampleWord}
            onChange={(e) => setExampleWord(e.target.value)}
            placeholder="ball"
            className={modalInputCls}
          />
        </Field>

        <Field label="Example meaning (optional)">
          <input
            value={exampleMeaning}
            onChange={(e) => setExampleMeaning(e.target.value)}
            placeholder="pelota"
            className={modalInputCls}
          />
        </Field>
      </div>

      {/* Media uploads */}
      <div className="grid grid-cols-2 gap-3">
        <UploadTile
          label="Image"
          accept="image/*"
          uploading={uploadingImg}
          hasValue={Boolean(img)}
          onFile={(f) => handleUpload(f, "image")}
          onClear={() => setImg("")}
          preview={resolveImageUrl(img)}
        />
        <UploadTile
          label="Audio"
          accept="audio/*"
          uploading={uploadingAudio}
          hasValue={Boolean(audio)}
          onFile={(f) => handleUpload(f, "audio")}
          onClear={() => setAudio("")}
          preview={resolveAudioUrl(audio)}
        />
      </div>
    </AdminModal>
  );
}
