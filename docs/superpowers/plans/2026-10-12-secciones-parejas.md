# Secciones parejas del Camino — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Re-cortar el Camino de producción en 16 secciones de 7 a 9 nodos (11, 3 y 2 por dificultad) sin cambiar el orden, con un script de datos que se puede revertir.

**Architecture:** Un script de backend, `scripts/rebalance-sections.js`, que lee el Camino, compara con el inventario del 2026-10-12 (`antes.json`), aplica el reparto escrito en `reparto.js` dentro de una transacción y verifica el resultado antes del COMMIT. Toda la lógica vive en `core.js`, pura y probada con `node:test` sobre `antes.json`; el CLI solo hace SQL. Un ensayo con un Postgres local desechable prueba `--apply` y `--rollback` de punta a punta antes de tocar producción. No cambia código de la app en ningún repo.

**Tech Stack:** Node 24 (CommonJS), `pg`, `node:test` + `node:assert/strict`, PostgreSQL local (`initdb`, `pg_ctl`, `psql`) y `openssl` para el ensayo.

**Spec:** `docs/superpowers/specs/2026-10-12-secciones-parejas-design.md` (en dots-webapp). Léela antes de empezar: el reparto, las decisiones y las siete verificaciones salen de ahí.

## Global Constraints

- Todo el backend se trabaja en el worktree `/home/endurance/Projects/Endurance/dots/dots-backend/.claude/worktrees/secciones-parejas` (branch `feat/secciones-parejas`, desde `origin/main`). **El checkout `/home/endurance/Projects/Endurance/dots/dots-backend` es compartido**: nunca cambiar de branch ahí ni editar archivos en él.
- Node 24 (`.nvmrc`). En la terminal de Claude (zsh): `source ~/.nvm/nvm.sh && nvm use`. Un subagente cuyo shell arranca con Node 20 antepone `export PATH="$HOME/.nvm/versions/node/v24.19.0/bin:$PATH"`.
- No se toca `src/` del backend ni el código de la app del webapp. Todo el cambio es el script, sus datos, sus tests y su ensayo.
- Patrón obligatorio del CLAUDE.md del backend: dry-run por defecto, `--apply` explícito, respaldo JSON en `scripts/out/` antes del COMMIT y `--rollback <respaldo>`.
- **`--apply` y `--rollback` contra producción solo con el sí explícito de Sergio en la conversación** («corre el apply» o equivalente). Una directiva general no cuenta. El dry-run también lee producción: si el clasificador de permisos lo bloquea, se le pide a Sergio que lo autorice; no se busca otra vía.
- `git add` siempre con rutas explícitas, nunca `-A` ni `.` (`scripts/out` es un enlace y está en `.gitignore`).
- Commits en español, `tipo(ámbito): resumen`, terminados en `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- `npm run test:scripts` en verde en cada commit desde la Task 1.
- Reparto (spec §El reparto): secciones de 7 a 9 nodos sin contar el checkpoint; 11, 3 y 2 por dificultad; nombres «Level 1» a «Level 16» en el orden del Camino; «Las decenas» (nodo 143) justo detrás de «Números 1–20» (nodo 2); Level 1 a Level 7 sin checkpoint.

## File Structure

**dots-backend** (worktree `secciones-parejas`):

| Archivo | Responsabilidad |
|---|---|
| `scripts/rebalance-sections.js` | CLI: conexión, lectura del Camino, dry-run, `--apply` en una transacción, `--rollback`. Solo SQL e impresión. |
| `scripts/rebalance-sections/antes.json` | Inventario de producción del 2026-10-12 (secciones, nodos, niveles, oraciones). Es a la vez el fixture de los tests y la referencia contra la que el CLI aborta. |
| `scripts/rebalance-sections/reparto.js` | El reparto de la spec (16 secciones con sus nodos y checkpoint) y las constantes. El diff de este archivo es la revisión del reparto. |
| `scripts/rebalance-sections/core.js` | Lógica pura: recorrido del Camino, precondiciones, plan, simulación, las siete verificaciones, informe, respaldo, nodo actual. |
| `scripts/rebalance-sections/core.test.js` | Tests `node:test` de `core.js` sobre `antes.json`. |
| `scripts/rebalance-sections/ensayo/` | `schema.sql`, `seed.js` y `ensayo.sh`: el ensayo contra un Postgres local desechable. |
| `package.json` | Scripts `test:scripts`, `sections:rebalance` y `sections:rebalance:ensayo`. |

**dots-webapp** (este worktree, branch `claude/balance-section-levels-d73af1`): este plan y, al cerrar, la línea de estado de la spec.

---

## Parte A — Código (nada toca producción)

### Task 1: Worktree, inventario y reparto

**Files:**
- Create: worktree `/home/endurance/Projects/Endurance/dots/dots-backend/.claude/worktrees/secciones-parejas`
- Create: `scripts/rebalance-sections/antes.json`
- Create: `scripts/rebalance-sections/reparto.js`
- Create: `scripts/rebalance-sections/core.js`
- Test: `scripts/rebalance-sections/core.test.js`
- Modify: `package.json` (script `test:scripts`)

**Interfaces:**
- Produces (`reparto.js`): `REPARTO: Array<{ name: string, difficulty: 1|2|3, sectionId: number|null, checkpoint: number|null, nodes: number[] }>` (`sectionId: null` = sección nueva); `MOVIDO = { nodo: 143, detrasDe: 2 }`; `CHECKPOINTS_RETIRADOS = [26, 95, 107]`; `RETIRADOS_PREVIOS = [132, 133, 134, 41]`; `MAX_SECTION_ID_ANTES = 12`; `MIN_NODOS = 7`; `MAX_NODOS = 9`; `POSITION_STEP = 10`; `PARKING_BASE = 10000`; `TEMP_BASE = 1000000`; `CHECKPOINT_MIN_SENTENCES = 5`.
- Produces (`core.js`): un *snapshot* es `{ sections: [{ id, name, idDifficulty }], nodes: [{ id, sectionId, position, type, refId, enabled, title? }], levels: [{ id, idSection, enabled }], sentencesByLevel: Map<levelId, number> }`. Funciones: `fromTuples(json) → snapshot`; `walk(snapshot) → node[]` (visibles en orden del Camino); `lecciones(snapshot) → number[]` (ids visibles sin checkpoints); `checkReparto(antes, reparto = REPARTO) → string[]` (vacío = coherente).

- [ ] **Step 1: Crear el worktree**

```bash
git -C /home/endurance/Projects/Endurance/dots/dots-backend fetch origin
git -C /home/endurance/Projects/Endurance/dots/dots-backend worktree add /home/endurance/Projects/Endurance/dots/dots-backend/.claude/worktrees/secciones-parejas -b feat/secciones-parejas origin/main
```

Expected: `Preparing worktree (new branch 'feat/secciones-parejas')`.

- [ ] **Step 2: Enlazar `.env` y `scripts/out`, e instalar dependencias**

El CLI lee `../.env` relativo a `scripts/`. El enlace de `scripts/out` hace que los respaldos de producción sobrevivan al worktree: `git worktree remove` borra los archivos ignorados. Va antes de correr ningún script, porque `fs.mkdirSync` lo crearía como directorio real.

```bash
cd /home/endurance/Projects/Endurance/dots/dots-backend/.claude/worktrees/secciones-parejas
ln -s /home/endurance/Projects/Endurance/dots/dots-backend/.env .env
ln -s /home/endurance/Projects/Endurance/dots/dots-backend/scripts/out scripts/out
source ~/.nvm/nvm.sh && nvm use && npm ci
git status --short
```

Expected: `added N packages` y `git status` vacío (los dos enlaces están en `.gitignore`).

- [ ] **Step 3: Añadir el script `test:scripts` a `package.json`**

Reemplaza la línea:

```json
    "test:e2e": "jest --config ./test/jest-e2e.json",
```

por:

```json
    "test:e2e": "jest --config ./test/jest-e2e.json",
    "test:scripts": "node --test scripts/rebalance-sections/*.test.js",
```

`npm` corre los scripts con `sh`, que expande el glob. Jest no ve estos tests: su `rootDir` es `src`.

- [ ] **Step 4: Escribir el test que falla**

Crea `scripts/rebalance-sections/core.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert/strict');

const core = require('./core');
const { REPARTO, MIN_NODOS, MAX_NODOS } = require('./reparto');

const ANTES = core.fromTuples(require('./antes.json'));
const NUEVAS = [13, 14, 15, 16];

/** Copia profunda: los tests mutan sin tocar ANTES. */
const copia = (s) => ({
  sections: s.sections.map((x) => ({ ...x })),
  nodes: s.nodes.map((x) => ({ ...x })),
  levels: s.levels.map((x) => ({ ...x })),
  sentencesByLevel: new Map(s.sentencesByLevel),
});
const despues = () => core.applyToSnapshot(ANTES, core.planChanges(ANTES, NUEVAS));
const fallan = (resultados) => resultados.filter((r) => r.errores.length).map((r) => r.nombre);
const nodo = (s, id) => s.nodes.find((n) => n.id === id);
const nivel = (s, id) => s.levels.find((l) => l.id === id);
const seccion = (s, id) => s.sections.find((x) => x.id === id);

// ── Inventario y reparto ─────────────────────────────────────────────────

test('antes.json reproduce el inventario del 2026-10-12', () => {
  assert.equal(ANTES.sections.length, 12);
  assert.equal(ANTES.nodes.length, 143);
  assert.equal(ANTES.levels.length, 95);
  assert.deepEqual(ANTES.nodes.filter((n) => !n.enabled).map((n) => n.id).sort((a, b) => a - b), [41, 132, 133, 134]);

  const visibles = core.walk(ANTES);
  const porSeccion = ANTES.sections.map((s) => visibles.filter((n) => n.sectionId === s.id && n.type !== 'checkpoint').length);
  assert.deepEqual(porSeccion, [56, 13, 13, 4, 7, 7, 5, 7, 2, 1, 1, 11]);
  assert.equal(core.lecciones(ANTES).length, 127);
  assert.equal(visibles.filter((n) => n.type === 'checkpoint').length, 12);
});

test('walk sigue el filtro de GET /path: nodo retirado o nivel apagado no se ven', () => {
  const s = copia(ANTES);
  nivel(s, 19).enabled = false; // articles, nodo 27
  const ids = core.walk(s).map((n) => n.id);
  assert.ok(!ids.includes(27));
  assert.ok(!ids.includes(41));
  assert.equal(core.walk(ANTES)[0].id, 108);
});

test('el reparto cubre los 127 nodos en el orden de hoy, salvo Las decenas', () => {
  assert.deepEqual(core.checkReparto(ANTES), []);
});

test('el reparto: de 7 a 9 nodos por sección y 11, 3 y 2 secciones por dificultad', () => {
  for (const s of REPARTO) assert.ok(s.nodes.length >= MIN_NODOS && s.nodes.length <= MAX_NODOS, s.name);
  assert.deepEqual([1, 2, 3].map((d) => REPARTO.filter((s) => s.difficulty === d).length), [11, 3, 2]);
  assert.deepEqual(REPARTO.map((s) => s.name), REPARTO.map((_, i) => `Level ${i + 1}`));
});

test('checkReparto detecta un nodo fuera de su orden', () => {
  const reparto = REPARTO.map((s) => ({ ...s, nodes: [...s.nodes] }));
  [reparto[2].nodes[0], reparto[2].nodes[1]] = [reparto[2].nodes[1], reparto[2].nodes[0]];
  assert.match(core.checkReparto(ANTES, reparto).join('\n'), /no sigue el orden de hoy/);
});

test('checkReparto detecta un checkpoint perdido', () => {
  const reparto = REPARTO.map((s) => (s.name === 'Level 16' ? { ...s, checkpoint: null } : s));
  assert.match(core.checkReparto(ANTES, reparto).join('\n'), /checkpoints de hoy/);
});

test('checkReparto detecta secciones fuera del orden de id', () => {
  const reparto = REPARTO.map((s) => {
    if (s.name === 'Level 12') return { ...s, sectionId: 6 };
    if (s.name === 'Level 13') return { ...s, sectionId: 5 };
    return s;
  });
  assert.match(core.checkReparto(ANTES, reparto).join('\n'), /dificultad 2: las secciones no van en orden de id/);
});

