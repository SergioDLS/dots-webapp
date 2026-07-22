# F3a — Módulos nuevos (letras + números), solo código · Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recomendado) o superpowers:executing-plans. Steps con checkbox (`- [ ]`).

**Goal:** Que existan los tipos de nodo `letters` y `numbers` end-to-end (datos → resolver → admin → lección), modelados como **packs+items** igual que `vocab`, **sin mutar contenido de producción** (solo DDL aditivo: 4 tablas vacías). El contenido real y el re-encaje de la sección 1 son F3b.

**Architecture:** Espejo 1:1 del stack de `vocab` construido en F2. Backend: entidades/repos nuevos + CRUD admin (`admin.*`) + resolver (`NodeContentService`). Frontend: uniones de tipo + fetchers + 2 managers en `/admin/foundations` + editor de camino + 2 páginas `lesson/*` + upgrade de `lesson/vocab` para mostrar imagen. Media (generación ElevenLabs) se difiere a F-media; audio/img se cargan manualmente vía `/admin/upload`.

**Tech Stack:** NestJS 11 + TypeORM (back), Next.js 16 app router + React 19 + Tailwind 4 (front). Sin test runner de componentes → verificación por tarea: `npx tsc --noEmit` + boot/rutas (back), `npm run lint` + `npx next build` (front), preview manual del admin/lección.

## Global Constraints

- **Espejar el patrón de `vocab`** ya existente (F2): `vocab_pack.entity.ts`/`vocab_item.entity.ts`, `vocab_*.repository.ts`, DTOs `CreateVocabPackDto`/`…ItemDto` en `admin.dto.ts`, métodos `listVocabPacks…deleteVocabItem` en `admin.service.ts`, rutas `/admin/vocab-*` en `admin.controller.ts`, `vocabContent()` en `node-content.service.ts`, `VocabNodeContentDto` en `path.dto.ts`, `vocab-manager.tsx` en el front.
- **PK autogenerada** (`@PrimaryGeneratedColumn`) en las 4 tablas nuevas; **no** hace falta el truco `max(id)+1`.
- **Sin `ON DELETE CASCADE`** en los FKs (se borra el hijo antes del padre en el service, como vocab).
- **`number_items.word` y `…value`, `letter_items.letter` son NOT NULL**; `name`/`sound_ipa`/`example_*`/`img`/`audio` son nullable. Al editar un item **no nullear `audio`/`img`** salvo que se pida (como vocab).
- **Audio/img = subida manual** (`/admin/upload`, como el modal de words); NADA de ElevenLabs aquí.
- **Front:** navegación con `router.push` (nunca `window.location`); `useSearchParams` **siempre** dentro de `<Suspense>`; lint del compiler de React (sin `setState` síncrono en cuerpo de `useEffect` — cargar con `.then(setState)`, refrescar por funciones llamadas desde handlers; sin efectos colaterales en updaters de `setState`).
- **RN-safe en las lecciones nuevas:** solo tap/pointer (`onPointerUp`/`onClick`); nada de teclado como input, drag HTML5, canvas, `<input>` de texto para jugar, `<select>` para jugar, ni hover como única señal. Animación solo `transform`/`opacity`. Las lecciones **degradan sin media** (si no hay audio/img, usan texto/nombre/ejemplo).
- **Rama:** `redesign/contenido-camino` (ambos repos). BD PostgreSQL **compartida de producción**: el único write a prod aquí es el DDL aditivo del Task 1, con `--apply` explícito.

---

## F3a-back — Backend

### Task 1: Migración DDL aditiva (crea las 4 tablas vacías)

**Files:**
- Create: `dots-backend/scripts/migrate-modules-letters-numbers.js`

**Interfaces:**
- Produces: tablas `dots.letter_packs`, `dots.letter_items`, `dots.number_packs`, `dots.number_items` (vacías).

- [ ] **Step 1:** Leer `dots-backend/scripts/migrate-learning-path.js` para copiar el harness: carga de `.env`, `new Client({ ssl:{rejectUnauthorized:false} })`, flag `--apply` (sin él = dry-run que solo imprime el SQL), `CREATE TABLE IF NOT EXISTS` idempotente en el schema `dots`, y el resumen final. **No** requiere backup (es aditivo; el rollback es `DROP TABLE`).
- [ ] **Step 2:** Definir el SQL (ejecutar dentro de una transacción cuando `--apply`):

