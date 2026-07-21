"use client";

import { useEffect, useRef } from "react";

/**
 * rAF loop throttled to `fps`. `cb` recibe `dtMs` (delta desde el frame anterior).
 * Se limpia al desmontar o cuando `running` cambia a false.
 * RN-safe: sin canvas, sin eventos, solo requestAnimationFrame.
 */
export function useTicker(
  fps: number,
  cb: (dtMs: number) => void,
  running: boolean,
): void {
  const cbRef = useRef(cb);

  useEffect(() => {
    cbRef.current = cb;
  }, [cb]);

  useEffect(() => {
    if (!running) return;

    const interval = 1000 / fps;
    let rafId = 0;
    let lastTs: number | null = null;
    let accumulated = 0;

    const tick = (ts: number) => {
      if (lastTs === null) lastTs = ts;
      accumulated += ts - lastTs;
      lastTs = ts;

      // Fire callback once per interval (throttle to target fps)
      if (accumulated >= interval) {
        const dt = accumulated;
        accumulated = 0;
        cbRef.current(dt);
      }

      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [running, fps]);
}
