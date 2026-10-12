# Secciones parejas del Camino — diseño

- **Fecha**: 2026-10-12
- **Repos afectados**: `dots-backend` (un script de datos nuevo). En
  `dots-webapp` solo este documento: no cambia código en ninguno de los dos.
- **Estado**: aplicado en producción el 2026-10-12 con
  `dots-backend/scripts/rebalance-sections.js` (respaldo
  `scripts/out/backup-rebalance-sections-2026-10-12T23-22-50-298Z.json`; se
  deshace con `npm run sections:rebalance -- --rollback <respaldo>`). Plan en
  `docs/superpowers/plans/2026-10-12-secciones-parejas.md`.
- **Predecesoras**: `2026-07-22-contenido-camino-y-modulos-design.md` (F3b, que
  convirtió la sección 1 en módulos) y `2026-09-29-tiles-de-modulos-design.md`
  (la fusión de duplicados que dejó cuatro nodos retirados).

## El problema, medido

Consultado en producción el 2026-10-12, en solo lectura. Nodos visibles por
sección, sin contar el checkpoint, con el mismo filtro que `GET /path` (nodo
`enabled` y, si es `practice`, nivel `enabled`):

| Dificultad | Secciones (`section.id` 1–12) | Total |
|---|---|---|
| Beginner (1) | 56 · 13 · 13 · 4 | 86 |
| Intermediate (2) | 7 · 7 · 5 · 7 | 26 |
| Advanced (3) | 2 · 1 · 1 · 11 | 15 |

La sección 1 se quedó con casi todo en julio: F3b convirtió sus 25 temas de
vocabulario en módulos y le intercaló los fundamentos, las letras, los números
y las lecturas. Las secciones 2 a 12 tienen solo los niveles de gramática de
siempre. Resultado: una sección de 56 nodos y tres de 1 o 2.

Dos defectos que salieron en la misma medición:

- **«Las decenas» (nodo 143) está después del checkpoint de la sección 1**
  (posición 270; el checkpoint, 260), lejos de «Números 1–20» (posición 20).
  F3b quería ponerlo contiguo.
- **El checkpoint de la sección 1 no tiene preguntas.** El examen solo usa
  oraciones de niveles `practice` atados a la sección por `levels.id_section`
  (`loadSectionSentenceCounts` en `path.service.ts`), y la sección 1 no tiene
  ninguno. El nodo se ve desbloqueado, su botón lleva a `/checkpoint`, y al
  empezar el backend responde 400 y la página dice «No se pudo iniciar el
  checkpoint. ¿Ya superaste esta sección?».

## Decisiones tomadas en conversación

1. **Secciones de unos 8 nodos, entre 7 y 9.** Es el tamaño que reparte parejo
   las tres dificultades (26 = 9+9+8; 15 = 8+7). Se descartaron ~10 (de 7 a 10)
   y ~13 (de 12 a 15, que dejaba Advanced en una sola sección).
2. **Mismo orden; solo se mueven los cortes, siempre dentro de su
   dificultad.** Nadie ve un nodo en otro orden, salvo «Las decenas» (punto 6).
   Se descartó reagrupar por tema.
3. **Las dificultades no se emparejan en este cambio.** Quedan 86, 26 y 15
   nodos, en 11, 3 y 2 secciones. Mover el límite entre dificultades con el
   mismo orden dejaría Beginner solo con módulos, lo que rompe el placement
   (empieza en Beginner y saca sus preguntas de las oraciones de los niveles
   de gramática de esa dificultad: `placement.service.ts`, `start`) y pondría
   *verb to be* o *articles* en Intermediate. Repartir por nivel CEFR se
   descartó: es otro cambio, y no corresponde clasificar a los alumnos por A, B
   o C. Emparejar las dificultades queda para un proyecto de contenido nuevo
   para Intermediate y Advanced: con la regla de ~8, cada 8 nodos nuevos son
   una sección más.
