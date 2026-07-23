"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import Spinner from "@/components/ui/Spinner/Spinner";
import UIButton from "@/components/ui/button/button";
import AudioChoiceQuiz, {
  type AudioChoice,
} from "@/components/lesson/shared/audio-choice-quiz";
import { useAuth } from "@/context/auth-context";
import { useLessonAudio } from "@/hooks/use-lesson-audio";
import { useLessonSession } from "@/hooks/use-lesson-session";
import {
  getNodeContentService,
  putNodeProgressService,
  type LettersContent,
  type NodeProgressReward,
} from "@/services/lessons.service";

// ── Sesión por tramos (F3e) ───────────────────────────────────────────────────
//
// Cada sesión toma 6–7 letras (a-reforzar → nuevas → 1–2 de repaso):
// presentación SOLO de las nuevas → ronda directa (escucha con autoplay →
// elige la letra) → ronda inversa (ve la letra → elige el audio) → cierre con
// "Seguir practicando". Fallos re-encolados hasta responder todo (dominio).

type ItemResult = { times_wrong: number; answered: boolean };
type Stage = "present" | "direct" | "inverse" | "done";
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

// El acierto repite el clip como refuerzo: el avance espera a que se oiga.
const ADVANCE_DELAY_MS = 800;
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
  /** Re-fetchea el contenido → nueva sesión con otro tramo. */
  onRestart: () => void;
}

