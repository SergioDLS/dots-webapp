"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import Spinner from "@/components/ui/Spinner/Spinner";
import { BASE_URL_SOUNDS } from "@/constants";
import { useAuth } from "@/context/auth-context";
import {
  getNodeContentService,
  putNodeProgressService,
  type NumbersContent,
} from "@/services/lessons.service";

// ── Client: fetch + gate ──────────────────────────────────────────────────────

function NumbersClient() {
  const searchParams = useSearchParams();
  const nodeId = Number(searchParams.get("id") ?? "0");
  const { isBootstrapping } = useAuth();

  const [content, setContent] = useState<NumbersContent | null>(null);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (isBootstrapping || !nodeId) return;
    getNodeContentService(nodeId)
      .then((data) => {
        if (data.type === "numbers") setContent(data);
        else setError(true);
      })
      .catch(() => setError(true));
  }, [nodeId, isBootstrapping, attempt]);

  if (error) {
    return (
      <div className="flex flex-col items-center gap-4 py-10">
        <p className="text-center text-(--muted)">
          No pudimos cargar este ejercicio.
        </p>
        <button
          className="rounded-2xl border border-(--border) bg-(--surface) px-5 py-2 font-semibold text-(--accent)"
          onClick={() => {
            setError(false);
            setAttempt((n) => n + 1);
          }}
        >
          Reintentar
        </button>
      </div>
    );
  }
  if (!content) {
    return (
      <div className="flex justify-center py-16">
        <Spinner />
      </div>
    );
  }
  return <NumbersDrill nodeId={nodeId} content={content} />;
}

export default function NumbersPage() {
  return (
    <main className="mx-auto w-full max-w-xl flex flex-col gap-4 p-4">
      <Suspense
        fallback={
          <div className="flex justify-center py-16">
            <Spinner />
          </div>
        }
      >
        <NumbersClient />
      </Suspense>
    </main>
  );
}

// ── Drill: ronda 1 escucha→numeral (cola de dominio) + ronda 2 empareja ───────
// Tap-only, RN-safe. Animación solo transform/opacity.

type NumberItem = NumbersContent["items"][number];
type ItemResult = { times_wrong: number; answered: boolean };

const OPTION_COUNT = 4;
const FEEDBACK_MS = 500;
const MATCH_CHUNK = 5;

/** Audio 1–10 viene como URL absoluta (Cloudinary); rutas legacy son relativas. */
const resolveAudio = (src: string) =>
  /^https?:\/\//.test(src) ? src : `${BASE_URL_SOUNDS}/${src}`;

/** Reproducir SOLO dentro de handlers de tap (gesto de usuario = autoplay legal). */
const playAudio = (src: string) => {
  new Audio(resolveAudio(src)).play().catch(() => {});
};

