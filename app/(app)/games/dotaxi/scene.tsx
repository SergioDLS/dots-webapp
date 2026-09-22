"use client";

import React from "react";
import Image from "next/image";
import Doty, { type DotyPose } from "@/components/ui/doty/doty";
import { Icon } from "@/components/ui/icon";
import { laneGeometry } from "./lanes";
import {
  THETA_DEG,
  PERSPECTIVE,
  lanePlaneX,
  laneXBottom,
  project,
  type PlaneMetrics,
} from "./perspective";
import type { Trip } from "./trip";

// ── Paleta fija de la escena ─────────────────────────────────────────────────
// Solo el cielo (tokens --sky-*) y las ventanas del skyline (--dotaxi-night)
// cambian con el tema. Una carretera no es una tarjeta de la app: con
// --surface el asfalto salía casi blanco en tema claro y las rayas morían.
export const ASPHALT = "#34314f";
export const ASPHALT_EDGE = "#1e1b5c";
export const CURB = "#c9c4d8";
export const CURB_EDGE = "#8f89a8";
export const LANE_PAINT = "#f4f1e4";
export const EDGE_PAINT = "#ffd21e";
export const TAXI_YELLOW = "#ffd21e";
export const TAXI_YELLOW_DEEP = "#f7b500";
export const INK = "#1e1b5c";
export const BRAKE_RED = "#ff3b5c";
export const BRAKE_DIM = "#b3122e";
export const PANEL_BLUE = "#3768ff";
export const SIGN_FACE = "#f7f4ea";

/** 0 intacto … 5 destruido: un escalón por corazón perdido. */
export type Damage = 0 | 1 | 2 | 3 | 4 | 5;

/** Ancho del arte del taxi (px de pantalla a escala 1). */
export const TAXI_W = 128;
export const TAXI_H = 110;

// ── Cielo y skyline ──────────────────────────────────────────────────────────

const BUILDINGS: readonly { w: number; h: number }[] = [
  { w: 30, h: 46 }, { w: 22, h: 30 }, { w: 40, h: 68 }, { w: 26, h: 38 },
  { w: 34, h: 56 }, { w: 20, h: 26 }, { w: 44, h: 74 }, { w: 28, h: 42 },
  { w: 36, h: 60 }, { w: 24, h: 34 }, { w: 32, h: 50 }, { w: 40, h: 64 },
];

const STARS: readonly [number, number][] = [
  [8, 12], [22, 30], [37, 9], [51, 24], [64, 14], [78, 33], [90, 10], [15, 48], [45, 44], [70, 52], [96, 42], [30, 60],
];

