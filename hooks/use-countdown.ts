"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export interface CountdownState {
  remaining: number;
  running: boolean;
  start: () => void;
  stop: () => void;
}

/**
 * Cuenta regresiva sin drift: computa `remaining` contra `startedAt` en lugar
 * de decrementar acumulativo. El intervalo es 100ms para actualizaciones suaves.
 * `onEnd` se dispara exactamente una vez cuando llega a 0.
 */
export function useCountdown(
  seconds: number,
  onEnd: () => void,
): CountdownState {
  const [remaining, setRemaining] = useState(seconds);
  const [running, setRunning] = useState(false);

  const startedAtRef = useRef<number | null>(null);
  const onEndRef = useRef(onEnd);
  const endFiredRef = useRef(false);

  // Keep onEnd ref current without resetting the timer
  useEffect(() => {
    onEndRef.current = onEnd;
  }, [onEnd]);

  const stop = useCallback(() => {
    setRunning(false);
    startedAtRef.current = null;
  }, []);

  const start = useCallback(() => {
    setRemaining(seconds);
    endFiredRef.current = false;
    startedAtRef.current = performance.now();
    setRunning(true);
  }, [seconds]);

  useEffect(() => {
    if (!running) return;

    const id = setInterval(() => {
      if (startedAtRef.current === null) return;
      const elapsed = (performance.now() - startedAtRef.current) / 1000;
      const left = Math.max(0, seconds - elapsed);
      setRemaining(left);

      if (left <= 0 && !endFiredRef.current) {
        endFiredRef.current = true;
        clearInterval(id);
        setRunning(false);
        startedAtRef.current = null;
        onEndRef.current();
      }
    }, 100);

    return () => clearInterval(id);
  }, [running, seconds]);

  return { remaining, running, start, stop };
}
