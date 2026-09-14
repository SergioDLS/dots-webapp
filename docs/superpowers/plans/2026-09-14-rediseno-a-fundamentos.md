# Rediseño look & feel — Subproyecto A (fundamentos) — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dejar listos los cimientos que B–F consumen: sistema de temas paleta × modo generado desde un JSON, ajustes del usuario en el servidor (`users.settings` + `GET/PATCH /me/settings` + `streakSecuredToday`), guía de voz de Doty, catálogo de arte fase 4 con el grupo `avatars`, y tres deudas saldadas (toggle en inglés, racha en `localStorage`, fórmula de nivel duplicada).

**Architecture:** Un `design/themes.json` es la única fuente de los tokens; `scripts/themes/build.mjs` genera `app/themes.generated.css` y `lib/theme-colors.ts`, y `npm run lint` falla si divergen. En el cliente, `<html>` lleva `data-palette` y `data-theme` (ausente = Auto), un script inline anti-parpadeo lee el espejo de `localStorage`, y `ThemeSync` reconcilia con `/me/settings`. En el backend, `users.settings jsonb` guarda preferencias con merge parcial validado por lista blanca; la lógica pura vive en `src/common/user-settings.ts` y se prueba sin BD.

**Tech Stack:** Next.js 16 (app router), React 19, Tailwind 4, Node 24 (`node --test`), NestJS 11 + TypeORM + Jest 30, Python 3.12 + pytest (`scripts/mj`), PostgreSQL remota compartida (solo vía scripts con dry-run).

**Spec:** `docs/superpowers/specs/2026-09-14-rediseno-look-and-feel-juvenil-design.md` (§1, §2, §8, §10).

## Global Constraints

- Webapp: `source ~/.nvm/nvm.sh && nvm use` antes de cualquier `node`/`npm` (Node 24 por `.nvmrc`). Verificación final siempre `npm run lint` y `npx next build`.
- Backend: `npm test` (Jest, `rootDir: src`, `*.spec.ts`). El watcher `nest start --watch` de Sergio suele estar corriendo en `:4000` — no arrancar otro.
- Ramas: `redesign/a-fundamentos` en **ambos** repos, desde `main`. **Sin push a origin.** En `dots-backend` existe un `scripts/unlock-path.js` sin trackear que no es de este trabajo: no tocarlo ni commitearlo.
- Commits terminan con `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`.
- Regla 3 del CLAUDE.md: nada de `setState` síncrono dentro de `useEffect`; nada de efectos colaterales dentro de updaters.
- Regla 10: nunca copiar un PNG a mano a `public/images/Doty/`; el registro `poses.ts` es generado.
- Regla 11: cero emoji como icono en código de producto.
- Tokens que **no** cambian por paleta (spec §2.1): `--gem`, `--flame`, `--gold`, `--success`, `--danger`, `--sky-*`, la paleta de nueve colores de `lib/difficulty-palette.ts`. Doty siempre es rosa.
- Nombres de tema en UI: "Rosa" y "Eléctrico". Copy en español; inglés solo como modismo con traducción.
- Voz de Doty: hype, drama propio, picardía suave solo por inactividad; **nunca se burla de un error**; sin vulgaridad, sin chilenismos, sin franquicias por nombre en prompts de arte.
- Scripts sobre la BD compartida: dry-run por defecto, `--apply` explícito, respaldo en `scripts/out/`, `--rollback`; **pedir aprobación explícita a Sergio antes de `--apply`**. Este plan NO aplica la migración: la deja lista y probada en dry-run.

---

## Estructura de archivos

**Webapp (`dots-webapp`)**

| Archivo | Responsabilidad |
|---|---|
| `design/themes.json` (crear) | Fuente única de tokens: `static`, `modes.{light,dark}`, `palettes.{rosa,electrico}.{label,light,dark}` |
| `scripts/themes/render.mjs` (crear) | Funciones puras: `renderCss(themes)`, `renderThemeColors(themes)`, `validateThemes(themes)` |
| `scripts/themes/render.test.mjs` (crear) | Tests `node --test` de las funciones puras |
| `scripts/themes/build.mjs` (crear) | CLI: escribe los generados; `--check` compara y falla si divergen |
| `app/themes.generated.css` (generar) | Bloques `:root[data-palette=…]` claro/oscuro + fallback de media query |
| `lib/theme-colors.ts` (regenerar) | `PALETTES`, `Palette`, `THEME_COLORS[palette][mode]` |
| `lib/theme-prefs.ts` (crear) | Cliente: leer/escribir espejo, resolver Auto, aplicar atributos y `<meta theme-color>` |
| `app/globals.css` (modificar) | Quitar los tres bloques de tokens; conservar `@theme inline`, base, utilidades, keyframes |
| `app/layout.tsx` (modificar) | Importar el CSS generado; script anti-parpadeo con paleta + modo Auto |
| `app/manifest.ts` (modificar) | `THEME_COLORS.rosa.light` |
| `components/theme-toggle.tsx` (modificar) | Etiquetas en español; usa `lib/theme-prefs.ts` |
| `services/settings.service.ts` (crear) | `getMySettingsService`, `patchMySettingsService`, tipos |
| `components/theme/theme-sync.tsx` (crear) | Reconcilia espejo local con `/me/settings` |
| `app/(app)/(hub)/layout.tsx` (modificar) | Monta `<ThemeSync />` |
| `lib/level-math.ts` (crear) | `levelProgress(xp, level, xpForNextLevel)` |
| `components/shell/app-header.tsx`, `components/interactive-column/xp-level.tsx` (modificar) | Usan `levelProgress` |
| `components/interactive-column/streak/streak.tsx` (modificar) | Prop `streak`, tokens `--flame`, español |
| `app/(app)/(hub)/profile/page.tsx` (modificar) | Pasa `stats?.streak` |
| `services/engagement.service.ts` (modificar) | `MyStats.streakSecuredToday?` |
| `docs/brand/doty-identity.md` (modificar) | Sección "Humor e irreverencia" + pasos con `--emit-registry fase-1 fase-4` |
| `scripts/mj/mjlib.py` (modificar) | `EXTRA_GROUPS += avatars`; `_relative_output`; `emit_registry` acepta varios catálogos |
| `scripts/mj/process.py` (modificar) | `--emit-registry FASE [FASE ...]` |
| `scripts/mj/batches/fase-4.json` (crear) | 14 expresiones + 3 narradores + 25 avatares |
| `scripts/mj/tests/test_catalogo_fase4.py` (crear), `test_mjlib.py` (modificar) | Tests del catálogo y del registro múltiple |
| `package.json` (modificar) | `lint` suma `build.mjs --check`; `themes:build`; `test:scripts` |

**Backend (`dots-backend`)**

| Archivo | Responsabilidad |
|---|---|
| `scripts/migrate-settings.js` (crear) | `users.settings jsonb NOT NULL DEFAULT '{}'`, dry-run/apply/rollback/backup |
| `src/common/entity/users.entity.ts` (modificar) | Columna `settings` |
| `src/common/user-settings.ts` (crear) + `user-settings.spec.ts` (crear) | Tipos, `DEFAULT_SETTINGS`, `normalizeSettings`, `mergeSettings`, `isStreakSecuredToday` |
| `src/modules/me/settings.dto.ts` (crear) | `PatchSettingsDto` con class-validator |
| `src/modules/me/me.controller.ts`, `me.service.ts`, `me.dto.ts` (modificar) | `GET/PATCH /me/settings`; `streakSecuredToday` en `/me/stats` |
| `src/modules/me/me.service.spec.ts` (crear) | Tests con repositorio mockeado |
| `package.json` (modificar) | `migrate:settings` |

---

### Task 1: `design/themes.json` y el renderizador puro (TDD)

**Files:**
- Create: `design/themes.json`
- Create: `scripts/themes/render.mjs`
- Create: `scripts/themes/render.test.mjs`

**Interfaces:**
- Produces: `validateThemes(themes)` lanza `Error` si una paleta no define exactamente las mismas claves que `rosa` en `light` y en `dark`, o si falta `--background`. `renderCss(themes) → string`. `renderThemeColors(themes) → string` (contenido de `lib/theme-colors.ts`).
- JSON: `{ static: Record<token,string>, modes: { light: Record, dark: Record }, palettes: { [id]: { label: string, light: Record, dark: Record } } }`. Un bloque CSS de (paleta P, modo M) = `static` (solo en claro) + `modes[M]` + `palettes[P][M]`, más `color-scheme: M`.

- [ ] **Step 1: Crear `design/themes.json` con los valores actuales (Rosa) y Eléctrico**

```json
{
  "static": {
    "--navy": "#201a4d",
    "--navy-2": "#2c2560",
    "--navy-edge": "#14102f",
    "--purple": "var(--primary)",
    "--purple-edge": "var(--primary-edge)",
    "--primary-accent": "var(--accent)",
    "--primary-accent-contrast": "var(--accent-contrast)",
    "--sun": "var(--gold)",
    "--shadow-press": "0 4px 0",
    "--radius-md": "1rem",
    "--radius-lg": "1.5rem",
    "--radius-xl": "2rem",
    "--ease-out-strong": "cubic-bezier(0.23, 1, 0.32, 1)",
    "--ease-in-out-strong": "cubic-bezier(0.77, 0, 0.175, 1)"
  },
  "modes": {
    "light": {
      "--success": "#22c55e", "--success-soft": "#dcfce7", "--success-edge": "#16a34a",
      "--danger": "#f43f5e", "--danger-soft": "#ffe4e6", "--danger-edge": "#b72f47",
      "--gold": "#ffb020", "--gold-edge": "#bf8418",
      "--gem": "#12b5c9", "--gem-edge": "#0c8a99",
      "--flame": "#ff7a1a", "--flame-edge": "#d95f00",
      "--sky-top": "#7ec8f5", "--sky-bottom": "#cdeafd"
    },
    "dark": {
      "--navy": "#201a4d", "--navy-2": "#2c2560", "--navy-edge": "#14102f",
      "--success": "#34d399", "--success-soft": "rgba(52, 211, 153, 0.16)", "--success-edge": "#14966b",
      "--danger": "#fb7185", "--danger-soft": "rgba(251, 113, 133, 0.16)", "--danger-edge": "#bc5564",
      "--gold": "#ffc53d", "--gold-edge": "#bf942e",
      "--gem": "#35d0e2", "--gem-edge": "#159fb0",
      "--flame": "#ff9540", "--flame-edge": "#e06a10",
      "--sky-top": "#1c2c54", "--sky-bottom": "#34467a"
    }
  },
  "palettes": {
    "rosa": {
      "label": "Rosa",
      "light": {
        "--background": "#fff7fb", "--surface": "#ffffff", "--surface-2": "#fff0f7",
        "--border": "#f4dcea", "--dot": "#f4dcea",
        "--foreground": "#201a4d", "--muted": "#6a6690",
        "--primary": "var(--navy)", "--primary-contrast": "#ffffff", "--primary-edge": "var(--navy-edge)",
        "--accent": "#e5077e", "--accent-soft": "#ff64b4", "--accent-contrast": "#ffffff", "--accent-edge": "#b0005c",
        "--neutral-edge": "#e7cfdd", "--scrim": "rgba(28, 16, 48, 0.5)",
        "--shadow-card": "0 2px 0 var(--border), 0 10px 30px -12px rgba(33, 22, 80, 0.18)",
        "--input-bg": "#ffffff"
      },
      "dark": {
        "--background": "#14122e", "--surface": "#201a4d", "--surface-2": "#1b1640",
        "--border": "#332c66", "--dot": "#1b1640",
        "--foreground": "#f4f2ff", "--muted": "#b6aee0",
        "--primary": "#6a5cff", "--primary-contrast": "#ffffff", "--primary-edge": "#4a3fd0",
        "--accent": "#ff3d9e", "--accent-soft": "#ff77bf", "--accent-contrast": "#ffffff", "--accent-edge": "#c1156f",
        "--neutral-edge": "#1a0f2e", "--scrim": "rgba(0, 0, 0, 0.6)",
        "--shadow-card": "0 2px 0 var(--border), 0 10px 30px -12px rgba(0, 0, 0, 0.5)",
        "--input-bg": "rgba(255, 255, 255, 0.06)"
      }
    },
    "electrico": {
      "label": "Eléctrico",
      "light": {
        "--background": "#f4f7ff", "--surface": "#ffffff", "--surface-2": "#e9efff",
        "--border": "#d3ddff", "--dot": "#d3ddff",
        "--foreground": "#201a4d", "--muted": "#5f6a8e",
        "--primary": "var(--navy)", "--primary-contrast": "#ffffff", "--primary-edge": "var(--navy-edge)",
        "--accent": "#3768ff", "--accent-soft": "#7aa0ff", "--accent-contrast": "#ffffff", "--accent-edge": "#2447c9",
        "--neutral-edge": "#c9d4f2", "--scrim": "rgba(16, 22, 48, 0.5)",
        "--shadow-card": "0 2px 0 var(--border), 0 10px 30px -12px rgba(22, 33, 80, 0.18)",
        "--input-bg": "#ffffff"
      },
      "dark": {
        "--background": "#0d1330", "--surface": "#172046", "--surface-2": "#121a3d",
        "--border": "#2a386b", "--dot": "#121a3d",
        "--foreground": "#eef2ff", "--muted": "#a9b6e6",
        "--primary": "#35d8f5", "--primary-contrast": "#0d1330", "--primary-edge": "#1ba9c4",
        "--accent": "#5c86ff", "--accent-soft": "#8fb0ff", "--accent-contrast": "#ffffff", "--accent-edge": "#2b55d6",
        "--neutral-edge": "#0a0f26", "--scrim": "rgba(0, 0, 0, 0.6)",
        "--shadow-card": "0 2px 0 var(--border), 0 10px 30px -12px rgba(0, 0, 0, 0.5)",
        "--input-bg": "rgba(255, 255, 255, 0.06)"
      }
    }
  }
}
```

