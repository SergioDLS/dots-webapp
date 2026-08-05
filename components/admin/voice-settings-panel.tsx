"use client";

import React, { useState } from "react";
import {
  getCharacterVoiceSettings,
  updateCharacter,
  type AdminCharacter,
  type VoiceSettings,
} from "@/services/admin.service";

/** Defaults genéricos documentados por ElevenLabs, solo si no se pueden leer. */
const FALLBACK: VoiceSettings = {
  stability: 0.5,
  similarityBoost: 0.75,
  style: 0,
  useSpeakerBoost: true,
};

interface VoiceSettingsPanelProps {
  /** Narrador elegido; null = Auto (balanceado), sin personaje al que guardar. */
  character: AdminCharacter | null;
  /** null = panel apagado: no se manda voiceSettings. */
  value: VoiceSettings | null;
  onChange: (v: VoiceSettings | null) => void;
  seed: number | null;
  onSeedChange: (s: number | null) => void;
}

function Slider({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-baseline justify-between px-1">
        <span className="text-xs font-bold text-(--muted)">{label}</span>
        <span className="text-xs font-bold text-(--accent)">
          {value.toFixed(2)}
        </span>
      </div>
      <input
        type="range"
        min={0}
        max={1}
        step={0.05}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-(--accent)"
      />
      <span className="px-1 text-[11px] font-medium text-(--muted)">{hint}</span>
    </div>
  );
}

