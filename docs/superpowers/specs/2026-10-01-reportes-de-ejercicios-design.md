# Reportes de ejercicios: el alumno avisa, el admin arregla — diseño

**Fecha:** 2026-10-01
**Repos afectados:** `dots-webapp` y `dots-backend`
**Estado:** aprobado en conversación («avanza con tus propuestas»), pendiente de plan

## Problema

Un alumno que ve una falta de ortografía, una oración que no se entiende o una
respuesta suya que debería contar como buena no tiene por dónde decirlo. Hoy la
calidad del contenido se revisa a mano y en frío (`dots-backend/scripts/triage-content.js`),
sin la señal de quien de verdad usa el ejercicio.

Lo que el código muestra y condiciona el diseño:

1. **Todas las respuestas son toques.** Elegir una opción, armar con fichas o
   tocar letras: no hay ningún `<input>` de texto en los flujos de aprender.
   Cada ítem tiene **una sola respuesta correcta** (`m_word`, `answer`,
   `word_a/word_b`…) y ninguna tabla tiene un campo de alternativas.
2. **Las opciones incorrectas se sortean sin mirar si también encajan.** En las
   oraciones salen de las `m_word` de otras oraciones (del nivel en práctica,
   de la sección en el checkpoint, de la dificultad en placement, 40 al azar en
   repaso, de todo el mazo en los juegos) y solo se descartan las idénticas.
   «I __ happy» puede ofrecer `feel` como incorrecta. Ese es el origen real de
   «mi respuesta debería estar bien».
3. **No hay una franja común de «¡Correcto!/Incorrecto».** Práctica, gramática
   y repaso colorean en el sitio y cambian el botón a Continuar; letras,
   números y la escucha de vocabulario avanzan solas a los 0,8 s; checkpoint,
   placement y lecturas esconden a propósito si acertaste.
4. **Las oraciones no tienen traducción.** `sentences` guarda el inglés con su
   hueco y la palabra que falta; la traducción solo existe en vocabulario
   (`meaning`) y letras (`example_meaning`).
5. **`sentences.id` es `bigint`** y llega como string a la práctica; el resto
   de ids de contenido son `int` y chocan entre tablas (el 12 de `vocab_items`
   no es el 12 de `sentences`).
6. **Tres juegos no mandan id de su contenido**: Torre de Palabras, Palabra del
   Día y Mini Crucigrama. Dot Bombs usa un contador local, y las trampas de
   ¿Verdad o Trampa? que vienen de `FALSE_FRIENDS` tienen ids negativos y viven
   en el código, no en la BD.
7. **No existe nada parecido** a reportes, flags o comentarios en ninguno de los
   dos repos.

## Decisiones tomadas en conversación

- **Alcance: todo**, juegos incluidos. En los juegos se reporta desde la
  pantalla de resultado, eligiendo el ítem de la ronda.
- **Banderita arriba, siempre en el mismo sitio** de cada pantalla de
  ejercicio. Si ya respondiste, adjunta tu respuesta; si la pantalla avanzó
  sola, la hoja deja elegir «este» o «el anterior». (Se descartó «tras
  responder, junto a Continuar» al ver el punto 3: quedaba en un sitio distinto
  en cada pantalla y en varias no había momento para tocarlo.)
- **Siete motivos según el ejercicio**, con casillas (se puede marcar más de
  uno) y comentario opcional, obligatorio en «Otra cosa».
- **Bandeja agrupada por ejercicio**; los «Algo no funciona» van aparte, uno por
  uno y con contexto técnico.
- **Aceptar respuestas alternativas** cuando el alumno tiene razón, incluido el
  orden de palabras en «Arma la oración».
- **Aviso al alumno + gemas si tenía razón**; si se descarta, aviso con nota
  opcional del admin y sin gemas.
- **El admin se entera por un contador** en el panel, en la entrada «Panel de
  admin» de Ajustes y en el chip ADMIN. Sin correo.
- **También un «Reportar un problema» general** en la hoja de Ajustes.
- **Todo junto**: un solo plan y una sola subida.
- **Enfoque A**: cada reporte guarda una foto de lo que vio el alumno, los
  grupos se calculan al consultar y las alternativas viven en su propia tabla.
  Descartado B (una entidad «incidencia» con reportes colgando): dobla el
  modelo y solo se justifica con mucho volumen o varios revisores. Descartado
  guardar las alternativas como columnas de `sentences`/`grammar_items`: sin la
  migración aplicada, TypeORM rompería todas las consultas de esas tablas.

