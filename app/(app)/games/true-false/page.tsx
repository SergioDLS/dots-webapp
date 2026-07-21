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
import {
  getTrueFalseService,
  type TrueFalseCard,
} from "@/services/games.service";
import { useCountdown } from "@/hooks/use-countdown";
import { useGameRecords } from "@/hooks/use-game-records";
import { useTournamentMode } from "@/hooks/use-tournament-mode";
import { useChallengeMode } from "@/hooks/use-challenge-mode";
import { playSound } from "@/lib/feedback-sounds";

// ── Constants ─────────────────────────────────────────────────────────────────

const GAME_SECONDS = 60;
const SWIPE_THRESHOLD = 80; // px
const CORRECTION_MS = 1200;
const STREAK_STEP = 5; // correct in a row to level up multiplier
const MAX_MULTIPLIER = 5;

type Phase = "intro" | "playing" | "result";

// ── Seed reader (inside Suspense boundary) ────────────────────────────────────

function TrueFalseGame() {
  const searchParams = useSearchParams();
  const seedParam = searchParams.get("seed");
  const seed =
    seedParam !== null && seedParam !== ""
      ? parseInt(seedParam, 10)
      : undefined;

  return <TrueFalseInner seed={seed} />;
}

// ── Main game component ───────────────────────────────────────────────────────

