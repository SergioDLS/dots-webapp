#!/usr/bin/env node
// Genera app/themes.generated.css y lib/theme-colors.ts desde design/themes.json.
//   node scripts/themes/build.mjs          # escribe
//   node scripts/themes/build.mjs --check  # falla (exit 1) si los generados divergen del JSON
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { renderCss, renderThemeColors } from "./render.mjs";

const root = new URL("../..", import.meta.url).pathname;
const themes = JSON.parse(readFileSync(join(root, "design/themes.json"), "utf8"));
const targets = [
  { path: join(root, "app/themes.generated.css"), content: renderCss(themes) },
  { path: join(root, "lib/theme-colors.ts"), content: renderThemeColors(themes) },
];
const check = process.argv.includes("--check");
let stale = 0;
for (const t of targets) {
  const current = existsSync(t.path) ? readFileSync(t.path, "utf8") : null;
  if (current === t.content) continue;
  if (check) {
    stale++;
    console.error(`check-themes: ${t.path.replace(root, "")} no coincide con design/themes.json — corre npm run themes:build`);
  } else {
    writeFileSync(t.path, t.content);
    console.log(`themes: escrito ${t.path.replace(root, "")}`);
  }
}
if (check && stale) process.exit(1);
if (check) console.log("check-themes: generados al día");
