import { test } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_AVATAR, avatarOrDefault, discBackground, ringWidth } from "./avatar.ts";

test("DEFAULT_AVATAR es el clasico en rosa de marca", () => {
  assert.deepEqual(DEFAULT_AVATAR, { img: "/images/avatars/clasico.png", color: "#FF1F8F" });
});

test("avatarOrDefault deja pasar un avatar válido", () => {
  const a = { img: "/images/avatars/nerd.png", color: "#35D8F5" };
  assert.deepEqual(avatarOrDefault(a), a);
});

test("avatarOrDefault cae al clasico con null, undefined o basura", () => {
  assert.deepEqual(avatarOrDefault(null), DEFAULT_AVATAR);
  assert.deepEqual(avatarOrDefault(undefined), DEFAULT_AVATAR);
  assert.deepEqual(avatarOrDefault({ img: "", color: "#fff" }), DEFAULT_AVATAR);
  assert.deepEqual(avatarOrDefault({ color: "#fff" }), DEFAULT_AVATAR);
});

test("discBackground mezcla el color del avatar al 42 % sobre la superficie", () => {
  // spec §6.1: el disco es color-mix(meta.color 42 %, surface)
  assert.equal(discBackground("#35D8F5"), "color-mix(in srgb, #35D8F5 42%, var(--surface))");
});

test("ringWidth da 3 px a 128 y 2 px a 34, que son los dos anclajes del spec", () => {
  assert.equal(ringWidth(128), 3);
  assert.equal(ringWidth(34), 2);
});

test("ringWidth interpola entre los dos anclajes y no se sale de ellos", () => {
  const w96 = ringWidth(96);
  assert.ok(w96 > 2 && w96 <= 3, `esperaba entre 2 y 3, dio ${w96}`);
  assert.equal(ringWidth(200), 3);
  assert.equal(ringWidth(16), 2);
});
