# Rediseño total — Fundación (Fase 0 + Fase 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dejar la base del rediseño total lista — mergear el trabajo verificado a `main`, abrir la rama `redesign/total` en ambos repos, y correr la paleta visual hacia el navy + rosa del logo (retirando el morado) sobre el sistema de diseño que ya existe.

**Architecture:** Fase 0 es puro git (fast-forward de `redesign/learning-path` a `main` en webapp y backend, luego `redesign/total` desde `main`). Fase 1 es un recoloreo de tokens CSS en `app/globals.css`: el sistema candy (Baloo 2 + Nunito, dark mode con anti-flash, botón 3D táctil, radios chunky) YA existe; solo se reasignan los tokens de marca — `--primary` pasa de morado a navy, el CTA (`--primary-accent`) pasa a rosa en ambos temas, el fondo dark pasa de plum a navy — y se añaden tokens de semántica de juego que faltan (`--gem`, `--flame`).

**Tech Stack:** Next.js 16.1.6, React 19, Tailwind 4 (CSS-first, tokens en `@theme` + variables CSS), `next/font`.

## Global Constraints

- Rama de trabajo: `redesign/total` (creada en Fase 0), en dots-webapp Y dots-backend. Nunca commitear a `main` directamente después del merge de Fase 0.
- Todo aditivo: no romper `GET /levels`, `/practice`, ni el progreso real de usuarios. Esta fundación no toca la BD (las migraciones van por fase, más adelante).
- No `push` a remoto salvo que el usuario lo pida explícitamente. Los merges de Fase 0 son locales.
- Paleta canónica: rosa `#e5077e` (logo, ya es `--accent`) + navy `#201a4d` (wordmark del logo `DOTS_LOGO_DARK.png`). El morado `#7c5cff` se retira como color de marca.
- El comentario en `globals.css` dice que la paleta se espeja en `dots-app/lib/theme.ts` (app React Native, repo aparte) — FUERA DE ALCANCE aquí; no editar ese repo.
- Verificación de cambios visuales: `npm run build` (type-check + lint) + preview en navegador con screenshot de ambos temas. No hay unit tests de tokens CSS.
- Node vía `source ~/.nvm/nvm.sh` (v22.23.1). Preview vía `.claude/launch.json` (ya arreglado para esta máquina).

---

## File Structure

- `app/globals.css` — MODIFICAR. Único archivo de Fase 1. Contiene los 3 bloques de paleta: `:root` (light, ~L13-77), `:root[data-theme="dark"]` (~L89-135), y `@media (prefers-color-scheme: dark) :root:not([data-theme])` (~L140-172). Los tres deben quedar consistentes.
- Sin archivos nuevos. El botón 3D (`components/ui/button/button.tsx`), las fuentes (`app/layout.tsx`) y el dark mode ya existen y NO se tocan en esta fase.

---

## Task 0: Merge a main + rama redesign/total (ambos repos)

**Files:** ninguno (operación git).

**Interfaces:**
- Produces: rama `redesign/total` en ambos repos, apuntando al HEAD de `main` ya avanzado con todo el trabajo de learning-path.

- [ ] **Step 1: Verificar árbol limpio y fast-forward en webapp**

Run:
```bash
cd /home/endurance/Projects/Endurance/dots/dots-webapp
git status --porcelain && git rev-list --left-right --count main...redesign/learning-path
```
Expected: sin salida de `--porcelain` (árbol limpio); conteo `0	6` (main 0 adelante, learning-path 6 → fast-forward posible).

- [ ] **Step 2: Merge fast-forward learning-path → main (webapp) y crear rama**

Run:
```bash
cd /home/endurance/Projects/Endurance/dots/dots-webapp
git checkout main && git merge --ff-only redesign/learning-path && git checkout -b redesign/total
```
Expected: `Fast-forward`, luego `Switched to a new branch 'redesign/total'`.

- [ ] **Step 3: Verificar árbol limpio y fast-forward en backend**

Run:
```bash
cd /home/endurance/Projects/Endurance/dots/dots-backend
git status --porcelain && git rev-list --left-right --count main...redesign/learning-path
```
Expected: árbol limpio; conteo `0	8`.

