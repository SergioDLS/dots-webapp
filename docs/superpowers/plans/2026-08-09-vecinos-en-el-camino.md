# Vecinos en el camino — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mostrar en el camino de aprendizaje, al costado del nodo donde está cada uno, a los dos compañeros más cercanos a tu posición (uno delante, uno detrás) entre quienes jugaron en los últimos 7 días.

**Architecture:** Se extrae el recorrido del camino de `PathService.getPath()` a una función pura (`path-walk.ts`) que se convierte en la **única** definición de "en qué nodo está un usuario". `GET /path/neighbors` la aplica a cada usuario activo, ordena por índice en el catálogo global y devuelve los dos vecinos inmediatos. El frontend pide ese endpoint en paralelo con `/path` y pinta un círculo con la inicial al costado del nodo, reusando el anclaje que ya usa `DotyMarker`.

**Tech Stack:** Backend NestJS 11 + TypeORM 11 + PostgreSQL (schema `dots`), Jest 30. Frontend Next.js 16 (app router) + React 19 + Tailwind 4.

**Spec:** [`docs/superpowers/specs/2026-08-09-vecinos-en-el-camino-design.md`](../specs/2026-08-09-vecinos-en-el-camino-design.md)

## Global Constraints

- `source ~/.nvm/nvm.sh` **antes** de cualquier `node`/`npm` en ambos repos (Node 22 vía nvm).
- La BD es **PostgreSQL remota COMPARTIDA de producción**. Este plan **no aplica ningún DDL**. Ningún test toca la BD real: todo con fixtures y mocks `jest.fn()`.
- Backend: todo controller nuevo con `@UseGuards(JwtAuthGuard)`; el `userId` sale de `@CurrentUser()`, **nunca** del body; raw SQL siempre parametrizado (`$1, $2`).
- Backend: `npm test` verde y `npm run build` antes de commitear.
- Frontend: `npm run lint` (incluye reglas del compiler de React) + `npx next build` (type-check) antes de commitear.
- Frontend regla 2 (RN-safe): solo tap/pointer, animación solo `transform`/`opacity`, **hover nunca como única señal** — todo texto informativo va siempre visible.
- Frontend regla 3: prohibido `setState` síncrono en el cuerpo de un `useEffect`.
- Frontend regla 1: navegación con `router.push`, nunca `window.location.*`.
- UI en **español, tono juguetón**. Nombres recortados a inicial de apellido, igual que `LeaderboardEntryDto`.
- Constantes de la feature: `NEIGHBOR_ACTIVITY_DAYS = 7`, `NEIGHBOR_MAX_DISTANCE = 5`.

## File Structure

**`dots-backend`**

| Archivo | Responsabilidad |
|---|---|
| `src/modules/path/path-walk.ts` *(crear)* | Puro, sin TypeORM. Catálogo ordenado, progreso por tipo de nodo, y `findCurrentNodeId()`. Única definición de "nodo actual". |
| `src/modules/path/path-walk.spec.ts` *(crear)* | Tests del anterior con fixtures. |
| `src/modules/path/path.service.ts` *(modificar)* | Deja de calcular `current` y `progress` por su cuenta; delega en `path-walk.ts`. |
| `src/modules/path/neighbors-select.ts` *(crear)* | Puro. Dado mi posición y las de los demás, elige `ahead`/`behind`. |
| `src/modules/path/neighbors-select.spec.ts` *(crear)* | Tests del anterior. |
| `src/modules/path/neighbors.dto.ts` *(crear)* | `NeighborDto`, `NeighborsResponseDto`. |
| `src/modules/path/path-neighbors.service.ts` *(crear)* | Queries (candidatos activos, catálogo, progreso batch) + orquestación. |
| `src/modules/path/path-neighbors.service.spec.ts` *(crear)* | Tests con repositorios mockeados. |
| `src/modules/path/path.controller.ts` *(modificar)* | Ruta `GET /path/neighbors`. |
| `src/modules/path/path.module.ts` *(modificar)* | Registra `PathNeighborsService`. |

**`dots-webapp`**

| Archivo | Responsabilidad |
|---|---|
| `types/path.types.ts` *(modificar)* | `PathPeer`, `PathNeighborsResponse`. |
| `services/levels.service.ts` *(modificar)* | `getPathNeighborsService()`. |
| `lib/peer-colors.ts` *(crear)* | Color estable por `userId`. |
| `components/path/path-peer.tsx` *(crear)* | El círculo con la inicial al costado del nodo. |
| `components/path/path-container.tsx` *(modificar)* | Fetch de vecinos con degradación silenciosa + arreglo de `normalizeCurrent`. |
| `components/path/path-difficulty.tsx` *(modificar)* | Pasa `peersByNodeId` hacia abajo. |
| `components/path/path-section.tsx` *(modificar)* | Renderiza `PathPeer` y resuelve la colisión con `DotyMarker`. |

---

## Task 0: Preparación de ramas

**Files:** ninguno (solo git).

- [ ] **Step 1: Confirmar la rama del frontend**

```bash
cd /home/endurance/Projects/Endurance/dots/dots-webapp
git branch --show-current
```

Esperado: `feat/vecinos-en-el-camino` (ya creada, con el spec commiteado).

- [ ] **Step 2: Crear la rama del backend**

```bash
cd /home/endurance/Projects/Endurance/dots/dots-backend
git status --short
git checkout -b feat/vecinos-en-el-camino
```

Esperado: working tree limpio antes de cambiar de rama; si hay cambios sin commitear, **detente y pregunta**. El backend suele estar corriendo con watcher en `:4000`.

---

## Task 1: `path-walk.ts` — la única regla de "nodo actual"

**Files:**
- Create: `dots-backend/src/modules/path/path-walk.ts`
- Test: `dots-backend/src/modules/path/path-walk.spec.ts`

**Interfaces:**
- Consumes: `PathNodeType` de `src/common/entity/path_node.entity.ts`.
- Produces: `type WalkNode`, `type WalkProgress`, `isOptionalNode(type): boolean`, `nodeProgressFor(node, progress, sectionSkipped): number`, `buildWalkCatalog(difficulties, nodesBySection, enabledLevelIds): WalkNode[]`, `findCurrentNodeId(catalog, progress): number | null`.

**Contexto para quien implementa:** hoy esta lógica vive incrustada en el recorrido de `PathService.getPath()` (`path.service.ts:97-138` y el método privado `nodeProgress` en `:213-234`). La sacamos a un módulo puro para que el endpoint de vecinos use **exactamente** la misma regla. Si divergen, la distancia entre vecinos es incorrecta y nadie se da cuenta.

- [ ] **Step 1: Escribir el test que falla**

Crear `dots-backend/src/modules/path/path-walk.spec.ts`:

