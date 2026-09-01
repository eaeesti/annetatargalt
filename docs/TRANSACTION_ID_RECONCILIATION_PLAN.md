# Transaction IDs & Bank Reconciliation

Add a bank **transaction ID** (LHV "Arhiveerimistunnus" / _Archiving code_) to every
donation, so donations can be matched against bank statement exports. Matching is
mostly automatic, with a manual path for the tricky cases.

This replaces the ad-hoc Python workflow in the private `Donations/` repo
(`match_donations_to_lhv_transactions.py`, `import_lhv_donations.py`,
`import_single_transaction.py`).

## Background

- Every finalized donation corresponds to exactly one incoming bank transaction.
  (One transaction can cover **many** donations — Montonio batch payouts, family
  transfers — so the transaction ID is **not unique** on donations.)
- The archiving code is 16 digits — `YYYYMMDD` + 8 more, assigned by the bank.
  We never generate it; it comes from the CSV export.
- Montonio payouts land in the bank days after the donation, so the ID is not
  known at donation time → the column is **nullable**.
- Bank CSV (LHV, Estonian headers) columns of interest:
  `Kuupäev`, `Summa`, `Arhiveerimistunnus`, `Selgitus`, `Deebet/Kreedit (D/C)`,
  `Isikukood või registrikood`, `Saaja/maksja konto`.
- `Selgitus` for platform payments contains `Anneta Targalt annetus <donationId>`
  (from Montonio `merchantReference`). Donor-initiated transfers and recurring
  standing orders have no ID in `Selgitus`.

## Public / private split

This repo is public. No donor data enters it.

| Piece                                             | Location                                          | Contains data? |
| ------------------------------------------------- | ------------------------------------------------- | -------------- |
| `transaction_id` column + migration               | this repo                                         | no             |
| Matching engine (pure functions)                  | this repo — `backend/src/utils/reconciliation.ts` | no             |
| Reconcile service + admin endpoints + UI          | this repo                                         | no             |
| Backfill script (`dist/src/scripts/reconcile.js`) | this repo, compiled                               | no             |
| Bank CSV exports                                  | private (`Donations/` repo / VPS)                 | **yes**        |
| `overrides.csv` (manual matches)                  | private (`Donations/` repo / VPS)                 | **yes**        |

The backfill **script** is public code that takes file paths as arguments; the
**files** it reads are private and live only on the VPS.

---

# Phase 1 — Schema, engine, backfill, surfacing

## 1.1 Schema + migration

`backend/src/db/schema.ts`, `donations` table:

```ts
transactionId: varchar("transaction_id", { length: 20 }),
transactionMatchSource: varchar("transaction_match_source", { length: 24 }),
// 'selgitus-id' | 'idcode-amount-date' | 'manual' | null
```

Plus an index: `index("donations_transaction_id_idx").on(table.transactionId)`.

**Status: done.** `drizzle.config.js` `schema` fixed from `./src/db/schema.js`
(never existed in source) to `./src/db/schema.ts` — drizzle-kit reads TS directly.
`0003_donation_transaction_id.sql` generated + `meta/0003_snapshot.json` +
`_journal.json` entry:

```sql
ALTER TABLE "donations" ADD COLUMN "transaction_id" varchar(20);
ALTER TABLE "donations" ADD COLUMN "transaction_match_source" varchar(24);
CREATE INDEX "donations_transaction_id_idx" ON "donations" USING btree ("transaction_id");
```

No data backfill in the migration — that is the script in 1.4.

### How migrations reach production

`backend/deploy-local.sh` (gitignored, run from a dev machine) step 6:

```bash
ssh $VPS "cd ~/annetatargalt/backend && npx drizzle-kit migrate"
```

i.e. after `git pull` on the VPS and before the PM2 reload. `drizzle-kit migrate`
reads `meta/_journal.json`, applies any `.sql` whose tag is not yet recorded in
the `drizzle.__drizzle_migrations` table, and records it. `drizzle.config.js`
reads `process.env` with defaults (`localhost` / `strapi` / `annetatargalt_donations`);
those defaults must match the VPS Postgres or the deploy step needs the env
loaded.

### The `0002` inconsistency — fixed

`meta/_journal.json` listed only `0000` and `0001`, but `0002_admin_audit_log.sql`
existed on disk hand-written (no snapshot, no journal entry) while
`admin_audit_log` was already in `schema.ts`. `drizzle-kit generate` would have
diffed against `0001` and emitted a migration re-creating `admin_audit_log`.

