"use client";

import { useEffect, useId, useRef, type CSSProperties } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import NodeMilestones from "./node-milestones";
import { Icon } from "@/components/ui/icon";
import { UiIcon } from "@/components/ui/ui-icon";
import { NODE_META } from "@/lib/path-node-meta";
import { nodeMilestones } from "@/lib/node-milestones";
import {
  ART_BOX,
  BUBBLE_H,
  BUBBLE_TOP,
  COL,
  LABEL_H,
  LABEL_TOP,
  NODE_ROW_H,
  SLOT_W,
} from "@/lib/node-bubble";
import { DIFFICULTY_TEXT_ON_HEX } from "@/lib/difficulty-palette";
import { wordImageUrl } from "@/lib/media-url";
import { BASE_URL_IMAGES } from "@/constants";
import type { PathNode as PathNodeType } from "@/types/path.types";

/* ── Geometría compartida con path-section (slots y conectores) ──────────
 * Vive en lib/node-bubble.ts, que también calcula el expandido. El arte
 * (128 px) flota en una caja de 136, con hitos de 104×14 y etiqueta de 13 px
 * debajo. Todas las filas miden lo mismo, checkpoints incluidos, y expandir
 * NO cambia ese alto: la burbuja crece a lo ancho y el título y los hitos
 * pasan a la columna de al lado (spec 2026-09-30 §Geometría). */
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
  /** Pista contextual de este nivel: la burbuja la lleva mientras está abierta (cerrada, el slot). */
  tipKey?: string;
  /** Vista previa de una dificultad bloqueada: todo en gris, sin expandir ni marcas de progreso. */
  preview?: boolean;
}

const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

