# Rediseño total — Fase 2: Layout + surfacing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Reemplazar el shell actual (sidebar-carrusel solo en `/levels`) por una navegación tipo app: barra inferior en móvil + riel de iconos en desktop, un header HUD con racha/XP/meta diaria cableado a `/me/stats`, el camino como home, y páginas dedicadas que sacan a la luz lo que hoy está enterrado en el carrusel (Retos, Zona de juego, Perfil). Repaso queda como stub hasta Fase 4.

**Architecture:** Se crea un route-group `app/(app)/(hub)/` con un `layout.tsx` cliente que provee el chrome persistente (nav + HUD). Las pantallas "hub" (camino, repaso, retos, zona de juego, perfil) viven ahí y comparten chrome; los flujos inmersivos (practice, lesson, checkpoint, onboarding, games, readings, admin) quedan fuera del grupo y NO llevan chrome (pantalla completa, como Duolingo en lección). Los route-groups no cambian la URL, así que `/levels` sigue siendo `/levels`. El contenido del `InteractiveColumn` (perfil, misión, leaderboard, badges, juegos, lecturas) se redistribuye a las páginas nuevas reutilizando los componentes y servicios existentes; el carrusel se retira.

**Tech Stack:** Next 16 app router (route groups, `usePathname`), React 19, Tailwind 4 + tokens CSS, servicios existentes en `services/engagement.service.ts`.

## Global Constraints

- Rama `redesign/total`. No push.
- Reutilizar endpoints existentes (`/me/stats`, `/me/quest` + claim, `/me/badges`, `/leaderboard?period=all|week`, `/games/*`, `/readings`) — cero backend nuevo en esta fase.
- Chrome (nav + HUD) SOLO en pantallas hub; nunca en lecciones/juegos/checkpoint/onboarding.
- 5 destinos: Camino (`/levels`) · Repaso (`/review`) · Retos (`/quests`) · Zona de juego (`/play`) · Perfil (`/profile`).
- Móvil: barra inferior fija con `env(safe-area-inset-bottom)`. Desktop ≥md: riel de iconos a la izquierda.
- Idioma UI en español (flujos nuevos), consistente con onboarding/lecciones.
- Estilos: tokens + `.dots-card`/`.dots-pressable` existentes; navy estructura, rosa acento/CTA. Sin morado.
- Verificación: `snapshot`/`inspect`/`eval` en preview (screenshot cuelga en este entorno) + `npm run build`.

## File Structure

- Create `app/(app)/(hub)/layout.tsx` — chrome cliente: riel desktop + barra inferior móvil + `<AppHeader/>`. Envuelve las 5 pantallas hub.
- Move `app/(app)/levels/` → `app/(app)/(hub)/levels/` (git mv; URL intacta).
- Create `app/(app)/(hub)/review/page.tsx` — stub "Repaso (pronto)" hasta Fase 4.
- Create `app/(app)/(hub)/quests/page.tsx` — misión diaria + leaderboard semanal.
- Create `app/(app)/(hub)/play/page.tsx` — grid de juegos + lecturas + flashcards.
- Create `app/(app)/(hub)/profile/page.tsx` — perfil + stats + badges + racha + ajustes.
- Create `components/shell/app-nav.tsx` — nav compartida (riel desktop / barra móvil), `usePathname` para activo.
- Create `components/shell/app-header.tsx` — HUD (racha, XP/nivel, anillo meta diaria; gemas oculto hasta Fase 5), consume `getMyStatsService`.
- Create `components/shell/nav-items.ts` — lista de destinos (href, label, icono) compartida por nav y cualquier fallback.
- Create `components/profile/profile-card.tsx`, `components/quests/leaderboard-panel.tsx` — extraídos/reusando lógica de `interactive-column`.
- Modify `components/interactive-column/interactive-column.tsx` — se retira de `/levels`; sus piezas reutilizables (Streak, XpLevel, DailyQuestCard, BadgesCard, TopStudents, GamesList, ReadingsList, ThemeToggle) se importan desde las páginas nuevas. El componente monolítico se elimina al final si nada lo usa.
- Modify `app/(app)/(hub)/levels/page.tsx` — quita el `InteractiveColumn`; el Camino ocupa el ancho, con HUD arriba (del layout).

## Task 1: Route-group hub + navegación + stubs

**Files:** create `(app)/(hub)/layout.tsx`, `components/shell/nav-items.ts`, `components/shell/app-nav.tsx`; git mv `levels`; create stub pages `review`, `quests`, `play`, `profile`.

