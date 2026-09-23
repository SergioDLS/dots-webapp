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

/** Sprite por escalón de daño: 0 intacto … 5 destruido. */
const TAXI_SPRITES: Record<Damage, string> = {
  0: "dotaxi-taxi",
  1: "dotaxi-taxi-d1",
  2: "dotaxi-taxi-d2",
  3: "dotaxi-taxi-d3",
  4: "dotaxi-taxi-d4",
  5: "dotaxi-taxi-wrecked",
};

// ── Cielo y skyline ──────────────────────────────────────────────────────────

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
      {/* skyline: dos franjas 3:1 (dotaxi-skyline-dia / -noche) con fundido por
          --dotaxi-night. El pipeline las deja centradas en un lienzo cuadrado:
          la franja ocupa de 0,395 a 0,604 del alto, y se coloca para que su
          pie caiga en el horizonte. */}
      {(["dia", "noche"] as const).map((v) => (
        <Image
          key={v}
          src={`/images/games/dotaxi-skyline-${v}.png`}
          alt=""
          aria-hidden
          width={1536}
          height={1536}
          sizes="420px"
          priority
          draggable={false}
          className="absolute select-none"
          style={{
            left: "50%",
            width: m.sceneW * 1.04,
            height: m.sceneW * 1.04,
            top: skyH - m.sceneW * 1.04 * 0.604,
            transform: "translateX(-50%)",
            opacity: v === "noche" ? "var(--dotaxi-night)" : "calc(1 - var(--dotaxi-night))",
          }}
        />
      ))}
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
        style={{
          left: m.curbW,
          width: m.roadW,
          // más oscuro hacia el horizonte: la distancia se lee también en el tono
          background: `linear-gradient(to top, ${ASPHALT} 0%, #2a2842 55%, #201e35 100%)`,
        }}
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
          {/* carrocería: un sprite por escalón de daño (dotaxi-taxi, -d1..-d4,
              -wrecked). El lienzo es cuadrado de 512 con el taxi ocupando de
              y=40 a y=469: se pinta a TAXI_W y se baja para que las ruedas
              apoyen en el pie del wrapper. */}
          <Image
            src={`/images/games/${TAXI_SPRITES[damage]}.png`}
            alt=""
            aria-hidden
            width={512}
            height={512}
            sizes={`${TAXI_W * 2}px`}
            priority
            draggable={false}
            className="absolute select-none"
            style={{ left: 0, bottom: -10, width: TAXI_W, height: TAXI_W }}
          />
          {/* luneta: se ve la NUCA de Doty al volante, con la gorra. Su cara va
              en la burbuja de reacción, que es donde una expresión se lee
              desde atrás. Coordenadas sobre el sprite: ventana ≈ x 32-96, y 32-58. */}
          {/* Desde atrás, de Doty se ve la gorra y tres púas del penacho que
              asoman por debajo. Una cabeza redonda entera parecía una pelota. */}
          <div className="absolute" style={{ left: 38, top: 33, width: 28, height: 22 }}>
            {[-2, 8, 18].map((x, i) => (
              <div
                key={x}
                className="absolute"
                style={{
                  left: x, top: 9 + (i === 1 ? -2 : 0), width: 8, height: 12,
                  background: "#ff1f8f", border: `1.5px solid ${INK}`,
                  borderRadius: "2px 2px 6px 6px",
                  transform: `rotate(${(i - 1) * 22}deg)`,
                  transformOrigin: "top center",
                }}
              />
            ))}
            <div className="absolute rounded-t-full" style={{ left: 0, top: 0, width: 28, height: 11, background: TAXI_YELLOW, border: `1.5px solid ${INK}` }} />
            <div className="absolute rounded-full" style={{ left: -2, top: 9, width: 32, height: 4, background: "#35d8f5", border: `1px solid ${INK}` }} />
          </div>
          {/* pilotos encendidos al frenar: sobre los del sprite (x≈24 y 102, y≈74) */}
          {[24, 102].map((cx, i) => (
            <div
              key={i}
              aria-hidden
              className="absolute rounded-full"
              style={{
                left: cx - 9, top: 68, width: 18, height: 12,
                background: BRAKE_RED,
                boxShadow: `0 0 10px ${BRAKE_RED}, 0 0 22px ${BRAKE_RED}`,
                opacity: braking && !(i === 0 && damage >= 3) ? 0.95 : 0,
                transition: "opacity 150ms",
              }}
            />
          ))}
          {/* humo animado solo en el destrozado: d3 y d4 ya traen su bocanada
              pintada en el sprite, y dos humos no suman, ensucian */}
          {wrecked &&
            Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                aria-hidden
                className="absolute rounded-full"
                style={{
                  top: -14 - (i % 2) * 6,
                  left: 70 + i * 10,
                  width: 20,
                  height: 20,
                  background: "rgba(205,205,220,0.85)",
                  animation: `dotaxi-smoke 1.4s ease-out ${i * 0.3}s infinite`,
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
        left: x - 22,
        top: -22,
        width: 44,
        height: 44,
        ["--to" as string]: `${to}px`,
        animation: `dotaxi-approach ${durationMs}ms linear both`,
      }}
    >
      {/* El sprite trae un disco gris alrededor del agujero que sobre el
          asfalto se lee como una tapa de alcantarilla. Una máscara radial
          conserva la grieta y funde el disco con la calzada. */}
      <Image
        src="/images/games/dotaxi-pothole.png"
        alt=""
        aria-hidden
        width={512}
        height={512}
        sizes="120px"
        priority
        draggable={false}
        className="absolute inset-0 h-full w-full select-none"
        style={{
          maskImage: "radial-gradient(circle at 50% 50%, #000 30%, rgba(0,0,0,0.55) 40%, transparent 52%)",
          WebkitMaskImage: "radial-gradient(circle at 50% 50%, #000 30%, rgba(0,0,0,0.55) 40%, transparent 52%)",
        }}
      />
    </div>
  );
}

// ── Destino ──────────────────────────────────────────────────────────────────

/** El edificio de cada destino (dotaxi-puerto / -laboratorio / -estadio). */
export function DestinationArt({ trip, width }: { trip: Trip; width: number }) {
  return (
    <Image
      src={`/images/games/dotaxi-${trip.destination.key}.png`}
      alt=""
      aria-hidden
      width={512}
      height={512}
      sizes={`${Math.round(width * 2)}px`}
      priority
      draggable={false}
      className="h-auto select-none object-contain"
      style={{ width }}
    />
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
          style={{ left: "50%", top: -24, transform: "translateX(-50%) scale(3.3)", transformOrigin: "top center" }}
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
