# src

This folder contains the entire client application.

## Top-Level Files

- `main.tsx`: mounts React and imports the active stylesheet
- `App.tsx`: top-level route shell, bootstrap loading, localStorage-backed preferences

## Folders

- `pages/`: route-level screens
- `components/`: shared charts, editors, layout, and history cards
- `lib/`: API client, response types, and pure helpers
- `styles/`: CSS systems

## App-Level Responsibilities

`App.tsx` is the client-side orchestrator. It owns:

- the current route
- theme and mood persistence
- dashboard preference persistence
- networking option persistence
- shared bootstrap data for the most common pages

It also decides which pages are visible:

- settings is always available
- resume is an independent page with its own data loading

## Important Quirks

- `API_BASE` is hardcoded in `lib/api.ts`.
- `theme` is active in the current stylesheet.
- `mood` is still persisted and passed around, but the active stylesheet no longer reacts to it.