4. **Las secciones sin niveles de práctica no tienen checkpoint.** Son Level 1
   a Level 7, que solo tienen módulos. No se pueden saltar una por una con un
   test; el placement puede seguir saltándose Beginner entero. Un checkpoint
   que examine módulos sería una función nueva con su propio spec.

Por defecto, y Sergio no los objetó:

5. Los nombres siguen el formato «Level N», renumerados del 1 al 16 en el orden
   del Camino.
6. «Las decenas» pasa a ir justo después de «Números 1–20». Es el único nodo que
   cambia de orden.
7. Se reutilizan las 12 secciones que existen y se crean 4. No se borra
   ninguna.

## A quién afecta (medido)

- 25 estudiantes y 3 admins. **El cambio no le mueve nada a ningún alumno**:
  el único usuario no admin con progreso es la cuenta 8 (según las notas del
  rediseño del Camino, `claude-test-lp`, de prueba), que completó «El verbo TO
  BE» (nodo 109). Su nodo actual, «Saludos» (108), no cambia.
- `section_progress`, `difficulty_progress` y `checkpoint_attempts` no tienen
  filas: nadie ha saltado una sección ni una dificultad por test, y nadie ha
  intentado un checkpoint.
- `levels.id_section` coincide con la sección de su nodo en los 69 niveles de
  práctica.
- El progreso vive en el nodo (`node_progress`) o en el nivel
  (`levels_progress`), no en la sección, y `GET /path` recalcula el avance de
  cada sección a partir de sus nodos. Mover nodos no le quita progreso a nadie.

## El reparto

Los cortes salen de tamaños iguales, y cada corte se mueve como mucho un nodo
para que ninguna sección empiece con una lectura y para no separar pares: el
plural con la S final, el presente simple con DO/DOES, *verb to be* con
*do/does*, *I don't like it* con *I like it* y los tres tiempos perfectos. Las
lecturas van en cursiva. Entre paréntesis, `path_nodes.id`.

### Beginner: 86 nodos en 11 secciones

| Sección | `section.id` | Nodos | Contenido, en orden | Checkpoint |
|---|---|---|---|---|
| Level 1 | 1 | 8 | Saludos (108) · El verbo TO BE (109) · ship vs sheep (110) · Frases de supervivencia (111) · Palabras gratis (112) · El abecedario (1) · *What makes the moon shine?* (137) · cat vs cut (113) | — |
| Level 2 | 2 | 8 | Números 1–20 (2) · Las decenas (143) · days of the week (3) · A, AN y THE (114) · colors (4) · *How do fish breathe underwater?* (138) · Adjetivos (115) · months of the year (5) | — |
| Level 3 | 3 | 8 | El sonido TH (116) · family (6) · El posesivo 'S (117) · clothes (7) · El plural con -S (118) · La S final (119) · verbs (8) · *What is a volcano?* (139) | — |
| Level 4 | 4 | 9 | Presente simple (120) · time (9) · Preguntas con DO y DOES (121) · shapes (10) · S inicial (122) · kitchen elements (11) · Falsos amigos (123) · foods (12) · *FUN FACT 1* (140) | — |
| Level 5 | 8 | 8 | This, that, these, those (124) · meals (13) · La H sí suena (125) · sports (14) · CAN (126) · seasons (15) · weather (16) · *How deep is the ocean?* (141) | — |
| Level 6 | 11 | 7 | V vs B (127) · professions (17) · There is / There are (128) · personal care products (18) · SH vs CH (129) · animals (19) · La ciudad (130) | — |
| Level 7 | 12 | 8 | daytime (20) · *How does a telephone work?* (142) · Frases para aprender (131) · fruits (21) · furniture (22) · house (23) · body (24) · school (25) | — |
| Level 8 | nueva (13) | 8 | articles (27) · demonstrative pronouns (28) · personal pronouns (29) · Preguntas con What, Where, Who… (135) · possesive adjectives (30) · verb to be (31) · reflexive pronouns (32) · do/does (33) | 39 |
| Level 9 | nueva (14) | 8 | possesive pronouns (34) · Exceptions, singular to plural (35) · complements (36) · prepositions (37) · frequency adverbs (38) · was/were (40) · indefinite (42) · verbs in past (irregular) (43) | 53 |
| Level 10 | nueva (15) | 7 | comparative superlative (44) · reciprocal (45) · like / alike (46) · interrogatives (47) · Rather/Such (48) · quantifiers (49) · since / for (50) | 58 |
| Level 11 | nueva (16) | 7 | simple past (51) · El pasado -ED (136) · past progressive (52) · Future simple (54) · Future progressive (55) · How much/How many (56) · Modal verbs (57) | 88 |

