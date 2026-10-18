# lib

This folder contains the client-side contract and helper functions.

## Files

### `api.ts`

- central fetch wrapper
- hardcoded `API_BASE`
- all frontend HTTP calls
- converts backend errors into thrown `Error` messages

If you add a backend endpoint that the UI should call, add a typed helper here.

### `types.ts`

- frontend response types and shared domain types
- mirrors backend payload shapes closely

If backend responses change, update this file together with the affected UI.

### `networking.ts`

- enums and option types for networking
- contact/potential-connect types
- filter/sort helpers
- date urgency helpers

### `dates.ts`

- current-week label and Monday-based week bounds helpers

### `duration.ts`

- parsing/formatting helpers for run durations and minute/second inputs

## Important Notes

- This folder is the best place to confirm the frontend/backend contract quickly.
- `api.ts` and `types.ts` are usually the first frontend files to update after a backend API change.
