"use client";

import { useEffect, useRef } from "react";
import Image from "next/image";
import NodePopover from "./node-popover";
import NodeMilestones from "./node-milestones";
import { Icon } from "@/components/ui/icon";
import { UiIcon } from "@/components/ui/ui-icon";
import { NODE_META } from "@/lib/path-node-meta";
import { nodeMilestones } from "@/lib/node-milestones";
import { ART_BOX, LABEL_H, MILESTONES_W, MILESTONE_DOT, NODE_ROW_H, SLOT_W } from "@/lib/node-bubble";
import { DIFFICULTY_TEXT_ON_HEX } from "@/lib/difficulty-palette";
import { wordImageUrl } from "@/lib/media-url";
import { BASE_URL_IMAGES } from "@/constants";
import type { PathNode as PathNodeType } from "@/types/path.types";

/* ── Geometría compartida con path-section (slots y conectores) ──────────
 * Vive en lib/node-bubble.ts, que también calcula el expandido. El arte
 * (128 px) flota en una caja de 136, con hitos de 104×14 y etiqueta de 13 px
 * debajo. Todas las filas miden lo mismo, checkpoints incluidos. */
export const NODE_W = SLOT_W;
export { ART_BOX, NODE_ROW_H };
export const ART = 128;
const TROPHY = 118;

interface PathNodeProps {
  node: PathNodeType;
  accentHex: string;
  checkpointAvailable: boolean;
  animationIndex: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  popoverAlign: "left" | "center" | "right";
  /** Vista previa de una dificultad bloqueada: todo en gris, sin popover ni marcas de progreso. */
  preview?: boolean;
}