Nota: en Eléctrico oscuro `--primary` es cyan, por eso `--primary-contrast` es navy oscuro (texto sobre cyan) y no blanco. Los valores de `rosa` son los que hoy viven en `app/globals.css` (líneas 13-94 y 106-163), copiados sin cambios.

- [ ] **Step 2: Escribir los tests que fallan**

`scripts/themes/render.test.mjs`:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { renderCss, renderThemeColors, validateThemes } from "./render.mjs";

const themes = JSON.parse(readFileSync(new URL("../../design/themes.json", import.meta.url), "utf8"));

test("validateThemes acepta el JSON real", () => {
  assert.doesNotThrow(() => validateThemes(themes));
});

test("validateThemes rechaza una paleta con claves distintas a rosa", () => {
  const bad = structuredClone(themes);
  delete bad.palettes.electrico.light["--muted"];
  assert.throws(() => validateThemes(bad), /electrico\.light.*--muted/);
});

test("validateThemes exige --background en cada modo de cada paleta", () => {
  const bad = structuredClone(themes);
  delete bad.palettes.rosa.dark["--background"];
  delete bad.palettes.electrico.dark["--background"];
  assert.throws(() => validateThemes(bad), /--background/);
});

test("renderCss: rosa es la paleta por defecto cuando no hay data-palette", () => {
  const css = renderCss(themes);
  assert.match(css, /:root:not\(\[data-palette\]\),\s*:root\[data-palette="rosa"\]\s*\{[^}]*--accent: #e5077e;/);
});

test("renderCss: cada paleta tiene bloque oscuro explícito y fallback de media query", () => {
  const css = renderCss(themes);
  assert.match(css, /:root\[data-palette="electrico"\]\[data-theme="dark"\]\s*\{[^}]*--accent: #5c86ff;/);
  assert.match(css, /@media \(prefers-color-scheme: dark\)\s*\{\s*:root:not\(\[data-palette\]\):not\(\[data-theme\]\),\s*:root\[data-palette="rosa"\]:not\(\[data-theme\]\)\s*\{[^}]*--background: #14122e;/);
  assert.match(css, /:root\[data-theme="light"\]\s*\{\s*color-scheme: light;\s*\}/);
});

test("renderCss: los tokens compartidos por modo salen en las dos paletas", () => {
  const css = renderCss(themes);
  const gemDark = css.match(/--gem: #35d0e2;/g) ?? [];
  // rosa oscuro explícito + rosa fallback + electrico oscuro explícito + electrico fallback
  assert.equal(gemDark.length, 4);
});

test("renderCss lleva la marca de generado", () => {
  assert.match(renderCss(themes), /^\/\* GENERADO por scripts\/themes\/build\.mjs/);
});

test("renderThemeColors emite el mapa paleta → modo → --background", () => {
  const ts = renderThemeColors(themes);
  assert.match(ts, /export const PALETTES = \["rosa", "electrico"\] as const;/);
  assert.match(ts, /rosa: \{ light: "#fff7fb", dark: "#14122e" \}/);
  assert.match(ts, /electrico: \{ light: "#f4f7ff", dark: "#0d1330" \}/);
  assert.match(ts, /export const PALETTE_LABELS: Record<Palette, string> = \{ rosa: "Rosa", electrico: "Eléctrico" \};/);
});
```

- [ ] **Step 3: Correr los tests y ver que fallan**

Run: `source ~/.nvm/nvm.sh && nvm use && node --test scripts/themes/render.test.mjs`
Expected: FAIL con `Cannot find module '.../scripts/themes/render.mjs'`.

- [ ] **Step 4: Implementar `scripts/themes/render.mjs`**

```js
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
```

- [ ] **Step 5: Correr los tests y ver que pasan**

Run: `node --test scripts/themes/render.test.mjs`
Expected: `# pass 8`, `# fail 0`. Si el test del fallback falla por espacios, ajusta la regex del test, no el generador: el selector debe ser exactamente `:root:not([data-palette]):not([data-theme]),\n  :root[data-palette="rosa"]:not([data-theme])` dentro del `@media`.

- [ ] **Step 6: Commit**

```bash
git add design/themes.json scripts/themes/render.mjs scripts/themes/render.test.mjs
git commit -m "feat(temas): themes.json como fuente única y renderizador puro con tests

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 2: CLI `build.mjs`, archivos generados y cableado en `globals.css`, `layout.tsx`, `manifest.ts`

**Files:**
- Create: `scripts/themes/build.mjs`
- Generate: `app/themes.generated.css`, `lib/theme-colors.ts`
- Modify: `app/globals.css` (borrar líneas 13-94 y 106-212), `app/layout.tsx:1-10, 93-97`, `app/manifest.ts:35-36`, `package.json` (scripts)

**Interfaces:**
- Consumes: `renderCss`, `renderThemeColors` (Task 1).
- Produces: `lib/theme-colors.ts` exporta `PALETTES`, `Palette`, `ThemeMode`, `PALETTE_LABELS`, `THEME_COLORS`. `npm run themes:build` regenera; `npm run lint` incluye `node scripts/themes/build.mjs --check`.

- [ ] **Step 1: Escribir `scripts/themes/build.mjs`**

```js
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
```

- [ ] **Step 2: Añadir scripts a `package.json`**

En `"scripts"`, deja `lint` así y añade dos entradas:

```json
"lint": "eslint && node scripts/check-doty-assets.mjs --strict && node scripts/check-icons.mjs && node scripts/themes/build.mjs --check",
"themes:build": "node scripts/themes/build.mjs",
"test:scripts": "node --test scripts/themes/render.test.mjs",
```

- [ ] **Step 3: Generar los archivos**

Run: `npm run themes:build`
Expected: dos líneas `themes: escrito app/themes.generated.css` y `themes: escrito lib/theme-colors.ts`. Abre `lib/theme-colors.ts` y confirma que exporta `THEME_COLORS.rosa.light === "#fff7fb"`.

- [ ] **Step 4: Recortar `app/globals.css`**

Borra el bloque `:root { … }` completo (líneas 13-94, desde el comentario `/* ─── Light theme ───` inclusive) y todo lo que va desde `/* ─── Dark theme ───` (línea 106) hasta el cierre del `@media (prefers-color-scheme: dark) { … }` (línea 212). **Conserva** el `@theme inline { … }` (líneas 96-103) y todo lo que sigue a `/* ─── Base ───`. Sustituye el comentario borrado de la cabecera por:

```css
/* Los tokens de color viven en design/themes.json y se generan en
   app/themes.generated.css (npm run themes:build), que app/layout.tsx importa
   antes que este archivo. Aquí solo quedan el puente de Tailwind, la base,
   las utilidades y los keyframes. */
```

Comprueba con `grep -n "data-theme\|prefers-color-scheme" app/globals.css`: no debe quedar ningún bloque de tokens (solo, si acaso, el `@media (prefers-reduced-motion)` del final).

- [ ] **Step 5: Importar el CSS generado y reescribir el script anti-parpadeo en `app/layout.tsx`**

Junto al `import "./globals.css"` existente, añade **antes** `import "./themes.generated.css";`. Sustituye el `<script dangerouslySetInnerHTML=…>` (línea 93-97) por:

```tsx
<script
  dangerouslySetInnerHTML={{
    __html: `(function(){try{var d=document.documentElement;var C=${JSON.stringify(THEME_COLORS)};var p=localStorage.getItem("dots-palette");if(!C[p])p="rosa";var m=localStorage.getItem("dots-theme");if(m!=="light"&&m!=="dark")m="auto";d.setAttribute("data-palette",p);if(m==="auto"){d.removeAttribute("data-theme");}else{d.setAttribute("data-theme",m);}var r=m==="auto"?(window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"):m;d.classList.toggle("dark",r==="dark");d.style.colorScheme=r;var olds=document.querySelectorAll('meta[name="theme-color"]');for(var i=0;i<olds.length;i++)olds[i].remove();var t=document.createElement("meta");t.setAttribute("name","theme-color");t.setAttribute("content",C[p][r]);document.head.appendChild(t);}catch(e){}})();`,
  }}
/>
```

Actualiza el comentario de las líneas 60-92 para decir que los colores salen de `THEME_COLORS` (generado) y que el modo Auto no pone `data-theme`. Usuarios con `dots-theme` guardado en `light`/`dark` conservan su modo; sin nada guardado el modo es Auto (antes era `light`).

- [ ] **Step 6: `app/manifest.ts`**

Cambia `THEME_COLORS.light` por `THEME_COLORS.rosa.light` en `background_color` y `theme_color` (líneas 35-36). El manifest no conoce al usuario: siempre Rosa claro.

- [ ] **Step 7: Verificar**

Run: `npm run lint && npx tsc --noEmit`
Expected: lint pasa incluyendo `check-themes: generados al día`. `tsc` fallará solo en `components/theme-toggle.tsx` por `THEME_COLORS[resolved]` (se arregla en Task 3); si falla en otro sitio, corrígelo aquí.

- [ ] **Step 8: Commit**

```bash
git add scripts/themes/build.mjs app/themes.generated.css lib/theme-colors.ts app/globals.css app/layout.tsx app/manifest.ts package.json
git commit -m "feat(temas): CSS y theme-colors generados desde themes.json; paleta y modo Auto en el anti-flash

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 3: `lib/theme-prefs.ts` y el toggle en español

**Files:**
- Create: `lib/theme-prefs.ts`
- Modify: `components/theme-toggle.tsx` (reescribir completo)

**Interfaces:**
- Produces: `type ThemePrefs = { palette: Palette; mode: "light" | "dark" | "auto" }`; `readMirror(): ThemePrefs`; `writeMirror(p: ThemePrefs): void`; `resolveMode(mode): "light" | "dark"`; `applyThemePrefs(p: ThemePrefs): void` (mismo efecto que el script anti-parpadeo). Los consume `ThemeSync` (Task 7) y, en el subproyecto D, la hoja de ajustes.

- [ ] **Step 1: Escribir `lib/theme-prefs.ts`**

```ts
"use client";

import { PALETTES, THEME_COLORS, type Palette } from "@/lib/theme-colors";

export type ThemeMode = "light" | "dark" | "auto";
export type ThemePrefs = { palette: Palette; mode: ThemeMode };

/** Claves del espejo local. El servidor (/me/settings) es la fuente de verdad;
 *  esto solo evita el parpadeo del primer paint (lo lee el script inline de
 *  app/layout.tsx con los mismos defaults). */
export const PALETTE_KEY = "dots-palette";
export const MODE_KEY = "dots-theme";
export const DEFAULT_PREFS: ThemePrefs = { palette: "rosa", mode: "auto" };

const isPalette = (v: unknown): v is Palette =>
  typeof v === "string" && (PALETTES as readonly string[]).includes(v);
const isMode = (v: unknown): v is ThemeMode =>
  v === "light" || v === "dark" || v === "auto";

export function readMirror(): ThemePrefs {
  if (typeof window === "undefined") return DEFAULT_PREFS;
  try {
    const p = window.localStorage.getItem(PALETTE_KEY);
    const m = window.localStorage.getItem(MODE_KEY);
    return {
      palette: isPalette(p) ? p : DEFAULT_PREFS.palette,
      mode: isMode(m) ? m : DEFAULT_PREFS.mode,
    };
  } catch {
    return DEFAULT_PREFS;
  }
}

export function writeMirror(prefs: ThemePrefs): void {
  try {
    window.localStorage.setItem(PALETTE_KEY, prefs.palette);
    window.localStorage.setItem(MODE_KEY, prefs.mode);
  } catch {
    /* modo privado o storage lleno: el servidor sigue teniendo la verdad */
  }
}

export function resolveMode(mode: ThemeMode): "light" | "dark" {
  if (mode !== "auto") return mode;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

/** Aplica paleta y modo al documento. Debe hacer exactamente lo mismo que el
 *  script anti-parpadeo de app/layout.tsx: si cambias uno, cambia el otro. */
export function applyThemePrefs(prefs: ThemePrefs): void {
  const root = document.documentElement;
  root.setAttribute("data-palette", prefs.palette);
  if (prefs.mode === "auto") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", prefs.mode);
  const resolved = resolveMode(prefs.mode);
  root.classList.toggle("dark", resolved === "dark");
  root.style.colorScheme = resolved;
  document.querySelectorAll('meta[name="theme-color"]').forEach((el) => el.remove());
  const meta = document.createElement("meta");
  meta.setAttribute("name", "theme-color");
  meta.setAttribute("content", THEME_COLORS[prefs.palette][resolved]);
  document.head.appendChild(meta);
}
```

- [ ] **Step 2: Reescribir `components/theme-toggle.tsx`**

Sigue siendo binario claro/oscuro (la hoja de ajustes del subproyecto D lo reemplaza); solo cambia a español y usa la librería. Conserva la paleta que el usuario ya tenga en el espejo.

```tsx
"use client";

import { useEffect, useState } from "react";
import { Icon, type IconName } from "@/components/ui/icon";
import { applyThemePrefs, readMirror, resolveMode, writeMirror } from "@/lib/theme-prefs";

type Resolved = "light" | "dark";

const label: Record<Resolved, string> = { light: "Tema claro", dark: "Tema oscuro" };
const icon: Record<Resolved, IconName> = { light: "sol", dark: "luna" };

export default function ThemeToggle() {
  const [mode, setMode] = useState<Resolved>(() =>
    typeof window === "undefined" ? "light" : resolveMode(readMirror().mode),
  );

  useEffect(() => {
    const prefs = { palette: readMirror().palette, mode };
    applyThemePrefs(prefs);
  }, [mode]);

  const toggle = () => {
    const next: Resolved = mode === "light" ? "dark" : "light";
    setMode(next);
    writeMirror({ palette: readMirror().palette, mode: next });
  };

  return (
    <button
      type="button"
      onClick={toggle}
      title={`${label[mode]} — toca para cambiar`}
      className="w-full rounded-xl border border-(--border) px-4 py-2 text-sm font-semibold text-(--muted) transition-all duration-200 hover:border-(--accent) hover:text-(--accent) hover:bg-(--accent)/8 focus:outline-none flex items-center justify-between gap-2"
    >
      <span className="inline-flex items-center gap-1.5">
        <Icon name={icon[mode]} size={16} /> {label[mode]}
      </span>
    </button>
  );
}
```

- [ ] **Step 3: Verificar**

Run: `npx tsc --noEmit && npm run lint`
Expected: ambos limpios. Después `npm run dev` (o `preview_start {name:"dots-webapp"}`), abre `/profile` y comprueba con `document.documentElement.dataset` que el toggle alterna `data-theme` entre `light` y `dark`, conserva `data-palette="rosa"` y que existe exactamente una `<meta name="theme-color">` con `#fff7fb` o `#14122e`.

- [ ] **Step 4: Commit**

```bash
git add lib/theme-prefs.ts components/theme-toggle.tsx
git commit -m "feat(temas): lib/theme-prefs y toggle en español que respeta la paleta

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 4: `lib/level-math.ts`, racha del perfil sin `localStorage` y `MyStats.streakSecuredToday`

**Files:**
- Create: `lib/level-math.ts`
- Modify: `components/shell/app-header.tsx:29-33`, `components/interactive-column/xp-level.tsx:18-23`
- Modify: `components/interactive-column/streak/streak.tsx` (reescribir), `app/(app)/(hub)/profile/page.tsx:8,153`
- Modify: `services/engagement.service.ts:139-151`

**Interfaces:**
- Produces: `levelProgress(xp: number, level: number, xpForNextLevel: number): { levelStart: number; span: number; pct: number }`. `Streak` pasa a `({ streak }: { streak: number })`. `MyStats` gana `streakSecuredToday?: boolean` (el backend lo emite desde Task 6; opcional para no romper mientras el `:4000` no se redespliegue).

- [ ] **Step 1: Escribir `lib/level-math.ts`**

```ts
/**
 * Fórmula de nivel (contrato del backend, me.service.ts):
 *   level = floor(sqrt(xp / 100)) + 1, el nivel actual empieza en 100·(level-1)²
 *   y xpForNextLevel = 100·level².
 * Única implementación en el frontend: HUD, perfil y cualquier barra de XP.
 */
export type LevelProgress = { levelStart: number; span: number; pct: number };

export function levelProgress(xp: number, level: number, xpForNextLevel: number): LevelProgress {
  const levelStart = 100 * (level - 1) * (level - 1);
  const span = Math.max(1, xpForNextLevel - levelStart);
  const pct = Math.min(100, Math.max(0, Math.round(((xp - levelStart) / span) * 100)));
  return { levelStart, span, pct };
}
```

- [ ] **Step 2: Usarla en el HUD y en `XpLevel`**

En `components/shell/app-header.tsx` sustituye las líneas 29-33 por:

```ts
const { pct } = stats ? levelProgress(stats.xp, stats.level, stats.xpForNextLevel) : { pct: 0 };
```

y añade `import { levelProgress } from "@/lib/level-math";`. En `components/interactive-column/xp-level.tsx` sustituye las líneas 18-23 por:

```ts
const { pct } = levelProgress(stats.xp, stats.level, stats.xpForNextLevel);
```

con el mismo import. Borra los comentarios de fórmula duplicados de ambos archivos y deja uno que apunte a `lib/level-math.ts`.

- [ ] **Step 3: Reescribir `components/interactive-column/streak/streak.tsx`**

```tsx
import { UiIcon } from "@/components/ui/ui-icon";

/** Chip de racha del perfil. Lee la racha real (MyStats.streak): el valor de
 *  localStorage["streak"] que usaba antes era el contador de aciertos seguidos
 *  de la práctica, otra cosa. */
export default function Streak({ streak }: { streak: number }) {
  const dias = streak === 1 ? "día" : "días";
  return (
    <div
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-extrabold text-xs"
      style={{
        background: "color-mix(in srgb, var(--flame) 14%, transparent)",
        border: "1.5px solid color-mix(in srgb, var(--flame) 38%, transparent)",
        color: "var(--flame-edge)",
      }}
      title="Racha diaria"
    >
      <UiIcon name="racha" size={16} />
      <span className="tabular-nums">
        {streak} {dias} de racha
      </span>
    </div>
  );
}
```

En `app/(app)/(hub)/profile/page.tsx` línea 153 cambia `<Streak />` por `<Streak streak={stats?.streak ?? 0} />` (`stats` ya existe en ese componente: es el que recibe `XpLevel`).

- [ ] **Step 4: Ampliar `MyStats`**

En `services/engagement.service.ts`, dentro de `MyStats`, después de `gems?: number;` añade:

```ts
  /** true si la racha de hoy (día Santiago) ya está asegurada. Lo emite el backend desde el subproyecto A. */
  streakSecuredToday?: boolean;
```

- [ ] **Step 5: Verificar**

Run: `npx tsc --noEmit && npm run lint && grep -rn 'localStorage.getItem("streak")' app components`
Expected: limpio, y el grep no devuelve `components/interactive-column/streak/streak.tsx` (solo, si acaso, `app/(app)/practice/page.tsx`, que escribe ese valor para otra cosa y queda igual).

- [ ] **Step 6: Commit**

```bash
git add lib/level-math.ts components/shell/app-header.tsx components/interactive-column/xp-level.tsx components/interactive-column/streak/streak.tsx "app/(app)/(hub)/profile/page.tsx" services/engagement.service.ts
git commit -m "refactor(hud): fórmula de nivel única y chip de racha con datos reales y tokens

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 5 (backend): módulo puro `user-settings.ts` con tests, entidad y migración

**Files (en `dots-backend`, rama `redesign/a-fundamentos` creada desde `main`):**
- Create: `src/common/user-settings.ts`
- Create: `src/common/user-settings.spec.ts`
- Modify: `src/common/entity/users.entity.ts` (después de `xpBoostUntil`, línea 87)
- Create: `scripts/migrate-settings.js`
- Modify: `package.json` (scripts)

**Interfaces:**
- Produces: `PALETTES = ['rosa','electrico']`, `MODES = ['light','dark','auto']`, `type UserSettings = { palette; mode; sound: boolean; avatar_key: string | null; onboarded_at: string | null; tips_seen: string[] }`, `DEFAULT_SETTINGS`, `normalizeSettings(raw: unknown): UserSettings`, `type SettingsPatch = { palette?; mode?; sound?; onboarded?: boolean; tips_seen?: string[] }`, `mergeSettings(current, patch, now: Date): UserSettings`, `isStreakSecuredToday(lastStreakDay, today: string): boolean`. `avatar_key` NO se escribe por PATCH: lo escribe `POST /me/avatar` en el subproyecto E.

- [ ] **Step 1: Crear la rama del backend**

```bash
cd /home/endurance/Projects/Endurance/dots/dots-backend && git checkout -b redesign/a-fundamentos main && git status --short
```

Expected: solo `?? scripts/unlock-path.js` (ajeno; no tocar).

- [ ] **Step 2: Escribir los tests que fallan — `src/common/user-settings.spec.ts`**

```ts
import {
  DEFAULT_SETTINGS,
  isStreakSecuredToday,
  mergeSettings,
  normalizeSettings,
} from './user-settings';

const NOW = new Date('2026-09-14T15:00:00.000Z');

describe('normalizeSettings', () => {
  it('rellena los defaults cuando la columna está vacía', () => {
    expect(normalizeSettings({})).toEqual(DEFAULT_SETTINGS);
    expect(normalizeSettings(null)).toEqual(DEFAULT_SETTINGS);
  });

  it('descarta claves desconocidas y valores fuera de lista', () => {
    const out = normalizeSettings({
      palette: 'verde',
      mode: 'dark',
      sound: 'yes',
      foo: 1,
      tips_seen: ['camino.racha', 42],
    });
    expect(out).toEqual({
      ...DEFAULT_SETTINGS,
      mode: 'dark',
      tips_seen: ['camino.racha'],
    });
  });
});

describe('mergeSettings', () => {
  it('aplica un parche parcial sin tocar el resto', () => {
    const out = mergeSettings(DEFAULT_SETTINGS, { palette: 'electrico', sound: false }, NOW);
    expect(out.palette).toBe('electrico');
    expect(out.sound).toBe(false);
    expect(out.mode).toBe('auto');
  });

  it('tips_seen acumula sin duplicar', () => {
    const cur = { ...DEFAULT_SETTINGS, tips_seen: ['camino.primer-nivel'] };
    const out = mergeSettings(cur, { tips_seen: ['camino.racha', 'camino.primer-nivel'] }, NOW);
    expect(out.tips_seen).toEqual(['camino.primer-nivel', 'camino.racha']);
  });

  it('onboarded estampa onboarded_at una sola vez', () => {
    const first = mergeSettings(DEFAULT_SETTINGS, { onboarded: true }, NOW);
    expect(first.onboarded_at).toBe('2026-09-14T15:00:00.000Z');
    const later = mergeSettings(first, { onboarded: true }, new Date('2026-10-01T00:00:00.000Z'));
    expect(later.onboarded_at).toBe('2026-09-14T15:00:00.000Z');
  });

  it('no muta el objeto original', () => {
    const cur = { ...DEFAULT_SETTINGS };
    mergeSettings(cur, { mode: 'light' }, NOW);
    expect(cur.mode).toBe('auto');
  });
});

describe('isStreakSecuredToday', () => {
  it('true solo si el último día de racha es hoy (Santiago)', () => {
    expect(isStreakSecuredToday('2026-09-14', '2026-09-14')).toBe(true);
    expect(isStreakSecuredToday('2026-09-13', '2026-09-14')).toBe(false);
    expect(isStreakSecuredToday(null, '2026-09-14')).toBe(false);
  });

  it('acepta el Date que devuelve el driver para columnas date', () => {
    // 2026-09-14 03:00 UTC = 2026-09-13 23:00 en Santiago (UTC-4)
    expect(isStreakSecuredToday(new Date('2026-09-14T03:00:00.000Z'), '2026-09-13')).toBe(true);
  });
});
```

- [ ] **Step 3: Correr y ver que falla**

Run: `npm test -- user-settings`
Expected: FAIL, `Cannot find module './user-settings'`.

- [ ] **Step 4: Escribir `src/common/user-settings.ts`**

```ts
import { normalizeDay } from './santiago-day';

/**
 * Preferencias del usuario (columna users.settings jsonb). Lógica pura, sin
 * BD, para que el merge y la validación se prueben solos. Contrato con el
 * frontend: lib/theme-prefs.ts y services/settings.service.ts en dots-webapp.
 */
export const PALETTES = ['rosa', 'electrico'] as const;
export const MODES = ['light', 'dark', 'auto'] as const;
export type Palette = (typeof PALETTES)[number];
export type ThemeMode = (typeof MODES)[number];

export type UserSettings = {
  palette: Palette;
  mode: ThemeMode;
  sound: boolean;
  /** Clave del shop_item de tipo avatar equipado; lo escribe POST /me/avatar (subproyecto E). */
  avatar_key: string | null;
  /** ISO-8601; null hasta que el usuario termina o salta el primer inicio. */
  onboarded_at: string | null;
  /** Pistas de Doty ya vistas, p. ej. "camino.primer-nivel". */
  tips_seen: string[];
};

export const DEFAULT_SETTINGS: UserSettings = {
  palette: 'rosa',
  mode: 'auto',
  sound: true,
  avatar_key: null,
  onboarded_at: null,
  tips_seen: [],
};

export type SettingsPatch = {
  palette?: Palette;
  mode?: ThemeMode;
  sound?: boolean;
  onboarded?: boolean;
  /** Claves a AÑADIR a tips_seen (unión, nunca reemplazo). */
  tips_seen?: string[];
};

const isPalette = (v: unknown): v is Palette =>
  typeof v === 'string' && (PALETTES as readonly string[]).includes(v);
const isMode = (v: unknown): v is ThemeMode =>
  typeof v === 'string' && (MODES as readonly string[]).includes(v);
const asStringList = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];

/** Lee lo que haya en la columna y devuelve siempre un objeto completo y válido. */
export function normalizeSettings(raw: unknown): UserSettings {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  return {
    palette: isPalette(r.palette) ? r.palette : DEFAULT_SETTINGS.palette,
    mode: isMode(r.mode) ? r.mode : DEFAULT_SETTINGS.mode,
    sound: typeof r.sound === 'boolean' ? r.sound : DEFAULT_SETTINGS.sound,
    avatar_key: typeof r.avatar_key === 'string' ? r.avatar_key : null,
    onboarded_at: typeof r.onboarded_at === 'string' ? r.onboarded_at : null,
    tips_seen: asStringList(r.tips_seen),
  };
}

export function mergeSettings(
  current: UserSettings,
  patch: SettingsPatch,
  now: Date,
): UserSettings {
  const next: UserSettings = { ...current, tips_seen: [...current.tips_seen] };
  if (patch.palette !== undefined) next.palette = patch.palette;
  if (patch.mode !== undefined) next.mode = patch.mode;
  if (patch.sound !== undefined) next.sound = patch.sound;
  if (patch.onboarded && next.onboarded_at === null) next.onboarded_at = now.toISOString();
  if (patch.tips_seen) {
    for (const key of patch.tips_seen) {
      if (!next.tips_seen.includes(key)) next.tips_seen.push(key);
    }
  }
  return next;
}

/** La llama del HUD se enciende si la racha ya se aseguró hoy (día Santiago). */
export function isStreakSecuredToday(
  lastStreakDay: string | Date | null | undefined,
  today: string,
): boolean {
  return normalizeDay(lastStreakDay) === today;
}
```

- [ ] **Step 5: Correr y ver que pasa**

Run: `npm test -- user-settings`
Expected: 8 tests en verde.

- [ ] **Step 6: Columna en la entidad**

En `src/common/entity/users.entity.ts`, tras `xpBoostUntil` (línea 87), añade:

```ts
  // Preferencias de UI y estado del primer inicio; ver src/common/user-settings.ts.
  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
  settings: Record<string, unknown>;
```

- [ ] **Step 7: Script de migración `scripts/migrate-settings.js`**

```js
#!/usr/bin/env node
/**
 * Additive migration: users.settings jsonb (preferencias de UI, primer inicio,
 * pistas vistas). Nada se borra ni se reescribe.
 *
 * Usage (from dots-backend/):
 *   node scripts/migrate-settings.js            # dry-run
 *   node scripts/migrate-settings.js --apply    # DDL, backup en scripts/out/
 *   node scripts/migrate-settings.js --rollback scripts/out/backup-settings-<ts>.json
 */
/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require('fs');
const path = require('path');
require('dotenv').config();
const { Client } = require('pg');

const OUT_DIR = path.join(__dirname, 'out');
const DDL = [
  `ALTER TABLE dots.users ADD COLUMN IF NOT EXISTS settings jsonb NOT NULL DEFAULT '{}'::jsonb`,
];

async function connect() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();
  return client;
}

async function columnExists(client, table, column) {
  const res = await client.query(
    `SELECT 1 FROM information_schema.columns WHERE table_schema='dots' AND table_name=$1 AND column_name=$2`,
    [table, column],
  );
  return res.rows.length > 0;
}

async function rollback(client, backup) {
  // Igual que migrate-economy: la columna añadida se deja inerte (no se dropea
  // una columna de users en producción desde un script); se registra.
  for (const c of backup.addedColumns ?? []) {
    console.log(`rollback: la columna ${c.table}.${c.column} queda inerte (no se dropea)`);
  }
  console.log('Rollback complete (nada que deshacer más allá de lo registrado).');
}

async function main() {
  const args = process.argv.slice(2);
  const apply = args.includes('--apply');
  const rollbackIdx = args.indexOf('--rollback');
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const client = await connect();
  try {
    if (rollbackIdx !== -1) {
      const backupFile = args[rollbackIdx + 1];
      if (!backupFile) throw new Error('Usage: --rollback <backup.json>');
      await rollback(client, JSON.parse(fs.readFileSync(backupFile, 'utf8')));
      return;
    }
    const before = await columnExists(client, 'users', 'settings');
    console.log('== settings migration ==');
    console.log(`users.settings: ${before ? 'exists' : 'will be added'}`);
    if (!apply) {
      console.log('\nDry-run only. Re-run with --apply to execute.');
      return;
    }
    const backup = {
      script: 'migrate-settings',
      timestamp: new Date().toISOString(),
      addedColumns: before ? [] : [{ table: 'users', column: 'settings' }],
    };
    for (const sql of DDL) {
      await client.query(sql);
      console.log('OK:', sql.replace(/\s+/g, ' ').slice(0, 80));
    }
    const backupFile = path.join(OUT_DIR, `backup-settings-${Date.now()}.json`);
    fs.writeFileSync(backupFile, JSON.stringify(backup, null, 2));
    console.log(`\nBackup written: ${backupFile}`);
    if (!(await columnExists(client, 'users', 'settings'))) {
      throw new Error('Verification failed: users.settings missing');
    }
    console.log('Migration verified OK.');
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
```

Antes de escribirlo, abre `scripts/migrate-economy.js` líneas 60-100 y copia **literalmente** su función `connect()` (la forma de construir el `Client` con las variables de `.env` que use ese script) en lugar de la de arriba si difiere: la conexión debe ser idéntica a la de los scripts que ya funcionan contra la BD.

En `package.json` añade `"migrate:settings": "node scripts/migrate-settings.js",` junto a los demás `migrate:*`.

- [ ] **Step 8: Dry-run (solo lectura) y build**

Run: `npm run migrate:settings && npm run build`
Expected: `users.settings: will be added` y `Dry-run only…`; build limpio. **No ejecutar `--apply`**: eso lo autoriza Sergio al final del subproyecto.

- [ ] **Step 9: Commit**

```bash
git add src/common/user-settings.ts src/common/user-settings.spec.ts src/common/entity/users.entity.ts scripts/migrate-settings.js package.json
git commit -m "feat(settings): users.settings jsonb, módulo puro de preferencias con tests y migración en dry-run

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 6 (backend): `GET/PATCH /me/settings` y `streakSecuredToday` en `/me/stats`

**Files:**
- Create: `src/modules/me/settings.dto.ts`
- Modify: `src/modules/me/me.dto.ts` (`MeStatsDto`), `src/modules/me/me.controller.ts`, `src/modules/me/me.service.ts`
- Create: `src/modules/me/me.service.spec.ts`

**Interfaces:**
- Consumes: `normalizeSettings`, `mergeSettings`, `isStreakSecuredToday`, `UserSettings`, `SettingsPatch` (Task 5); `santiagoToday` (`src/common/santiago-day.ts`).
- Produces: `GET /me/settings → UserSettings`; `PATCH /me/settings` body `PatchSettingsDto` → `UserSettings`; `MeStatsDto.streakSecuredToday: boolean`. Claves desconocidas en el PATCH → 400 (`forbidNonWhitelisted`).

- [ ] **Step 1: Tests del servicio que fallan — `src/modules/me/me.service.spec.ts`**

```ts
import { HttpException } from '@nestjs/common';
import { MeService } from './me.service';
import { DEFAULT_SETTINGS } from '../../common/user-settings';

function makeService(user: Record<string, unknown> | null) {
  const usersRepository = {
    findOne: jest.fn().mockResolvedValue(user),
    update: jest.fn().mockResolvedValue({ affected: 1 }),
    manager: { query: jest.fn().mockResolvedValue([{ gems: '5' }]) },
  };
  const userGameScoresRepository = { find: jest.fn().mockResolvedValue([]) };
  const dailyUseRepository = { find: jest.fn().mockResolvedValue([]) };
  const service = new MeService(
    usersRepository as never,
    userGameScoresRepository as never,
    dailyUseRepository as never,
  );
  return { service, usersRepository };
}

describe('MeService settings', () => {
  it('getSettings devuelve defaults cuando la columna está vacía', async () => {
    const { service } = makeService({ id: 1, settings: {} });
    await expect(service.getSettings(1)).resolves.toEqual(DEFAULT_SETTINGS);
  });

  it('getSettings 404 si el usuario no existe', async () => {
    const { service } = makeService(null);
    await expect(service.getSettings(1)).rejects.toBeInstanceOf(HttpException);
  });

  it('patchSettings mezcla, persiste y devuelve el resultado', async () => {
    const { service, usersRepository } = makeService({ id: 1, settings: { palette: 'rosa', tips_seen: ['a'] } });
    const out = await service.patchSettings(1, { palette: 'electrico', tips_seen: ['b'] });
    expect(out.palette).toBe('electrico');
    expect(out.tips_seen).toEqual(['a', 'b']);
    expect(usersRepository.update).toHaveBeenCalledWith({ id: 1 }, { settings: out });
  });
});

describe('MeService getStats.streakSecuredToday', () => {
  const base = { id: 1, xp: 0, streak: 3, streakFreezes: 0, bestStreak: 3, xpWeek: 0, weekStart: null };

  it('true cuando last_streak_day es hoy', async () => {
    const { service } = makeService({ ...base, lastStreakDay: service_today() });
    const stats = await service.getStats(1);
    expect(stats.streakSecuredToday).toBe(true);
  });

  it('false cuando la racha no se aseguró hoy', async () => {
    const { service } = makeService({ ...base, lastStreakDay: '2000-01-01' });
    const stats = await service.getStats(1);
    expect(stats.streakSecuredToday).toBe(false);
  });
});

function service_today(): string {
  // Mismo helper que usa el servicio; evita fijar una fecha que caduque.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('../../common/santiago-day').santiagoToday();
}
```

- [ ] **Step 2: Correr y ver que falla**

Run: `npm test -- me.service`
Expected: FAIL por `getSettings is not a function` / `streakSecuredToday` undefined.

- [ ] **Step 3: DTO `src/modules/me/settings.dto.ts`**

```ts
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { MODES, PALETTES } from '../../common/user-settings';

/** Cuerpo de PATCH /me/settings: merge parcial. Claves fuera de esta lista → 400. */
export class PatchSettingsDto {
  @IsOptional()
  @IsIn(PALETTES)
  palette?: (typeof PALETTES)[number];

  @IsOptional()
  @IsIn(MODES)
  mode?: (typeof MODES)[number];

  @IsOptional()
  @IsBoolean()
  sound?: boolean;

  /** true estampa onboarded_at (una sola vez). */
  @IsOptional()
  @IsBoolean()
  onboarded?: boolean;

  /** Pistas vistas a añadir (unión). */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  @MaxLength(60, { each: true })
  tips_seen?: string[];
}
```

- [ ] **Step 4: `MeStatsDto` y servicio**

En `me.dto.ts`, dentro de `MeStatsDto` tras `gems: number;`:

```ts
  // La llama del HUD: true si la racha ya se aseguró hoy (día Santiago).
  streakSecuredToday: boolean;
```

En `me.service.ts`: importa `isStreakSecuredToday, mergeSettings, normalizeSettings, type SettingsPatch, type UserSettings` desde `'src/common/user-settings'`. En `getStats`, al objeto de retorno añade `streakSecuredToday: isStreakSecuredToday(user.lastStreakDay, santiagoToday()),`. Añade al final de la clase:

```ts
  // ── Settings ─────────────────────────────────────────────────────────────
  async getSettings(userId: number): Promise<UserSettings> {
    const user = await this.usersRepository.findOne({ where: { id: userId } });
    if (!user) throw new HttpException('User not found', 404);
    return normalizeSettings(user.settings);
  }

  async patchSettings(userId: number, patch: SettingsPatch): Promise<UserSettings> {
    const user = await this.usersRepository.findOne({ where: { id: userId } });
    if (!user) throw new HttpException('User not found', 404);
    const next = mergeSettings(normalizeSettings(user.settings), patch, new Date());
    await this.usersRepository.update({ id: userId }, { settings: next });
    return next;
  }
```

- [ ] **Step 5: Controlador**

En `me.controller.ts` añade a los imports de `@nestjs/common`: `Body, Patch, UsePipes, ValidationPipe`; importa `PatchSettingsDto` y `type UserSettings`. Añade:

```ts
  /** Preferencias de UI y estado del primer inicio. */
  @Get('settings')
  getSettings(@CurrentUser() user: AuthUser): Promise<UserSettings> {
    return this.meService.getSettings(user.id);
  }

  /** Merge parcial. Claves desconocidas → 400 (forbidNonWhitelisted). */
  @Patch('settings')
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }))
  patchSettings(
    @CurrentUser() user: AuthUser,
    @Body() body: PatchSettingsDto,
  ): Promise<UserSettings> {
    return this.meService.patchSettings(user.id, body);
  }
```

- [ ] **Step 6: Correr todo**

Run: `npm test && npm run build && npm run lint`
Expected: todos los specs en verde (los 128 previos + los nuevos), build y lint limpios. Si el watcher de Sergio está corriendo en `:4000`, comprueba a mano con el token de una sesión: `curl -H "Authorization: Bearer $T" http://localhost:4000/me/settings` devuelve los defaults, y un `PATCH` con `{"foo":1}` responde 400.

- [ ] **Step 7: Commit**

```bash
git add src/modules/me/settings.dto.ts src/modules/me/me.dto.ts src/modules/me/me.controller.ts src/modules/me/me.service.ts src/modules/me/me.service.spec.ts
git commit -m "feat(me): GET/PATCH /me/settings con lista blanca y streakSecuredToday en /me/stats

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 7: `services/settings.service.ts` y `ThemeSync` en el hub

**Files (webapp):**
- Create: `services/settings.service.ts`
- Create: `components/theme/theme-sync.tsx`
- Modify: `app/(app)/(hub)/layout.tsx:23`

**Interfaces:**
- Consumes: `readMirror`, `writeMirror`, `applyThemePrefs` (Task 3); endpoints de Task 6.
- Produces: `type UserSettings`, `type SettingsPatch`, `getMySettingsService(): Promise<UserSettings | null>`, `patchMySettingsService(patch): Promise<UserSettings>` (lanza). D y F los consumen.

- [ ] **Step 1: `services/settings.service.ts`**

```ts
import api from "@/lib/api-client";
import type { Palette } from "@/lib/theme-colors";
import type { ThemeMode } from "@/lib/theme-prefs";

/** Espejo del contrato del backend: src/common/user-settings.ts. */
export type UserSettings = {
  palette: Palette;
  mode: ThemeMode;
  sound: boolean;
  avatar_key: string | null;
  onboarded_at: string | null;
  tips_seen: string[];
};

export type SettingsPatch = {
  palette?: Palette;
  mode?: ThemeMode;
  sound?: boolean;
  /** true estampa onboarded_at una sola vez. */
  onboarded?: boolean;
  /** Claves a añadir a tips_seen. */
  tips_seen?: string[];
};

/** null si no hay sesión o el backend aún no expone el endpoint: el shell no se rompe. */
export async function getMySettingsService(): Promise<UserSettings | null> {
  try {
    const { data } = await api.get<UserSettings>("/me/settings");
    return data;
  } catch {
    return null;
  }
}

export async function patchMySettingsService(patch: SettingsPatch): Promise<UserSettings> {
  const { data } = await api.patch<UserSettings>("/me/settings", patch);
  return data;
}
```

- [ ] **Step 2: `components/theme/theme-sync.tsx`**

```tsx
"use client";

import { useEffect } from "react";
import { getMySettingsService } from "@/services/settings.service";
import { applyThemePrefs, readMirror, writeMirror } from "@/lib/theme-prefs";

/**
 * El primer paint usa el espejo de localStorage (script inline de app/layout.tsx).
 * Aquí se reconcilia con el servidor: si /me/settings difiere, se aplica y se
 * reescribe el espejo. Sin estado ni setState (regla 3): solo un efecto.
 */
export default function ThemeSync() {
  useEffect(() => {
    let alive = true;
    getMySettingsService().then((settings) => {
      if (!alive || !settings) return;
      const server = { palette: settings.palette, mode: settings.mode };
      const mirror = readMirror();
      if (mirror.palette === server.palette && mirror.mode === server.mode) return;
      applyThemePrefs(server);
      writeMirror(server);
    });
    return () => {
      alive = false;
    };
  }, []);
  return null;
}
```

- [ ] **Step 3: Montarlo en el layout del hub**

En `app/(app)/(hub)/layout.tsx` importa `ThemeSync from "@/components/theme/theme-sync"` y ponlo justo antes de `<DotyEntrada />`:

```tsx
      <ThemeSync />
      <DotyEntrada />
```

- [ ] **Step 4: Verificar**

Run: `npx tsc --noEmit && npm run lint`
Expected: limpio. Con el dev server y una sesión real (pídele a Sergio la comprobación si no puedes iniciar sesión): en la consola, `localStorage.setItem("dots-palette","electrico")`, recarga → el HUD sale azul; si el servidor dice `rosa`, `ThemeSync` lo devuelve a rosa y el espejo queda en `rosa`.

- [ ] **Step 5: Commit**

```bash
git add services/settings.service.ts components/theme/theme-sync.tsx "app/(app)/(hub)/layout.tsx"
git commit -m "feat(temas): settings.service y ThemeSync reconcilian el espejo local con /me/settings

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 8: Guía de voz de Doty en `docs/brand/doty-identity.md`

**Files:**
- Modify: `docs/brand/doty-identity.md` (insertar una sección nueva entre "## Qué expresión va con qué mensaje" (línea 129) y "## Cómo pedir una pose nueva" (línea 151); actualizar los pasos 1, 4 y 5 de esa segunda sección)

**Interfaces:**
- Produces: la tabla "momento → frase" es la fuente del copy de B–F. Cualquier frase nueva de Doty se añade aquí antes de cablearse.

- [ ] **Step 1: Insertar la sección**

Después de la tabla de "Qué expresión va con qué mensaje" y antes de "## Cómo pedir una pose nueva", pega:

```markdown
## Humor e irreverencia

Doty es juvenil e irreverente, para **todo público**. La regla que decide cualquier
duda sigue siendo la de arriba: **motiva y celebra, nunca regaña**. Sobre ella,
cinco reglas de voz (aprobadas el 2026-09-14):

| Regla | Sí | No |
|---|---|---|
| Hype exagerado al celebrar | "Modo bestia activado. +1000 de aura." | "Bien hecho." (plano) |
| Drama sobre sí mismo, nunca sobre el usuario | "Se me apagó la llama. Estoy destruido. Vuelve." | "Perdiste la racha por flojo." |
| Picardía suave **solo** por inactividad | "Te extrañé… 👀 ¿Volvemos?" | Picardía tras un error: "¿Otra vez mal?" |
| Jerga de internet latina neutra | aura, cocinado, GOAT, modo bestia, épico, literal | Chilenismos, regionalismos, vulgaridad |
| Español; inglés solo como modismo enseñable, con traducción | "You're on fire! (= estás en racha)" | Celebraciones enteras en inglés |

**El arte dibuja arquetipos, el copy pone la moda.** Los PNG duran años; una frase
se cambia en un commit. Los memes van en esta tabla, no en el catálogo de arte, y
las franquicias se describen sin nombrarlas ("aura dorada flameante y pelo de
energía en punta", nunca el nombre de la serie).

### Frases aprobadas por momento

| Momento | Pose | Frase |
|---|---|---|
| Racha en práctica (5, 10, 15…) | `en-llamas` | "You're on fire! (= estás en racha) · {n} seguidas" |
| Nuevo récord o trono | `aura` | "Farmeaste aura. Récord nuevo." |
| Tiempo agotado en un juego | `cocinado` | "Me cociné yo, no tú. Otra ronda." |
| Primera carga tras perder la racha | `llanto-dramatico` | "Se apagó la llama. Estoy destruido. Una lección y me recupero." |
| Maestría al 100 % | `cerebro-galaxia` | "Cerebro galaxia. Este nivel ya es tuyo." |
| Entrada tras 3 a 6 días sin practicar | `reojo` | "Te extrañé… 👀 ¿Volvemos?" |
| Entrada tras 7 o más días | `bostezo` | "Me quedé dormido esperándote. Cero drama. Vamos." |
| Nivel desbloqueado | `mente-volada` | "Nivel nuevo desbloqueado. Sin palabras." |
| Checkpoint aprobado | `lentes-deal` | "Checkpoint aprobado. Deal with it (= acéptalo)." |
| Cabecera de /play | `gamer` | "Arcade · XP sin sufrir." |
| Aviso de rival | `chismoso` | "{nombre} te pasó en el ranking. Está {n} XP arriba. Una lección y lo recuperas." |
| Error de carga | `facepalm` | "Se me cayó algo. Culpa mía. ¿Reintentamos?" |
| Boost de XP activo | `flexeando` | "XP x2 activo. Modo bestia." |
| Repaso al día | `meditando` | "Repaso al día. Paz mental." |
| Dificultad: 0 % | narrador | "Todo el mundo empezó aquí. Hasta yo." |
| Dificultad: < 40 % | narrador | "Vas con todo. Ni una lección te frena." |
| Dificultad: < 80 % | narrador | "Más de la mitad. Ya no hay vuelta atrás." |
| Dificultad: 100 % | narrador | "Nivel dominado. +1000 de aura." |
| Bienvenida (primer inicio) | `saludando` | "¡Hola! Soy Doty. Tu coach de inglés. Prometo no regañarte." |
| Pista: primer nivel | `senalando` | "Este es tu primer nivel. Toca la imagen y arrancamos. Cada lección son unos tres minutos." |
| Pista: la llama | `emocionado` | "La llama es tu racha. Practica hoy y se enciende. Un día sin practicar y se apaga. Drama garantizado." |

Prohibido en copy y en prompts de arte: burlarse de un error del usuario,
vulgaridad, regionalismos, franquicias por nombre, texto dentro del PNG.
```

- [ ] **Step 2: Actualizar los pasos de "Cómo pedir una pose nueva"**

- Paso 1: cambia "`scripts/mj/batches/fase-1.json`" por "`scripts/mj/batches/fase-4.json` (fase-1 está cerrada; las piezas nuevas de Doty van a la fase 4)".
- Paso 4: `--apply fase-4 --raw $RAW`.
- Paso 5: "**Regenera el registro**: `--emit-registry fase-1 fase-4` (ambas fases: el registro es la unión)".
- En "## Catálogo (97 piezas)" añade al final una línea: "La fase 4 (`fase-4.json`) suma 14 expresiones, 3 narradores de dificultad y el grupo `avatars` (25 retratos, fuera del registro, en `public/images/avatars/`)."

- [ ] **Step 3: Commit**

```bash
git add docs/brand/doty-identity.md
git commit -m "docs(doty): guía de humor e irreverencia y tabla de frases aprobadas por momento

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 9: Pipeline — grupo `avatars` y registro a partir de varias fases (TDD)

**Files:**
- Modify: `scripts/mj/mjlib.py:13-14, 132-152, 379-407`
- Modify: `scripts/mj/process.py` (flag `--emit-registry`, docstring)
- Modify: `scripts/mj/tests/test_mjlib.py` (añadir tests; los existentes de `emit_registry` con un solo catálogo deben seguir pasando)

**Interfaces:**
- Produces: `EXTRA_GROUPS` incluye `"avatars"`; `_relative_output` devuelve `public/images/avatars/<slug>.png` para ese grupo; `emit_registry(cats)` acepta un `dict` **o** una `list[dict]` y lanza `CatalogError` si dos catálogos repiten una clave de registro; cabecera `// Fuente: scripts/mj/batches/fase-1.json + fase-4.json`. CLI: `--emit-registry fase-1 fase-4`.

- [ ] **Step 1: Tests que fallan (añadir al final de `scripts/mj/tests/test_mjlib.py`)**

```python
def test_avatars_es_grupo_extra_con_salida_propia():
    p = piece(group="avatars", slug="nerd", prefix="Avatar Doty nerd")
    assert "avatars" in mjlib.EXTRA_GROUPS
    assert mjlib._relative_output(p, "fase-4") == "public/images/avatars/nerd.png"
    # va al repo, no a $RAW como characters/app-icon
    assert str(mjlib.output_path(p, "fase-4", Path("/repo"), Path("/raw"))) == "/repo/public/images/avatars/nerd.png"

def test_emit_registry_une_varias_fases():
    f1 = {"fase": "fase-1", "pieces": [piece(done=True)]}
    f4 = {"fase": "fase-4", "pieces": [
        piece(slug="en-llamas", prefix="Doty on fire power up", done=True),
        piece(group="avatars", slug="nerd", prefix="Avatar Doty nerd", done=True),
    ]}
    ts = mjlib.emit_registry([f1, f4])
    assert "// Fuente: scripts/mj/batches/fase-1.json + fase-4.json" in ts
    assert '  feliz: { src: "/images/Doty/expressions/feliz.png", group: "expressions" },' in ts
    assert '  "en-llamas": { src: "/images/Doty/expressions/en-llamas.png", group: "expressions" },' in ts
    assert "nerd" not in ts  # avatars no entra en el registro

def test_emit_registry_rechaza_claves_repetidas_entre_fases():
    f1 = {"fase": "fase-1", "pieces": [piece(done=True)]}
    f4 = {"fase": "fase-4", "pieces": [piece(prefix="Doty happy again", done=True)]}
    with pytest.raises(mjlib.CatalogError, match="feliz"):
        mjlib.emit_registry([f1, f4])

def test_emit_registry_sigue_aceptando_un_solo_catalogo():
    ts = mjlib.emit_registry({"fase": "fase-1", "pieces": [piece(done=True)]})
    assert "// Fuente: scripts/mj/batches/fase-1.json" in ts
```

- [ ] **Step 2: Correr y ver que fallan**

Run: `cd scripts/mj && uv run --python 3.12 --with pytest --with pillow python -m pytest tests/test_mjlib.py -q`
(Si en este equipo los tests se corren de otra forma, usa la que documente `scripts/mj/tests/__init__.py` o el historial de git; lo importante es que corran los cuatro nuevos.)
Expected: 4 FAIL (`avatars` no está en `EXTRA_GROUPS`; `emit_registry` no acepta lista).

- [ ] **Step 3: Implementar en `mjlib.py`**

Línea 14: `EXTRA_GROUPS = ("games", "characters", "app-icon", "levels", "ui", "avatars")`.

En `_relative_output`, antes del `return f"{fase}/out/app-icon.png"` final:

```python
    if g == "avatars":
        return f"public/images/avatars/{s}.png"
```

Sustituye `emit_registry` completa por:

```python
def emit_registry(cats: "dict | list[dict]") -> str:
    """Registro TS a partir de una o varias fases. Solo entran los REGISTRY_GROUPS;
    una clave repetida entre fases es un error, no una sobreescritura silenciosa."""
    cat_list = [cats] if isinstance(cats, dict) else list(cats)
    pieces: list[dict] = []
    seen: dict[str, str] = {}
    for cat in cat_list:
        for p in cat["pieces"]:
            if p["group"] not in REGISTRY_GROUPS:
                continue
            key = registry_key(p)
            if key in seen:
                raise CatalogError(f"registry key {key!r} repetida: {seen[key]} y {cat['fase']}")
            seen[key] = cat["fase"]
            pieces.append(p)
    if not any(registry_key(p) == "feliz" for p in pieces):
        raise CatalogError("registry needs a 'feliz' piece (FALLBACK_POSE)")
    groups = " | ".join(f'"{g}"' for g in REGISTRY_GROUPS)
    fuente = " + ".join(f"{c['fase']}.json" for c in cat_list)
    rows = "\n".join(
        f'  {_ts_key(registry_key(p))}: {{ src: "{registry_src(p)}", group: "{p["group"]}" }},' for p in pieces
    )
    return f'''// GENERADO por scripts/mj/process.py --emit-registry — no editar a mano.
// Fuente: scripts/mj/batches/{fuente}. Reglas de uso: docs/brand/doty-identity.md
export type DotyGroup = {groups};
export type PoseEntry = {{ src: string; group: DotyGroup }};

export const POSES = {{
{rows}
}} as const satisfies Record<string, PoseEntry>;

export type DotyPose = keyof typeof POSES;
export const FALLBACK_POSE: DotyPose = "feliz";

export function isDotyPose(v: unknown): v is DotyPose {{
  return typeof v === "string" && Object.prototype.hasOwnProperty.call(POSES, v);
}}

/** Strings dinámicos (BD, params) → pose válida o la cara amable por defecto. */
export function toDotyPose(v: string | null | undefined): DotyPose {{
  return isDotyPose(v) ? v : FALLBACK_POSE;
}}
'''
```

- [ ] **Step 4: CLI en `process.py`**

Cambia `g.add_argument("--emit-registry", metavar="FASE")` por `g.add_argument("--emit-registry", nargs="+", metavar="FASE")` y el bloque:

```python
    if a.emit_registry:
        cats = [mjlib.load_catalog(batch_path(f)) for f in a.emit_registry]
        out = REPO / "components/ui/doty/poses.ts"
        out.write_text(mjlib.emit_registry(cats), encoding="utf-8")
        print(f"registro ({' + '.join(a.emit_registry)}) → {out}")
        return 0
```

En el docstring de cabecera: `uv run scripts/mj/process.py --emit-registry fase-1 fase-4`.

- [ ] **Step 5: Correr todos los tests del pipeline**

Run: el mismo comando del Step 2 pero sobre `tests/`.
Expected: todo en verde, incluidos `test_catalogs.py`, `test_catalogo_fase2.py` y `test_catalogo_fase3.py`.

- [ ] **Step 6: Verificar que el registro no cambia todavía**

Run: `uv run --python 3.12 scripts/mj/process.py --emit-registry fase-1 && git diff --stat components/ui/doty/poses.ts`
Expected: sin cambios en `poses.ts` (misma fase, misma salida salvo la línea `// Fuente:` que ya decía `fase-1.json`). Si solo cambia esa línea, está bien.

- [ ] **Step 7: Commit**

```bash
git add scripts/mj/mjlib.py scripts/mj/process.py scripts/mj/tests/test_mjlib.py components/ui/doty/poses.ts
git commit -m "feat(mj): grupo avatars y registro de Doty como unión de varias fases

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 10: Catálogo de arte `fase-4.json`, sus tests y la hoja de la tanda 1

**Files:**
- Create: `scripts/mj/batches/fase-4.json`
- Create: `scripts/mj/tests/test_catalogo_fase4.py`

**Interfaces:**
- Consumes: `EXTRA_GROUPS` con `avatars` y `emit_registry(list)` (Task 9).
- Produces: 42 piezas con `done: false`; `--emit-lote expressions poses avatars --pendientes --fase fase-4` genera `$RAW/fase-4/LOTE-expressions+poses+avatars.md`. Los slugs de `expressions` y `poses` son los que la spec §2.3 cablea en B–F; los de `avatars` son las `key` de los `shop_items` del subproyecto E (`avatar_<slug>`).

Reglas del catálogo que `validate_catalog` exige y este JSON cumple: slugs únicos kebab-case; `prefix` únicos y **ninguno subcadena de otro** tras normalizar (por eso los avatares empiezan por "Avatar Doty" y las expresiones por "Doty"); nada oscuro como relleno en `prompt`; todo `mascot: true` (grupo sin ancla). Ninguna referencia a franquicias por nombre. Nada flotante separado del cuerpo (`rembg` lo borra).

- [ ] **Step 1: Escribir `scripts/mj/batches/fase-4.json`**

```json
{
  "fase": "fase-4",
  "pieces": [
    { "slug": "en-llamas", "group": "expressions", "prefix": "Doty on fire power up", "prompt": "powered up like an anime fighter, feet planted wide, fists clenched at his sides, teeth gritted in a fierce determined grin, the tuft standing straight up in sharp spikes, a bold golden yellow flame aura hugging the whole body with the flames growing out of the outline itself and touching the silhouette everywhere, small cyan sparks inside the flames, intense glowing eyes, nothing floating separate from the body", "size": 1024, "mascot": true, "done": false },
    { "slug": "aura", "group": "expressions", "prefix": "Doty glowing with confidence", "prompt": "standing tall and relaxed, one hand adjusting a pair of bold cyan sunglasses on his face, smug tiny smile, a soft golden glow hugging the outline of the body, the glow touching the silhouette and not floating apart, chill and unbothered", "size": 1024, "mascot": true, "done": false, "glasses": true },
    { "slug": "cocinado", "group": "expressions", "prefix": "Doty fried and smoking", "prompt": "slumped and wobbly with the tuft frazzled and singed into a puffy cloud shape, spiral dizzy eyes, a small wavy puff of pale gray smoke rising from the top of the tuft and touching it, tongue out, comic exhaustion, funny not sad", "size": 1024, "mascot": true, "done": false },
    { "slug": "llanto-dramatico", "group": "expressions", "prefix": "Doty crying dramatically", "prompt": "melodramatic sobbing, both hands pressed to the cheeks, huge glossy eyes with two thick cyan tear streams running down and pooling at the feet, mouth wide open in an exaggerated wail, theatrical soap opera drama, comic and endearing", "size": 1024, "mascot": true, "done": false },
    { "slug": "cerebro-galaxia", "group": "expressions", "prefix": "Doty with a galaxy brain", "prompt": "eyes half closed in serene enlightenment, tiny knowing smile, the tuft swirled into a spiral shape filled with a swirling blue and cyan galaxy pattern with small white stars, one finger raised to the temple, cosmic genius", "size": 1024, "mascot": true, "done": false },
    { "slug": "reojo", "group": "expressions", "prefix": "Doty side eye glance", "prompt": "arms crossed, body turned three quarters, eyes sliding sideways toward the viewer in a suspicious side glance, one eyebrow raised, lips pressed in a tiny pout, playful passive aggressive attitude, cute not hostile", "size": 1024, "mascot": true, "done": false },
    { "slug": "mente-volada", "group": "expressions", "prefix": "Doty with mind blown", "prompt": "eyes huge and wide, mouth open in a perfect O, both hands on the sides of the head, the tuft splayed outward in every direction like a burst, three small cyan and pink starbursts touching the tips of the tuft, astonished delight", "size": 1024, "mascot": true, "done": false },
    { "slug": "lentes-deal", "group": "expressions", "prefix": "Doty lowering cool shades", "prompt": "chin up, one hand pulling a pair of bold cyan sunglasses halfway down the face, one eye visible over the rim, confident lopsided grin, the other hand on the hip, effortlessly cool", "size": 1024, "mascot": true, "done": false, "glasses": true },
    { "slug": "gamer", "group": "expressions", "prefix": "Doty gaming with a controller", "prompt": "holding a chunky blue game controller with both hands, thumbs on the sticks, bulky cyan headphones over the tuft, leaning forward with focused excited eyes and an open grin, fully absorbed in the game", "size": 1024, "mascot": true, "done": false },
    { "slug": "chismoso", "group": "expressions", "prefix": "Doty peeking with gossip face", "prompt": "peeking from behind the edge of a big pink speech bubble that he holds with both hands, only the head and hands visible above it, eyes wide and darting, eyebrows high, tiny mischievous smile, about to share gossip", "size": 1024, "mascot": true, "done": false },
    { "slug": "facepalm", "group": "expressions", "prefix": "Doty facepalm moment", "prompt": "one hand slapped flat over the eyes and forehead, head tilted back, mouth in a flat embarrassed line, the other arm hanging limp, the tuft drooping, comic self blame, endearing", "size": 1024, "mascot": true, "done": false },
    { "slug": "flexeando", "group": "expressions", "prefix": "Doty flexing muscles", "prompt": "both arms raised and bent flexing exaggerated round cartoon biceps, chin up, proud grin with gritted teeth, one eye winking, small cyan sparkle touching the top of each bicep, hype pose", "size": 1024, "mascot": true, "done": false },
    { "slug": "meditando", "group": "expressions", "prefix": "Doty meditating in peace", "prompt": "sitting cross legged, hands resting on the knees with fingertips touching, eyes closed, serene tiny smile, the tuft neatly smooth, a soft cyan glow hugging the outline of the body, total calm", "size": 1024, "mascot": true, "done": false },
    { "slug": "bostezo", "group": "expressions", "prefix": "Doty yawning dramatically", "prompt": "mid huge yawn with the mouth wide open, eyes squeezed shut with tiny tears at the corners, one hand covering the mouth halfway, the other arm stretched up, the tuft flattened to one side as if just woken up, sleepy and cozy", "size": 1024, "mascot": true, "done": false },

    { "slug": "narrador-beginner", "group": "poses", "prefix": "Doty rookie guide waving you in", "prompt": "standing on tiptoes waving both arms over the head in a big welcome, wearing a small cyan cap turned backwards on the tuft, huge eager smile, sparkling eyes, fresh and enthusiastic, the energy of the first day of school", "size": 1024, "mascot": true, "done": false },
    { "slug": "narrador-intermediate", "group": "poses", "prefix": "Doty coach with a whistle", "prompt": "standing firm with one hand on the hip and the other pointing forward, a cyan whistle on a short cord around the neck resting on the chest, focused confident grin, one eyebrow raised, the attitude of a coach who knows you can do more", "size": 1024, "mascot": true, "done": false },
    { "slug": "narrador-advanced", "group": "poses", "prefix": "Doty champion with a golden medal", "prompt": "standing tall with the arms crossed, a big round golden medal on a cyan ribbon resting on the chest, chin slightly raised, calm proud smile with one eye half closed, the tuft swept back neatly, the swagger of a champion", "size": 1024, "mascot": true, "done": false },

    { "slug": "clasico", "group": "avatars", "prefix": "Avatar Doty classic smile", "prompt": "big friendly smile, bright eyes looking straight at the viewer, the tuft standing naturally, no accessories", "size": 512, "mascot": true, "done": false, "framing": "head and shoulders only, centered with margin, plain white background, no shadow" },
    { "slug": "nerd", "group": "avatars", "prefix": "Avatar Doty nerd with round glasses", "prompt": "big round cyan-framed glasses, a clever grin, one eyebrow raised, the tuft neatly combed to one side", "size": 512, "mascot": true, "done": false, "glasses": true, "framing": "head and shoulders only, centered with margin, plain white background, no shadow" },
    { "slug": "crack", "group": "avatars", "prefix": "Avatar Doty crack with a cap", "prompt": "a bold blue baseball cap worn forward with the tuft poking out the back, a cocky confident smirk, one eye winking", "size": 512, "mascot": true, "done": false, "framing": "head and shoulders only, centered with margin, plain white background, no shadow" },
    { "slug": "hype", "group": "avatars", "prefix": "Avatar Doty hype with headphones", "prompt": "bulky cyan headphones over the tuft, mouth open in an excited shout, eyes squeezed into happy crescents", "size": 512, "mascot": true, "done": false, "framing": "head and shoulders only, centered with margin, plain white background, no shadow" },
    { "slug": "buena-onda", "group": "avatars", "prefix": "Avatar Doty good vibes waving", "prompt": "one hand raised beside the face in a relaxed open wave, warm easy smile, the tuft loose and slightly wavy", "size": 512, "mascot": true, "done": false, "framing": "head and shoulders only, centered with margin, plain white background, no shadow" },
    { "slug": "techie", "group": "avatars", "prefix": "Avatar Doty techie with a visor", "prompt": "a sleek cyan visor across the eyes reflecting a faint blue grid, a small focused smile, the tuft shaped into two sharp points", "size": 512, "mascot": true, "done": false, "framing": "head and shoulders only, centered with margin, plain white background, no shadow" },

    { "slug": "genio", "group": "avatars", "prefix": "Avatar Doty genius with a lightbulb", "prompt": "a small glowing cyan lightbulb resting on top of the tuft and touching it, wide delighted eyes, an open smile of sudden inspiration", "size": 512, "mascot": true, "done": false, "framing": "head and shoulders only, centered with margin, plain white background, no shadow" },
    { "slug": "campeon", "group": "avatars", "prefix": "Avatar Doty champion with a laurel", "prompt": "a golden laurel wreath resting on the tuft, proud closed-eye smile, chin up", "size": 512, "mascot": true, "done": false, "framing": "head and shoulders only, centered with margin, plain white background, no shadow" },
    { "slug": "jugador", "group": "avatars", "prefix": "Avatar Doty player with a controller", "prompt": "a chunky blue game controller held up beside the face, tongue poking out in concentration, eyes locked forward", "size": 512, "mascot": true, "done": false, "framing": "head and shoulders only, centered with margin, plain white background, no shadow" },
    { "slug": "veloz", "group": "avatars", "prefix": "Avatar Doty speedy with a headband", "prompt": "a cyan sweatband across the forehead, the tuft swept back flat as if in the wind, a fierce determined grin", "size": 512, "mascot": true, "done": false, "framing": "head and shoulders only, centered with margin, plain white background, no shadow" },
    { "slug": "capitan", "group": "avatars", "prefix": "Avatar Doty captain with a peaked cap", "prompt": "a white peaked captain cap with a blue band worn straight, a firm confident smile, one eyebrow raised", "size": 512, "mascot": true, "done": false, "framing": "head and shoulders only, centered with margin, plain white background, no shadow" },
    { "slug": "astronauta", "group": "avatars", "prefix": "Avatar Doty astronaut in a helmet", "prompt": "the head inside a round white space helmet with a cyan visor rim, the face fully visible through the glass, an amazed wide-eyed smile", "size": 512, "mascot": true, "done": false, "framing": "head and shoulders only, centered with margin, plain white background, no shadow" },
    { "slug": "chef", "group": "avatars", "prefix": "Avatar Doty chef with a toque", "prompt": "a tall white chef hat sitting on the tuft, a satisfied smile with the eyes closed as if tasting something delicious", "size": 512, "mascot": true, "done": false, "framing": "head and shoulders only, centered with margin, plain white background, no shadow" },
    { "slug": "rockstar", "group": "avatars", "prefix": "Avatar Doty rockstar with a spiky mohawk", "prompt": "the tuft styled into a tall cyan-tipped mohawk, one eye closed, mouth open in a rock shout, a small blue star painted around the other eye", "size": 512, "mascot": true, "done": false, "framing": "head and shoulders only, centered with margin, plain white background, no shadow" },
    { "slug": "detective", "group": "avatars", "prefix": "Avatar Doty detective with a deerstalker", "prompt": "a blue checkered detective cap with ear flaps, one eye narrowed, a thoughtful half smile, a small cyan magnifying glass held up beside the face", "size": 512, "mascot": true, "done": false, "framing": "head and shoulders only, centered with margin, plain white background, no shadow" },
    { "slug": "pirata", "group": "avatars", "prefix": "Avatar Doty pirate with a bandana", "prompt": "a cyan bandana tied over the tuft with the knot to one side, a blue eye patch over one eye, a wide roguish grin showing teeth", "size": 512, "mascot": true, "done": false, "framing": "head and shoulders only, centered with margin, plain white background, no shadow" },
    { "slug": "mago", "group": "avatars", "prefix": "Avatar Doty wizard with a pointed hat", "prompt": "a tall blue pointed wizard hat with small cyan stars printed on it, a mysterious knowing smile, eyes half closed", "size": 512, "mascot": true, "done": false, "framing": "head and shoulders only, centered with margin, plain white background, no shadow" },
    { "slug": "surfista", "group": "avatars", "prefix": "Avatar Doty surfer with wet hair", "prompt": "the tuft dripping and slicked back with a few cyan water droplets touching it, a relaxed sunny grin, a blue shell necklace at the shoulders", "size": 512, "mascot": true, "done": false, "framing": "head and shoulders only, centered with margin, plain white background, no shadow" },
    { "slug": "ninja", "group": "avatars", "prefix": "Avatar Doty ninja with a mask", "prompt": "a blue ninja headband tied at the back and a cyan cloth mask covering the mouth, only the focused sharp eyes visible, the tuft poking above the headband", "size": 512, "mascot": true, "done": false, "framing": "head and shoulders only, centered with margin, plain white background, no shadow" },
    { "slug": "artista", "group": "avatars", "prefix": "Avatar Doty artist with a beret", "prompt": "a blue beret tilted on the tuft, a small cyan paint smudge on one cheek, a dreamy inspired smile looking slightly upward", "size": 512, "mascot": true, "done": false, "framing": "head and shoulders only, centered with margin, plain white background, no shadow" },
    { "slug": "dj", "group": "avatars", "prefix": "Avatar Doty dj with one headphone", "prompt": "big cyan headphones with one cup pushed off the ear and held by a hand, eyes closed feeling the beat, a cool half smile", "size": 512, "mascot": true, "done": false, "framing": "head and shoulders only, centered with margin, plain white background, no shadow" },
    { "slug": "explorador", "group": "avatars", "prefix": "Avatar Doty explorer with a safari hat", "prompt": "a wide-brimmed blue safari hat with a cyan band, a curious open-mouthed smile, eyes looking toward the horizon", "size": 512, "mascot": true, "done": false, "framing": "head and shoulders only, centered with margin, plain white background, no shadow" },

    { "slug": "fem", "group": "avatars", "prefix": "Avatar Doty Fem the orchid narrator", "prompt": "same Doty face but an orchid purple body #E30BE3 clearly more purple than Doty's hot pink, a cyan sports visor with no crown sitting low on the forehead, the tuft gathered into a thick braided ponytail that rises behind the visor and falls to one side tied with a small cyan band, long curled eyelashes, a bright open smile showing the teeth, athletic youthful and upbeat, no headphones, no earrings, no bow, no blushing cheeks", "size": 512, "mascot": true, "done": false, "brand_lock": "keep the dark navy outline and the navy eyes with white highlights, and an orchid purple body #E30BE3 — clearly purple, not hot pink", "framing": "head and shoulders only, centered with margin, plain white background, no shadow" },
    { "slug": "marinero", "group": "avatars", "prefix": "Avatar Doty Sailor the old crimson narrator", "prompt": "same Doty shape but with a crimson red body #FF0010, stockier and squarer, a white sailor cap with a cyan visor flattening the tuft, cyan neckerchief, thick furrowed brow, one eye squinting, mouth open to one side mid-grumble, the endearing grumpy attitude of an old sea captain, comic and never menacing", "size": 512, "mascot": true, "done": false, "brand_lock": "keep the dark navy outline and the navy eyes with white highlights, and a crimson red body #FF0010 — not pink, not orange", "framing": "head and shoulders only, centered with margin, plain white background, no shadow" },
    { "slug": "cientifica", "group": "avatars", "prefix": "Avatar Doty Scientist the poised violet narrator", "prompt": "same Doty face but a soft violet body #B432FF with the shoulders squared off by the collar of a crisp white lab coat, the tuft neatly swept back, round glasses, long curled eyelashes, chin slightly raised, calm confident smile with the mouth open mid-sentence", "size": 512, "mascot": true, "done": false, "glasses": true, "brand_lock": "keep the dark navy outline and the navy eyes with white highlights, and a soft violet body #B432FF — muted and refined, not pink", "framing": "head and shoulders only, centered with margin, plain white background, no shadow" }
  ]
}
```

Los tres personajes reutilizan palabra por palabra el `prompt` y el `brand_lock` de `doty-fem`, `doty-sailor` y `doty-scientist` en `fase-1.json`, recortados a lo que se ve de hombros para arriba; el `prefix` cambia de "Doty …" a "Avatar Doty …" para que no colisione con nada y para que el archivo descargado caiga en la pieza correcta.

- [ ] **Step 2: Tests — `scripts/mj/tests/test_catalogo_fase4.py`**

```python
import json
import pathlib
import re
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))
import mjlib

