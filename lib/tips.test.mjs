import { test } from "node:test";
import assert from "node:assert/strict";
import { MAX_POR_PANTALLA, TIPS, pendientesPara } from "./tips.ts";

test("el catálogo tiene las seis pistas, sin arcade.trono", () => {
  assert.equal(TIPS.length, 6);
  const claves = TIPS.map((t) => t.key);
  assert.deepEqual(claves, [
    "camino.primer-nivel",
    "camino.racha",
    "arcade.diarios",
    "repaso.que-es",
    "retos.torneo",
    "perfil.avatar",
  ]);
  assert.equal(claves.includes("arcade.trono"), false);
});

test("ninguna pantalla pasa del máximo de dos", () => {
  const porRuta = new Map();
  for (const t of TIPS) porRuta.set(t.ruta, (porRuta.get(t.ruta) ?? 0) + 1);
  for (const [ruta, n] of porRuta) {
    assert.ok(n <= MAX_POR_PANTALLA, `${ruta} tiene ${n} pistas`);
  }
});

test("toda pista trae pose, título y frase no vacíos", () => {
  for (const t of TIPS) {
    assert.ok(t.pose.length > 0, `${t.key} sin pose`);
    assert.ok(t.titulo.length > 0, `${t.key} sin título`);
    assert.ok(t.frase.length > 0, `${t.key} sin frase`);
    assert.ok(t.ruta.startsWith("/"), `${t.key} con ruta rara`);
  }
});

test("pendientesPara devuelve las de esa ruta, en orden", () => {
  const camino = pendientesPara("/levels", []);
  assert.deepEqual(camino.map((t) => t.key), ["camino.primer-nivel", "camino.racha"]);
  assert.deepEqual(pendientesPara("/profile", []).map((t) => t.key), ["perfil.avatar"]);
});

test("pendientesPara descarta las ya vistas", () => {
  const quedan = pendientesPara("/levels", ["camino.primer-nivel"]);
  assert.deepEqual(quedan.map((t) => t.key), ["camino.racha"]);
  assert.deepEqual(pendientesPara("/levels", ["camino.primer-nivel", "camino.racha"]), []);
});

test("pendientesPara ignora claves desconocidas en lo visto", () => {
  // `tips_seen` es una lista libre en el servidor: puede traer claves viejas.
  const quedan = pendientesPara("/profile", ["arcade.trono", "lo-que-sea"]);
  assert.deepEqual(quedan.map((t) => t.key), ["perfil.avatar"]);
});

test("una ruta sin pistas devuelve lista vacía, no explota", () => {
  assert.deepEqual(pendientesPara("/shop", []), []);
  assert.deepEqual(pendientesPara("", []), []);
});

test("la ruta se compara exacta, no por prefijo", () => {
  assert.deepEqual(pendientesPara("/levels/algo", []), []);
});