```

- [ ] **Step 5: Correrlo y ver que falla**

Run: `npm run test:scripts`
Expected: FAIL, `Cannot find module './core'`.

- [ ] **Step 6: Crear el inventario**

Crea `scripts/rebalance-sections/antes.json`. Es el volcado de producción del 2026-10-12 (solo lectura); no se edita a mano:

```json
{
  "$comment": "Estado del Camino en producción el 2026-10-12 (lectura), antes de secciones parejas. rebalance-sections.js aborta si la BD no coincide con sections, nodes y levels; sentences solo alimenta la verificación del checkpoint. Tuplas: sections [id, name, idDifficulty] · nodes [id, sectionId, position, type, refId, enabled] · levels [id, idSection, enabled] · sentences [levelId, oraciones activas], solo niveles con alguna.",
  "sections": [
    [1,"Level 1",1],
    [2,"Level 2",1],
    [3,"Level 3",1],
    [4,"Level 4",1],
    [5,"Level 5",2],
    [6,"Level 6",2],
    [7,"Level 7",2],
    [8,"Level 8",2],
    [9,"Level 9",3],
    [10,"Level 10",3],
    [11,"Level 11",3],
    [12,"Level 12",3]
  ],
  "nodes": [
    [108,1,1,"vocab",1,true],
    [109,1,2,"grammar",1,true],
    [110,1,3,"pronunciation",1,true],
    [111,1,4,"vocab",2,true],
    [112,1,6,"vocab",3,true],
    [1,1,10,"letters",1,true],
    [137,1,11,"reading",1,true],
    [113,1,15,"pronunciation",2,true],
    [2,1,20,"numbers",1,true],
    [3,1,30,"vocab",10,true],
    [114,1,35,"grammar",2,true],
    [4,1,40,"vocab",11,true],
    [138,1,41,"reading",2,true],
    [115,1,45,"grammar",3,true],
    [5,1,50,"vocab",12,true],
    [116,1,55,"pronunciation",3,true],
    [6,1,60,"vocab",13,true],
    [117,1,65,"grammar",4,true],
    [7,1,70,"vocab",14,true],
    [118,1,75,"grammar",5,true],
    [119,1,76,"pronunciation",5,true],
    [8,1,80,"vocab",15,true],
    [139,1,81,"reading",3,true],
    [120,1,85,"grammar",7,true],
    [9,1,90,"vocab",16,true],
    [121,1,95,"grammar",8,true],
    [10,1,100,"vocab",17,true],
    [122,1,105,"pronunciation",4,true],
    [11,1,110,"vocab",18,true],
    [123,1,115,"vocab",4,true],
    [12,1,120,"vocab",19,true],
    [140,1,121,"reading",4,true],
    [124,1,125,"grammar",6,true],
    [13,1,130,"vocab",20,true],
    [125,1,135,"pronunciation",6,true],
    [14,1,140,"vocab",21,true],
    [126,1,145,"grammar",9,true],
    [15,1,150,"vocab",22,true],
    [16,1,160,"vocab",23,true],
    [141,1,161,"reading",5,true],
    [127,1,165,"pronunciation",7,true],
    [17,1,170,"vocab",24,true],
    [128,1,175,"grammar",10,true],
    [18,1,180,"vocab",25,true],
    [129,1,185,"pronunciation",8,true],
    [19,1,190,"vocab",26,true],
    [130,1,195,"vocab",6,true],
    [20,1,200,"vocab",27,true],
    [142,1,201,"reading",6,true],
    [131,1,205,"vocab",5,true],
    [21,1,210,"vocab",28,true],
    [22,1,220,"vocab",29,true],
    [132,1,225,"vocab",7,false],
    [23,1,230,"vocab",30,true],
    [24,1,240,"vocab",31,true],
    [133,1,245,"vocab",8,false],
    [25,1,250,"vocab",32,true],
    [134,1,255,"vocab",9,false],
    [26,1,260,"checkpoint",null,true],
    [143,1,270,"numbers",2,true],
    [27,2,10,"practice",19,true],
    [28,2,20,"practice",20,true],
    [29,2,30,"practice",21,true],
    [135,2,35,"grammar",11,true],
    [30,2,40,"practice",22,true],
    [31,2,50,"practice",23,true],
    [32,2,60,"practice",24,true],
    [33,2,70,"practice",25,true],
    [34,2,80,"practice",26,true],
    [35,2,90,"practice",27,true],
    [36,2,100,"practice",28,true],
    [37,2,110,"practice",29,true],
    [38,2,120,"practice",30,true],
    [39,2,130,"checkpoint",null,true],
    [40,3,10,"practice",31,true],
    [41,3,20,"practice",32,false],
    [42,3,30,"practice",33,true],
    [43,3,40,"practice",34,true],
    [44,3,50,"practice",35,true],
    [45,3,60,"practice",36,true],
    [46,3,70,"practice",37,true],
    [47,3,80,"practice",38,true],
    [48,3,90,"practice",39,true],
    [49,3,100,"practice",40,true],
    [50,3,110,"practice",41,true],
    [51,3,120,"practice",42,true],
    [136,3,125,"pronunciation",9,true],
    [52,3,130,"practice",43,true],
    [53,3,140,"checkpoint",null,true],
    [54,4,10,"practice",51,true],
    [55,4,20,"practice",52,true],
    [56,4,30,"practice",53,true],
    [57,4,40,"practice",54,true],
    [58,4,50,"checkpoint",null,true],
    [59,5,10,"practice",55,true],
    [60,5,20,"practice",56,true],
    [61,5,30,"practice",57,true],
    [62,5,40,"practice",58,true],
    [63,5,50,"practice",59,true],
    [64,5,60,"practice",60,true],
    [65,5,70,"practice",61,true],
    [66,5,80,"checkpoint",null,true],
    [67,6,10,"practice",62,true],
    [68,6,20,"practice",63,true],
    [69,6,30,"practice",64,true],
    [70,6,40,"practice",65,true],
    [71,6,50,"practice",66,true],
    [72,6,60,"practice",67,true],
    [73,6,70,"practice",68,true],
    [74,6,80,"checkpoint",null,true],
    [75,7,10,"practice",69,true],
    [76,7,20,"practice",70,true],
    [77,7,30,"practice",71,true],
    [78,7,40,"practice",72,true],
    [79,7,50,"practice",73,true],
    [80,7,60,"checkpoint",null,true],
    [81,8,10,"practice",74,true],
    [82,8,20,"practice",75,true],
    [83,8,30,"practice",76,true],
    [84,8,40,"practice",77,true],
    [85,8,50,"practice",78,true],
    [86,8,60,"practice",79,true],
    [87,8,70,"practice",80,true],
    [88,8,80,"checkpoint",null,true],
    [89,9,10,"practice",81,true],
    [90,9,20,"practice",83,true],
    [91,9,30,"checkpoint",null,true],
    [92,10,10,"practice",82,true],
    [93,10,20,"checkpoint",null,true],
    [94,11,10,"practice",84,true],
    [95,11,20,"checkpoint",null,true],
    [96,12,10,"practice",85,true],
    [97,12,20,"practice",86,true],
    [98,12,30,"practice",87,true],
    [99,12,40,"practice",88,true],
    [100,12,50,"practice",89,true],
    [101,12,60,"practice",90,true],
    [102,12,70,"practice",91,true],
    [103,12,80,"practice",92,true],
    [104,12,90,"practice",93,true],
    [105,12,100,"practice",94,true],
    [106,12,110,"practice",95,true],
    [107,12,120,"checkpoint",null,true]
  ],
  "levels": [
    [1,1,true],
    [2,1,true],
    [3,1,true],
    [4,1,true],
    [5,1,true],
    [6,1,true],
    [7,1,true],
    [8,1,true],
    [9,1,true],
    [10,1,true],
    [11,1,true],
    [12,1,true],
    [13,1,true],
    [14,1,true],
    [15,1,true],
    [16,1,true],
    [17,1,true],
    [18,1,true],
    [19,2,true],
    [20,2,true],
    [21,2,true],
    [22,2,true],
    [23,2,true],
    [24,2,true],
    [25,2,true],
    [26,2,true],
    [27,2,true],
    [28,2,true],
    [29,2,true],
    [30,2,true],
    [31,3,true],
    [32,3,true],
    [33,3,true],
    [34,3,true],
    [35,3,true],
    [36,3,true],
    [37,3,true],
    [38,3,true],
    [39,3,true],
    [40,3,true],
    [41,3,true],
    [42,3,true],
    [43,3,true],
    [44,1,true],
    [45,1,true],
    [46,1,true],
    [47,1,true],
    [48,1,true],
    [49,1,true],
    [50,1,true],
    [51,4,true],
    [52,4,true],
    [53,4,true],
    [54,4,true],
    [55,5,true],
    [56,5,true],
    [57,5,true],
    [58,5,true],
    [59,5,true],
    [60,5,true],
    [61,5,true],
    [62,6,true],
    [63,6,true],
    [64,6,true],
    [65,6,true],
    [66,6,true],
    [67,6,true],
    [68,6,true],
    [69,7,true],
    [70,7,true],
    [71,7,true],
    [72,7,true],
    [73,7,true],
    [74,8,true],
    [75,8,true],
    [76,8,true],
    [77,8,true],
    [78,8,true],
    [79,8,true],
    [80,8,true],
    [81,9,true],
    [82,10,true],
    [83,9,true],
    [84,11,true],
    [85,12,true],
    [86,12,true],
    [87,12,true],
    [88,12,true],
    [89,12,true],
    [90,12,true],
    [91,12,true],
    [92,12,true],
    [93,12,true],
    [94,12,true],
    [95,12,true]
  ],
  "sentences": [
    [19,10],
    [20,10],
    [21,20],
    [22,20],
    [23,14],
    [24,8],
    [25,15],
    [26,8],
    [27,10],
    [28,8],
    [29,13],
    [30,9],
    [31,8],
    [33,12],
    [34,8],
    [35,8],
    [36,8],
    [37,8],
    [38,8],
    [39,14],
    [40,12],
    [41,8],
    [42,8],
    [43,8],
    [51,8],
    [52,8],
    [53,10],
    [54,11],
    [55,9],
    [56,18],
    [57,14],
    [58,14],
    [59,10],
    [60,10],
    [61,8],
    [62,8],
    [63,26],
    [64,14],
    [65,8],
    [66,10],
    [67,13],
    [68,10],
    [69,10],
    [70,8],
    [71,8],
    [72,8],
    [73,10],
    [74,8],
    [75,8],
    [76,9],
    [77,8],
    [78,10],
    [79,8],
    [80,8],
    [81,8],
    [82,8],
    [83,8],
    [84,8],
    [85,11],
    [86,8],
    [87,8],
    [88,8],
    [89,8],
    [90,8],
    [91,8],
    [92,8],
    [93,8],
    [94,10],
    [95,10]
  ]
}
```

- [ ] **Step 7: Crear el reparto**

Crea `scripts/rebalance-sections/reparto.js`. Las listas son las tablas de la spec, nodo por nodo:

```js
/**
 * Reparto del Camino en secciones de ~8 nodos. Copiado de las tablas de la
 * spec (webapp docs/superpowers/specs/2026-10-12-secciones-parejas-design.md,
 * §El reparto): el diff de este archivo es la revisión del reparto.
 *
 * `sectionId: null` es una sección nueva. Las nuevas se crean en el orden en
 * que aparecen y toman los ids que dé la secuencia (se esperan 13 a 16). El
 * Camino ordena por id dentro de cada dificultad, así que en cada dificultad
 * las reutilizadas van en orden de id y las nuevas al final.
 */
const REPARTO = [
  // Beginner
  { name: 'Level 1', difficulty: 1, sectionId: 1, checkpoint: null, nodes: [108, 109, 110, 111, 112, 1, 137, 113] },
  { name: 'Level 2', difficulty: 1, sectionId: 2, checkpoint: null, nodes: [2, 143, 3, 114, 4, 138, 115, 5] },
  { name: 'Level 3', difficulty: 1, sectionId: 3, checkpoint: null, nodes: [116, 6, 117, 7, 118, 119, 8, 139] },
  { name: 'Level 4', difficulty: 1, sectionId: 4, checkpoint: null, nodes: [120, 9, 121, 10, 122, 11, 123, 12, 140] },
  { name: 'Level 5', difficulty: 1, sectionId: 8, checkpoint: null, nodes: [124, 13, 125, 14, 126, 15, 16, 141] },
  { name: 'Level 6', difficulty: 1, sectionId: 11, checkpoint: null, nodes: [127, 17, 128, 18, 129, 19, 130] },
  { name: 'Level 7', difficulty: 1, sectionId: 12, checkpoint: null, nodes: [20, 142, 131, 21, 22, 23, 24, 25] },
  { name: 'Level 8', difficulty: 1, sectionId: null, checkpoint: 39, nodes: [27, 28, 29, 135, 30, 31, 32, 33] },
  { name: 'Level 9', difficulty: 1, sectionId: null, checkpoint: 53, nodes: [34, 35, 36, 37, 38, 40, 42, 43] },
  { name: 'Level 10', difficulty: 1, sectionId: null, checkpoint: 58, nodes: [44, 45, 46, 47, 48, 49, 50] },
  { name: 'Level 11', difficulty: 1, sectionId: null, checkpoint: 88, nodes: [51, 136, 52, 54, 55, 56, 57] },
  // Intermediate
  { name: 'Level 12', difficulty: 2, sectionId: 5, checkpoint: 66, nodes: [59, 60, 61, 62, 63, 64, 65, 67, 68] },
  { name: 'Level 13', difficulty: 2, sectionId: 6, checkpoint: 74, nodes: [69, 70, 71, 72, 73, 75, 76, 77, 78] },
  { name: 'Level 14', difficulty: 2, sectionId: 7, checkpoint: 80, nodes: [79, 81, 82, 83, 84, 85, 86, 87] },
  // Advanced
  { name: 'Level 15', difficulty: 3, sectionId: 9, checkpoint: 91, nodes: [89, 90, 92, 94, 96, 97, 98, 99] },
  { name: 'Level 16', difficulty: 3, sectionId: 10, checkpoint: 93, nodes: [100, 101, 102, 103, 104, 105, 106] },
];

/** Único cambio de orden: «Las decenas» va justo detrás de «Números 1–20». */
const MOVIDO = { nodo: 143, detrasDe: 2 };

/** Checkpoints que sobran y pasan a enabled = false. El 26 es el de la sección 1, sin preguntas. */
const CHECKPOINTS_RETIRADOS = [26, 95, 107];

/** Nodos ya retirados antes de este cambio (fusión de duplicados del 2026-09-29). */
const RETIRADOS_PREVIOS = [132, 133, 134, 41];

/** Mayor section.id antes del cambio: toda sección nueva tiene que quedar por encima. */
const MAX_SECTION_ID_ANTES = 12;

