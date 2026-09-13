#!/usr/bin/env node
// Valida la regla de dibujo de components/ui/icon/paths.tsx.
// Falla si un icono usa un color fuera de paleta, navy como relleno, o un
// stroke-width distinto al de su familia.
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = new URL("..", import.meta.url).pathname;
const source = readFileSync(join(root, "components/ui/icon/paths.tsx"), "utf8");

const PALETA = new Set(["#FF1F8F", "#3768FF", "#35D8F5", "#ffffff", "none", "currentColor"]);
const NAVY = "#1E1B5C";
const errors = [];

// 1. Ningún color fuera de la paleta, en fill ni en stroke.
//    El rango es [A-Za-z], no [a-z]: con minúsculas solo, `currentColor` casa
//    como `current` y el verificador lo denuncia como color inventado.
for (const m of source.matchAll(/(?:fill|stroke)=["{]"?(#[0-9A-Fa-f]{3,8}|[A-Za-z]+)"?/g)) {
  const c = m[1];
  if (c === NAVY) continue; // navy es legítimo como contorno; el fill se revisa abajo
  if (!PALETA.has(c)) errors.push(`color fuera de paleta: ${c}`);
}

// 2. Navy nunca como relleno. Es la regla 10 del CLAUDE.md: sobre el tema
//    oscuro mide 1.18:1 y la forma desaparece.
const navyFillHits = source.match(new RegExp(`fill=["{]"?${NAVY}`, "g")) ?? [];
for (let i = 0; i < navyFillHits.length; i++) {
  errors.push(`navy como relleno (${NAVY}): es color de línea, no de masa`);
}

// 3. Sin degradados ni brillos.
for (const t of ["linearGradient", "radialGradient", "filter="]) {
  if (source.includes(t)) errors.push(`relleno no plano: ${t}`);
}

// 4. Grosor constante por familia. Las familias se marcan con un comentario
//    `── familia <nombre> · stroke-width <n> ──` y todo lo que va debajo hasta
//    la siguiente marca debe usar ese grosor.
const marcas = [...source.matchAll(/── familia (\S+) · stroke-width ([\d.]+) ──/g)];
if (marcas.length === 0) errors.push("ninguna familia declarada en paths.tsx");
for (let i = 0; i < marcas.length; i++) {
  const desde = marcas[i].index;
  const hasta = i + 1 < marcas.length ? marcas[i + 1].index : source.length;
  const [, familia, esperado] = marcas[i];
  for (const m of source.slice(desde, hasta).matchAll(/strokeWidth=\{([\d.]+)\}/g)) {
    if (m[1] !== esperado) {
      errors.push(`familia ${familia}: strokeWidth ${m[1]} donde la familia usa ${esperado}`);
    }
  }
}

// 5. Un solo viewBox, y vive en icon.tsx, no aquí.
if (source.includes("viewBox")) errors.push("paths.tsx no declara viewBox: lo pone icon.tsx");

if (errors.length) {
  console.error(`check-icons: ${errors.length} problema(s)\n  ${errors.join("\n  ")}`);
  process.exit(1);
}
const n = [...source.matchAll(/^  [a-z][\w-]*: \(/gm)].length;
console.log(`check-icons: ${n} iconos OK (${marcas.length} familia(s))`);