BATCHES = pathlib.Path(__file__).resolve().parents[1] / "batches"
CATALOGO = BATCHES / "fase-4.json"

EXPRESIONES = {"en-llamas", "aura", "cocinado", "llanto-dramatico", "cerebro-galaxia", "reojo",
               "mente-volada", "lentes-deal", "gamer", "chismoso", "facepalm", "flexeando",
               "meditando", "bostezo"}
NARRADORES = {"narrador-beginner", "narrador-intermediate", "narrador-advanced"}
AVATARES_GRATIS = {"clasico", "nerd", "crack", "hype", "buena-onda", "techie"}
AVATARES_PAGO = {"genio", "campeon", "jugador", "veloz", "capitan", "astronauta", "chef", "rockstar",
                 "detective", "pirata", "mago", "surfista", "ninja", "artista", "dj", "explorador"}
PERSONAJES = {"fem", "marinero", "cientifica"}
FRANQUICIAS = re.compile(r"dragon ?ball|saiyan|sayayin|goku|pokemon|mario|sonic|naruto|marvel|disney", re.I)


def _cat():
    return mjlib.load_catalog(str(CATALOGO))


def _por_grupo(cat):
    out = {}
    for p in cat["pieces"]:
        out.setdefault(p["group"], set()).add(p["slug"])
    return out


