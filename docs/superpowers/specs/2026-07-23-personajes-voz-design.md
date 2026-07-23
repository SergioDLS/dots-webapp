# Personajes de Doty como voces de los audios — Diseño (grilling 2026-07-23)

- **Fecha:** 2026-07-23
- **Rama:** `redesign/contenido-camino` (ambos repos)
- **Estado:** 🔨 **código implementado y con review final de rama 2026-07-23** ([plan](../plans/2026-07-23-personajes-voz.md); backend `5fbb6cf..b1a7e07`, webapp `b876522..0d1b2f5`; ambos merge-ready). Corrección a la derivada técnica 1: `sentences` queda FUERA del reparto retro porque su personaje construye la URL de Cloudinary (reasignar rompería audios); se reparte en F-media al regenerar. **Pendiente (usuario):** `npm run migrate:item-progress -- --apply` (F3e) y `npm run migrate:voice-characters -- --apply` — el backend nuevo NO debe bootear contra prod antes; luego preview end-to-end. Los voice IDs se cargan cuando el usuario los elija: `npm run migrate:voice-characters -- --apply --voices doty=<id>,doty-fem=<id>,doty-captain=<id>,doty-scientist=<id>`. Arte Midjourney: cargar en `characters.img` (VoiceAvatar ya lo prefiere).
- **Repos:** `dots-webapp` (front) + `dots-backend` (API/seed). BD PostgreSQL **compartida de producción** — migraciones/seeds `--apply` los corre el usuario.

## 1. Idea

Cada audio de la app pertenece a un personaje de la familia Doty: la cara que se muestra es la voz que suena. A futuro los personajes se animan con Rive; por ahora se fija la propiedad audio→personaje en datos y una UI placeholder.

## 2. Lo que YA existía (verificado en código, no rehacer)

- Tabla `dots.characters` (`BE/src/common/entity/character.entity.ts`): `key`, `name`, `elevenlabs_voice_id`, `img`, `is_default`, `enabled`. Seedeada en prod con `doty` (default) y `doty-fem` (`BE/scripts/migrate-learning-path.js:167`), ambos sin voice ID ni img.
- FK `voice_character_id` en `sentences`, `vocab_items`, `pronunciation_items`. **Faltan:** `letter_items`, `number_items`, `words`.
- Picker balanceado (el personaje con menos audios recibe el próximo): `BE/src/modules/admin/narration.service.ts` y `BE/scripts/generate-narrations.js` (soporta `--character <key>` fijo).
- Los audios de letters/numbers se **copiaron** de `words.audio` (F3d) — todo el catálogo actual es UNA sola voz anónima.
- Front: `voice_key` ya viaja en sentences y arma la URL de Cloudinary (`FE/constants.ts` `resolveSentenceSoundUrl`); no hay representación visual del personaje en ninguna UI.

## 3. Decisiones (cerradas en grilling)

