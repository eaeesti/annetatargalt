# Admin Panel — Feature Plan

## Current State

- Login / logout with Strapi admin credentials
- Sidebar navigation with mobile support, dark mode
- Donations list — basic table, most recent 50
- Phase 0 complete: middleware fixed, session expiry redirect, DonationAdmin read-only, error/loading boundaries
- Phase 1 complete: `resolveOrgNames()` utility, `/organizations` page with logo/avatar/status/website, org names resolved in donations table

---

## Data Model Clarifications

- **`finalized`**: set to `true` by the payment webhook when payment completes. Donations imported from bank CSV are finalized by default. Unfinalized = payment initiated but not yet confirmed.
- **`externalDonation`**: donations made through MTÜ Efektiivne Altruism Eesti's frontend (efektiivnealtruism.org/anneta) routed through our backend. Purely internal for now — no special UI treatment needed.
- **`companyName` / `companyCode`**: important for tax purposes. Should be optional visible columns in the donations table with a filter for "has company" (companyCode is not null). Show in all donation detail views.
  So

---

## Tech Decisions

- **Data tables**: Standard Next.js App Router pattern — server component reads `searchParams`, fetches data from the backend with those params, passes results to a thin client component that uses TanStack Table for column definitions and rendering (`manualPagination`, `manualSorting`, `manualFiltering` all true). Pagination/sort state changes via `router.push` with updated search params. **All table state (page, sort, filters) lives in URL search params** — this makes every filtered/sorted view automatically bookmarkable and shareable. Always use URL params, never local state, for table state.
- **Page size**: default **50** across all tables. User-selectable options: 25 / 50 / 100 / 250. State lives in URL params.
- **Column visibility**: built into TanStack Table; each table has a "Columns" dropdown (shadcn dropdown-menu, Base UI) to show/hide each column individually. Persisted per-table in `localStorage` (it's a personal UI preference, not a shareable view). In the donations table, ID, Status, Payment method, Company, and Company code are hidden by default.
- **Filtering (Phase 2)**: simple fixed filters per table — date range, status, and other common cases as dropdowns/inputs above the table. Filter state lives in URL params.
- **Filter builder (Phase 11)**: Strapi-style "Add filter" UI — pick column → pick operator → enter value, stackable, removable. Built once as a shared reusable component, then applied to all tables. Each column type has appropriate operators: text (contains / equals / starts with), number (= / ≠ / > / < / between), boolean (is true / is false), date (before / after / between). Filter state lives in URL params.
- **Charts**: shadcn Charts (Recharts-based, theme-aware)
- **Detail views**: Full-page detail routes first (e.g. `/donations/23`), linked from table rows. Sheet/drawer overlays added in a later pass once the full-page views are working — this avoids the complexity of Next.js intercepting routes (`@modal` + `(.)`) upfront.
- **Organization names**: fetched from Strapi's content API using the admin JWT (same `strapiAdmin()` helper — the DonationAdmin role is granted `api::organization.organization.find` in the bootstrap). No separate fetch helper or public API token needed. Fetched fresh on each request — no caching complexity until there's a measured performance problem.
- **Bank import**: LHV CSV format. The existing Python script calls `findTransaction`, `insertTransaction`, and `insertDonation` on the donations plugin — review the script before building the UI to understand the matching logic. The admin panel import UI will reimplement this logic in the new `admin-panel` plugin (not reuse the legacy endpoints directly, as those are slated for removal).
- **Data mutation**: read-only for now. Manual donation insertion and other writes deferred until clearly needed.
- **Testing**: new backend endpoints for financial-critical paths (transfers per-org totals, dashboard stats) must have unit tests alongside the existing 44-test suite.

---

## Backend Work (Strapi API layer)

This is a significant chunk of work and needs to happen in parallel with or ahead of each frontend feature.

### Plugin architecture

The existing `donations` plugin currently mixes two unrelated concerns:

- **Public donation flow** — `donate`, `donateExternal`, `donateForeign`, `confirm`, `decode`, `stats`. Called by the public frontend; use `auth: false`.
- **Legacy Python script endpoints** — `findTransaction`, `insertTransaction`, `insertDonation`, `import`, `export`, `deleteAll`, `migrateTips`, `addDonationsToTransferByDate`. Originally used by the CSV import script; will become obsolete once the admin panel handles import and transfer creation.

All new admin panel endpoints go into a **new `admin-panel` plugin** (`backend/src/plugins/admin-panel/`), with one controller file per entity:

```
backend/src/plugins/admin-panel/server/controllers/
  donation.ts          — list, detail
  donor.ts             — list, detail
  recurringDonation.ts — list, detail
  transfer.ts          — list, detail
  dashboard.ts         — stats, charts
  organization.ts      — stats
```

Routes live in `backend/src/plugins/admin-panel/server/routes/` using Strapi's native plugin route namespace (no custom `backend/src/api/` route files needed — unlike the donations plugin which uses custom routes for its `/api/donate` URLs, the admin plugin's namespaced URLs are fine). All routes use `config: {}` (authenticated). The `donations` plugin retains only the public flow endpoints. The legacy script endpoints are deprecated and removed once the CSV import UI is built (see Cleanup).