function LettersDrill({ nodeId, content, onRestart }: DrillProps) {
  const router = useRouter();
  const play = useLessonAudio();
  const session = useLessonSession(content.items);
  const tramo = session.tramo;

  const [stage, setStage] = useState<Stage>(() =>
    session.newItems.length > 0 ? "present" : "direct",
  );
  // Present stage: which NEW letters the learner already tapped/heard.
  const [seen, setSeen] = useState<Set<number>>(() => new Set());
  // Direct stage: ids pending mastery (head = current turn).
  const [queue, setQueue] = useState<number[]>(() => {
    const withAudio = tramo.filter((it) => it.audio).map((it) => it.id);
    const withoutAudio = tramo.filter((it) => !it.audio).map((it) => it.id);
    return [...shuffle(withAudio), ...shuffle(withoutAudio)];
  });
  const [results, setResults] = useState<Record<number, ItemResult>>(() => {
    const seed: Record<number, ItemResult> = {};
    for (const it of tramo) seed[it.id] = { times_wrong: 0, answered: false };
    return seed;
  });
  const [feedback, setFeedback] = useState<Feedback>("idle");
  const [picked, setPicked] = useState<string | null>(null);
  const [reward, setReward] = useState<NodeProgressReward | null>(null);
  // Aciertos a la primera, congelados al cerrar la sesión (los refs no se
  // leen durante render — regla del compiler).
  const [firstTry, setFirstTry] = useState(0);
  // Blocks option taps while the correct/wrong flash is on screen.
  const advancingRef = useRef(false);
  const sentRef = useRef(false);
  const wrongByItem = useRef<Map<number, number>>(new Map());

  const goToPath = () => router.push("/levels");

  const targetId = queue[0];
  const target = tramo.find((it) => it.id === targetId);
  const targetAudio = target?.audio ?? null;

  // Autoplay: el clip del turno suena al entrar (la activación viene del tap
  // de "Practicar"/respuestas previas). Solo reproduce — sin setState.
  useEffect(() => {
    if (stage !== "direct" || targetId == null) return;
    if (targetAudio) play(targetAudio);
  }, [stage, targetId, targetAudio, play]);

  // Ronda inversa: ítems del tramo con audio; distractores del pack completo.
  const inverseItems = useMemo<AudioChoice[]>(
    () =>
      tramo
        .filter((it) => it.audio)
        .map((it) => ({ id: it.id, prompt: it.letter, audio: it.audio! })),
    [tramo],
  );
  const inversePool = useMemo<AudioChoice[]>(
    () =>
      content.items
        .filter((it) => it.audio)
        .map((it) => ({ id: it.id, prompt: it.letter, audio: it.audio! })),
    [content.items],
  );
  const hasInverse = inverseItems.length >= 2;

  // Options: the correct letter + up to 3 distinct distractors from the WHOLE
  // pack, shuffled once per turn.
  const options = useMemo(() => {
    if (!target) return [] as string[];
    const distractors: string[] = [];
    const dedupe = new Set<string>([target.letter]);
    for (const it of shuffle(content.items)) {
      if (dedupe.has(it.letter)) continue;
      dedupe.add(it.letter);
      distractors.push(it.letter);
    }
    const picks = distractors.slice(0, 3);
    return shuffle([target.letter, ...picks]);
    // targetId + queue.length drive the turn change; target derives from them.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetId, queue.length, content.items]);

  // Envía SOLO los ítems del tramo, una vez (guard con ref).
  const finishSession = (finalResults: Record<number, ItemResult>) => {
    setStage("done");
    if (sentRef.current) return;
    sentRef.current = true;
    const payload = tramo.map((it) => ({
      id: it.id,
      times_wrong:
        (finalResults[it.id]?.times_wrong ?? 0) +
        (wrongByItem.current.get(it.id) ?? 0),
      answered: true,
    }));
    setFirstTry(payload.filter((it) => it.times_wrong === 0).length);
    putNodeProgressService(nodeId, payload).then(setReward).catch(console.error);
  };

  const endDirectRound = (finalResults: Record<number, ItemResult>) => {
    if (hasInverse) setStage("inverse");
    else finishSession(finalResults);
  };

  // Present stage: tap a card → hear the letter + mark seen.
  const onPresentTap = (item: LettersContent["items"][number]) => {
    if (item.audio) play(item.audio);
    setSeen((prev) => new Set(prev).add(item.id));
  };

  const onPick = (letter: string) => {
    if (!target || advancingRef.current) return;
    advancingRef.current = true;

    if (letter === target.letter) {
      // Refuerzo: se repite el clip al acertar.
      if (target.audio) play(target.audio);
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
        setFeedback("idle");
        setPicked(null);
        if (isLast) {
          endDirectRound(next);
        } else {
          setQueue((q) => q.slice(1));
        }
      }, ADVANCE_DELAY_MS);
    } else {
      // One attempt per turn: brief red flash, then the letter goes to the END
      // of the queue — the round only ends when every letter is answered.
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
  if (content.items.length === 0) {
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
    const learnedNow =
      reward?.mastery != null
        ? Math.round((reward.mastery / 100) * session.packTotal)
        : null;
    return (
      <div className="dots-card flex flex-col items-center gap-4 p-8 text-center">
        <span className="text-5xl">🎉</span>
        <h2 className="text-xl font-extrabold text-(--accent)">
          {session.isReview ? "¡Repaso completo!" : "¡Sesión lista!"}
        </h2>
        <p className="text-sm text-(--muted)">
          {firstTry}/{tramo.length} a la primera
        </p>
        {learnedNow != null && (
          <p className="text-sm font-bold text-(--foreground)">
            👑 Aprendidas {learnedNow} de {session.packTotal}
          </p>
        )}
        {reward && (
          <p className="text-xs font-bold text-(--muted)">
            +{reward.xpGained} XP
          </p>
        )}
        <UIButton tone="accent" onClick={onRestart} fullWidth>
          Seguir practicando
        </UIButton>
        <UIButton tone="ghost" onClick={goToPath} fullWidth>
          Volver al camino
        </UIButton>
      </div>
    );
  }

  if (stage === "present") {
    const newItems = session.newItems;
    const allSeen = seen.size >= newItems.length;
    return (
      <div className="flex w-full flex-col gap-4">
        <h1 className="text-center text-lg font-extrabold text-(--foreground)">
          {content.title}
        </h1>
        <p className="text-center text-xs font-bold text-(--muted)">
          Letras nuevas de esta sesión — toca cada una para oírla ({seen.size}/
          {newItems.length})
        </p>

        <div className="grid grid-cols-4 gap-2">
          {newItems.map((it) => {
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
          onClick={() => setStage("direct")}
        >
          Practicar
        </UIButton>
        <UIButton tone="ghost" onClick={goToPath}>
          ← Salir
        </UIButton>
      </div>
    );
  }

  if (stage === "inverse") {
    return (
      <div className="flex w-full flex-col gap-4">
        <p className="text-center text-xs font-bold text-(--muted)">
          Aprendidas {session.learnedBefore} de {session.packTotal} · ahora al
          revés
        </p>
        <div className="dots-card p-5">
          <AudioChoiceQuiz
            items={inverseItems}
            pool={inversePool}
            play={play}
            onWrong={(itemId) =>
              wrongByItem.current.set(
                itemId,
                (wrongByItem.current.get(itemId) ?? 0) + 1,
              )
            }
            onComplete={() => finishSession(results)}
          />
        </div>
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
      {/* Session + pack progress */}
      <p className="text-center text-xs font-bold text-(--muted)">
        Aprendidas {session.learnedBefore} de {session.packTotal} · sesión{" "}
        {answeredCount}/{tramo.length}
      </p>

      {/* Prompt: the clip autoplays (tap to replay) — or text if no audio */}
      <div className="dots-card flex flex-col items-center gap-3 p-6 text-center">
        {target.audio ? (
          <>
            <button
              type="button"
              onClick={() => play(target.audio)}
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

  return (
    <LettersDrill
      // Remount per fetch: cada sesión arma su propio tramo desde cero.
      key={attempt}
      nodeId={nodeId}
      content={content}
      onRestart={() => {
        // "Seguir practicando": re-fetch → dominio fresco → tramo nuevo.
        setContent(null);
        setAttempt((a) => a + 1);
      }}
    />
  );
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
