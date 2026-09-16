import { test } from "node:test";
import assert from "node:assert/strict";
import {
  FLIP_MS,
  FLOURISH_DELAY_MS,
  LOOP_MS,
  flourishLoops,
  flourishMs,
  flourishTimeline,
  gestureAnimation,
  gesturePose,
  shouldFlourish,
} from "./avatar-flip.ts";

const item = (over = {}) => ({
  id: 1,
  key: "gesture_wave",
  kind: "gesture",
  name: "Saludo",
  img: null,
  slot: "gesture",
  meta: { animation: "wave" },
  equippedSlot: "gesture",
  ...over,
});

test("LOOP_MS calca las duraciones de app/globals.css", () => {
  assert.deepEqual(LOOP_MS, { none: 0, bob: 2200, cheer: 900, sad: 3000, wave: 1600 });
});

test("gestureAnimation lee meta.animation y solo acepta el vocabulario de Doty", () => {
  assert.equal(gestureAnimation(item()), "wave");
  assert.equal(gestureAnimation(item({ meta: { animation: "cheer" } })), "cheer");
  assert.equal(gestureAnimation(item({ meta: { animation: "none" } })), null);
  assert.equal(gestureAnimation(item({ meta: { animation: "moonwalk" } })), null);
  assert.equal(gestureAnimation(item({ meta: { animation: 7 } })), null);
  assert.equal(gestureAnimation(item({ meta: null })), null);
  assert.equal(gestureAnimation(null), null);
  assert.equal(gestureAnimation(undefined), null);
});

test("gesturePose elige la pose que hace legible cada gesto", () => {
  assert.equal(gesturePose("wave"), "saludando");
  assert.equal(gesturePose("cheer"), "emocionado");
  assert.equal(gesturePose("bob"), "feliz");
  assert.equal(gesturePose("sad"), "feliz");
  assert.equal(gesturePose("none"), "feliz");
});

test("flourishLoops da vueltas completas que suman unos 3 s, nunca menos de dos", () => {
  assert.equal(flourishLoops("wave"), 2); // 3200 ms
  assert.equal(flourishLoops("cheer"), 3); // 2700 ms
  assert.equal(flourishLoops("bob"), 2); // 4400 ms: manda el mínimo
  assert.equal(flourishLoops("none"), 0);
});

test("flourishMs es vueltas por duración de vuelta", () => {
  assert.equal(flourishMs("wave"), 3200);
  assert.equal(flourishMs("cheer"), 2700);
  assert.equal(flourishMs("none"), 0);
});

test("flourishTimeline: retrato 600 ms, giro de 400, gesto completo y vuelta", () => {
  assert.equal(FLOURISH_DELAY_MS, 600);
  assert.equal(FLIP_MS, 400);
  assert.deepEqual(flourishTimeline("wave"), { flipAt: 600, flipBackAt: 4200 });
  assert.deepEqual(flourishTimeline("cheer"), { flipAt: 600, flipBackAt: 3700 });
  assert.equal(flourishTimeline("none"), null);
  assert.equal(flourishTimeline(null), null);
});

test("shouldFlourish exige gesto y respeta prefers-reduced-motion", () => {
  assert.equal(shouldFlourish("wave", false), true);
  assert.equal(shouldFlourish("cheer", false), true);
  assert.equal(shouldFlourish("wave", true), false);
  assert.equal(shouldFlourish(null, false), false);
  assert.equal(shouldFlourish("none", false), false);
});
