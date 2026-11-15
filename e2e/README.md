# End-to-end tests

Playwright tests that use the site, the admin panel and Strapi's admin the way people do: a donation from the form through the bank to the thank-you page and the confirmation email, the contact form, email settings, statement import, transfer rounds, newsletters and so on.

They run against a stack of their own, which `pnpm test` starts and stops:

- **Postgres**: two databases, `annetatargalt_e2e_strapi` and `annetatargalt_e2e_donations`, made anew on every start, on the Postgres the `PG*` variables name (as for `psql`). Your own databases aren't touched.
- **Backend** on port 1347: built, its donations tables migrated, and filled by `stack/seed.mjs` with the made-up content in `stack/content.ts`. It reads none of `backend/.env`; `stack/config.ts` sets everything it needs.
- **Site** on 3047 and **admin panel** on 3048: built and started as in production.
- **Fakes** on 4047 (`stack/fakes.ts`): Montonio, whose payment page is a "bank" with two buttons, and a mail server that keeps every email for the tests to read. Nothing leaves your machine.

## Running them

Once, after `pnpm install:all` in the repository's root:

```
cd e2e
pnpm exec playwright install chromium
```

Then, with `pnpm dev` stopped (the tests build the apps into the same folders it uses):

```
PGUSER=<you> PGPASSWORD=<password> pnpm test
```

Leave out `PGUSER` and `PGPASSWORD` if `psql` works without them. A run takes a few minutes, most of it building. `pnpm report` shows the last run's report.

While you work on the tests, `pnpm test:ui` opens Playwright's window, which keeps the stack running while it's open: run tests one by one and watch them, in seconds. After a build, `E2E_SKIP_BUILD=1` in front of either command starts the stack without building again.

Everything a run makes, logs and results included, is in `.state/`.

## Writing tests

- Find things the way people do, by role and name: `page.getByRole("button", { name: "Next button text" })`. Fields the seed doesn't set get their own name in words ("nextButtonText" becomes "Next button text"), so those texts are what the tests look for. Texts that matter are in `TEXT` in `stack/content.ts`.
- Tests run in parallel against one stack, and a run's data stays until the next start. Give each test its own donor: `uniqueEmail()`, `idCode()` and names that won't repeat.
- `helpers/api.ts` makes a paid donation without the browser, for tests that need one to exist. `helpers/fakes.ts` reads the fake mail server and Montonio's orders.
- Strapi lets one address sign in only a few times in a few minutes, so the admin panel's tests share one session (`tests/admin/sign-in.setup.ts`), and a test that signs in itself has an admin of its own in `ADMINS` in `stack/config.ts`.
- Every name in the content and the tests is made up. Don't use a real organization's or person's.
