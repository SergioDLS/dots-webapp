import { test } from "node:test";
import assert from "node:assert/strict";
import {
  estadoModoAdmin,
  fijarModoAdmin,
  modoAdminDesdeAjustes,
  suscribirModoAdmin,
} from "./admin-mode.ts";

test("nace desconocido", () => {
  assert.equal(estadoModoAdmin(), "desconocido");
});

test("modoAdminDesdeAjustes: solo true explícito enciende", () => {
  assert.equal(modoAdminDesdeAjustes({ admin_mode: true }), "encendido");
  assert.equal(modoAdminDesdeAjustes({ admin_mode: false }), "apagado");
  assert.equal(modoAdminDesdeAjustes({}), "apagado");
  assert.equal(modoAdminDesdeAjustes(null), "apagado");
  assert.equal(modoAdminDesdeAjustes(undefined), "apagado");
});

test("fijar avisa a los suscritos una vez por cambio real", () => {
  let avisos = 0;
  const soltar = suscribirModoAdmin(() => {
    avisos += 1;
  });
  fijarModoAdmin("encendido");
  fijarModoAdmin("encendido");
  assert.equal(estadoModoAdmin(), "encendido");
  assert.equal(avisos, 1);
  fijarModoAdmin("apagado");
  assert.equal(avisos, 2);
  soltar();
  fijarModoAdmin("encendido");
  assert.equal(avisos, 2);
  fijarModoAdmin("desconocido");
});
