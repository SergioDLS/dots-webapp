"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import Doty from "@/components/ui/doty/doty";
import WordImg from "@/components/ui/word-img/word-img";
import UIButton from "@/components/ui/button/button";
import Spinner from "@/components/ui/Spinner/Spinner";
import { getGameWordsService, type GameWord } from "@/services/games.service";
import {
  submitGameScoreService,
  type ScoreResult,
} from "@/services/engagement.service";
import XpReward from "@/components/ui/xp-reward";

const BombImg = "/images/DotBombs/bomb.png";
const ExplosionImg = "/images/DotBombs/bomb-explosion.png";
const Checkmark = "/images/answers/checkmark.png";

const FALL_DISTANCE = 50; // game units; bomb explodes when it reaches this
const TICK_MS = 100;
const START_LIVES = 5;
const WIN_SCORE = 1000;

type Place = "start" | "difficulties" | "game" | "endgame";
type Mode = "normal" | "survival";
type Difficulty = "easy" | "medium" | "hard";

type BombState = "bomb" | "word" | "explode" | "correct";
type Bomb = {
  title: string;
  src: string | null;
  distance: number;
  falling: boolean;
  state: BombState;
};

type Config = {
  bombQty: number;
  amount: number; // fall speed per tick
  interval: number; // seconds between spawns
  scoreMult: number;
};

const DIFFICULTY_CONFIG: Record<Difficulty, Config> = {
  easy: { bombQty: 2, amount: 0.1, interval: 5, scoreMult: 3 },
  medium: { bombQty: 3, amount: 0.3, interval: 3, scoreMult: 2 },
  hard: { bombQty: 5, amount: 0.5, interval: 2, scoreMult: 1 },
};
const SURVIVAL_CONFIG: Config = {
  bombQty: 5,
  amount: 0.01,
  interval: 5,
  scoreMult: 1,
};

