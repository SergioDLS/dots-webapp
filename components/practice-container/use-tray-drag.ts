"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { dropTarget, type Box, type Caret } from "@/lib/tray-drop";

// Reordenar la oración arrastrando sus palabras, con pointer events (RN-safe:
// nada de HTML5 Drag API). Un toque sin arrastre sigue siendo un click normal,
// que el componente usa para devolver la palabra al banco.

const DRAG_THRESHOLD = 6; // px antes de que un toque pase a ser arrastre
export const DRAG_SCALE = "1.08"; // el chip en la mano se ve un poco más grande
const SETTLE_EASE = "180ms cubic-bezier(.2,.8,.2,1)";
const SETTLE = `translate ${SETTLE_EASE}, scale ${SETTLE_EASE}`;

type Press = {
  id: number;
  pointerId: number;
  from: number;
  x0: number;
  y0: number;
  originLeft: number;
  originTop: number;
  /** Escala visual de la bandeja (≠1 si un ancestro anima un scale). */
  scale: number;
  ids: number[];
  boxes: Box[];
  dragging: boolean;
};

type Settle = { ids: number[]; boxes: Box[]; id: number; dx: number; dy: number };

export type TrayDrag = { id: number; dx: number; dy: number; caret: Caret | null };

export function useTrayDrag({
  enabled,
  onMove,
}: {
  enabled: boolean;
  onMove: (from: number, to: number) => void;
}) {
  // Contenedor posicionado de los chips: offsetLeft/Top se miden contra él.
  const trayRef = useRef<HTMLDivElement>(null);
  const press = useRef<Press | null>(null);
  const settle = useRef<Settle | null>(null);
  const suppressClick = useRef(false);
  const [drag, setDrag] = useState<TrayDrag | null>(null);

  // Punto del dedo y desplazamiento en coordenadas de layout de la bandeja,
  // las mismas de offsetLeft/Top.
  const local = (p: Press, e: React.PointerEvent<HTMLElement>) => ({
    x: (e.clientX - p.originLeft) / p.scale,
    y: (e.clientY - p.originTop) / p.scale,
    dx: (e.clientX - p.x0) / p.scale,
    dy: (e.clientY - p.y0) / p.scale,
  });

  const chips = () =>
    Array.from(trayRef.current?.querySelectorAll<HTMLElement>("[data-tray-chip]") ?? []);

  // Al soltar, cada chip arranca donde se veía y se desliza a su sitio nuevo
  // (FLIP): el arrastrado desde el dedo, los demás desde su hueco anterior.
  useLayoutEffect(() => {
    const s = settle.current;
    if (drag || !s) return;
    settle.current = null;
    for (const el of chips()) {
      const id = Number(el.dataset.trayChip);
      const i = s.ids.indexOf(id);
      if (i < 0) continue;
      const held = id === s.id;
      const ox = s.boxes[i].left - el.offsetLeft + (held ? s.dx : 0);
      const oy = s.boxes[i].top - el.offsetTop + (held ? s.dy : 0);
      if (!ox && !oy && !held) continue;
      el.style.transition = "none";
      el.style.translate = `${ox}px ${oy}px`;
      if (held) el.style.scale = DRAG_SCALE;
      el.getBoundingClientRect(); // fija el punto de partida antes de animar
      el.style.transition = SETTLE;
      el.style.translate = "0px 0px";
      if (held) el.style.scale = "";
      // Si el chip ya está otra vez en la mano, React le puso transition
      // "none" para el arrastre: no hay que pisarla.
      el.addEventListener("transitionend", () => {
        if (el.style.transition !== "none") el.style.transition = "";
      }, { once: true });
    }
  }, [drag]);

  const onPointerDown = (e: React.PointerEvent<HTMLElement>, id: number, index: number) => {
    suppressClick.current = false;
    const tray = trayRef.current;
    if (!enabled || !tray || press.current) return;
    const els = chips();
    const origin = tray.getBoundingClientRect();
    e.currentTarget.setPointerCapture(e.pointerId);
    press.current = {
      id,
      pointerId: e.pointerId,
      from: index,
      x0: e.clientX,
      y0: e.clientY,
      originLeft: origin.left,
      originTop: origin.top,
      scale: origin.width / tray.offsetWidth || 1,
      ids: els.map((el) => Number(el.dataset.trayChip)),
      // offset* ignora transforms: la animación de entrada o el active:scale
      // no deforman las cajas.
      boxes: els.map((el) => ({
        left: el.offsetLeft,
        top: el.offsetTop,
        width: el.offsetWidth,
        height: el.offsetHeight,
      })),
      dragging: false,
    };
  };

  const onPointerMove = (e: React.PointerEvent<HTMLElement>) => {
    const p = press.current;
    if (!p || e.pointerId !== p.pointerId) return;
    if (!p.dragging) {
      if (Math.hypot(e.clientX - p.x0, e.clientY - p.y0) < DRAG_THRESHOLD) return;
      if (!enabled) {
        press.current = null;
        return;
      }
      p.dragging = true;
    }
    const { x, y, dx, dy } = local(p, e);
    setDrag({ id: p.id, dx, dy, caret: dropTarget(p.boxes, p.from, x, y).caret });
  };

  const finish = (e: React.PointerEvent<HTMLElement>, commit: boolean) => {
    const p = press.current;
    if (!p || e.pointerId !== p.pointerId) return;
    press.current = null;
    if (!p.dragging) return; // fue un toque: lo resuelve onClick
    suppressClick.current = true;
    const { x, y, dx, dy } = local(p, e);
    settle.current = { ids: p.ids, boxes: p.boxes, id: p.id, dx, dy };
    setDrag(null);
    if (!commit) return;
    const { to } = dropTarget(p.boxes, p.from, x, y);
    if (to !== p.from) onMove(p.from, to);
  };

  return {
    trayRef,
    drag,
    chipProps: (id: number, index: number) => ({
      "data-tray-chip": id,
      onPointerDown: (e: React.PointerEvent<HTMLElement>) => onPointerDown(e, id, index),
      onPointerMove,
      onPointerUp: (e: React.PointerEvent<HTMLElement>) => finish(e, true),
      onPointerCancel: (e: React.PointerEvent<HTMLElement>) => finish(e, false),
    }),
    /** true si este click es el que cierra un arrastre y hay que ignorarlo. */
    consumeClick: () => {
      const was = suppressClick.current;
      suppressClick.current = false;
      return was;
    },
  };
}
