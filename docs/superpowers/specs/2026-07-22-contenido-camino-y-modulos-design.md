# Contenido del camino, editable en admin, y módulos por tipo — Diseño

- **Fecha:** 2026-07-22
- **Rama:** `redesign/contenido-camino` (ambos repos)
- **Estado:** F0/F1/F2/F3a/F3b/F3d hechos y aplicados a prod (2026-07-22); F3c parcial (engrosado vocab hecho; fundamentos 2–12 diferidos — requieren autoría nueva); **F3e con diseño completo, pendiente de implementar** (dominio por ítem + sesiones por tramos + autoplay + ronda inversa; incluye fix del progreso de letters/numbers); piloto gramática sección 2 diseñado, sin arrancar; F-media diferida (créditos).
- **Repos:** `dots-webapp` (front) + `dots-backend` (API/seed). BD PostgreSQL **compartida de producción**.

## 1. Problema

Auditoría de los 95 `levels` (temas) y su contenido (`words` + `sentences`), leído read-only de prod el 2026-07-22. Tres problemas encadenados:

### 1.1 Contenido roto / apagado (lo más grave)
- **~18 niveles con 0 oraciones habilitadas** (`enabled=false` en todas). El alumno entra a "verb to be" (L23, 14 oraciones, 0 activas), "do/does" (L25, 15→0), "possesive adjectives" (L22, 20→0), "prepositions" (L29, 13→0), "Opposites" (L55, 21→0)… y **no hay nada que practicar**. Secciones 2 y parte de 3 están, de hecho, apagadas.
- **35 niveles bajo la barra de ≥8 oraciones habilitadas.**
- **13 oraciones basura en prod** ("this is test sentence", "more testing hehe", "new sentenceeee aaaa", "testing number 10000"): L1 alphabet(10), L2 numbers(1), L5 months(1), L80 Like(1).
- **Vacíos:** L32 "reflexive pronouns" (0/0, además duplica el nombre de L24); L45 daytime, L47 furniture, L48 house, L49 body, L50 school = tienen words pero **0 oraciones**.
- **Ruido de formato:** L55 tokens tipo `"Put-__"`, `"Soft-__"`; L80 `"f::__"`; duplicados (family: `"Our __ watches tv."` x2); typos (`daugther`, `sharpenner`); `GREY` en words vs `GRAY` en la oración.

### 1.2 Módulo equivocado para temas de vocabulario
- **25 niveles son de vocabulario** (todos en sección 1: alphabet, numbers, colors, days, family, clothes, foods, animals, body, house…) y **70 son de gramática**.
- Los 25 de vocabulario se enseñan con el módulo **`practice` (oraciones fill-in-the-blank)**, que no es su forma natural.
- Caso extremo **alphabet (L1)**: las 26 "words" son `A…Z` **sin significado ni audio**; las oraciones son un acróstico de palabras random (BEES, CASTLE, DOGS…) que **no enseña el abecedario**, y la primera está rota (`"That is __ tall building"` con respuesta `A`).
- **numbers (L2)**: 1–10 correcto, luego deriva a otras palabras (SINGS, BUYS…) y termina en oraciones de prueba.
- **~397 words, casi todos sin significado en español** (`meaning` vacío) y sin audio — nunca se necesitaron porque estos temas se practicaban por oraciones.

### 1.3 Fundamentos no editables en admin
- Los fundamentos que se agregaron (`pronunciation_units/items`, `grammar_pills/items`, `vocab_packs/items`) viven en `scripts/seed-data/foundations.json`, se siembran vía `scripts/seed-foundations.js`, y **no tienen CRUD en el admin** (solo se puede disparar generación de audio). En contraste, `words`, `sentences` y `readings` **sí** son editables (`/admin/*`).
- Además, los fundamentos solo se interlazaron en la **sección 1**; las secciones 2–12 son `practice` puro.

## 2. Decisiones (cerradas con el usuario)

