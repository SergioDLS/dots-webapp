import { test } from "node:test";
import assert from "node:assert/strict";
import {
  alternativaPara,
  camposVisibles,
  cierraAlGuardar,
  dondeDelReporte,
  esEditable,
  etiquetaLugar,
  etiquetaModo,
  etiquetaSuperficie,
  fechaCorta,
  idsACerrar,
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

test("mensajeDelServidor: solo hablan el 400, 404, 409 y 503; el resto de Nest viene en inglés", () => {
  const porDefecto = "No se pudo cerrar. Inténtalo otra vez.";
  // Los textos por defecto de Nest para 401 y 403 están en inglés y no explican nada al admin.
  assert.equal(mensajeDelServidor(errorHttp(401, { statusCode: 401, message: "Unauthorized" }), porDefecto), porDefecto);
  assert.equal(
    mensajeDelServidor(errorHttp(403, { statusCode: 403, message: "Forbidden resource", error: "Forbidden" }), porDefecto),
    porDefecto,
  );
  for (const status of [402, 405, 408, 413, 422, 429]) {
    assert.equal(mensajeDelServidor(errorHttp(status, { message: "texto de Nest" }), porDefecto), porDefecto);
  }
  // Sin status no se puede saber si es de las que explican: tampoco.
  assert.equal(mensajeDelServidor({ response: { data: { message: "texto" } } }, porDefecto), porDefecto);
  // Y las cuatro que sí hablan, una por una.
  for (const status of [400, 404, 409, 503]) {
    assert.equal(mensajeDelServidor(errorHttp(status, { message: `explicación ${status}` }), porDefecto), `explicación ${status}`);
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

test("editar desde un bug: cualquier ejercicio salvo el falso amigo, que vive fijo en el código", () => {
  assert.equal(esEditable("sentence", "101"), true);
  assert.equal(esEditable("grammar_pill", "3"), true);
  assert.equal(esEditable("word", "0"), true); // «0» es un id, no «vacío»
  assert.equal(esEditable("false_friend", "-3"), false);
  // Un bug general (sin ejercicio) no tiene nada que abrir.
  assert.equal(esEditable(null, null), false);
  assert.equal(esEditable("sentence", null), false);
  assert.equal(esEditable(null, "101"), false);
  assert.equal(esEditable("sentence", ""), false);
});

test("al guardar se cierran todos los modales menos el de la oración (su studio de voz sigue abierto)", () => {
  assert.equal(cierraAlGuardar("sentence"), false);
  for (const tipo of [
    "word",
    "vocab_item",
    "grammar_item",
    "grammar_pill",
    "pronunciation_item",
    "pronunciation_unit",
    "letter_item",
    "number_item",
    "reading",
  ]) {
    assert.equal(cierraAlGuardar(tipo), true, tipo);
  }
});

test("el lugar de un reporte de Ajustes se lee con la etiqueta de su chip", () => {
  assert.equal(etiquetaLugar("tienda"), "Tienda");
  assert.equal(etiquetaLugar("camino"), "Camino");
  assert.equal(etiquetaLugar("otra"), "Otra");
  // Un lugar que esta lista no conoce (otra versión de la app) se ve tal cual, no se pierde.
  assert.equal(etiquetaLugar("mazmorra"), "mazmorra");
  assert.equal(etiquetaLugar(""), "");
});

// Los `mode` que la app manda de verdad: los literales de los constructores de lib/report.ts y los que
// pasan las pantallas (práctica la decide el servidor, lecciones, lecturas y juegos).
const MODOS_DE_LA_APP = [
  "complete", "buildUp", "whatDoYouHear", "whatDoYouHearSentence", "guessImg", "witchIs", // práctica
  "practice", "explain", "drill", "intro", // gramática y pronunciación
  "present", "listen", "direct", "inverse", "recognize", "match", // vocabulario, letras y números
  "read", "quiz", // lecturas
  "order", "true-false", "category", "image", // juegos
];

test("el modo se lee con su título en español; el que no se conoce, tal cual", () => {
  assert.equal(etiquetaModo("buildUp"), "Arma la oración");
  assert.equal(etiquetaModo("complete"), "Completa la oración");
  assert.equal(etiquetaModo("guessImg"), "¿Qué es esto?");
  assert.equal(etiquetaModo("witchIs"), "¿Cuál es?");
  assert.equal(etiquetaModo("whatDoYouHear"), "¿Qué escuchas?");
  assert.equal(etiquetaModo("whatDoYouHearSentence"), "¿Qué oración escuchas?");
  assert.equal(etiquetaModo("inverse"), "¿Cómo suena?");
  assert.equal(etiquetaModo("match"), "Empareja");
  assert.equal(etiquetaModo("modo-que-no-existe"), "modo-que-no-existe");
  assert.equal(etiquetaModo(""), "");
});

test("ningún modo de la app se ve en crudo", () => {
  for (const modo of MODOS_DE_LA_APP) assert.notEqual(etiquetaModo(modo), modo, modo);
});

test("el modo lo escribe el alumno (hasta 40 letras): las claves de cualquier objeto no son modos", () => {
  for (const clave of ["constructor", "toString", "__proto__", "hasOwnProperty", "valueOf"]) {
    assert.equal(etiquetaModo(clave), clave, clave);
  }
});

test("el dónde de un reporte se lee como en el spec: «Práctica · Arma la oración», «Ajustes · Tienda»", () => {
  const base = { mode: null, where: null, context: {} };
  assert.equal(dondeDelReporte({ ...base, surface: "practice", mode: "buildUp" }), "Práctica · Arma la oración");
  assert.equal(dondeDelReporte({ ...base, surface: "app", context: { lugar: "tienda" } }), "Ajustes · Tienda");
  // Detrás va dónde vive el ejercicio (nivel, pack, píldora…).
  assert.equal(
    dondeDelReporte({ ...base, surface: "practice", mode: "buildUp", where: "Nivel 12 Verb to be" }),
    "Práctica · Arma la oración · Nivel 12 Verb to be",
  );
  assert.equal(dondeDelReporte({ ...base, surface: "game:sentence-builder", mode: "order" }), "Juego · Constructor · Ordena las fichas");
  // Sin nada que añadir, solo la superficie; lo vacío o que no es texto se ignora.
  assert.equal(dondeDelReporte({ ...base, surface: "checkpoint" }), "Checkpoint");
  assert.equal(dondeDelReporte({ surface: "app", mode: "", where: "", context: { lugar: "" } }), "Ajustes");
  assert.equal(dondeDelReporte({ ...base, surface: "app", context: { lugar: 3 } }), "Ajustes");
  assert.equal(dondeDelReporte({ ...base, surface: "app", context: { lugar: { a: 1 } } }), "Ajustes");
});

test("solo se cierra lo marcado que sigue pendiente en la última lectura", () => {
  assert.deepEqual(idsACerrar(null, [1, 2, 3]), [1, 2, 3]); // sin selección propia: todos los pendientes
  assert.deepEqual(idsACerrar([2, 3], [1, 2, 3]), [2, 3]);
  assert.deepEqual(idsACerrar([2, 3], [1, 3]), [3]); // el 2 lo cerró otro admin entre dos lecturas
  assert.deepEqual(idsACerrar([2], [1, 3]), []); // ya no queda nada de lo marcado
  assert.deepEqual(idsACerrar([], [1, 2]), []); // lo desmarcó todo a propósito: no vuelve a ser «todos»
  assert.deepEqual(idsACerrar([3, 1], [1, 2, 3]), [3, 1]); // conserva el orden de la selección
  assert.deepEqual(idsACerrar(null, []), []);
});
