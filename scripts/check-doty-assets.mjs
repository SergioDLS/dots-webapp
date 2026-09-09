#!/usr/bin/env node
// Verifica que cada src del registro de Doty existe en disco.
// --strict: además prohíbe legacy (DOTTY-POSES) y PNG huérfanos en public/images/Doty.
import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const root = new URL("..", import.meta.url).pathname;
const strict = process.argv.includes("--strict");
const registryPath = join(root, "components/ui/doty/poses.ts");
const source = existsSync(registryPath) ? readFileSync(registryPath, "utf8") : "";
const srcs = [...source.matchAll(/src:\s*"(\/images\/Doty\/[^"]+)"/g)].map((m) => m[1]);

const errors = [];
for (const src of srcs) {
  if (!existsSync(join(root, "public", src))) errors.push(`falta en disco: ${src}`);
  if (strict && src.includes("DOTTY-POSES")) errors.push(`legacy en registro: ${src}`);
}

if (strict) {
  const walk = (dir) =>
    readdirSync(dir).flatMap((n) => {
      const p = join(dir, n);
      return statSync(p).isDirectory() ? walk(p) : [p];
    });
  const referenced = new Set(srcs.map((s) => join(root, "public", s)));
  for (const f of walk(join(root, "public/images/Doty"))) {
    if (f.endsWith(".png") && !referenced.has(f)) errors.push(`huérfano: ${relative(root, f)}`);
  }
}

if (errors.length) {
  console.error(`check-doty-assets: ${errors.length} problema(s)\n  ${errors.join("\n  ")}`);
  process.exit(1);
}
console.log(`check-doty-assets: ${srcs.length} poses OK${strict ? " (strict)" : ""}`);
