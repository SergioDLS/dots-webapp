# dots-webapp — CLAUDE.md

Frontend de **dots**: app de aprendizaje de inglés para hispanohablantes (estilo Duolingo, mascota Doty). Next.js 16 (app router) + React 19 + Tailwind 4. La UI va en **español, tono juguetón**; el contenido a aprender en inglés.

Repo hermano: `../dots-backend` (NestJS en `:4000`, normalmente corriendo con watcher). La BD es **PostgreSQL remota COMPARTIDA de producción** — todo cambio de datos pasa por el backend y sus reglas (ver su CLAUDE.md).

## Comandos

```bash
source ~/.nvm/nvm.sh && nvm use   # SIEMPRE antes de node/npm — `nvm use` lee el .nvmrc (Node 24)
npm run dev                 # dev server :3000
npm run lint                # eslint (incluye reglas del compiler de React)
npx next build              # build de producción CON type-check — debe pasar antes de commitear
npx tsc --noEmit            # type-check suelto
npm run themes:build        # regenera CSS y theme-colors desde design/themes.json
npm run test:scripts        # tests node:test de scripts/ (renderizador de temas)
```

No hay test runner de componentes: la verificación es lint + build + preview manual.

## Estructura

- `app/(app)/(hub)/` — páginas con chrome (nav + HUD): levels (Camino), review, quests, play, profile, shop. El layout del grupo pone el chrome; **los flujos inmersivos viven FUERA del grupo** (lesson/, practice/, checkpoint/, games/, readings/, onboarding/) y no llevan nav.
- `app/(app)/games/<key>/page.tsx` — un juego por carpeta (12 juegos).
- `components/games/shared/` — `GameIntro` (pantalla de inicio; es el gesto de usuario que legaliza el autoplay de audio) y `GameResult` (envía el score UNA vez, StrictMode-safe).
- `hooks/` — use-countdown, use-ticker (rAF), use-game-records (récord+trono), use-tournament-mode, use-challenge-mode, use-lesson-series, use-lesson-keys.
- `services/*.service.ts` — fetchers axios sobre `lib/api-client.ts`. **El access token vive EN MEMORIA** (refresh token en cookie HttpOnly).
- Estilos: los tokens de color viven en `design/themes.json` y se GENERAN en `app/themes.generated.css` + `lib/theme-colors.ts` con `npm run themes:build` (`npm run lint` falla si están desactualizados); `app/globals.css` conserva utilidades (`dots-card`, `dots-pressable`) y estilos que no son tokens. Paleta y modo se leen de `<html data-palette="rosa|electrico" data-theme="light|dark">` (sin `data-theme` = Auto); espejo local `localStorage` `dots-palette`/`dots-theme`; la preferencia del servidor vive en `users.settings` (`GET/PATCH /me/settings`). **No hay CSS modules.**

## Reglas duras (violarlas rompe build, review o producción)

1. **Navegación con `router.push`, nunca `window.location.*`** — recarga la página y pierde el token en memoria. Sin excepciones en código de producto: la última (la grilla de juegos) cayó en el subproyecto C. `lib/api-client.ts` sí usa `window.location.replace("/")` al expirar la sesión, y `context/auth-context.tsx` hace lo mismo en su `logout`; en los dos casos es lo correcto, porque una recarga limpia es justo lo que se busca.
2. **RN-safe en todo juego nuevo** (habrá app React Native): solo tap/pointer (`onPointerUp`/`onClick`); nada de `keydown` como input, ni HTML5 Drag API, ni canvas, ni `<input>` de texto para jugar, ni `<select>`, ni hover como única señal. Teclados = botones en pantalla. Animación solo `transform`/`opacity` + ticks rAF/interval.
3. **Lint del compiler de React**: prohibido `setState` síncrono en el cuerpo de un `useEffect` (para "Reintentar" usa el patrón `fetchAttempt`: el botón setea loading/error y bumpea un contador; el efecto solo fetchea) y prohibidos efectos colaterales (refs, timeouts, otros setState) dentro de updaters de `setState` — StrictMode los doble-invoca.
4. **Score/XP**: solo `submitGameScoreService` dentro de `GameResult` (guard con ref). **Excepción ghost-race**: el server premia vía `POST /ghost/run`; su página usa un ResultCard propio y NO debe re-enviar.
5. Todo fetch de página de juego: estado `loadError` + botón **Reintentar** que re-fetchea por estado (nunca `window.location.reload`).
6. `useSearchParams` siempre dentro de un boundary `<Suspense>`.
7. Juegos seedables aceptan `?seed=` y lo pasan al fetcher (torneo/reto/fantasma dependen de eso para mazos idénticos).
8. **Acceso solo por invitación.** No hay registro público: `POST /auth/register` fue eliminado del backend. La única ruta capaz de crear un usuario es `POST /auth/invitations/accept`, y exige un token válido de 48 h atado a un correo. Si necesitas una cuenta de prueba, invítate desde `/admin/users` → pestaña *Invitations*. El login respeta además `users.expires`, y el refresh revalida `blocked` contra la BD, así que desactivar a alguien lo expulsa en menos de 15 minutos.

