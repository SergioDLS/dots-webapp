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
  getSentenceBuilderService,
  type BuilderSentence,
} from "@/services/games.service";
import { useGameRecords } from "@/hooks/use-game-records";
import { playSound } from "@/lib/feedback-sounds";
import { resolveSentenceSoundUrl } from "@/constants";

// ── Constants ─────────────────────────────────────────────────────────────────

const TOTAL_SENTENCES = 8;
const SCORE_BASE = 100;
const SCORE_BONUS_CLEAN = 20;
const ADVANCE_CORRECT_MS = 1200;
const ADVANCE_WRONG_MS = 1800;
const MAX_FAILED_CHECKS = 2;

type Phase = "intro" | "playing" | "result";

// Per-sentence check state
type CheckState =
  | "idle"          // not checked yet
  | "correct"       // correct answer
  | "wrong"         // wrong — first-error token highlighted, may retry
  | "revealed";     // second wrong — correct answer revealed, advancing

// ── Seed reader (inside Suspense boundary) ────────────────────────────────────

function SentenceBuilderGame() {
  const searchParams = useSearchParams();
  const seedParam = searchParams.get("seed");
  const seed =
    seedParam !== null && seedParam !== ""
      ? parseInt(seedParam, 10)
      : undefined;
  return <SentenceBuilderInner seed={seed} />;
}

// ── Main game component ───────────────────────────────────────────────────────