```ts
import {
  buildWalkCatalog,
  findCurrentNodeId,
  isOptionalNode,
  nodeProgressFor,
  type WalkNode,
  type WalkProgress,
} from './path-walk';

const node = (
  nodeId: number,
  type: WalkNode['type'],
  sectionId = 1,
  refId: number | null = nodeId * 10,
): WalkNode => ({ nodeId, sectionId, type, refId });

const progressOf = (over: Partial<WalkProgress> = {}): WalkProgress => ({
  levelProgressById: new Map(),
  nodeProgressById: new Map(),
  skippedSections: new Set(),
  completedReadings: new Set(),
  ...over,
});

describe('isOptionalNode', () => {
  it('trata checkpoint y reading como opcionales, y nada más', () => {
    expect(isOptionalNode('checkpoint')).toBe(true);
    expect(isOptionalNode('reading')).toBe(true);
    for (const type of [
      'practice',
      'vocab',
      'grammar',
      'pronunciation',
      'letters',
      'numbers',
    ] as const) {
      expect(isOptionalNode(type)).toBe(false);
    }
  });
});

describe('nodeProgressFor', () => {
  it('lee un nodo practice desde levels_progress por refId', () => {
    const progress = progressOf({ levelProgressById: new Map([[77, 40]]) });
    expect(nodeProgressFor(node(1, 'practice', 1, 77), progress, false)).toBe(40);
  });

  it('lee los módulos con ítems desde node_progress por nodeId', () => {
    const progress = progressOf({ nodeProgressById: new Map([[5, 60]]) });
    expect(nodeProgressFor(node(5, 'vocab'), progress, false)).toBe(60);
  });

  it('da 0 a un checkpoint pendiente y 100 si la sección fue superada por test', () => {
    expect(nodeProgressFor(node(9, 'checkpoint', 1, null), progressOf(), false)).toBe(0);
    expect(nodeProgressFor(node(9, 'checkpoint', 1, null), progressOf(), true)).toBe(100);
  });

  it('marca una lectura como 100 solo si está en completedReadings', () => {
    const reading = node(3, 'reading', 1, 42);
    expect(nodeProgressFor(reading, progressOf(), false)).toBe(0);
    expect(
      nodeProgressFor(reading, progressOf({ completedReadings: new Set([42]) }), false),
    ).toBe(100);
  });

  it('una sección superada por test pone 100 en cualquier tipo', () => {
    expect(nodeProgressFor(node(1, 'practice', 1, 77), progressOf(), true)).toBe(100);
    expect(nodeProgressFor(node(2, 'vocab'), progressOf(), true)).toBe(100);
  });

  it('da 0 cuando no hay progreso registrado', () => {
    expect(nodeProgressFor(node(1, 'practice', 1, 77), progressOf(), false)).toBe(0);
    expect(nodeProgressFor(node(2, 'grammar'), progressOf(), false)).toBe(0);
  });
});

describe('buildWalkCatalog', () => {
  const difficulties = [
    { id: 1, sections: [{ id: 10 }, { id: 11 }] },
    { id: 2, sections: [{ id: 20 }] },
  ];
  const nodesBySection = new Map([
    [
      10,
      [
        { id: 100, sectionId: 10, type: 'practice' as const, refId: 900 },
        { id: 101, sectionId: 10, type: 'vocab' as const, refId: 1 },
      ],
    ],
    [11, [{ id: 110, sectionId: 11, type: 'reading' as const, refId: 2 }]],
    [20, [{ id: 200, sectionId: 20, type: 'practice' as const, refId: 901 }]],
  ]);

  it('aplana en orden difficulty → section → position', () => {
    const catalog = buildWalkCatalog(
      difficulties,
      nodesBySection,
      new Set([900, 901]),
    );
    expect(catalog.map((n) => n.nodeId)).toEqual([100, 101, 110, 200]);
  });

  it('omite nodos practice cuyo nivel ya no está habilitado', () => {
    // Espeja path.service.ts:116-119. Si no se omiten, todos los índices se
    // desplazan y la distancia entre vecinos deja de cuadrar.
    const catalog = buildWalkCatalog(difficulties, nodesBySection, new Set([901]));
    expect(catalog.map((n) => n.nodeId)).toEqual([101, 110, 200]);
  });

  it('omite nodos practice sin refId', () => {
    const sinRef = new Map([
      [10, [{ id: 100, sectionId: 10, type: 'practice' as const, refId: null }]],
    ]);
    expect(
      buildWalkCatalog([{ id: 1, sections: [{ id: 10 }] }], sinRef, new Set()),
    ).toEqual([]);
  });

  it('tolera dificultades sin secciones y secciones sin nodos', () => {
    expect(buildWalkCatalog([{ id: 1 }], new Map(), new Set())).toEqual([]);
  });
});

describe('findCurrentNodeId', () => {
  const catalog: WalkNode[] = [
    node(1, 'practice', 1, 101),
    node(2, 'vocab', 1),
    node(3, 'reading', 1, 301),
    node(4, 'checkpoint', 1, null),
    node(5, 'practice', 2, 105),
  ];

  it('devuelve el primer nodo no-opcional sin completar', () => {
    const progress = progressOf({ levelProgressById: new Map([[101, 100]]) });
    expect(findCurrentNodeId(catalog, progress)).toBe(2);
  });

  it('nunca elige una lectura, aunque sea el siguiente nodo sin hacer', () => {
    // Este es exactamente el bug que normalizeCurrent() introduce hoy en el
    // frontend: la lectura 3 se roba la estrella de nodo actual.
    const progress = progressOf({
      levelProgressById: new Map([[101, 100]]),
      nodeProgressById: new Map([[2, 100]]),
    });
    expect(findCurrentNodeId(catalog, progress)).toBe(5);
  });

  it('nunca elige un checkpoint', () => {
    expect(
      findCurrentNodeId([node(4, 'checkpoint', 1, null)], progressOf()),
    ).toBeNull();
  });

  it('atraviesa una sección superada por test como si estuviera completa', () => {
    const progress = progressOf({ skippedSections: new Set([1]) });
    expect(findCurrentNodeId(catalog, progress)).toBe(5);
  });

  it('devuelve el primer nodo para alguien sin nada de progreso', () => {
    expect(findCurrentNodeId(catalog, progressOf())).toBe(1);
  });

  it('devuelve null cuando el camino entero está completo', () => {
    const progress = progressOf({
      levelProgressById: new Map([
        [101, 100],
        [105, 100],
      ]),
      nodeProgressById: new Map([[2, 100]]),
    });
    expect(findCurrentNodeId(catalog, progress)).toBeNull();
  });

  it('devuelve null para un catálogo vacío', () => {
    expect(findCurrentNodeId([], progressOf())).toBeNull();
  });
});
```

- [ ] **Step 2: Correr el test para verificar que falla**

```bash
source ~/.nvm/nvm.sh
cd /home/endurance/Projects/Endurance/dots/dots-backend
npx jest src/modules/path/path-walk.spec.ts
```

Esperado: FAIL — `Cannot find module './path-walk'`.

- [ ] **Step 3: Escribir la implementación**

Crear `dots-backend/src/modules/path/path-walk.ts`:

```ts
import { PathNodeType } from 'src/common/entity/path_node.entity';

/**
 * Recorrido del camino, aislado de TypeORM y de la BD.
 *
 * Esta es la ÚNICA definición de "en qué nodo está un usuario". La usan
 * GET /path (para marcar el nodo actual) y GET /path/neighbors (para ubicar a
 * cada compañero). Si alguien vuelve a duplicar la regla, las distancias entre
 * vecinos empiezan a mentir sin que nada falle.
 */

/** Un nodo del catálogo, ya en orden global (difficulty.id → section.id → position). */
export type WalkNode = {
  nodeId: number;
  sectionId: number;
  type: PathNodeType;
  refId: number | null;
};

/** Progreso de UN usuario, en el mismo formato que ya arma PathService.getPath(). */
export type WalkProgress = {
  /** levels_progress: idLevel → progress. Solo nodos `practice`. */
  levelProgressById: Map<number, number>;
  /** node_progress: nodeId → progress. Resto de módulos con ítems. */
  nodeProgressById: Map<number, number>;
  /** Secciones con section_progress.sectionTest = true (superadas por test). */
  skippedSections: Set<number>;
  /** refId de las lecturas ya leídas (daily_use con type_use = 'reading'). */
  completedReadings: Set<number>;
};

/**
 * Checkpoints y lecturas son opcionales: se desbloquean al llegar pero NO cierran
 * la frontera de desbloqueo ni pueden ser el nodo actual.
 */
export function isOptionalNode(type: PathNodeType): boolean {
  return type === 'checkpoint' || type === 'reading';
}

/** Progreso 0-100 de un nodo, según su tipo. */
export function nodeProgressFor(
  node: WalkNode,
  progress: WalkProgress,
  sectionSkipped: boolean,
): number {
  if (node.type === 'checkpoint') return sectionSkipped ? 100 : 0;
  if (node.type === 'reading') {
    if (sectionSkipped) return 100;
    return node.refId != null && progress.completedReadings.has(node.refId)
      ? 100
      : 0;
  }
  if (sectionSkipped) return 100;
  if (node.type === 'practice') {
    return node.refId ? (progress.levelProgressById.get(node.refId) ?? 0) : 0;
  }
  return progress.nodeProgressById.get(node.nodeId) ?? 0;
}

/**
 * Aplana el catálogo al orden global. Tipado estructural a propósito: acepta
 * tanto las entities de TypeORM como fixtures de test.
 *
 * `enabledLevelIds` filtra nodos `practice` cuyo nivel se deshabilitó después.
 * Ese filtro NO es opcional: omitir uno de menos desplaza todos los índices
 * siguientes y arruina el cálculo de distancia.
 */
export function buildWalkCatalog(
  difficulties: Array<{ id: number; sections?: Array<{ id: number }> }>,
  nodesBySection: Map<
    number,
    Array<{
      id: number;
      sectionId: number;
      type: PathNodeType;
      refId?: number | null;
    }>
  >,
  enabledLevelIds: Set<number>,
): WalkNode[] {
  const catalog: WalkNode[] = [];
  for (const difficulty of difficulties) {
    for (const section of difficulty.sections ?? []) {
      for (const node of nodesBySection.get(section.id) ?? []) {
        if (
          node.type === 'practice' &&
          (!node.refId || !enabledLevelIds.has(node.refId))
        ) {
          continue;
        }
        catalog.push({
          nodeId: node.id,
          sectionId: node.sectionId,
          type: node.type,
          refId: node.refId ?? null,
        });
      }
    }
  }
  return catalog;
}

/**
 * El nodo donde está el usuario: el primer nodo no-opcional sin completar.
 * Devuelve null si completó el camino entero (o si el catálogo está vacío).
 *
 * `frontierOpen` se conserva por paridad estructural con el recorrido de
 * PathService.getPath(): es la misma regla, y así un revisor puede compararlas
 * línea a línea sin razonar sobre equivalencias.
 */
export function findCurrentNodeId(
  catalog: WalkNode[],
  progress: WalkProgress,
): number | null {
  let frontierOpen = true;
  for (const node of catalog) {
    const sectionSkipped = progress.skippedSections.has(node.sectionId);
    const completed = nodeProgressFor(node, progress, sectionSkipped) >= 100;
    const optional = isOptionalNode(node.type);
    if (!optional && !completed && frontierOpen) return node.nodeId;
    if (!optional && !completed && !sectionSkipped) frontierOpen = false;
  }
  return null;
}
```

