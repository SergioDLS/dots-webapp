# Dificultades parejas — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans (inline, con revisión por subagente al cerrar cada tarea de código) — Sergio pidió «avanza», así que no se para en cada gate. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cargar 59 píldoras de gramática en Intermediate y Advanced y re-cortar esas dos dificultades en 6 secciones cada una (86 · 52 · 48 nodos), con un script de datos reversible.

**Architecture:** `scripts/difficulty-content.js` (CLI, solo SQL) sobre un core puro en `scripts/difficulty-content/` que reutiliza el de `rebalance-sections` (recorrido, precondiciones, simulación, verificaciones, informe) con el rango de tamaño como parámetro. El contenido vive en `scripts/seed-data/pildoras-intermedio-avanzado.json` y pasa por un validador puro. Un ensayo contra un Postgres local desechable prueba apply y rollback antes de producción.

**Tech Stack:** Node 24 (CommonJS), `pg`, `node:test`, PostgreSQL local para el ensayo.

**Spec:** `docs/superpowers/specs/2026-10-15-dificultades-parejas-design.md` (webapp).

## Global Constraints

- Backend en el worktree `/home/endurance/Projects/Endurance/dots/dots-backend/.claude/worktrees/dificultades` (branch `feat/dificultades-parejas` desde `origin/main`). El checkout compartido no se toca.
- Node 24: `export PATH="$HOME/.nvm/versions/node/v24.19.0/bin:$PATH"`.
- Nada en `src/`. Nada en el código de la app del webapp.
- Patrón obligatorio: dry-run por defecto, `--apply`, respaldo en `scripts/out/` antes del COMMIT, `--rollback`.
- **Nunca** correr el CLI en el worktree fuera del dry-run (su `.env` es producción). `--apply` y `--rollback` en producción solo con el sí explícito de Sergio.
- `git add` con rutas explícitas. Commits en español con `Co-Authored-By`.
- `npm run test:scripts` en verde en cada commit.
- Reparto (spec §Decisiones 4–7): Beginner intacto (Level 1–11); Intermediate en 6 secciones de 4 o 5 pares píldora+nivel (8 o 10 nodos), ids 5, 6, 7, 17, 18, 19 → Level 12–17; Advanced en 6 secciones de 8, ids 9, 10, 20, 21, 22, 23 → Level 18–23; checkpoints solo en secciones con práctica; tamaños 7 a 10.

## El reparto

Pares en orden (`P` = píldora, número = `path_nodes.id` del nivel):

| Sección | id | Contenido | Checkpoint |
|---|---|---|---|
| Level 12 | 5 | P59 59 · P60 60 · P61 61 · P62 62 | 66 |
| Level 13 | 6 | P63 63 · P64 64 · P65 65 · P67 67 | 74 |
| Level 14 | 7 | P68 68 · P69 69 · P70 70 · P71 71 | 80 |
| Level 15 | nueva (17) | P72 72 · P73 73 · P75 75 · P76 76 · P77 77 | nuevo |
| Level 16 | nueva (18) | P78 78 · P79 79 · P81 81 · P82 82 | nuevo |
| Level 17 | nueva (19) | P83 83 · P84 84 · P85 85 · P86 86 · P87 87 | nuevo |
| Level 18 | 9 | P89 89 · P90 90 · P92 92 · P94 94 | 91 |
| Level 19 | 10 | P96 96 · P97 97 · P98 98 · P99 99 | 93 |
| Level 20 | nueva (20) | P100 100 · P101 101 · P102 102 · P103 103 | nuevo |
| Level 21 | nueva (21) | P104 104 · P105 105 · P106 106 · be-get-used-to · present-perfect-continuous | nuevo |
| Level 22 | nueva (22) | past-perfect-continuous · futuro-en-el-pasado · modales-de-deduccion · gerundio-o-infinitivo · relativas · oraciones-de-participio · comparativos-avanzados · so-neither | — |
| Level 23 | nueva (23) | do-enfatico · contraste-y-concesion · would-rather-its-time · pasiva-de-opinion · condicionales-mixtos · oraciones-escindidas · inversion · subjuntivo-formal | — |

Claves de las píldoras de nivel (`path_nodes.id` del nivel → clave): 59 `opuestos` · 60 `exclamaciones` · 61 `palabras-compuestas` · 62 `verbos-de-accion` · 63 `present-perfect` · 64 `past-perfect` · 65 `future-perfect` · 67 `conectores` · 68 `phrasal-verbs` · 69 `condicionales` · 70 `imperativo` · 71 `shall` · 72 `used-to` · 73 `voz-pasiva` · 75 `had-better` · 76 `estilo-indirecto` · 77 `suppose` · 78 `have-get-something-done` · 79 `wish` · 81 `should-have` · 82 `could-have` · 83 `will-be-doing` · 84 `will-have-done` · 85 `usos-de-for` · 86 `usos-de-let` · 87 `like-parecer` · 89 `usos-de-about` · 90 `question-tags` · 92 `forma-ing` · 94 `modismos` · 96 `jerga` · 97 `formal-informal` · 98 `decir-no-me-gusta` · 99 `decir-me-gusta` · 100 `presentarte` · 101 `pedir-calma` · 102 `decir-te-extrano` · 103 `decir-que-no` · 104 `felicitar` · 105 `antonimos` · 106 `otras-preposiciones`.

