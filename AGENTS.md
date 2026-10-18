# Agent Guide

This repository is a local-first personal dashboard with one React frontend, one FastAPI backend, and one SQLite database. Most product behavior is implemented directly in the app rather than hidden behind heavy frameworks, so agents can move quickly once they understand the file layout and a few invariants.

## Start Here

Read these in order when you need orientation:

1. `README.md`
2. `docs/architecture.md`
3. `docs/data-model.md`
4. `backend/personal_api/main.py`
5. `backend/personal_api/core/db.py`
6. `frontend/src/App.tsx`
7. The page/service pair for the feature you are touching

## Repo Shape

- `backend/app.py`: simple Uvicorn entrypoint
- `backend/personal_api/main.py`: app factory, CORS, router registration, startup schema bootstrap
- `backend/personal_api/core/db.py`: schema creation, inline migrations, default seeds, DB/file paths
- `backend/personal_api/routers/`: thin HTTP layer
- `backend/personal_api/services/`: most backend behavior lives here
- `backend/data/personal.db`: live user data
- `frontend/src/App.tsx`: route shell, top-level loading, localStorage-backed preferences
- `frontend/src/pages/`: route-level product surfaces
- `frontend/src/components/`: reused editors/charts/layout
- `frontend/src/lib/api.ts`: frontend-to-backend contract
- `frontend/src/lib/types.ts`: shared frontend response types
- `frontend/src/styles/app.css`: active theme

## Generated And User-Data Areas

Treat these as data, not source:

- `frontend/node_modules/`
- `frontend/dist/`
- `backend/__pycache__/`
- `backend/data/personal.db`
- `backend/data/personal_backup_*.db`
- `backend/data/companies_cowork.txt`
- `backend/data/guitar_files/` when present

Agents should avoid editing database files directly unless the task is explicitly about data repair.

## Critical Invariants

### Backend

- The app has no separate migration system. `create_schema()` in `backend/personal_api/core/db.py` owns schema creation, backfills, and seed data.
- Routers are intentionally thin. Business logic belongs in `services/`, not inside route functions.
- `get_db()` is the write boundary. It auto-commits and enables foreign keys.
- Session-backed habits are special:
  - `Guitar` completion comes from `guitar_sessions`
  - `Exercise` completion comes from `workout_sessions`
  - do not treat those habits like ordinary `habit_logs`
- Recurring tasks are rules in `recurring_tasks`, but visible tasks are materialized into `tasks`.
- Company edits also regenerate `backend/data/companies_cowork.txt`.

### Frontend

- There is no URL router. `frontend/src/App.tsx` keeps a string route in state/localStorage.
- The frontend API base is hardcoded to `http://127.0.0.1:8000`.
- Page visibility is partly controlled by dashboard preferences in localStorage.
- The active stylesheet is `app.css`.
- `mood` is still stored in `App.tsx` and passed through `SettingsPage`, but the active stylesheet no longer uses it.
- The resume page is mostly local-first state plus backend PDF compilation.
- The Today page migrated notes from a legacy localStorage key to the backend `app_notes` table.

## Feature Ownership Map

- Daily planning and habits: `backend/personal_api/routers/habits.py`, `services/habits.py`, `routers/tasks.py`, `services/tasks.py`, `frontend/src/pages/TodayPage.tsx`
- Dashboard analytics: `services/dashboard.py`, `frontend/src/pages/DashboardPage.tsx`
- Guitar/workouts: `routers/modules.py`, `services/modules.py`, `frontend/src/pages/GuitarPage.tsx`, `frontend/src/pages/ModulePage.tsx`
- Networking: `routers/networking.py`, `services/networking.py`, `frontend/src/pages/NetworkingPage.tsx`
- Resume: `routers/resume.py`, `services/resume.py`, `frontend/src/pages/ResumePage.tsx`
- Settings/admin surfaces: `frontend/src/pages/SettingsPage.tsx`, plus the domain APIs it calls

## Common Agent Workflows

- Add a backend-backed feature:
  1. Update `schemas.py` if a new payload shape is needed.
  2. Extend `core/db.py` if schema/storage must change.
  3. Put domain logic in the relevant `services/*.py`.
  4. Expose it from the matching router.
  5. Add/update typed helpers in `frontend/src/lib/api.ts` and `frontend/src/lib/types.ts`.
  6. Wire the page/component.

- Add a new product surface:
  1. Add the page in `frontend/src/pages/`.
  2. Import it into `frontend/src/App.tsx`.
  3. Add navigation metadata in `frontend/src/components/Layout.tsx`.
  4. If it is optional, thread the setting through dashboard preferences.

- Change the schema safely:
  1. Preserve existing user data in `personal.db`.
  2. Prefer additive or backfill-friendly migrations inside `create_schema()`.
  3. Update any seed/bootstrap logic that assumes old columns or defaults.
  4. Update `docs/data-model.md`.

## External Dependencies

- `pdflatex`: required for resume PDF compilation
- `python-multipart`: required for guitar PDF uploads

## Useful Docs

- `docs/architecture.md`
- `docs/api-reference.md`
- `docs/data-model.md`
- `docs/agent-workflows.md`
- `COMPANY_LIST_CONTEXT.md`
