---
paths:
    - 'server/**'
---

# Backend Code Patterns

## Error handling

Throw an `AppError` through a factory in `shared/errors.ts` (`badRequest`,
`unauthorized`, `forbidden`, `notFound`, `conflict`, `tooManyRequests`).
Express 5 forwards a thrown or rejected error to `shared/errorHandler.ts`,
the one place a failure becomes a response.

- An `AppError` keeps its status and message. Its message is shown to a
  volunteer, so write it for them: what happened and what to do.
- Anything else is a masked 500, logged with the error.
- Never `res.status(4xx).json(...)` or `res.status(500)` in a route or a
  middleware. Throw, or call `next(error)`.
- A Postgres constraint with a plain meaning is translated in
  `errorHandler.ts` (`databaseMessage`). Add a new constraint there.

```ts
if (result.rowCount === 0) throw notFound('That shelf no longer exists.');
```

## Routes and services

- `routes.ts` is a thin HTTP wrapper: parse the input, call the service,
  send the result. No SQL, no business rules.
- `service.ts` takes plain data and a `Queryable` or pool, never `req`/`res`,
  and never imports `express`. It throws `AppError` on a business error.
- A write that touches more than one row goes through `withTransaction`. A
  helper called inside one takes the transaction's `db` as a parameter; it
  must not reach for the pool, or its writes escape the rollback.
- One connection runs one query at a time. Do not `Promise.all` queries on the
  same client; await them in turn.

## Input validation

- Parse every request field with the helpers in `shared/parse.ts`
  (`requiredText`, `optionalText`, `wholeNumber`, `optionalBarcode`,
  `optionalShelfId`, `idParam`). Each returns a clean value or throws a 400.
- When a module has more than a couple of fields, put the parsing in its
  `validation.ts` as `parseX(body): X` and keep the route to one line.
- The service's input type lists every field it persists. A field that is not
  parsed is not saved.
- Never index a plain object with a request-derived string. Use a `Map` or
  `Object.hasOwn`.

## Logging

Use `logger` from `shared/logger.ts` (Pino). Never `console` in `server/src`;
scripts in `server/scripts/` may print.

```ts
logger.info({ port }, 'Pantry inventory listening'); // fields first
logger.error({ err }, 'Unhandled request error'); // the Error under `err`
```

- The fields object goes first. With a string first, later arguments are
  dropped.
- Log the Error itself as `{ err }`, never `err.message`.
- Never log a PIN, the session secret or a cookie.

## Auth

- Two roles: `viewer` and `editor`. Reads use `auth.requireView`, every write
  uses `auth.requireEdit`. A new route without a gate needs a comment saying
  why it is public.
- PINs and signatures are compared with `sameString` (constant time).
