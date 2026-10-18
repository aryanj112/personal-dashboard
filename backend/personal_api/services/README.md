# Services

`services/` is where most backend behavior lives.

## Domain Files

### `habits.py`

- builds the Today payload
- computes streaks and heatmap cells
- handles session-backed habits for `Guitar` and `Exercise`

### `tasks.py`

- lists dated tasks, week tasks, overdue tasks, misc tasks
- lists goals
- assembles checklist payloads from tracker rows plus per-day deltas

### `recurring.py`

- stores recurring-task rules
- expands rules into concrete `tasks` rows for visible date ranges
- detaches generated tasks if a rule is deleted

### `modules.py`

- shared section/session behavior for guitar and workouts
- guitar materials and song-group helpers
- guitar song-file metadata helpers
- session analytics for charts and streaks

### `dashboard.py`

- aggregates Today, streaks, module analytics, and recent activity into one overview payload

### `networking.py`

- contact CRUD
- contact interactions
- potential-connect queue updates
- sync logic between contacts and outreach queue rows

### `companies.py`

- tracked company CRUD
- cowork-text generation and disk write

### `resume.py`

- compiles LaTeX into PDF bytes using a local `pdflatex` binary

## Patterns Worth Preserving

- keep SQL close to the domain logic instead of hiding it behind generic abstractions
- return plain dict payloads that already match frontend expectations
- preserve user-entered data during refresh/backfill flows
- prefer explicit helper functions over clever inheritance or generic service bases

## High-Risk Areas

- `networking.py`: two partially synchronized table families
- `modules.py`: shared guitar/workout logic plus file metadata
- `resume.py`: depends on system binaries and subprocess execution
