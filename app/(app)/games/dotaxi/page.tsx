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
import Doty from "@/components/ui/doty/doty";
import { getDotaxiService, type DotaxiQuestion } from "@/services/games.service";
import { useGameRecords } from "@/hooks/use-game-records";
import { useTournamentMode } from "@/hooks/use-tournament-mode";
import { useChallengeMode } from "@/hooks/use-challenge-mode";
import { useTicker } from "@/hooks/use-ticker";
import { playSound } from "@/lib/feedback-sounds";
import {
  lanesForCorrect,
  laneGeometry,
  nearestLane,
  buildLaneOptions,
} from "./lanes";

// ── Constantes (heredadas del juego original) ────────────────────────────────

const START_HEARTS = 5;
const WIN_CORRECT = 10;
const TIMER_START = 5000;
const TIMER_STEP = 280; // se recorta por ronda jugada
const TIMER_MIN = 2500;
const TICKER_FPS = 30;
const RESOLVE_MS = 1300; // pausa tras resolver la ronda
const TIER_NOTICE_MS = 600; // aviso "¡Carril nuevo!" al abrirse un carril

type Phase = "intro" | "playing" | "result";

/** PRNG determinista para derivar el mazo del seed (mismo mazo entre rivales). */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffleWith<T>(arr: readonly T[], rng: () => number): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

// ── Taxi (top-down, Doty in the cabin) ──────────────────────────────────────────
function Taxi({
  tilt,
  crashing,
  pose,
}: {
  tilt: number;
  crashing: boolean;
  pose: string;
}) {
  return (
    <div
      className="relative"
      style={{
        width: 78,
        height: 116,
        ["--tilt" as string]: `${tilt}deg`,
        animation: crashing
          ? "dotaxi-shake 0.5s ease-in-out"
          : "dotaxi-bob 0.8s ease-in-out infinite",
        transition: "transform 0.25s ease",
      }}
    >
      {/* wheels */}
      {[18, 74].map((top) =>
        [-4, 70].map((left) => (
          <div
            key={`${top}-${left}`}
            className="absolute rounded-md"
            style={{
              top,
              left,
              width: 12,
              height: 26,
              background: "#1b1340",
            }}
          />
        )),
      )}

      {/* body */}
      <div
        className="absolute inset-0 rounded-[28px]"
        style={{
          background: "linear-gradient(180deg,#ffd21e,#f7b500)",
          border: "3px solid #1b1340",
          boxShadow: "0 6px 16px rgba(0,0,0,0.35)",
        }}
      >
        {/* roof sign */}
        <div
          className="absolute left-1/2 -translate-x-1/2 rounded-md px-1.5 py-0.5 text-[8px] font-black tracking-widest"
          style={{
            top: 2,
            background: "#1b1340",
            color: "#ffd21e",
          }}
        >
          TAXI
        </div>

        {/* headlights */}
        <div className="absolute top-2 left-2 h-2 w-3 rounded-full bg-white/90" />
        <div className="absolute top-2 right-2 h-2 w-3 rounded-full bg-white/90" />

        {/* cabin window with Doty */}
        <div
          className="absolute left-1/2 -translate-x-1/2 overflow-hidden rounded-2xl"
          style={{
            top: 24,
            width: 56,
            height: 52,
            background: "#bfe9ff",
            border: "2px solid #1b1340",
          }}
        >
          <div className="absolute left-1/2 -translate-x-1/2" style={{ top: 2 }}>
            <Doty pose={pose} size="mini" />
          </div>
        </div>

        {/* checker stripe */}
        <div
          className="absolute left-0 right-0"
          style={{
            bottom: 16,
            height: 8,
            background:
              "repeating-linear-gradient(90deg,#1b1340 0 8px,#fff 8px 16px)",
          }}
        />

        {/* taillights */}
        <div className="absolute bottom-2 left-2 h-2 w-3 rounded-full bg-red-500" />
        <div className="absolute bottom-2 right-2 h-2 w-3 rounded-full bg-red-500" />
      </div>
    </div>
  );
}