def test_grupos_y_slugs_exactos():
    g = _por_grupo(_cat())
    assert g["expressions"] == EXPRESIONES
    assert g["poses"] == NARRADORES
    assert g["avatars"] == AVATARES_GRATIS | AVATARES_PAGO | PERSONAJES
    assert set(g) == {"expressions", "poses", "avatars"}
    assert len(_cat()["pieces"]) == 42


def test_todo_es_mascota_sin_hacer_y_con_tamano_por_grupo():
    for p in _cat()["pieces"]:
        assert p["mascot"] is True, p["slug"]
        assert p["done"] is False, p["slug"]
        assert p["size"] == (512 if p["group"] == "avatars" else 1024), p["slug"]


def test_los_avatares_son_retratos():
    for p in _cat()["pieces"]:
        if p["group"] == "avatars":
            assert "head and shoulders" in p.get("framing", ""), p["slug"]
        else:
            assert "framing" not in p, p["slug"]


def test_ninguna_franquicia_por_nombre():
    for p in _cat()["pieces"]:
        assert not FRANQUICIAS.search(p["prompt"] + " " + p["prefix"]), p["slug"]


def test_prefijos_arrancan_por_su_familia():
    for p in _cat()["pieces"]:
        esperado = "Avatar Doty" if p["group"] == "avatars" else "Doty"
        assert p["prefix"].startswith(esperado), p["slug"]