Detalles que se resolvieron con la recomendación por defecto (la tabla que
Sergio aprobó con «avanza»):

| Punto | Decisión |
|---|---|
| Gemas por reporte aceptado | 10 (una lección da 5, el checkpoint 15). Los admins no ganan |
| Idioma de la sección Reportes | Español, como el estudio de voces y el modo admin |
| Aviso al alumno | Hoja al entrar al Camino, espera a que nada tape la pantalla, junta varios resultados y se queda hasta que la cierre |
| Dónde hay alternativas | Oraciones (palabra del hueco y orden de «Arma la oración»/Constructor) y gramática. En vocabulario, pronunciación, letras y números el arreglo es editar |
| «Debería estar bien» | No sale en checkpoint, placement ni lecturas: ahí el alumno no sabe si falló |
| Duplicados y abuso | Un mismo alumno y ejercicio pendiente se fusiona; tope de 30 reportes en 24 h por alumno |
| Bugs | Viajan con pantalla, navegador, versión y los últimos errores de la app; sin captura ni correo |

## Concepto

```
alumno: ⚑ → [¿cuál?] → ¿qué pasó? (motivos) → comentario → Enviar → ¡Gracias!
                                                     │
                                          content_reports (con foto)
                                                     │
admin:  Reportes (3) → grupo «I __ happy» · 4 alumnos → ver respuestas
        → Editar | Aceptar «feel» | Apagar → Arreglado / Descartar (+ nota)
                                                     │
alumno (próxima entrada al Camino): «Arreglamos la oración que reportaste · +10»
```

## 1. Lado alumno

### 1.1 La banderita

Un glifo nuevo `bandera` en `components/ui/icon/paths.tsx`, familia glifo
(grosor 3,5, `viewBox` 48, rellenos solo en los colores que admite
`check-icons.mjs`). Ningún emoji (regla 11). Botón con `aria-label="Reportar un
problema"` y área táctil de 40 px aunque el glifo mida 20.

`components/report/report-flag.tsx` es el botón y es dueño del estado de la
hoja: lee los candidatos (ver 1.2), abre `ReportSheet` al tocarlo y congela la
lista en ese momento, para que nada cambie bajo el dedo si la pantalla avanza
sola. Dónde se monta:

| Superficie | Dónde | Candidatos |
|---|---|---|
| Práctica | `LessonTopBar`, a la derecha | ítem actual y el anterior respondido |
| Gramática | `LessonTopBar` en la práctica; cabecera de la explicación | ítem actual y anterior; en la explicación, la píldora |
| Pronunciación | `LessonTopBar` | ítem actual y anterior; en la portada, la unidad |
| Vocabulario | `LessonTopBar` de cada etapa | presentación: la palabra; escucha/inversa: actual y anterior; emparejar: las de la ronda |
| Letras y Números | fila superior de progreso (se añade donde no hay) | actual y anterior; emparejar: las de la ronda |
| Checkpoint y Placement | `LessonTopBar` | pregunta actual, con la opción elegida |
| Repaso | `LessonTopBar` | actual y anterior |
| Lecturas | la barra propia de la lectura | la lectura entera y cada pregunta del quiz |
| Juegos | pantalla de resultado (ver 1.5) | los ítems de la ronda |

**Cómo llega lo que hay en pantalla a la banderita.** En vocabulario, letras y
números el estado del ejercicio vive en componentes hijos (`ListenQuiz`,
`AudioChoiceQuiz`, `MatchQuiz`, `MatchRound`) y la barra la pinta el padre, así
que pasar props no alcanza. Un store de módulo, `lib/report-targets.ts` (mismo
patrón que `lib/admin-mode.ts`: puro, `useSyncExternalStore`), guarda lo que la
pantalla publica: `usePublicarObjetivos(lista)` desde el componente que conoce
el ejercicio (lo retira al desmontarse) y `registrarRespondido(objetivo)` desde
el handler que corrige. `LessonTopBar` pinta `ReportFlag` a la derecha cuando
hay algo publicado, sin props nuevas; las pantallas sin `LessonTopBar` montan
`ReportFlag` en su fila superior. Publicar compara una firma (claves y
respuestas) y no avisa si nada cambió, así que no hay bucles de render.