```sql
CREATE TABLE IF NOT EXISTS dots.letter_packs (
  id       SERIAL PRIMARY KEY,
  key      VARCHAR(80) UNIQUE,
  title    VARCHAR(120) NOT NULL,
  enabled  BOOLEAN NOT NULL DEFAULT TRUE
);
CREATE TABLE IF NOT EXISTS dots.letter_items (
  id               SERIAL PRIMARY KEY,
  pack_id          INT NOT NULL REFERENCES dots.letter_packs(id),
  letter           VARCHAR(8) NOT NULL,
  name             VARCHAR(60),
  sound_ipa        VARCHAR(40),
  example_word     VARCHAR(80),
  example_meaning  VARCHAR(150),
  img              VARCHAR(255),
  audio            VARCHAR(255),
  position         INT NOT NULL DEFAULT 0,
  enabled          BOOLEAN NOT NULL DEFAULT TRUE
);
CREATE TABLE IF NOT EXISTS dots.number_packs (
  id       SERIAL PRIMARY KEY,
  key      VARCHAR(80) UNIQUE,
  title    VARCHAR(120) NOT NULL,
  enabled  BOOLEAN NOT NULL DEFAULT TRUE
);
CREATE TABLE IF NOT EXISTS dots.number_items (
  id        SERIAL PRIMARY KEY,
  pack_id   INT NOT NULL REFERENCES dots.number_packs(id),
  value     INT NOT NULL,
  word      VARCHAR(60) NOT NULL,
  img       VARCHAR(255),
  audio     VARCHAR(255),
  position  INT NOT NULL DEFAULT 0,
  enabled   BOOLEAN NOT NULL DEFAULT TRUE
);
CREATE INDEX IF NOT EXISTS idx_letter_items_pack ON dots.letter_items(pack_id);
CREATE INDEX IF NOT EXISTS idx_number_items_pack ON dots.number_items(pack_id);
```

- [ ] **Step 3:** Agregar script npm en `dots-backend/package.json`: `"migrate:modules": "node scripts/migrate-modules-letters-numbers.js"`.
- [ ] **Step 4 (verificación):** dry-run imprime el SQL sin escribir:
  `bash -lc 'source ~/.nvm/nvm.sh; nvm use 22; cd dots-backend && npm run migrate:modules'` → muestra los `CREATE TABLE` y "dry-run". Luego, **con aprobación**, `npm run migrate:modules -- --apply` y verificar `SELECT` de las 4 tablas (0 filas).
- [ ] **Step 5:** Commit: `feat(migrate): DDL aditivo de letter/number packs+items`.

### Task 2: Entidades + repositorios

**Files:**
- Create: `dots-backend/src/common/entity/letter_pack.entity.ts`, `letter_item.entity.ts`, `number_pack.entity.ts`, `number_item.entity.ts`
- Create: `dots-backend/src/common/repository/letter_pack.repository.ts`, `letter_item.repository.ts`, `number_pack.repository.ts`, `number_item.repository.ts`

**Interfaces:**
- Produces: `LetterPack`, `LetterItem`, `NumberPack`, `NumberItem` + `LetterPackRepository`, `LetterItemRepository`, `NumberPackRepository`, `NumberItemRepository`.

- [ ] **Step 1:** Crear las entidades espejando `vocab_pack.entity.ts` (packs) y `vocab_item.entity.ts` (items). Packs idénticos a `VocabPack` (schema `dots`, `name: 'letter_packs'`/`'number_packs'`, columnas `id`/`key`/`title`/`enabled`, `@OneToMany` a los items). Items:

```ts
// letter_item.entity.ts — campos propios (resto = patrón de VocabItem)
@Column({ name: 'pack_id', type: 'int' }) packId: number;
@ManyToOne(() => LetterPack, (p) => p.items, { nullable: false })
@JoinColumn({ name: 'pack_id' }) pack?: LetterPack;
@Column({ type: 'varchar', length: 8 }) letter: string;
@Column({ type: 'varchar', length: 60, nullable: true }) name?: string | null;
@Column({ name: 'sound_ipa', type: 'varchar', length: 40, nullable: true }) soundIpa?: string | null;
@Column({ name: 'example_word', type: 'varchar', length: 80, nullable: true }) exampleWord?: string | null;
@Column({ name: 'example_meaning', type: 'varchar', length: 150, nullable: true }) exampleMeaning?: string | null;
@Column({ type: 'varchar', length: 255, nullable: true }) img?: string | null;
@Column({ type: 'varchar', length: 255, nullable: true }) audio?: string | null;
@Column({ type: 'int', default: 0 }) position: number;
@Column({ type: 'bool', default: true }) enabled: boolean;
```

