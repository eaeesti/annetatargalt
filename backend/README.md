# Backend

Strapi v5 in TypeScript: the site's content, and the donations, which are kept
in a database of their own with Drizzle ORM. See the repository's
[README](../README.md) to set it up and [AGENTS.md](AGENTS.md) for how the code
is organised.

```bash
pnpm dev              # Strapi on http://localhost:1337, reloading on changes
pnpm build            # needed for changes to src/plugins/ to take effect
pnpm check            # lint, type check and unit tests
pnpm test:integration # the repositories' tests against a real database (see src/db/repositories/__tests__)
pnpm db:migrate       # apply the donations database's migrations
pnpm db:generate      # a migration from changes to src/db/schema.ts
pnpm snapshot:load    # load a content snapshot (see the repository's README)
pnpm snapshot:make    # make one from a production dump
```
