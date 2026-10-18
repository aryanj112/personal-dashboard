# Components

These components are reused across multiple pages or encapsulate a focused editing/visualization pattern.

## Files

### `Layout.tsx`

- top navigation shell
- route buttons and active-page framing

### `Charts.tsx`

- `TinyBarChart`
- `TrendLine`
- `WeeklyPieChart`
- `DistributionPieChart`
- `Heatmap`

Used primarily by Dashboard, Guitar, and Workouts.

### `HabitSessionDetails.tsx`

- inline editors used from the Today page
- supports the two session-backed habits: guitar and exercise
- lets users create, edit, or delete sessions without leaving Today

### `WorkoutHistoryCard.tsx`

- reusable workout-session edit card
- supports run-specific duration parsing and rest-day toggles

## Design Notes

- These components are mostly stateful and domain-aware rather than ultra-generic.
- Shared logic is extracted when reuse is real, but not pushed into abstract component systems prematurely.
- If a component starts accumulating feature-specific behavior for only one page, moving it back into that page is often reasonable in this repo.