function SentenceBuilderInner({ seed }: { seed?: number }) {
  const router = useRouter();
  const { record, throne } = useGameRecords("sentence-builder");

  const [phase, setPhase] = useState<Phase>("intro");
  const [sentences, setSentences] = useState<BuilderSentence[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  // Game state
  const [sentenceIndex, setSentenceIndex] = useState(0);
  const [score, setScore] = useState(0);

  // Per-sentence state: chips in pool and tray
  const [poolChips, setPoolChips] = useState<string[]>([]);
  const [trayChips, setTrayChips] = useState<string[]>([]);

  // Check / result state for the current sentence
  const [checkState, setCheckState] = useState<CheckState>("idle");
  const [failedChecks, setFailedChecks] = useState(0);
  const [firstWrongIndex, setFirstWrongIndex] = useState<number | null>(null);

  // Advance timer ref — cleaned on unmount
  const advanceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Prevent double-tap / race on Comprobar
  const checkingRef = useRef(false);

  // ── Load sentences ────────────────────────────────────────────────────────

  useEffect(() => {
    let active = true;
    getSentenceBuilderService(seed)
      .then((data) => {
        if (active) {
          setSentences(data);
          setLoadError(false);
          setLoading(false);
        }
      })
      .catch(() => {
        if (active) {
          setLoadError(true);
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, [seed]);

  // Reintentar (event handler — not an effect)
  const fetchSentences = useCallback(() => {
    setLoading(true);
    setLoadError(false);
    getSentenceBuilderService(seed)
      .then((data) => {
        setSentences(data);
        setLoadError(false);
      })
      .catch(() => setLoadError(true))
      .finally(() => setLoading(false));
  }, [seed]);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (advanceTimerRef.current) clearTimeout(advanceTimerRef.current);
    };
  }, []);

  // ── Initialize chips when sentence changes ────────────────────────────────

  useEffect(() => {
    if (phase !== "playing") return;
    const s = sentences[sentenceIndex];
    if (!s) return;
    setPoolChips([...s.chips]);
    setTrayChips([]);
    setCheckState("idle");
    setFailedChecks(0);
    setFirstWrongIndex(null);
    checkingRef.current = false;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, sentenceIndex]);

  // ── End game when all sentences done ─────────────────────────────────────

  useEffect(() => {
    if (
      phase === "playing" &&
      sentences.length > 0 &&
      sentenceIndex >= sentences.length
    ) {
      setPhase("result");
    }
  }, [sentenceIndex, sentences.length, phase]);

  // ── Start / restart game ─────────────────────────────────────────────────

  const startGame = useCallback(() => {
    if (advanceTimerRef.current) {
      clearTimeout(advanceTimerRef.current);
      advanceTimerRef.current = null;
    }
    checkingRef.current = false;
    setSentenceIndex(0);
    setScore(0);
    setPoolChips([]);
    setTrayChips([]);
    setCheckState("idle");
    setFailedChecks(0);
    setFirstWrongIndex(null);
    setPhase("playing");
    // chips initialized by the sentenceIndex/phase effect above
  }, []);

  // ── Tap chip from pool → tray ────────────────────────────────────────────

  const tapPoolChip = useCallback(
    (chip: string, index: number) => {
      if (checkState !== "idle") return;
      setPoolChips((prev) => {
        const next = [...prev];
        next.splice(index, 1);
        return next;
      });
      setTrayChips((prev) => [...prev, chip]);
    },
    [checkState],
  );

  // ── Tap chip from tray → back to pool ────────────────────────────────────

  const tapTrayChip = useCallback(
    (chip: string, index: number) => {
      if (checkState !== "idle") return;
      setTrayChips((prev) => {
        const next = [...prev];
        next.splice(index, 1);
        return next;
      });
      setPoolChips((prev) => [...prev, chip]);
    },
    [checkState],
  );

  // ── Comprobar ─────────────────────────────────────────────────────────────

  const handleCheck = useCallback(() => {
    const s = sentences[sentenceIndex];
    if (!s) return;
    if (checkingRef.current) return;
    if (trayChips.length !== s.answer.length) return;
    if (checkState !== "idle") return;

    checkingRef.current = true;

    // Find first out-of-place token (case-insensitive)
    let wrongIdx: number | null = null;
    for (let i = 0; i < s.answer.length; i++) {
      if (trayChips[i].toUpperCase() !== s.answer[i].toUpperCase()) {
        wrongIdx = i;
        break;
      }
    }

    if (wrongIdx === null) {
      // Correct
      playSound("correct");
      const cleanRun = failedChecks === 0;
      setScore((prev) => prev + SCORE_BASE + (cleanRun ? SCORE_BONUS_CLEAN : 0));
      setCheckState("correct");
      advanceTimerRef.current = setTimeout(() => {
        checkingRef.current = false;
        setSentenceIndex((i) => i + 1);
      }, ADVANCE_CORRECT_MS);
    } else {
      // Wrong
      playSound("wrong");
      const newFailed = failedChecks + 1;
      setFirstWrongIndex(wrongIdx);

      if (newFailed >= MAX_FAILED_CHECKS) {
        // Reveal correct answer and advance
        setCheckState("revealed");
        setFailedChecks(newFailed);
        advanceTimerRef.current = setTimeout(() => {
          checkingRef.current = false;
          setSentenceIndex((i) => i + 1);
        }, ADVANCE_WRONG_MS);
      } else {
        // First failure — mark wrong, allow retry
        setCheckState("wrong");
        setFailedChecks(newFailed);
        // Re-enable after a tick so user can fix and retry
        advanceTimerRef.current = setTimeout(() => {
          setCheckState("idle");
          setFirstWrongIndex(null);
          checkingRef.current = false;
        }, 900);
      }
    }
  }, [sentences, sentenceIndex, trayChips, checkState, failedChecks]);

  // ── Derived ───────────────────────────────────────────────────────────────

  const sentence = sentences[sentenceIndex];
  const audioSrc = sentence
    ? resolveSentenceSoundUrl(sentence.id, sentence.ext, sentence.voiceKey)
    : "";

  const canCheck =
    sentence !== undefined &&
    trayChips.length === sentence.answer.length &&
    checkState === "idle";

  // ── Loading / error screens ───────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner title="Preparando las frases…" />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
        <span className="text-4xl">😬</span>
        <p
          className="text-base font-bold"
          style={{ color: "var(--foreground)" }}
        >
          No se pudo cargar el juego.
        </p>
        <p className="text-sm" style={{ color: "var(--muted)" }}>
          Comprueba tu conexión e inténtalo de nuevo.
        </p>
        <button
          onPointerUp={fetchSentences}
          className="dots-pressable rounded-2xl px-6 py-3 text-sm font-black"
          style={{
            background: "color-mix(in srgb, var(--accent) 15%, transparent)",
            border: "2px solid var(--accent)",
            color: "var(--accent)",
          }}
        >
          Reintentar
        </button>
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="relative flex min-h-screen w-full flex-col items-center overflow-hidden px-4 py-6">
      {/* Background glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-32 -left-24 h-80 w-80 rounded-full opacity-15 blur-3xl"
        style={{ background: "var(--accent)" }}
      />

      {/* ── Intro ───────────────────────────────────────────────────────── */}
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
            emoji="🧱"
            title="Constructor"
            howTo={[
              "Escucha la narración en inglés.",
              "Toca las fichas para armar la frase en orden.",
              "Toca 'Comprobar' cuando estés listo.",
              "Acierto sin fallos = +120 pts. ¡8 frases!",
            ]}
            record={record}
            throne={throne}
            onStart={startGame}
          />
        </>
      )}

      {/* ── Playing ─────────────────────────────────────────────────────── */}
      {phase === "playing" && sentence && (
        <>
          {/* HUD */}
          <div
            className="dots-card z-10 flex w-full max-w-sm items-center justify-between gap-3 px-4 py-3"
            style={{ marginBottom: "0.75rem" }}
          >
            <button
              onPointerUp={() => {
                if (advanceTimerRef.current) {
                  clearTimeout(advanceTimerRef.current);
                  advanceTimerRef.current = null;
                }
                setPhase("result");
              }}
              className="text-sm font-bold transition-colors"
              style={{ color: "var(--muted)" }}
            >
              ← Salir
            </button>
            <div className="flex flex-col items-center">
              <span
                className="text-xs font-black uppercase tracking-widest"
                style={{ color: "var(--muted)" }}
              >
                Frase {sentenceIndex + 1}/{TOTAL_SENTENCES}
              </span>
            </div>
            <div className="flex flex-col items-end">
              <span
                className="text-xs font-black uppercase tracking-widest"
                style={{ color: "var(--muted)" }}
              >
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

          {/* Audio player */}
          <div className="z-10 w-full max-w-sm mb-5 flex flex-col items-center gap-2">
            <Sound
              key={audioSrc}
              src={audioSrc}
              autoplay
              className="flex flex-col items-center gap-1"
            >
              <div
                className="dots-pressable flex h-20 w-20 items-center justify-center rounded-full text-4xl"
                style={{
                  background:
                    "color-mix(in srgb, var(--accent) 15%, transparent)",
                  border:
                    "3px solid color-mix(in srgb, var(--accent) 40%, transparent)",
                }}
              >
                🔊
              </div>
              <span
                className="text-xs font-bold"
                style={{ color: "var(--muted)" }}
              >
                Toca para repetir
              </span>
            </Sound>

            <p
              className="text-sm font-bold text-center mt-1"
              style={{ color: "var(--muted)" }}
            >
              Escucha y arma la frase
            </p>
          </div>

          {/* Tray (answer slots) */}
          <div
            className="z-10 w-full max-w-sm mb-4 min-h-[56px] flex flex-wrap gap-2 rounded-2xl p-3"
            style={{
              background:
                checkState === "correct"
                  ? "color-mix(in srgb, var(--success) 10%, transparent)"
                  : checkState === "revealed"
                    ? "color-mix(in srgb, var(--danger) 8%, transparent)"
                    : "color-mix(in srgb, var(--border) 40%, transparent)",
              border:
                checkState === "correct"
                  ? "2px solid color-mix(in srgb, var(--success) 40%, transparent)"
                  : checkState === "revealed"
                    ? "2px solid color-mix(in srgb, var(--danger) 40%, transparent)"
                    : "2px dashed color-mix(in srgb, var(--border) 70%, transparent)",
              transition: "background 0.3s, border-color 0.3s",
            }}
          >
            {/* Revealed correct answer tokens */}
            {checkState === "revealed"
              ? sentence.answer.map((tok, i) => (
                  <span
                    key={`revealed-${i}`}
                    className="rounded-xl px-3 py-1.5 text-sm font-black"
                    style={{
                      background:
                        "color-mix(in srgb, var(--success) 20%, transparent)",
                      border:
                        "2px solid color-mix(in srgb, var(--success) 50%, transparent)",
                      color: "var(--success)",
                      animation: "dots-pop-in 0.2s ease-out both",
                      animationDelay: `${i * 40}ms`,
                    }}
                  >
                    {tok}
                  </span>
                ))
              : trayChips.map((chip, i) => {
                  const isWrong =
                    checkState === "wrong" && i === firstWrongIndex;
                  const isCorrect = checkState === "correct";
                  return (
                    <button
                      key={`tray-${i}`}
                      onPointerUp={() => tapTrayChip(chip, i)}
                      disabled={checkState !== "idle"}
                      className="dots-pressable rounded-xl px-3 py-1.5 text-sm font-black"
                      style={{
                        background: isWrong
                          ? "color-mix(in srgb, var(--danger) 15%, transparent)"
                          : isCorrect
                            ? "color-mix(in srgb, var(--success) 15%, transparent)"
                            : "var(--surface)",
                        border: isWrong
                          ? "2px solid color-mix(in srgb, var(--danger) 60%, transparent)"
                          : isCorrect
                            ? "2px solid color-mix(in srgb, var(--success) 60%, transparent)"
                            : "2px solid var(--border)",
                        color: isWrong
                          ? "var(--danger)"
                          : isCorrect
                            ? "var(--success)"
                            : "var(--foreground)",
                        transform: isWrong ? "scale(1.05)" : "scale(1)",
                        transition:
                          "background 0.2s, border-color 0.2s, transform 0.2s, color 0.2s",
                        opacity: checkState !== "idle" ? 0.85 : 1,
                      }}
                    >
                      {chip}
                    </button>
                  );
                })}

            {trayChips.length === 0 && checkState !== "revealed" && (
              <span
                className="text-xs font-bold self-center"
                style={{ color: "var(--muted)", opacity: 0.6 }}
              >
                Toca las fichas de abajo para armar la frase
              </span>
            )}
          </div>

          {/* Chip pool */}
          <div className="z-10 w-full max-w-sm mb-5 flex flex-wrap gap-2 justify-center">
            {poolChips.map((chip, i) => (
              <button
                key={`pool-${i}-${chip}`}
                onPointerUp={() => tapPoolChip(chip, i)}
                disabled={checkState !== "idle"}
                className="dots-pressable rounded-xl border-2 px-3 py-1.5 text-sm font-black"
                style={{
                  borderColor: "var(--border)",
                  background: "var(--surface)",
                  color: "var(--foreground)",
                  opacity: checkState !== "idle" ? 0.4 : 1,
                  transition: "opacity 0.2s",
                }}
              >
                {chip}
              </button>
            ))}
          </div>

          {/* Comprobar button */}
          <div className="z-10 w-full max-w-sm">
            <button
              onPointerUp={handleCheck}
              disabled={!canCheck}
              className="dots-pressable w-full rounded-2xl py-4 text-base font-black"
              style={{
                background: canCheck
                  ? "var(--accent)"
                  : "color-mix(in srgb, var(--accent) 30%, transparent)",
                color: canCheck
                  ? "var(--accent-foreground)"
                  : "color-mix(in srgb, var(--accent-foreground) 50%, transparent)",
                transition: "background 0.2s, color 0.2s",
              }}
            >
              Comprobar
            </button>
          </div>

          {/* Feedback banner for correct */}
          {checkState === "correct" && (
            <div
              className="z-10 mt-4 w-full max-w-sm rounded-2xl px-5 py-3 text-center"
              style={{
                background:
                  "color-mix(in srgb, var(--success) 12%, transparent)",
                border:
                  "2px solid color-mix(in srgb, var(--success) 40%, transparent)",
                animation: "dots-pop-in 0.2s ease-out both",
              }}
            >
              <p
                className="text-sm font-black"
                style={{ color: "var(--success)" }}
              >
                ¡Correcto! {failedChecks === 0 ? "+120 pts 🎯" : "+100 pts"}
              </p>
            </div>
          )}

          {/* Feedback banner for revealed */}
          {checkState === "revealed" && (
            <div
              className="z-10 mt-4 w-full max-w-sm rounded-2xl px-5 py-3 text-center"
              style={{
                background:
                  "color-mix(in srgb, var(--danger) 10%, transparent)",
                border:
                  "2px solid color-mix(in srgb, var(--danger) 35%, transparent)",
                animation: "dots-pop-in 0.2s ease-out both",
              }}
            >
              <p
                className="text-xs font-black uppercase tracking-widest mb-1"
                style={{ color: "var(--danger)" }}
              >
                La respuesta correcta:
              </p>
              <p
                className="text-sm font-bold"
                style={{ color: "var(--foreground)" }}
              >
                {sentence.answer.join(" ")}
              </p>
            </div>
          )}
        </>
      )}

      {/* ── Result ──────────────────────────────────────────────────────── */}
      {phase === "result" && (
        <GameResult
          gameKey="sentence-builder"
          score={score}
          onReplay={startGame}
          onExit={() => router.push("/play")}
        />
      )}
    </div>
  );
}

// ── Page export with Suspense gate ────────────────────────────────────────────

export default function SentenceBuilderPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <Spinner title="Cargando…" />
        </div>
      }
    >
      <SentenceBuilderGame />
    </Suspense>
  );
}
