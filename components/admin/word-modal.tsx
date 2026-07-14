"use client";

import React, { useState } from "react";
import UIButton from "@/components/ui/button/button";
import {
  createWord,
  updateWord,
  uploadMedia,
  type AdminWord,
} from "@/services/admin.service";
import {
  AdminModal,
  Field,
  ModalError,
  UploadTile,
  modalInputCls,
  resolveAudioUrl,
  resolveImageUrl,
} from "@/components/admin/ui";

interface Props {
  levelId: number;
  word: AdminWord | null; // null → create
  onClose: () => void;
  onSaved: (message: string) => void;
}

export default function WordModal({ levelId, word, onClose, onSaved }: Props) {
  const isEdit = Boolean(word);
  const [text, setText] = useState(word?.text ?? "");
  const [meaning, setMeaning] = useState(word?.meaning ?? "");
  const [img, setImg] = useState(word?.img ?? "");
  const [audio, setAudio] = useState(word?.audio ?? "");
  const [position, setPosition] = useState<string>(
    word?.position != null ? String(word.position) : "",
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
      if (isEdit && word) {
        await updateWord(word.id, {
          text: text.trim(),
          meaning: meaning.trim(),
          img,
          audio,
          ...(position !== "" ? { position: Number(position) } : {}),
        });
        onSaved("Word updated.");
      } else {
        await createWord({
          levelId,
          text: text.trim(),
          meaning: meaning.trim() || undefined,
          img: img || undefined,
          audio: audio || undefined,
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
            disabled={saving || uploadingImg || uploadingAudio}
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

      <Field label="Position (optional — order inside the level)">
        <input
          value={position}
          onChange={(e) => setPosition(e.target.value)}
          placeholder="Auto"
          inputMode="numeric"
          className={modalInputCls}
        />
      </Field>

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
