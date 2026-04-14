"use client";

import { useState, useRef, useCallback } from "react";
import Doty from "@/components/ui/doty/doty";
import WordImg from "@/components/ui/word-img/word-img";
import Sound from "@/components/ui/sound/sound";

// ── Types ────────────────────────────────────────────────────────────────────
type Option = {
  id: number;
  word: string;
  correct: boolean;
  img?: string;
  img_sound?: string;
  selected?: boolean;
  order?: number;
};

type Sentence = {
  id: number;
  text: string;
  mode: string;
  img?: string;
  img_sound?: string;
  sentence_extension?: string;
  options: Option[];
};

interface PracticeContainerProps {
  mode: string;
  dataSentence: Sentence;
  answered: string;
  click: (correct: boolean) => void;
  doty: string;
  streak: number;
}

/* ── Inject practice-container keyframes once ─────────────── */
if (typeof document !== "undefined") {
  const STYLE_ID = "__pc_kf__";
  if (!document.getElementById(STYLE_ID)) {
    const s = document.createElement("style");
    s.id = STYLE_ID;
    s.textContent = `
      @keyframes pc-pop {
        0%   { transform: scale(0.7); opacity: 0; }
        60%  { transform: scale(1.06); }
        100% { transform: scale(1);   opacity: 1; }
      }
      @keyframes pc-fade-in {
        0%   { opacity: 0; transform: translateY(8px); }
        100% { opacity: 1; transform: translateY(0); }
      }
      @keyframes pc-wiggle {
        0%,100% { transform: rotate(0deg); }
        25%     { transform: rotate(-4deg); }
        75%     { transform: rotate(4deg); }
      }
      @keyframes pc-float {
        0%,100% { transform: translateY(0); }
        50%     { transform: translateY(-8px); }
      }
      @keyframes pc-streak-glow {
        0%   { text-shadow: 0 0 8px rgba(251,191,36,0.6); }
        50%  { text-shadow: 0 0 20px rgba(251,191,36,0.9), 0 0 40px rgba(249,115,22,0.4); }
        100% { text-shadow: 0 0 8px rgba(251,191,36,0.6); }
      }
      @keyframes pc-option-in {
        0%   { transform: scale(0.85) translateY(6px); opacity: 0; }
        100% { transform: scale(1) translateY(0); opacity: 1; }
      }
      @keyframes pc-fly-to-tray {
        0%   { transform: scale(1) translateY(0); opacity: 1; }
        40%  { transform: scale(0.8) translateY(-10px); opacity: 0.6; }
        100% { transform: scale(0) translateY(-32px); opacity: 0; }
      }
      @keyframes pc-fly-from-pool {
        0%   { transform: scale(0.5) translateY(18px); opacity: 0; }
        60%  { transform: scale(1.1) translateY(-3px); opacity: 1; }
        100% { transform: scale(1) translateY(0); opacity: 1; }
      }
      @keyframes pc-fly-back-from-tray {
        0%   { transform: scale(1) translateY(0); opacity: 1; }
        40%  { transform: scale(0.8) translateY(10px); opacity: 0.6; }
        100% { transform: scale(0) translateY(28px); opacity: 0; }
      }
      @keyframes pc-correct-flash {
        0%   { box-shadow: 0 0 0 0px rgba(34,197,94,0.5); }
        50%  { box-shadow: 0 0 0 6px rgba(34,197,94,0); }
        100% { box-shadow: 0 0 0 0px rgba(34,197,94,0); }
      }
      @keyframes pc-wrong-shake {
        0%,100% { transform: translateX(0); }
        20%     { transform: translateX(-6px); }
        40%     { transform: translateX(6px); }
        60%     { transform: translateX(-4px); }
        80%     { transform: translateX(4px); }
      }
    `;
    document.head.appendChild(s);
  }
}

// ── Option visual state ───────────────────────────────────────────────────────
type OptionState = "idle" | "selected" | "correct" | "wrong" | "reveal-correct" | "reveal-wrong";

