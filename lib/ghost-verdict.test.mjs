import { test } from "node:test";
import assert from "node:assert/strict";
import { ganoAlFantasma } from "./ghost-verdict.ts";

test("terminar antes que el fantasma es ganar", () => {
  assert.equal(ganoAlFantasma({ completo: true, mio: [3000, 40000], fantasma: [4500, 54000] }), true);
});

test("terminar después, o empatar, es perder", () => {
  assert.equal(ganoAlFantasma({ completo: true, mio: [3000, 60000], fantasma: [4500, 54000] }), false);
  assert.equal(ganoAlFantasma({ completo: true, mio: [54000], fantasma: [54000] }), false);
});

test("sin responder todas las preguntas no hay victoria, aunque vayas delante", () => {
  assert.equal(ganoAlFantasma({ completo: false, mio: [1000], fantasma: [54000] }), false);
});

test("sin pasos propios no se gana; contra un fantasma sin pasos, terminar basta", () => {
  assert.equal(ganoAlFantasma({ completo: true, mio: [], fantasma: [54000] }), false);
  assert.equal(ganoAlFantasma({ completo: true, mio: [3000], fantasma: [] }), true);
});