// ── Lector de seed (dentro del boundary de Suspense) ────────────────────────

function DotaxiGame() {
  const searchParams = useSearchParams();
  const seedParam = searchParams.get("seed");
  const parsed = seedParam !== null && seedParam !== "" ? parseInt(seedParam, 10) : NaN;
  const seed = Number.isFinite(parsed) ? parsed : undefined;
  return <DotaxiInner seed={seed} />;
}

// ── Componente principal ─────────────────────────────────────────────────────

function DotaxiInner({ seed }: { seed?: number }) {
  const router = useRouter();
  const { record, throne } = useGameRecords("dotaxi");
  const { submitTournamentScore, resetTournamentSubmit } = useTournamentMode();
  const { submitChallengeScore } = useChallengeMode();

  const [phase, setPhase] = useState<Phase>("intro");
  const [deck, setDeck] = useState<DotaxiQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  const [hearts, setHearts] = useState(START_HEARTS);
  const [correctCount, setCorrectCount] = useState(0);
  const [score, setScore] = useState(0);
  const [finalScore, setFinalScore] = useState(0);

  /** La partida llegó a su fin natural (ganó o se quedó sin corazones). */
  const completedRef = useRef(false);

  // Motor en refs; el estado es snapshot para render (regla 3)
  const roundRef = useRef(0); // rondas jugadas (para el timer decreciente)
  const laneRef = useRef(0); // carril actual del taxi
  const lanesRef = useRef(2); // carriles del tramo actual
  const remainingRef = useRef(TIMER_START);
  const resolvingRef = useRef(false);
  const correctCountRef = useRef(0);
  const heartsRef = useRef(START_HEARTS);
  const scoreRef = useRef(0);
  const comboRef = useRef(0);
  const resolveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Timer propio (no está en el brief original): sin él, TIER_NOTICE_MS quedaba
  // sin usar y el aviso de carril nuevo se quedaba en pantalla toda la ronda.
  const tierNoticeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const roadYRef = useRef(0); // desplazamiento de la carretera (px, cíclico)

  const [lane, setLane] = useState(0);
  const [lanes, setLanes] = useState(2);
  const [laneOptions, setLaneOptions] = useState<string[]>([]);
  const [question, setQuestion] = useState<DotaxiQuestion | null>(null);
  const [remaining, setRemaining] = useState(TIMER_START);
  const [outcome, setOutcome] = useState<"none" | "clear" | "crash">("none");
  const [tierNotice, setTierNotice] = useState(false);
  const [roadY, setRoadY] = useState(0);

  // Fetch con patrón fetchAttempt (regla 5)
  const [fetchAttempt, setFetchAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    getDotaxiService()
      .then((data) => {
        if (!active) return;
        const usable = data.filter(
          (q) => q.correct && q.options && q.options.length > 0,
        );
        // Nunca se arranca sin preguntas: el juego viejo encadenaba choques
        // automáticos y enviaba un score 0
        if (usable.length === 0) {
          setLoadError(true);
          return;
        }
        const rng = seed !== undefined ? mulberry32(seed) : Math.random;
        setDeck(shuffleWith(usable, rng));
      })
      .catch(() => {
        if (active) setLoadError(true);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [seed, fetchAttempt]);

  useEffect(() => {
    return () => {
      if (resolveTimerRef.current) clearTimeout(resolveTimerRef.current);
      if (tierNoticeTimerRef.current) clearTimeout(tierNoticeTimerRef.current);
    };
  }, []);

  /** Prepara la ronda `idx`: calcula el tramo, recoloca el taxi si cambió el
   *  número de carriles y reparte las opciones por los carriles. */
  const setupRound = useCallback(
    (idx: number) => {
      const q = deck[idx % deck.length];
      if (!q) return;

      const nextLanes = lanesForCorrect(correctCountRef.current);
      const prevLanes = lanesRef.current;
      // Cancela cualquier aviso pendiente de la ronda anterior antes de
      // decidir si esta ronda dispara uno nuevo.
      if (tierNoticeTimerRef.current) clearTimeout(tierNoticeTimerRef.current);
      if (nextLanes !== prevLanes) {
        laneRef.current = nearestLane(laneRef.current, prevLanes, nextLanes);
        lanesRef.current = nextLanes;
        setLane(laneRef.current);
        setLanes(nextLanes);
        setTierNotice(true);
        tierNoticeTimerRef.current = setTimeout(() => {
          setTierNotice(false);
        }, TIER_NOTICE_MS);
      } else {
        setTierNotice(false);
      }

      // cuarto distractor desde OTRAS preguntas del mazo (el backend da 3)
      const cross = deck
        .filter((_, i) => i % deck.length !== idx % deck.length)
        .map((other) => other.correct);
      const rng =
        seed !== undefined ? mulberry32(seed + idx) : Math.random;

      setQuestion(q);
      setLaneOptions(buildLaneOptions(q.correct, q.options, cross, nextLanes, rng));
      remainingRef.current = Math.max(
        TIMER_MIN,
        TIMER_START - TIMER_STEP * idx,
      );
      setRemaining(remainingRef.current);
      setOutcome("none");
      resolvingRef.current = false;
    },
    [deck, seed],
  );

  const startGame = useCallback(() => {
    completedRef.current = false;
    setHearts(START_HEARTS);
    setCorrectCount(0);
    setScore(0);
    setFinalScore(0);
    roundRef.current = 0;
    laneRef.current = 0;
    lanesRef.current = 2;
    correctCountRef.current = 0;
    heartsRef.current = START_HEARTS;
    scoreRef.current = 0;
    comboRef.current = 0;
    resolvingRef.current = false;
    roadYRef.current = 0;
    setLane(0);
    setLanes(2);
    setOutcome("none");
    setPhase("playing");
    setupRound(0);
  }, [setupRound]);

  const finishGame = useCallback(() => {
    completedRef.current = true;
    setFinalScore(scoreRef.current);
    setPhase("result");
  }, []);

  const resolve = useCallback(() => {
    if (resolvingRef.current || !question) return;
    resolvingRef.current = true;

    const chosen = laneOptions[laneRef.current];
    const hit = chosen === question.correct;

    if (hit) {
      playSound("correct");
      comboRef.current += 1;
      scoreRef.current += 100 * comboRef.current;
      correctCountRef.current += 1;
      setScore(scoreRef.current);
      setCorrectCount(correctCountRef.current);
      setOutcome("clear");
    } else {
      playSound("wrong");
      comboRef.current = 0;
      heartsRef.current = Math.max(0, heartsRef.current - 1);
      setHearts(heartsRef.current);
      setOutcome("crash");
    }

    if (resolveTimerRef.current) clearTimeout(resolveTimerRef.current);
    resolveTimerRef.current = setTimeout(() => {
      if (correctCountRef.current >= WIN_CORRECT || heartsRef.current <= 0) {
        finishGame();
        return;
      }
      roundRef.current += 1;
      setupRound(roundRef.current);
    }, RESOLVE_MS);
  }, [question, laneOptions, setupRound, finishGame]);

  // Torneo/reto: solo partidas completas. El score personal conserva el
  // parcial al salir (sube desde 0, como dot-match).
  useEffect(() => {
    if (phase === "result") {
      if (completedRef.current) {
        submitTournamentScore(finalScore);
        submitChallengeScore(finalScore, { completed: true });
      }
    } else {
      resetTournamentSubmit();
    }
  }, [phase]); // eslint-disable-line react-hooks/exhaustive-deps

  const onTick = useCallback(
    (dtMs: number) => {
      // carretera en movimiento: translateY cíclico (nunca background-position)
      roadYRef.current = (roadYRef.current + dtMs * 0.12) % 64;
      setRoadY(roadYRef.current);

      if (resolvingRef.current) return;
      remainingRef.current = Math.max(0, remainingRef.current - dtMs);
      setRemaining(remainingRef.current);
      if (remainingRef.current <= 0) resolve(); // se acabó el tiempo = fallo
    },
    [resolve],
  );

  useTicker(TICKER_FPS, onTick, phase === "playing");

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner title="Calentando el motor…" />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="text-lg font-bold" style={{ color: "var(--foreground)" }}>
          No se pudo cargar el trayecto.
        </p>
        <p className="text-sm" style={{ color: "var(--muted)" }}>
          Comprueba tu conexión e inténtalo de nuevo.
        </p>
        <button
          onPointerUp={() => {
            setLoadError(false);
            setLoading(true);
            setFetchAttempt((n) => n + 1);
          }}
          className="dots-pressable rounded-2xl px-6 py-3 text-sm font-bold"
          style={{ background: "var(--accent)", color: "var(--accent-contrast)" }}
        >
          Reintentar
        </button>
      </div>
    );
  }

  return (
    <div className="relative flex min-h-screen w-full flex-col items-center overflow-hidden px-4 py-6">
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
            emoji="🚕"
            title="Dotaxi"
            howTo={[
              "Lee la frase con el hueco y busca la palabra que encaja.",
              "Toca el carril de esa palabra para mover el taxi.",
              "Pulsa «¡Vamos!» para confirmar antes de que se acabe el tiempo.",
              "Empiezas con 2 carriles; según aciertas se abren más (¡hasta 4!).",
              `${WIN_CORRECT} aciertos para llegar. Tienes ${START_HEARTS} corazones.`,
            ]}
            record={record}
            throne={throne}
            onStart={startGame}
          />
        </>
      )}

      {phase === "playing" && (
        <div data-testid="road" className="z-10 flex w-full max-w-sm flex-1 flex-col gap-3">
          {/* HUD */}
          <div className="dots-card flex w-full items-center justify-between gap-3 px-4 py-3">
            <button
              onPointerUp={() => {
                // Abandonar: el parcial cuenta para el récord, no para el reto
                if (resolveTimerRef.current) clearTimeout(resolveTimerRef.current);
                setFinalScore(scoreRef.current);
                setPhase("result");
              }}
              className="text-sm font-bold transition-colors"
              style={{ color: "var(--muted)" }}
            >
              ← Salir
            </button>
            <span className="text-sm font-black" aria-label={`${hearts} corazones`}>
              {"❤️".repeat(hearts)}
              {"🤍".repeat(START_HEARTS - hearts)}
            </span>
            <div className="flex flex-col items-end">
              <span className="text-xs font-black uppercase tracking-widest" style={{ color: "var(--muted)" }}>
                {correctCount}/{WIN_CORRECT}
              </span>
              <span className="font-display text-lg font-extrabold" style={{ color: "var(--accent)" }}>
                {score}
              </span>
            </div>
          </div>

          {/* Frase con el hueco */}
          <div className="dots-card px-4 py-3 text-center">
            <p className="text-base font-extrabold">
              {question?.text.split("__")[0]}
              <span
                className="mx-1 inline-block min-w-12 rounded-md border-b-4 px-2"
                style={{ borderColor: "var(--accent)", color: "var(--accent)" }}
              >
                ?
              </span>
              {question?.text.split("__")[1] ?? ""}
            </p>
          </div>

          {/* Barra de tiempo (scaleX, nunca width) */}
          <div className="h-2 w-full overflow-hidden rounded-full" style={{ background: "var(--border)" }}>
            <div
              className="h-full w-full origin-left rounded-full"
              style={{
                transform: `scaleX(${Math.max(0, remaining) / TIMER_START})`,
                background: remaining > TIMER_START * 0.3 ? "var(--success)" : "var(--danger)",
              }}
            />
          </div>

          {/* Carretera */}
          <div
            className="relative w-full flex-1 overflow-hidden rounded-2xl border-2"
            style={{ borderColor: "var(--border)", background: "color-mix(in srgb, var(--foreground) 8%, var(--surface))" }}
          >
            {/* rayas de carril desplazándose con translateY */}
            <div
              aria-hidden
              className="absolute inset-x-0 top-0"
              style={{
                height: "200%",
                transform: `translateY(${roadY - 64}px)`,
                backgroundImage:
                  "repeating-linear-gradient(to bottom, var(--border) 0 24px, transparent 24px 64px)",
                backgroundSize: "2px 100%",
                backgroundRepeat: "repeat-y",
                backgroundPosition: "center",
                opacity: 0.5,
              }}
            />

            {/* carteles de opción, uno por carril */}
            {laneOptions.map((opt, i) => {
              const { widthPct, centersPct } = laneGeometry(lanes);
              const isClear = outcome !== "none" && opt === question?.correct;
              const isBlocked = outcome !== "none" && !isClear;
              return (
                <button
                  key={`${i}-${opt}`}
                  data-testid={`lane-${i}`}
                  onPointerUp={() => {
                    if (resolvingRef.current) return;
                    laneRef.current = i;
                    setLane(i);
                  }}
                  className="absolute top-3 dots-card px-1 py-2 text-xs font-extrabold"
                  style={{
                    left: `${centersPct[i]}%`,
                    width: `${widthPct * 0.86}%`,
                    transform: "translateX(-50%)",
                    borderColor: isClear
                      ? "var(--success)"
                      : isBlocked
                        ? "var(--danger)"
                        : lane === i
                          ? "var(--accent)"
                          : "var(--border)",
                    transition: "border-color 0.2s",
                  }}
                >
                  {outcome === "none" ? opt : isClear ? "✓" : "🚧"}
                </button>
              );
            })}

            {/* Taxi: translateX (nunca left) */}
            <div
              data-testid="taxi"
              className="absolute bottom-4"
              style={{
                left: `${laneGeometry(lanes).centersPct[Math.min(lane, lanes - 1)]}%`,
                transform: "translateX(-50%)",
                transition: "left 0.28s var(--ease-out-strong)",
              }}
            >
              <Taxi tilt={0} crashing={outcome === "crash"} pose="02" />
            </div>

            {/* aviso de carril nuevo */}
            {tierNotice && (
              <div
                data-testid="tier-notice"
                className="absolute inset-x-0 top-1/2 text-center font-display text-xl font-extrabold"
                style={{
                  color: "var(--accent)",
                  animation: "dots-pop-in 0.3s var(--ease-out-strong) both",
                }}
              >
                ¡Carril nuevo!
              </div>
            )}
          </div>

          {/* Confirmar: separado de moverse (antes tocar tu carril confirmaba) */}
          <button
            data-testid="go"
            onPointerUp={resolve}
            disabled={outcome !== "none"}
            className="dots-pressable w-full rounded-2xl py-4 text-base font-extrabold disabled:opacity-40"
            style={{
              background: "var(--accent)",
              color: "var(--accent-contrast)",
              ["--press-color" as string]: "var(--accent-edge)",
            }}
          >
            ¡Vamos!
          </button>
        </div>
      )}

      {phase === "result" && (
        <GameResult
          gameKey="dotaxi"
          score={finalScore}
          onReplay={startGame}
          onExit={() => router.push("/play")}
          extra={
            <p className="text-sm font-bold text-center" style={{ color: "var(--muted)" }}>
              {correctCount}/{WIN_CORRECT} aciertos
            </p>
          }
        />
      )}
    </div>
  );
}

// ── Export con puerta de Suspense (useSearchParams, regla 6) ────────────────

export default function DotaxiPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <Spinner title="Cargando…" />
        </div>
      }
    >
      <DotaxiGame />
    </Suspense>
  );
}
