"use client";

import React from "react";
import Image from "next/image";
import Doty, { type DotyPose } from "@/components/ui/doty/doty";
import { Icon } from "@/components/ui/icon";
import { laneGeometry } from "./lanes";
import {
  PERSPECTIVE,
  laneXAt,
  laneXAtScale,
  edgeXAt,
  SIDEWALK_BOTTOM_PX,
  travel,
  TRAVEL_END,
  type PlaneMetrics,
} from "./perspective";
import type { DestinationKey, Trip } from "./trip";

// ── Paleta fija de la escena ─────────────────────────────────────────────────
// Solo el cielo (tokens --sky-*) y las ventanas del skyline (--dotaxi-night)
// cambian con el tema. Una carretera no es una tarjeta de la app: con
// --surface el asfalto salía casi blanco en tema claro y las rayas morían.
export const ASPHALT = "#34314f";
export const ASPHALT_EDGE = "#1e1b5c";
export const CURB = "#d9d4e6";
export const SIDEWALK = "#b7b1cc";
export const SIDEWALK_LINE = "rgba(30, 27, 92, 0.28)";
export const LANE_PAINT = "#f4f1e4";
export const EDGE_PAINT = "#ffd21e";
export const TAXI_YELLOW = "#ffd21e";
export const TAXI_YELLOW_DEEP = "#f7b500";
export const INK = "#1e1b5c";
export const BRAKE_RED = "#ff3b5c";
export const BRAKE_DIM = "#b3122e";
export const PANEL_BLUE = "#3768ff";
export const SIGN_FACE = "#f7f4ea";
export const TURN_AMBER = "#ffb020";

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

/** Ancho del skyline respecto a la escena: sobresale por los lados y sus
 *  edificios llegan más alto (Sergio lo subió un 10 % desde 1,04). */
const SKYLINE_W = 1.144;

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
      {/* sol de día / luna de noche: el mismo disco, dos opacidades complementarias.
          El sol lleva detrás un abanico de rayos que gira despacio. */}
      <div
        className="absolute rounded-full"
        style={{
          top: skyH * 0.52 - 30, right: 22 - 30, width: 90, height: 90,
          background: `repeating-conic-gradient(from 0deg, ${TAXI_YELLOW}55 0deg 14deg, transparent 14deg 30deg)`,
          maskImage: "radial-gradient(circle, black 30%, transparent 72%)",
          WebkitMaskImage: "radial-gradient(circle, black 30%, transparent 72%)",
          opacity: "calc(1 - var(--dotaxi-night))",
          animation: "dotaxi-spin 48s linear infinite",
        }}
      />
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
      {/* estrellas: la noche la pone el padre; cada una parpadea a su ritmo */}
      <div className="absolute inset-0" style={{ opacity: "var(--dotaxi-night)" }}>
        {STARS.map(([x, y], i) => (
          <div
            key={i}
            className="absolute rounded-full"
            style={{
              left: `${x}%`, top: `${y}%`, width: 2 + (i % 2), height: 2 + (i % 2),
              background: SIGN_FACE,
              animation: `dotaxi-twinkle ${2.2 + (i % 3) * 0.5}s ease-in-out ${-(i * 0.37)}s infinite`,
            }}
          />
        ))}
      </div>
      <Birds skyH={skyH} sceneW={m.sceneW} yFrac={0.3} scale={1} dur={26} delay={4} />
      <Birds skyH={skyH} sceneW={m.sceneW} yFrac={0.18} scale={0.7} dur={37} delay={19} />
      <Plane skyH={skyH} sceneW={m.sceneW} />
      {/* skyline: dos franjas 3:1 (dotaxi-skyline-dia / -noche) con fundido por
          --dotaxi-night. El pipeline las deja centradas en un lienzo cuadrado:
          la franja ocupa de 0,395 a 0,604 del alto, y se coloca para que su
          pie caiga en el horizonte. Se pinta a SKYLINE_W anchos de escena. */}
      {(["dia", "noche"] as const).map((v) => (
        <Image
          key={v}
          src={`/images/games/dotaxi-skyline-${v}.png`}
          alt=""
          aria-hidden
          width={1536}
          height={1536}
          sizes="480px"
          priority
          draggable={false}
          className="absolute select-none"
          style={{
            left: "50%",
            width: m.sceneW * SKYLINE_W,
            height: m.sceneW * SKYLINE_W,
            top: skyH - m.sceneW * SKYLINE_W * 0.604,
            transform: "translateX(-50%)",
            opacity: v === "noche" ? "var(--dotaxi-night)" : "calc(1 - var(--dotaxi-night))",
          }}
        />
      ))}
    </div>
  );
}

/** Una bandada de tres pájaros en V cruzando el cielo de derecha a izquierda;
 *  el resto del ciclo se queda fuera de escena, así no parece un carrusel. */
function Birds({ skyH, sceneW, yFrac, scale, dur, delay }: {
  skyH: number; sceneW: number; yFrac: number; scale: number; dur: number; delay: number;
}) {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute left-0"
      style={{
        top: skyH * yFrac,
        width: 60,
        height: 20,
        ["--from" as string]: `${sceneW + 40}px`,
        ["--to" as string]: "-100px",
        animation: `dotaxi-birds ${dur}s linear ${delay}s infinite`,
        // de noche son siluetas apenas visibles
        opacity: "calc(1 - 0.6 * var(--dotaxi-night))",
      }}
    >
      <div style={{ transform: `scale(${scale})`, transformOrigin: "left top" }}>
        {([[0, 6], [18, 0], [36, 9]] as const).map(([x, y], i) => (
          <div
            key={i}
            className="absolute"
            style={{ left: x, top: y, width: 15, height: 8, animation: `dotaxi-flap 0.5s ease-in-out ${i * 0.12}s infinite` }}
          >
            <div className="absolute" style={{ left: 0, top: 3, width: 8, height: 2, background: INK, borderRadius: 1, transform: "rotate(-28deg)", transformOrigin: "right center" }} />
            <div className="absolute" style={{ left: 7, top: 3, width: 8, height: 2, background: INK, borderRadius: 1, transform: "rotate(28deg)", transformOrigin: "left center" }} />
          </div>
        ))}
      </div>
    </div>
  );
}

/** Ancho del lienzo de la avioneta en pantalla; la franja 3:1 ocupa de 0,44 a
 *  0,56 del alto y el cartel va de 0,34 a 0,96 del ancho (medido en el PNG). */
