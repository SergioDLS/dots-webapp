import { test } from "node:test";
import assert from "node:assert/strict";
import {
  candidatosDeReporte,
  conRespuesta,
  cuerpoDelReporte,
  detalleMotivo,
  esperadaDePractica,
  etiquetaMotivo,
  motivosPara,
  objetivo,
  objetivoDeLectura,
  objetivoDeOracion,
  objetivoDePractica,
  objetivoDePregunta,
  objetivoDeTarjeta,
  objetivoGeneral,
  ordenarParaJuego,
  recortarFoto,
  validarBorrador,
} from "./report.ts";

const oracion = (over = {}) =>
  objetivoDeOracion({ id: "12", text: "I __ happy.", options: ["am", "feel"] }, "review", over);

test("la clave es tipo:id, o superficie:prompt si no hay ejercicio", () => {
  assert.equal(oracion().key, "sentence:12");
  assert.equal(objetivoGeneral("game:dotaxi", "El juego en general").key, "game:dotaxi:El juego en general");
});

test("sentences.id llega como string y se queda como string", () => {
  const t = objetivoDeOracion({ id: 1234567890123, text: "x __" }, "checkpoint");
  assert.equal(t.id, "1234567890123");
});

test("sin id no hay tipo: un juego viejo sin ids solo ofrece bug y otra cosa", () => {
  const t = objetivo({ type: "vocab_item", id: null, surface: "game:word-tower", snapshot: { prompt: "dog" } });
  assert.equal(t.type, null);
  assert.deepEqual(motivosPara(t), ["bug", "other"]);
});

test("candidatos: lo respondido manda; si no, se añade el anterior", () => {
  const a = oracion();
  const b = objetivoDeOracion({ id: "30", text: "She __ tired." }, "review");
  const bRespondida = conRespuesta(b, { answer: "is", expected: "feels", wasWrong: true });
  assert.deepEqual(candidatosDeReporte([a], null), [a]);
  assert.deepEqual(candidatosDeReporte([a], bRespondida), [a, bRespondida]);
  const aRespondida = conRespuesta(a, { answer: "am", wasWrong: false });
  assert.deepEqual(candidatosDeReporte([aRespondida], bRespondida), [aRespondida]);
  // Re-encolado: el anterior respondido sustituye a su gemelo sin responder.
  assert.deepEqual(candidatosDeReporte([b], bRespondida), [bRespondida]);
});

test("motivos según el ejercicio", () => {
  assert.deepEqual(motivosPara(objetivoGeneral("app", "x")), ["bug", "other"]);
  assert.deepEqual(motivosPara(oracion()), ["typo", "meaning", "bug", "other"]);
  const fallada = conRespuesta(oracion({ hasAudio: true }), { answer: "feel", expected: "am", wasWrong: true });
  assert.deepEqual(motivosPara(fallada), ["answer", "typo", "meaning", "audio", "bug", "other"]);
  // wasWrong null (checkpoint): nunca «debería estar bien».
  const examen = conRespuesta(oracion(), { answer: "feel", wasWrong: null });
  assert.equal(motivosPara(examen).includes("answer"), false);
  // Una palabra con imagen no tiene «no se entiende».
  const palabra = objetivo({ type: "word", id: 3, surface: "game:memory", snapshot: { prompt: "cat", image: "cat.png" } });
  assert.deepEqual(motivosPara(palabra), ["typo", "image", "bug", "other"]);
});

test("etiquetas y detalle", () => {
  assert.equal(etiquetaMotivo("meaning", oracion()), "La oración no se entiende");
  const vocab = objetivo({ type: "vocab_item", id: 1, surface: "lesson-vocab", snapshot: { prompt: "big" } });
  assert.equal(etiquetaMotivo("meaning", vocab), "La traducción no cuadra");
  const pregunta = objetivoDePregunta({ id: 4, title: "Mi casa" }, { idx: 2, prompt: "The __ is red.", options: ["house"] });
  assert.equal(etiquetaMotivo("meaning", pregunta), "La pregunta no se entiende");
  const fallada = conRespuesta(oracion(), { answer: "feel", expected: "am", wasWrong: true });
  assert.equal(detalleMotivo("answer", fallada), "Elegiste «feel» · esperábamos «am»");
  assert.equal(detalleMotivo("typo", fallada), null);
});

