import { test } from "node:test";
import assert from "node:assert/strict";
import {
  cubreTodasLasIncorrectas,
  esOracionAceptada,
  normalizarOracion,
  primerFalloEnOrden,
  sinAceptadas,
} from "./accepted-answers.ts";

test("misma normalización que el backend", () => {
  assert.equal(normalizarOracion("  Today   I am happy ."), "TODAY I AM HAPPY");
});

test("«Arma la oración»: la referencia como siempre y las alternativas normalizadas", () => {
  assert.equal(esOracionAceptada("i am happy today", "I am happy today"), true);
  assert.equal(esOracionAceptada("today I am happy", "I am happy today"), false);
  assert.equal(esOracionAceptada("today I am happy", "I am happy today", ["Today I am happy."]), true);
  assert.equal(esOracionAceptada("", "x", [""]), false);
});

test("Constructor: primera ficha mal puesta respecto de la secuencia más parecida", () => {
  const ref = ["I", "am", "happy", "today"];
  const alt = ["Today", "I", "am", "happy"];
  assert.equal(primerFalloEnOrden(["I", "am", "happy", "today"], [ref, alt]), null);
  assert.equal(primerFalloEnOrden(["today", "i", "am", "happy"], [ref, alt]), null);
  assert.equal(primerFalloEnOrden(["I", "am", "today", "happy"], [ref, alt]), 2);
  assert.equal(primerFalloEnOrden(["Today", "I", "happy", "am"], [ref, alt]), 2);
});

test("¡No lo revientes!: las aceptadas salen de los distractores", () => {
  assert.deepEqual(sinAceptadas(["kitten", "dog", "Kitten "], ["kitten"]), ["dog"]);
  assert.deepEqual(sinAceptadas(["dog"], undefined), ["dog"]);
});

test("aviso del editor: las aceptadas cubren TODAS las opciones incorrectas", () => {
  // Con la misma normalización que usan los juegos: mayúsculas y puntuación final no cuentan.
  assert.equal(cubreTodasLasIncorrectas(["go", "goes"], ["Go", "goes."]), true);
  assert.equal(cubreTodasLasIncorrectas(["go"], ["go"]), true);
  // Aceptar de más (palabras que no eran distractores) no cambia nada.
  assert.equal(cubreTodasLasIncorrectas(["go"], ["went", "go"]), true);
});

test("aviso del editor: si queda al menos una incorrecta, no avisa", () => {
  assert.equal(cubreTodasLasIncorrectas(["go", "goes", "went"], ["go", "goes"]), false);
  assert.equal(cubreTodasLasIncorrectas(["go", "goes"], []), false);
  assert.equal(cubreTodasLasIncorrectas(["go"], ["went"]), false);
});

test("aviso del editor: sin distractores no hay nada que cubrir", () => {
  // No fue lo que aceptó el admin lo que dejó el ejercicio con una sola opción.
  assert.equal(cubreTodasLasIncorrectas([], ["go"]), false);
  assert.equal(cubreTodasLasIncorrectas([], []), false);
  // Los renglones en blanco no son opciones: ni cuentan como incorrecta que quede, ni como lista llena.
  assert.equal(cubreTodasLasIncorrectas(["go", "  ", ""], ["go"]), true);
  assert.equal(cubreTodasLasIncorrectas(["  ", ""], ["go"]), false);
});