```ts
// number_item.entity.ts — campos propios
@Column({ name: 'pack_id', type: 'int' }) packId: number;
@ManyToOne(() => NumberPack, (p) => p.items, { nullable: false })
@JoinColumn({ name: 'pack_id' }) pack?: NumberPack;
@Column({ type: 'int' }) value: number;
@Column({ type: 'varchar', length: 60 }) word: string;
@Column({ type: 'varchar', length: 255, nullable: true }) img?: string | null;
@Column({ type: 'varchar', length: 255, nullable: true }) audio?: string | null;
@Column({ type: 'int', default: 0 }) position: number;
@Column({ type: 'bool', default: true }) enabled: boolean;
```

- [ ] **Step 2:** Crear los 4 repos copiando textualmente `vocab_pack.repository.ts` (cambiando el tipo/import). Patrón: `class XRepository extends Repository<X> { constructor(@InjectRepository(X) private readonly repository: Repository<X>) { super(repository.target, repository.manager, repository.queryRunner); } }`.
- [ ] **Step 3 (verificación):** `npx tsc --noEmit` en `dots-backend` → sin errores (aún nadie las usa; solo compilan). Commit: `feat(entity): letter/number packs+items`.

### Task 3: Registrar en AdminModule + ampliar PathNodeType

**Files:**
- Modify: `dots-backend/src/common/entity/path_node.entity.ts`
- Modify: `dots-backend/src/modules/admin/admin.module.ts`

**Interfaces:**
- Produces: `PathNodeType` incluye `'letters' | 'numbers'`; los 4 repos disponibles para inyección en `AdminModule`.

- [ ] **Step 1:** En `path_node.entity.ts`, ampliar la unión:

```ts
export type PathNodeType =
  | 'practice' | 'pronunciation' | 'grammar' | 'vocab'
  | 'letters' | 'numbers'
  | 'reading' | 'checkpoint';
```
Y actualizar el comentario de `ref_id` (`letters → letter_packs.id · numbers → number_packs.id`).
- [ ] **Step 2:** En `admin.module.ts`, importar las 4 entidades + 4 repos, agregarlas a `TypeOrmModule.forFeature([...])` y a `providers` (orden alfabético, como el resto).
- [ ] **Step 3 (verificación):** `npx tsc --noEmit`. Commit: `feat(admin): PathNodeType letters/numbers + registra repos`.

### Task 4: DTOs de letras/números + PATH_NODE_TYPES

**Files:**
- Modify: `dots-backend/src/modules/admin/admin.dto.ts`

**Interfaces:**
- Produces: `CreateLetterPackDto`/`UpdateLetterPackDto`/`CreateLetterItemDto`/`UpdateLetterItemDto` + los 4 equivalentes de number; `PATH_NODE_TYPES` incluye `'letters','numbers'`.

- [ ] **Step 1:** Packs: copiar `CreateVocabPackDto`/`UpdateVocabPackDto` como `CreateLetterPackDto`/`UpdateLetterPackDto` y `CreateNumberPackDto`/`UpdateNumberPackDto` (idénticos: `key`+`title` en create; `title?`+`enabled?` en update).
- [ ] **Step 2:** Letter item DTOs:

```ts
export class CreateLetterItemDto {
  @IsInt() @Min(1) packId: number;
  @IsString() @IsNotEmpty() letter: string;
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() soundIpa?: string;
  @IsOptional() @IsString() exampleWord?: string;
  @IsOptional() @IsString() exampleMeaning?: string;
  @IsOptional() @IsString() img?: string;
  @IsOptional() @IsInt() @Min(0) position?: number;
}
export class UpdateLetterItemDto {
  @IsOptional() @IsString() @IsNotEmpty() letter?: string;
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() soundIpa?: string;
  @IsOptional() @IsString() exampleWord?: string;
  @IsOptional() @IsString() exampleMeaning?: string;
  @IsOptional() @IsString() img?: string;
  @IsOptional() @IsInt() @Min(0) position?: number;
  @IsOptional() @IsBoolean() enabled?: boolean;
}
```
(audio se maneja por subida manual → va en el body como `img`; si se prefiere, agregar `@IsOptional() @IsString() audio?` a ambos. Incluirlo.)
- [ ] **Step 3:** Number item DTOs:

```ts
export class CreateNumberItemDto {
  @IsInt() @Min(1) packId: number;
  @IsInt() value: number;
  @IsString() @IsNotEmpty() word: string;
  @IsOptional() @IsString() img?: string;
  @IsOptional() @IsString() audio?: string;
  @IsOptional() @IsInt() @Min(0) position?: number;
}
export class UpdateNumberItemDto {
  @IsOptional() @IsInt() value?: number;
  @IsOptional() @IsString() @IsNotEmpty() word?: string;
  @IsOptional() @IsString() img?: string;
  @IsOptional() @IsString() audio?: string;
  @IsOptional() @IsInt() @Min(0) position?: number;
  @IsOptional() @IsBoolean() enabled?: boolean;
}
```
(y agregar `audio?` a los letter item DTOs del Step 2 por simetría.)
- [ ] **Step 4:** Actualizar el array `PATH_NODE_TYPES` (usado por `CreatePathNodeDto`/`UpdatePathNodeDto`): agregar `'letters', 'numbers'`.
- [ ] **Step 5 (verificación):** `npx tsc --noEmit`. Commit: `feat(admin): DTOs de letter/number packs+items`.

### Task 5: Service + rutas admin — Letras

**Files:**
- Modify: `dots-backend/src/modules/admin/admin.service.ts`, `admin.controller.ts`

**Interfaces:**
- Consumes: DTOs del Task 4, repos del Task 2.
- Produces: métodos `listLetterPacks/createLetterPack/updateLetterPack/deleteLetterPack/listLetterItems/createLetterItem/updateLetterItem/deleteLetterItem` + rutas `/admin/letter-packs*`, `/admin/letter-items*`.

- [ ] **Step 1:** En `admin.service.ts`: importar los 2 repos de letras + entidades + DTOs; inyectarlos en el constructor. Agregar una sección "Foundations: letters" **espejando exactamente** la sección `vocab` (métodos `listVocabPacks…deleteVocabItem` + serializers). Diferencias del item: en create/update copiar `letter, name, soundIpa, exampleWord, exampleMeaning, img, audio` (con `?? null`), **sin tocar `audio`/`img` si no vienen** en update; `serializeLetterItem` devuelve todos esos campos con `?? ''`. Borrado del pack: `await this.letterItemRepository.delete({ packId: id })` antes de `remove(pack)`.
- [ ] **Step 2:** En `admin.controller.ts`: importar los 4 DTOs de letras y agregar el bloque de rutas espejando `vocab` (bajo `@UseGuards(AdminGuard)`):
```
GET/POST/PATCH/DELETE  /admin/letter-packs[/:id]
GET  /admin/letter-packs/:id/items
POST/PATCH/DELETE      /admin/letter-items[/:id]
```
- [ ] **Step 3 (verificación):** `npx tsc --noEmit`. Commit: `feat(admin): CRUD de letter packs+items`.

### Task 6: Service + rutas admin — Números

**Files:**
- Modify: `dots-backend/src/modules/admin/admin.service.ts`, `admin.controller.ts`

**Interfaces:**
- Produces: métodos `list/create/update/deleteNumberPack`+`…NumberItem` + rutas `/admin/number-packs*`, `/admin/number-items*`.

- [ ] **Step 1:** Igual que Task 5 para números. Item: copiar `value, word, img, audio`; `word` NOT NULL (requerido en create); `value` requerido. Preservar `audio`/`img` en update.
- [ ] **Step 2:** Rutas `/admin/number-packs*` + `/admin/number-items*` espejando letras.
- [ ] **Step 3 (verificación):** `npx tsc --noEmit`, luego boot y confirmar rutas mapeadas:
  `bash -lc 'source ~/.nvm/nvm.sh; nvm use 22; cd dots-backend && npm run start'` (en background) → el log muestra `Mapped {/admin/letter-packs...}`, `{/admin/number-packs...}`, sin errores de DI; detener el server. Commit: `feat(admin): CRUD de number packs+items`.

### Task 7: Resolver de contenido (`GET /path/nodes/:id`) + itemCount