const PLANE_W = 230;

/**
 * La avioneta con cartel (dotaxi-avioneta) cruza el cielo de derecha a
 * izquierda cada minuto y luego descansa fuera de escena. El cartel se genera
 * vacío y el «DOTS» va como texto encima, igual que los letreros del destino.
 */
function Plane({ skyH, sceneW }: { skyH: number; sceneW: number }) {
  const W = PLANE_W;
  return (
    <div
      aria-hidden
      data-testid="plane-banner"
      className="pointer-events-none absolute left-0"
      style={{
        top: skyH * 0.12 - W * 0.44,
        width: W,
        height: W,
        ["--from" as string]: `${sceneW + 30}px`,
        ["--to" as string]: `${-W - 30}px`,
        // arranca ya a la vista: la primera partida también tiene su avioneta
        animation: "dotaxi-birds 60s linear -7s infinite",
        opacity: "calc(1 - 0.35 * var(--dotaxi-night))",
      }}
    >
      <div className="relative h-full w-full" style={{ animation: "dotaxi-float 3.2s ease-in-out infinite" }}>
        <Image
          src="/images/games/dotaxi-avioneta.png"
          alt=""
          aria-hidden
          width={1536}
          height={1536}
          sizes={`${W * 2}px`}
          draggable={false}
          className="absolute inset-0 h-full w-full select-none"
        />
        <div
          className="absolute flex items-center justify-center font-display font-extrabold tracking-[0.18em]"
          style={{ left: W * 0.35, width: W * 0.6, top: W * 0.445, height: W * 0.115, fontSize: W * 0.075, color: INK }}
        >
          DOTS
        </div>
      </div>
    </div>
  );
}

// ── El plano de suelo ────────────────────────────────────────────────────────

/**
 * El plano se dibuja PLANE_RASTER veces más grande y se encoge con
 * scale(1/R) dentro del mismo transform: la geometría es la misma, pero la
 * textura tiene R veces más píxeles. Con perspectiva el navegador rasteriza la
 * capa a su tamaño CSS y luego la estira hasta kBottom (8) veces en el borde
 * cercano: rayas, bordillos y el césped salían borrosos.
 */
const PLANE_RASTER = 4;

export function GroundPlane({
  m,
  dist,
  lanes,
  children,
}: {
  m: PlaneMetrics;
  /** distancia recorrida en unidades de plano (no cíclica); cada capa toma su módulo */
  dist: number;
  lanes: number;
  children?: React.ReactNode;
}) {
  const R = PLANE_RASTER;
  const { centersPct, widthPct } = laneGeometry(lanes);
  const boundaries = centersPct.slice(1).map((c) => c - widthPct / 2);
  // Todo lo que corre con la carretera es una tira alta que se desplaza en
  // unidades de plano (translateY); la perspectiva del padre la acorta hacia
  // el horizonte. Nunca background-position. Los periodos son cortos porque en
  // el borde cercano se multiplican por kBottom. Todo en unidades de plano × R.
  const scroll = (period: number) => ({
    top: -period * R,
    height: `calc(100% + ${period * 2 * R}px)`,
    transform: `translateY(${(dist % period) * R}px)`,
  });
  const stripes = (a: string, b: string, on: number, period: number) =>
    `repeating-linear-gradient(to bottom, ${a} 0 ${on * R}px, ${b} ${on * R}px ${period * R}px)`;
  return (
    <div
      data-testid="plane"
      aria-hidden={false}
      className="absolute"
      style={{
        top: m.horizonY,
        left: (m.sceneW - m.groundW * R) / 2,
        width: m.groundW * R,
        height: m.planeH * R,
        transformOrigin: "top center",
        transform: `perspective(${PERSPECTIVE}px) rotateX(${m.thetaDeg}deg) scale(${1 / R})`,
        // césped teñido por el cielo: de día verde, de noche verde oscuro
        background: "color-mix(in srgb, var(--sky-bottom) 28%, #2f7a4f)",
        borderTop: `${2 * R}px solid color-mix(in srgb, var(--sky-bottom) 20%, #1f4f36)`,
        overflow: "hidden",
      }}
    >
      {/* franjas de césped */}
      <div
        className="absolute inset-x-0"
        style={{ ...scroll(60), backgroundImage: stripes("rgba(255,255,255,0.07)", "transparent", 26, 60) }}
      />
      {/* aceras pavimentadas, con las juntas de las baldosas en movimiento */}
      {[m.groundMargin, m.groundMargin + m.sidewalkW + 2 * m.curbW + m.roadW].map((left, i) => (
        <div
          key={`sw-${i}`}
          className="absolute inset-y-0 overflow-hidden"
          style={{ left: left * R, width: m.sidewalkW * R, background: `color-mix(in srgb, var(--sky-bottom) 16%, ${SIDEWALK})` }}
        >
          <div className="absolute inset-x-0" style={{ ...scroll(40), backgroundImage: stripes(SIDEWALK_LINE, "transparent", 1.4, 40) }} />
          {/* junta longitudinal, a un tercio del bordillo */}
          <div className="absolute inset-y-0" style={{ [i === 0 ? "right" : "left"]: m.sidewalkW * R * 0.34, width: 1.2 * R, background: SIDEWALK_LINE }} />
        </div>
      ))}
      {/* bordillos rojo-blanco tipo circuito, en movimiento */}
      {[m.groundMargin + m.sidewalkW, m.groundMargin + m.sidewalkW + m.curbW + m.roadW].map((left, i) => (
        <div key={i} className="absolute inset-y-0 overflow-hidden" style={{ left: left * R, width: m.curbW * R, background: CURB }}>
          <div className="absolute inset-x-0" style={{ ...scroll(24), backgroundImage: stripes(BRAKE_RED, SIGN_FACE, 12, 24) }} />
        </div>
      ))}
      {/* calzada */}
      <div
        className="absolute inset-y-0 overflow-hidden"
        style={{
          left: (m.groundMargin + m.sidewalkW + m.curbW) * R,
          width: m.roadW * R,
          // más oscuro hacia el horizonte: la distancia se lee también en el tono
          background: `linear-gradient(to top, ${ASPHALT} 0%, #2a2842 55%, #201e35 100%)`,
        }}
      >
        {boundaries.map((pct, i) => (
          <div
            key={i}
            className="absolute inset-y-0"
            style={{
              left: `${pct}%`,
              width: 1.6 * R,
              transform: "translateX(-50%)",
              transition: "left 450ms var(--ease-out-strong)",
            }}
          >
            <div className="absolute inset-x-0" style={{ ...scroll(28), backgroundImage: stripes(LANE_PAINT, "transparent", 10, 28) }} />
          </div>
        ))}
        {/* arcenes continuos */}
        <div className="absolute inset-y-0" style={{ left: 1 * R, width: 1.4 * R, background: EDGE_PAINT }} />
        <div className="absolute inset-y-0" style={{ right: 1 * R, width: 1.4 * R, background: EDGE_PAINT }} />
      </div>
      {children}
    </div>
  );
}

