# API Reference

All API routes are served by the FastAPI app in `backend/personal_api/main.py`.

Base URL in local development: `http://127.0.0.1:8000`

## Health And System

| Method | Path | Purpose | Body |
| --- | --- | --- | --- |
| `GET` | `/health` | Liveness check | none |

## Habits And Today

| Method | Path | Purpose | Body |
| --- | --- | --- | --- |
| `GET` | `/api/today?target_date=YYYY-MM-DD` | Today payload for a date | none |
| `GET` | `/api/habits` | List active habits | none |
| `POST` | `/api/habits` | Create a habit | `{ name, sort_order? }` |
| `PATCH` | `/api/habits/{habit_id}` | Update habit metadata | `{ name?, is_active?, sort_order? }` |
| `DELETE` | `/api/habits/{habit_id}` | Delete/deactivate a habit | none |
| `PUT` | `/api/habits/{habit_id}/log` | Upsert manual habit completion | `{ date, completed, notes? }` |
| `PUT` | `/api/habits/{habit_id}/sick-day` | Mark Singing or Exercise as sick without completing it | `{ date, is_sick }` |

Notes:

- `GET /api/today` also includes tasks, checklists, goals, overdue tasks, and misc tasks.
- `Guitar` and `Exercise` completion comes from session tables, not only from `habit_logs`.

## Tasks, Goals, Checklists, Recurring

| Method | Path | Purpose | Body |
| --- | --- | --- | --- |
| `GET` | `/api/tasks/week?week_start=YYYY-MM-DD` | Week payload plus overdue/misc tasks | none |
| `POST` | `/api/tasks` | Create a task | `{ text, date?, notes?, checklist_id?, priority, is_misc }` |
| `PATCH` | `/api/tasks/{task_id}` | Update a task | `{ text?, completed?, notes?, sort_order?, date?, priority?, is_misc? }` |
| `DELETE` | `/api/tasks/{task_id}` | Delete a task | none |
| `POST` | `/api/tasks/goals` | Create a goal | `{ text }` |
| `DELETE` | `/api/tasks/goals/{goal_id}` | Delete a goal | none |
| `POST` | `/api/tasks/checklists` | Create a checklist tracker | `{ text, starting_count, total_goal, daily_goal }` |
| `POST` | `/api/tasks/checklists/{checklist_id}/progress` | Apply checklist delta for a date | `{ date, delta }` |
| `POST` | `/api/tasks/checklists/{checklist_id}/task` | Create/return linked task for a date | `{ date, delta }` |
| `DELETE` | `/api/tasks/checklists/{checklist_id}` | Delete checklist tracker | none |
| `GET` | `/api/tasks/recurring` | List recurring rules | none |
| `POST` | `/api/tasks/recurring` | Create recurring rule | `{ text, priority, days_of_week, end_date? }` |
| `PATCH` | `/api/tasks/recurring/{task_id}` | Update recurring rule | `{ text?, priority?, days_of_week?, end_date?, is_active? }` |
| `DELETE` | `/api/tasks/recurring/{task_id}` | Delete recurring rule | none |

Notes:

- `GET /api/tasks/week` materializes recurring tasks for the requested week plus two weeks ahead.
- Non-misc tasks must always have a date.

## Dashboard

| Method | Path | Purpose | Body |
| --- | --- | --- | --- |
| `GET` | `/api/dashboard` | Overview analytics, streaks, heatmap, and recent activity | none |

## Guitar

