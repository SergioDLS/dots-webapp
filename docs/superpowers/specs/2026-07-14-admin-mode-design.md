# Admin mode — full port from legacy DOTS admin

Date: 2026-07-14

## Goal

Enable a complete, comfortable admin mode in dots-webapp, porting every working
feature of the legacy DOTS admin (CRA app in `../DOTS`) and fixing what was
broken or stubbed there. Videos was an empty stub in the legacy admin and is
intentionally omitted.

## What the legacy admin had

- Levels: difficulty → section → level browse, enable/disable, edit link.
- Sentences per level: CRUD with audio/image uploads.
- Words per level: create/edit with uploads (enable toggle was a stub).
- Readings: list with search, enable toggle, create/edit (title/body/audio).
- Users: list with search; the edit modal and block toggle were stubs with no
  backend calls.

## Backend (dots-backend, NestJS — all under the existing `/admin` controller,
guarded by AdminGuard, profile === 1 checked against the DB)

- Words: `POST /admin/words`, `PATCH /admin/words/:id`, `DELETE /admin/words/:id`.
  The `words` table has a plain (non-generated) PK, so create uses max(id)+1;
  `position` defaults to max(position)+1 within the level.
- Readings: `GET /admin/readings` (all, incl. disabled; light payload),
  `GET /admin/readings/:id`, `POST /admin/readings`, `PATCH /admin/readings/:id`,
  `PATCH /admin/readings/:id/enabled`. The cloze quiz is generated
  deterministically from `text`, so admins only edit title/text/audio/unlock.
- Users: `GET /admin/users` (never returns password/reset fields),
  `PATCH /admin/users/:id` (name, lastName, email, birth, expires — dates accept
  ISO string or null to clear), `PATCH /admin/users/:id/blocked` (an admin
  cannot block their own account).

## Webapp (dots-webapp)

- Admin shell (`app/(app)/admin/layout.tsx`): persistent section nav
  (Dashboard / Levels / Readings / Users) with active state; pill row under the
  top bar on mobile.
- Dashboard: three cards — Levels & Content, Readings, Users.
- Levels (`/admin/levels`): browse unchanged; level detail now has
  Sentences | Words tabs with per-tab counts, word CRUD via `word-modal.tsx`.
- Readings (`/admin/readings`): searchable table (title, unlock, audio,
  enabled toggle), wide editor modal with word count, large resizable body,
  audio upload and unlock threshold.
- Users (`/admin/users`): searchable table (name+ADMIN badge, email, xp,
  streak, member since, expires, active toggle with confirm), edit modal with
  save-disabled-until-dirty.
- Shared admin UI (`components/admin/ui.tsx`): Toggle, ToastBanner/useToast,
  SearchInput, AdminModal (Escape to close), Field, UploadTile (image/audio
  previews), and media URL resolvers (Cloudinary absolute URLs as-is, legacy
  relative paths against the backend static folders).
- Sidebar admin menu updated with the new sections.

## Verification

- `tsc --noEmit` clean on both repos; `next build` passes with the new routes.
- Live smoke test against the running dev backend: new routes return 401
  without a token, 404 for unknown paths; with an admin JWT,
  `GET /admin/readings`, `GET /admin/readings/1` and `GET /admin/users` return
  real data. Mutating endpoints were not exercised against the shared DB.