/**
 * Neblina en el horizonte: la calzada y el césped se funden con el cielo en
 * vez de acabar en una línea recta. Es la perspectiva atmosférica de toda la
 * vida y lo que hace que la vía "se pierda" a lo lejos.
 */
export function HorizonHaze({ m }: { m: PlaneMetrics }) {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-x-0"
      style={{
        top: m.horizonY - 2,
        height: Math.max(36, m.sceneH * 0.09),
        background: "linear-gradient(to bottom, var(--sky-bottom) 0%, color-mix(in srgb, var(--sky-bottom) 70%, transparent) 35%, transparent 100%)",
      }}
    />
  );
}

// ── Palabras flotantes (la firma) ───────────────────────────────────────────

/** Escala relativa (k/kBottom) a la que las palabras quedan flotando: cerca
 *  para leerse, lejos para que los carriles aún converjan bajo ellas. */
const WORD_REST_R = 0.6;
/** Altura de reposo como fracción del alto de la escena. Con 2 carriles una
 *  sola (o dos en zigzag si alguna opción es una frase); con 3–4, UNA FILA
 *  POR CARRIL en escalera entre WORD_Y_TOP y WORD_Y_BOTTOM: así ninguna
 *  palabra puede pisar a otra y todas van al mismo tamaño sin encoger. */
const WORD_Y_SINGLE = 0.33;
const WORD_Y_HIGH = 0.25;
const WORD_Y_LOW = 0.4;
const WORD_Y_TOP = 0.16;
const WORD_Y_BOTTOM = 0.47;
/** Cuánto crecen al atravesarlas respecto al reposo. */
const WORD_EXIT_GROWTH = 2.2;

/**
 * Las opciones flotan sobre su carril como texto suelto: blanco con contorno
 * navy, el carril elegido en amarillo taxi. Nacen en el punto de fuga y crecen
 * hasta su sitio (`approach` 0→1: hasta entonces no se puede tocar ni corre el
 * reloj); al confirmar el taxi las atraviesa (`exit` 0→1): la correcta en
 * verde, las otras en rojo y tachadas, y todas se van por arriba y los lados.
 * Todo por escala desde el punto de fuga: un objeto quieto en el mundo se
 * aleja del punto de fuga en proporción a su escala. Con 3–4 carriles cada
 * palabra tiene su fila (escalera): con dos alturas compartidas se solapaban.
 */
export function FloatingWords({
  m,
  options,
  lane,
  outcome,
  correct,
  onPick,
  approach,
  exit,
}: {
  m: PlaneMetrics;
  options: readonly string[];
  lane: number;
  outcome: "none" | "clear" | "crash";
  correct: string | undefined;
  onPick: (i: number) => void;
  /** 0 en el horizonte … 1 en reposo */
  approach: number;
  /** 0 en reposo … 1 ya atravesadas */
  exit: number;
}) {
  const lanes = Math.max(1, options.length);
  const { centersPct } = laneGeometry(lanes);
  const vpX = m.sceneW / 2;
  const vpY = m.horizonY;
  const a = Math.min(1, Math.max(0, approach));
  const ea = 1 - Math.pow(1 - a, 3);
  const x = Math.min(1, Math.max(0, exit));
  const ex = x * x; // acelera al pasar
  const g = x > 0 ? 1 + WORD_EXIT_GROWTH * ex : 0.12 + 0.88 * ea;
  // Con 3–4 carriles cada palabra tiene su fila entera: una sola línea, al
  // ancho que haga falta, a 20 px.
  const staircase = lanes >= 3;
  const fontPx = staircase ? 20 : 22;
  const spacing = (m.roadBottomW / lanes) * WORD_REST_R;
  // Con 2 carriles, zigzag si alguna opción es una frase: «Like many others»
  // a 22 px mide más que su carril y pisaba a la vecina.
  const zigzag = !staircase && options.some((o) => o.length > 9);
  // Con 2 carriles una frase larga se parte en dos líneas antes de medir más
  // de media escena. En todos los casos el centro de cada palabra se acota
  // para que no se corte contra el marco mientras flota (el carril del borde
  // cae en parte fuera).
  const maxW = staircase ? m.sceneW - 12 : Math.min(Math.max(80, spacing * 2 - 6), m.sceneW * 0.55);
  return (
    <>
      {options.map((opt, i) => {
        const restX = laneXAtScale(m, centersPct[i] ?? 50, WORD_REST_R);
        const yFrac = staircase
          ? WORD_Y_TOP + (i * (WORD_Y_BOTTOM - WORD_Y_TOP)) / (lanes - 1)
          : !zigzag
            ? WORD_Y_SINGLE
            : i % 2 === 0
              ? WORD_Y_LOW
              : WORD_Y_HIGH;
        const restY = m.sceneH * yFrac;
        // una opción kilométrica («I'm looking forward to getting to know you
        // all») no cabe ni en una fila entera: baja de tamaño y se parte
        const huge = opt.length > 26;
        const size = huge ? fontPx - 4 : opt.length >= 9 ? fontPx - 2 : fontPx;
        const estW = Math.min(maxW, opt.length * size * 0.58 + 20);
        const clampedRestX = Math.min(Math.max(restX, estW / 2 + 6), m.sceneW - estW / 2 - 6);
        const cx = vpX + ((x > 0 ? restX : clampedRestX) - vpX) * g;
        const cy = vpY + (restY - vpY) * g;
        const isClear = outcome !== "none" && opt === correct;
        const isBlocked = outcome !== "none" && !isClear;
        const active = outcome === "none" && lane === i;
        const color = isClear ? "var(--success)" : isBlocked ? "var(--danger)" : active ? TAXI_YELLOW : SIGN_FACE;
        return (
          <div
            key={`${i}-${opt}`}
            data-testid={`word-${i}`}
            className="absolute left-0 top-0"
            style={{
              transform: `translate(${cx}px, ${cy}px) translate(-50%, -50%) scale(${g * (active ? 1.12 : 1)})`,
              opacity: x > 0 ? 1 - Math.max(0, (x - 0.55) / 0.45) : 0.3 + 0.7 * ea,
              pointerEvents: a >= 1 && outcome === "none" ? "auto" : "none",
            }}
          >
            <div style={{ animation: `dotaxi-float 2.4s ease-in-out ${-(i * 0.55)}s infinite` }}>
              <button
                type="button"
                data-testid={`lane-${i}`}
                onPointerUp={() => onPick(i)}
                className="flex items-center justify-center gap-1 px-2 py-1.5 text-center font-display font-extrabold leading-none"
                style={{
                  minWidth: 44,
                  minHeight: 36,
                  maxWidth: maxW,
                  fontSize: size,
                  color,
                  WebkitTextStroke: `5px ${INK}`,
                  paintOrder: "stroke fill",
                  // relieve + halo oscuro suave: se lee sobre nubes y skyline
                  textShadow: `0 3px 0 ${INK}, 0 0 4px rgba(30, 27, 92, 0.9), 0 0 18px rgba(30, 27, 92, 0.8), 0 6px 12px rgba(30, 27, 92, 0.45)`,
                  letterSpacing: "0.01em",
                  textDecoration: isBlocked ? "line-through" : "none",
                  textDecorationThickness: 3,
                  whiteSpace: huge || (!staircase && opt.length > 12) ? "normal" : "nowrap",
                  touchAction: "manipulation",
                  transition: "color 0.2s",
                }}
              >
                {isClear && <Icon name="check" size={18} mono />}
                {isBlocked && <Icon name="cruz" size={18} mono />}
                <span>{opt}</span>
              </button>
            </div>
          </div>
        );
      })}
    </>
  );
}

