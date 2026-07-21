# Juegos Arcade + Capa Social — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 9 juegos nuevos RN-safe (Dot Match, ¿Verdad o Trampa?, Memoria Relámpago, Escucha Rápida, Torre de Palabras, Constructor, Palabra del Día, Mini Crucigrama, Carrera Fantasma) + 4 capas sociales (Trono por juego, Torneo semanal, Reto directo 1v1, Rivalidades automáticas), reutilizando el contenido y la infraestructura de juegos existente.

**Architecture:** Cada juego = un endpoint de contenido en `GamesModule` (backend) + una página en `app/(app)/games/<key>/` (frontend) que reusa un kit compartido nuevo (`GameIntro`/`GameResult`/hooks). El score SIEMPRE va por el `POST /games/score` existente (XP 15 + 25 récord). Lo social se apoya en `user_game_scores` (trono), tablas nuevas (`tournament_scores`, `challenges`, `game_runs`, `daily_game_state`) y el leaderboard semanal existente (rivalidades). Mazos competitivos deterministas por semilla (mulberry32, patrón de `readings/quiz.ts`).

**Tech Stack:** NestJS 11 + TypeORM + PostgreSQL (schema `dots`, BD remota compartida) / Next.js 16 + React 19 + Tailwind 4 (CSS vars de `app/globals.css`).

## Global Constraints

- **RN-safe obligatorio en los 9 juegos**: solo tap/pointer (swipe con Pointer Events); teclados SIEMPRE en pantalla como botones propios (nunca `<input>` de texto libre ni `addEventListener("keydown")` como único input); animación solo `transform`/`opacity` + ticks rAF/interval (portable a Reanimated); nada de hover como única señal; nada de HTML5 Drag API; nada de canvas.
- **BD compartida remota**: todo script que toque tablas = dry-run por defecto, `--apply`, backup JSON en `scripts/out/`, `--rollback <file>`. Todo DDL aditivo (`IF NOT EXISTS`).
- **XP**: exclusivamente vía `POST /games/score` existente (`XP_PER_GAME_PLAY=15`, `XP_NEW_HIGH_SCORE_BONUS=25`). No inventar otras vías de XP.
- **Gemas**: solo social — trono +10, torneo top-3 = 50/30/15, reto ganador +15 / perdedor +3. Siempre vía `awardGems()` de `src/common/gems.ts` (defensivo, no-op si tablas faltan).
- **UI en español**, contenido a aprender en inglés. Tono juguetón todas las edades (ni infantil ni corporativo).
- **Navegación**: `router.push`, nunca `window.location.replace` (descarta token en memoria). `games-list.tsx` usa `window.location.assign` — mantener ese patrón ahí.
- Los juegos con audio necesitan **gesto de inicio** (pantalla "Empezar") antes del primer autoplay.
- Correcciones client-side con `correct` embebido = patrón aceptado (igual que dotaxi/flashcards), EXCEPTO wordle/crucigrama (server-side, si no el payload revela la respuesta).
- Node: `source ~/.nvm/nvm.sh` antes de node/npm. Backend en `~/Projects/Endurance/dots/dots-backend`, frontend en `~/Projects/Endurance/dots/dots-webapp`. Rama: `redesign/total` en ambos.

## Hechos del código existente (verificados)

- `dots.games`: `id, name, path, unlock (levels completados), enabled`. `GET /games` computa `unlocked` contra `levels_progress`.
- `POST /games/score` (`games.service.ts:97`): body `{gameKey, score}` → upsert high score en `user_game_scores (id_user, game_key, high_score)`, `daily_use`, XP. `GAME_KEY_TO_ID` hardcodeado (1-5). `GameKey` union en `games.dto.ts`.
- Contenido: `words (text, img)`, `sentences (text con "__", m_word, img, enabled, sentence_extension, voice_key vía characters)`, `vocab_items (text EN, meaning ES, img, audio, id_pack)`, `vocab_packs (key, title)`.
- Audio: frontend arma URL con `resolveSentenceSoundUrl(id, ext, voiceKey)` de `constants.ts` (Cloudinary `dots/sounds/sentences/`). ~814 narraciones ya migradas.
- Seeded RNG: `mulberry32` en `src/modules/readings/quiz.ts` (copiar patrón, no importar entre módulos — extraer a `src/common/seeded.ts`).
- Frontend: fetchers en `services/games.service.ts`; `submitGameScoreService(gameKey, score)` en `services/engagement.service.ts:135`; `getLeaderboardService` en `:181`; sonidos `lib/feedback-sounds.ts`; `Doty` poses; visual por juego en `components/interactive-column/games-list.tsx` `gameVisual()`.

