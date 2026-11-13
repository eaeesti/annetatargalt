# Backend — Agent Guide

Strapi v5 + TypeScript. Source in `src/`, compiled to `dist/`. Always edit `src/`.

```bash
pnpm dev              # compile + start dev server
pnpm type-check       # must pass (strict mode)
pnpm lint             # oxlint
pnpm test:unit        # Vitest unit tests
pnpm test:integration # requires .env.test with DB credentials
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
strapi.plugin("donations").controller("donation").methodName(ctx);
// Services:
strapi.plugin("donations").service("donation").methodName(args);
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
- An image on the site is an `elements.image` component (file, `alt`, `decorative`), not a bare `media` field: its description belongs to where it's used, in that language. Saving one with a file but no description and no `decorative` tick is refused (`src/image-fields.ts`), except for share images. Bare media is only for things nobody reads, like favicons.
- **Strapi admin login with Google**: once the backend has its own Google client's ID and secret (a separate client from the donation admin panel's) and the Workspace's domain, `src/middlewares/google-login.ts` logs admin users in with their Workspace account (`/google-login`), creating the same session Strapi's own login does, and refuses the admin's password routes (`/admin/login`, `register`, `register-admin`, `reset-password`, `forgot-password`) for everyone, matched as Strapi's router matches them, ignoring case and a trailing slash. It relies on Strapi's session manager and its default admin cookie names; check it after Strapi upgrades. The login page's button, in place of the password form, is added to the DOM by `src/admin/google-login.ts`, since Strapi has no slot for it.
- Every field of a localized content type needs its own `pluginOptions.i18n.localized` (`true`, or `false` for a field shared between languages). Strapi treats an unmarked field as shared and copies it onto every language on save.

## Drizzle Conventions

- Use `eq`, `and`, `or`, `isNull` from `drizzle-orm` for query conditions — never concatenate raw SQL strings.

## Route Architecture

Donation routes are defined in `src/api/donation/routes/custom-donation-routes.ts` (not inside the plugin) to keep `/api/*` URLs. The API controller is a thin proxy; real logic is in the plugin controller.
