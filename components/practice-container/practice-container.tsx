"use client";

import { useState } from "react";
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

// ── Option visual state ───────────────────────────────────────────────────────
type OptionState = "idle" | "selected" | "correct" | "wrong" | "reveal-correct" | "reveal-wrong";

function getOptionState(selected: boolean, answered: string, correct: boolean): OptionState {
  if (answered === "") return selected ? "selected" : "idle";
  if (selected && answered === "correct") return "correct";
  if (selected && answered === "wrong") return "wrong";
  if (!selected && correct) return "reveal-correct";
  return "reveal-wrong";
}

const optionStateClasses: Record<OptionState, string> = {
  idle:           "bg-surface border-2 border-(--border) text-foreground hover:border-(--accent) hover:bg-(--accent)/5 active:scale-[.97]",
  selected:       "bg-(--accent)/15 border-2 border-(--accent) text-(--accent)",
  correct:        "bg-emerald-500 border-2 border-emerald-500 text-white",
  wrong:          "bg-rose-500 border-2 border-rose-500 text-white",
  "reveal-correct": "bg-emerald-500/20 border-2 border-emerald-500 text-emerald-600 dark:text-emerald-400",
  "reveal-wrong": "border-2 border-(--border) text-(--muted) opacity-50",
};

const baseOptionCls =
  "flex items-center justify-center text-center rounded-2xl px-4 py-3 text-sm font-bold transition-all duration-200 cursor-pointer select-none";

// ── Panel wrapper ────────────────────────────────────────────────────────────
function PanelWrapper({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={[
        "relative w-full flex flex-col items-center gap-6 rounded-3xl p-6 overflow-hidden",
        "bg-surface border border-(--border)",
        "shadow-sm",
        className,
      ].join(" ")}
      style={{ minHeight: "22rem" }}
    >
      {children}
    </div>
  );
}

// ── Section label (e.g. "What do you hear?") ─────────────────────────────────
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 self-start">
      <span className="inline-block w-1 h-5 rounded-full bg-(--accent)" />
      <span className="text-sm font-bold uppercase tracking-widest text-(--muted)">{children}</span>
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
        <SectionLabel>Streak 🔥</SectionLabel>
        <Doty pose="02" size="small" />
        <p className="text-4xl font-extrabold bg-clip-text text-transparent bg-linear-to-r from-(--primary-accent) to-(--accent)">
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
        <SectionLabel>{title}</SectionLabel>
        <Doty pose={isGameover ? "05" : "02"} size="small" />
        <p className="text-base text-(--muted)">{subtext}</p>
      </PanelWrapper>
    );
  }

  // ── BuildUp ───────────────────────────────────────────────────────────────
  if (mode === "buildUp") {
    return (
      <PanelWrapper>
        <SectionLabel>Build up the sentence!</SectionLabel>
        <div className="flex items-end gap-4">
          <Doty pose={doty} size="small" />
          <Sound autoplay src={audioSrc} icon className="flex flex-col items-center gap-2">
            <WordImg src={dataSentence.img ?? ""} size="medium" />
          </Sound>
        </div>

        {answered === "wrong" && (
          <p className="text-sm font-semibold text-emerald-400">Correct: {dataSentence.text}</p>
        )}

        {/* Selected words tray */}
        <div
          className="flex flex-wrap gap-2 w-full min-h-12 rounded-xl p-3"
          style={{ background: 'var(--background)', border: '1px solid var(--border)' }}
        >
          {buildUpSentence.length === 0 && (
            <span className="text-xs text-(--muted) self-center">Tap words below to build the sentence…</span>
          )}
          {buildUpSentence.map((word, i) => (
            <button
              key={i}
              onClick={() => selectHandler(i, word)}
              className={`${baseOptionCls} px-3 py-1.5 text-sm bg-(--accent)/15 border-2 border-(--accent)/40 text-(--accent)`}
            >
              {word.word}
            </button>
          ))}
        </div>

  <div className="w-full h-px" style={{ background: 'var(--border)' }} />

        {/* Word pool */}
        <div className="flex flex-wrap justify-center gap-2 w-full">
          {options.map((item, index) =>
            !item.selected ? (
              <button
                key={item.id}
                onClick={() => selectHandler(index, item)}
                className={`${baseOptionCls} px-3 py-1.5 text-sm ${optionStateClasses[getOptionState(false, answered, item.correct)]}`}
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
      ? <Sound autoplay icon src={src} className="flex flex-col items-center gap-2"><WordImg src={dataSentence.img ?? ""} size="medium" /></Sound>
      : <WordImg src={dataSentence.img ?? ""} size="medium" />;
  } else {
    soundContent = (
      <Sound autoplay icon src={audioSrc} className="flex flex-col items-center gap-2">
        <p className="text-xl font-semibold text-foreground text-center max-w-xs">{sentenceText}</p>
      </Sound>
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
    const stateCls = optionStateClasses[getOptionState(item.selected ?? false, answered, item.correct)];
    const label = mode === "whatDoYouHearSentence"
      ? dataSentence.text.replace("__", item.word)
      : item.word;

    if (mode === "guessImg") {
      return (
        <Sound key={index} src={item.img_sound ?? ""} icon className="w-[45%] flex flex-col items-center gap-2" onClick={() => selectHandler(index, item)}>
          <div className={`${baseOptionCls} ${stateCls} w-full`}>
            {label}
          </div>
        </Sound>
      );
    }
    if (mode === "witchIs") {
      return (
        <Sound key={index} src={item.img_sound ?? ""} icon className="w-[45%] flex flex-col items-center gap-2" onClick={() => selectHandler(index, item)}>
          <div className={`${baseOptionCls} ${stateCls} w-full flex-col gap-1`}>
            <WordImg src={item.img ?? ""} size="small" />
          </div>
        </Sound>
      );
    }
    return (
      <button
        key={index}
        onClick={() => selectHandler(index, item)}
        className={`${baseOptionCls} ${stateCls} ${mode === "whatDoYouHearSentence" ? "w-full" : "w-[45%]"}`}
      >
        {label}
      </button>
    );
  });

  return (
    <PanelWrapper>
      <SectionLabel>{titleText}</SectionLabel>

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
