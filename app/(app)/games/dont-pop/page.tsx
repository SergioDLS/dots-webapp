"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import Doty from "@/components/ui/doty/doty";
import WordImg from "@/components/ui/word-img/word-img";
import UIButton from "@/components/ui/button/button";
import Spinner from "@/components/ui/Spinner/Spinner";
import { getDontPopService, type GameWord } from "@/services/games.service";

const Balloon = "/images/PopIt/balloon.png";
const Explosion = "/images/PopIt/explotion.gif";
const WinGif = "/images/PopIt/win.gif";

const MAX_SIZE = 15; // balloon pops at this size
const TICK_MS = 100;
const INFLATE_PER_TICK = 0.1;
const CORRECT_DEFLATE = 4;
const WRONG_INFLATE = 6;

type Place = "start" | "game" | "endgame";
type Option = { text: string; id: number };

export default function DontPopPage() {
  const [place, setPlace] = useState<Place>("start");
  const [pose, setPose] = useState("12");
  const [size, setSize] = useState(1);
  const [text, setText] = useState("Pick the right word before the balloon pops!");
  const [index, setIndex] = useState(-1);
  const [options, setOptions] = useState<Option[]>([]);
  const [data, setData] = useState<GameWord[]>([]);
  const [loading, setLoading] = useState(true);
  const [won, setWon] = useState(false);

  // size is read inside the interval; keep a ref so the effect stays stable
  const sizeRef = useRef(size);
  useEffect(() => {
    sizeRef.current = size;
  }, [size]);

  useEffect(() => {
    let active = true;
    getDontPopService()
      .then((words) => {
        if (active) setData(words.map((w) => ({ ...w, answered: false })));
      })
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, []);

  const answeredCount = data.filter((d) => d.answered).length;

  const endgame = useCallback((didWin: boolean) => {
    setWon(didWin);
    setText(didWin ? "You did it! 🎈" : "Pop! Better luck next time.");
    setPose(didWin ? "02" : "05");
    setPlace("endgame");
    setData((prev) => prev.map((d) => ({ ...d, answered: false })));
  }, []);

  // Build the next round: find an unanswered word, pair it with a distractor.
  const nextRound = useCallback(() => {
    setData((current) => {
      const firstUnanswered = current.findIndex((d) => !d.answered);
      if (firstUnanswered === -1) {
        endgame(true);
        return current;
      }

      setIndex((prevIndex) => {
        let newIndex = prevIndex + 1;
        if (newIndex >= current.length) newIndex = 0;
        // skip already-answered words
        let guard = 0;
        while (current[newIndex]?.answered && guard < current.length) {
          newIndex = (newIndex + 1) % current.length;
          guard++;
        }

        // pick a distractor different from the answer
        let distractor = Math.floor(Math.random() * current.length);
        if (distractor === newIndex) {
          distractor = (distractor + 1) % current.length;
        }

        const correctOpt = {
          text: current[newIndex].title,
          id: current[newIndex].id,
        };
        const wrongOpt = {
          text: current[distractor].title,
          id: current[distractor].id,
        };
        setOptions(
          Math.random() < 0.5
            ? [correctOpt, wrongOpt]
            : [wrongOpt, correctOpt],
        );
        return newIndex;
      });

      return current;
    });
  }, [endgame]);

  // Inflation loop
  useEffect(() => {
    if (place !== "game") return;
    const interval = setInterval(() => {
      if (sizeRef.current >= MAX_SIZE) {
        endgame(false);
      } else {
        setSize((s) => Math.min(MAX_SIZE, s + INFLATE_PER_TICK));
      }
    }, TICK_MS);
    return () => clearInterval(interval);
  }, [place, endgame]);

  const start = () => {
    setSize(1);
    setIndex(-1);
    setPose("14");
    setData((prev) => prev.map((d) => ({ ...d, answered: false })));
    setPlace("game");
    // kick off the first round after state resets
    setTimeout(() => nextRound(), 0);
  };

  const answer = (optId: number) => {
    if (place !== "game" || index < 0) return;
    const current = data[index];
    if (!current) return;

    if (optId === current.id) {
      setPose("02");
      setData((prev) => {
        const copy = [...prev];
        copy[index] = { ...copy[index], answered: true };
        return copy;
      });
      setSize((s) => Math.max(0, s - CORRECT_DEFLATE));
    } else {
      setPose("05");
      setSize((s) => s + WRONG_INFLATE);
    }

    if (sizeRef.current >= MAX_SIZE) {
      endgame(false);
    } else {
      nextRound();
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner title="Loading game..." />
      </div>
    );
  }

  // balloon scale: 1..MAX_SIZE → 0.5..2.4 visual scale, redder as it grows
  const danger = Math.min(1, size / MAX_SIZE);
  const balloonScale = 0.5 + danger * 1.9;

  return (
    <div className="relative flex min-h-screen w-full flex-col items-center overflow-hidden px-4 py-6">
      {/* ambient blobs */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-32 -left-24 h-80 w-80 rounded-full opacity-25 blur-3xl"
        style={{ background: "var(--accent)" }}
      />

      {/* Top bar */}
      <div className="dots-card z-10 flex w-full max-w-xl items-center justify-between gap-3 px-4 py-3">
        <button
          onClick={() => window.location.assign("/levels")}
          className="text-sm font-bold text-(--muted) hover:text-(--accent) transition-colors"
        >
          ← Exit
        </button>
        <span className="font-display text-lg font-extrabold text-(--accent)">
          Don&apos;t Pop!
        </span>
        <span className="text-sm font-bold text-(--muted) tabular-nums">
          {answeredCount}/{data.length}
        </span>
      </div>

      {/* Play area */}
      <div className="relative z-10 mt-4 flex w-full max-w-xl flex-1 flex-col items-center">
        {place === "start" && (
          <div className="dots-card flex flex-col items-center gap-6 px-8 py-12 text-center mt-8">
            <div style={{ animation: "dots-float 3s ease-in-out infinite" }}>
              <Doty pose="17" size="small" />
            </div>
            <h2 className="font-display text-2xl font-extrabold text-foreground">
              {text}
            </h2>
            <p className="max-w-sm text-sm font-semibold text-(--muted)">
              Each correct word lets the air out. Wrong answers — and dawdling —
              puff it up. Clear all {data.length} words before it bursts!
            </p>
            <UIButton tone="accent" onClick={start}>
              Start playing
            </UIButton>
          </div>
        )}

        {place === "game" && index >= 0 && data[index] && (
          <>
            {/* Balloon + image */}
            <div className="relative flex h-72 w-full items-end justify-center">
              <Image
                src={Balloon}
                alt="balloon"
                width={120}
                height={150}
                className="absolute bottom-0 transition-transform duration-200 ease-out"
                style={{
                  transform: `scale(${balloonScale})`,
                  transformOrigin: "bottom center",
                  filter:
                    danger > 0.7
                      ? `hue-rotate(-50deg) saturate(${1 + danger})`
                      : "none",
                }}
              />
              <div
                className="dots-card absolute top-2 left-1/2 flex -translate-x-1/2 flex-col items-center gap-2 px-5 py-4"
                style={{ animation: "dots-pop-in 0.3s ease-out both" }}
              >
                <span className="text-xs font-bold uppercase tracking-widest text-(--muted)">
                  What is this?
                </span>
                {data[index].src && (
                  <WordImg key={data[index].src} src={data[index].src} size="medium" />
                )}
              </div>
            </div>

            {/* Doty reacting */}
            <div className="my-2" style={{ animation: "dots-float 2.5s ease-in-out infinite" }}>
              <Doty pose={pose} size="tiny" />
            </div>

            {/* Options */}
            <div className="grid w-full grid-cols-2 gap-4">
              {options.map((opt, i) => (
                <button
                  key={`${opt.id}-${i}`}
                  onClick={() => answer(opt.id)}
                  className="dots-pressable rounded-2xl bg-(--surface) border-2 border-(--border) px-4 py-6 text-lg font-extrabold text-foreground [--press-color:var(--border)] hover:border-(--accent) hover:text-(--accent)"
                >
                  {opt.text}
                </button>
              ))}
            </div>
          </>
        )}

        {place === "endgame" && (
          <div className="dots-card flex flex-col items-center gap-5 px-8 py-12 text-center mt-8">
            <Image
              src={won ? WinGif : Explosion}
              alt=""
              width={160}
              height={160}
              unoptimized
            />
            <h2 className="font-display text-3xl font-extrabold text-foreground">
              {text}
            </h2>
            <Doty pose={pose} size="small" />
            <div className="flex flex-col gap-3 w-full max-w-xs">
              <UIButton tone="accent" onClick={start} fullWidth>
                Play again
              </UIButton>
              <UIButton
                tone="neutral"
                onClick={() => window.location.assign("/levels")}
                fullWidth
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
