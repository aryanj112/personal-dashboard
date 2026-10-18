# Unified Company List

## What this is

The `tracked_companies` table in `backend/data/personal.db` is the source of truth for:

- Settings → Company list management
- the generated cowork-text export used outside the app

If an agent needs to change company-related behavior, this table and its surrounding code are the starting point.

## Key files

| File | Purpose |
| --- | --- |
| `backend/personal_api/core/db.py` | Schema plus `DEFAULT_TRACKED_COMPANIES` seed list |
| `backend/personal_api/services/companies.py` | CRUD and cowork-text generation |
| `backend/personal_api/routers/companies.py` | Company REST API |
| `backend/data/companies_cowork.txt` | Generated export file |
| `frontend/src/lib/types.ts` | `Company` frontend type |
| `frontend/src/lib/api.ts` | Company-related client helpers |
| `frontend/src/pages/SettingsPage.tsx` | `CompanyListManager` UI |

## Current Seed Shape

The seeded defaults currently contain `57` companies across `8` categories:

- `AI` (`11`)
- `Autonomous Vehicles / Drones` (`9`)
- `Big Tech` (`9`)
- `Climate Tech / Robotics` (`6`)
- `Defense / Autonomy` (`2`)
- `Robotics` (`12`)
- `Simulation / Graphics` (`3`)
- `Space` (`5`)

The app may later contain additional user-created companies beyond the seeded defaults.

## API Endpoints

```text
GET    /api/companies
GET    /api/companies/cowork-text
POST   /api/companies
PATCH  /api/companies/{company_id}
DELETE /api/companies/{company_id}
```

Body shapes:

- `POST /api/companies`: `{ name, category, careers_url, source_type, source_key }`
- `PATCH /api/companies/{company_id}`: any subset of `name`, `category`, `careers_url`, `source_type`, `source_key`, `is_active`

## Table Shape

Core fields:

```sql
id, name, source_type, source_key, careers_url, role_focus,
is_active, last_fetched_at, last_fetch_error, created_at, updated_at, category
```

Notes:

- `source_type` and `source_key` are retained company metadata; no internship fetch service is mounted
- `category` is free-form and powers both UI grouping and cowork-text grouping

### Cowork Text Generation

Every create, update, or delete operation rewrites `backend/data/companies_cowork.txt` via `write_cowork_file()` in `services/companies.py`.

### Frontend Ordering


## Adding A New Company

### Via UI

Use Settings → Company list.

### Via Code

Append a new tuple to the end of `DEFAULT_TRACKED_COMPANIES` in `backend/personal_api/core/db.py`:

```python
("Company Name", "greenhouse", "board-token", "https://careers.example.com", "Category Name")
```

Tuple order:

```python
(name, source_type, source_key, careers_url, category)
```

Appending is safer than inserting into the middle because the frontend preserves its own ordering separately.