export default function PathNode({
  node,
  accentHex,
  checkpointAvailable,
  animationIndex,
  open,
  onOpenChange,
  tipKey,
  preview = false,
}: PathNodeProps) {
  const router = useRouter();
  const wrapperRef = useRef<HTMLDivElement>(null);
  const bubbleId = useId();

  const isCheckpoint = node.type === "checkpoint";
  const isLocked = preview || !node.unlocked;
  const progress = clamp(node.progress);
  const isDone = !preview && node.completed;
  const isCurrent = !preview && node.current && !isLocked && !isDone;
  const isTestable =
    !preview && isCheckpoint && node.unlocked && !node.completed && checkpointAvailable;
  const meta = NODE_META[node.type];
  const expanded = open && !isLocked;

  // Cerrar con un click fuera. Click y no pointerdown: el nivel actual nace
  // abierto, y con pointerdown el primer toque para hacer scroll lo cerraría.
  useEffect(() => {
    if (!expanded) return;
    const h = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) onOpenChange(false);
    };
    document.addEventListener("click", h);
    return () => document.removeEventListener("click", h);
  }, [expanded, onOpenChange]);

  const toggle = () => {
    if (expanded) {
      onOpenChange(false);
      return;
    }
    onOpenChange(true);
    // La fila no cambia de alto: esto solo actúa si el nivel estaba medio fuera.
    wrapperRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  };

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
  const tint = isCheckpoint ? "var(--gold)" : accentHex;
  const cta = node.completed ? "Repasar" : progress > 0 ? "Continuar" : "Empezar";

  return (
    <div
      ref={wrapperRef}
      // Al abrir con un toque, `scrollIntoView` libra la cabecera plegada y la navegación.
      className="relative scroll-mt-[120px] scroll-mb-[96px]"
      style={{
        width: SLOT_W,
        height: NODE_ROW_H,
        animation: `dots-pop-in 500ms cubic-bezier(.34,1.56,.64,1) ${delay}ms both`,
      }}
    >
      {/* ── Burbuja: invisible en reposo, crece a su ancho al abrir ─────── */}
      {!isLocked && (
        <div
          id={bubbleId}
          role="group"
          aria-label={node.title}
          aria-hidden={!expanded}
          data-tip={expanded ? tipKey : undefined}
          className="dots-node-bubble absolute overflow-hidden"
          style={{
            top: BUBBLE_TOP,
            height: BUBBLE_H,
            borderRadius: 28,
            background: `color-mix(in srgb, ${tint} 8%, var(--surface))`,
            // Borde como sombra interior y no `border`: un borde desplazaría 2 px
            // la columna (los hijos absolutos cuentan desde dentro del borde) y
            // dejaría de alinear con los hitos, que se posicionan en el slot.
            boxShadow: `inset 0 0 0 2px color-mix(in srgb, ${tint} 40%, var(--border)), var(--shadow-card)`,
          }}
        >
          <div inert={!expanded} className="dots-node-col absolute flex flex-col" style={{ top: COL.top }}>
            <span
              className="truncate text-[11px] font-black uppercase tracking-wider"
              style={{
                height: COL.typeH,
                lineHeight: `${COL.typeH}px`,
                color: `color-mix(in srgb, ${tint} 55%, var(--foreground))`,
              }}
            >
              {meta.label}
            </span>
            <p
              className="line-clamp-2 font-display text-base font-extrabold text-foreground"
              style={{ marginTop: COL.titleGap, height: COL.titleH, lineHeight: `${COL.titleH / 2}px` }}
            >
              {node.title}
            </p>
            {/* El hueco de los hitos: la barra es la del nodo, que viaja hasta aquí. */}
            <div aria-hidden style={{ marginTop: COL.msGap, height: COL.msH }} />
            <button
              type="button"
              onClick={() => router.push(meta.route(node))}
              className="dots-pressable w-full rounded-xl text-sm font-black tracking-wide cursor-pointer"
              style={
                {
                  marginTop: COL.ctaGap,
                  height: COL.ctaH,
                  background: accentHex,
                  color: DIFFICULTY_TEXT_ON_HEX[accentHex] ?? "#ffffff",
                  "--press-color": `color-mix(in srgb, ${accentHex} 70%, black)`,
                } as CSSProperties
              }
            >
              <span className="inline-flex items-center justify-center gap-1">
                <Icon name="derecha" size={16} mono />
                {cta}
              </span>
            </button>
          </div>
        </div>
      )}

      {/* ── Arte (el tile es el botón que abre y cierra) ─────────────────── */}
      <button
        type="button"
        aria-label={`${meta.label}: ${node.title}`}
        aria-expanded={isLocked ? undefined : expanded}
        aria-controls={isLocked ? undefined : bubbleId}
        disabled={isLocked}
        onClick={toggle}
        className="dots-node-art absolute flex items-center justify-center bg-transparent p-0 disabled:cursor-default"
        style={{
          left: (SLOT_W - ART_BOX) / 2,
          top: 0,
          width: ART_BOX,
          height: ART_BOX,
          zIndex: 1,
          // Abierto no flota: la burbuja es la que marca por dónde vas.
          animation:
            isCurrent && !expanded
              ? `dots-float 2.5s ease-in-out ${(animationIndex % 3) * 0.4}s infinite`
              : "none",
        }}
      >
        {/* Pulso: acento en el actual, oro suave en el checkpoint listo */}
        {(isCurrent || isTestable) && !expanded && (
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
            animation:
              isCurrent && !expanded
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

      {/* ── Hitos: la misma barra en reposo y abierta (viaja a la columna) ── */}
      {showBar && (
        <NodeMilestones
          legs={nodeMilestones(node)}
          accentHex={accentHex}
          labeled={expanded}
          className="dots-node-ms absolute"
          style={{ zIndex: 2 }}
        />
      )}

      {/* ── Etiqueta en reposo (abierta, el título va en la columna) ─────── */}
      <span
        aria-hidden={expanded}
        className="dots-node-label absolute left-0 w-full text-center font-extrabold line-clamp-2"
        style={{
          top: LABEL_TOP,
          color: labelColor,
          fontSize: 13,
          lineHeight: "15px",
          letterSpacing: "-0.01em",
          height: LABEL_H,
        }}
      >
        {node.title}
      </span>
    </div>
  );
}
