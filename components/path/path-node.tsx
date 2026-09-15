"use client";

import { useEffect, useRef } from "react";
import Image from "next/image";
import NodePopover from "./node-popover";
import { Icon } from "@/components/ui/icon";
import { UiIcon } from "@/components/ui/ui-icon";
import { NODE_META } from "@/lib/path-node-meta";
import { DIFFICULTY_TEXT_ON_HEX } from "@/lib/difficulty-palette";
import { wordImageUrl } from "@/lib/media-url";
import { BASE_URL_IMAGES } from "@/constants";
import type { PathNode as PathNodeType } from "@/types/path.types";

/* ── Geometría compartida con path-section (slots y conectores) ──────────
 * El arte flota sin disco ni anillo (spec §3.1): 128 px dentro de una caja de
 * 136 (8 px de aire para el resplandor), barra de 100×8 y etiqueta de 13 px.
 * Todas las filas miden lo mismo, checkpoints incluidos: la pista no tiene que
 * distinguir tamaños. */
export const NODE_W = 150;
export const ART_BOX = 136;
export const ART = 128;
export const BAR_W = 100;
export const BAR_H = 8;
export const LABEL_H = 30;
export const NODE_ROW_H = ART_BOX + 4 + BAR_H + 4 + LABEL_H; // 182
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

/** Módulos con dominio por ítem: la corona exige mastery 100, no solo completar. */
const MASTERY_TYPES = new Set(["letters", "numbers", "vocab", "pronunciation", "grammar"]);

const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

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
  const progress = clamp(node.progress);
  const isDone = !preview && node.completed;
  // Dos niveles (F3e): completado = respondiste todo 1× (check); corona = pack dominado.
  const isMastered =
    !preview && (MASTERY_TYPES.has(node.type) ? (node.mastery ?? 0) >= 100 : isDone);
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

        {/* Check de completado (abajo-derecha): el dorado es la marca de dominado desde que se retiró la corona */}
        {isDone && !isLocked && (
          <div
            className="absolute flex items-center justify-center text-white"
            style={{
              bottom: 6,
              right: 8,
              width: 26,
              height: 26,
              borderRadius: "50%",
              background: isMastered ? "linear-gradient(135deg, var(--gold), var(--gold-edge))" : "var(--success)",
              border: "2px solid var(--surface)",
              boxShadow: `0 2px 6px color-mix(in srgb, ${isMastered ? "var(--gold)" : "var(--success)"} 40%, transparent)`,
              zIndex: 10,
            }}
          >
            <Icon name="check" size={16} mono />
          </div>
        )}
      </button>

      {/* ── Barra de progreso (oculta en bloqueados y checkpoints; el hueco se conserva) ── */}
      {showBar ? (
        <div
          className="mt-1 overflow-hidden rounded-full"
          role="progressbar"
          aria-label="Progreso de la lección"
          aria-valuenow={isDone ? 100 : progress}
          aria-valuemin={0}
          aria-valuemax={100}
          style={{
            width: BAR_W,
            height: BAR_H,
            background: `color-mix(in srgb, ${accentHex} 18%, transparent)`,
          }}
        >
          <div
            className="h-full rounded-full transition-[width] duration-700 ease-out"
            style={{
              width: `${isDone ? 100 : progress}%`,
              background: isDone ? "var(--success)" : accentHex,
            }}
          />
        </div>
      ) : (
        <div aria-hidden className="mt-1" style={{ height: BAR_H }} />
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
