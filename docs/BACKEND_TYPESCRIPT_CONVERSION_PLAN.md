# Backend TypeScript Conversion Plan

## Progress Update (March 7, 2026)

### Completed Phases ✅
- **Phase 0**: TypeScript infrastructure setup - DONE
- **Phase 1**: Database schema & client conversion - DONE
- **Phase 2**: Test helpers & utilities conversion - DONE
- **Phase 3**: All 7 repositories converted - DONE
- **Phase 4**: All API controllers, services, and lifecycles converted - DONE
- **Phase 5**: Donations plugin conversion - DONE
- **Phase 6**: All API routes converted - DONE (12 route files)
- **Phase 7**: `src/index.ts` converted - DONE
- **Phase 8**: Test migration - DONE
- **Phase 9**: Strict mode - DONE

### Phase 10: Code Quality Cleanup — DONE

Post-conversion cleanup based on critical analysis of the branch:

1. **Remove unused `amountToCents` import** — was never used, even in the original JS
2. **Consolidate repository access** — `donation.ts` had 3 patterns (module-level instances, imported singletons, locally instantiated inside methods). Standardized to singletons from the index.
3. **Replace `any` types** — Proper interfaces defined (`DonationInput`, `ForeignDonationInput`, `ImportData`, `OrgAmount`, `ValidationResult`, `InsertDonationInput`). `strapi` parameter typed as `Core.Strapi`. Email plugin access typed via `emailService()` helper using `unknown` cast.
4. **Remove `!` non-null assertions** — Replaced with explicit null guards. `donation.donorId !== null` checked before `findById`. `donation.donor` checked before email sends.
5. **Enforce convention rules** — No `any`, no `!` assertions, no `error: any` catch blocks, no `(global as any).strapi`, typed `ctx: Context` in all controllers.

### Phase 11: Eliminate Remaining `any` and `as` Casts — DONE

Identified after comprehensive pre-PR review.

**Goal:** Migrate all `strapi.db.query()` (Strapi v4 Entity Service) calls to `strapi.documents()` (Strapi v5 Document Service). This eliminates the `as Record<string, string | null>` casts that were required because `db.query()` returns `any`. Also migrated 2 missed calls in API controllers and fixed `MONTONIO_PUBLIC` null guard.

**Files changed:**
- `src/plugins/donations/server/services/donation.ts` — 13 `db.query()` calls across 8 methods
- `src/plugins/donations/server/controllers/donation.ts` — 1 `db.query()` call + 2 `decoded: any` → `MontonioDecodedToken`
- `src/api/email-config/controllers/email-config.ts` — 1 `db.query()` call
- `src/api/contact-submission/controllers/contact-submission.ts` — 1 `db.query()` call
- `src/utils/montonio.ts` — `MONTONIO_PUBLIC` env var guarded via `getPublicKey()` helper

**Content types migrated:**
- `api::global.global` (single type) — 9 instances
- `api::email-config.email-config` (single type) — 7 instances
- `api::donation-info.donation-info` (single type) — 2 instances

**Migration pattern:**
```typescript
// Before
const global = await strapi.db.query("api::global.global").findOne() as Record<string, string | null>;

// After — typed, no cast, null guard added
const global = await strapi.documents("api::global.global").findFirst();
if (!global) throw new Error("Global config not found");
```

The migration also caught real bugs previously hidden by the `as` cast:
- `decoded.merchant_reference` accessed without null check (optional field on `MontonioDecodedToken`)
- `donationInfo.iban`/`recipient`/`description` passed to `createRecurringPaymentLink` as `undefined` (now use `?? ""`)
- `EmailTemplate.subject` typed as non-nullable but CMS fields can be unset

**Remaining unavoidable casts (at external API boundaries):**

| Cast | Location | Reason |
|---|---|---|
| `strapi as unknown as { plugins: { email } }` | `donation.ts` | Strapi email plugin has no type exports |
| `strapi.db as unknown as { connection: KnexConnection }` | `donor.ts`, `index.ts` | Knex internals not typed by Strapi |
| `as DonationCtrl` | donation proxy controller | Strapi types plugin methods as 2-arg Koa middleware |
| `organization.cause as { id: number }` | `donation.ts` export | Document Service populated relation type |
| `org as { internalId: string } \| null` | `donation.ts` insertDonation | Document Service `fields:` narrowing limitation |
| `event.params.where as Record<string, unknown>` | `lifecycles.ts` | Lifecycle event type vs Document Service filters |
| `donation.bank as Bank` | `donation.ts` | Drizzle types `bank` as `string \| null`; `Bank` is a string union |
| `jwt.verify(...) as MontonioDecodedToken` | `montonio.ts` | `jwt.verify()` returns `string \| JwtPayload` |
| `(await response.json()) as { paymentUrl: string }` | `montonio.ts` | `fetch().json()` returns `unknown` |

### Final Status

**`yarn type-check`:** 0 errors (`strict: true`)
**`yarn test:unit`:** 44 tests passing

---

## Key Implementation Notes

### Strapi TypeScript Build (Phase 4 discovery)

`tsconfig.json` extends `@strapi/typescript-utils/tsconfigs/server` with `outDir: "dist"`. Strapi compiles `.ts` → `dist/` during `yarn develop` and loads from there. Type checking is separate via `yarn type-check`.

### Plugin Path (critical)

`config/plugins.js` must point to the compiled output:
```js
donations: { enabled: true, resolve: "./dist/src/plugins/donations" }
```
Without this, `strapi.plugin("donations")` returns `undefined` silently — Strapi starts but the plugin is skipped because `strapi-server.js` doesn't exist in `src/` (only `strapi-server.ts`).

### Drizzle `.returning()` pattern

```typescript
// Always destructure and guard — returning() returns T[]
const [donor] = await db.insert(donors).values(data).returning();
if (!donor) throw new Error("Failed to insert donor");
return donor;
```

### Strapi Document Service for single types

Use `findFirst()` (not `findOne()`) for single-type content types:
```typescript
const global = await strapi.documents("api::global.global").findFirst();
if (!global) throw new Error("Global config not found");
// global.currency is now typed as string | null | undefined
```

### Global `strapi` declaration

`backend/types/strapi-global.d.ts` declares `strapi` as a global constant, eliminating `(global as any).strapi` throughout the codebase:
```typescript
import type { Core } from "@strapi/strapi";
declare global {
  const strapi: Core.Strapi;
}
```
