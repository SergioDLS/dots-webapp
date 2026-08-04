"use client";

import React, { useState } from "react";
import type {
  AdminCharacter,
  VoiceClip,
  VoiceSettings,
} from "@/services/admin.service";
import VoiceSettingsPanel from "@/components/admin/voice-settings-panel";
import { resolveAudioUrl } from "@/components/admin/ui";

export type StudioTake = {
  characterId?: number;
  characterName: string;
  spokenText?: string;
  clips: VoiceClip[];
  /** Ajustes con los que se generó realmente. Revela los del personaje
   *  cuando el panel está apagado, que es lo que no se puede inferir. */
  voiceSettings?: VoiceSettings | null;
};

export type DraftOpts = {
  characterId?: number;
  seed?: number;
  voiceSettings?: VoiceSettings | null;
};

/**
 * Toma viva de las entidades de UN solo clip (vocab, letters, numbers), que
 * comparten shape: `audio` + `voiceCharacterId`. pronunciation arma la suya
 * aparte porque es un par mínimo de dos clips etiquetados.
 */
export function singleClipTake(
  item: { audio?: string | null; voiceCharacterId?: number | null },
  characterName: (id?: number | null) => string,
): StudioTake | null {
  if (!item.audio) return null;
  return {
    characterId: item.voiceCharacterId ?? undefined,
    characterName: characterName(item.voiceCharacterId),
    clips: [{ url: item.audio }],
  };
}

interface VoiceStudioProps {
  /** Toma que oye el alumno hoy, o null si el ítem aún no tiene narración. */
  live: StudioTake | null;
  characters: AdminCharacter[];
  onDraft: (opts: DraftOpts) => Promise<StudioTake & { characterId: number }>;
  onPublish: (characterId: number) => Promise<{ urls: string[] }>;
}

function errorMessage(e: unknown): string {
  const status = (e as { response?: { status?: number } })?.response?.status;
  if (status === 409)
    return "No hay borrador de ese narrador para este ítem. Regenera la toma para volver a intentarlo.";
  if (status === 429) return "ElevenLabs pidió esperar. Prueba en un momento.";
  if (status === 400)
    return "ElevenLabs rechazó los ajustes. Revisa los valores del panel.";
  if (status === 503)
    return "Falta configurar ElevenLabs o Cloudinary en el servidor.";
  const msg = (e as { response?: { data?: { message?: string } } })?.response
    ?.data?.message;
  return msg ?? "No se pudo completar. Inténtalo otra vez.";
}

function Player({
  clips,
  autoPlay,
}: {
  clips: VoiceClip[];
  autoPlay?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      {clips.map((clip, i) => (
        // La posición va en la clave porque un par mínimo con datos legacy
        // corruptos podría traer audioA === audioB. Sigue cambiando por toma,
        // que es lo que sostiene el invariante de remontaje.
        <div key={`${i}-${clip.url}`} className="flex items-center gap-2">
          {clip.label && (
            <span className="min-w-16 text-xs font-bold text-(--muted)">
              {clip.label}
            </span>
          )}
          {/* key por URL: cada toma nueva remonta el <audio>, así autoPlay
              suena UNA vez por toma y nunca se repite en un re-render. */}
          <audio
            key={`${i}-${clip.url}`}
            // Único punto de paso de TODO clip del studio, así que resolvemos
            // aquí: los borradores y las tomas de Cloudinary son absolutas y
            // pasan intactas, pero en la BD compartida quedan rutas legacy
            // relativas, y un <audio> con src roto falla EN SILENCIO.
            src={resolveAudioUrl(clip.url)}
            controls
            autoPlay={autoPlay && i === 0}
            className="h-8 w-full"
          />
        </div>
      ))}
    </div>
  );
}

/**
 * ⚠️ El componente debe remontarse por ítem (dale `key={item.id}` donde lo
 * uses). Inicializa su estado interno desde `live`, así que reusar la instancia
 * entre dos ítems distintos mostraría la toma del anterior.
 */