**Files:**
- Modify: `dots-backend/src/modules/path/node-content.service.ts`, `path.dto.ts`, `path.module.ts`, `path.service.ts`

**Interfaces:**
- Consumes: repos del Task 2, `PathNodeType` del Task 3.
- Produces: `LettersNodeContentDto`, `NumbersNodeContentDto` en la unión `NodeContentDto`; `GET /path/nodes/:id` resuelve `letters`/`numbers`.

- [ ] **Step 1:** En `path.dto.ts` agregar los DTOs y sumarlos a la unión `NodeContentDto`:

```ts
export type LettersNodeContentDto = {
  type: 'letters';
  title: string;
  items: Array<{
    id: number; letter: string; name?: string | null;
    soundIpa?: string | null; exampleWord?: string | null;
    exampleMeaning?: string | null; img?: string | null; audio?: string | null;
  }>;
};
export type NumbersNodeContentDto = {
  type: 'numbers';
  title: string;
  items: Array<{
    id: number; value: number; word: string;
    img?: string | null; audio?: string | null;
  }>;
};
export type NodeContentDto =
  | PracticeNodeContentDto | PronunciationNodeContentDto
  | GrammarNodeContentDto | VocabNodeContentDto
  | LettersNodeContentDto | NumbersNodeContentDto;
```

- [ ] **Step 2:** En `path.module.ts`: registrar los 4 repos nuevos (import + `forFeature` + `providers`) para que `NodeContentService` pueda inyectarlos. (Verificar cómo `path.module` registra los repos de vocab y copiar.)
- [ ] **Step 3:** En `node-content.service.ts`: inyectar `LetterPackRepository`/`LetterItemRepository`/`NumberPackRepository`/`NumberItemRepository`; en el `switch (node.type)` agregar `case 'letters': return this.lettersContent(node);` y `case 'numbers': …`. Implementar `lettersContent`/`numbersContent` espejando `vocabContent`: buscar el pack por `refId` (enabled), traer items enabled ordenados por `position, id`, mapear al shape del DTO. Sin lógica de opciones/quiz (a diferencia de pronunciation/grammar): el drill de reconocimiento lo arma el front con los items.
- [ ] **Step 4:** En `path.service.ts`, método `loadContentMeta` (~línea 274): el mapa `TABLES` está keyed por tipo → `{ unit, item, fk }`. Agregar dos entradas (la query genérica ya cuenta items enabled por `pack_id`):

```ts
letters: { unit: 'letter_packs', item: 'letter_items', fk: 'pack_id' },
numbers: { unit: 'number_packs', item: 'number_items', fk: 'pack_id' },
```
Nada más cambia ahí (el `Promise.all` recorre `Object.keys(TABLES)` y el `dto.itemCount` se asigna por `${type}:${refId}`). Confirmar que el comentario del método menciona los nuevos tipos.
- [ ] **Step 5 (verificación):** `npx tsc --noEmit` + boot (rutas de `/path` mapeadas, sin errores DI). Commit: `feat(path): resolver de nodos letters/numbers + itemCount`.

---

## F3a-front — Frontend

### Task 8: Fetchers + uniones de tipo + NODE_META

**Files:**
- Modify: `dots-webapp/services/admin.service.ts`, `services/lessons.service.ts`, `types/path.types.ts`, `lib/path-node-meta.ts`

**Interfaces:**
- Produces: tipos `AdminLetterPack/Item`, `AdminNumberPack/Item` + sus CRUD fetchers; `NodeContent` incluye `LettersContent`/`NumbersContent`; `PathNodeType` (front) incluye `letters|numbers`; `NODE_META.letters`/`.numbers`.

- [ ] **Step 1:** En `services/admin.service.ts` agregar, espejando el bloque de vocab: tipos `AdminLetterPack = { id, key, title, enabled }`, `AdminLetterItem = { id, packId, letter, name, soundIpa, exampleWord, exampleMeaning, img, audio, position, enabled }`, `AdminNumberPack` (= pack), `AdminNumberItem = { id, packId, value, word, img, audio, position, enabled }`; y los fetchers `get/create/update/deleteLetterPack`, `get/create/update/deleteLetterItem` (rutas `/admin/letter-*`) y sus equivalentes de number. Ampliar el `export type PathNodeType` de este archivo con `"letters" | "numbers"`.
- [ ] **Step 2:** En `services/lessons.service.ts` agregar a la unión `NodeContent`:

```ts
export type LettersContent = {
  type: "letters"; title: string;
  items: { id: number; letter: string; name?: string | null;
    soundIpa?: string | null; exampleWord?: string | null;
    exampleMeaning?: string | null; img?: string | null; audio?: string | null; }[];
};
export type NumbersContent = {
  type: "numbers"; title: string;
  items: { id: number; value: number; word: string;
    img?: string | null; audio?: string | null; }[];
};
export type NodeContent =
  | PronunciationContent | GrammarContent | VocabContent
  | PracticeContent | LettersContent | NumbersContent;
```

- [ ] **Step 3:** En `types/path.types.ts` ampliar `PathNodeType` con `"letters" | "numbers"`.
- [ ] **Step 4:** En `lib/path-node-meta.ts` agregar a `NODE_META`:

```ts
letters: { icon: "🔤", label: "Letras", route: (n) => `/lesson/letters?id=${n.id}` },
numbers: { icon: "🔢", label: "Números", route: (n) => `/lesson/numbers?id=${n.id}` },
```

- [ ] **Step 5 (verificación):** `npm run lint` (sin errores nuevos). Commit: `feat(admin): fetchers + tipos de letters/numbers`.

### Task 9: Managers de admin (Letters + Numbers) + tabs

**Files:**
- Create: `dots-webapp/components/admin/foundations/letters-manager.tsx`, `numbers-manager.tsx`
- Modify: `dots-webapp/app/(app)/admin/foundations/page.tsx`

**Interfaces:**
- Consumes: fetchers del Task 8, `flash` del page.
- Produces: `LettersManager`/`NumbersManager` (default export, prop `{ flash }`).

- [ ] **Step 1:** Crear `letters-manager.tsx` **copiando `components/admin/foundations/vocab-manager.tsx`** y adaptando: usar los fetchers de letter pack/item; el pack list = igual (Title+key, Toggle enabled, Manage, Edit/Delete); el item modal (mirar `word-modal.tsx`) con campos **Letter** (req), **Name** (ej. "bee"), **Sound (IPA)**, **Example word**, **Example meaning**, **Image** (UploadTile), **Audio** (UploadTile), **Position**; tabla de items con columnas #, Letter, Name, Media (🖼️/🔊), Actions. Preservar `audio`/`img` no enviándolos vacíos en update.
- [ ] **Step 2:** Crear `numbers-manager.tsx` igual, con item fields **Value** (req, numérico), **Word** (req), **Image**, **Audio**, **Position**; tabla #, Value, Word, Media, Actions.
- [ ] **Step 3:** En `foundations/page.tsx` agregar `"letters"` y `"numbers"` al tipo `FoundationType`, al array `TABS` (labels "Letters"/"Numbers", hints "Alphabet"/"Counting") y renderizar `<LettersManager flash={flash}/>`/`<NumbersManager flash={flash}/>`.
- [ ] **Step 4 (verificación):** `npm run lint` + `npx next build`. Commit: `feat(admin): managers de letters y numbers`.

### Task 10: Editor de camino — tipos letters/numbers + refs

**Files:**
- Modify: `dots-webapp/app/(app)/admin/path/page.tsx`

**Interfaces:**
- Consumes: `getLetterPacks`/`getNumberPacks` (Task 8).

- [ ] **Step 1:** Agregar a `NODE_TYPES` las entradas `{ key:"letters", label:"Letters", color:"var(--gem)" }` y `{ key:"numbers", label:"Numbers", color:"var(--success)" }` (elegir colores con base+contraste ya existentes; reutilizar de la paleta usada — evitar duplicar exactamente los de otros tipos si molesta, pero no es bloqueante).
- [ ] **Step 2:** Cargar los packs para los dropdowns de ref: agregar `const [letters,setLetters]=useState<RefOption[]>([])` y `numbers` análogo; en el `useEffect` de catálogos, `getLetterPacks().then(p=>setLetters(p.map(x=>({id:x.id,label:x.title}))))` y number igual. Sumar los casos `letters`/`numbers` a `optionsFor(type)`.
- [ ] **Step 3 (verificación):** `npx next build`. Commit: `feat(admin): letters/numbers en el editor de camino`.

### Task 11: Página `lesson/letters`

**Files:**
- Create: `dots-webapp/app/(app)/lesson/letters/page.tsx`

