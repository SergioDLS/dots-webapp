# Audición de voz en el admin: generar → escuchar → regenerar — Diseño (brainstorming 2026-07-30)

- **Fecha:** 2026-07-30
- **Rama:** por crear (ambos repos)
- **Estado:** 📐 diseño aprobado, sin implementar. Siguiente paso: plan de implementación.
- **Repos:** `dots-webapp` (front) + `dots-backend` (API). BD PostgreSQL **compartida de producción** — por eso el diseño evita publicar audio no aprobado.
- **Antecedente directo:** [`2026-07-23-personajes-voz-design.md`](2026-07-23-personajes-voz-design.md) decisión 8 ("admin: ver + override, sin CRUD") y la fase **F-media** de [`2026-07-22-contenido-camino-y-modulos-design.md`](2026-07-22-contenido-camino-y-modulos-design.md), que dejó pendiente regenerar ~397 audios legacy.

## 1. Problema

El admin genera voces a ciegas. No hay forma de **escuchar** lo que se generó ni de **rehacerlo** si no convence.

Concretamente, verificado en código el 2026-07-30:

### 1.1 Las oraciones ya generan narración, en silencio y sin control

- `createSentence` llama `tryNarration()` (`BE/src/modules/admin/admin.service.ts:423`) y cualquier edición de `text`/`mWord` la vuelve a llamar (`:461`). `tryNarration` (`:150-159`) devuelve `'generated' | 'failed'`.
- El front **descarta ese resultado**: `components/admin/sentence-modal.tsx:90,99` solo hace `onSaved("Sentence created.")`. El admin no sabe si la narración salió, ni con qué voz, ni cómo suena.
- El personaje lo elige un picker balanceado (`BE/src/modules/admin/narration.service.ts:91-146`), así que la voz de cada oración es efectivamente aleatoria y invisible.

### 1.2 El admin no puede ni construir la URL de la narración

`serializeSentence` (`BE/src/modules/admin/admin.service.ts:1378-1397`) no expone `voiceCharacterId` ni la key del personaje. La URL del alumno se **deriva** (`FE/constants.ts:22-30`):

```
https://res.cloudinary.com/<cloud>/video/upload/dots/sounds/sentences/<voiceKey>/<id>.<ext>
```

Sin `voiceKey` el admin no puede armarla. **Este es el bloqueo real**, no la generación.

### 1.3 `imgSound` no es la narración (trampa de nomenclatura)

`sentences.img_sound` es el clip de la **palabra faltante** (`mWord`), no de la oración: `FE/components/practice-container/practice-container.tsx:279` elige `img_sound` salvo en modo `whatDoYouHearSentence`, y `:329,341` lo usan como audio de los botones de respuesta. El comentario en `:284` lo dice explícito ("`img_sound` es otra voz"). El `UploadTile` etiquetado "Word audio" (`sentence-modal.tsx:178-186`) es ese clip. **La narración de la oración no tiene UI alguna.**

### 1.4 Los cuatro fundamentos generan sin reproducir

`vocab-manager.tsx:240`, `letters-manager.tsx:230`, `numbers-manager.tsx:230` y `pronunciation-manager.tsx:224` llaman `generateXAudio(item.id, narratorId)` → refrescan la lista → toast. La fila muestra badge `🔊` y nombre del personaje, pero **no hay reproducción en ningún punto**. Si la toma quedó mal, el admin no lo sabe.

### 1.5 Regenerar pisa el audio vivo

`uploadBuffer` usa `overwrite: true` + `invalidate: true` (`BE/src/modules/admin/cloudinary.service.ts`, opts en el bloque `upload_stream`) sobre rutas deterministas. Regenerar **reemplaza lo que oye el alumno** antes de que nadie apruebe la toma, y la URL derivada del front no lleva segmento de versión → puede servir el clip viejo durante minutos.

## 2. Lo que YA existe (verificado — no rehacer)

