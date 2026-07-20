# Rediseño total de dots — "dots se siente juego"

**Fecha**: 2026-07-20 · **Estado**: aprobación pendiente · **Repos**: dots-webapp + dots-backend

## Objetivo

Rediseño total de la cara estudiante: UI mucho más intuitiva, divertida y visualmente impactante; progreso siempre visible; mecánicas de retención probadas (investigación Duolingo/Speak/Busuu 2025-2026); modalidad nueva de aprendizaje (repaso SRS) más explicación educativa al fallar; historias con personajes diferidas hasta tener elenco + voces. Admin queda funcional como está.

## Decisiones cerradas (grilling con el usuario)

| Tema | Decisión |
|---|---|
| Mecánicas retención | Misiones diarias + cofres · liga semanal · racha protagonista + escudos · gemas |
| Público | Todas las edades, tono juguetón estilo Duolingo (denso pero divertido) |
| Layout | Mobile-first con bottom tabs; desktop sidebar delgado de iconos |
| Marca | Diseño nuevo conservando rosa + navy del logo y Doty |
| Modalidades nuevas | Repaso SRS. Historias DIFERIDAS hasta tener elenco de personajes + ELEVENLABS_API_KEY (speaking/IA fuera) |
| Frontera | Solo cara estudiante; admin intacto |
| Gemas compran | Escudos de racha · cosméticos Doty · gestos Doty · boost XP x2 (15 min) · rescate en modos con stakes |
| Vidas | **Solo checkpoints + arcade**. Camino: infinitas, fallo re-encola hasta acertar. A 0 vidas: modal rescate con gemas o reiniciar gratis. Modo desafío descartado (farmeo de XP) |
| Explicar fallo | **Sí, en todas las lecciones**: al fallar, mini-explicación del porqué (Doty). Convierte el error en aprendizaje — lever educativo central |
| Notificaciones / PWA | **Fuera de la web**: push y hábito los asume la futura app React Native (tokens nativos, iOS sólido). La web queda responsive sin service worker |
| Ramas | Mergear `redesign/learning-path` a main (ambos repos, verificada E2E); rediseño en rama nueva `redesign/total` |

Anti-decisiones (respaldadas por evidencia): sin corazones globales (backlash Energy 2025; la web de Duolingo nunca los tuvo), sin encadenamiento infinito de lecciones (bingers churnean más), máximo 1 notificación/día (cuando exista, en la app RN), gamificación premia — nunca castiga el aprender.

## A. Identidad visual

- **Paleta**: navy profundo como base dark (primera clase), blanco cálido como light, rosa del logo como acento/CTA. Tokens CSS en `app/globals.css` (extiende `--accent`, `--surface`, etc. — mismo mecanismo actual, valores nuevos + tokens de semántica de juego: `--gold`, `--gem`, `--flame`).
- **Tipografía**: display redondeada gorda (Baloo 2) + Nunito body, vía `next/font`. Botones/labels en bold.
- **Botones táctiles 3D**: relleno plano + borde inferior 4px que colapsa al presionar (`border-b-4 active:border-b-0 active:translate-y-[4px]`). Firma visual del género.
- **Superficies**: flat táctil, `rounded-2xl`, sombras duras. Sin glassmorphism.
- **Feedback multisensorial**: flash verde / shake rojo + sonidos existentes (`feedback-sounds.ts`); `prefers-reduced-motion` respetado; toggle de sonido.
- **Doty reactivo**: poses semánticas (canibaliza `poses.ts` de la rama `redesign/doty-brand`) según estado — idle / acierto / fallo / celebración / racha en peligro — en lecciones, estados vacíos, hitos y onboarding.
- **Dark/light**: class-based con `prefers-color-scheme` por defecto y toggle en perfil.

## B. Estructura y navegación

- **Bottom tabs móvil** (5, con label): **Camino · Repaso · Retos · Zona de juego · Perfil**. Desktop ≥md: sidebar delgado de iconos con los mismos 5 destinos. Reemplaza el sidebar actual en `app/(app)/layout.tsx`. `env(safe-area-inset-bottom)`.
- **Camino ES la home** (`/` redirige al camino). Exactamente un nodo pulsando "EMPIEZA" + botón "Continuar" persistente en el header. Cero parálisis: la pantalla responde "¿qué hago ahora?" en un tap.
- **Header HUD**: llama de racha (contador) + gemas + anillo de meta diaria de XP (cierra con pop al cumplirla).
- **Zona de juego** (`/play`): hub que consolida juegos arcade + lecturas + flashcards (hoy dispersos). Las misiones diarias enrutan tráfico hacia ahí.
- **Retos** (`/quests`): misiones del día + liga semanal (la liga aparece cuando se construya, fase 8).
- **Repaso** (`/review`): sesión SRS del día.
- **Perfil** (`/profile`): Doty custom, nivel CEFR, calendario de racha, badges, stats, ajustes.