/** Tamaño permitido de una sección, sin contar el checkpoint. */
const MIN_NODOS = 7;
const MAX_NODOS = 9;

/** Paso de posición dentro de cada sección: 10, 20, 30…, como el resto del Camino. */
const POSITION_STEP = 10;

/** Los retirados se estacionan en PARKING_BASE + id, fuera de la numeración nueva. */
const PARKING_BASE = 10000;

/** Posición temporal (TEMP_BASE + id) mientras se mueven los nodos, para que UNIQUE (section_id, position) no salte. */
const TEMP_BASE = 1000000;

/** Mínimo de oraciones para que un checkpoint sea examen (CHECKPOINT_MIN_SENTENCES en src/modules/path/path.service.ts). */
const CHECKPOINT_MIN_SENTENCES = 5;

module.exports = {
  REPARTO,
  MOVIDO,
  CHECKPOINTS_RETIRADOS,
  RETIRADOS_PREVIOS,
  MAX_SECTION_ID_ANTES,
  MIN_NODOS,
  MAX_NODOS,
  POSITION_STEP,
  PARKING_BASE,
  TEMP_BASE,
  CHECKPOINT_MIN_SENTENCES,
};
```

- [ ] **Step 8: Crear `core.js` con el recorrido y `checkReparto`**

Crea `scripts/rebalance-sections/core.js`:

```js
/**
 * Lógica pura de rebalance-sections.js: no toca la BD, así que se prueba con
 * antes.json (`npm run test:scripts`).
 *
 * Un snapshot es el estado del Camino en este formato:
 *   sections          [{ id, name, idDifficulty }]
 *   nodes             [{ id, sectionId, position, type, refId, enabled, title? }]
 *   levels            [{ id, idSection, enabled }]
 *   sentencesByLevel  Map<levelId, oraciones activas>
 */
const {
  REPARTO,
  MOVIDO,
  CHECKPOINTS_RETIRADOS,
  RETIRADOS_PREVIOS,
  MIN_NODOS,
  MAX_NODOS,
  POSITION_STEP,
  PARKING_BASE,
  CHECKPOINT_MIN_SENTENCES,
} = require('./reparto');

const porId = (a, b) => a - b;
const iguales = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]);

/** antes.json (tuplas) → snapshot. */
function fromTuples(json) {
  return {
    sections: json.sections.map(([id, name, idDifficulty]) => ({ id, name, idDifficulty })),
    nodes: json.nodes.map(([id, sectionId, position, type, refId, enabled]) => ({
      id, sectionId, position, type, refId, enabled,
    })),
    levels: json.levels.map(([id, idSection, enabled]) => ({ id, idSection, enabled })),
    sentencesByLevel: new Map(json.sentences),
  };
}

/** Secciones en el orden del Camino: dificultad y, dentro de ella, id. */
function seccionesEnOrden(snapshot) {
  return [...snapshot.sections].sort((a, b) => a.idDifficulty - b.idDifficulty || a.id - b.id);
}

/**
 * Nodos visibles en el orden del Camino, con el filtro de GET /path: nodo
 * enabled y, si es practice, nivel enabled (buildWalkCatalog en
 * src/modules/path/path-walk.ts).
 */
function walk(snapshot) {
  const nivelesOn = new Set(snapshot.levels.filter((l) => l.enabled).map((l) => l.id));
  const out = [];
  for (const s of seccionesEnOrden(snapshot)) {
    out.push(
      ...snapshot.nodes
        .filter((n) => n.sectionId === s.id && n.enabled && (n.type !== 'practice' || nivelesOn.has(n.refId)))
        .sort((a, b) => a.position - b.position),
    );
  }
  return out;
}

/** Ids de los nodos visibles que no son checkpoint, en orden. */
function lecciones(snapshot) {
  return walk(snapshot).filter((n) => n.type !== 'checkpoint').map((n) => n.id);
}

/** Primer índice donde dos listas difieren, o -1 si son iguales. */
function primeraDiferencia(a, b) {
  for (let i = 0; i < Math.max(a.length, b.length); i++) if (a[i] !== b[i]) return i;
  return -1;
}

/**
 * Coherencia del reparto con el estado de antes: cubre cada nodo visible una
 * vez y en el orden de hoy (salvo MOVIDO), usa exactamente los checkpoints de
 * hoy y reutiliza cada sección existente una vez, en orden de id.
 */
function checkReparto(antes, reparto = REPARTO) {
  const errores = [];

  const esperado = lecciones(antes).filter((id) => id !== MOVIDO.nodo);
  esperado.splice(esperado.indexOf(MOVIDO.detrasDe) + 1, 0, MOVIDO.nodo);
  const plan = reparto.flatMap((s) => s.nodes);
  const i = primeraDiferencia(plan, esperado);
  if (i !== -1) errores.push(`el reparto no sigue el orden de hoy: en la posición ${i} pone ${plan[i]}, toca ${esperado[i]}`);

  const cpsHoy = walk(antes).filter((n) => n.type === 'checkpoint').map((n) => n.id).sort(porId);
  const cpsPlan = [...reparto.map((s) => s.checkpoint).filter((c) => c !== null), ...CHECKPOINTS_RETIRADOS].sort(porId);
  if (!iguales(cpsHoy, cpsPlan)) errores.push(`checkpoints de hoy ${cpsHoy}; el reparto usa ${cpsPlan}`);

  const retiradosHoy = antes.nodes.filter((n) => !n.enabled).map((n) => n.id).sort(porId);
  const retiradosPlan = [...RETIRADOS_PREVIOS].sort(porId);
  if (!iguales(retiradosHoy, retiradosPlan)) errores.push(`retirados de hoy ${retiradosHoy}; el reparto espera ${retiradosPlan}`);

  const reutilizadas = reparto.filter((s) => s.sectionId !== null).map((s) => s.sectionId).sort(porId);
  const existentes = antes.sections.map((s) => s.id).sort(porId);
  if (!iguales(reutilizadas, existentes)) errores.push(`el reparto reutiliza ${reutilizadas}; existen ${existentes}`);

  for (const d of new Set(reparto.map((s) => s.difficulty))) {
    const ids = reparto.filter((s) => s.difficulty === d).map((s) => s.sectionId ?? Infinity);
    if (ids.some((id, k) => k > 0 && id < ids[k - 1])) {
      errores.push(`dificultad ${d}: las secciones no van en orden de id (${ids.map((x) => (x === Infinity ? 'nueva' : x))})`);
    }
  }
  return errores;
}

module.exports = {
  fromTuples,
  walk,
  lecciones,
  checkReparto,
};
```

`walk` repite el filtro de `buildWalkCatalog` (`src/modules/path/path-walk.ts`): si se separan, los tests dejarían de describir lo que ve el alumno.

- [ ] **Step 9: Correr los tests**

Run: `npm run test:scripts`
Expected: PASS, `tests 7`, `pass 7`.

- [ ] **Step 10: Commit**

```bash
git add package.json scripts/rebalance-sections/antes.json scripts/rebalance-sections/reparto.js scripts/rebalance-sections/core.js scripts/rebalance-sections/core.test.js
git commit -m "$(cat <<'EOF'
feat(scripts): el reparto de secciones parejas, validado contra el inventario

antes.json es el Camino de producción del 2026-10-12 y reparto.js, las tablas
de la spec (webapp docs/superpowers/specs/2026-10-12-secciones-parejas-design.md):
16 secciones de 7 a 9 nodos. checkReparto comprueba que cubre cada nodo una
vez, en el orden de hoy salvo «Las decenas», con los checkpoints de hoy.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Precondiciones

**Files:**
- Modify: `scripts/rebalance-sections/core.js`
- Test: `scripts/rebalance-sections/core.test.js`

**Interfaces:**
- Consumes: `fromTuples`, el formato de snapshot (Task 1).
- Produces: `checkPreconditions(snapshot, antes) → string[]`. Compara secciones (`name`, `idDifficulty`), nodos (`sectionId`, `position`, `type`, `refId`, `enabled`) y niveles (`idSection`, `enabled`); ignora títulos y oraciones. Mensajes: `«<tipo> <id>: falta»`, `«<tipo> <id>: sobra»`, `«<tipo> <id>: <campo> = <real>, se esperaba <esperado>»`, con tipo `sección`, `nodo` o `nivel`.

- [ ] **Step 1: Escribir los tests que fallan**

Añade al final de `core.test.js`:

```js
// ── Precondiciones ───────────────────────────────────────────────────────

test('checkPreconditions: la BD igual al inventario pasa', () => {
  assert.deepEqual(core.checkPreconditions(copia(ANTES), ANTES), []);
});

test('checkPreconditions: cualquier diferencia estructural aborta', () => {
  const s = copia(ANTES);
  nodo(s, 41).position = 25;
  s.nodes.push({ id: 999, sectionId: 5, position: 75, type: 'practice', refId: 60, enabled: true });
  seccion(s, 8).idDifficulty = 1;
  nivel(s, 23).idSection = 3;
  s.levels = s.levels.filter((l) => l.id !== 95);
  const errores = core.checkPreconditions(s, ANTES);
  assert.deepEqual(errores, [
    'sección 8: idDifficulty = 1, se esperaba 2',
    'nodo 41: position = 25, se esperaba 20',
    'nodo 999: sobra',
    'nivel 23: idSection = 3, se esperaba 2',
    'nivel 95: falta',
  ]);
});

test('checkPreconditions ignora títulos y oraciones', () => {
  const s = copia(ANTES);
  nodo(s, 108).title = 'Saludos';
  s.sentencesByLevel.set(19, 0);
  assert.deepEqual(core.checkPreconditions(s, ANTES), []);
});

```

- [ ] **Step 2: Correrlos y ver que fallan**

Run: `npm run test:scripts`
Expected: FAIL en los tres nuevos, `core.checkPreconditions is not a function`.

- [ ] **Step 3: Implementar**

Añade a `core.js`, justo antes de `module.exports`:

```js
function diferencias(tipo, real, esperado, campos) {
  const errores = [];
  const reales = new Map(real.map((x) => [x.id, x]));
  const esperados = new Map(esperado.map((x) => [x.id, x]));
  for (const [id, e] of esperados) {
    const r = reales.get(id);
    if (!r) {
      errores.push(`${tipo} ${id}: falta`);
      continue;
    }
    for (const c of campos) {
      if (r[c] !== e[c]) errores.push(`${tipo} ${id}: ${c} = ${JSON.stringify(r[c])}, se esperaba ${JSON.stringify(e[c])}`);
    }
  }
  for (const id of reales.keys()) if (!esperados.has(id)) errores.push(`${tipo} ${id}: sobra`);
  return errores;
}

/** La BD tiene que ser exactamente la del inventario: secciones, nodos y niveles. */
function checkPreconditions(snapshot, antes) {
  return [
    ...diferencias('sección', snapshot.sections, antes.sections, ['name', 'idDifficulty']),
    ...diferencias('nodo', snapshot.nodes, antes.nodes, ['sectionId', 'position', 'type', 'refId', 'enabled']),
    ...diferencias('nivel', snapshot.levels, antes.levels, ['idSection', 'enabled']),
  ];
}

```

Reemplaza el `module.exports` de `core.js` por:

```js
module.exports = {
  fromTuples,
  walk,
  lecciones,
  checkReparto,
  checkPreconditions,
};
```

- [ ] **Step 4: Correr los tests**

Run: `npm run test:scripts`
Expected: PASS, `tests 10`, `pass 10`.

- [ ] **Step 5: Commit**

```bash
git add scripts/rebalance-sections/core.js scripts/rebalance-sections/core.test.js
git commit -m "$(cat <<'EOF'
feat(scripts): secciones parejas aborta si la BD no es la del inventario

Cualquier diferencia en secciones, nodos o niveles respecto de antes.json
detiene el script antes de escribir: el reparto solo vale para ese Camino.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: El plan de cambios

**Files:**
- Modify: `scripts/rebalance-sections/core.js`
- Test: `scripts/rebalance-sections/core.test.js`

**Interfaces:**
- Consumes: `REPARTO`, `RETIRADOS_PREVIOS`, `CHECKPOINTS_RETIRADOS`, `POSITION_STEP`, `PARKING_BASE` (Task 1).
- Produces: `planChanges(snapshot, newSectionIds: number[], reparto = REPARTO) → { sections: [{ id, name, idDifficulty, nueva }], nodes: [{ id, sectionId, position, enabled }], levels: [{ id, idSection }] }`, con el estado final de las 16 secciones, los 143 nodos y los 69 niveles de práctica. Lanza `Error('hacen falta 4 ids de sección nuevos y llegaron N')` si no llegan 4 ids. `applyToSnapshot(snapshot, changes) → snapshot` nuevo, sin mutar la entrada (copia también `sentencesByLevel`).

- [ ] **Step 1: Escribir los tests que fallan**

Añade al final de `core.test.js`:

```js
// ── Plan ─────────────────────────────────────────────────────────────────

test('planChanges: 12 secciones reutilizadas y 4 nuevas, con nombre y dificultad', () => {
  const { sections } = core.planChanges(ANTES, NUEVAS);
  assert.equal(sections.length, 16);
  assert.deepEqual(
    sections.map((s) => [s.id, s.name, s.idDifficulty, s.nueva]),
    [
      [1, 'Level 1', 1, false], [2, 'Level 2', 1, false], [3, 'Level 3', 1, false], [4, 'Level 4', 1, false],
      [8, 'Level 5', 1, false], [11, 'Level 6', 1, false], [12, 'Level 7', 1, false],
      [13, 'Level 8', 1, true], [14, 'Level 9', 1, true], [15, 'Level 10', 1, true], [16, 'Level 11', 1, true],
      [5, 'Level 12', 2, false], [6, 'Level 13', 2, false], [7, 'Level 14', 2, false],
      [9, 'Level 15', 3, false], [10, 'Level 16', 3, false],
    ],
  );
});

