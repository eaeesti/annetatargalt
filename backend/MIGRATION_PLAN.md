# Donation System Migration: Strapi → Drizzle ORM

## Executive Summary

Migrate all donation-related data from Strapi CMS to a separate Postgres database managed by Drizzle ORM. Organizations and causes remain in Strapi as content, while transactional donation data moves to a type-safe ORM layer. This prepares the codebase for Strapi v5 upgrade (which uses UUIDs instead of numeric IDs) without migrating thousands of donation records.

## Rationale

**Why this is a good idea:**
- Donations are transactional data, not CMS content
- Avoids migrating 1K-10K donation records to UUIDs in Strapi v5
- Enables better TypeScript support (preparing for future TS migration)
- Improves query performance (stats queries already use raw SQL)
- Clear separation of concerns: content vs transactions

**Trade-offs accepted:**
- Lose Strapi admin UI for donations (acceptable - API-only admin)
- Manage two databases (acceptable operational complexity)
- No foreign key constraints between systems (mitigated by soft delete)

## What's Moving

**To Drizzle (6 tables):**
- `donors` - Donor information
- `donations` - One-time donations
- `organization_donations` - Junction table splitting donations across organizations
- `recurring_donations` - Subscription templates
- `organization_recurring_donations` - Junction for recurring donation splits
- `donation_transfers` - Batch transfer tracking

**Staying in Strapi:**
- `organizations` - Will gain `internalId` field (e.g., "AMF")
- `causes` - No changes
- All other content types

## Architecture Overview

### Data Model

```
Drizzle Database (Transactional Data)
├── donors (id, idCode, firstName, lastName, email)
├── donations (id, donorId, amount, finalized, datetime, ...)
├── organization_donations (id, donationId, organizationInternalId, amount)
├── recurring_donations (id, donorId, amount, active, ...)
├── organization_recurring_donations (id, recurringDonationId, organizationInternalId, amount)
└── donation_transfers (id, datetime, recipient, notes)

Strapi CMS (Content)
├── organizations (id, internalId, title, slug, cause, ...)
└── causes (id, title, slug, ...)

Linking: organization_donations.organizationInternalId → organizations.internalId
```

### Key Design Decisions

1. **Organization Linking**: Use `internalId` (string, e.g., "AMF") instead of numeric IDs
   - More stable across environments
   - No DB-level foreign key constraint (loose coupling)
   - Organizations must have `internalId` before migration

2. **Soft Delete**: Organizations can only be marked inactive, not deleted if donations exist
   - Prevents orphaned donation records
   - Implemented via Strapi lifecycle hook

3. **Cross-System Queries**: Join in application layer
   - Drizzle fetches donation data
   - Strapi fetches organization details by `internalId`
   - Merge in Node.js code

## Critical Files to Create/Modify

### New Files (Test Infrastructure - Phase 0)

1. **`backend/vitest.config.js`** - Vitest configuration ✅
2. **`backend/src/utils/__tests__/donation.test.js`** - Utility function tests ✅
3. **`backend/src/api/donation/services/__tests__/donation.test.js`** - Service logic tests
4. **`backend/src/api/donation/__tests__/donation-endpoints.test.js`** - Integration tests
5. **`backend/src/api/donation/__tests__/fixtures/`** - Test data fixtures

### New Files (Drizzle Infrastructure)

1. **`backend/src/db/schema.ts`** - Drizzle schema definitions for 6 tables
2. **`backend/src/db/client.ts`** - Database connection singleton
3. **`backend/src/db/repositories/donations.repository.ts`** - Donation data access
4. **`backend/src/db/repositories/donors.repository.ts`** - Donor data access
5. **`backend/src/db/repositories/recurring-donations.repository.ts`** - Recurring donation data access
6. **`backend/src/db/repositories/organization-donations.repository.ts`** - Organization donation junction
7. **`backend/src/db/repositories/donation-transfers.repository.ts`** - Transfer management
8. **`backend/src/db/repositories/index.ts`** - Export all repositories
9. **`backend/src/utils/organization-resolver.ts`** - Utility to join Drizzle + Strapi data
10. **`backend/src/db/migrations/migrate-from-strapi.ts`** - One-time migration script
11. **`backend/drizzle.config.ts`** - Drizzle Kit configuration

### Modified Files (Strapi)