## Registro de juegos nuevos (ids fijos, insertados con id explícito)

| id | gameKey | name | path | unlock |
|----|---------|------|------|--------|
| 6 | `dot-match` | Dot Match | `/dot-match` | 0 |
| 7 | `true-false` | ¿Verdad o Trampa? | `/true-false` | 0 |
| 8 | `memory` | Memoria Relámpago | `/memory` | 1 |
| 9 | `audio-blitz` | Escucha Rápida | `/audio-blitz` | 2 |
| 10 | `word-tower` | Torre de Palabras | `/word-tower` | 3 |
| 11 | `sentence-builder` | Constructor | `/sentence-builder` | 4 |
| 12 | `wordle` | Palabra del Día | `/wordle` | 5 |
| 13 | `crossword` | Mini Crucigrama | `/crossword` | 8 |
| 14 | `ghost-race` | Carrera Fantasma | `/ghost-race` | 6 |

Emojis para `gameVisual()`: 🔗 dot-match · 🃏 true-false · 🧠 memory · 🎧 audio-blitz · 🗼 word-tower · 🧱 sentence-builder · 🟩 wordle · ✏️ crossword · 👻 ghost-race.

---

# FASE A — Infraestructura común

### Task A1: Migración BD + registro de juegos + GameKey

**Files:**
- Create: `dots-backend/scripts/migrate-games-social.js`
- Modify: `dots-backend/package.json` (script `migrate:games-social`)
- Modify: `dots-backend/src/modules/games/games.dto.ts` (union `GameKey` + ids)
- Modify: `dots-backend/src/modules/games/games.service.ts` (`GAME_KEY_TO_ID` 6-14)
- Create: `dots-backend/src/common/seeded.ts` + Test: `src/common/seeded.spec.ts`
- Create entidades+repos: `daily_game_state`, `game_runs`, `tournament_score`, `tournament_week`, `challenge` en `src/common/entity|repository/`

**Interfaces (produce):**
- `GameKey` = union existente + `'dot-match'|'true-false'|'memory'|'audio-blitz'|'word-tower'|'sentence-builder'|'wordle'|'crossword'|'ghost-race'`
- `mulberry32(seed: number): () => number` y `seededShuffle<T>(arr: readonly T[], seed: number): T[]` en `src/common/seeded.ts`
- `weekKey(date: Date): string` → `'2026-W30'` (ISO week) en `src/common/seeded.ts`

- [ ] **Step 1**: DDL en `migrate-games-social.js` (patrón exacto de `migrate-economy.js`: pg Client, env DB_*, ssl `rejectUnauthorized:false`, dry-run default, `--apply`, backup a `scripts/out/backup-games-social-<ts>.json`, `--rollback`):

```sql
CREATE TABLE IF NOT EXISTS dots.daily_game_state (
  id serial PRIMARY KEY, user_id int NOT NULL, game_key varchar(32) NOT NULL,
  day date NOT NULL, state jsonb NOT NULL DEFAULT '{}',
  completed boolean NOT NULL DEFAULT false, score int NOT NULL DEFAULT 0,
  updated_at timestamp NOT NULL DEFAULT now(), UNIQUE(user_id, game_key, day));
CREATE TABLE IF NOT EXISTS dots.game_runs (
  id serial PRIMARY KEY, user_id int NOT NULL, game_key varchar(32) NOT NULL,
  deck_seed int NOT NULL, score int NOT NULL, duration_ms int NOT NULL,
  events jsonb NOT NULL DEFAULT '[]', created_at timestamp NOT NULL DEFAULT now());
CREATE INDEX IF NOT EXISTS idx_game_runs_user ON dots.game_runs(user_id, game_key);
CREATE TABLE IF NOT EXISTS dots.tournament_scores (
  id serial PRIMARY KEY, user_id int NOT NULL, week varchar(8) NOT NULL,
  game_key varchar(32) NOT NULL, best_score int NOT NULL DEFAULT 0,
  plays int NOT NULL DEFAULT 0, updated_at timestamp NOT NULL DEFAULT now(),
  UNIQUE(user_id, week));
CREATE TABLE IF NOT EXISTS dots.tournament_weeks (
  week varchar(8) PRIMARY KEY, game_key varchar(32) NOT NULL,
  settled boolean NOT NULL DEFAULT false, settled_at timestamp);
CREATE TABLE IF NOT EXISTS dots.challenges (
  id serial PRIMARY KEY, challenger_id int NOT NULL, challenged_id int NOT NULL,
  game_key varchar(32) NOT NULL, deck_seed int NOT NULL,
  challenger_score int, challenged_score int,
  status varchar(16) NOT NULL DEFAULT 'pending',
  created_at timestamp NOT NULL DEFAULT now(), resolved_at timestamp);
CREATE INDEX IF NOT EXISTS idx_challenges_in ON dots.challenges(challenged_id, status);
```