| Pieza | Ubicación | Estado |
|---|---|---|
| `POST /admin/sentences/:id/generate-narration` | `BE/admin.controller.ts:94` | ✅ **existe**; el front nunca lo llama |
| `generate-audio` de vocab / pronunciation / letter / number | `BE/admin.controller.ts:105,113,124,132` | ✅ existe y se usa |
| Body `{ characterId? }` (`GenerateNarrationDto`) | `BE/admin.dto.ts` | ✅ override de narrador ya soportado |
| Picker balanceado + filtros `enabled` y `accent='en-US'` | `BE/narration.service.ts:91-146` | ✅ |
| `buildNarrationText(text, mWord)` (sustituye `__`) | `BE/narration.util.ts:13-28` | ✅ |
| Síntesis ElevenLabs `eleven_multilingual_v2`, `mp3_44100_128`, `TtsRateLimitException` en 429 | `BE/tts.service.ts` | ✅ sin `seed` ni `voice_settings` → cada toma varía levemente |
| `uploadBuffer(publicId, kind, overwrite, invalidate)` | `BE/cloudinary.service.ts` | ✅ devuelve `secure_url` **con versión** |
| `GET /admin/characters` con `audioCount` | `BE/admin.controller.ts:76` | ✅ |
| Dropdown "Narrador: Auto (balanceado)" filtrado por `enabled` | `vocab-manager.tsx:272`, letters, numbers | ✅ a nivel de pack |
| `<audio controls>` en previews | `FE/components/admin/ui.tsx:227-229` (`UploadTile`) | ✅ precedente de reproducción |
| `voice_character_id` en `sentences`, `vocab_items`, `letter_items`, `number_items`, `pronunciation_items` | entidades | ✅ |

**No existe:** `rename` en `CloudinaryService`; ningún modo de síntesis sin persistir; reproducción tras generar; exposición del personaje en `serializeSentence`.

**Elenco efectivo:** `doty`, `doty-sailor`, `doty-scientist`. `doty-fem` está `enabled=false` (su voz `professional` da HTTP 402 en plan gratuito).

## 3. Decisiones (cerradas en brainstorming)

| # | Tema | Decisión |
|---|------|----------|
| 1 | Alcance | **Oraciones + los 4 fundamentos que ya generan** (vocab, letters, numbers, pronunciation). `words` y `readings` quedan fuera: `words` es catálogo legacy de juegos y `readings` son narraciones largas y caras. |
| 2 | Ciclo de regeneración | **Borrador y luego publicar.** Generar sube a una ruta borrador que ningún resolver del alumno referencia; publicar hace `rename` de Cloudinary a la ruta canónica. **Cero llamadas extra a ElevenLabs al publicar** (el rename es metadata) → regenerar cuesta créditos, aprobar no. |
| 3 | Ruta del borrador | **Alcanzada por personaje**: `dots/sounds/_drafts/<entity>/<characterKey>/<id>`. Se autovalida (publicar con un `characterId` que no generó borrador → el rename falla → 409) y es *stateless*: no hace falta guardar metadata del borrador en memoria, que el watcher de dev perdería en cada reinicio. Costo: hasta 3 archivos huérfanos por ítem (uno por personaje del elenco) en vez de 1. Se acepta. |
| 4 | Autogeneración al crear | **Se conserva.** `tryNarration` en create y en cambio de `text`/`mWord` sigue publicando directo, para que ninguna oración quede muda. Lo que cambia es que su resultado **se muestra** y que el ciclo de borrador existe para *mejorar* la toma. Una oración muda es peor que una toma sin auditar. |
| 5 | Comparación | **Toma viva y borrador reproducibles a la vez**, apiladas. Es el beneficio concreto de la decisión 2; un solo reproductor lo desperdiciaría. |
| 6 | Texto hablado visible | El borrador muestra `spokenText`. En oraciones es **derivado** (`__` → `mWord`), no inferible del formulario, y es la causa habitual de una toma mala. |
| 7 | Reproductor | **`<audio controls>` nativo**, siguiendo `UploadTile`. Sin código de reproducción nuevo; seek y repetición gratis. El borrador **autoreproduce** al llegar (el click en "Generar" es el gesto de usuario que legaliza el autoplay). |
| 8 | Modo crear | Tras crear con éxito el modal **queda abierto en modo edición** con el bloque de narración activo, para que crear → escuchar → regenerar sea un flujo continuo. |
| 9 | Cache-busting | Borrador y publicación devuelven el `secure_url` **versionado** de Cloudinary → inmunes a CDN vieja. Solo la URL viva cargada al abrir se construye sin versión: lleva `?t=` sellado al montar (`useState(() => Date.now())`). |
| 10 | Descartar | Solo limpia estado local. El archivo queda en la ruta borrador hasta que la próxima toma lo sobrescriba; no acumula. |
| 11 | Etiqueta de `imgSound` | Se renombra a **"Audio de la palabra"** con la aclaración "clip de «\<mWord\>», no la narración" (ver §1.3). |