/** Fisher–Yates. */
function shuffle<T>(arr: T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function NumbersDrill({
  nodeId,
  content,
}: {
  nodeId: number;
  content: NumbersContent;
}) {
  const router = useRouter();
  const items = content.items;

  const [phase, setPhase] = useState<"recognize" | "match" | "done">(
    "recognize",
  );
  // Cola de dominio: ids por responder; los fallados vuelven al final.
  const [queue, setQueue] = useState<number[]>(() =>
    shuffle(items.map((it) => it.id)),
  );
  const [results, setResults] = useState<Record<number, ItemResult>>(() => {
    const seed: Record<number, ItemResult> = {};
    for (const it of items) seed[it.id] = { times_wrong: 0, answered: false };
    return seed;
  });
  const [feedback, setFeedback] = useState<{
    value: number;
    kind: "correct" | "wrong";
  } | null>(null);
  const lockRef = useRef(false); // bloquea taps mientras se muestra feedback
  const sentRef = useRef(false);

  const goToPath = () => router.push("/levels");

  const targetId = queue[0];
  const target = items.find((it) => it.id === targetId);

  // Opciones: valor objetivo + hasta 3 distractores únicos, barajadas por turno.
  const options = useMemo(() => {
    const t = items.find((it) => it.id === targetId);
    if (!t) return [] as number[];
    const seen = new Set<number>([t.value]);
    const pool: number[] = [];
    for (const it of items) {
      if (seen.has(it.value)) continue;
      seen.add(it.value);
      pool.push(it.value);
    }
    const distractors = shuffle(pool).slice(0, OPTION_COUNT - 1);
    return shuffle([t.value, ...distractors]);
  }, [items, targetId]);

  // Envía el progreso exactamente una vez al terminar ambas rondas.
  useEffect(() => {
    if (phase !== "done" || sentRef.current) return;
    sentRef.current = true;
    const payload = items.map((it) => ({
      id: it.id,
      times_wrong: results[it.id]?.times_wrong ?? 0,
      answered: true,
    }));
    putNodeProgressService(nodeId, payload).catch(console.error);
  }, [phase, results, items, nodeId]);

  // Vacío: pantalla amable, sin submit.
  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center gap-4 py-10">
        <p className="text-center text-(--muted)">
          Aún no hay contenido en esta lección.
        </p>
        <button
          className="rounded-2xl border border-(--border) bg-(--surface) px-5 py-2 font-semibold text-(--accent)"
          onClick={goToPath}
        >
          Volver
        </button>
      </div>
    );
  }

  if (phase === "done") {
    const firstTry = items.filter(
      (it) => (results[it.id]?.times_wrong ?? 0) === 0,
    ).length;
    return (
      <div className="flex flex-col items-center gap-4 py-10">
        <p className="text-3xl font-extrabold">¡Listo!</p>
        <p className="text-center font-semibold">
          {firstTry}/{items.length} a la primera
        </p>
        <p className="text-center text-(--muted)">
          Completaste el ejercicio de números.
        </p>
        <button
          className="rounded-2xl bg-(--accent) px-6 py-3 font-bold text-white"
          onClick={goToPath}
        >
          Volver al camino
        </button>
      </div>
    );
  }

  if (phase === "match") {
    return (
      <div className="flex flex-col gap-4 w-full">
        <p className="text-center font-semibold">
          Empareja el número con su palabra
        </p>
        <MatchRound
          items={items}
          onWrong={(itemId) =>
            setResults((prev) => ({
              ...prev,
              [itemId]: {
                ...prev[itemId],
                times_wrong: prev[itemId].times_wrong + 1,
              },
            }))
          }
          onComplete={() => setPhase("done")}
        />
        <button className="text-sm text-(--muted)" onClick={goToPath}>
          ← Salir
        </button>
      </div>
    );
  }

  if (!target) return null;

  const mastered = Object.values(results).filter((r) => r.answered).length;
  const audioSrc = target.audio ?? null;

  const onPick = (value: number) => {
    if (lockRef.current) return;
    lockRef.current = true;
    if (value === target.value) {
      setFeedback({ value, kind: "correct" });
      setResults((prev) => ({
        ...prev,
        [target.id]: { ...prev[target.id], answered: true },
      }));
      const isLast = queue.length <= 1;
      setTimeout(() => {
        lockRef.current = false;
        setFeedback(null);
        setQueue((q) => q.slice(1));
        if (isLast) setPhase("match");
      }, FEEDBACK_MS);
    } else {
      setFeedback({ value, kind: "wrong" });
      setResults((prev) => ({
        ...prev,
        [target.id]: {
          ...prev[target.id],
          times_wrong: prev[target.id].times_wrong + 1,
        },
      }));
      setTimeout(() => {
        lockRef.current = false;
        setFeedback(null);
        // El fallado vuelve al FINAL de la cola.
        setQueue((q) => (q.length > 1 ? [...q.slice(1), q[0]] : q));
      }, FEEDBACK_MS);
    }
  };

  return (
    <div className="flex flex-col gap-4 w-full">
      <div className="text-center text-sm text-(--muted)">
        Dominados {mastered} de {items.length}
      </div>

      <div className="dots-card flex flex-col items-center gap-3 p-5">
        {audioSrc ? (
          <>
            <span className="text-sm text-(--muted)">Toca para escuchar</span>
            <button
              className="rounded-3xl bg-(--accent) px-8 py-5 text-2xl font-extrabold text-white transition-transform active:scale-95"
              onClick={() => playAudio(audioSrc)}
            >
              🔊 Escuchar
            </button>
          </>
        ) : (
          <>
            <span className="text-sm text-(--muted)">Palabra</span>
            <span className="text-4xl font-extrabold lowercase">
              {target.word}
            </span>
          </>
        )}
      </div>

      <p className="text-center font-semibold">
        {audioSrc ? "¿Qué número escuchas?" : "¿Qué número es?"}
      </p>

      <div className="grid grid-cols-2 gap-3 w-full">
        {options.map((value) => {
          const isPicked = feedback?.value === value;
          const isCorrectPick = isPicked && feedback?.kind === "correct";
          const isWrongPick = isPicked && feedback?.kind === "wrong";
          return (
            <button
              key={value}
              className="rounded-2xl border py-6 text-3xl font-extrabold transition-transform active:scale-95"
              style={{
                borderColor: isCorrectPick
                  ? "var(--accent)"
                  : isWrongPick
                    ? "#e5484d"
                    : "var(--border)",
                background: isCorrectPick
                  ? "color-mix(in srgb, var(--accent) 14%, transparent)"
                  : isWrongPick
                    ? "color-mix(in srgb, #e5484d 12%, transparent)"
                    : "var(--surface)",
                color: isWrongPick ? "#e5484d" : "inherit",
              }}
              onClick={() => onPick(value)}
            >
              {value}
            </button>
          );
        })}
      </div>

      {feedback?.kind === "wrong" && (
        <p className="text-center text-sm text-(--muted)">
          Casi. Este vuelve a la fila.
        </p>
      )}

      <button className="text-sm text-(--muted)" onClick={goToPath}>
        ← Salir
      </button>
    </div>
  );
}

