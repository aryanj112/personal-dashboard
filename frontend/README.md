# Frontend

This is a Vite + React frontend for the Personal dashboard.

## Run

```bash
cd frontend
npm install
npm run dev
```

The frontend expects the backend at `http://127.0.0.1:8000`.

## Stack

- React 19
- TypeScript
- Vite
- Framer Motion
- Lucide icons
- `pdfjs-dist` for resume preview rendering

## Layout

```text
frontend/
├── src/
│   ├── App.tsx            # top-level route shell and bootstrap loading
│   ├── main.tsx           # mount point and stylesheet import
│   ├── pages/             # route-level product surfaces
│   ├── components/        # shared UI
│   ├── lib/               # API client, types, and helpers
│   └── styles/            # active and legacy CSS systems
├── index.html
├── package.json
└── vite.config.ts
```

## Frontend Architecture Notes

- There is no URL router; `App.tsx` stores the current route in state/localStorage.
- The frontend loads several core payloads in parallel and passes them down by props.
- Settings and some workflow data are persisted in localStorage.
- The active stylesheet is `src/styles/app-military.css`.
- `src/styles/app.css` is a legacy theme that still acts as a useful reference.
- The app still persists a `mood` setting, but the active stylesheet no longer uses it.

## Directory Guides

- `src/README.md`
- `src/pages/README.md`
- `src/components/README.md`
- `src/lib/README.md`
- `src/styles/README.md`