### 1.2 Qué se reporta: `ReportTarget`

Cada pantalla describe lo que tiene delante con un objeto puro
(`lib/report.ts`):

```ts
type ReportTarget = {
  key: string;                    // "sentence:123" — identidad para fusionar y elegir
  type: ReportTargetType | null;  // null = el juego o la pantalla en general
  id: string | null;              // string siempre: sentences.id es bigint
  surface: ReportSurface;         // "practice", "lesson-vocab", "game:dotaxi"…
  mode?: string;                  // "complete", "buildUp", "listen", "match"…
  label: string;                  // lo que se lee en el selector «¿cuál?»
  snapshot: ReportSnapshot;       // la foto: prompt, opciones, imagen, audio, significado
  answer?: string;                // lo que eligió o armó el alumno
  expected?: string;              // la correcta, si el cliente la conoce
  wasWrong: boolean | null;       // null = la pantalla no revela si falló
  hasAudio: boolean;
  hasImage: boolean;
  context: Record<string, string | number>; // levelId, nodeId, sectionId, readingId…
};

type ReportTargetType =
  | "sentence" | "word" | "vocab_item" | "grammar_item" | "grammar_pill"
  | "pronunciation_item" | "pronunciation_unit" | "letter_item"
  | "number_item" | "reading" | "false_friend";
```

**El anterior.** El store guarda también el último ítem respondido, que la
pantalla registra desde su handler de corregir (un evento, nunca un efecto:
regla 3). `candidatosDeReporte(actuales, anterior)` devuelve la lista: si algo
de lo actual ya está respondido, solo lo actual; si no y hay anterior, se añade
al final (o sustituye a su gemelo sin responder, si el ítem se re-encoló). Sirve
igual para las pantallas que avanzan solas: cuando el alumno toca la banderita,
«el anterior» es justo el que acaba de pasar.

Los constructores por tipo (`objetivoDePractica`, `objetivoDeOracion`,
`objetivoDeVocab`…) viven en `lib/report.ts`, así cada pantalla arma sus
objetivos igual y con pocas líneas. La píldora de gramática y la unidad de
pronunciación necesitan su id, que hoy no viaja al cliente: el contenido del
nodo (`GET /path/nodes/:id`) gana `refId` en esos dos tipos.

### 1.3 La hoja

`components/report/report-sheet.tsx`, hoja inferior en móvil y centrada en
escritorio, con el patrón de `install-sheet.tsx`: `OverlayPortal`,
`bloquearScroll`, Escape, botón de cerrar y fondo que cierra. RN-safe: todo con
toques; la caja de comentario no es una entrada para jugar (la regla 2 prohíbe
`<input>` solo para jugar).

1. **¿Sobre cuál?** Solo si hay dos candidatos o más. Cada uno con su `label` y,
   si se respondió, «elegiste «feel»».
2. **¿Qué pasó?** Casillas con los motivos que aplican a ese objetivo:

| Clave | Texto | Sale si |
|---|---|---|
| `answer` | Mi respuesta debería estar bien | `wasWrong === true`; debajo, «Elegiste «x» · esperábamos «y»» |
| `typo` | Hay una falta de ortografía | hay objetivo |
| `meaning` | «La oración no se entiende» (`sentence`, `grammar_item`), «La traducción no cuadra» (`vocab_item`, `false_friend`), «La explicación no se entiende» (`grammar_pill`, `pronunciation_unit`), «La lectura no se entiende» (`reading`) | uno de esos tipos; no en `word`, `pronunciation_item`, `letter_item` ni `number_item`, que no muestran frase ni traducción |
| `audio` | El audio está mal | `hasAudio` |
| `image` | La imagen no corresponde | `hasImage` |
| `bug` | Algo no funciona | siempre |
| `other` | Otra cosa | siempre; exige comentario |

Sin objetivo —«El juego en general» o el reporte desde Ajustes— solo salen
`bug` y `other`.

3. **Cuéntanos más** (opcional, 500 caracteres).
4. **Enviar reporte.** Valida en el handler: al menos un motivo y comentario si
   hay `other`, con el error en línea junto al botón. Mientras envía, el botón
   dice «Enviando…». Si falla la red, el error se queda en la hoja con
   «Reintentar» y nada se pierde. Un 429 se lee «Ya mandaste muchos reportes
   hoy. ¡Gracias! Vuelve mañana».
