"use client";

import React, {
  Suspense,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";
import ExitFlow from "@/components/ui/exit-flow/exit-flow";
import GameIntro from "@/components/games/shared/game-intro";
import GameResult from "@/components/games/shared/game-result";
import Spinner from "@/components/ui/Spinner/Spinner";
import { UiIcon } from "@/components/ui/ui-icon";
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
  MIN_LANES,
} from "./lanes";
import { planeMetrics, laneXBottom, CURB_BOTTOM_PX } from "./perspective";
import { pickTrip, type Trip } from "./trip";
import {
  Backdrop,
  GroundPlane,
  Gantry,
  GantryApproach,
  TaxiRear,
  Pothole,
  DestinationApproach,
  DestinationArt,
  Passenger,
  SpeechBubble,
  Dust,
  ASPHALT_EDGE,
  TAXI_H,
  type Damage,
} from "./scene";

// ── Constantes ───────────────────────────────────────────────────────────────

const START_HEARTS = 5;
const WIN_CORRECT = 10;
const TIMER_START = 5000;
const TIMER_STEP = 280; // se recorta por ronda jugada
const TIMER_MIN = 2500;
const TICKER_FPS = 30;
const RESOLVE_MS = 1300; // pausa tras resolver la ronda
// Fallar es un bache: nace en el horizonte, en tu carril, y baja por el plano
// hasta el morro. El golpe (sonido, corazón, abolladura) llega cuando pasa
// por debajo, no al pulsar. 450 + los 500 del temblor caben en RESOLVE_MS.
const POTHOLE_MS = 450;
// Recogida: el pasajero pide destino y sube. Un toque la salta.
const PICKUP_MS = 2000;
// Llegada: el destino crece desde el punto de fuga y la carretera frena.
const ARRIVAL_BRAKE_MS = 1400;
const ARRIVAL_MS = 2400;
// Avería: al perder el último corazón el taxi se detiene humeando.
const BREAKDOWN_MS = 2200;
const TIER_ZOOM_MS = 450; // cámara alejándose al abrirse un carril
// El aviso congela la cuenta atrás; tiene que durar al menos lo que el zoom.
const TIER_NOTICE_MS = 900;
const TAXI_TILT_MS = 260; // inclinación al cambiar de carril
// El pórtico nace en el punto de fuga y se acerca hasta ser legible; el reloj
// no arranca hasta entonces. Leer no puede costar tiempo de respuesta.
const SIGN_APPROACH_MS = 900;
// Velocidad de las rayas en unidades de plano por ms: la perspectiva la
// multiplica ×3 en el borde cercano y la deja tal cual en el horizonte.
const ROAD_SPEED = 0.09;
const DASH_CYCLE = 64;

type Phase = "intro" | "pickup" | "playing" | "arrival" | "breakdown" | "result";

/** Fases con la escena en pantalla (y el ticker midiéndola). */
function inGamePhase(phase: Phase): boolean {
  return phase === "pickup" || phase === "playing" || phase === "arrival" || phase === "breakdown";
}

/** Un escalón de daño por corazón perdido: 0 intacto … 5 destruido. */
function damageFor(hearts: number): Damage {
  return Math.max(0, Math.min(5, START_HEARTS - hearts)) as Damage;
}

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

