# Anneta Targalt

This is the code for the Anneta Targalt donation platform that runs at https://annetatargalt.ee/.

- **Backend**: [Strapi v5](https://strapi.io/) (TypeScript) in `/backend`, on port 1337. Besides the content, it takes donations, which it keeps in a database of their own (Drizzle ORM).
- **Site**: [Next.js 16](https://nextjs.org/) and [Tailwind CSS 4](https://tailwindcss.com/) in `/frontend`, on port 3000
- **Admin panel**: Next.js 16 with Tailwind CSS 4 and shadcn/ui in `/admin`, on port 3001, for the team's work with donations

[AGENTS.md](AGENTS.md) and the guides it links to describe how the code is organised and the conventions it follows. They're written for coding agents, but they're the best introduction for people too.

## Setup

You need Node.js 24, PostgreSQL 16 or newer (with its command-line tools: `psql`, `pg_dump`, `createdb`) and pnpm. `corepack enable` provides the pnpm version pinned in `package.json`. Node.js 25 and newer don't come with corepack: install it first with `npm install -g corepack`.

On macOS with Homebrew's `postgresql@17`, its command-line tools aren't on your `PATH` until you run `brew link --force postgresql@17`.

1\. Clone the repository and install the dependencies of all three apps:

```
git clone https://github.com/eaeesti/annetatargalt.git
cd annetatargalt
pnpm install:all
```

Installing also turns on a pre-commit hook (`.githooks/pre-commit`) that checks the formatting, and runs the lint, type check and tests of each app a commit changes.

2\. In `backend`, copy `.env.example` to `.env` and fill it in:

- `APP_KEYS`: four keys, each from `openssl rand -base64 16`, separated by commas
- `API_TOKEN_SALT`, `ADMIN_JWT_SECRET`, `TRANSFER_TOKEN_SALT`, `JWT_SECRET`, `ENCRYPTION_KEY`: one key each, from `openssl rand -base64 16`
- `DATABASE_*`: how to reach your Postgres (with Homebrew's, `DATABASE_USERNAME` is your Mac username and `DATABASE_PASSWORD` is empty). `DATABASE_NAME` is the database for Strapi's content and `DRIZZLE_DATABASE_NAME` the one for donations; the next step creates both.
- The Cloudinary keys are only needed to upload images. The content's images are on Cloudinary already and show without them.
- The Montonio keys are needed to try a donation through to the bank. Use the sandbox's (`MONTONIO_URL` already points at it).
- Leave the email (`SMTP_*`) settings as they are unless you're working on emails: with real ones, the backend really sends every email it makes, to whoever it's addressed to.

3\. Create the databases, with the site's content in them. Ask a maintainer for a content snapshot: a copy of the production content without anything private (no messages, accounts or keys, and no donations). Then:

```
cd backend
pnpm snapshot:load ~/Downloads/content-snapshot-….sql.gz
```

This creates both databases and the donations database's tables. If a database by that name already exists, it's kept under another name. You can run it again whenever you want newer content: stop Strapi first.

To start without content instead, create both databases (`createdb <name>`) and run `pnpm db:migrate` for the donations database's tables. The site has no pages then until you make some.

4\. Start all three apps from the repository's root:

```
pnpm dev
```

5\. Open http://localhost:1337/admin and register. The first account is a Super Admin. On its first start, Strapi writes the site's API token into `frontend/.env`, creating the file if needed, so the site at http://localhost:3000 can read the content.

6\. The admin panel at http://localhost:3001 takes the email and password of your Strapi account. It needs no settings of its own locally; see [admin/README.md](admin/README.md).

### While you work

- `pnpm dev` reloads each app when you save a file, with one exception: the backend's two plugins (`backend/src/plugins/`) run from the built code, so a change to them, or to anything they import, takes effect only after `pnpm build` in `backend` and a restart.
- The site's types for Strapi's content (`frontend/src/types/generated/strapi.ts`) are generated from the backend's schemas every time the backend starts or builds.
- `pnpm check` in the root runs every check the pre-commit hook does, for all three apps, and `pnpm format` formats everything. Every pull request runs the same checks on GitHub, and the backend's integration tests and the end-to-end tests too.
- `pnpm test:e2e` runs the end-to-end tests: all three apps, built and started with test content and stand-ins for Montonio and email, used through a browser. See [e2e/README.md](e2e/README.md).

### Making a content snapshot

For maintainers. In `backend`:

```
pnpm snapshot:make
```

This makes one from your own Strapi database, so the content is as new as your copy of it. To make one from production's content instead, give it a plain-SQL dump of the production Strapi database, made with `pg_dump --no-owner --no-privileges` (gzipped or not): `pnpm snapshot:make <dump.sql.gz>`.

Either way it loads the content into a scratch database next to yours, removes what's private, checks that it's gone, and writes `content-snapshot-<date>.sql.gz`. What it removes is listed at the top of `backend/scripts/content-snapshot.mjs`. Delete a production dump afterwards, and share the snapshot only with people working on the site: it includes drafts that aren't published yet.