def test_las_llamas_van_pegadas_al_cuerpo():
    en_llamas = next(p for p in _cat()["pieces"] if p["slug"] == "en-llamas")
    assert "touching the silhouette" in en_llamas["prompt"]
    assert "nothing floating" in en_llamas["prompt"]


def test_solo_las_piezas_con_lentes_llevan_glasses():
    con = {p["slug"] for p in _cat()["pieces"] if p.get("glasses")}
    assert con == {"aura", "lentes-deal", "nerd", "cientifica"}


def test_los_personajes_conservan_el_brand_lock_de_fase1():
    f1 = {p["slug"]: p for p in json.loads((BATCHES / "fase-1.json").read_text(encoding="utf-8"))["pieces"]}
    f4 = {p["slug"]: p for p in _cat()["pieces"]}
    assert f4["fem"]["brand_lock"] == f1["doty-fem"]["brand_lock"]
    assert f4["marinero"]["brand_lock"] == f1["doty-sailor"]["brand_lock"]
    assert f4["cientifica"]["brand_lock"] == f1["doty-scientist"]["brand_lock"]


def test_el_registro_unido_con_fase1_no_repite_claves_y_suma_las_expresiones():
    f1 = mjlib.load_catalog(str(BATCHES / "fase-1.json"))
    ts = mjlib.emit_registry([f1, _cat()])
    assert '"en-llamas"' in ts and "narradorBeginner" not in ts  # kebab-case va entre comillas
    assert '"narrador-beginner"' in ts
    assert ts.count("feliz:") == 1