| # | Decisión | Elección |
|---|----------|----------|
| 1 | Prioridad | **Fases: contenido → admin → módulos** |
| 2 | Alcance | **Los 95 niveles** (beginner + intermediate + advanced) |
| 3 | Módulos para vocab | **Nuevo por tipo, acotado a 4 arquetipos** |
| 4 | Autoría de contenido | **Yo genero, el usuario revisa en admin** |
| 5 | Fuente de la verdad de fundamentos | **La BD manda; el seed queda como import inicial (one-shot)** |
| 6 | Barra de "suficiente práctica" | **≥8 práctica / ≥10 vocab / ≥8 fundamentos** por módulo |
| 7 | Contenido roto | **Borrar lo obvio (con backup); marcar lo dudoso para revisión** |
| 8 | Media (audio/imágenes) | **Significados ahora (texto); audio + imágenes en fase aparte** |

## 3. Arquitectura actual (referencia)

```
difficulty (beginner/intermediate/advanced)
  └─ section  ("Level 1".."Level 12")           dots.section
       ├─ levels (los 95 temas)                 dots.levels        ← id_section, name, unlock, enabled
       │     ├─ words     (por level_id varchar) dots.words        ← text, meaning, img, audio, position
       │     └─ sentences (por level_id int)     dots.sentences    ← text, m_word, enabled, voice_character_id
       └─ path_nodes (el "camino")              dots.path_nodes    ← type, position, ref_id
              type: practice   → ref = levels.id           (oraciones del tema)
                    pronunciation/grammar/vocab → ref = fundamentos (foundations.json)
                    reading     → ref = readings.id
                    checkpoint  → ref = NULL (examen de sección)
```

**Puntos de integración (verificados):**

- Backend
  - Entidades: `dots-backend/src/common/entity/*.entity.ts` (`path_node.entity.ts` define `PathNodeType`).
  - Admin: `dots-backend/src/modules/admin/{admin.controller.ts, admin.service.ts, admin.dto.ts, admin.guard.ts, narration.service.ts, cloudinary.service.ts}`. Guard exige `users.profile === 1`.
  - Patrón CRUD existente (a espejar): `sentences` y `words` en `admin.controller.ts:128-172` + `admin.service.ts:155-338`. Upload a Cloudinary en `admin.controller.ts:231`. Narración de `vocab-items`/`pronunciation-items` **ya cableada** en `admin.controller.ts:81-98`.
  - Seed idempotente + backup/rollback: `scripts/seed-foundations.js`; audio: `scripts/generate-narrations.js`.
- Frontend
  - Admin UI: `app/(app)/admin/{layout.tsx, page.tsx, levels/page.tsx, readings/page.tsx, users/page.tsx}`; gate en `layout.tsx:38-48` (`ADMIN_PROFILE` en `constants.ts:8`); fetchers en `services/admin.service.ts`.
  - Despacho de nodos: `lib/path-node-meta.ts:9-40` (`NODE_META[type].route`), usado por `components/path/node-popover.tsx:22,103` y `components/path/path-node.tsx:46`.
  - Unión de tipos: `types/path.types.ts:1-7`.
  - Carga de contenido de nodo: `services/lessons.service.ts:60` `getNodeContentService(nodeId)` → `NodeContent` (union), backend `GET /path/nodes/{id}`. Tipos de contenido en `lessons.service.ts:14-58`.

## 4. Los 4 arquetipos de módulo

Toda pieza nueva cumple **reglas RN-safe** (solo tap/pointer; sin keydown como input, sin drag HTML5, sin canvas, sin `<input>` de texto, sin hover como única señal; teclados = botones en pantalla; animación solo `transform`/`opacity`) y **reglas del compiler de React** (patrón `fetchAttempt`, sin setState en cuerpo de efecto, sin efectos en updaters).

