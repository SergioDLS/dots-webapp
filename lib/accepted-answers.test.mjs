import { test } from "node:test";
import assert from "node:assert/strict";
import {
  cubreTodasLasIncorrectas,
  esOracionAceptada,
  normalizarOracion,
  normalizarPalabra,
  primerFalloEnOrden,
  sinAceptadas,
  tokenizarOracion,
} from "./accepted-answers.ts";

test("misma normalización que el backend", () => {
  assert.equal(normalizarOracion("  Today   I am happy ."), "TODAY I AM HAPPY");
});

test("normalizarPalabra: sin espacios, sin puntuación final y en mayúsculas", () => {
  assert.equal(normalizarPalabra("Coffee."), "COFFEE");
  assert.equal(normalizarPalabra("  morning,  "), "MORNING");
  assert.equal(normalizarPalabra("really?!"), "REALLY");
  assert.equal(normalizarPalabra("..."), "");
  // La puntuación de en medio es parte de la ficha y se queda.
  assert.equal(normalizarPalabra("it's"), "IT'S");
  assert.equal(normalizarPalabra("well-known"), "WELL-KNOWN");
});

test("tokenizarOracion: gemela del servidor, fichas por espacios y sin puntuación en la última", () => {
  assert.deepEqual(tokenizarOracion("  I   drink coffee.  "), ["I", "drink", "coffee"]);
  // La puntuación de en medio se queda en su ficha.
  assert.deepEqual(tokenizarOracion("In the morning, I drink coffee"), ["In", "the", "morning,", "I", "drink", "coffee"]);
  // Una última «ficha» que era solo puntuación desaparece, y vacío no da fichas.
  assert.deepEqual(tokenizarOracion("Really ?!"), ["Really"]);
  assert.deepEqual(tokenizarOracion("   "), []);
  assert.deepEqual(tokenizarOracion(""), []);
});

test("«Arma la oración»: la referencia como siempre y las alternativas normalizadas", () => {
  assert.equal(esOracionAceptada("i am happy today", "I am happy today"), true);
  assert.equal(esOracionAceptada("today I am happy", "I am happy today"), false);
  assert.equal(esOracionAceptada("today I am happy", "I am happy today", ["Today I am happy."]), true);
  assert.equal(esOracionAceptada("", "x", [""]), false);
});

test("«Arma la oración»: un orden aceptado con otro número de fichas que la oración ya no vale", () => {
  // La oración creció a «I am very happy today» y «Today I am happy» se aceptó
  // cuando eran 4 fichas: la práctica corrige en cada cambio de la bandeja, y
  // con ese orden daría por buena una oración a medio armar.
  const hoy = "I am very happy today";
  assert.equal(esOracionAceptada("Today I am happy", hoy, ["Today I am happy"]), false);
  assert.equal(esOracionAceptada("Today I am happy", hoy, ["Today I am happy."]), false);
  // La que conserva las fichas de la oración sigue valiendo, con o sin punto final.
  assert.equal(esOracionAceptada("Today I am very happy", hoy, ["Today I am very happy."]), true);
  // Una rancia no estorba a la buena que viene detrás.
  assert.equal(esOracionAceptada("Today I am very happy", hoy, ["Today I am happy", "today i am very happy"]), true);
  // La referencia no depende de las alternativas.
  assert.equal(esOracionAceptada("i am very happy today", hoy, ["Today I am happy"]), true);
  // El punto final de la oración no es una ficha: se cuentan igual que en el servidor.
  assert.equal(esOracionAceptada("Today I am very happy", "I am very happy today.", ["Today I am very happy"]), true);
});

test("Constructor: primera ficha mal puesta respecto de la secuencia más parecida", () => {
  const ref = ["I", "am", "happy", "today"];
  const alt = ["Today", "I", "am", "happy"];
  assert.equal(primerFalloEnOrden(["I", "am", "happy", "today"], [ref, alt]), null);
  assert.equal(primerFalloEnOrden(["today", "i", "am", "happy"], [ref, alt]), null);
  assert.equal(primerFalloEnOrden(["I", "am", "today", "happy"], [ref, alt]), 2);
  assert.equal(primerFalloEnOrden(["Today", "I", "happy", "am"], [ref, alt]), 2);
});

test("Constructor: devuelve 0 cuando ya la primera ficha está mal", () => {
  const ref = ["I", "am", "happy", "today"];
  const alt = ["Today", "I", "am", "happy"];
  assert.equal(primerFalloEnOrden(["happy", "I", "am", "today"], [ref, alt]), 0);
  assert.equal(primerFalloEnOrden(["am", "I", "happy", "today"], [ref]), 0);
});

test("Constructor: una bandeja con otro número de fichas que las secuencias no coincide con ninguna, aunque calce hasta donde llega", () => {
  const ref = ["I", "am", "happy", "today"];
  const alt = ["Today", "I", "am", "happy"];
  // Más corta y más larga que las secuencias: no hay con qué compararla, así que falla en la primera ficha.
  assert.equal(primerFalloEnOrden(["I", "am"], [ref, alt]), 0);
  assert.equal(primerFalloEnOrden(["Today", "I", "am"], [ref, alt]), 0);
  assert.equal(primerFalloEnOrden(["I", "am", "happy", "today", "very"], [ref, alt]), 0);
  assert.equal(primerFalloEnOrden([], [ref]), 0);
});

