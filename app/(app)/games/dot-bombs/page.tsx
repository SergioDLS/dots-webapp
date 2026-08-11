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
import { useTicker } from "@/hooks/use-ticker";
import { playSound } from "@/lib/feedback-sounds";
import WordImg from "@/components/ui/word-img/word-img";
import { buildTray, tapChip, type TrayState } from "./anagram";
import {
  bombScore,
  DIFFICULTY,
  stepBombs,
  survivalMultiplier,
  type Bomb,
  type GameMode,
} from "./engine";

// ── Constantes ────────────────────────────────────────────────────────────────

const MAX_LIVES = 5;
const TICKER_FPS = 30;
const BOMB_H = 148;

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

  // Motor en refs (el tick es la única fuente de verdad; el estado es snapshot)
  const bombsRef = useRef<Bomb[]>([]);
  const winTargetRef = useRef<number | null>(null); // min(winAt, pool) del modo en curso
  const activeIdRef = useRef<number | null>(null);
  const nextBombIdRef = useRef(1);
  const lastSpawnAtRef = useRef(0);
  const elapsedMsRef = useRef(0);
  const wordCursorRef = useRef(0);
  const livesRef = useRef(MAX_LIVES);
  const defusedRef = useRef(0);
  const scoreRef = useRef(0);
  const skyHRef = useRef(0);

  const [bombsSnapshot, setBombsSnapshot] = useState<Bomb[]>([]);
  const [activeId, setActiveId] = useState<number | null>(null);
  // Snapshots de solo-lectura para el HUD (los refs no se leen en render)
  const [winTarget, setWinTarget] = useState<number | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);

  // Alto real del cielo en px, medido desde onTick (ver más abajo)
  const skyRef = useRef<HTMLDivElement | null>(null);
  const [skyH, setSkyH] = useState(0);

  const wordsRef = useRef<GameWord[]>([]);

  // Bandeja de anagrama (Task 5): estado de UI + refs de combo/feedback
  const [tray, setTray] = useState<TrayState | null>(null);
  const [wrongChipId, setWrongChipId] = useState<number | null>(null);
  const comboRef = useRef(0);
  const wrongTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  // Limpieza del timer de "ficha equivocada" al desmontar
  useEffect(() => {
    return () => {
      if (wrongTimerRef.current) clearTimeout(wrongTimerRef.current);
    };
  }, []);

  const startGame = useCallback((m: GameMode) => {
    setMode(m);
    // meta del modo: min(20, pool) por spec — con pool corto la meta encoge
    const cfgWin = DIFFICULTY[m].winAt;
    winTargetRef.current =
      cfgWin === null ? null : Math.min(cfgWin, wordsRef.current.length);
    livesRef.current = MAX_LIVES;
    defusedRef.current = 0;
    scoreRef.current = 0;
    bombsRef.current = [];
    activeIdRef.current = null;
    nextBombIdRef.current = 1;
    lastSpawnAtRef.current = 0;
    elapsedMsRef.current = 0;
    wordCursorRef.current = 0;
    comboRef.current = 0;
    if (wrongTimerRef.current) clearTimeout(wrongTimerRef.current);
    setTray(null);
    setWrongChipId(null);
    setLives(MAX_LIVES);
    setDefusedCount(0);
    setScore(0);
    setFinalScore(0);
    setBombsSnapshot([]);
    setActiveId(null);
    setWinTarget(winTargetRef.current);
    setElapsedMs(0);
    setPhase("playing");
    // primer spawn inmediato: el primer tick ya cumple spawnEveryMs
    lastSpawnAtRef.current = -DIFFICULTY[m].spawnEveryMs;
  }, []);

  /** Fin de partida: score y phase en el MISMO commit (lección de memory —
   *  GameResult envía al montar y los efectos del hijo corren primero). */
  const endGame = useCallback(() => {
    setFinalScore(scoreRef.current);
    setDefusedCount(defusedRef.current);
    setPhase("result");
  }, []);

  const spawnBomb = useCallback(() => {
    const pool = wordsRef.current;
    if (pool.length === 0) return;
    const cfg = DIFFICULTY[mode];
    const word = pool[wordCursorRef.current % pool.length];
    wordCursorRef.current += 1;
    bombsRef.current = [
      ...bombsRef.current,
      {
        id: nextBombIdRef.current++,
        word: word.title.toLowerCase(),
        img: word.src,
        y: 0,
        speed: 1 / cfg.fallSeconds,
      },
    ];
  }, [mode]);

  const onTick = useCallback(
    (dtMs: number) => {
      // mide el cielo desde el tick: funciona aunque no haya compositing
      // (ResizeObserver no entrega callbacks ahí) y cubre resize en vivo
      const skyEl = skyRef.current;
      if (skyEl && skyEl.clientHeight !== skyHRef.current) {
        skyHRef.current = skyEl.clientHeight;
        setSkyH(skyEl.clientHeight);
      }

      const cfg = DIFFICULTY[mode];
      elapsedMsRef.current += dtMs;

      // survival acelera; normal va a x1 constante
      const speedMult =
        cfg.accelPerSecond > 0
          ? 1 + cfg.accelPerSecond * (elapsedMsRef.current / 1000)
          : 1;

      const { bombs, landed } = stepBombs(bombsRef.current, dtMs, speedMult);
      bombsRef.current = bombs;

      // TODOS los aterrizajes del tick cuestan vida (fix del bug del booleano)
      if (landed.length > 0) {
        playSound("wrong");
        comboRef.current = 0; // aterrizaje = fallo
        livesRef.current = Math.max(0, livesRef.current - landed.length);
        setLives(livesRef.current);
        if (livesRef.current === 0) {
          endGame();
          return;
        }
      }

      // spawn si hay hueco
      if (
        bombsRef.current.length < cfg.maxBombs &&
        elapsedMsRef.current - lastSpawnAtRef.current >= cfg.spawnEveryMs
      ) {
        lastSpawnAtRef.current = elapsedMsRef.current;
        spawnBomb();
      }

      // bomba activa = la más baja
      const prevActiveId = activeIdRef.current;
      const lowest = bombsRef.current.reduce<Bomb | null>(
        (acc, b) => (acc === null || b.y > acc.y ? b : acc),
        null,
      );
      activeIdRef.current = lowest?.id ?? null;

      // la bandeja sigue a la bomba activa (se rearma al cambiar de objetivo)
      if (activeIdRef.current !== prevActiveId) {
        const target = bombsRef.current.find((b) => b.id === activeIdRef.current);
        setTray(
          target
            ? buildTray(target.word, DIFFICULTY[mode].decoys, Math.random)
            : null,
        );
      }

      // snapshot para render
      setBombsSnapshot(bombsRef.current);
      setActiveId(activeIdRef.current);
      setElapsedMs(elapsedMsRef.current);
    },
    [mode, spawnBomb, endGame],
  );

  useTicker(TICKER_FPS, onTick, phase === "playing");

  const onChipTap = useCallback(
    (chipId: number) => {
      if (phase !== "playing" || tray === null) return;
      const { state, result } = tapChip(tray, chipId);
      if (result === "noop") return;

      if (result === "wrong") {
        playSound("wrong");
        comboRef.current = 0;
        setWrongChipId(chipId);
        if (wrongTimerRef.current) clearTimeout(wrongTimerRef.current);
        wrongTimerRef.current = setTimeout(() => setWrongChipId(null), 400);
        return;
      }

      setTray(state);
      if (result === "complete") {
        playSound("correct");
        const bomb = bombsRef.current.find((b) => b.id === activeIdRef.current);
        if (!bomb) return;
        const cfg = DIFFICULTY[mode];
        const mult =
          cfg.winAt === null
            ? survivalMultiplier(elapsedMsRef.current / 1000)
            : cfg.multiplier;
        scoreRef.current += bombScore(mult, bomb.y, comboRef.current);
        comboRef.current += 1;
        defusedRef.current += 1;
        setScore(scoreRef.current);
        setDefusedCount(defusedRef.current);

        // retirar la bomba; el próximo tick elige nueva activa y rearma bandeja
        bombsRef.current = bombsRef.current.filter((b) => b.id !== bomb.id);
        setBombsSnapshot(bombsRef.current);
        setTray(null);

        if (winTargetRef.current !== null && defusedRef.current >= winTargetRef.current) {
          endGame();
        }
      }
    },
    [phase, tray, mode, endGame],
  );

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

      {/* ── Jugando ── */}
      {phase === "playing" && (
        <div data-testid="battlefield" className="z-10 flex w-full max-w-sm flex-1 flex-col">
          {/* HUD */}
          <div className="dots-card flex w-full items-center justify-between gap-3 px-4 py-3">
            <button
              onPointerUp={() => {
                // Abandonar NO envía score (misma política que memory)
                router.push("/play");
              }}
              className="text-sm font-bold transition-colors"
              style={{ color: "var(--muted)" }}
            >
              ← Salir
            </button>
            <span className="text-sm font-black tabular-nums" aria-label={`${lives} vidas`}>
              {"❤️".repeat(lives)}
              {"🤍".repeat(MAX_LIVES - lives)}
            </span>
            <div className="flex flex-col items-end">
              <span className="text-xs font-black uppercase tracking-widest" style={{ color: "var(--muted)" }}>
                {winTarget !== null
                  ? `${defusedCount}/${winTarget}`
                  : `${Math.floor(elapsedMs / 1000)}s`}
              </span>
              <span className="font-display text-lg font-extrabold" style={{ color: "var(--accent)" }}>
                {score}
              </span>
            </div>
          </div>

          {/* Cielo: las bombas caen con translateY (nunca top) */}
          <div ref={skyRef} className="relative mt-3 w-full flex-1 min-h-40 overflow-hidden rounded-2xl border-2"
            style={{
              borderColor: "var(--border)",
              background: "color-mix(in srgb, var(--accent) 4%, var(--surface))",
            }}
          >
            {bombsSnapshot.map((bomb) => (
              <div
                key={bomb.id}
                data-testid={`bomb-${bomb.id}`}
                className="absolute left-0 top-0 flex w-full justify-center"
                style={{
                  // y∈[0,1] → recorre el alto medido del cielo menos la bomba, sin bajar de 0 (evita saltos hacia arriba)
                  transform: `translateY(${(bomb.y * Math.max(0, skyH - BOMB_H)).toFixed(1)}px)`,
                  opacity: activeId === bomb.id ? 1 : 0.7,
                }}
              >
                <div
                  className="dots-card flex flex-col items-center gap-1 px-3 py-2"
                  style={{
                    borderColor: activeId === bomb.id ? "var(--danger)" : "var(--border)",
                    transform: activeId === bomb.id ? "scale(1)" : "scale(0.85)",
                    transition: "transform 0.2s var(--ease-out-strong), border-color 0.2s",
                  }}
                >
                  <span className="text-5xl leading-none" aria-hidden>💣</span>
                  {bomb.img && <WordImg src={bomb.img} size="w-12 h-12" customClass="rounded" />}
                  <span className="text-sm font-extrabold">{bomb.word}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Bandeja de anagrama */}
          <div
            data-testid="tray"
            key={activeId ?? "none"}
            className="mt-3 flex h-44 shrink-0 overflow-hidden flex-col items-center gap-3"
          >
            {tray && (
              <>
                {/* Huecos de la palabra */}
                <div className="flex flex-wrap justify-center gap-1">
                  {tray.display.map((ch, i) => (
                    <span
                      key={i}
                      className="flex h-8 w-7 items-center justify-center rounded-md border-b-4 font-display text-lg font-extrabold uppercase"
                      style={{
                        borderColor: i === tray.nextSlot ? "var(--accent)" : "var(--border)",
                        color: ch === "" ? "transparent" : "var(--foreground)",
                        animation: ch !== "" && i !== tray.nextSlot ? "none" : undefined,
                      }}
                    >
                      {ch === "" ? "·" : ch}
                    </span>
                  ))}
                </div>
                {/* Fichas */}
                <div className="flex flex-wrap justify-center gap-2">
                  {tray.chips.map((chip) => (
                    <button
                      key={chip.id}
                      data-testid={`chip-${chip.id}`}
                      disabled={chip.used}
                      onPointerUp={() => onChipTap(chip.id)}
                      className="dots-pressable h-12 w-11 rounded-xl border-2 font-display text-lg font-extrabold uppercase disabled:opacity-30"
                      style={{
                        borderColor: "var(--border)",
                        background: "var(--surface)",
                        color: "var(--foreground)",
                        animation:
                          wrongChipId === chip.id
                            ? "dots-shake-x 0.4s var(--ease-out-strong)"
                            : `dots-slot-in 0.22s var(--ease-out-strong) ${chip.id * 30}ms backwards`,
                        ["--press-color" as string]: "var(--accent-soft)",
                      }}
                    >
                      {chip.char}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
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