// ── Ronda 2: emparejar numeral ↔ palabra en grupos de hasta 5 pares ──────────

function MatchRound({
  items,
  onWrong,
  onComplete,
}: {
  items: NumberItem[];
  /** Se llama por cada pareja errada, con el id del numeral tocado. */
  onWrong: (itemId: number) => void;
  onComplete: () => void;
}) {
  const chunks = useMemo(() => {
    const out: NumberItem[][] = [];
    for (let i = 0; i < items.length; i += MATCH_CHUNK) {
      out.push(items.slice(i, i + MATCH_CHUNK));
    }
    return out;
  }, [items]);

  const [chunkIdx, setChunkIdx] = useState(0);
  const [matched, setMatched] = useState<Set<number>>(new Set());
  const [selLeft, setSelLeft] = useState<number | null>(null);
  const [selRight, setSelRight] = useState<number | null>(null);
  const [wrongPair, setWrongPair] = useState<{
    left: number;
    right: number;
  } | null>(null);
  const advancingRef = useRef(false); // bloquea taps durante el cambio de grupo

  const chunk = useMemo(() => chunks[chunkIdx] ?? [], [chunks, chunkIdx]);
  const words = useMemo(() => shuffle(chunk), [chunk]);

  const evaluate = (leftId: number, rightId: number) => {
    setSelLeft(null);
    setSelRight(null);
    if (leftId === rightId) {
      const next = new Set(matched).add(leftId);
      setMatched(next);
      if (next.size === chunk.length) {
        advancingRef.current = true;
        const isLastChunk = chunkIdx + 1 >= chunks.length;
        setTimeout(() => {
          advancingRef.current = false;
          if (isLastChunk) {
            onComplete();
          } else {
            setChunkIdx((i) => i + 1);
            setMatched(new Set());
          }
        }, FEEDBACK_MS);
      }
    } else {
      onWrong(leftId);
      setWrongPair({ left: leftId, right: rightId });
      setTimeout(() => setWrongPair(null), FEEDBACK_MS);
    }
  };

  const pickLeft = (id: number) => {
    if (advancingRef.current || matched.has(id)) return;
    if (selRight !== null) evaluate(id, selRight);
    else setSelLeft(id === selLeft ? null : id);
  };
  const pickRight = (id: number) => {
    if (advancingRef.current || matched.has(id)) return;
    if (selLeft !== null) evaluate(selLeft, id);
    else setSelRight(id === selRight ? null : id);
  };

  // Solo color + opacity: sin shakes (RN-safe).
  const pairStyle = (id: number, selected: boolean, isWrong: boolean) => ({
    borderColor: matched.has(id)
      ? "rgba(34,197,94,0.5)"
      : isWrong
        ? "#e5484d"
        : selected
          ? "var(--accent)"
          : "var(--border)",
    background: matched.has(id)
      ? "rgba(34,197,94,0.12)"
      : isWrong
        ? "color-mix(in srgb, #e5484d 12%, transparent)"
        : selected
          ? "color-mix(in srgb, var(--accent) 14%, transparent)"
          : "var(--surface)",
    color: isWrong ? "#e5484d" : "inherit",
    opacity: matched.has(id) ? 0.45 : 1,
  });

  return (
    <div className="flex flex-col gap-3 w-full">
      {chunks.length > 1 && (
        <p className="text-center text-sm text-(--muted)">
          Grupo {chunkIdx + 1} de {chunks.length}
        </p>
      )}
      <div className="grid grid-cols-2 gap-3 w-full">
        <div className="flex flex-col gap-2">
          {chunk.map((item) => (
            <button
              key={item.id}
              className="rounded-2xl border py-4 text-2xl font-extrabold transition-transform active:scale-95"
              style={pairStyle(
                item.id,
                selLeft === item.id,
                wrongPair?.left === item.id,
              )}
              onClick={() => pickLeft(item.id)}
            >
              {item.value}
            </button>
          ))}
        </div>
        <div className="flex flex-col gap-2">
          {words.map((item) => (
            <button
              key={item.id}
              className="rounded-2xl border py-4 font-semibold lowercase transition-transform active:scale-95"
              style={pairStyle(
                item.id,
                selRight === item.id,
                wrongPair?.right === item.id,
              )}
              onClick={() => pickRight(item.id)}
            >
              {item.word}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
