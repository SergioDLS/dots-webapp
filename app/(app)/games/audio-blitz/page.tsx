"use client";

import React, {
  Suspense,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";
import GameIntro from "@/components/games/shared/game-intro";
import GameResult from "@/components/games/shared/game-result";
import Spinner from "@/components/ui/Spinner/Spinner";
import Sound from "@/components/ui/sound/sound";
import {
  getAudioBlitzService,
  type AudioBlitzItem,
} from "@/services/games.service";
import { useCountdown } from "@/hooks/use-countdown";
import { playSound } from "@/lib/feedback-sounds";
import { resolveSentenceSoundUrl } from "@/constants";

// ── Constants ─────────────────────────────────────────────────────────────────

const QUESTION_SECONDS = 7;
const CORRECTION_MS = 1500;
const SCORE_BASE = 100;
const SCORE_PER_SECOND = 10;

type Phase = "intro" | "playing" | "result";

// ── Seed reader (inside Suspense boundary) ────────────────────────────────────

function AudioBlitzGame() {
  const searchParams = useSearchParams();
  const seedParam = searchParams.get("seed");
  const seed =
    seedParam !== null && seedParam !== ""
      ? parseInt(seedParam, 10)
      : undefined;
  return <AudioBlitzInner seed={seed} />;
}

// ── Main game component ───────────────────────────────────────────────────────

function AudioBlitzInner({ seed }: { seed?: number }) {
  const router = useRouter();

  const [phase, setPhase] = useState<Phase>("intro");
  const [items, setItems] = useState<AudioBlitzItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  const [questionIndex, setQuestionIndex] = useState(0);
  const [score, setScore] = useState(0);

  // Correction state: null = not showing, string = the highlighted sentence
  const [correction, setCorrection] = useState<string | null>(null);
  const correctionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Blocks re-entrant taps between a correct answer and the next question's render.
  const advancingRef = useRef(false);

  // Per-question timer: fires when 7s expire (= timeout → wrong)
  const handleTimeUp = useCallback(() => {
    // Only fire if not already in correction
    setCorrection((prev) => {
      if (prev !== null) return prev; // already correcting, ignore
      return "__TIMEOUT__"; // sentinel triggers correction effect below
    });
  }, []);

  const {
    remaining,
    stop: stopTimer,
    start: startTimer,
  } = useCountdown(QUESTION_SECONDS, handleTimeUp);

  // ── Load items once ──────────────────────────────────────────────────────

  const fetchItems = useCallback(() => {
    setLoading(true);
    setLoadError(false);
    getAudioBlitzService(seed)
      .then((data) => setItems(data))
      .catch(() => setLoadError(true))
      .finally(() => setLoading(false));
  }, [seed]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (correctionTimerRef.current) clearTimeout(correctionTimerRef.current);
    };
  }, []);

  // ── Handle correction sentinel (from timeout) ────────────────────────────

  // When correction is the sentinel string, replace it with the real sentence
  useEffect(() => {
    if (correction !== "__TIMEOUT__") return;
    const item = items[questionIndex];
    if (!item) {
      setCorrection(null);
      return;
    }
    playSound("wrong");
    stopTimer();
    const highlighted = buildHighlightedSentence(item.text, item.correct);
    setCorrection(highlighted);
    correctionTimerRef.current = setTimeout(() => {
      setCorrection(null);
      setQuestionIndex((i) => i + 1);
    }, CORRECTION_MS);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [correction]);

  // ── Start timer on each new question ────────────────────────────────────

  useEffect(() => {
    if (phase !== "playing") return;
    if (correction !== null) return;
    if (questionIndex >= items.length) return;
    advancingRef.current = false;
    startTimer();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, questionIndex, correction]);

  // ── End game when questions exhausted ───────────────────────────────────

  useEffect(() => {
    if (phase === "playing" && items.length > 0 && questionIndex >= items.length) {
      stopTimer();
      setPhase("result");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [questionIndex, items.length, phase]);

  // ── Helpers ───────────────────────────────────────────────────────────────

  /** Replace "__" with the correct word wrapped in an accent-colored span. */
  function buildHighlightedSentence(text: string, correct: string): string {
    return text.replace(
      "__",
      `<span style="color:var(--accent);font-weight:900">${correct}</span>`,
    );
  }

  // ── Start / restart game ─────────────────────────────────────────────────

  const startGame = useCallback(() => {
    if (correctionTimerRef.current) {
      clearTimeout(correctionTimerRef.current);
      correctionTimerRef.current = null;
    }
    advancingRef.current = false;
    setQuestionIndex(0);
    setScore(0);
    setCorrection(null);
    setPhase("playing");
    // timer starts via the phase/questionIndex effect above
  }, []);

  // ── Tap an option ────────────────────────────────────────────────────────

  const tapOption = useCallback(
    (option: string) => {
      if (correction !== null || advancingRef.current) return;
      const item = items[questionIndex];
      if (!item) return;

      advancingRef.current = true;
      stopTimer();

      if (option === item.correct) {
        playSound("correct");
        const secondsLeft = Math.floor(remaining);
        setScore((s) => s + SCORE_BASE + secondsLeft * SCORE_PER_SECOND);
        // Brief flash then advance — no correction overlay for correct
        setQuestionIndex((i) => i + 1);
      } else {
        playSound("wrong");
        const highlighted = buildHighlightedSentence(item.text, item.correct);
        setCorrection(highlighted);
        correctionTimerRef.current = setTimeout(() => {
          setCorrection(null);
          setQuestionIndex((i) => i + 1);
        }, CORRECTION_MS);
      }
    },
    [correction, items, questionIndex, remaining, stopTimer],
  );

  // ── Replay audio manually ────────────────────────────────────────────────
  // Handled by Sound component itself (tap the big replay button)

  // ── Derived values ────────────────────────────────────────────────────────

  const item = items[questionIndex];
  const audioSrc = item
    ? resolveSentenceSoundUrl(item.id, item.ext, item.voiceKey)
    : "";

  const timerPct = Math.max(0, remaining / QUESTION_SECONDS);
  const timerColor =
    remaining <= 2
      ? "var(--danger)"
      : remaining <= 4
        ? "var(--gold)"
        : "var(--accent)";

  // ── Loading / error gates ─────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner title="Cargando audio…" />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="text-lg font-bold" style={{ color: "var(--foreground)" }}>
          No se pudo cargar el juego.
        </p>
        <p className="text-sm" style={{ color: "var(--muted)" }}>
          Comprueba tu conexión e inténtalo de nuevo.
        </p>
        <button
          onPointerUp={fetchItems}
          className="dots-pressable rounded-2xl px-6 py-3 text-sm font-bold"
          style={{
            background: "var(--accent)",
            color: "var(--accent-foreground)",
          }}
        >
          Reintentar
        </button>
      </div>
    );
  }

  return (
    <div className="relative flex min-h-screen w-full flex-col items-center overflow-hidden px-4 py-6">
      {/* Background glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-32 -right-24 h-80 w-80 rounded-full opacity-15 blur-3xl"
        style={{ background: "var(--accent)" }}
      />

      {/* ── Intro ── */}
      {phase === "intro" && (
        <>
          <div className="z-10 flex w-full max-w-sm justify-start">
            <button
              onPointerUp={() => router.push("/play")}
              className="text-sm font-bold transition-colors"
              style={{ color: "var(--muted)" }}
            >
              ← Salir
            </button>
          </div>
          <GameIntro
            emoji="🎧"
            title="Escucha Rápida"
            howTo={[
              "Escucha la narración en inglés.",
              "Toca la palabra que escuchaste en la frase.",
              "Más rápido = más puntos (7 segundos por pregunta).",
              "12 frases. ¡Oídos listos!",
            ]}
            record={null}
            throne={null}
            onStart={startGame}
          />
        </>
      )}

      {/* ── Playing ── */}
      {phase === "playing" && item && (
        <>
          {/* Top bar */}
          <div
            className="dots-card z-10 flex w-full max-w-sm items-center justify-between gap-3 px-4 py-3"
            style={{ marginBottom: "0.75rem" }}
          >
            <button
              onPointerUp={() => { stopTimer(); setPhase("result"); }}
              className="text-sm font-bold transition-colors"
              style={{ color: "var(--muted)" }}
            >
              ← Salir
            </button>
            <div className="flex flex-col items-center">
              <span className="text-xs font-black uppercase tracking-widest" style={{ color: "var(--muted)" }}>
                {questionIndex + 1} / {items.length}
              </span>
            </div>
            <div className="flex flex-col items-end">
              <span className="text-xs font-black uppercase tracking-widest" style={{ color: "var(--muted)" }}>
                Puntos
              </span>
              <span
                className="font-display text-lg font-extrabold"
                style={{ color: "var(--accent)" }}
              >
                {score}
              </span>
            </div>
          </div>

          {/* Timer bar */}
          <div
            className="z-10 w-full max-w-sm mb-4 overflow-hidden rounded-full"
            style={{
              height: "6px",
              background: "color-mix(in srgb, var(--border) 60%, transparent)",
            }}
          >
            <div
              style={{
                height: "100%",
                width: `${timerPct * 100}%`,
                background: timerColor,
                transition: "width 0.1s linear, background 0.3s ease",
                borderRadius: "9999px",
              }}
            />
          </div>

          {/* Audio player area */}
          <div className="z-10 w-full max-w-sm mb-6 flex flex-col items-center gap-3">
            {/* Big replay button — Sound wraps it for autoplay + tap-to-replay */}
            <Sound
              key={audioSrc}
              src={audioSrc}
              autoplay
              className="flex flex-col items-center gap-1"
            >
              <div
                className="dots-pressable flex h-20 w-20 items-center justify-center rounded-full text-4xl"
                style={{
                  background: "color-mix(in srgb, var(--accent) 15%, transparent)",
                  border: "3px solid color-mix(in srgb, var(--accent) 40%, transparent)",
                }}
              >
                🔊
              </div>
              <span className="text-xs font-bold" style={{ color: "var(--muted)" }}>
                Toca para repetir
              </span>
            </Sound>

            <p
              className="text-base font-extrabold text-center"
              style={{ color: "var(--foreground)" }}
            >
              ¿Qué palabra escuchaste?
            </p>
          </div>

          {/* Options grid */}
          <div className="z-10 grid w-full max-w-sm grid-cols-2 gap-3">
            {item.options.map((opt) => (
              <button
                key={opt}
                onPointerUp={() => tapOption(opt)}
                disabled={correction !== null}
                className="dots-pressable rounded-2xl border-2 px-4 py-4 text-center text-base font-bold disabled:opacity-40"
                style={{
                  borderColor: "var(--border)",
                  background: "var(--surface)",
                  color: "var(--foreground)",
                  ["--press-color" as string]: "var(--accent-soft)",
                }}
              >
                {opt}
              </button>
            ))}
          </div>

          {/* Correction overlay */}
          {correction !== null && correction !== "__TIMEOUT__" && (
            <div
              className="z-10 mt-5 w-full max-w-sm rounded-2xl px-5 py-4 text-center text-sm font-bold"
              style={{
                background: "color-mix(in srgb, var(--danger) 10%, transparent)",
                border: "2px solid color-mix(in srgb, var(--danger) 35%, transparent)",
                color: "var(--foreground)",
                animation: "dots-pop-in 0.2s ease-out both",
              }}
            >
              <p
                className="mb-1 text-xs font-black uppercase tracking-widest"
                style={{ color: "var(--danger)" }}
              >
                La frase completa:
              </p>
              <p
                dangerouslySetInnerHTML={{ __html: correction }}
              />
            </div>
          )}
        </>
      )}

      {/* ── Result ── */}
      {phase === "result" && (
        <GameResult
          gameKey="audio-blitz"
          score={score}
          onReplay={startGame}
          onExit={() => router.push("/play")}
        />
      )}
    </div>
  );
}

// ── Page export with Suspense gate ────────────────────────────────────────────

export default function AudioBlitzPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <Spinner title="Cargando…" />
        </div>
      }
    >
      <AudioBlitzGame />
    </Suspense>
  );
}
