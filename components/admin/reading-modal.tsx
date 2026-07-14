"use client";

import React, { useState } from "react";
import UIButton from "@/components/ui/button/button";
import {
  createReading,
  updateReading,
  uploadMedia,
  type AdminReading,
} from "@/services/admin.service";
import {
  AdminModal,
  Field,
  ModalError,
  UploadTile,
  modalInputCls,
  resolveAudioUrl,
} from "@/components/admin/ui";

interface Props {
  reading: AdminReading | null; // null → create
  onClose: () => void;
  onSaved: (message: string) => void;
}

export default function ReadingModal({ reading, onClose, onSaved }: Props) {
  const isEdit = Boolean(reading);
  const [title, setTitle] = useState(reading?.title ?? "");
  const [text, setText] = useState(reading?.text ?? "");
  const [src, setSrc] = useState(reading?.src ?? "");
  const [unlock, setUnlock] = useState<string>(
    reading ? String(reading.unlock) : "0",
  );
  const [uploadingAudio, setUploadingAudio] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  const wordCount = text.trim() ? text.trim().split(/\s+/).length : 0;

  const handleUpload = async (file: File | undefined) => {
    if (!file) return;
    setUploadingAudio(true);
    setErr("");
    try {
      const { url } = await uploadMedia(file, "audio");
      setSrc(url);
    } catch {
      setErr(
        "Upload failed. Media uploads need Cloudinary configured on the server.",
      );
    } finally {
      setUploadingAudio(false);
    }
  };

  const save = async () => {
    if (!title.trim()) {
      setErr("Please write a title.");
      return;
    }
    if (!text.trim()) {
      setErr("Please write the reading text.");
      return;
    }
    if (!/^\d+$/.test(unlock)) {
      setErr("Unlock must be a number (completed levels required).");
      return;
    }
    setSaving(true);
    setErr("");
    try {
      if (isEdit && reading) {
        await updateReading(reading.id, {
          title: title.trim(),
          text: text.trim(),
          src,
          unlock: Number(unlock),
        });
        onSaved("Reading updated.");
      } else {
        await createReading({
          title: title.trim(),
          text: text.trim(),
          src: src || undefined,
          unlock: Number(unlock),
        });
        onSaved("Reading created.");
      }
    } catch (e: unknown) {
      const ex = e as { response?: { data?: { message?: string } } };
      setErr(ex?.response?.data?.message ?? "Could not save. Please try again.");
      setSaving(false);
    }
  };

  return (
    <AdminModal
      title={isEdit ? "Edit reading" : "New reading"}
      onClose={onClose}
      wide
      footer={
        <>
          <UIButton tone="neutral" onClick={onClose}>
            Cancel
          </UIButton>
          <UIButton
            tone="accent"
            onClick={save}
            disabled={saving || uploadingAudio}
          >
            {saving ? "Saving…" : isEdit ? "Save changes" : "Create reading"}
          </UIButton>
        </>
      }
    >
      <ModalError text={err} />

      <Field label="Title">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="The three little pigs"
          className={modalInputCls}
        />
      </Field>

      <Field
        label={
          <span className="flex items-center justify-between">
            <span>
              Text — the cloze quiz is generated automatically from it
            </span>
            <span className="font-semibold">{wordCount} words</span>
          </span>
        }
      >
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Once upon a time…"
          rows={10}
          className={`${modalInputCls} resize-y leading-relaxed`}
        />
      </Field>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Unlock after (completed levels)">
          <input
            value={unlock}
            onChange={(e) => setUnlock(e.target.value)}
            inputMode="numeric"
            className={modalInputCls}
          />
        </Field>

        <UploadTile
          label="Narration audio"
          accept="audio/*"
          uploading={uploadingAudio}
          hasValue={Boolean(src)}
          onFile={handleUpload}
          onClear={() => setSrc("")}
          preview={resolveAudioUrl(src)}
        />
      </div>
    </AdminModal>
  );
}
