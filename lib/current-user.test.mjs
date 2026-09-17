import { test } from "node:test";
import assert from "node:assert/strict";
import { parseStoredUser, readStoredUser, readCurrentUserId } from "./current-user.ts";

test("parseStoredUser lee un JSON válido con todos los campos", () => {
  const raw = JSON.stringify({ id: 7, name: "Sofía", last_name: "Gómez", profile: 1 });
  assert.deepEqual(parseStoredUser(raw), {
    id: 7,
    name: "Sofía",
    last_name: "Gómez",
    profile: 1,
  });
});

test("parseStoredUser da {} cuando no hay clave (localStorage.getItem devuelve null)", () => {
  assert.deepEqual(parseStoredUser(null), {});
  assert.deepEqual(parseStoredUser(undefined), {});
  assert.deepEqual(parseStoredUser(""), {});
});

test("parseStoredUser da {} ante JSON corrupto", () => {
  assert.deepEqual(parseStoredUser("{not json"), {});
  assert.deepEqual(parseStoredUser("{\"id\":"), {});
});

test('parseStoredUser da {} ante el string "null"', () => {
  assert.deepEqual(parseStoredUser("null"), {});
});

test("parseStoredUser da {} ante un JSON que no es un objeto (array o número)", () => {
  assert.deepEqual(parseStoredUser("[]"), {});
  assert.deepEqual(parseStoredUser("3"), {});
  assert.deepEqual(parseStoredUser('"un string"'), {});
});

test("readStoredUser da {} sin window (SSR) en vez de reventar", () => {
  assert.equal(typeof window, "undefined");
  assert.deepEqual(readStoredUser(), {});
});

test("readCurrentUserId da null sin window (SSR)", () => {
  assert.equal(typeof window, "undefined");
  assert.equal(readCurrentUserId(), null);
});

test("readCurrentUserId lee el id guardado y descarta uno que no sea number", () => {
  // node:test no trae window/localStorage: se simula lo mínimo y se limpia
  // después para no filtrar estado a los demás tests de este archivo.
  const fakeStorage = (value) => ({
    getItem: (key) => (key === "user" ? value : null),
  });
  globalThis.window = { localStorage: fakeStorage(JSON.stringify({ id: 42 })) };
  try {
    assert.equal(readCurrentUserId(), 42);
    globalThis.window = { localStorage: fakeStorage(JSON.stringify({ id: "42" })) };
    assert.equal(readCurrentUserId(), null);
    globalThis.window = { localStorage: fakeStorage(JSON.stringify({ name: "Sin id" })) };
    assert.equal(readCurrentUserId(), null);
  } finally {
    delete globalThis.window;
  }
});