### Authentication

All admin plugin endpoints use `config: {}` (no `auth: false`) so Strapi's users-permissions middleware enforces JWT authentication. Access is granted by adding each action to the DonationAdmin role in the bootstrap function in `backend/src/index.ts`. No new endpoint may use `auth: false`. The admin Next.js app sends the JWT from the httpOnly cookie as `Authorization: Bearer <token>` on every request via `strapiAdmin()`.

### Future: role-based access control

Keep in mind that finer-grained roles may be added later:

- **Admin** — full read access + write operations (create transfer, import CSV)
- **Finance** — transfer org totals and amounts, but anonymized donor info (no names/emails/ID codes)
- **Observer** — dashboard and charts only, no individual records

GDPR is the main driver: donor names, emails, and ID codes are personal data that not every user needs to see. Design endpoints and frontend components to make it easy to swap in a role check later — e.g. keep personal fields clearly separated from aggregate/financial fields in API responses, and avoid mixing them into the same component in ways that are hard to conditionally hide.

### General pattern for list endpoints

All list endpoints need to accept:

- `page`, `pageSize`
- `sortBy`, `sortDir` (`asc` | `desc`)
- Entity-specific filters (documented per endpoint below)

All return `{ data: [...], pagination: { page, pageSize, total, pageCount } }`.

### Endpoints needed

All admin panel endpoints are served under the `admin-panel` plugin namespace: `/api/admin-panel/...`

#### Donations

- `GET /api/admin-panel/donations/list` — moved from donations plugin; sort by any column, filter by `finalized`, `dateFrom`, `dateTo`, `donorId`, `transferId`, `hasTransfer`, `hasCompany`, `orgId`
- `GET /api/admin-panel/donations/:id` — full detail with donor, org split, recurring donation link, transfer link

#### Donors

- `GET /api/admin-panel/donors/list` — sort + filters (`recurringDonor`, `activeSince`); computed columns: `totalDonated`, `donationCount`, `lastDonationDate`
- `GET /api/admin-panel/donors/:id` — full detail with stats + all donations + recurring donation(s)

#### Recurring donations

- `GET /api/admin-panel/recurring-donations/list` — sort + filter by `active`; include donor name, org split summary
- `GET /api/admin-panel/recurring-donations/:id` — full detail with donor, org split, all linked donations sorted by date

#### Transfers

- `GET /api/admin-panel/transfers/list` — sort; include computed `donationCount` and `totalAmount`
- `GET /api/admin-panel/transfers/:id` — full detail with all linked donations and per-org totals — **must have unit tests**

#### Dashboard

- `GET /api/admin-panel/dashboard/stats` — summary card data: **must have unit tests**
  - total finalized donations (count + sum)
  - total unique donors with ≥1 finalized donation
  - active donors (donated in last 12 months)
  - MRR from Anneta Targalt org allocation across active recurring donations
  - period comparisons: total donated in last 30/90/365 days vs prior period