// ── Taxi trasero ─────────────────────────────────────────────────────────────

/**
 * El taxi visto por detrás, un sprite por escalón de daño. Encima van las
 * capas vivas: intermitente al cambiar de carril, pilotos al frenar y el humo
 * del destrozado. La luneta va vacía y no hay cono de faros: probado, se veía
 * mal (un trapecio pálido sobre el asfalto) y Sergio lo quitó.
 */
export function TaxiRear({
  damage,
  braking,
  crashing,
  speed = 1,
  signal = 0,
}: {
  damage: Damage;
  /** pilotos encendidos + hundimiento del morro */
  braking: boolean;
  /** temblor del golpe */
  crashing: boolean;
  /** 1 en crucero, hasta ~1,6 con racha: acorta el vaivén del motor */
  speed?: number;
  /** intermitente: −1 izquierda, 1 derecha, 0 apagado */
  signal?: -1 | 0 | 1;
}) {
  const wrecked = damage >= 5;
  return (
    <div
      className="relative"
      style={{
        width: TAXI_W,
        height: TAXI_H,
        animation: crashing
          ? "dotaxi-shake 0.5s ease-in-out"
          : `dotaxi-bob ${(0.8 / Math.max(1, speed)).toFixed(2)}s ease-in-out infinite`,
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
              -wrecked). Lienzo cuadrado de 1024 con el taxi de y=0,08 a 0,92:
              se pinta a TAXI_W y se baja para que las ruedas apoyen en el pie
              del wrapper. */}
          <Image
            src={`/images/games/${TAXI_SPRITES[damage]}.png`}
            alt=""
            aria-hidden
            width={1024}
            height={1024}
            sizes={`${TAXI_W * 3}px`}
            priority
            draggable={false}
            className="absolute select-none"
            style={{ left: 0, bottom: -10, width: TAXI_W, height: TAXI_W }}
          />
          {/* La luneta va vacía: la nuca con gorra en CSS parecía una pelota
              y Sergio la sacó. La cara de Doty vive en la burbuja de reacción. */}
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
          {/* intermitente del lado hacia el que gira */}
          {signal !== 0 && (
            <div
              aria-hidden
              data-testid="signal"
              className="absolute rounded-full"
              style={{
                left: (signal < 0 ? 24 : 102) - 9, top: 66, width: 18, height: 12,
                background: TURN_AMBER,
                boxShadow: `0 0 10px ${TURN_AMBER}, 0 0 20px ${TURN_AMBER}`,
                animation: "dotaxi-blink 0.4s linear infinite",
              }}
            />
          )}
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

// ── Laterales: farolas y árboles que se acercan ─────────────────────────────

/** Altura de cada sprite al llegar al borde cercano, en altos de escena
 *  (Sergio los fue bajando desde 1,45/1,25 hasta verlos en proporción). */
const LAMP_H_FRAC = 0.98;
const TREE_H_FRAC = 0.9;
const ROADSIDE_SLOTS = 8;
/** La farola planta el poste sobre la acera, a esta distancia del bordillo
 *  (px del borde cercano): separada de la calle, como pidió Sergio. */
const LAMP_OFFSET_PX = 51;
/** La farola se estrecha un poco (poste y cabeza): a tamaño natural pesaba. */
const LAMP_SQUEEZE = 0.9;
/** El árbol arranca en la mitad exterior de la acera (alcorque): detrás de la
 *  acera entera quedaba tan lejos que solo se veía en el horizonte. */
const TREE_OFFSET_PX = SIDEWALK_BOTTOM_PX * 0.55;
/** Aire transparente del lienzo del árbol a cada lado de la copa (fracción del lado). */
const TREE_INSET = 0.12;

/** Farola o árbol (dotaxi-farola / dotaxi-arbol) a 1024: de cerca ocupan más
 *  que la escena y a 512 se veían borrosos. De noche la farola suma su halo. */
function RoadsideArt({ kind, size }: { kind: "farola" | "arbol"; size: number }) {
  return (
    <div className="relative" style={{ width: size, height: size }}>
      {kind === "farola" && (
        <div
          aria-hidden
          className="absolute rounded-full"
          style={{
            left: size * 0.26, top: -size * 0.06, width: size * 0.48, height: size * 0.48,
            background: `radial-gradient(circle, ${TAXI_YELLOW}80, transparent 70%)`,
            opacity: "var(--dotaxi-night)",
          }}
        />
      )}
      <Image
        src={`/images/games/dotaxi-${kind}.png`}
        alt=""
        aria-hidden
        width={1024}
        height={1024}
        sizes="min(100vw, 640px)"
        draggable={false}
        className="absolute inset-0 h-full w-full select-none"
        style={kind === "farola" ? { transform: `scaleX(${LAMP_SQUEEZE})`, transformOrigin: "bottom center" } : undefined}
      />
    </div>
  );
}

/**
 * Farolas y árboles alternando a ambos lados, en ciclo: nacen en el punto de
 * fuga y crecen al acercarse, a la misma velocidad que las rayas (misma
 * `dist`). Van en espacio de pantalla con travel(): son los que venden el
 * avance, más que las rayas. La farola se ancla por el poste, sobre la acera;
 * el árbol por su borde interior en el césped de detrás, así la copa crece
 * hacia fuera y nunca tapa la calzada.
 */
export function Roadside({ m, dist }: { m: PlaneMetrics; dist: number }) {
  const cycle = m.planeH * TRAVEL_END;
  const lampH = m.sceneH * LAMP_H_FRAC;
  const treeH = m.sceneH * TREE_H_FRAC;
  return (
    <>
      {Array.from({ length: ROADSIDE_SLOTS }).map((_, i) => {
        const side: -1 | 1 = i % 2 === 0 ? -1 : 1;
        const kind = (i >> 1) % 2 === 0 ? "farola" : "arbol";
        const p = ((((dist + (i * cycle) / ROADSIDE_SLOTS) % cycle) + cycle) % cycle) / m.planeH;
        if (p > TRAVEL_END) return null;
        const { y, k, s } = travel(m, p);
        const scale = k / m.kBottom;
        const size = kind === "farola" ? lampH : treeH;
        const drawn = size * scale;
        let x: number;
        let anchor: string;
        let origin: string;
        if (kind === "farola") {
          x = edgeXAt(m, side, LAMP_OFFSET_PX, s);
          if (x + drawn / 2 < 0 || x - drawn / 2 > m.sceneW) return null;
          anchor = "translate(-50%, -100%)";
          origin = "bottom center";
        } else {
          x = edgeXAt(m, side, TREE_OFFSET_PX, s) - side * TREE_INSET * drawn;
          if ((side < 0 && x - TREE_INSET * drawn < 0) || (side > 0 && x + TREE_INSET * drawn > m.sceneW)) return null;
          anchor = side < 0 ? "translate(-100%, -100%)" : "translate(0, -100%)";
          origin = side < 0 ? "bottom right" : "bottom left";
        }
        return (
          <div
            key={i}
            aria-hidden
            data-testid={`roadside-${kind}`}
            className="pointer-events-none absolute left-0 top-0"
            style={{
              transform: `translate(${x}px, ${y}px) ${anchor} scale(${scale})`,
              transformOrigin: origin,
              opacity: Math.min(1, 0.25 + p * 3),
            }}
          >
            <RoadsideArt kind={kind} size={size} />
          </div>
        );
      })}
    </>
  );
}

// ── Nubes ─────────────────────────────────────────────────────────────────────

/** Cinco nubes repartidas por todo el cielo. `start` es dónde empieza cada
 *  una su cruce (0 entrando por la izquierda, 1 saliendo): así al abrir la
 *  escena ya están desplegadas y no en fila. Las grandes están más cerca y
 *  cruzan más rápido (parallax). */
const CLOUDS: readonly { w: number; yFrac: number; dur: number; start: number }[] = [
  { w: 132, yFrac: 0.16, dur: 30, start: 0.05 },
  { w: 66, yFrac: 0.08, dur: 54, start: 0.25 },
  { w: 84, yFrac: 0.36, dur: 46, start: 0.42 },
  { w: 110, yFrac: 0.58, dur: 36, start: 0.72 },
  { w: 96, yFrac: 0.46, dur: 40, start: 0.9 },
];

/** Nubes a la deriva de izquierda a derecha (dotaxi-nube). */
export function Clouds({ m }: { m: PlaneMetrics }) {
  const skyH = m.horizonY;
  return (
    <>
      {CLOUDS.map((cl, i) => (
        <div
          key={i}
          aria-hidden
          data-testid="cloud"
          className="pointer-events-none absolute left-0"
          style={{
            top: skyH * cl.yFrac - cl.w * 0.25,
            width: cl.w,
            height: cl.w * 0.5,
            ["--drift" as string]: `${m.sceneW + cl.w * 2}px`,
            animation: `dotaxi-cloud-drift ${cl.dur}s linear ${-(cl.start * cl.dur)}s infinite`,
            opacity: "calc(0.95 - 0.45 * var(--dotaxi-night))",
            willChange: "transform",
          }}
        >
          {/* dotaxi-nube: lienzo cuadrado con la nube en la franja central */}
          <Image
            src="/images/games/dotaxi-nube.png"
            alt=""
            aria-hidden
            width={512}
            height={512}
            sizes={`${cl.w * 2}px`}
            draggable={false}
            className="absolute select-none"
            style={{ left: 0, top: -cl.w * 0.24, width: cl.w, height: cl.w }}
          />
        </div>
      ))}
    </>
  );
}

// ── Obstáculos ────────────────────────────────────────────────────────────────

export const OBSTACLE_KINDS = [
  "cerdito", "tiburon", "banera", "sofa", "piano", "flamenco", "pinguino", "ovni",
] as const;
export type ObstacleKind = (typeof OBSTACLE_KINDS)[number];

/** Ancho en el borde cercano; se divide por kBottom al proyectar. */
const OBSTACLE_W = 120;

/** El sprite de cada obstáculo (dotaxi-obs-<kind>), apoyado en el pie del lienzo. */
function ObstacleArt({ kind }: { kind: ObstacleKind }) {
  return (
    <Image
      src={`/images/games/dotaxi-obs-${kind}.png`}
      alt=""
      aria-hidden
      width={512}
      height={512}
      sizes={`${OBSTACLE_W * 2}px`}
      draggable={false}
      className="select-none"
      style={{ width: OBSTACLE_W, height: OBSTACLE_W }}
    />
  );
}

/**
 * Un obstáculo bajando por su carril: nace en el punto de fuga, crece y pasa
 * de largo hasta salir. `p` lo mueve el ticker (0 horizonte, 1 pie del plano).
 */
export function Obstacle({ m, kind, pct, p }: { m: PlaneMetrics; kind: ObstacleKind; pct: number; p: number }) {
  if (p > TRAVEL_END) return null;
  const { y, k, s } = travel(m, p);
  const x = laneXAt(m, pct, s);
  const scale = k / m.kBottom;
  return (
    <div
      data-testid="obstacle"
      aria-hidden
      className="pointer-events-none absolute left-0 top-0"
      style={{
        transform: `translate(${x}px, ${y}px) translate(-50%, -100%) scale(${scale})`,
        transformOrigin: "bottom center",
        opacity: Math.min(1, 0.3 + p * 3),
      }}
    >
      <ObstacleArt kind={kind} />
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
      width={1024}
      height={1024}
      sizes={`${Math.round(width * 2)}px`}
      priority
      draggable={false}
      className="h-auto select-none object-contain"
      style={{ width }}
    />
  );
}

// ── Llegada: cutscene ────────────────────────────────────────────────────────

/** Dónde empieza y dónde apoya cada edificio dentro de su lienzo cuadrado
 *  (fracciones del alto, medidas en el PNG): así el pie del dibujo cae en la
 *  explanada y el letrero queda justo sobre el tejado. */
const DEST_TOP_FRAC: Record<DestinationKey, number> = { puerto: 0.17, laboratorio: 0.1, estadio: 0.24 };
const DEST_BASE_FRAC: Record<DestinationKey, number> = { puerto: 0.83, laboratorio: 0.9, estadio: 0.76 };
/** Escala final del taxi al frenar en la puerta: la misma que el `to` de
 *  `dotaxi-arrive-drive` en globals.css (la animación manda; esto coloca al
 *  pasajero y las burbujas a su alrededor). */
const ARRIVE_TAXI_SCALE = 0.5;
/** El taxi aparca a la izquierda de la puerta (fracción del ancho): así el
 *  pasajero baja hacia la entrada y su bocadillo crece hacia la derecha sin
 *  chocar con la burbuja de Doty, que queda a la izquierda del techo. */
const ARRIVE_TAXI_X = 0.36;

/** Cielo, astro y dos nubes de las cutscenes (llegada y avería). */
function CutsceneSky({ W, H }: { W: number; H: number }) {
  return (
    <>
      <div className="absolute inset-0" style={{ background: "linear-gradient(180deg, var(--sky-top), var(--sky-bottom))" }} />
      <div className="absolute rounded-full" style={{ top: H * 0.1, right: 26, width: 34, height: 34, background: TAXI_YELLOW, boxShadow: `0 0 20px ${TAXI_YELLOW}`, opacity: "calc(1 - var(--dotaxi-night))" }} />
      <div className="absolute rounded-full" style={{ top: H * 0.1, right: 28, width: 30, height: 30, background: SIGN_FACE, boxShadow: `0 0 14px ${SIGN_FACE}`, opacity: "var(--dotaxi-night)" }} />
      {([[0.06, 0.16, 110], [0.62, 0.3, 84]] as const).map(([xf, yf, w], i) => (
        <div key={i} className="absolute" style={{ left: W * xf, top: H * yf - w * 0.25, width: w, height: w * 0.5, animation: `dotaxi-float ${5 + i}s ease-in-out infinite`, opacity: "calc(0.95 - 0.45 * var(--dotaxi-night))" }}>
          <Image src="/images/games/dotaxi-nube.png" alt="" aria-hidden width={512} height={512} sizes={`${w * 2}px`} draggable={false} className="absolute select-none" style={{ left: 0, top: -w * 0.24, width: w, height: w }} />
        </div>
      ))}
    </>
  );
}

/**
 * La llegada como escena aparte: funde a un cielo limpio con una explanada y
 * el edificio del destino grande y centrado (sin carretera ni skyline: un
 * estadio plantado en mitad de la autopista se veía raro). El taxi entra por
 * abajo y se aleja hacia la puerta encogiéndose, frena con luces y humo, el
 * pasajero baja y agradece y Doty celebra en burbuja. Solo transform/opacity;
 * `progress` (0→1) lo lleva el ticker con la frenada de la carretera.
 */
export function ArrivalCutscene({
  m,
  trip,
  progress,
  passengerOut,
  reaction,
  damage,
  driveMs,
}: {
  m: PlaneMetrics;
  trip: Trip;
  progress: number;
  passengerOut: boolean;
  reaction: DotyPose | null;
  damage: Damage;
  driveMs: number;
}) {
  const W = m.sceneW;
  const H = m.sceneH;
  const groundY = H * 0.7;
  const buildingW = Math.min(W * 0.8, H * 0.62);
  const key = trip.destination.key;
  const buildingTop = groundY - DEST_BASE_FRAC[key] * buildingW;
  const roofY = buildingTop + DEST_TOP_FRAC[key] * buildingW;
  const p = Math.min(1, Math.max(0, progress));
  const parked = p >= 1;
  // el taxi acaba con las ruedas un poco por debajo de la línea de la explanada
  const taxiBottom = H - groundY - 10;
  const taxiW = TAXI_W * ARRIVE_TAXI_SCALE;
  const taxiH = TAXI_H * ARRIVE_TAXI_SCALE;
  // entra por el centro y se va cerrando hacia su plaza, con la misma frenada
  // que el resto (el ticker lleva `progress`; solo transform)
  const ease = 1 - Math.pow(1 - p, 3);
  const taxiX = W / 2 + (W * ARRIVE_TAXI_X - W / 2) * ease;
  return (
    <div
      data-testid="arrival"
      aria-hidden
      className="pointer-events-none absolute inset-0 overflow-hidden"
      style={{ animation: "dotaxi-cut-in 400ms ease-out both" }}
    >
      <CutsceneSky W={W} H={H} />
      {/* explanada: franja de césped y plaza embaldosada */}
      <div className="absolute inset-x-0" style={{ top: groundY - 10, height: 10, background: "color-mix(in srgb, var(--sky-bottom) 28%, #2f7a4f)" }} />
      <div
        className="absolute inset-x-0 bottom-0"
        style={{
          top: groundY,
          background: `color-mix(in srgb, var(--sky-bottom) 16%, ${SIDEWALK})`,
          backgroundImage: `repeating-linear-gradient(to bottom, ${SIDEWALK_LINE} 0 1.5px, transparent 1.5px 26px)`,
        }}
      />
      {/* el edificio y su letrero */}
      <div className="absolute" style={{ left: "50%", top: buildingTop, width: buildingW, transform: "translateX(-50%)" }}>
        <DestinationArt trip={trip} width={buildingW} />
      </div>
      <div
        className="absolute rounded-2xl px-5 py-1.5 font-display text-[26px] font-extrabold tracking-wider"
        style={{ left: "50%", top: Math.max(10, roofY - 58), transform: "translateX(-50%)", background: SIGN_FACE, color: "var(--accent)", border: `4px solid ${INK}`, boxShadow: `0 5px 0 ${INK}` }}
      >
        {trip.destination.sign}
      </div>
      {/* el taxi: entra grande por abajo, se cierra a la izquierda y frena
          ante la puerta. La x la lleva el ticker; la y y la escala, la
          animación (misma curva de frenada). */}
      <div className="absolute left-0 bottom-0" style={{ transform: `translateX(${taxiX}px)` }}>
        <div
          data-testid="arrival-taxi"
          className="absolute"
          style={{
            left: 0,
            bottom: 0,
            transformOrigin: "bottom center",
            ["--from-y" as string]: "24px",
            ["--to-y" as string]: `${-taxiBottom}px`,
            animation: `dotaxi-arrive-drive ${driveMs}ms cubic-bezier(0.2, 0.8, 0.2, 1) both`,
          }}
        >
          <div className="relative">
            <TaxiRear damage={damage} braking={parked} crashing={false} />
            {parked && <TireSmoke />}
          </div>
        </div>
      </div>
      {/* el pasajero baja hacia la puerta y agradece, hacia la derecha */}
      {passengerOut && (
        <div
          className="absolute"
          style={{ left: W * ARRIVE_TAXI_X + taxiW / 2 + 10, bottom: taxiBottom - 2, animation: "dotaxi-fade-in 0.35s var(--ease-out-strong) both" }}
        >
          <Passenger trip={trip} size={44} />
          <SpeechBubble
            text={trip.voice.thanks}
            tail="left"
            style={{ left: -4, bottom: 44 + 10, width: "max-content", maxWidth: W * 0.42, fontSize: 12 }}
          />
        </div>
      )}
      {/* Doty celebra a la izquierda del techo */}
      {parked && reaction && (
        <ReactionBubble
          pose={reaction}
          side="left"
          style={{ right: W - (W * ARRIVE_TAXI_X - taxiW / 2) + 2, bottom: taxiBottom + taxiH - 6 }}
        />
      )}
    </div>
  );
}

/** Escala final del taxi averiado: la del `to` de `dotaxi-breakdown-drive`. */
const BREAKDOWN_TAXI_SCALE = 0.85;

/**
 * La avería como escena aparte: mismo cielo limpio, una calle plana y el
 * taxi destrozado que entra, se detiene y se queda humeando en medio. El
 * pasajero baja por la derecha y se lamenta; Doty llora en su burbuja a la
 * izquierda. Solo transform/opacity; `progress` lo lleva el ticker.
 */
export function BreakdownCutscene({
  m,
  trip,
  progress,
  passengerOut,
  reaction,
  driveMs,
}: {
  m: PlaneMetrics;
  trip: Trip;
  progress: number;
  passengerOut: boolean;
  reaction: DotyPose | null;
  driveMs: number;
}) {
  const W = m.sceneW;
  const H = m.sceneH;
  const groundY = H * 0.62;
  const p = Math.min(1, Math.max(0, progress));
  const stopped = p >= 1;
  const taxiBottom = H - groundY - 26;
  const taxiW = TAXI_W * BREAKDOWN_TAXI_SCALE;
  const taxiH = TAXI_H * BREAKDOWN_TAXI_SCALE;
  const passengerLeft = W / 2 + taxiW / 2 - 4;
  return (
    <div
      data-testid="breakdown"
      aria-hidden
      className="pointer-events-none absolute inset-0 overflow-hidden"
      style={{ animation: "dotaxi-cut-in 400ms ease-out both" }}
    >
      <CutsceneSky W={W} H={H} />
      {/* la calle, plana: arcén amarillo, asfalto y una raya discontinua */}
      <div className="absolute inset-x-0" style={{ top: groundY - 8, height: 8, background: "color-mix(in srgb, var(--sky-bottom) 28%, #2f7a4f)" }} />
      <div className="absolute inset-x-0 bottom-0" style={{ top: groundY, background: ASPHALT }}>
        <div className="absolute inset-x-0" style={{ top: 0, height: 3, background: EDGE_PAINT }} />
        <div
          className="absolute inset-x-0"
          style={{ top: (H - groundY) * 0.62, height: 4, backgroundImage: `repeating-linear-gradient(to right, ${LANE_PAINT} 0 28px, transparent 28px 52px)` }}
        />
      </div>
      {/* el taxi destrozado entra y se para en medio */}
      <div className="absolute left-0 bottom-0" style={{ transform: `translateX(${W / 2}px)` }}>
        <div
          data-testid="breakdown-taxi"
          className="absolute"
          style={{
            left: 0,
            bottom: 0,
            transformOrigin: "bottom center",
            ["--from-y" as string]: "24px",
            ["--to-y" as string]: `${-taxiBottom}px`,
            animation: `dotaxi-breakdown-drive ${driveMs}ms cubic-bezier(0.2, 0.8, 0.2, 1) both`,
          }}
        >
          <div className="relative">
            <TaxiRear damage={5} braking={stopped} crashing={false} />
            {stopped && <TireSmoke />}
            {/* humo grande del capó, además del que trae el taxi */}
            {stopped &&
              [0, 1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  aria-hidden
                  className="absolute rounded-full"
                  style={{
                    top: -6 - (i % 2) * 8,
                    left: TAXI_W / 2 - 18 + (i - 2) * 9,
                    width: 30,
                    height: 30,
                    background: "rgba(200, 198, 214, 0.85)",
                    ["--dx" as string]: `${(i - 2) * 10}px`,
                    animation: `dotaxi-big-smoke 1.8s ease-out ${i * 0.32}s infinite`,
                  }}
                />
              ))}
          </div>
        </div>
      </div>
      {/* el pasajero se baja pegado al taxi y se lamenta; el bocadillo se
          acota al marco (a la derecha queda poco sitio) */}
      {passengerOut && (
        <div
          className="absolute"
          style={{ left: passengerLeft, bottom: taxiBottom - 2, animation: "dotaxi-fade-in 0.35s var(--ease-out-strong) both" }}
        >
          <Passenger trip={trip} size={48} />
          <SpeechBubble
            text={trip.voice.groan}
            tail="left"
            style={{ left: -28, bottom: 48 + 10, width: "max-content", maxWidth: W - (passengerLeft - 28) - 8, fontSize: 12 }}
          />
        </div>
      )}
      {/* Doty llora a la izquierda del techo */}
      {stopped && reaction && (
        <ReactionBubble pose={reaction} side="left" style={{ right: W / 2 + taxiW / 2 + 2, bottom: taxiBottom + taxiH - 10 }} />
      )}
    </div>
  );
}

// ── Burbuja de reacción de Doty ──────────────────────────────────────────────

/**
 * La cara de Doty cuando pasa algo: acierto, bache, llegada, avería. Sale del
 * techo del taxi como un bocadillo; se remonta por key para volver a saltar.
 * Tamaño constante: va fuera del wrapper de escala del taxi.
 */
export function ReactionBubble({
  pose,
  style,
  side = "right",
}: {
  pose: DotyPose;
  style?: React.CSSProperties;
  /** de qué lado del taxi está: la cola apunta hacia el techo */
  side?: "left" | "right";
}) {
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
        {/* size="medium" (192 px servidos) en vez de micro (32) estirado: a
            tres aumentos el micro salía borroso. Se encuadra a ojos y boca. */}
        <div
          className="absolute"
          // ancho explícito: la clase de tamaño de Doty es relativa y dentro de
          // un absoluto sin ancho colapsaba a nada
          style={{ left: "50%", top: -40, width: 192, transform: "translateX(-50%) scale(0.74)", transformOrigin: "top center" }}
        >
          <Doty pose={pose} size="medium" />
        </div>
      </div>
      {/* cola hacia el techo, del lado del taxi */}
      <div
        aria-hidden
        className="absolute"
        style={{
          ...(side === "right" ? { left: 8 } : { right: 8 }),
          bottom: -8, width: 12, height: 12, background: SIGN_FACE,
          borderLeft: `2.5px solid ${INK}`, borderBottom: `2.5px solid ${INK}`,
          transform: side === "right" ? "rotate(-45deg)" : "rotate(45deg)",
        }}
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

export function SpeechBubble({
  text,
  style,
  tail = "left",
}: {
  text: string;
  style?: React.CSSProperties;
  /** de qué lado sale la cola: hacia quien habla */
  tail?: "left" | "right";
}) {
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
        style={{
          ...(tail === "left" ? { left: 14 } : { right: 14 }),
          bottom: -7, width: 12, height: 12, background: SIGN_FACE,
          borderRight: `2px solid ${INK}`, borderBottom: `2px solid ${INK}`, transform: "rotate(45deg)",
        }}
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

// ── Velocidad, comentarios y humo ────────────────────────────────────────────

/**
 * Líneas de velocidad en los bordes, sobre el césped: aparecen con la racha y
 * al confirmar (el taxi acelera al atravesar las palabras). `intensity` 0..1.
 */
export function SpeedLines({ m, intensity }: { m: PlaneMetrics; intensity: number }) {
  if (intensity <= 0.03) return null;
  const xs = [8, 22, 38, m.sceneW - 12, m.sceneW - 26, m.sceneW - 42];
  return (
    <div aria-hidden data-testid="speedlines" className="pointer-events-none absolute inset-0 overflow-hidden" style={{ opacity: Math.min(1, intensity) }}>
      {xs.map((x, i) => (
        <div
          key={i}
          className="absolute"
          style={{
            left: x,
            top: m.horizonY + 24 + (i % 3) * 44,
            width: 2,
            height: 70 + (i % 2) * 30,
            borderRadius: 1,
            background: `linear-gradient(to bottom, transparent, ${SIGN_FACE}, transparent)`,
            animation: `dotaxi-speedline ${(0.42 + (i % 3) * 0.08).toFixed(2)}s linear ${-(i * 0.09)}s infinite`,
          }}
        />
      ))}
    </div>
  );
}

/**
 * Lo que dice el pasajero desde el asiento de atrás: bocadillo pequeño con su
 * cara como remitente. Se remonta por key para volver a saltar.
 */
export function Remark({
  trip,
  text,
  style,
  side = "left",
}: {
  trip: Trip;
  text: string;
  style?: React.CSSProperties;
  /** de qué lado del taxi está: la cola apunta hacia la ventanilla */
  side?: "left" | "right";
}) {
  return (
    <div
      data-testid="remark"
      aria-hidden
      className="pointer-events-none absolute flex items-center gap-1.5 rounded-2xl py-1 pl-1 pr-2.5 font-display text-[12px] font-extrabold leading-tight"
      style={{
        background: SIGN_FACE,
        color: INK,
        border: `2px solid ${INK}`,
        boxShadow: `0 3px 0 ${INK}`,
        width: "max-content",
        animation: "dotaxi-bubble-in 0.25s var(--ease-out-strong) both",
        ...style,
      }}
    >
      {/* la cara: el avatar es de cuerpo entero, se encuadra la cabeza */}
      <span className="relative block h-6 w-6 shrink-0 overflow-hidden rounded-full" style={{ background: "#e9e6f2", border: `1.5px solid ${INK}` }}>
        <Image
          src={`/images/avatars/${trip.avatar}.png`}
          alt=""
          width={512}
          height={512}
          sizes="64px"
          draggable={false}
          className="absolute select-none"
          style={{ left: "50%", top: 1, width: 42, height: 42, transform: "translateX(-50%)" }}
        />
      </span>
      {text}
      {/* cola hacia la ventanilla, del lado del taxi */}
      <div
        aria-hidden
        className="absolute"
        style={{
          ...(side === "left" ? { right: 10 } : { left: 10 }),
          bottom: -7, width: 12, height: 12, background: SIGN_FACE,
          borderRight: `2px solid ${INK}`, borderBottom: `2px solid ${INK}`, transform: "rotate(45deg)",
        }}
      />
    </div>
  );
}

/** Humo de ruedas en el frenazo: dos bocanadas por rueda hacia fuera. Se
 *  remonta por key para repetirse. */
export function TireSmoke() {
  return (
    <>
      {([[14, -1], [114, 1]] as const).map(([x, dir]) =>
        [0, 1].map((j) => (
          <div
            key={`${x}-${j}`}
            aria-hidden
            className="pointer-events-none absolute rounded-full"
            style={{
              left: x - 8,
              bottom: 2,
              width: 16,
              height: 16,
              background: "rgba(225, 222, 235, 0.85)",
              ["--dx" as string]: `${dir * (14 + j * 10)}px`,
              animation: `dotaxi-tire-smoke 480ms ease-out ${j * 90}ms both`,
            }}
          />
        )),
      )}
    </>
  );
}