## C. Núcleo adictivo

### C1. Celebración fin de lección (todas las lecciones/juegos)
Secuencia por etapas en `result-screen.tsx` renovado: confetti → XP contando hacia arriba → barras de misiones subiendo con tick → llama de racha (+1) → posición de liga si cambió. Sonido de jingle. Es el payload de dopamina (+30% completion documentado).

### C2. Racha protagonista
- Llama animada en header; hitos 7/30/50/100/365 con pantalla completa de celebración.
- Calendario de racha en perfil.
- **Escudos**: `users.streak_freezes` ya existe — la tienda los vende (cap 2 equipados); el job nocturno ya los consume.
- Aviso "racha en peligro": en la web, banner/estado visible al abrir; el push a la hora habitual lo hará la app RN (sección F).
- Dato guía: rachas con escudos promedian +48% de duración; día 10 = punto de inflexión de abandono.

### C3. Misiones diarias
- 3 misiones/día por usuario, deterministas (seed usuario+fecha), de plantillas: "gana N XP", "acierta N seguidas", "completa 1 lección de pronunciación", "juega 1 partida en Zona de juego", "haz tu repaso"...
- Cada misión → cofre (gemas o boost); las 3 → cofre bonus. Animación de apertura.
- Progreso engancha en los endpoints de progreso existentes + `daily_use` (sin instrumentación nueva en el cliente).
- Tablas: `quest_templates` (key, metric, target, reward jsonb, enabled) + `user_quests` (user_id, template_id, date, progress, completed_at, claimed_at; UNIQUE(user_id, template_id, date)).

### C4. Economía de gemas
- **Ganar**: ~10-15/lección, cofres 20-50, hitos de racha más grandes. **Gastar**: escudo 200, boost XP x2 15min 150, rescate en stakes 250, cosméticos 300-800, gestos 400-1000 (valores iniciales, tunables en un solo módulo de constantes).
- `users.gems int default 0` + `gem_ledger` (user_id, delta, reason, ref, created_at) — economía auditable, previene dobles-gastos.
- `shop_items` (key, kind `cosmetic|gesture|streak_shield|xp_boost`, name, price, slot, meta jsonb, img, enabled) + `user_items` (user_id, item_id, acquired_at, equipped_slot nullable).
- Boost XP: `users.xp_boost_until timestamptz`; `applyXpGain` duplica si vigente.
- API: `GET /shop`, `POST /shop/buy`, `POST /profile/equip`. Compra y gasto en transacción con check de saldo.

### C5. Vidas solo con stakes
- Camino: sin vidas; ítem fallado se re-encola al final hasta acertarlo (ver C8, explicación al fallar); combo de 5 celebra con callout (nunca castiga).
- **Checkpoints y juegos arcade**: 3 vidas. A 0 → modal Doty preocupado: "Continúa por 250 gemas" / "Reiniciar gratis".
- Modo desafío descartado en el grilling: repetir lección por XP x1.5 es farmeo y no enseña nada nuevo.

### C6. Liga semanal (fase tardía — necesita economía XP viva)
- Cohortes de ~30 usuarios por semana y división (Bronce → Plata → Oro al inicio), ranking por XP semanal, top 10 asciende / bottom 5 desciende, opt-out en ajustes.
- Tablas: `league_cohorts` (week, tier) + `league_members` (cohort_id, user_id, xp_week). Asignación al primer XP de la semana; cierre por cron domingo noche (job NestJS `@Cron`).
- **Base pequeña (<50 usuarios, caso actual)**: es la ÚLTIMA fase. Con pocos activos, cohorte única con los usuarios reales que haya (sin bots que mientan); si no hay masa suficiente, la fase se pospone sin bloquear nada anterior.
- Dato guía: +17% tiempo de estudio, 3x usuarios altamente comprometidos.