type TimerName =
  | "resolve" | "notice" | "impact" | "tilt" | "board" | "pickup" | "arrival" | "out" | "breakdown";

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
  const [combo, setCombo] = useState(0);
  const [finalScore, setFinalScore] = useState(0);
  const [trip, setTrip] = useState<Trip | null>(null);

  /** La partida llegó a su fin natural (llegó o se rompió el taxi). */
  const completedRef = useRef(false);

  // Motor en refs; el estado es snapshot para render (regla 3)
  const playDeckRef = useRef<DotaxiQuestion[]>([]);
  const roundRef = useRef(0);
  const laneRef = useRef(0);
  const lanesRef = useRef(2);
  const remainingRef = useRef(TIMER_START);
  const resolvingRef = useRef(false);
  const correctCountRef = useRef(0);
  const heartsRef = useRef(START_HEARTS);
  const scoreRef = useRef(0);
  const comboRef = useRef(0);
  const noticeRef = useRef(false); // el aviso de carril congela la cuenta atrás
  const roadYRef = useRef(0); // desplazamiento cíclico de las rayas (unidades de plano)
  const sceneRef = useRef<HTMLDivElement | null>(null);
  const sceneWRef = useRef(0);
  const sceneHRef = useRef(0);
  // Frenada de la carretera (llegada y avería): cuánto lleva frenando.
  const brakingRef = useRef(false);
  const brakeElapsedRef = useRef(0);
  // El pórtico acercándose: mientras dura, la cuenta atrás no corre.
  const approachingRef = useRef(false);
  const signElapsedRef = useRef(0);
  // Recogida: el taxi está parado en el arcén. El ticker sigue vivo porque es
  // quien mide la escena (sin medida no se pinta nada), pero no mueve la
  // carretera ni descuenta tiempo.
  const parkedRef = useRef(false);

  // Todos los temporizadores por nombre: uno solo de cada, y un clearAll al
  // salir. Antes eran cinco refs sueltas y cada salida tenía que recordarlas.
  const timers = useRef(new Map<TimerName, ReturnType<typeof setTimeout>>());
  const clearT = useCallback((name: TimerName) => {
    const t = timers.current.get(name);
    if (t) clearTimeout(t);
    timers.current.delete(name);
  }, []);
  const setT = useCallback(
    (name: TimerName, fn: () => void, ms: number) => {
      clearT(name);
      timers.current.set(name, setTimeout(fn, ms));
    },
    [clearT],
  );
  const clearAll = useCallback(() => {
    for (const t of timers.current.values()) clearTimeout(t);
    timers.current.clear();
  }, []);

  const [lane, setLane] = useState(0);
  const [lanes, setLanes] = useState(2);
  const [laneOptions, setLaneOptions] = useState<string[]>([]);
  const [question, setQuestion] = useState<DotaxiQuestion | null>(null);
  const [remaining, setRemaining] = useState(TIMER_START);
  const [outcome, setOutcome] = useState<"none" | "clear" | "crash">("none");
  const [tierNotice, setTierNotice] = useState(false);
  const [roadY, setRoadY] = useState(0);
  const [sceneW, setSceneW] = useState(0);
  const [sceneH, setSceneH] = useState(0);
  // true desde que el bache pasa bajo el taxi hasta la ronda siguiente
  const [impact, setImpact] = useState(false);
  // >0 remonta las motas de polvo del golpe
  const [dustKey, setDustKey] = useState(0);
  // 0..1 mientras frena: mueve el destino por la calzada
  const [brakeProgress, setBrakeProgress] = useState(0);
  // 0..1 mientras el pórtico se acerca desde el horizonte
  const [signProgress, setSignProgress] = useState(0);
  const [tilt, setTilt] = useState(0);
  // recogida: el pasajero está subiendo; llegada: ya bajó
  const [boarding, setBoarding] = useState(false);
  const [passengerOut, setPassengerOut] = useState(false);

  // Fetch con patrón fetchAttempt (regla 5)
  const [fetchAttempt, setFetchAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    getDotaxiService(seed)
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

  useEffect(() => clearAll, [clearAll]);

  // La escena solo pinta sus hijos cuando conoce su tamaño. Medirla desde el
  // ticker tardaba más de medio segundo al empezar cada partida y la escena
  // aparecía vacía y luego de golpe: el ResizeObserver avisa en el primer
  // frame tras montarse y en cada cambio de tamaño (rotación, teclado).
  const inGame = inGamePhase(phase);
  useEffect(() => {
    const el = sceneRef.current;
    if (!inGame || !el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver((entries) => {
      const box = entries[0]?.contentRect;
      if (!box) return;
      const w = Math.round(box.width);
      const h = Math.round(box.height);
      if (w !== sceneWRef.current) {
        sceneWRef.current = w;
        setSceneW(w);
      }
      if (h !== sceneHRef.current) {
        sceneHRef.current = h;
        setSceneH(h);
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [inGame]);

  /** Prepara la ronda `idx`: calcula el tramo, recoloca el taxi si cambió el
   *  número de carriles y reparte las opciones por los carriles. */
  const setupRound = useCallback(
    (idx: number) => {
      const q = playDeckRef.current[idx % playDeckRef.current.length];
      if (!q) return;

      const nextLanes = lanesForCorrect(correctCountRef.current);
      const prevLanes = lanesRef.current;
      clearT("notice");
      if (nextLanes !== prevLanes) {
        laneRef.current = nearestLane(laneRef.current, prevLanes, nextLanes);
        lanesRef.current = nextLanes;
        setLane(laneRef.current);
        setLanes(nextLanes);
        setTierNotice(true);
        noticeRef.current = true;
        setT(
          "notice",
          () => {
            setTierNotice(false);
            noticeRef.current = false;
          },
          TIER_NOTICE_MS,
        );
      } else {
        setTierNotice(false);
        noticeRef.current = false;
      }

      // cuarto distractor desde OTRAS preguntas del mazo (el backend da 3)
      const cross = playDeckRef.current
        .filter(
          (_, i) =>
            i % playDeckRef.current.length !== idx % playDeckRef.current.length,
        )
        .map((other) => other.correct);
      const rng = seed !== undefined ? mulberry32(seed + idx) : Math.random;

      setQuestion(q);
      setLaneOptions(buildLaneOptions(q.correct, q.options, cross, nextLanes, rng));
      signElapsedRef.current = 0;
      approachingRef.current = true;
      setSignProgress(0);
      remainingRef.current = Math.max(TIMER_MIN, TIMER_START - TIMER_STEP * idx);
      setRemaining(remainingRef.current);
      setOutcome("none");
      setImpact(false);
      setDustKey(0);
      resolvingRef.current = false;
    },
    [seed, clearT, setT],
  );

  const finishGame = useCallback(() => {
    completedRef.current = true;
    brakingRef.current = false;
    clearAll();
    setFinalScore(scoreRef.current);
    setPhase("result");
  }, [clearAll]);

  /** Décimo acierto: el destino crece desde el punto de fuga, el taxi frena
   *  y el pasajero baja. Termina sola o con un toque en la escena. */
  const startArrival = useCallback(() => {
    clearT("notice");
    setTierNotice(false);
    noticeRef.current = false;
    setOutcome("none");
    setImpact(false);
    brakeElapsedRef.current = 0;
    brakingRef.current = true;
    setBrakeProgress(0);
    setPassengerOut(false);
    setPhase("arrival");
    setT("out", () => setPassengerOut(true), ARRIVAL_BRAKE_MS);
    setT("arrival", finishGame, ARRIVAL_MS);
  }, [clearT, setT, finishGame]);

  /** Último corazón: el taxi se detiene destrozado y se pierde el nivel. */
  const startBreakdown = useCallback(() => {
    clearT("notice");
    setTierNotice(false);
    noticeRef.current = false;
    setOutcome("none");
    brakeElapsedRef.current = 0;
    brakingRef.current = true;
    setBrakeProgress(0);
    setPhase("breakdown");
    setT("breakdown", finishGame, BREAKDOWN_MS);
  }, [clearT, setT, finishGame]);

  /** Fin de la recogida: arranca la primera ronda. */
  const beginDriving = useCallback(() => {
    clearT("pickup");
    clearT("board");
    parkedRef.current = false;
    setBoarding(false);
    setPhase("playing");
    setupRound(0);
  }, [clearT, setupRound]);

  const startGame = useCallback(() => {
    clearAll();
    completedRef.current = false;
    brakingRef.current = false;
    setHearts(START_HEARTS);
    setCorrectCount(0);
    setScore(0);
    setCombo(0);
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
    setImpact(false);
    setDustKey(0);
    setTilt(0);
    setLane(0);
    setLanes(2);
    setLaneOptions([]);
    setOutcome("none");
    setPassengerOut(false);
    setBoarding(false);
    // Revancha con mazo fresco: sin esto las 15 preguntas se repiten en el
    // mismo orden y basta memorizarlas. Con seed se conserva el determinismo.
    playDeckRef.current =
      seed !== undefined ? deck : shuffleWith(deck, Math.random);
    // El pasajero sale de un rng aparte del mazo: con seed, los rivales
    // llevan al mismo; sin seed, azar.
    setTrip(pickTrip(seed !== undefined ? mulberry32(seed * 31 + 7) : Math.random));
    parkedRef.current = true;
    setPhase("pickup");
    setT("board", () => setBoarding(true), PICKUP_MS * 0.6);
    setT("pickup", beginDriving, PICKUP_MS);
  }, [clearAll, deck, seed, setT, beginDriving]);

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
      setCombo(comboRef.current);
      setOutcome("clear");
    } else {
      comboRef.current = 0;
      setCombo(0);
      setOutcome("crash"); // el bache arranca a bajar por el carril
      // El golpe llega cuando el bache pasa bajo el taxi, no al pulsar. El
      // temporizador de ronda (RESOLVE_MS) va después, así que el chequeo de
      // corazones de abajo ya lee el valor restado.
      setT(
        "impact",
        () => {
          playSound("wrong");
          heartsRef.current = Math.max(0, heartsRef.current - 1);
          setHearts(heartsRef.current);
          setImpact(true);
          setDustKey((k) => k + 1);
        },
        POTHOLE_MS,
      );
    }

    setT(
      "resolve",
      () => {
        if (heartsRef.current <= 0) {
          startBreakdown();
          return;
        }
        if (correctCountRef.current >= WIN_CORRECT) {
          startArrival();
          return;
        }
        roundRef.current += 1;
        setupRound(roundRef.current);
      },
      RESOLVE_MS,
    );
  }, [question, laneOptions, setupRound, startArrival, startBreakdown, setT]);

  /** Mover el taxi a un carril: se inclina hacia el lado del giro y vuelve. */
  const pickLane = useCallback(
    (i: number) => {
      if (resolvingRef.current) return;
      const dir = Math.sign(i - laneRef.current);
      laneRef.current = i;
      setLane(i);
      if (dir !== 0) {
        setTilt(dir * 4);
        setT("tilt", () => setTilt(0), TAXI_TILT_MS);
      }
    },
    [setT],
  );

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
      const el = sceneRef.current;
      if (el && el.clientWidth !== sceneWRef.current) {
        sceneWRef.current = el.clientWidth;
        setSceneW(el.clientWidth);
      }
      if (el && el.clientHeight !== sceneHRef.current) {
        sceneHRef.current = el.clientHeight;
        setSceneH(el.clientHeight);
      }

      if (parkedRef.current) return; // recogida: todo quieto, solo se mide

      // Llegada y avería: la carretera frena hasta detenerse. Sin cuenta atrás.
      let speed = 1;
      if (brakingRef.current) {
        brakeElapsedRef.current += dtMs;
        const progress = Math.min(1, brakeElapsedRef.current / ARRIVAL_BRAKE_MS);
        speed = 1 - progress;
        setBrakeProgress(progress);
      }

      // rayas en movimiento: translateY cíclico en unidades de plano
      roadYRef.current = (roadYRef.current + dtMs * ROAD_SPEED * speed) % DASH_CYCLE;
      setRoadY(roadYRef.current);

      if (brakingRef.current) return;
      if (approachingRef.current) {
        signElapsedRef.current += dtMs;
        const p = Math.min(1, signElapsedRef.current / SIGN_APPROACH_MS);
        setSignProgress(p);
        if (p >= 1) approachingRef.current = false;
        return; // hasta que la señal se lee, el reloj no corre
      }
      if (resolvingRef.current) return;
      if (noticeRef.current) return; // el aviso congela la cuenta atrás
      remainingRef.current = Math.max(0, remainingRef.current - dtMs);
      setRemaining(remainingRef.current);
      if (remainingRef.current <= 0) resolve(); // se acabó el tiempo: se resuelve con el carril actual
    },
    [resolve],
  );

  useTicker(TICKER_FPS, onTick, inGamePhase(phase));

  if (loading) {
    return (
      <div className="flex min-h-svh items-center justify-center">
        <Spinner title="Calentando el motor…" />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="flex min-h-svh flex-col items-center justify-center gap-4 px-6 text-center">
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

  // ── Derivados de render ────────────────────────────────────────────────────
  // El taxi nunca debe caer en un carril sin cartel: si buildLaneOptions
  // devolvió menos opciones que carriles, se recorta al último con cartel.
  const effectiveLanes = Math.max(1, Math.min(lanes, laneOptions.length || lanes));
  const damage = damageFor(hearts);
  const m = planeMetrics(sceneW, sceneH);
  const laneScale = MIN_LANES / lanes;
  const stopped = phase === "arrival" || phase === "breakdown";
  // Centro del taxi en px de pantalla: su carril mientras se juega, el centro
  // de la calzada en la llegada. El bache usa el mismo carril para caer bajo él.
  const lanePct = laneGeometry(effectiveLanes).centersPct[Math.min(lane, effectiveLanes - 1)] ?? 50;
  const taxiX = laneXBottom(m, phase === "arrival" ? 50 : lanePct);
  const braking = impact || stopped;
  const won = correctCount >= WIN_CORRECT;
  const lost = hearts <= 0;

  return (
    <div className="dots-compact-shell relative flex min-h-svh w-full flex-col items-center overflow-hidden px-4 py-6">
      {phase === "intro" && (
        <>
          <div className="z-10 flex w-full max-w-sm justify-start">
            <ExitFlow onExit={() => router.push("/play")} aviso={null} />
          </div>
          <GameIntro
            gameKey="dotaxi"
            title="Dotaxi"
            howTo={[
              "Doty es taxista: sube un pasajero y llévalo a su destino.",
              "Lee la frase con el hueco y busca la palabra que encaja.",
              "Toca el cartel del pórtico —o su carril— para mover el taxi, y pulsa «¡Vamos!» antes de que se acabe el tiempo.",
              "Empiezas con 2 carriles; según aciertas se abren más (¡hasta 4!).",
              `${WIN_CORRECT} aciertos para llegar. Cada fallo es un bache que abolla el taxi: al quinto se rompe y pierdes.`,
            ]}
            record={record}
            throne={throne}
            onStart={startGame}
          />
        </>
      )}

      {inGame && (
        <div data-testid="road" className="z-10 flex w-full max-w-sm flex-1 flex-col gap-3">
          {/* HUD */}
          <div className="dots-card flex w-full items-center justify-between gap-3 px-4 py-3">
            <ExitFlow
              onExit={() => {
                clearAll();
                // Llegada o avería: la partida YA terminó; salir es saltar la
                // escena, y cuenta para torneo y reto.
                if (stopped) {
                  finishGame();
                  return;
                }
                // Abandonar: el parcial cuenta para el récord, no para el reto
                brakingRef.current = false;
                parkedRef.current = false;
                setFinalScore(scoreRef.current);
                setPhase("result");
              }}
              aviso={phase === "playing" ? "Se acaba la partida, pero tu puntaje cuenta igual." : null}
              compacto
            />
            <span className="flex items-center gap-0.5" aria-label={`${hearts} corazones`}>
              {Array.from({ length: START_HEARTS }).map((_, i) => (
                <UiIcon key={i} name="vidas" size={16} apagado={i >= hearts} />
              ))}
            </span>
            <div className="flex flex-col items-end">
              <span className="text-xs font-black uppercase tracking-widest" style={{ color: "var(--muted)" }}>
                {correctCount}/{WIN_CORRECT}
              </span>
              <span className="font-display text-lg font-extrabold" style={{ color: "var(--accent)" }}>
                {score}
              </span>
              {combo > 1 && (
                <span
                  key={combo}
                  className="rounded-full px-2 py-0.5 text-xs font-black"
                  style={{
                    background: "color-mix(in srgb, var(--gold) 20%, transparent)",
                    color: "var(--gold-edge)",
                    border: "2px solid color-mix(in srgb, var(--gold) 50%, transparent)",
                    animation: "dots-pop-in 0.15s var(--ease-out-strong) both",
                  }}
                >
                  <span className="inline-flex items-center gap-0.5"><UiIcon name="racha" size={16} /> x{combo}</span>
                </span>
              )}
            </div>
          </div>

          {/* Frase con el hueco; en las otras fases, el mensaje del viaje */}
          <div className="dots-card px-4 py-3 text-center">
            {phase === "playing" ? (
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
            ) : (
              <p className="font-display text-lg font-extrabold" style={{ color: "var(--accent)" }}>
                {phase === "pickup" && trip && `${trip.name} sube al taxi`}
                {phase === "arrival" && trip && trip.arrive}
                {phase === "breakdown" && "¡El taxi no da más!"}
              </p>
            )}
          </div>

          {/* Barra de tiempo (scaleX, nunca width) */}
          <div className="h-2 w-full overflow-hidden rounded-full" style={{ background: "var(--border)" }}>
            <div
              className="h-full w-full origin-left rounded-full"
              style={{
                transform: `scaleX(${phase === "playing" ? Math.max(0, remaining) / TIMER_START : 1})`,
                background:
                  phase !== "playing" || remaining > TIMER_START * 0.3 ? "var(--success)" : "var(--danger)",
              }}
            />
          </div>

          {/* Escena: cielo, plano de suelo, pórtico, taxi */}
          <div
            ref={sceneRef}
            data-testid="scene"
            className="relative w-full flex-1 overflow-hidden rounded-2xl border-2"
            style={{
              borderColor: ASPHALT_EDGE,
              background: "var(--sky-bottom)",
              // el tap del carril no compite con el pan de scroll de la página
              touchAction: "manipulation",
            }}
            // un toque salta la recogida, la llegada y la avería
            onPointerUp={
              stopped ? finishGame : phase === "pickup" ? beginDriving : undefined
            }
          >
            {sceneW > 0 && (
              <>
                <Backdrop m={m} />
                <GroundPlane m={m} roadY={roadY} lanes={lanes}>
                  {phase === "playing" && outcome === "crash" && (
                    <Pothole m={m} pct={lanePct} to={m.planeH * 0.92} durationMs={POTHOLE_MS} />
                  )}
                </GroundPlane>

                {/* Llegada: el destino se acerca por el centro de la calzada */}
                {phase === "arrival" && trip && (
                  <DestinationApproach m={m} trip={trip} progress={brakeProgress} />
                )}

                {/* Zona de toque de cada carril, a todo lo alto; las de los
                    extremos se estiran hasta el borde. Va DEBAJO del pórtico
                    en el DOM para no robarle el tap. */}
                {phase === "playing" &&
                  Array.from({ length: effectiveLanes }).map((_, i) => {
                    const laneW = m.roadBottomW / effectiveLanes;
                    const first = i === 0;
                    const last = i === effectiveLanes - 1;
                    return (
                      <button
                        key={i}
                        type="button"
                        data-testid={`lane-zone-${i}`}
                        aria-label={`Ir al carril ${i + 1}: ${laneOptions[i] ?? ""}`}
                        onPointerUp={() => pickLane(i)}
                        className="absolute inset-y-0"
                        style={{
                          left: first ? 0 : CURB_BOTTOM_PX + i * laneW,
                          width: laneW + (first ? CURB_BOTTOM_PX : 0) + (last ? CURB_BOTTOM_PX : 0),
                          touchAction: "manipulation",
                        }}
                      />
                    );
                  })}

                {phase === "playing" && (
                  <GantryApproach m={m} progress={signProgress}>
                    <Gantry
                      m={m}
                      lanes={lanes}
                      options={laneOptions}
                      lane={lane}
                      outcome={outcome}
                      correct={question?.correct}
                      onPick={pickLane}
                    />
                  </GantryApproach>
                )}

                {/* Recogida: el pasajero espera en la acera y sube */}
                {phase === "pickup" && trip && (
                  <>
                    <div
                      className="pointer-events-none absolute"
                      style={{
                        left: -2,
                        bottom: 22,
                        transform: boarding ? "translateX(44px) scale(0.8)" : "none",
                        opacity: boarding ? 0 : 1,
                        transition: "transform 420ms var(--ease-out-strong), opacity 380ms",
                        animation: "dotaxi-fade-in 0.3s var(--ease-out-strong) both",
                      }}
                    >
                      <Passenger trip={trip} size={64} eager />
                    </div>
                    {!boarding && (
                      <SpeechBubble text={trip.ask} style={{ left: 8, bottom: TAXI_H + 4, maxWidth: m.sceneW * 0.62 }} />
                    )}
                  </>
                )}

                {/* Taxi. Decorativo (pointer-events none), o taparía la zona
                    del carril donde está parado. Capas: carril (280 ms, o el
                    frenazo entero al centrarse), zoom de cámara (450 ms) e
                    inclinación del giro (260 ms): tres duraciones distintas
                    no caben en un solo transform. */}
                <div
                  data-testid="taxi"
                  className="pointer-events-none absolute"
                  style={{
                    left: 0,
                    bottom: 10,
                    transform: `translateX(${taxiX}px) translateX(-50%)`,
                    transition: `transform ${phase === "arrival" ? ARRIVAL_BRAKE_MS : 280}ms var(--ease-out-strong)`,
                  }}
                >
                  <div
                    style={{
                      transform: `scale(${laneScale})`,
                      transformOrigin: "bottom center",
                      transition: `transform ${TIER_ZOOM_MS}ms var(--ease-out-strong)`,
                    }}
                  >
                    <div
                      className="relative"
                      style={{
                        transform: `rotate(${tilt}deg)`,
                        transformOrigin: "bottom center",
                        transition: `transform ${TAXI_TILT_MS}ms var(--ease-out-strong)`,
                      }}
                    >
                      <TaxiRear
                        damage={damage}
                        braking={braking}
                        crashing={impact}
                        pose={
                          impact
                            ? "oh-no"
                            : phase === "arrival"
                              ? "lo-lograste"
                              : phase === "breakdown"
                                ? "llanto-dramatico"
                                : outcome === "clear"
                                  ? "excelente"
                                  : "feliz"
                        }
                      />
                      {dustKey > 0 && <Dust key={dustKey} />}
                    </div>
                  </div>
                </div>

                {/* Llegada: el pasajero baja junto al taxi */}
                {phase === "arrival" && trip && passengerOut && (
                  <div
                    className="pointer-events-none absolute"
                    style={{
                      left: taxiX + (TAXI_H * laneScale) / 2 + 6,
                      bottom: 18,
                      animation: "dotaxi-fade-in 0.35s var(--ease-out-strong) both",
                    }}
                  >
                    <Passenger trip={trip} size={56} />
                  </div>
                )}

                {/* aviso de carril nuevo */}
                {tierNotice && (
                  <div
                    data-testid="tier-notice"
                    className="pointer-events-none absolute inset-x-0 text-center font-display text-xl font-extrabold"
                    style={{
                      top: "52%",
                      color: "var(--accent)",
                      textShadow: `0 2px 8px ${ASPHALT_EDGE}`,
                      animation: "dots-pop-in 0.3s var(--ease-out-strong) both",
                    }}
                  >
                    ¡Carril nuevo!
                  </div>
                )}
              </>
            )}
          </div>

          {/* Confirmar: separado de moverse */}
          <button
            data-testid="go"
            onPointerUp={resolve}
            disabled={phase !== "playing" || outcome !== "none" || signProgress < 1}
            className="dots-pressable w-full rounded-2xl py-4 text-base font-extrabold disabled:opacity-40"
            style={{
              background: "var(--accent)",
              color: "var(--accent-contrast)",
              ["--press-color" as string]: "var(--accent-edge)",
            }}
          >
            {phase === "pickup"
              ? "Subiendo pasajero…"
              : phase === "arrival"
                ? "Llegando a destino…"
                : phase === "breakdown"
                  ? "Taxi averiado…"
                  : signProgress < 1
                    ? "Se acerca la señal…"
                    : "¡Vamos!"}
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
            trip ? (
              <div className="flex w-full flex-col items-center gap-3">
                {/* Cómo acabó el viaje: quién iba y adónde */}
                <div className="flex items-end justify-center gap-4">
                  <Passenger trip={trip} size={56} style={{ opacity: lost ? 0.6 : 1 }} />
                  <div style={{ opacity: won ? 1 : 0.4, filter: won ? "none" : "grayscale(0.6)" }}>
                    <DestinationArt trip={trip} width={72} />
                  </div>
                </div>
                <p className="text-center text-sm font-bold" style={{ color: "var(--muted)" }}>
                  {won ? trip.arrived : lost ? trip.failed : trip.midway}
                </p>
                <p className="text-center text-xs font-black uppercase tracking-widest" style={{ color: "var(--muted)" }}>
                  {correctCount}/{WIN_CORRECT} aciertos
                </p>
              </div>
            ) : (
              <p className="text-sm font-bold text-center" style={{ color: "var(--muted)" }}>
                {correctCount}/{WIN_CORRECT} aciertos
              </p>
            )
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
        <div className="flex min-h-svh items-center justify-center">
          <Spinner title="Cargando…" />
        </div>
      }
    >
      <DotaxiGame />
    </Suspense>
  );
}
