# dots-webapp — CLAUDE.md

Frontend de **dots**: app de aprendizaje de inglés para hispanohablantes (estilo Duolingo, mascota Doty). Next.js 16 (app router) + React 19 + Tailwind 4. La UI va en **español, tono juguetón**; el contenido a aprender en inglés.

Repo hermano: `../dots-backend` (NestJS en `:4000`, normalmente corriendo con watcher). La BD es **PostgreSQL remota COMPARTIDA de producción** — todo cambio de datos pasa por el backend y sus reglas (ver su CLAUDE.md).

## Comandos

```bash
source ~/.nvm/nvm.sh        # SIEMPRE antes de node/npm (Node 22 vía nvm)
npm run dev                 # dev server :3000
npm run lint                # eslint (incluye reglas del compiler de React)
npx next build              # build de producción CON type-check — debe pasar antes de commitear
npx tsc --noEmit            # type-check suelto
```

No hay test runner de componentes: la verificación es lint + build + preview manual.

## Estructura

- `app/(app)/(hub)/` — páginas con chrome (nav + HUD): levels (Camino), review, quests, play, profile, shop. El layout del grupo pone el chrome; **los flujos inmersivos viven FUERA del grupo** (lesson/, practice/, checkpoint/, games/, readings/, onboarding/) y no llevan nav.
- `app/(app)/games/<key>/page.tsx` — un juego por carpeta (14 juegos).
- `components/games/shared/` — `GameIntro` (pantalla de inicio; es el gesto de usuario que legaliza el autoplay de audio) y `GameResult` (envía el score UNA vez, StrictMode-safe).
- `hooks/` — use-countdown, use-ticker (rAF), use-game-records (récord+trono), use-tournament-mode, use-challenge-mode, use-rival-watch, use-lesson-series, use-lesson-keys.
- `services/*.service.ts` — fetchers axios sobre `lib/api-client.ts`. **El access token vive EN MEMORIA** (refresh token en cookie HttpOnly).
- Estilos: variables CSS en `app/globals.css` (`--accent`, `--surface`, `--border`, `--muted`, `--gem`, `--flame`...) + utilidades (`dots-card`, `dots-pressable`). **No hay CSS modules.**

## Reglas duras (violarlas rompe build, review o producción)

1. **Navegación con `router.push`, nunca `window.location.*`** — recarga la página y pierde el token en memoria. (Excepción legacy aceptada: games-list usa `window.location.assign`.)
2. **RN-safe en todo juego nuevo** (habrá app React Native): solo tap/pointer (`onPointerUp`/`onClick`); nada de `keydown` como input, ni HTML5 Drag API, ni canvas, ni `<input>` de texto para jugar, ni `<select>`, ni hover como única señal. Teclados = botones en pantalla. Animación solo `transform`/`opacity` + ticks rAF/interval.
3. **Lint del compiler de React**: prohibido `setState` síncrono en el cuerpo de un `useEffect` (para "Reintentar" usa el patrón `fetchAttempt`: el botón setea loading/error y bumpea un contador; el efecto solo fetchea) y prohibidos efectos colaterales (refs, timeouts, otros setState) dentro de updaters de `setState` — StrictMode los doble-invoca.
4. **Score/XP**: solo `submitGameScoreService` dentro de `GameResult` (guard con ref). **Excepción ghost-race**: el server premia vía `POST /ghost/run`; su página usa un ResultCard propio y NO debe re-enviar.
5. Todo fetch de página de juego: estado `loadError` + botón **Reintentar** que re-fetchea por estado (nunca `window.location.reload`).
6. `useSearchParams` siempre dentro de un boundary `<Suspense>`.
7. Juegos seedables aceptan `?seed=` y lo pasan al fetcher (torneo/reto/fantasma dependen de eso para mazos idénticos).

## Contexto ampliado

- `docs/ARQUITECTURA.md` — mapa completo (rutas, juegos, hooks, flujos).
- `docs/superpowers/` — specs, planes de implementación y handoffs históricos.
