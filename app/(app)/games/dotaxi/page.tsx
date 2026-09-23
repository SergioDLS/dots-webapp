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
import { planeMetrics, laneXBottom } from "./perspective";
import { pickTrip, type Trip } from "./trip";
import {
  Backdrop,
  GroundPlane,
  HorizonHaze,
  Roadside,
  Clouds,
  Obstacle,
  OBSTACLE_KINDS,
  type ObstacleKind,
  FloatingWords,
  SpeedLines,
  Remark,
  TireSmoke,
  TaxiRear,
  ReactionBubble,
  DestinationApproach,
  DestinationArt,
  Passenger,
  SpeechBubble,
  Dust,
  ASPHALT_EDGE,
  TAXI_H,
  TAXI_W,
  type Damage,
} from "./scene";
import type { DotyPose } from "@/components/ui/doty/doty";

// ── Constantes ───────────────────────────────────────────────────────────────

const START_HEARTS = 5;
const WIN_CORRECT = 10;
// Tiempo para responder, desde que las palabras son legibles: arranca en
// TIMER_START, se recorta TIMER_STEP por ronda hasta TIMER_MIN y suma
// LANE_BONUS_MS por cada carril más allá del mínimo (más opciones que leer).
// Sergio lo sintió muy corto con 5 s / 2,5 s.
const TIMER_START = 7000;
const TIMER_STEP = 250;
const TIMER_MIN = 4000;
const LANE_BONUS_MS = 1200;
const TICKER_FPS = 30;
const RESOLVE_MS = 1300; // pausa tras resolver la ronda
// Al confirmar, cada carril INCORRECTO suelta un obstáculo que baja desde el
// punto de fuga y pasa de largo: si acertaste ves lo que esquivaste; si no, el
// de tu carril te golpea. El golpe (sonido, corazón, abolladura) llega cuando
// el obstáculo pasa bajo el morro (avance IMPACT_P), no al pulsar.
const IMPACT_MS = 450;
const IMPACT_P = 0.92; // avance del obstáculo cuando golpea (1 = pie del plano)
const OBSTACLE_MS = Math.round(IMPACT_MS / IMPACT_P); // lo que tarda en llegar al pie
// El taxi, un poco más grande que su sprite: en una calzada más ancha que la
// pantalla se perdía.
const TAXI_ZOOM = 1.12;
// Recogida: el pasajero espera en la acera con su petición hasta que el
// jugador pulsa «¡Vamos!»; entonces sube y el taxi arranca.
const BOARD_MS = 650;
// Intermitente al cambiar de carril.
const SIGNAL_MS = 900;
// El pasajero comenta desde atrás: sale un poco después de Doty y se va solo.
// No habla en cada suceso —cansaba— sino con estas probabilidades.
const REMARK_DELAY_MS = 260;
const REMARK_MS = 1500;
const REMARK_MAX_W = 160; // ancho máximo del bocadillo del pasajero, en px
const REMARK_CHANCE_CHEER = 0.4;
const REMARK_CHANCE_OUCH = 0.7;
const REMARK_CHANCE_HURRY = 0.35;
// Con menos de esto en el reloj, el pasajero mete prisa (una vez por ronda).
const HURRY_AT_MS = 1300;
// Velocidad: cada acierto de racha suma un escalón (tope SPEED_MAX_COMBO) y al
// confirmar el taxi acelera un instante para atravesar las palabras.
const SPEED_PER_COMBO = 0.12;
const SPEED_MAX_COMBO = 5;
const BURST_BOOST = 0.6;
// Llegada: el destino crece desde el punto de fuga y la carretera frena.
const ARRIVAL_BRAKE_MS = 1400;
const ARRIVAL_MS = 2400;
// Avería: al perder el último corazón el taxi se detiene humeando.
const BREAKDOWN_MS = 2200;
const TIER_ZOOM_MS = 450; // cámara alejándose al abrirse un carril
// El aviso congela la cuenta atrás; tiene que durar al menos lo que el zoom.
const TIER_NOTICE_MS = 900;
const TAXI_TILT_MS = 260; // inclinación al cambiar de carril
// Las palabras nacen en el punto de fuga y se acercan hasta ser legibles; el
// reloj no arranca hasta entonces. Leer no puede costar tiempo de respuesta.
const SIGN_APPROACH_MS = 900;
// Velocidad en unidades de plano por ms: la perspectiva la multiplica por
// kBottom (8) en el borde cercano y la deja tal cual en el horizonte.
const ROAD_SPEED = 0.1;

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
  | "resolve" | "notice" | "impact" | "tilt" | "board" | "arrival" | "out" | "breakdown"
  | "signal" | "remark" | "remarkHide";

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
  const distRef = useRef(0); // distancia recorrida en unidades de plano (no cíclica)
  // Obstáculos de la ronda: nacen al confirmar y el ticker los hace avanzar.
  const obstacleElapsedRef = useRef(0);
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
  // El pasajero ya está subiendo: un segundo «¡Vamos!» no reinicia la subida.
  const boardingRef = useRef(false);
  // El viaje, para los callbacks del motor (los comentarios del pasajero).
  const tripRef = useRef<Trip | null>(null);
  // Ya metió prisa en esta ronda.
  const hurriedRef = useRef(false);
  // Última frase dicha: la siguiente se elige entre las demás.
  const lastLineRef = useRef<string | null>(null);

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
  // Con cuánto arrancó la ronda: la barra se pinta contra esto, no contra
  // TIMER_START (con eso salía a medias en las rondas cortas).
  const [roundTime, setRoundTime] = useState(TIMER_START);
  const [outcome, setOutcome] = useState<"none" | "clear" | "crash">("none");
  const [tierNotice, setTierNotice] = useState(false);
  const [dist, setDist] = useState(0);
  const [obstacles, setObstacles] = useState<{ id: number; pct: number; kind: ObstacleKind }[]>([]);
  const [obstacleT, setObstacleT] = useState(0);
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
  // intermitente del taxi: −1 izquierda, 1 derecha, 0 apagado
  const [signal, setSignal] = useState<-1 | 0 | 1>(0);
  // lo que dice el pasajero ahora (null: nada); la key remonta el bocadillo
  const [remark, setRemark] = useState<string | null>(null);
  const [remarkKey, setRemarkKey] = useState(0);

  /** El pasajero comenta desde atrás, un poco después de la reacción de Doty. */
  const say = useCallback(
    (text: string) => {
      lastLineRef.current = text;
      setT(
        "remark",
        () => {
          setRemark(text);
          setRemarkKey((k) => k + 1);
        },
        REMARK_DELAY_MS,
      );
      setT("remarkHide", () => setRemark(null), REMARK_DELAY_MS + REMARK_MS);
    },
    [setT],
  );

  /** Comenta con probabilidad `chance`, sin repetir la última frase. Azar
   *  cosmético: no toca el seed de torneo ni de reto. */
  const maybeSay = useCallback(
    (lines: readonly string[], chance: number) => {
      if (lines.length === 0 || Math.random() >= chance) return;
      const pool = lines.length > 1 ? lines.filter((l) => l !== lastLineRef.current) : lines;
      const line = pool[Math.floor(Math.random() * pool.length)];
      if (line) say(line);
    },
    [say],
  );

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
      const total =
        Math.max(TIMER_MIN, TIMER_START - TIMER_STEP * idx) + Math.max(0, nextLanes - MIN_LANES) * LANE_BONUS_MS;
      setRoundTime(total);
      remainingRef.current = total;
      setRemaining(total);
      setOutcome("none");
      setImpact(false);
      setDustKey(0);
      setObstacles([]);
      resolvingRef.current = false;
      hurriedRef.current = false;
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
    setObstacles([]);
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
    setObstacles([]);
    brakeElapsedRef.current = 0;
    brakingRef.current = true;
    setBrakeProgress(0);
    setPhase("breakdown");
    setT("breakdown", finishGame, BREAKDOWN_MS);
    if (tripRef.current) say(tripRef.current.voice.groan);
  }, [clearT, setT, finishGame, say]);

  /** Fin de la recogida: arranca la primera ronda. */
  const beginDriving = useCallback(() => {
    clearT("board");
    parkedRef.current = false;
    boardingRef.current = false;
    setBoarding(false);
    setPhase("playing");
    setupRound(0);
  }, [clearT, setupRound]);

  /** «¡Vamos!» en la recogida: el pasajero sube y, al cerrar la puerta, se arranca. */
  const boardPassenger = useCallback(() => {
    if (boardingRef.current) return;
    boardingRef.current = true;
    setBoarding(true);
    setT("board", beginDriving, BOARD_MS);
  }, [setT, beginDriving]);

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
    distRef.current = 0;
    setObstacles([]);
    setImpact(false);
    setDustKey(0);
    setTilt(0);
    setLane(0);
    setLanes(2);
    setLaneOptions([]);
    setOutcome("none");
    setPassengerOut(false);
    setBoarding(false);
    boardingRef.current = false;
    setSignal(0);
    setRemark(null);
    // Revancha con mazo fresco: sin esto las 15 preguntas se repiten en el
    // mismo orden y basta memorizarlas. Con seed se conserva el determinismo.
    playDeckRef.current =
      seed !== undefined ? deck : shuffleWith(deck, Math.random);
    // El pasajero sale de un rng aparte del mazo: con seed, los rivales
    // llevan al mismo; sin seed, azar.
    const nextTrip = pickTrip(seed !== undefined ? mulberry32(seed * 31 + 7) : Math.random);
    tripRef.current = nextTrip;
    setTrip(nextTrip);
    // El taxi espera parado hasta «¡Vamos!»: la petición del pasajero se lee
    // con calma, y arrancar es un gesto del jugador.
    parkedRef.current = true;
    setPhase("pickup");
  }, [clearAll, deck, seed]);

  const resolve = useCallback(() => {
    if (resolvingRef.current || !question) return;
    resolvingRef.current = true;

    const chosen = laneOptions[laneRef.current];
    const hit = chosen === question.correct;

    // Un obstáculo por carril incorrecto. Del seed en torneo y reto, para que
    // los rivales vean lo mismo; al azar en partida libre.
    const rng = seed !== undefined ? mulberry32(seed * 97 + roundRef.current * 13 + 5) : Math.random;
    const { centersPct } = laneGeometry(Math.max(1, laneOptions.length));
    obstacleElapsedRef.current = 0;
    setObstacleT(0);
    setObstacles(
      laneOptions
        .map((opt, i) => ({ opt, i }))
        .filter(({ opt }) => opt !== question.correct)
        .map(({ i }) => ({
          id: roundRef.current * 10 + i,
          pct: centersPct[i] ?? 50,
          kind: OBSTACLE_KINDS[Math.floor(rng() * OBSTACLE_KINDS.length)] ?? "cerdito",
        })),
    );

    const voice = tripRef.current?.voice;
    if (hit) {
      playSound("correct");
      if (voice) maybeSay(voice.cheer, REMARK_CHANCE_CHEER);
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
      setOutcome("crash");
      // El golpe llega cuando el obstáculo pasa bajo el taxi, no al pulsar. El
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
          if (voice) maybeSay(voice.ouch, REMARK_CHANCE_OUCH);
        },
        IMPACT_MS,
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
  }, [question, laneOptions, seed, setupRound, startArrival, startBreakdown, setT, maybeSay]);

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
        setSignal(dir as -1 | 1);
        setT("signal", () => setSignal(0), SIGNAL_MS);
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

      // La racha acelera la carretera y, al confirmar, el taxi pega un
      // acelerón que se apaga a lo largo de la resolución.
      const burst = resolvingRef.current ? Math.max(0, 1 - obstacleElapsedRef.current / RESOLVE_MS) : 0;
      const mul = 1 + Math.min(comboRef.current, SPEED_MAX_COMBO) * SPEED_PER_COMBO + BURST_BOOST * burst;

      // distancia recorrida en unidades de plano: rayas, bordillos y laterales
      // la comparten, cada uno con su periodo
      distRef.current += dtMs * ROAD_SPEED * speed * mul;
      setDist(distRef.current);

      // los obstáculos avanzan aunque la ronda esté resolviéndose
      if (resolvingRef.current) {
        obstacleElapsedRef.current += dtMs;
        setObstacleT(obstacleElapsedRef.current);
      }

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
      if (remainingRef.current <= HURRY_AT_MS && !hurriedRef.current && tripRef.current) {
        hurriedRef.current = true;
        maybeSay([tripRef.current.voice.hurry], REMARK_CHANCE_HURRY);
      }
      if (remainingRef.current <= 0) resolve(); // se acabó el tiempo: se resuelve con el carril actual
    },
    [resolve, maybeSay],
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
  const stopped = phase === "arrival" || phase === "breakdown";
  // Centro del taxi en px de pantalla: su carril mientras se juega, el centro
  // de la calzada en la recogida y la llegada. En la recogida el carril 0 cae
  // casi fuera de la escena (la calzada es más ancha que la pantalla) y el
  // taxi tapaba al pasajero que espera a su izquierda.
  const lanePct = laneGeometry(effectiveLanes).centersPct[Math.min(lane, effectiveLanes - 1)] ?? 50;
  const laneScale = (MIN_LANES / lanes) * TAXI_ZOOM;
  // Con la calzada un 50 % más ancha que la escena, el carril del borde cae en
  // buena parte fuera. El taxi se queda ENTERO dentro del marco, sobre la
  // parte visible de su carril: asomando un tercio por fuera (probado) se veía
  // mal ubicado.
  const taxiHalf = (TAXI_W * laneScale) / 2;
  const taxiMin = taxiHalf + 6;
  const rawTaxiX = laneXBottom(m, phase === "arrival" || phase === "pickup" ? 50 : lanePct);
  const taxiX = sceneW > 0 ? Math.min(Math.max(rawTaxiX, taxiMin), m.sceneW - taxiMin) : rawTaxiX;
  // Los bocadillos se abren hacia el centro de la escena: en el carril del
  // borde, hacia fuera se perdían. Doty sobre el techo; el pasajero a la
  // altura de la ventanilla, acotado para no salirse por el otro lado.
  const bubbleSide: "left" | "right" = taxiX <= m.sceneW / 2 ? "right" : "left";
  const wrapperLeft = taxiX - TAXI_W / 2;
  const remarkGap = taxiHalf + 4;
  const remarkLeftScreen =
    bubbleSide === "right"
      ? Math.min(taxiX + remarkGap, m.sceneW - 6 - REMARK_MAX_W)
      : Math.max(taxiX - remarkGap - REMARK_MAX_W, 6);
  const remarkStyle: React.CSSProperties = {
    left: remarkLeftScreen - wrapperLeft,
    bottom: TAXI_H * laneScale * 0.6,
    maxWidth: REMARK_MAX_W,
  };
  const reactionStyle: React.CSSProperties = {
    ...(bubbleSide === "right" ? { left: TAXI_W / 2 + 10 * laneScale } : { right: TAXI_W / 2 + 10 * laneScale }),
    bottom: TAXI_H * laneScale + 8,
  };
  const braking = impact || stopped;
  // La velocidad que se ve: vaivén del motor y líneas en los bordes.
  const speedMul = 1 + Math.min(combo, SPEED_MAX_COMBO) * SPEED_PER_COMBO;
  const burst = outcome !== "none" ? Math.max(0, 1 - obstacleT / RESOLVE_MS) : 0;
  const speedIntensity = phase === "playing" ? (speedMul - 1) / (SPEED_MAX_COMBO * SPEED_PER_COMBO) + 0.8 * burst : 0;
  const wordsExit = outcome !== "none" ? Math.min(1, obstacleT / RESOLVE_MS) : 0;
  const won = correctCount >= WIN_CORRECT;
  const lost = hearts <= 0;
  // La cara de Doty salta en burbuja cuando pasa algo; en marcha normal no hay.
  const reaction: DotyPose | null = impact
    ? "oh-no"
    : phase === "arrival"
      ? "lo-lograste"
      : phase === "breakdown"
        ? "llanto-dramatico"
        : outcome === "clear"
          ? "excelente"
          : null;

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
              "Toca la palabra que flota sobre su carril —o el carril mismo— para mover el taxi, y pulsa «¡Vamos!» antes de que se acabe el tiempo.",
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
                {phase === "pickup" && trip && (boarding ? `${trip.name} sube al taxi` : `${trip.name} pide un taxi`)}
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
                transform: `scaleX(${phase === "playing" ? Math.max(0, remaining) / roundTime : 1})`,
                background:
                  phase !== "playing" || remaining > roundTime * 0.3 ? "var(--success)" : "var(--danger)",
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
            // un toque salta la llegada y la avería (la recogida arranca con el botón)
            onPointerUp={stopped ? finishGame : undefined}
          >
            {sceneW > 0 && (
              <>
                <Backdrop m={m} />
                <Clouds m={m} />
                <GroundPlane m={m} dist={dist} lanes={lanes} />
                <HorizonHaze m={m} />
                <Roadside m={m} dist={dist} />
                <SpeedLines m={m} intensity={speedIntensity} />

                {/* Obstáculos de la ronda, uno por carril incorrecto */}
                {phase === "playing" &&
                  obstacles.map((o) => (
                    <Obstacle key={o.id} m={m} kind={o.kind} pct={o.pct} p={obstacleT / OBSTACLE_MS} />
                  ))}

                {/* Llegada: el destino se acerca por el centro de la calzada */}
                {phase === "arrival" && trip && (
                  <DestinationApproach m={m} trip={trip} progress={brakeProgress} />
                )}

                {/* Zona de toque de cada carril, a todo lo alto; las de los
                    extremos se estiran hasta el borde. Va DEBAJO del pórtico
                    en el DOM para no robarle el tap. */}
                {phase === "playing" &&
                  Array.from({ length: effectiveLanes }).map((_, i) => {
                    // la calzada sobresale de la escena: las zonas se recortan
                    // al ancho visible y las de los extremos absorben el resto
                    const laneW = m.roadBottomW / effectiveLanes;
                    const rawLeft = m.roadLeftBottom + i * laneW;
                    const left = Math.max(0, rawLeft);
                    const right = Math.min(m.sceneW, rawLeft + laneW);
                    return (
                      <button
                        key={i}
                        type="button"
                        data-testid={`lane-zone-${i}`}
                        aria-label={`Ir al carril ${i + 1}: ${laneOptions[i] ?? ""}`}
                        onPointerUp={() => pickLane(i)}
                        className="absolute inset-y-0"
                        style={{ left, width: Math.max(0, right - left), touchAction: "manipulation" }}
                      />
                    );
                  })}

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
                      <SpeechBubble text={trip.ask} style={{ left: 8, bottom: TAXI_H + 4, maxWidth: m.sceneW * 0.7, fontSize: 15 }} />
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
                      <TaxiRear damage={damage} braking={braking} crashing={impact} speed={speedMul} signal={signal} />
                      {dustKey > 0 && <Dust key={dustKey} />}
                      {/* humo de ruedas: en cada golpe y al frenar en la llegada o la avería */}
                      {dustKey > 0 && <TireSmoke key={`hit-${dustKey}`} />}
                      {stopped && <TireSmoke />}
                    </div>
                  </div>
                  {reaction && <ReactionBubble key={reaction} pose={reaction} side={bubbleSide} style={reactionStyle} />}
                  {/* el pasajero, desde la ventanilla del lado del centro */}
                  {remark && trip && !passengerOut && (
                    <Remark key={remarkKey} trip={trip} text={remark} side={bubbleSide === "right" ? "right" : "left"} style={remarkStyle} />
                  )}
                </div>

                {/* Las palabras van por encima de todo: al atravesarlas pasan
                    sobre la cámara. Su zona de toque no compite con el taxi
                    (decorativo) ni con los carriles (debajo en el DOM). */}
                {phase === "playing" && (
                  <FloatingWords
                    m={m}
                    options={laneOptions}
                    lane={lane}
                    outcome={outcome}
                    correct={question?.correct}
                    onPick={pickLane}
                    approach={signProgress}
                    exit={wordsExit}
                  />
                )}

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
                    {/* anclado por la derecha: el pasajero baja por el lado
                        derecho y un bocadillo que creciera hacia allá se
                        saldría de la escena */}
                    <SpeechBubble
                      text={trip.voice.thanks}
                      tail="right"
                      style={{ right: -4, bottom: 56 + 12, width: "max-content", maxWidth: m.sceneW * 0.5, fontSize: 12 }}
                    />
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
            onPointerUp={phase === "pickup" ? boardPassenger : resolve}
            disabled={
              phase === "pickup"
                ? boarding
                : phase !== "playing" || outcome !== "none" || signProgress < 1
            }
            className="dots-pressable w-full rounded-2xl py-4 text-base font-extrabold disabled:opacity-40"
            style={{
              background: "var(--accent)",
              color: "var(--accent-contrast)",
              ["--press-color" as string]: "var(--accent-edge)",
            }}
          >
            {phase === "pickup"
              ? boarding
                ? "Subiendo pasajero…"
                : "¡Vamos!"
              : phase === "arrival"
                ? "Llegando a destino…"
                : phase === "breakdown"
                  ? "Taxi averiado…"
                  : signProgress < 1
                    ? "Llegan las palabras…"
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
          // sin llegar a la meta Doty no celebra: decepcionado si el taxi se
          // rompió, triste si el jugador se bajó a medio camino
          // llegaste: Doty taxista con su gorra; taxi roto: decepcionado;
          // medio camino: triste
          dotyPose={won ? "taxista" : lost ? "decepcionado" : "triste"}
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
