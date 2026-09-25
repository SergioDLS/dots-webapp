import { test } from "node:test";
import assert from "node:assert/strict";
import {
  CLAVE_MARCA,
  ESPERA_SEGUNDA_MS,
  GUIONES,
  MAX_VISTAS,
  decidirAviso,
  detectarGuion,
  esIOS,
  marcarVista,
  parsearMarca,
  serializarMarca,
} from "./install-prompt.ts";

// UAs reales, recortados a lo que la detección mira.
const UA = {
  iphoneSafari:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1",
  iphoneChrome:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/126.0.6478.108 Mobile/15E148 Safari/604.1",
  iphoneFirefox:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) FxiOS/127.0 Mobile/15E148 Safari/605.1.15",
  iphoneInstagram:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 334.0.3.28.104 (iPhone14,5; iOS 17_5; es_CL)",
  iphoneFacebook:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/FBIOS;FBAV/468.0.0.44.107]",
  ipadOS:
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15",
  androidChrome:
    "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36",
  androidFirefox:
    "Mozilla/5.0 (Android 14; Mobile; rv:127.0) Gecko/127.0 Firefox/127.0",
  androidWebview:
    "Mozilla/5.0 (Linux; Android 14; Pixel 8 Build/AP1A; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/126.0.0.0 Mobile Safari/537.36",
  escritorio:
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
};

// ── detectarGuion ─────────────────────────────────────────────────────────

test("con prompt nativo disponible, el guion es el de un toque", () => {
  assert.equal(detectarGuion(UA.androidChrome, { nativo: true }), "nativo");
  // Manda sobre cualquier otra pista: si el navegador se ofrece a instalar,
  // no hay tutorial que dar.
  assert.equal(detectarGuion(UA.escritorio, { nativo: true }), "nativo");
});

test("iOS nunca cae en el guion nativo aunque algo diga lo contrario", () => {
  // Safari no dispara `beforeinstallprompt`; si llegara, sería un bug ajeno.
  assert.equal(detectarGuion(UA.iphoneSafari, { nativo: true }), "ios-safari");
});

test("Safari de iPhone y de iPad llevan al mismo guion", () => {
  assert.equal(detectarGuion(UA.iphoneSafari, { nativo: false }), "ios-safari");
  // iPadOS miente y dice ser un Mac: solo el táctil lo delata.
  assert.equal(detectarGuion(UA.ipadOS, { nativo: false, tactil: true }), "ios-safari");
  assert.equal(detectarGuion(UA.ipadOS, { nativo: false, tactil: false }), "escritorio");
});

test("Chrome y Firefox de iOS tienen su propio menú", () => {
  assert.equal(detectarGuion(UA.iphoneChrome, { nativo: false }), "ios-navegador");
  assert.equal(detectarGuion(UA.iphoneFirefox, { nativo: false }), "ios-navegador");
});

test("dentro de Instagram o Facebook hay que salir a Safari primero", () => {
  assert.equal(detectarGuion(UA.iphoneInstagram, { nativo: false }), "ios-webview");
  assert.equal(detectarGuion(UA.iphoneFacebook, { nativo: false }), "ios-webview");
});

test("Android sin prompt nativo va por el menú del navegador", () => {
  assert.equal(detectarGuion(UA.androidFirefox, { nativo: false }), "android-menu");
  // Chrome ya instalado deja de disparar el evento: mismo guion, sin mentir.
  assert.equal(detectarGuion(UA.androidChrome, { nativo: false }), "android-menu");
});

test("un webview de Android tampoco instala: hay que abrir el navegador", () => {
  assert.equal(detectarGuion(UA.androidWebview, { nativo: false }), "android-webview");
});

test("el escritorio sin prompt nativo no tiene guion que ofrecer", () => {
  assert.equal(detectarGuion(UA.escritorio, { nativo: false }), "escritorio");
});

test("un UA vacío no revienta ni inventa un guion", () => {
  assert.equal(detectarGuion("", { nativo: false }), "escritorio");
});

test("esIOS reconoce iPhone, iPad moderno y iPad viejo", () => {
  assert.equal(esIOS(UA.iphoneSafari, false), true);
  assert.equal(esIOS(UA.ipadOS, true), true);
  assert.equal(esIOS(UA.ipadOS, false), false);
  assert.equal(esIOS(UA.androidChrome, true), false);
});

