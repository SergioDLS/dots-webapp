#!/usr/bin/env node
// Splash de arranque de iOS: fondo del tema claro con Doty centrado.
//
// iOS ignora el `icons` del manifest y exige un PNG por tamaño FÍSICO de
// pantalla, que elige con media queries — de ahí que haya doce y no uno.
// La lista DEVICES tiene que quedar idéntica a la de `appleWebApp.startupImage`
// en app/layout.tsx: si se añade un dispositivo, va en los dos sitios.
//
// Uso: node scripts/mj/compose-splash.mjs
import sharp from "sharp";
import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

const root = fileURLToPath(new URL("../..", import.meta.url));
// THEME_COLORS.light de lib/theme-colors.ts (ver nota en compose-icons.mjs).
const BG = { r: 0xff, g: 0xf7, b: 0xfb, alpha: 1 };
const doty = join(root, "public/icons/icon-512.png");

// [ancho CSS, alto CSS, DPR] — iPhone SE/8, 11/XR, 12–16 y Pro/Max, iPad 10.2–13"
export const DEVICES = [
  [375, 667, 2], [414, 896, 2], [414, 896, 3], [375, 812, 3],
  [390, 844, 3], [393, 852, 3], [402, 874, 3], [430, 932, 3],
  [440, 956, 3], [768, 1024, 2], [820, 1180, 2], [1024, 1366, 2],
];

mkdirSync(join(root, "public/splash"), { recursive: true });

for (const [w, h, dpr] of DEVICES) {
  const W = w * dpr;
  const H = h * dpr;
  // Doty al 32 % del lado corto: en un iPad no queda diminuto y en un SE no
  // llega a los bordes.
  const side = Math.round(Math.min(W, H) * 0.32);
  const d = await sharp(doty)
    .resize(side, side, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();
  // Un splash es un fondo plano con una figura: la paleta lo comprime mucho más
  // que RGBA y aquí no hay degradado de fondo que pueda bandear.
  const out = await sharp({ create: { width: W, height: H, channels: 4, background: BG } })
    .composite([{ input: d, gravity: "centre" }])
    .flatten({ background: BG })
    .png({ palette: true, quality: 90, effort: 10 })
    .toBuffer();
  const name = `splash-${w}x${h}@${dpr}x.png`;
  writeFileSync(join(root, "public/splash", name), out);
  console.log(`${name.padEnd(26)} ${W}x${H}  ${(out.length / 1024).toFixed(1)} kB`);
}