test('planChanges: posiciones 10, 20…, checkpoint al final y retirados estacionados', () => {
  const { nodes } = core.planChanges(ANTES, NUEVAS);
  assert.equal(nodes.length, 143);
  assert.equal(new Set(nodes.map((n) => n.id)).size, 143);
  const de = (id) => nodes.find((n) => n.id === id);
  assert.deepEqual(de(2), { id: 2, sectionId: 2, position: 10, enabled: true });
  assert.deepEqual(de(143), { id: 143, sectionId: 2, position: 20, enabled: true });
  assert.deepEqual(de(27), { id: 27, sectionId: 13, position: 10, enabled: true });
  assert.deepEqual(de(39), { id: 39, sectionId: 13, position: 90, enabled: true });
  assert.deepEqual(de(93), { id: 93, sectionId: 10, position: 80, enabled: true });
  assert.deepEqual(de(26), { id: 26, sectionId: 1, position: 10026, enabled: false });
  assert.deepEqual(de(107), { id: 107, sectionId: 12, position: 10107, enabled: false });
  assert.deepEqual(de(41), { id: 41, sectionId: 3, position: 10041, enabled: false });
});

test('planChanges: cada nivel de práctica sigue a su nodo', () => {
  const { levels } = core.planChanges(ANTES, NUEVAS);
  assert.equal(levels.length, 69);
  const de = (id) => levels.find((l) => l.id === id);
  assert.equal(de(23).idSection, 13); // verb to be → Level 8
  assert.equal(de(55).idSection, 5); // Opposites, se queda
  assert.equal(de(73).idSection, 7); // Wish → Level 14
  assert.equal(de(95).idSection, 10); // Other prepositions → Level 16
  assert.equal(de(32), undefined); // el L32 no tiene nodo visible: no se toca
});

test('planChanges exige un id por cada sección nueva', () => {
  assert.throws(() => core.planChanges(ANTES, [13, 14]), /hacen falta 4 ids de sección nuevos y llegaron 2/);
});

test('applyToSnapshot no muta el snapshot de entrada', () => {
  const s = copia(ANTES);
  const r = core.applyToSnapshot(s, core.planChanges(s, NUEVAS));
  r.sentencesByLevel.set(19, 0);
  assert.deepEqual(core.checkPreconditions(s, ANTES), []);
  assert.equal(s.sentencesByLevel.get(19), 10);
});

```

- [ ] **Step 2: Correrlos y ver que fallan**

Run: `npm run test:scripts`
Expected: FAIL en los cinco nuevos, `core.planChanges is not a function`.

- [ ] **Step 3: Implementar**

Añade a `core.js`, justo antes de `module.exports`:

```js
/**
 * Estado final de cada fila que se toca. `newSectionIds` son los ids de las
 * secciones nuevas, en el orden del reparto.
 */
function planChanges(snapshot, newSectionIds, reparto = REPARTO) {
  const nuevas = reparto.filter((s) => s.sectionId === null).length;
  if (newSectionIds.length !== nuevas) {
    throw new Error(`hacen falta ${nuevas} ids de sección nuevos y llegaron ${newSectionIds.length}`);
  }
  let k = 0;
  const sections = reparto.map((s) => ({
    id: s.sectionId ?? newSectionIds[k++],
    name: s.name,
    idDifficulty: s.difficulty,
    nueva: s.sectionId === null,
  }));

  const nodes = [];
  reparto.forEach((s, i) => {
    const sectionId = sections[i].id;
    s.nodes.forEach((id, j) => nodes.push({ id, sectionId, position: (j + 1) * POSITION_STEP, enabled: true }));
    if (s.checkpoint !== null) {
      nodes.push({ id: s.checkpoint, sectionId, position: (s.nodes.length + 1) * POSITION_STEP, enabled: true });
    }
  });
  const antes = new Map(snapshot.nodes.map((n) => [n.id, n]));
  for (const id of [...RETIRADOS_PREVIOS, ...CHECKPOINTS_RETIRADOS]) {
    nodes.push({ id, sectionId: antes.get(id).sectionId, position: PARKING_BASE + id, enabled: false });
  }

  const seccionDe = new Map(nodes.map((n) => [n.id, n.sectionId]));
  const levels = snapshot.nodes
    .filter((n) => n.type === 'practice' && n.enabled)
    .map((n) => ({ id: n.refId, idSection: seccionDe.get(n.id) }));

  return { sections, nodes, levels };
}

/** El snapshot que queda tras aplicar los cambios. Sirve al dry-run y a los tests. */
function applyToSnapshot(snapshot, changes) {
  const sections = new Map(snapshot.sections.map((s) => [s.id, { ...s }]));
  for (const s of changes.sections) sections.set(s.id, { id: s.id, name: s.name, idDifficulty: s.idDifficulty });
  const nodes = new Map(snapshot.nodes.map((n) => [n.id, { ...n }]));
  for (const c of changes.nodes) {
    Object.assign(nodes.get(c.id), { sectionId: c.sectionId, position: c.position, enabled: c.enabled });
  }
  const levels = new Map(snapshot.levels.map((l) => [l.id, { ...l }]));
  for (const c of changes.levels) levels.get(c.id).idSection = c.idSection;
  return {
    sections: [...sections.values()],
    nodes: [...nodes.values()],
    levels: [...levels.values()],
    sentencesByLevel: new Map(snapshot.sentencesByLevel),
  };
}

```

Reemplaza el `module.exports` de `core.js` por:

```js
module.exports = {
  fromTuples,
  walk,
  lecciones,
  checkReparto,
  checkPreconditions,
  planChanges,
  applyToSnapshot,
};
```

`applyToSnapshot` copia el `Map` de oraciones a propósito: si lo compartiera, un test que vacía oraciones en el resultado contaminaría `ANTES` y a todos los tests que vienen después.

- [ ] **Step 4: Correr los tests**

Run: `npm run test:scripts`
Expected: PASS, `tests 15`, `pass 15`.

- [ ] **Step 5: Commit**

```bash
git add scripts/rebalance-sections/core.js scripts/rebalance-sections/core.test.js
git commit -m "$(cat <<'EOF'
feat(scripts): el plan de secciones parejas, fila por fila

planChanges da el estado final de las 16 secciones, los 143 nodos (10, 20…
con el checkpoint al final; los retirados en 10000 + id) y los 69 niveles de
práctica, que siguen a su nodo. applyToSnapshot lo simula sin tocar la BD.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Las siete verificaciones

**Files:**
- Modify: `scripts/rebalance-sections/core.js`
- Test: `scripts/rebalance-sections/core.test.js`

**Interfaces:**
- Consumes: `walk`, `planChanges`, `applyToSnapshot`, `MIN_NODOS`, `MAX_NODOS`, `CHECKPOINT_MIN_SENTENCES`.
- Produces: `verify(snapshot, reparto = REPARTO) → Array<{ nombre: 'nodos'|'orden'|'tamaños'|'checkpoints'|'posiciones'|'niveles'|'nombres', errores: string[] }>`, siempre en ese orden. Todo bien = todos los `errores` vacíos. Son las siete verificaciones de la spec (§Verificaciones).

- [ ] **Step 1: Escribir los tests que fallan**

Añade al final de `core.test.js`:

```js
// ── Las siete verificaciones ─────────────────────────────────────────────

test('el Camino resultante pasa las siete verificaciones', () => {
  const resultados = core.verify(despues());
  assert.deepEqual(resultados.map((r) => r.nombre), ['nodos', 'orden', 'tamaños', 'checkpoints', 'posiciones', 'niveles', 'nombres']);
  assert.deepEqual(fallan(resultados), []);
});

test('el Camino de hoy falla orden, tamaños y checkpoints', () => {
  assert.deepEqual(fallan(core.verify(ANTES)), ['orden', 'tamaños', 'checkpoints']);
});

test('verify detecta dos nodos intercambiados', () => {
  const s = despues();
  [nodo(s, 6).position, nodo(s, 116).position] = [nodo(s, 116).position, nodo(s, 6).position];
  assert.deepEqual(fallan(core.verify(s)), ['orden']);
});

test('verify detecta un nivel en otra sección que su nodo', () => {
  const s = despues();
  nivel(s, 23).idSection = 2;
  assert.ok(fallan(core.verify(s)).includes('niveles'));
});

test('verify detecta dos nodos en la misma posición', () => {
  const s = despues();
  nodo(s, 25).position = nodo(s, 24).position;
  assert.ok(fallan(core.verify(s)).includes('posiciones'));
});

test('verify detecta un checkpoint en una sección sin práctica', () => {
  const s = despues();
  nodo(s, 26).enabled = true;
  assert.deepEqual(fallan(core.verify(s)), ['checkpoints']);
});

test('verify detecta un checkpoint sin oraciones para el examen', () => {
  const s = despues();
  for (const id of [89, 90, 91, 92, 93, 94, 95]) s.sentencesByLevel.set(id, 0); // niveles de Level 16
  assert.deepEqual(fallan(core.verify(s)), ['checkpoints']);
});

test('verify detecta un nombre fuera de orden', () => {
  const s = despues();
  seccion(s, 13).name = 'Level 99';
  assert.deepEqual(fallan(core.verify(s)), ['nombres']);
});

test('verify detecta una sección vacía de más', () => {
  const s = despues();
  s.sections.push({ id: 17, name: 'Level 17', idDifficulty: 1 });
  assert.ok(fallan(core.verify(s)).includes('tamaños'));
});

```

- [ ] **Step 2: Correrlos y ver que fallan**

Run: `npm run test:scripts`
Expected: FAIL en los nueve nuevos, `core.verify is not a function`.

- [ ] **Step 3: Implementar**

Añade a `core.js`, justo antes de `module.exports`:

```js
/** Oraciones del examen por sección, como loadSectionSentenceCounts en path.service.ts. */
function oracionesPorSeccion(snapshot) {
  const out = new Map();
  for (const l of snapshot.levels) {
    if (!l.enabled) continue;
    out.set(l.idSection, (out.get(l.idSection) ?? 0) + (snapshot.sentencesByLevel.get(l.id) ?? 0));
  }
  return out;
}

const nombreDe = (s) => `sección ${s.id} (${s.name})`;

/** Las siete verificaciones de la spec. Devuelve [{ nombre, errores }]; todo bien = errores vacíos. */
function verify(snapshot, reparto = REPARTO) {
  const visibles = walk(snapshot);
  const sinCheckpoint = visibles.filter((n) => n.type !== 'checkpoint');
  const esperado = reparto.flatMap((s) => s.nodes);
  const resultados = [];

  // 1. Cada nodo del reparto visible una vez, y ninguno más.
  {
    const errores = [];
    const vistos = new Set(sinCheckpoint.map((n) => n.id));
    for (const id of esperado) if (!vistos.has(id)) errores.push(`nodo ${id}: no está visible`);
    const delReparto = new Set(esperado);
    for (const id of vistos) if (!delReparto.has(id)) errores.push(`nodo ${id}: visible y fuera del reparto`);
    resultados.push({ nombre: 'nodos', errores });
  }

  // 2. El orden del Camino es el del reparto.
  {
    const real = sinCheckpoint.map((n) => n.id);
    const i = primeraDiferencia(real, esperado);
    const errores = i === -1 ? [] : [`el orden se separa en la posición ${i}: hay ${real[i]}, toca ${esperado[i]}`];
    resultados.push({ nombre: 'orden', errores });
  }

  // 3. De MIN_NODOS a MAX_NODOS por sección, y las secciones por dificultad del reparto.
  {
    const errores = [];
    const porDificultad = new Map();
    for (const s of snapshot.sections) {
      porDificultad.set(s.idDifficulty, (porDificultad.get(s.idDifficulty) ?? 0) + 1);
      const n = sinCheckpoint.filter((x) => x.sectionId === s.id).length;
      if (n < MIN_NODOS || n > MAX_NODOS) errores.push(`${nombreDe(s)}: ${n} nodos`);
    }
    const esperadas = new Map();
    for (const s of reparto) esperadas.set(s.difficulty, (esperadas.get(s.difficulty) ?? 0) + 1);
    for (const [d, n] of esperadas) {
      const hay = porDificultad.get(d) ?? 0;
      if (hay !== n) errores.push(`dificultad ${d}: ${hay} secciones, tocan ${n}`);
    }
    resultados.push({ nombre: 'tamaños', errores });
  }

  // 4. Un checkpoint al final de cada sección con práctica, con examen; ninguno en las demás.
  {
    const errores = [];
    const oraciones = oracionesPorSeccion(snapshot);
    for (const s of snapshot.sections) {
      const nodos = visibles.filter((n) => n.sectionId === s.id);
      const cps = nodos.filter((n) => n.type === 'checkpoint');
      if (!nodos.some((n) => n.type === 'practice')) {
        if (cps.length) errores.push(`${nombreDe(s)}: checkpoint ${cps.map((c) => c.id)} sin niveles de práctica`);
        continue;
      }
      if (cps.length !== 1) {
        errores.push(`${nombreDe(s)}: ${cps.length} checkpoints`);
        continue;
      }
      if (nodos[nodos.length - 1].id !== cps[0].id) errores.push(`${nombreDe(s)}: el checkpoint ${cps[0].id} no va al final`);
      const n = oraciones.get(s.id) ?? 0;
      if (n < CHECKPOINT_MIN_SENTENCES) errores.push(`${nombreDe(s)}: ${n} oraciones para el examen`);
    }
    resultados.push({ nombre: 'checkpoints', errores });
  }

  // 5. Ningún (section_id, position) repetido, contando los retirados.
  {
    const errores = [];
    const ocupado = new Map();
    for (const n of snapshot.nodes) {
      const clave = `${n.sectionId}:${n.position}`;
      if (ocupado.has(clave)) {
        errores.push(`nodos ${ocupado.get(clave)} y ${n.id}: sección ${n.sectionId}, posición ${n.position}`);
      } else {
        ocupado.set(clave, n.id);
      }
    }
    resultados.push({ nombre: 'posiciones', errores });
  }

  // 6. Cada nivel de práctica, en la sección de su nodo.
  {
    const errores = [];
    const niveles = new Map(snapshot.levels.map((l) => [l.id, l]));
    for (const n of snapshot.nodes) {
      if (n.type !== 'practice' || !n.enabled) continue;
      const l = niveles.get(n.refId);
      if (!l) errores.push(`nodo ${n.id}: el nivel ${n.refId} no existe`);
      else if (l.idSection !== n.sectionId) {
        errores.push(`nivel ${l.id}: id_section ${l.idSection}, su nodo ${n.id} está en la sección ${n.sectionId}`);
      }
    }
    resultados.push({ nombre: 'niveles', errores });
  }

  // 7. «Level 1» a «Level N» en el orden del Camino.
  {
    const errores = [];
    seccionesEnOrden(snapshot).forEach((s, i) => {
      if (s.name !== `Level ${i + 1}`) errores.push(`sección ${s.id}: se llama «${s.name}», toca «Level ${i + 1}»`);
    });
    resultados.push({ nombre: 'nombres', errores });
  }

  return resultados;
}

```