```

- [ ] **Step 3: Correr los tests**

Run: `cd scripts/mj && uv run --python 3.12 --with pytest --with pillow python -m pytest tests -q`
Expected: todo en verde. Si `validate_catalog` rechaza un `prefix` por colisión de subcadena, cambia la palabra del prefix ofensor (no el slug) y vuelve a correr.

- [ ] **Step 4: Emitir la hoja de la tanda 1 para Sergio**

Run: `uv run --python 3.12 scripts/mj/process.py --emit-lote expressions poses avatars --pendientes --fase fase-4 --raw /home/endurance/Projects/Endurance/dots/imagenes/mj`
Expected: `42 piezas (42 mascota, 0 icono) → …/fase-4/LOTE-expressions+poses+avatars.md`. En el mensaje de cierre del subproyecto, indica a Sergio que la **tanda 1** son estas 13: `en-llamas`, `gamer`, `reojo`, `llanto-dramatico`, `narrador-beginner`, `narrador-intermediate`, `narrador-advanced`, `clasico`, `nerd`, `crack`, `hype`, `buena-onda`, `techie`; el resto puede esperar.

- [ ] **Step 5: Regenerar el registro con las dos fases y verificar que el placeholder cubre lo pendiente**

Run: `uv run --python 3.12 scripts/mj/process.py --emit-registry fase-1 fase-4 && npm run lint`
Expected: `poses.ts` gana 17 claves nuevas apuntando al placeholder (`feliz.png`) hasta que las piezas estén `done`; `check-doty-assets --strict` pasa porque el placeholder existe en disco y no hay huérfanos.

- [ ] **Step 6: Commit**

```bash
git add scripts/mj/batches/fase-4.json scripts/mj/tests/test_catalogo_fase4.py components/ui/doty/poses.ts
git commit -m "feat(mj): catálogo fase 4 — 14 expresiones, 3 narradores y 25 avatares, con tests

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 11: Verificación final y cierre del subproyecto

