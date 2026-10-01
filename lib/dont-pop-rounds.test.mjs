import { test } from "node:test";
import assert from "node:assert/strict";
import { OPTIONS_PER_ROUND, buildRound } from "../app/(app)/games/dont-pop/rounds.ts";
import { normalizarPalabra } from "./accepted-answers.ts";

// ── Utilidades de la prueba ──────────────────────────────────────────────────

/** El mismo PRNG que usa la página para derivar las rondas del seed. */
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const TITULOS = ["cat", "dog", "kitten", "bird", "fish", "horse", "cow", "pig", "duck", "frog"];

/** El mazo de la prueba; `aceptadas` es {título: [palabras que también valen]}. */
const mazo = (aceptadas = {}) =>
  TITULOS.map((title, i) => ({
    id: i + 1,
    title,
    src: `img/${title}.png`,
    answered: false,
    ...(aceptadas[title] ? { accepted: aceptadas[title] } : {}),
  }));

/** `buildRound` tal como era antes de las respuestas aceptadas (copia fiel). */
function rondaDeAntes(words, answeredIds, rng) {
  const shuffleWith = (arr, r) => {
    const copy = [...arr];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(r() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  };
  const pending = words.filter((w) => !answeredIds.has(w.id) && w.title);
  if (pending.length === 0) return null;
  const word = shuffleWith(pending, rng)[0];
  const taken = new Set([word.title.toLowerCase()]);
  const options = [word.title];
  for (const w of shuffleWith(pending, rng)) {
    if (options.length >= OPTIONS_PER_ROUND) break;
    const key = w.title.toLowerCase();
    if (taken.has(key)) continue;
    taken.add(key);
    options.push(w.title);
  }
  return { word, options: shuffleWith(options, rng) };
}

// ── Pruebas ──────────────────────────────────────────────────────────────────

test("sin `accepted` la ronda es idéntica a la de antes, semilla por semilla", () => {
  const words = mazo();
  for (let seed = 0; seed < 500; seed++) {
    const respondidas = new Set(seed % 3 === 0 ? [1, 4] : []);
    assert.deepEqual(
      buildRound(words, respondidas, mulberry32(seed)),
      rondaDeAntes(words, respondidas, mulberry32(seed)),
      `semilla ${seed}`,
    );
  }
});

test("un `accepted` vacío tampoco mueve nada", () => {
  const vacio = mazo().map((w) => ({ ...w, accepted: [] }));
  for (let seed = 0; seed < 100; seed++) {
    assert.deepEqual(
      buildRound(vacio, new Set(), mulberry32(seed)).options,
      rondaDeAntes(mazo(), new Set(), mulberry32(seed)).options,
      `semilla ${seed}`,
    );
  }
});

test("una palabra aceptada nunca sale de señuelo y solo se sustituye ese señuelo", () => {
  for (let seed = 0; seed < 500; seed++) {
    const antes = buildRound(mazo(), new Set(), mulberry32(seed));
    // Aceptamos justo uno de los señuelos que habían salido.
    const aceptada = antes.options.find((o) => o !== antes.word.title);
    const words = mazo({ [antes.word.title]: [aceptada] });

    const rng = mulberry32(seed);
    const despues = buildRound(words, new Set(), rng);

    assert.equal(despues.word.id, antes.word.id, `semilla ${seed}: la palabra de la ronda no cambia`);
    assert.ok(despues.options.includes(antes.word.title), `semilla ${seed}: la correcta sigue ahí`);
    assert.ok(!despues.options.includes(aceptada), `semilla ${seed}: «${aceptada}» no debía salir`);
    assert.equal(despues.options.length, OPTIONS_PER_ROUND, `semilla ${seed}: siguen los globos de siempre`);
    // El otro señuelo se conserva: la sustitución es de uno solo.
    const intacto = antes.options.find((o) => o !== antes.word.title && o !== aceptada);
    assert.ok(despues.options.includes(intacto), `semilla ${seed}: «${intacto}» se conserva`);
    // El rng gasta lo mismo: lo que viene después en el mazo sembrado no se mueve.
    const sinAlternativas = mulberry32(seed);
    buildRound(mazo(), new Set(), sinAlternativas);
    assert.equal(rng(), sinAlternativas(), `semilla ${seed}: el rng queda en el mismo punto`);
  }
});

test("ninguna aceptada sale de señuelo, sea cual sea el subconjunto", () => {
  for (let seed = 0; seed < 300; seed++) {
    const azar = mulberry32(seed + 10_000);
    const aceptadas = TITULOS.filter(() => azar() < 0.3);
    const words = mazo().map((w) => ({ ...w, accepted: aceptadas.filter((a) => a !== w.title) }));
    const ronda = buildRound(words, new Set(), mulberry32(seed));
    const prohibidas = new Set(ronda.word.accepted.map(normalizarPalabra));
    for (const o of ronda.options) {
      if (o === ronda.word.title) continue;
      assert.ok(!prohibidas.has(normalizarPalabra(o)), `semilla ${seed}: «${o}» es aceptada y salió`);
    }
    assert.ok(ronda.options.includes(ronda.word.title), `semilla ${seed}: falta la correcta`);
    assert.equal(new Set(ronda.options.map((o) => o.toLowerCase())).size, ronda.options.length, "sin repetidas");
  }
});

test("la comparación ignora mayúsculas y puntuación final, como en el servidor", () => {
  const words = [
    { id: 1, title: "cat", src: null, answered: false, accepted: ["Kitten."] },
    { id: 2, title: "kitten", src: null, answered: false },
  ];
  let vistas = 0;
  for (let seed = 0; seed < 50; seed++) {
    const ronda = buildRound(words, new Set(), mulberry32(seed));
    if (ronda.word.id !== 1) continue;
    vistas++;
    assert.deepEqual(ronda.options, ["cat"], "«kitten» es aceptada: no se ofrece y no queda otro señuelo");
  }
  assert.ok(vistas > 0, "alguna semilla debía sacar «cat»");
});

test("con el mazo corto prefiere menos globos antes que ofrecer una aceptada", () => {
  const words = [
    { id: 1, title: "cat", src: null, answered: false, accepted: ["dog"] },
    { id: 2, title: "dog", src: null, answered: false },
    { id: 3, title: "bird", src: null, answered: false },
  ];
  let vistas = 0;
  for (let seed = 0; seed < 100; seed++) {
    const ronda = buildRound(words, new Set(), mulberry32(seed));
    if (ronda.word.id !== 1) continue;
    vistas++;
    assert.deepEqual([...ronda.options].sort(), ["bird", "cat"], `semilla ${seed}`);
  }
  assert.ok(vistas > 0, "alguna semilla debía sacar «cat»");
});

test("sin palabras jugables no hay ronda", () => {
  assert.equal(buildRound(mazo(), new Set(mazo().map((w) => w.id)), mulberry32(1)), null);
});