| Arquetipo | Es | Node type | Módulo/renderer | Interacción | Contenido |
|-----------|----|-----------|-----------------|-------------|-----------|
| **Letras** | **nuevo** | `letters` | `app/(app)/lesson/letters/page.tsx` | Ver letra → oír nombre + sonido → tap: "¿qué letra oíste?" (reconocimiento) y "¿con qué letra empieza?" | Tabla nueva `dots.letters` (26): `letter, name (ej. "bee"), sound_ipa, example_word, example_meaning, audio, img` |
| **Números** | **nuevo** | `numbers` | `app/(app)/lesson/numbers/page.tsx` | Ver numeral → oír palabra → tap: numeral↔palabra; "¿cuántos?" con objetos | Tabla nueva `dots.numbers`: `value, word, audio, img`. 1–20 + decenas hasta 100 (2ª unidad) |
| **Vocab-visual** | **upgrade** del actual | `vocab` (existente) | `app/(app)/lesson/vocab/page.tsx` (mejorado: muestra imagen) | present → match (ya existe) + tarjeta con imagen/audio/significado | `vocab_packs` + `vocab_items` (creados desde los `words` existentes + significados que autoro) |
| **Práctica (oraciones)** | **existente, limpiado** | `practice` | `app/(app)/practice/page.tsx` | fill-in-the-blank / buildUp / listen / select (ya existe) | `sentences` limpiadas, habilitadas y expandidas a ≥8 |

Nota: se eligen **2 tipos nuevos** (`letters`, `numbers`) + **1 upgrade** (`vocab`) + **1 limpieza** (`practice`). Los otros 23 temas de vocabulario van a **vocab-visual** (reusan `vocab`), no a tipos nuevos — así "4 arquetipos" queda construible.

**Almacenamiento (refinado en F3a, 2026-07-22):** `letters`/`numbers` se guardan como **packs+items** (igual que `vocab`: `letter_packs`/`letter_items`, `number_packs`/`number_items`), no como tablas planas; un nodo del camino apunta a un pack vía `ref_id`. Así el resolver, el CRUD admin y el editor de camino reusan 1:1 el patrón de los fundamentos (ver §5 F3a).

## 5. Fases

Cada fase, al implementarse, genera su propio plan con `writing-plans` y se ejecuta gateada. Todo cambio de datos pasa por backend/seed con **backup previo** (patrón `seed-foundations.js`). Verificación por fase: `npm run lint` + `npx next build` (front), `npx tsc --noEmit`/build (back), y preview manual — no hay test runner de componentes.

### F0 — Triage de contenido (rápido, los 95 niveles) — ✅ hecho 2026-07-22
**Meta:** que ningún nivel esté vacío o con basura; dejar el camino "sano".
- Borrar las 13 oraciones basura (backup antes).
- Auditar los **~18 niveles con 0 habilitadas**: por cada uno, decidir re-habilitar (si el contenido es correcto), corregir+habilitar, o marcar para reescritura en F1. **Requiere criterio caso a caso** (ver §7 — abierto: por qué se apagaron).
- Resolver vacíos: L32 (definir si es duplicado de L24 y consolidar), y decidir el módulo de daytime/furniture/house/body/school (van a vocab-visual en F3; en F0 solo se marca).
- Fix de typos y duplicados evidentes; normalizar `GREY/GRAY`.
- **Entregable:** informe de estado por nivel + BD sin basura ni niveles muertos. Reversible.
- **✅ Ejecutado 2026-07-22:** `deleted=12, dedup=16, enabled=139` (14 niveles muertos revividos), `17` fixes. Reporte: [2026-07-22-f0-triage-reporte.md](../plans/2026-07-22-f0-triage-reporte.md). Backup para rollback: `dots-backend/scripts/out/backup-triage-1784737020582.json`. Pendiente para F1: revividos aún <8 (complements, irregular past, comparatives, imperative, since/for, reciprocal…).

### F1 — Expansión + significados (los 95 niveles) — ✅ hecho 2026-07-22
**Meta:** cada módulo alcanza la barra (≥8 práctica / ≥10 vocab / ≥8 fundamentos) con contenido **acorde al tema**.
- Autorear oraciones nuevas donde falten, **temáticas del nivel** (nada de acrósticos ni relleno).
- Autorear los **~397 significados en español** de `words` (necesarios para vocab-visual).
- Extender fundamentos: hoy solo en sección 1; sembrar pronunciation/grammar/vocab también en las secciones que lo pidan (intermediate/advanced), interlazados.
- **Entregable:** contenido a la barra, cargado vía seed/backend. Audio/imágenes NO (fase media).
- **✅ Ejecutado 2026-07-22:** Batch A (371 significados), Batch B (29 oraciones → gramática ≥8 + Opposites reformateado), chunk 1 (L21 4→20, 9 typos, `stations`→`seasons`), Batch C (+36 fundamentos). Reporte: [2026-07-22-f1-expansion-reporte.md](../plans/2026-07-22-f1-expansion-reporte.md). Nota: "extender fundamentos a otras secciones" (placement en path_nodes) se difiere a **F3** (edición de camino); los niveles vocab flacos también van a F3. `s-inicial` queda en 6 (intencional).