## 4. Contrato de API

Dos endpoints nuevos por tipo de contenido. **No reemplazan** a los `generate-*` existentes (que siguen sirviendo a `tryNarration` y a los scripts de batch).

```
POST /admin/<entity>/:id/narration-draft     body { characterId? }
  → 200 { characterId, characterKey, characterName, spokenText,
          clips: [{ label?, url }] }
     Sintetiza y sube a dots/sounds/_drafts/<entity>/<characterKey>/<id>
     (pronunciation: sufijos -a / -b → dos clips)
  → 400 personaje explícito sin voz configurada
  → 429 TtsRateLimitException
  → 503 ElevenLabs o Cloudinary sin configurar

POST /admin/<entity>/:id/narration-publish   body { characterId }
  → 200 { characterKey, url }   // secure_url versionado de la ruta canónica
     rename(_drafts/… → ruta canónica) + escribe en BD:
       audio (o sentence_extension en sentences) + voice_character_id
  → 409 no hay borrador de ese narrador para ese ítem
```

`<entity>` ∈ `sentences`, `vocab-items`, `letter-items`, `number-items`, `pronunciation-items`.

Rutas canónicas de destino (las que ya usa `narration.service.ts`, sin cambios):

| Entidad | `public_id` canónico |
|---|---|
| sentences (personaje default) | `dots/sounds/sentences/<id>` |
| sentences (otro personaje) | `dots/sounds/sentences/<key>/<id>` |
| vocab | `dots/sounds/vocab/<pack.key>/<key>/<slug>` |
| letters / numbers | `dots/sounds/{letters,numbers}/<key>/<slug>` |
| pronunciation | `dots/sounds/pronunciation/<unit.key>/<key>/<slug>` |

⚠️ En `sentences` el personaje **determina la ruta** (el default no lleva subcarpeta). Publicar con otro narrador escribe en una ruta distinta y **deja el archivo anterior huérfano** en la ruta del narrador viejo. Es inocuo (nadie lo referencia tras actualizar `voice_character_id`) pero hay que documentarlo: es el mismo motivo por el que la corrección del spec de personajes-voz excluyó `sentences` del reparto retro.

## 5. Derivadas técnicas

### 5.1 Backend

1. **`CloudinaryService.rename(fromPublicId, toPublicId, kind)`** — nuevo; envuelve `cloudinary.uploader.rename` con `resource_type` (`video` para audio), `overwrite: true`, `invalidate: true`. Traduce el 404 de Cloudinary en `HttpException(409)`.
2. **`NarrationService`**: extraer la síntesis de los cinco `generate*` a un helper que reciba destino, y agregar `draft<X>()` / `publish<X>()`. Internamente los `generate*` pasan a ser `draft` + `publish` inmediato, para no duplicar lógica de picker ni de texto. **Su contrato HTTP no cambia** (mismo path, mismo body, misma respuesta `{characterKey, url}`): siguen sirviendo a `tryNarration` y a los scripts de batch sin tocarlos.
3. **`serializeSentence`**: agregar `voiceCharacterId`, `voiceKey`, `voiceCharacterName`. **Bloqueante** para que el admin pueda armar la URL viva.
4. **Controller**: 10 rutas nuevas (draft + publish × 5) con `GenerateNarrationDto` y un `PublishNarrationDto { characterId: number }` (obligatorio).
5. `createSentence`/`updateSentence` ya devuelven `narration: 'generated' | 'failed'` — no se toca el backend, se consume en el front.

### 5.2 Frontend

