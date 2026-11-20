# Testing Standards

## Where tests live

- A server module's tests: `server/src/modules/<name>/__tests__/*.test.ts`.
- Shared server code: `server/src/shared/__tests__/`.
- `server/test/` holds only the helpers (`helpers/testApp.ts`,
  `globalSetup.ts`) and the repo-wide `structure.test.ts`. Never a
  `server/test/<domain>` file.
- Browser tests: `e2e/pantry.spec.ts`, run at 360px and 1280px.

## Writing a server test

```ts
const t = useTestApp(); // this file's own database, emptied before each test

it('adds a shelf', async () => {
    const agent = await t.editor(); // a signed-in volunteer
    await agent.post('/api/shelves').send({ name: 'A1' }).expect(201);
});
```

- Tests go through HTTP with `supertest`, against a real Postgres. No mocked
  database.
- The barcode lookup is faked: set `t.known[barcode]`, read `t.lookups`. No
  test may reach the internet.
- Test files run in parallel, each in its own database. Do not share state
  between files.

## Rules

- A change to behaviour changes its test in the same commit.
- A new route gets a test for the happy path, for bad input and for the
  permission it needs (a viewer is refused).
- A new or materially changed screen flow extends the Playwright happy path
  in the same PR.
- A test that fails and then passes on a re-run has a cause. Find it; do not
  re-run until green.
- Never dismiss a failure as "pre-existing" without looking.
- Timers and debounces run on fake timers, never real sleeps.