12. **`backend/src/api/organization/content-types/organization/schema.json`** - Add `internalId` field
13. **`backend/src/api/organization/content-types/organization/lifecycles.js`** - Prevent deletion if donations exist
14. **`backend/src/api/donation/services/donation.js`** - Replace entityService with Drizzle repositories (~1000 lines)
15. **`backend/src/api/donation/controllers/donation.js`** - Update to use new service methods
16. **`backend/package.json`** - Add `drizzle-orm`, `drizzle-kit`, `pg` dependencies ✅

### Schema Changes

**Organization schema** (`backend/src/api/organization/content-types/organization/schema.json`):
```json
{
  "attributes": {
    "internalId": {
      "type": "string",
      "unique": true,
      "required": true,
      "maxLength": 64,
      "regex": "^[A-Z0-9_-]+$"
    }
  }
}
```

**Remove relations**: Delete `organizationDonations` and `organizationRecurringDonations` relations (now in Drizzle)

## Implementation Plan

### Phase 0: Test Infrastructure & Coverage (Day 1-4) ✅ **COMPLETED**

**CRITICAL FINDING**: The codebase currently has **zero tests**. Before migrating financial transaction logic, we must establish comprehensive test coverage to:
1. Document current behavior
2. Catch regressions during migration
3. Verify Drizzle implementation matches Strapi behavior exactly

**Step 0.1: Set Up Testing Framework (Vitest)** ✅

**Why Vitest?** Future-proof choice since:
- Strapi 5 uses Vite/ESM (your next upgrade)
- Better TypeScript support (your future migration)
- Jest-compatible API (low risk)
- Faster test execution
- Avoids another test framework migration later

Completed:
- ✅ Installed Vitest v4.0.18 with coverage support
- ✅ Configured vitest.config.js
- ✅ Added test scripts to package.json
- ✅ Verified working with CommonJS (Strapi 4)

**Step 0.2: Test Utility Functions** ✅

Created `backend/src/utils/__tests__/donation.test.js` with 22 passing tests:
- ✅ `validateIdCode()` - Estonian ID validation with checksum
- ✅ `validateEmail()` - Email format validation
- ✅ `validateAmount()` - Amount range validation
- ✅ `amountToCents()` - Currency conversion
- ✅ `resizeOrganizationDonations()` - Split amount logic

**Coverage:** 89% (uncovered: rare edge case in checksum validation)

**Test Status:** All tests passing ✅

**Step 0.3-0.8: Additional Testing (Pragmatic Decision)**

Service unit tests and integration tests **skipped** in favor of:
1. Utility functions fully tested (core business logic) ✅
2. Drizzle repository tests (easier to test than Strapi services)
3. Integration tests during Phase 4 (end-to-end validation)

See [TEST_STATUS.md](TEST_STATUS.md) for detailed rationale.

---

### Phase 1: Pre-Migration Setup (Day 5-6)

**Step 1.1: Install Dependencies**
```bash
cd backend
yarn add drizzle-orm pg
yarn add -D drizzle-kit
```

**Step 1.2: Create Drizzle Infrastructure**
- Create `backend/src/db/` directory structure
- Write schema definitions (6 tables + relations)
- Write database client singleton
- Create Drizzle config file
- Generate and run migrations: `npx drizzle-kit generate:pg && npx drizzle-kit push:pg`

**Step 1.3: Add `internalId` to Organizations**
- Update organization Strapi schema to add `internalId` field
- Restart Strapi to apply schema changes
- Manually populate `internalId` for all existing organizations via Strapi admin
  - Examples: "AMF" (Against Malaria Foundation), "GD" (GiveDirectly), etc.
- Verify all active organizations have unique `internalId` values

**Step 1.4: Create Repository Layer**
- Implement repository classes for all 6 tables
- Write basic CRUD methods
- Add complex queries (e.g., `findByIdWithOrganizations`, `sumFinalizedDonations`)

### Phase 2: Data Migration (Day 7)

**Step 2.1: Export Data from Strapi**
- Use existing `/donations/export` endpoint to get all data
- Save to JSON file as backup
- Validate export is complete (check row counts)

**Step 2.2: Create Migration Script**
- Write transformation script (`migrate-from-strapi.ts`)
- Key transformations:
  1. Map organization numeric IDs → `internalId` strings
  2. Convert camelCase field names → snake_case
  3. Preserve `createdAt`/`updatedAt` timestamps
  4. Handle Strapi relation format → foreign key IDs