- `GET /api/admin-panel/dashboard/charts` — all chart series in one call (or split if too slow):
  - monthly donation totals (last 24 months)
  - cumulative donations by month (all time)
  - active donors per month (trailing 12-month window, computed historically — complex sliding window query)
  - new vs churned recurring donors per month
  - monthly average donation amount (last 24 months)
  - org allocation totals (filterable by date range)

#### Organizations

- Org list from Strapi content API (`/api/organizations?populate=*`).
- **`GET /api/admin-panel/organizations/stats`** — per-org totals (total donated, donation count, last donation date) in a single query grouped by `organizationInternalId`.

#### Cleanup

- Remove `sentToOrganization` column from donations table (safe — column is unused and not reflecting reality)
- Remove legacy Python script endpoints from the donations plugin (`findTransaction`, `insertTransaction`, `insertDonation`, `import`, `export`, `deleteAll`, `migrateTips`, `addDonationsToTransferByDate`) once the CSV import UI is built and the Python script is retired

---

## Pages & Features

### Donations (`/donations`)

**Table columns**: ID, date, amount, donor, organizations (names), status, payment method; optional: company name, company code
**Server-side**: sort by any column; filter by status, date range, transfer presence, has company. All state in URL params.
**Detail** (sheet + `/donations/[id]` full page):

- All fields: amount, date, payment method, IBAN, comment, external flag, dedication info
- Company name + code if present
- Organization split with resolved names
- Links to donor and transfer (if any)

---

### Donors (`/donors`)

**Table columns**: ID, name, email, ID code, recurring flag, total donated, donation count, last donation date
**Server-side**: sort, filter by recurring/active. All state in URL params.
**Detail** (sheet + `/donors/[id]`):

- All donor fields
- Stats: total donated, count, first/last donation date
- Donations list (compact)
- Recurring donation(s) if any

---

### Recurring Donations (`/recurring-donations`)

**Table columns**: ID, donor, amount/month, active, org split (names), bank, start date
**Server-side**: sort, filter by active/inactive. All state in URL params.
**Detail** (sheet + `/recurring-donations/[id]`):

- All fields including org split with names
- Month-by-month list of linked donations
- Gap detection: months where a donation was expected but missing

---

### Donation Transfers (`/transfers`)

**Table columns**: ID, date, notes, donation count, total amount
**Server-side**: sort by date/amount. All state in URL params.
**Detail** (sheet + `/transfers/[id]`):

- Transfer metadata
- Per-org totals (the key output — what to report to GWWC)
- Full list of included donations

**Future — Create Transfer**:

- Pick date range → show finalized donations not yet in any transfer
- Preview per-org totals
- Confirm → write transfer record and link donations

---

### Organizations (`/organizations`)

**Table**: org name, internal ID, total donated (all time), donation count, last donation date — stats from `GET /api/admin-panel/organizations/stats` (single query, not per-org calls). Basic org list (name + internal ID) available from Phase 1; stats columns added in Phase 7.
**Detail** (sheet + `/organizations/[id]`):

- Org info from Strapi
- Full list of donations allocated to this org (links to donation detail)
- Monthly totals chart

---

### Recurring Donations Grid (`/recurring-donations/grid`)

Rows = donors (paginated; default 10, with option for larger page sizes), columns = months (from first donation month of the visible donors to today — not all the way back to 2021-12 unless viewing all)
Cell value = amount donated that month
Color coding: green = donated, gray = missed (active period), faded/empty = before/after active period
Purpose: spot churn patterns and gaps at a glance

---

### Dashboard (`/`)

Until Phase 8, the root route shows a simple placeholder ("Dashboard coming soon") so the homepage isn't blank.

**Summary cards**:

- Total finalized donations (count + sum)
- Total donors (with ≥1 finalized donation)
- Active donors (donated in last 12 months)
- Anneta Targalt MRR (sum of active recurring donation amounts allocated to own org)