### Intermediate: 26 nodos en 3 secciones

| Sección | `section.id` | Nodos | Contenido, en orden | Checkpoint |
|---|---|---|---|---|
| Level 12 | 5 | 9 | Opposites (59) · Exclamations (60) · Compound words (61) · Actions (62) · Present perfect (63) · Past perfect (64) · Future perfect (65) · Connectors (67) · Phrasal verbs (68) | 66 |
| Level 13 | 6 | 9 | Conditionals (69) · Imperative (70) · Shall (71) · Used to (72) · Active/passive (73) · Had better (75) · Reported speech (76) · Suppose (77) · Have/Get something done (78) | 74 |
| Level 14 | 7 | 8 | Wish (79) · Should have (81) · Can/Could have (82) · Will be doing (83) · Will have done (84) · Use of For (85) · Use of Let (86) · Like (87) | 80 |

### Advanced: 15 nodos en 2 secciones

| Sección | `section.id` | Nodos | Contenido, en orden | Checkpoint |
|---|---|---|---|---|
| Level 15 | 9 | 8 | about (89) · questions tags (90) · the ING form (92) · Idioms (94) · slangs words (96) · formal vs informal (97) · ways to say I don't like it (98) · Ways to say I like it (99) | 91 |
| Level 16 | 10 | 7 | How to introduce yourself (100) · ways to say "calm down" (101) · ways to say "I miss you" (102) · ways to say "no" (103) · ways to say "congratulations" (104) · Antonyms (105) · Other prepositions (106) | 93 |

### Las secciones por dentro

El Camino ordena las secciones por `section.id` dentro de cada dificultad
(`path.service.ts` y `path-neighbors.service.ts`: `sections: { id: 'ASC' }`;
`skip-applier.service.ts`: `ORDER BY d.id, s.id, l.id`). Por eso la tabla
asigna los tramos de cada dificultad a sus ids en orden ascendente, y no hace
falta tocar código:

- Intermediate se queda con 5, 6 y 7; Advanced, con 9 y 10.
- Las secciones con `section.id` 8, 11 y 12 sobran en sus dificultades y pasan a Beginner
  (`id_difficulty = 1`), como Level 5, 6 y 7.
- Las 4 nuevas salen de la identidad de `section.id` (`GENERATED ALWAYS AS
  IDENTITY`, secuencia `dots.section_id_seq`). En producción esa secuencia
  está en 1 sin usar, porque las 12 secciones se cargaron con ids explícitos
  (medido el 2026-10-12): el apply la alinea hacia adelante con el máximo (12)
  antes de insertar, así que las nuevas son 13 a 16, y el rollback no la
  devuelve. El script comprueba igual que sean mayores que 12: si no,
  quedarían ordenadas antes que alguna sección reutilizada.

Un humano que lea la tabla `section` verá ids intercalados entre dificultades.
Es cosmético: lo que ve el alumno es el nombre, y el orden lo da el id dentro
de cada dificultad.

### Checkpoints

