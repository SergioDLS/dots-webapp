import { test } from "node:test";
import assert from "node:assert/strict";
import { wordImageUrl } from "./media-url.ts";

test("absolutas y rutas del frontend se devuelven tal cual", () => {
  assert.equal(wordImageUrl("https://res.cloudinary.com/x/a.png", "https://api"), "https://res.cloudinary.com/x/a.png");
  assert.equal(wordImageUrl("/images/levels/colores.png", "https://api"), "/images/levels/colores.png");
});

test("un nombre suelto es el formato legacy de words", () => {
  assert.equal(wordImageUrl("abc.png", "https://api/images"), "https://api/images/words/abc.png");
});
