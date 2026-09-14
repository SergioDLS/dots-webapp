import { UiIcon } from "@/components/ui/ui-icon";

/** Chip de racha del perfil. Lee la racha real (MyStats.streak): el valor de
 *  localStorage["streak"] que usaba antes era el contador de aciertos seguidos
 *  de la práctica, otra cosa. */
export default function Streak({ streak }: { streak: number }) {
  const dias = streak === 1 ? "día" : "días";
  return (
    <div
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-extrabold text-xs"
      style={{
        background: "color-mix(in srgb, var(--flame) 14%, transparent)",
        border: "1.5px solid color-mix(in srgb, var(--flame) 38%, transparent)",
        color: "var(--flame-edge)",
      }}
      title="Racha diaria"
    >
      <UiIcon name="racha" size={16} />
      <span className="tabular-nums">
        {streak} {dias} de racha
      </span>
    </div>
  );
}
