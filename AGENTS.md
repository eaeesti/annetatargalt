# Anneta Targalt — Agent Guide

Estonian donation platform. Monorepo: Next.js frontend (`frontend/`) + Strapi v5 backend (`backend/`).

Ports: Strapi **1337**, Next.js **3000**.

```bash
yarn develop          # starts both concurrently (from repo root)
cd frontend && yarn develop
cd backend && yarn develop
```

See [backend/AGENTS.md](backend/AGENTS.md) and [frontend/AGENTS.md](frontend/AGENTS.md) for subsystem-specific guidance.

## TypeScript Conventions

These apply to both frontend and backend.

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
