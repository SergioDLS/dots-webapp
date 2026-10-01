import { test } from "node:test";
import assert from "node:assert/strict";
import {
  VIGENCIA_MS,
  fijarConteo,
  leerConteo,
  refrescarConteoReportes,
  sigueVigente,
  suscribirConteo,
  totalPendientes,
  versionConteo,
} from "./report-counts.ts";

test("fijar avisa y leer devuelve lo último", () => {
  let avisos = 0;
  const soltar = suscribirConteo(() => avisos++);
  fijarConteo({ content: 2, bugs: 1 });
  assert.deepEqual(leerConteo(), { content: 2, bugs: 1 });
  assert.equal(avisos, 1);
  soltar();
});

test("refrescar sube la versión", () => {
  const antes = versionConteo();
  refrescarConteoReportes();
  assert.equal(versionConteo(), antes + 1);
});

test("total de pendientes", () => {
  assert.equal(totalPendientes({ content: 2, bugs: 3 }), 5);
  assert.equal(totalPendientes(null), 0);
});

// --- Vigencia de la petición ya hecha (una app abierta horas no se queda con el primer conteo) ---

const PEDIDO = { version: 3, at: 1_000_000 };

test("la vigencia son 2 minutos", () => {
  assert.equal(VIGENCIA_MS, 2 * 60_000);
});

test("una petición de la misma versión se reutiliza mientras tenga menos de 2 minutos", () => {
  assert.equal(sigueVigente(PEDIDO, 3, PEDIDO.at), true); // recién hecha: la comparten los que montan a la vez
  assert.equal(sigueVigente(PEDIDO, 3, PEDIDO.at + 60_000), true);
  assert.equal(sigueVigente(PEDIDO, 3, PEDIDO.at + VIGENCIA_MS - 1), true);
});

test("a los 2 minutos justos, y más tarde, ya no vale", () => {
  assert.equal(sigueVigente(PEDIDO, 3, PEDIDO.at + VIGENCIA_MS), false);
  assert.equal(sigueVigente(PEDIDO, 3, PEDIDO.at + 3 * 60 * 60_000), false); // PWA abierta horas
});

test("otra versión invalida la petición aunque sea de hace un instante", () => {
  assert.equal(sigueVigente(PEDIDO, 4, PEDIDO.at), false); // se cerró algo: hay que volver a preguntar
  assert.equal(sigueVigente(PEDIDO, 2, PEDIDO.at), false);
});

test("sin petición previa no hay nada vigente", () => {
  assert.equal(sigueVigente(null, 0, 0), false);
});

test("un reloj que retrocede no deja el conteo pegado", () => {
  assert.equal(sigueVigente(PEDIDO, 3, PEDIDO.at - 1), false);
});