### F2 — Admin CRUD de fundamentos + estructura — ✅ hecho 2026-07-22
**Meta:** que el usuario edite todo el contenido desde el admin (la BD pasa a ser la fuente de verdad).
- Backend: endpoints CRUD para `pronunciation_units/items`, `grammar_pills/items`, `vocab_packs/items`, **espejando** el patrón de `words`/`sentences` (nuevos DTOs en `admin.dto.ts`, métodos en `admin.service.ts`, rutas en `admin.controller.ts`). Reusar `AdminGuard` y `narration.service` (audio ya cableado).
- Backend: elevar `levels` a CRUD (hoy solo enable/disable) y exponer **edición de `path_nodes`** (crear/mover/borrar nodos, reordenar posición) — es lo que permite "colocar" contenido en el camino desde el admin.
- Frontend: páginas admin nuevas (`app/(app)/admin/foundations/`, `app/(app)/admin/path/`) + fetchers en `services/admin.service.ts`, siguiendo `admin/levels/page.tsx`.
- **Fuente de la verdad:** tras F2, la BD manda. `foundations.json` se documenta como import inicial (one-shot); se agrega una nota en `seed-foundations.js` para no re-pisar ediciones del admin (o se retira del flujo normal).
- **Entregable:** admin donde se crea/edita/borra fundamentos y se arma el camino.
- **✅ Ejecutado 2026-07-22:** CRUD backend de los 6 fundamentos + `levels` create/update + `path_nodes` (colisión de posición + limpieza de `node_progress`); front `/admin/foundations` (3 managers) y `/admin/path` + nav/dashboard; nota de fuente de la verdad en `seed-foundations.js`. Alcance: `levels` quedó con create/update (sin delete, por el arrastre de words/sentences/progress). Verificado: `tsc`+boot+35 rutas (back), `lint`+`build` (front). Commits en ambos repos.

### F3 — Módulos nuevos + re-encaje — **dividido en F3a / F3b / F3c** (2026-07-22)
**Meta:** letras/números/vocabulario en su módulo natural.
**Decisiones (2026-07-22):** se **divide** F3 y se hace **F3a (código) primero**; el contenido de letras/números se modela como **packs+items** (igual que vocab), no como tablas planas.

#### F3a — Módulos nuevos (solo código + DDL aditivo)
**Meta:** que existan los tipos `letters` y `numbers` end-to-end (datos → resolver → admin → lección), **sin mutar** contenido de prod.
- **Datos (espeja vocab):** `letter_packs`/`letter_items` (`letter, name, sound_ipa, example_word, example_meaning, img, audio, position, enabled`) y `number_packs`/`number_items` (`value, word, img, audio, position, enabled`). Migración **aditiva** (patrón idempotente + backup de `migrate-learning-path.js`) que crea las 4 tablas vacías.
- **Backend:** entidades + repos; `PathNodeType += 'letters' | 'numbers'` (`path_node.entity.ts`); CRUD admin espejando vocab (`/admin/letter-packs*`, `/admin/letter-items*`, `/admin/number-packs*`, `/admin/number-items*`); resolver `NodeContentService += letters|numbers` con `LettersNodeContentDto`/`NumbersNodeContentDto` (registrar repos en `path.module`); `itemCount` en `GET /path`. Audio/img por **subida manual** (`/admin/upload`, como el modal de words); la generación ElevenLabs de letras/números va a **F-media**.
- **Frontend:** uniones `PathNodeType` (`types/path.types.ts` + `services/admin.service.ts`) y `NodeContent` (`services/lessons.service.ts`) `+= letters|numbers`; `NODE_META` (icono + ruta `/lesson/letters|numbers?id=`); editor de camino (`NODE_TYPES` + dropdowns de packs + `PATH_NODE_TYPES` del DTO admin); **2 tabs (Letters/Numbers)** en `/admin/foundations` reusando el patrón de managers; páginas `lesson/letters` y `lesson/numbers` (RN-safe, `useSearchParams` en `<Suspense>`, **degradan sin media**); **upgrade de `lesson/vocab`** para mostrar imagen (el backend ya devuelve `img` — solo display).
- **Entregable:** admin donde se crean packs de letras/números y se colocan en el camino; lecciones que renderizan (aún sin audio/imágenes). Verificación: `tsc`+build (back), `lint`+`build` (front), preview.

