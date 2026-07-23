"use client";

import { useMemo } from "react";

import type { ItemMastery } from "@/services/lessons.service";

/**
 * Sesiones por tramos (F3e): en vez de pedir todo el pack de golpe, cada
 * sesión toma 6–7 ítems priorizando lo que el alumno falla, luego lo nuevo,
 * y mezcla 1–2 ya aprendidas como repaso (beginner necesita repetición).
 * Pack 100% dominado → sesión de repaso con tramo aleatorio.
 */

export type SessionableItem = {
  id: number;
  audio?: string | null;
  progress?: ItemMastery | null;
};

export type LessonSession<T> = {
  /** Ítems de esta sesión (tramo), ya barajados. */
  tramo: T[];
  /** Subconjunto del tramo nunca practicado (los únicos que se presentan). */
  newItems: T[];
  /** true si el pack completo ya está dominado (sesión de repaso). */
  isReview: boolean;
  /** Ítems del pack dominados ANTES de esta sesión. */
  learnedBefore: number;
  packTotal: number;
};

const TRAMO_MAX = 7;
const REVIEW_MIX = 2;

/** Fisher–Yates on a copy — pure, safe inside useMemo. */
function shuffle<T>(arr: T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function buildLessonSession<T extends SessionableItem>(
  items: T[],
): LessonSession<T> {
  const packTotal = items.length;
  const learned = items.filter((it) => it.progress?.done);
  const learnedBefore = learned.length;

  // Packs chicos (days=7, seasons=4…) entran completos.
  if (packTotal <= TRAMO_MAX) {
    const tramo = shuffle(items);
    return {
      tramo,
      newItems: tramo.filter((it) => !it.progress),
      isReview: packTotal > 0 && learnedBefore === packTotal,
      learnedBefore,
      packTotal,
    };
  }

  // Tramos parejos: 26 letras → 4 sesiones de 7/7/7/5.
  const sessionCount = Math.ceil(packTotal / TRAMO_MAX);
  const sessionSize = Math.ceil(packTotal / sessionCount);

  // Pack dominado: repaso con tramo aleatorio — el nodo nunca "se agota".
  if (learnedBefore === packTotal) {
    return {
      tramo: shuffle(items).slice(0, sessionSize),
      newItems: [],
      isReview: true,
      learnedBefore,
      packTotal,
    };
  }

  // Prioridad: a-reforzar (falló y no domina) → en-curso (bien pero sin
  // racha) → nuevas. Cada grupo barajado para variar entre sesiones.
  const reinforce = shuffle(
    items.filter(
      (it) => it.progress && !it.progress.done && it.progress.timesWrong > 0,
    ),
  );
  const inProgress = shuffle(
    items.filter(
      (it) => it.progress && !it.progress.done && it.progress.timesWrong === 0,
    ),
  );
  const fresh = shuffle(items.filter((it) => !it.progress));

  const reviewCount = Math.min(REVIEW_MIX, learned.length);
  const main = [...reinforce, ...inProgress, ...fresh].slice(
    0,
    Math.max(1, sessionSize - reviewCount),
  );
  const review = shuffle(learned).slice(
    0,
    Math.min(reviewCount, sessionSize - main.length),
  );
  const tramo = shuffle([...main, ...review]);

  return {
    tramo,
    newItems: tramo.filter((it) => !it.progress),
    isReview: false,
    learnedBefore,
    packTotal,
  };
}

export function useLessonSession<T extends SessionableItem>(
  items: T[],
): LessonSession<T> {
  return useMemo(() => buildLessonSession(items), [items]);
}
