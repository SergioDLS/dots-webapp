import { test } from "node:test";
import assert from "node:assert/strict";
import { dropTarget, moveItem } from "./tray-drop.ts";

// Dos filas de chips de 40×30 con 8 px de separación:
//   fila 1 (top 0):  [0] 0–40   [1] 48–88   [2] 96–136
//   fila 2 (top 38): [3] 0–40   [4] 48–88
const box = (left, top) => ({ left, top, width: 40, height: 30 });
const BOXES = [box(0, 0), box(48, 0), box(96, 0), box(0, 38), box(48, 38)];

test("moveItem mueve sin mutar el original", () => {
  const list = ["a", "b", "c", "d"];
  assert.deepEqual(moveItem(list, 0, 2), ["b", "c", "a", "d"]);
  assert.deepEqual(moveItem(list, 3, 0), ["d", "a", "b", "c"]);
  assert.deepEqual(moveItem(list, 1, 1), list);
  assert.deepEqual(list, ["a", "b", "c", "d"]);
});

test("soltar sobre su propio sitio no mueve nada ni pinta caret", () => {
  assert.deepEqual(dropTarget(BOXES, 1, 60, 15), { to: 1, caret: null });
  // justo pasada la mitad de sí mismo sigue siendo su sitio
  assert.deepEqual(dropTarget(BOXES, 1, 75, 15), { to: 1, caret: null });
});

test("hacia la izquierda en la misma fila", () => {
  // chip 2 soltado sobre la mitad izquierda del chip 0 → va al principio
  const r = dropTarget(BOXES, 2, 5, 15);
  assert.equal(r.to, 0);
  assert.deepEqual(r.caret, { x: -4, y: 0, h: 30 });
});

test("hacia la derecha en la misma fila", () => {
  // chip 0 soltado pasada la mitad del chip 2 → queda al final de la fila 1
  const r = dropTarget(BOXES, 0, 130, 15);
  assert.equal(r.to, 2);
  assert.deepEqual(r.caret, { x: 140, y: 0, h: 30 });
});

test("el caret entre dos chips cae en el centro del hueco", () => {
  // chip 4 soltado sobre la mitad izquierda del chip 1 → entre 0 y 1
  const r = dropTarget(BOXES, 4, 50, 10);
  assert.equal(r.to, 1);
  assert.deepEqual(r.caret, { x: 44, y: 0, h: 30 });
});

test("cambiar de fila", () => {
  // chip 0 soltado al final de la fila 2 → último
  const r = dropTarget(BOXES, 0, 120, 50);
  assert.equal(r.to, 4);
  assert.deepEqual(r.caret, { x: 92, y: 38, h: 30 });
  // chip 4 soltado al principio de la fila 2 → antes del 3
  assert.equal(dropTarget(BOXES, 4, 2, 50).to, 3);
});

test("fuera de la bandeja usa la fila más cercana", () => {
  assert.equal(dropTarget(BOXES, 4, 5, -40).to, 0); // por encima
  assert.equal(dropTarget(BOXES, 0, 200, 300).to, 4); // por debajo
  // en el hueco entre filas, más cerca de la fila 2
  assert.equal(dropTarget(BOXES, 0, 5, 36).to, 2);
});

test("sin chips no hay destino", () => {
  assert.deepEqual(dropTarget([], 0, 0, 0), { to: 0, caret: null });
});
