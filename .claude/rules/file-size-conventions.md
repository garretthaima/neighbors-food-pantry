# File and Function Size Conventions

Adapted from `escalation-league`. That repo has soft and hard limits because it
has old files to grandfather. Everything here is new, so there is one limit per
kind of file and it is enforced.

## File length limits

| Kind                             | Path                                      | Limit |
| -------------------------------- | ----------------------------------------- | ----- |
| Route file                       | `server/src/modules/*/routes.ts`          | 300   |
| Service and other module files   | `server/src/modules/**`                   | 400   |
| Shared server code, entry files  | `server/src/shared/**`, `server/src/*.ts` | 300   |
| Scripts and test helpers         | `server/scripts/**`, `server/test/**`     | 300   |
| Components, hooks, web utilities | `web/src/**/*.{ts,tsx}`                   | 300   |
| Stylesheets                      | `web/src/**/*.css`                        | 300   |
| Test files                       | `*.test.ts`, `e2e/**`                     | 800   |

## Function length limits (server)

- Any function in `server/src`: 50 lines.
- A route handler does three things: parse, call the service, respond. If it
  needs more than about ten lines, the logic belongs in the service.
- React components are not line-limited as functions; the file limit covers them.

## Counting

- All lines count, including comments and blanks (`wc -l`).
- Migrations, lock files and generated files are excluded.

## Enforcement

- `server/test/structure.test.ts` fails when a file is over its limit.
- ESLint `max-lines-per-function` fails a long server function.
- An exception goes in `SIZE_EXCEPTIONS` in the structure test, with its
  reason, and only by owner decision. Do not add one to get a PR green.

## When to split

- Route file too long: the module is two modules. Split by sub-domain.
- Service too long: split by sub-domain (`service.ts` -> `stockService.ts`).
- Component too long: extract a child component or a hook into its own file in
  the same feature folder (`Inventory.tsx` -> `ProductRow.tsx`).
- Stylesheet too long: split by component; list the new file in
  `web/src/app/styles.ts` next to its neighbour.
- Test file over 800: the thing under test does too much. Split that first.