function TrueFalseInner({ seed }: { seed?: number }) {
  const router = useRouter();
  const { record, throne } = useGameRecords("true-false");
  const { submitTournamentScore, resetTournamentSubmit } = useTournamentMode();
  const { submitChallengeScore } = useChallengeMode();

  const [phase, setPhase] = useState<Phase>("intro");
  const [cards, setCards] = useState<TrueFalseCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [cardIndex, setCardIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [multiplier, setMultiplier] = useState(1);
  const [correction, setCorrection] = useState<string | null>(null);
  const correctionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Swipe state
  const [dragX, setDragX] = useState(0);
  const [dragging, setDragging] = useState(false);
  const pointerStartXRef = useRef(0);
  const cardRef = useRef<HTMLDivElement>(null);

  const handleTimeUp = useCallback(() => {
    setPhase("result");
  }, []);

  const { remaining, start: startCountdown } = useCountdown(
    GAME_SECONDS,
    handleTimeUp,
  );

  // Load cards once on mount
  useEffect(() => {
    let active = true;
    getTrueFalseService(seed)
      .then((data) => {
        if (active) setCards(data);
      })
      .catch(() => {})
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [seed]);

  // Clean up correction timer on unmount
  useEffect(() => {
    return () => {
      if (correctionTimerRef.current) clearTimeout(correctionTimerRef.current);
    };
  }, []);

  const startGame = useCallback(() => {
    setCardIndex(0);
    setScore(0);
    setStreak(0);
    setMultiplier(1);
    setCorrection(null);
    setPhase("playing");
    startCountdown();
  }, [startCountdown]);

  // Advance to next card
  const advance = useCallback(() => {
    setCardIndex((i) => i + 1);
    setDragX(0);
  }, []);

  // Process an answer: true = "verdad", false = "trampa"
  const answer = useCallback(
    (guessedCorrect: boolean) => {
      const card = cards[cardIndex];
      if (!card || correction !== null) return;

      const isRight = guessedCorrect === card.isCorrect;

      if (isRight) {
        playSound("correct");
        const newStreak = streak + 1;
        const newMultiplier = Math.min(MAX_MULTIPLIER, Math.floor(newStreak / STREAK_STEP) + 1);
        setStreak(newStreak);
        setMultiplier(newMultiplier);
        setScore((sc) => sc + 10 * newMultiplier);
        advance();
      } else {
        playSound("wrong");
        setStreak(0);
        setMultiplier(1);

        // Build correction text
        let correctionText: string;
        if (card.isCorrect) {
          // Player said "trampa" but it was correct
          correctionText = `¡Verdad! "${card.en}" sí significa "${card.es}"`;
        } else {
          // Player said "verdad" but it was a trap — show real meaning
          const real = card.realEs ?? card.es;
          correctionText = `Trampa: "${card.en}" = ${real}`;
        }
        setCorrection(correctionText);

        correctionTimerRef.current = setTimeout(() => {
          setCorrection(null);
          advance();
        }, CORRECTION_MS);
      }
    },
    [cards, cardIndex, correction, streak, advance],
  );

  // ── Pointer events (swipe) ────────────────────────────────────────────────

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (correction !== null) return;
      e.currentTarget.setPointerCapture(e.pointerId);
      pointerStartXRef.current = e.clientX;
      setDragging(true);
      setDragX(0);
    },
    [correction],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!dragging) return;
      setDragX(e.clientX - pointerStartXRef.current);
    },
    [dragging],
  );

  const onPointerUp = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!dragging) return;
      setDragging(false);
      const dx = e.clientX - pointerStartXRef.current;
      if (dx >= SWIPE_THRESHOLD) {
        answer(true); // swipe right = verdad
      } else if (dx <= -SWIPE_THRESHOLD) {
        answer(false); // swipe left = trampa
      } else {
        // Snap back
        setDragX(0);
      }
    },
    [dragging, answer],
  );

  const onPointerCancel = useCallback(() => {
    setDragging(false);
    setDragX(0);
  }, []);

  // Modo torneo: envía el score una vez al llegar a "result"; al salir
  // (reintentar) rearma el guard para que la próxima partida también cuente.
  useEffect(() => {
    if (phase === "result") {
      submitTournamentScore(score);
      submitChallengeScore(score);
    } else {
      resetTournamentSubmit();
    }
  }, [phase]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Derived display values ────────────────────────────────────────────────

  const card = cards[cardIndex];
  const timeLeft = Math.ceil(remaining);
  const timeColor =
    timeLeft <= 10
      ? "var(--danger)"
      : timeLeft <= 20
        ? "var(--gold)"
        : "var(--accent)";

  const swipeHint =
    dragX > 30
      ? "¡Verdad!"
      : dragX < -30
        ? "¡Trampa!"
        : null;
  const swipeHintColor =
    dragX > 30 ? "var(--success)" : "var(--danger)";

  const cardStyle: React.CSSProperties = {
    transform: `translateX(${dragX}px) rotate(${dragX / 20}deg)`,
    transition: dragging ? "none" : "transform 0.3s ease",
    touchAction: "none",
    cursor: dragging ? "grabbing" : "grab",
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner title="Cargando cartas..." />
      </div>
    );
  }

  return (
    <div className="relative flex min-h-screen w-full flex-col items-center overflow-hidden px-4 py-6">
      {/* Background glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-32 -left-24 h-80 w-80 rounded-full opacity-20 blur-3xl"
        style={{ background: "var(--accent)" }}
      />

      {/* Intro screen */}
      {phase === "intro" && (
        <>
          {/* Exit button floats above GameIntro */}
          <div className="z-10 flex w-full max-w-sm justify-start">
            <button
              onClick={() => router.push("/play")}
              className="text-sm font-bold transition-colors"
              style={{ color: "var(--muted)" }}
            >
              ← Salir
            </button>
          </div>
          <GameIntro
            emoji="🃏"
            title="¿Verdad o Trampa?"
            howTo={[
              "Aparece una palabra en inglés con su traducción al español.",
              "Desliza a la derecha si el par es CORRECTO (verdad).",
              "Desliza a la izquierda si la traducción es FALSA (trampa).",
              "Cada respuesta correcta suma puntos — ¡la racha multiplica!",
            ]}
            record={record}
            throne={throne}
            onStart={startGame}
          />
        </>
      )}

      {/* Playing screen */}
      {phase === "playing" && (
        <>
          {/* Top bar */}
          <div
            className="dots-card z-10 flex w-full max-w-sm items-center justify-between gap-3 px-4 py-3"
            style={{ marginBottom: "1rem" }}
          >
            <button
              onClick={() => setPhase("result")}
              className="text-sm font-bold transition-colors"
              style={{ color: "var(--muted)" }}
            >
              ← Salir
            </button>
            <div className="flex flex-col items-center">
              <span
                className="font-display text-2xl font-extrabold tabular-nums"
                style={{ color: timeColor }}
              >
                {timeLeft}s
              </span>
            </div>
            <div className="flex flex-col items-end">
              <span className="text-xs font-black uppercase tracking-widest" style={{ color: "var(--muted)" }}>
                Puntos
              </span>
              <span className="font-display text-lg font-extrabold" style={{ color: "var(--accent)" }}>
                {score}
              </span>
            </div>
          </div>

          {/* Multiplier & streak bar */}
          <div className="z-10 flex w-full max-w-sm items-center justify-between px-1 mb-3">
            <span className="text-xs font-black" style={{ color: "var(--muted)" }}>
              Racha: {streak}
            </span>
            <span
              className="rounded-full px-3 py-0.5 text-xs font-black"
              style={{
                background: multiplier > 1
                  ? "color-mix(in srgb, var(--gold) 20%, transparent)"
                  : "color-mix(in srgb, var(--border) 60%, transparent)",
                color: multiplier > 1 ? "var(--gold-edge)" : "var(--muted)",
                border: multiplier > 1
                  ? "2px solid color-mix(in srgb, var(--gold) 50%, transparent)"
                  : "2px solid var(--border)",
              }}
            >
              ×{multiplier}
            </span>
          </div>

          {/* Card area */}
          <div className="relative z-10 flex w-full max-w-sm flex-1 flex-col items-center">
            {card ? (
              <>
                {/* Swipe hint overlay */}
                {swipeHint && (
                  <div
                    className="absolute top-2 z-20 rounded-full px-5 py-2 text-base font-black"
                    style={{
                      color: swipeHintColor,
                      background: `color-mix(in srgb, ${swipeHintColor} 15%, transparent)`,
                      border: `2px solid color-mix(in srgb, ${swipeHintColor} 40%, transparent)`,
                      pointerEvents: "none",
                      animation: "dots-pop-in 0.15s ease-out both",
                    }}
                  >
                    {swipeHint}
                  </div>
                )}

                {/* The card */}
                <div
                  ref={cardRef}
                  key={cardIndex}
                  onPointerDown={onPointerDown}
                  onPointerMove={onPointerMove}
                  onPointerUp={onPointerUp}
                  onPointerCancel={onPointerCancel}
                  className="dots-card flex w-full flex-col items-center gap-4 px-8 py-10 select-none"
                  style={{
                    ...cardStyle,
                    animation: !dragging ? "dots-pop-in 0.3s ease-out both" : undefined,
                  }}
                >
                  <span
                    className="text-xs font-black uppercase tracking-widest"
                    style={{ color: "var(--muted)" }}
                  >
                    ¿Verdad o Trampa?
                  </span>
                  <span
                    className="font-display text-3xl font-extrabold text-center"
                    style={{ color: "var(--foreground)" }}
                  >
                    {card.en}
                  </span>
                  <div
                    className="h-px w-16"
                    style={{ background: "var(--border)" }}
                  />
                  <span
                    className="text-xl font-bold text-center"
                    style={{ color: "var(--accent)" }}
                  >
                    {card.es}
                  </span>

                  {/* Swipe guide arrows */}
                  <div className="flex w-full items-center justify-between mt-2">
                    <span className="text-xs font-bold" style={{ color: "var(--danger)" }}>
                      ← Trampa
                    </span>
                    <span className="text-xs font-bold" style={{ color: "var(--success)" }}>
                      Verdad →
                    </span>
                  </div>
                </div>

                {/* Correction banner */}
                {correction && (
                  <div
                    className="mt-4 w-full rounded-2xl px-5 py-3 text-center text-sm font-bold"
                    style={{
                      background: "color-mix(in srgb, var(--danger) 12%, transparent)",
                      border: "2px solid color-mix(in srgb, var(--danger) 40%, transparent)",
                      color: "var(--danger)",
                      animation: "dots-pop-in 0.2s ease-out both",
                    }}
                  >
                    {correction}
                  </div>
                )}

                {/* Fallback buttons */}
                <div className="mt-5 flex w-full gap-4">
                  <button
                    onPointerUp={() => answer(false)}
                    disabled={correction !== null}
                    className="dots-pressable flex-1 rounded-2xl border-2 py-4 text-2xl font-black disabled:opacity-40"
                    style={{
                      borderColor: "color-mix(in srgb, var(--danger) 50%, transparent)",
                      background: "color-mix(in srgb, var(--danger) 8%, transparent)",
                      color: "var(--danger)",
                      ["--press-color" as string]: "var(--danger-soft)",
                    }}
                    aria-label="Trampa"
                  >
                    ✗
                  </button>
                  <button
                    onPointerUp={() => answer(true)}
                    disabled={correction !== null}
                    className="dots-pressable flex-1 rounded-2xl border-2 py-4 text-2xl font-black disabled:opacity-40"
                    style={{
                      borderColor: "color-mix(in srgb, var(--success) 50%, transparent)",
                      background: "color-mix(in srgb, var(--success) 8%, transparent)",
                      color: "var(--success)",
                      ["--press-color" as string]: "var(--success-soft)",
                    }}
                    aria-label="Verdad"
                  >
                    ✓
                  </button>
                </div>
              </>
            ) : (
              // No more cards — show a waiting state
              <div className="flex flex-col items-center gap-3 mt-12">
                <span className="text-4xl">🎉</span>
                <p className="font-display text-lg font-extrabold text-center" style={{ color: "var(--foreground)" }}>
                  ¡Todas las cartas respondidas!
                </p>
                <p className="text-sm font-bold" style={{ color: "var(--muted)" }}>
                  Esperando que termine el tiempo…
                </p>
              </div>
            )}
          </div>
        </>
      )}

      {/* Result screen */}
      {phase === "result" && (
        <GameResult
          gameKey="true-false"
          score={score}
          onReplay={startGame}
          onExit={() => router.push("/play")}
        />
      )}
    </div>
  );
}

// ── Page export with Suspense gate ────────────────────────────────────────────

export default function TrueFalsePage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <Spinner title="Cargando…" />
        </div>
      }
    >
      <TrueFalseGame />
    </Suspense>
  );
}