5. **¡Gracias!** Doty contento, «Lo revisamos» y «Volver al ejercicio». Reportar
   no gasta vidas ni toca el progreso.

La lógica de qué motivos salen, la validación y el armado del cuerpo viven en
`lib/report.ts`, puro y bajo `node --test`. La hoja solo pinta.

Detalles por superficie que el plan concreta:

- **Práctica**: la respuesta es la opción elegida o, en «Arma la oración», la
  oración armada (fichas unidas por espacios). Hoy viven en el estado local de
  `practice-container.tsx` y hay que subirlas a la página al confirmar.
- **Checkpoint, placement y lecturas**: `wasWrong: null`, así que nunca sale
  `answer`; sí se adjunta la opción elegida, para contexto del admin.
- **Emparejar** (vocabulario y números): varios ítems en pantalla, el selector
  los lista todos.

### 1.4 Reporte general desde Ajustes

En la sección «Acciones» de `settings-sheet.tsx`, encima de «Cambiar avatar»,
una fila «Reportar un problema». Abre la misma hoja en modo `app`: sin
selector de objetivo, con «¿Dónde pasó?» como chips (Camino, Repaso, Retos,
Juegos, Perfil, Tienda, Otra) y solo los motivos `bug` y `other`. Va con
`surface: "app"` y sin `type`, así que cae en la pestaña Bugs.

### 1.5 Juegos

`components/report/report-button.tsx` es un botón fantasma «Reportar un
problema» que abre la hoja con el selector ya poblado: primero los ítems que
fallaste, luego los acertados (`ordenarParaJuego`) y al final «El juego en
general» (`type: null`, cae en Bugs). `GameResult` gana una prop
`reportables?: ReportTarget[]` y lo pinta bajo «Salir». Los tres juegos que no
usan `GameResult` lo montan en su propio final: el `ResultCard` de ghost-race y
el bloque de partida terminada de Palabra del Día y Mini Crucigrama.

Cada juego acumula en un ref los ítems que llegó a ver, con la respuesta del
alumno y si falló:

| Juego | Ítem | Tipo |
|---|---|---|
| Escucha Rápida, Carrera Fantasma, Dotaxi, Constructor | la oración | `sentence` |
| ¡No lo revientes! | la oración (su imagen y su palabra) | `sentence` |
| Dot Match, ¿Verdad o Trampa? | el par EN–ES | `vocab_item`; la trampa de `FALSE_FRIENDS`, `false_friend` con su id negativo |
| Memoria, Dot Bombs | la palabra con imagen | `word` |
| Torre de Palabras | la palabra y su categoría | `vocab_item` |
| Palabra del Día | la palabra del día | `vocab_item` |
| Mini Crucigrama | cada palabra del día | `vocab_item` |

Para los cuatro últimos el backend tiene que empezar a mandar ids (sección 5).

### 1.6 El aviso de vuelta

`components/report/report-notice-watch.tsx`, montado en el layout del hub junto
a `RivalWatch`, con la misma mecánica que ese: al entrar a `/levels` pide
`GET /me/report-notices`; si hay algo, espera a que la pantalla esté destapada
(`[data-doty-entrada]`, `hayScrollBloqueado`, pestaña oculta y, además, que no
haya un aviso de rival visible, `[data-rival-alert]`, atributo que se añade a
`rival-alert.tsx`), con el mismo techo de 20 s, y entonces pinta
`report-notice.tsx`.

Es una **hoja de verdad**: toma el scroll con `bloquearScroll`, así que pistas,
aviso de rival e invitación a instalar esperan a que se cierre, porque los tres
ya respetan ese tapón. Lleva a Doty (`aplaudiendo` si hubo algo arreglado,
`pensando` si todo se descartó), hasta tres resultados con su fragmento de
ejercicio y la nota del admin, «y N más» si hay más, y un chip con el total de
gemas. Se queda hasta que el alumno toca «¡Genial!», que manda
`POST /me/report-notices/seen` con los ids. Si ese POST falla, el aviso vuelve a
salir la próxima vez: es preferible a perderlo.

Las gemas ya se sumaron en el servidor al cerrar el reporte (sección 3.4); el
aviso solo informa, y tras cerrarlo se llama a `bumpCuenta()` para que el HUD
vuelva a pedir el saldo.

## 2. Lado admin

### 2.1 Entrada y contadores

