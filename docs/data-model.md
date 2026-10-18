# Data Model

## Database Location

- Primary DB: `backend/data/personal.db`
- Backups: `backend/data/personal_backup_*.db`

SQLite is the source of truth for persistent app state. There is no ORM or external migration framework.

## Schema Ownership

`backend/personal_api/core/db.py` owns:

- initial table creation
- additive migrations and backfills
- default seed rows
- filesystem sidecar paths such as `guitar_files/`

If you change storage, update `create_schema()` rather than assuming a clean DB.

## Table Groups

### Habits And Today

- `habits`: habit definitions, sort order, soft-delete metadata
- `habit_logs`: per-day manual completion rows
- `habit_sick_days`: neutral Singing and Exercise dates that preserve streaks without marking completion
- `tasks`: dated tasks, misc tasks, checklist links, recurring-task instance links
- `goals`: lightweight evergreen goals
- `checklist_trackers`: checklist definitions
- `checklist_logs`: per-date checklist deltas
- `app_notes`: singleton table for Today notes
- `recurring_tasks`: recurring-task rules

Important rules:

- `tasks.is_misc = 1` means the task lives outside date-based day columns.
- `tasks.recurring_task_id` links a generated task instance back to a rule.
- `checklist_logs` stores deltas, not absolute totals.
- `app_notes` is a singleton row with `id = 1`.

### Guitar

- `guitar_sections`
- `guitar_sessions`
- `guitar_session_sections`
- `guitar_materials`
- `guitar_song_groups`
- `guitar_songs`
- `guitar_song_files`

Important rules:

- guitar files are stored on disk and referenced by `relative_path`
- deleting a song or file should also clean up the on-disk PDF

### Workouts

- `workout_sections`
- `workout_sessions`
- `workout_session_sections`

Important rules:

- `run_miles` is only meaningful for run sessions
- `is_rest = 1` marks rest-day entries
- workout analytics intentionally exclude rest days from counts, but rest days still keep streak gaps from breaking

### Networking

- `networking_contacts`
- `networking_interactions`
- `potential_connects`

Important rules:

- contact tags live in `tags_json`
- `potential_connects` is a separate outreach queue, not the same thing as real contacts
- services keep parts of these tables in sync when names/companies/LinkedIn URLs change

### Tracked Companies And Retained Feature Data

- `tracked_companies`

`tracked_companies` powers the active Settings company manager and cowork-text export. Old internship and posting records may remain in existing databases but have no active page or API.

### Finance

- `finance_categories`
- `finance_expenses`
- `finance_subscriptions`
- `finance_wishlist_items`

These tables and existing rows are retained in SQLite, but the Finance API and UI have been removed. No database file or record was changed.

### Reflection

- `reflection_items`

Existing reflection rows are retained; no active reflection page or API is mounted.

## Seed Data

`create_schema()` seeds default rows when tables are empty, including:

- core habits
- guitar sections/materials/song groups
- workout sections
- finance categories
- reflection items
- tracked companies
- singleton notes row

Because the app is personal and local-first, seeds are written to coexist with existing user data instead of assuming stateless deploys.

## Derived Behaviors Worth Remembering

### Session-Backed Habits

The `Guitar` and `Exercise` habits are derived from session tables, not only from `habit_logs`.

### Recurring Tasks

Rules in `recurring_tasks` are expanded into concrete `tasks` rows for visible date ranges. Deleting a recurring rule detaches generated tasks by clearing `tasks.recurring_task_id`.

## Filesystem Sidecars

- `backend/data/companies_cowork.txt`: regenerated from `tracked_companies`
- `backend/data/guitar_files/`: uploaded song PDFs

These are part of the app's effective data model even though they are not in SQLite.
