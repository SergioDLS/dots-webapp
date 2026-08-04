"use client";

import React, { useEffect, useState } from "react";
import UIButton from "@/components/ui/button/button";
import {
  createSentence,
  draftNarration,
  getAdminCharacters,
  publishNarration,
  updateSentence,
  uploadMedia,
  type AdminCharacter,
  type AdminSentence,
  type SavedSentence,
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
import VoiceStudio from "@/components/admin/voice-studio";
import { resolveSentenceSoundUrl } from "@/constants";

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
  const [text, setText] = useState(sentence?.text ?? "");
  const [mWord, setMWord] = useState(sentence?.mWord ?? "");
  const [img, setImg] = useState(sentence?.img ?? "");
  const [imgSound, setImgSound] = useState(sentence?.imgSound ?? "");
  const [uploadingImg, setUploadingImg] = useState(false);
  const [uploadingAudio, setUploadingAudio] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  // Tras crear con éxito el modal NO se cierra: queda en modo edición con la
  // narración lista para escuchar y regenerar. Por eso el modo se lee de
  // `savedId` y no de la prop `sentence`, que en el flujo de creación nunca
  // deja de ser null.
  const [savedId, setSavedId] = useState<number | null>(sentence?.id ?? null);
  // Texto tal como quedó guardado. El backend re-narra Y publica directo en
  // cuanto ve `text`/`mWord` en el body, así que mandarlos sin que hayan
  // cambiado pisaría con una toma automática la que el admin acabó de aprobar
  // — y gastaría créditos de ElevenLabs en un guardado de solo media.
  const [savedText, setSavedText] = useState(sentence?.text ?? "");
  const [savedWord, setSavedWord] = useState(sentence?.mWord ?? "");
  const [ext, setExt] = useState<string>(sentence?.sentenceExtension ?? "");
  const [voiceKey, setVoiceKey] = useState<string | null>(
    sentence?.voiceKey ?? null,
  );
  const [voiceName, setVoiceName] = useState<string | null>(
    sentence?.voiceCharacterName ?? null,
  );
  // El studio siembra su selector de narrador con esto: sin el id, "Regenerar"
  // caería a Auto y podría reasignarle la voz a la oración.
  const [voiceCharacterId, setVoiceCharacterId] = useState<number | null>(
    sentence?.voiceCharacterId ?? null,
  );
  // El studio siembra su estado (y su sello anti-caché) al montar, así que hay
  // que remontarlo cuando el backend reescribe la ruta canónica: si no, el
  // reproductor seguiría sirviendo la toma anterior desde la caché del
  // navegador, con la misma URL y el mismo `?t=`.
  const [takeVersion, setTakeVersion] = useState(0);
  // null = todavía cargando. El studio no se monta sin el elenco: además de
  // llenar su selector, `isDefault` es lo único que revela si la narración vive
  // en la ruta legacy (ver `pathKey`).
  const [characters, setCharacters] = useState<AdminCharacter[] | null>(null);
  const [charsError, setCharsError] = useState(false);
  const [charsAttempt, setCharsAttempt] = useState(0);

  useEffect(() => {
    let alive = true;
    getAdminCharacters()
      .then((rows) => {
        if (alive) setCharacters(rows);
      })
      .catch(() => {
        if (alive) setCharsError(true);
      });
    return () => {
      alive = false;
    };
  }, [charsAttempt]);

  const narrator = characters?.find((c) => c.id === voiceCharacterId) ?? null;
  // El personaje por defecto conserva la ruta legacy SIN subcarpeta
  // (`sentencePublicId` en el backend), pero el serializer del admin manda su
  // `key` igual que la de cualquier otro. Usarla armaría un 404 silencioso en
  // las ~814 narraciones de la voz por defecto, así que la subcarpeta se decide
  // por `isDefault`, igual que hace el endpoint del alumno. El `voiceKey` crudo
  // queda de respaldo por si el id no apareciera en el elenco.
  const pathKey = narrator
    ? narrator.isDefault
      ? undefined
      : narrator.key
    : (voiceKey ?? undefined);

  // Sin extensión no hay narración publicada. El studio necesita `null` (no un
  // objeto a medias) para ofrecer "Generar voz" en vez de un reproductor roto.
  const liveTake =
    savedId != null && ext
      ? {
          characterId: voiceCharacterId ?? undefined,
          characterName: voiceName ?? "voz sin identificar",
          clips: [{ url: resolveSentenceSoundUrl(savedId, ext, pathKey) }],
        }
      : null;

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

  /**
   * Refleja la fila que acabó de devolver el backend: la narración que generó
   * (el modal ya no la descarta) y la línea base de texto contra la que se
   * decide si el próximo guardado debe re-narrar.
   */
  const applySavedRow = (row: SavedSentence) => {
    setSavedText(row.text);
    setSavedWord(row.mWord);
    setExt(row.sentenceExtension ?? "");
    setVoiceKey(row.voiceKey ?? null);
    setVoiceName(row.voiceCharacterName ?? null);
    setVoiceCharacterId(row.voiceCharacterId ?? null);
    // `narration` presente ⇒ el backend regeneró la toma canónica. Bumpear solo
    // en ese caso deja intacto un borrador en curso cuando el guardado no tocó
    // el texto, y lo descarta cuando sí (ese borrador diría la frase vieja).
    if (row.narration) setTakeVersion((n) => n + 1);
  };

  /**
   * Hasta ahora este resultado se descartaba: la narración fallaba en silencio
   * y el admin no tenía forma de enterarse.
   */
  const narrationNote = (row: SavedSentence, base: string) =>
    row.narration === "failed"
      ? `${base} La narración NO se pudo generar — revísala abajo.`
      : base;

  const save = async () => {
    const problem = validate();
    if (problem) {
      setErr(problem);
      return;
    }
    setSaving(true);
    setErr("");
    const nextText = text.trim();
    const nextWord = mWord.trim();
    try {
      // La rama va por `savedId`, no por la prop: tras crear sin cerrar hay que
      // actualizar esa misma oración, no crear una segunda.
      if (savedId != null) {
        const updated = await updateSentence(savedId, {
          ...(nextText !== savedText && { text: nextText }),
          ...(nextWord !== savedWord && { mWord: nextWord }),
          img,
          imgSound,
        });
        applySavedRow(updated);
        onSaved(narrationNote(updated, "Oración actualizada."));
      } else {
        const created = await createSentence({
          levelId,
          text: nextText,
          mWord: nextWord,
          img: img || undefined,
          imgSound: imgSound || undefined,
        });
        applySavedRow(created);
        setSavedId(created.id);
        onSaved(narrationNote(created, "Oración creada."));
      }
    } catch (e: unknown) {
      const ex = e as { response?: { data?: { message?: string } } };
      setErr(
        ex?.response?.data?.message ??
          "No se pudo guardar. Inténtalo otra vez.",
      );
    } finally {
      setSaving(false);
    }
  };

  const preview = text ? text.replace("__", mWord || "_____") : "";

  return (
    <AdminModal
      title={savedId != null ? "Edit sentence" : "New sentence"}
      onClose={onClose}
      footer={
        <>
          {/* Con la oración ya creada no queda nada que cancelar. */}
          <UIButton tone="neutral" onClick={onClose}>
            {savedId != null ? "Cerrar" : "Cancelar"}
          </UIButton>
          <UIButton
            tone="accent"
            onClick={save}
            disabled={saving || uploadingImg || uploadingAudio}
          >
            {saving
              ? "Guardando…"
              : savedId != null
                ? "Guardar cambios"
                : "Crear oración"}
          </UIButton>
        </>
      }
    >
      <ModalError text={err} />

      <Field
        label={
          <>
            Sentence (use <code className="text-(--accent)">__</code> for the
            missing word)
          </>
        }
      >
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="The cat is __"
          className={modalInputCls}
        />
      </Field>

      <Field label="Missing word">
        <input
          value={mWord}
          onChange={(e) => setMWord(e.target.value)}
          placeholder="black"
          className={modalInputCls}
        />
      </Field>

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
          preview={resolveImageUrl(img)}
        />
        <UploadTile
          label="Audio de la palabra"
          accept="audio/*"
          uploading={uploadingAudio}
          hasValue={Boolean(imgSound)}
          onFile={(f) => handleUpload(f, "audio")}
          onClear={() => setImgSound("")}
          preview={resolveAudioUrl(imgSound)}
        />
      </div>

      {/* Confundir este clip con la narración es lo que dejó la narración sin
          UI durante todo este tiempo. */}
      <p className="px-1 text-[11px] font-medium text-(--muted)">
        “Audio de la palabra” es el clip de “{mWord || "la palabra faltante"}”
        que suena en los botones de respuesta — no es la narración de la oración.
      </p>

      {savedId == null ? (
        <div className="rounded-2xl border-2 border-dashed border-(--border) p-3 text-xs font-semibold text-(--muted)">
          Crea la oración y aquí mismo podrás escuchar su narración y
          regenerarla.
        </div>
      ) : charsError ? (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border-2 border-dashed border-(--border) p-3 text-xs font-semibold text-(--muted)">
          No se pudieron cargar las voces.
          <button
            onClick={() => {
              setCharsError(false);
              setCharsAttempt((n) => n + 1);
            }}
            className="rounded-lg border-2 border-(--accent) px-3 py-1.5 text-xs font-bold text-(--accent) transition-colors hover:bg-(--accent)/10"
          >
            Reintentar
          </button>
        </div>
      ) : characters == null ? (
        <div className="rounded-2xl border-2 border-dashed border-(--border) p-3 text-xs font-semibold text-(--muted)">
          Cargando voces…
        </div>
      ) : (
        /* key por toma: el studio siembra su estado desde `live`, así que debe
           remontarse por oración y cada vez que el backend la vuelve a narrar. */
        <VoiceStudio
          key={`${savedId}-${takeVersion}`}
          live={liveTake}
          characters={characters}
          onDraft={(opts) => draftNarration("sentences", savedId, opts)}
          onPublish={(characterId) =>
            publishNarration("sentences", savedId, characterId)
          }
        />
      )}
    </AdminModal>
  );
}