export default function VoiceSettingsPanel({
  character,
  value,
  onChange,
  seed,
  onSeedChange,
}: VoiceSettingsPanelProps) {
  const [open, setOpen] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [note, setNote] = useState("");

  // Encender siembra los sliders con los ajustes reales de la voz. Va en el
  // handler del click, no en un efecto: la regla 3 prohíbe setState en el
  // cuerpo de un useEffect, y además no queremos fetchear sin que lo pidan.
  const enable = async () => {
    setSeeding(true);
    setNote("");
    try {
      if (character) {
        const real = await getCharacterVoiceSettings(character.id);
        onChange({
          stability: real.stability,
          similarityBoost: real.similarityBoost,
          style: real.style,
          useSpeakerBoost: real.useSpeakerBoost,
        });
      } else {
        onChange(FALLBACK);
        setNote("Con narrador Auto no hay voz que leer: partimos de los valores genéricos.");
      }
    } catch {
      onChange(FALLBACK);
      setNote("No se pudieron leer los ajustes de la voz. Partimos de los genéricos.");
    } finally {
      setSeeding(false);
    }
  };

  const saveToCharacter = async () => {
    if (!character || !value) return;
    setSaving(true);
    setNote("");
    try {
      await updateCharacter(character.id, {
        ttsStability: value.stability,
        ttsSimilarityBoost: value.similarityBoost,
        ttsStyle: value.style,
        ttsSpeakerBoost: value.useSpeakerBoost,
      });
      setNote(`Guardado en ${character.name}: lo usará todo audio nuevo de esa voz.`);
    } catch {
      setNote("No se pudo guardar en el personaje.");
    } finally {
      setSaving(false);
    }
  };

  const clearOnCharacter = async () => {
    if (!character) return;
    setSaving(true);
    setNote("");
    try {
      await updateCharacter(character.id, {
        ttsStability: null,
        ttsSimilarityBoost: null,
        ttsStyle: null,
        ttsSpeakerBoost: null,
      });
      setNote(`${character.name} vuelve a los ajustes guardados en su voz.`);
    } catch {
      setNote("No se pudo limpiar los ajustes del personaje.");
    } finally {
      setSaving(false);
    }
  };

  const set = (patch: Partial<VoiceSettings>) => {
    if (!value) return;
    onChange({ ...value, ...patch });
  };

  return (
    <div className="rounded-2xl border-2 border-(--border) p-3">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between text-xs font-bold text-(--muted) transition-colors hover:text-(--accent)"
      >
        <span>Ajustes avanzados de voz</span>
        <span>{open ? "▾" : "▸"}</span>
      </button>

      {open && (
        <div className="mt-3 flex flex-col gap-3">
          {!value ? (
            <div className="flex flex-col gap-2">
              <p className="text-[11px] font-medium text-(--muted)">
                Apagado: se usan los ajustes guardados en la voz. Enciéndelo para
                experimentar con la expresividad de las tomas.
              </p>
              <button
                onClick={enable}
                disabled={seeding}
                className="self-start rounded-lg border-2 border-(--border) px-3 py-1.5 text-xs font-bold text-(--muted) transition-colors hover:border-(--accent) hover:text-(--accent) disabled:opacity-50"
              >
                {seeding ? "Leyendo la voz…" : "Encender ajustes"}
              </button>
            </div>
          ) : (
            <>
              <Slider
                label="Estabilidad"
                hint="Bajo = más expresivo y más variación entre tomas. Ojo: también más pronunciaciones raras."
                value={value.stability}
                onChange={(stability) => set({ stability })}
              />
              <Slider
                label="Parecido a la voz"
                hint="Qué tanto se apega al timbre original."
                value={value.similarityBoost}
                onChange={(similarityBoost) => set({ similarityBoost })}
              />
              <Slider
                label="Estilo"
                hint="Exageración del estilo. Sube la latencia y puede desestabilizar."
                value={value.style}
                onChange={(style) => set({ style })}
              />

              <button
                onClick={() => set({ useSpeakerBoost: !value.useSpeakerBoost })}
                className="flex items-center gap-2 self-start text-xs font-bold text-(--muted)"
              >
                <span
                  className={`inline-block h-4 w-4 rounded border-2 ${
                    value.useSpeakerBoost
                      ? "border-(--accent) bg-(--accent)"
                      : "border-(--border)"
                  }`}
                />
                Refuerzo de claridad
              </button>

              <div className="flex flex-col gap-1">
                <span className="px-1 text-xs font-bold text-(--muted)">
                  Seed (opcional)
                </span>
                <input
                  value={seed ?? ""}
                  onChange={(e) => {
                    // El backend exige un entero 0..4294967295. Filtramos aquí
                    // lo que provocaría un 400 —decimales, negativos, letras—
                    // en vez de dejarlo llegar al fetcher.
                    const digits = e.target.value.replace(/\D/g, "");
                    onSeedChange(
                      digits === ""
                        ? null
                        : Math.min(Number(digits), 4294967295),
                    );
                  }}
                  placeholder="vacío = al azar"
                  inputMode="numeric"
                  className="w-full rounded-xl border-2 border-(--border) bg-(--input-bg) px-3 py-2 text-sm font-semibold text-foreground placeholder:font-medium placeholder:text-(--muted) outline-none focus:border-(--accent)"
                />
                <span className="px-1 text-[11px] font-medium text-(--muted)">
                  Fíjalo para aislar la variable: mismo seed y distinta
                  estabilidad, y la diferencia es el ajuste, no el azar.
                </span>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  onClick={saveToCharacter}
                  disabled={saving || !character}
                  title={
                    character
                      ? undefined
                      : "Elige un narrador concreto para poder guardar"
                  }
                  className="rounded-lg border-2 border-(--accent) px-3 py-1.5 text-xs font-bold text-(--accent) transition-colors hover:bg-(--accent)/10 disabled:opacity-40"
                >
                  {saving ? "Guardando…" : "Guardar en el personaje"}
                </button>
                <button
                  onClick={clearOnCharacter}
                  disabled={saving || !character}
                  className="rounded-lg border-2 border-(--border) px-3 py-1.5 text-xs font-bold text-(--muted) transition-colors hover:border-(--danger) hover:text-(--danger) disabled:opacity-40"
                >
                  Volver a los de la voz
                </button>
                <button
                  onClick={() => {
                    onChange(null);
                    onSeedChange(null);
                    setNote("");
                  }}
                  className="rounded-lg px-3 py-1.5 text-xs font-bold text-(--muted) transition-colors hover:text-(--danger)"
                >
                  Apagar
                </button>
              </div>
            </>
          )}

          {note && (
            <p className="text-[11px] font-bold text-(--accent)">{note}</p>
          )}
        </div>
      )}
    </div>
  );
}
