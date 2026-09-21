# Phase 1 — Personalization Architecture Foundation

Status: **implemented (foundation only)** — no visual redesign, no gamification UI changes, no AI.

## 1. What was discovered (audit)

### Product surface
- **Routes (flat, auth-guarded via `RequireAuth`)**: `/dashboard`, `/today`, `/inbox`, `/tasks`, `/projects`, `/projects/:id`, `/calendar`, `/planning`, `/progress`, `/progress/paths/:pathKey`, `/analytics`, `/archive`, `/settings`, `/help`; public `/`, `/auth`, `/onboarding`. Legacy `/app/*` redirects preserved. (src/main.tsx)
- **Shell**: `AppShell` = desktop collapsible sidebar (11 primary destinations) + topbar (search, notifications) + mobile bottom nav (5 destinations) + FAB. Content rendered inside `WorkspaceData` provider (tasks/projects CRUD + Ctrl+K palette + task detail panel).
- **Feature map**:
  - *Core productivity*: tasks (inbox/todo/in_progress/review/done, subtasks, tags, priority, due date/time, estimates), projects (color/deadline/status), routines + routine items + daily checkins, calendar, planning page, archive, quick-add, command palette.
  - *Progression (already implemented, exceeds Phase 1 scope)*: `progress`, `dailyStats`, `xpEvents` (immutable XP ledger — this IS the event log Phase 1 requires), `missionState`, `challengeState`, `pathEnrollments`, `achievementUnlocks`, `rewardUnlocks`; driven by `src/convex/progression.ts`, `gamification.ts`, `growthPaths.ts` and surfaced on `/progress` + dashboard `ProgressSnapshot`.
  - *Analysis*: `/analytics` + `dailyStats` rollups (score, planned/completed, focus minutes, streaks).
  - *Account*: profile name (`profile.updateName`), theme/accent/start-page + notification prefs — currently **localStorage only** (`taskly-*` keys).
- **User model**: Convex auth `users` (name/image/email). No persona, no goals, no server-side preferences, no dashboard configuration.
- **Onboarding**: exists (`/onboarding`, 5 steps) — name, one goal (focus/study/work/life), first task, first project. **Its goal choice was never persisted anywhere.**

### Gaps relevant to Phase 1
1. Onboarding signals discarded (no persona/goal persistence).
2. Preferences device-bound (localStorage), invisible to server-side personalization.
3. Dashboard layout hard-coded in `Dashboard.tsx`; no widget model.
4. Mobile: `archive`, `calendar`, `planning`, `settings`, `help` unreachable except via palette; palette only exposed 7 of 11 destinations.

## 2. What was changed (minimal, additive)

| File | Change |
|---|---|
| `src/lib/personas.ts` (new) | Persona catalog (8 keys), widget registry (15 widgets, `exists` flag), `DashboardConfig` model (rows: widget/visible/priority), per-persona recommended configs, onboarding question templates + `questionsForPersona()`, `personaKeyFromGoal()` bridge. |
| `src/convex/schema.ts` | Added `userProfile` table (one per user: `personaKey`, `personaSource`, `personaDetails`(JSON), `goals[]`, `preferences`(JSON), `dashboardConfig`(JSON), `schemaVersion`) with `by_user` index. No existing table touched. |
| `src/convex/userProfile.ts` (new) | `get` (query) + `upsert` (patch-or-create mutation). JSON string fields keep the schema additive/migration-free. |
| `src/hooks/use-user-profile.ts` (new) | `useUserProfile()` — reads profile with graceful defaults ("personal" persona + recommended config when none exists). Single integration point for Phase 2 consumers. |
| `src/pages/Onboarding.tsx` | On finish, persists persona (derived from existing goal picker) + goals + persona's recommended dashboard config via `userProfile.upsert`. **UI unchanged**; failure is non-fatal. |
| `src/components/workspace/CommandPalette.tsx` | Added the 5 missing navigation actions (tasks, calendar, planning, archive, settings, help) — restores mobile reachability parity without touching nav UI. |
| `docs/PHASE1-ARCHITECTURE.md` (new) | This document. |

## 3. Architecture prepared

```
USER (auth users)
  ↓
userProfile (persona, goals, preferences, dashboardConfig)   ← Phase 1
  ↓
persona → RECOMMENDED_DASHBOARDS[key] → DashboardConfig      ← data, not code
  ↓
Dashboard renders config.rows (visibility + order)           ← Phase 2
  ↓
xpEvents (already exists) → gamification / AI                ← already event-sourced
```

Design guarantees:
- **Core data stays persona-agnostic.** Tasks/projects never become persona-typed; presentation differs, storage doesn't.
- **Persona is advisory, not restrictive.** All features remain accessible for every persona.
- **Data-driven extension.** New persona/widget/question = edit `src/lib/personas.ts` only.
- **Event foundation already exists.** `xpEvents` (kind/label/day/refType/refId/meta) is an append-only activity ledger gamification already consumes; future AI can analyze `dailyStats` + `xpEvents` without new collection.

## 4. What was preserved
- All routes, auth flow, and `RequireAuth` protection.
- Dashboard structure, order, and every existing widget.
- All gamification behavior (XP, levels, missions, challenges, paths, achievements).
- localStorage preferences and all forms/flows.
- Design system (glassmorphism tokens, `ui-surface`, typography, spacing).

## 5. Remains for Phase 2
1. Persona-aware onboarding UI rendering `ONBOARDING_QUESTIONS` (`questionsForPersona`), storing into `personaDetails`.
2. Dashboard rendering driven by `dashboardConfig.rows` (a `DashboardRenderer` that maps widget keys → existing components), plus a widget-visibility settings UI.
3. Move localStorage preferences (theme/accent/start/notifications) into `userProfile.preferences` (keep localStorage as cache).
4. Persona-tuned dashboard defaults per persona (currently mostly shared ordering).
5. Surface persona in settings with a picker (write path already exists).

## 6. Risks / decisions to review
- **JSON-string columns** (`personaDetails`, `preferences`, `dashboardConfig`): chosen for zero-migration additivity; tradeoff is no server-side field validation and no indexed queries inside those blobs. Acceptable while they are read-mostly, single-writer (per user) documents. Revisit if server-side rules must evaluate them.
- **Race on first write**: onboarding is the only writer today; if two tabs write concurrently, last-write-wins per field. Fine for Phase 1.
- **`personaKey` is a plain string** (not a union) at the DB layer so unknown future keys never break reads; the client falls back to "personal" via `personaMeta()`.
- **Goal→persona mapping** (`personaKeyFromGoal`) is a bridge for existing onboarding UX; Phase 2's persona picker will replace it.