#### F3b — Re-encaje de la sección 1 (migración de datos, con backup) — ✅ hecho 2026-07-22
**Meta:** que alphabet, numbers y los ~23 temas de vocabulario usen su módulo natural.
- Crear `vocab_packs`/`items` desde los `words` existentes; crear el contenido de `letters`/`numbers` (rango **1–20 + decenas hasta 100**).
- Reescribir los `path_nodes` de la sección 1 para usar `vocab`/`letters`/`numbers` en vez de `practice`; retirar las oraciones obsoletas **archivándolas** (`enabled=false`, reversible).
- Todo con backup + rollback (patrón `seed-foundations.js`).
- **✅ Ejecutado 2026-07-22:** seed idempotente `seed:modules` (`scripts/seed-modules-content.js` + `scripts/seed-data/modules.json`). Aplicado a prod: 26 packs + 415 items (26 letras, 28 números, 361 vocab-items derivados de `words`); 25 nodos `practice` de la sección 1 reescritos a módulo + 1 nodo `numbers-tens`; **269 oraciones archivadas** (`enabled=false`). Sección 1 quedó con 0 `practice`. Backup: `scripts/out/backup-modules-content-1784754263982.json` (rollback: `npm run seed:modules -- --rollback <backup>`). `verbs` (L8) → vocab, como decidido.

#### F3c — Diferidos de F1 (contenido/camino) — ⚠️ parcial 2026-07-22
- **Engrosar vocab flacos ≥10:** ✅ hecho donde es posible. `seed:vocab-topup` (`scripts/seed-vocab-topup.js`) aplicado a prod: `vocab-shapes` 6→10 (+STAR, OVAL, PENTAGON, HEXAGON) y `vocab-daytime` 8→10 (+dawn, dusk). Las **categorías cerradas se aceptan** bajo la barra: `days`=7, `seasons`=4, `meals`=5 (no se pueden inflar sin meter ruido). Backup: `scripts/out/backup-vocab-topup-*.json`.
- **Colocar fundamentos en secciones 2–12:** ⏸️ **diferido.** El inventario mostró **0 fundamentos sin colocar** (pronunciation 9/9, grammar 11/11, vocab 32/32 ya referenciados). Interlazar 2–12 exige **autorear fundamentos nuevos** (grammar pills / pronunciation / vocab por sección) — una fase de contenido propia con su spec/plan; no se hizo en esta tanda.

