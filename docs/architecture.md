# Architecture

## High-Level Shape

The project is a local-first full-stack app:

- `frontend/`: a Vite + React client with in-memory routing
- `backend/`: a FastAPI API
- `backend/data/personal.db`: the single source of truth for persistent app data

There is no cloud database, no ORM, and no separate migration framework. The app starts fast because most behavior is encoded directly in a small number of Python and TypeScript files.

## Runtime Flow

1. `run-dev.sh` starts the FastAPI backend and the Vite dev server.
2. The frontend mounts `frontend/src/App.tsx`.
3. `App.tsx` loads the dashboard/today/guitar/workout data in parallel.
4. Frontend pages call the backend through `frontend/src/lib/api.ts`.
5. FastAPI routers delegate to `services/*.py`.
6. Services read and write SQLite through `get_db()` in `backend/personal_api/core/db.py`.

## Backend Layout

### App Bootstrap

- `backend/app.py`: Uvicorn import target
- `backend/personal_api/main.py`: app factory, CORS setup, router registration, startup hook

### Storage

- `backend/personal_api/core/db.py`:
  - DB path and data directories
  - schema creation
  - inline migrations
  - default seed data
  - helper for company alias merges
- `backend/personal_api/core/utils.py`:
  - row-to-dict helper
  - ISO date helpers
  - Monday-based week-start helper

### HTTP Layer

`backend/personal_api/routers/` is intentionally thin. Routers validate request bodies, open a DB connection, and hand off almost everything to services.

### Domain Layer

`backend/personal_api/services/` owns almost all backend behavior:

- `habits.py`: today payload, streaks, heatmap, session-backed habits
- `tasks.py`: tasks, goals, checklists
- `recurring.py`: recurring-task rules and task materialization
- `modules.py`: shared guitar/workout session logic
- `dashboard.py`: aggregated home-page analytics
- `networking.py`: contacts, interactions, follow-up state, outreach sync
- `resume.py`: LaTeX-to-PDF compilation
- `companies.py`: tracked companies and cowork-text file generation

## Frontend Layout

### App Shell

- `frontend/src/main.tsx`: mounts the app and imports the active stylesheet
- `frontend/src/App.tsx`:
  - owns route/theme/preference state
  - loads shared bootstrap data
  - decides which page to render
  - persists settings to localStorage

### Shared UI

- `frontend/src/components/Layout.tsx`: top navigation shell
- `frontend/src/components/Charts.tsx`: bar/line/pie/heatmap visuals
- `frontend/src/components/HabitSessionDetails.tsx`: inline session editors used from Today
- `frontend/src/components/WorkoutHistoryCard.tsx`: workout history editing card

### Pages

- `DashboardPage.tsx`: overview analytics + export modal
- `TodayPage.tsx`: core daily workflow
- `GuitarPage.tsx`: guitar-specific tracking, materials, song files, CAGED helpers
- `ModulePage.tsx`: shared workout-style module page
- `NetworkingPage.tsx`: contacts + potential outreach queue
- `ResumePage.tsx`: local resume library and PDF preview
- `SettingsPage.tsx`: admin/configuration surfaces

### Frontend Utilities

- `frontend/src/lib/api.ts`: the full client-side API contract
- `frontend/src/lib/types.ts`: response types
- `frontend/src/lib/networking.ts`: networking enums, sort/filter helpers
- `frontend/src/lib/dates.ts`: Monday-based week formatting
- `frontend/src/lib/duration.ts`: duration parsing/formatting

## Persistence Model

### Database-Backed

- habits, tasks, checklists, goals
- guitar/workout sessions and sections
- networking contacts and interactions
- potential outreach queue
- tracked companies
- app-wide notes

### Frontend localStorage-Backed

- current route
- selected theme
- selected mood
- dashboard preferences
- networking option lists
- resume documents, selected resume, sidebar collapse

Important: some workflows blend both. Example: Today notes now live in the DB, but the page still migrates from a legacy localStorage key if it finds one.

## Important Cross-Cutting Behaviors

### Startup-Driven Schema Management

There is no Alembic or migration CLI. The backend mutates the schema in `create_schema()` every time the app boots. Agents changing persistence need to update that file carefully and preserve compatibility with existing user data.

### Session-Backed Habits

The habit system treats `Guitar` and `Exercise` specially. Completion is derived from session tables, not only from `habit_logs`. Any habit UI or analytics change has to respect that.

### Materialized Recurring Tasks

Recurring tasks are stored as rules in `recurring_tasks`, then expanded into real `tasks` rows for visible dates. Pages that show week or recurring-task state rely on this materialization behavior.

### Style System

`frontend/src/styles/app.css` is the active theme. The app still persists a `mood` flag, but the stylesheet no longer uses it.

## External Tooling

- `pdflatex`: needed by resume compilation
- `python-multipart`: required for guitar PDF uploads

## Testing Reality

The repo currently does not contain a dedicated automated test suite. Manual app verification and lightweight checks like frontend typechecking are the main validation path today.
