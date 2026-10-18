# Pages

Each file in this folder is a route-level screen rendered by `frontend/src/App.tsx`.

## Route Map

### `DashboardPage.tsx`

- home/overview surface
- shows streaks, heatmap, module charts, recent activity
- can open session detail editors for session-backed habits
- includes an export modal that reloads several backend payloads in parallel

### `TodayPage.tsx`

- primary daily workflow
- owns task creation/editing, week calendar, misc tasks, checklist interactions, recurring-task management, notes, and habit toggles
- notes are now DB-backed through `/api/notes`
- still contains a one-time migration from the legacy `personal-quick-notes` localStorage key

### `GuitarPage.tsx`

- guitar-specific practice page
- logs sessions
- edits materials and song-group content
- uploads PDF attachments for songs
- contains custom UI for classical notes, delta blues content, and CAGED chord browsing

### `ModulePage.tsx`

- shared module surface currently used for workouts
- logs sessions, supports run handling and rest days, and renders weekly/history views

### `NetworkingPage.tsx`

- manages both real contacts and the outreach queue
- includes search/filter/sort tools
- edits interactions and follow-up metadata
- handles copy/open workflows for outreach messages

### `ResumePage.tsx`

- stores multiple resume drafts in localStorage
- sends LaTeX source to the backend for compilation
- uses `pdfjs-dist` to render the first-page preview

### `SettingsPage.tsx`

- admin/configuration hub
- theme toggles and optional feature flags
- habits manager
- company list manager
- networking enum/options management
- section/history management for guitar and workouts

## Shared Patterns Across Pages

- Framer Motion reveal helpers are defined locally in many pages.
- Most page-level mutations call `api.*` helpers directly instead of using a separate data library.
- Some pages own their own loading state even when `App.tsx` already loaded shared baseline data.
- LocalStorage is used selectively for product preferences and workflow drafts, not as the main source of truth for core data tables.