Más el registro (INSERT con id explícito, `ON CONFLICT (id) DO NOTHING`, luego `setval` de la secuencia de `dots.games` a `GREATEST(max(id), 14)`), con los 9 rows de la tabla de arriba.

- [ ] **Step 2**: `src/common/seeded.ts` — copiar `mulberry32` de `readings/quiz.ts` + `seededShuffle` (Fisher-Yates con rng inyectado) + `weekKey` (ISO-8601 week: jueves define el año). Spec: mismo seed ⇒ misma permutación; seeds distintos ⇒ distinta (probabilístico); `weekKey(new Date('2026-07-21'))` = `'2026-W30'`; `weekKey(new Date('2026-01-01'))` = `'2026-W01'`.
- [ ] **Step 3**: extender `GameKey` + `GAME_KEY_TO_ID` (6-14). Entidades/repos nuevos siguiendo `review_item.entity.ts` como plantilla (snake_case columnas, schema `dots`).
- [ ] **Step 4**: `npm test` (specs seeded verdes) + `npm run build` limpio. Dry-run del script (imprime DDL + rows). **NO `--apply` sin autorización explícita del usuario** (BD compartida).
- [ ] **Step 5**: commit backend `feat(games): infra juegos arcade+social (migración, seeded, keys 6-14)`.

### Task A2: Kit frontend compartido de juegos

**Files:**
- Create: `dots-webapp/components/games/shared/game-intro.tsx`, `game-result.tsx`
- Create: `dots-webapp/hooks/use-countdown.ts`, `dots-webapp/hooks/use-ticker.ts`
- Modify: `dots-webapp/services/games.service.ts` (tipos+fetchers se añaden por juego en su task)
- Modify: `dots-webapp/components/interactive-column/games-list.tsx` (`gameVisual`: 9 emojis nuevos)

**Interfaces (produce):**
- `<GameIntro emoji title howTo={string[]} record={number|null} throne={{name,score}|null} onStart={()=>void} />` — pantalla inicial (gesto pre-audio) con "Cómo se juega", tu récord, y el trono (si Task E1 ya sirve datos; hasta entonces prop `throne={null}`).
- `<GameResult gameKey score onReplay onExit extra? />` — llama `submitGameScoreService(gameKey, score)` al montar, muestra `+XP`, `isNewHighScore`, y (tras E1) `tookThrone`. Botones "Otra vez" / "Salir" (`router.push('/play')`).
- `useCountdown(seconds, onEnd)` → `{remaining, running, start, stop}` (interval 100ms, sin drift: computa contra `startedAt`).
- `useTicker(fps, cb, running)` — rAF loop para juegos con física ligera (torre).

- [ ] **Step 1**: escribir los 4 archivos. Estilo: `dots-card`, `dots-pressable`, CSS vars (`--accent`, `--border`, `--surface`), Doty pose en intro/result (pose "12" intro, "07" éxito — verificar poses existentes en `components/ui/doty/poses.ts`).
- [ ] **Step 2**: `npm run lint && npm run build` limpios.
- [ ] **Step 3**: commit `feat(games): kit compartido GameIntro/GameResult + hooks countdown/ticker`.

---

# FASE B — Juegos S (arcade tap-only)

> Patrón por juego: endpoint de contenido en `games.controller/service` + tipos/fetcher en `services/games.service.ts` + página `app/(app)/games/<key>/page.tsx` ("use client", `GameIntro` → juego → `GameResult`, `playSound` correct/wrong) + emoji en `gameVisual`. Cada endpoint acepta `?seed=<int>` opcional: con seed usa `seededShuffle`, sin seed `shuffle` normal (lo usan torneo/reto/fantasma después).

