# Rediseño total de dots — "dots se siente juego"

**Fecha**: 2026-07-20 · **Estado**: aprobación pendiente · **Repos**: dots-webapp + dots-backend

## Objetivo

Rediseño total de la cara estudiante: UI mucho más intuitiva, divertida y visualmente impactante; progreso siempre visible; mecánicas de retención probadas (investigación Duolingo/Speak/Busuu 2025-2026); dos modalidades nuevas de aprendizaje (repaso SRS + historias con personajes). Admin queda funcional como está.

## Decisiones cerradas (grilling con el usuario)

| Tema | Decisión |
|---|---|
| Mecánicas retención | Misiones diarias + cofres · liga semanal · racha protagonista + escudos · gemas |
| Público | Todas las edades, tono juguetón estilo Duolingo (denso pero divertido) |
| Layout | Mobile-first con bottom tabs; desktop sidebar delgado de iconos |
| Marca | Diseño nuevo conservando rosa + navy del logo y Doty |
| Modalidades nuevas | Repaso SRS + historias con personajes (speaking/IA quedan fuera de esta fase) |
| Frontera | Solo cara estudiante; admin intacto |
| Gemas compran | Escudos de racha · cosméticos Doty · gestos Doty · boost XP x2 (15 min) · rescate en modos con stakes |
| Vidas | **Solo en modos con stakes** (checkpoints, arcade, modo desafío opcional). Lecciones del camino: infinitas, fallo re-encola hasta acertar. A 0 vidas → modal rescate con gemas o reiniciar gratis |
| Ramas | Mergear `redesign/learning-path` a main (ambos repos, verificada E2E); rediseño en rama nueva `redesign/total` |

Anti-decisiones (respaldadas por evidencia): sin corazones globales (backlash Energy 2025; la web de Duolingo nunca los tuvo), sin encadenamiento infinito de lecciones (bingers churnean más), máximo 1 notificación/día, gamificación premia — nunca castiga el aprender.

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
- **Retos** (`/quests`): misiones del día + liga semanal.
- **Repaso** (`/review`): sesión SRS del día.
- **Perfil** (`/profile`): Doty custom, nivel CEFR, calendario de racha, badges, stats, ajustes.

## C. Núcleo adictivo

### C1. Celebración fin de lección (todas las lecciones/juegos)
Secuencia por etapas en `result-screen.tsx` renovado: confetti → XP contando hacia arriba → barras de misiones subiendo con tick → llama de racha (+1) → posición de liga si cambió. Sonido de jingle. Es el payload de dopamina (+30% completion documentado).

### C2. Racha protagonista
- Llama animada en header; hitos 7/30/50/100/365 con pantalla completa de celebración.
- Calendario de racha en perfil.
- **Escudos**: `users.streak_freezes` ya existe — la tienda los vende (cap 2 equipados); el job nocturno ya los consume.
- Aviso "racha en peligro": push a la hora habitual del usuario (fase PWA).
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
- Camino: sin vidas; ítem fallado se re-encola al final hasta acertarlo; combo de 5 celebra con callout (nunca castiga).
- **Checkpoints y juegos arcade**: 3 vidas. A 0 → modal Doty preocupado: "Continúa por 250 gemas" / "Reiniciar gratis".
- **Modo desafío** (opcional, por lección ya completada): 3 vidas, XP x1.5. Entrada desde el popover del nodo. El que busca tensión la elige.

### C6. Liga semanal (fase tardía — necesita economía XP viva)
- Cohortes de ~30 usuarios por semana y división (Bronce → Plata → Oro al inicio), ranking por XP semanal, top 10 asciende / bottom 5 desciende, opt-out en ajustes.
- Tablas: `league_cohorts` (week, tier) + `league_members` (cohort_id, user_id, xp_week). Asignación al primer XP de la semana; cierre por cron domingo noche (job NestJS `@Cron`).
- Dato guía: +17% tiempo de estudio, 3x usuarios altamente comprometidos.

### C7. Teclado en lecciones (web/desktop)
Enter = confirmar/continuar · 1-9 = opción n · Ctrl+Space = replay audio · Space = continuar en pantallas de fin. Hook `use-lesson-keys.ts` + hints visuales sutiles. Aplica a práctica, lecciones nuevas, checkpoint, repaso.

## D. Modalidades nuevas

### D1. Repaso SRS (tab Repaso)
- Cola de repetición espaciada alimentada por fallos en TODAS las modalidades (oraciones con `times_wrong>0`, vocab, pares mínimos, ítems de gramática) — hook en los endpoints de progreso existentes.
- `review_items` (user_id, kind `sentence|vocab|pronunciation|grammar`, ref_id, ease, interval_days, due_at, lapses; UNIQUE(user_id, kind, ref_id)). Algoritmo SM-2 simplificado: acierto → intervalo x ease (1d, 3d, 7d...); fallo → reset a 1d, ease baja.
- Sesión: `GET /review/session` (hasta 15 vencidos, mezcla tipos) → UI reusa las primitivas de lección existentes (`useLessonSeries`, componentes por tipo) → `PUT /review/session` actualiza SRS + XP normal.
- Estado vacío ("nada vencido hoy"): Doty celebrando + CTA al camino.

