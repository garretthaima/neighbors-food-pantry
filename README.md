# Pantry inventory

Barcode-scanning inventory for a church food pantry. Volunteers scan items
in and out; anyone with the link can see what is on which shelf.

- `server/`: Express 5 + Postgres. Node runs the TypeScript directly.
- `web/`: React + Vite. The server serves the built files.
- `deploy/chart/`: Helm chart (app, Postgres, HTTPRoute).

## Where things go

```
server/src/modules/<name>/   one folder per feature: routes.ts, service.ts, __tests__/
server/src/shared/           errors, logger, db, input parsing
server/migrations/           plain .sql, append-only
web/src/features/<name>/     one folder per screen
web/src/shared/ui/           buttons, dialogs, fields, tokens
web/src/app/                 the shell and the stylesheet order
e2e/                         browser tests
```

The conventions are in `.claude/rules/` (layout, file sizes, backend
patterns, database, git, testing) and `web/DESIGN.md` (UI). `npm test`
fails when a file is too long, in the wrong folder or imports across a
boundary.

## How scanning works

A USB barcode scanner acts as a keyboard: it types the digits and presses
Enter. The Scan screen keeps a text box focused for it. Phones can use the
camera button instead (needs https).

The first time a barcode is seen, the server asks Open Food Facts, then
UPCitemdb, and saves the answer. Later scans never leave the database. If
neither service knows the barcode, the volunteer types the name once.

## Run it locally

Needs Node 24 or newer. No Docker required.

```sh
npm install
cp .env.example .env
npm run dev:db       # terminal 1: local Postgres
npm run dev:server   # terminal 2: API on :4000
npm run dev:web      # terminal 3: app on :5173
```

Open http://localhost:5173. The volunteer PIN is `EDIT_PIN` in `.env`.

```sh
npm test             # API tests against a real Postgres
npm run test:e2e     # browser tests, phone + desktop
npm run check        # type-check, lint, format check, tests
npm run build        # builds web/dist for the server
```

## Settings

| Variable            | Required              | Meaning                                    |
| ------------------- | --------------------- | ------------------------------------------ |
| `DATABASE_URL`      | yes, or `PGHOST` etc. | Postgres connection                        |
| `EDIT_PIN`          | yes                   | Volunteers type this to scan and edit      |
| `SESSION_SECRET`    | yes                   | Long random string, signs the login cookie |
| `VIEW_PIN`          | no                    | If set, viewing needs a PIN too            |
| `PORT`              | no                    | Defaults to 4000                           |
| `LOOKUP_USER_AGENT` | no                    | Sent to the barcode lookup services        |

## Deploy

Build and push the image, create the Secret named in `values.yaml`
(`DB_PASSWORD`, `EDIT_PIN`, `SESSION_SECRET`), then install the chart with
`images.app`, `gateway.name`, `gateway.namespace` and `hosts` set. The app
applies its own database migrations when it starts.

The chart does not back up the database yet.
