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

`strapi` is a globally declared constant (via `types/strapi-global.d.ts`) — no cast needed:
```ts
// From API proxy controllers:
strapi.plugin("donations").controller("donation").methodName(ctx)
// Services:
strapi.plugin("donations").service("donation").methodName(args)
```

## TypeScript Conventions

See root [AGENTS.md](../AGENTS.md) for shared conventions. Backend-specific additions:

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
