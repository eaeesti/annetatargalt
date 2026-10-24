# Anneta Targalt — Agent Guide

Estonian donation platform. Monorepo with three apps: the public Next.js site (`frontend/`), the Strapi v5 backend (`backend/`) and the Next.js admin panel (`admin/`).

Ports: Strapi **1337**, frontend **3000**, admin **3001**.

```bash
pnpm dev              # starts all three concurrently (from repo root)
cd frontend && pnpm dev
cd backend && pnpm dev
cd admin && pnpm dev
pnpm format           # oxfmt, every app at once (from repo root)
```

Each app has `pnpm lint` (oxlint), which enforces the `any` and `!` rules below.

See [backend/AGENTS.md](backend/AGENTS.md) and [frontend/AGENTS.md](frontend/AGENTS.md) for subsystem-specific guidance. `admin/` doesn't have its own guide yet, see [admin/README.md](admin/README.md). Unlike `frontend/`, it has no `src/` folder (routes are in `app/`) and file names are kebab-case.

## TypeScript Conventions

These apply to all three apps.

- Never use `any` or `as any` — use `unknown` and narrow the type, or define a proper interface.
- Never use `!` (non-null assertion) — always handle nulls explicitly with a guard or fallback.
- Don't use `== null` (or any `==`/`!=`) to check for null/undefined — use truthiness or `typeof x === "number"` etc. oxlint's `eqeqeq` enforces it.
- Use camelCase for variable names.
- **Let TypeScript infer types** — avoid explicit type annotations where the type is already inferrable. Arrow function parameters especially should not have explicit types when inferable from context:
  ```ts
  // Good — type inferred from the array
  people.every((p) => p.name === name);
  // Bad — unnecessary annotation
  people.every((p: Person) => p.name === name);
  ```
- If you find yourself needing to annotate a callback parameter, that's a signal the source data structure lacks proper typing — fix the source type instead.
- No `as SomeType` assertions, not just `as any` — they silence the compiler the same way. Prefer type guards or narrowing. oxlint enforces this (`as const` is fine; generated shadcn components are exempt).
- Data from outside — request bodies, query strings, other services' replies, browser storage — is read as `unknown` and checked before use (`backend/src/utils/narrow.ts` has `isRecord` and `oneOf`).
- Data from our own systems is typed in one place per app, instead of a cast at every call: `readJson` (admin, for our backend's JSON), `fetchAPI` / `readStrapiJson` (frontend, for Strapi), and in the backend Drizzle's `execute<Row>()` for raw SQL and `src/strapi-internals.ts` for Strapi's own tables and services.
- `Object.keys(obj)` returns `string[]`, not `(keyof typeof obj)[]` — cast explicitly or restructure to avoid the issue.
