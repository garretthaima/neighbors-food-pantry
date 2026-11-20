# Git Workflow

Trunk-based. `main` is the only long-lived branch and is always deployable.

## Branches

- Feature: `feature/<description>-issue-<number>`
- Bugfix: `bugfix/<description>-issue-<number>`
- Chore with no issue: `chore/<description>`
- Branch off `main`, keep it short-lived. Do not commit straight to `main`;
  open a PR, even solo. It is where CI runs.

## Commits: Conventional Commits

- `feat:` new behaviour, `fix:` a bug, `refactor:`, `test:`, `docs:`, `ci:`,
  `build:`, `chore:`. Scope optional: `feat(scan): ...`.
- Reference the issue: `feat(scan): receive a whole case (#5)`.
- No emojis in commit messages, PR titles, PR bodies or issue comments.

## Pull requests

- Base on `main`. `Closes #123` in the body.
- Title under 70 characters, Conventional-Commit shaped: it becomes the
  squashed commit.
- Body: a summary and a test plan.
- Before opening: `npm run check` and `npm run test:e2e` green, and the app
  run locally for anything a person can see.
- Squash merge.

## Never

- Force-push `main`.
- Commit `.env`, a PIN or a session secret.