### Task B1: ¿Verdad o Trampa? (swipe)

**Files:** Modify backend `games.{controller,service,dto}.ts` · Create `dots-webapp/app/(app)/games/true-false/page.tsx`

**Contrato:** `GET /games/true-false?seed?` → `TrueFalseCardDto[]` (~40): `{id, en, es, isCorrect}`.
Construcción server: pool = `vocab_items` con `meaning`; 60% pares correctos `{en: text, es: meaning}`; 40% trampas: mitad `meaning` de OTRO item (mismatch), mitad del const `FALSE_FRIENDS` (lista curada en `games.service.ts`, ~15: embarrassed/embarazada(avergonzado), actually/actualmente(en realidad), library/librería(biblioteca), exit/éxito(salida), carpet/carpeta(alfombra), rope/ropa(cuerda), soap/sopa(jabón), fabric/fábrica(tela), lecture/lectura(conferencia), assist/asistir(ayudar), realize/realizar(darse cuenta), sensible/sensible(sensato), success/suceso(éxito), constipated/constipado(estreñido), argument/argumento(discusión)).

**Mecánica:** carta grande "en = es"; swipe → derecha = "verdad", izquierda = "trampa" (Pointer Events: `onPointerDown/Move/Up` sobre la carta, `transform: translateX(dx) rotate(dx/20deg)`, umbral ±80px, snap-back animado si no llega) + 2 botones ✓/✗ (fallback y accesibilidad). 60s countdown. Racha: multiplicador ×1..×5 (cada 5 seguidas sube). Score = Σ 10×mult. Fallo resta racha a 0 y muestra 1.2s la corrección ("trampa: exit = salida").

- [ ] Backend: DTO + service + controller + fetcher. Build limpio.
- [ ] Frontend page. Lint+build limpios.
- [ ] Verificar en preview: jugar ronda completa, swipe y botones, XP chip en result.
- [ ] Commits: backend `feat(games): endpoint true-false con falsos amigos`, frontend `feat(games): ¿Verdad o Trampa? (swipe RN-safe)`.

### Task B2: Dot Match (parejas contrarreloj)

**Files:** Modify backend games module · Create `app/(app)/games/dot-match/page.tsx`

**Contrato:** `GET /games/match?seed?` → `MatchPairDto[]` (hasta 60): `{id, en, es}` de `vocab_items` con `meaning`.

**Mecánica:** 3 rondas: 60s/45s/30s con objetivo 15/20/25 parejas. Tablero: 2 columnas × 5 filas (izq EN, der ES, orden independiente). Tap en una de cada columna: acierto → ambas salen con animación (scale+fade) y entran las siguientes de la cola; fallo → shake + ambas se des-seleccionan + rompe combo. Combo sin errores visible (contador 🔥). Score = parejas×10 + combo máximo×5. Pasar objetivo antes del tiempo → siguiente ronda (banner "¡Ronda 2!"); no llegar → GameResult con lo acumulado.

- [ ] Backend + fetcher; frontend page; lint+build; preview E2E; commits `feat(games): endpoint match pairs` / `feat(games): Dot Match contrarreloj`.

### Task B3: Memoria Relámpago

**Files:** Modify backend games module · Create `app/(app)/games/memory/page.tsx`

**Contrato:** `GET /games/memory?seed?` → `MemoryPairDto[]` (8): `{id, word, img}` de `words` con `img IS NOT NULL`.

**Mecánica:** grid 4×4 de cartas boca abajo (8 palabras + 8 imágenes). Tap voltea (CSS `rotateY` con `transform-style: preserve-3d`); 2 volteadas: match (palabra↔su imagen) → quedan abiertas con borde `--success`; no-match → 800ms y se cierran. Cronómetro asciende + contador de movimientos. Score = `max(50, 1000 − segundos×8 − movimientos×10)`. Sin fallo posible: siempre termina.

- [ ] Backend + fetcher; frontend; lint+build; preview E2E; commits.

### Task B4: Escucha Rápida (audio blitz)

**Files:** Modify backend games module · Create `app/(app)/games/audio-blitz/page.tsx`

**Contrato:** `GET /games/audio-blitz?seed?` → `AudioBlitzDto[]` (12): `{id, ext, voiceKey, text, correct, options}` — sentences con `sentence_extension IS NOT NULL`, `enabled`, `m_word` no vacío; `options` = correct + 3 distractores del pool de `m_word` (limpiados con el mismo `clean()` de dotaxi); `voiceKey` = key del character si no es default (mismo join que usa practice).