**Files:** ninguno nuevo. Solo verificación y el mensaje de cierre.

- [ ] **Step 1: Webapp completa**

Run (en `dots-webapp`): `npm run lint && npm run test:scripts && npx next build`
Expected: lint con `check-themes: generados al día`, 8 tests de `render.test.mjs` en verde, build de producción sin errores ni warnings nuevos.

- [ ] **Step 2: Backend completo**

Run (en `dots-backend`): `npm test && npm run build && npm run migrate:settings`
Expected: specs en verde, build limpio, y el dry-run imprime `users.settings: will be added`.

- [ ] **Step 3: Prueba manual de los cuatro temas**

Con `preview_start {name:"dots-webapp"}` y una ruta temporal fuera de `(app)` (patrón de `preview-visual-verification`), o con la sesión de Sergio: fija `data-palette` y `data-theme` en `<html>` desde la consola para las cuatro combinaciones y captura el HUD, un nodo del Camino y un botón `dots-pressable`. Comprueba que ningún texto queda por debajo de 4.5:1 midiendo `getComputedStyle` de `--foreground`/`--muted` contra `--background` y `--surface` (usa la fórmula WCAG; anota los cuatro ratios en el mensaje de cierre). Si Eléctrico oscuro baja de 4.5:1 en `--muted`, sube `--muted` a `#b4bfe9` en `themes.json` y regenera.

