# personal_api Package

This package contains the full backend application.

## Files And Folders

- `main.py`: creates the FastAPI app, configures CORS, registers routers, and runs startup schema creation
- `schemas.py`: request-body models used by routers
- `core/`: low-level storage and utility helpers
- `routers/`: HTTP endpoints grouped by product area
- `services/`: business logic and data access helpers

## Design Pattern

The package follows a simple split:

- `routers/` parses HTTP input and raises HTTP-level errors
- `services/` performs the real work
- `core/db.py` owns persistence bootstrap and paths

This structure is consistent across most features, so when you touch a domain you should usually edit the router, its service, and the matching frontend API helper together.

## Registered Routers

Routers are registered in `main.py` in this order:

1. `system`
2. `habits`
3. `tasks`
4. `modules`
5. `dashboard`
6. `networking`
7. `internships`
8. `companies`
9. `notes`
10. `finance`
11. `reflection`
12. `resume`

The registration order is not usually important, but this is the quickest place to check whether a route file is actually mounted.
