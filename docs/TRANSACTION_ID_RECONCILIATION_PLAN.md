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

# Phase 2 — Statement import in the admin panel

Replaces `import_lhv_donations.py` **and** `match_donations_to_lhv_transactions.py`.
The primary job is **keeping the donation ledger current** — most of a monthly
statement is recurring bank payments with no donation record yet (as of the
backfill: ~150 payments / 4 months of backlog, dashboard stats stale). Assigning
transaction IDs rides along.

**Status: built, not yet deployed.** Commits `f6d5c1e`, `7554d14`, `bcdff3d`,
`7b8d8de`. Routing verified (403/404); service smoke-tested end-to-end against a
scratch DB (preview + apply + idempotent re-run); 98 unit tests. Not yet
exercised over HTTP with a real token, and the Montonio payouts API is coded but
unverified against the live merchant account.

**Before deploy:**

- migration `0004` applies (`ignored_bank_transactions`) — same
  `drizzle-kit migrate` step; `CREATE TABLE IF NOT EXISTS`
- `MONTONIO_STORE_UUID` in the VPS `.env` (card-payout auto-resolve is off
  without it — manual entry still works)
- re-check `drizzle.__drizzle_migrations` count goes 4 → 5
- verify the Montonio payouts endpoints accept the existing key pair; if not,
  card payouts stay manual and that's fine for v1
- first real run clears the recurring backlog and updates the dashboard

## 2.0 What the categoriser does

Parse the uploaded LHV CSV. For every credit line with an archiving code, in
order:

1. **already done** — some donation already has this `transaction_id`, or the
   code is in the ignore list → count only, no action.
2. **reconcile to existing donation** — the `matchDonations` engine (Phase 1.2)
   finds exactly one still-unreconciled donation (`selgitus-id` or
   `idcode-amount-date`) → propose assigning the code.
