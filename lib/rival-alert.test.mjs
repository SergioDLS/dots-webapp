import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DURACION_MS,
  claveSnapshot,
  decidirAviso,
  parsearSnapshot,
  serializarSnapshot,
} from "./rival-alert.ts";

const SEMANA = "2026-09-14";

/** Estado del servidor con los dos vecinos puestos, para no repetirlo. */
function estado(over = {}) {
  return {
    rank: 5,
    weekStart: SEMANA,
    above: { name: "Camila", delta: 40, gesture: null },
    below: { name: "Bruno", delta: 25, gesture: null },
    ...over,
  };
}

test("la primera vez no avisa, solo guarda", () => {
  assert.equal(decidirAviso(null, estado()), null);
});

test("si no cambia el puesto no hay aviso", () => {
  const anterior = { rank: 5, weekStart: SEMANA };
  assert.equal(decidirAviso(anterior, estado({ rank: 5 })), null);
});

test("bajar de puesto avisa y nombra a quien quedó justo encima", () => {
  const anterior = { rank: 4, weekStart: SEMANA };
  const aviso = decidirAviso(anterior, estado({ rank: 5 }));
  assert.equal(aviso.tipo, "perdiste");
  assert.equal(aviso.nombre, "Camila");
  assert.equal(aviso.delta, 40);
});

test("sin gesto equipado, el rival presume con la pose fija", () => {
  const anterior = { rank: 4, weekStart: SEMANA };
  const aviso = decidirAviso(anterior, estado({ rank: 5 }));
  assert.equal(aviso.pose, "flexeando");
  assert.equal(aviso.animacion, "cheer");
});

test("con gesto equipado, se usa el gesto del rival y su pose", () => {
  const anterior = { rank: 4, weekStart: SEMANA };
  const aviso = decidirAviso(
    anterior,
    estado({ rank: 5, above: { name: "Camila", delta: 40, gesture: "wave" } }),
  );
  assert.equal(aviso.animacion, "wave");
  assert.equal(aviso.pose, "saludando");
});

test("subir de puesto avisa, nombra a quien quedó debajo y NUNCA usa su gesto", () => {
  const anterior = { rank: 6, weekStart: SEMANA };
  const aviso = decidirAviso(
    anterior,
    estado({ rank: 5, below: { name: "Bruno", delta: 25, gesture: "wave" } }),
  );
  assert.equal(aviso.tipo, "ganaste");
  assert.equal(aviso.nombre, "Bruno");
  assert.equal(aviso.pose, "aplaudiendo");
  assert.equal(aviso.animacion, "cheer", "el gesto es el premio de ganar, no de perder");
});

test("si cambió la semana no se compara: el ranking se reinicia y barajaría los puestos", () => {
  const anterior = { rank: 4, weekStart: "2026-09-07" };
  assert.equal(decidirAviso(anterior, estado({ rank: 5 })), null);
});

test("semana desconocida en cualquiera de los dos lados tampoco compara", () => {
  assert.equal(decidirAviso({ rank: 4, weekStart: null }, estado({ rank: 5 })), null);
  assert.equal(
    decidirAviso({ rank: 4, weekStart: SEMANA }, estado({ rank: 5, weekStart: null })),
    null,
  );
});

test("sin puesto en alguno de los dos lados no hay nada que comparar", () => {
  assert.equal(decidirAviso({ rank: null, weekStart: SEMANA }, estado()), null);
  assert.equal(
    decidirAviso({ rank: 4, weekStart: SEMANA }, estado({ rank: null })),
    null,
  );
});

test("bajar sin vecino arriba no inventa a nadie", () => {
  const anterior = { rank: 4, weekStart: SEMANA };
  assert.equal(decidirAviso(anterior, estado({ rank: 5, above: null })), null);
});

test("un nombre vacío no deja la frase coja", () => {
  const anterior = { rank: 4, weekStart: SEMANA };
  const aviso = decidirAviso(
    anterior,
    estado({ rank: 5, above: { name: "", delta: 40, gesture: null } }),
  );
  assert.equal(aviso.nombre, "Alguien");
});

test("el delta siempre se enseña en positivo", () => {
  const anterior = { rank: 4, weekStart: SEMANA };
  const aviso = decidirAviso(
    anterior,
    estado({ rank: 5, above: { name: "Camila", delta: -40, gesture: null } }),
  );
  assert.equal(aviso.delta, 40);
});

test("una animación que Doty no sabe hacer cae en la pose fija, no en una pose inventada", () => {
  const anterior = { rank: 4, weekStart: SEMANA };
  const aviso = decidirAviso(
    anterior,
    estado({ rank: 5, above: { name: "Camila", delta: 40, gesture: "breakdance" } }),
  );
  assert.equal(aviso.pose, "flexeando");
  assert.equal(aviso.animacion, "cheer");
});

test("el snapshot viejo (solo rank) se lee sin romperse y se trata como semana desconocida", () => {
  const snap = parsearSnapshot('{"rank":7}');
  assert.deepEqual(snap, { rank: 7, weekStart: null });
});

test("un snapshot ilegible o ausente es como no tener ninguno", () => {
  assert.equal(parsearSnapshot(null), null);
  assert.equal(parsearSnapshot("no soy json"), null);
});

test("un JSON válido que no es un objeto plano tampoco cuenta como snapshot", () => {
  // typeof null === "object" y typeof [] === "object": sin un descarte
  // explícito de cada uno, cualquiera de los dos se colaría como snapshot
  // con los campos en null en vez de tratarse como "no hay snapshot".
  assert.equal(parsearSnapshot("3"), null);
  assert.equal(parsearSnapshot("null"), null);
  assert.equal(parsearSnapshot("[1,2]"), null);
});

test("lo que se serializa se vuelve a leer igual", () => {
  const snap = { rank: 3, weekStart: SEMANA };
  assert.deepEqual(parsearSnapshot(serializarSnapshot(snap)), snap);
});

test("la clave del snapshot es la que ya usaban los navegadores", () => {
  assert.equal(claveSnapshot(42), "dots.rival.rank.42");
});

test("la tarjeta dura más que el gesto más largo", () => {
  assert.ok(DURACION_MS >= 3000);
});