- `NAV_ITEMS` del layout de admin gana «Reportes» (`/admin/reports`) con un
  globo de pendientes, y el dashboard gana su tarjeta.
- `GET /admin/reports/summary` → `{ content, bugs }`: grupos de contenido con
  algo pendiente y reportes de bug pendientes. El globo muestra la suma.
- `hooks/use-report-counts.ts` hace un único fetch compartido (patrón
  single-flight de `use-admin-mode.ts`), solo para perfil 1, y vuelve a pedir
  al resolver algo. Con pendientes, un puntito sobre «Panel de admin» en
  Ajustes y sobre el chip ADMIN.

### 2.2 Bandeja «Contenido»

`app/(app)/admin/reports/page.tsx`, con dos pestañas segmentadas (el patrón de
users/invitations): **Contenido** y **Bugs**, y un filtro **Pendientes /
Cerrados**.

Cada fila de Contenido es un grupo (`type` + `id`):

- el texto del ejercicio tal como lo vio el último alumno («I __ happy today.»),
  con un chip del tipo y dónde vive («Práctica · Nivel 12 Verb to be»);
- el recuento por motivo («3 debería estar bien · 1 ortografía»);
- cuántos alumnos y cuándo llegó el último.

Orden: más alumnos primero; a igualdad, el más reciente. Entra un reporte en un
grupo si tiene objetivo y al menos un motivo distinto de `bug`.

### 2.3 Detalle de un grupo

Se abre en el sitio, cambiando la vista por estado como el resto del admin
(«← Volver a reportes»):

1. **El contenido de ahora**, leído en vivo de su tabla (puede diferir de la
   foto si alguien ya lo editó), con **Editar**, que abre el modal que ya
   existe para ese tipo, y **Apagar/Encender** donde el tipo tenga `enabled`
   (todos menos `words` y `false_friend`). Si el contenido ya no existe, se
   dice y solo queda la foto.
2. **Lo que respondieron**: las respuestas distintas con su recuento («feel ·
   3 alumnos»). En oraciones y gramática, cada una con **Aceptar «feel»**: crea
   la alternativa (de palabra, o de oración si vino de «Arma la oración» o del
   Constructor) y ofrece cerrar como arreglados los reportes con esa respuesta,
   con la nota «Ahora «feel» también vale» editable.
3. **Respuestas que ya valen**: las alternativas aceptadas, cada una con
   «Quitar».
4. **Los reportes**: alumno (con chip «admin» si es perfil 1), motivos,
   comentario, su respuesta, modo y fecha, con casillas. Todas marcadas por
   defecto.
5. **Cerrar los marcados**: «Arreglado» o «Descartar», con una nota opcional
   para el alumno.

### 2.4 Bandeja «Bugs»

Entra todo reporte sin objetivo o que marque `bug`. Una fila por reporte: alumno, dónde («Práctica · Arma la oración», «Ajustes ·
Tienda»), comentario y fecha. Al tocarla se expande en el sitio con el contexto
técnico (ruta, navegador, tamaño de pantalla, si está instalada, versión y los
últimos errores capturados) y el objetivo si lo había, con «Editar» como en el
detalle de contenido. Se cierra igual: Arreglado o Descartar, con nota.

Un reporte con objetivo que marque `bug` y otros motivos sale en las dos
pestañas; es un solo reporte con un solo estado, así que cerrarlo en una lo
quita de las dos.

### 2.5 Editar desde el reporte

El detalle devuelve el contenido en la forma que ya esperan los modales de
admin (`AdminSentence`, `AdminWord`, `AdminReading`…) más el id del padre que
pide cada uno (nivel, pack, píldora, unidad). Se reutilizan `SentenceModal`,
`WordModal` y `ReadingModal` tal cual; los modales de ítem de fundamentos y los
de píldora y unidad hoy son privados de cada `*-manager.tsx` y pasan a
exportarse sin cambiar su comportamiento.

### 2.6 Alternativas en los editores

`SentenceModal` gana una sección «Otras respuestas válidas» con dos listas:
palabras que también caben en el hueco y oraciones armadas en otro orden. El
modal de ítem de gramática gana la de palabras. Ambas añaden y quitan contra
los endpoints de la sección 3.3, sin pasar por guardar el modal.

## 3. Datos y API (backend)

### 3.1 Tablas