#### F3d — Oído + dominio (rediseño de lecciones, audio copiado) — ✅ hecho 2026-07-22
**Origen:** feedback del usuario al verificar F3b: "el abecedario debería ser escuchar el sonido y seleccionar la letra; el resto (con traducción) escuchar y seleccionar + emparejar, y repetir hasta ~90% — es vocabulario vital".
**Hallazgo clave:** `words` de la sección 1 tiene **audio al 100%** (Cloudinary), y el seed F3b ya lo copió a `vocab_items` (361/367). Letras A–Z y números one–ten tienen clip en `words` → se **copian** a `letter_items`/`number_items`. **Sin ElevenLabs** (decidido: no generar los ~24 faltantes; eleven–twenty/decenas y 6 vocab de F3c degradan a modo visual).
- **Audio:** seed idempotente que copia `words.audio` → `letter_items` (por letra, 26/26) y `number_items` (por palabra, 10/28). Solo llena NULL; backup + rollback.
- **Lecciones:** letras = presentación → **escucha-y-selecciona** (suena el nombre → eliges entre 4 letras); números = escucha-y-selecciona (con audio) / palabra→numeral (sin) + ronda de emparejar numeral↔palabra; vocab = presentar + **escucha-y-selecciona** (oyes EN → eliges traducción) + emparejar. **Bucle de dominio** en las tres: fallos re-encolados hasta responder todo bien (~90%); `times_wrong` sigue viajando igual.
- **Piloto sección 2 (nota):** pills de profundidad variable; **verb to be la más amplia** (vital y complicado).
- **✅ Ejecutado 2026-07-22:** audio copiado a prod (`audio:copy-modules`, letters 26/26, numbers 10/28; backup `scripts/out/backup-copy-audio-*.json`) y las 3 lecciones rediseñadas y verificadas por el usuario en preview ("está mejor"): letras = presentación con audio por tap → escucha-y-selecciona; números = escucha→numeral + emparejar; vocab = etapa `listen` nueva (`listen-quiz.tsx`) entre presentar y emparejar. Re-encolado de fallos en las tres. Commits `5d84723` (back) y `6145bdc`/`6d0e5f4`/`95e4f14` (front).

#### F3e — Dominio por ítem + sesiones por tramos + autoplay + ronda inversa — 📐 diseño completo 2026-07-22 (pendiente implementación)
**Feedback del usuario (dos tandas tras probar F3d):** (1) no pedir todas las letras de golpe — **⅓–½ de los ítems por sesión**; (2) **autoplay** del audio al cambiar de pregunta o al responder bien (el gesto de "Practicar" ya legaliza el autoplay); (3) **ronda inversa**: ver la letra/numeral/palabra y **elegir el audio correcto** entre opciones; (4) aplica a letters, numbers y **todas** las lecciones tipo vocabulario (months, days, seasons… — todas ya son vocab packs que renderiza `lesson/vocab`, así que cubrir las 3 páginas cubre todo); (5) beginner necesita **mucha repetición y entrega progresiva** del contenido, con todo; (6) **sistema de progreso de práctica por ítem**: saber qué ítems el alumno ya responde bien (**"aprendida"**) y en cuáles falla, para **reforzar**.

**Hallazgos técnicos (condicionan el diseño):**
- 🐞 **Bug real pendiente:** `NodeProgressService.ITEM_TABLES` solo cubre pronunciation/grammar/vocab — **`letters` y `numbers` NO están** → `PUT /path/nodes/:id/progress` responde 400 para esos nodos y el progreso de las lecciones nuevas **no se persiste hoy** (el front lo traga con `.catch`). Fix chico: agregar `letters: { table: 'letter_items', fk: 'pack_id' }` y `numbers: { table: 'number_items', fk: 'pack_id' }`.
- **El chunking necesita backend:** el progreso por nodo se guarda como `max(progress previo, answered/total de la sesión)` — enviar ⅓ de los ítems da 33% y un segundo tercio vuelve a dar 33% (max no acumula tramos distintos). Se resuelve computando el progreso desde el dominio por ítem (punto 3 del diseño).
- **El patrón por-ítem ya existe en el repo:** `sentences_progress` guarda por (usuario, oración) `times_correct / times_wrong / streak / done`, con `done = streak≥2 || times_correct≥3`, y el progreso del nivel se recalcula contando `done` (`sentences.service.ts:244-337`). F3e generaliza ese patrón a ítems de módulo — no se inventa semántica nueva.
- `GET /path/nodes/:id` ya exige JWT pero el resolver no recibe al usuario (`path.controller.ts:46-52`, `node-content.service.ts:41`) — hay que pasarle `@CurrentUser()` para adjuntar el dominio por ítem.
- Letters hoy manda **todos** los ítems con `answered:true` al terminar (`lesson/letters/page.tsx:113-124`); con tramos se envía solo lo practicado (punto 8).

