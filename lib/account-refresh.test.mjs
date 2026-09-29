import { test } from "node:test";
import assert from "node:assert/strict";
import { bumpCuenta, suscribirCuenta, versionCuenta } from "./account-refresh.ts";

test("empieza en 0 y sube de uno en uno", () => {
  const inicial = versionCuenta();
  bumpCuenta();
  assert.equal(versionCuenta(), inicial + 1);
});

test("cada bump avisa a los suscritos; soltar deja de avisar", () => {
  let avisos = 0;
  const soltar = suscribirCuenta(() => {
    avisos += 1;
  });
  bumpCuenta();
  bumpCuenta();
  assert.equal(avisos, 2);
  soltar();
  bumpCuenta();
  assert.equal(avisos, 2);
});