**Period comparison cards** (% change vs prior period):

- Total donated — last 30 / 90 / 365 days

**Charts**:

1. **Monthly donation volume** — bar, last 24 months
2. **Cumulative donations** — area, all time
3. **Active donors over time** — line, monthly (trailing 12-month window per point — complex query)
4. **New vs churned recurring donors** — bar with two series per month
5. **Average donation amount** — line, monthly, last 24 months
6. **Organization allocation breakdown** — donut, filterable by date range

---

## Implementation Order

### Phase 0 — Security & reliability baseline ✅

#### Backend

- ✅ **DonationAdmin role is now read-only** — write permissions (`deleteAll`, `import`, `insertTransaction`, `insertDonation`, `migrateTips`, `addDonationsToTransferByDate`) are actively revoked on bootstrap; `api::organization.organization.find` added for org name resolution.

#### Auth / session

- ✅ **Middleware fixed** — file is `proxy.ts` with `export function proxy(...)`. Next.js 16 renamed the middleware file convention from `middleware.ts` to `proxy.ts`; unauthenticated dashboard requests now correctly redirect to `/login`.
- ✅ **Session expiry handling** — dashboard layout redirects to `/login` when `/api/users/me` returns non-OK (covers JWT expiry and deleted users).
- **Shorten JWT TTL** (optional, not done): consider reducing Strapi JWT TTL from default 30 days to ~8 hours in Strapi settings.

#### Error & loading boundaries

- ✅ `error.tsx` added to `app/(dashboard)/`
- ✅ `loading.tsx` added to `app/(dashboard)/`

---

### Phase 1 — Organization name resolution + basic organizations page ✅

- ✅ `admin/lib/orgs.ts` — `fetchOrgs()` + `resolveOrgNames()`. Uses `pagination[pageSize]=500` (`pagination[limit]=-1` is not supported in Strapi v5). Logo URLs handled for both local (`/uploads/...`) and cloud storage (already-absolute URLs).
- ✅ `/organizations` page — table with logo (or colored initial avatar fallback), name, internal ID, type (org vs fund), active status, website.
- ✅ Donations table updated to show resolved org names instead of raw `internalId`s.
- ✅ Organizations added to sidebar nav.

### Phase 2 — Donations table (foundation) ✅

- ✅ `admin-panel` plugin created at `backend/src/plugins/admin-panel/` with `GET /api/admin-panel/donations/list` — sort by any column, full filter params (`finalized`, `dateFrom`, `dateTo`, `donorId`, `transferId`, `hasTransfer`, `hasCompany`, `orgId`), pageSize up to 250.
- ✅ Plugin registered in `backend/config/plugins.js` pointing to the dist path (`./dist/src/plugins/admin-panel`).
- ✅ **Strapi v5 plugin route fix**: routes must be exported as a named-router object with `type: "content-api"` — a flat array silently registers routes under the admin prefix (`/admin/...`) instead of `/api/...`.
- ✅ **Next.js 16 proxy convention**: `proxy.ts` with `export function proxy(...)` is the correct Next.js 16 middleware file name. `middleware.ts` is deprecated and causes Turbopack panics.
- ✅ Frontend: TanStack Table with URL-driven state (page, sort, pageSize in URL params), per-column visibility dropdown (shadcn dropdown-menu, Base UI), hidden by default: ID, Status, Payment method, Company, Company code. Org names resolved via Phase 1 utility.
- ⏳ `admin_audit_log` Drizzle table + migration — deferred to Phase 3.

### Phase 3 — Donation detail + audit log ✅

- ✅ `GET /api/admin-panel/donations/:id` — full detail with donor, org split, recurring donation link, transfer link. Uses existing `findByIdWithRelations()`.
- ✅ `backend/src/db/repositories/adminAuditLog.repository.ts` — append-only audit log repository.
- ✅ Audit logging added to both `donations.list` and `donations.findOne` — logs userId, userEmail, action, recordId, IP. Fire-and-forget (never fails the request).
- ✅ `plugin::admin-panel.donation.findOne` added to DonationAdmin role in bootstrap.
- ✅ Frontend: `/donations/[id]` full-page detail view — details, donor, company (conditional), dedication (conditional), org split sections.
- ✅ Table rows clickable — `router.push('/donations/${id}')` on row click.
- ⏳ Sheet/drawer overlay (intercepting route) — deferred to a later pass per the tech decisions above.