- [ ] **Step 4: Correr el test para verificar que pasa**

```bash
source ~/.nvm/nvm.sh
cd /home/endurance/Projects/Endurance/dots/dots-backend
npx jest src/modules/path/path-walk.spec.ts
```

Esperado: PASS, 18 tests.

- [ ] **Step 5: Commit**

```bash
cd /home/endurance/Projects/Endurance/dots/dots-backend
git add src/modules/path/path-walk.ts src/modules/path/path-walk.spec.ts
git commit -m "feat(camino): recorrido del camino como funcion pura

Extrae a path-walk.ts la regla de \"en que nodo esta un usuario\", hoy
incrustada en PathService.getPath(). Sin TypeORM: se testea con fixtures,
nunca contra la BD compartida.

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 2: `PathService` delega en `path-walk.ts`

**Files:**
- Modify: `dots-backend/src/modules/path/path.service.ts` (bloque `97-152`, y elimina el privado `nodeProgress` en `213-234`)

**Interfaces:**
- Consumes: `buildWalkCatalog`, `findCurrentNodeId`, `nodeProgressFor`, `WalkProgress` de `./path-walk` (Task 1).
- Produces: sin cambios en el contrato de `PathResponseDto`. El comportamiento observable cambia en un solo punto: `current` ya no puede caer en un nodo `reading` — que es justamente el bug.

**Por qué importa:** después de este task la coherencia entre `/path` y `/path/neighbors` es **estructural**, no algo que un test tenga que vigilar: hay una sola implementación.

- [ ] **Step 1: Añadir el import**

En `dots-backend/src/modules/path/path.service.ts`, después del import de `PathNode` (línea 12):

```ts
import {
  buildWalkCatalog,
  findCurrentNodeId,
  nodeProgressFor,
  type WalkProgress,
} from './path-walk';
```

- [ ] **Step 2: Construir catálogo y progreso antes del recorrido**

Reemplazar el comentario y las dos declaraciones de acumuladores (líneas 97-101):

```ts
      // ── single ordered walk: unlock frontier + current node ────────────────
      // A node is unlocked while everything before it on the global path is
      // complete (skipped sections count as complete via section_test).
      let frontierOpen = true;
      let currentAssigned = false;
```

por:

```ts
      // ── nodo actual: una sola regla, compartida con GET /path/neighbors ────
      const walkProgress: WalkProgress = {
        levelProgressById,
        nodeProgressById,
        skippedSections: new Set(
          sectionProgress
            .filter((sp) => sp.sectionTest === true)
            .map((sp) => sp.sectionId),
        ),
        completedReadings: readingMeta.completed,
      };
      const currentNodeId = findCurrentNodeId(
        buildWalkCatalog(
          difficulties,
          nodesBySection,
          new Set(levels.map((l) => l.id)),
        ),
        walkProgress,
      );

      // ── single ordered walk: unlock frontier + DTO building ────────────────
      // A node is unlocked while everything before it on the global path is
      // complete (skipped sections count as complete via section_test).
      let frontierOpen = true;