| # | Tema | Decisión |
|---|------|----------|
| 1 | Catálogo existente (una sola voz) | **"Visual ya, voz después": reparto retro 100% aleatorio-balanceado** entre los 4 personajes, aceptando el mismatch voz↔cara temporal. Cuando haya créditos, la regeneración **prioriza los audios cuyo personaje no calza con la voz legacy**. |
| 2 | Elenco inicial | **4 perfiles equilibrados por edad y género, todos acento US** (simplificado 2026-07-23): **2 juveniles** — Doty (M, host, cálido/enérgico, default) y Doty Fem (F, brillante/enérgica) — **+ 2 adultos** — Doty capitán (M, voz grave, calmada) y Doty científica (F, voz madura, precisa/pausada). La temática de los adultos la eligió el agente (al usuario le da igual; lo que fija es el eje juvenil×2 / adulto×2). Mapeo BD: `doty` y `doty-fem` quedan tal cual (sin rename); se agregan 2 filas nuevas (keys: `doty-captain`, `doty-scientist`). |
| 3 | Acentos | **Niveles base: solo acento americano.** En niveles más avanzados se incorporan personajes con otros acentos (p.ej. científico británico) para enriquecer el oído. Implica columna `accent` en `characters` y filtro del picker según nivel del contenido. El "Doty investigador británico" **debuta en niveles avanzados**, no en el elenco inicial. |
| 4 | Mezcla en sesión | **Mezcla por ítem** (estilo Duolingo): cada audio tiene su personaje fijo de por vida; una sesión de 6-7 ítems mezcla voces. Es lo que el picker actual ya produce. |
| 5 | UI fase 1 (sin arte aún) | **Doty actual + nombre:** junto al altavoz aparece el Doty existente (PNG poses, pose distinta por personaje como placeholder) con el nombre del que habla. El arte de Midjourney solo reemplaza imágenes después (campo `img`). |
| 6 | Ronda inversa | **Avatar en cada botón 🔊** (audio-choice-quiz): cada botón lleva el mini-avatar del personaje de su clip — refuerza voz↔cara en el ejercicio de oído. |
| 7 | Alcance fase 1 | **Solo módulo levels: lecciones rápidas y practice. Juegos NO** (audio-blitz y juegos que reproducen words adoptan personajes en fase posterior; el dato queda listo). |
| 8 | Admin | **Ver + override, sin CRUD:** el admin muestra el personaje asignado a cada audio y permite regenerar con personaje específico (el backend ya soporta elección fija). Los personajes se gestionan por seed/SQL. |
| 9 | Voces ElevenLabs | **Elegir las 4 voces YA** (shortlist con criterios por rasgo, la prepara el agente; elige el usuario). Todo audio nuevo nace con la voz real de su personaje; solo el batch retro espera presupuesto (F-media). |
| 10 | Silueta (dirección de arte) | **Familia esférica con props** (lentes, gorra, moño, bata): la marca ES "dots"; en Rive = un solo rig con skins (vs rig por personaje); a 40-64px el prop lee mejor que anatomías distintas. |

## 4. Derivadas técnicas (para el plan de implementación)

1. **Migración BD (usuario corre `--apply`):**
   - `characters`: insertar `doty-captain` ("Doty capitán") y `doty-scientist` ("Doty científica"); `doty` y `doty-fem` quedan tal cual; nueva columna `accent` (p.ej. `en-US`/`en-GB`, default `en-US`).
   - `letter_items` y `number_items`: agregar `voice_character_id` (words puede esperar a la fase de juegos).
   - **Seed de reparto retro:** asignar `voice_character_id` aleatorio-balanceado a todo audio existente sin personaje (sentences legacy, vocab, letters, numbers). Idempotente y con dry-run, como los seeds previos.
2. **Backend:** picker filtra `accent = 'en-US'` para contenido base (el gating por nivel se diseña cuando existan personajes acentuados); endpoints `generate-*` aceptan `characterKey` opcional (override admin); exponer `character` (key, name, img) en los payloads de lesson items que hoy solo traen `audio`.
3. **Front (lección):** `listen-quiz` muestra avatar placeholder + nombre del personaje del ítem; `audio-choice-quiz` muestra mini-avatar por botón. Placeholder = poses existentes de `FE/public/images/Doty/` mapeadas por key. RN-safe (solo tap, transform/opacity).
4. **Admin:** columna/badge de personaje en los managers de foundations y en el flujo de generación; selector de personaje al regenerar.
5. **Regeneración futura (F-media):** batch prioriza ítems donde `characters.gender` (si se agrega) o la voz real no calza con el clip legacy. Queda explícitamente fuera de esta fase.

## 5. Pendientes / no resueltos

- **Género de la voz legacy** (¿masculina o femenina?): el usuario no lo precisó; solo afecta la priorización de la regeneración futura, no bloquea nada.
- **Voice IDs de ElevenLabs:** shortlist pendiente de preparar con el eje del elenco — 2 voces juveniles (M/F) + 2 voces adultas (M grave / F madura), todas US; decide el usuario.
- **Arte Midjourney + rig Rive:** dirección cerrada (esférica + props), producción pendiente; no bloquea datos ni UI placeholder.
- **Personajes con acento (británico etc.):** diseño del gating por nivel se hace cuando se incorporen; hoy solo queda la columna `accent`.
