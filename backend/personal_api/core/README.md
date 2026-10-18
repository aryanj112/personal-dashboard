# Core

`core/` contains the lowest-level helpers shared across the backend.

## Files

- `db.py`: database paths, schema creation, inline migrations, seed data, DB connection helper
- `utils.py`: lightweight helpers for rows and date math

## `db.py` Responsibilities

`db.py` is the most important backend infrastructure file. It owns:

- `BASE_DIR`, `DATA_DIR`, `DB_PATH`, and `GUITAR_FILES_DIR`
- `get_db()`: context manager that opens SQLite, enables foreign keys, commits, and closes
- `create_schema()`: table creation, additive migrations, and seeding
- default seed lists for habits, sections, and tracked companies
- company-alias merge helper logic

## Important Rules

- There is no separate migration system. Storage changes belong in `create_schema()`.
- Schema changes must be idempotent because they run at startup.
- Preserve existing local user data whenever possible.
- File-backed guitar uploads depend on `GUITAR_FILES_DIR` existing.

## `utils.py`

`utils.py` intentionally stays small:

- `dicts(rows)`: row-to-dict conversion
- `iso_today()`: today's ISO date
- `week_start(day)`: Monday-based week start

If a helper starts growing domain behavior, it likely belongs in a service instead.
