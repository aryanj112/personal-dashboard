# Agent Workflows

These are the highest-value implementation patterns in this repo.

## 1. Change A Page Safely

1. Read the matching page in `frontend/src/pages/`.
2. Check `frontend/src/lib/api.ts` for the network calls it makes.
3. Read the backend router and service pair for those calls.
4. Check `frontend/src/lib/types.ts` for the response shape.
5. If the UI is shared, inspect `frontend/src/components/`.
6. If visual behavior looks odd, confirm which stylesheet owns it: `app.css` is active.

## 2. Add A New Backend Resource

1. Define request models in `backend/personal_api/schemas.py` if needed.
2. Add storage changes in `backend/personal_api/core/db.py`.
3. Put logic in a new or existing `services/*.py` file.
4. Add HTTP routes in the matching router file.
5. Add typed frontend helpers in `frontend/src/lib/api.ts`.
6. Add or update frontend response types in `frontend/src/lib/types.ts`.
7. Update local docs in the touched directories.

## 3. Modify The Schema Without Breaking Local Data

1. Never assume a clean DB.
2. Make migrations idempotent inside `create_schema()`.
3. Prefer additive columns and backfills over destructive rewrites.
4. Preserve user-entered rows in `personal.db`.
5. Document the change in `docs/data-model.md`.

## 4. Work On Today / Tasks Features

Read these together:

- `backend/personal_api/services/habits.py`
- `backend/personal_api/services/tasks.py`
- `backend/personal_api/services/recurring.py`
- `backend/personal_api/routers/tasks.py`
- `frontend/src/pages/TodayPage.tsx`

Things that surprise agents:

- Today payload is assembled in one backend call.
- recurring-task rules are not the same as visible task rows.
- misc tasks are real `tasks` rows with `is_misc = 1`.
- notes are DB-backed now, but a legacy localStorage migration still exists.

## 5. Work On Guitar / Workout Features

Read these together:

- `backend/personal_api/services/modules.py`
- `backend/personal_api/routers/modules.py`
- `frontend/src/pages/GuitarPage.tsx` or `frontend/src/pages/ModulePage.tsx`
- `frontend/src/components/HabitSessionDetails.tsx`
- `frontend/src/components/WorkoutHistoryCard.tsx`

Things that surprise agents:

- guitar and workouts share a lot of backend logic
- workout sessions support `run_miles` and `is_rest`; guitar does not
- song PDFs are stored on disk, not in SQLite blobs

## 6. Work On Networking

Read these together:

- `backend/personal_api/services/networking.py`
- `frontend/src/lib/networking.ts`
- `frontend/src/pages/NetworkingPage.tsx`

Things that surprise agents:

- contacts and `potential_connects` are different systems but partially synchronized
- tags are stored as JSON in SQLite
- follow-up urgency is partly derived from dates and partly from tags/status

## 7. Work On Resume Features

Read these together:

- `backend/personal_api/services/resume.py`
- `backend/personal_api/routers/resume.py`
- `frontend/src/pages/ResumePage.tsx`

Things that surprise agents:

- resumes are stored in localStorage, not the backend
- the backend only compiles LaTeX source to a PDF blob
- preview rendering uses `pdfjs-dist`

## 8. Styling Changes

1. Confirm whether the class lives in `app.css`.
2. Edit the active stylesheet directly.
3. Reuse CSS custom properties before adding hard-coded values.
4. If you touch theme behavior, remember `theme` is active and `mood` is currently vestigial.