**Mecánica:** por pregunta: se reproduce la narración (URL con `resolveSentenceSoundUrl(id, ext, voiceKey)`, componente `Sound` autoplay tras el gesto de GameIntro), botón replay grande 🔊, la frase NO se muestra — solo 4 opciones: "¿qué palabra escuchaste?". 7s por pregunta (barra); acierto rápido da bonus: score += 100 + segundosRestantes×10. Timeout = fallo (muestra la frase completa 1.5s con la palabra resaltada). 12 preguntas.

- [ ] Backend + fetcher; frontend; lint+build; preview E2E con audio real; commits.

---

# FASE C — Juegos M

### Task C1: Torre de Palabras (categorías)

**Files:** Modify backend games module · Create `app/(app)/games/word-tower/page.tsx`

**Contrato:** `GET /games/word-tower?seed?` → `{rounds: TowerRoundDto[]}` (20): `{word, correct, options}` donde `options` = 3 títulos de `vocab_packs` (el correcto + 2 señuelos). Server: elegir packs con ≥5 items y `meaning` presente; excluir packs 'cognados'/'falsos amigos' si sus keys existen (categoría ambigua); cada ronda toma un item y su pack.

**Mecánica:** palabra cae desde arriba (div con `transform: translateY` animado por `useTicker`; duración inicial 5s, −150ms por ronda, mínimo 2.5s — mismos ritmos que dotaxi). Abajo 3 botones-carril con las categorías (se reordenan por ronda). Tap carril correcto antes de aterrizar → +100×combo; carril errado o aterrizaje → pierde 1 de 3 vidas (❤️), muestra la respuesta. 3 vidas fuera = fin. Score acumulado.

- [ ] Backend + fetcher; frontend; lint+build; preview E2E; commits.

### Task C2: Constructor (arma la frase que oyes)

**Files:** Modify backend games module · Create `app/(app)/games/sentence-builder/page.tsx`

**Contrato:** `GET /games/sentence-builder?seed?` → `BuilderSentenceDto[]` (8): `{id, ext, voiceKey, answer: string[], chips: string[]}` — sentences con narración; `answer` = tokens de `text.replace('__', clean(m_word)).split(/\s+/)` (puntuación final pegada al último token se limpia); `chips` = answer + 2 distractores (palabras de otros m_word del pool, sin duplicar tokens del answer) barajados.

**Mecánica:** suena la narración (replay 🔊 disponible), NO se muestra la frase. Abajo chips de palabras; tap chip → se mueve a la bandeja superior en orden; tap en la bandeja → vuelve abajo. Botón "Comprobar" activo cuando bandeja ≥ answer.length−2: compara orden exacto (case-insensitive). Acierto → frase completa visible + verde, +100 + bonus sin errores 20. Fallo → se marca en rojo la primera palabra fuera de lugar, reintento (máx 2; al 2º fallo muestra la respuesta y pasa). 8 frases; sin vidas.

- [ ] Backend + fetcher; frontend; lint+build; preview E2E; commits.

---

# FASE D — Juegos diarios (corrección server-side)

### Task D1: Palabra del Día (wordle)

**Files:**
- Create: `dots-backend/src/modules/daily-games/{daily-games.module,daily-games.controller,daily-games.service,wordle.logic,daily-games.dto}.ts` + Test: `wordle.logic.spec.ts`
- Create: `dots-webapp/app/(app)/games/wordle/page.tsx`
- Modify: `dots-webapp/services/games.service.ts`

**Interfaces (produce):**
- `GET /games/wordle` → `{day, length, maxTries: 6, guesses: {word, marks: Mark[]}[], done, won, hintEs: string|null, answer: string|null}` (`answer` solo si `done`). `Mark = 'hit'|'present'|'miss'`.
- `POST /games/wordle/guess` body `{guess: string}` → mismo shape (validación: solo A-Z, longitud exacta, no si `done`; 400 si no).
- Pure: `scoreWordleGuess(answer: string, guess: string): Mark[]` — algoritmo two-pass (hits primero, luego presents con contador de letras restantes, doble letra correcta).
- Palabra del día: pool = `vocab_items.text` alfabético puro 4-6 letras, `UPPER`, dedup, orden estable por id; índice = `mulberry32(hash(day))()` → pick. `hintEs` = `meaning` del item, se revela tras el 3er intento fallido (server manda `hintEs` solo cuando `guesses.length >= 3`).
- Estado en `daily_game_state (game_key='wordle', day)`: `state = {guesses: [...], answerId}`.
- Al ganar: server llama internamente `gamesService.submitScore(userId, 'wordle', (7−intentos)×50)` — el cliente NO envía score (server-authoritative).