1. **`components/admin/voice-studio.tsx`** (~180 líneas, agnóstico de entidad):
   ```ts
   type VoiceTake = {
     characterId?: number
     characterName: string
     spokenText?: string
     clips: { label?: string; url: string }[]   // array por el par mínimo de pronunciation
   }
   interface VoiceStudioProps {
     live: VoiceTake | null
     characters: AdminCharacter[]
     onDraft: (characterId?: number) => Promise<VoiceTake>
     onPublish: (characterId: number) => Promise<VoiceTake>
     disabled?: boolean
     disabledReason?: string
   }
   ```
   Máquina de estados `idle → generating → draft → publishing → idle`, más `error`. Contador de toma solo en cliente (orientativo).

   Al publicar, `publish` solo devuelve `{characterKey, url}`; el nuevo `live` se arma **combinando esa `url` versionada con el `characterName`/`spokenText` que ya traía el borrador** — el componente no necesita refetch para actualizar la toma viva.
2. **`components/admin/voice-modal.tsx`** (~40 líneas): `AdminModal` + `VoiceStudio`, para los botones de fila de fundamentos.
3. **`sentence-modal.tsx`**: bloque `VoiceStudio` inline; relabel de `imgSound` (decisión 11); consumir `narration` de create/update; permanecer abierto en modo edición tras crear (decisión 8).
4. **Cuatro managers de fundamentos**: el botón de fila abre `VoiceModal` en vez de generar a ciegas (~10 líneas cada uno). El dropdown de narrador por pack y la columna de personaje **se conservan tal cual**.
5. **`services/admin.service.ts`**: 10 fetchers nuevos (`draftXNarration` / `publishXNarration`) + tipos. `AdminSentence` gana `voiceCharacterId`/`voiceKey`/`voiceCharacterName`.

### 5.3 Cumplimiento de las reglas duras de `CLAUDE.md`

- **Regla 3 (lint del compiler de React):** `VoiceStudio` es puramente dirigido por eventos — no hay `useEffect` que fetchee ni `setState` en cuerpo de efecto. El sello de `?t=` usa inicializador lazy de `useState`, no un efecto.
- **Regla 5 (reintentar por estado):** el error de generación se muestra en el bloque y "Regenerar" **es** el reintento por estado. Nada de `window.location.reload`.
- **Regla 1:** sin navegación; no aplica.
- **Regla 2 (RN-safe):** no aplica — es admin, web-only, y el `<select>` + `<audio controls>` siguen el precedente ya existente en admin. Si el admin llegara a RN habría que reemplazar ambos.

## 6. Verificación

- `npx next build` (incluye type-check) + `npm run lint` en webapp; `npx tsc --noEmit` + build en backend.
- **Preview manual**, contra prod y por eso con cuidado:
  1. Oración existente: abrir modal → suena la voz viva con el nombre correcto del personaje.
  2. Generar borrador con narrador explícito → autoreproduce, `spokenText` muestra `__` sustituido, la voz viva **no cambió** (verificar la URL canónica en otra pestaña).
  3. Regenerar 2 veces → cada toma suena distinta; sigue sin tocar la voz viva.
  4. "Usar esta toma" → la URL canónica sirve el audio nuevo y la fila muestra el personaje nuevo.
  5. Crear oración nueva → modal queda en edición, narración autogenerada audible.
  6. Un ítem de cada fundamento, incluido **pronunciation** (dos clips, mismo personaje).
  7. Publicar con `characterId` sin borrador → 409 manejado con mensaje, no crash.
- **Créditos:** cada borrador gasta ElevenLabs (plan gratuito). Probar con pocos ítems.

## 7. Pendientes / fuera de alcance

- **`words` y `readings`**: sin endpoints de generación; quedan fuera (decisión 1).
- **Regeneración masiva de los ~397 audios legacy** (F-media pendiente): se sigue haciendo por script (`narrations:generate --force --ids`). Este admin es la herramienta para casos puntuales, no para el batch.
- **Limpieza de huérfanos**: los archivos en `_drafts/` y los de rutas de narrador viejo en `sentences` no se borran. Si molestan, un script de barrido posterior.
- **`doty-fem`** sigue inutilizable hasta plan pago o voz `generated` de reemplazo; el dropdown ya la excluye por `enabled`.
- **Override del texto hablado**: se muestra `spokenText` pero no se puede editar (requeriría columna nueva). YAGNI hasta que aparezca un caso real.
- **`seed`/`voice_settings` de ElevenLabs**: no se exponen. Hoy la variación entre tomas es la que da el modelo por defecto; si resultara insuficiente, exponer `stability`/`similarity_boost` es la siguiente palanca.