**Diseño:**
1. **Datos — `dots.item_progress` (tabla nueva, espejo de `sentences_progress`):** `user_id, item_type ('letters'|'numbers'|'vocab'|'pronunciation'|'grammar'), item_id, times_correct, times_wrong, streak, done, created_at, updated_at`, única por `(user_id, item_type, item_id)`. Migración **aditiva** idempotente con backup (patrón `migrate-learning-path.js`). Genérica a propósito: cubre también fundamentos (grammar/pronunciation) sin tabla nueva, aunque F3e solo cablea letters/numbers/vocab.
2. **Definición de "aprendida" / "a reforzar":** `done = streak ≥ 2 || times_correct ≥ 3` (misma barra que oraciones). "A reforzar" = `times_wrong > 0 && !done`. "Nueva" = sin registro.
3. **Backend — progreso (`NodeProgressService`), dos niveles (decidido en grilling 2026-07-22):** (a) fix `ITEM_TABLES += letters|numbers`; (b) upsert de `item_progress` por cada ítem enviado (misma actualización que oraciones: correct++/wrong+=n, streak resetea con fallo, done al cruzar la barra); (c) **`progress` (desbloqueo)** = `floor(respondidos_1×/total_habilitados × 100)` (ítem con `times_correct ≥ 1`) — el camino avanza al responder todo al menos una vez; **`mastery` (corona)** = `floor(done/total_habilitados × 100)`, columna nueva en `node_progress` — la corona aparece al dominar el pack completo. Ambos leídos de `item_progress`, acumulan entre tramos; se conserva el `max()` para no bajar progreso ya mostrado. XP sin cambios (10/ítem respondido + 20 flawless de la sesión); **gemas solo en la primera sesión del día por nodo** (guard con `daily_use.updated_at` de hoy) para que "Seguir practicando" no se farmee.
4. **Backend — contenido (`NodeContentService`):** `getNodeContent(nodeId, user)` adjunta a cada ítem de letters/numbers/vocab su dominio (`done, streak, timesWrong` vía LEFT JOIN a `item_progress`). Un solo fetch: el front no necesita endpoint nuevo. `GET /path` expone `mastery` junto al `progress` de cada nodo para pintar la **corona** en el camino (`path-node.tsx`).
5. **Front — selección de tramo (hook compartido `use-lesson-session`), tamaño decidido en grilling:** **6–7 ítems por sesión**: `n_sesiones = ceil(total/7)`, `tamaño = ceil(total/n_sesiones)` (26 letras → 4 sesiones de 7/7/7/5); packs ≤7 (days, seasons, meals) entran completos. Composición por prioridad: **a-reforzar primero, luego nuevas**, y 1–2 **ya-aprendidas** mezcladas como repaso (la repetición que pide beginner). Pack 100% dominado → sesión de repaso con tramo aleatorio: el nodo nunca "se agota".
6. **Front — sesión (las 3 lecciones, mismo motor):** presentación **solo de los ítems nuevos** del tramo → ronda directa (escucha → elige texto, la existente) → **ronda inversa** (texto grande como prompt → 3–4 botones 🔊; tap = reproduce Y selecciona; botón **Comprobar** valida — RN-safe, solo tap) → emparejar (numbers/vocab, acotado al tramo). El bucle de dominio intra-sesión se mantiene (fallos re-encolados hasta responder todo). Ítems sin audio quedan fuera de la inversa; si el pack tiene <2 clips, la inversa se salta entera (degrada como hoy).
7. **Front — autoplay:** un único elemento `Audio` reutilizado por ref (evita clips solapados); se reproduce **al montar cada turno** de la ronda directa y **como refuerzo al acertar**. El tap de "Practicar" y cada respuesta mantienen viva la activación de usuario — mismo principio que `GameIntro`.
8. **Front — envío y cierre:** se envían **solo los ítems del tramo** con su `times_wrong` real y `answered` (se corrige el "todos answered:true" de letters). Pantalla final: "Aprendidas X de Y" del pack completo (con las del tramo recién ganadas destacadas) + botón **"Seguir practicando"** que re-selecciona otro tramo sin volver al camino.

