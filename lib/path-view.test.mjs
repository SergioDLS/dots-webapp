import { test } from "node:test";
import assert from "node:assert/strict";
import {
  SECTION_POSES,
  clampPct,
  countLessons,
  difficultyNav,
  encouragement,
  firstUpcomingSectionIndex,
  isDifficultyUnlocked,
  narratorFallback,
  panelTint,
  pickDefaultDifficultyId,
  prettyDifficultyName,
  sectionPose,
} from "./path-view.ts";

const node = (over = {}) => ({
  id: 1, type: "vocab", position: 0, title: "x", sectionId: 1,
  progress: 0, completed: false, unlocked: true, current: false, ...over,
});
const section = (over = {}) => ({
  id: 1, name: "s", progress: 0, skipped: false, unlocked: true, current: false,
  checkpointAvailable: false, nodes: [], ...over,
});
const difficulty = (over = {}) => ({
  id: 1, name: "beginner", img: null, progress: 0, skipped: false, current: false, sections: [], ...over,
});

test("clampPct acota y redondea", () => {
  assert.equal(clampPct(-5), 0);
  assert.equal(clampPct(33.4), 33);
  assert.equal(clampPct(140), 100);
});

test("countLessons excluye checkpoints y redondea el porcentaje", () => {
  const s = section({ nodes: [node({ completed: true }), node({ id: 2 }), node({ id: 3, type: "checkpoint" }), node({ id: 4 })] });
  assert.deepEqual(countLessons([s]), { done: 1, total: 3, pct: 33 });
  assert.deepEqual(countLessons([]), { done: 0, total: 0, pct: 0 });
});

test("isDifficultyUnlocked: superada o con alguna sección abierta", () => {
  assert.equal(isDifficultyUnlocked(difficulty({ sections: [section({ unlocked: false })] })), false);
  assert.equal(isDifficultyUnlocked(difficulty({ sections: [section({ unlocked: false, skipped: true })] })), true);
  assert.equal(isDifficultyUnlocked(difficulty({ skipped: true })), true);
});

test("pickDefaultDifficultyId: flag current, luego nodo current, luego primera abierta", () => {
  const a = difficulty({ id: 1, sections: [section({ unlocked: true })] });
  const b = difficulty({ id: 2, sections: [section({ id: 2, nodes: [node({ current: true })] })] });
  const c = difficulty({ id: 3, current: true });
  assert.equal(pickDefaultDifficultyId([a, b, c]), 3);
  assert.equal(pickDefaultDifficultyId([a, b]), 2);
  assert.equal(pickDefaultDifficultyId([difficulty({ id: 9, sections: [section({ unlocked: false })] }), a]), 1);
  assert.equal(pickDefaultDifficultyId([]), null);
});

test("difficultyNav: vecinas y bloqueo de la siguiente", () => {
  const ds = [
    difficulty({ id: 1, sections: [section()] }),
    difficulty({ id: 2, sections: [section({ unlocked: true })] }),
    difficulty({ id: 3, sections: [section({ unlocked: false })] }),
  ];
  assert.deepEqual(difficultyNav(ds, 1), { index: 0, total: 3, prevId: null, nextId: 2, nextLocked: false });
  assert.deepEqual(difficultyNav(ds, 2), { index: 1, total: 3, prevId: 1, nextId: 3, nextLocked: true });
  assert.deepEqual(difficultyNav(ds, 3), { index: 2, total: 3, prevId: 2, nextId: null, nextLocked: false });
  assert.deepEqual(difficultyNav(ds, 99).index, 0);
});

test("firstUpcomingSectionIndex: primera sección ni abierta ni superada", () => {
  assert.equal(firstUpcomingSectionIndex([section(), section({ id: 2, unlocked: false }), section({ id: 3, unlocked: false })]), 1);
  assert.equal(firstUpcomingSectionIndex([section(), section({ id: 2, unlocked: false, skipped: true })]), -1);
});

test("encouragement sigue la tabla de doty-identity", () => {
  assert.equal(encouragement(0), "Todo el mundo empezó aquí. Hasta yo.");
  assert.equal(encouragement(25), "Vas con todo. Ni una lección te frena.");
  assert.equal(encouragement(50), "Más de la mitad. Ya no hay vuelta atrás.");
  assert.equal(encouragement(85), "Ya casi. Cierra con estilo.");
  assert.equal(encouragement(100), "Nivel dominado. +1000 de aura.");
});

test("sectionPose es determinista y sale del pool", () => {
  assert.equal(sectionPose(7), sectionPose(7));
  assert.equal(sectionPose(-3), sectionPose(3));
  assert.ok(SECTION_POSES.includes(sectionPose(1234)));
});

test("narratorFallback por posición, acotado", () => {
  assert.equal(narratorFallback(0), "bienvenido");
  assert.equal(narratorFallback(1), "sigue-asi");
  assert.equal(narratorFallback(2), "orgulloso");
  assert.equal(narratorFallback(9), "orgulloso");
  assert.equal(narratorFallback(-1), "bienvenido");
});

test("prettyDifficultyName capitaliza cada palabra", () => {
  assert.equal(prettyDifficultyName("upper intermediate"), "Upper Intermediate");
  assert.equal(prettyDifficultyName(""), "");
});

test("panelTint mezcla el acento al 14 % sobre --surface", () => {
  assert.equal(panelTint("#3768ff"), "color-mix(in srgb, #3768ff 14%, var(--surface))");
});