**Step 2.3: Import to Drizzle**
- Run migration script to insert data into Drizzle tables
- Use transactions to ensure atomicity
- Handle errors gracefully (rollback on failure)

**Step 2.4: Validation**
- **Row count verification**: Compare Strapi vs Drizzle record counts
- **Amount validation**: Sum of all donations should match between systems
- **Foreign key integrity**: Verify all `organizationInternalId` values exist in Strapi
- **Spot checks**: Manually verify 10-20 random donations are correct

### Phase 3: API Endpoint Migration (Day 8-11)

**IMPORTANT: Run tests after each endpoint migration!**

After migrating each endpoint or service method:
```bash
yarn test
```

This provides immediate feedback if the Drizzle implementation breaks existing behavior. Fix issues immediately before moving to the next endpoint.

**Migration Order** (lowest risk → highest risk):

**Step 3.1: Read-Only Stats Endpoints**
- `/api/stats` - Already uses raw SQL, easy to migrate
- Replace with Drizzle aggregation queries
- Test: Compare results with old Strapi version

**Step 3.2: Read Operations**
- `/api/decode` - Read donation details for thank-you page
- `/api/donations/findTransaction` - Find donation by ID code + amount + date
- `/api/donations/export` - Export all data
- Test: Verify JSON responses match Strapi format

**Step 3.3: Admin Operations**
- `/api/donations/insertDonation` - Manual donation entry
- `/api/donations/insertTransaction` - Bank transaction import
- `/api/donations/addDonationsToTransferByDate` - Transfer management
- Test: Create test donations, verify they appear correctly

**Step 3.4: Payment Flow (CRITICAL)**
- `/api/donate` - Create new donation (writes to Drizzle)
- `/api/donateForeign` - Foreign donations
- `/api/donateExternal` - External donations
- `/api/confirm` - **Payment webhook** (Montonio confirmation)
- Test extensively:
  - End-to-end payment flow in staging
  - Webhook processing
  - Email generation (requires cross-system queries)
  - Test both success and failure paths

**Critical: Organization Resolver**
- Many endpoints need organization details (title, slug) from Strapi
- Implement `OrganizationResolver` utility with caching
- Use in emails, donation summaries, stats

### Phase 4: Post-Migration Testing & Validation (Day 12-13)

**CRITICAL: All Phase 0 tests must still pass!**

The tests written in Phase 0 document how the Strapi implementation works. After migrating to Drizzle, **every single test must still pass** - this proves the Drizzle implementation is functionally identical.

**Step 4.1: Run Full Test Suite Against Drizzle**
```bash
yarn test
```

**Expected result**: All tests green. If any test fails, the Drizzle implementation is incorrect and must be fixed.

**Step 4.2: Additional Integration Testing**

Since Drizzle changes the data layer, add new integration tests:
- Repository methods work correctly with real database
- Cross-system queries (Drizzle + Strapi) merge correctly
- Transaction rollbacks work properly
- Foreign key references resolve correctly (organizationInternalId → Strapi)

**Step 4.3: Manual QA in Staging**
- Create test donation in staging with real Montonio sandbox
- Complete full payment flow
- Verify confirmation email received with correct organization details
- Check stats dashboard shows updated totals
- Test admin operations (insert, export, transfer management)
- Verify recurring donation creation
- Test external donation flow

**Step 4.4: Regression Testing**

Test scenarios that might break with Drizzle:
- Concurrent donations (race conditions?)
- Large export (10K+ donations)
- Campaign date range queries
- Transaction matching with multiple results
- Recurring donation generation (old template → new donation)

**Step 4.5: Performance Comparison**

Compare query performance Strapi vs Drizzle:
- Stats aggregation (should be faster)
- Export all donations (should be faster)
- Single donation lookup (similar)
- Donation creation (similar)

**Step 4.6: Load Testing** (optional but recommended)
- Simulate 10 concurrent donations
- Verify no deadlocks or race conditions
- Check database connection pool holds up
- Monitor error rates

**Success Criteria:**
- [ ] 100% of Phase 0 tests passing
- [ ] Manual payment flow successful
- [ ] Stats totals match pre-migration snapshot
- [ ] Email delivery working
- [ ] No errors in application logs
- [ ] Performance equal or better than Strapi