- [ ] **Step 4: Merge fast-forward learning-path → main (backend) y crear rama**

Run:
```bash
cd /home/endurance/Projects/Endurance/dots/dots-backend
git checkout main && git merge --ff-only redesign/learning-path && git checkout -b redesign/total
```
Expected: `Fast-forward`, luego `Switched to a new branch 'redesign/total'`.

- [ ] **Step 5: Confirmar ramas**

Run:
```bash
cd /home/endurance/Projects/Endurance/dots/dots-webapp && git branch --show-current
cd /home/endurance/Projects/Endurance/dots/dots-backend && git branch --show-current
```
Expected: `redesign/total` en ambos. (Sin commit: solo se crearon ramas.)

---

## Task 1: Correr la paleta a navy + rosa (retirar morado)

**Files:**
- Modify: `app/globals.css` — los 3 bloques de paleta.

**Interfaces:**
- Consumes: tokens existentes (`--accent` rosa, `--primary`, `--primary-accent`, `--background`, `--foreground`, `--purple`, `--gold`).
- Produces: `--navy`, `--navy-2`, `--navy-edge`, `--gem`, `--gem-edge`, `--flame`, `--flame-edge` (nuevos, disponibles para fases siguientes). `--primary` reasignado a navy; `--primary-accent` reasignado a rosa en ambos temas; fondo dark reasignado a navy. `--purple` re-apunta a `--primary` (navy) para no romper referencias de admin/decorativas.

- [ ] **Step 1: Añadir tokens navy + juego y reasignar marca en el bloque light (`:root`)**

En `app/globals.css`, dentro de `:root`, reemplazar el bloque `/* Brand */` … hasta `--primary-accent-contrast` por:

```css
  /* Brand — navy (logo wordmark) estructura, rosa acento/CTA */
  --navy:       #201a4d;   /* wordmark del logo */
  --navy-2:     #2c2560;   /* navy elevado */
  --navy-edge:  #14102f;

  --primary:          var(--navy);
  --primary-contrast: #ffffff;
  --primary-edge:     var(--navy-edge);
  --accent:           #e5077e; /* bubblegum pink (logo) */
  --accent-soft:      #ff64b4;
  --accent-contrast:  #ffffff;
  --accent-edge:      #b0005c;

  /* Aliases (admin & decorative surfaces reference these) */
  --purple:      var(--primary);
  --purple-edge: var(--primary-edge);

  /* CTA highlight — rosa en ambos temas */
  --primary-accent: var(--accent);
  --primary-accent-contrast: var(--accent-contrast);
```

Y cambiar `--foreground` de `#3d2352` a `var(--navy)` (texto navy, más on-brand):
```css
  --foreground: #201a4d;     /* navy (logo) */
```

- [ ] **Step 2: Añadir tokens de juego (gem/flame) junto a `--gold` en `:root`**

Justo debajo de la línea `--gold-edge:  #bf8418;` en `:root`, añadir:
```css
  --gem:        #12b5c9;   /* joya cian — moneda */
  --gem-edge:   #0c8a99;
  --flame:      #ff7a1a;   /* llama de racha */
  --flame-edge: #d95f00;
```

- [ ] **Step 3: Reasignar marca en el bloque dark (`:root[data-theme="dark"]`)**

En el bloque `:root[data-theme="dark"]`, cambiar el fondo plum a navy y la marca:
```css
  --background: #14122e;     /* deep navy */
  --surface:    #201a4d;
  --surface-2:  #1b1640;
  --border:     #332c66;
  --dot:        #1b1640;

  --foreground: #f4f2ff;
  --muted:      #b6aee0;

  --navy:       #201a4d;
  --navy-2:     #2c2560;
  --navy-edge:  #14102f;

  --primary:          #6a5cff; /* navy-índigo claro para lienzo oscuro */
  --primary-contrast: #ffffff;
  --primary-edge:     #4a3fd0;
  --accent:           #ff3d9e; /* rosa más brillante en oscuro */
  --accent-soft:      #ff77bf;
  --accent-contrast:  #ffffff;
  --accent-edge:      #c1156f;
```
(El resto del bloque dark — `--purple` alias, `--primary-accent: var(--accent)`, success/danger/gold, etc. — se deja igual; `--primary-accent` ya era `--accent` en dark, correcto.)