| Method | Path | Purpose | Body |
| --- | --- | --- | --- |
| `GET` | `/api/guitar` | Full guitar module payload | none |
| `POST` | `/api/guitar/materials` | Create guitar material | `{ title, notes }` |
| `PATCH` | `/api/guitar/materials/{material_id}` | Update guitar material | `{ title?, notes? }` |
| `DELETE` | `/api/guitar/materials/{material_id}` | Delete guitar material | none |
| `POST` | `/api/guitar/song-groups/{group_id}/songs` | Create song in group | `{ title }` |
| `PATCH` | `/api/guitar/songs/{song_id}` | Update song | `{ title?, notes? }` |
| `DELETE` | `/api/guitar/songs/{song_id}` | Delete song and linked files | none |
| `POST` | `/api/guitar/songs/{song_id}/files` | Upload song PDF | multipart form with `file` |
| `GET` | `/api/guitar/song-files/{file_id}` | Download stored song PDF | none |
| `DELETE` | `/api/guitar/song-files/{file_id}` | Delete stored song PDF | none |
| `POST` | `/api/guitar/sections` | Create guitar section | `{ name }` |
| `PATCH` | `/api/guitar/sections/{section_id}` | Rename guitar section | `{ name }` |
| `DELETE` | `/api/guitar/sections/{section_id}` | Delete guitar section | none |
| `POST` | `/api/guitar/sessions` | Create guitar session | `{ date, duration_minutes?, notes?, section_ids, is_rest? }` |
| `PATCH` | `/api/guitar/sessions/{session_id}` | Update guitar session | same shape, optional fields |
| `DELETE` | `/api/guitar/sessions/{session_id}` | Delete guitar session | none |

## Workouts

| Method | Path | Purpose | Body |
| --- | --- | --- | --- |
| `GET` | `/api/workouts` | Full workouts module payload, including `sick_dates` | none |
| `POST` | `/api/workouts/sections` | Create workout section | `{ name }` |
| `PATCH` | `/api/workouts/sections/{section_id}` | Rename workout section | `{ name }` |
| `DELETE` | `/api/workouts/sections/{section_id}` | Delete workout section | none |
| `POST` | `/api/workouts/sessions` | Create workout session | `{ date, duration_minutes?, run_miles?, notes?, section_ids, is_rest? }` |
| `PATCH` | `/api/workouts/sessions/{session_id}` | Update workout session | same shape, optional fields |
| `DELETE` | `/api/workouts/sessions/{session_id}` | Delete workout session | none |

Notes:

- `run_miles` and `is_rest` are only meaningful for workouts.

## Networking

| Method | Path | Purpose | Body |
| --- | --- | --- | --- |
| `GET` | `/api/networking` | List contacts with interactions | none |
| `GET` | `/api/networking/potential-connects` | List outreach queue rows | none |
| `POST` | `/api/networking` | Create contact | contact payload |
| `PATCH` | `/api/networking/{contact_id}` | Update contact | partial contact payload |
| `DELETE` | `/api/networking/{contact_id}` | Delete contact | none |
| `PATCH` | `/api/networking/potential-connects/{connect_id}` | Update outreach queue row | `{ company?, connection_request?, status?, date_sent?, notes? }` |

Contact payload fields:

- `name`, `company`, `role`
- `tags`
- `email`, `phone`, `linkedin`
- `location: { city, region }`
- `notes`
- `last_contact_date`
- `next_follow_up_date?`
- `how_we_met`
- `next_action`
- `follow_up_type?`
- `interactions: [{ date, type, summary }]`

Notes:

- contact edits can propagate company/name/linkedin changes into `potential_connects`
- some outreach queue edits can propagate company changes back into contacts

## Companies

| Method | Path | Purpose | Body |
| --- | --- | --- | --- |
| `GET` | `/api/companies` | List all tracked companies | none |
| `GET` | `/api/companies/cowork-text` | Return generated cowork-text export | none |
| `POST` | `/api/companies` | Create tracked company | `{ name, category, careers_url, source_type, source_key }` |
| `PATCH` | `/api/companies/{company_id}` | Update tracked company | any subset of `name`, `category`, `careers_url`, `source_type`, `source_key`, `is_active` |
| `DELETE` | `/api/companies/{company_id}` | Delete tracked company | none |

Note: any company mutation rewrites `backend/data/companies_cowork.txt`.

## Notes

| Method | Path | Purpose | Body |
| --- | --- | --- | --- |
| `GET` | `/api/notes` | Load singleton notes document | none |
| `PUT` | `/api/notes` | Save singleton notes document | `{ content }` |

## Resume

| Method | Path | Purpose | Body |
| --- | --- | --- | --- |
| `POST` | `/api/resume/compile` | Compile LaTeX to PDF | `{ name, source }` |

Notes:

- `name` is sanitized before being used as the PDF job name
- the backend returns raw PDF bytes rather than JSON
- compilation requires `pdflatex` on the machine
