#!/usr/bin/env node
// Valida la regla de dibujo de components/ui/icon/paths.tsx, y que el set de
// PNG de economía (components/ui/ui-icon/ui-icon.tsx) tenga archivo por cada
// clave y ningún archivo huérfano en public/images/ui/.
// Falla si un icono usa un color fuera de paleta, navy como relleno, un
// stroke-width distinto al de su familia, un icono colocado antes de toda
// marca de familia, o cualquier className/style (puertas traseras para colar
// color fuera de fill/stroke) — o si ui-icon.tsx y public/images/ui/ no casan.
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const root = new URL("..", import.meta.url).pathname;
const source = readFileSync(join(root, "components/ui/icon/paths.tsx"), "utf8");

const PALETA = new Set(["#FF1F8F", "#3768FF", "#35D8F5", "#FFFFFF", "none", "currentColor"]);
const NAVY = "#1E1B5C";
const errors = [];

/** Los hex del set son insensibles a mayúsculas; "none"/"currentColor" no lo son. */
const normalizeColor = (c) => (c.startsWith("#") ? c.toUpperCase() : c);

// 1. Ningún color fuera de la paleta, en fill ni en stroke.
//    El rango es [A-Za-z], no [a-z]: con minúsculas solo, `currentColor` casa
//    como `current` y el verificador lo denuncia como color inventado.
//    La comilla de apertura acepta ' " o {: una comilla simple sola bastaba
//    para colar un color sin que esta regla lo viera.
for (const m of source.matchAll(/(?:fill|stroke)=['"{]['"]?(#[0-9A-Fa-f]{3,8}|[A-Za-z]+)['"]?/g)) {
  const c = normalizeColor(m[1]);
  if (c === NAVY) continue; // navy es legítimo como contorno; el fill se revisa abajo
  if (!PALETA.has(c)) errors.push(`color fuera de paleta: ${m[1]}`);
}

// 2. Navy nunca como relleno. Es la regla 10 del CLAUDE.md: sobre el tema
//    oscuro mide 1.18:1 y la forma desaparece. "gi": comilla simple o doble
//    (como en la regla 1) y sin distinguir mayúsculas — #1e1b5c cuela lo
//    mismo que #1E1B5C, y antes solo se detectaba la forma exacta en mayúsculas.
const navyFillHits = source.match(new RegExp(`fill=['"{]['"]?${NAVY}`, "gi")) ?? [];
for (let i = 0; i < navyFillHits.length; i++) {
  errors.push(`navy como relleno (${NAVY}): es color de línea, no de masa`);
}

// 3. Sin degradados ni brillos.
for (const t of ["linearGradient", "radialGradient", "filter="]) {
  if (source.includes(t)) errors.push(`relleno no plano: ${t}`);
}

