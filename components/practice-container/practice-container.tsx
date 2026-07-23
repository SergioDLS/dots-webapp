"use client";

import { useState, useRef, useCallback } from "react";
import Doty from "@/components/ui/doty/doty";
import Confetti from "@/components/ui/confetti/confetti";
import WordImg from "@/components/ui/word-img/word-img";
import Sound from "@/components/ui/sound/sound";
import { VoiceAvatar } from "@/components/lesson/shared/voice-avatar";
import { PanelWrapper, SectionLabel } from "@/components/lesson/panel";
import { getOptionState, optionStyles, baseOptionCls } from "@/components/lesson/option-styles";
import RewardPanel from "@/components/lesson/reward-panel";
import type { Sentence, SentenceOption as Option } from "@/types/practice.types";
import type { ProgressReward } from "@/services/engagement.service";
import { resolveSentenceSoundUrl } from "@/constants";

interface PracticeContainerProps {
  mode: string;
  dataSentence: Sentence;
  answered: string;
  click: (correct: boolean) => void;
  doty: string;
  streak: number;
  /** Enriched PUT /sentences/progress response (arrives async on end screens) */
  reward?: ProgressReward | null;
}

// ── Main component ────────────────────────────────────────────────────────────
export default function PracticeContainer({
  mode,
  dataSentence,
  answered,
  click,
  doty,
  streak,
  reward = null,
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
  const audioSrc = dataSentence.sentence_extension
    ? resolveSentenceSoundUrl(
        dataSentence.id,
        dataSentence.sentence_extension,
        dataSentence.voice_key,
      )
    : "";

  // ── Streak ────────────────────────────────────────────────────────────────
  if (mode === "streak") {
    return (
      <PanelWrapper>
        <Confetti burstKey={streak} count={34} />
        <SectionLabel emoji="🔥">Streak</SectionLabel>
        <Doty pose="02" size="small" animation="cheer" say="You're on fire!" />
        <p
          className="font-display text-5xl font-extrabold"
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
    const subtext = mode === "perfect" ? "No mistakes! DOTY is SO proud of you!" : isGameover ? "You ran out of hearts!" : "You completed the level!";
    const dotySays = mode === "perfect" ? "WOW! You're a star!" : isGameover ? "Let's try again together!" : "I knew you could do it!";
    const gradient = isGameover
      ? "linear-gradient(135deg, #f43f5e, #ef4444)"
      : "linear-gradient(135deg, var(--accent), #fbbf24)";
    return (
      <PanelWrapper>
        {!isGameover && <Confetti burstKey={mode} count={40} />}
        <SectionLabel emoji={emoji}>{title}</SectionLabel>
        <Doty
          pose={isGameover ? "05" : mode === "perfect" ? "17" : "02"}
          size="small"
          animation={isGameover ? "sad" : "cheer"}
          say={dotySays}
        />
        <p
          className="font-display text-2xl font-extrabold text-center"
          style={{
            background: gradient,
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
          }}
        >
          {subtext}
        </p>

        {/* ── Engagement reward (arrives async from PUT /sentences/progress) ── */}
        <RewardPanel reward={reward} />
      </PanelWrapper>
    );
  }

  // ── BuildUp ───────────────────────────────────────────────────────────────
  if (mode === "buildUp") {
    return (
      <PanelWrapper>
        <SectionLabel emoji="🧩">Build up the sentence!</SectionLabel>
        <div className="flex items-end gap-4">
          <Doty pose={doty} size="small" animation="bob" />
          <div className="flex flex-col items-center gap-2">
            <Sound autoplay src={audioSrc} icon className="flex flex-col items-center gap-2">
              <WordImg src={dataSentence.img ?? ""} size="medium" />
            </Sound>
            {audioSrc && <VoiceAvatar voiceKey={dataSentence.voice_key} />}
          </div>
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
                background: "color-mix(in srgb, var(--accent) 10%, transparent)",
                border: "2px solid color-mix(in srgb, var(--accent) 30%, transparent)",
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
      ? (
        <div className="flex flex-col items-center gap-2">
          <Sound autoplay icon src={src} className="flex flex-col items-center gap-2"><WordImg src={dataSentence.img ?? ""} size="medium" /></Sound>
          {/* avatar solo si suena la narración de la oración (img_sound es otra voz) */}
          {src === audioSrc && audioSrc && <VoiceAvatar voiceKey={dataSentence.voice_key} />}
        </div>
      )
      : <WordImg src={dataSentence.img ?? ""} size="medium" />;
  } else {
    soundContent = (
      <div className="flex flex-col items-center gap-2">
        <Sound autoplay icon src={audioSrc} className="flex flex-col items-center gap-2">
          <p
            className="text-xl font-bold text-center max-w-xs"
            style={{ color: "var(--foreground)" }}
          >
            {sentenceText}
          </p>
        </Sound>
        {audioSrc && <VoiceAvatar voiceKey={dataSentence.voice_key} />}
      </div>
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
          <Doty pose={doty} size="small" animation="bob" />
          {soundContent}
        </div>
      )}

      <div className="flex flex-wrap justify-center gap-3 w-full">
        {optionList}
      </div>
    </PanelWrapper>
  );
}
