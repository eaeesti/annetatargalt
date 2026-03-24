# Admin Panel — Feature Plan

## Current State

- Login / logout with Strapi admin credentials
- Sidebar navigation with mobile support, dark mode
- Donations list — basic table, most recent 50
- Phase 0 complete: middleware fixed, session expiry redirect, DonationAdmin read-only, error/loading boundaries

---

## Data Model Clarifications

- **`finalized`**: set to `true` by the payment webhook when payment completes. Donations imported from bank CSV are finalized by default. Unfinalized = payment initiated but not yet confirmed.
- **`externalDonation`**: donations made through MTÜ Efektiivne Altruism Eesti's frontend (efektiivnealtruism.org/anneta) routed through our backend. Purely internal for now — no special UI treatment needed.
- **`companyName` / `companyCode`**: important for tax purposes. Should be optional visible columns in the donations table with a filter for "has company" (companyCode is not null). Show in all donation detail views.

---

## Tech Decisions

- **Data tables**: Standard Next.js App Router pattern — server component reads `searchParams`, fetches data from the backend with those params, passes results to a thin client component that uses TanStack Table for column definitions and rendering (`manualPagination`, `manualSorting`, `manualFiltering` all true). Pagination/sort state changes via `router.push` with updated search params. **All table state (page, sort, filters) lives in URL search params** — this makes every filtered/sorted view automatically bookmarkable and shareable. Always use URL params, never local state, for table state.
- **Page size**: default **50** across all tables. User-selectable options: 25 / 50 / 100 / 250. State lives in URL params.
- **Column visibility**: built into TanStack Table; each table has a dropdown to show/hide columns. Persisted per-table in `localStorage` (it's a personal UI preference, not a shareable view). Company name and company code are hidden by default.
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
- ✅ **Middleware fixed** — `proxy.ts` renamed to `middleware.ts`, export renamed to `middleware`; unauthenticated dashboard requests now correctly redirect to `/login`.
- ✅ **Session expiry handling** — dashboard layout redirects to `/login` when `/api/users/me` returns non-OK (covers JWT expiry and deleted users).
- **Shorten JWT TTL** (optional, not done): consider reducing Strapi JWT TTL from default 30 days to ~8 hours in Strapi settings.

#### Error & loading boundaries
- ✅ `error.tsx` added to `app/(dashboard)/`
- ✅ `loading.tsx` added to `app/(dashboard)/`

---

### Phase 1 — Organization name resolution + basic organizations page
Next.js utility (not Strapi backend): `resolveOrgNames(internalIds: string[]) → Map<string, string>` in `admin/lib/orgs.ts`. Fetches from Strapi content API (`/api/organizations?populate=*&pagination[limit]=-1`) using `strapiAdmin()` (admin JWT — the DonationAdmin role is granted `api::organization.organization.find` in the backend bootstrap). The `pagination[limit]=-1` avoids Strapi's default 25-result truncation. Maps `internalId` → display name. Falls back to the raw internal ID if an org isn't found. Fetched fresh on each request. Used in every subsequent phase — donations table, donation detail, transfers, etc.

Frontend: render the same Strapi org data as a basic `/organizations` table — org name, internal ID, and any other fields available (logo, description, website, etc.). Stats columns (total donated, donation count, last donation date) are absent until Phase 7 fills them in. No TanStack Table needed — ~10 orgs, simple static table is sufficient.

### Phase 2 — Donations table (foundation)
Backend: move `GET /api/donations/list` into the `admin-panel` plugin. Extend it with sort by any column, full filter params (`finalized`, `dateFrom`, `dateTo`, `donorId`, `transferId`, `hasTransfer`, `hasCompany`, `orgId`). Fix the existing hardcoded `pageSize` cap of 100 → 250. Also: **create the `admin_audit_log` Drizzle table and migration** in this phase (even though the logging code lands in Phase 3) — the table must exist before the detail endpoint goes live.
**Plugin registration**: add `admin-panel` to `backend/config/plugins.js` pointing to the dist path (`./dist/src/plugins/admin-panel`) — same pattern as the donations plugin. Strapi resolves local plugins from the source root, but TS projects only have compiled JS in `dist/`; using the source path will silently skip the plugin.
Frontend: replace current table with TanStack Table, URL-driven state, optional company columns; org names resolved via Phase 1 utility.

### Phase 3 — Donation detail + audit log (sets the pattern)
Backend: `GET /api/admin-panel/donations/:id`. Add audit logging to both this endpoint and Phase 2's list endpoint at the same time.
Frontend: intercepting route + sheet + full page — establishes the pattern reused everywhere

#### Audit log
- Log **all admin actions: reads and writes** — which user, what action, what record was accessed.
- Read events matter for GDPR: viewing a donor's name, email, or ID code is a personal data access that must be accountable. List views are also logged.
- Log at minimum: `timestamp`, `userId`, `userEmail`, `action` (e.g. `donations.list`, `donors.view`, `transfers.create`), `recordId` (where applicable), `ip`.
- **Implementation**: logging happens in Strapi controllers (server-side), not in Next.js. Next.js forwards the real client IP in `X-Forwarded-For`; Strapi reads it from the request headers alongside the JWT.
- Store in the `admin_audit_log` Drizzle table (schema + migration created in Phase 2). Entries are never deleted.
- No admin UI initially — queryable from DB. Add a UI view later when needed.

### Phase 4 — Donors
Backend: `GET /api/admin-panel/donors/list` + `GET /api/admin-panel/donors/:id`.
- `DonorsRepository.findAll()` currently returns all donors unsorted with no pagination — needs a new paginated + sorted variant.
- Computed columns (`totalDonated`, `donationCount`, `lastDonationDate`) don't exist — require new Drizzle subqueries aggregating finalized donations per donor.
- `GET .../donors/:id` stats (total donated, count, first/last donation date) are also new queries.

Frontend: donors table + detail (reuses Phase 3 pattern)

### Phase 5 — Recurring donations
Backend: `GET /api/admin-panel/recurring-donations/list` + `GET /api/admin-panel/recurring-donations/:id`.
- `RecurringDonationsRepository.findAll()` returns all records unsorted with no pagination — needs the same paginated + sorted extension as Phase 4.
- Org split summary for the list view requires joining `organizationRecurringDonations`.
- Gap detection (months where a payment was expected but missing) is new logic: every calendar month between the recurring donation's start date and today counts as an expected month — generate the full set, diff against actual linked donations, any missing month is a gap.

Frontend: table + detail with gap detection

### Phase 6 — Transfers
Backend: `GET /api/admin-panel/transfers/list` + `GET /api/admin-panel/transfers/:id`.
- `DonationTransfersRepository.findAll()` exists but lacks computed `donationCount` and `totalAmount` — needs a new aggregation query joining donations.
- `GET .../transfers/:id` per-org totals = GROUP BY `organizationInternalId` across the transfer's `organizationDonations` — new Drizzle query.
- Both endpoints require unit tests.

Frontend: table + detail (per-org totals view is the most important output of the whole app)

### Phase 7 — Organizations view (stats + detail)
Backend: `GET /api/admin-panel/organizations/stats`.
- Entirely new query: GROUP BY `organizationInternalId` across `organizationDonations` joined with finalized donations — total donated, donation count, last donation date per org.
- No existing repository method covers this.

Frontend: augment the Phase 1 org list page — merge stats from the new endpoint into the existing table, and add the detail view (sheet + `/organizations/[id]` full page) with org info from Strapi, full list of donations allocated to this org, and monthly totals chart.

### Phase 8 — Dashboard summary cards + period comparisons
Backend: `GET /api/admin-panel/dashboard/stats`. Several new queries needed alongside existing ones:
- Total finalized donations count + sum — reuse `countFinalized()` + `sumFinalizedDonations()` (already exist)
- Total unique donors with ≥1 finalized donation — new query
- Active donors (donated in last 12 months) — new query
- MRR — sum of `organizationRecurringDonations.amount` for active recurring donations allocated to the Anneta Targalt org — new query joining recurring donations and their org splits
- Period comparisons — reuse `sumFinalizedDonationsInRange()` (already exists), called twice per period (current vs prior)
- Unit tests required for all of the above.

Frontend: card layout (replaces the placeholder on `/`)

### Phase 9 — Dashboard charts
Backend: `GET /api/admin-panel/dashboard/charts`. All series are new queries:
- Monthly donation totals — GROUP BY month across finalized donations
- Cumulative donations — running sum over all months
- Active donors per month — **most complex**: for each month M, count distinct donors with ≥1 finalized donation in [M−11, M]; likely requires a generate_series approach or raw SQL
- New vs churned recurring donors — **payment-based, not flag-based**: for each month, a donor is "active" if they have ≥1 finalized donation linked to a recurring donation in that month. A donor is "new" if they appear this month but not last month; "churned" if they appeared last month but not this month. The `active` boolean flag on `recurringDonations` is not used for this calculation.
- Monthly average donation amount — AVG per month across finalized donations
- Org allocation totals — GROUP BY org + month across `organizationDonations`, filterable by date range

Frontend: all 6 charts

### Phase 10 — Recurring donations grid
Backend: ensure the recurring donations list endpoint supports fetching enough rows for the grid (up to all active donors — probably a few hundred). No new query structure needed beyond Phase 5's paginated list.
Frontend: grid with pagination and dynamic column range

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
