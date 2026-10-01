import { test } from "node:test";
import assert from "node:assert/strict";
import { resumenDeAvisos } from "./report-notice.ts";

const aviso = (over = {}) => ({
  id: 1,
  outcome: "fixed",
  note: null,
  gems: 10,
  prompt: "I __ happy today.",
  resolvedAt: "2026-10-01T10:00:00.000Z",
  ...over,
});

// Un sustituto alto sin su bajo (media pareja) es texto roto: el mismo cuidado que en lib/report.test.mjs.
const sustitutoSuelto = /[\ud800-\udbff](?![\udc00-\udfff])|(?<![\ud800-\udbff])[\udc00-\udfff]/;

test("sin avisos no hay hoja", () => {
  assert.equal(resumenDeAvisos([]), null);
});

test("uno arreglado: aplausos, título en singular y sus gemas", () => {
  const r = resumenDeAvisos([aviso()]);
  assert.equal(r.pose, "aplaudiendo");
  assert.equal(r.titulo, "¡Arreglamos lo que reportaste!");
  assert.equal(r.gemas, 10);
  assert.deepEqual(r.lineas[0], { id: 1, texto: "«I __ happy today.»", nota: null, arreglado: true });
});

test("solo descartados: Doty pensando y sin gemas", () => {
  const r = resumenDeAvisos([
    aviso({ id: 2, outcome: "dismissed", gems: 0, note: "«am» es la única que va" }),
    aviso({ id: 3, outcome: "dismissed", gems: 0, prompt: null }),
  ]);
  assert.equal(r.pose, "pensando");
  assert.equal(r.titulo, "Revisamos tus 2 reportes");
  assert.equal(r.gemas, 0);
  assert.equal(r.lineas[1].texto, "Un ejercicio");
});

test("más de tres: tres líneas y el resto se cuenta", () => {
  const r = resumenDeAvisos([1, 2, 3, 4, 5].map((id) => aviso({ id })));
  assert.equal(r.lineas.length, 3);
  assert.equal(r.extra, 2);
  assert.equal(r.titulo, "¡Arreglamos 5 cosas que reportaste!");
  assert.equal(r.gemas, 50);
});

test("un solo descartado: título en singular, sin gemas y con la nota del admin", () => {
  const r = resumenDeAvisos([aviso({ outcome: "dismissed", gems: 0, note: "Está bien así" })]);
  assert.equal(r.pose, "pensando");
  assert.equal(r.titulo, "Revisamos tu reporte");
  assert.equal(r.gemas, 0);
  assert.equal(r.extra, 0);
  assert.deepEqual(r.lineas[0], { id: 1, texto: "«I __ happy today.»", nota: "Está bien así", arreglado: false });
});

test("mezcla: el título cuenta solo lo arreglado y las gemas solo lo que pagó", () => {
  const r = resumenDeAvisos([
    aviso({ id: 1, outcome: "dismissed", gems: 0 }),
    aviso({ id: 2, outcome: "fixed", gems: 10 }),
    aviso({ id: 3, outcome: "dismissed", gems: 0 }),
  ]);
  assert.equal(r.pose, "aplaudiendo");
  assert.equal(r.titulo, "¡Arreglamos lo que reportaste!");
  assert.equal(r.gemas, 10);
  assert.deepEqual(
    r.lineas.map((l) => l.arreglado),
    [false, true, false],
  );
});

test("un enunciado largo se recorta a 60 y, si el corte cae en un emoji, no deja media pareja", () => {
  // El corte (max - 1 = 59 unidades) cae entre las dos mitades de 😀.
  const partido = resumenDeAvisos([aviso({ prompt: "a".repeat(58) + "😀" + "b".repeat(10) })]);
  const texto = partido.lineas[0].texto;
  assert.equal(sustitutoSuelto.test(texto), false);
  assert.ok(texto.endsWith("…»"));
  assert.equal(texto, `«${"a".repeat(58)}…»`);
  // Si el emoji cabe entero antes del corte, se conserva.
  const entero = resumenDeAvisos([aviso({ prompt: "a".repeat(57) + "😀" + "b".repeat(10) })]).lineas[0].texto;
  assert.equal(entero, `«${"a".repeat(57)}😀…»`);
  assert.equal(sustitutoSuelto.test(entero), false);
  // Justo en el límite no se recorta.
  const justo = "c".repeat(60);
  assert.equal(resumenDeAvisos([aviso({ prompt: justo })]).lineas[0].texto, `«${justo}»`);
});