**Done:**

1. Regenerated `0002_admin_audit_log.sql` via `drizzle-kit generate` from the
   `main` schema state → proper `0002_snapshot.json` + journal entry. DDL is the
   same `CREATE TABLE` as the hand-written one, plus a stray
   `ALTER TABLE "recurring_donations" ALTER COLUMN "active" SET DEFAULT false`
   (pre-existing schema drift never captured in a migration; harmless, idempotent).
2. Changed its `CREATE TABLE` → `CREATE TABLE IF NOT EXISTS` so it is a no-op
   where the table already exists.
3. Generated `0003` on top.

**Verified** on throwaway databases:

- fresh DB: `0000→0003` applies clean; re-running `migrate` is a no-op.
- DB with `admin_audit_log` pre-created out-of-band (simulating a `push`-applied
  prod) + only `0000/0001` in `__drizzle_migrations`: full `migrate` applies
  `0002` (no-op via `IF NOT EXISTS`) + `0003`, ends with 4 tracked migrations.
- `migrate` does **not** need the schema file, so it has been functional on the
  VPS regardless of the old `.js` path.

**Residual risk (needs one prod check):** if the VPS
`drizzle.__drizzle_migrations` does _not_ already contain `0000`/`0001` (whole
schema applied via `push`, `migrate` never recorded a baseline), the next
`migrate` will try `0000` from scratch and fail on existing tables. This would
already be breaking every deploy since 2026-03-29, so it is very unlikely — but
confirm before deploying:

```sql
SELECT hash, created_at FROM drizzle.__drizzle_migrations ORDER BY created_at;
```

