# Admin Panel

The team's dashboard for Anneta Targalt's donations: the donations, donors and
recurring donations, the transfers to organizations, the bank statement and
the emails to donors. Built with Next.js (App Router), TypeScript and
Tailwind 4. Data comes from the Strapi backend in `../backend`.

## Getting Started

```bash
pnpm install
pnpm dev        # http://localhost:3001
```

You need the backend running as well. Running `pnpm dev` from the repo root
starts the frontend, backend and admin in one go.

## Environment

Locally it needs no settings: it finds the backend at `http://localhost:1337`,
and you sign in with the email and password of your Strapi admin account.
Settings go in `.env.local`:

| Variable                  | Purpose                                                     |
| ------------------------- | ----------------------------------------------------------- |
| `STRAPI_URL`              | Strapi backend URL, `http://localhost:1337` if unset        |
| `GOOGLE_CLIENT_ID`        | Google OAuth client ID for sign-in                          |
| `GOOGLE_CLIENT_SECRET`    | Google OAuth client secret                                  |
| `GOOGLE_WORKSPACE_DOMAIN` | Only accounts from this Google Workspace domain can sign in |

With the three Google settings, signing in is with Google only, and passwords
are turned off.

## Layout

```
app/
  login/          Google sign-in page
  api/            route handlers (auth, exports, calls to Strapi)
  (dashboard)/    pages behind sign-in, sharing one layout and sidebar
    page.tsx      overview with summary cards and charts
    donations/  donors/  recurring-donations/  organizations/
    transfers/  transactions/  statement/  emails/
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