Level 8 a Level 16 llevan un checkpoint al final; Level 1 a Level 7, ninguno.
Las secciones con `section.id` 5, 6, 7, 9 y 10 conservan el suyo (66, 74, 80,
91 y 93). Las cuatro nuevas toman 39, 53, 58 y 88, que quedan libres en
secciones que pasan a ser de módulos. Los otros tres libres (26, 95 y 107),
entre ellos el de la sección 1 que hoy falla, pasan a `enabled = false`, igual
que la fusión de duplicados retiró nodos. Cada sección con checkpoint tiene al
menos 6 niveles de práctica de 8 oraciones o más, así que todas superan las 5
oraciones mínimas (`CHECKPOINT_MIN_SENTENCES`).

Después del cambio no queda ningún checkpoint sin preguntas, así que el error
engañoso de `/checkpoint` deja de poder verse por esta vía.

### Lo que no se mueve

- **Los 26 niveles antiguos sin nodo**: los 25 de vocabulario que F3b
  convirtió en módulos (1–18 y 44–50, `id_section = 1`) y el L32 (`id_section
  = 3`), cuyo nodo retiró la fusión de duplicados. No tienen oraciones activas,
  así que no cuentan para checkpoint ni placement, y no aparecen en el Camino.
  De su sección depende el salto por test, que con estas decisiones solo puede
  venir del placement (que salta Beginner entero) o de la caja de modo admin.
- **Los 4 nodos ya retirados** (132, 133 y 134 en la `section.id` 1; 41 en la
  3).
  Siguen en su sección, pero en posiciones altas, porque el UNIQUE
  `(section_id, position)` incluye las filas retiradas: el 41 ocupa hoy la
  posición 20 de la sección 3, que la numeración nueva va a usar.

## El script

`dots-backend/scripts/rebalance-sections.js`, con el patrón obligatorio del
backend (su CLAUDE.md, reglas 1 y 2): cliente `pg`, **dry-run por defecto**,
`--apply`, respaldo JSON en `scripts/out/` y `--rollback <respaldo>`. El
`--apply` en producción se corre solo con el sí explícito de Sergio en la
conversación.

**El reparto va escrito en el script** como lista explícita de ids de nodo por
sección, con su checkpoint: exactamente las tablas de arriba. No se calcula al
vuelo, para que el diff del script sea la revisión del reparto.

**Antes de escribir nada**, el script lee la BD y aborta sin tocarla si no
coincide con lo que espera: un nodo visible que no está en el reparto o que
está dos veces, un nodo del reparto que no existe, está retirado o cambió de
tipo, una sección que no existe o no está en la dificultad esperada, o un
nodo retirado que no es uno de los 4 conocidos.

**Orden de operaciones, todo en una transacción:**

1. Si la secuencia de `section` va atrás del máximo, alinearla con él (solo
   hacia adelante). Crear las 4 secciones nuevas en Beginner y comprobar que
   sus ids son mayores que 12.
2. Actualizar `name` e `id_difficulty` de las 12 existentes. `section.name` no
   tiene índice único, así que basta un paso.
3. Llevar todos los nodos a posiciones temporales únicas (por ejemplo,
   `1000000 + id`) para que el UNIQUE no salte a mitad del movimiento.
4. Escribir `section_id` y `position` finales: 10, 20, 30… dentro de cada
   sección, con el checkpoint en la última. Retirar los checkpoints 26, 95 y
   107. Llevar los 7 nodos retirados (los 4 de antes y estos 3) a
   `10000 + id` dentro de su sección actual.
5. Igualar `levels.id_section` a la sección del nodo en los 69 niveles de
   práctica.
6. Verificar (siguiente apartado). Si algo falla, ROLLBACK.
7. Escribir el respaldo y hacer COMMIT. El respaldo va antes del COMMIT, como
   en `merge-duplicate-nodes.js`: si el COMMIT fallara, el rollback de ese
   respaldo solo reescribe valores que ya están.