test("validación del borrador", () => {
  assert.equal(validarBorrador({ motivos: [], comentario: "" }), "Marca al menos un motivo");
  assert.match(validarBorrador({ motivos: ["other"], comentario: "  " }), /Otra cosa/);
  assert.equal(validarBorrador({ motivos: ["typo"], comentario: "" }), null);
});

test("el cuerpo ordena motivos, recorta y une el contexto", () => {
  const t = conRespuesta(oracion({ context: { levelId: "5" } }), { answer: "feel", expected: "am", wasWrong: true });
  const cuerpo = cuerpoDelReporte(t, { motivos: ["other", "answer"], comentario: "  ojo  " }, { route: "/review" });
  assert.deepEqual(cuerpo.reasons, ["answer", "other"]);
  assert.equal(cuerpo.comment, "ojo");
  assert.equal(cuerpo.targetType, "sentence");
  assert.equal(cuerpo.targetId, "12");
  assert.equal(cuerpo.wasWrong, true);
  assert.deepEqual(cuerpo.context, { levelId: "5", route: "/review" });
  const general = cuerpoDelReporte(objetivoGeneral("app", "Reportar"), { motivos: ["bug"], comentario: "", lugar: "tienda" }, {});
  assert.equal(general.targetType, undefined);
  assert.equal(general.targetId, undefined);
  assert.equal(general.context.lugar, "tienda");
});

test("la foto recortada nunca pasa de 4 KB", () => {
  const enorme = recortarFoto({
    prompt: "x".repeat(5000),
    options: Array.from({ length: 30 }, () => "y".repeat(500)),
    image: "i".repeat(900),
    audio: "a".repeat(900),
    meaning: "m".repeat(900),
  });
  assert.ok(JSON.stringify(enorme).length <= 4096);
});

// Un sustituto alto sin su bajo (media pareja) lo rechaza el cast a jsonb del servidor: 500 en TODOS los reportes de ese ítem.
const sustitutoSuelto = /[\ud800-\udbff](?![\udc00-\udfff])|(?<![\ud800-\udbff])[\udc00-\udfff]/;

test("recortar nunca deja media pareja de sustitutos al cortar por un emoji", () => {
  // El corte (max - 1 = 999 unidades) cae entre las dos mitades de 😀.
  const p = recortarFoto({ prompt: "a".repeat(998) + "😀" + "b".repeat(10) }).prompt;
  assert.equal(sustitutoSuelto.test(p), false);
  assert.ok(p.endsWith("…"));
  assert.equal(p, "a".repeat(998) + "…");
  // Si el emoji cabe entero antes del corte, se conserva.
  const entero = recortarFoto({ prompt: "a".repeat(997) + "😀" + "b".repeat(10) }).prompt;
  assert.equal(entero, "a".repeat(997) + "😀" + "…");
  assert.equal(sustitutoSuelto.test(entero), false);
  // Mismo cuidado en lo que se envía como answer/expected (300) y en las opciones (150).
  const t = conRespuesta(oracion(), { answer: "x".repeat(298) + "😀😀", expected: "y".repeat(298) + "😀😀", wasWrong: true });
  const cuerpo = cuerpoDelReporte(t, { motivos: ["answer"], comentario: "" }, {});
  assert.equal(sustitutoSuelto.test(cuerpo.answer), false);
  assert.equal(sustitutoSuelto.test(cuerpo.expected), false);
  assert.ok(cuerpo.answer.length <= 300 && cuerpo.expected.length <= 300);
  const op = recortarFoto({ prompt: "p", options: ["z".repeat(148) + "😀😀"] }).options[0];
  assert.equal(sustitutoSuelto.test(op), false);
  assert.ok(op.length <= 150);
});

test("práctica: modos, imagen y esperada", () => {
  const s = { id: "7", text: "I __ happy.", img: "img.png", sentence_extension: "mp3", options: [{ word: "am", correct: true }, { word: "is", correct: false }] };
  const witch = objetivoDePractica(s, "witchIs", 5);
  assert.equal(witch.snapshot.prompt, "Which is: am?");
  assert.equal(witch.hasImage, true);
  assert.equal(objetivoDePractica(s, "complete", 5).hasImage, false);
  assert.equal(objetivoDePractica(s, "buildUp", 5).snapshot.options, undefined);
  assert.equal(esperadaDePractica(s, "complete"), "am");
  assert.equal(esperadaDePractica({ ...s, text: "I am happy" }, "buildUp"), "I am happy");
});

