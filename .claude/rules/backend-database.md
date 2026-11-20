---
paths:
    - 'server/migrations/**'
    - 'server/src/**'
---

# Database Rules (PostgreSQL 16, node-postgres, plain SQL)

## Migrations are append-only

Never edit, delete or rename a migration that is on `main`. The runner records
applied files by name and never re-runs them, so the live database would keep
the old version while a fresh one gets the new. Make the change in a new file.

- Files are `server/migrations/NNN_description.sql`, applied in name order,
  each in its own transaction. The app applies them when it starts.
- Use the next number. Check `main` first so two branches do not both take it.
- A migration must work on a database that holds real data: add a column as
  nullable or with a default, backfill, then tighten.
- `.claude/hooks/guard_protected_files.py` blocks edits to an existing
  migration, and `scripts/ci/check_migration_edits.py` fails a PR that makes
  one.

## SQL

- Always parameters (`$1`), never string-built values. Column names in a
  dynamic `SET` come from code, never from the request.
- Columns are `snake_case`; alias to `camelCase` in the `SELECT`
  (`p.shelf_id AS "shelfId"`). A module keeps its column list in one constant.
- Counts and sums come back as strings from Postgres; cast with `::int`.
- Stock never goes below zero: change it only through `changeStock`, which
  guards it in the `UPDATE` and writes the `stock_events` row.
- Every change to a quantity writes a `stock_events` row in the same
  transaction. Reports are built from that table.

## Tests

Database tests run against a real Postgres (`embedded-postgres`), never a
mock. `useTestApp()` gives each test file its own database.