**Spec `wordle.logic.spec.ts`:** `scoreWordleGuess('APPLE','ALLEY')` → `['hit','present','miss','present','miss']`... casos: doble letra en guess con una en answer marca solo una `present`; hit consume antes que present.

- [ ] **Step 1**: spec de `scoreWordleGuess` → falla → implementación → verde.
- [ ] **Step 2**: module/service/controller (JwtAuthGuard igual que games) + registro en `app.module.ts`. Build limpio.
- [ ] **Step 3**: frontend: grid 6×N, teclado QWERTY en pantalla (botones propios, 3 filas + Enter/⌫, colorean según marks acumulados), animación flip por fila al responder, estado "ya jugaste hoy" (muestra resultado + countdown a medianoche). Lint+build.
- [ ] **Step 4**: preview E2E (jugar día actual). Commits backend/frontend.

### Task D2: Mini Crucigrama diario

**Files:**
- Create: `dots-backend/src/modules/daily-games/crossword-gen.ts` + Test: `crossword-gen.spec.ts`
- Modify: `daily-games.{controller,service,dto}.ts`
- Create: `dots-webapp/app/(app)/games/crossword/page.tsx`

**Interfaces (produce):**
- Pure: `buildCrossword(seed: number, pool: {text: string, meaning: string}[]): Crossword | null` donde `Crossword = {size: 5, slots: {id, dir: 'A'|'D', row, col, len, answer, clueEs}[]}`.
- Generación: 3 plantillas fijas de slots 5×5 (patrones de mini-crucigrama con 5-6 slots, cruces definidos); elegir plantilla por seed; llenar slots por backtracking sobre el pool (palabra alfabética `UPPER` del `len` exacto, cruces coinciden letra a letra); si una semilla no llena, probar `seed+1` (máx 20 saltos) — determinista igualmente porque parte del mismo día.
- `GET /games/crossword` → `{day, size, slots: [{id, dir, row, col, len, clueEs}], grid: (string|null)[][] (celdas del usuario), done, won}` (answers NUNCA viajan antes de done).
- `POST /games/crossword/check` body `{cells: string[][]}` → `{correct: boolean[][], done, won, slots?: conAnswers si done}`. `done` cuando todo correcto (won) o al 5º check (se rinde con respuestas). Estado en `daily_game_state('crossword')`. Al ganar: `submitScore(userId,'crossword', 300 − checksUsados×50)` server-side.

**Spec:** mismo seed ⇒ mismo puzzle; toda celda compartida entre slots tiene la misma letra; todos los answers existen en el pool; pool insuficiente ⇒ `null`.

- [ ] **Step 1**: spec → implementación `crossword-gen.ts` → verde (pool de prueba sintético en el spec, no BD).
- [ ] **Step 2**: endpoints + estado diario. Build.
- [ ] **Step 3**: frontend: grid 5×5 (celdas negras donde no hay slot), tap celda → resalta slot activo + pista abajo, teclado A-Z en pantalla, botón "Comprobar" (marca verdes/rojas), contador de checks restantes. Lint+build.
- [ ] **Step 4**: preview E2E. Commits.

---

# FASE E — Capa social

### Task E1: Trono por juego

**Files:**
- Modify: `dots-backend/src/modules/games/games.{service,controller,dto}.ts`
- Modify: `dots-webapp/services/games.service.ts`, `components/games/shared/{game-intro,game-result}.tsx`, páginas de juegos existentes (5 viejas) para pasar `throne`

**Interfaces:**
- `GET /games/records` → `RecordDto[]`: `{gameKey, holderName, holderId, highScore}` — máx por `game_key` de `user_game_scores` join `users` (raw SQL `DISTINCT ON (game_key) ... ORDER BY game_key, high_score DESC, updated_at ASC` — el más antiguo desempata).
- `SubmitScoreResponseDto` += `{tookThrone: boolean, dethronedName: string | null}`: en `submitScore`, antes del upsert leer el récord global del gameKey; si `score > max global` y el holder era otro usuario → `tookThrone=true`, `dethronedName`, y `awardGems(manager, userId, 10, 'throne', gameKey)` (defensivo).
- Frontend: `GameIntro` muestra "🏆 <holder> reina con <score> — ¡destrónalo!" (fetch `getGameRecordsService()`); `GameResult` muestra banner "👑 ¡Trono robado a <name>!" si `tookThrone`.