export default function DotBombsPage() {
  const [place, setPlace] = useState<Place>("start");
  const [mode, setMode] = useState<Mode>("normal");
  const [difficulty, setDifficulty] = useState<Difficulty>("easy");
  const [bombs, setBombs] = useState<Bomb[]>([]);
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(START_LIVES);
  const [search, setSearch] = useState("");
  const [dotyPose, setDotyPose] = useState("14");
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(true);
  const [reward, setReward] = useState<ScoreResult | null>(null);
  const scoreSubmittedRef = useRef(false);

  // mutable engine state read inside the tick loop
  const words = useRef<GameWord[]>([]);
  const engine = useRef<{
    bombs: Bomb[];
    cfg: Config;
    mode: Mode;
    spawnAccum: number;
    running: boolean;
  }>({
    bombs: [],
    cfg: DIFFICULTY_CONFIG.easy,
    mode: "normal",
    spawnAccum: 0,
    running: false,
  });
  const livesRef = useRef(START_LIVES);
  const scoreRef = useRef(0);

  useEffect(() => {
    let active = true;
    getGameWordsService()
      .then((w) => {
        if (active) words.current = w.filter((x) => x.src);
      })
      .catch(() => {})
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, []);

  const endgame = useCallback((text: string, pose: string) => {
    engine.current.running = false;
    setResult(text);
    setDotyPose(pose);
    setPlace("endgame");
    // fire-and-forget: sync the run's score, then show "+N XP" if it arrives
    if (!scoreSubmittedRef.current) {
      scoreSubmittedRef.current = true;
      submitGameScoreService("dot-bombs", scoreRef.current)
        .then(setReward)
        .catch(() => {});
    }
  }, []);

  // pick a word not already shown on another active bomb
  const pickWord = useCallback((): GameWord | null => {
    const pool = words.current;
    if (pool.length === 0) return null;
    const active = new Set(
      engine.current.bombs.filter((b) => b.title).map((b) => b.title),
    );
    for (let tries = 0; tries < pool.length; tries++) {
      const w = pool[Math.floor(Math.random() * pool.length)];
      if (!active.has(w.title)) return w;
    }
    return pool[Math.floor(Math.random() * pool.length)];
  }, []);

  // single game loop: drop falling bombs + spawn new ones on the interval
  useEffect(() => {
    if (place !== "game") return;
    const id = setInterval(() => {
      const e = engine.current;
      if (!e.running) return;

      // accelerate survival mode over time
      if (e.mode === "survival") {
        e.cfg = { ...e.cfg, amount: e.cfg.amount + 0.0002 };
      }

      // spawn
      e.spawnAccum += TICK_MS;
      if (e.spawnAccum >= e.cfg.interval * 1000) {
        e.spawnAccum = 0;
        const free = e.bombs.findIndex((b) => !b.falling && b.distance === 0);
        if (free !== -1) {
          const w = pickWord();
          if (w) {
            e.bombs[free] = {
              title: w.title,
              src: w.src,
              distance: 0,
              falling: true,
              state: "word",
            };
          }
        }
      }

      // drop
      let lostLife = false;
      e.bombs.forEach((b, i) => {
        if (!b.falling) return;
        if (b.distance < FALL_DISTANCE) {
          b.distance += e.cfg.amount;
        } else {
          // exploded
          b.state = "explode";
          b.falling = false;
          lostLife = true;
          setTimeout(() => {
            const bb = engine.current.bombs[i];
            if (bb) {
              bb.distance = 0;
              bb.title = "";
              bb.src = null;
              bb.state = "bomb";
              setBombs([...engine.current.bombs]);
            }
          }, 1200);
        }
      });

      if (lostLife) {
        livesRef.current -= 1;
        setLives(livesRef.current);
        setDotyPose("05");
        setTimeout(() => setDotyPose("14"), 1000);
        if (livesRef.current <= 0) {
          setBombs([...e.bombs]);
          endgame("You exploded! 💥", "05");
          return;
        }
      }

      setBombs([...e.bombs]);
    }, TICK_MS);
    return () => clearInterval(id);
  }, [place, pickWord, endgame]);

  const startGame = (selectedMode: Mode, selectedDifficulty?: Difficulty) => {
    const cfg =
      selectedMode === "survival"
        ? SURVIVAL_CONFIG
        : DIFFICULTY_CONFIG[selectedDifficulty ?? "easy"];
    const fresh: Bomb[] = Array.from({ length: cfg.bombQty }, () => ({
      title: "",
      src: null,
      distance: 0,
      falling: false,
      state: "bomb",
    }));
    engine.current = {
      bombs: fresh,
      cfg: { ...cfg },
      mode: selectedMode,
      spawnAccum: cfg.interval * 1000, // spawn one almost immediately
      running: true,
    };
    livesRef.current = START_LIVES;
    scoreRef.current = 0;
    scoreSubmittedRef.current = false;
    setReward(null);
    setMode(selectedMode);
    if (selectedDifficulty) setDifficulty(selectedDifficulty);
    setLives(START_LIVES);
    setScore(0);
    setSearch("");
    setDotyPose("14");
    setBombs(fresh);
    setPlace("game");
  };

  const handleType = (value: string) => {
    setSearch(value);
    const guess = value.toUpperCase().trim();
    if (!guess) return;
    const e = engine.current;
    const idx = e.bombs.findIndex(
      (b) => b.falling && b.title.toUpperCase().trim() === guess,
    );
    if (idx === -1) return;

    const bomb = e.bombs[idx];
    const gained = Math.floor((FALL_DISTANCE - bomb.distance) * e.cfg.scoreMult);
    scoreRef.current += Math.max(0, gained);
    bomb.state = "correct";
    bomb.falling = false;
    setSearch("");
    setDotyPose("02");
    setTimeout(() => setDotyPose("14"), 800);

    if (e.mode === "normal" && scoreRef.current >= WIN_SCORE) {
      scoreRef.current = WIN_SCORE;
      setScore(WIN_SCORE);
      endgame("You WIN! 🏆", "02");
    } else {
      setScore(scoreRef.current);
    }

    setTimeout(() => {
      const bb = engine.current.bombs[idx];
      if (bb) {
        bb.distance = 0;
        bb.title = "";
        bb.src = null;
        bb.state = "bomb";
        setBombs([...engine.current.bombs]);
      }
    }, 1500);
    setBombs([...e.bombs]);
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner title="Loading game..." />
      </div>
    );
  }

  return (
    <div className="relative flex min-h-screen w-full flex-col items-center overflow-hidden px-4 py-6">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-32 -right-24 h-80 w-80 rounded-full opacity-20 blur-3xl"
        style={{ background: "var(--primary)" }}
      />

      {/* Top bar */}
      <div className="dots-card z-10 flex w-full max-w-2xl items-center justify-between gap-3 px-4 py-3">
        <button
          onClick={() => window.location.assign("/levels")}
          className="text-sm font-bold text-(--muted) hover:text-(--accent) transition-colors"
        >
          ← Exit
        </button>
        <span className="font-display text-lg font-extrabold text-(--accent)">
          Dot Bombs!
        </span>
        {place === "game" ? (
          <div className="flex items-center gap-3">
            <span className="text-sm font-extrabold text-foreground tabular-nums">
              {score}
            </span>
            <div className="flex items-center gap-0.5">
              {Array.from({ length: START_LIVES }).map((_, i) => (
                <span
                  key={i}
                  className="text-base leading-none"
                  style={{
                    filter: i < lives ? "none" : "grayscale(1)",
                    opacity: i < lives ? 1 : 0.3,
                  }}
                >
                  ❤️
                </span>
              ))}
            </div>
          </div>
        ) : (
          <span className="w-10" />
        )}
      </div>

      <div className="relative z-10 mt-4 flex w-full max-w-2xl flex-1 flex-col items-center">
        {place === "start" && (
          <div className="dots-card mt-8 flex flex-col items-center gap-6 px-8 py-12 text-center">
            <div style={{ animation: "dots-wiggle 2s ease-in-out infinite" }}>
              <Doty pose="12" size="small" />
            </div>
            <h2 className="font-display text-2xl font-extrabold text-foreground">
              Defuse the falling bombs!
            </h2>
            <p className="max-w-sm text-sm font-semibold text-(--muted)">
              Type each word before its bomb hits the ground. Lose all five
              hearts and it&apos;s game over.
            </p>
            <div className="flex flex-col gap-3 w-full max-w-xs">
              <UIButton tone="accent" fullWidth onClick={() => setPlace("difficulties")}>
                Normal mode
              </UIButton>
              <UIButton tone="neutral" fullWidth onClick={() => startGame("survival")}>
                Survival mode
              </UIButton>
            </div>
          </div>
        )}

        {place === "difficulties" && (
          <div className="dots-card mt-8 flex flex-col items-center gap-6 px-8 py-12 text-center">
            <h2 className="font-display text-2xl font-extrabold text-foreground">
              Choose a difficulty
            </h2>
            <div className="flex flex-col gap-3 w-full max-w-xs">
              {(["easy", "medium", "hard"] as Difficulty[]).map((d) => (
                <UIButton
                  key={d}
                  tone={d === "easy" ? "accent" : "neutral"}
                  fullWidth
                  onClick={() => startGame("normal", d)}
                >
                  {d.charAt(0).toUpperCase() + d.slice(1)}
                </UIButton>
              ))}
              <button
                onClick={() => setPlace("start")}
                className="text-sm font-bold text-(--muted) hover:text-(--accent) transition-colors mt-1"
              >
                ← Back
              </button>
            </div>
          </div>
        )}

        {place === "game" && (
          <div className="flex w-full flex-col items-center gap-4">
            {/* Falling field */}
            <div
              className="relative w-full overflow-hidden rounded-3xl border-2 border-(--border) bg-(--surface)"
              style={{ height: "22rem" }}
            >
              {/* ground */}
              <div
                className="absolute bottom-0 left-0 w-full"
                style={{
                  height: "12%",
                  background:
                    "repeating-linear-gradient(45deg, var(--surface-2), var(--surface-2) 10px, var(--background) 10px, var(--background) 20px)",
                  borderTop: "2px solid var(--border)",
                }}
              />
              {bombs.map((bomb, i) => {
                const topPct = (bomb.distance / FALL_DISTANCE) * 82; // leave room for ground
                const leftPct =
                  bombs.length > 1 ? 8 + (i * 84) / (bombs.length - 1) : 50;
                return (
                  <div
                    key={i}
                    className="absolute flex w-20 -translate-x-1/2 flex-col items-center"
                    style={{
                      left: `${leftPct}%`,
                      top: `${topPct}%`,
                      transition: "top 100ms linear",
                    }}
                  >
                    {bomb.state === "explode" ? (
                      <Image
                        src={ExplosionImg}
                        alt=""
                        width={56}
                        height={56}
                        className="object-contain"
                        style={{ animation: "dots-pop-in 0.3s ease-out" }}
                      />
                    ) : bomb.state === "correct" ? (
                      <Image
                        src={Checkmark}
                        alt=""
                        width={48}
                        height={48}
                        className="object-contain"
                        style={{ animation: "dots-pop-in 0.3s ease-out" }}
                      />
                    ) : bomb.state === "word" && bomb.src ? (
                      <>
                        <WordImg src={bomb.src} size="small" />
                        <span className="mt-1 rounded-full bg-(--accent)/10 px-2 py-0.5 text-[11px] font-extrabold text-(--accent)">
                          {bomb.title}
                        </span>
                      </>
                    ) : (
                      <Image
                        src={BombImg}
                        alt=""
                        width={40}
                        height={40}
                        className="object-contain opacity-40"
                      />
                    )}
                  </div>
                );
              })}
            </div>

            {/* Doty + input */}
            <div className="flex w-full items-end gap-3">
              <div className="shrink-0" style={{ animation: "dots-float 2.5s ease-in-out infinite" }}>
                <Doty pose={dotyPose} size="tiny" />
              </div>
              <input
                autoFocus
                value={search}
                onChange={(e) => handleType(e.target.value)}
                placeholder="Type the word…"
                className="flex-1 rounded-2xl border-2 border-(--border) bg-(--input-bg) px-4 py-3.5 text-base font-semibold text-foreground placeholder:text-(--muted) outline-none transition focus:border-(--accent) focus:ring-4 focus:ring-(--accent)/15"
              />
            </div>
          </div>
        )}

        {place === "endgame" && (
          <div className="dots-card mt-8 flex flex-col items-center gap-5 px-8 py-12 text-center">
            <Doty pose={dotyPose} size="medium" />
            <h2 className="font-display text-3xl font-extrabold text-foreground">
              {result}
            </h2>
            <div className="flex flex-col gap-1 text-sm font-bold text-(--muted)">
              <span>Score: {score}</span>
              <span className="capitalize">
                Mode: {mode}
                {mode === "normal" ? ` · ${difficulty}` : ""}
              </span>
            </div>
            <XpReward reward={reward} />
            <div className="flex flex-col gap-3 w-full max-w-xs">
              <UIButton tone="accent" fullWidth onClick={() => setPlace("start")}>
                Play again
              </UIButton>
              <UIButton
                tone="neutral"
                fullWidth
                onClick={() => window.location.assign("/levels")}
              >
                Back to levels
              </UIButton>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
