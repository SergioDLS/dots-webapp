import { test } from "node:test";
import assert from "node:assert/strict";
import {
  alternativaPara,
  camposVisibles,
  etiquetaSuperficie,
  fechaCorta,
  idsPendientes,
  mensajeDelServidor,
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

// Un error como el que deja axios: Error con `isAxiosError` y la respuesta del servidor.
const errorHttp = (status, data) =>
  Object.assign(new Error(`Request failed with status code ${status}`), {
    isAxiosError: true,
    response: { status, data },
  });

test("mensajeDelServidor: el texto del 400, 404 o 409 explica el porqué", () => {
  const porDefecto = "No se pudo cerrar. Inténtalo otra vez.";
  assert.equal(
    mensajeDelServidor(
      errorHttp(400, { statusCode: 400, message: "Un ítem de gramática solo acepta otras palabras" }),
      porDefecto,
    ),
    "Un ítem de gramática solo acepta otras palabras",
  );
  assert.equal(
    mensajeDelServidor(errorHttp(409, { message: "Otro admin la quitó. Inténtalo otra vez." }), porDefecto),
    "Otro admin la quitó. Inténtalo otra vez.",
  );
  assert.equal(mensajeDelServidor(errorHttp(404, { message: "La oración ya no existe" }), porDefecto), "La oración ya no existe");
});

test("mensajeDelServidor: el 503 de la migración sin aplicar también cuenta", () => {
  assert.equal(
    mensajeDelServidor(errorHttp(503, { message: "Los reportes aún no están disponibles" }), "No se pudo cerrar."),
    "Los reportes aún no están disponibles",
  );
});

test("mensajeDelServidor: el ValidationPipe manda un arreglo y se une con « · »", () => {
  assert.equal(
    mensajeDelServidor(
      errorHttp(400, { message: ["ids must contain at least 1 elements", "note must be shorter than or equal to 500 characters"] }),
      "x",
    ),
    "ids must contain at least 1 elements · note must be shorter than or equal to 500 characters",
  );
  // Un solo elemento no lleva separador; lo que no es texto o está en blanco se descarta.
  assert.equal(mensajeDelServidor(errorHttp(400, { message: ["solo uno"] }), "x"), "solo uno");
  assert.equal(mensajeDelServidor(errorHttp(400, { message: ["uno", 7, null, "  ", "dos"] }), "x"), "uno · dos");
});

test("mensajeDelServidor: un 5xx que no sea 503 es el servidor o su proxy fallando, no una explicación", () => {
  for (const status of [500, 502, 504]) {
    assert.equal(mensajeDelServidor(errorHttp(status, { message: "Internal server error" }), "No se pudo cerrar."), "No se pudo cerrar.");
  }
});

test("mensajeDelServidor: lo que no es un error HTTP del servidor cae al texto por defecto", () => {
  const porDefecto = "No se pudo quitar.";
  // Sin respuesta (red caída, timeout) y errores de código nuestro.
  assert.equal(mensajeDelServidor(new Error("Network Error"), porDefecto), porDefecto);
  assert.equal(mensajeDelServidor(new TypeError("x is not a function"), porDefecto), porDefecto);
  for (const raro of [null, undefined, "boom", 42, {}, { response: null }, { response: "no" }]) {
    assert.equal(mensajeDelServidor(raro, porDefecto), porDefecto);
  }
  // Respuesta sin un mensaje utilizable: cuerpo en HTML o texto, sin `message`, vacío o no textual.
  assert.equal(mensajeDelServidor(errorHttp(400, "<html>Bad Request</html>"), porDefecto), porDefecto);
  assert.equal(mensajeDelServidor(errorHttp(400, undefined), porDefecto), porDefecto);
  assert.equal(mensajeDelServidor(errorHttp(400, {}), porDefecto), porDefecto);
  assert.equal(mensajeDelServidor(errorHttp(400, { message: "   " }), porDefecto), porDefecto);
  assert.equal(mensajeDelServidor(errorHttp(400, { message: [] }), porDefecto), porDefecto);
  assert.equal(mensajeDelServidor(errorHttp(400, { message: { campo: "x" } }), porDefecto), porDefecto);
  assert.equal(mensajeDelServidor(errorHttp(400, { message: 400 }), porDefecto), porDefecto);
});