**Entregable:** progreso por ítem persistente y visible; lecciones por tramos con autoplay y ronda inversa en letters/numbers/vocab (cubre months/days/seasons y todo vocab pack sin trabajo por tema). Verificación: `tsc`+build (back), `lint`+`build` (front), preview manual: dos sesiones seguidas del mismo nodo deben **acumular** progreso (≈33%→66%), el PUT de letters/numbers deja de dar 400, y los ítems fallados reaparecen priorizados en la sesión siguiente.

**Riesgos propios de F3e:** la fórmula nueva puede calcular MENOS progreso a usuarios que ya completaron nodos (mitigado: `max()` conserva lo mostrado); writes por ítem en la BD compartida (volumen bajo, upsert sobre clave única); migración aditiva con backup como siempre.

#### F-media — ⏸️ diferida (sin correr)
Audio ElevenLabs (los ~24 clips faltantes de números/vocab nuevos) e imágenes: **no ejecutado**; se retoma con presupuesto. Con F3d, la sección 1 ya tiene escucha-y-selecciona con el audio existente.

### F-media — Audio + imágenes (diferida, aprobación aparte)
- Audio de words/letters/numbers/fundamentos nuevos vía `generate-narrations.js` (ElevenLabs → Cloudinary; **cuesta créditos**).
- Imágenes para vocab-visual/letras/números (fuente y subida vía `/admin/upload`). Los módulos **degradan elegante** sin media (muestran texto+significado).

## 6. Riesgos y mitigaciones
- **BD de producción compartida:** todo write pasa por backend/seed con backup + rollback (patrón `seed-foundations.js`). Nada de queries destructivas ad-hoc.
- **Borrado de contenido:** siempre backup antes; F0 borra solo lo "obvio", lo dudoso se marca.
- **Flip de fuente de la verdad (F2):** documentar y ajustar `seed-foundations.js` para que un re-seed no pise ediciones del admin.
- **RN-safe / React compiler:** los 2 módulos nuevos siguen las reglas duras de `CLAUDE.md` (habrá app React Native).
- **Volumen de autoría:** ~397 significados + oraciones de ~35 niveles flacos + 18 apagados. Se entrega por lotes revisables en admin, no de una.

## 7. Abierto / para revisión
- ~~**¿Por qué están `enabled=false` esas ~18 secciones?**~~ **RESUELTO (F0):** el contenido era correcto y on-topic; no estaban apagadas por malas. 14 niveles revividos (139 oraciones). La excepción real fue L55 "Opposites" (formato roto → F1).
- **Rango de números:** propuesto 1–20 + decenas hasta 100. Confirmar. **(decisión de F3b — no bloquea F3a).**
- ~~**L32 vs L24 "reflexive pronouns":**~~ **RESUELTO (F0):** L32 está vacío (0/0) y L24 tiene el contenido bueno (8 oraciones) → L32 es duplicado; consolidar/retirar su nodo en F3.
- **Oraciones retiradas en F3:** ¿borrar definitivo o archivar desactivadas? **(decisión de F3b — no bloquea F3a).**
- **Imágenes:** fuente (banco propio, generadas, libres) — se define en F-media.
- ~~**Tamaño de tramo (F3e):**~~ **RESUELTO (grilling 2026-07-22):** 6–7 por sesión (`ceil(total/ceil(total/7))`); packs ≤7 completos. También resueltos ahí: completitud en **dos niveles** (progress=respondido 1×, corona=mastery 100%), **gemas 1×/día por nodo**, y ejecución de F3e **completa de una** (no por slices).
- **Repaso global (F3e, futuro):** ¿los ítems `done` de `item_progress` deberían alimentar el SRS/review general (como hoy las oraciones)? No bloquea F3e; se decide cuando el dominio por ítem esté en prod.
- **Fundamentos con dominio por ítem:** `item_progress` ya contempla `pronunciation|grammar`; cablear sus lecciones al mismo motor de tramos queda para después del piloto de sección 2.

## 8. Fuera de alcance
- Rediseño del panel admin (se extiende el existente, no se rehace).
- Historias con personajes / voces nuevas (diferido en el spec de rediseño total).
- Cambios al motor de juegos, torneo, retos, SRS (ya entregados).