`scripts/migrate-reports.js`, con el patrón de `migrate-economy.js`: dry-run
por defecto, `--apply`, backup en `scripts/out/` y `--rollback`. Solo DDL
aditivo.

```sql
CREATE TABLE IF NOT EXISTS dots.content_reports (
  id               serial PRIMARY KEY,
  user_id          integer NOT NULL REFERENCES dots.users(id) ON DELETE CASCADE,
  surface          varchar(40) NOT NULL,
  mode             varchar(40),
  target_type      varchar(30),
  target_id        bigint,
  reasons          text[] NOT NULL,
  comment          text,
  answer           text,
  expected         text,
  was_wrong        boolean,
  snapshot         jsonb NOT NULL DEFAULT '{}',
  context          jsonb NOT NULL DEFAULT '{}',
  status           varchar(12) NOT NULL DEFAULT 'pending',  -- pending | fixed | dismissed
  resolution_note  text,
  resolved_by      integer,
  resolved_at      timestamptz,
  gems_awarded     integer NOT NULL DEFAULT 0,
  notice_seen_at   timestamptz,
  created_at       timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at       timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS content_reports_status_idx  ON dots.content_reports (status, created_at DESC);
CREATE INDEX IF NOT EXISTS content_reports_target_idx  ON dots.content_reports (target_type, target_id);
CREATE INDEX IF NOT EXISTS content_reports_notice_idx  ON dots.content_reports (user_id)
  WHERE resolved_at IS NOT NULL AND notice_seen_at IS NULL;

CREATE TABLE IF NOT EXISTS dots.answer_alternatives (
  id                serial PRIMARY KEY,
  target_type       varchar(30) NOT NULL,   -- sentence | grammar_item
  target_id         bigint NOT NULL,
  kind              varchar(10) NOT NULL,   -- word | sentence
  value             text NOT NULL,
  created_by        integer,
  source_report_id  integer,
  created_at        timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS answer_alternatives_unique
  ON dots.answer_alternatives (target_type, target_id, kind, upper(value));
```

Las dos tablas se leen y escriben con SQL crudo parametrizado, sin entity de
TypeORM (patrón de `awardGems` y `admin-me`): así una tabla ausente es un error
`42P01` que se atrapa, y no una consulta de repositorio que rompe. Un reporte es
feedback sobre el contenido, no progreso, y reiniciar la cuenta no debe
borrarlo; como no hay entity, el test de metadatos de `admin-me.reset.spec.ts`
no la ve y `KEPT_TABLES` no puede listarla (ese test rechaza entradas sin
entity). La decisión queda escrita en un comentario sobre `KEPT_TABLES`.

### 3.2 Endpoints del alumno (`src/modules/reports/`, `JwtAuthGuard` de clase)

- `POST /reports` — `CreateReportDto`: `surface` (lista cerrada, con `game:<key>`
  para los doce juegos), `mode?`, `targetType?`, `targetId?` (string numérico,
  admite negativo para `false_friend`), `reasons` (1–7 claves sin repetir),
  `comment?` (≤ 500), `answer?`/`expected?` (≤ 300), `wasWrong?`, `snapshot` y
  `context` (objetos de ≤ 4 KB serializados). Reglas: `answer` en `reasons`
  exige `answer`; `other` exige `comment`; sin `targetType` solo valen `bug` y
  `other`. Responde `{ id, merged }`.
  - **Fusión**: si el mismo alumno tiene un reporte `pending` del mismo
    objetivo, se actualiza en vez de crear otro: unión de motivos, el
    comentario nuevo si trae uno, y respuesta, foto y contexto del último.
    Los bugs sin objetivo nunca se fusionan.
  - **Tope**: más de 30 reportes creados en 24 h por el mismo alumno → 429.
    Las fusiones no cuentan.
- `GET /me/report-notices` → `{ notices: [{ id, outcome, note, gems, prompt, resolvedAt }] }`:
  los resueltos del alumno sin `notice_seen_at`, de más nuevo a más viejo.
- `POST /me/report-notices/seen` `{ ids }` → marca `notice_seen_at` solo en
  filas del propio alumno.

### 3.3 Endpoints del admin (`AdminGuard` de clase)

- `GET /admin/reports/summary` → `{ content, bugs }`.
- `GET /admin/reports/groups?status=pending|closed` → grupos con `type`, `id`,
  foto del último, dónde vive (nivel, pack, píldora…), recuento por motivo,
  alumnos, último. `closed` devuelve los últimos 100 reportes cerrados
  agrupados igual.
