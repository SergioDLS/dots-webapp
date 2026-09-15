import { test } from "node:test";
import assert from "node:assert/strict";
import {
  badgeCounts,
  cefrBand,
  equippedGesture,
  gestureItems,
  levelLine,
  statRow,
} from "./profile-view.ts";

const stats = (over = {}) => ({
  xp: 620, streak: 3, level: 4, xpForNextLevel: 900, highScores: [],
  readingsCompleted: 2, streakFreezes: 1, bestStreak: 9, xpWeek: 140, ...over,
});
const badge = (over = {}) => ({
  key: "b1", title: "Primera lección", emoji: "🌟", earned: true, progress: 1, goal: 1, ...over,
});
const item = (over = {}) => ({
  id: 1, key: "g1", kind: "cosmetic", name: "Saludo", slot: "gesture",
  meta: { animation: "wave" }, equippedSlot: null, ...over,
});

test("cefrBand devuelve código y nombre en español por nivel", () => {
  assert.deepEqual(cefrBand(1), { code: "A1", name: "Principiante" });
  assert.deepEqual(cefrBand(4), { code: "A2", name: "Básico" });
  assert.deepEqual(cefrBand(7), { code: "B1", name: "Intermedio" });
  assert.deepEqual(cefrBand(10), { code: "B2", name: "Intermedio alto" });
  assert.deepEqual(cefrBand(14), { code: "C1", name: "Avanzado" });
  assert.deepEqual(cefrBand(15), { code: "C2", name: "Experto" });
});

test("cefrBand no se rompe con un nivel absurdo", () => {
  assert.deepEqual(cefrBand(0), { code: "A1", name: "Principiante" });
  assert.deepEqual(cefrBand(999), { code: "C2", name: "Experto" });
});

test("badgeCounts cuenta ganadas sobre total", () => {
  const list = [badge({ earned: true }), badge({ key: "b2", earned: false }), badge({ key: "b3", earned: true })];
  assert.deepEqual(badgeCounts(list), { earned: 2, total: 3 });
});

test("badgeCounts con lista vacía no divide por cero", () => {
  assert.deepEqual(badgeCounts([]), { earned: 0, total: 0 });
});

test("levelLine arma la línea de nivel del spec", () => {
  assert.equal(levelLine(stats()), "Nivel 4 · 620 / 900 XP");
});

test("levelLine sin stats da una línea neutra, no 'undefined'", () => {
  assert.equal(levelLine(null), "Nivel 1 · 0 / 0 XP");
});

test("statRow da los cuatro números del spec en orden", () => {
  const row = statRow(stats({ gems: 14 }), [badge({ earned: true }), badge({ key: "b2", earned: false })]);
  assert.deepEqual(row, [
    { label: "XP total", value: "620" },
    { label: "Mejor racha", value: "9" },
    { label: "Insignias", value: "1/2" },
    { label: "Gemas", value: "14" },
  ]);
});

test("statRow tolera gemas ausentes: el backend puede no haber migrado la economía", () => {
  const row = statRow(stats(), []);
  assert.equal(row[3].value, "0");
  assert.equal(row[2].value, "0/0");
});

test("statRow sin stats devuelve ceros y no revienta", () => {
  const row = statRow(null, []);
  assert.deepEqual(row.map((s) => s.value), ["0", "0", "0/0", "0"]);
});

test("gestureItems se queda solo con los del slot gesture", () => {
  const items = [item(), item({ id: 2, slot: "hat" }), item({ id: 3, slot: null }), item({ id: 4 })];
  assert.deepEqual(gestureItems(items).map((i) => i.id), [1, 4]);
});

test("equippedGesture encuentra el gesto puesto y devuelve null si no hay", () => {
  const items = [item(), item({ id: 2, equippedSlot: "gesture" })];
  assert.equal(equippedGesture(items)?.id, 2);
  assert.equal(equippedGesture([item()]), null);
});

test("equippedGesture ignora un equipado de otro slot", () => {
  // Un gorro equipado no debe animar a Doty.
  assert.equal(equippedGesture([item({ slot: "hat", equippedSlot: "hat" })]), null);
});