- [ ] Backend (+ build), frontend kit + wiring en las 5 páginas viejas (solo pasar props, sin tocar su mecánica). Preview E2E: batir récord propio vs global. Commits.

### Task E2: Torneo semanal

**Files:**
- Create: `dots-backend/src/modules/tournament/{tournament.module,controller,service,dto}.ts` + Test: `tournament.service.spec.ts` (rotación y settle puros)
- Modify: `dots-webapp/app/(app)/(hub)/quests/page.tsx` + Create `components/quests/tournament-card.tsx`
- Modify: páginas de juegos de la rotación (leen `?tournament=1`)

**Interfaces:**
- Rotación: `TOURNAMENT_ROTATION = ['dot-match','true-false','audio-blitz','memory','word-tower','speed-round','sentence-builder']`; juego de la semana = `ROTATION[isoWeekNumber % 7]`; seed del mazo = hash de `weekKey`.
- `GET /tournament` → `{week, gameKey, gameName, endsAt, top: {name, score}[] (10), me: {rank, best, plays} | null}`. Efecto lazy: si existe semana anterior con scores y `tournament_weeks.settled=false` → settle: top 3 → `awardGems` 50/30/15 (reason `tournament`, ref week), marcar settled. (Sin cron: el primer visitante de la semana liquida la anterior.)
- `POST /tournament/score` `{score}` → upsert `tournament_scores` (best = max, plays+1) de la semana actual.
- Frontend: `tournament-card.tsx` en /quests: juego de la semana, tabla top-10, tu puesto, CTA "Jugar torneo" → `router.push('/games/<path>?tournament=1')`. Las páginas de juegos: si `useSearchParams` trae `tournament=1` → fetch de contenido con `seed=<hash weekKey>` (mismo mazo para todos) y en el finish, además del submit normal, `postTournamentScoreService(score)`.

- [ ] Spec settle (mock repos: semana previa sin settle → 3 awards + marked; ya settled → no-op). Backend build. Frontend card + wiring `?tournament=1` en los juegos de la rotación (los de fases B/C ya aceptan `seed`). Preview E2E. Commits.

### Task E3: Reto directo 1v1

**Files:**
- Create: `dots-backend/src/modules/challenges/{challenges.module,controller,service,dto}.ts`
- Create: `dots-webapp/components/quests/challenges-panel.tsx` · Modify: quests page, `components/shell/app-nav.tsx` (badge)

**Interfaces:**
- `POST /challenges` `{challengedId, gameKey}` → `{id, deckSeed}` (valida: challenged existe, no self, gameKey ∈ juegos con seed, máx 3 pendientes salientes). El retador juega inmediatamente con ese seed y reporta con score.
- `POST /challenges/:id/score` `{score}` → guarda en el lado que corresponda (challenger primero; challenged solo si status pending y es el retado). Cuando ambos scores existen → resolver: mayor gana, `awardGems` +15 ganador / +3 perdedor (empate: +9 y +9), status `played`, `resolved_at`.
- `GET /challenges` → `{incoming: [{id, from, gameKey, gameName, myScore: null, theirScore: hidden}], outgoing: [...], finished: últimos 5 con resultado}` — el score rival se OCULTA hasta que juegas (anti-info).
- `POST /challenges/:id/decline`.
- Frontend: en /quests panel "⚔️ Retos": entrantes ("María te retó a Dot Match — Aceptar/Rechazar"), salientes (esperando), historial con W/L. "Retar" desde el leaderboard: en `top-students.tsx` botón ⚔️ por fila → dialog elegir juego → crea reto → lanza el juego con `?challenge=<id>&seed=<deckSeed>`. Páginas de juegos: con `challenge` param, al terminar POST score del reto (además del submit normal). Badge: contador de entrantes pendientes en el tab Retos (`app-nav.tsx`, fetch ligero en el layout hub).

- [ ] Backend (validaciones + resolución transaccional) + build. Frontend panel + botón en leaderboard + wiring param + badge. Preview E2E con 2 usuarios (crear reto con user admin, aceptar con otro). Commits.

