# Backend — Agent Guide

Strapi v5 + TypeScript. Source in `src/`, compiled to `dist/`. Always edit `src/`.

```bash
yarn develop          # compile + start dev server
yarn type-check       # must pass (strict mode)
yarn test:unit        # Vitest unit tests
yarn test:integration # requires .env.test with DB credentials
```

## Source Layout

```
src/
├── index.ts                              # bootstrap
├── db/schema.ts                          # Drizzle schema + exported types
├── db/client.ts                          # exports `db` and `Database` type
├── db/repositories/                      # one class + singleton export per entity
├── utils/                                # pure utility functions
├── api/donation/                         # thin proxy → donations plugin
├── api/organization/                     # custom service + lifecycle hook
└── plugins/donations/server/
    ├── controllers/donation.ts           # HTTP handlers
    └── services/donation.ts             # main service (~1000 lines)
```

## CRITICAL: Donations Plugin Path

`config/plugins.js` must use the **dist** path:
```js
donations: { enabled: true, resolve: "./dist/src/plugins/donations" }
```
If changed to `./src/plugins/donations`, Strapi silently skips the plugin (no error thrown), `strapi.plugin("donations")` returns `undefined`, and all donation routes 500.

## Drizzle ORM

Use singleton exports, not class constructors:
```ts
import { donationsRepository } from "../db/repositories/donations.repository";
```

Types come from the schema:
```ts
import type { Donor, NewDonation } from "../db/schema";
```

## Plugin Access Pattern

```ts
// From API proxy controllers:
(global as any).strapi.plugin("donations").controller("donation").methodName(ctx)
// Services:
strapi.plugin("donations").service("donation").methodName(args)
```

## TypeScript Conventions

- Never use `any` or `as any` — use `unknown` and narrow the type, or define a proper interface.
- Never use `!` (non-null assertion) — always handle nulls explicitly with a guard or fallback.
- Don't use `== null` to check for null/undefined — use truthiness or `typeof x === "number"` etc.
- Use camelCase for variable names.
- **Let TypeScript infer types** — avoid explicit type annotations where the type is already inferrable. Arrow function parameters especially should not have explicit types when inferable from context:
  ```ts
  // Good — type inferred from the array
  people.every((p) => p.name === name)
  // Bad — unnecessary annotation
  people.every((p: Person) => p.name === name)
  ```
- If you find yourself needing to annotate a callback parameter, that's a signal the source data structure lacks proper typing — fix the source type instead.
- Avoid `as SomeType` assertions broadly, not just `as any` — they silence the compiler the same way. Prefer type guards or narrowing.
- `Object.keys(obj)` returns `string[]`, not `(keyof typeof obj)[]` — cast explicitly or restructure to avoid the issue.
- Drizzle's `.returning()` returns an array — always destructure: `const [row] = await db.insert(...).returning()`. An empty result gives `undefined`, not a type error.
- Nullable Drizzle columns return `T | null` in strict mode — handle them; don't cast.

## Strapi Conventions

- Use `strapi.documents("api::x.x")` (Document Service) for content types, not `strapi.db.query()` — the latter bypasses draft/publish and i18n logic.
- Content type UIDs: `api::content-type.content-type` (e.g. `api::organization.organization`). Plugin types: `plugin::name.type`.
- In controllers, use `ctx.badRequest()`, `ctx.notFound()`, `ctx.unauthorized()` for error responses — throwing errors produces 500s.
- Lifecycle hooks can trigger themselves if they write back to the same content type — guard with a flag or check if relevant fields actually changed.

## Drizzle Conventions

- Use `eq`, `and`, `or`, `isNull` from `drizzle-orm` for query conditions — never concatenate raw SQL strings.

## Route Architecture

Donation routes are defined in `src/api/donation/routes/custom-donation-routes.ts` (not inside the plugin) to keep `/api/*` URLs. The API controller is a thin proxy; real logic is in the plugin controller.
