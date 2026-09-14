// Funciones puras del generador de temas. Sin E/S: build.mjs las llama.
// Contrato del JSON: design/themes.json → { static, modes.{light,dark}, palettes.{id}.{label,light,dark} }.
export const DEFAULT_PALETTE = "rosa";

export function validateThemes(themes) {
  if (!themes?.palettes?.[DEFAULT_PALETTE]) throw new Error(`themes.json: falta la paleta por defecto "${DEFAULT_PALETTE}"`);
  const ref = themes.palettes[DEFAULT_PALETTE];
  for (const [id, p] of Object.entries(themes.palettes)) {
    for (const mode of ["light", "dark"]) {
      if (!p[mode]) throw new Error(`themes.json: ${id}.${mode} no existe`);
      if (!p[mode]["--background"]) throw new Error(`themes.json: ${id}.${mode} sin --background`);
      const want = Object.keys(ref[mode]).sort().join(",");
      const have = Object.keys(p[mode]).sort().join(",");
      if (want !== have) {
        const missing = Object.keys(ref[mode]).filter((k) => !(k in p[mode]));
        const extra = Object.keys(p[mode]).filter((k) => !(k in ref[mode]));
        throw new Error(`themes.json: ${id}.${mode} difiere de rosa.${mode} (faltan: ${missing.join(" ") || "-"}; sobran: ${extra.join(" ") || "-"})`);
      }
    }
    if (typeof p.label !== "string" || !p.label) throw new Error(`themes.json: ${id} sin label`);
  }
}

const decls = (obj, indent = "  ") =>
  Object.entries(obj).map(([k, v]) => `${indent}${k}: ${v};`).join("\n");

function block(selector, tokens, scheme) {
  return `${selector} {\n${decls(tokens)}\n  color-scheme: ${scheme};\n}\n`;
}

export function renderCss(themes) {
  validateThemes(themes);
  const out = [
    "/* GENERADO por scripts/themes/build.mjs a partir de design/themes.json — no editar a mano.",
    "   Paleta × modo: <html data-palette=\"rosa|electrico\" data-theme=\"light|dark\">;",
    "   sin data-theme = Auto (sigue a prefers-color-scheme). Sin data-palette = rosa. */",
    "",
  ];
  for (const [id, p] of Object.entries(themes.palettes)) {
    const isDefault = id === DEFAULT_PALETTE;
    const lightSel = isDefault ? `:root:not([data-palette]),\n:root[data-palette="${id}"]` : `:root[data-palette="${id}"]`;
    const darkSel = isDefault
      ? `:root:not([data-palette])[data-theme="dark"],\n:root[data-palette="${id}"][data-theme="dark"]`
      : `:root[data-palette="${id}"][data-theme="dark"]`;
    const autoSel = isDefault
      ? `:root:not([data-palette]):not([data-theme]),\n  :root[data-palette="${id}"]:not([data-theme])`
      : `:root[data-palette="${id}"]:not([data-theme])`;
    out.push(`/* ── ${p.label} ── */`);
    out.push(block(lightSel, { ...themes.static, ...themes.modes.light, ...p.light }, "light"));
    out.push(block(darkSel, { ...themes.modes.dark, ...p.dark }, "dark"));
    out.push(`@media (prefers-color-scheme: dark) {\n  ${block(autoSel, { ...themes.modes.dark, ...p.dark }, "dark").replace(/\n/g, "\n  ").trimEnd()}\n}\n`);
  }
  out.push(`:root[data-theme="light"] {\n  color-scheme: light;\n}\n`);
  return out.join("\n");
}

export function renderThemeColors(themes) {
  validateThemes(themes);
  const ids = Object.keys(themes.palettes);
  const rows = ids.map((id) => `  ${id}: { light: "${themes.palettes[id].light["--background"]}", dark: "${themes.palettes[id].dark["--background"]}" },`).join("\n");
  const labels = ids.map((id) => `${id}: "${themes.palettes[id].label}"`).join(", ");
  return `// GENERADO por scripts/themes/build.mjs a partir de design/themes.json — no editar a mano.
// Colores que hace falta conocer FUERA de CSS: el manifest de la PWA y la
// <meta name="theme-color"> que pintan el script anti-flash (app/layout.tsx)
// y lib/theme-prefs.ts. Es el --background de cada paleta y modo.
export const PALETTES = [${ids.map((i) => `"${i}"`).join(", ")}] as const;
export type Palette = (typeof PALETTES)[number];
export type ThemeMode = "light" | "dark";
export const PALETTE_LABELS: Record<Palette, string> = { ${labels} };
export const THEME_COLORS: Record<Palette, Record<ThemeMode, string>> = {
${rows}
};
`;
}