### C7. Teclado en lecciones (web/desktop)
Enter = confirmar/continuar · 1-9 = opción n · Ctrl+Space = replay audio · Space = continuar en pantallas de fin. Hook `use-lesson-keys.ts` + hints visuales sutiles. Aplica a práctica, lecciones nuevas, checkpoint, repaso.

### C8. Explicación al fallar (lever educativo central)
Al fallar un ítem, antes de re-encolarlo, se muestra un panel breve con el porqué (Doty lo dice). No bloquea el ritmo: aparece bajo el feedback rojo con la respuesta correcta resaltada; se cierra con Enter/tap "Entendido". Fuente del texto por tipo, reutilizando datos existentes:
- **Gramática**: el bloque `tip`/`example` relevante de `grammar_pills.explanation` (jsonb ya existe) — cero contenido nuevo.
- **Oraciones (práctica)**: la traducción de la frase + la palabra correcta en contexto; enlace opcional "repasar regla" a la píldora relacionada.
- **Vocabulario**: significado ES + ejemplo de uso del ítem.
- **Pronunciación**: qué contraste falló (ej: "sonaba /iː/ como en *sheep*, no /ɪ/ como en *ship*") — hint templado desde el par mínimo.
- Degradación: ítem sin buen hint muestra solo "Respuesta correcta: X" — nunca rompe el flujo.
- Contrato: los DTO de contenido de nodo ganan un `hint?` opcional por ítem (derivado en el backend); el cliente solo lo pinta si viene.

## D. Modalidades nuevas

### D1. Repaso SRS (tab Repaso)
- Cola de repetición espaciada alimentada por fallos en TODAS las modalidades (oraciones con `times_wrong>0`, vocab, pares mínimos, ítems de gramática) — hook en los endpoints de progreso existentes.
- `review_items` (user_id, kind `sentence|vocab|pronunciation|grammar`, ref_id, ease, interval_days, due_at, lapses; UNIQUE(user_id, kind, ref_id)). Algoritmo SM-2 simplificado: acierto → intervalo x ease (1d, 3d, 7d...); fallo → reset a 1d, ease baja.
- **Granularidad (verificado en código)**: `sentence_progress` ya guarda `timesWrong`/`streak` por (usuario, oración) → las oraciones entran al SRS con historial real desde el día 1. Vocab/pronunciation/grammar hoy guardan progreso por NODO, no por ítem: para esos tipos `review_items` se alimenta de los fallos registrados de aquí en adelante (sin historial retroactivo por ítem, sin ALTER extra) — el ítem se inscribe la primera vez que se falla.
- Sesión: `GET /review/session` (hasta 15 vencidos, mezcla tipos) → UI reusa las primitivas de lección existentes (`useLessonSeries`, componentes por tipo) → `PUT /review/session` actualiza SRS + XP normal.
- Estado vacío ("nada vencido hoy"): Doty celebrando + CTA al camino.

### D2. Historias con personajes — DIFERIDO
Decisión del grilling: no entra en este rediseño. Con solo `doty` + `doty-fem` el elenco es pobre, y falta `ELEVENLABS_API_KEY` para audio. Se retoma cuando existan (a) las voces del elenco (villano/profesor/científico como filas en `characters` con sus `voice_id`) y (b) las API keys. El diseño ya previsto (nodos `path_nodes` type `story`, tablas `stories`/`story_lines`, player de diálogo con cloze/choice, audio por línea vía pipeline TTS) queda documentado aquí como trabajo futuro, fuera del alcance actual.

## E. Perfil y Doty customizable

- **Avatar Doty custom**: slots hat / outfit / background + gestos equipados (presets de animación sobre las poses SVG por capas — viable sin runtime nuevo). Se muestra en perfil, liga y celebraciones.
- **Nivel CEFR visible**: "A1 · 40%" derivado del camino (dificultad actual + % nodos completados). XP mide esfuerzo; esto mide habilidad. Sin tabla nueva.
- Calendario de racha, badges existentes, stats (XP total, lecciones, precisión), ajustes (sonido, tema, opt-out liga).

## F. Notificaciones y hábito — delegado a la app React Native