- [ ] **Step 4: Mensaje de cierre a Sergio**

Debe decir, sin adornos: ramas y commits en ambos repos; que la migración `migrate:settings` está en dry-run y **espera su `--apply`** (comando exacto); que el registro tiene 17 poses nuevas en placeholder hasta que genere la tanda 1 (lista de las 13 piezas y ruta del `LOTE-…md`); que el modo por defecto pasó de claro a Auto para quien no tenía nada guardado; y los ratios de contraste medidos.

---

## Self-review del plan

- **Cobertura de la spec §2**: 2.1 temas → Tasks 1, 2, 3, 7. 2.2 voz → Task 8. 2.3 catálogo fase 4 y pipeline → Tasks 9, 10. 2.4 backend (`settings`, endpoints, `streakSecuredToday`) → Tasks 5, 6. 2.5 deuda (toggle, racha, level-math) → Tasks 3, 4. 2.6 criterios → Task 11.
- **Fuera de este plan, a propósito**: la hoja de ajustes (D), `POST /me/avatar` y los `shop_items` de avatares (E), el gating del primer inicio (F), el cableado de las poses nuevas en las pantallas (B, C, F). El registro las expone desde ya en placeholder.
- **Consistencia de nombres**: `ThemeMode` se define dos veces a propósito: en `lib/theme-colors.ts` (generado) como `"light" | "dark"` y en `lib/theme-prefs.ts` como `"light" | "dark" | "auto"`; `settings.service.ts` importa la de `theme-prefs`. `PALETTES` existe en el frontend (`lib/theme-colors.ts`) y en el backend (`src/common/user-settings.ts`) con los mismos valores.
