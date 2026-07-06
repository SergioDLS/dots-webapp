"use client";

import React, { useState } from "react";
import UIButton from "@/components/ui/button/button";
import {
  createSentence,
  updateSentence,
  uploadMedia,
  type AdminSentence,
} from "@/services/admin.service";

interface Props {
  levelId: number;
  sentence: AdminSentence | null; // null → create
  onClose: () => void;
  onSaved: (message: string) => void;
}

export default function SentenceModal({
  levelId,
  sentence,
  onClose,
  onSaved,
}: Props) {
  const isEdit = Boolean(sentence);
  const [text, setText] = useState(sentence?.text ?? "");
  const [mWord, setMWord] = useState(sentence?.mWord ?? "");
  const [img, setImg] = useState(sentence?.img ?? "");
  const [imgSound, setImgSound] = useState(sentence?.imgSound ?? "");
  const [uploadingImg, setUploadingImg] = useState(false);
  const [uploadingAudio, setUploadingAudio] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  const validate = (): string => {
    if (!text.trim()) return "Please write the sentence.";
    if (!text.includes("__")) return 'The sentence needs "__" for the missing word.';
    if (text.split("__").length !== 2)
      return 'The sentence must contain "__" exactly once.';
    if (!mWord.trim()) return "Please write the missing word.";
    return "";
  };

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
      else setImgSound(url);
    } catch {
      setErr(
        "Upload failed. Media uploads need Cloudinary configured on the server.",
      );
    } finally {
      setUploading(false);
    }
  };

  const save = async () => {
    const problem = validate();
    if (problem) {
      setErr(problem);
      return;
    }
    setSaving(true);
    setErr("");
    try {
      if (isEdit && sentence) {
        await updateSentence(sentence.id, {
          text: text.trim(),
          mWord: mWord.trim(),
          img,
          imgSound,
        });
        onSaved("Sentence updated.");
      } else {
        await createSentence({
          levelId,
          text: text.trim(),
          mWord: mWord.trim(),
          img: img || undefined,
          imgSound: imgSound || undefined,
        });
        onSaved("Sentence created.");
      }
    } catch (e: unknown) {
      const ex = e as { response?: { data?: { message?: string } } };
      setErr(ex?.response?.data?.message ?? "Could not save. Please try again.");
      setSaving(false);
    }
  };

  const inputCls =
    "w-full rounded-2xl border-2 border-(--border) bg-(--input-bg) px-4 py-3 text-base font-semibold text-foreground placeholder:text-(--muted) placeholder:font-medium outline-none transition-all focus:border-(--accent) focus:ring-4 focus:ring-(--accent)/15";

  const preview = text ? text.replace("__", mWord || "_____") : "";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden
      />
      <div className="pop-in relative z-10 w-full max-w-lg overflow-hidden rounded-3xl border-2 border-(--border) bg-(--surface) shadow-2xl">
        <div className="flex items-center justify-between border-b border-(--border) px-6 py-4">
          <h3 className="font-display text-xl font-extrabold text-foreground">
            {isEdit ? "Edit sentence" : "New sentence"}
          </h3>
          <button
            onClick={onClose}
            className="text-2xl leading-none text-(--muted) hover:text-(--accent)"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div className="flex max-h-[70vh] flex-col gap-4 overflow-y-auto px-6 py-5">
          {err && (
            <p className="rounded-2xl border-2 border-(--danger)/30 bg-(--danger)/10 px-4 py-2.5 text-center text-sm font-bold text-(--danger)">
              {err}
            </p>
          )}

          <label className="flex flex-col gap-1">
            <span className="px-1 text-xs font-bold text-(--muted)">
              Sentence (use <code className="text-(--accent)">__</code> for the
              missing word)
            </span>
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="The cat is __"
              className={inputCls}
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="px-1 text-xs font-bold text-(--muted)">
              Missing word
            </span>
            <input
              value={mWord}
              onChange={(e) => setMWord(e.target.value)}
              placeholder="black"
              className={inputCls}
            />
          </label>

          {preview && (
            <div className="rounded-2xl bg-(--background) px-4 py-3 text-center">
              <span className="text-xs font-bold uppercase tracking-wide text-(--muted)">
                Preview
              </span>
              <p className="font-display text-lg font-extrabold text-foreground">
                {preview}
              </p>
            </div>
          )}

          {/* Media uploads */}
          <div className="grid grid-cols-2 gap-3">
            <UploadTile
              label="Image"
              accept="image/*"
              uploading={uploadingImg}
              hasValue={Boolean(img)}
              onFile={(f) => handleUpload(f, "image")}
              onClear={() => setImg("")}
              preview={img}
            />
            <UploadTile
              label="Word audio"
              accept="audio/*"
              uploading={uploadingAudio}
              hasValue={Boolean(imgSound)}
              onFile={(f) => handleUpload(f, "audio")}
              onClear={() => setImgSound("")}
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 border-t border-(--border) px-6 py-4">
          <UIButton tone="neutral" onClick={onClose}>
            Cancel
          </UIButton>
          <UIButton
            tone="accent"
            onClick={save}
            disabled={saving || uploadingImg || uploadingAudio}
          >
            {saving ? "Saving…" : isEdit ? "Save changes" : "Create sentence"}
          </UIButton>
        </div>
      </div>
    </div>
  );
}

function UploadTile({
  label,
  accept,
  uploading,
  hasValue,
  onFile,
  onClear,
  preview,
}: {
  label: string;
  accept: string;
  uploading: boolean;
  hasValue: boolean;
  onFile: (f: File | undefined) => void;
  onClear: () => void;
  preview?: string;
}) {
  const id = `upload-${label.replace(/\s+/g, "-").toLowerCase()}`;
  return (
    <div className="flex flex-col gap-2 rounded-2xl border-2 border-(--border) p-3">
      <span className="text-xs font-bold text-(--muted)">{label}</span>
      {preview && accept.startsWith("image") && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={preview}
          alt={label}
          className="h-16 w-16 rounded-lg object-cover"
        />
      )}
      <div className="flex items-center gap-2">
        <input
          id={id}
          type="file"
          accept={accept}
          hidden
          onChange={(e) => onFile(e.target.files?.[0])}
        />
        <label
          htmlFor={id}
          className="cursor-pointer rounded-lg border-2 border-(--border) px-3 py-1.5 text-xs font-bold text-(--muted) transition-colors hover:border-(--accent) hover:text-(--accent)"
        >
          {uploading ? "Uploading…" : hasValue ? "Replace" : "Upload"}
        </label>
        {hasValue && !uploading && (
          <>
            <span className="text-sm text-(--success)" title="Uploaded">
              ✓
            </span>
            <button
              onClick={onClear}
              className="text-xs font-bold text-(--muted) hover:text-(--danger)"
            >
              clear
            </button>
          </>
        )}
      </div>
    </div>
  );
}
