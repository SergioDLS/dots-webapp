import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeAvatarMirror } from "./avatar-mirror.ts";

const BUENO = { img: "/images/avatars/cientifica.png", color: "#9C84DC" };

test("lee un espejo bien formado", () => {
  assert.deepEqual(normalizeAvatarMirror(JSON.stringify(BUENO)), BUENO);
});

test("sin espejo devuelve null, no el clasico", () => {
  // El consumidor ya cae al clasico; distinguirlo permite que el servidor mande
  // sin discutir cuando este dispositivo todavia no sabe nada.
  for (const vacio of [null, undefined, ""]) {
    assert.equal(normalizeAvatarMirror(vacio), null);
  }
});

test("un JSON roto no revienta", () => {
  assert.equal(normalizeAvatarMirror("{no soy json"), null);
  assert.equal(normalizeAvatarMirror("[]"), null);
  assert.equal(normalizeAvatarMirror("null"), null);
  assert.equal(normalizeAvatarMirror('"clasico"'), null);
});

test("rechaza una img que no sea de la carpeta de avatares", () => {
  // Acaba en el `src` de un <img>: un storage manipulado no puede convertirse
  // en una peticion a otro origen.
  for (const img of [
    "https://malo.example/x.png",
    "//malo.example/x.png",
    "/images/Doty/poses/feliz.png",
    "../../etc/passwd",
  ]) {
    assert.equal(normalizeAvatarMirror(JSON.stringify({ ...BUENO, img })), null, img);
  }
});

test("rechaza un color que no sea hex de seis digitos", () => {
  // Va a parar a un `color-mix` de CSS.
  for (const color of ["red", "#FFF", "#9C84DCC", "", "javascript:alert(1)"]) {
    assert.equal(normalizeAvatarMirror(JSON.stringify({ ...BUENO, color })), null, color);
  }
});

test("exige los dos campos", () => {
  assert.equal(normalizeAvatarMirror(JSON.stringify({ img: BUENO.img })), null);
  assert.equal(normalizeAvatarMirror(JSON.stringify({ color: BUENO.color })), null);
});

test("descarta lo que sobre en vez de arrastrarlo", () => {
  const conBasura = JSON.stringify({ ...BUENO, onerror: "alert(1)", extra: 1 });
  assert.deepEqual(normalizeAvatarMirror(conBasura), BUENO);
});
