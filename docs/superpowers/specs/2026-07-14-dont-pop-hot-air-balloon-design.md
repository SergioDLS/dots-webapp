# Don't Pop — hot-air balloon redesign (webapp + mobile app)

Date: 2026-07-14

## Goal

Re-theme the two-option word game on both platforms: Doty rides a hot-air
balloon whose pressure climbs on its own (the balloon IS the timer). Right
answers vent air; wrong answers pump it in; hitting max pressure bursts the
balloon and Doty falls (loss); clearing every word lands the balloon safely
(win). On mobile this REPLACES the old Pop It (rising balloons, tap the
target) so both platforms play the same game.

Decisions (confirmed with Sergio): replace Pop It entirely on mobile; a wrong
answer inflates a chunk; the win condition is clearing all words.

## Shared tuning (identical on both platforms)

- `PRESSURE_MAX 100`, `START_PRESSURE 15`, `INFLATE_PER_SEC 6`,
  `CORRECT_DEFLATE 25`, `WRONG_INFLATE 30`, tick 100ms.
- Crash beat ~1.5s / landing beat ~1.4s before the end card.
- Score = words cleared; submitted as game key `dont-pop`.

## Webapp

- `components/games/dont-pop/hot-air-balloon.tsx`: presentational SVG balloon
  (gored envelope in dots palette, ropes, wicker basket, Doty peeking out).
  Props: `pressure` 0..1, `phase` flying | exploded | landed. Envelope swells
  (scale 1→1.38), hue-shifts red past 55% and trembles past 72%; explosion
  renders a burst ring + shards while the basket group falls; landed settles
  with a cheering Doty.
- `app/(app)/games/dont-pop/page.tsx`: same data flow as before
  (`getDontPopService`, `submitGameScoreService('dont-pop')`, XpReward) with
  the new pressure model, a pressure meter, sky scene (drifting clouds,
  ground strip, new `--sky-top`/`--sky-bottom` tokens for light/dark) and the
  crash/landing beats before the end card.
- `globals.css`: adds `--sun: var(--gold)` — the token was referenced by
  confetti and the admin WIP badge but never defined (rendered black).

## Mobile app (replaces Pop It)

- `components/games/popit/engine.ts`: new pure engine (rng injected, fully
  deterministic). `initGame` builds a quest of up to `MAX_QUEST_WORDS 12`
  prompt-able words (must carry an image; ≥2 required) plus a distractor pool
  of all unique words; `tick` inflates; `answer` resolves a choice. Statuses:
  playing | exploded | landed. `MIN_VOCAB_WORDS 8` hub gate unchanged.
- `__tests__/popit-engine.test.ts`: rewritten for the new engine (17 tests).
- `components/games/popit/PopItGame.tsx`: rewritten screen — pressure meter,
  SVG balloon (same geometry as web, reanimated bob/tremble/fall), prompt
  card (WordImg + SoundButton), two option cards, sounds + haptics, local
  high score `dots-hs-popit`, `submitGameScore('dont-pop')`, Confetti on win.
- `app/(app)/game/pop-it.tsx`: extra gate on `promptableWords(vocab) >= 2`.
- Games hub: card renamed "Don't Pop!"; route, image and score keys unchanged.

## Verification

- Webapp: tsc/eslint/next build clean; start screen screenshotted in the
  browser (balloon, sky, ground render correctly after the `--sun` fix).
- App: tsc clean; full jest suite passes (13 suites, 138 tests).
