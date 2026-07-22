"use client";

import React, {
  Suspense,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import GameIntro from "@/components/games/shared/game-intro";
import Spinner from "@/components/ui/Spinner/Spinner";
import Sound from "@/components/ui/sound/sound";
import {
  getAudioBlitzService,
  type AudioBlitzItem,
} from "@/services/games.service";
import {
  getGhostRaceService,
  postGhostRunService,
  type GhostInfo,
} from "@/services/ghost.service";
import { useCountdown } from "@/hooks/use-countdown";
import { useGameRecords } from "@/hooks/use-game-records";
import { playSound } from "@/lib/feedback-sounds";
import { resolveSentenceSoundUrl } from "@/constants";

// ── Constants ─────────────────────────────────────────────────────────────────

const QUESTION_SECONDS = 7;
const CORRECTION_MS = 1500;
const SCORE_BASE = 100;
const SCORE_PER_SECOND = 10;
const TOTAL_QUESTIONS = 12;

/** Doty synthetic ghost: TOTAL_QUESTIONS steps at ~4500 ms each, mild jitter. */
function buildDotyTimeline(seed: number): number[] {
  // Mulberry32 PRNG inline (no cross-module import)
  let a = seed >>> 0;
  const rng = () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) | 0;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  const BASE_INTERVAL = 4500;
  const JITTER = 800; // ±400 ms
  const timeline: number[] = [];
  let t = 0;
  for (let i = 0; i < TOTAL_QUESTIONS; i++) {
    t += BASE_INTERVAL + Math.round((rng() - 0.5) * JITTER);
    timeline.push(t);
  }
  return timeline;
}

type Phase = "intro" | "playing" | "result";

// ── Result card (inline — server already submitted score via /ghost/run) ───────

interface ResultCardProps {
  score: number;
  beatGhost: boolean;
  ghostName: string;
  onReplay: () => void;
  onExit: () => void;
}

