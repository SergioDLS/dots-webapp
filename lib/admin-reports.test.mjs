import { test } from "node:test";
import assert from "node:assert/strict";
import {
  alternativaPara,
  camposVisibles,
  etiquetaSuperficie,
  fechaCorta,
  idsPendientes,
  notaPorDefecto,
  puedeAceptar,
  resumenMotivos,
} from "./admin-reports.ts";

test("superficies legibles", () => {
  assert.equal(etiquetaSuperficie("practice"), "Práctica");
  assert.equal(etiquetaSuperficie("lesson-vocab"), "Vocabulario");
  assert.equal(etiquetaSuperficie("game:dotaxi"), "Juego · Dotaxi");
  assert.equal(etiquetaSuperficie("app"), "Ajustes");
  assert.equal(etiquetaSuperficie("game:nuevo"), "Juego · nuevo");
});

test("recuento de motivos en orden canónico", () => {
  assert.equal(resumenMotivos({ typo: 1, answer: 3 }), "3 debería estar bien · 1 ortografía");
  assert.equal(resumenMotivos({}), "");
});

test("aceptar: oraciones (palabra u orden) y gramática (solo palabra)", () => {
  assert.equal(puedeAceptar("sentence"), true);
  assert.equal(puedeAceptar("vocab_item"), false);
  const palabra = { answer: "feel", kind: "word", count: 1, reportIds: [1] };
  const orden = { answer: "Today I am happy", kind: "sentence", count: 1, reportIds: [2] };
  assert.deepEqual(alternativaPara("sentence", orden), { targetType: "sentence", kind: "sentence" });
  assert.deepEqual(alternativaPara("grammar_item", palabra), { targetType: "grammar_item", kind: "word" });
  assert.equal(alternativaPara("grammar_item", orden), null);
  assert.equal(alternativaPara("vocab_item", palabra), null);
  assert.equal(notaPorDefecto("feel"), "Ahora «feel» también vale");
});

test("fecha corta relativa a hoy", () => {
  const ahora = new Date("2026-10-01T15:00:00");
  assert.match(fechaCorta("2026-10-01T10:05:00", ahora), /^hoy \d{2}:\d{2}$/);
  assert.equal(fechaCorta("2026-09-30T10:05:00", ahora), "ayer");
  assert.equal(fechaCorta("2026-09-12T10:05:00", ahora), "12 sep");
});

test("campos visibles por tipo, sin vacíos", () => {
  assert.deepEqual(camposVisibles("sentence", { text: "I __ happy.", mWord: "am", img: "" }), [
    { label: "Oración", value: "I __ happy." },
    { label: "Palabra correcta", value: "am" },
  ]);
  assert.deepEqual(camposVisibles("vocab_item", { text: "big", meaning: "grande" }), [
    { label: "Inglés", value: "big" },
    { label: "Significado", value: "grande" },
  ]);
});

test("solo los pendientes se cierran", () => {
  assert.deepEqual(
    idsPendientes([
      { id: 1, status: "pending" },
      { id: 2, status: "fixed" },
      { id: 3, status: "pending" },
    ]),
    [1, 3],
  );
});
