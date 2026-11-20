---
paths:
    - 'server/src/**'
    - 'web/src/**'
---

# Module Conventions

A scaled-down copy of the `escalation-league` layout: feature folders with a
public `index.ts`, a small shared tier, and a test that enforces the edges.
No DI container or manifests here; the app is too small to need them.

## Server

```
server/src/
  index.ts          boot: config, migrate, listen
  app.ts            builds the app from the modules; owns only /api/health
  config.ts
  modules/
    index.ts        the composition list, in mount order
    context.ts      Module, ModuleContext, AppDeps types
    <name>/
      index.ts      the module object + what other modules may use
      routes.ts     router factory: (ctx) => Router
      service.ts    logic and SQL; plain parameters, no req/res
      validation.ts request body -> typed input (when routes.ts gets busy)
      __tests__/
  shared/           non-feature code every module may use
```

- Every `/api` route is mounted by a module. `app.ts` holds no feature routes.
- A module imports its own files, `shared/`, and another module's `index.ts`
  only. `shared/` never imports a module.
- What another module may call is re-exported from `index.ts`. If it is not
  there, it is private.
- A route's gates (`auth.requireView`, `auth.requireEdit`) come from the
  context, never from importing the auth module's internals.
- Nothing else goes at the top of `server/src`.

### Adding a module

1. Create `modules/<name>/` with `index.ts`, `routes.ts`, `service.ts`.
2. Add it to `modules/index.ts`.
3. Add `modules/<name>/__tests__/<name>.test.ts` using `useTestApp()`.

## Web

```
web/src/
  main.tsx
  app/              the shell, the page switch, styles.ts (CSS order)
  features/<name>/  one folder per screen or flow; index.ts is its surface
  shared/           api.ts, types.ts, format.ts, ui/ (primitives + tokens)
```

- `shared/` never imports a feature or `app/`.
- A feature imports another feature only as `@/features/<name>` (its
  `index.ts`), never a file inside it.
- Only `main.tsx` imports `app/`.
- Leaving a folder uses the `@/` alias. `../` is not allowed in `web/src`.
  Inside a folder use `./`.
- Feature folders are flat until one has more than about ten files.
- Every stylesheet is listed once in `app/styles.ts`. The order there is the
  cascade; components do not import CSS themselves.
- A component used by two features lives in the feature that owns the concept
  and is exported from its `index.ts` (`ProductThumb` in `inventory`). Move it
  to `shared/ui/` only when it knows nothing about the domain.

### Adding a feature

1. Create `features/<name>/` with the screen component and `index.ts`.
2. Mount it in `app/App.tsx`.
3. Extend `e2e/pantry.spec.ts` with its happy path.

## Enforced

`server/test/structure.test.ts` checks the top-level entries of both `src`
folders, that every module and feature has an `index.ts`, every import edge
above, that routes run no SQL and services import no `express`, and that every
stylesheet is in `styles.ts`.
