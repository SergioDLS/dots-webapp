"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import Spinner from "@/components/ui/Spinner/Spinner";
import UIButton from "@/components/ui/button/button";
import { BASE_URL_SOUNDS } from "@/constants";
import { useAuth } from "@/context/auth-context";
import {
  getNodeContentService,
  putNodeProgressService,
  type LettersContent,
} from "@/services/lessons.service";

// ── Audio (absolute Cloudinary URLs pass through; legacy paths resolve) ───────

const resolveAudio = (src: string) =>
  /^https?:\/\//.test(src) ? src : `${BASE_URL_SOUNDS}/${src}`;

/** Call ONLY from tap handlers — the gesture legalizes the playback. */
const playAudio = (src: string) => {
  void new Audio(resolveAudio(src)).play().catch(() => {});
};

// ── Drill (inline; RN-safe: tap-only, no keyboard/drag/inputs) ────────────────
//
// Ear-first flow: stage "present" (tap every letter to hear it) → stage
// "drill" (hear a clip, pick the letter; wrong answers re-queue until every
// letter is mastered) → stage "done" (submit once, show first-try score).

type ItemResult = { times_wrong: number; answered: boolean };
type Stage = "present" | "drill" | "done";
type Feedback = "idle" | "correct" | "wrong";

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
const WRONG_DELAY_MS = 800;

const CORRECT_STYLE: React.CSSProperties = {
  background: "color-mix(in srgb, var(--accent) 18%, transparent)",
  borderColor: "var(--accent)",
  color: "var(--accent)",
};
const WRONG_STYLE: React.CSSProperties = {
  background: "color-mix(in srgb, #ef4444 14%, transparent)",
  borderColor: "#ef4444",
  color: "#ef4444",
};
const NEUTRAL_STYLE: React.CSSProperties = {
  background: "var(--surface)",
  borderColor: "var(--border)",
  color: "var(--foreground)",
};

interface DrillProps {
  nodeId: number;
  content: LettersContent;
}

