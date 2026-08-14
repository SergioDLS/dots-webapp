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
import { getDotaxiService, type DotaxiQuestion } from "@/services/games.service";
import { useGameRecords } from "@/hooks/use-game-records";
import { useTournamentMode } from "@/hooks/use-tournament-mode";
import { useChallengeMode } from "@/hooks/use-challenge-mode";
import { lanesForCorrect } from "./lanes";

// ── Constantes (heredadas del juego original) ────────────────────────────────

const START_HEARTS = 5;
const WIN_CORRECT = 10;
const TIMER_START = 5000;
const TIMER_STEP = 280; // se recorta por ronda jugada
const TIMER_MIN = 2500;

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

  const startGame = useCallback(() => {
    completedRef.current = false;
    setHearts(START_HEARTS);
    setCorrectCount(0);
    setScore(0);
    setFinalScore(0);
    setPhase("playing");
  }, []);

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

      {/* Jugando — Task 3 reemplaza este placeholder */}
      {phase === "playing" && (
        <div data-testid="road" className="z-10 flex w-full max-w-sm flex-1 flex-col">
          <p className="text-sm font-bold" style={{ color: "var(--muted)" }}>
            carriles: {lanesForCorrect(correctCount)} · aciertos: {correctCount} ·
            corazones: {hearts} · pts: {score}
          </p>
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