**El respaldo** guarda las 12 secciones como estaban (`id`, `name`,
`id_difficulty`), los ids de las 4 creadas, los 143 nodos (139 activos y 4 retirados) como estaban
(`id`, `section_id`, `position`, `enabled`) y el `id_section` previo de los 69
niveles. **El rollback** devuelve los nodos a posiciones temporales, restaura
nodos, niveles y secciones, y borra las 4 secciones creadas cuando ya no las
referencia ningún nodo ni nivel. Va en una transacción. Se niega si
`section_progress` tiene alguna sección saltada por test o alguna fila apunta a
una sección creada, y no devuelve la secuencia a 1 (dejarla alineada no cambia
datos). El CLI rechaza argumentos desconocidos y `--apply` junto con
`--rollback`, antes de conectarse.

### Verificaciones (dry-run, y apply antes del COMMIT)

1. Cada nodo visible aparece una sola vez.
2. La secuencia global de nodos que no son checkpoint (dificultad → sección →
   posición) es idéntica a la de antes, salvo «Las decenas» (143), que va justo
   después de «Números 1–20» (2).
3. Todas las secciones tienen entre 7 y 9 nodos sin contar el checkpoint, y
   hay 11, 3 y 2 por dificultad.
4. Las secciones Level 8 a 16 tienen exactamente un checkpoint, en la última
   posición, y al menos 5 oraciones activas para el examen, contadas como
   `loadSectionSentenceCounts`. Las Level 1 a 7 no tienen checkpoint visible.
5. No hay dos nodos en la misma `(section_id, position)`, contando los
   retirados.
6. Cada nivel de práctica tiene `id_section` igual a la sección de su nodo.
7. Los nombres van de «Level 1» a «Level 16» en el orden del Camino, sin
   repetirse.

El dry-run imprime el reparto resultante sección por sección (nombre, id,
dificultad, nodos con su posición) y el resultado de cada verificación.

## Verificación después del apply

Con el navegador integrado sobre producción (la sesión se inicia en ese
panel, no en el Chrome de Sergio):

- El Camino muestra 11, 3 y 2 secciones, con los nombres y tamaños de las
  tablas. La barra segmentada del banner tiene un segmento por sección.
- Las secciones Level 1 a 7 no tienen checkpoint. En Level 8 a 16 está al
  final y `GET /path` lo da por disponible. La portada del examen de Level 12
  (`section.id` 5) se abre, pero el examen no se empieza: empezarlo escribe un
  intento en producción, y uno en una sección creada bloquearía el rollback.
- «Las decenas» aparece justo después de «Números 1–20».

El nodo actual de cada alumno con progreso lo calcula el dry-run, antes y
después del cambio, con la misma regla que `findCurrentNodeId`: la cuenta 8
sigue en «Saludos» (108). Después del apply no se puede comprobar en el
navegador, porque no entramos con esa cuenta.

## Fuera de alcance

- Emparejar las dificultades: requiere contenido nuevo para Intermediate y
  Advanced, cada nodo con su tile. Hoy no hay Midjourney.
- Un checkpoint que examine módulos (vocabulario, letras, números…).
- Repartir por nivel CEFR (descartado, decisión 3).
- Mover los 25 niveles antiguos de vocabulario a la sección de su módulo.
- El fallback de `path-container.tsx` a `GET /levels` (solo se usa si
  `GET /path` falla) agrupa por `levels.id_section` y seguirá mostrando esos 25
  niveles en «Level 1», como hoy.

## Riesgos conocidos

- **La pose de Doty de cada sub-banner cambia** en las secciones reutilizadas:
  `sectionPose(section.id)` (`lib/path-view.ts`) la elige por id. Es cosmético.
- **Ids intercalados en la tabla `section`** (ver «Las secciones por dentro»).
  Si en el futuro se insertan secciones en medio de una dificultad, hará falta
  una columna de orden en `section`; hoy no.
- **Cambiar la BD a mano entre el dry-run y el apply** (por ejemplo, desde
  `/admin/path`) haría abortar el apply por las comprobaciones previas, que se
  repiten dentro de la transacción. Es el comportamiento buscado.
