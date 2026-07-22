# F2 — Admin CRUD de fundamentos + camino · Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development o superpowers:executing-plans. Steps con checkbox (`- [ ]`).

**Goal:** Que el admin pueda crear/editar/borrar los fundamentos (`pronunciation_units/items`, `grammar_pills/items`, `vocab_packs/items`), gestionar `levels` (crear/editar, no solo enable) y armar el camino (`path_nodes`), **espejando** el CRUD que ya existe para words/sentences. Tras F2, la BD es la fuente de la verdad.

**Architecture:** El módulo admin (`dots-backend/src/modules/admin/`) ya tiene el patrón: `admin.controller.ts` (rutas + guard) → `admin.service.ts` (lógica + repos) → `admin.dto.ts` (validación). Las entidades y repositorios de las 6 tablas de fundamentos + `path_node` + `section` **ya existen** en `src/common/`; solo hay que registrarlos y agregar DTOs/métodos/rutas. El frontend replica `app/(app)/admin/levels/page.tsx` + `services/admin.service.ts`.

**Tech Stack:** NestJS 11 + TypeORM (back), Next.js 16 app router (front). Sin test runner → verificación: `npx tsc --noEmit` + `npx next build` + preview manual del admin.

## Global Constraints

- **Espejar el patrón existente** de sentences/words (`admin.service.ts:155-338`, `admin.dto.ts:13-119`): validación con class-validator, `NotFoundException`/`HttpException`, serializers, guard `AdminGuard` (profile===1).
- **`grammar_items.distractors` y `grammar_pills.explanation` son JSON** (se guardan como JSON string en el seed; con TypeORM usar el tipo de la entidad).
- **`pronunciation_items` y `vocab_items` ya tienen endpoints de generación de audio** (`admin.controller.ts:81-98`); reusarlos, no duplicar.
- **Audio se preserva:** al editar un item, no nullear `audio/audio_a/audio_b` salvo que se pida (igual que el seed).
- **Fuente de la verdad:** tras F2, agregar nota en `scripts/seed-foundations.js` de que un re-seed pisa ediciones del admin (o excluirlo del flujo normal).
- **Navegación front con `router.push`** (nunca `window.location`), `useSearchParams` en `<Suspense>`.
- **Rama:** `redesign/contenido-camino` (ambos repos).

---

## F2a — Backend: CRUD de fundamentos

### Task 1: Registrar entidades/repos faltantes en el módulo

**Files:** Modify `dots-backend/src/modules/admin/admin.module.ts`

- [ ] **Step 1:** Agregar a `TypeOrmModule.forFeature([...])` las entidades que faltan: `PronunciationUnit`, `GrammarPill`, `GrammarItem`, `VocabPack` (ya están `PronunciationItem`, `VocabItem`). Importarlas de `src/common/entity/*`.
- [ ] **Step 2:** Agregar a `providers` los repos: `PronunciationUnitRepository`, `GrammarPillRepository`, `GrammarItemRepository`, `VocabPackRepository` (existen en `src/common/repository/`).
- [ ] **Step 3:** `npx tsc --noEmit` → sin errores. Commit: `chore(admin): registra repos de fundamentos en AdminModule`.

### Task 2: DTOs de fundamentos

**Files:** Modify `dots-backend/src/modules/admin/admin.dto.ts`

- [ ] **Step 1:** Agregar DTOs (mismo estilo que `CreateSentenceDto`). Columnas por entidad:
  - **Pronunciation unit:** `CreatePronunciationUnitDto { key, title, descriptionEs?, soundA?, soundB? }`, `UpdatePronunciationUnitDto` (todos opcionales).
  - **Pronunciation item:** `CreatePronunciationItemDto { unitId:int, wordA, wordB, position? }`, `UpdatePronunciationItemDto { wordA?, wordB?, position? }` (audio se maneja por el endpoint de generación).
  - **Grammar pill:** `CreateGrammarPillDto { key, title, explanation: any[] }`, `UpdateGrammarPillDto`.
  - **Grammar item:** `CreateGrammarItemDto { pillId:int, text, answer, distractors: string[], mode? }`, `UpdateGrammarItemDto`. Validar `text` contiene `__` exactamente una vez (como sentences).
  - **Vocab pack:** `CreateVocabPackDto { key, title }`, `UpdateVocabPackDto`.
  - **Vocab item:** `CreateVocabItemDto { packId:int, text, meaning?, img?, position? }`, `UpdateVocabItemDto`.
- [ ] **Step 2:** `npx tsc --noEmit`. Commit: `feat(admin): DTOs de fundamentos`.

### Task 3: Servicio + rutas — Pronunciation (EXEMPLAR completo)

**Files:** Modify `admin.service.ts`, `admin.controller.ts`

Este task es el patrón que Tasks 4-5 replican para grammar y vocab.

- [ ] **Step 1:** En `admin.service.ts`, inyectar los repos nuevos en el constructor y agregar métodos (espejo de `listSentences/createSentence/updateSentence/deleteSentence`):