function getOptionState(selected: boolean, answered: string, correct: boolean): OptionState {
  if (answered === "") return selected ? "selected" : "idle";
  if (selected && answered === "correct") return "correct";
  if (selected && answered === "wrong") return "wrong";
  if (!selected && correct) return "reveal-correct";
  return "reveal-wrong";
}

/* Style map: { background, border, color, shadow, animation } */
const optionStyles: Record<OptionState, React.CSSProperties> = {
  idle: {
    background: "var(--surface)",
    border: "2px solid var(--border)",
    color: "var(--foreground)",
  },
  selected: {
    background: "var(--surface)",
    border: "2px solid var(--accent)",
    color: "var(--accent)",
    boxShadow: "0 0 0 3px rgba(212,0,126,0.15)",
  },
  correct: {
    background: "linear-gradient(135deg, #22c55e, #10b981)",
    border: "2px solid #22c55e",
    color: "#fff",
    animation: "pc-correct-flash 0.6s ease-out",
  },
  wrong: {
    background: "linear-gradient(135deg, #f43f5e, #ef4444)",
    border: "2px solid #f43f5e",
    color: "#fff",
    animation: "pc-wrong-shake 0.4s ease-out",
  },
  "reveal-correct": {
    background: "rgba(34,197,94,0.12)",
    border: "2px solid rgba(34,197,94,0.5)",
    color: "#059669",
  },
  "reveal-wrong": {
    background: "var(--surface)",
    border: "2px solid var(--border)",
    color: "var(--muted)",
    opacity: 0.4,
  },
};

const baseOptionCls =
  "flex items-center justify-center text-center rounded-2xl px-4 py-3 text-sm font-bold transition-all duration-200 cursor-pointer select-none active:scale-[.96]";

// ── Panel wrapper ────────────────────────────────────────────────────────────
function PanelWrapper({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={[
        "relative w-full flex flex-col items-center gap-6 rounded-3xl p-6 overflow-hidden",
        className,
      ].join(" ")}
      style={{
        minHeight: "22rem",
        background: "var(--surface)",
        border: "2px solid var(--border)",
        boxShadow: "0 4px 24px rgba(0,0,0,0.06)",
        animation: "pc-pop 0.4s ease-out both",
      }}
    >
      {/* Decorative corner circles */}
      <div
        className="absolute -top-6 -right-6 w-20 h-20 rounded-full"
        style={{ background: "var(--accent)", opacity: 0.06 }}
      />
      <div
        className="absolute -bottom-4 -left-4 w-14 h-14 rounded-full"
        style={{ background: "var(--accent)", opacity: 0.04 }}
      />
      {children}
    </div>
  );
}