### D2. Historias con personajes (nodos del camino)
- Episodios donde los personajes Dots dialogan, cada línea con su voz ElevenLabs (pipeline TTS + asignación por personaje del sistema existente — aquí el personaje es fijo por rol en el guion, no balanceado).
- Player: burbujas de diálogo con avatar + audio por línea, tap para avanzar; intercala preguntas cloze (completar la frase dicha) y de comprensión (elegir respuesta). Al final: resumen + XP.
- Tablas: `stories` (key, season, episode, title, description_es, enabled) + `story_lines` (story_id, position, character_id, kind `line|cloze|choice`, text_en, text_es, audio, meta jsonb con opciones/respuesta).
- Se colocan en el camino como `path_nodes` type `story` (ref_id → story); progreso vía `node_progress` existente. `GET /path/nodes/:id` gana la rama `story`.
- Contenido: yo redacto temporada 1 (6-8 episodios A1 con doty y doty-fem; entra el elenco futuro cuando exista) como seed con backup/rollback; audios vía `generate-narrations.js --target stories`.

## E. Perfil y Doty customizable

- **Avatar Doty custom**: slots hat / outfit / background + gestos equipados (presets de animación sobre las poses SVG por capas — viable sin runtime nuevo). Se muestra en perfil, liga y celebraciones.
- **Nivel CEFR visible**: "A1 · 40%" derivado del camino (dificultad actual + % nodos completados). XP mide esfuerzo; esto mide habilidad. Sin tabla nueva.
- Calendario de racha, badges existentes, stats (XP total, lecciones, precisión), ajustes (sonido, tema, opt-out liga).

## F. PWA + push (fase final)

Manifest + instalable + Web Push (iOS ≥16.4 instalada): 1 recordatorio/día a la hora habitual (mediana de `daily_use`), copy especial si la racha peligra. `push_subscriptions` (user_id, endpoint, keys). Cron nocturno en backend.

## Modelo de datos — resumen (todo aditivo)

Nuevas: `quest_templates`, `user_quests`, `gem_ledger`, `shop_items`, `user_items`, `league_cohorts`, `league_members`, `review_items`, `stories`, `story_lines`, `push_subscriptions`. ALTER `users`: `gems`, `xp_boost_until`, `daily_goal_xp`. `path_nodes.type` gana valor `story`.

**Política de respaldo (constraint del usuario)**: todo script que toque la BD (remota, compartida) sigue el patrón existente — dry-run por defecto, `--apply`, backup previo a `scripts/out/backup-*.json`, `--rollback`. Scripts: `migrate-redesign.js` (DDL + alters), `seed-quests.js`, `seed-shop.js`, `seed-stories.js`.

## Fases (cada una deployable, backend y frontend por fase)

| # | Fase | Contenido |
|---|---|---|
| 0 | Base | Merge `redesign/learning-path` → main (ambos repos); rama nueva `redesign/total`; `migrate-redesign.js` |
| 1 | UI kit | Tokens rosa/navy, fuentes, botones 3D, dark mode, Doty poses — re-pinta lo existente sin cambiar estructura |
| 2 | Layout | Bottom tabs + sidebar iconos + header HUD + camino-como-home + Zona de juego hub |
| 3 | Juego seguro | Celebración por etapas, re-encolado sin vidas en camino, combo x5, teclado |
| 4 | Economía | Gemas + ledger + tienda + escudos + boost + rescate en checkpoints/arcade + modo desafío |
| 5 | Misiones | Plantillas + asignación diaria + cofres + UI Retos |
| 6 | Repaso | SRS backend + tab Repaso |
| 7 | Historias | Tablas + player + seed temporada 1 + audios TTS |
| 8 | Identidad | Perfil nuevo + Doty custom (cosméticos/gestos) + CEFR score |
| 9 | Liga | Cohortes + cron semanal + UI en Retos |
| 10 | PWA | Manifest + push racha en peligro |

Orden defendible: 1-3 hacen que TODO se sienta nuevo ya; 4-5 crean el loop diario; 6-8 profundizan; 9-10 escalan retención.

## Riesgos

- Migración en BD compartida → dry-run + backup + rollback obligatorios (patrón probado 3 veces).
- Rediseño de layout toca todas las páginas → fase 1 es solo tokens (bajo riesgo); fase 2 concentra el riesgo estructural en `(app)/layout.tsx` con rollback por git.
- Economía explotable (farmear gemas repitiendo lección fácil) → gemas por lección solo la primera vez al 100% + tope diario por fuente en `gem_ledger.reason`.
- Historias: costo TTS (~centavos/línea, estimado en dry-run); guion revisable antes de generar audio.
- Liga con pocos usuarios → cohortes se llenan con los que haya (mínimo viable 5); bots NO (anti-patrón).
- `levels.unlock` global intacto: nada de esto toca `levels_progress` salvo lo ya diseñado en learning-path.

## Verificación

- Backend: specs jest para asignación de misiones (determinismo), SM-2 (progresión de intervalos), compra/gasto (saldo insuficiente, doble gasto), cierre de liga (promote/demote). Dry-runs con inventario impreso.
- Frontend: `tsc --noEmit` + eslint + `next build`; E2E con preview: loop completo día 1 (lección → celebración → misión avanza → cofre → gema → comprar escudo), repaso con ítems vencidos, historia completa con audio, rescate en checkpoint, modo desafío, teclado.
- Regresión: práctica de 6 modos, juegos, lecturas siguen funcionando tras fases 1-2.