### Task E4: Rivalidades automáticas

**Files:**
- Modify: `dots-backend/src/modules/me/{me.service,me.controller,me.dto}.ts`
- Create: `dots-webapp/components/quests/rival-banner.tsx` · Modify: quests page + `components/shell/app-header.tsx`

**Interfaces:**
- `GET /me/rival` → `{above: {name, delta} | null, below: {name, delta} | null}` — sobre el leaderboard semanal existente (misma query que `/leaderboard?period=week`): vecino inmediato arriba/abajo en XP semanal. `delta` = diferencia de XP.
- Frontend: `rival-banner.tsx`: "👀 Estás a **{delta} XP** de superar a **{above.name}**" (o "🛡️ {below.name} está a {delta} XP de alcanzarte — no aflojes"). En /quests arriba del leaderboard + versión compacta en `app-header` (solo desktop, junto al XP). Adelantamiento: en localStorage `rival_prev` guarda `{aboveName, ts}`; si al cargar el `above` anterior ahora está DEBAJO tuyo → toast "😤 ¡Superaste a {name}!" (y si tú caíste, "María te superó — ¿lo dejarás así?"). Sin backend extra.

- [ ] Backend endpoint (raw SQL reutilizando la CTE del leaderboard) + build. Frontend banner + toast. Preview E2E. Commits.

### Task E5: Carrera Fantasma

**Files:**
- Modify: `dots-backend/src/modules/games/games.{controller,service,dto}.ts`
- Create: `dots-webapp/app/(app)/games/ghost-race/page.tsx`

**Interfaces:**
- `GET /games/ghost-race` → `{deckSeed, questions: DotaxiQuestionDto[] (10, seeded del pool dotaxi), ghost: {name, score, durationMs, events: {q: number, tMs: number, correct: boolean}[]} | null}`. Server: elegir un `game_runs` de OTRO usuario (`game_key='ghost-race'`, orden: |score propio previo − score| asc, luego reciente); si no hay runs ajenos → `ghost: null` y el frontend usa el fantasma sintético "Doty" (const local: 10 eventos, 1 fallo, ~6s/pregunta).
- `POST /games/ghost-race/run` `{deckSeed, score, durationMs, events}` → inserta en `game_runs` (cap: guarda máx 20 runs/usuario, borra el más viejo).
- Frontend: quiz fill-blank estilo speed-round PERO con 2 barras de progreso arriba: la tuya y la del fantasma "👻 {name}" que avanza sola según `events` (timestamps relativos al start). Cada acierto +100 + bonus por delante del fantasma al final (+200). Al terminar: pantalla comparativa (tu tiempo/aciertos vs fantasma, "¡Le ganaste a María!" / "María sigue imbatible"), POST del run propio, submit score normal.

- [ ] Backend + build. Frontend + lint/build. Preview E2E (primera corrida vs Doty sintético). Commits.

---

# Verificación global (al cierre de cada fase)

1. Backend: `npm test` (specs: seeded, wordle.logic, crossword-gen, tournament settle) + `npm run build`.
2. Frontend: `npm run lint` + `npm run build` (type-check ya rompió antes — commit c34df33).
3. Preview E2E por juego: ronda completa → GameResult muestra `+XP` (respuesta real de `/games/score`) → el juego aparece en /play con su candado según `unlock`.
4. RN-safety audit por juego nuevo: grep de `keydown|onDrag|onMouseMove|<input` en `app/(app)/games/<key>/` = solo pointer/tap.
5. Migración: dry-run mostrado al usuario; `--apply` SOLO con autorización explícita; verificar `backup-games-social-*.json` en `scripts/out/`.
6. Social E2E: récord global robado muestra corona; torneo settle otorga gemas (verificar `gem_ledger`); reto resuelto reparte 15/3; rival banner coincide con el leaderboard.

# Orden de ejecución y dependencias

A1 → A2 → B1..B4 (independientes entre sí) → C1, C2 → D1 → D2 → E1 → E2 (necesita seeds de B/C) → E3 → E4 (independiente) → E5.
Cada fase deja main deployable. La migración `--apply` es prerequisito REAL solo de D y E (daily_game_state, tournament, challenges, game_runs); B y C funcionan sin tocar la BD (solo lectura de contenido + games rows... los rows de `dots.games` sí requieren el seed del script — B necesita el `--apply` del registro de juegos o los juegos no aparecen en /play).