### Phase 4 — Donors ✅

- ✅ `DonorsRepository.findPaginated()` — paginated + sorted donors list with computed columns (`totalDonated`, `donationCount`, `lastDonationDate`) via LEFT JOIN on a finalized-donations subquery. Sortable by all columns including the computed ones.
- ✅ `DonorsRepository.findByIdWithDonations()` — donor with full donations list (incl. org splits) and recurring donations via Drizzle relations.
- ✅ `GET /api/admin-panel/donors/list` + `GET /api/admin-panel/donors/:id` — with audit logging. Stats (totalDonated, donationCount, firstDonationDate, lastDonationDate) computed in the controller from the fetched donations.
- ✅ `donor.list` and `donor.findOne` added to DonationAdmin role in bootstrap.
- ✅ `/donors` — sortable table: ID, name, email, recurring, total donated, donation count, last donation date; URL-driven state; clickable rows.
- ✅ `/donors/[id]` — detail page with donor info, stats, recurring donations summary, and full donations list (each row links to `/donations/[id]`).
- ✅ Donors added to sidebar nav.

### Phase 5 — Recurring donations ✅

- ✅ `RecurringDonationsRepository.findPaginated()` — paginated + sorted recurring donations with donor name JOIN and finalized donation stats subquery (donationCount, lastDonationDate). Sortable by all columns including computed ones.
- ✅ `RecurringDonationsRepository.findByIdWithFullDonations()` — recurring donation with donor, org splits, and all linked donations (with org splits) ordered by date.
- ✅ `GET /api/admin-panel/recurring-donations/list` + `GET /api/admin-panel/recurring-donations/:id` — with audit logging. Detail endpoint computes `gapMonths[]` (array of "YYYY-MM" strings for months with no finalized linked donation since the start date).
- ✅ `recurringDonation.list` and `recurringDonation.findOne` added to DonationAdmin role in bootstrap.
- ✅ `/recurring-donations` — sortable table: ID, status, donor, amount/mo, started, donations count, last donation; URL-driven state; clickable rows.
- ✅ `/recurring-donations/[id]` — detail page with details, donor (linked), org split, gap months (shown as destructive badges), and linked donations list.
- ✅ Recurring added to sidebar nav.

### Phase 6 — Transfers ✅

- ✅ `DonationTransfersRepository.findPaginated()` — paginated + sorted transfers with computed `donationCount` and `totalAmount` via finalized-donations subquery.
- ✅ `DonationTransfersRepository.findByIdWithPerOrgTotals()` — transfer with all linked donations (+ org splits) and per-org totals aggregated from finalized donations' `organizationDonations`, sorted by amount descending.
- ✅ Unit tests for both methods (9 new tests, all passing; total suite now 56 tests).
- ✅ `GET /api/admin-panel/transfers/list` + `GET /api/admin-panel/transfers/:id` — with audit logging.
- ✅ `transfer.list` and `transfer.findOne` added to DonationAdmin role in bootstrap.
- ✅ `/transfers` — sortable table: ID, date, recipient, donations count, total; URL-driven state; clickable rows. Default sort: date descending.
- ✅ `/transfers/[id]` — detail with metadata, per-org totals section (org names resolved, amounts, donation counts, %, progress bars, grand total row), and full linked donations list.
- ✅ Transfers added to sidebar nav.

### Phase 7 — Organizations view (stats + detail) ✅

