import { test } from "node:test";
import assert from "node:assert/strict";
import { MASTERY_TYPES, milestonesLabel, nodeMilestones } from "./node-milestones.ts";

const node = (over = {}) => ({ type: "vocab", progress: 0, completed: false, mastery: 0, ...over });

test("los cinco módulos con dominio por ítem, y nada más", () => {
  assert.deepEqual(
    [...MASTERY_TYPES].sort(),
    ["grammar", "letters", "numbers", "pronunciation", "vocab"],
  );
});

test("módulo con dominio a medio camino: dos tramos, ninguno alcanzado", () => {
  assert.deepEqual(nodeMilestones(node({ progress: 40 })), [
    { kind: "complete", fill: 40, tone: "accent", reached: false },
    { kind: "master", fill: 0, tone: "accent", reached: false },
  ]);
});

test("completado con dominio al 50 %: primer hito verde, segundo en curso", () => {
  assert.deepEqual(nodeMilestones(node({ progress: 100, completed: true, mastery: 50 })), [
    { kind: "complete", fill: 100, tone: "success", reached: true },
    { kind: "master", fill: 50, tone: "accent", reached: false },
  ]);
});

test("dominado: segundo hito dorado", () => {
  const [, master] = nodeMilestones(node({ progress: 100, completed: true, mastery: 100 }));
  assert.deepEqual(master, { kind: "master", fill: 100, tone: "gold", reached: true });
});

test("el dominio se muestra tal cual aunque falte completar", () => {
  const [complete, master] = nodeMilestones(node({ progress: 60, mastery: 20 }));
  assert.equal(complete.reached, false);
  assert.equal(master.fill, 20);
});

test("completed manda sobre progress: completado es tramo lleno", () => {
  const [complete] = nodeMilestones(node({ progress: 97, completed: true }));
  assert.equal(complete.fill, 100);
});

test("lección y lectura: un solo tramo", () => {
  for (const type of ["practice", "reading"]) {
    assert.deepEqual(nodeMilestones(node({ type, progress: 60 })), [
      { kind: "complete", fill: 60, tone: "accent", reached: false },
    ]);
  }
});

test("checkpoint: sin hitos", () => {
  assert.deepEqual(nodeMilestones(node({ type: "checkpoint", progress: 100, completed: true })), []);
});

test("mastery ausente cuenta como 0, y los valores se recortan y redondean", () => {
  const [a, b] = nodeMilestones(node({ progress: 33.4, mastery: undefined }));
  assert.equal(a.fill, 33);
  assert.equal(b.fill, 0);
  assert.equal(nodeMilestones(node({ progress: 140 }))[0].fill, 100);
  assert.equal(nodeMilestones(node({ progress: -5 }))[0].fill, 0);
});

test("la etiqueta accesible dice los dos porcentajes", () => {
  assert.equal(milestonesLabel(nodeMilestones(node({ progress: 40 }))), "Completado al 40 %. Dominado al 0 %.");
  assert.equal(milestonesLabel(nodeMilestones(node({ type: "practice", progress: 60 }))), "Completado al 60 %.");
});
