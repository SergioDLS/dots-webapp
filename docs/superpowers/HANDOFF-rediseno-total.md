# Rediseño total — Handoff (2026-07-20, sesión nocturna)

Rama `redesign/total` en **ambos** repos (dots-webapp + dots-backend). `main` avanzó por fast-forward local con todo el trabajo de `redesign/learning-path` (sin push). Nada se ha empujado a remoto.

## Lo que quedó hecho (Fases 0-6)

- **Fase 0** — merge learning-path→main (ambos repos) + rama `redesign/total`.
- **Fase 1** — paleta navy `#201a4d` + rosa `#e5077e`/`#ff3d9e` del logo (morado retirado), tokens `--gem`/`--flame`.
- **Fase 2** — navegación tipo app: `(app)/(hub)/layout.tsx` con barra inferior (móvil) + riel de iconos (desktop) + HUD (racha/nivel/XP/gemas), solo en pantallas hub. Tabs: Camino · Repaso · Retos · Juegos · Perfil. Se desmanteló el sidebar-carrusel y su contenido se redistribuyó a `/quests`, `/play`, `/profile` (reutilizando el engagement existente). Componentes reusados localizados a español.
- **Fase 3** — celebración de fin por etapas (conteo de XP animado), **explicación al fallar** (gramática + pronunciación), teclado (Enter/1-9/Ctrl+Space), fallo que re-encola en el camino (sin gameover).
- **Fase 4** — Repaso SRS: `review_items` + SM-2, `GET/PUT /review/session`, tab Repaso (cloze reusando la mecánica de oraciones).
- **Fase 5** — Economía: gemas + `gem_ledger` + tienda (`shop_items` con seed) + `user_items`; `GET /shop`, `POST /shop/buy`, `GET /shop/inventory`, `POST /shop/equip`; ganar gemas en lección/repaso; chip de gemas en el HUD + página `/shop`.
- **Fase 6** — Perfil: CEFR estimado (A1-C2), Doty customizable (equipar gorros/fondos/gestos comprados).

Verificación: backend `npm test` = 45/45; `nest build` limpio; webapp `next build` limpio (25 rutas); eslint limpio. El screenshot del preview cuelga en este entorno — se verificó por snapshot/inspect/eval (estructura + estilos computados) y builds.

## ⚠️ ACCIÓN REQUERIDA — aplicar 2 migraciones (aditivas)

El clasificador de seguridad bloqueó aplicar migraciones al DB compartido de producción de forma autónoma. **El código está listo y las migraciones están dry-run-verificadas; falta aplicarlas** (dejan backup en `scripts/out/` y soportan `--rollback`). Desde `dots-backend/` con el `.env` de producción:

```bash
# 1. Repaso SRS (tabla review_items)
npm run migrate:srs            # dry-run: muestra qué crea
npm run migrate:srs -- --apply # aplica + backup

# 2. Economía (users.gems/xp_boost_until + gem_ledger + shop_items(+seed) + user_items)
npm run migrate:economy
npm run migrate:economy -- --apply
```

Ambas son **aditivas** (tablas nuevas + columnas nullable/defaulted; nada se borra ni reescribe). Hasta aplicarlas, las features degradan solas: `/review` muestra "Nada que repasar", `/shop` "abre muy pronto", gemas = 0 — **sin romper** ningún flujo existente (gemas/boost se leen/escriben por SQL crudo defensivo, el entity `Users` no se tocó a propósito).

Tras aplicar, hay que **reconstruir/redeployar el backend** (`npm run build` + reiniciar) para que carguen los módulos Review/Economy.

## Diferido (documentado, no bloquea)

- **Efecto x2 del boost de XP**: la compra fija `users.xp_boost_until`, pero el doblado de XP en los sitios de award falta (requeriría leer el timestamp al otorgar XP; se evitó tocar el entity Users por seguridad de migración).
- **Modal de rescate con gemas** en checkpoints/arcade (a 0 vidas): requiere cablear el gasto de gemas en `checkpoint-exam` y los juegos.
- **Explicar-al-fallar en práctica de oraciones y vocab**: práctica tiene máquina de estados propia; vocab es matching (se explica solo).
- **Historias con personajes** y **PWA/push**: fuera de alcance (esperan elenco+ElevenLabs / los asume la app React Native).
- **ELEVENLABS_API_KEY + voice_ids** de doty/doty-fem (pendiente desde learning-path) para generar los audios del seed.

## Notas

- Gemas por acción: 5/lección, 4/repaso (constantes en `src/common/gems.ts`). Precios de tienda en `scripts/migrate-economy.js` (SHOP_SEED). Cosméticos son placeholders con emoji (falta arte real de Doty).
- CEFR es una estimación por nivel de XP (mapeo en `profile/page.tsx`), no un test formal.
- Merge a `main` y push: pendiente de tu revisión.