test("Constructor: un orden aceptado cuya última ficha lleva la puntuación de la referencia sí coincide", () => {
  // «In the morning, I drink coffee.»: las fichas son las de la referencia, con su coma.
  const ref = ["In", "the", "morning,", "I", "drink", "coffee"];
  // El servidor tokeniza «I drink coffee In the morning,» y le quita la coma a la ÚLTIMA ficha.
  const alt = ["I", "drink", "coffee", "In", "the", "morning"];
  const armada = ["I", "drink", "coffee", "In", "the", "morning,"];
  assert.equal(primerFalloEnOrden(armada, [ref, alt]), null);
  // Se sigue distinguiendo lo que no está aceptado: aquí la falla es la 4.ª ficha.
  assert.equal(primerFalloEnOrden(["I", "drink", "coffee", "the", "In", "morning,"], [ref, alt]), 3);
  // La referencia no se normaliza: sigue pidiendo cada ficha tal cual (misma coma).
  assert.equal(primerFalloEnOrden(["In", "the", "morning", "I", "drink", "coffee"], [ref, alt]), 2);
  assert.equal(primerFalloEnOrden(["In", "the", "morning,", "I", "drink", "coffee"], [ref, alt]), null);
});

test("Constructor: solo las alternativas se comparan normalizadas; la referencia (índice 0) no", () => {
  // Misma secuencia, distinto lugar: como referencia pide «Hello» a secas; como alternativa vale «Hello.».
  assert.equal(primerFalloEnOrden(["Hello.", "world"], [["Hello", "world"]]), 0);
  assert.equal(primerFalloEnOrden(["Hello.", "world"], [["Other", "words"], ["Hello", "world"]]), null);
});

test("Constructor: un orden aceptado con otro número de fichas que la referencia no cuenta, ni con la bandeja de su largo", () => {
  // La oración creció a 5 fichas; «Today I am happy» (4) se aceptó antes.
  const ref = ["I", "am", "very", "happy", "today"];
  const rancia = ["Today", "I", "am", "happy"];
  // La bandeja de 4 fichas calza con la rancia, pero esa ya no es una oración completa.
  assert.equal(primerFalloEnOrden(["Today", "I", "am", "happy"], [ref, rancia]), 0);
  // Con la bandeja completa se corrige contra la referencia, como siempre.
  assert.equal(primerFalloEnOrden(["I", "am", "very", "happy", "today"], [ref, rancia]), null);
  assert.equal(primerFalloEnOrden(["I", "am", "happy", "very", "today"], [ref, rancia]), 2);
  // Una alternativa vigente (5 fichas) sigue contando aunque la rancia esté en medio.
  const vigente = ["Today", "I", "am", "very", "happy"];
  assert.equal(primerFalloEnOrden(["today", "i", "am", "very", "happy"], [ref, rancia, vigente]), null);
});

test("¡No lo revientes!: las aceptadas salen de los distractores", () => {
  assert.deepEqual(sinAceptadas(["kitten", "dog", "Kitten "], ["kitten"]), ["dog"]);
  assert.deepEqual(sinAceptadas(["dog"], undefined), ["dog"]);
});

test("aviso del editor: las aceptadas cubren TODAS las opciones incorrectas", () => {
  // Con la misma normalización que usan los juegos: mayúsculas y puntuación final no cuentan.
  assert.equal(cubreTodasLasIncorrectas(["go", "goes"], ["Go", "goes."]), true);
  assert.equal(cubreTodasLasIncorrectas(["go"], ["go"]), true);
  // Aceptar de más (palabras que no eran distractores) no cambia nada.
  assert.equal(cubreTodasLasIncorrectas(["go"], ["went", "go"]), true);
});

test("aviso del editor: si queda al menos una incorrecta, no avisa", () => {
  assert.equal(cubreTodasLasIncorrectas(["go", "goes", "went"], ["go", "goes"]), false);
  assert.equal(cubreTodasLasIncorrectas(["go", "goes"], []), false);
  assert.equal(cubreTodasLasIncorrectas(["go"], ["went"]), false);
});

test("aviso del editor: sin distractores no hay nada que cubrir", () => {
  // No fue lo que aceptó el admin lo que dejó el ejercicio con una sola opción.
  assert.equal(cubreTodasLasIncorrectas([], ["go"]), false);
  assert.equal(cubreTodasLasIncorrectas([], []), false);
  // Los renglones en blanco no son opciones: ni cuentan como incorrecta que quede, ni como lista llena.
  assert.equal(cubreTodasLasIncorrectas(["go", "  ", ""], ["go"]), true);
  assert.equal(cubreTodasLasIncorrectas(["  ", ""], ["go"]), false);
});
