# Claude Code Guidelines

Barcode inventory for a church food pantry. `server/` is Express 5 + Postgres,
`web/` is React + Vite, `deploy/chart/` is the Helm chart. See `README.md`.

## Commands

| Command                                     | What it does                                                             |
| ------------------------------------------- | ------------------------------------------------------------------------ |
| `npm run check`                             | Type-check, lint, format check and server tests. Run before every commit |
| `npm test`                                  | Server tests against a real throwaway Postgres, plus the structure test  |
| `npm run test:e2e`                          | Browser tests at phone and desktop widths                                |
| `npm run format`                            | Prettier over the repo                                                   |
| `npm run dev:db` / `dev:server` / `dev:web` | Local Postgres, API on :4000, app on :5173                               |

## Scoped Rules

Rules in `.claude/rules/` load automatically based on which files are touched.

| Rule File                  | Scope                                   | Content                                         |
| -------------------------- | --------------------------------------- | ----------------------------------------------- |
| `git-workflow.md`          | Always                                  | Branches, Conventional Commits, PRs             |
| `file-size-conventions.md` | Always                                  | File and function line limits                   |
| `testing.md`               | Always                                  | Where tests live, what a change must add        |
| `module-conventions.md`    | `server/src/**`, `web/src/**`           | Folder layout, what may import what             |
| `backend-patterns.md`      | `server/**`                             | Errors, routes vs services, validation, logging |
| `backend-database.md`      | `server/migrations/**`, `server/src/**` | Migrations are append-only, SQL conventions     |
| `frontend-design.md`       | `web/**`                                | Stub; the design rules are in `web/DESIGN.md`   |

## Enforcement

- `server/test/structure.test.ts` fails on a file over its limit, a file in the
  wrong place, or an import that crosses a boundary. It runs with `npm test`.
- ESLint covers function length, `console`, hooks and accessibility.
- `.claude/hooks/` blocks edits to applied migrations and `.env*`, and formats
  each edited file with Prettier.
- `.github/workflows/ci.yml` runs all of it on every pull request.

A rule that is only written down drifts. When you add a rule, add its check.
