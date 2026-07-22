"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import Spinner from "@/components/ui/Spinner/Spinner";
import UIButton from "@/components/ui/button/button";
import { useAuth } from "@/context/auth-context";
import {
  getNodeContentService,
  putNodeProgressService,
  type LettersContent,
} from "@/services/lessons.service";

// ── Drill (inline; RN-safe: tap-only, no keyboard/drag/inputs) ────────────────

type ItemResult = { times_wrong: number; answered: boolean };

/** Fisher–Yates on a copy — pure, safe to call inside useMemo. */
function shuffle<T>(arr: T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

const ADVANCE_DELAY_MS = 500;

interface DrillProps {
  nodeId: number;
  content: LettersContent;
}

function LettersDrill({ nodeId, content }: DrillProps) {
  const router = useRouter();
  const items = content.items;

  const [idx, setIdx] = useState(0);
  const [results, setResults] = useState<Record<number, ItemResult>>(() => {
    const seed: Record<number, ItemResult> = {};
    for (const it of items) seed[it.id] = { times_wrong: 0, answered: false };
    return seed;
  });
  // Per-tap feedback: which letter was picked and whether it was right/wrong.
  const [picked, setPicked] = useState<{ letter: string; correct: boolean } | null>(
    null,
  );
  const [done, setDone] = useState(false);
  const sentRef = useRef(false);

  const goToPath = () => router.push("/levels");

  const target = items[idx];

  // Options: the correct letter + up to 3 distinct distractor letters. Shuffled
  // once per question (memo keyed on idx) so re-renders don't reshuffle.
  const options = useMemo(() => {
    if (!target) return [] as string[];
    const distractors: string[] = [];
    const seen = new Set<string>([target.letter]);
    for (const it of items) {
      if (seen.has(it.letter)) continue;
      seen.add(it.letter);
      distractors.push(it.letter);
    }
    const picks = shuffle(distractors).slice(0, 3);
    return shuffle([target.letter, ...picks]);
    // idx drives the question change; items/target are stable per node.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx, items]);

  const submitOnce = (finalResults: Record<number, ItemResult>) => {
    if (sentRef.current) return;
    sentRef.current = true;
    putNodeProgressService(
      nodeId,
      Object.entries(finalResults).map(([id, r]) => ({
        id: Number(id),
        times_wrong: r.times_wrong,
        answered: r.answered,
      })),
    ).catch(console.error);
  };

  const onPick = (letter: string) => {
    if (!target || picked?.correct) return; // ignore taps mid-advance

    if (letter === target.letter) {
      const next = {
        ...results,
        [target.id]: { ...results[target.id], answered: true },
      };
      setResults(next);
      setPicked({ letter, correct: true });
      const isLast = idx >= items.length - 1;
      // Short "correct" highlight, then advance (or finish). setTimeout lives in
      // an event handler, never in a useEffect body.
      setTimeout(() => {
        if (isLast) {
          submitOnce(next);
          setDone(true);
        } else {
          setIdx((i) => i + 1);
          setPicked(null);
        }
      }, ADVANCE_DELAY_MS);
    } else {
      setResults((prev) => ({
        ...prev,
        [target.id]: {
          ...prev[target.id],
          times_wrong: prev[target.id].times_wrong + 1,
        },
      }));
      setPicked({ letter, correct: false });
      // No advance — let the learner tap again.
    }
  };

  // Empty lesson — friendly state, do NOT submit progress.
  if (items.length === 0) {
    return (
      <div className="dots-card flex flex-col items-center gap-4 p-6 text-center">
        <p className="text-sm text-(--muted)">
          Aún no hay contenido en esta lección.
        </p>
        <UIButton tone="accent" onClick={goToPath} fullWidth>
          Volver
        </UIButton>
      </div>
    );
  }

  if (done) {
    return (
      <div className="dots-card flex flex-col items-center gap-4 p-8 text-center">
        <span className="text-5xl">🎉</span>
        <h2 className="text-xl font-extrabold text-(--accent)">¡Listo!</h2>
        <p className="text-sm text-(--muted)">
          Completaste la lección de letras.
        </p>
        <UIButton tone="accent" onClick={goToPath} fullWidth>
          Volver al camino
        </UIButton>
      </div>
    );
  }

  if (!target) return null;

  const example = target.exampleWord
    ? `${target.exampleWord}${target.exampleMeaning ? ` — ${target.exampleMeaning}` : ""}`
    : null;
  const prompt = target.name || target.exampleWord || "esta letra";

  return (
    <div className="flex w-full flex-col gap-4">
      {/* Progress: n de N */}
      <p className="text-center text-xs font-bold text-(--muted)">
        {idx + 1} de {items.length}
      </p>

      {/* Letter card */}
      <div className="dots-card flex flex-col items-center gap-3 p-6 text-center">
        <span className="text-6xl font-extrabold text-(--accent)">
          {target.letter}
        </span>
        <span className="text-lg font-bold text-(--foreground)">
          {target.name}
        </span>
        {example && <span className="text-sm text-(--muted)">{example}</span>}
        {target.audio && (
          <UIButton
            tone="neutral"
            onClick={() => {
              // Tap gesture legalizes the autoplay.
              void new Audio(target.audio as string).play().catch(() => {});
            }}
          >
            🔊 Escuchar
          </UIButton>
        )}
      </div>

      {/* Prompt + letter options */}
      <p className="text-center text-sm font-bold text-(--foreground)">
        ¿Qué letra corresponde a{" "}
        <span className="text-(--accent)">{prompt}</span>?
      </p>
      <div className="grid grid-cols-2 gap-3">
        {options.map((letter) => {
          const isPicked = picked?.letter === letter;
          const style: React.CSSProperties = isPicked
            ? picked.correct
              ? {
                  background: "color-mix(in srgb, var(--accent) 18%, transparent)",
                  borderColor: "var(--accent)",
                  color: "var(--accent)",
                }
              : {
                  background: "color-mix(in srgb, #ef4444 14%, transparent)",
                  borderColor: "#ef4444",
                  color: "#ef4444",
                }
            : {
                background: "var(--surface)",
                borderColor: "var(--border)",
                color: "var(--foreground)",
              };
          return (
            <button
              key={letter}
              type="button"
              onClick={() => onPick(letter)}
              className="dots-pressable rounded-2xl border-2 py-6 text-3xl font-extrabold cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--accent) focus-visible:ring-offset-2"
              style={style}
            >
              {letter}
            </button>
          );
        })}
      </div>

      {picked && !picked.correct && (
        <p className="text-center text-sm font-bold" style={{ color: "#ef4444" }}>
          Casi. Inténtalo de nuevo.
        </p>
      )}

      <UIButton tone="ghost" onClick={goToPath}>
        ← Salir
      </UIButton>
    </div>
  );
}

// ── Client (reads ?id=, gates on auth, fetches content) ───────────────────────

function LettersClient() {
  const searchParams = useSearchParams();
  const nodeId = Number(searchParams.get("id") ?? "0");
  const { isBootstrapping } = useAuth();

  const [content, setContent] = useState<LettersContent | null>(null);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (isBootstrapping || !nodeId) return;
    getNodeContentService(nodeId)
      .then((data) => {
        if (data.type === "letters") setContent(data);
        else setError(true);
      })
      .catch(() => setError(true));
  }, [nodeId, isBootstrapping, attempt]);

  if (error) {
    return (
      <div className="flex flex-col items-center gap-4 py-10 text-center">
        <p className="text-sm text-(--muted)">
          No pudimos cargar este ejercicio.
        </p>
        <UIButton
          tone="accent"
          onClick={() => {
            // fetchAttempt retry: bump the counter, the effect re-fetches.
            setError(false);
            setAttempt((a) => a + 1);
          }}
        >
          Reintentar
        </UIButton>
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

  return <LettersDrill nodeId={nodeId} content={content} />;
}

export default function LettersPage() {
  return (
    <main className="mx-auto w-full max-w-xl flex flex-col gap-4 p-4">
      <Suspense
        fallback={
          <div className="flex justify-center py-16">
            <Spinner />
          </div>
        }
      >
        <LettersClient />
      </Suspense>
    </main>
  );
}
