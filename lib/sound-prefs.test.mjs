import { test } from "node:test";
import assert from "node:assert/strict";
import { SOUND_KEY, normalizeSound } from "./sound-prefs.ts";

test("la clave del espejo sigue la convención de las de tema", () => {
  assert.equal(SOUND_KEY, "dots-sound");
});

test("normalizeSound reconoce los dos valores que escribimos", () => {
  assert.equal(normalizeSound("on"), true);
  assert.equal(normalizeSound("off"), false);
});

test("normalizeSound da true por defecto: quien nunca lo tocó oye los sonidos", () => {
  assert.equal(normalizeSound(null), true);
  assert.equal(normalizeSound(""), true);
  assert.equal(normalizeSound("basura"), true);
});
