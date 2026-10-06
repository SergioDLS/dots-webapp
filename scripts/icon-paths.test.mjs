import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { iconosDe } from "./icon-paths.mjs";

test("iconosDe reconoce la clave sin comillas y la que va entre comillas dobles o simples", () => {
  // Una clave con guion no es un identificador de JS: va entre comillas por
  // fuerza. La posición es la del inicio de la línea, que check-icons compara
  // con la de la primera marca de familia.
  const source = [
    "export const ICON_PATHS = {",
    "  camino: (",
    '    <path d="M0,0" />',
    "  ),",
    '  "anadir-inicio": (',
    '    <path d="M0,0" />',
    "  ),",
    "  'menu-puntos': (",
    '    <path d="M0,0" />',
    "  ),",
    "};",
  ].join("\n");
  assert.deepEqual(iconosDe(source), [
    { nombre: "camino", index: source.indexOf("  camino") },
    { nombre: "anadir-inicio", index: source.indexOf('  "anadir-inicio"') },
    { nombre: "menu-puntos", index: source.indexOf("  'menu-puntos'") },
  ]);
});

test("iconosDe ve todos los iconos del paths.tsx real", () => {
  const source = readFileSync(new URL("../components/ui/icon/paths.tsx", import.meta.url), "utf8");
  // Cada entrada de ICON_PATHS se cierra con `  ),`, escriba como escriba su
  // clave: contar los cierres no pasa por la regex que se está probando.
  const cierres = source.match(/^ {2}\),$/gm) ?? [];
  assert.notEqual(cierres.length, 0, "paths.tsx ya no cierra sus entradas con `  ),`: el recuento no sirve");
  assert.equal(iconosDe(source).length, cierres.length);
});
