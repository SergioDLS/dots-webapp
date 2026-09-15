"use client";

import Doty from "@/components/ui/doty/doty";
import { Icon } from "@/components/ui/icon";
import { narratorFallback, prettyDifficultyName } from "@/lib/path-view";
import type { PathDifficulty } from "@/types/path.types";

interface Props {
  difficulty: PathDifficulty;
  index: number;
  previousName: string;
  accentHex: string;
  onPreview: (id: number) => void;
}

/** Dificultad bloqueada al final del Camino (spec §3.2): banner punteado, Doty en gris; tocar abre la vista previa. */
export default function LockedDifficulty({ difficulty, index, previousName, accentHex, onPreview }: Props) {
  return (
    <button
      type="button"
      onClick={() => onPreview(difficulty.id)}
      className="dots-pressable relative flex w-full items-center gap-4 bg-transparent text-left"
      style={{
        borderRadius: 28,
        padding: "16px 20px",
        border: `2px dashed color-mix(in srgb, ${accentHex} 45%, var(--border))`,
      }}
    >
      <div aria-hidden style={{ filter: "grayscale(1)", opacity: 0.5 }}>
        <Doty pose={narratorFallback(index)} size="mini" shadow={false} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1 text-[11px] font-black uppercase tracking-widest text-(--muted)">
          <Icon name="candado" size={14} /> Dificultad {index + 1}
        </p>
        <h3 className="truncate font-display text-lg font-extrabold text-(--muted)">
          {prettyDifficultyName(difficulty.name)}
        </h3>
        <p className="text-xs font-bold text-(--muted)">
          Termina {previousName} para desbloquear · toca para ver qué viene
        </p>
      </div>
      <span className="text-(--muted)">
        <Icon name="derecha" size={20} />
      </span>
    </button>
  );
}
