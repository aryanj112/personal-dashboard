# .claude

This folder contains local assistant-tooling configuration and permission hints. It is not part of the runtime application.

## Files

- `settings.json`: shared allow-list entries for common local commands
- `settings.local.json`: additional machine-local command allowances

## Notes

- These files are useful for understanding past local workflows, especially around SQLite inspection and internship scraping experiments.
- They do not affect the FastAPI app, Vite frontend, or SQLite schema directly.
