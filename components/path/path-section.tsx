"use client";

import React, { useState, type CSSProperties } from "react";
import PathNode from "./path-node";
import DotyMarker from "./doty-marker";
import PathPeer from "./path-peer";
import SectionBanner from "./section-banner";
import { ART_BOX, NODE_ROW_H, SLOT_W, bubbleVars, sideOf, type NodeSide } from "@/lib/node-bubble";
import type {
  PathNode as PathNodeType,
  PathPeer as PathPeerType,
  PathSection as PathSectionType,
} from "@/types/path.types";

interface PathSectionProps {
  section: PathSectionType;
  index: number;
  total: number;
  accentHex: string;
  peersByNodeId: Record<number, PathPeerType[]>;
  preview?: boolean;
}

/* ── Zigzag helpers (evolved from level-section) ────────────── */
// Pattern repeats every 4 items: left → center → right → center → …
const zigzagX = (i: number): number => {
  const phase = i % 4;
  if (phase === 0) return 15;
  if (phase === 1) return 50;
  if (phase === 2) return 85;
  return 50;
};

const ROW_GAP = 18; // px – vertical gap between nodes

const keyOf = (n: PathNodeType) => `${n.type}-${n.id}`;
/** El nivel actual de verdad: el mismo criterio que la estrella de PathNode. */
const isLiveCurrent = (n: PathNodeType, preview: boolean) =>
  !preview && n.current && n.unlocked && !n.completed;
/** Variables de geometría por lado: tres objetos, calculados una sola vez. */
const SLOT_VARS: Record<NodeSide, CSSProperties> = {
  left: bubbleVars("left") as CSSProperties,
  center: bubbleVars("center") as CSSProperties,
  right: bubbleVars("right") as CSSProperties,
};
const TIP_PRIMER_NIVEL = "camino.primer-nivel";

export default function PathSection({
  section,
  index,
  total,
  accentHex,
  peersByNodeId,
  preview = false,
}: PathSectionProps) {
  const { id, checkpointAvailable, nodes } = section;
  // El nivel actual nace abierto (spec 2026-09-30, decisión 4). Inicializador y
  // no efecto: se pinta abierto desde el primer frame, sin animar ni saltar.
  const [openKey, setOpenKey] = useState<string | null>(() => {
    const current = nodes.find((n) => isLiveCurrent(n, preview));
    return current ? keyOf(current) : null;
  });

  // Todas las filas miden lo mismo (checkpoint incluido): NODE_ROW_H. Abrir un
  // nivel no lo cambia, así que las filas y el conector no se mueven nunca.
  const slots = nodes.map((n, i) => {
    const xPct = n.type === "checkpoint" ? 50 : zigzagX(i);
    return { node: n, key: keyOf(n), xPct, side: sideOf(xPct), h: NODE_ROW_H };
  });
  const offsets = slots.map((_, i) =>
    slots.slice(0, i).reduce((sum, s) => sum + s.h + ROW_GAP, 0),
  );
  const placed = slots.map((s, i) => ({
    ...s,
    y: offsets[i],
    centerY: offsets[i] + ART_BOX / 2,
  }));
  const totalH =
    slots.length === 0
      ? 0
      : offsets[slots.length - 1] + slots[slots.length - 1].h;

  // Connector: one cubic segment per consecutive pair; travelled part solid
  const segment = (
    a: { xPct: number; centerY: number },
    b: { xPct: number; centerY: number },
  ) => {
    const midY = (a.centerY + b.centerY) / 2;
    return `M ${a.xPct} ${a.centerY} C ${a.xPct} ${midY}, ${b.xPct} ${midY}, ${b.xPct} ${b.centerY}`;
  };

  return (
    <div className="flex w-full flex-col gap-4 items-center" data-section-id={id}>
      <SectionBanner
        section={section}
        index={index}
        total={total}
        accentHex={accentHex}
        muted={preview || (!section.unlocked && !section.skipped)}
      />

      {/* ── Path (zigzag + connector) ──────────────────────── */}
      {placed.length === 0 ? (
        <span className="text-(--muted)">No hay lecciones disponibles.</span>
      ) : (
        <div className="dots-track relative w-full" style={{ maxWidth: 640, height: totalH }}>
          {/* SVG connector: solid where already travelled, dashed ahead */}
          {placed.length >= 2 && (
            <svg
              className="absolute inset-0 w-full h-full pointer-events-none"
              viewBox={`0 0 100 ${totalH}`}
              preserveAspectRatio="none"
              fill="none"
            >
              {placed.slice(0, -1).map((p, i) => {
                const next = placed[i + 1];
                const travelled = p.node.completed;
                return (
                  <path
                    key={p.key}
                    d={segment(p, next)}
                    stroke={accentHex}
                    strokeWidth={travelled ? 3.5 : 2.5}
                    strokeDasharray={travelled ? undefined : "6 6"}
                    strokeLinecap="round"
                    opacity={travelled ? 0.55 : 0.3}
                    vectorEffect="non-scaling-stroke"
                  />
                );
              })}
            </svg>
          )}

          {/* Nodes */}
          {placed.map((p, nodeIndex) => {
            const peersHere = peersByNodeId[p.node.id] ?? [];
            const open = openKey === p.key;
            const live = isLiveCurrent(p.node, preview);
            return (
            <div
              key={p.key}
              className="dots-slot absolute"
              data-open={open ? "" : undefined}
              data-path-current={!preview && p.node.current ? "true" : undefined}
              // Una sola marca en el DOM: abierta la lleva la burbuja, que es lo que se ve.
              data-tip={live && !open ? TIP_PRIMER_NIVEL : undefined}
              style={{
                ...SLOT_VARS[p.side],
                left: `calc(${p.xPct}% - ${SLOT_W / 2}px)`,
                top: p.y,
                width: SLOT_W,
                zIndex: open ? 40 : 1,
              }}
            >
              <PathNode
                node={p.node}
                accentHex={accentHex}
                checkpointAvailable={checkpointAvailable}
                animationIndex={nodeIndex}
                open={open}
                // Updater puro: abrir otro nivel dispara también el "click fuera"
                // de este, y sin comparar cerraría al que se acaba de abrir.
                onOpenChange={(v) =>
                  setOpenKey((prev) => (v ? p.key : prev === p.key ? null : prev))
                }
                tipKey={live ? TIP_PRIMER_NIVEL : undefined}
                preview={preview}
              />
              {/*
                Doty and peers claim the same slot: the interior side of the
                node, top-aligned. There is no room for both — a row is
                NODE_ROW_H (188px) tall, Doty takes ~110 and two peers need
                ~105 — so on a node that has peers, Doty yields. The star
                badge and the pulse still mark the current node, and a peer
                is information while "¡Sigue aquí!" is decoration.
              */}
              {!preview && p.node.current && peersHere.length === 0 && (
                <DotyMarker side={p.xPct >= 50 ? "left" : "right"} />
              )}
              {!preview &&
                peersHere.map((peer, peerIndex) => (
                  <PathPeer
                    key={peer.id}
                    peer={peer}
                    // Always toward the inside of the zigzag. Flipping to the
                    // outside on the current node would push the peer off-screen
                    // on the 15% and 85% slots.
                    side={p.xPct >= 50 ? "left" : "right"}
                    stackIndex={peerIndex}
                  />
                ))}
            </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