test("todo guion tiene copy y pasos, salvo los que no enseñan pasos", () => {
  for (const [clave, guion] of Object.entries(GUIONES)) {
    assert.ok(guion.titulo.length > 0, `${clave} sin título`);
    assert.ok(guion.frase.length > 0, `${clave} sin frase`);
    assert.ok(guion.cta.length > 0, `${clave} sin CTA`);
    // "nativo" resuelve con un botón y "escritorio" no se ofrece solo.
    if (clave !== "nativo") assert.ok(guion.pasos.length > 0, `${clave} sin pasos`);
  }
});

// ── marca en localStorage ─────────────────────────────────────────────────

test("la clave es estable: cambiarla reabre el aviso a todo el mundo", () => {
  assert.equal(CLAVE_MARCA, "dots.install.aviso");
});

test("parsear aguanta basura sin lanzar", () => {
  assert.equal(parsearMarca(null), null);
  assert.equal(parsearMarca(""), null);
  assert.equal(parsearMarca("{no es json"), null);
  assert.equal(parsearMarca("[]"), null);
  assert.equal(parsearMarca('"texto"'), null);
  assert.equal(parsearMarca("42"), null);
});

test("parsear normaliza campos de tipo raro en vez de confiar", () => {
  const m = parsearMarca('{"vistas":"3","ultima":"ayer","instalada":1}');
  assert.deepEqual(m, { vistas: 0, ultima: 0, instalada: false });
});

test("lo serializado vuelve igual", () => {
  const m = { vistas: 1, ultima: 1_700_000_000_000, instalada: false };
  assert.deepEqual(parsearMarca(serializarMarca(m)), m);
});

test("marcarVista suma una y sella la fecha", () => {
  const primera = marcarVista(null, 1000);
  assert.deepEqual(primera, { vistas: 1, ultima: 1000, instalada: false });
  const segunda = marcarVista(primera, 2000);
  assert.deepEqual(segunda, { vistas: 2, ultima: 2000, instalada: false });
});

test("marcarVista conserva que ya está instalada", () => {
  const m = marcarVista({ vistas: 1, ultima: 0, instalada: true }, 5000);
  assert.equal(m.instalada, true);
});

// ── decidirAviso ──────────────────────────────────────────────────────────

/** El caso que SÍ avisa; cada test tuerce una sola cosa. */
function entrada(over = {}) {
  return {
    instalada: false,
    movil: true,
    guion: "ios-safari",
    marca: null,
    ahora: 1_000_000,
    ...over,
  };
}

test("móvil, sin instalar y sin historial: avisa", () => {
  assert.equal(decidirAviso(entrada()), true);
});

test("ya abierta como app instalada: nunca", () => {
  assert.equal(decidirAviso(entrada({ instalada: true })), false);
});

test("en escritorio no se ofrece solo", () => {
  assert.equal(decidirAviso(entrada({ movil: false })), false);
  // Ni aunque el guion sea instalable: el aviso automático es cosa de móvil.
  assert.equal(decidirAviso(entrada({ movil: false, guion: "nativo" })), false);
});

test("el guion de escritorio no avisa ni en un móvil que lo reporte", () => {
  assert.equal(decidirAviso(entrada({ guion: "escritorio" })), false);
});

test("quien ya instaló en este dispositivo no vuelve a verlo", () => {
  const marca = { vistas: 1, ultima: 0, instalada: true };
  assert.equal(decidirAviso(entrada({ marca })), false);
});

test("tras el primer 'ahora no' hay que esperar catorce días", () => {
  const marca = { vistas: 1, ultima: 1_000_000, instalada: false };
  assert.equal(decidirAviso(entrada({ marca, ahora: 1_000_000 + ESPERA_SEGUNDA_MS - 1 })), false);
  assert.equal(decidirAviso(entrada({ marca, ahora: 1_000_000 + ESPERA_SEGUNDA_MS })), true);
});

test("a la segunda vista se acabó para siempre", () => {
  const marca = { vistas: MAX_VISTAS, ultima: 0, instalada: false };
  assert.equal(decidirAviso(entrada({ marca, ahora: 9_999_999_999 })), false);
});

test("una marca del futuro no desbloquea el aviso antes de tiempo", () => {
  // Reloj del sistema movido hacia atrás: la resta da negativa y no debe
  // leerse como "ya pasaron catorce días".
  const marca = { vistas: 1, ultima: 5_000_000, instalada: false };
  assert.equal(decidirAviso(entrada({ marca, ahora: 1_000_000 })), false);
});