3. **recurring import** — sender `idOrRegCode` matches a donor
   (`donor.idCode`, or a recurring template's `companyCode`) who has a template
   dated on/before the transaction → propose **creating** a finalized donation
   from that template (amount from the payment, org split scaled — see 2.1).
4. **card payout** — counterparty is Montonio / "Card payout …" / "STRIPE …
   MONTONIO FINANCE" → resolve via the Montonio payouts API (2.2); assign the
   code to every donation in the payout. Manual checklist fallback.
5. **needs a decision** — donation-like `Selgitus` but no donor/template match
   (new donor, unusual company) → **list only, no action** (handled
   exceptionally, outside this tool).
6. **not a donation** — everything else (interest, refunds, internal transfers)
   → offer to add to the ignore list.

## 2.1 Recurring import — mirror of `insertFromTransaction`

Per [insertFromTransaction](../backend/src/plugins/donations/server/services/donation.ts):

- donor via `donor.findDonor(idOrRegCode)` (idCode, then recurring
  `companyCode`)
- templates via `recurringDonationsRepository.findByDonorId` (newest first);
  pick the **first with `datetime <= transactionDate + 24h`**
- new donation: `amount` = payment, `finalized: true`,
  `companyName/companyCode` + `paymentMethod` (= `bank`) from the template,
  `iban` = counterparty account, `transactionId` = archiving code,
  `transactionMatchSource = 'recurring-import'`
- org split: template's `organizationRecurringDonations` scaled by
  `payment / template.amount` via `resizeOrganizationDonations` (rounding
  fixup). **No operator adjustment** — amount drift (~25% of donors) is handled
  by the proportional scale, same as the Python script does today.
- ambiguity (donor has 2+ candidate templates, no template predates) → surfaces
  in "needs a decision", not auto-created.

New `transaction_match_source` value: `'recurring-import'` (alongside
`selgitus-id | idcode-amount-date | manual`).

## 2.2 Montonio payouts client — `backend/src/utils/montonio.ts`

- `GET {MONTONIO_URL}/stores/:storeUuid/payouts?limit&offset&order` — list
- `GET …/payouts/:payoutUuid/export-json` — returns a download URL; fetch it for
  the order list (each `merchantReference` = `<prefix> <donationId>`)
- auth: JWT signed with `MONTONIO_PRIVATE`, `Authorization: Bearer <jwt>` (GET)
- needs `MONTONIO_STORE_UUID` in config (new)

**Spike first** — confirm the existing creds authorise these endpoints and the
export contains merchant references. If not, section 4 stays a manual checklist
(sum candidate card donations vs `payout / (1 - feeRate)`).

The payout UUID is in the CSV `Selgitus` (`Card payout faab4de5-…`), often
truncated — match by UUID prefix, else by amount+date against the payouts list.

## 2.3 Ignore list

New table `ignored_bank_transactions` (`archiving_code` PK, `reason`,
`created_at`, `created_by`). Checked in step 1; populated from step 6. One-time
bulk seed for the current backlog of non-donation credits.

## 2.4 Endpoints — `admin-panel` plugin (first write paths)

`content-api`, `DonationAdmin`-gated, `auditLog`ged.

- `POST /admin-panel/statement/preview` — multipart CSV → the categorised
  report (all six buckets; buckets 1 + auto-2 collapsed to counts). No writes.
- `POST /admin-panel/statement/apply` — body: confirmed assignments, confirmed
  recurring-imports, confirmed ignores. Runs in one transaction, returns a
  summary. One click (per the locked decision).

Raise the route's `multipart` limit (statement ~0.5 MB, grows).
`id_code_replacement_map` → config value.

## 2.5 Admin UI — `admin/app/(dashboard)/statement/`

Upload (browser file-picker) → review page:

- **Recurring payments to import** — donor · paid · template · scaled org split ·
  `[import]`; "import all clean" bulk action
- **Card payouts** — per payout: amount, fee, resolved donations (or manual
  checklist with running total)
- **Needs a decision** — read-only list
- **Not a donation** — checkboxes → ignore
- **Auto-reconciled / already done** — counts
- **Apply** → `apply`, then a result summary

Nav entry in `admin/app/(dashboard)/layout.tsx`.

## 2.6 First run + retire the scripts

First real use clears the ~4-month backlog. Then delete from the private
`Donations/` repo: `match_donations_to_lhv_transactions.py`,
`import_lhv_donations.py`, `import_single_transaction.py`. `reconcile.ts` /
`yarn reconcile` stays for one-off DB-side fixes.

## Build order

1. Montonio payouts spike (verify creds + response shape)
2. Categoriser + recurring-import computation — pure, unit-tested
3. `ignored_bank_transactions` table + migration `0004`
4. `statement` service (preview) wiring DB + engine
5. `preview` / `apply` endpoints + routes
6. Admin UI
7. Card-payout resolution (Montonio client → categoriser)

---

---

# Phase 3 — Bank-transactions ledger & money-flow check

**Status: built, not yet deployed.** Adds a persistent `bank_transactions` table
(one row per statement credit line), FK-linked from `donations.transaction_id`,
plus a `/transactions` admin view and a money-flow summary.

## 3.1 Schema + migration `0006`

- `bank_transactions` — PK `archiving_code`; `date` / `amount` nullable (a blind
  ignore or a Phase-1 stub has no bank fields yet); `category`
  (`donation | card-payout | ignored | undecided`, default `undecided`);
  `gross_amount` / `fee_amount` (card payouts only); `note`, `imported_at/by`.
  Absorbs and drops `ignored_bank_transactions`.
- `donations.transaction_id` → real FK to `bank_transactions.archiving_code`
  (`ON DELETE/UPDATE NO ACTION`). `donations.processor_fee_cents` added
  (per-donation share of a card payout's fee).
- Migration backfills a stub row (`category='donation'`) for every existing
  `donations.transaction_id` **before** adding the FK, and copies the ignore
  list in. `IF NOT EXISTS` / guarded `ADD CONSTRAINT` — idempotent. Verified on a
  prod-DB copy: 1654 stub + 19 ignored rows, 0 FK orphans.
- `drizzle.__drizzle_migrations` 6 → 7.

## 3.2 Repository — `bank-transactions.repository.ts`

Replaces `ignored-bank-transactions.repository.ts`.

- `upsertMany(rows)` — idempotent; coalesces bank fields; `category` only ever
  rises in precedence (`donation > card-payout > ignored > undecided`), so a
  re-upload never un-ignores or un-links a code.
- `setCategory(code, …)` — reclassify; refuses to move off `donation` while
  finalized donations reference the code (→ 409).
- `findPaginated` — filter by category / date / text; computes
  `linkedDonationCount`, `allocatedCents`, `linkedGrossCents`, `balanced`.
- `moneyFlow({dateFrom,dateTo})` — `received` (Σ donation-category amount),
  `cardPayoutNet/Gross`, `cardFees` (Σ `fee_amount`), `cardFeesFromDonations`
  (Σ `processor_fee_cents`, cross-check), `allocated` / `transferred`
  (Σ org splits for linked donations), `undecidedInflow`,
  `unlinkedDonation{Count,Cents}` (finalized, no `transaction_id`),
  `discrepancy` = `allocated − (received + cardPayoutNet + cardFees)`.

## 3.3 Statement import — now writes the ledger

`categorizeStatement` returns `allCredits` (every deduped credit line) and
`counts.unrecorded`. `splitFeeProRata(fee, donations)` splits a payout fee
pro-rata by gross, remainder to the largest.

`apply` (reordered — `bank_transactions` upsert **first**, for the FK):

- one `upsertMany` over `allCredits`, category derived from what the operator
  confirmed (applied reconcile / recurring-import → `donation`;
  `looksLikeCardPayout` → `card-payout`; `ignore` → `ignored`; else `undecided`).
- card-payout rows carry `gross_amount` / `fee_amount` (from Montonio, or a
  manual fee typed in the UI). Per-assigned-donation `processor_fee_cents` is
  recomputed server-side via `splitFeeProRata` over the donations' own amounts.
- `summary` gains `recorded`.

`resolveCardPayouts` also returns `grossCents` / `feeCents` / `feeByDonationId`.

## 3.4 Endpoints + UI

- `admin-panel` plugin: `GET /bank-transactions/{list,summary,:code}`,
  `PATCH /bank-transactions/:code` (reclassify — the one write path).
  Permissions added to `bootstrapDonationPermissions` allowedActions.
- `admin/app/(dashboard)/transactions/` — money-flow summary card + filterable
  ledger table with an expandable per-row drawer (linked donations, their card
  fee, inline category/note edit). Nav entry added.
- `/statement` UI: echoes `allCredits` back, shows "N new bank rows will be
  recorded" + `recorded` in the result, editable fee on unresolved card payouts.
- Donation detail page shows the card fee + net.
- `reconcile.ts --apply` now upserts stub `bank_transactions` rows too (FK).

## 3.5 Deploy + first run

1. Dry-run `0006` on a prod-DB copy.
2. `deploy-local.sh` (migrate 6 → 7) + `git push vercel main`.
3. Upload the **full historical LHV export** through `/statement` — backfills
   `date`/`amount`/`counterparty` on all the stub rows, 0 new donations,
   idempotent on re-upload. Only then does the money-flow discrepancy read true
   (stub rows have null `amount` until this runs).
4. `/transactions` all-time: `discrepancy` within a few € of 0, `unlinkedDonations`
   ≈ 2 (Bob W Aug), card-payout fees match Montonio.

---

# Decisions locked in

- `transaction_id` nullable permanently, not unique.
- Canonical CSV input = LHV Estonian headers; English export also accepted.
- Deps: `csv-parse` (backend).
- Phase 1 backfill wrote directly to Postgres via `yarn reconcile`; Phase 2
  endpoints are the ongoing flow.
- Operator-confirmed matches → `source = 'manual'`; auto recurring creations →
  `'recurring-import'`.
- Recurring import: proportional org-split scaling, **no** per-line adjustment UI.
- Unknown senders / no template: **listed, never auto-created** by this tool.
- Card payouts: resolve via Montonio payouts API; manual checklist fallback.
- Apply is one request / one click.
- Ignore list persists in its own table.
