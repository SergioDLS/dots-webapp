import { test } from "node:test";
import assert from "node:assert/strict";
import { isPlaceholderPose, resolvePoseOrFallback } from "./pending.ts";

const reg = {
  feliz: { src: "/images/Doty/expressions/feliz.png" },
  orgulloso: { src: "/images/Doty/expressions/orgulloso.png" },
  "cerebro-galaxia": { src: "/images/Doty/expressions/feliz.png" },
};

test("una pose en placeholder comparte el src de feliz", () => {
  assert.equal(isPlaceholderPose(reg, "cerebro-galaxia"), true);
  assert.equal(isPlaceholderPose(reg, "orgulloso"), false);
  assert.equal(isPlaceholderPose(reg, "feliz"), false);
  assert.equal(isPlaceholderPose(reg, "no-existe"), false);
});

test("resolvePoseOrFallback devuelve el fallback solo mientras dure el placeholder", () => {
  assert.equal(resolvePoseOrFallback(reg, "cerebro-galaxia", "orgulloso"), "orgulloso");
  assert.equal(resolvePoseOrFallback(reg, "orgulloso", "feliz"), "orgulloso");
  const listo = { ...reg, "cerebro-galaxia": { src: "/images/Doty/expressions/cerebro-galaxia.png" } };
  assert.equal(resolvePoseOrFallback(listo, "cerebro-galaxia", "orgulloso"), "cerebro-galaxia");
});
