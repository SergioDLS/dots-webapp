import { test } from "node:test";
import assert from "node:assert/strict";
import { crearRastro } from "./error-trail.ts";

test("guarda los últimos N, recorta y descarta vacíos", () => {
  const r = crearRastro(2);
  r.anotar({ mensaje: "" });
  r.anotar({ mensaje: "uno" }, new Date("2026-10-01T10:00:00Z"));
  r.anotar({ mensaje: "dos" });
  r.anotar({ mensaje: "x".repeat(400), origen: "y".repeat(400) });
  const lista = r.leer();
  assert.equal(lista.length, 2);
  assert.equal(lista[0].mensaje, "dos");
  assert.equal(lista[1].mensaje.length, 200);
  assert.equal(lista[1].origen.length, 150);
});

test("leer devuelve una copia", () => {
  const r = crearRastro();
  r.anotar({ mensaje: "a" });
  r.leer().pop();
  assert.equal(r.leer().length, 1);
});
