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
import GameResult from "@/components/games/shared/game-result";
import Spinner from "@/components/ui/Spinner/Spinner";
import WordImg from "@/components/ui/word-img/word-img";
import HotAirBalloon from "@/components/games/dont-pop/hot-air-balloon";
import { getDontPopService, type GameWord } from "@/services/games.service";
import { useGameRecords } from "@/hooks/use-game-records";
import { useTournamentMode } from "@/hooks/use-tournament-mode";
import { useChallengeMode } from "@/hooks/use-challenge-mode";
import { useGameSeed } from "@/hooks/use-game-seed";
import { playSound } from "@/lib/feedback-sounds";
import { buildRound, roundScore } from "./rounds";

// ── Constantes (mecánica heredada: el globo ES el reloj) ────────────────────

const PRESSURE_MAX = 100;
const START_PRESSURE = 15;
const INFLATE_PER_SEC = 6;
const CORRECT_DEFLATE = 25;
const WRONG_INFLATE = 30;
const TICK_MS = 100;
const CRASH_DELAY_MS = 1500; // deja que revienten y caiga
const LANDING_DELAY_MS = 1400;

type Phase = "intro" | "playing" | "result";
type Outcome = "none" | "crash" | "land";

/** PRNG determinista para derivar las rondas del seed. */
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

// ── Lector de seed (dentro del boundary de Suspense) ─────────────────────────

