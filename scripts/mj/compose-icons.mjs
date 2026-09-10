#!/usr/bin/env node
// Deriva todos los iconos de la PWA desde un único render 1024 px transparente
// de la cara de Doty (pieza `app-icon` del catálogo de fase 1).
//
// Uso: node scripts/mj/compose-icons.mjs /ruta/app-icon.png
//
// `icon-192.png` está en PRECACHE_URLS del service worker, así que ejecutar
// esto obliga a bumpear SW_VERSION en el mismo commit (regla 9 de CLAUDE.md):
// sin eso los clientes instalados siguen sirviendo el icono viejo para siempre,
// porque el único disparador de update es el byte-diff de sw.js.
import sharp from "sharp";
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

const src = process.argv[2];
if (!src) {
  console.error("uso: compose-icons.mjs <app-icon.png>");
  process.exit(2);
}
const root = fileURLToPath(new URL("../..", import.meta.url));

// THEME_COLORS.light de lib/theme-colors.ts. Son dos fuentes a mano a propósito
// (las custom properties de CSS no se importan desde JS) — cambiar las dos.
const BG = { r: 0xff, g: 0xf7, b: 0xfb, alpha: 1 };
const TRANSPARENTE = { r: 0, g: 0, b: 0, alpha: 0 };

/** Doty ocupa `ratio` del lienzo, centrado, sobre `bg`. */
async function icon(size, ratio, bg) {
  const inner = Math.round(size * ratio);
  const doty = await sharp(src)
    .resize(inner, inner, { fit: "contain", background: TRANSPARENTE })
    .png()
    .toBuffer();
  let img = sharp({
    create: { width: size, height: size, channels: 4, background: bg ?? TRANSPARENTE },
  }).composite([{ input: doty, gravity: "centre" }]);
  // Con fondo opaco se tira el canal alfa: iOS lo descarta de todas formas y
  // arrastrarlo solo suma bytes.
  if (bg) img = img.flatten({ background: bg });
  // Paleta en vez de RGBA: 3,7 veces menos peso (icon-192 pasa de 37,6 a
  // 12,2 kB) por una desviación media de 0,87 por canal sobre los píxeles
  // opacos — medido, imperceptible. Importa porque icon-192 va en PRECACHE_URLS.
  return img.png({ palette: true, quality: 90, effort: 10 }).toBuffer();
}

const jobs = [
  ["public/icons/icon-192.png", 192, 0.92, null],
  ["public/icons/icon-512.png", 512, 0.92, null],
  // maskable: el sistema recorta a un círculo de 80 % del lienzo, así que Doty
  // va dentro de esa zona segura y el resto se rellena con el color de tema.
  ["public/icons/icon-maskable-192.png", 192, 0.8, BG],
  ["public/icons/icon-maskable-512.png", 512, 0.8, BG],
  // iOS descarta el alfa y pinta el hueco de negro: fondo opaco obligatorio.
  ["app/apple-icon.png", 180, 0.84, BG],
  // favicon moderno; Next lo enlaza solo por convención de app/.
  ["app/icon.png", 192, 0.92, null],
];

for (const [out, size, ratio, bg] of jobs) {
  const buf = await icon(size, ratio, bg);
  writeFileSync(join(root, out), buf);
  console.log(`${out.padEnd(38)} ${size}px  ${(buf.length / 1024).toFixed(1)} kB`);
}