export default function VoiceStudio({
  live,
  characters,
  onDraft,
  onPublish,
}: VoiceStudioProps) {
  const [published, setPublished] = useState<StudioTake | null>(live);
  const [draft, setDraft] = useState<
    (StudioTake & { characterId: number }) | null
  >(null);
  const [takeCount, setTakeCount] = useState(0);
  const [generating, setGenerating] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [err, setErr] = useState("");
  // Sembrado con el narrador que YA tiene el ítem: "Regenerar" sin tocar el
  // selector debe repetir la misma voz, no caer a Auto y reasignarle el
  // narrador al publicar. El componente se remonta por ítem, así que la
  // siembra es correcta para cada uno.
  const [narratorId, setNarratorId] = useState<number | undefined>(
    live?.characterId,
  );
  const [settings, setSettings] = useState<VoiceSettings | null>(null);
  const [seed, setSeed] = useState<number | null>(null);

  // La URL viva se construye en cliente sin segmento de versión, así que el
  // navegador podría servir una copia vieja. Sello de montaje para romper la
  // caché. Inicializador lazy, no un efecto (regla 3).
  const [cacheBust] = useState(() => Date.now());

  const selected = characters.find((c) => c.id === narratorId) ?? null;

  const bust = (url: string) =>
    url.includes("?") ? `${url}&t=${cacheBust}` : `${url}?t=${cacheBust}`;

  const generate = async () => {
    setGenerating(true);
    setErr("");
    try {
      const take = await onDraft({
        characterId: narratorId,
        seed: seed ?? undefined,
        voiceSettings: settings,
      });
      setDraft(take);
      setTakeCount((n) => n + 1);
    } catch (e) {
      setErr(errorMessage(e));
    } finally {
      setGenerating(false);
    }
  };

  const publish = async () => {
    if (!draft) return;
    setPublishing(true);
    setErr("");
    try {
      const { urls } = await onPublish(draft.characterId);
      // Sin una URL por clip no se puede armar la toma viva: caer a la del
      // borrador daría un 404 silencioso, porque el rename ya movió ese asset.
      // Mejor dejar el borrador en pantalla y decirlo.
      if (urls.length !== draft.clips.length) {
        setErr(
          "El servidor publicó pero no devolvió todas las pistas. Recarga para ver qué quedó.",
        );
        return;
      }
      // La respuesta trae solo las URLs canónicas versionadas; el nombre y el
      // texto hablado ya venían en el borrador, así que la toma viva se arma
      // sin refetch.
      setPublished({
        characterId: draft.characterId,
        characterName: draft.characterName,
        spokenText: draft.spokenText,
        clips: draft.clips.map((c, i) => ({ label: c.label, url: urls[i] })),
      });
      setDraft(null);
    } catch (e) {
      setErr(errorMessage(e));
    } finally {
      setPublishing(false);
    }
  };

  return (
    <div className="flex flex-col gap-3 rounded-2xl border-2 border-(--border) p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs font-bold text-(--muted)">Narración</span>
        <select
          aria-label="Narrador"
          value={narratorId ?? ""}
          // A propósito no se resetean los `settings`: cambiar de narrador
          // conservando los ajustes deja comparar la misma configuración entre
          // voces. Ojo, entonces "Guardar en el personaje" los escribe sobre el
          // narrador que esté elegido en ese momento, no sobre el que los sembró.
          onChange={(e) =>
            setNarratorId(
              e.target.value === "" ? undefined : Number(e.target.value),
            )
          }
          className="rounded-lg border-2 border-(--border) bg-(--input-bg) px-2 py-1 text-xs font-bold text-foreground"
        >
          <option value="">Narrador: Auto (balanceado)</option>
          {characters
            // El narrador que el ítem ya usa entra aunque esté deshabilitado:
            // si no, el selector mostraría un valor sin opción y regenerar
            // parecería usar Auto cuando en realidad repite esa voz.
            .filter((c) => c.enabled || c.id === live?.characterId)
            .map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
        </select>
      </div>

      {published ? (
        <div className="flex flex-col gap-1.5 rounded-xl bg-(--background) p-2.5">
          <span className="text-[11px] font-bold uppercase tracking-wide text-(--muted)">
            En vivo · {published.characterName}
          </span>
          <Player
            clips={published.clips.map((c) => ({ ...c, url: bust(c.url) }))}
          />
        </div>
      ) : (
        <p className="rounded-xl bg-(--background) p-2.5 text-xs font-semibold text-(--muted)">
          Este ítem todavía no tiene narración.
        </p>
      )}

      {draft && (
        <div className="flex flex-col gap-2 rounded-xl border-2 border-(--accent) bg-(--accent)/8 p-2.5">
          <div className="flex items-baseline justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wide text-(--accent)">
              Borrador · {draft.characterName}
            </span>
            <span className="text-[11px] font-bold text-(--accent)">
              toma {takeCount}
            </span>
          </div>
          {draft.spokenText && (
            <p className="text-xs font-semibold text-(--accent)">
              Dice: “{draft.spokenText}”
            </p>
          )}
          {draft.voiceSettings && (
            <p className="text-[11px] font-medium text-(--accent)">
              Ajustes usados · estabilidad{" "}
              {draft.voiceSettings.stability.toFixed(2)}
              {" · "}parecido {draft.voiceSettings.similarityBoost.toFixed(2)}
              {" · "}estilo {draft.voiceSettings.style.toFixed(2)}
              {/* Se imprimen los dos casos: con el panel apagado esta línea es
                  la ÚNICA forma de ver que el personaje trae el refuerzo en
                  false, y omitirlo se leería como que no viajó el ajuste. */}
              {draft.voiceSettings.useSpeakerBoost
                ? " · con refuerzo"
                : " · sin refuerzo"}
            </p>
          )}
          <Player clips={draft.clips} autoPlay />
          <div className="flex flex-wrap gap-2">
            <button
              onClick={publish}
              disabled={publishing || generating}
              className="rounded-lg border-2 border-(--accent) bg-(--accent) px-3 py-1.5 text-xs font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {publishing ? "Publicando…" : "Usar esta toma"}
            </button>
            <button
              onClick={generate}
              disabled={generating || publishing}
              className="rounded-lg border-2 border-(--border) px-3 py-1.5 text-xs font-bold text-(--muted) transition-colors hover:border-(--accent) hover:text-(--accent) disabled:opacity-50"
            >
              {generating ? "Generando…" : "Regenerar"}
            </button>
            <button
              onClick={() => {
                setDraft(null);
                setErr("");
              }}
              disabled={publishing}
              className="rounded-lg px-3 py-1.5 text-xs font-bold text-(--muted) transition-colors hover:text-(--danger) disabled:opacity-50"
            >
              Descartar
            </button>
          </div>
        </div>
      )}

      {!draft && (
        <button
          onClick={generate}
          disabled={generating}
          className="self-start rounded-lg border-2 border-(--accent) px-3 py-1.5 text-xs font-bold text-(--accent) transition-colors hover:bg-(--accent)/10 disabled:opacity-40"
        >
          {generating
            ? "Generando…"
            : published
              ? "Generar otra toma"
              : "Generar voz"}
        </button>
      )}

      {err && (
        <p className="rounded-xl bg-(--danger)/10 px-3 py-2 text-xs font-bold text-(--danger)">
          {err}
        </p>
      )}

      <VoiceSettingsPanel
        character={selected}
        value={settings}
        onChange={setSettings}
        seed={seed}
        onSeedChange={setSeed}
      />
    </div>
  );
}
