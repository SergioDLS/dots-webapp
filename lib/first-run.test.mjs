import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ONBOARDED_KEY,
  borrarEspejo,
  escribirEspejo,
  estaOnboardado,
  estadoPrimerInicio,
  fijarPrimerInicio,
  leerEspejo,
  rutaTrasBienvenida,
  suscribirPrimerInicio,
} from "./first-run.ts";

test("la clave del espejo es la del resto de preferencias", () => {
  assert.equal(ONBOARDED_KEY, "dots-onboarded");
});

test("estaOnboardado: con fecha sí, sin fecha no", () => {
  assert.equal(estaOnboardado({ onboarded_at: "2026-09-17T10:00:00.000Z" }), true);
  assert.equal(estaOnboardado({ onboarded_at: null }), false);
  assert.equal(estaOnboardado({}), false);
});

test("estaOnboardado falla abierto: sin ajustes nadie queda atrapado", () => {
  // getMySettingsService devuelve null ante CUALQUIER error de red.
  assert.equal(estaOnboardado(null), true);
  assert.equal(estaOnboardado(undefined), true);
});

test("rutaTrasBienvenida manda a placement solo si se puede tomar o ya está activo", () => {
  assert.equal(rutaTrasBienvenida({ status: "none", canTake: true }), "/onboarding");
  assert.equal(rutaTrasBienvenida({ status: "active", canTake: false }), "/onboarding");
  assert.equal(rutaTrasBienvenida({ status: "done", canTake: false }), "/levels");
  assert.equal(rutaTrasBienvenida({ status: "skipped", canTake: false }), "/levels");
});

test("rutaTrasBienvenida falla abierta al Camino si no se pudo preguntar", () => {
  assert.equal(rutaTrasBienvenida(null), "/levels");
  assert.equal(rutaTrasBienvenida(undefined), "/levels");
});

test("el espejo no explota fuera del navegador", () => {
  // Node no tiene localStorage: leer devuelve false y escribir no lanza.
  assert.equal(leerEspejo(), false);
  assert.doesNotThrow(() => escribirEspejo());
  assert.doesNotThrow(() => borrarEspejo());
});

test("el flag compartido arranca en desconocido y se puede fijar", () => {
  assert.equal(estadoPrimerInicio(), "desconocido");
  fijarPrimerInicio("pendiente");
  assert.equal(estadoPrimerInicio(), "pendiente");
  fijarPrimerInicio("hecho");
  assert.equal(estadoPrimerInicio(), "hecho");
  fijarPrimerInicio("desconocido");
  assert.equal(estadoPrimerInicio(), "desconocido");
});

test("suscribirPrimerInicio notifica un cambio real y desuscribe con lo que devuelve", () => {
  fijarPrimerInicio("desconocido"); // estado de partida conocido, antes de suscribirse
  let llamadas = 0;
  const desuscribir = suscribirPrimerInicio(() => {
    llamadas += 1;
  });
  fijarPrimerInicio("pendiente");
  assert.equal(llamadas, 1);
  desuscribir();
  fijarPrimerInicio("hecho");
  assert.equal(llamadas, 1);
  fijarPrimerInicio("desconocido");
});

test("fijar el mismo valor dos veces notifica una sola vez", () => {
  fijarPrimerInicio("desconocido"); // estado de partida conocido, antes de suscribirse
  let llamadas = 0;
  const desuscribir = suscribirPrimerInicio(() => {
    llamadas += 1;
  });
  fijarPrimerInicio("pendiente");
  fijarPrimerInicio("pendiente");
  assert.equal(llamadas, 1);
  desuscribir();
  fijarPrimerInicio("desconocido");
});