Reemplaza el `module.exports` de `core.js` por:

```js
module.exports = {
  fromTuples,
  walk,
  lecciones,
  checkReparto,
  checkPreconditions,
  planChanges,
  applyToSnapshot,
  verify,
};
```

La regla del checkpoint es la de la decisión 4 de la spec, escrita en general: una sección con algún nivel de práctica lleva exactamente uno, al final y con al menos 5 oraciones; una sin práctica no lleva ninguno. Las oraciones se cuentan como `loadSectionSentenceCounts` (`src/modules/path/path.service.ts`): por `levels.id_section`, solo niveles y oraciones activos.

- [ ] **Step 4: Correr los tests**

Run: `npm run test:scripts`
Expected: PASS, `tests 24`, `pass 24`.

- [ ] **Step 5: Commit**

```bash
git add scripts/rebalance-sections/core.js scripts/rebalance-sections/core.test.js
git commit -m "$(cat <<'EOF'
feat(scripts): las siete verificaciones de secciones parejas

Nodos, orden, tamaños, checkpoints, posiciones, niveles y nombres. El Camino
que sale del plan las pasa todas; el de hoy falla orden, tamaños y checkpoints.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: Resumen, informe, respaldo y nodo actual

**Files:**
- Modify: `scripts/rebalance-sections/core.js`
- Test: `scripts/rebalance-sections/core.test.js`

**Interfaces:**
- Consumes: `walk`, `planChanges`, `applyToSnapshot`.
- Produces: `summary(antes, changes) → string` (una línea); `report(snapshot) → string` (sección por sección: `«  Level 8   sección 13  8 nodos, checkpoint 39»` y una línea por nodo con posición, id, tipo y título); `backupOf(antes, changes, createdSectionIds) → { createdSectionIds, sections, nodes, levels }` (estado de antes de las 12 secciones, los 143 nodos y los 69 niveles que cambian); `currentNode(snapshot, hecho: { nodes: Set<number>, levels: Set<number> }) → number|null`.

- [ ] **Step 1: Escribir los tests que fallan**

Añade al final de `core.test.js`:

```js
// ── Resumen, informe, respaldo y nodo actual ─────────────────────────────

test('summary cuenta lo que cambia', () => {
  assert.equal(
    core.summary(ANTES, core.planChanges(ANTES, NUEVAS)),
    '4 secciones nuevas y 12 reutilizadas · 134 nodos cambian de sección, posición o estado · 3 checkpoints se retiran · 54 niveles cambian de sección',
  );
});

test('report lista cada sección con sus nodos', () => {
  const texto = core.report(despues());
  assert.match(texto, /^Dificultad 1$/m);
  assert.match(texto, /^ {2}Level 1 {3}sección {2}1 {2}8 nodos$/m);
  assert.match(texto, /^ {2}Level 8 {3}sección 13 {2}8 nodos, checkpoint 39$/m);
  assert.match(texto, /^ {2}Level 16 {2}sección 10 {2}7 nodos, checkpoint 93$/m);
  assert.match(texto, /^ {6}20 {3}143 {2}numbers$/m);
});

test('backupOf guarda el estado de antes de cada fila que se toca', () => {
  const changes = core.planChanges(ANTES, NUEVAS);
  const b = core.backupOf(ANTES, changes, NUEVAS);
  assert.deepEqual(b.createdSectionIds, NUEVAS);
  assert.equal(b.sections.length, 12);
  assert.equal(b.nodes.length, 143);
  assert.equal(b.levels.length, 69);
  assert.deepEqual(b.sections.find((s) => s.id === 8), { id: 8, name: 'Level 8', idDifficulty: 2 });
  assert.deepEqual(b.nodes.find((n) => n.id === 143), { id: 143, sectionId: 1, position: 270, enabled: true });
  assert.deepEqual(b.levels.find((l) => l.id === 23), { id: 23, idSection: 2 });
});

test('currentNode: la cuenta 8 sigue en Saludos', () => {
  const hecho = { nodes: new Set([109]), levels: new Set() };
  assert.equal(core.currentNode(ANTES, hecho), 108);
  assert.equal(core.currentNode(despues(), hecho), 108);
});

test('currentNode: el único cambio de orden es Las decenas', () => {
  // Hecho todo hasta «months of the year» (nodo 5), salvo Las decenas.
  const hasta5 = core.lecciones(ANTES).slice(0, core.lecciones(ANTES).indexOf(5) + 1);
  const hecho = { nodes: new Set(hasta5), levels: new Set() };
  assert.equal(core.currentNode(ANTES, hecho), 116);
  assert.equal(core.currentNode(despues(), hecho), 143);
});
```

- [ ] **Step 2: Correrlos y ver que fallan**

Run: `npm run test:scripts`
Expected: FAIL en los cinco nuevos: `summary`, `report`, `backupOf` y `currentNode` todavía no existen (`core.summary is not a function`…).

- [ ] **Step 3: Implementar**

Añade a `core.js`, justo antes de `module.exports`:

```js
/** Lo que cambia, en una línea. */
function summary(antes, changes) {
  const nodos = new Map(antes.nodes.map((n) => [n.id, n]));
  const niveles = new Map(antes.levels.map((l) => [l.id, l]));
  const nuevas = changes.sections.filter((s) => s.nueva).length;
  const movidos = changes.nodes.filter((c) => {
    const a = nodos.get(c.id);
    return a.sectionId !== c.sectionId || a.position !== c.position || a.enabled !== c.enabled;
  }).length;
  const retirados = changes.nodes.filter((c) => !c.enabled && nodos.get(c.id).enabled).length;
  const cambianNivel = changes.levels.filter((c) => niveles.get(c.id).idSection !== c.idSection).length;
  return (
    `${nuevas} secciones nuevas y ${changes.sections.length - nuevas} reutilizadas · ` +
    `${movidos} nodos cambian de sección, posición o estado · ${retirados} checkpoints se retiran · ` +
    `${cambianNivel} niveles cambian de sección`
  );
}

/** El Camino sección por sección: nombre, id, nodos con su posición. */
function report(snapshot) {
  const visibles = walk(snapshot);
  const lineas = [];
  let dificultad = null;
  for (const s of seccionesEnOrden(snapshot)) {
    if (s.idDifficulty !== dificultad) {
      dificultad = s.idDifficulty;
      lineas.push(`Dificultad ${dificultad}`);
    }
    const nodos = visibles.filter((n) => n.sectionId === s.id);
    const cp = nodos.find((n) => n.type === 'checkpoint');
    const cuantos = nodos.length - (cp ? 1 : 0);
    lineas.push(`  ${s.name.padEnd(9)} sección ${String(s.id).padStart(2)}  ${cuantos} nodos${cp ? `, checkpoint ${cp.id}` : ''}`);
    for (const n of nodos) {
      lineas.push(`    ${String(n.position).padStart(4)}  ${String(n.id).padStart(4)}  ${n.type.padEnd(13)}  ${n.title ?? ''}`.trimEnd());
    }
  }
  return lineas.join('\n');
}

/** El respaldo: lo justo para devolver cada fila tocada a su estado de antes. */
function backupOf(antes, changes, createdSectionIds) {
  const niveles = new Map(antes.levels.map((l) => [l.id, l]));
  return {
    createdSectionIds,
    sections: antes.sections.map(({ id, name, idDifficulty }) => ({ id, name, idDifficulty })),
    nodes: antes.nodes.map(({ id, sectionId, position, enabled }) => ({ id, sectionId, position, enabled })),
    levels: changes.levels.map(({ id }) => ({ id, idSection: niveles.get(id).idSection })),
  };
}

/**
 * El nodo actual de un usuario: el primero visible, no opcional y sin completar
 * (findCurrentNodeId en path-walk.ts). Sin secciones saltadas por test:
 * rebalance-sections.js aborta si section_progress tiene alguna.
 * `hecho` = { nodes: Set<nodeId>, levels: Set<levelId> } con progreso 100.
 */
function currentNode(snapshot, hecho) {
  for (const n of walk(snapshot)) {
    if (n.type === 'checkpoint' || n.type === 'reading') continue;
    const completo = n.type === 'practice' ? hecho.levels.has(n.refId) : hecho.nodes.has(n.id);
    if (!completo) return n.id;
  }
  return null;
}

```

Reemplaza el `module.exports` de `core.js` por:

```js
module.exports = {
  fromTuples,
  walk,
  lecciones,
  checkReparto,
  checkPreconditions,
  planChanges,
  applyToSnapshot,
  verify,
  summary,
  report,
  backupOf,
  currentNode,
};
```

- [ ] **Step 4: Correr los tests**

Run: `npm run test:scripts`
Expected: PASS, `tests 29`, `pass 29`.

- [ ] **Step 5: Commit**

```bash
git add scripts/rebalance-sections/core.js scripts/rebalance-sections/core.test.js
git commit -m "$(cat <<'EOF'
feat(scripts): informe, respaldo y nodo actual de secciones parejas

El informe es lo que el dry-run muestra a Sergio; el respaldo guarda lo justo
para deshacer; currentNode confirma que la cuenta 8 sigue en «Saludos» y que
el único cambio de orden es «Las decenas».

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: El CLI y su ensayo contra un Postgres local

**Files:**
- Create: `scripts/rebalance-sections/ensayo/schema.sql`
- Create: `scripts/rebalance-sections/ensayo/seed.js`
- Create: `scripts/rebalance-sections/ensayo/ensayo.sh`
- Create: `scripts/rebalance-sections.js`
- Modify: `package.json` (scripts `sections:rebalance` y `sections:rebalance:ensayo`)

**Interfaces:**
- Consumes: todo `core.js` y `reparto.js`.
- Produces: `node scripts/rebalance-sections.js [--apply | --rollback <respaldo>]` (alias `npm run sections:rebalance`). Respaldo en `scripts/out/backup-rebalance-sections-<ts>.json` con `{ script, timestamp, createdSectionIds, sections, nodes, levels }`. Mensajes que el ensayo y las Tasks 7 y 8 buscan: `«Escrito. Respaldo: <ruta>»`, `«La BD no coincide con el inventario del 2026-10-12; no se escribe nada:»`, `«section_progress tiene N secciones saltadas por test»`, `«<tabla> tiene N filas en las secciones creadas …»`, `«Restaurados 143 nodos, 69 niveles y 12 secciones; borradas 4.»`, `«usuario <id>: <antes> → <después>»`, `«(dry-run: nada escrito. Usa --apply.)»`.

El ensayo es el test del CLI: arma un Postgres local con `antes.json` y comprueba en ocho pasos el dry-run, las dos guardas, el apply, el rollback y un segundo apply. Corre una **copia** de los scripts con su propio `.env` local, así que el `.env` del worktree (enlace al de producción) no se lee ni se toca. Necesita `initdb`, `pg_ctl`, `psql` y `openssl` (están en `/usr/bin`) y el puerto 55432 libre.

- [ ] **Step 1: Escribir el ensayo (el test que falla)**

Crea `scripts/rebalance-sections/ensayo/schema.sql`:

```sql
-- Esquema mínimo de dots para ensayar rebalance-sections.js: las tablas que
-- el script lee o escribe, con las restricciones que importan (PK, serial de
-- section, FK a section, UNIQUE (section_id, position)).
CREATE SCHEMA dots;
SET search_path TO dots;
CREATE TABLE difficulty (id int PRIMARY KEY, name varchar(100));
CREATE TABLE section (
  id serial PRIMARY KEY,
  name varchar(100) NOT NULL,
  id_difficulty int NOT NULL REFERENCES difficulty(id)
);
CREATE TABLE levels (
  id int PRIMARY KEY,
  name varchar(100) NOT NULL,
  id_section int REFERENCES section(id),
  enabled bool
);
CREATE TABLE path_nodes (
  id int PRIMARY KEY,
  section_id int NOT NULL REFERENCES section(id),
  position int NOT NULL,
  type varchar(20) NOT NULL,
  ref_id int,
  title varchar(120),
  enabled bool NOT NULL DEFAULT true,
  UNIQUE (section_id, position)
);
CREATE TABLE sentences (id bigserial PRIMARY KEY, level_id int REFERENCES levels(id), enabled bool DEFAULT true);
CREATE TABLE users (id int PRIMARY KEY, profile smallint NOT NULL DEFAULT 0);
CREATE TABLE node_progress (id serial PRIMARY KEY, user_id int NOT NULL, node_id int NOT NULL REFERENCES path_nodes(id), progress int NOT NULL DEFAULT 0);
CREATE TABLE levels_progress (id_levels_progress serial PRIMARY KEY, id_level int NOT NULL REFERENCES levels(id), id_user int, progress int DEFAULT 0);
CREATE TABLE section_progress (level_progress_id serial PRIMARY KEY, user_id int, section_id int REFERENCES section(id), progress int DEFAULT 0, section_test bool DEFAULT false);
CREATE TABLE checkpoint_attempts (id serial PRIMARY KEY, user_id int NOT NULL, section_id int NOT NULL REFERENCES section(id));
CREATE TABLE vocab_packs (id int PRIMARY KEY, title varchar(120));
CREATE TABLE grammar_pills (id int PRIMARY KEY, title varchar(120));
CREATE TABLE pronunciation_units (id int PRIMARY KEY, title varchar(120));
CREATE TABLE letter_packs (id int PRIMARY KEY, title varchar(120));
CREATE TABLE number_packs (id int PRIMARY KEY, title varchar(120));
CREATE TABLE readings (id int PRIMARY KEY, title varchar(255));
```

Crea `scripts/rebalance-sections/ensayo/seed.js`:

```js
// Carga antes.json en el Postgres de ensayo: secciones, niveles, nodos, tantas
// oraciones activas como dice el inventario, un admin (1) y la cuenta 8 con
// «El verbo TO BE» (nodo 109) completo, como en producción.
const antes = require(process.argv[2]);

const out = [
  'SET search_path TO dots;',
  "INSERT INTO difficulty VALUES (1, 'beginner'), (2, 'intermediate'), (3, 'advanced');",
];
for (const [id, name, d] of antes.sections) out.push(`INSERT INTO section (id, name, id_difficulty) VALUES (${id}, '${name}', ${d});`);
out.push(`SELECT setval('section_id_seq', ${Math.max(...antes.sections.map(([id]) => id))});`);
for (const [id, sec, en] of antes.levels) out.push(`INSERT INTO levels VALUES (${id}, 'L${id}', ${sec}, ${en});`);
for (const [id, sec, pos, type, ref, en] of antes.nodes) {
  out.push(`INSERT INTO path_nodes (id, section_id, position, type, ref_id, enabled) VALUES (${id}, ${sec}, ${pos}, '${type}', ${ref ?? 'NULL'}, ${en});`);
}
for (const [level, n] of antes.sentences) out.push(`INSERT INTO sentences (level_id) SELECT ${level} FROM generate_series(1, ${n});`);
out.push('INSERT INTO users VALUES (1, 1), (8, 0);');
out.push('INSERT INTO node_progress (user_id, node_id, progress) VALUES (8, 109, 100);');
console.log(out.join('\n'));
```

Crea `scripts/rebalance-sections/ensayo/ensayo.sh`:

```bash
#!/usr/bin/env bash
# Ensayo de rebalance-sections.js contra un Postgres local desechable: dry-run,
# las dos guardas, apply, rollback y un segundo apply, con comprobaciones.
#
#   npm run sections:rebalance:ensayo
#   bash scripts/rebalance-sections/ensayo/ensayo.sh <checkout> [<dir de trabajo>]
#
# Necesita initdb, pg_ctl, psql y openssl. Corre una COPIA de los scripts en
# <dir de trabajo>/repo, con su propio .env apuntando al Postgres local (TCP
# 55432, con SSL porque el script lo pide siempre). El .env del checkout, que
# en un worktree es un enlace al del backend con la BD de producción, no se
# lee ni se toca; las DB_* del shell que lo lanza también se ignoran (run()
# fija las suyas). Sin <dir de trabajo>, usa uno temporal y lo borra al salir.
set -uo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
SRC="$1"
if [[ -n "${2:-}" ]]; then E="$2"; PROPIO=0; else E="$(mktemp -d)"; PROPIO=1; fi
PGDATA="$E/pgdata"
PORT=55432
REPO="$E/repo"
PSQL=(env PGOPTIONS=-csearch_path=dots psql -h localhost -p "$PORT" -U ensayo -d dots_ensayo -q -v ON_ERROR_STOP=1 -X)
# loadEnv() no pisa variables ya exportadas: sin fijarlas aquí, unas DB_* del
# shell (por ejemplo, las de producción) recibirían los --apply del ensayo.
run() { (cd "$REPO" && DB_HOST=localhost DB_PORT="$PORT" DB_USERNAME=ensayo DB_PASSWORD=ensayo DB_NAME=dots_ensayo NODE_PATH="$SRC/node_modules" node scripts/rebalance-sections.js "$@"); }
ok() { echo "✔ $*"; }
ko() { echo "✖ $*"; FALLOS=$((FALLOS + 1)); }
FALLOS=0

limpiar() {
  pg_ctl -D "$PGDATA" stop -m fast >/dev/null 2>&1
  if [[ $PROPIO -eq 1 ]]; then rm -rf "$E"; fi
}
trap limpiar EXIT

pg_ctl -D "$PGDATA" stop -m fast >/dev/null 2>&1
rm -rf "$PGDATA"
initdb -D "$PGDATA" --auth=trust -U ensayo >/dev/null || exit 1
openssl req -new -x509 -days 1 -nodes -subj "/CN=localhost" \
  -out "$PGDATA/server.crt" -keyout "$PGDATA/server.key" 2>/dev/null
chmod 600 "$PGDATA/server.key"
printf "ssl = on\nlisten_addresses = 'localhost'\nport = %s\nunix_socket_directories = ''\n" "$PORT" >> "$PGDATA/postgresql.conf"
pg_ctl -D "$PGDATA" -l "$E/pg.log" -w start >/dev/null || { cat "$E/pg.log"; exit 1; }
createdb -h localhost -p "$PORT" -U ensayo dots_ensayo
"${PSQL[@]}" -f "$HERE/schema.sql"
node "$HERE/seed.js" "$SRC/scripts/rebalance-sections/antes.json" | "${PSQL[@]}" >/dev/null

rm -rf "$REPO" && mkdir -p "$REPO/scripts"
cp "$SRC/scripts/rebalance-sections.js" "$REPO/scripts/"
cp -r "$SRC/scripts/rebalance-sections" "$REPO/scripts/"
printf 'DB_HOST=localhost\nDB_PORT=%s\nDB_USERNAME=ensayo\nDB_PASSWORD=ensayo\nDB_NAME=dots_ensayo\n' "$PORT" > "$REPO/.env"

echo "── 1. dry-run sobre el inventario"
out=$(run 2>&1); st=$?
if [[ $st -eq 0 && $(grep -c '^  ok' <<<"$out") -eq 7 && "$out" == *"usuario 8: 108 → 108"* ]]; then
  ok "7 verificaciones ok, usuario 8 sin cambio"
else ko "dry-run"; echo "$out" | tail -20; fi

echo "── 2. apply con un salto por test pendiente: aborta sin escribir"
"${PSQL[@]}" -c "INSERT INTO section_progress (user_id, section_id, progress, section_test) VALUES (8, 2, 100, true)"
out=$(run --apply 2>&1); st=$?
n=$("${PSQL[@]}" -tA -c "SELECT count(*) FROM section")
if [[ $st -ne 0 && "$out" == *"secciones saltadas por test"* && $n -eq 12 ]]; then
  ok "abortó; siguen 12 secciones"
else ko "guarda de section_test"; echo "$out" | tail -5; fi
"${PSQL[@]}" -c "DELETE FROM section_progress"

echo "── 3. apply"
out=$(run --apply 2>&1); st=$?
if [[ $st -eq 0 && "$out" == *"Escrito. Respaldo:"* ]]; then ok "apply escribió"
else ko "apply"; echo "$out" | tail -30; fi
backup=$(ls "$REPO"/scripts/out/backup-rebalance-sections-*.json 2>/dev/null | head -1)
got=$("${PSQL[@]}" -tA -c "SELECT string_agg(id || ':' || name, ' ' ORDER BY id_difficulty, id) FROM section")
esperado="1:Level 1 2:Level 2 3:Level 3 4:Level 4 8:Level 5 11:Level 6 12:Level 7 13:Level 8 14:Level 9 15:Level 10 16:Level 11 5:Level 12 6:Level 13 7:Level 14 9:Level 15 10:Level 16"
if [[ "$got" == "$esperado" ]]; then ok "16 secciones en orden"; else ko "secciones: $got"; fi
got=$("${PSQL[@]}" -tA -c "SELECT section_id || '/' || position FROM path_nodes WHERE id = 143")
if [[ "$got" == "2/20" ]]; then ok "Las decenas en Level 2, posición 20"; else ko "decenas: $got"; fi
got=$("${PSQL[@]}" -tA -c "SELECT string_agg(id::text, ',' ORDER BY id) FROM path_nodes WHERE NOT enabled")
if [[ "$got" == "26,41,95,107,132,133,134" ]]; then ok "7 nodos retirados"; else ko "retirados: $got"; fi
got=$("${PSQL[@]}" -tA -c "SELECT count(*) FROM levels l JOIN path_nodes n ON n.type = 'practice' AND n.ref_id = l.id AND n.enabled WHERE l.id_section IS DISTINCT FROM n.section_id")
if [[ "$got" == "0" ]]; then ok "niveles en la sección de su nodo"; else ko "niveles desalineados: $got"; fi

echo "── 4. dry-run después del apply: aborta (la BD ya no es el inventario)"
out=$(run 2>&1); st=$?
if [[ $st -ne 0 && "$out" == *"no coincide con el inventario"* ]]; then ok "abortó"
else ko "dry-run después del apply"; echo "$out" | tail -5; fi

echo "── 5. rollback con un intento de checkpoint en una sección creada: aborta"
"${PSQL[@]}" -c "INSERT INTO checkpoint_attempts (user_id, section_id) VALUES (8, 13)"
out=$(run --rollback "$backup" 2>&1); st=$?
n=$("${PSQL[@]}" -tA -c "SELECT count(*) FROM section")
if [[ $st -ne 0 && "$out" == *"checkpoint_attempts tiene 1 filas"* && $n -eq 16 ]]; then
  ok "abortó; siguen 16 secciones"
else ko "guarda del rollback"; echo "$out" | tail -5; fi
"${PSQL[@]}" -c "DELETE FROM checkpoint_attempts"

echo "── 6. rollback"
out=$(run --rollback "$backup" 2>&1); st=$?
if [[ $st -eq 0 && "$out" == *"Restaurados 143 nodos, 69 niveles y 12 secciones; borradas 4."* ]]; then ok "rollback"
else ko "rollback"; echo "$out" | tail -20; fi

echo "── 7. dry-run tras el rollback: la BD vuelve a ser el inventario"
out=$(run 2>&1); st=$?
if [[ $st -eq 0 && $(grep -c '^  ok' <<<"$out") -eq 7 ]]; then ok "inventario restaurado"
else ko "dry-run tras el rollback"; echo "$out" | tail -20; fi

echo "── 8. apply otra vez: la secuencia no retrocede y las nuevas son 17 a 20"
out=$(run --apply 2>&1); st=$?
got=$("${PSQL[@]}" -tA -c "SELECT string_agg(id::text, ',' ORDER BY id) FROM section WHERE id > 12")
if [[ $st -eq 0 && "$got" == "17,18,19,20" ]]; then ok "apply con ids 17 a 20"
else ko "segundo apply: $got"; echo "$out" | tail -10; fi

echo
if [[ $FALLOS -eq 0 ]]; then echo "ENSAYO OK"; else echo "ENSAYO CON $FALLOS FALLOS"; exit 1; fi
```

Añade a `package.json`, justo después de la línea `"nodes:art": "node scripts/set-node-art.js",`:

```json
    "sections:rebalance": "node scripts/rebalance-sections.js",
    "sections:rebalance:ensayo": "bash scripts/rebalance-sections/ensayo/ensayo.sh \"$PWD\"",
```

- [ ] **Step 2: Correr el ensayo y ver que falla**

Run: `chmod +x scripts/rebalance-sections/ensayo/ensayo.sh && npm run sections:rebalance:ensayo`
Expected: FAIL. `cp` no encuentra `scripts/rebalance-sections.js`, casi todos los pasos salen con `✖` y termina en `ENSAYO CON 11 FALLOS`, con código de salida 1.

- [ ] **Step 3: Crear el CLI**

Crea `scripts/rebalance-sections.js`:

```js
/**
 * Secciones parejas del Camino (spec webapp
 * docs/superpowers/specs/2026-10-12-secciones-parejas-design.md).
 *
 *   node scripts/rebalance-sections.js                    # dry-run
 *   node scripts/rebalance-sections.js --apply            # escribe, en una transacción
 *   node scripts/rebalance-sections.js --rollback scripts/out/backup-rebalance-sections-<ts>.json
 *
 * Re-corta los 127 nodos visibles en 16 secciones de 7 a 9 sin cambiar el
 * orden (salvo «Las decenas», que pasa detrás de «Números 1–20»), quita el
 * checkpoint a las secciones sin niveles de práctica e iguala
 * levels.id_section a la sección de su nodo. El reparto vive en
 * rebalance-sections/reparto.js y la lógica, probada, en core.js.
 *
 * Aborta sin escribir si la BD no es la del inventario del 2026-10-12
 * (rebalance-sections/antes.json) o si alguien saltó una sección por test.
 *
 * Patrón obligatorio del CLAUDE.md del backend: dry-run por defecto, --apply
 * explícito, respaldo JSON en scripts/out/ antes del COMMIT y --rollback.
 */
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

const core = require('./rebalance-sections/core');
const { REPARTO, MAX_SECTION_ID_ANTES, TEMP_BASE } = require('./rebalance-sections/reparto');

const OUT_DIR = path.join(__dirname, 'out');
const ANTES = core.fromTuples(require('./rebalance-sections/antes.json'));

/** users.profile de un admin (src/common/admin-profile.ts). */
const ADMIN_PROFILE = 1;

class Abort extends Error {
  constructor(titulo, errores) {
    super(titulo);
    this.errores = errores;
  }
}

function loadEnv() {
  const file = path.join(__dirname, '..', '.env');
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    const i = line.indexOf('=');
    if (i > 0 && !line.trim().startsWith('#')) {
      const k = line.slice(0, i).trim();
      if (!(k in process.env)) process.env[k] = line.slice(i + 1).trim();
    }
  }
}

function arg(name) {
  const i = process.argv.indexOf(name);
  return i === -1 ? null : (process.argv[i + 1] ?? true);
}

/** El Camino en el formato de core.js. Dentro de una transacción, lee lo que ella ve. */
async function readSnapshot(db) {
  const sections = (await db.query('SELECT id, name, id_difficulty FROM section ORDER BY id')).rows
    .map((r) => ({ id: r.id, name: r.name, idDifficulty: r.id_difficulty }));
  const nodes = (await db.query(`
    SELECT n.id, n.section_id, n.position, n.type, n.ref_id, n.enabled,
           COALESCE(n.title, l.name, vp.title, gp.title, pu.title, lp.title, np.title, r.title) AS title
      FROM path_nodes n
      LEFT JOIN levels l ON n.type = 'practice' AND l.id = n.ref_id
      LEFT JOIN vocab_packs vp ON n.type = 'vocab' AND vp.id = n.ref_id
      LEFT JOIN grammar_pills gp ON n.type = 'grammar' AND gp.id = n.ref_id
      LEFT JOIN pronunciation_units pu ON n.type = 'pronunciation' AND pu.id = n.ref_id
      LEFT JOIN letter_packs lp ON n.type = 'letters' AND lp.id = n.ref_id
      LEFT JOIN number_packs np ON n.type = 'numbers' AND np.id = n.ref_id
      LEFT JOIN readings r ON n.type = 'reading' AND r.id = n.ref_id
     ORDER BY n.id`)).rows
    .map((r) => ({
      id: r.id, sectionId: r.section_id, position: r.position, type: r.type,
      refId: r.ref_id, enabled: r.enabled, title: r.title,
    }));
  const levels = (await db.query('SELECT id, id_section, enabled FROM levels ORDER BY id')).rows
    .map((r) => ({ id: r.id, idSection: r.id_section, enabled: r.enabled }));
  const sentencesByLevel = new Map((await db.query(
    'SELECT level_id, count(*)::int AS n FROM sentences WHERE enabled AND level_id IS NOT NULL GROUP BY level_id',
  )).rows.map((r) => [r.level_id, r.n]));
  return { sections, nodes, levels, sentencesByLevel };
}

/**
 * Lleva cada nodo a su sección, posición y estado. Primero todos pasan a una
 * posición temporal única (TEMP_BASE + id): UNIQUE (section_id, position) se
 * comprueba fila a fila y saltaría a mitad del movimiento.
 */
async function moverNodos(db, nodes) {
  await db.query('UPDATE path_nodes SET position = $1 + id WHERE id = ANY($2)', [TEMP_BASE, nodes.map((n) => n.id)]);
  for (const n of nodes) {
    await db.query('UPDATE path_nodes SET section_id = $1, position = $2, enabled = $3 WHERE id = $4',
      [n.sectionId, n.position, n.enabled, n.id]);
  }
}

/** Lo que tiene que cumplirse antes de escribir. Vacío = se puede seguir. */
async function precondiciones(db, antes) {
  const errores = [...core.checkReparto(ANTES), ...core.checkPreconditions(antes, ANTES)];
  // Un salto por test es por sección: re-cortar cambiaría lo que el alumno saltó.
  const [{ n }] = (await db.query('SELECT count(*)::int AS n FROM section_progress WHERE section_test')).rows;
  if (n > 0) errores.push(`section_progress tiene ${n} secciones saltadas por test`);
  return errores;
}

/** Alumnos con algún progreso: userId → lo que tienen completo (progreso 100). */
async function readProgress(db) {
  const hecho = new Map();
  const de = (userId) => {
    if (!hecho.has(userId)) hecho.set(userId, { nodes: new Set(), levels: new Set() });
    return hecho.get(userId);
  };
  const nodos = (await db.query(
    `SELECT np.user_id, np.node_id, np.progress FROM node_progress np JOIN users u ON u.id = np.user_id
      WHERE np.progress > 0 AND u.profile IS DISTINCT FROM $1`, [ADMIN_PROFILE],
  )).rows;
  for (const r of nodos) if (r.progress >= 100) de(r.user_id).nodes.add(r.node_id); else de(r.user_id);
  const niveles = (await db.query(
    `SELECT lp.id_user, lp.id_level, lp.progress FROM levels_progress lp JOIN users u ON u.id = lp.id_user
      WHERE lp.progress > 0 AND u.profile IS DISTINCT FROM $1`, [ADMIN_PROFILE],
  )).rows;
  for (const r of niveles) if (r.progress >= 100) de(r.id_user).levels.add(r.id_level); else de(r.id_user);
  return hecho;
}

function imprimirVerificaciones(resultados) {
  console.log('\nVerificaciones:');
  for (const r of resultados) {
    console.log(`  ${r.errores.length ? 'FALLA' : 'ok   '}  ${r.nombre}`);
    for (const e of r.errores) console.log(`         - ${e}`);
  }
}

function imprimirAlumnos(antes, despues, hecho) {
  console.log('\nAlumnos con progreso (nodo actual antes → después):');
  if (!hecho.size) console.log('  (ninguno)');
  for (const [userId, h] of hecho) {
    console.log(`  usuario ${userId}: ${core.currentNode(antes, h)} → ${core.currentNode(despues, h)}`);
  }
}

async function dryRun(db) {
  const antes = await readSnapshot(db);
  const errores = await precondiciones(db, antes);
  if (errores.length) throw new Abort('La BD no coincide con el inventario del 2026-10-12; no se escribe nada:', errores);

  // Sin escribir no hay ids nuevos: se simulan los siguientes al máximo.
  const max = Math.max(...antes.sections.map((s) => s.id));
  const simulados = REPARTO.filter((s) => s.sectionId === null).map((_, i) => max + 1 + i);
  const changes = core.planChanges(antes, simulados);
  const despues = core.applyToSnapshot(antes, changes);

  console.log(core.report(despues));
  console.log(`\n${core.summary(antes, changes)}`);
  const resultados = core.verify(despues);
  imprimirVerificaciones(resultados);
  imprimirAlumnos(antes, despues, await readProgress(db));
  if (resultados.some((r) => r.errores.length)) process.exitCode = 1;
  console.log('\n(dry-run: nada escrito. Usa --apply.)');
}

async function apply(db) {
  const backupFile = path.join(
    OUT_DIR, `backup-rebalance-sections-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
  await db.query('BEGIN');
  try {
    const antes = await readSnapshot(db);
    const errores = await precondiciones(db, antes);
    if (errores.length) throw new Abort('La BD no coincide con el inventario del 2026-10-12; no se escribe nada:', errores);

    // 1. Secciones nuevas, en el orden del reparto.
    const nuevas = [];
    for (const s of REPARTO.filter((x) => x.sectionId === null)) {
      const { rows } = await db.query(
        'INSERT INTO section (name, id_difficulty) VALUES ($1, $2) RETURNING id', [s.name, s.difficulty]);
      nuevas.push(rows[0].id);
    }
    if (nuevas.some((id) => id <= MAX_SECTION_ID_ANTES)) {
      throw new Abort('Las secciones nuevas quedarían antes que alguna reutilizada:', [
        `ids nuevos ${nuevas}; tienen que ser mayores que ${MAX_SECTION_ID_ANTES}`,
      ]);
    }
    const changes = core.planChanges(antes, nuevas);

    // 2. Nombre y dificultad de las reutilizadas.
    for (const s of changes.sections.filter((x) => !x.nueva)) {
      await db.query('UPDATE section SET name = $1, id_difficulty = $2 WHERE id = $3', [s.name, s.idDifficulty, s.id]);
    }
    // 3 y 4. Cada nodo a su sección, posición y estado, pasando por una posición temporal.
    await moverNodos(db, changes.nodes);
    // 5. Cada nivel de práctica, a la sección de su nodo.
    for (const l of changes.levels) {
      await db.query('UPDATE levels SET id_section = $1 WHERE id = $2', [l.idSection, l.id]);
    }

    // 6. Verificar lo escrito, leído desde la propia transacción.
    const despues = await readSnapshot(db);
    const resultados = core.verify(despues);
    imprimirVerificaciones(resultados);
    const fallos = resultados.flatMap((r) => r.errores.map((e) => `${r.nombre}: ${e}`));
    if (fallos.length) throw new Abort('La verificación falló; se deshace todo:', fallos);

    // 7. Respaldo antes del COMMIT: si el COMMIT fallara, su rollback solo reescribe lo que ya está.
    fs.writeFileSync(backupFile, JSON.stringify({
      script: 'rebalance-sections',
      timestamp: new Date().toISOString(),
      ...core.backupOf(antes, changes, nuevas),
    }, null, 2));
    await db.query('COMMIT');
    console.log(`\n${core.report(despues)}`);
    console.log(`\n${core.summary(antes, changes)}`);
    console.log(`\nEscrito. Respaldo: ${backupFile}`);
  } catch (e) {
    await db.query('ROLLBACK');
    throw e;
  }
}

async function rollback(db, file) {
  const b = JSON.parse(fs.readFileSync(file, 'utf8'));
  await db.query('BEGIN');
  try {
    // Las secciones creadas se borran al final: nada más puede apuntarlas.
    for (const tabla of ['section_progress', 'checkpoint_attempts']) {
      const [{ n }] = (await db.query(
        `SELECT count(*)::int AS n FROM ${tabla} WHERE section_id = ANY($1)`, [b.createdSectionIds])).rows;
      if (n > 0) {
        throw new Abort('No se puede deshacer sin perder datos:', [
          `${tabla} tiene ${n} filas en las secciones creadas ${b.createdSectionIds}; revisar a mano`,
        ]);
      }
    }
    await moverNodos(db, b.nodes);
    for (const l of b.levels) await db.query('UPDATE levels SET id_section = $1 WHERE id = $2', [l.idSection, l.id]);
    for (const s of b.sections) {
      await db.query('UPDATE section SET name = $1, id_difficulty = $2 WHERE id = $3', [s.name, s.idDifficulty, s.id]);
    }
    await db.query('DELETE FROM section WHERE id = ANY($1)', [b.createdSectionIds]);

    // Lo restaurado tiene que ser exactamente el inventario.
    const errores = core.checkPreconditions(await readSnapshot(db), ANTES);
    if (errores.length) throw new Abort('Lo restaurado no es el inventario; se deshace el rollback:', errores);
    await db.query('COMMIT');
  } catch (e) {
    await db.query('ROLLBACK');
    throw e;
  }
  console.log(`Restaurados ${b.nodes.length} nodos, ${b.levels.length} niveles y ${b.sections.length} secciones; borradas ${b.createdSectionIds.length}.`);
}