- `GET /admin/reports/groups/:type/:id` → contenido en vivo en forma de admin +
  id del padre, alternativas, respuestas distintas con recuento y los reportes
  con nombre del alumno y si es admin.
- `GET /admin/reports/bugs?status=pending|closed` → reportes de bug con el
  objetivo resuelto si lo hay.
- `POST /admin/reports/resolve` `{ ids, outcome: "fixed"|"dismissed", note? }`
  → `{ resolved, gems }` (sección 3.4).
- `POST /admin/answer-alternatives` `{ targetType, targetId, kind, value, sourceReportId? }`
  → la alternativa creada (idempotente: si ya existe, la devuelve).
  `DELETE /admin/answer-alternatives/:id`.

### 3.4 Cierre y gemas, exactamente una vez

En una transacción:

```sql
UPDATE dots.content_reports
   SET status = $2, resolution_note = $3, resolved_by = $4,
       resolved_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
 WHERE id = ANY($1) AND status = 'pending'
RETURNING id, user_id
```

Solo las filas que volvieron se premian (convención del CLAUDE.md del
backend): si `outcome = fixed` y el alumno no es perfil 1,
`awardGems(manager, userId, GEMS_PER_ACCEPTED_REPORT, 'report_accepted', String(id))`
y `gems_awarded = 10` en esa fila. `GEMS_PER_ACCEPTED_REPORT = 10` vive en
`src/common/gems.ts` junto a las demás. Cerrar dos veces el mismo reporte no
vuelve a pagar porque la segunda vez el `WHERE` no lo devuelve.

### 3.5 Si la migración aún no está aplicada

Todo degrada sin romper (patrón `awardGems`): `POST /reports` responde 503
«Los reportes aún no están disponibles» (el error `42P01` se traduce en el
servicio), `GET /me/report-notices` devuelve una lista vacía, el resumen da
ceros y el cargador de alternativas devuelve un mapa vacío, así que práctica,
juegos y exámenes siguen exactamente como hoy.

## 4. Respuestas alternativas

### 4.1 Qué significa aceptar una

Una alternativa aceptada **deja de salir como opción incorrecta** de ese
ejercicio y **cuenta como buena donde el alumno puede producirla**. En los modos
de elegir, como solo se elige entre lo ofrecido, basta con lo primero: la
pregunta vuelve a tener una sola correcta, que es lo que se espera de «elige la
que va». En «Arma la oración» y el Constructor, lo segundo es lo que importa:
otro orden de las mismas fichas pasa a valer.

- `kind = "word"`: otra palabra que cabe en el hueco (oraciones) u otra
  respuesta (gramática). Se compara con `trim()`, sin la puntuación final y en
  mayúsculas (`normalizarPalabra`). Es lo de hoy más la puntuación final, que
  los juegos ya quitan con su `clean()`: así «feel.» y «feel» son la misma
  alternativa tanto al sortear opciones como al corregir.
- `kind = "sentence"`: la oración completa en otro orden. Se compara
  normalizada igual que la de referencia: espacios colapsados, sin la
  puntuación final y en mayúsculas.

### 4.2 Dónde se aplica

`src/common/answer-alternatives.ts` expone
`cargarAlternativas(manager, targetType, ids)` → `Map<id, { words, sentences }>`
con una sola consulta por petición y try/catch que devuelve un mapa vacío.

| Sitio | Cambio |
|---|---|
| `buildOptionSet` (`src/common/sentence-quiz.ts`) | parámetro `excluir?: string[]` que siembra el set de descartes junto a la correcta |
| Práctica (`sentences.service.ts`) | excluye las palabras alternativas; en `buildUp` manda `accepted_texts` con las oraciones alternativas normalizadas |
| `practice-container.tsx` | «Arma la oración» acepta `text` o cualquiera de `accepted_texts` |
| Repaso, placement y checkpoint | excluyen al sortear; placement y checkpoint además aceptan las alternativas al corregir, por si una edición llega a mitad de un intento |
| Gramática (`node-content.service.ts`) | excluye las alternativas de los distractores curados |
| Escucha Rápida y Carrera Fantasma, Dotaxi | excluyen al sortear |
| ¡No lo revientes! | el servidor manda `accepted` por palabra y el cliente las saca de sus distractores |
| Constructor | excluye las palabras alternativas de los señuelos y manda `answers` (la de referencia y las alternativas en fichas); el cliente valida cada ficha contra el prefijo de cualquiera de ellas |

