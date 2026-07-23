"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import Spinner from "@/components/ui/Spinner/Spinner";
import AudioChoiceQuiz, {
  type AudioChoice,
} from "@/components/lesson/shared/audio-choice-quiz";
import { useAuth } from "@/context/auth-context";
import { useLessonAudio } from "@/hooks/use-lesson-audio";
import { useLessonSession } from "@/hooks/use-lesson-session";
import {
  getNodeContentService,
  putNodeProgressService,
  type NodeProgressReward,
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
  return (
    <NumbersDrill
      // Remount per fetch: cada sesión arma su propio tramo desde cero.
      key={attempt}
      nodeId={nodeId}
      content={content}
      onRestart={() => {
        setContent(null);
        setAttempt((n) => n + 1);
      }}
    />
  );
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

// ── Drill por tramos (F3e): escucha→numeral (autoplay) + inversa + emparejar ──
// Tap-only, RN-safe. Animación solo transform/opacity.

type NumberItem = NumbersContent["items"][number];
type ItemResult = { times_wrong: number; answered: boolean };

const OPTION_COUNT = 4;
// El acierto repite el clip como refuerzo: el avance espera a que se oiga.
const FEEDBACK_MS = 800;
const MATCH_CHUNK = 5;

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
  onRestart,
}: {
  nodeId: number;
  content: NumbersContent;
  /** Re-fetchea el contenido → nueva sesión con otro tramo. */
  onRestart: () => void;
}) {
  const router = useRouter();
  const play = useLessonAudio();
  const session = useLessonSession(content.items);
  const tramo = session.tramo;

  const [phase, setPhase] = useState<"recognize" | "inverse" | "match" | "done">(
    "recognize",
  );
  // Cola de dominio: ids del tramo por responder; los fallados vuelven al final.
  const [queue, setQueue] = useState<number[]>(() =>
    shuffle(tramo.map((it) => it.id)),
  );
  const [results, setResults] = useState<Record<number, ItemResult>>(() => {
    const seed: Record<number, ItemResult> = {};
    for (const it of tramo) seed[it.id] = { times_wrong: 0, answered: false };
    return seed;
  });
  const [feedback, setFeedback] = useState<{
    value: number;
    kind: "correct" | "wrong";
  } | null>(null);
  const [reward, setReward] = useState<NodeProgressReward | null>(null);
  // Aciertos a la primera, congelados al cerrar la sesión (los refs no se
  // leen durante render — regla del compiler).
  const [firstTry, setFirstTry] = useState(0);
  const lockRef = useRef(false); // bloquea taps mientras se muestra feedback
  const sentRef = useRef(false);
  const wrongExtra = useRef<Map<number, number>>(new Map());

  const goToPath = () => router.push("/levels");

  const targetId = queue[0];
  const target = tramo.find((it) => it.id === targetId);
  const targetAudio = target?.audio ?? null;

  // Autoplay del turno (la activación de usuario viene de taps previos).
  useEffect(() => {
    if (phase !== "recognize" || targetId == null) return;
    if (targetAudio) play(targetAudio);
  }, [phase, targetId, targetAudio, play]);

  // Ronda inversa: numeral → elige el audio. Distractores del pack completo.
  const inverseItems = useMemo<AudioChoice[]>(
    () =>
      tramo
        .filter((it) => it.audio)
        .map((it) => ({ id: it.id, prompt: String(it.value), audio: it.audio! })),
    [tramo],
  );
  const inversePool = useMemo<AudioChoice[]>(
    () =>
      content.items
        .filter((it) => it.audio)
        .map((it) => ({ id: it.id, prompt: String(it.value), audio: it.audio! })),
    [content.items],
  );
  const hasInverse = inverseItems.length >= 2;

  // Opciones: valor objetivo + hasta 3 distractores únicos del pack completo.
  const options = useMemo(() => {
    const t = tramo.find((it) => it.id === targetId);
    if (!t) return [] as number[];
    const seen = new Set<number>([t.value]);
    const pool: number[] = [];
    for (const it of content.items) {
      if (seen.has(it.value)) continue;
      seen.add(it.value);
      pool.push(it.value);
    }
    const distractors = shuffle(pool).slice(0, OPTION_COUNT - 1);
    return shuffle([t.value, ...distractors]);
  }, [tramo, content.items, targetId]);

  // Envía SOLO los ítems del tramo, una vez (guard con ref).
  const finishSession = () => {
    setPhase("done");
    if (sentRef.current) return;
    sentRef.current = true;
    const payload = tramo.map((it) => ({
      id: it.id,
      times_wrong:
        (results[it.id]?.times_wrong ?? 0) + (wrongExtra.current.get(it.id) ?? 0),
      answered: true,
    }));
    setFirstTry(payload.filter((it) => it.times_wrong === 0).length);
    putNodeProgressService(nodeId, payload).then(setReward).catch(console.error);
  };

  // Vacío: pantalla amable, sin submit.
  if (content.items.length === 0) {
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
    const learnedNow =
      reward?.mastery != null
        ? Math.round((reward.mastery / 100) * session.packTotal)
        : null;
    return (
      <div className="flex flex-col items-center gap-4 py-10">
        <p className="text-3xl font-extrabold">
          {session.isReview ? "¡Repaso completo!" : "¡Sesión lista!"}
        </p>
        <p className="text-center font-semibold">
          {firstTry}/{tramo.length} a la primera
        </p>
        {learnedNow != null && (
          <p className="text-center font-semibold">
            👑 Aprendidos {learnedNow} de {session.packTotal}
          </p>
        )}
        {reward && (
          <p className="text-center text-sm text-(--muted)">
            +{reward.xpGained} XP
          </p>
        )}
        <button
          className="rounded-2xl bg-(--accent) px-6 py-3 font-bold text-white"
          onClick={onRestart}
        >
          Seguir practicando
        </button>
        <button className="text-sm text-(--muted)" onClick={goToPath}>
          Volver al camino
        </button>
      </div>
    );
  }

  if (phase === "inverse") {
    return (
      <div className="flex flex-col gap-4 w-full">
        <p className="text-center text-sm text-(--muted)">
          Aprendidos {session.learnedBefore} de {session.packTotal} · ahora al
          revés
        </p>
        <div className="dots-card p-5">
          <AudioChoiceQuiz
            items={inverseItems}
            pool={inversePool}
            play={play}
            onWrong={(itemId) =>
              wrongExtra.current.set(
                itemId,
                (wrongExtra.current.get(itemId) ?? 0) + 1,
              )
            }
            onComplete={() => setPhase("match")}
          />
        </div>
        <button className="text-sm text-(--muted)" onClick={goToPath}>
          ← Salir
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
          items={tramo}
          onWrong={(itemId) =>
            setResults((prev) => ({
              ...prev,
              [itemId]: {
                ...prev[itemId],
                times_wrong: prev[itemId].times_wrong + 1,
              },
            }))
          }
          onComplete={finishSession}
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
      // Refuerzo: se repite el clip al acertar.
      if (audioSrc) play(audioSrc);
      setFeedback({ value, kind: "correct" });
      setResults((prev) => ({
        ...prev,
        [target.id]: { ...prev[target.id], answered: true },
      }));
      const isLast = queue.length <= 1;
      setTimeout(() => {
        lockRef.current = false;
        setFeedback(null);
        if (isLast) {
          setQueue([]);
          setPhase(hasInverse ? "inverse" : "match");
        } else {
          setQueue((q) => q.slice(1));
        }
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
        Aprendidos {session.learnedBefore} de {session.packTotal} · sesión{" "}
        {mastered}/{tramo.length}
      </div>

      <div className="dots-card flex flex-col items-center gap-3 p-5">
        {audioSrc ? (
          <>
            <span className="text-sm text-(--muted)">
              Suena solo — toca para repetir
            </span>
            <button
              className="rounded-3xl bg-(--accent) px-8 py-5 text-2xl font-extrabold text-white transition-transform active:scale-95"
              onClick={() => play(audioSrc)}
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

// ── Emparejar numeral ↔ palabra en grupos de hasta 5 pares (solo el tramo) ───

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
