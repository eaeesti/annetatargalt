# Admin Panel

Internal dashboard for looking at Anneta Targalt donation data. Built with
Next.js (App Router), TypeScript and Tailwind 4. Data comes from the Strapi
backend in `../backend`.

## Getting Started

```bash
pnpm install
pnpm dev        # http://localhost:3001
```

You need the backend running as well. Running `pnpm dev` from the repo root
starts the frontend, backend and admin in one go.

## Environment

Create `.env.local`:

| Variable                  | Purpose                                                     |
| ------------------------- | ----------------------------------------------------------- |
| `STRAPI_URL`              | Strapi backend URL, e.g. `http://localhost:1337`            |
| `GOOGLE_CLIENT_ID`        | Google OAuth client ID for sign-in                          |
| `GOOGLE_CLIENT_SECRET`    | Google OAuth client secret                                  |
| `GOOGLE_WORKSPACE_DOMAIN` | Only accounts from this Google Workspace domain can sign in |

## Layout

```
app/
  login/          Google sign-in page
  api/            route handlers (auth, exports, calls to Strapi)
  (dashboard)/    pages behind sign-in, sharing one layout and sidebar
    page.tsx      overview with summary cards and charts
    donations/  donors/  recurring-donations/  organizations/
    transfers/  transactions/  statement/
components/       shared components (shadcn primitives are in ui/)
lib/              Strapi client (api.ts), auth, formatting helpers
```

## Conventions

This app is set up a bit differently from `../frontend`: there's no `src/`
folder, and file names are kebab-case (`filter-builder.tsx`). If a component is
only used by one route, put it in that route's `_components/` folder. The shared
TypeScript rules are in the root [AGENTS.md](../AGENTS.md).

The `@/*` alias points at the app root, but most of the code uses relative
imports. Match whatever the file you're editing already does.

```bash
pnpm lint       # oxlint
pnpm build      # production build
```