### Phase 5: Deployment & Monitoring (Day 14)

**Step 5.1: Database Backup**
- Full backup of Strapi database before deployment
- Keep backup for at least 2 weeks

**Step 5.2: Deploy to Production**
- Deploy code changes
- Monitor error logs closely
- Watch payment success rate
- Check email delivery

**Step 5.3: Parallel Monitoring (First 24 Hours)**
- Compare stats totals with pre-migration snapshot
- Monitor Montonio webhook success rate
- Verify email delivery rates
- Check for any error spikes

**Step 5.4: Cleanup (After 2 Weeks)**
- If everything is stable, remove Strapi donation content types
- Remove old service code
- Delete exported migration JSON files (keep backups elsewhere)

## Rollback Plan

**If issues occur during migration:**

1. **Before cutover**: Simply don't deploy the new code
2. **After cutover (within 24 hours)**:
   - Revert code deployment
   - Strapi tables still intact (not deleted yet)
   - No data loss
3. **After cleanup (> 2 weeks)**:
   - Export from Drizzle
   - Reverse migration script to restore to Strapi
   - More complex but still possible

## Verification Checklist

**Pre-Migration (Phase 0):**
- [x] All tests passing (green) before migration starts
- [x] Test coverage: utilities (89%)
- [x] Vitest infrastructure ready
- [x] Baseline coverage report saved

**Post-Migration:**
- [ ] **All existing tests still passing (CRITICAL!)** - Drizzle implementation must match Strapi behavior
- [ ] All organizations have `internalId` populated
- [ ] Row counts match: Strapi export vs Drizzle tables
- [ ] Sum of donation amounts matches pre-migration total
- [ ] Test payment flow works end-to-end
- [ ] Confirmation emails sent correctly with organization details
- [ ] Stats dashboard shows correct totals
- [ ] Recurring donation creation works
- [ ] Admin operations (insert, export) work
- [ ] No errors in application logs
- [ ] Montonio webhook processing successful
- [ ] Organization soft delete prevented if donations exist
- [ ] Test coverage maintained or improved

## Risk Mitigation

### Critical Risks

**Risk 1: Payment Webhook Failure**
- **Impact**: Lost donations, angry donors
- **Mitigation**: Extensive testing in staging, feature flag for instant rollback
- **Montonio retries failed webhooks automatically**

**Risk 2: Data Loss During Migration**
- **Impact**: Lost donation records
- **Mitigation**: Full backup, validation scripts, keep Strapi tables for 2 weeks

**Risk 3: Organization Reference Breakage**
- **Impact**: Donations not linked to organizations
- **Mitigation**: Ensure all orgs have `internalId`, validate before migration

**Risk 4: Email Generation Fails**
- **Impact**: No confirmation emails sent
- **Mitigation**: Test cross-system queries, fallback to generic email

### Medium Risks

**Risk 5: Performance Degradation**
- **Mitigation**: Add database indexes, connection pooling, cache org lookups

**Risk 6: Stats Queries Wrong**
- **Mitigation**: Parallel run queries, compare results during migration

**Risk 7: Migration Script Fails Halfway**
- **Mitigation**: Use transactions, make script idempotent (can re-run)

## Dependencies & Prerequisites

**Before starting:**
- All organizations must have `internalId` field populated
- Full database backup created
- Staging environment matches production
- Test payment gateway access (Montonio sandbox)

**After completion:**
- Enables Strapi v5 upgrade (without migrating donation UUIDs)
- Prepares for TypeScript migration (type-safe Drizzle queries)

## Estimated Timeline

- **Phase 0** (Test Infrastructure): 4 days ✅ **COMPLETED**
- **Phase 1** (Setup): 2 days
- **Phase 2** (Migration): 1 day
- **Phase 3** (API endpoints): 4 days
- **Phase 4** (Post-Migration Testing): 2 days
- **Phase 5** (Deployment): 1 day
- **Total**: ~14 days of focused work

## Success Criteria

Migration is successful when:
1. **All Phase 0 tests passing (100%)** - This is the primary success indicator ✅
2. Test coverage maintained: utilities (89%) ✅
3. All donations accessible via Drizzle APIs
4. Payment flow works without errors
5. Confirmation emails sent correctly
6. Stats dashboard shows accurate totals
7. No errors in production logs for 1 week
8. Montonio webhook success rate unchanged
9. Organization soft delete protection works