9. **PWA / service worker.** El SW (`public/sw.js`) solo intercepta GETs same-origin: nunca la API, Cloudinary, HTML ni RSC. Si tocas `public/offline.html` (o cualquier ruta de `PRECACHE_URLS`), **bumpea `SW_VERSION`** en el mismo commit: sin eso los clientes instalados siguen sirviendo la copia vieja para siempre, porque el único disparador de update es el byte-diff de `sw.js`. Emergencia: `public/sw.kill.js` lleva el procedimiento en su cabecera. Para probarlo hace falta build de producción (`npm run start`, config `dots-webapp-prod` del launch.json) — en dev el registro se desactiva a propósito.

10. **Doty.** Solo se renderiza con `<Doty pose=…>` y poses del registro **generado** `components/ui/doty/poses.ts` (los strings dinámicos pasan por `toDotyPose`, que cae a `feliz` en vez de a un 404). Las piezas nuevas entran por `scripts/mj/` (catálogo → `--emit-lote` → generar → `--apply` → `--emit-registry`), **nunca copiando un PNG a mano** a `public/images/Doty/`: `npm run lint` lo rechaza (`check-doty-assets --strict` prohíbe huérfanos ahí y legacy en el registro). Para rehacer una pieza que ya existe usa `regen: true`, no `done: false` — con `done: false` el registro cae al placeholder mientras dure. El navy es la línea de la marca, no la masa: sobre el tema oscuro mide 1.18:1 y la forma se funde con el fondo. Guía de canon y de tono→pose: `docs/brand/doty-identity.md`.

11. **Iconos.** Ningún emoji como iconografía en código de producto. Los iconos de sistema se pintan con `<Icon name=…>` (SVG, `components/ui/icon/paths.tsx`) y los de economía con `<UiIcon name=…>` (PNG, `public/images/ui/`). Un emoji lo dibuja el sistema operativo: sale distinto en Safari de iPhone que en escritorio, y no se puede teñir. `npm run lint` lo comprueba (`check-icons.mjs`): rellenos solo en rosa `#FF1F8F`, azul `#3768FF`, cyan `#35D8F5` o blanco; el contorno navy `#1E1B5C` nunca como relleno (sobre el tema oscuro mide 1.18:1 y la forma se funde con el fondo); `viewBox` 48 y grosor constante por familia — nav 3, nodo 2.5, glifo 3.5. Ese grosor NO se copia de los tiles de Midjourney: el suyo es el 1.8% del sujeto, que a 24 px es invisible (0.45 px); el de un icono se elige por el tamaño real al que se renderiza esa familia, no al revés. Los emoji dentro de frases de copy se quedan: ahí son puntuación, no iconos. Guía completa: `docs/brand/doty-identity.md`.

12. **Temas.** Nunca editar `app/themes.generated.css` ni `lib/theme-colors.ts` a mano: se generan desde `design/themes.json` (`npm run themes:build`). Los tokens que NO cambian por paleta: `--gem`, `--flame`, `--gold`, `--success`, `--danger`, `--sky-*` y la paleta de `lib/difficulty-palette.ts`; Doty siempre es rosa. Un componente cliente lee el modo resuelto del DOM (`html.dark`), nunca de `matchMedia` en el render, para no romper la hidratación (ver `components/profile/settings-sheet.tsx`).

## Contexto ampliado

- `docs/ARQUITECTURA.md` — mapa completo (rutas, juegos, hooks, flujos).
- `docs/superpowers/` — specs, planes de implementación y handoffs históricos.