Decisión del grilling: la web tendrá una app React Native acompañante. El push de hábito (recordatorio diario a la hora habitual, "racha en peligro") lo hará la app nativa — tokens push reales, background, iOS sólido vía Expo/FCM/APNs. El Web Push (service worker + VAPID + solo PWA instalada en iOS) sería infra frágil y duplicada. La webapp queda como experiencia responsive fuerte, sin service worker. El cron de "racha en peligro" vivirá en el backend compartido cuando exista la app, y disparará push nativo, no web.

## Modelo de datos — resumen (todo aditivo)

Nuevas: `quest_templates`, `user_quests`, `gem_ledger`, `shop_items`, `user_items`, `league_cohorts`, `league_members`, `review_items`. ALTER `users`: `gems`, `xp_boost_until`, `daily_goal_xp`. (Historias y push diferidos: sin `stories`/`story_lines`/`push_subscriptions` ni tipo de nodo `story` por ahora.)

**Política de respaldo (constraint del usuario)**: todo script que toque la BD (remota, compartida) sigue el patrón existente — dry-run por defecto, `--apply`, backup previo a `scripts/out/backup-*.json`, `--rollback`. Scripts: `migrate-redesign.js` (DDL + alters), `seed-quests.js`, `seed-shop.js`.

## Fases (cada una deployable, backend y frontend por fase)

| # | Fase | Contenido |
|---|---|---|
| 0 | Base | Merge `redesign/learning-path` → main (ambos repos); rama nueva `redesign/total`; `migrate-redesign.js` |
| 1 | UI kit | Tokens rosa/navy, fuentes, botones 3D, dark mode, Doty poses — re-pinta lo existente sin cambiar estructura |
| 2 | Layout | Bottom tabs + sidebar iconos + header HUD + camino-como-home + Zona de juego hub (crea `(app)/layout.tsx` compartido) |
| 3 | Juego seguro + explicar-fallo | Celebración por etapas, re-encolado sin vidas, combo x5, **explicación al fallar (C8)**, teclado |
| 4 | Repaso SRS | `review_items` + tab Repaso — adelantado por ser el lever educativo |
| 5 | Economía | Gemas + ledger + tienda + escudos + boost + rescate en checkpoints/arcade |
| 6 | Misiones | Plantillas + asignación diaria + cofres + UI Retos |
| 7 | Perfil + Doty | Perfil nuevo + Doty custom (cosméticos/gestos) + CEFR score |
| 8 | Liga (última) | Cohortes reales + cron semanal + gate por tamaño mínimo (sin bots) + UI en Retos |

**Primera tanda (construyo y luego paro para tu OK)**: fases 0-4 — piel nueva + layout + juego seguro/explicar-fallo + SRS. Es el corte "se siente nuevo + educativo". Después economía → misiones → perfil → liga, cada una con tu visto bueno.

**Diferido (fuera de este rediseño)**: historias con personajes (espera elenco + `ELEVENLABS_API_KEY`); PWA/push (lo asume la futura app React Native).

## Riesgos

- Migración en BD compartida → dry-run + backup + rollback obligatorios (patrón probado 3 veces).
- Rediseño de layout toca todas las páginas → fase 1 es solo tokens (bajo riesgo); fase 2 concentra el riesgo estructural en `(app)/layout.tsx` con rollback por git.
- Economía explotable (farmear gemas repitiendo lección fácil) → gemas por lección solo la primera vez al 100% + tope diario por fuente en `gem_ledger.reason`.
- Explicar-fallo: gramática tiene explicación real (jsonb); pronunciación/vocab derivan hint templado; oraciones usan traducción. Ítem sin buen hint degrada a "Respuesta correcta: X" sin romper el flujo.
- Liga con pocos usuarios → cohortes se llenan con los que haya (mínimo viable ~5); si no hay masa, la fase se pospone. Bots NO (anti-patrón que miente al usuario).
- `levels.unlock` global intacto: nada de esto toca `levels_progress` salvo lo ya diseñado en learning-path.

## Verificación

- Backend: specs jest para asignación de misiones (determinismo), SM-2 (progresión de intervalos), compra/gasto (saldo insuficiente, doble gasto), cierre de liga (promote/demote). Dry-runs con inventario impreso.
- Frontend: `tsc --noEmit` + eslint + `next build`; E2E con preview: loop completo día 1 (lección → celebración → explicación al fallar → misión avanza → cofre → gema → comprar escudo), repaso SRS con ítems vencidos, rescate en checkpoint, teclado en lección.
- Regresión: práctica de 6 modos, juegos, lecturas siguen funcionando tras fases 1-2.