- ✅ `OrganizationDonationsRepository.getStats()` — single GROUP BY query across finalized `organizationDonations` joined with `donations`; returns totalDonated, donationCount, lastDonationDate per org.
- ✅ `GET /api/admin-panel/organizations/stats` with audit logging; `organization.stats` permission added to DonationAdmin role.
- ✅ `/organizations` list — augmented with three stats columns (total donated, donations, last donation); sorted by totalDonated desc; rows link to detail page. Stats fetched in parallel with Strapi org list.
- ✅ `/organizations/[internalId]` detail — org info (logo, internal ID, website), stats section, recent donations list (most recent 50, with "see all" link to `/donations?orgId=...` when more exist). Uses `internalId` as URL slug.

### ✅ Phase 8 — Dashboard summary cards + period comparisons

`DashboardRepository` with `getTotalDonations`, `getTotalDonors`, `getActiveDonors`, `getMrr`, `getPeriodStats`, `getStats` (parallel). 10 integration tests (66 total passing). `GET /api/admin-panel/dashboard/stats`. Dashboard page replaced with 4 KPI cards + period comparison table with trend badges (vs prior period).

### ✅ Phase 9 — Dashboard charts

`GET /api/admin-panel/dashboard/charts` (3 series, all in parallel). Raw SQL for `generate_series`-based queries. 4 Recharts components (client components):

- Bar chart: monthly donation totals (last 24 months)
- Area chart: cumulative donations (computed from monthly via running sum in JS)
- Line chart: active donors per month (rolling 12-month window per month, CTE + generate_series)
- Composed chart: recurring donors new/churned (bars) + active count (line)

### ✅ Phase 10 — Donations grid

`getGrid()` on RecurringDonationsRepository: CTE + `json_object_agg` query returning all donors with any finalized donation, grouped by donor. Returns `monthAmounts: Record<string, number>` (month → total cents). `GET /api/admin-panel/recurring-donations/grid`. Frontend at `/recurring-donations/grid`: horizontally-scrollable table with sticky donor column, month columns showing actual donated amount in green (e.g. €20) or ✗ for gaps / blank before first donation. Rows sorted by first donation month then name. 12/24/36/All-month range selector (All spans from earliest donor's first donation to today). Column visibility: no €/mo column — amounts shown per cell. "Grid view →" toggle added to the recurring donations list page header.

### Phase 11 — Filter builder

Build the reusable "Add filter" component and roll it out across all tables. Each column type gets appropriate operators (text: contains/equals/starts with; number: =/≠/>/</between; boolean: is true/is false; date: before/after/between). Filter state lives in URL params.

### Cleanup (can be done any time)

- Remove `sentToOrganization` from DB schema + migration
- Remove legacy Python script endpoints from the donations plugin (`findTransaction`, `insertTransaction`, `insertDonation`, `import`, `export`, `deleteAll`, `migrateTips`, `addDonationsToTransferByDate`) once the CSV import UI is built and the Python script is retired
- Revoke the old `api::donation.donation.list` action from the DonationAdmin role once Phase 2's `admin-panel` list endpoint is the canonical source and the transition is complete (do NOT revoke during Phase 2 — keep both active during transition)

---

## Future / Backlog

### Bank CSV Import (`/import`)

- Upload LHV CSV export (example to be provided)
- Review the Python script before building — understand the matching logic (find existing donation by donor + amount + date; if not found, create from latest recurring donation's org split)
- Reimplement the logic in the `admin-panel` plugin (do not reuse the legacy `findTransaction`/`insertTransaction`/`insertDonation` endpoints — those are slated for removal)
- Review/confirm UI before writing to DB

### Create Donation Transfer

- From `/transfers` — pick date range, preview org totals, confirm

### Global search

- Search bar (likely in the header) across donors (name, email, ID code), donations (ID, IBAN), and recurring donations
- Could be a single endpoint or federated calls to each list endpoint with a `search` param
- Useful for support queries: look up a specific donor or transaction quickly

### Manual donation insertion

- For cases where a donor sends a direct bank transfer and wants it directed to specific orgs
- Deferred until clearly needed

---

## Out of Scope

- Editing existing donations/donors (read-only for now)
- User/admin management (stays in Strapi admin UI)
- Frontend donation form
