import { test } from "node:test";
import assert from "node:assert/strict";

/**
 * El módulo escribe en `document.body.style.overflow` y guarda su estado en
 * variables de módulo, así que cada test carga una instancia limpia con una
 * query distinta (Node cachea por URL resuelta) sobre un `document` de
 * mentira. Sin el aislamiento, el contador de un test se arrastraría al
 * siguiente y los fallos saldrían en el test equivocado.
 */
let semilla = 0;
async function cargar(overflowInicial = "") {
  globalThis.document = { body: { style: { overflow: overflowInicial } } };
  semilla += 1;
  const mod = await import(`./scroll-lock.ts?t=${semilla}`);
  return { ...mod, cuerpo: globalThis.document.body.style };
}

test("el primer bloqueo esconde el overflow y el último lo devuelve", async () => {
  const { bloquearScroll, cuerpo } = await cargar();
  const soltar = bloquearScroll();
  assert.equal(cuerpo.overflow, "hidden");
  soltar();
  assert.equal(cuerpo.overflow, "");
});

test("respeta el valor que ya hubiera, no asume cadena vacía", async () => {
  const { bloquearScroll, cuerpo } = await cargar("auto");
  const soltar = bloquearScroll();
  assert.equal(cuerpo.overflow, "hidden");
  soltar();
  assert.equal(cuerpo.overflow, "auto");
});

test("dos bloqueos anidados: solo el segundo en soltar devuelve el scroll", async () => {
  const { bloquearScroll, cuerpo } = await cargar();
  const soltarA = bloquearScroll();
  const soltarB = bloquearScroll();
  soltarA();
  assert.equal(cuerpo.overflow, "hidden", "con B todavía vivo el scroll sigue parado");
  soltarB();
  assert.equal(cuerpo.overflow, "");
});

test("soltar en orden distinto al de apertura NO deja el scroll muerto", async () => {
  // Este es el bug que motivó el módulo: con guardar-y-restaurar por separado,
  // el segundo en soltar restauraba el "hidden" que había guardado del primero
  // y el body se quedaba sin scroll para el resto de la sesión.
  const { bloquearScroll, cuerpo } = await cargar();
  const soltarPrimero = bloquearScroll();
  const soltarSegundo = bloquearScroll();
  soltarSegundo();
  soltarPrimero();
  assert.equal(cuerpo.overflow, "");
});

test("soltar dos veces no descuenta dos veces", async () => {
  // StrictMode monta, limpia y vuelve a montar: una limpieza repetida no puede
  // soltar el bloqueo de otro.
  const { bloquearScroll, cuerpo } = await cargar();
  const soltarA = bloquearScroll();
  const soltarB = bloquearScroll();
  soltarA();
  soltarA();
  soltarA();
  assert.equal(cuerpo.overflow, "hidden", "las llamadas de más no pueden soltar lo de B");
  soltarB();
  assert.equal(cuerpo.overflow, "");
});

test("el ciclo de StrictMode (montar, limpiar, montar) deja el scroll parado", async () => {
  const { bloquearScroll, hayScrollBloqueado, cuerpo } = await cargar();
  const primero = bloquearScroll();
  primero();
  const segundo = bloquearScroll();
  assert.equal(cuerpo.overflow, "hidden");
  assert.equal(hayScrollBloqueado(), true);
  segundo();
  assert.equal(cuerpo.overflow, "");
  assert.equal(hayScrollBloqueado(), false);
});

test("hayScrollBloqueado responde mientras quede alguien", async () => {
  const { bloquearScroll, hayScrollBloqueado } = await cargar();
  assert.equal(hayScrollBloqueado(), false);
  const soltarA = bloquearScroll();
  const soltarB = bloquearScroll();
  assert.equal(hayScrollBloqueado(), true);
  soltarA();
  assert.equal(hayScrollBloqueado(), true, "B sigue vivo");
  soltarB();
  assert.equal(hayScrollBloqueado(), false);
});

test("un ciclo completo devuelve el valor original aunque se anide tres veces", async () => {
  const { bloquearScroll, cuerpo } = await cargar("scroll");
  const sueltas = [bloquearScroll(), bloquearScroll(), bloquearScroll()];
  assert.equal(cuerpo.overflow, "hidden");
  for (const soltar of sueltas.reverse()) soltar();
  assert.equal(cuerpo.overflow, "scroll");
});
