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

test("caer un puesto es el único caso atribuible: saltos = 1", () => {
  const anterior = { rank: 4, weekStart: SEMANA };
  assert.equal(decidirAviso(anterior, estado({ rank: 5 })).saltos, 1);
});

test("caer varios puestos cuenta los puestos: el de arriba pudo no haberte pasado", () => {
  // Estabas 3.º, no abres la app en tres días y entran dos cuentas nuevas por
  // encima de todos: acabas 5.º y `above` es quien ya era 2.º, que llevaba
  // toda la semana por delante y no te adelantó nunca. Se le sigue nombrando
  // —va delante, eso es verdad— pero el copy no puede decir que te pasó.
  const anterior = { rank: 3, weekStart: SEMANA };
  const aviso = decidirAviso(anterior, estado({ rank: 5 }));
  assert.equal(aviso.tipo, "perdiste");
  assert.equal(aviso.saltos, 2);
  assert.equal(aviso.nombre, "Camila");
});

test("subir un puesto deja saltos en 1", () => {
  const anterior = { rank: 6, weekStart: SEMANA };
  assert.equal(decidirAviso(anterior, estado({ rank: 5 })).saltos, 1);
});

test("subir varios puestos cuenta los puestos: pudiste no haber pasado a nadie", () => {
  // El mismo agujero del revés: bloquean a cuatro cuentas que iban por delante
  // y subes cuatro puestos sin haber cruzado a nadie.
  const anterior = { rank: 9, weekStart: SEMANA };
  const aviso = decidirAviso(anterior, estado({ rank: 5 }));
  assert.equal(aviso.tipo, "ganaste");
  assert.equal(aviso.saltos, 4);
  assert.equal(aviso.nombre, "Bruno");
});

test("saltos siempre es positivo, se baje o se suba", () => {
  const bajada = decidirAviso({ rank: 2, weekStart: SEMANA }, estado({ rank: 5 }));
  const subida = decidirAviso({ rank: 40, weekStart: SEMANA }, estado({ rank: 5 }));
  assert.ok(bajada.saltos > 0, "de 2.º a 5.º son tres puestos, no menos tres");
  assert.ok(subida.saltos > 0, "de 40.º a 5.º son 35 puestos, no menos 35");
  assert.equal(bajada.saltos, 3);
  assert.equal(subida.saltos, 35);
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
  // Un backend viejo no manda `weekStart` y llega `undefined`, no `null`: el
  // guard tiene que cortar ahí a propósito, no de rebote más abajo.
  assert.equal(
    decidirAviso({ rank: 4, weekStart: SEMANA }, estado({ rank: 5, weekStart: undefined })),
    null,
  );
});

test("sin puesto en alguno de los dos lados no hay nada que comparar", () => {
  assert.equal(decidirAviso({ rank: null, weekStart: SEMANA }, estado()), null);
  assert.equal(
    decidirAviso({ rank: 4, weekStart: SEMANA }, estado({ rank: null })),
    null,
  );
  // `rank` y `weekStart` nacieron juntos: el backend viejo que no manda uno
  // tampoco manda el otro, y llega `undefined`.
  assert.equal(
    decidirAviso({ rank: 4, weekStart: SEMANA }, estado({ rank: undefined })),
    null,
  );
});

test("bajar sin vecino arriba no inventa a nadie", () => {
  const anterior = { rank: 4, weekStart: SEMANA };
  assert.equal(decidirAviso(anterior, estado({ rank: 5, above: null })), null);
});

test("subir sin vecino abajo tampoco inventa a nadie", () => {
  const anterior = { rank: 6, weekStart: SEMANA };
  assert.equal(decidirAviso(anterior, estado({ rank: 5, below: null })), null);
});

test("un vecino undefined no lanza: se trata igual que sin vecino", () => {
  // `actual` no se valida en runtime (services/engagement.service.ts hace
  // api.get<RivalData>, una aserción de tipo sin comprobación): un
  // `undefined` real es tan esperable como el `null` que promete el tipo.
  const anterior = { rank: 4, weekStart: SEMANA };
  assert.equal(decidirAviso(anterior, estado({ rank: 5, above: undefined })), null);
});

test("un nombre vacío no deja la frase coja", () => {
  const anterior = { rank: 4, weekStart: SEMANA };
  const aviso = decidirAviso(
    anterior,
    estado({ rank: 5, above: { name: "", delta: 40, gesture: null } }),
  );
  assert.equal(aviso.nombre, "Alguien");
});

test("un vecino sin name no lanza: cae a la misma ausencia", () => {
  const anterior = { rank: 4, weekStart: SEMANA };
  const aviso = decidirAviso(
    anterior,
    estado({ rank: 5, above: { delta: 40, gesture: null } }),
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

test("un delta que no es un número finito no lanza: se enseña como 0, no NaN", () => {
  const anterior = { rank: 4, weekStart: SEMANA };
  const aviso = decidirAviso(
    anterior,
    estado({ rank: 5, above: { name: "Camila", delta: undefined, gesture: null } }),
  );
  assert.equal(aviso.delta, 0);
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
