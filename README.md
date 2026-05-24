# Personal

Local-first life dashboard with a React frontend, a FastAPI backend, and a single SQLite database.

The app started as a habit tracker and now covers daily planning, guitar/workout logging, networking follow-ups, internship sourcing, finance tracking, reflection prompts, and LaTeX resume tailoring.

## Product Surface

- `Dashboard`: streaks, heatmap, recent activity, and compact weekly analytics
- `Today`: habits, dated tasks, checklists, recurring tasks, misc tasks, and notes
- `Guitar`: session logging, materials, song groups, PDF uploads, and CAGED helpers
- `Workouts`: session logging, run tracking, rest days, and history editing
- `Networking`: contacts, interactions, follow-ups, and outreach queue management
- `Internships`: tracked companies, job-board fetches, manual buckets, and AI summaries
- `Finance`: monthly expenses, subscriptions, wishlist items, and category management
- `Reflection`: quotes, prompts, questions, videos, and local journaling fields
- `Resume`: local LaTeX editing, backend PDF compilation, and inline preview/export
- `Settings`: theme/preferences plus habits, companies, finance categories, sections, and option lists

## Repo Map

```text
.
├── AGENTS.md                      # Primary repo guide for coding agents
├── docs/                          # Architecture, API, data model, and workflow docs
├── backend/
│   ├── app.py                     # Uvicorn entrypoint
│   ├── requirements.txt
│   ├── data/                      # SQLite DB, backups, generated cowork text, uploaded PDFs
│   └── personal_api/
│       ├── core/                  # DB bootstrap and small utilities
│       ├── routers/               # FastAPI route layer
│       ├── services/              # Domain logic
│       ├── main.py                # App factory
│       └── schemas.py             # Pydantic request models
├── frontend/
│   ├── src/
│   │   ├── App.tsx                # Client-side route shell and shared loading
│   │   ├── components/            # Shared UI and detail editors
│   │   ├── lib/                   # API client, types, and helpers
│   │   ├── pages/                 # Route-level pages
│   │   └── styles/                # Active and legacy themes
│   └── package.json
├── COMPANY_LIST_CONTEXT.md        # Detailed note for tracked companies/cowork text
├── TESLA_SCRAPER_CONTEXT.md       # Detailed note for the Tesla scraper
├── run-dev.sh                     # Starts backend, frontend, and local Ollama when available
└── session.md                     # Product narrative / project history
```

## Run Locally

One command starts both app tiers:

```bash
./run-dev.sh
```

On macOS, `Run Personal.command` is a Finder-friendly wrapper.

Disable backend reload if needed:

```bash
./run-dev.sh --no-reload-backend
```

Backend only:

```bash
cd backend
pip3 install -r requirements.txt
python3 -m uvicorn app:app --reload
```

Frontend only:

```bash
cd frontend
npm install
npm run dev
```

Then open [http://127.0.0.1:5173](http://127.0.0.1:5173).

## Important Runtime Notes

- The backend initializes and migrates the SQLite schema on startup via `create_schema()` in `backend/personal_api/core/db.py`.
- The frontend is hardcoded to talk to `http://127.0.0.1:8000` in `frontend/src/lib/api.ts`.
- Guitar song file uploads require `python-multipart`.
- Resume compilation requires a working `pdflatex` installation on the machine running the backend.
- Internship AI summaries call a local Ollama server when available; failures degrade gracefully to an empty summary.

## Docs

- Start with `AGENTS.md` for the fastest orientation.
- See `docs/README.md` for the full docs index.
- Directory-level READMEs under `backend/` and `frontend/` explain local ownership and quirks.
