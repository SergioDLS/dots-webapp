"use client";

import { useState, useEffect } from "react";
import Doty from "@/components/ui/doty/doty";
import WordImg from "@/components/ui/word-img/word-img";
import { BASE_URL_IMAGES } from "@/constants";

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

// ── SoundButton ───────────────────────────────────────────────────────────────
// Plays a URL on mount (autoplay) and/or on click. Wraps children above the speaker icon.
function SoundButton({
  src,
  autoplay = false,
  children,
  extraClass = "",
  onClick,
}: {
  src: string;
  autoplay?: boolean;
  children?: React.ReactNode;
  extraClass?: string;
  onClick?: () => void;
}) {
  const fullSrc = src.startsWith("http") ? src : `${BASE_URL_IMAGES}/${src}`;

  useEffect(() => {
    if (autoplay && src) {
      const a = new Audio(fullSrc);
      a.play().catch(() => {});
      return () => { a.pause(); };
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src]);

  const playSound = () => {
    if (src) new Audio(fullSrc).play().catch(() => {});
    onClick?.();
  };

  return (
    <div className={`flex flex-col items-center gap-2 ${extraClass}`}>
      {children}
      <button
        type="button"
        onClick={playSound}
        aria-label="Play sound"
        className="flex items-center justify-center w-10 h-10 rounded-full transition-all duration-200 hover:scale-110 active:scale-95"
        style={{
          background: "linear-gradient(135deg, rgba(255,255,255,0.15) 0%, rgba(255,255,255,0.25) 100%)",
          backdropFilter: "blur(8px)",
          WebkitBackdropFilter: "blur(8px)",
          border: "1.5px solid rgba(255,255,255,0.30)",
          boxShadow: "0 4px 12px rgba(0,0,0,0.12), inset 0 1px 0 rgba(255,255,255,0.35)",
        }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-foreground">
          <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
          <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
          <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
        </svg>
      </button>
    </div>
  );
}

// ── Option visual state ───────────────────────────────────────────────────────
function optionStyle(selected: boolean, answered: string, correct: boolean): React.CSSProperties {
  if (selected && answered === "correct")
    return { background: "rgba(34,197,94,0.25)", border: "1.5px solid rgba(34,197,94,0.55)", cursor: "default" };
  if (selected && answered === "wrong")
    return { background: "rgba(239,68,68,0.22)", border: "1.5px solid rgba(239,68,68,0.50)", cursor: "default" };
  if (!selected && (answered === "correct" || answered === "wrong") && correct)
    return { background: "rgba(34,197,94,0.18)", border: "1.5px solid rgba(34,197,94,0.45)", cursor: "default" };
  if (!selected && (answered === "correct" || answered === "wrong"))
    return { background: "rgba(255,255,255,0.04)", border: "1.5px solid rgba(255,255,255,0.10)", cursor: "default", opacity: 0.5 };
  if (selected)
    return { background: "rgba(99,102,241,0.25)", border: "1.5px solid rgba(99,102,241,0.55)" };
  return { background: "rgba(255,255,255,0.09)", border: "1.5px solid rgba(255,255,255,0.18)" };
}

const baseOptionCls =
  "flex items-center justify-center text-center rounded-xl px-4 py-3 text-sm font-semibold text-foreground transition-all duration-200 hover:scale-[1.02] active:scale-[.98] cursor-pointer select-none";

// ── Shared glass panel wrapper ────────────────────────────────────────────────
function PanelWrapper({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="relative w-full flex flex-col items-center justify-between gap-5 rounded-2xl p-6 overflow-hidden"
      style={{
        background: "linear-gradient(155deg, rgba(255,255,255,0.07) 0%, rgba(255,255,255,0.12) 100%)",
        backdropFilter: "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
        border: "1.5px solid rgba(255,255,255,0.20)",
        boxShadow: "0 8px 32px rgba(0,0,0,0.10), inset 0 1px 0 rgba(255,255,255,0.28)",
        minHeight: "22rem",
      }}
    >
      {/* Top sheen */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-1/3 rounded-t-2xl"
        style={{ background: "linear-gradient(to bottom, rgba(255,255,255,0.18) 0%, transparent 100%)" }}
      />
      {children}
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

  const selectHandler = (index: number, item: Option) => {
    if (answered !== "") return;
    const newOptions = [...options];

    if (mode === "buildUp") {
      const arrayBuild = [...buildUpSentence];
      const optIdx = newOptions.findIndex((o) => o.id === item.id);
      newOptions[optIdx].selected = !newOptions[optIdx].selected;
      const updatedBuild = newOptions[optIdx].selected
        ? [...arrayBuild, item]
        : arrayBuild.filter((itm) => itm.id !== item.id);
      const text = updatedBuild.map((o) => o.word).join(" ");
      setPracticeState((s) => ({ ...s, options: newOptions, buildUpSentence: updatedBuild }));
      click(text.toUpperCase() === dataSentence.text.toUpperCase());
    } else {
      newOptions.forEach((_, i) => { newOptions[i].selected = false; });
      newOptions[index].selected = true;
      setPracticeState((s) => ({ ...s, options: newOptions }));
      click(item.correct);
    }
  };

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
        <h3 className="text-2xl font-extrabold text-foreground">Yay! 🔥</h3>
        <Doty pose="02" size="small" />
        <p className="text-3xl font-bold bg-clip-text text-transparent bg-linear-to-r from-(--primary-accent) to-(--accent)">
          {streak} in a row!
        </p>
      </PanelWrapper>
    );
  }

  // ── End states ────────────────────────────────────────────────────────────
  if (mode === "perfect" || mode === "finished" || mode === "gameover") {
    const isGameover = mode === "gameover";
    const title   = mode === "perfect" ? "Perfect! 🌟" : isGameover ? "Oh no! 💔" : "Success! 🎉";
    const subtext = mode === "perfect" ? "No mistakes!" : isGameover ? "You ran out of hearts!" : "You completed the level!";
    return (
      <PanelWrapper>
        <h3 className="text-2xl font-extrabold text-foreground">{title}</h3>
        <Doty pose={isGameover ? "05" : "02"} size="small" />
        <p className="text-base text-(--muted)">{subtext}</p>
      </PanelWrapper>
    );
  }

  // ── BuildUp ───────────────────────────────────────────────────────────────
  if (mode === "buildUp") {
    return (
      <PanelWrapper>
        <h3 className="text-lg font-extrabold text-foreground">Build up the sentence!</h3>
        <div className="flex items-end gap-4">
          <Doty pose={doty} size="small" />
          <SoundButton autoplay src={audioSrc}>
            <WordImg src={dataSentence.img ?? ""} size="medium" />
          </SoundButton>
        </div>

        {answered === "wrong" && (
          <p className="text-sm font-semibold text-emerald-400">Correct: {dataSentence.text}</p>
        )}

        {/* Selected words tray */}
        <div
          className="flex flex-wrap gap-2 w-full min-h-12 rounded-xl p-3"
          style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.14)" }}
        >
          {buildUpSentence.length === 0 && (
            <span className="text-xs text-(--muted) self-center">Tap words below to build the sentence…</span>
          )}
          {buildUpSentence.map((word, i) => (
            <button
              key={i}
              onClick={() => selectHandler(i, word)}
              className={`${baseOptionCls} px-3 py-1.5 text-sm`}
              style={{ background: "rgba(99,102,241,0.22)", border: "1.5px solid rgba(99,102,241,0.45)" }}
            >
              {word.word}
            </button>
          ))}
        </div>

        <div className="w-full h-px" style={{ background: "rgba(255,255,255,0.12)" }} />

        {/* Word pool */}
        <div className="flex flex-wrap justify-center gap-2 w-full">
          {options.map((item, index) =>
            !item.selected ? (
              <button
                key={item.id}
                onClick={() => selectHandler(index, item)}
                className={`${baseOptionCls} px-3 py-1.5 text-sm`}
                style={optionStyle(false, answered, item.correct)}
              >
                {item.word}
              </button>
            ) : null
          )}
        </div>
      </PanelWrapper>
    );
  }

  // ── Standard modes ────────────────────────────────────────────────────────
  let titleText = "Complete the sentence!";
  let soundContent: React.ReactNode;

  if (mode === "whatDoYouHear" || mode === "whatDoYouHearSentence" || mode === "guessImg") {
    titleText = mode === "guessImg" ? "What is this?" : "What do you hear?";
    const src = mode === "whatDoYouHearSentence" ? audioSrc : (dataSentence.img_sound ?? audioSrc);
    soundContent = mode !== "guessImg"
      ? <SoundButton autoplay src={src}><WordImg src={dataSentence.img ?? ""} size="medium" /></SoundButton>
      : <WordImg src={dataSentence.img ?? ""} size="medium" />;
  } else {
    soundContent = (
      <SoundButton autoplay src={audioSrc}>
        <p className="text-xl font-semibold text-foreground text-center max-w-xs">{sentenceText}</p>
      </SoundButton>
    );
  }

  if (mode === "witchIs") titleText = `Which is: ${correctWord}?`;

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
    const style = optionStyle(item.selected ?? false, answered, item.correct);
    const label = mode === "whatDoYouHearSentence"
      ? dataSentence.text.replace("__", item.word)
      : item.word;

    if (mode === "guessImg") {
      return (
        <SoundButton key={index} src={item.img_sound ?? ""} extraClass="w-[45%]" onClick={() => selectHandler(index, item)}>
          <div className={`${baseOptionCls} w-full`} style={style} onClick={() => selectHandler(index, item)}>
            {label}
          </div>
        </SoundButton>
      );
    }
    if (mode === "witchIs") {
      return (
        <SoundButton key={index} src={item.img_sound ?? ""} extraClass="w-[45%]" onClick={() => selectHandler(index, item)}>
          <div className={`${baseOptionCls} w-full flex-col gap-1`} style={style} onClick={() => selectHandler(index, item)}>
            <WordImg src={item.img ?? ""} size="small" />
          </div>
        </SoundButton>
      );
    }
    return (
      <button
        key={index}
        onClick={() => selectHandler(index, item)}
        className={`${baseOptionCls} ${mode === "whatDoYouHearSentence" ? "w-full" : "w-[45%]"}`}
        style={style}
      >
        {label}
      </button>
    );
  });

  return (
    <PanelWrapper>
      <h3 className="text-lg font-extrabold text-foreground">{titleText}</h3>

      {mode !== "witchIs" && (
        <div className="flex items-end gap-4">
          <Doty pose={doty} size="small" />
          {soundContent}
        </div>
      )}

      <div className="flex flex-wrap justify-center gap-3 w-full">
        {optionList}
      </div>
    </PanelWrapper>
  );
}