**Interfaces:**
- Consumes: `getNodeContentService`, `putNodeProgressService` (`services/lessons.service.ts`); `LettersContent`.

- [ ] **Step 1:** Leer una lección existente como plantilla (`app/(app)/lesson/pronunciation/page.tsx` o `vocab/page.tsx`) para copiar: el boundary `<Suspense>` alrededor del componente que usa `useSearchParams`, el patrón `fetchAttempt` de carga + `loadError` + botón **Reintentar** (rule 5/3 de CLAUDE.md), el envío de progreso con `putNodeProgressService(nodeId, items)` al terminar, y el chrome de lección.
- [ ] **Step 2:** Construir el drill RN-safe (solo tap): por cada `LettersContent.items[i]`, presentar la letra (grande) + su `name`/`exampleWord` (si hay); si hay `audio`, un botón ▶ para oírlo (autoplay legal solo tras gesto — botón). Pregunta de reconocimiento con **botones** de opciones (p. ej. 3-4 letras: "¿cuál viste/oíste?"), sin `<input>` ni `<select>`. Registrar aciertos/errores por item (`NodeItemResult { id, times_wrong, answered }`) y al final enviar progreso. **Degrada sin media:** si no hay audio/img, el drill usa letra + nombre + ejemplo en texto.
- [ ] **Step 3 (verificación):** `npm run lint` + `npx next build`. Commit: `feat(lesson): página de letras`.

### Task 12: Página `lesson/numbers`

**Files:**
- Create: `dots-webapp/app/(app)/lesson/numbers/page.tsx`

- [ ] **Step 1:** Copiar la estructura del Task 11 (Suspense + fetchAttempt + envío de progreso), tipada con `NumbersContent`.
- [ ] **Step 2:** Drill RN-safe: mostrar el `value` (numeral) y, si hay audio, botón ▶ de la `word`; reconocimiento con botones numeral↔palabra (p. ej. "¿qué número es 'seven'?" con opciones de numerales, y viceversa). Si hay `img`, variante "¿cuántos?" contando objetos. Degrada a numeral+palabra en texto sin media.
- [ ] **Step 3 (verificación):** `npm run lint` + `npx next build`. Commit: `feat(lesson): página de números`.

### Task 13: Upgrade de `lesson/vocab` (imagen) + verificación final

**Files:**
- Modify: `dots-webapp/app/(app)/lesson/vocab/page.tsx`

- [ ] **Step 1:** Leer `lesson/vocab/page.tsx`. El backend ya devuelve `items[].img` en `VocabContent`. Mostrar la imagen (con `resolveImageUrl` si aplica; `max-width:100%`, `object-cover`) cuando `img` exista, en la tarjeta present/match. **Degrada** sin `img` (comportamiento actual). No tocar la lógica de quiz.
- [ ] **Step 2 (verificación final F3a):** `npm run lint` + `npx next build` (front) verdes; `npx tsc --noEmit` + boot (back) verdes; preview manual como `profile=1`: crear un `letter_pack` con 3 items y un `number_pack`, colocarlos como nodos en una sección de prueba desde `/admin/path`, y abrir `/lesson/letters?id=…` y `/lesson/numbers?id=…`. Commit: `feat(lesson): vocab muestra imagen + cierre F3a`.

---

## Self-Review

- **Cobertura spec F3a:** datos (Task 1-2), `PathNodeType`+registro (Task 3), DTOs (Task 4), CRUD admin letras/números (Task 5-6), resolver+itemCount (Task 7), fetchers/tipos/meta (Task 8), managers+tabs (Task 9), editor de camino (Task 10), lecciones letras/números (Task 11-12), upgrade vocab (Task 13). ✓
- **Reuso:** todo espeja el stack de `vocab` de F2; el resolver mira `vocabContent`; las lecciones copian una `lesson/*` existente. Sin reinvención. ✓
- **Sin mutación de prod:** el único write es el DDL aditivo (Task 1, `--apply` explícito, rollback = DROP TABLE). El contenido real y el re-encaje son F3b. ✓
- **Riesgo:** el resolver y `path.service` exigen registrar los repos nuevos en `path.module` (Task 7 Step 2) — si falta, DI falla al boot (lo detecta el Step 5). Borrado de pack borra items primero (sin cascade). ✓
- **Media diferida:** lecciones y managers funcionan sin audio/img (degradación explícita en Task 11/12/13); ElevenLabs = F-media. ✓
