"use client";

import { useMemo, useRef, useState } from "react";

import UIButton from "@/components/ui/button/button";
import { optionStyles } from "@/components/lesson/option-styles";
import { playSound } from "@/lib/feedback-sounds";

/**
 * Ronda inversa (F3e): ves el texto (letra/numeral/significado) y eliges el
 * audio correcto entre 3–4 altavoces. Tap en un altavoz = reproduce Y lo
 * selecciona; "Comprobar" valida. Fallos se re-encolan hasta dominar todo.
 * RN-safe: solo tap, animación transform/opacity.
 */

export type AudioChoice = {
  id: number;
  /** Texto grande mostrado como consigna. */
  prompt: string;
  audio: string;
};

interface Props {
  /** Ítems del tramo CON audio (la cola de dominio de esta ronda). */
  items: AudioChoice[];
  /** Pool de distractores (el pack completo con audio). */
  pool: AudioChoice[];
  /** Reproductor compartido de la lección (useLessonAudio). */
  play: (src?: string | null) => void;
  /** Una llamada por fallo (alimenta times_wrong). */
  onWrong: (itemId: number) => void;
  /** Progreso 0-100 de la ronda. */
  onProgress?: (pct: number) => void;
  onComplete: () => void;
}

const FEEDBACK_MS = 600;
const OPTION_COUNT = 4;

function shuffle<T>(arr: T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export default function AudioChoiceQuiz({
  items,
  pool,
  play,
  onWrong,
  onProgress,
  onComplete,
}: Props) {
  const [queue, setQueue] = useState<AudioChoice[]>(() => shuffle(items));
  const [total] = useState(() => queue.length);
  const [mastered, setMastered] = useState<Set<number>>(new Set());
  const [selected, setSelected] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<"correct" | "wrong" | null>(null);
  const lockRef = useRef(false);

  const target = queue[0];
  const targetId = target?.id;

  // Opciones: el audio correcto + hasta 3 distractores del pack, barajadas por
  // turno (memo keyed en targetId + queue.length: un re-encolado rebaraja).
  const options = useMemo(() => {
    if (!target) return [] as AudioChoice[];
    const picked: AudioChoice[] = [target];
    const seen = new Set<number>([target.id]);
    for (const item of shuffle(pool)) {
      if (picked.length >= OPTION_COUNT) break;
      if (seen.has(item.id) || item.audio === target.audio) continue;
      seen.add(item.id);
      picked.push(item);
    }
    return shuffle(picked);
    // queue.length fuerza rebarajado al re-encolar el mismo target.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetId, queue.length, pool]);

  if (!target) return null;

  const pick = (option: AudioChoice) => {
    if (lockRef.current) return;
    play(option.audio);
    setSelected(option.id);
  };

  const check = () => {
    if (lockRef.current || selected === null) return;
    lockRef.current = true;

    if (selected === target.id) {
      playSound("correct");
      const nextMastered = new Set(mastered).add(target.id);
      setMastered(nextMastered);
      onProgress?.(Math.floor((nextMastered.size / Math.max(1, total)) * 100));
      setFeedback("correct");
      const rest = queue.slice(1);
      setTimeout(() => {
        lockRef.current = false;
        setFeedback(null);
        setSelected(null);
        setQueue(rest);
        if (rest.length === 0) onComplete();
      }, FEEDBACK_MS);
    } else {
      playSound("wrong");
      onWrong(target.id);
      setFeedback("wrong");
      setTimeout(() => {
        lockRef.current = false;
        setFeedback(null);
        setSelected(null);
        // El fallado vuelve al FINAL de la cola.
        setQueue((q) => [...q.slice(1), q[0]]);
      }, FEEDBACK_MS);
    }
  };

  const optionStyle = (id: number): React.CSSProperties => {
    if (feedback && selected === id) {
      return feedback === "correct" ? optionStyles.correct : optionStyles.wrong;
    }
    return selected === id ? optionStyles.selected : optionStyles.idle;
  };

  return (
    <div className="w-full">
      <p className="text-center text-sm mb-3" style={{ color: "var(--muted)" }}>
        ¿Cómo suena? Toca los altavoces y elige · {mastered.size} de {total}
      </p>

      {/* Consigna: el texto grande */}
      <div
        className="w-full rounded-2xl py-6 mb-4 text-center"
        style={{
          background: "color-mix(in srgb, var(--accent) 10%, var(--surface))",
          border: "2px solid var(--border)",
        }}
      >
        <span className="text-4xl font-extrabold" style={{ color: "var(--accent)" }}>
          {target.prompt}
        </span>
      </div>

      {/* Altavoces: tap = reproduce + selecciona */}
      <div className="grid grid-cols-2 gap-3 w-full mb-4">
        {options.map((option, idx) => (
          <button
            key={option.id}
            type="button"
            className="flex flex-col items-center gap-1 rounded-2xl py-5 font-bold transition-all duration-200 cursor-pointer select-none active:scale-[.96]"
            style={optionStyle(option.id)}
            onClick={() => pick(option)}
          >
            <span className="text-3xl">🔊</span>
            <span className="text-xs" style={{ opacity: 0.7 }}>
              Opción {idx + 1}
            </span>
          </button>
        ))}
      </div>

      <UIButton
        tone="accent"
        fullWidth
        disabled={selected === null || feedback !== null}
        onClick={check}
      >
        Comprobar
      </UIButton>

      {feedback === "wrong" && (
        <p
          className="text-center text-sm font-bold mt-3"
          style={{ color: "#ef4444" }}
        >
          Casi — este volverá a salir.
        </p>
      )}
    </div>
  );
}