Tiles: la píldora de un nivel usa `levels.src` de su nivel. Las nuevas: `be-get-used-to` presente · `present-perfect-continuous` y `past-perfect-continuous` perfectos · `futuro-en-el-pasado` futuro · `modales-de-deduccion` modales · `gerundio-o-infinitivo` acciones · `relativas`, `oraciones-de-participio`, `oraciones-escindidas` e `inversion` estructuras · `comparativos-avanzados` comparativo · `so-neither` parecido · `do-enfatico` exclamaciones · `contraste-y-concesion` conectores · `would-rather-its-time` deseo · `pasiva-de-opinion` estilo-indirecto · `condicionales-mixtos` condicionales · `subjuntivo-formal` formal-informal (todas `/images/levels/<slug>.png`).

---

### Task 1: Worktree, inventario y `verify` con rango de tamaño

- Worktree `dificultades` (branch `feat/dificultades-parejas` desde `origin/main`), enlaces `.env` y `scripts/out`, `npm ci`.
- `scripts/rebalance-sections/core.js`: `verify(snapshot, reparto = REPARTO, opts = {})` con `opts.minNodos`/`opts.maxNodos` (por defecto `MIN_NODOS`/`MAX_NODOS`). Test nuevo: con `{ maxNodos: 8 }` el Camino resultante de `rebalance-sections` falla `tamaños`. Los 33 tests siguen en verde.
- `scripts/difficulty-content/antes.json`: volcado de solo lectura de producción del 2026-10-15 (secciones, nodos, niveles, conteo de oraciones *cloze* por nivel y claves de `grammar_pills`), mismo formato de tuplas que el de `rebalance-sections` más `grammarPillKeys`.
- Commit.

### Task 2: Validador del contenido

- `scripts/difficulty-content/contenido.js`: `validarContenido(json) → string[]` con las reglas de la spec (§Cómo se escribe cada píldora): clave kebab única, título ≤ 120, 3 a 5 bloques con al menos un `p`, exactamente 2 `example` con traducción y 1 `tip`; 8 ítems `complete`, posiciones 1..8, un solo `__`, respuesta ≤ 30 y fuera de los distractores, 2 distractores distintos.
- Tests con casos que fallan cada regla. Commit.

### Task 3: Reparto y plan

- `scripts/difficulty-content/reparto.js`: la tabla de arriba (`nodes` con ids de nodos existentes o `{ pill: '<clave>' }`, `checkpoint` id existente, `'nuevo'` o `null`), el mapa de tiles y las constantes (`MIN_NODOS = 7`, `MAX_NODOS = 10`).
- `scripts/difficulty-content/core.js`: `checkReparto(antes, contenido)` (cada nodo de Intermediate y Advanced aparece una vez y en su orden de hoy; cada píldora de nivel va justo antes de su nivel; las 59 claves del reparto son las del contenido; ninguna existe ya); `resolverReparto(antes, ids)` → reparto completo de las 23 secciones con ids numéricos (Beginner desde el inventario); `planChanges(antes, contenido, ids)` → secciones, nodos (los existentes de Intermediate y Advanced y los nuevos, con sección y posición finales), niveles y filas a insertar; `simular(antes, plan)` → snapshot resultante.
- Tests: el reparto cubre todo; el snapshot simulado pasa `verify` (con `minNodos 7`, `maxNodos 10`) y da 11 · 6 · 6 secciones; casos que fallan (par separado, clave faltante, clave ya existente). Commit.

### Task 4: CLI, ensayo y dry-run

- `scripts/difficulty-content.js`: argumentos estrictos; dry-run (precondiciones, simulación con ids previstos desde las secuencias, informe, verificaciones, nodo actual de cada alumno con progreso); `--apply` en una transacción (crear secciones → insertar píldoras e ítems → insertar nodos y checkpoints nuevos → mover → renombrar → `levels.id_section` → verificar sobre lo escrito → respaldo → COMMIT); `--rollback` (se niega si hay progreso en nodos, ítems o secciones nuevos o algún `section_test`; restaura lo movido, borra lo insertado y comprueba que la BD vuelve a ser el inventario).
- `scripts/difficulty-content/ensayo/`: esquema mínimo (con `grammar_pills`, `grammar_items`, `item_progress`, `node_progress`), seed desde `antes.json` y el contenido, y pasos: dry-run, apply, estado, dry-run que aborta, rollback, dry-run que vuelve a pasar.
- npm: `content:difficulties` y `content:difficulties:ensayo`; `test:scripts` incluye los tests nuevos.
- Dry-run contra producción (solo lectura). Commit.

### Task 5: Revisión del contenido

- Un revisor lee las 59 píldoras contra la spec: inglés correcto, una sola opción válida por ítem, explicación correcta y en español neutro. Las correcciones se hacen en el JSON y el validador vuelve a pasar. Commit.

### Task 6: Producción (con Sergio)

- Dry-run, sí explícito, `--apply`, verificación sobre la BD y en el navegador, push con su OK, memoria.