// ── Section label (e.g. "What do you hear?") ─────────────────────────────────
function SectionLabel({ children, emoji }: { children: React.ReactNode; emoji?: string }) {
  return (
    <div className="flex items-center gap-2.5 self-start">
      {emoji && (
        <span
          className="text-xl leading-none"
          style={{ animation: "pc-wiggle 2s ease-in-out infinite" }}
        >
          {emoji}
        </span>
      )}
      <span
        className="inline-block w-1.5 h-5 rounded-full"
        style={{ background: "var(--accent)" }}
      />
      <span
        className="text-sm font-extrabold uppercase tracking-widest"
        style={{ color: "var(--muted)" }}
      >
        {children}
      </span>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function PracticeContainer({
  mode,
  dataSentence,
  answered,
  click,
  doty,
  streak,
}: PracticeContainerProps) {
  // Merge options + buildUp + tracked sentence id into one state object
  // so we only call setState once when the sentence changes.
  const [practiceState, setPracticeState] = useState<{
    sentenceId: number | null;
    options: Option[];
    buildUpSentence: Option[];
  }>({ sentenceId: null, options: [], buildUpSentence: [] });

  // Track which option id is currently animating and in which direction
  const [flyingId, setFlyingId] = useState<number | null>(null);
  const [flyDir, setFlyDir] = useState<"to-tray" | "from-tray">("to-tray");
  const flyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Derive from state for convenience
  const { options, buildUpSentence } = practiceState;

  // Re-initialise when sentence changes (single setState call avoids cascading render lint)
  if (
    mode !== "finished" && mode !== "perfect" &&
    practiceState.sentenceId !== dataSentence.id
  ) {
    const fresh = dataSentence.options.map((item, i) => ({
      ...item, selected: false, order: 0, id: i,
    }));
    // Calling setState during render is allowed when it's conditional on a prop change
    // (React "derived state from props" pattern)
    setPracticeState({ sentenceId: dataSentence.id, options: fresh, buildUpSentence: [] });
  }

  const selectHandler = useCallback((index: number, item: Option) => {
    if (answered !== "") return;
    const newOptions = [...options];

    if (mode === "buildUp") {
      const arrayBuild = [...buildUpSentence];
      const optIdx = newOptions.findIndex((o) => o.id === item.id);
      const isAdding = !newOptions[optIdx].selected;

      // Trigger fly animation for this item
      setFlyingId(item.id);
      setFlyDir(isAdding ? "to-tray" : "from-tray");

      // Clear any existing timer
      if (flyTimer.current) clearTimeout(flyTimer.current);

      // After animation completes, commit the state change
      flyTimer.current = setTimeout(() => {
        const opts = [...options];
        opts[optIdx] = { ...opts[optIdx], selected: isAdding };
        const updatedBuild = isAdding
          ? [...arrayBuild, item]
          : arrayBuild.filter((itm) => itm.id !== item.id);
        const text = updatedBuild.map((o) => o.word).join(" ");
        setPracticeState((s) => ({ ...s, options: opts, buildUpSentence: updatedBuild }));
        click(text.toUpperCase() === dataSentence.text.toUpperCase());
        setFlyingId(null);
      }, 260);
    } else {
      const realIdx = newOptions.findIndex((o) => o.id === item.id);
      newOptions.forEach((_, i) => { newOptions[i].selected = false; });
      if (realIdx !== -1) newOptions[realIdx].selected = true;
      setPracticeState((s) => ({ ...s, options: newOptions }));
      click(item.correct);
    }
  }, [answered, mode, options, buildUpSentence, dataSentence.text, click]);

  let sentenceText = dataSentence.text;
  if (answered === "correct") {
    const chosen = options.find((o) => o.selected)?.word ?? "";
    sentenceText = dataSentence.text.replace("__", chosen);
  }
  const correctWord = options.find((o) => o.correct)?.word ?? "";
  const audioSrc = `sentences/${dataSentence.id}.${dataSentence.sentence_extension}`;

  // ── Streak ────────────────────────────────────────────────────────────────
  if (mode === "streak") {
    return (
      <PanelWrapper>
        <SectionLabel emoji="🔥">Streak</SectionLabel>
        <div style={{ animation: "pc-float 2s ease-in-out infinite" }}>
          <Doty pose="02" size="small" />
        </div>
        <p
          className="text-5xl font-black"
          style={{
            background: "linear-gradient(135deg, var(--accent), #fbbf24, #f97316)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            animation: "pc-streak-glow 2s ease-in-out infinite",
          }}
        >
          {streak} in a row!
        </p>
        <span className="text-3xl" style={{ animation: "pc-wiggle 1s ease-in-out infinite" }}>🎯</span>
      </PanelWrapper>
    );
  }

  // ── End states ────────────────────────────────────────────────────────────
  if (mode === "perfect" || mode === "finished" || mode === "gameover") {
    const isGameover = mode === "gameover";
    const emoji   = mode === "perfect" ? "🌟" : isGameover ? "💔" : "🎉";
    const title   = mode === "perfect" ? "Perfect!" : isGameover ? "Oh no!" : "Success!";
    const subtext = mode === "perfect" ? "No mistakes!" : isGameover ? "You ran out of hearts!" : "You completed the level!";
    const gradient = isGameover
      ? "linear-gradient(135deg, #f43f5e, #ef4444)"
      : "linear-gradient(135deg, var(--accent), #fbbf24)";
    return (
      <PanelWrapper>
        <SectionLabel emoji={emoji}>{title}</SectionLabel>
        <div style={{ animation: isGameover ? "pc-wiggle 0.6s ease-in-out" : "pc-float 2.5s ease-in-out infinite" }}>
          <Doty pose={isGameover ? "05" : "02"} size="small" />
        </div>
        <span
          className="text-5xl"
          style={{ animation: "pc-pop 0.5s ease-out both 0.2s" }}
        >
          {emoji}
        </span>
        <p
          className="text-lg font-extrabold"
          style={{
            background: gradient,
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
          }}
        >
          {subtext}
        </p>
      </PanelWrapper>
    );
  }

  // ── BuildUp ───────────────────────────────────────────────────────────────
  if (mode === "buildUp") {
    return (
      <PanelWrapper>
        <SectionLabel emoji="🧩">Build up the sentence!</SectionLabel>
        <div className="flex items-end gap-4">
          <div style={{ animation: "pc-wiggle 3s ease-in-out infinite" }}>
            <Doty pose={doty} size="small" />
          </div>
          <Sound autoplay src={audioSrc} icon className="flex flex-col items-center gap-2">
            <WordImg src={dataSentence.img ?? ""} size="medium" />
          </Sound>
        </div>

        {answered === "wrong" && (
          <p
            className="text-sm font-bold px-3 py-1.5 rounded-xl"
            style={{
              background: "rgba(34,197,94,0.12)",
              border: "1.5px solid rgba(34,197,94,0.3)",
              color: "#059669",
              animation: "pc-fade-in 0.3s ease-out both",
            }}
          >
            ✅ Correct: {dataSentence.text}
          </p>
        )}

        {/* Selected words tray */}
        <div
          className="flex flex-wrap gap-2 w-full min-h-14 rounded-2xl p-3"
          style={{
            background: "var(--background)",
            border: "2px dashed var(--border)",
          }}
        >
          {buildUpSentence.length === 0 && (
            <span className="text-xs self-center" style={{ color: "var(--muted)" }}>
              Tap words below to build the sentence…
            </span>
          )}
          {buildUpSentence.map((word, i) => (
            <button
              key={`tray-${word.id}-${i}`}
              onClick={() => selectHandler(i, word)}
              className={`${baseOptionCls} px-3 py-1.5 text-sm`}
              style={{
                background: "rgba(212,0,126,0.1)",
                border: "2px solid rgba(212,0,126,0.3)",
                color: "var(--accent)",
                animation: flyingId === word.id && flyDir === "to-tray"
                  ? "pc-fly-from-pool 0.28s cubic-bezier(.34,1.5,.64,1) both"
                  : flyingId === word.id && flyDir === "from-tray"
                    ? "pc-fly-back-from-tray 0.24s ease-in both"
                    : `pc-fly-from-pool 0.28s cubic-bezier(.34,1.5,.64,1) both ${i * 0.04}s`,
              }}
            >
              {word.word}
            </button>
          ))}
        </div>

        <div className="w-full h-px" style={{ background: "var(--border)" }} />

        {/* Word pool */}
        <div className="flex flex-wrap justify-center gap-2 w-full">
          {options.map((item, index) => {
            if (item.selected) return null;
            const isFlyingOut = flyingId === item.id && flyDir === "to-tray";
            const state = getOptionState(false, answered, item.correct);
            return (
              <button
                key={item.id}
                onClick={() => selectHandler(index, item)}
                disabled={flyingId === item.id}
                className={`${baseOptionCls} px-3 py-1.5 text-sm`}
                style={{
                  ...optionStyles[state],
                  animation: isFlyingOut
                    ? "pc-fly-to-tray 0.26s ease-in both"
                    : `pc-option-in 0.25s ease-out both ${index * 0.04}s`,
                  pointerEvents: flyingId !== null ? "none" : undefined,
                }}
              >
                {item.word}
              </button>
            );
          })}
        </div>
      </PanelWrapper>
    );
  }

  // ── Standard modes ────────────────────────────────────────────────────────
  let titleText = "Complete the sentence!";
  let titleEmoji = "✏️";
  let soundContent: React.ReactNode;

  if (mode === "whatDoYouHear" || mode === "whatDoYouHearSentence" || mode === "guessImg") {
    titleText = mode === "guessImg" ? "What is this?" : "What do you hear?";
    titleEmoji = mode === "guessImg" ? "🖼️" : "👂";
    const src = mode === "whatDoYouHearSentence" ? audioSrc : (dataSentence.img_sound ?? audioSrc);
    soundContent = mode !== "guessImg"
      ? <Sound autoplay icon src={src} className="flex flex-col items-center gap-2"><WordImg src={dataSentence.img ?? ""} size="medium" /></Sound>
      : <WordImg src={dataSentence.img ?? ""} size="medium" />;
  } else {
    soundContent = (
      <Sound autoplay icon src={audioSrc} className="flex flex-col items-center gap-2">
        <p
          className="text-xl font-bold text-center max-w-xs"
          style={{ color: "var(--foreground)" }}
        >
          {sentenceText}
        </p>
      </Sound>
    );
  }

  if (mode === "witchIs") { titleText = `Which is: ${correctWord}?`; titleEmoji = "🔍"; }

  // For whatDoYouHearSentence: keep only the correct option + one wrong option
  const filteredOptions = mode === "whatDoYouHearSentence"
    ? (() => {
        let skippedWrong = false;
        return options.filter((o) => {
          if (!o.correct && !skippedWrong) { skippedWrong = true; return false; }
          return true;
        });
      })()
    : options;

  const optionList = filteredOptions.map((item, index) => {
    const state = getOptionState(item.selected ?? false, answered, item.correct);
    const stateStyle = optionStyles[state];
    const label = mode === "whatDoYouHearSentence"
      ? dataSentence.text.replace("__", item.word)
      : item.word;

    const entryAnim = `pc-option-in 0.3s ease-out both ${index * 0.06}s`;

    if (mode === "guessImg") {
      return (
        <Sound key={index} src={item.img_sound ?? ""} icon className="w-[45%] flex flex-col items-center gap-2" onClick={() => selectHandler(index, item)}>
          <div
            className={`${baseOptionCls} w-full`}
            style={{ ...stateStyle, animation: entryAnim }}
          >
            {label}
          </div>
        </Sound>
      );
    }
    if (mode === "witchIs") {
      return (
        <Sound key={index} src={item.img_sound ?? ""} icon className="w-[45%] flex flex-col items-center gap-2" onClick={() => selectHandler(index, item)}>
          <div
            className={`${baseOptionCls} w-full flex-col gap-1`}
            style={{ ...stateStyle, animation: entryAnim }}
          >
            <WordImg src={item.img ?? ""} size="small" />
          </div>
        </Sound>
      );
    }
    return (
      <button
        key={index}
        onClick={() => selectHandler(index, item)}
        className={`${baseOptionCls} ${mode === "whatDoYouHearSentence" ? "w-full" : "w-[45%]"}`}
        style={{ ...stateStyle, animation: entryAnim }}
      >
        {label}
      </button>
    );
  });

  return (
    <PanelWrapper>
      <SectionLabel emoji={titleEmoji}>{titleText}</SectionLabel>

      {mode !== "witchIs" && (
        <div
          className="flex items-end gap-4"
          style={{ animation: "pc-fade-in 0.4s ease-out both" }}
        >
          <div style={{ animation: "pc-wiggle 3s ease-in-out infinite" }}>
            <Doty pose={doty} size="small" />
          </div>
          {soundContent}
        </div>
      )}

      <div className="flex flex-wrap justify-center gap-3 w-full">
        {optionList}
      </div>
    </PanelWrapper>
  );
}