export function Backdrop({ m }: { m: PlaneMetrics }) {
  const skyH = m.horizonY + 2;
  return (
    <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0" style={{ height: skyH }}>
      {/* cielo: celeste de día, azul noche en oscuro — lo deciden los tokens */}
      <div
        className="absolute inset-0"
        style={{ background: "linear-gradient(180deg, var(--sky-top), var(--sky-bottom))" }}
      />
      {/* sol de día / luna de noche: el mismo disco, dos opacidades complementarias */}
      <div
        className="absolute rounded-full"
        style={{
          top: skyH * 0.52, right: 22, width: 30, height: 30,
          background: TAXI_YELLOW, boxShadow: `0 0 18px ${TAXI_YELLOW}`,
          opacity: "calc(1 - var(--dotaxi-night))",
        }}
      />
      <div
        className="absolute rounded-full"
        style={{
          top: skyH * 0.52, right: 24, width: 26, height: 26,
          background: SIGN_FACE, boxShadow: `0 0 14px ${SIGN_FACE}`,
          opacity: "var(--dotaxi-night)",
        }}
      />
      {STARS.map(([x, y], i) => (
        <div
          key={i}
          className="absolute rounded-full"
          style={{
            left: `${x}%`, top: `${y}%`, width: 2 + (i % 2), height: 2 + (i % 2),
            background: SIGN_FACE, opacity: "var(--dotaxi-night)",
          }}
        />
      ))}
      {/* skyline: siluetas teñidas con el cielo; las ventanas se encienden de noche */}
      <div className="absolute inset-x-0 bottom-0 flex items-end justify-center gap-[2px] overflow-hidden">
        {BUILDINGS.map((b, i) => (
          <div
            key={i}
            className="relative shrink-0"
            style={{
              width: b.w, height: b.h,
              background: "color-mix(in srgb, var(--sky-bottom) 40%, #1e1b5c)",
              borderRadius: "3px 3px 0 0",
            }}
          >
            <div
              className="absolute inset-x-1 top-1 bottom-0"
              style={{
                backgroundImage: `repeating-linear-gradient(0deg, ${TAXI_YELLOW} 0 3px, transparent 3px 8px), repeating-linear-gradient(90deg, ${TAXI_YELLOW} 0 3px, transparent 3px 8px)`,
                backgroundBlendMode: "multiply",
                opacity: "calc(var(--dotaxi-night) * 0.85)",
                maskImage: `repeating-linear-gradient(90deg, #000 0 3px, transparent 3px 8px)`,
                WebkitMaskImage: `repeating-linear-gradient(90deg, #000 0 3px, transparent 3px 8px)`,
              }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

// ── El plano de suelo ────────────────────────────────────────────────────────

export function GroundPlane({
  m,
  roadY,
  lanes,
  children,
}: {
  m: PlaneMetrics;
  /** desplazamiento cíclico de las rayas, en unidades de plano */
  roadY: number;
  lanes: number;
  children?: React.ReactNode;
}) {
  const { centersPct, widthPct } = laneGeometry(lanes);
  const boundaries = centersPct.slice(1).map((c) => c - widthPct / 2);
  return (
    <div
      data-testid="plane"
      aria-hidden={false}
      className="absolute"
      style={{
        top: m.horizonY,
        left: (m.sceneW - m.planeW) / 2,
        width: m.planeW,
        height: m.planeH,
        transformOrigin: "top center",
        transform: `perspective(${PERSPECTIVE}px) rotateX(${THETA_DEG}deg)`,
        // los hijos contrarrotados (destino) necesitan el 3D real del padre
        transformStyle: "preserve-3d",
        background: CURB,
        borderTop: `2px solid ${CURB_EDGE}`,
      }}
    >
      {/* calzada */}
      <div
        className="absolute inset-y-0 overflow-hidden"
        style={{ left: m.curbW, width: m.roadW, background: ASPHALT }}
      >
        {/* divisorias discontinuas: una tira alta que se desplaza en unidades
            de plano; la perspectiva del padre las acorta hacia el horizonte */}
        {boundaries.map((pct, i) => (
          <div
            key={i}
            className="absolute inset-y-0"
            style={{
              left: `${pct}%`,
              width: 2.5,
              transform: "translateX(-50%)",
              transition: "left 450ms var(--ease-out-strong)",
            }}
          >
            <div
              className="absolute inset-x-0"
              style={{
                top: -64,
                height: "calc(100% + 128px)",
                transform: `translateY(${roadY}px)`,
                backgroundImage: `repeating-linear-gradient(to bottom, ${LANE_PAINT} 0 22px, transparent 22px 64px)`,
              }}
            />
          </div>
        ))}
        {/* arcenes continuos */}
        <div className="absolute inset-y-0" style={{ left: 1.5, width: 2, background: EDGE_PAINT }} />
        <div className="absolute inset-y-0" style={{ right: 1.5, width: 2, background: EDGE_PAINT }} />
      </div>
      {/* bordillos */}
      <div className="absolute inset-y-0" style={{ left: m.curbW - 1.5, width: 1.5, background: CURB_EDGE }} />
      <div className="absolute inset-y-0" style={{ left: m.curbW + m.roadW, width: 1.5, background: CURB_EDGE }} />
      {children}
    </div>
  );
}

// ── Pórtico de señales (la firma) ────────────────────────────────────────────

export function Gantry({
  m,
  lanes,
  options,
  lane,
  outcome,
  correct,
  onPick,
}: {
  m: PlaneMetrics;
  lanes: number;
  options: readonly string[];
  lane: number;
  outcome: "none" | "clear" | "crash";
  correct: string | undefined;
  onPick: (i: number) => void;
}) {
  const { centersPct } = laneGeometry(lanes);
  const laneW = m.roadBottomW / lanes;
  const panelW = laneW * 0.92;
  const postH = m.horizonY + 26 - 14;
  const fontPx = lanes >= 4 ? 10.5 : lanes === 3 ? 12 : 14;
  return (
    <>
      {/* travesaño y postes */}
      <div aria-hidden className="pointer-events-none absolute rounded-full" style={{ top: 14, left: 18, right: 18, height: 10, background: INK }} />
      {[18, m.sceneW - 24].map((x) => (
        <div key={x} aria-hidden className="pointer-events-none absolute" style={{ top: 14, left: x, width: 6, height: postH, background: INK, borderRadius: 3 }} />
      ))}
      {/* paneles, uno por carril */}
      {options.map((opt, i) => {
        const isClear = outcome !== "none" && opt === correct;
        const isBlocked = outcome !== "none" && !isClear;
        const active = outcome === "none" && lane === i;
        const cx = laneXBottom(m, centersPct[i] ?? 50);
        return (
          <React.Fragment key={`${i}-${opt}`}>
            <div aria-hidden className="pointer-events-none absolute" style={{ top: 22, left: cx - 4, width: 8, height: 8, background: INK }} />
            <button
              type="button"
              data-testid={`lane-${i}`}
              onPointerUp={() => onPick(i)}
              className="absolute flex items-center justify-center rounded-lg border-2 px-1 py-1.5 font-display font-extrabold leading-tight break-words"
              style={{
                top: 30,
                left: cx - panelW / 2,
                width: panelW,
                minHeight: 38,
                fontSize: fontPx,
                color: SIGN_FACE,
                background: isClear ? "var(--success)" : isBlocked ? "var(--danger)" : PANEL_BLUE,
                borderColor: active ? EDGE_PAINT : INK,
                boxShadow: active
                  ? `0 0 0 2px ${EDGE_PAINT}, 0 4px 0 ${INK}`
                  : `0 4px 0 ${INK}`,
                touchAction: "manipulation",
                transition: "background 0.2s, border-color 0.2s, box-shadow 0.2s, left 450ms var(--ease-out-strong), width 450ms var(--ease-out-strong)",
              }}
            >
              {outcome === "none" ? opt : <Icon name={isClear ? "check" : "cruz"} size={20} mono />}
            </button>
          </React.Fragment>
        );
      })}
    </>
  );
}

/**
 * El pórtico llegando desde el punto de fuga: nace pequeño en el horizonte y
 * sube creciendo hasta su sitio (lo que está por encima de la vista sube al
 * acercarse). Solo transform/opacity; el progreso lo marca el ticker.
 */
export function GantryApproach({ m, progress, children }: { m: PlaneMetrics; progress: number; children: React.ReactNode }) {
  const p = Math.min(1, Math.max(0, progress));
  const e = 1 - Math.pow(1 - p, 3);
  const k = 0.18 + 0.82 * e;
  // centro del pórtico en reposo ≈ y 50; en el horizonte, sobre el punto de fuga
  const dy = (1 - e) * (m.horizonY - 50 - 6);
  return (
    <div
      data-testid="gantry"
      className="absolute inset-x-0 top-0"
      style={{
        height: 110,
        transform: `translateY(${dy}px) scale(${k})`,
        transformOrigin: "50% 50px",
        opacity: 0.35 + 0.65 * e,
        pointerEvents: p >= 1 ? "auto" : "none",
      }}
    >
      {children}
    </div>
  );
}

// ── Taxi trasero ─────────────────────────────────────────────────────────────

const DENTS: readonly { top: number; left: number; w: number; h: number }[] = [
  { top: 58, left: 22, w: 16, h: 10 },
  { top: 12, left: 84, w: 14, h: 9 },
  { top: 70, left: 84, w: 18, h: 11 },
  { top: 36, left: 12, w: 12, h: 14 },
  { top: 20, left: 46, w: 20, h: 9 },
];

/**
 * El taxi visto por detrás con Doty al volante. Placeholder CSS hasta que
 * lleguen los sprites dotaxi-taxi{,-d1..-d4,-wrecked}: entonces este cuerpo
 * se cambia por un <Image> por nivel de daño y NADA más cambia.
 */
export function TaxiRear({
  damage,
  braking,
  crashing,
}: {
  damage: Damage;
  /** pilotos encendidos + hundimiento del morro */
  braking: boolean;
  /** temblor del golpe */
  crashing: boolean;
}) {
  const wrecked = damage >= 5;
  return (
    <div
      className="relative"
      style={{
        width: TAXI_W,
        height: TAXI_H,
        animation: crashing ? "dotaxi-shake 0.5s ease-in-out" : "dotaxi-bob 0.8s ease-in-out infinite",
      }}
    >
      <div
        className="absolute inset-0"
        style={{ animation: braking ? "dotaxi-brake-dip 420ms var(--ease-out-strong) both" : "none", transformOrigin: "bottom center" }}
      >
        <div
          className="absolute inset-0"
          style={{ animation: wrecked ? "dotaxi-sag 600ms ease-out both" : "none", transformOrigin: "bottom center" }}
        >
          {/* halo de frenado bajo la trasera */}
          <div
            aria-hidden
            className="absolute"
            style={{
              left: 0, right: 0, top: 58, height: 52,
              background: `radial-gradient(ellipse at 18% 40%, ${BRAKE_RED}bb, transparent 45%), radial-gradient(ellipse at 82% 40%, ${BRAKE_RED}bb, transparent 45%)`,
              opacity: braking ? 1 : 0,
              transition: "opacity 180ms",
              filter: "blur(2px)",
            }}
          />
          {/* ruedas traseras */}
          {[6, TAXI_W - 28].map((left) => (
            <div key={left} className="absolute rounded-md" style={{ left, top: 76, width: 22, height: 30, background: INK }} />
          ))}
          {/* carrocería */}
          <div
            className="absolute"
            style={{
              left: 10, right: 10, top: 8, bottom: 14,
              background: `linear-gradient(180deg, ${TAXI_YELLOW}, ${TAXI_YELLOW_DEEP})`,
              border: `3px solid ${INK}`,
              borderRadius: "26px 26px 18px 18px",
              boxShadow: "0 8px 14px rgba(0,0,0,0.35)",
            }}
          >
            {/* cartel del techo */}
            <div
              className="absolute left-1/2 rounded-md px-2 py-0.5 text-[9px] font-black tracking-widest"
              style={{
                top: -12,
                background: INK,
                color: TAXI_YELLOW,
                transform: `translateX(-50%) rotate(${damage >= 4 ? -14 : 0}deg)`,
                transition: "transform 0.3s var(--ease-out-strong)",
                opacity: wrecked ? 0.55 : 1,
              }}
            >
              TAXI
            </div>
            {/* luneta: se ve la NUCA de Doty al volante, con la gorra. Su cara
                va en la burbuja de reacción (ReactionBubble), que es donde
                una expresión se lee desde atrás. */}
            <div
              className="absolute overflow-hidden"
              style={{ left: 18, right: 18, top: 8, height: 38, background: "#bfe9ff", border: `2px solid ${INK}`, borderRadius: 12 }}
            >
              {/* reposacabezas */}
              <div className="absolute rounded-md" style={{ left: 12, top: 18, width: 30, height: 22, background: "#2a2750", border: `2px solid ${INK}` }} />
              {/* cabeza por detrás */}
              <div className="absolute rounded-full" style={{ left: 14, top: 6, width: 26, height: 26, background: "#ff1f8f", border: `2px solid ${INK}` }} />
              {/* gorra: copa y banda */}
              <div className="absolute rounded-t-full" style={{ left: 12, top: 1, width: 30, height: 12, background: INK }} />
              <div className="absolute rounded-full" style={{ left: 10, top: 10, width: 34, height: 4, background: TAXI_YELLOW, border: `1px solid ${INK}` }} />
              {/* grietas */}
              {damage >= 2 && (
                <div aria-hidden className="absolute" style={{ top: -4, left: 52, width: 2, height: 46, background: INK, transform: "rotate(24deg)", opacity: 0.8 }} />
              )}
              {damage >= 4 && (
                <div aria-hidden className="absolute" style={{ top: 6, left: 30, width: 2, height: 30, background: INK, transform: "rotate(-38deg)", opacity: 0.8 }} />
              )}
            </div>
            {/* línea del maletero */}
            <div className="absolute" style={{ left: 16, right: 16, top: 54, height: 2, background: INK, opacity: 0.55 }} />
            {/* matrícula */}
            <div
              className="absolute left-1/2 flex items-center justify-center rounded-sm text-[7px] font-black"
              style={{
                top: 58, width: 30, height: 11, background: SIGN_FACE, border: `1.5px solid ${INK}`, color: INK,
                transform: `translateX(-50%) rotate(${damage >= 3 ? 9 : 0}deg)`,
                transition: "transform 0.3s var(--ease-out-strong)",
              }}
            >
              DOTS
            </div>
            {/* pilotos */}
            {[
              { left: 8, broken: damage >= 3 },
              { right: 8, broken: false },
            ].map((p, i) => (
              <div
                key={i}
                className="absolute rounded-full"
                style={{
                  ...(p.left !== undefined ? { left: p.left } : { right: p.right }),
                  top: 60, width: 18, height: 9,
                  background: p.broken ? "#4a1020" : braking ? BRAKE_RED : BRAKE_DIM,
                  border: `1.5px solid ${INK}`,
                  boxShadow: braking && !p.broken ? `0 0 10px ${BRAKE_RED}` : "none",
                  transition: "background 150ms, box-shadow 150ms",
                }}
              />
            ))}
            {/* parachoques con la franja a cuadros */}
            <div
              className="absolute"
              style={{
                left: 6, right: 6, bottom: -2, height: 9, borderRadius: 4,
                background: `repeating-linear-gradient(90deg, ${INK} 0 7px, ${SIGN_FACE} 7px 14px)`,
                border: `1.5px solid ${INK}`,
              }}
            />
            {/* abolladuras: una por corazón perdido */}
            {DENTS.slice(0, Math.min(damage, 5)).map((d) => (
              <div
                key={`${d.top}-${d.left}`}
                className="absolute rounded-full"
                style={{
                  top: d.top, left: d.left, width: d.w, height: d.h,
                  background: "rgba(30,27,92,0.45)",
                  boxShadow: "inset 1px 1px 0 rgba(255,255,255,0.35)",
                }}
              />
            ))}
            {/* destrozado: la pintura pierde brillo */}
            {wrecked && <div className="absolute inset-0 rounded-[22px]" style={{ background: "rgba(60,60,80,0.28)" }} />}
          </div>
          {/* humo: del morro (más allá del techo) desde el tercer golpe */}
          {damage >= 3 &&
            Array.from({ length: wrecked ? 4 : damage >= 4 ? 2 : 1 }).map((_, i) => (
              <div
                key={i}
                aria-hidden
                className="absolute rounded-full"
                style={{
                  top: -10 - (i % 2) * 6,
                  left: 44 + i * 12,
                  width: wrecked ? 20 : 14,
                  height: wrecked ? 20 : 14,
                  background: "rgba(205,205,220,0.85)",
                  animation: `dotaxi-smoke ${wrecked ? 1.4 : 1.1}s ease-out ${i * 0.3}s infinite`,
                }}
              />
            ))}
        </div>
      </div>
    </div>
  );
}

// ── Bache sobre el plano ─────────────────────────────────────────────────────

export function Pothole({ m, pct, to, durationMs }: { m: PlaneMetrics; pct: number; to: number; durationMs: number }) {
  const x = lanePlaneX(m, pct);
  return (
    <div
      data-testid="pothole"
      aria-hidden
      className="pointer-events-none absolute"
      style={{
        left: x - 18,
        top: -12,
        width: 36,
        height: 24,
        ["--to" as string]: `${to}px`,
        animation: `dotaxi-approach ${durationMs}ms linear both`,
      }}
    >
      <div className="absolute inset-0 rounded-[50%]" style={{ background: "#141228", border: `2px solid ${ASPHALT_EDGE}` }} />
      <div className="absolute rounded-[50%]" style={{ top: 6, left: 7, width: 22, height: 12, background: "linear-gradient(180deg,#35d8f5,#3768ff)", opacity: 0.9 }} />
    </div>
  );
}

// ── Destino ──────────────────────────────────────────────────────────────────

/** El edificio de cada destino. Placeholder hasta dotaxi-{puerto,laboratorio,estadio}. */
export function DestinationArt({ trip, width }: { trip: Trip; width: number }) {
  const s = width / 96; // dibujado a 96 de ancho
  const k = trip.destination.key;
  return (
    <div className="relative" style={{ width, height: 92 * s }}>
      <div className="absolute inset-0" style={{ transform: `scale(${s})`, transformOrigin: "top left", width: 96, height: 92 }}>
        {k === "puerto" && (
          <>
            <div className="absolute" style={{ left: 0, right: 0, bottom: 0, height: 14, background: "#35d8f5", border: `2px solid ${INK}`, borderRadius: 4 }} />
            <div className="absolute" style={{ left: 34, bottom: 12, width: 28, height: 64, background: `repeating-linear-gradient(180deg, ${SIGN_FACE} 0 12px, ${BRAKE_RED} 12px 24px)`, border: `2px solid ${INK}`, borderRadius: "6px 6px 2px 2px" }} />
            <div className="absolute" style={{ left: 30, bottom: 74, width: 36, height: 12, background: INK, borderRadius: 3 }} />
            <div className="absolute rounded-full" style={{ left: 40, bottom: 77, width: 16, height: 8, background: TAXI_YELLOW, boxShadow: `0 0 10px ${TAXI_YELLOW}` }} />
            <div className="absolute" style={{ left: 4, bottom: 10, width: 22, height: 10, background: "#ff1f8f", border: `2px solid ${INK}`, borderRadius: "2px 2px 8px 8px" }} />
          </>
        )}
        {k === "laboratorio" && (
          <>
            <div className="absolute" style={{ left: 6, right: 6, bottom: 0, height: 64, background: SIGN_FACE, border: `2px solid ${INK}`, borderRadius: 6 }} />
            <div className="absolute" style={{ left: 2, right: 2, bottom: 60, height: 12, background: "#9c84dc", border: `2px solid ${INK}`, borderRadius: 4 }} />
            <div className="absolute rounded-full" style={{ left: 34, bottom: 24, width: 28, height: 28, background: "#35d8f5", border: `2px solid ${INK}` }} />
            <div className="absolute" style={{ left: 14, bottom: 0, width: 14, height: 22, background: "#3768ff", border: `2px solid ${INK}`, borderRadius: "6px 6px 0 0" }} />
            <div className="absolute" style={{ left: 68, bottom: 0, width: 14, height: 22, background: "#3768ff", border: `2px solid ${INK}`, borderRadius: "6px 6px 0 0" }} />
            <div className="absolute" style={{ left: 38, bottom: 72, width: 20, height: 18, background: "#ff1f8f", border: `2px solid ${INK}`, borderRadius: "4px 4px 10px 10px" }} />
          </>
        )}
        {k === "estadio" && (
          <>
            <div className="absolute" style={{ left: 0, right: 0, bottom: 0, height: 46, background: "#ff1f8f", border: `2px solid ${INK}`, borderRadius: "40px 40px 8px 8px" }} />
            <div className="absolute" style={{ left: 12, right: 12, bottom: 30, height: 12, background: SIGN_FACE, border: `2px solid ${INK}`, borderRadius: 20 }} />
            <div className="absolute" style={{ left: 22, right: 22, bottom: 0, height: 16, background: "#35d8f5", border: `2px solid ${INK}`, borderRadius: "6px 6px 0 0" }} />
            {[6, 84].map((x) => (
              <React.Fragment key={x}>
                <div className="absolute" style={{ left: x, bottom: 44, width: 4, height: 40, background: INK }} />
                <div className="absolute rounded-sm" style={{ left: x - 6, bottom: 82, width: 16, height: 8, background: TAXI_YELLOW, border: `1.5px solid ${INK}`, boxShadow: `0 0 10px ${TAXI_YELLOW}` }} />
              </React.Fragment>
            ))}
          </>
        )}
      </div>
    </div>
  );
}

/**
 * El destino acercándose por el centro de la calzada. Va en espacio de
 * pantalla y se coloca con project(): probado sobre el plano con
 * preserve-3d, el navegador lo escalaba 2,5 veces más de lo que dice la
 * geometría y el cartel tapaba la calzada entera. Con la proyección a mano
 * el tamaño es exactamente el que se calcula. Solo transform y opacity.
 */
export function DestinationApproach({ m, trip, progress }: { m: PlaneMetrics; trip: Trip; progress: number }) {
  // llega rápido y frena, como el taxi
  const p = Math.min(1, Math.max(0, progress));
  const e = 1 - Math.pow(1 - p, 3);
  const { k, y } = project(m, m.planeH * 0.64 * e);
  const w = 96;
  return (
    <div
      data-testid="destination"
      aria-hidden
      className="pointer-events-none absolute left-0 top-0 flex flex-col items-center"
      style={{
        width: w,
        transform: `translate(${m.sceneW / 2}px, ${y}px) translate(-50%, -100%) scale(${k})`,
        transformOrigin: "bottom center",
        opacity: Math.min(1, 0.4 + e),
      }}
    >
      {/* El letrero lleva el nombre como TEXTO de marca: el arte se genera con
          el cartel en blanco. */}
      <div
        className="mb-1 rounded-md px-2 py-0.5 font-display text-[10px] font-extrabold tracking-wider"
        style={{ background: SIGN_FACE, color: "var(--accent)", border: `2px solid ${INK}`, boxShadow: `0 2px 0 ${INK}` }}
      >
        {trip.destination.sign}
      </div>
      <DestinationArt trip={trip} width={w} />
    </div>
  );
}

// ── Burbuja de reacción de Doty ──────────────────────────────────────────────

/**
 * La cara de Doty cuando pasa algo: acierto, bache, llegada, avería. Sale del
 * techo del taxi como un bocadillo; se remonta por key para volver a saltar.
 * Tamaño constante: va fuera del wrapper de escala del taxi.
 */
export function ReactionBubble({ pose, style }: { pose: DotyPose; style?: React.CSSProperties }) {
  return (
    <div
      data-testid="reaction"
      aria-hidden
      className="pointer-events-none absolute flex items-center justify-center rounded-2xl"
      style={{
        width: 58,
        height: 58,
        background: SIGN_FACE,
        border: `2.5px solid ${INK}`,
        boxShadow: `0 3px 0 ${INK}`,
        animation: "dotaxi-bubble-in 0.25s var(--ease-out-strong) both",
        ...style,
      }}
    >
      {/* Recorte a la cara: el sprite es de cuerpo entero y aquí interesa la
          expresión, así que se amplía anclado arriba y las piernas quedan
          fuera del marco. El marco es un hijo con overflow hidden para que la
          cola de abajo no se recorte. */}
      <div className="absolute overflow-hidden rounded-xl" style={{ inset: 3 }}>
        <div
          className="absolute"
          style={{ left: "50%", top: -3, transform: "translateX(-50%) scale(2.35)", transformOrigin: "top center" }}
        >
          <Doty pose={pose} size="micro" />
        </div>
      </div>
      {/* cola hacia el techo */}
      <div
        aria-hidden
        className="absolute"
        style={{ left: 8, bottom: -8, width: 12, height: 12, background: SIGN_FACE, borderLeft: `2.5px solid ${INK}`, borderBottom: `2.5px solid ${INK}`, transform: "rotate(-45deg)" }}
      />
    </div>
  );
}

// ── Pasajero, bocadillo, polvo ───────────────────────────────────────────────

export function Passenger({
  trip,
  size,
  eager = false,
  className,
  style,
}: {
  trip: Trip;
  size: number;
  /** sin carga diferida: el de la recogida tiene que estar en el primer frame */
  eager?: boolean;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <Image
      src={`/images/avatars/${trip.avatar}.png`}
      alt={trip.name}
      width={512}
      height={512}
      sizes={`${size}px`}
      priority={eager}
      className={`dots-floor-shadow h-auto select-none object-contain ${className ?? ""}`}
      style={{ width: size, ...style }}
      draggable={false}
    />
  );
}

export function SpeechBubble({ text, style }: { text: string; style?: React.CSSProperties }) {
  return (
    <div
      data-testid="bubble"
      className="pointer-events-none absolute rounded-2xl px-3 py-2 font-display text-[13px] font-extrabold leading-snug"
      style={{
        background: SIGN_FACE,
        color: INK,
        border: `2px solid ${INK}`,
        boxShadow: `0 3px 0 ${INK}`,
        animation: "dotaxi-bubble-in 0.3s var(--ease-out-strong) both",
        ...style,
      }}
    >
      {text}
      <div
        aria-hidden
        className="absolute"
        style={{ left: 14, bottom: -7, width: 12, height: 12, background: SIGN_FACE, borderRight: `2px solid ${INK}`, borderBottom: `2px solid ${INK}`, transform: "rotate(45deg)" }}
      />
    </div>
  );
}

/** Tres motas de polvo al golpe del bache. Se remonta por key para repetirse. */
export function Dust() {
  return (
    <>
      {[-26, 0, 26].map((dx, i) => (
        <div
          key={i}
          aria-hidden
          className="pointer-events-none absolute rounded-full"
          style={{
            left: TAXI_W / 2 - 5 + dx * 0.4,
            bottom: 6,
            width: 10,
            height: 10,
            background: "rgba(220,214,230,0.9)",
            ["--dx" as string]: `${dx}px`,
            animation: `dotaxi-dust 520ms ease-out ${i * 40}ms both`,
          }}
        />
      ))}
    </>
  );
}
