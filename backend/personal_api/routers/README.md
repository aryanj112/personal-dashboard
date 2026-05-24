# Routers

Each router file defines HTTP endpoints for one domain and usually delegates most work to a matching service file.

## Files

- `system.py`: `GET /health`
- `habits.py`: today payload, habits CRUD, habit logging
- `tasks.py`: week payload, tasks, goals, checklists, recurring tasks
- `modules.py`: guitar and workouts endpoints
- `dashboard.py`: overview analytics payload
- `networking.py`: contacts and potential connects
- `internships.py`: tracked internship companies, postings, refreshes, summaries
- `companies.py`: tracked companies CRUD and cowork-text export
- `notes.py`: singleton notes document
- `finance.py`: finance categories, expenses, subscriptions, wishlist
- `reflection.py`: reflection content payload
- `resume.py`: LaTeX compile endpoint

## Conventions

- Open a DB connection with `get_db()` inside the route function.
- Keep validation or translation logic small and local to the router.
- Push reusable logic into `services/`.
- Raise `HTTPException` for user-facing API errors.

## Notable Route Behaviors

- `tasks.py` materializes recurring task instances when the week payload is requested.
- `modules.py` mixes JSON endpoints with file upload/download endpoints for guitar song PDFs.
- `notes.py` manages a singleton document instead of a collection resource.
- `resume.py` returns PDF bytes, not JSON.
- `companies.py` uses absolute paths under `/api/companies` instead of an `APIRouter(prefix=...)` pattern.

For the complete endpoint list, see `../../../docs/api-reference.md`.
