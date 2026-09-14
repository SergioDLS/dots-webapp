import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { renderCss, renderThemeColors, validateThemes } from "./render.mjs";

const themes = JSON.parse(readFileSync(new URL("../../design/themes.json", import.meta.url), "utf8"));

test("validateThemes acepta el JSON real", () => {
  assert.doesNotThrow(() => validateThemes(themes));
});

test("validateThemes rechaza una paleta con claves distintas a rosa", () => {
  const bad = structuredClone(themes);
  delete bad.palettes.electrico.light["--muted"];
  assert.throws(() => validateThemes(bad), /electrico\.light.*--muted/);
});

test("validateThemes exige --background en cada modo de cada paleta", () => {
  const bad = structuredClone(themes);
  delete bad.palettes.rosa.dark["--background"];
  delete bad.palettes.electrico.dark["--background"];
  assert.throws(() => validateThemes(bad), /--background/);
});

test("renderCss: rosa es la paleta por defecto cuando no hay data-palette", () => {
  const css = renderCss(themes);
  assert.match(css, /:root:not\(\[data-palette\]\),\s*:root\[data-palette="rosa"\]\s*\{[^}]*--accent: #e5077e;/);
});

test("renderCss: cada paleta tiene bloque oscuro explícito y fallback de media query", () => {
  const css = renderCss(themes);
  assert.match(css, /:root\[data-palette="electrico"\]\[data-theme="dark"\]\s*\{[^}]*--accent: #5c86ff;/);
  assert.match(css, /@media \(prefers-color-scheme: dark\)\s*\{\s*:root:not\(\[data-palette\]\):not\(\[data-theme\]\),\s*:root\[data-palette="rosa"\]:not\(\[data-theme\]\)\s*\{[^}]*--background: #14122e;/);
  assert.match(css, /:root\[data-theme="light"\]\s*\{\s*color-scheme: light;\s*\}/);
});

test("renderCss: los tokens compartidos por modo salen en las dos paletas", () => {
  const css = renderCss(themes);
  const gemDark = css.match(/--gem: #35d0e2;/g) ?? [];
  // rosa oscuro explícito + rosa fallback + electrico oscuro explícito + electrico fallback
  assert.equal(gemDark.length, 4);
});

test("renderCss lleva la marca de generado", () => {
  assert.match(renderCss(themes), /^\/\* GENERADO por scripts\/themes\/build\.mjs/);
});

test("renderThemeColors emite el mapa paleta → modo → --background", () => {
  const ts = renderThemeColors(themes);
  assert.match(ts, /export const PALETTES = \["rosa", "electrico"\] as const;/);
  assert.match(ts, /rosa: \{ light: "#fff7fb", dark: "#14122e" \}/);
  assert.match(ts, /electrico: \{ light: "#f4f7ff", dark: "#0d1330" \}/);
  assert.match(ts, /export const PALETTE_LABELS: Record<Palette, string> = \{ rosa: "Rosa", electrico: "Eléctrico" \};/);
});