async function main() {
  loadEnv();
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const db = new Client({
    host: process.env.DB_HOST, port: Number(process.env.DB_PORT),
    user: process.env.DB_USERNAME, password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME, ssl: { rejectUnauthorized: false },
  });
  await db.connect();
  await db.query('SET search_path TO dots');
  try {
    const rollbackFile = arg('--rollback');
    if (rollbackFile) await rollback(db, rollbackFile);
    else if (process.argv.includes('--apply')) await apply(db);
    else await dryRun(db);
  } catch (e) {
    if (!(e instanceof Abort)) throw e;
    console.error(e.message);
    for (const x of e.errores) console.error(`  - ${x}`);
    process.exitCode = 1;
  } finally {
    await db.end();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
```

- [ ] **Step 4: Comprobar que parsea y correr el ensayo**

Run: `node --check scripts/rebalance-sections.js && npm run sections:rebalance:ensayo`
Expected: doce líneas `✔` repartidas en los pasos 1 a 8, ninguna `✖` y, al final, `ENSAYO OK`. Si el puerto 55432 está ocupado, `pg_ctl` no arranca e imprime su log: libéralo, no cambies el puerto en medio del plan.

- [ ] **Step 5: La suite del backend sigue verde**

Run: `npm run test:scripts && npm test`
Expected: `pass 29` y la suite de jest en verde (este cambio no toca `src/`).

- [ ] **Step 6: Commit**

```bash
git add package.json scripts/rebalance-sections.js scripts/rebalance-sections/ensayo/schema.sql scripts/rebalance-sections/ensayo/seed.js scripts/rebalance-sections/ensayo/ensayo.sh
git commit -m "$(cat <<'EOF'
feat(scripts): rebalance-sections — secciones parejas del Camino

Dry-run por defecto, --apply en una transacción que verifica lo escrito antes
del COMMIT y --rollback con el respaldo de scripts/out/. Aborta si la BD no
es la del inventario o si alguien saltó una sección por test. El ensayo
(npm run sections:rebalance:ensayo) lo prueba entero contra un Postgres local
desechable, sin leer el .env de producción.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

### Después de la revisión final

El código de las Tasks 1 a 6 quedó como se transcribe arriba, con tres cambios
posteriores que viven en la rama y no en estos bloques:

- `moverNodos` y las `DB_*` fijadas en `run()` del ensayo: sí están reflejados
  arriba (rulings del pre-flight y de la Task 6, backend `1d73baa`).
- Backend `34f0941`, después del pre-flight de producción: `section.id` es
  `GENERATED ALWAYS AS IDENTITY` y su secuencia está en 1 sin usar, así que el
  apply la alinea hacia adelante con el máximo antes de insertar (lógica pura
  `planSecuencia` en `core.js`, con 4 tests: 33 en total); el dry-run predice
  los ids reales; el rollback se niega con cualquier `section_test` y no
  devuelve la secuencia; argumentos estrictos antes de conectarse; COMMIT al
  final del `try` y un ROLLBACK que falla no tapa el error original. El ensayo
  reproduce la identidad de producción y suma pasos 9 a 12 (31 ✔). Para esos
  archivos, la fuente de verdad es la rama, no estos bloques.

---

## Parte B — Producción (con Sergio)

### Task 7: Dry-run contra producción

**Files:** ninguno (solo lectura).

- [ ] **Step 1: Autorización para leer producción**

Si en esta conversación Sergio todavía no autorizó lecturas de producción, pídeselo antes de correr nada: el dry-run lee la BD compartida. Si el clasificador bloquea el comando, no busques otra vía; déjale el comando listo para que lo corra él y te pegue la salida.

- [ ] **Step 2: Pre-flight de solo lectura (lo pidió la revisión final)**

El ensayo corre sobre un `schema.sql` escrito a mano, así que lo que el esquema real tenga de más (un trigger, una FK con `ON DELETE CASCADE` hacia `section`) no lo ve nadie. Además, el examen del checkpoint (`checkpoint.service.ts`, `loadSectionSentences`) solo usa oraciones *cloze* (`text LIKE '%\_\_%'` y `m_word` no vacío) y responde 400 con menos de 5, mientras que la verificación 4 cuenta todas las oraciones activas. Corre, dentro de `BEGIN READ ONLY` … `ROLLBACK`:

```sql
SELECT conrelid::regclass, conname, pg_get_constraintdef(oid) FROM pg_constraint
 WHERE conrelid IN ('dots.section'::regclass, 'dots.path_nodes'::regclass, 'dots.levels'::regclass)
    OR confrelid IN ('dots.section'::regclass, 'dots.path_nodes'::regclass, 'dots.levels'::regclass);
SELECT tgrelid::regclass, tgname FROM pg_trigger
 WHERE NOT tgisinternal AND tgrelid IN ('dots.section'::regclass, 'dots.path_nodes'::regclass, 'dots.levels'::regclass);
SELECT table_name, column_name, is_nullable, column_default FROM information_schema.columns
 WHERE table_schema = 'dots' AND table_name IN ('section', 'path_nodes', 'levels') ORDER BY 1, ordinal_position;
SELECT last_value, is_called FROM dots.section_id_seq;
SELECT has_table_privilege('dots.section', 'INSERT'), has_table_privilege('dots.section', 'UPDATE'),
       has_table_privilege('dots.section', 'DELETE'), has_table_privilege('dots.path_nodes', 'UPDATE'),
       has_table_privilege('dots.levels', 'UPDATE'), has_sequence_privilege('dots.section_id_seq', 'USAGE');
SELECT s.level_id, count(*) AS cloze FROM dots.sentences s JOIN dots.levels l ON l.id = s.level_id AND l.enabled
 WHERE s.enabled AND s.text LIKE '%\_\_%' AND COALESCE(s.m_word, '') <> '' GROUP BY 1 ORDER BY 1;
```

Expected:
- Ninguna FK con `ON DELETE CASCADE` hacia `section`, ningún CHECK sobre `position`, ningún UNIQUE sobre `section.name`, 0 triggers.
- Ninguna columna NOT NULL sin default en `section` aparte de `id`, `name` e `id_difficulty`.
- `last_value` 1 con `is_called` false (medido el 2026-10-12: el apply la alinea a 12 y las nuevas serán 13 a 16); todos los privilegios en `true`, también `SELECT` y `UPDATE` sobre `dots.section_id_seq`, que el CLI necesita para leerla y alinearla.
- Cloze por sección con checkpoint, sumando los niveles de cada una: Level 8 {19–25}, Level 9 {26–31, 33, 34}, Level 10 {35–41}, Level 11 {42, 43, 51–54}, Level 12 {55–63}, Level 13 {64–72}, Level 14 {73–80}, Level 15 {81–88}, Level 16 {89–95}. **Cada suma ≥ 5.** Si alguna queda por debajo, su checkpoint aparecería disponible y el examen fallaría: detente y llévaselo a Sergio.

- [ ] **Step 3: Correr el dry-run**

```bash
cd /home/endurance/Projects/Endurance/dots/dots-backend/.claude/worktrees/secciones-parejas
source ~/.nvm/nvm.sh && nvm use && npm run sections:rebalance
```

Expected, en este orden:
- El informe: `Dificultad 1` con Level 1 a Level 11, `Dificultad 2` con Level 12 a 14 y `Dificultad 3` con Level 15 y 16, igual que las tablas de la spec. Level 8 es `sección 13  8 nodos, checkpoint 39` y Level 16, `sección 10  7 nodos, checkpoint 93`.
- `4 secciones nuevas y 12 reutilizadas · 134 nodos cambian de sección, posición o estado · 3 checkpoints se retiran · 54 niveles cambian de sección`.
- `Secuencia de section alineada: 1 → 12 (solo con --apply)` y `Secciones nuevas: 13 a 16`.
- Siete líneas `ok` en `Verificaciones:`.
- `usuario 8: 108 → 108`. Si aparece otro usuario, anótalo para Sergio.
- `(dry-run: nada escrito. Usa --apply.)`.

Si en cambio sale `La BD no coincide con el inventario del 2026-10-12`, **detente**. Alguien cambió el Camino desde el inventario (por ejemplo, desde `/admin/path`). Lleva la lista de diferencias a Sergio y no edites `antes.json` ni `reparto.js` sin volver a validar el reparto con él.

- [ ] **Step 4: Mostrarle el resultado a Sergio y pedir el sí**

Resúmele el pre-flight y el informe (16 secciones, tamaños, checkpoints con su pool cloze, nodo actual de la cuenta 8) y pregúntale si corres el `--apply` en producción, idealmente en una hora tranquila: el apply bloquea las 143 filas de `path_nodes` hasta el COMMIT. Sin un sí explícito no se sigue.

---

### Task 8: Apply en producción y verificación

**Files:** ninguno en git. Escribe en la BD de producción y deja un respaldo en `scripts/out/`.

- [ ] **Step 1: Apply (solo con el sí de Sergio en la conversación)**

```bash
cd /home/endurance/Projects/Endurance/dots/dots-backend/.claude/worktrees/secciones-parejas
source ~/.nvm/nvm.sh && nvm use && npm run sections:rebalance -- --apply
```

Expected: `Secuencia de section alineada: 1 → 12`, siete `ok` en `Verificaciones:`, el informe con las 16 secciones, la línea de resumen y `Escrito. Respaldo: …/scripts/out/backup-rebalance-sections-<ts>.json`. **Anota la ruta del respaldo.** Las secciones nuevas serán 13 a 16, salvo que un apply anterior se haya deshecho: la secuencia no retrocede y entonces serán otras, todas mayores que 12.

Si sale `La verificación falló; se deshace todo:`, no se escribió nada: lleva los errores a Sergio.

Si termina con un error que no es de esos (por ejemplo, la conexión se corta con el COMMIT en vuelo), **no lo repitas**: el COMMIT pudo haber ocurrido. Mira si apareció un respaldo nuevo en `scripts/out/` y corre el dry-run: si dice que la BD no coincide con el inventario y las diferencias son las del reparto, el cambio quedó aplicado.

- [ ] **Step 2: Verificar el Camino en el navegador integrado**

1. Abre `https://app.dotsonlinelearning.com/levels` con `preview_start` (`url`). Si el panel no tiene sesión, pídele a Sergio que inicie sesión **en ese panel**; tú no escribes credenciales.
2. Con `read_network_requests` (`urlPattern: "/path"`) toma el `requestId` de `GET /path` y lee su cuerpo. Comprueba:
   - `difficulties[0].sections` tiene 11 secciones, `[1]` 3 y `[2]` 2, con los nombres «Level 1» a «Level 16» en ese orden.
   - Cada sección tiene entre 7 y 9 nodos que no son `checkpoint`.
   - Level 1 a Level 7 no tienen nodo `checkpoint`. Level 8 a Level 16 tienen uno, al final, y `checkpointAvailable: true` si la sección está desbloqueada (con el modo admin encendido, lo están todas).
   - En Level 2, el nodo 143 («Las decenas») va justo después del 2 («Números 1–20»).
3. Captura de pantalla del banner de Beginner: la barra segmentada debe tener 11 segmentos.
4. Abre `/checkpoint?id=5` (el checkpoint de Level 12) y comprueba que muestra la portada del examen. **No lo empieces**: empezarlo escribe un intento en producción. Además, un intento en una sección creada (13 a 16) bloquearía el rollback.
5. No toques `localStorage`, cookies ni la sesión del panel.

6. Justo después del apply, una lectura: `SELECT user_id, section_id FROM dots.section_progress WHERE section_test` debe devolver 0 filas. La guarda del apply lee esa tabla sin lock; un placement o un checkpoint confirmado durante el apply quedaría grabado sobre el reparto viejo.

- [ ] **Step 3: Si algo no cuadra, rollback (también con el sí de Sergio)**

La ventana práctica del rollback es corta: la primera práctica en Level 8 a 11 crea `section_progress` en una sección nueva y, a propósito, la guarda del rollback se niega. Decídelo en minutos, no en días.

```bash
cd /home/endurance/Projects/Endurance/dots/dots-backend/.claude/worktrees/secciones-parejas
source ~/.nvm/nvm.sh && nvm use && npm run sections:rebalance -- --rollback scripts/out/backup-rebalance-sections-<ts>.json
```

Expected: `Restaurados 143 nodos, 69 niveles y 12 secciones; borradas 4.` Si se niega porque `checkpoint_attempts` o `section_progress` tienen filas en una sección creada, alguien ya usó el Camino nuevo: llévaselo a Sergio, no borres esas filas.

---

### Task 9: Cierre

**Files:**
- Modify (webapp): `docs/superpowers/specs/2026-10-12-secciones-parejas-design.md` (línea **Estado**)

- [ ] **Step 1: Subir el backend a main (con el OK de Sergio)**

La regla de Sergio es push directo a main tras rebase, sin PR ni merge. Pregúntale antes de empujar.

```bash
cd /home/endurance/Projects/Endurance/dots/dots-backend/.claude/worktrees/secciones-parejas
git fetch origin && git rebase origin/main
source ~/.nvm/nvm.sh && nvm use && npm run test:scripts
git push origin HEAD:main
```

Si el rebase trajo commits nuevos, corre también `npm test`. Si el clasificador bloquea el push, déjale a Sergio el comando en un bloque `bash`.

- [ ] **Step 2: Marcar la spec como aplicada**

En el webapp, reemplaza la línea de estado de la spec:

```markdown
- **Estado**: diseño aprobado y revisado por Sergio; plan en
  `docs/superpowers/plans/2026-10-12-secciones-parejas.md`.
```

por (con la fecha y la ruta reales del respaldo):

```markdown
- **Estado**: aplicado en producción el <AAAA-MM-DD> con
  `dots-backend/scripts/rebalance-sections.js` (respaldo
  `scripts/out/backup-rebalance-sections-<ts>.json`; se deshace con
  `npm run sections:rebalance -- --rollback <respaldo>`).
```

```bash
cd /home/endurance/Projects/Endurance/dots/dots-webapp/.claude/worktrees/level-1-descriptive-images-af7087
git add docs/superpowers/specs/2026-10-12-secciones-parejas-design.md
git commit -m "$(cat <<'EOF'
docs(spec): secciones parejas, aplicado en producción

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

Subir el webapp a main sigue la misma regla y el mismo OK de Sergio: `git fetch origin && git rebase origin/main && git push origin HEAD:main`. Solo cambian documentos, así que no hace falta `npx next build`.

- [ ] **Step 3: Actualizar la memoria**

En `/home/endurance/.claude/projects/-home-endurance-Projects-Endurance-dots-dots-webapp/memory/secciones-parejas.md`: aplicado (fecha), ruta del respaldo, commits de backend y webapp en main, y el comando de rollback. Ajusta su línea en `MEMORY.md`.

- [ ] **Step 4: Retirar el worktree del backend**

Solo después del push. `scripts/out` es un enlace, así que el respaldo vive en el checkout compartido y sobrevive.

```bash
ls -la /home/endurance/Projects/Endurance/dots/dots-backend/scripts/out/ | grep rebalance-sections
git -C /home/endurance/Projects/Endurance/dots/dots-backend worktree remove /home/endurance/Projects/Endurance/dots/dots-backend/.claude/worktrees/secciones-parejas
```

Expected: el `ls` muestra el respaldo antes de retirar el worktree.
