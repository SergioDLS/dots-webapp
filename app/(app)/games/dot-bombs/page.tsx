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
import { getGameWordsService, type GameWord } from "@/services/games.service";
import { useGameRecords } from "@/hooks/use-game-records";
import { type GameMode } from "./engine";

// ── Constantes ────────────────────────────────────────────────────────────────

const MAX_LIVES = 5;

type Phase = "intro" | "modes" | "playing" | "result";

const MODE_LABEL: Record<GameMode, { name: string; desc: string; emoji: string }> = {
  easy: { name: "Tranqui", desc: "2 bombas lentas · ×1", emoji: "🙂" },
  medium: { name: "Serio", desc: "3 bombas · ×2", emoji: "😮" },
  hard: { name: "Caos", desc: "4 bombas + letras trampa · ×3", emoji: "🤯" },
  survival: { name: "Survival", desc: "Sin final, cada vez más rápido", emoji: "🔥" },
};

// ── Lector de seed (dentro del boundary de Suspense) ─────────────────────────

function DotBombsGame() {
  const searchParams = useSearchParams();
  const seedParam = searchParams.get("seed");
  const seed =
    seedParam !== null && seedParam !== "" ? parseInt(seedParam, 10) : undefined;
  return <DotBombsInner seed={seed} />;
}

// ── Componente principal ──────────────────────────────────────────────────────

function DotBombsInner({ seed }: { seed?: number }) {
  const router = useRouter();
  const { record, throne } = useGameRecords("dot-bombs");

  const [phase, setPhase] = useState<Phase>("intro");
  const [mode, setMode] = useState<GameMode>("easy");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [finalScore, setFinalScore] = useState(0);
  const [lives, setLives] = useState(MAX_LIVES);
  const [defusedCount, setDefusedCount] = useState(0);
  const [score, setScore] = useState(0);

  const wordsRef = useRef<GameWord[]>([]);

  // Fetch con patrón fetchAttempt (regla 5): el botón solo bumpea el contador
  const [fetchAttempt, setFetchAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    getGameWordsService(seed)
      .then((data) => {
        if (!active) return;
        wordsRef.current = data.filter((w) => w.title && w.title.trim() !== "");
        if (wordsRef.current.length === 0) setLoadError(true);
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

  const startGame = useCallback((m: GameMode) => {
    setMode(m);
    setLives(MAX_LIVES);
    setDefusedCount(0);
    setScore(0);
    setFinalScore(0);
    setPhase("playing");
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner title="Cargando palabras…" />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="text-lg font-bold" style={{ color: "var(--foreground)" }}>
          No se pudieron cargar las palabras.
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
      {/* Glow de fondo */}
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-32 -left-24 h-80 w-80 rounded-full opacity-20 blur-3xl"
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
            emoji="💣"
            title="Dot Bombs"
            howTo={[
              "Caen bombas con una imagen y su palabra en inglés.",
              "La bomba más baja se enciende: deletrea su palabra tocando las letras en orden.",
              "Palabra completa = bomba desactivada y puntos. ¡Desactivar alto paga más!",
              "Si una bomba toca el suelo, pierdes un corazón. Tienes 5.",
            ]}
            record={record}
            throne={throne}
            onStart={() => setPhase("modes")}
          />
        </>
      )}

      {/* ── Selector de modo ── */}
      {phase === "modes" && (
        <div className="z-10 flex min-h-screen w-full max-w-sm flex-col items-center justify-center gap-3">
          <h2 className="font-display text-2xl font-extrabold mb-2">¿Cómo lo quieres?</h2>
          {(Object.keys(MODE_LABEL) as GameMode[]).map((m) => (
            <button
              key={m}
              onPointerUp={() => startGame(m)}
              className="dots-pressable dots-card flex w-full items-center gap-4 px-5 py-4 text-left"
              style={{ ["--press-color" as string]: "var(--accent-soft)" }}
            >
              <span className="text-3xl">{MODE_LABEL[m].emoji}</span>
              <span className="flex flex-col">
                <span className="font-display text-lg font-extrabold">{MODE_LABEL[m].name}</span>
                <span className="text-xs font-bold" style={{ color: "var(--muted)" }}>
                  {MODE_LABEL[m].desc}
                </span>
              </span>
            </button>
          ))}
          <button
            onPointerUp={() => setPhase("intro")}
            className="mt-2 text-sm font-bold"
            style={{ color: "var(--muted)" }}
          >
            ← Volver
          </button>
        </div>
      )}

      {/* ── Jugando (placeholder — Task 4 lo reemplaza) ── */}
      {phase === "playing" && (
        <div data-testid="battlefield" className="z-10 flex w-full max-w-sm flex-1 flex-col">
          <p className="text-sm font-bold" style={{ color: "var(--muted)" }}>
            modo: {mode} · vidas: {lives} · desactivadas: {defusedCount} · pts: {score}
          </p>
        </div>
      )}

      {/* ── Result ── */}
      {phase === "result" && (
        <GameResult
          gameKey="dot-bombs"
          score={finalScore}
          onReplay={() => setPhase("modes")}
          onExit={() => router.push("/play")}
          extra={
            <p className="text-sm font-bold text-center" style={{ color: "var(--muted)" }}>
              {MODE_LABEL[mode].name} · {defusedCount} bomba{defusedCount === 1 ? "" : "s"} desactivada{defusedCount === 1 ? "" : "s"}
            </p>
          }
        />
      )}
    </div>
  );
}

// ── Export con puerta de Suspense (useSearchParams, regla 6) ─────────────────

export default function DotBombsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <Spinner title="Cargando…" />
        </div>
      }
    >
      <DotBombsGame />
    </Suspense>
  );
}