function DontPopGame() {
  const router = useRouter();
  const seed = useGameSeed();
  const { record, throne } = useGameRecords("dont-pop");
  const { submitTournamentScore, resetTournamentSubmit } = useTournamentMode();
  const { submitChallengeScore } = useChallengeMode();

  const [phase, setPhase] = useState<Phase>("intro");
  const [words, setWords] = useState<GameWord[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  // Snapshots para render
  const [pressure, setPressure] = useState(START_PRESSURE);
  const [score, setScore] = useState(0);
  const [finalScore, setFinalScore] = useState(0);
  const [cleared, setCleared] = useState(0);
  const [current, setCurrent] = useState<{ word: GameWord; options: string[] } | null>(null);
  const [outcome, setOutcome] = useState<Outcome>("none");

  // Motor en refs
  const pressureRef = useRef(START_PRESSURE);
  const scoreRef = useRef(0);
  const clearedRef = useRef(0);
  const answeredRef = useRef<Set<number>>(new Set());
  const roundSeqRef = useRef(0);
  const resolvingRef = useRef(false);
  const endTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  /** La partida terminó de forma natural (reventó o aterrizó). */
  const completedRef = useRef(false);

  // ── Carga (patrón fetchAttempt, regla 5) ──────────────────────────────────
  const [fetchAttempt, setFetchAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    getDontPopService()
      .then((data) => {
        if (!active) return;
        const usable = data.filter((w) => w.title && w.title.trim() !== "");
        // Nunca arrancar sin palabras: el juego viejo daba victoria instantánea
        // con score 0 cuando el fetch fallaba
        if (usable.length === 0) {
          setLoadError(true);
          return;
        }
        setWords(usable);
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
  }, [fetchAttempt]);

  // Limpieza de timers
  useEffect(() => {
    return () => {
      if (endTimerRef.current) clearTimeout(endTimerRef.current);
      if (tickRef.current) clearInterval(tickRef.current);
    };
  }, []);

  const rngFor = useCallback(
    (n: number) => (seed !== undefined ? mulberry32(seed + n) : Math.random),
    [seed],
  );

  const finishGame = useCallback((how: Outcome) => {
    completedRef.current = true;
    setOutcome(how);
    if (tickRef.current) {
      clearInterval(tickRef.current);
      tickRef.current = null;
    }
    if (endTimerRef.current) clearTimeout(endTimerRef.current);
    endTimerRef.current = setTimeout(
      () => {
        setFinalScore(scoreRef.current);
        setPhase("result");
      },
      how === "crash" ? CRASH_DELAY_MS : LANDING_DELAY_MS,
    );
  }, []);

  /** Arma la siguiente ronda; si no quedan palabras, aterriza. */
  const advance = useCallback(() => {
    roundSeqRef.current += 1;
    const next = buildRound(words, answeredRef.current, rngFor(roundSeqRef.current));
    if (next === null) {
      finishGame("land");
      return;
    }
    setCurrent(next);
    resolvingRef.current = false;
  }, [words, rngFor, finishGame]);

  const startGame = useCallback(() => {
    if (endTimerRef.current) clearTimeout(endTimerRef.current);
    if (tickRef.current) clearInterval(tickRef.current);
    completedRef.current = false;
    pressureRef.current = START_PRESSURE;
    scoreRef.current = 0;
    clearedRef.current = 0;
    answeredRef.current = new Set();
    roundSeqRef.current = 0;
    resolvingRef.current = false;
    setPressure(START_PRESSURE);
    setScore(0);
    setCleared(0);
    setFinalScore(0);
    setOutcome("none");
    setPhase("playing");

    const first = buildRound(words, new Set(), rngFor(0));
    setCurrent(first);
    if (first === null) {
      // defensivo: el gate de carga ya impide llegar aquí sin palabras
      setLoadError(true);
      return;
    }

    tickRef.current = setInterval(() => {
      if (resolvingRef.current) return;
      const next = Math.min(
        PRESSURE_MAX,
        pressureRef.current + INFLATE_PER_SEC * (TICK_MS / 1000),
      );
      pressureRef.current = next;
      setPressure(next);
      if (next >= PRESSURE_MAX) {
        resolvingRef.current = true;
        playSound("wrong");
        finishGame("crash");
      }
    }, TICK_MS);
  }, [words, rngFor, finishGame]);

  // Torneo/reto: solo partidas completas
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

  const answer = useCallback(
    (option: string) => {
      if (phase !== "playing" || resolvingRef.current || current === null) return;

      if (option === current.word.title) {
        playSound("correct");
        // El bonus se calcula con la presión ANTES de desinflar: premia haber
        // respondido con el globo tranquilo
        scoreRef.current += roundScore(pressureRef.current);
        clearedRef.current += 1;
        answeredRef.current.add(current.word.id);
        pressureRef.current = Math.max(0, pressureRef.current - CORRECT_DEFLATE);
        setScore(scoreRef.current);
        setCleared(clearedRef.current);
        setPressure(pressureRef.current);
        advance();
      } else {
        playSound("wrong");
        const next = Math.min(PRESSURE_MAX, pressureRef.current + WRONG_INFLATE);
        pressureRef.current = next;
        setPressure(next);
        if (next >= PRESSURE_MAX) {
          resolvingRef.current = true;
          finishGame("crash");
        }
      }
    },
    [phase, current, advance, finishGame],
  );

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner title="Inflando el globo…" />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="text-lg font-bold" style={{ color: "var(--foreground)" }}>
          No se pudo preparar el vuelo.
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

  const danger = pressure / PRESSURE_MAX;

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
            emoji="🎈"
            title="¡No lo revientes!"
            howTo={[
              "No hay reloj: el globo es el reloj. Se infla solo.",
              "Mira la imagen y toca la palabra correcta en inglés.",
              "Acertar desinfla el globo; fallar lo infla de golpe.",
              "Cuanto más tranquilo respondas, más puntos ganas.",
              `Responde las ${words.length} palabras para aterrizar.`,
            ]}
            record={record}
            throne={throne}
            onStart={startGame}
          />
        </>
      )}

      {phase === "playing" && (
        <div data-testid="sky" className="z-10 flex w-full max-w-sm flex-1 flex-col gap-3">
          {/* HUD */}
          <div className="dots-card flex w-full items-center justify-between gap-3 px-4 py-3">
            <button
              onPointerUp={() => {
                // Abandonar: el parcial cuenta para el récord, no para el reto
                if (endTimerRef.current) clearTimeout(endTimerRef.current);
                if (tickRef.current) clearInterval(tickRef.current);
                setFinalScore(scoreRef.current);
                setPhase("result");
              }}
              className="text-sm font-bold transition-colors"
              style={{ color: "var(--muted)" }}
            >
              ← Salir
            </button>
            <span className="text-xs font-black uppercase tracking-widest" style={{ color: "var(--muted)" }}>
              {cleared}/{words.length}
            </span>
            <span className="font-display text-lg font-extrabold" style={{ color: "var(--accent)" }}>
              {score}
            </span>
          </div>

          {/* Barra de presión (scaleX, nunca width) */}
          <div
            className="h-2.5 w-full overflow-hidden rounded-full"
            style={{ background: "var(--border)" }}
            role="progressbar"
            aria-valuenow={Math.round(pressure)}
            aria-valuemin={0}
            aria-valuemax={PRESSURE_MAX}
            aria-label="Presión del globo"
          >
            <div
              data-testid="pressure-bar"
              className="h-full w-full origin-left rounded-full"
              style={{
                transform: `scaleX(${danger})`,
                background: danger > 0.75 ? "var(--danger)" : danger > 0.5 ? "var(--gold)" : "var(--success)",
                transition: "transform 0.1s linear, background 0.3s",
              }}
            />
          </div>

          {/* Globo */}
          <div className="flex justify-center">
            <HotAirBalloon
              phase={outcome === "crash" ? "exploded" : outcome === "land" ? "landed" : "flying"}
              pressure={danger}
            />
          </div>

          {/* Imagen de la palabra */}
          {current && (
            <div className="dots-card flex flex-col items-center gap-2 px-4 py-3">
              {current.word.src && (
                <WordImg src={current.word.src} size="w-24 h-24" customClass="rounded-xl" />
              )}
            </div>
          )}

          {/* Opciones */}
          <div className="flex flex-col gap-2">
            {current?.options.map((opt) => (
              <button
                key={opt}
                data-testid={`opt-${opt}`}
                onPointerUp={() => answer(opt)}
                disabled={outcome !== "none"}
                className="dots-pressable w-full rounded-2xl border-2 px-4 py-3 text-base font-extrabold disabled:opacity-40"
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
        </div>
      )}

      {phase === "result" && (
        <GameResult
          gameKey="dont-pop"
          score={finalScore}
          onReplay={startGame}
          onExit={() => router.push("/play")}
          extra={
            <p className="text-sm font-bold text-center" style={{ color: "var(--muted)" }}>
              {/* tres desenlaces: abandonar no es reventar */}
              {outcome === "land"
                ? "🛬 Aterrizaje perfecto"
                : outcome === "crash"
                  ? "💥 ¡Reventó!"
                  : "🪂 Vuelo interrumpido"}{" "}
              · {cleared}/{words.length} palabras
            </p>
          }
        />
      )}
    </div>
  );
}

// ── Export con puerta de Suspense (useSearchParams, regla 6) ─────────────────

export default function DontPopPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <Spinner title="Cargando…" />
        </div>
      }
    >
      <DontPopGame />
    </Suspense>
  );
}