export default function PathNode({
  node,
  accentHex,
  checkpointAvailable,
  animationIndex,
  open,
  onOpenChange,
  popoverAlign,
  preview = false,
}: PathNodeProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);

  const isCheckpoint = node.type === "checkpoint";
  const isLocked = preview || !node.unlocked;
  const isDone = !preview && node.completed;
  const isCurrent = !preview && node.current && !isLocked && !isDone;
  const isTestable =
    !preview && isCheckpoint && node.unlocked && !node.completed && checkpointAvailable;
  const meta = NODE_META[node.type];

  // Cerrar el popover al tocar fuera (pointerdown: sirve para ratón y dedo).
  useEffect(() => {
    if (!open) return;
    const h = (e: PointerEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) onOpenChange(false);
    };
    document.addEventListener("pointerdown", h);
    return () => document.removeEventListener("pointerdown", h);
  }, [open, onOpenChange]);

  const labelColor = isLocked
    ? "var(--muted)"
    : isCheckpoint
      ? "var(--gold-edge)"
      : isDone
        ? "var(--success)"
        : `color-mix(in srgb, ${accentHex} 55%, var(--foreground))`;

  // Sombra de piso por defecto; resplandor del color de la sección en el actual;
  // dorado en el checkpoint (no bloqueado). Bloqueado: gris y apagado, sin sombra.
  const artFilter = isLocked
    ? "grayscale(1)"
    : isCheckpoint
      ? "drop-shadow(0 0 16px color-mix(in srgb, var(--gold) 60%, transparent))"
      : isCurrent
        ? `drop-shadow(0 0 14px ${accentHex}aa)`
        : "drop-shadow(0 6px 4px rgba(30, 27, 92, 0.18))";
  const artOpacity = isLocked ? 0.3 : isDone ? 0.88 : 1;
  const delay = Math.min(animationIndex, 8) * 80;
  const src = node.src ? wordImageUrl(node.src, BASE_URL_IMAGES) : null;
  const showBar = !isLocked && !isCheckpoint;

  return (
    <div
      ref={wrapperRef}
      className="relative flex flex-col items-center"
      style={{
        width: NODE_W,
        animation: `dots-pop-in 500ms cubic-bezier(.34,1.56,.64,1) ${delay}ms both`,
      }}
    >
      {/* ── Arte (el tile es el botón) ─────────────────────── */}
      <button
        type="button"
        aria-label={`${meta.label}: ${node.title}`}
        aria-expanded={open}
        disabled={isLocked}
        onClick={() => onOpenChange(!open)}
        className="relative flex items-center justify-center bg-transparent p-0 transition-transform duration-150 hover:enabled:scale-[1.06] active:enabled:scale-95 disabled:cursor-default"
        style={{
          width: ART_BOX,
          height: ART_BOX,
          animation: isCurrent
            ? `dots-float 2.5s ease-in-out ${(animationIndex % 3) * 0.4}s infinite`
            : "none",
        }}
      >
        {/* Pulso: acento en el actual, oro suave en el checkpoint listo */}
        {(isCurrent || isTestable) && (
          <div
            aria-hidden
            className="absolute inset-2 rounded-full"
            style={{
              border: `3px solid ${isTestable ? "color-mix(in srgb, var(--gold) 55%, transparent)" : `${accentHex}88`}`,
              animation: `dots-pulse-scale ${isTestable ? "2.6s" : "2s"} ease-out infinite`,
              // opacity base: con prefers-reduced-motion la animación colapsa y este borde tenue es el feedback que queda.
              opacity: 0.7,
            }}
          />
        )}

        <div
          style={{
            opacity: artOpacity,
            filter: artFilter,
            transition: "opacity 200ms",
            animation: isCurrent
              ? `dots-wiggle 3s ease-in-out ${animationIndex * 0.2}s infinite`
              : "none",
          }}
        >
          {isCheckpoint ? (
            <UiIcon name="trofeo" size={TROPHY} />
          ) : src ? (
            <Image
              src={src}
              alt=""
              width={ART}
              height={ART}
              sizes={`${ART}px`}
              className="object-contain"
              style={{ width: ART, height: ART }}
              draggable={false}
            />
          ) : (
            <Icon name={meta.icon} size={72} />
          )}
        </div>

        {isLocked && (
          <div
            className="absolute inset-0 flex items-center justify-center text-(--muted)"
            role="img"
            aria-label="Bloqueado"
          >
            <Icon name="candado" size={36} />
          </div>
        )}

        {/* Badge de tipo (abajo-izquierda), en mono sobre el acento: ver DIFFICULTY_TEXT_ON_HEX */}
        {!isCheckpoint && (
          <div
            className="absolute flex items-center justify-center"
            style={{
              bottom: 6,
              left: 6,
              width: 28,
              height: 28,
              borderRadius: "50%",
              background: isLocked ? "var(--border)" : accentHex,
              border: "2px solid var(--surface)",
              boxShadow: isLocked ? "none" : `0 2px 6px ${accentHex}55`,
              filter: isLocked ? "grayscale(1)" : "none",
              color: DIFFICULTY_TEXT_ON_HEX[accentHex] ?? "#ffffff",
              zIndex: 10,
            }}
            title={meta.label}
          >
            <Icon name={meta.icon} size={16} mono />
          </div>
        )}

        {/* Estrella del actual (arriba-derecha) */}
        {isCurrent && (
          <div
            className="absolute flex items-center justify-center"
            style={{
              top: 4,
              right: 8,
              width: 30,
              height: 30,
              borderRadius: "50%",
              background: "linear-gradient(135deg, var(--gold), var(--gold-edge))",
              border: "2px solid var(--surface)",
              boxShadow: "0 2px 8px color-mix(in srgb, var(--gold) 50%, transparent)",
              zIndex: 10,
            }}
          >
            <span style={{ display: "inline-flex", animation: "dots-star-spin 3s linear infinite" }}>
              <UiIcon name="xp" size={15} />
            </span>
          </div>
        )}

      </button>

      {/* ── Hitos (ocultos en bloqueados y checkpoints; el hueco se conserva) ── */}
      {showBar ? (
        <NodeMilestones
          legs={nodeMilestones(node)}
          accentHex={accentHex}
          className="mt-1"
          style={{ width: MILESTONES_W }}
        />
      ) : (
        <div aria-hidden className="mt-1" style={{ height: MILESTONE_DOT }} />
      )}

      {/* ── Etiqueta ───────────────────────────────────────── */}
      <span
        className="mt-1 w-full text-center font-extrabold line-clamp-2"
        style={{ color: labelColor, fontSize: 13, lineHeight: "15px", letterSpacing: "-0.01em", height: LABEL_H }}
      >
        {node.title}
      </span>

      {/* ── Popover ────────────────────────────────────────── */}
      {open && !isLocked && (
        <NodePopover
          node={node}
          accentHex={accentHex}
          align={popoverAlign}
          onClose={() => onOpenChange(false)}
        />
      )}
    </div>
  );
}