Añadir gem/flame en dark junto a `--gold-edge: #bf942e;`:
```css
  --gem:        #35d0e2;
  --gem-edge:   #159fb0;
  --flame:      #ff9540;
  --flame-edge: #e06a10;
```

- [ ] **Step 4: Espejar los mismos cambios en el bloque `@media (prefers-color-scheme: dark)`**

El bloque `@media (prefers-color-scheme: dark) { :root:not([data-theme]) { … } }` es un duplicado del tema dark para usuarios sin preferencia guardada. Aplicar EXACTAMENTE los mismos valores del Step 3 (background navy, foreground, navy tokens, primary índigo claro, accent rosa, gem/flame). Debe quedar idéntico al bloque `[data-theme="dark"]` para que no haya divergencia entre "dark por toggle" y "dark por sistema".

- [ ] **Step 5: Build (type-check + lint)**

Run:
```bash
cd /home/endurance/Projects/Endurance/dots/dots-webapp
source ~/.nvm/nvm.sh && npm run build
```
Expected: build OK sin errores de type-check ni lint. (CSS no rompe el build salvo sintaxis; verifica que no quedaron llaves desbalanceadas.)

- [ ] **Step 6: Verificar re-skin en preview (light + dark)**

Arrancar preview (preview_start si no corre), navegar a la pantalla de login y a `/levels`. Con preview_screenshot capturar light; togglear a dark (preview_eval `localStorage.setItem('dots-theme','dark');location.reload()`) y capturar dark. Confirmar visualmente: fondos/estructura en navy, CTAs y acentos en rosa, cero morado #7c5cff residual, contraste de texto legible (navy sobre blush en light; near-white sobre navy en dark). Ajustar hexes en `globals.css` si algún contraste falla y re-verificar.

- [ ] **Step 7: Commit**

```bash
cd /home/endurance/Projects/Endurance/dots/dots-webapp
git add app/globals.css
git commit -m "feat(ui): paleta navy + rosa del logo, retira morado, tokens de juego

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

## Self-Review

**Spec coverage (Fase 0 + Fase 1 del spec):**
- Merge learning-path→main + rama redesign/total (ambos repos) → Task 0. ✓
- "Tokens rosa/navy" → Task 1 Steps 1-4. ✓
- "Fuentes, botones 3D, dark mode, Doty poses" → ya existen en la base (verificado: Baloo/Nunito en layout.tsx, botón en components/ui/button, dark en globals.css). NO requieren trabajo en esta fase; las poses de Doty se cannibalizarán de doty-brand en la Fase 7 (perfil/Doty custom), no aquí — la Fase 1 del spec las listaba pero el uso real de poses llega con el avatar customizable.
- "re-pinta lo existente sin cambiar estructura" → Task 1 no toca estructura, solo tokens. ✓

**Nota de desviación del spec (comunicada al usuario):** el spec ponía `migrate-redesign.js` con TODAS las tablas nuevas en Fase 0. Se difiere: las migraciones van por fase (fases 0-4 solo necesitan `review_items`, que entra en el plan de la Fase 4). Fase 0 queda como puro git. Razón: YAGNI + no fijar el schema de economía/liga antes de validar la UI. Cada fase trae su migración con backup/rollback.

**Placeholder scan:** sin TBD/TODO; todos los hexes y comandos son concretos.

**Type/token consistency:** `--navy`/`--navy-2`/`--navy-edge`/`--gem`/`--gem-edge`/`--flame`/`--flame-edge` se definen en los 3 bloques con los mismos nombres. `--primary-accent` = `--accent` (rosa) en los 3. `--purple` re-apunta a `--primary` en los 3 (light explícito; dark ya lo hacía).

## Execution Handoff

Al terminar este plan (Fase 0 + 1), sigue el plan de la Fase 2 (layout: bottom tabs + sidebar iconos + header HUD + camino-como-home + hub Zona de juego), que se escribirá como su propio documento.