function ResultCard({
  score,
  beatGhost,
  ghostName,
  onReplay,
  onExit,
}: ResultCardProps) {
  return (
    <div className="flex min-h-screen w-full flex-col items-center justify-center px-4 py-8">
      <div
        aria-hidden
        className="pointer-events-none fixed -bottom-32 -right-24 h-80 w-80 rounded-full opacity-20 blur-3xl"
        style={{ background: "var(--accent)" }}
      />
      <div
        className="dots-card flex w-full max-w-sm flex-col items-center gap-6 px-8 py-10 text-center"
        style={{ animation: "dots-pop-in 0.4s ease-out both" }}
      >
        <div className="text-6xl" role="img" aria-label={beatGhost ? "ganaste" : "perdiste"}>
          {beatGhost ? "🏆" : "👻"}
        </div>

        <div className="flex flex-col gap-1">
          <h2
            className="font-display text-2xl font-extrabold"
            style={{ color: "var(--foreground)" }}
          >
            {beatGhost
              ? "¡Ganaste la carrera!"
              : `${ghostName} fue más rápido`}
          </h2>
          <p className="text-sm font-semibold" style={{ color: "var(--muted)" }}>
            {beatGhost
              ? `¡Le ganaste a ${ghostName}!`
              : "¡La próxima vez lo superas!"}
          </p>
        </div>

        <div
          className="w-full rounded-2xl px-5 py-4"
          style={{ background: "var(--surface)", border: "2px solid var(--border)" }}
        >
          <p className="text-xs font-black uppercase tracking-widest" style={{ color: "var(--muted)" }}>
            Tu puntuación
          </p>
          <p
            className="font-display text-4xl font-extrabold"
            style={{ color: "var(--accent)" }}
          >
            {score}
          </p>
        </div>

        <div className="flex w-full flex-col gap-3">
          <button
            onPointerUp={onReplay}
            className="dots-pressable w-full rounded-2xl py-4 text-base font-bold"
            style={{
              background: "var(--accent)",
              color: "var(--accent-foreground)",
            }}
          >
            Otra vez
          </button>
          <button
            onPointerUp={onExit}
            className="dots-pressable w-full rounded-2xl py-3 text-sm font-bold"
            style={{
              background: "var(--surface)",
              color: "var(--muted)",
              border: "2px solid var(--border)",
            }}
          >
            Salir
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main game component ───────────────────────────────────────────────────────

function GhostRaceInner() {
  const router = useRouter();
  const { record, throne } = useGameRecords("ghost-race");

  // ── Race data (loaded once) ───────────────────────────────────────────────
  const [seed, setSeed] = useState<number | null>(null);
  const [ghost, setGhost] = useState<GhostInfo | null>(null);
  const [ghostTimeline, setGhostTimeline] = useState<number[]>([]);
  const [ghostName, setGhostName] = useState("Doty");
  const [items, setItems] = useState<AudioBlitzItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  // ── Game state ────────────────────────────────────────────────────────────
  const [phase, setPhase] = useState<Phase>("intro");
  const [questionIndex, setQuestionIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [myTimeline, setMyTimeline] = useState<number[]>([]);
  const raceStartRef = useRef<number>(0);

  // ── Ghost bar state ───────────────────────────────────────────────────────
  const [elapsed, setElapsed] = useState(0); // ms since raceStart
  const elapsedIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Correction state ──────────────────────────────────────────────────────
  const [correction, setCorrection] = useState<string | null>(null);
  const correctionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const advancingRef = useRef(false);

  // ── Result state ──────────────────────────────────────────────────────────
  const [beatGhost, setBeatGhost] = useState(false);
  const runSubmittedRef = useRef(false);

  // ── Timer (per-question countdown) ───────────────────────────────────────

  const handleTimeUp = useCallback(() => {
    setCorrection((prev) => {
      if (prev !== null) return prev;
      return "__TIMEOUT__";
    });
  }, []);

  const { remaining, stop: stopTimer, start: startTimer } = useCountdown(
    QUESTION_SECONDS,
    handleTimeUp,
  );

  // ── Load race data ────────────────────────────────────────────────────────

  const fetchAll = useCallback(() => {
    setLoading(true);
    setLoadError(false);

    getGhostRaceService()
      .then(({ seed: s, ghost: g }) => {
        setSeed(s);
        setGhost(g);

        const name = g?.name ?? "Doty";
        setGhostName(name);
        // Timeline: rival's real timeline, or synthetic Doty timeline
        setGhostTimeline(g?.timeline ?? buildDotyTimeline(s));

        return getAudioBlitzService(s);
      })
      .then((data) => setItems(data))
      .catch(() => setLoadError(true))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // ── Cleanup on unmount ────────────────────────────────────────────────────

  useEffect(() => {
    return () => {
      if (correctionTimerRef.current) clearTimeout(correctionTimerRef.current);
      if (elapsedIntervalRef.current) clearInterval(elapsedIntervalRef.current);
    };
  }, []);

  // ── Correction sentinel (timeout → wrong) ────────────────────────────────

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

  // ── Start timer on each new question ─────────────────────────────────────

  useEffect(() => {
    if (phase !== "playing") return;
    if (correction !== null) return;
    if (questionIndex >= items.length) return;
    advancingRef.current = false;
    startTimer();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, questionIndex, correction]);

  // ── End game when questions exhausted ────────────────────────────────────

  useEffect(() => {
    if (phase === "playing" && items.length > 0 && questionIndex >= items.length) {
      stopTimer();
      if (elapsedIntervalRef.current) clearInterval(elapsedIntervalRef.current);
      setPhase("result");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [questionIndex, items.length, phase]);

  // ── Submit run when reaching result ──────────────────────────────────────

  useEffect(() => {
    if (phase !== "result") return;
    // StrictMode guard
    if (runSubmittedRef.current) return;
    runSubmittedRef.current = true;

    const finalSeed = seed ?? 0;
    const finalScore = score;
    const finalDuration =
      myTimeline.length > 0 ? myTimeline[myTimeline.length - 1] : 0;

    postGhostRunService({
      seed: finalSeed,
      score: finalScore,
      durationMs: finalDuration,
      timeline: myTimeline,
    })
      .then(({ beatGhost: beat }) => {
        setBeatGhost(beat);
      })
      .catch(() => {
        // If submit fails, compare locally: my last step vs ghost's last step
        const myLast = myTimeline.length > 0 ? myTimeline[myTimeline.length - 1] : Infinity;
        const ghostLast =
          ghostTimeline.length > 0
            ? ghostTimeline[ghostTimeline.length - 1]
            : Infinity;
        setBeatGhost(
          questionIndex >= TOTAL_QUESTIONS && myLast < ghostLast,
        );
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  // ── Helpers ───────────────────────────────────────────────────────────────

  function buildHighlightedSentence(text: string, correct: string): string {
    return text.replace(
      "__",
      `<span style="color:var(--accent);font-weight:900">${correct}</span>`,
    );
  }

  // ── Start / restart ───────────────────────────────────────────────────────

  const startGame = useCallback(() => {
    if (correctionTimerRef.current) {
      clearTimeout(correctionTimerRef.current);
      correctionTimerRef.current = null;
    }
    if (elapsedIntervalRef.current) {
      clearInterval(elapsedIntervalRef.current);
      elapsedIntervalRef.current = null;
    }
    advancingRef.current = false;
    runSubmittedRef.current = false;
    setQuestionIndex(0);
    setScore(0);
    setMyTimeline([]);
    setElapsed(0);
    setCorrection(null);
    setBeatGhost(false);
    raceStartRef.current = Date.now();
    // Ghost elapsed clock
    elapsedIntervalRef.current = setInterval(() => {
      setElapsed(Date.now() - raceStartRef.current);
    }, 100);
    setPhase("playing");
  }, []);

  // ── Tap an option ─────────────────────────────────────────────────────────

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
        // Record timestamp
        const ts = Date.now() - raceStartRef.current;
        setMyTimeline((tl) => [...tl, ts]);
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

  /** How many ghost steps have elapsed by current time. */
  const ghostSteps = ghostTimeline.filter((t) => t <= elapsed).length;
  const ghostPct = TOTAL_QUESTIONS > 0 ? ghostSteps / TOTAL_QUESTIONS : 0;
  const myPct = TOTAL_QUESTIONS > 0 ? questionIndex / TOTAL_QUESTIONS : 0;

  // ── Loading / error gates ─────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner title="Cargando carrera…" />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="text-lg font-bold" style={{ color: "var(--foreground)" }}>
          No se pudo cargar la carrera.
        </p>
        <p className="text-sm" style={{ color: "var(--muted)" }}>
          Comprueba tu conexión e inténtalo de nuevo.
        </p>
        <button
          onPointerUp={fetchAll}
          className="dots-pressable rounded-2xl px-6 py-3 text-sm font-bold"
          style={{ background: "var(--accent)", color: "var(--accent-foreground)" }}
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
            emoji="👻"
            title="Carrera Fantasma"
            howTo={[
              ghost
                ? `Corre contra el fantasma de ${ghost.name}.`
                : "Corre contra Doty (ningún rival aún).",
              "Escucha la narración y toca la palabra correcta.",
              "Más rápido = más puntos. 7 segundos por pregunta.",
              "¡Termina antes que el fantasma y gana!",
            ]}
            record={record}
            throne={throne}
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
              onPointerUp={() => {
                stopTimer();
                if (elapsedIntervalRef.current) clearInterval(elapsedIntervalRef.current);
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
                {questionIndex + 1} / {items.length}
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

          {/* Timer bar */}
          <div
            className="z-10 w-full max-w-sm mb-3 overflow-hidden rounded-full"
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

          {/* Race progress bars */}
          <div
            className="dots-card z-10 flex w-full max-w-sm flex-col gap-2 px-4 py-3 mb-3"
          >
            {/* Player bar */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-black w-5 text-center">🟦</span>
              <div
                className="flex-1 overflow-hidden rounded-full"
                style={{
                  height: "10px",
                  background: "color-mix(in srgb, var(--border) 50%, transparent)",
                }}
              >
                <div
                  style={{
                    height: "100%",
                    width: `${myPct * 100}%`,
                    background: "var(--accent)",
                    borderRadius: "9999px",
                    transition: "width 0.2s ease",
                  }}
                />
              </div>
              <span className="text-xs font-bold w-6 text-right" style={{ color: "var(--accent)" }}>
                {questionIndex}
              </span>
            </div>

            {/* Ghost bar */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-black w-5 text-center">👻</span>
              <div
                className="flex-1 overflow-hidden rounded-full"
                style={{
                  height: "10px",
                  background: "color-mix(in srgb, var(--border) 50%, transparent)",
                }}
              >
                <div
                  style={{
                    height: "100%",
                    width: `${ghostPct * 100}%`,
                    background: "color-mix(in srgb, var(--muted) 60%, transparent)",
                    borderRadius: "9999px",
                    transition: "width 0.3s ease",
                  }}
                />
              </div>
              <span
                className="text-xs font-bold w-6 text-right"
                style={{ color: "var(--muted)" }}
              >
                {ghostSteps}
              </span>
            </div>

            <p className="text-center text-xs font-semibold" style={{ color: "var(--muted)" }}>
              👻 {ghostName}
            </p>
          </div>

          {/* Audio player area */}
          <div className="z-10 w-full max-w-sm mb-4 flex flex-col items-center gap-3">
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
              <p dangerouslySetInnerHTML={{ __html: correction }} />
            </div>
          )}
        </>
      )}

      {/* ── Result ── */}
      {phase === "result" && (
        <ResultCard
          score={score}
          beatGhost={beatGhost}
          ghostName={ghostName}
          onReplay={() => {
            // Fresh race: new seed + latest ghost (a rival may have posted a
            // better run since). fetchAll reloads data; the intro re-shows and
            // the player taps Empezar to run the new deck.
            runSubmittedRef.current = false;
            fetchAll();
            setPhase("intro");
          }}
          onExit={() => router.push("/play")}
        />
      )}
    </div>
  );
}

// ── Page export with Suspense gate ────────────────────────────────────────────

export default function GhostRacePage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <Spinner title="Cargando…" />
        </div>
      }
    >
      <GhostRaceInner />
    </Suspense>
  );
}