test("práctica: la imagen real viaja en la foto de «Which is» y de «What is this?», no en los demás modos", () => {
  // Solo esos dos modos enseñan la imagen de la oración (buildUp y los de escucha traen un placeholder; «complete» no la pinta).
  const s = { id: "7", text: "I see a balloon", img: "balloon.png", sentence_extension: "mp3", options: [{ word: "balloon", correct: true }, { word: "bomb", correct: false }] };
  assert.equal(objetivoDePractica(s, "witchIs", 5).snapshot.image, "balloon.png");
  assert.equal(objetivoDePractica(s, "guessImg", 5).snapshot.image, "balloon.png");
  for (const modo of ["complete", "buildUp", "whatDoYouHear", "whatDoYouHearSentence"]) {
    assert.equal(objetivoDePractica(s, modo, 5).snapshot.image, undefined, modo);
  }
  // Sin imagen en la oración no se inventa una clave vacía.
  const sinImg = { ...s, img: undefined };
  assert.equal("image" in objetivoDePractica(sinImg, "witchIs", 5).snapshot, false);
  assert.equal("image" in objetivoDePractica({ ...s, img: "" }, "witchIs", 5).snapshot, false);
  // hasImage no cambia: sigue siendo true en esos dos modos.
  assert.equal(objetivoDePractica(s, "witchIs", 5).hasImage, true);
});

test("tarjetas: las trampas con id negativo son false_friend", () => {
  assert.equal(objetivoDeTarjeta({ id: -3, en: "actually", es: "actualmente" }, "game:true-false").type, "false_friend");
  assert.equal(objetivoDeTarjeta({ id: 9, en: "big", es: "grande" }, "game:true-false").type, "vocab_item");
});

test("lectura y preguntas tienen claves distintas pero el mismo objetivo", () => {
  const r = { id: 4, title: "Mi casa", text: "My house is red." };
  const lectura = objetivoDeLectura(r);
  const pregunta = objetivoDePregunta(r, { idx: 0, prompt: "My __ is red.", options: ["house"] });
  assert.notEqual(lectura.key, pregunta.key);
  assert.equal(pregunta.type, "reading");
  assert.equal(pregunta.id, "4");
  assert.equal(pregunta.context.idx, 0);
});

test("juego: sin repetir, la fallada gana y va primero", () => {
  const a = oracion();
  const aBien = conRespuesta(a, { answer: "am", wasWrong: false });
  const aMal = conRespuesta(a, { answer: "feel", wasWrong: true });
  const b = objetivoDeOracion({ id: "30", text: "y __" }, "game:dotaxi");
  const lista = ordenarParaJuego([b, aBien, aMal]);
  assert.deepEqual(lista.map((t) => t.key), ["sentence:12", "sentence:30"]);
  assert.equal(lista[0].wasWrong, true);
});

test("robustez: prompt null/undefined no lanza, da ''", () => {
  const tNull = objetivo({ type: "sentence", id: 1, surface: "review", snapshot: { prompt: null } });
  assert.equal(tNull.snapshot.prompt, "");
  const tUndef = objetivo({ type: "sentence", id: 1, surface: "review", snapshot: { prompt: undefined } });
  assert.equal(tUndef.snapshot.prompt, "");
});

test("robustez: ids inválidos se tratan como sin id", () => {
  const t1 = objetivo({ type: "sentence", id: "", surface: "review", snapshot: { prompt: "x" } });
  assert.equal(t1.id, null);
  assert.equal(t1.type, null);
  const t2 = objetivo({ type: "sentence", id: "NaN", surface: "review", snapshot: { prompt: "x" } });
  assert.equal(t2.id, null);
  assert.equal(t2.type, null);
  const t3 = objetivo({ type: "sentence", id: "abc", surface: "review", snapshot: { prompt: "x" } });
  assert.equal(t3.id, null);
  assert.equal(t3.type, null);
  // Negativo funciona (false_friend).
  const t4 = objetivo({ type: "false_friend", id: -3, surface: "game:true-false", snapshot: { prompt: "x" } });
  assert.equal(t4.id, "-3");
  assert.equal(t4.type, "false_friend");
});

test("cuerpo: solo envía motivos que aplican al target", () => {
  // Un target sin tipo (general) solo puede reportar bug y other.
  const general = objetivoGeneral("app", "Reportar");
  const cuerpo = cuerpoDelReporte(general, { motivos: ["typo", "bug"], comentario: "" }, {});
  assert.deepEqual(cuerpo.reasons, ["bug"]);
});