Expect ≥ 2 rows. If the table is missing or empty, baseline it by inserting rows
for `0000`/`0001`/`0002` (hashes = sha256 of each `.sql` file's contents) before
deploying, so `migrate` only runs `0003`.

## 1.2 Matching engine — `backend/src/utils/reconciliation.ts`

**Status: done.** Pure, no DB access, no `strapi`; `csv-parse` dependency added.
Port of `match_donations_to_lhv_transactions.py`. 19 unit tests
(`src/utils/__tests__/reconciliation.test.ts`, synthetic fixtures only).

Sanity check against the real private CSV + `full_data_2026-05-11.json` +
`known_transactions_map` (cutoff 2026-04-18): 1559 / 1560 finalized donations
matched (manual 151, selgitus-id 15, idcode-amount-date 1393), 0 ambiguous,
1 transactionless, 237 donationless credit rows (recurring standing orders not in
that export + non-platform income). Reproduces the script.

```ts
export type MatchSource = "selgitus-id" | "idcode-amount-date" | "manual";

export interface BankTransaction {
  date: string; // YYYY-MM-DD
  amountCents: number;
  archivingCode: string; // Arhiveerimistunnus
  description: string; // Selgitus
  idOrRegCode: string; // Isikukood või registrikood
  counterpartyAccount: string;
  direction: "D" | "C";
}

export interface ReconcilableDonation {
  id: number;
  amountCents: number;
  datetime: string;
  companyCode: string | null;
  donorIdCode: string | null;
}

export interface ReconciliationReport {
  matched: { donationId: number; archivingCode: string; source: MatchSource }[];
  ambiguous: { donationId: number; candidateCodes: string[] }[];
  donationlessTransactions: BankTransaction[];
  transactionlessDonations: number[];
}

export function parseLhvCsv(input: string | Buffer): BankTransaction[];

export function matchDonations(
  transactions: BankTransaction[],
  donations: ReconcilableDonation[],
  overrides: Map<number, string>,
): ReconciliationReport;
```

**Parsing** (`parseLhvCsv`)

- Accepts LHV Estonian headers (canonical) and the English export via a
  header-alias map; validates the required columns are present.
- Returns every row; `matchDonations` filters to `direction === "C"` with a
  non-empty archiving code (drops bank-generated lines like `Saadud intress`).
- `Summa` → cents; handles both `15.00` and `1 234,56`.

**Matching** (`matchDonations`), per donation, first hit wins:

1. **`manual`** — `overrides.get(donation.id)` → use that archiving code directly.
2. **`selgitus-id`** — a transaction whose `Selgitus` matches
   `/Anneta Targalt annetus (\d+)/` with the captured id `=== donation.id` and
   `amountCents` equal (±1 cent).
3. **`idcode-amount-date`** — transaction(s) where
   `idOrRegCode === donorIdCode` **or**
   (`idOrRegCode === companyCode` and `companyCode` non-empty), `amountCents`
   equal, and `0 ≤ (txnDate − donationDate) ≤ 4` days.
   - exactly one → matched
   - more than one → `ambiguous`
   - zero → `transactionlessDonations`

`donationlessTransactions` = credit transactions not referenced by any match.

Batch case falls out naturally: several donations resolve (via `selgitus-id` or
`manual`) to the same `archivingCode`.

**Tests** — `backend/src/utils/__tests__/reconciliation.test.ts`, synthetic
fixtures only:

- each strategy in isolation
- `selgitus-id` beats `idcode-amount-date`
- batch: 3 donations → 1 archiving code
- ambiguity: 2 candidate transactions same day/amount/idCode
- date window boundaries (0, 4, 5 days; negative)
- English-header CSV parses identically
- debit rows ignored

## 1.3 Repository methods

**Status: done.** `backend/src/db/repositories/donations.repository.ts`:

```ts
findForReconciliation(): Promise<ReconcilableDonation[]>   // finalized, donor idCode joined
findReconciledIds(): Promise<Set<number>>                  // ids with a transaction_id
setTransactionId(id, code, source): Promise<void>
setTransactionIds(rows): Promise<void>                     // one transaction
```

Plus `findWithFilters` gains `transactionId` (exact) + `hasTransactionId` (bool)
filters and a `transactionId` sort column. 4 integration tests added to
`donations.repository.test.ts`.

The orchestration layer the plan first sketched
(`services/reconciliation.ts` `buildReport`/`applyReport`) is deferred to
Phase 2 — the backfill script (1.4) inlines that logic and Phase 2's admin
endpoint needs a superset of it anyway (recurring-donation detection).

## 1.4 Backfill script — `backend/src/scripts/reconcile.ts`

**Status: done.** Compiles to `dist/src/scripts/reconcile.js`;
`yarn reconcile` wraps it with `dotenv -e .env`.

```bash
yarn reconcile <bank.csv> [overrides.csv] [--apply] [--force]
```

- `<bank.csv>` — an LHV export (private file, kept out of this repo)
- `[overrides.csv]` — header row + `donation_id,archiving_code[,note]`; optional,
  private; derived from the old `known_transactions_map`
- default: **dry run** — prints matched counts by source, and full lists of
  `ambiguous`, `transactionlessDonations`, `donationlessTransactions`
- `--apply` — writes `transaction_id` + `transaction_match_source` for `matched`,
  in one transaction
- `--force` — also overwrite donations that already have a `transaction_id`
  (default: skip them, so re-runs are idempotent)

Uses the Drizzle client directly (`backend/src/db/client.ts`). Verified end-to-end
on a scratch DB: dry-run writes nothing, apply sets all three sources correctly,
re-run skips already-reconciled, debit rows ignored, orphans reported.

**Backfill procedure**

1. `git pull && yarn build` on the VPS (or run against a copy of prod).
2. Put the latest full LHV export + `overrides.csv` on the box (not in git).
3. `yarn reconcile export.csv overrides.csv` — inspect `ambiguous` +
   `transactionlessDonations`.
4. Resolve each by appending a row to `overrides.csv`.
5. Repeat 3–4 until only expected leftovers remain (very recent Montonio payouts
   not yet in the statement).
6. `yarn reconcile export.csv overrides.csv --apply`.

## 1.5 Admin panel surfacing

**Status: done.**

- `donations.repository.ts` `findWithFilters` — `transactionId` (exact) +
  `hasTransactionId` (bool) filters, `transactionId` sort column.
- `admin-panel` donation controller — `transactionId` in `VALID_SORT_COLS`,
  parses `transactionId` / `hasTransactionId` query params.
- `admin/app/(dashboard)/donations/_components/donations-table.tsx` —
  `transactionId` + `transactionMatchSource` on `DonationRow`; a sortable
  "Transaction ID" column (mono, match source on hover); a text filter and a
  "Reconciled" boolean filter.
- `donations/[id]/page.tsx` — "Transaction ID" field with match source, or
  "Not reconciled".
- `donations/page.tsx` — passes the two new params through.

Exports (`donation.export()` service, admin CSV) pick up the fields automatically
since they spread the row.

---

# Phase 2 — CSV import in the admin panel

Replace `import_lhv_donations.py`. One CSV upload does two jobs:

1. assign archiving codes to existing donations (reconciliation)
2. create finalized donations for **recurring bank transfers** not yet in the DB

## 2.1 Endpoints — `admin-panel` plugin (first write paths)

`backend/src/plugins/admin-panel/server/routes/reconciliation.ts`
(`content-api`, `DonationAdmin`-gated, audit-logged):

### `POST /admin-panel/reconciliation/preview`

Multipart CSV upload. Returns:

```jsonc
{
  "matched": [
    { "donationId": 1337, "archivingCode": "...", "source": "selgitus-id" },
  ],
  "ambiguous": [
    {
      "donationId": 42,
      "candidates": [
        /* transaction rows */
      ],
    },
  ],
  "newRecurringDonations": [
    {
      "transaction": {
        /* row */
      },
      "donorId": 12,
      "recurringDonationId": 5,
      "amountCents": 3000,
      "date": "2026-01-15",
    },
  ],
  "donationlessTransactions": [
    /* rows, minus the newRecurring ones */
  ],
  "transactionlessDonations": [
    { "id": 99, "date": "...", "amountCents": 3000, "donor": "..." },
  ],
}
```

`newRecurringDonations` detection reuses the logic from
`donation.service` `insertFromTransaction` / `findTransactionDonation`:
credit transaction whose `idOrRegCode` matches a donor with an active recurring
template, no existing donation for that date/amount, template datetime on or
before the transaction date.

### `POST /admin-panel/reconciliation/apply`

```jsonc
{
  "assignments": [{ "donationId": 1337, "archivingCode": "..." }],
  "createDonations": [
    {
      "transactionArchivingCode": "...",
      "recurringDonationId": 5,
      "idCode": "...",
      "amountCents": 3000,
      "date": "...",
      "iban": "...",
    },
  ],
}
```

- assignments → `donationsRepository.setTransactionId(..., 'manual')`
  (operator-confirmed ⇒ `manual`; keep the engine's source only for
  untouched auto-matches)
- createDonations → extend
  `donation.service.insertFromTransaction` to accept and store
  `transactionId`, then call it per row

Config: raise `multipart`/`formLimit` for these two routes (default 1 MB; the
full statement is ~300 KB today but grows).

`id_code_replacement_map` (from `import_lhv_donations.py`) becomes a config
value, not a hardcode.

## 2.2 Admin UI — `admin/app/(dashboard)/reconciliation/`

- **Upload** page → POSTs to `preview`.
- **Review** screen:
  - _Proposed matches_ — table, accept / reject / edit archiving code per row
  - _Ambiguous_ — pick the correct transaction from candidates
  - _New recurring donations_ — checkbox list; shows donor, amount, date,
    target template
  - _Unmatched_ (both directions) — informational, exportable to CSV
  - **Apply** → POSTs to `apply`, shows a result summary
- Nav entry in `admin/app/(dashboard)/layout.tsx`.

## 2.3 Retire the Python scripts

Once 2.2 is in use, delete from the private `Donations/` repo:
`match_donations_to_lhv_transactions.py`, `import_lhv_donations.py`,
`import_single_transaction.py`. Monthly flow becomes: export CSV from LHV →
upload → review → apply.

---

# Decisions locked in

- `transaction_id` is nullable permanently (Montonio payouts lag; corrections).
- `transaction_id` is **not** unique (batch payouts).
- Canonical CSV input = LHV Estonian headers; English export also accepted.
- New dependency: `csv-parse` (backend).
- Backfill writes directly to Postgres via the Drizzle client on the VPS; the
  admin endpoints are for the ongoing monthly flow.
- Operator-confirmed matches in the UI are stored as `source = 'manual'`.

# Open questions

- One-time prod check (see 1.1): does `admin_audit_log` exist and is `0002` in
  `drizzle.__drizzle_migrations`? Determines nothing about the code — the
  `IF NOT EXISTS` guard covers both — but good to confirm before deploying.
- `overrides.csv`: caller's choice; the script only needs a path. Default to
  keeping it in the private `Donations/` repo alongside the bank exports.
- Phase 2 `apply`: create the missing recurring donations and reconcile in one
  request, or two explicit operator steps? (Leaning: one request, one summary.)