function LettersDrill({ nodeId, content }: DrillProps) {
  const router = useRouter();
  const items = content.items;

  const [stage, setStage] = useState<Stage>("present");
  // Present stage: which letters the learner already tapped/heard.
  const [seen, setSeen] = useState<Set<number>>(() => new Set());
  // Drill stage: ids pending mastery (head = current turn).
  const [queue, setQueue] = useState<number[]>([]);
  const [results, setResults] = useState<Record<number, ItemResult>>(() => {
    const seed: Record<number, ItemResult> = {};
    for (const it of items) seed[it.id] = { times_wrong: 0, answered: false };
    return seed;
  });
  const [feedback, setFeedback] = useState<Feedback>("idle");
  const [picked, setPicked] = useState<string | null>(null);
  // Blocks option taps while the correct/wrong flash is on screen.
  const advancingRef = useRef(false);
  const sentRef = useRef(false);

  const goToPath = () => router.push("/levels");

  const targetId = queue[0];
  const target = items.find((it) => it.id === targetId);

  // Options: the correct letter + up to 3 distinct distractor letters, shuffled
  // once per turn (memo keyed on the target id + queue length so a re-queue of
  // the same letter later still reshuffles).
  const options = useMemo(() => {
    if (!target) return [] as string[];
    const distractors: string[] = [];
    const dedupe = new Set<string>([target.letter]);
    for (const it of items) {
      if (dedupe.has(it.letter)) continue;
      dedupe.add(it.letter);
      distractors.push(it.letter);
    }
    const picks = shuffle(distractors).slice(0, 3);
    return shuffle([target.letter, ...picks]);
    // targetId + queue.length drive the turn change; target derives from them.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetId, queue.length, items]);

  const submitOnce = (finalResults: Record<number, ItemResult>) => {
    if (sentRef.current) return;
    sentRef.current = true;
    putNodeProgressService(
      nodeId,
      items.map((it) => ({
        id: it.id,
        times_wrong: finalResults[it.id]?.times_wrong ?? 0,
        answered: true,
      })),
    ).catch(console.error);
  };

  // Present stage: tap a card → hear the letter (if it has audio) + mark seen.
  const onPresentTap = (item: LettersContent["items"][number]) => {
    if (item.audio) playAudio(item.audio);
    setSeen((prev) => new Set(prev).add(item.id));
  };

  // Practicar: audio items first (shuffled); audio-less stragglers go last as
  // a visual queue (their prompt is text instead of a clip).
  const startDrill = () => {
    const withAudio = items.filter((it) => it.audio).map((it) => it.id);
    const withoutAudio = items.filter((it) => !it.audio).map((it) => it.id);
    setQueue([...shuffle(withAudio), ...shuffle(withoutAudio)]);
    setStage("drill");
  };

  const onPick = (letter: string) => {
    if (!target || advancingRef.current) return;
    advancingRef.current = true;

    if (letter === target.letter) {
      const next = {
        ...results,
        [target.id]: { ...results[target.id], answered: true },
      };
      setResults(next);
      setPicked(letter);
      setFeedback("correct");
      const isLast = queue.length <= 1;
      // Short flash, then advance (or finish). setTimeout lives in an event
      // handler, never in a useEffect body.
      setTimeout(() => {
        advancingRef.current = false;
        if (isLast) {
          submitOnce(next);
          setStage("done");
        } else {
          setQueue((q) => q.slice(1));
          setFeedback("idle");
          setPicked(null);
        }
      }, ADVANCE_DELAY_MS);
    } else {
      // One attempt per turn: brief red flash, then the letter goes to the END
      // of the queue — the lesson only ends when every letter is answered.
      const next = {
        ...results,
        [target.id]: {
          ...results[target.id],
          times_wrong: results[target.id].times_wrong + 1,
        },
      };
      setResults(next);
      setPicked(letter);
      setFeedback("wrong");
      setTimeout(() => {
        advancingRef.current = false;
        setQueue((q) => [...q.slice(1), q[0]]);
        setFeedback("idle");
        setPicked(null);
      }, WRONG_DELAY_MS);
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

  if (stage === "done") {
    const firstTry = items.filter(
      (it) => (results[it.id]?.times_wrong ?? 0) === 0,
    ).length;
    return (
      <div className="dots-card flex flex-col items-center gap-4 p-8 text-center">
        <span className="text-5xl">🎉</span>
        <h2 className="text-xl font-extrabold text-(--accent)">¡Listo!</h2>
        <p className="text-sm text-(--muted)">
          {firstTry}/{items.length} a la primera
        </p>
        <UIButton tone="accent" onClick={goToPath} fullWidth>
          Volver al camino
        </UIButton>
      </div>
    );
  }

  if (stage === "present") {
    const allSeen = seen.size >= items.length;
    return (
      <div className="flex w-full flex-col gap-4">
        <h1 className="text-center text-lg font-extrabold text-(--foreground)">
          {content.title}
        </h1>
        <p className="text-center text-xs font-bold text-(--muted)">
          Toca cada letra para oírla ({seen.size}/{items.length})
        </p>

        <div className="grid grid-cols-4 gap-2">
          {items.map((it) => {
            const isSeen = seen.has(it.id);
            return (
              <button
                key={it.id}
                type="button"
                onClick={() => onPresentTap(it)}
                className="dots-pressable flex flex-col items-center gap-1 rounded-2xl border-2 px-1 py-4 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--accent) focus-visible:ring-offset-2"
                style={isSeen ? CORRECT_STYLE : NEUTRAL_STYLE}
              >
                <span className="text-3xl font-extrabold">{it.letter}</span>
                <span className="text-[11px] font-bold text-(--muted)">
                  {isSeen ? "✓" : "🔊"}
                </span>
              </button>
            );
          })}
        </div>

        <UIButton
          tone="accent"
          fullWidth
          disabled={!allSeen}
          onClick={startDrill}
        >
          Practicar
        </UIButton>
        <UIButton tone="ghost" onClick={goToPath}>
          ← Salir
        </UIButton>
      </div>
    );
  }

  if (!target) return null;

  const answeredCount = Object.values(results).filter((r) => r.answered).length;
  const textPrompt = target.name || target.exampleWord || target.letter;

  return (
    <div className="flex w-full flex-col gap-4">
      {/* Mastery progress */}
      <p className="text-center text-xs font-bold text-(--muted)">
        Dominadas {answeredCount} de {items.length}
      </p>

      {/* Prompt: hear the clip (tap to replay) — or text if the item lacks audio */}
      <div className="dots-card flex flex-col items-center gap-3 p-6 text-center">
        {target.audio ? (
          <>
            <button
              type="button"
              onClick={() => playAudio(target.audio as string)}
              className="dots-pressable flex h-24 w-24 items-center justify-center rounded-full text-4xl cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--accent) focus-visible:ring-offset-2"
              style={{
                background: "var(--accent)",
                color: "var(--accent-contrast)",
              }}
            >
              🔊
            </button>
            <p className="text-sm font-bold text-(--foreground)">
              ¿Qué letra escuchaste?
            </p>
            <p className="text-xs text-(--muted)">
              Toca el altavoz para repetir el audio.
            </p>
          </>
        ) : (
          <>
            <span className="text-2xl font-extrabold text-(--accent)">
              {textPrompt}
            </span>
            <p className="text-sm font-bold text-(--foreground)">
              ¿Qué letra corresponde?
            </p>
          </>
        )}
      </div>

      {/* Letter options */}
      <div className="grid grid-cols-2 gap-3">
        {options.map((letter) => {
          const isPicked = picked === letter;
          const style: React.CSSProperties =
            isPicked && feedback === "correct"
              ? CORRECT_STYLE
              : isPicked && feedback === "wrong"
                ? WRONG_STYLE
                : NEUTRAL_STYLE;
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

      {feedback === "wrong" && (
        <p className="text-center text-sm font-bold" style={{ color: "#ef4444" }}>
          Casi — esta letra volverá a salir.
        </p>
      )}
      {feedback === "correct" && (
        <p className="text-center text-sm font-bold text-(--accent)">¡Bien!</p>
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