```

- [ ] **Step 3: Usar las funciones puras dentro del recorrido**

Reemplazar el bloque de cálculo por nodo (líneas 120-138, desde `const progress = this.nodeProgress(` hasta `if (!isOptional && !completed && !skipped) frontierOpen = false;`) por:

```ts
            const progress = nodeProgressFor(
              { nodeId: node.id, sectionId: node.sectionId, type: node.type, refId: node.refId ?? null },
              walkProgress,
              skipped,
            );
            const completed = progress >= 100;
            const isCheckpoint = node.type === 'checkpoint';
            const isReading = node.type === 'reading';
            // Checkpoints y lecturas son opcionales: se desbloquean al llegar
            // pero NO cierran la frontera ni pueden ser el nodo "actual".
            const isOptional = isCheckpoint || isReading;
            const unlocked = isCheckpoint
              ? sectionUnlocked
              : skipped || frontierOpen;
            const current = node.id === currentNodeId;
            if (!isOptional && !completed && !skipped) frontierOpen = false;
```

- [ ] **Step 4: Eliminar el método privado `nodeProgress`**

Borrar completo el método `private nodeProgress(...)` (líneas 213-234 del archivo original). Su lógica vive ahora en `nodeProgressFor` de `path-walk.ts`.

- [ ] **Step 5: Correr la suite completa y el build**

```bash
source ~/.nvm/nvm.sh
cd /home/endurance/Projects/Endurance/dots/dots-backend
npm test && npm run build
```

Esperado: toda la suite en verde y build sin errores de tipo. Si algún test de checkpoint o placement falla, **detente**: significa que el recorrido no era equivalente y hay que comparar línea a línea contra el original en git (`git diff src/modules/path/path.service.ts`).

- [ ] **Step 6: Commit**

```bash
cd /home/endurance/Projects/Endurance/dots/dots-backend
git add src/modules/path/path.service.ts
git commit -m "fix(camino): una sola regla para el nodo actual

PathService.getPath() delega en path-walk.ts en vez de calcular el nodo
actual y el progreso por tipo por su cuenta. Deja la coherencia con
GET /path/neighbors garantizada por construccion, no por un test.

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 3: `neighbors-select.ts` — elegir los dos vecinos

**Files:**
- Create: `dots-backend/src/modules/path/neighbors-select.ts`
- Test: `dots-backend/src/modules/path/neighbors-select.spec.ts`

**Interfaces:**
- Consumes: nada (módulo puro, sin imports del proyecto).
- Produces: `NEIGHBOR_MAX_DISTANCE`, `type Placed = { userId: number; index: number; nodeProgress: number }`, `type Ranked = { userId: number; index: number; distance: number }`, `type SelectedNeighbors = { ahead: Ranked | null; behind: Ranked | null }`, `selectNeighbors(me: Placed, others: Placed[], maxDistance?: number): SelectedNeighbors`.

**Reglas a implementar:** `ahead` es el índice más cercano por encima del mío, `behind` el más cercano por debajo. Empate de índice (mismo nodo) se resuelve por `nodeProgress`; si eso también empata, el `userId` menor va delante — lo que garantiza que si A ve a B detrás, B ve a A delante. Distancias mayores a `maxDistance` se descartan.

- [ ] **Step 1: Escribir el test que falla**

Crear `dots-backend/src/modules/path/neighbors-select.spec.ts`:

```ts
import {
  NEIGHBOR_MAX_DISTANCE,
  selectNeighbors,
  type Placed,
} from './neighbors-select';

const at = (userId: number, index: number, nodeProgress = 0): Placed => ({
  userId,
  index,
  nodeProgress,
});

describe('selectNeighbors', () => {
  const me = at(1, 10, 50);

  it('elige el más cercano por arriba y por abajo', () => {
    const result = selectNeighbors(me, [at(2, 12), at(3, 15), at(4, 8), at(5, 4)]);
    expect(result.ahead).toEqual({ userId: 2, index: 12, distance: 2 });
    expect(result.behind).toEqual({ userId: 4, index: 8, distance: 2 });
  });

  it('devuelve null en el lado donde no hay nadie', () => {
    expect(selectNeighbors(me, [at(2, 12)]).behind).toBeNull();
    expect(selectNeighbors(me, [at(4, 8)]).ahead).toBeNull();
  });

  it('devuelve ambos null cuando no hay candidatos', () => {
    expect(selectNeighbors(me, [])).toEqual({ ahead: null, behind: null });
  });

  it('descarta a quien está más lejos que maxDistance', () => {
    const result = selectNeighbors(me, [at(2, 10 + NEIGHBOR_MAX_DISTANCE + 1)]);
    expect(result.ahead).toBeNull();
  });

  it('acepta a quien está exactamente a maxDistance', () => {
    const result = selectNeighbors(me, [at(2, 10 + NEIGHBOR_MAX_DISTANCE)]);
    expect(result.ahead).toEqual({
      userId: 2,
      index: 10 + NEIGHBOR_MAX_DISTANCE,
      distance: NEIGHBOR_MAX_DISTANCE,
    });
  });

  it('nunca me devuelve a mí mismo, aunque venga en la lista', () => {
    expect(selectNeighbors(me, [at(1, 10, 50)])).toEqual({
      ahead: null,
      behind: null,
    });
  });

  it('en el mismo nodo, desempata por progreso dentro del nodo', () => {
    const result = selectNeighbors(me, [at(2, 10, 80), at(3, 10, 20)]);
    expect(result.ahead).toEqual({ userId: 2, index: 10, distance: 0 });
    expect(result.behind).toEqual({ userId: 3, index: 10, distance: 0 });
  });

  it('con índice y progreso empatados, el id menor va delante (y es simétrico)', () => {
    const a = at(5, 10, 50);
    const b = at(9, 10, 50);
    // A mira a B: id mayor → detrás.
    expect(selectNeighbors(a, [b]).behind?.userId).toBe(9);
    expect(selectNeighbors(a, [b]).ahead).toBeNull();
    // B mira a A: id menor → delante. Sin esta simetría uno de los dos vería
    // al otro en el lado equivocado.
    expect(selectNeighbors(b, [a]).ahead?.userId).toBe(5);
    expect(selectNeighbors(b, [a]).behind).toBeNull();
  });

  it('a igual distancia elige el id menor, para ser determinista', () => {
    const result = selectNeighbors(me, [at(9, 12), at(3, 12)]);
    expect(result.ahead?.userId).toBe(3);
  });

  it('respeta un maxDistance explícito distinto del default', () => {
    expect(selectNeighbors(me, [at(2, 13)], 2).ahead).toBeNull();
    expect(selectNeighbors(me, [at(2, 13)], 3).ahead?.distance).toBe(3);
  });
});
```

- [ ] **Step 2: Correr el test para verificar que falla**

```bash
source ~/.nvm/nvm.sh
cd /home/endurance/Projects/Endurance/dots/dots-backend
npx jest src/modules/path/neighbors-select.spec.ts
```

Esperado: FAIL — `Cannot find module './neighbors-select'`.

- [ ] **Step 3: Escribir la implementación**

Crear `dots-backend/src/modules/path/neighbors-select.ts`:

```ts
/**
 * Selección de vecinos en el camino: puro, sin BD.
 *
 * Un "vecino" es la persona inmediatamente anterior o posterior a ti en el
 * catálogo global de nodos. Deliberadamente NO es un ranking: ver la distancia
 * total al primero desmotiva, ver que alguien está a dos lecciones empuja.
 */

/**
 * Más allá de esto no es un vecino, es un desconocido — y pintarlo en
 * territorio que el usuario ni desbloqueó desmotiva más de lo que empuja.
 */
export const NEIGHBOR_MAX_DISTANCE = 5;

/** Posición de un usuario en el catálogo global. */
export type Placed = {
  userId: number;
  /** Índice en el catálogo aplanado. */
  index: number;
  /** Progreso 0-100 dentro de ese nodo, solo para desempatar. */
  nodeProgress: number;
};

export type Ranked = {
  userId: number;
  index: number;
  /** Nodos de separación. 0 = mismo nodo. */
  distance: number;
};

export type SelectedNeighbors = {
  ahead: Ranked | null;
  behind: Ranked | null;
};

/** Más cercano primero; a igual distancia, el id menor para ser determinista. */
function closest(list: Ranked[]): Ranked | null {
  if (list.length === 0) return null;
  return [...list].sort(
    (a, b) => a.distance - b.distance || a.userId - b.userId,
  )[0];
}

export function selectNeighbors(
  me: Placed,
  others: Placed[],
  maxDistance: number = NEIGHBOR_MAX_DISTANCE,
): SelectedNeighbors {
  const ahead: Ranked[] = [];
  const behind: Ranked[] = [];

  for (const other of others) {
    if (other.userId === me.userId) continue;
    const distance = Math.abs(other.index - me.index);
    if (distance > maxDistance) continue;
    const entry: Ranked = { userId: other.userId, index: other.index, distance };

    if (other.index > me.index) ahead.push(entry);
    else if (other.index < me.index) behind.push(entry);
    // Mismo nodo: manda el progreso dentro del nodo. Si también empata, el id
    // menor va delante — así la relación es simétrica entre los dos usuarios.
    else if (other.nodeProgress > me.nodeProgress) ahead.push(entry);
    else if (other.nodeProgress < me.nodeProgress) behind.push(entry);
    else if (other.userId < me.userId) ahead.push(entry);
    else behind.push(entry);
  }

  return { ahead: closest(ahead), behind: closest(behind) };
}
```

- [ ] **Step 4: Correr el test para verificar que pasa**

```bash
source ~/.nvm/nvm.sh
cd /home/endurance/Projects/Endurance/dots/dots-backend
npx jest src/modules/path/neighbors-select.spec.ts
```

Esperado: PASS, 10 tests.

- [ ] **Step 5: Commit**

```bash
cd /home/endurance/Projects/Endurance/dots/dots-backend
git add src/modules/path/neighbors-select.ts src/modules/path/neighbors-select.spec.ts
git commit -m "feat(camino): seleccion pura de vecinos

Elige el companero inmediatamente anterior y posterior por indice en el
catalogo, con desempate simetrico por progreso dentro del nodo y por id.

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 4: `PathNeighborsService` — queries y orquestación

**Files:**
- Create: `dots-backend/src/modules/path/neighbors.dto.ts`
- Create: `dots-backend/src/modules/path/path-neighbors.service.ts`
- Test: `dots-backend/src/modules/path/path-neighbors.service.spec.ts`

**Interfaces:**
- Consumes: `buildWalkCatalog`, `findCurrentNodeId`, `nodeProgressFor`, `WalkProgress`, `WalkNode` de `./path-walk` (Task 1); `selectNeighbors`, `Placed`, `Ranked` de `./neighbors-select` (Task 3); `isAccessExpired` de `../invitations/invitations.util`; los repositorios ya registrados en `PathModule`.
- Produces: `NEIGHBOR_ACTIVITY_DAYS`, `type NeighborDto`, `type NeighborsResponseDto`, `class PathNeighborsService` con `getNeighbors(user: { id: number }): Promise<NeighborsResponseDto>`.

**Nombres de columna confirmados** (no los cambies por intuición): `daily_use` usa `id_user`, `type_use`, `id_reading`, `updated_at`, `created_at`. Todo lo demás pasa por repositorios de TypeORM para no depender de nombres de columna.

- [ ] **Step 1: Crear el DTO**

Crear `dots-backend/src/modules/path/neighbors.dto.ts`:

```ts
// ── GET /path/neighbors ──────────────────────────────────────────────────────

export type NeighborDto = {
  id: number;
  name: string;
  /** Recortado a la inicial, igual que LeaderboardEntryDto. */
  lastName: string;
  /** Nodo del camino donde está esta persona. */
  nodeId: number;
  /** Nodos de separación respecto a quien consulta. 0 = mismo nodo. */
  distance: number;
};

export type NeighborsResponseDto = {
  ahead: NeighborDto | null;
  behind: NeighborDto | null;
};
```

- [ ] **Step 2: Escribir el test que falla**

Crear `dots-backend/src/modules/path/path-neighbors.service.spec.ts`:

```ts
import { PathNeighborsService } from './path-neighbors.service';

/**
 * Todas las interacciones con la BD se reemplazan por mocks jest.fn(): los tests
 * corren sin conexión y NUNCA tocan la BD compartida de producción.
 */

type Repo = { find: jest.Mock; manager?: { query: jest.Mock } };

const repo = (rows: unknown[] = []): Repo => ({
  find: jest.fn().mockResolvedValue(rows),
});

/**
 * Catálogo de 6 nodos practice (niveles 901..906) en una sección, todos
 * habilitados. Cada usuario queda ubicado por su levels_progress.
 */
function makeService(opts: {
  activeIds: number[];
  users: Array<{ id: number; name: string; lastName: string; blocked?: boolean; expires?: Date | null }>;
  levelProgress: Array<{ userId: number; idLevel: number; progress: number }>;
  /** Override para inspeccionar los argumentos de la query de usuarios. */
  usersRepository?: Repo;
}) {
  const query = jest.fn(async (sql: string) => {
    if (sql.includes('GREATEST')) return opts.activeIds.map((id) => ({ id }));
    if (sql.includes("type_use = 'reading'")) return [];
    return [];
  });

  const nodes = [901, 902, 903, 904, 905, 906].map((refId, i) => ({
    id: 100 + i,
    sectionId: 10,
    type: 'practice' as const,
    position: i,
    refId,
  }));

  const pathNodeRepository = { ...repo(nodes), manager: { query } };

  const service = new PathNeighborsService(
    repo([{ id: 1, sections: [{ id: 10 }] }]) as never, // difficulty
    repo([901, 902, 903, 904, 905, 906].map((id) => ({ id }))) as never, // levels
    repo(opts.levelProgress) as never, // levels_progress
    repo([]) as never, // node_progress
    pathNodeRepository as never, // path_nodes
    repo([]) as never, // section_progress
    (opts.usersRepository ??
      repo(
        opts.users.map((u) => ({ blocked: false, expires: null, ...u })),
      )) as never, // users
  );

  return { service, query };
}

describe('PathNeighborsService.getNeighbors()', () => {
  it('rechaza sin usuario autenticado', async () => {
    const { service } = makeService({ activeIds: [], users: [], levelProgress: [] });
    await expect(service.getNeighbors({ id: 0 })).rejects.toThrow('Unauthorized');
  });

  it('devuelve ambos null cuando nadie jugó en la ventana de actividad', async () => {
    const { service } = makeService({ activeIds: [], users: [], levelProgress: [] });
    await expect(service.getNeighbors({ id: 1 })).resolves.toEqual({
      ahead: null,
      behind: null,
    });
  });

  it('devuelve el vecino de arriba y el de abajo con su distancia', async () => {
    // yo (1) en el nodo índice 2; Sofía (2) en el 3; Diego (3) en el 0.
    const { service } = makeService({
      activeIds: [1, 2, 3],
      users: [
        { id: 1, name: 'Yo', lastName: 'Test' },
        { id: 2, name: 'Sofía', lastName: 'González' },
        { id: 3, name: 'Diego', lastName: 'Muñoz' },
      ],
      levelProgress: [
        { userId: 1, idLevel: 901, progress: 100 },
        { userId: 1, idLevel: 902, progress: 100 },
        { userId: 2, idLevel: 901, progress: 100 },
        { userId: 2, idLevel: 902, progress: 100 },
        { userId: 2, idLevel: 903, progress: 100 },
      ],
    });

    const result = await service.getNeighbors({ id: 1 });
    expect(result.ahead).toEqual({
      id: 2,
      name: 'Sofía',
      lastName: 'G',
      nodeId: 103,
      distance: 1,
    });
    expect(result.behind).toEqual({
      id: 3,
      name: 'Diego',
      lastName: 'M',
      nodeId: 100,
      distance: 2,
    });
  });

  it('delega el filtro de bloqueados a la query', async () => {
    // El mock de find() ignora el where, así que esto se verifica por el
    // argumento y no por el resultado: lo que importa es que la condición
    // llegue a la BD.
    const users = { find: jest.fn().mockResolvedValue([]) };
    const { service } = makeService({
      activeIds: [1, 2],
      users: [{ id: 1, name: 'Yo', lastName: 'Test' }],
      levelProgress: [],
      usersRepository: users,
    });
    await service.getNeighbors({ id: 1 });
    expect(users.find).toHaveBeenCalledWith({
      where: { id: expect.anything(), blocked: false },
    });
  });

  it('excluye en memoria a quien tiene el acceso vencido', async () => {
    // yo (1) en el índice 0; el vencido (2) estaría en el 1 y sería mi vecino
    // de arriba si no se filtrara.
    const { service } = makeService({
      activeIds: [1, 2],
      users: [
        { id: 1, name: 'Yo', lastName: 'Test' },
        {
          id: 2,
          name: 'Vencido',
          lastName: 'Y',
          expires: new Date('2020-01-01'),
        },
      ],
      levelProgress: [{ userId: 2, idLevel: 901, progress: 100 }],
    });
    await expect(service.getNeighbors({ id: 1 })).resolves.toEqual({
      ahead: null,
      behind: null,
    });
  });

  it('filtra la actividad por la ventana de días parametrizada', async () => {
    const { service, query } = makeService({
      activeIds: [1],
      users: [{ id: 1, name: 'Yo', lastName: 'Test' }],
      levelProgress: [],
    });
    await service.getNeighbors({ id: 1 });
    const activity = query.mock.calls.find((c) => String(c[0]).includes('GREATEST'));
    expect(activity).toBeDefined();
    expect(activity?.[1]).toEqual([7]);
  });
});
```

- [ ] **Step 3: Correr el test para verificar que falla**

```bash
source ~/.nvm/nvm.sh
cd /home/endurance/Projects/Endurance/dots/dots-backend
npx jest src/modules/path/path-neighbors.service.spec.ts
```

Esperado: FAIL — `Cannot find module './path-neighbors.service'`.

- [ ] **Step 4: Escribir la implementación**

Crear `dots-backend/src/modules/path/path-neighbors.service.ts`:

```ts
import { HttpException, Injectable } from '@nestjs/common';
import { In } from 'typeorm';

import { DifficultyRepository } from 'src/common/repository/difficulty.repository';
import { LevelsProgressRepository } from 'src/common/repository/levels_progress.repository';
import { LevelsRepository } from 'src/common/repository/levels.repository';
import { NodeProgressRepository } from 'src/common/repository/node_progress.repository';
import { PathNodeRepository } from 'src/common/repository/path_node.repository';
import { SectionProgressRepository } from 'src/common/repository/section_progress.repository';
import { UsersRepository } from 'src/common/repository/users.repository';
import { isAccessExpired } from '../invitations/invitations.util';
import {
  buildWalkCatalog,
  findCurrentNodeId,
  nodeProgressFor,
  type WalkNode,
  type WalkProgress,
} from './path-walk';
import {
  selectNeighbors,
  type Placed,
  type Ranked,
} from './neighbors-select';
import { NeighborDto, NeighborsResponseDto } from './neighbors.dto';

/**
 * Ventana de actividad reciente. Filtra fantasmas: competir contra alguien que
 * abandonó hace dos meses no motiva.
 */
export const NEIGHBOR_ACTIVITY_DAYS = 7;

const EMPTY: NeighborsResponseDto = { ahead: null, behind: null };

@Injectable()
export class PathNeighborsService {
  constructor(
    private readonly difficultyRepository: DifficultyRepository,
    private readonly levelsRepository: LevelsRepository,
    private readonly levelsProgressRepository: LevelsProgressRepository,
    private readonly nodeProgressRepository: NodeProgressRepository,
    private readonly pathNodeRepository: PathNodeRepository,
    private readonly sectionProgressRepository: SectionProgressRepository,
    private readonly usersRepository: UsersRepository,
  ) {}

  public async getNeighbors(user: {
    id: number;
  }): Promise<NeighborsResponseDto> {
    const userId = user?.id;
    if (!userId || Number.isNaN(userId)) {
      throw new HttpException('Unauthorized', 401);
    }
    try {
      const candidates = await this.candidates(userId);
      if (candidates.length === 0) return EMPTY;

      const ids = candidates.map((c) => c.id);
      if (!ids.includes(userId)) ids.push(userId);

      const { catalog, placed } = await this.place(ids);
      const me = placed.get(userId);
      if (!me) return EMPTY;

      const picked = selectNeighbors(me, [...placed.values()]);
      const byId = new Map(candidates.map((c) => [c.id, c]));

      return {
        ahead: this.toDto(picked.ahead, catalog, byId),
        behind: this.toDto(picked.behind, catalog, byId),
      };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      console.error('getNeighbors error', error);
      throw new HttpException('Error fetching neighbors', 500);
    }
  }

  /**
   * Usuarios que pueden aparecer como vecinos: activos en la ventana, no
   * bloqueados y sin acceso vencido. Incluye a quien consulta (se descarta
   * después, en selectNeighbors).
   */
  private async candidates(
    userId: number,
  ): Promise<Array<{ id: number; name: string; lastName: string }>> {
    const activeRows: Array<{ id: number }> =
      await this.pathNodeRepository.manager.query(
        `SELECT DISTINCT du.id_user AS id
           FROM dots.daily_use du
          WHERE GREATEST(du.updated_at, du.created_at)
                >= NOW() - make_interval(days => $1::int)`,
        [NEIGHBOR_ACTIVITY_DAYS],
      );
    const activeIds = activeRows.map((r) => Number(r.id));
    if (activeIds.length === 0) return [];

    const users = await this.usersRepository.find({
      where: { id: In(activeIds), blocked: false },
    });
    const now = new Date();
    return users
      .filter((u) => !isAccessExpired(u.expires, now))
      .map((u) => ({
        id: u.id,
        name: u.name ?? '',
        lastName: u.lastName ?? '',
      }));
  }

  /** Ubica a cada usuario en el catálogo global. */
  private async place(
    userIds: number[],
  ): Promise<{ catalog: WalkNode[]; placed: Map<number, Placed> }> {
    const [
      difficulties,
      nodes,
      levels,
      levelsProgress,
      nodeProgress,
      sectionProgress,
      readingRows,
    ] = await Promise.all([
      this.difficultyRepository.find({
        where: { enabled: true },
        relations: ['sections'],
        order: { id: 'ASC', sections: { id: 'ASC' } },
      }),
      this.pathNodeRepository.find({
        where: { enabled: true },
        order: { sectionId: 'ASC', position: 'ASC' },
      }),
      this.levelsRepository.find({ where: { enabled: true } }),
      this.levelsProgressRepository.find({ where: { userId: In(userIds) } }),
      this.nodeProgressRepository.find({ where: { userId: In(userIds) } }),
      this.sectionProgressRepository.find({ where: { userId: In(userIds) } }),
      this.pathNodeRepository.manager.query(
        `SELECT DISTINCT id_user, id_reading FROM dots.daily_use
          WHERE id_user = ANY($1) AND type_use = 'reading'
            AND id_reading IS NOT NULL`,
        [userIds],
      ) as Promise<Array<{ id_user: number; id_reading: number }>>,
    ]);

    const nodesBySection = new Map<number, typeof nodes>();
    for (const node of nodes) {
      const list = nodesBySection.get(node.sectionId) ?? [];
      list.push(node);
      nodesBySection.set(node.sectionId, list);
    }

    // Mismo orden y mismo filtro que PathService.getPath(): si divergen, los
    // índices se desplazan y la distancia entre vecinos deja de cuadrar.
    const catalog = buildWalkCatalog(
      difficulties,
      nodesBySection,
      new Set(levels.map((l) => l.id)),
    );
    const indexByNodeId = new Map(catalog.map((n, i) => [n.nodeId, i]));

    const progressByUser = new Map<number, WalkProgress>();
    const walkFor = (id: number): WalkProgress => {
      let walk = progressByUser.get(id);
      if (!walk) {
        walk = {
          levelProgressById: new Map(),
          nodeProgressById: new Map(),
          skippedSections: new Set(),
          completedReadings: new Set(),
        };
        progressByUser.set(id, walk);
      }
      return walk;
    };
    for (const id of userIds) walkFor(id);
    for (const lp of levelsProgress) {
      walkFor(lp.userId).levelProgressById.set(lp.idLevel, lp.progress ?? 0);
    }
    for (const np of nodeProgress) {
      walkFor(np.userId).nodeProgressById.set(np.nodeId, np.progress ?? 0);
    }
    for (const sp of sectionProgress) {
      if (sp.sectionTest === true) {
        walkFor(sp.userId).skippedSections.add(sp.sectionId);
      }
    }
    for (const row of readingRows) {
      walkFor(Number(row.id_user)).completedReadings.add(Number(row.id_reading));
    }

    const placed = new Map<number, Placed>();
    for (const id of userIds) {
      const walk = walkFor(id);
      const nodeId = findCurrentNodeId(catalog, walk);
      if (nodeId == null) continue; // camino completo: fuera del conjunto
      const index = indexByNodeId.get(nodeId);
      if (index == null) continue;
      const node = catalog[index];
      placed.set(id, {
        userId: id,
        index,
        nodeProgress: nodeProgressFor(
          node,
          walk,
          walk.skippedSections.has(node.sectionId),
        ),
      });
    }

    return { catalog, placed };
  }

  private toDto(
    ranked: Ranked | null,
    catalog: WalkNode[],
    byId: Map<number, { id: number; name: string; lastName: string }>,
  ): NeighborDto | null {
    if (!ranked) return null;
    const person = byId.get(ranked.userId);
    const node = catalog[ranked.index];
    if (!person || !node) return null;
    return {
      id: person.id,
      name: person.name,
      // Inicial del apellido, igual que el leaderboard.
      lastName: person.lastName ? person.lastName.trim().charAt(0) : '',
      nodeId: node.nodeId,
      distance: ranked.distance,
    };
  }
}
```

- [ ] **Step 5: Correr el test para verificar que pasa**

```bash
source ~/.nvm/nvm.sh
cd /home/endurance/Projects/Endurance/dots/dots-backend
npx jest src/modules/path/path-neighbors.service.spec.ts
```

Esperado: PASS, 6 tests.

- [ ] **Step 6: Commit**

```bash
cd /home/endurance/Projects/Endurance/dots/dots-backend
git add src/modules/path/neighbors.dto.ts src/modules/path/path-neighbors.service.ts src/modules/path/path-neighbors.service.spec.ts
git commit -m "feat(camino): servicio de vecinos activos

Ubica a cada usuario activo en los ultimos 7 dias usando el mismo recorrido
que GET /path, y devuelve los dos vecinos inmediatos. Excluye bloqueados,
accesos vencidos y a quien completo el camino entero.

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 5: Exponer `GET /path/neighbors`

**Files:**
- Modify: `dots-backend/src/modules/path/path.controller.ts`
- Modify: `dots-backend/src/modules/path/path.module.ts:92-123` (array `providers`)

**Interfaces:**
- Consumes: `PathNeighborsService` y `NeighborsResponseDto` (Task 4).
- Produces: ruta HTTP `GET /path/neighbors`, autenticada.

**Cuidado con el orden de rutas:** `neighbors` es un segmento literal y `@Get('nodes/:id')` ya existe; no colisionan. Pero declara `@Get('neighbors')` **antes** de cualquier ruta con parámetro de primer nivel si alguien añade una en el futuro.

- [ ] **Step 1: Añadir el import y la ruta al controller**

En `dots-backend/src/modules/path/path.controller.ts`, añadir a los imports:

```ts
import { PathNeighborsService } from './path-neighbors.service';
import { NeighborsResponseDto } from './neighbors.dto';
```

Añadir al constructor un parámetro más:

```ts
    private readonly pathNeighborsService: PathNeighborsService,
```

Y añadir el handler inmediatamente después de `getPath()`:

```ts
  @Get('neighbors')
  @UseGuards(JwtAuthGuard)
  async getNeighbors(
    @CurrentUser() user: AuthUser,
  ): Promise<NeighborsResponseDto> {
    return this.pathNeighborsService.getNeighbors(user);
  }
```

- [ ] **Step 2: Registrar el servicio en el módulo**

En `dots-backend/src/modules/path/path.module.ts`, añadir a `providers`, justo después de `PathService`:

```ts
    PathNeighborsService,
```

Y el import correspondiente junto a los otros del módulo:

```ts
import { PathNeighborsService } from './path-neighbors.service';
```

No hace falta tocar `TypeOrmModule.forFeature`: todas las entities que usa el servicio (`Difficulty`, `Levels`, `LevelsProgress`, `NodeProgress`, `PathNode`, `SectionProgress`, `Users`) ya están registradas, y sus repositorios ya están en `providers`.

- [ ] **Step 3: Correr suite completa y build**

```bash
source ~/.nvm/nvm.sh
cd /home/endurance/Projects/Endurance/dots/dots-backend
npm test && npm run build
```

Esperado: toda la suite verde, build limpio.

- [ ] **Step 4: Probar el endpoint contra el backend corriendo**

El backend suele estar en `:4000` con watcher. Si no lo está: `npm run start:dev`.

```bash
curl -s -i http://localhost:4000/path/neighbors | head -3
```

Esperado: `HTTP/1.1 401 Unauthorized` — confirma que el guard está puesto. **No** intentes autenticarte con curl a mano; la verificación con sesión real va en el Task 7 desde el navegador.

- [ ] **Step 5: Commit**

```bash
cd /home/endurance/Projects/Endurance/dots/dots-backend
git add src/modules/path/path.controller.ts src/modules/path/path.module.ts
git commit -m "feat(camino): ruta GET /path/neighbors

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 6: Frontend — tipos, fetcher y arreglo de `normalizeCurrent`

**Files:**
- Modify: `dots-webapp/types/path.types.ts`
- Modify: `dots-webapp/services/levels.service.ts`
- Modify: `dots-webapp/components/path/path-container.tsx`

**Interfaces:**
- Consumes: `GET /path/neighbors` (Task 5).
- Produces: `type PathPeer`, `type PathNeighborsResponse` en `types/path.types.ts`; `getPathNeighborsService(): Promise<PathNeighborsResponse>` en `services/levels.service.ts`; estado `peersByNodeId: Record<number, PathPeer[]>` dentro de `PathContainer`.

**Las dos cosas de este task son independientes pero van juntas** porque ambas tocan `path-container.tsx`, y separarlas obligaría a dos rondas de conflictos en el mismo archivo.

- [ ] **Step 1: Añadir los tipos**

Al final de `dots-webapp/types/path.types.ts`:

```ts
/** Un compañero ubicado en el camino (GET /path/neighbors). */
export type PathPeer = {
  id: number;
  name: string;
  /** Inicial del apellido, ya recortada por el backend. */
  lastName: string;
  nodeId: number;
  /** Nodos de separación respecto a ti. 0 = mismo nodo. */
  distance: number;
};

export type PathNeighborsResponse = {
  ahead: PathPeer | null;
  behind: PathPeer | null;
};
```

- [ ] **Step 2: Añadir el fetcher**

En `dots-webapp/services/levels.service.ts`, añadir el import del tipo y la función, y exportarla:

```ts
import api from "../lib/api-client";
import type {
  PathNeighborsResponse,
  PathResponse,
} from "@/types/path.types";

async function getLevelsService() {
  try {
    const response = await api.get("/levels");
    return response.data;
  } catch (error) {
    console.error("Levels fetch error:", error);
    throw error;
  }
}

async function getPathService(): Promise<PathResponse> {
  const response = await api.get("/path");
  return response.data;
}

/**
 * Compañeros más cercanos en el camino. Es un adorno: quien lo consuma debe
 * degradar en silencio si falla (ver PathContainer).
 */
async function getPathNeighborsService(): Promise<PathNeighborsResponse> {
  const response = await api.get("/path/neighbors");
  return response.data;
}

export { getLevelsService, getPathService, getPathNeighborsService };
```

- [ ] **Step 3: Restringir `normalizeCurrent` al fallback del adapter**

En `dots-webapp/components/path/path-container.tsx`, cambiar el comentario de `normalizeCurrent` (línea 14) por:

```ts
/**
 * Marca exactamente UN nodo actual: el primero desbloqueado y sin completar.
 *
 * SOLO para el fallback de /levels + adapter, que no trae los flags calculados.
 * Cuando GET /path responde, sus flags se respetan tal cual: el backend ya usa
 * la regla buena (path-walk.ts), que además excluye las lecturas — esta versión
 * no, y por eso llegó a dejar que un nodo `reading` se robara la estrella.
 */
```

Y en el `useEffect` de carga (líneas 46-49), quitar la normalización del camino que sí viene del backend:

```ts
      try {
        const data = await getPathService();
        // El backend ya marca exactamente un `current` con la regla compartida.
        if (mounted) setPath(data);
      } catch {
```

La rama del fallback (línea 56) **se queda igual**, con `normalizeCurrent`.

- [ ] **Step 4: Añadir el fetch de vecinos con degradación silenciosa**

En el mismo archivo, añadir `getPathNeighborsService` al import de servicios y `PathPeer` al import de tipos. Después declarar el estado junto a los demás (línea 39-41):

```ts
  const [peersByNodeId, setPeersByNodeId] = useState<
    Record<number, PathPeer[]>
  >({});
```

Y añadir este efecto **después** del efecto de carga del camino:

```ts
  // Vecinos en el camino. Adorno deliberado: si falla, se pone lento o no está
  // desplegado, el camino se ve exactamente como hoy. Sin loadError, sin botón
  // de Reintentar y sin ruido para el alumno (excepción consciente a la regla 5
  // del CLAUDE.md, que aplica a fetches que bloquean el juego).
  useEffect(() => {
    if (isBootstrapping) return;
    let mounted = true;
    (async () => {
      try {
        const data = await getPathNeighborsService();
        if (!mounted) return;
        const map: Record<number, PathPeer[]> = {};
        for (const peer of [data.ahead, data.behind]) {
          if (!peer) continue;
          (map[peer.nodeId] ??= []).push(peer);
        }
        setPeersByNodeId(map);
      } catch {
        // Silencio intencional.
      }
    })();
    return () => {
      mounted = false;
    };
  }, [isBootstrapping]);
```

- [ ] **Step 5: Pasar `peersByNodeId` al render**

Cambiar el `map` de dificultades (líneas 115-117) por:

```ts
        {path.difficulties.map((difficulty) => (
          <PathDifficulty
            key={difficulty.id}
            difficulty={difficulty}
            peersByNodeId={peersByNodeId}
          />
        ))}
```

Esto **rompe el type-check hasta el Task 7**, que es donde `PathDifficulty` acepta la prop. Es esperado.

- [ ] **Step 6: Verificar que lint y build fallan solo por la prop pendiente**

```bash
source ~/.nvm/nvm.sh
cd /home/endurance/Projects/Endurance/dots/dots-webapp
npx tsc --noEmit
```

Esperado: un único error, sobre `peersByNodeId` no existiendo en las props de `PathDifficulty`. Cualquier otro error hay que arreglarlo aquí antes de seguir.

- [ ] **Step 7: Sin commit todavía**

Este task deja el árbol sin compilar a propósito. Se commitea junto con el Task 7.

---

## Task 7: Frontend — `PathPeer` y su cableado

**Files:**
- Create: `dots-webapp/lib/peer-colors.ts`
- Create: `dots-webapp/components/path/path-peer.tsx`
- Modify: `dots-webapp/components/path/path-difficulty.tsx`
- Modify: `dots-webapp/components/path/path-section.tsx`

**Interfaces:**
- Consumes: `PathPeer` de `@/types/path.types` y `peersByNodeId` de `PathContainer` (Task 6).
- Produces: `peerColor(userId: number): string` en `lib/peer-colors.ts`; componente `PathPeer` con props `{ peer: PathPeer; side: "left" | "right"; stackIndex?: number }`.

- [ ] **Step 1: Crear la paleta**

Crear `dots-webapp/lib/peer-colors.ts`:

```ts
/**
 * Color estable por usuario para los vecinos del camino: el mismo id siempre
 * recibe el mismo color, así una persona es reconocible entre sesiones.
 *
 * Matices bien separados para que dos vecinos no se confundan, y saturados lo
 * suficiente para sobrevivir el color-mix contra --surface en modo oscuro.
 */
const PEER_COLORS = [
  "#e0409a", // rosa dots
  "#3b82f6", // azul
  "#22c55e", // verde
  "#f59e0b", // ámbar
  "#8b5cf6", // violeta
  "#ef4444", // rojo
  "#14b8a6", // turquesa
  "#f97316", // naranja
] as const;

export function peerColor(userId: number): string {
  return PEER_COLORS[Math.abs(userId) % PEER_COLORS.length];
}
```

- [ ] **Step 2: Crear el componente**

Crear `dots-webapp/components/path/path-peer.tsx`:

```tsx
"use client";

import React from "react";
import { peerColor } from "@/lib/peer-colors";
import type { PathPeer as PathPeerType } from "@/types/path.types";

interface PathPeerProps {
  peer: PathPeerType;
  side: "left" | "right";
  /** Desplazamiento vertical para apilar varios vecinos en el mismo nodo. */
  stackIndex?: number;
}

const CIRCLE = 34;
const SLOT_H = CIRCLE + 22;

/**
 * Un compañero posado al costado de su nodo. Mismo anclaje que DotyMarker:
 * se pega al borde del wrapper de 150px, hacia el interior del zigzag.
 *
 * RN-safe: el nombre va SIEMPRE visible (nada de hover como única señal) y no
 * hay animación fuera de transform/opacity. `pointer-events-none` porque hoy es
 * informativo; si más adelante se puede tocar para retar, se quita.
 */
export default function PathPeer({
  peer,
  side,
  stackIndex = 0,
}: PathPeerProps) {
  const anchor: React.CSSProperties =
    side === "right" ? { left: "100%" } : { right: "100%" };
  const hex = peerColor(peer.id);
  const initial = (peer.name?.trim()?.[0] ?? "?").toUpperCase();
  const label = peer.lastName ? `${peer.name} ${peer.lastName}.` : peer.name;

  return (
    <div
      className="absolute flex flex-col items-center gap-0.5 pointer-events-none select-none"
      style={{
        top: 18 + stackIndex * SLOT_H,
        width: 72,
        zIndex: 20,
        ...anchor,
      }}
    >
      <div
        className="flex items-center justify-center rounded-full font-display font-black"
        style={{
          width: CIRCLE,
          height: CIRCLE,
          fontSize: 15,
          lineHeight: 1,
          background: `color-mix(in srgb, ${hex} 22%, var(--surface))`,
          border: `2.5px solid ${hex}`,
          color: `color-mix(in srgb, ${hex} 55%, var(--foreground))`,
          boxShadow: `0 2px 8px ${hex}44`,
        }}
      >
        {initial}
      </div>
      <span className="w-full truncate text-center text-[10px] font-extrabold leading-tight text-(--muted)">
        {label}
      </span>
    </div>
  );
}
```

- [ ] **Step 3: Pasar la prop por `PathDifficulty`**

En `dots-webapp/components/path/path-difficulty.tsx`, añadir al import de tipos `PathPeer`, ampliar la interfaz de props:

```tsx
interface PathDifficultyProps {
  difficulty: PathDifficultyType;
  peersByNodeId: Record<number, PathPeer[]>;
}
```

Cambiar la firma:

```tsx
export default function PathDifficulty({
  difficulty,
  peersByNodeId,
}: PathDifficultyProps) {
```

Y pasarla a cada sección (líneas 185-189):

```tsx
              <PathSection
                key={section.id}
                section={section}
                accentHex={DIFFICULTY_COLOR_HEX[colorName] ?? accentHex}
                peersByNodeId={peersByNodeId}
              />
```

- [ ] **Step 4: Renderizar en `PathSection`**

En `dots-webapp/components/path/path-section.tsx`, añadir el import:

```tsx
import PathPeer from "./path-peer";
import type {
  PathPeer as PathPeerType,
  PathSection as PathSectionType,
} from "@/types/path.types";
```

Ampliar las props:

```tsx
interface PathSectionProps {
  section: PathSectionType;
  accentHex: string;
  peersByNodeId: Record<number, PathPeerType[]>;
}
```

Cambiar la firma:

```tsx
export default function PathSection({
  section,
  accentHex,
  peersByNodeId,
}: PathSectionProps) {
```

Y añadir el render dentro del wrapper de cada nodo, justo después del bloque de `DotyMarker` (línea 164):

```tsx
              {(peersByNodeId[p.node.id] ?? []).map((peer, peerIndex) => (
                <PathPeer
                  key={peer.id}
                  peer={peer}
                  // DotyMarker ocupa el lado interior del nodo actual, así que
                  // ahí el vecino va al opuesto. En el resto de nodos usa la
                  // misma regla "hacia adentro" del zigzag.
                  side={
                    p.node.current
                      ? p.xPct >= 50
                        ? "right"
                        : "left"
                      : p.xPct >= 50
                        ? "left"
                        : "right"
                  }
                  stackIndex={peerIndex}
                />
              ))}
```

- [ ] **Step 5: Verificar lint y build**

```bash
source ~/.nvm/nvm.sh
cd /home/endurance/Projects/Endurance/dots/dots-webapp
npm run lint && npx next build
```

Esperado: lint sin errores (ojo con las reglas del compiler de React sobre el efecto nuevo del Task 6) y build completo con type-check limpio.

- [ ] **Step 6: Commit**

```bash
cd /home/endurance/Projects/Endurance/dots/dots-webapp
git add types/path.types.ts services/levels.service.ts lib/peer-colors.ts components/path/
git commit -m "feat(camino): vecinos activos al costado del nodo

Muestra a los dos companeros mas cercanos (uno delante, uno detras) con un
circulo de inicial anclado como DotyMarker. Degrada en silencio si el
endpoint falla.

Restringe ademas normalizeCurrent() al fallback de /levels: cuando GET /path
responde se respetan sus flags, que ya excluyen las lecturas del nodo actual.

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 8: Verificación visual y cierre

**Files:** ninguno nuevo; posibles ajustes de estilo en `dots-webapp/components/path/path-peer.tsx`.

**Objetivo:** comprobar los tres estados visuales y que el círculo cabe en móvil. Nada de esto se puede dar por bueno leyendo el código.

- [ ] **Step 1: Arrancar el dev server y abrir el camino**

```bash
source ~/.nvm/nvm.sh
cd /home/endurance/Projects/Endurance/dots/dots-webapp
npm run dev
```

Con el backend en `:4000`, entra con una cuenta real y navega a `/levels`.

- [ ] **Step 2: Confirmar que el endpoint responde y qué trae**

Revisa la pestaña de red (o `preview_network`) buscando `GET /path/neighbors`. Anota el cuerpo. Con ~28 usuarios y filtro de 7 días es perfectamente posible que devuelva `{ ahead: null, behind: null }` — eso **no** es un fallo, es el riesgo #2 del spec. Si pasa, sigue al Step 3 con datos simulados.

- [ ] **Step 3: Forzar los tres estados con una respuesta simulada**

Para ver los casos borde sin escribir en la BD de producción, sustituye temporalmente el cuerpo de `getPathNeighborsService` por datos fijos. Usa el `nodeId` real de tu nodo actual y de un vecino, sacados del `GET /path` de tu sesión:

```ts
async function getPathNeighborsService(): Promise<PathNeighborsResponse> {
  // TEMPORAL solo para verificación visual — revertir antes de commitear.
  return {
    ahead: { id: 7, name: "Sofía", lastName: "G", nodeId: 0 /* pon aquí un nodeId real */, distance: 1 },
    behind: { id: 12, name: "Diego", lastName: "M", nodeId: 0 /* otro nodeId real */, distance: 2 },
  };
}
```

Comprueba, en este orden:

1. **Un vecino en un nodo cualquiera** — el círculo aparece al lado correcto (hacia adentro del zigzag) y no tapa el nodo.
2. **Un vecino en tu nodo actual** — usa el `nodeId` del nodo con la estrella. El círculo debe caer al **lado opuesto** de Doty, sin solaparse con la burbuja "¡Sigue aquí!".
3. **Dos vecinos en tu nodo actual** — pon el mismo `nodeId` en `ahead` y `behind`. Deben apilarse verticalmente, sin pisarse.

- [ ] **Step 4: Medir que cabe en móvil**

Redimensiona a 380 px de ancho. Mide con `preview_inspect` (o el inspector) el `boundingClientRect` del `div` de `PathPeer` y del contenedor de la sección (`maxWidth: 520`).

Criterio: el círculo de 34 px debe quedar **completo dentro del viewport**, sin scroll horizontal en el body. Comprueba los tres valores de zigzag: un nodo en `xPct=15`, uno en `50` y uno en `85`.

Si algo se sale, el ajuste es `width: 72` → menor, o `top` → mayor, en `path-peer.tsx`. No toques el anclaje `left/right: 100%`: es lo que hace que funcione igual que `DotyMarker`.

- [ ] **Step 5: Verificar modo oscuro**

Cambia a modo oscuro y confirma que la inicial se lee sobre el fondo `color-mix`. Si un color de la paleta queda ilegible, súbele la mezcla del texto en `path-peer.tsx` (de `55%` a `70%`) — no cambies el hex de la paleta, que también se usa para el borde.

- [ ] **Step 6: Revertir la simulación y verificar de nuevo**

```bash
cd /home/endurance/Projects/Endurance/dots/dots-webapp
git diff services/levels.service.ts
git checkout -- services/levels.service.ts
```

Esperado: el diff muestra solo el mock temporal, y tras revertir el fetcher vuelve a llamar al endpoint real.

- [ ] **Step 7: Comprobar la degradación**

Apaga el backend (o deja `:4000` caído) y recarga `/levels`. Esperado: el camino se renderiza normal, sin banner de error y sin botón de Reintentar por culpa de los vecinos. En consola puede aparecer el warning del fallback de `/path` — ese es el comportamiento previo, no de esta feature.

- [ ] **Step 8: Verificación final y commit de ajustes**

```bash
source ~/.nvm/nvm.sh
cd /home/endurance/Projects/Endurance/dots/dots-webapp
npm run lint && npx next build
cd /home/endurance/Projects/Endurance/dots/dots-backend
npm test && npm run build
```

Esperado: los cuatro comandos en verde. Si hubo ajustes de estilo:

```bash
cd /home/endurance/Projects/Endurance/dots/dots-webapp
git add components/path/path-peer.tsx
git commit -m "fix(camino): ajuste de encaje del vecino en movil

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Notas para el revisor

- **El cambio de mayor riesgo es el Task 2**, porque toca la pantalla más crítica de la app. Su diff debería ser puramente mecánico: mismo recorrido, con `nodeProgressFor` y `currentNodeId` en lugar de lógica inline. Si el diff hace algo más que eso, sospecha.
- **El Task 2 arregla un bug preexistente** (un nodo `reading` podía marcarse como actual). Es un cambio de comportamiento visible: si alguien tenía la estrella sobre una lectura, se moverá al siguiente nodo obligatorio. Es lo correcto, pero conviene saberlo antes de que alguien lo reporte como regresión.
- **Ningún task aplica DDL.** Los dos índices que faltan (`daily_use.id_user`, `levels_progress.id_user`) están fuera de este plan a propósito; ver la sección *Migraciones* del spec.
- **No hay caché.** Con ~28 usuarios, `place()` corre 6 queries por request a `/path/neighbors`. Si eso deja de ser aceptable, el primer paso es cachear el catálogo (que es global y cambia poco), no el resultado por usuario.