## 5. Ids que faltan en los juegos

- **Torre de Palabras**: `TowerRoundDto` gana `id` (el del `vocab_item`). No
  revela nada: la categoría ya viaja en las opciones.
- **Palabra del Día**: `WordleStateDto` gana `answerId`, no nulo solo cuando
  `done`, igual que `answer`.
- **Mini Crucigrama**: cada `CrosswordAnswerDto` gana `vocabId`, que solo viaja
  cuando el crucigrama está terminado, como las respuestas.
- **Dot Bombs**: la bomba conserva el id de su palabra además del contador local.
- **¿Verdad o Trampa?**: la trampa reporta su id negativo como `false_friend`; el
  detalle del admin la muestra como contenido fijo del código, sin «Editar».

## 6. Contexto técnico de los bugs

`lib/error-trail.ts` guarda en memoria los últimos cinco errores
(`window.onerror` y `unhandledrejection`: mensaje, origen y hora) y lo engancha
un componente sin render en el layout raíz. Todo reporte lleva en `context`: la
ruta, el user agent, el tamaño de la ventana, si la app está instalada
(`display-mode: standalone`) y la versión (`NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA`
recortada, o `dev`). Los que marcan `bug` añaden además los errores
capturados.

## 7. Pruebas

**Backend (jest)**, con los fakes de `manager.query` de `admin-me.service.spec.ts`:

- crear, fusionar, tope de 24 h, validaciones del DTO y 503 sin tabla;
- cerrar paga una sola vez, no paga a admins ni al descartar, y la segunda
  llamada no devuelve filas;
- avisos: solo los del alumno y solo los no vistos; marcar vistos no toca filas
  ajenas;
- `buildOptionSet` con `excluir`, corrección de checkpoint y placement con
  alternativas, y los sorteos de los juegos sin las alternativas;
- el test de clasificación de `admin-me.reset` pasa con la tabla nueva en
  `KEPT_TABLES`.

**Webapp (`node --test`)**: `lib/report.test.mjs` (motivos por objetivo,
etiquetas, validación, candidatos y armado del cuerpo, recorte de la foto),
`lib/report-notice.test.mjs` (resumen del aviso: pose, líneas, total de gemas),
`lib/admin-reports.test.mjs` (filas, recuentos, respuestas distintas, cuándo se
puede aceptar y de qué tipo) y `lib/error-trail.test.mjs`. Además `npm run
lint`, `npx next build` y verificación en el preview: la banderita en práctica,
un juego y ajustes, la hoja entera y la bandeja del admin.

## 8. Despliegue

1. `node scripts/migrate-reports.js` en seco y luego `--apply` con el
   consentimiento explícito de Sergio (regla 1 del CLAUDE.md del backend).
2. Backend a main y después el webapp, los dos con push directo tras rebase. El
   orden protege lo nuevo, pero no es crítico: sin la migración todo degrada.

## Fuera de alcance

- Correos (al admin o al alumno) y resumen diario.
- Capturas de pantalla adjuntas.
- Revisión pregunta a pregunta al terminar checkpoint, placement o lecturas,
  que es lo que haría falta para ofrecer «debería estar bien» ahí.
- Alternativas en vocabulario, pronunciación, letras y números (el arreglo es
  editar).
- Ocultar un ejercicio solo porque acumula reportes, asignar reportes entre
  admins y métricas.

## Riesgos y deuda

- **Avisos que se pisan.** La hoja de resultados espera a los tapones
  conocidos y los demás esperan a ella porque toma el scroll, pero una pista
  que suba después de pintarse puede taparla igual que hoy tapa al aviso de
  rival (deuda ya anotada en `docs/ARQUITECTURA.md`). Aquí pesa menos: la hoja
  no se cierra sola y no se pierde.
- **Ediciones durante un checkpoint.** El checkpoint regenera el examen al
  corregir; aceptar una alternativa a mitad de un intento solo puede convertir
  en buena una respuesta que antes contaba mal, nunca al revés.
- **Contenido borrado.** `DELETE /admin/sentences/:id` es duro; sus reportes
  quedan legibles por la foto y el detalle lo dice.