```ts
// Pronunciation units
async listPronunciationUnits() {
  const units = await this.pronunciationUnitRepository.find({ order: { id: 'ASC' } });
  return units.map((u) => ({ id: u.id, key: u.key, title: u.title,
    descriptionEs: u.descriptionEs, soundA: u.soundA, soundB: u.soundB }));
}
async createPronunciationUnit(dto: CreatePronunciationUnitDto) {
  const dup = await this.pronunciationUnitRepository.findOne({ where: { key: dto.key } });
  if (dup) throw new HttpException('key already exists', 409);
  return this.pronunciationUnitRepository.save(
    this.pronunciationUnitRepository.create({ key: dto.key, title: dto.title,
      descriptionEs: dto.descriptionEs ?? null, soundA: dto.soundA ?? null, soundB: dto.soundB ?? null }));
}
async updatePronunciationUnit(id: number, dto: UpdatePronunciationUnitDto) {
  const u = await this.pronunciationUnitRepository.findOne({ where: { id } });
  if (!u) throw new NotFoundException('Unit not found');
  if (dto.title !== undefined) u.title = dto.title;
  if (dto.descriptionEs !== undefined) u.descriptionEs = dto.descriptionEs;
  if (dto.soundA !== undefined) u.soundA = dto.soundA;
  if (dto.soundB !== undefined) u.soundB = dto.soundB;
  return this.pronunciationUnitRepository.save(u);
}
async deletePronunciationUnit(id: number) {
  const u = await this.pronunciationUnitRepository.findOne({ where: { id } });
  if (!u) throw new NotFoundException('Unit not found');
  await this.pronunciationUnitRepository.remove(u); // items cascade via FK / delete items first if no cascade
  return { ok: true };
}
// Pronunciation items (position-scoped to unit, like words to level)
async listPronunciationItems(unitId: number) { /* find where unit_id, order position ASC */ }
async createPronunciationItem(dto: CreatePronunciationItemDto) { /* validate unit exists; next position */ }
async updatePronunciationItem(id: number, dto: UpdatePronunciationItemDto) { /* preserve audio_a/audio_b */ }
async deletePronunciationItem(id: number) { /* remove */ }
```

- [ ] **Step 2:** En `admin.controller.ts`, agregar rutas (bajo `@UseGuards(AdminGuard)`):
```
GET    /admin/pronunciation-units
POST   /admin/pronunciation-units
PATCH  /admin/pronunciation-units/:id
DELETE /admin/pronunciation-units/:id
GET    /admin/pronunciation-units/:id/items
POST   /admin/pronunciation-items
PATCH  /admin/pronunciation-items/:id
DELETE /admin/pronunciation-items/:id
```
(el `pronunciation-items/:id/generate-audio` ya existe).
- [ ] **Step 3:** `npx tsc --noEmit` + probar con curl/preview autenticado como admin. Commit: `feat(admin): CRUD de pronunciation units+items`.

### Task 4: Grammar (replica del exemplar)
- [ ] Igual que Task 3 para `grammar_pills` + `grammar_items`. Nota: `explanation` (JSON array de bloques `{type,text,en?}`) y `distractors` (JSON array). Validar `text` del item contiene `__`. Rutas `/admin/grammar-pills*`, `/admin/grammar-items*`. Commit.

### Task 5: Vocab (replica del exemplar)
- [ ] Igual para `vocab_packs` + `vocab_items`. `vocab-items/:id/generate-audio` ya existe. Rutas `/admin/vocab-packs*`, `/admin/vocab-items*`. Commit.

---

## F2b — Backend: levels + camino (path_nodes)

### Task 6: Levels create/update
- [ ] DTOs `CreateLevelDto { name, src, idSection, unlock? }`, `UpdateLevelDto`. Métodos en service (LevelsRepository ya inyectado). Rutas `POST /admin/levels`, `PATCH /admin/levels/:id` (el enable ya existe). `levels.id` es autogenerado int. Commit.

### Task 7: Path nodes CRUD + reorder
- [ ] Registrar `PathNodeRepository` + `SectionRepository` en el módulo. DTOs `CreatePathNodeDto { sectionId, position, type, refId?, title? }` (type ∈ practice|pronunciation|grammar|vocab|reading|checkpoint — más los nuevos en F3), `UpdatePathNodeDto`. Manejar **colisión de (section_id, position)** como `seed-foundations.js:placeNodes`. Rutas `GET /admin/sections/:id/nodes`, `POST/PATCH/DELETE /admin/path-nodes/:id`. Al borrar un nodo, limpiar `node_progress` (como el rollback del seed). Commit.

---

## F2c — Frontend: UI de admin

### Task 8: Fetchers
- [ ] En `services/admin.service.ts`, agregar métodos para todos los endpoints nuevos (patrón de los existentes `getSentences/createSentence/...`).

### Task 9: Editor de fundamentos
- [ ] `app/(app)/admin/foundations/page.tsx`: lista por tipo (pronunciation/grammar/vocab), expandible a items, con crear/editar/borrar y botón "generar audio" (reusa endpoint). Gate de admin del layout ya aplica. Navegación `router.push`. `useSearchParams` en `<Suspense>` si se usa.

### Task 10: Editor de camino
- [ ] `app/(app)/admin/path/page.tsx`: elegir sección → ver nodos ordenados por posición → crear/mover/borrar nodo, eligiendo `type` + `ref` (dropdown del contenido correspondiente). Aviso de colisión de posición.

### Task 11: Nav + fuente de la verdad
- [ ] Agregar entradas al nav del admin (`app/(app)/admin/layout.tsx`). Nota en `scripts/seed-foundations.js`: la BD es ahora la fuente de la verdad; un re-seed pisa ediciones (documentar / gatear).
- [ ] `npx next build` (front) + `npx tsc --noEmit` (back) verdes. Preview del admin como profile=1. Commit.

---

## Self-Review
- **Cobertura spec F2:** CRUD fundamentos (F2a), levels + path editing (F2b), UI admin (F2c), fuente de la verdad (Task 11). ✓
- **Reuso:** entidades/repos ya existen; audio reusa endpoints existentes; se espeja el patrón sentences/words (no se inventa). ✓
- **Riesgo:** borrado de unit/pill/pack debe borrar items primero si no hay cascade en FK — verificar en cada entidad y, si falta, borrar items en el service antes del parent (como el `deleteOrder` del seed). Anotado en Task 3/4/5.
- **Decompuesto:** F2a (CRUD contenido) entrega valor solo; F2b y F2c se pueden gatear por separado.
