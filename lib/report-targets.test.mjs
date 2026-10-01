import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { conRespuesta, objetivoDeOracion } from "./report.ts";
import {
  leerCandidatos,
  limpiarObjetivos,
  publicarObjetivos,
  registrarRespondido,
  suscribirObjetivos,
} from "./report-targets.ts";

const a = objetivoDeOracion({ id: "1", text: "a __" }, "review");
const b = objetivoDeOracion({ id: "2", text: "b __" }, "review");

beforeEach(() => limpiarObjetivos());

test("publicar avisa una vez y repetir lo mismo no vuelve a avisar", () => {
  let avisos = 0;
  const soltar = suscribirObjetivos(() => avisos++);
  try {
    publicarObjetivos([a]);
    publicarObjetivos([{ ...a }]);
    assert.equal(avisos, 1);
    assert.deepEqual(leerCandidatos(), [a]);
  } finally {
    soltar();
  }
});

test("leerCandidatos devuelve la misma referencia mientras nada cambie", () => {
  publicarObjetivos([a]);
  assert.equal(leerCandidatos(), leerCandidatos());
});

test("lo respondido entra como anterior hasta que se limpia", () => {
  publicarObjetivos([a]);
  const aRespondida = conRespuesta(a, { answer: "x", wasWrong: true });
  registrarRespondido(aRespondida);
  publicarObjetivos([b]);
  assert.deepEqual(leerCandidatos(), [b, aRespondida]);
  limpiarObjetivos();
  assert.deepEqual(leerCandidatos(), []);
});

test("tras limpiar, publicar lo mismo otra vez lo vuelve a mostrar", () => {
  publicarObjetivos([a]);
  limpiarObjetivos();
  assert.deepEqual(leerCandidatos(), []);
  publicarObjetivos([a]);
  assert.deepEqual(leerCandidatos(), [a]);
});

test("la misma pantalla ya respondida es un cambio y avisa de nuevo", () => {
  let avisos = 0;
  const soltar = suscribirObjetivos(() => avisos++);
  try {
    publicarObjetivos([a]);
    const aRespondida = conRespuesta(a, { answer: "x", wasWrong: true });
    publicarObjetivos([aRespondida]);
    assert.equal(avisos, 2);
    assert.deepEqual(leerCandidatos(), [aRespondida]);
  } finally {
    soltar();
  }
});

test("republicar lo mismo con otros objetos no cambia la referencia", () => {
  publicarObjetivos([a]);
  const antes = leerCandidatos();
  publicarObjetivos([{ ...a }]);
  assert.equal(leerCandidatos(), antes);
});