// 4. Grosor constante por familia. Las familias se marcan con un comentario
//    `── familia <nombre> · stroke-width <n> ──` y todo lo que va debajo hasta
//    la siguiente marca debe usar ese grosor. Acepta `strokeWidth={n}`,
//    `strokeWidth="n"` y el kebab-case `stroke-width` (React lo pasa igual
//    al DOM: es SVG válido) en cualquiera de las dos formas — mirar solo
//    `strokeWidth={n}` dejaba pasar sin comprobar las otras tres.
const STROKE_WIDTH_RE = /(?:strokeWidth|stroke-width)=(?:\{([\d.]+)\}|["']([\d.]+)["'])/g;
const marcas = [...source.matchAll(/── familia (\S+) · stroke-width ([\d.]+) ──/g)];
if (marcas.length === 0) errors.push("ninguna familia declarada en paths.tsx");
for (let i = 0; i < marcas.length; i++) {
  const desde = marcas[i].index;
  const hasta = i + 1 < marcas.length ? marcas[i + 1].index : source.length;
  const [, familia, esperado] = marcas[i];
  for (const m of source.slice(desde, hasta).matchAll(STROKE_WIDTH_RE)) {
    const valor = m[1] ?? m[2];
    if (valor !== esperado) {
      errors.push(`familia ${familia}: strokeWidth ${valor} donde la familia usa ${esperado}`);
    }
  }
}
//    Un icono declarado antes de la primera marca no cae en ningún rango
//    [desde, hasta) de arriba: el bucle de encima nunca lo mira, y por tanto
//    tampoco su stroke-width. Es el agujero real de esta regla.
if (marcas.length > 0) {
  const primeraMarca = marcas[0].index;
  for (const m of source.matchAll(/^ {2}([a-z][\w-]*): \(/gm)) {
    if (m.index < primeraMarca) {
      errors.push(`icono "${m[1]}" antes de toda marca de familia: la regla de grosor nunca lo revisa`);
    }
  }
}

// 5. Un solo viewBox, y vive en icon.tsx, no aquí. Regex y no substring: la
//    palabra "viewBox" mencionada en prosa (un comentario que explique el
//    porqué) no es una declaración y no debería obligar a evitarla.
if (/viewBox\s*=/.test(source)) errors.push("paths.tsx no declara viewBox: lo pone icon.tsx");

// 6. Ningún className NI style en paths.tsx. La geometría no necesita clases
//    ni estilos inline: el color vive en atributos fill/stroke (reglas 1 y
//    2) y el tamaño lo pone icon.tsx. Un className cuela colores (Tailwind
//    arbitrario tipo `fill-[#1E1B5C]`, o clases con nombre); un
//    `style={{ fill: "#1E1B5C" }}` cuela lo mismo por un camino que las
//    reglas 1 y 2 nunca miran, porque ahí "fill" va seguido de `:`, no de `=`.
if (source.includes("className")) errors.push("paths.tsx no admite className: la geometría no lleva clases, el color va en atributos");
if (source.includes("style=")) errors.push("paths.tsx no admite style: cuela fill/stroke por un camino que las reglas 1 y 2 no miran");

if (errors.length) {
  console.error(`check-icons: ${errors.length} problema(s)\n  ${errors.join("\n  ")}`);
  process.exit(1);
}
const totalIconos = [...source.matchAll(/^ {2}[a-z][\w-]*: \(/gm)].length;
console.log(`check-icons: ${totalIconos} iconos OK (${marcas.length} familia(s))`);

// ── UiIcon: los PNG de economía casan 1:1 con NOMBRES ─────────────────────
// Sin esto, renombrar una clave en ui-icon.tsx o un archivo en
// public/images/ui/ es un 404 silencioso en producción — <UiIcon> no valida
// nada en build time, al revés que el grupo de Doty (check-doty-assets.mjs).
const uiIconSource = readFileSync(join(root, "components/ui/ui-icon/ui-icon.tsx"), "utf8");
const nombresMatch = uiIconSource.match(/const NOMBRES = \[([\s\S]*?)\] as const;/);
if (!nombresMatch) {
  console.error("check-icons: no se pudo leer NOMBRES de components/ui/ui-icon/ui-icon.tsx");
  process.exit(1);
}
const nombres = [...nombresMatch[1].matchAll(/"([a-z0-9-]+)"/g)].map((m) => m[1]);
const uiDir = join(root, "public/images/ui");
const archivos = readdirSync(uiDir).filter((f) => f.endsWith(".png"));
const archivosSet = new Set(archivos.map((f) => f.replace(/\.png$/, "")));
const nombresSet = new Set(nombres);

const uiErrors = [];
for (const nombre of nombres) {
  if (!archivosSet.has(nombre)) uiErrors.push(`ui-icon "${nombre}" no tiene public/images/ui/${nombre}.png`);
}
for (const archivo of archivos) {
  const clave = archivo.replace(/\.png$/, "");
  if (!nombresSet.has(clave)) uiErrors.push(`public/images/ui/${archivo} no está en NOMBRES de ui-icon.tsx (huérfano)`);
}
if (uiErrors.length) {
  console.error(`check-icons: ${uiErrors.length} problema(s) en ui-icon\n  ${uiErrors.join("\n  ")}`);
  process.exit(1);
}
console.log(`check-icons: ${nombres.length} PNG de ui-icon OK`);