**Interfaces:**
- Produces: `NAV_ITEMS: {href,label,icon}[]`; `<AppNav/>` (usa `usePathname`); hub `layout.tsx` que renderiza `<AppNav/>` + `{children}` con padding para la barra.

- [ ] **Step 1: `components/shell/nav-items.ts`** — export `NAV_ITEMS` con los 5 destinos (href, label español, emoji/icono placeholder por ahora: 🛤️ Camino, 🔁 Repaso, 🎯 Retos, 🎮 Zona de juego, 👤 Perfil).
- [ ] **Step 2: `components/shell/app-nav.tsx`** — client. En móvil: `<nav>` fija abajo (`fixed bottom-0 inset-x-0`, `pb-[env(safe-area-inset-bottom)]`, `md:hidden`, fondo surface, borde superior), 5 botones iguales (icono + label 10px), activo en rosa. En desktop: riel `hidden md:flex md:flex-col` fijo a la izquierda (~84px), logo arriba, 5 items verticales, activo con fondo rosa suave + texto rosa. `usePathname()` → activo si `pathname === href` o (para /levels) empieza con href.
- [ ] **Step 3: `(app)/(hub)/layout.tsx`** — client. `<div class="md:pl-[84px] pb-20 md:pb-0">` con `<AppHeader/>` (Task 2, por ahora importar y dejar; o placeholder) + `<main>{children}</main>` + `<AppNav/>`. Padding inferior en móvil para no tapar contenido con la barra.
- [ ] **Step 4: git mv levels al grupo** — `git mv "app/(app)/levels" "app/(app)/(hub)/levels"`. Verificar que `/levels` sigue resolviendo (preview).
- [ ] **Step 5: stubs** — `review/page.tsx` ("Repaso — pronto, guardará lo que fallas para repasarlo"), `quests/page.tsx`, `play/page.tsx`, `profile/page.tsx` como stubs mínimos (Doty + título) para que la nav funcione. Se rellenan en Tasks 3-5.
- [ ] **Step 6: verificar** — preview: navegar por los 5 tabs, `snapshot` confirma nav presente y cada ruta 200; `inspect` la barra móvil (resize mobile) y el riel desktop.
- [ ] **Step 7: commit** — `feat(shell): route-group hub con navegación (bottom tabs móvil + riel desktop)`.

## Task 2: Header HUD cableado a /me/stats

**Files:** create `components/shell/app-header.tsx`; usa `getMyStatsService` (existente).

**Interfaces:** Consumes `MyStats` (`{xp, streak, level, xpForNextLevel, xpWeek, streakFreezes, ...}`). Produces `<AppHeader/>` renderizado por el hub layout.

- [ ] **Step 1: `app-header.tsx`** — client. `useEffect` → `getMyStatsService()`. Muestra: llama 🔥 + `streak`; chip nivel + barra XP hacia `xpForNextLevel`; anillo de meta diaria (placeholder: `xpWeek`/meta hasta tener meta diaria real — usar constante `DAILY_GOAL=30` de XP del día; el XP del día no está en stats, así que v1 muestra racha + nivel + XP total, y el anillo de meta se marca TODO para cuando exista `daily_use` del día). Gemas: NO render hasta Fase 5.
- [ ] **Step 2: montar en layout** — `(hub)/layout.tsx` renderiza `<AppHeader/>` arriba (sticky top en scroll).
- [ ] **Step 3: verificar** — preview con sesión: `snapshot`/`inspect` muestran racha y nivel reales; sin sesión, el HUD degrada (no crashea; stats null → oculta cifras).
- [ ] **Step 4: commit** — `feat(shell): header HUD con racha y nivel desde /me/stats`.

## Task 3: /play — Zona de juego (hub de juegos + lecturas + flashcards)

**Files:** rellenar `(hub)/play/page.tsx`; reusar `getGameScoresService`, `getReadingsService`, componentes `GamesList`/`ReadingsList` o su data.

- [ ] **Step 1** — grid de tarjetas: 5 juegos (dot-bombs, dont-pop, dotaxi, speed-round, flashcards) con su ruta `/games/<key>` (flashcards `/games/flashcards`), high score si existe; sección lecturas (lista de `getReadingsService`, bloqueadas/completadas). Título "Zona de juego" + Doty.
- [ ] **Step 2: verificar** — preview: tarjetas linkean a las rutas correctas (`snapshot`), lecturas listan.
- [ ] **Step 3: commit** — `feat(play): hub Zona de juego (juegos + lecturas)`.

