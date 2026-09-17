import { test } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_AVATAR, avatarOrDefault, avatarShadow } from "./avatar.ts";

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

test("avatarShadow tiñe la sombra con el color del avatar", () => {
  // spec §6.1: el retrato flota y su color es una sombra tenue, no un marco.
  assert.equal(
    avatarShadow("#35D8F5", 78),
    "drop-shadow(0 4.7px 9.4px color-mix(in srgb, #35D8F5 45%, transparent))",
  );
});

test("avatarShadow escala con el tamaño: a 34 px no es un borrón", () => {
  assert.equal(
    avatarShadow("#FF1F8F", 34),
    "drop-shadow(0 2px 4.1px color-mix(in srgb, #FF1F8F 45%, transparent))",
  );
  assert.equal(
    avatarShadow("#FF1F8F", 96),
    "drop-shadow(0 5.8px 11.5px color-mix(in srgb, #FF1F8F 45%, transparent))",
  );
});
