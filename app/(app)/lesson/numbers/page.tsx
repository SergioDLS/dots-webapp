"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import Spinner from "@/components/ui/Spinner/Spinner";
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

// ── Drill: word → numeral, tap-only, RN-safe ─────────────────────────────────

type ItemResult = { times_wrong: number; answered: boolean };

const OPTION_COUNT = 4;
const CORRECT_HOLD_MS = 500;

/** Deterministic-ish shuffle (Fisher–Yates) for the option order. */
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

  const [idx, setIdx] = useState(0);
  const [results, setResults] = useState<Record<number, ItemResult>>(() => {
    const seed: Record<number, ItemResult> = {};
    for (const it of items) seed[it.id] = { times_wrong: 0, answered: false };
    return seed;
  });
  const [picked, setPicked] = useState<number | null>(null);
  const [pickState, setPickState] = useState<"" | "correct" | "wrong">("");
  const [done, setDone] = useState(false);
  const sentRef = useRef(false);

  const goToPath = () => router.push("/levels");

  const target = items[idx];

  // Options: the target value + up to 3 distinct distractor values, shuffled.
  // Memoized per item so taps don't reshuffle the buttons mid-question.
  const options = useMemo(() => {
    if (!target) return [] as number[];
    const pool: number[] = [];
    const seen = new Set<number>([target.value]);
    for (const it of items) {
      if (seen.has(it.value)) continue;
      seen.add(it.value);
      pool.push(it.value);
    }
    const distractors = shuffle(pool).slice(0, OPTION_COUNT - 1);
    return shuffle([target.value, ...distractors]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target?.id]);

  // Submit progress exactly once when the last item is answered.
  useEffect(() => {
    if (!done || sentRef.current) return;
    sentRef.current = true;
    const payload = Object.entries(results).map(([id, r]) => ({
      id: Number(id),
      times_wrong: r.times_wrong,
      answered: r.answered,
    }));
    putNodeProgressService(nodeId, payload).catch(console.error);
  }, [done, results, nodeId]);

  // Empty content: friendly state, no submit.
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

  if (done) {
    return (
      <div className="flex flex-col items-center gap-4 py-10">
        <p className="text-3xl font-extrabold">¡Listo!</p>
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

  if (!target) return null;

  const onPick = (value: number) => {
    if (pickState === "correct") return; // locked while advancing
    if (value === target.value) {
      setPicked(value);
      setPickState("correct");
      setResults((prev) => ({
        ...prev,
        [target.id]: { ...prev[target.id], answered: true },
      }));
      const isLast = idx >= items.length - 1;
      setTimeout(() => {
        if (isLast) {
          setDone(true);
        } else {
          setIdx((n) => n + 1);
          setPicked(null);
          setPickState("");
        }
      }, CORRECT_HOLD_MS);
    } else {
      setPicked(value);
      setPickState("wrong");
      setResults((prev) => ({
        ...prev,
        [target.id]: {
          ...prev[target.id],
          times_wrong: prev[target.id].times_wrong + 1,
        },
      }));
    }
  };

  return (
    <div className="flex flex-col gap-4 w-full">
      <div className="text-center text-sm text-(--muted)">
        {idx + 1} / {items.length}
      </div>

      <div className="dots-card flex flex-col items-center gap-3 p-5">
        <span className="text-sm text-(--muted)">Palabra</span>
        <span className="text-4xl font-extrabold lowercase">{target.word}</span>

        {target.audio && (
          <button
            className="rounded-2xl border border-(--border) bg-(--surface) px-4 py-2 font-semibold text-(--accent)"
            onClick={() => {
              new Audio(target.audio as string).play().catch(() => {});
            }}
          >
            🔊 Escuchar
          </button>
        )}

        {target.img && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={target.img}
            alt={target.word}
            className="max-w-full h-auto rounded-2xl"
          />
        )}
      </div>

      <p className="text-center font-semibold">¿Qué número es?</p>

      <div className="grid grid-cols-2 gap-3 w-full">
        {options.map((value) => {
          const isPicked = picked === value;
          const isCorrectPick = isPicked && pickState === "correct";
          const isWrongPick = isPicked && pickState === "wrong";
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

      {pickState === "wrong" && (
        <p className="text-center text-sm text-(--muted)">
          Casi. Inténtalo otra vez.
        </p>
      )}

      <button className="text-sm text-(--muted)" onClick={goToPath}>
        ← Salir
      </button>
    </div>
  );
}