## Task 4: /quests — Retos (misión diaria + leaderboard semanal)

**Files:** rellenar `(hub)/quests/page.tsx`; reusar `DailyQuestCard`, `getLeaderboardService`; create `components/quests/leaderboard-panel.tsx`.

- [ ] **Step 1** — misión diaria arriba (reusa `<DailyQuestCard/>`); debajo `<LeaderboardPanel/>` con toggle semana/histórico (`getLeaderboardService('week'|'all')`), tu fila destacada, racha por fila. Título "Retos".
- [ ] **Step 2: verificar** — preview: quest renderiza; leaderboard lista y el toggle cambia el período.
- [ ] **Step 3: commit** — `feat(quests): tab Retos (misión diaria + leaderboard semanal)`.

## Task 5: /profile — Perfil (stats + badges + racha + ajustes)

**Files:** rellenar `(hub)/profile/page.tsx`; create `components/profile/profile-card.tsx`; reusar `BadgesCard`, `XpLevel`, `Streak`, `ThemeToggle`, avatar/logout de `interactive-column`.

- [ ] **Step 1** — `<ProfileCard/>` (avatar Doty + nombre + nivel/XP + racha + escudos); `<BadgesCard/>`; stats (XP total, lecturas completadas, mejor racha, high scores); ajustes (`<ThemeToggle/>`, logout, link admin si `profile===ADMIN_PROFILE`). Doty custom + CEFR se añaden en Fase 6.
- [ ] **Step 2: verificar** — preview: perfil muestra datos reales; logout y theme toggle funcionan; admin link solo para admin.
- [ ] **Step 3: commit** — `feat(profile): tab Perfil (stats + badges + ajustes)`.

## Task 6: Adelgazar /levels (Camino) y retirar el carrusel

**Files:** modify `(hub)/levels/page.tsx` (quita `InteractiveColumn`, Camino a ancho completo bajo el HUD); dejar `interactive-column.tsx` sin referencias.

- [ ] **Step 1** — `levels/page.tsx`: solo `<PathContainer/>` centrado, sin `<aside>`. El HUD del layout da el contexto (racha/XP). Auto-scroll al nodo current ya lo hace PathContainer.
- [ ] **Step 2: verificar** — preview `/levels`: camino ocupa el ancho, HUD arriba, nav presente; `snapshot` sin el carrusel.
- [ ] **Step 3: grep** — `grep -rn InteractiveColumn app/ components/` → sin usos; borrar `interactive-column.tsx` si quedó huérfano (sus subcomponentes siguen usados por las páginas nuevas). Si algún subcomponente quedó huérfano, dejarlo (se reusa) o borrarlo si nadie lo importa.
- [ ] **Step 4: commit** — `refactor(levels): Camino a ancho completo, retira el sidebar-carrusel`.

## Task 7: Build + verificación integral

- [ ] **Step 1** — `npm run build` limpio (type-check + lint).
- [ ] **Step 2** — preview E2E de navegación: los 5 tabs cargan; el chrome NO aparece en `/practice`, `/lesson/*`, `/checkpoint`, `/games/*` (verificar `snapshot` sin `<AppNav/>` en una lección); móvil (resize) muestra barra inferior, desktop el riel.
- [ ] **Step 3: commit** si hubo ajustes.

## Self-Review

**Spec coverage (Fase 2):** bottom tabs móvil ✓ (Task 1) · riel desktop ✓ (Task 1) · header HUD ✓ (Task 2) · camino como home ✓ (Task 6, login ya va a /levels) · hub Zona de juego ✓ (Task 3) · crea `(app)/layout.tsx` → realizado como `(app)/(hub)/layout.tsx` (route group, más limpio: chrome solo en hub) ✓ · cablear a endpoints existentes ✓ (Tasks 2,4,5).

**Desviación:** el spec decía `(app)/layout.tsx`; se usa `(app)/(hub)/layout.tsx` para que los flujos inmersivos NO hereden el chrome sin necesidad de matching de pathname. Misma meta, más limpio.

**Riesgos:** (1) mover `levels` a route group podría romper imports relativos — son `@/` absolutos, seguro. (2) HUD sin sesión → guard con stats null. (3) `interactive-column` reusa muchos subcomponentes; no borrarlos, solo dejar de usar el monolito. (4) chrome en admin: admin está fuera de (hub), intacto.

**Placeholders:** anillo de meta diaria queda como TODO explícito (falta XP-del-día en `/me/stats`); v1 muestra racha+nivel+XP. Documentado, no oculto.
