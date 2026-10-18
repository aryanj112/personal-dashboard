# Backend

This is a small FastAPI backend backed directly by SQLite. Most meaningful behavior lives in `personal_api/services/`, while `personal_api/routers/` stays intentionally thin.

## Entry Points

- `app.py`: import target for `uvicorn app:app`
- `personal_api/main.py`: app factory, router registration, startup schema bootstrap

## Run

```bash
cd backend
pip3 install -r requirements.txt
python3 -m uvicorn app:app --reload
```

The dev helper at the repo root, `../run-dev.sh`, starts this together with the frontend.

## Dependencies

`requirements.txt` currently includes:

- `fastapi`
- `uvicorn`
- `python-multipart`
- `httpx`

## Layout

```text
backend/
├── app.py
├── data/                  # SQLite DB, backups, generated exports, uploaded files
├── personal_api/
│   ├── core/              # DB bootstrap and tiny helpers
│   ├── routers/           # HTTP layer
│   ├── services/          # Domain logic
│   ├── main.py            # App factory
│   └── schemas.py         # Pydantic request models
└── requirements.txt
```

## Important Backend Rules

- Schema creation and migrations happen at startup in `personal_api/core/db.py`.
- There is no ORM and no separate migration tool.
- Avoid putting business logic in route functions; add it to `services/`.
- Treat `backend/data/personal.db` as user data.
- Session-backed habits (`Guitar`, `Exercise`) are derived from session tables.
- Company mutations regenerate `backend/data/companies_cowork.txt`.
- Resume compilation depends on a local `pdflatex` binary.

## Local Guides

- `personal_api/README.md`
- `personal_api/core/README.md`
- `personal_api/routers/README.md`
- `personal_api/services/README.md`
- `data/README.md`
