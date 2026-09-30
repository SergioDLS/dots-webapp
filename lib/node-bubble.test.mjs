import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  ART_BOX, BUBBLE_H, BUBBLE_TOP, COL, DOTY_PEEK_W, MS_OPEN_TOP, NODE_ROW_H, SIDE_X, SLOT_W,
  WIDE_MIN_TRACK, WIDE_W, bubbleGeometry, bubbleVars, evalLin, sideOf, toCss,
} from "./node-bubble.ts";

const SIDES = ["left", "center", "right"];
const NARROW = [288, 343, 400, WIDE_MIN_TRACK - 1];
const WIDE = [WIDE_MIN_TRACK, 628, 640];
const near = (a, b, msg) => assert.ok(Math.abs(a - b) < 1e-9, `${msg}: ${a} ≠ ${b}`);

/** Todo en coordenadas de la pista, para comparar con sus bordes. */
function enPista(side, mode, W) {
  const g = bubbleGeometry(side, mode);
  const slot = (SIDE_X[side] * W) / 100 - SLOT_W / 2;
  const bl = slot + evalLin(g.bubbleLeft, W);
  const bw = evalLin(g.bubbleWidth, W);
  const art = slot + (SLOT_W - ART_BOX) / 2 + evalLin(g.artX, W);
  return { g, slot, bl, br: bl + bw, bw, art, ms: slot + evalLin(g.msLeft, W), doty: slot + evalLin(g.dotyLeft, W) };
}

test("el alto de fila y la burbuja expandida miden lo mismo por abajo", () => {
  assert.equal(NODE_ROW_H, 188);
  assert.equal(BUBBLE_TOP + BUBBLE_H, NODE_ROW_H);
});

test("la columna cabe en la burbuja y los hitos caen en su hueco", () => {
  const fin = COL.top + COL.typeH + COL.titleGap + COL.titleH + COL.msGap + COL.msH + COL.ctaGap + COL.ctaH;
  assert.ok(fin <= BUBBLE_H, `la columna mide ${fin}`);
  assert.equal(MS_OPEN_TOP - BUBBLE_TOP, COL.top + COL.typeH + COL.titleGap + COL.titleH + COL.msGap);
});

test("sideOf sigue la regla 35/65 del zigzag", () => {
  assert.equal(sideOf(15), "left");
  assert.equal(sideOf(50), "center");
  assert.equal(sideOf(85), "right");
});

test("estrecha: la burbuja es exactamente la pista", () => {
  for (const side of SIDES) for (const W of NARROW) {
    const p = enPista(side, "narrow", W);
    near(p.bl, 0, `${side}@${W} borde izq`);
    near(p.bw, W, `${side}@${W} ancho`);
  }
});

test("ancha: 440 px, dentro de la pista y anclada a su lado", () => {
  for (const side of SIDES) for (const W of WIDE) {
    const p = enPista(side, "wide", W);
    near(p.bw, WIDE_W, `${side}@${W} ancho`);
    assert.ok(p.bl >= 0 && p.br <= W, `${side}@${W} se sale: ${p.bl}..${p.br}`);
    if (side === "left") near(p.bl, p.slot, `${side}@${W} anclada a la izq del slot`);
    if (side === "right") near(p.br, p.slot + SLOT_W, `${side}@${W} anclada a la der del slot`);
    if (side === "center") near(p.bl + p.bw / 2, p.slot + SLOT_W / 2, `${side}@${W} centrada`);
  }
});

test("la imagen queda a 12 px del borde de su lado", () => {
  for (const mode of ["narrow", "wide"]) for (const side of SIDES) for (const W of mode === "narrow" ? NARROW : WIDE) {
    const p = enPista(side, mode, W);
    if (side === "right") near(p.art + ART_BOX, p.br - 12, `${side}/${mode}@${W}`);
    else near(p.art, p.bl + 12, `${side}/${mode}@${W}`);
  }
});

test("hitos y columna: mismo borde y mismo ancho, dentro de la burbuja", () => {
  for (const mode of ["narrow", "wide"]) for (const side of SIDES) for (const W of mode === "narrow" ? NARROW : WIDE) {
    const p = enPista(side, mode, W);
    near(p.ms, p.bl + p.g.colLeft, `${side}/${mode}@${W} borde`);
    near(evalLin(p.g.msWidth, W), evalLin(p.g.colWidth, W), `${side}/${mode}@${W} ancho`);
    near(evalLin(p.g.colWidth, W), p.bw - 176, `${side}/${mode}@${W} ancho de columna`);
    assert.ok(p.ms + evalLin(p.g.msWidth, W) <= p.br, `${side}/${mode}@${W} se sale`);
  }
});

test("Doty asomado cabe sobre la burbuja, lejos de la imagen", () => {
  for (const mode of ["narrow", "wide"]) for (const side of SIDES) for (const W of mode === "narrow" ? NARROW : WIDE) {
    const p = enPista(side, mode, W);
    assert.ok(p.doty >= p.bl && p.doty + DOTY_PEEK_W <= p.br, `${side}/${mode}@${W}`);
    if (side === "right") near(p.doty, p.bl + 16, `${side}/${mode}@${W}`);
    else near(p.doty + DOTY_PEEK_W, p.br - 16, `${side}/${mode}@${W}`);
  }
});

test("toCss escribe CSS válido y corto", () => {
  assert.equal(toCss({ px: 80, cqw: 0 }), "80px");
  assert.equal(toCss({ px: 0, cqw: 100 }), "100cqw");
  assert.equal(toCss({ px: 80, cqw: -15 }), "calc(80px - 15cqw)");
  assert.equal(toCss({ px: -80, cqw: 15 }), "calc(-80px + 15cqw)");
});

test.todo("bubbleVars trae todas las variables que lee globals.css", () => {
  const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
  const leidas = new Set([...css.matchAll(/var\((--nb-[a-z-]+)\)/g)].map((m) => m[1]));
  assert.ok(leidas.size > 0, "globals.css no lee ninguna --nb-*");
  for (const side of SIDES) {
    const vars = bubbleVars(side);
    for (const v of leidas) assert.ok(v in vars, `${side}: falta ${v}`);
  }
});

test.todo("el umbral de la container query es WIDE_MIN_TRACK", () => {
  const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
  assert.match(css, new RegExp(`@container \\(min-width: ${WIDE_MIN_TRACK}px\\)`));
});
